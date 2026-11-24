"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getMaxPanelConfig,
  saveMaxPanelConfig,
  deleteMaxPanelConfig,
  getAllMaxPanelConfigs,
  getObTypeConfig,
  saveObTypeConfig,
  deleteObTypeConfig,
  getAllObTypeConfigs,
  upsertMachineConfig,
} from "./machine-config-actions";

export async function getProductionPlan(nomorMc: string, potonganKe: number) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("production_plans")
      .select("*")
      .eq("nomor_mc", nomorMc)
      .eq("potongan_ke", potonganKe)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Error fetching production plan:", error);
    }

    const [maxPanel, jenisOb] = await Promise.all([
      getMaxPanelConfig(nomorMc, potonganKe),
      getObTypeConfig(nomorMc, potonganKe),
    ]);

    if (!data) {
      if (maxPanel) {
        return {
          success: true,
          data: { nomor_mc: nomorMc, potongan_ke: potonganKe, max_panel: maxPanel, jenis_ob: jenisOb || "" },
        };
      }
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        ...data,
        max_panel: maxPanel !== null ? maxPanel : data.max_panel || null,
        jenis_ob: jenisOb || "",
      },
    };
  } catch (err: any) {
    console.error("Error fetching production plan:", err);
    return { success: false, error: err.message };
  }
}

export async function upsertProductionPlan(data: any) {
  try {
    const supabase = await createClient();
    const { max_panel, input_type, jenis_ob, workflow_status: _ws, ...cleanPayload } = data;

    // Save max_panel config if provided
    if (max_panel !== undefined && data.nomor_mc && data.potongan_ke) {
      if (Number(max_panel) > 0) {
        await saveMaxPanelConfig(data.nomor_mc, Number(max_panel), data.potongan_ke);
      } else {
        await deleteMaxPanelConfig(data.nomor_mc, data.potongan_ke);
      }
    }

    // Save jenis_ob config (STM / DJI) if provided, or delete to fall back to Auto
    if (jenis_ob !== undefined && data.nomor_mc && data.potongan_ke) {
      const cleanObType = String(jenis_ob || "").toUpperCase().trim();
      if (cleanObType === "STM" || cleanObType === "DJI") {
        await saveObTypeConfig(data.nomor_mc, data.potongan_ke, cleanObType);
      } else {
        await deleteObTypeConfig(data.nomor_mc, data.potongan_ke);
      }
    }

    if (input_type && data.nomor_mc) {
      // Retain the machine's configured default_pcs if already set in machine_configs
      const { data: mcData } = await supabase
        .from("machine_configs")
        .select("default_pcs")
        .eq("nomor_mc", data.nomor_mc.trim())
        .maybeSingle();

      const defaultPcsToKeep =
        mcData?.default_pcs !== undefined && mcData?.default_pcs !== null
          ? Number(mcData.default_pcs)
          : Number(data.pcs_count || 1);

      await upsertMachineConfig(data.nomor_mc, defaultPcsToKeep, input_type);
    }

    // Check if plan already exists in production_plans
    const { data: existing, error: fetchError } = await supabase
      .from("production_plans")
      .select("id")
      .eq("nomor_mc", cleanPayload.nomor_mc)
      .eq("potongan_ke", cleanPayload.potongan_ke)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    let result;
    if (existing) {
      // Update
      const { data: updated, error } = await supabase
        .from("production_plans")
        .update(cleanPayload)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      result = updated;
    } else {
      // Insert
      const { data: inserted, error } = await supabase
        .from("production_plans")
        .insert(cleanPayload)
        .select()
        .single();

      if (error) throw error;
      result = inserted;
    }

    return {
      success: true,
      data: {
        ...result,
        max_panel: max_panel ? Number(max_panel) : null,
      },
    };
  } catch (err: any) {
    console.error("Error upserting production plan:", err);
    return { success: false, error: err.message };
  }
}

export interface DuplicatePotonganConflict {
  potongan_ke: number;
  inPlan: boolean;
  inProduction: boolean;
  planDesignId?: string | null;
  planNoOrder?: string | null;
  prodDesignId?: string | null;
  prodNoOrder?: string | null;
}

/**
 * Mengecek apakah kombinasi nomor_mc + daftar potongan_ke sudah pernah
 * dijadwalkan (production_plans) dan/atau sudah pernah diproduksi (production_headers).
 */
export async function checkDuplicateProductionPlans(
  nomorMc: string,
  potonganList: number[],
  excludePlanId?: string
): Promise<{
  success: boolean;
  conflicts: DuplicatePotonganConflict[];
  error?: string;
}> {
  try {
    const cleanMc = nomorMc?.trim();
    const uniquePots = Array.from(
      new Set(
        (potonganList || [])
          .map((p) => Number(p))
          .filter((p) => Number.isInteger(p) && p > 0)
      )
    ).slice(0, 105);

    if (!cleanMc || uniquePots.length === 0) {
      return { success: true, conflicts: [] };
    }

    const supabase = await createClient();

    // 1. Cek di production_plans
    const plansPromise = supabase
      .from("production_plans")
      .select("id, potongan_ke, design_id, no_order_barang")
      .eq("nomor_mc", cleanMc)
      .in("potongan_ke", uniquePots);

    // 2. Cek di production_headers (riwayat produksi aktual)
    const fetchProdRows = async () => {
      if (uniquePots.length === 1) {
        const { data, error } = await supabase
          .from("production_headers")
          .select("potongan_ke, design_id, no_order_barang")
          .eq("nomor_mc", cleanMc)
          .eq("potongan_ke", uniquePots[0])
          .neq("panel_no", "Downtime Mekanik (Direct)")
          .neq("panel_no", "BERHENTI")
          .order("tanggal_jam", { ascending: false })
          .limit(1);
        if (error) throw error;
        return data || [];
      }

      const collected: any[] = [];
      const foundPots = new Set<number>();
      const pageSize = 1000;
      for (let page = 0; page < 10; page++) {
        const from = page * pageSize;
        const { data, error } = await supabase
          .from("production_headers")
          .select("potongan_ke, design_id, no_order_barang")
          .eq("nomor_mc", cleanMc)
          .in("potongan_ke", uniquePots)
          .neq("panel_no", "Downtime Mekanik (Direct)")
          .neq("panel_no", "BERHENTI")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = data || [];
        for (const row of batch) {
          const pot = Number(row.potongan_ke);
          if (!foundPots.has(pot)) {
            foundPots.add(pot);
            collected.push(row);
          }
        }
        if (batch.length < pageSize || foundPots.size >= uniquePots.length) {
          break;
        }
      }
      return collected;
    };

    const [plansRes, prodRows] = await Promise.all([plansPromise, fetchProdRows()]);
    if (plansRes.error) throw plansRes.error;

    const conflictMap = new Map<number, DuplicatePotonganConflict>();

    for (const row of plansRes.data || []) {
      if (excludePlanId && String(row.id) === String(excludePlanId)) continue;
      const pot = Number(row.potongan_ke);
      conflictMap.set(pot, {
        potongan_ke: pot,
        inPlan: true,
        inProduction: false,
        planDesignId: row.design_id || null,
        planNoOrder: row.no_order_barang || null,
      });
    }

    for (const row of prodRows || []) {
      const pot = Number(row.potongan_ke);
      const existing = conflictMap.get(pot);
      if (existing) {
        existing.inProduction = true;
        if (!existing.prodDesignId && row.design_id) existing.prodDesignId = row.design_id;
        if (!existing.prodNoOrder && row.no_order_barang) existing.prodNoOrder = row.no_order_barang;
      } else {
        conflictMap.set(pot, {
          potongan_ke: pot,
          inPlan: false,
          inProduction: true,
          prodDesignId: row.design_id || null,
          prodNoOrder: row.no_order_barang || null,
        });
      }
    }

    const conflicts = Array.from(conflictMap.values()).sort(
      (a, b) => a.potongan_ke - b.potongan_ke
    );

    return { success: true, conflicts };
  } catch (err: any) {
    console.error("Error checking duplicate production plans:", err);
    return { success: false, conflicts: [], error: err.message };
  }
}

/**
 * Menjadwalkan beberapa potongan sekaligus (Batch Range)
 * Contoh: dari potongan 100 s/d 110 dengan spek yang sama
 */
export async function upsertBatchProductionPlans(
  data: any,
  fromPot: number,
  toPot: number,
  options?: { skipPotongans?: number[] }
) {
  try {
    const supabase = await createClient();
    const { max_panel, input_type, jenis_ob, workflow_status: _ws, id, potongan_ke, ...cleanPayload } = data;

    const start = Math.min(fromPot, toPot);
    const end = Math.max(fromPot, toPot);

    if (isNaN(start) || isNaN(end) || start <= 0) {
      return { success: false, error: "Nomor potongan harus berupa angka bulat positif." };
    }

    if (end - start > 100) {
      return { success: false, error: "Maksimal rentang 100 potongan dalam sekali input." };
    }

    if (!cleanPayload.nomor_mc) {
      return { success: false, error: "Nomor mesin belum ditentukan." };
    }

    // 1. Update machine config (input_type / default_pcs) jika disediakan
    if (input_type && cleanPayload.nomor_mc) {
      const { data: mcData } = await supabase
        .from("machine_configs")
        .select("default_pcs")
        .eq("nomor_mc", cleanPayload.nomor_mc.trim())
        .maybeSingle();

      const defaultPcsToKeep =
        mcData?.default_pcs !== undefined && mcData?.default_pcs !== null
          ? Number(mcData.default_pcs)
          : Number(data.pcs_count || 1);

      await upsertMachineConfig(cleanPayload.nomor_mc, defaultPcsToKeep, input_type);
    }

    // 2. Ambil list potongan yang akan diproses (dikurangi skipPotongans bila diminta)
    const skipSet = new Set(
      (options?.skipPotongans || []).map((p) => Number(p)).filter((p) => !isNaN(p))
    );
    const potonganList: number[] = [];
    for (let p = start; p <= end; p++) {
      if (!skipSet.has(p)) {
        potonganList.push(p);
      }
    }

    if (potonganList.length === 0) {
      return {
        success: false,
        error: "Semua potongan dalam rentang ini sudah ada. Tidak ada jadwal baru untuk disimpan.",
      };
    }

    const { data: existingList, error: fetchErr } = await supabase
      .from("production_plans")
      .select("id, potongan_ke")
      .eq("nomor_mc", cleanPayload.nomor_mc)
      .in("potongan_ke", potonganList);

    if (fetchErr) throw fetchErr;

    const existingMap = new Map<number, string>();
    (existingList || []).forEach((row: any) => {
      existingMap.set(Number(row.potongan_ke), row.id);
    });

    const updates: any[] = [];
    const inserts: any[] = [];

    for (const pot of potonganList) {
      const payloadItem = {
        ...cleanPayload,
        potongan_ke: pot,
        updated_at: new Date().toISOString(),
      };

      if (existingMap.has(pot)) {
        updates.push({ id: existingMap.get(pot), ...payloadItem });
      } else {
        inserts.push(payloadItem);
      }
    }

    // Jalankan updates
    for (const item of updates) {
      const { id: itemId, ...itemData } = item;
      const { error: updErr } = await supabase
        .from("production_plans")
        .update(itemData)
        .eq("id", itemId);
      if (updErr) throw updErr;
    }

    // Jalankan inserts secara batch
    if (inserts.length > 0) {
      const { error: insErr } = await supabase
        .from("production_plans")
        .insert(inserts);
      if (insErr) throw insErr;
    }

    // Simpan konfigurasi max_panel untuk setiap potongan
    if (max_panel !== undefined && cleanPayload.nomor_mc) {
      const maxPanelPromises = potonganList.map((pot) => {
        if (Number(max_panel) > 0) {
          return saveMaxPanelConfig(cleanPayload.nomor_mc, Number(max_panel), pot);
        } else {
          return deleteMaxPanelConfig(cleanPayload.nomor_mc, pot);
        }
      });
      await Promise.all(maxPanelPromises);
    }

    // Simpan konfigurasi jenis_ob (STM / DJI) untuk setiap potongan
    if (jenis_ob !== undefined && cleanPayload.nomor_mc) {
      const cleanObType = String(jenis_ob || "").toUpperCase().trim();
      const obTypePromises = potonganList.map((pot) => {
        if (cleanObType === "STM" || cleanObType === "DJI") {
          return saveObTypeConfig(cleanPayload.nomor_mc, pot, cleanObType);
        } else {
          return deleteObTypeConfig(cleanPayload.nomor_mc, pot);
        }
      });
      await Promise.all(obTypePromises);
    }

    return {
      success: true,
      count: potonganList.length,
      skippedCount: end - start + 1 - potonganList.length,
      savedPotongans: potonganList,
      from: start,
      to: end,
    };
  } catch (err: any) {
    console.error("Error in upsertBatchProductionPlans:", err);
    return { success: false, error: err.message || "Gagal menyimpan jadwal batch." };
  }
}

export type PlanWorkflowStatus = "PLANNED" | "IN_PRODUCTION" | "INSPECTED" | "COMPLETED";

export type PlanSortBy = "NEWEST" | "POTONGAN_ASC" | "POTONGAN_DESC";

export interface GetProductionPlansOptions {
  statusFilter?: "ACTIVE" | "COMPLETED" | "ALL";
  machineGroup?: "ALL" | "RASCHEL" | "TRICOTE";
  machineNo?: string;
  sortBy?: PlanSortBy;
}

export async function getAllProductionPlans(
  page: number = 1,
  limit: number = 20,
  search: string = "",
  options: GetProductionPlansOptions = {}
) {
  try {
    const supabase = await createClient();
    const {
      statusFilter = "ACTIVE",
      machineGroup = "ALL",
      machineNo = "",
      sortBy = "NEWEST",
    } = options;

    let query = supabase
      .from("production_plans")
      .select("*");

    if (machineNo && machineNo !== "ALL") {
      query = query.ilike("nomor_mc", machineNo.trim());
    } else if (machineGroup === "RASCHEL") {
      query = query.ilike("nomor_mc", "R%");
    } else if (machineGroup === "TRICOTE") {
      query = query.ilike("nomor_mc", "T%");
    }

    const { data: allMatchingPlans, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;

    let rows: any[] = allMatchingPlans || [];

    if (search.trim()) {
      const qLower = search.trim().toLowerCase();
      // Support multi-token search (e.g. "R1 625", "pot 625", "potongan 625", "625", "WLD 6923")
      const potOnlyMatch = qLower.match(/^(?:potongan|pot)\.?\s*(\d+)$/);
      const tokens = qLower.split(/\s+/).filter(Boolean);

      rows = rows.filter((p: any) => {
        const mc = String(p.nomor_mc || "").toLowerCase();
        const pot = String(p.potongan_ke ?? "").toLowerCase();
        const design = String(p.design_id || "").toLowerCase();
        const order = String(p.no_order_barang || "").toLowerCase();
        const cust = String(p.no_customer || "").toLowerCase();

        if (potOnlyMatch) {
          return pot.includes(potOnlyMatch[1]);
        }

        const combined = `${mc} ${pot} pot ${pot} potongan ${pot} ${design} ${order} ${cust}`;
        return (
          mc.includes(qLower) ||
          pot.includes(qLower) ||
          design.includes(qLower) ||
          order.includes(qLower) ||
          cust.includes(qLower) ||
          (tokens.length > 1 && tokens.every((t) => combined.includes(t)))
        );
      });
    }

    // Fetch live progress status for matching machines in parallel
    const uniqueMachines = Array.from(
      new Set(rows.map((r) => String(r.nomor_mc || "").trim().toUpperCase()).filter(Boolean))
    );

    const [maxPanelRes, prodRes, qcRes, mendingRes] = await Promise.all([
      getAllMaxPanelConfigs(),
      uniqueMachines.length > 0
        ? supabase
          .from("production_headers")
          .select("nomor_mc, potongan_ke")
          .in("nomor_mc", uniqueMachines)
        : Promise.resolve({ data: [] }),
      uniqueMachines.length > 0
        ? supabase
          .from("qc_inspection_batches")
          .select("nomor_mc, potongan_ke")
          .in("nomor_mc", uniqueMachines)
        : Promise.resolve({ data: [] }),
      uniqueMachines.length > 0
        ? supabase
          .from("mending_batches")
          .select("nomor_mc, potongan_ke")
          .in("nomor_mc", uniqueMachines)
        : Promise.resolve({ data: [] }),
    ]);

    const maxPanelMap = maxPanelRes.data || {};
    const obTypeRes = await getAllObTypeConfigs();
    const obTypeMap = obTypeRes.data || {};
    const toKey = (mc: any, pot: any) =>
      `${String(mc || "").trim().toUpperCase()}::${Number(pot)}`;

    const prodSet = new Set((prodRes.data || []).map((r: any) => toKey(r.nomor_mc, r.potongan_ke)));
    const qcSet = new Set((qcRes.data || []).map((r: any) => toKey(r.nomor_mc, r.potongan_ke)));
    const mendingSet = new Set(
      (mendingRes.data || []).map((r: any) => toKey(r.nomor_mc, r.potongan_ke))
    );

    const enhancedAll = rows.map((p: any) => {
      const mcUpper = String(p.nomor_mc || "").toUpperCase().trim();
      const specKey = `${mcUpper}:${p.potongan_ke}`;
      const maxPanel = maxPanelMap[specKey] || maxPanelMap[mcUpper] || p.max_panel || null;
      const jenisOb = obTypeMap[specKey] || "";
      const key = toKey(mcUpper, p.potongan_ke);

      let workflow_status: PlanWorkflowStatus = "PLANNED";
      if (mendingSet.has(key)) {
        workflow_status = "COMPLETED";
      } else if (qcSet.has(key)) {
        workflow_status = "INSPECTED";
      } else if (prodSet.has(key)) {
        workflow_status = "IN_PRODUCTION";
      }

      return {
        ...p,
        max_panel: maxPanel,
        jenis_ob: jenisOb,
        workflow_status,
      };
    });

    const activeCount = enhancedAll.filter((p) => p.workflow_status !== "COMPLETED").length;
    const completedCount = enhancedAll.length - activeCount;

    const filteredByStatus = enhancedAll.filter((p) => {
      if (statusFilter === "ACTIVE") return p.workflow_status !== "COMPLETED";
      if (statusFilter === "COMPLETED") return p.workflow_status === "COMPLETED";
      return true;
    });

    if (sortBy === "POTONGAN_ASC") {
      filteredByStatus.sort((a, b) => {
        const diff = (Number(a.potongan_ke) || 0) - (Number(b.potongan_ke) || 0);
        if (diff !== 0) return diff;
        return String(a.nomor_mc || "").localeCompare(String(b.nomor_mc || ""), undefined, { numeric: true });
      });
    } else if (sortBy === "POTONGAN_DESC") {
      filteredByStatus.sort((a, b) => {
        const diff = (Number(b.potongan_ke) || 0) - (Number(a.potongan_ke) || 0);
        if (diff !== 0) return diff;
        return String(a.nomor_mc || "").localeCompare(String(b.nomor_mc || ""), undefined, { numeric: true });
      });
    }

    const total = filteredByStatus.length;
    const from = (page - 1) * limit;
    const pagedData = filteredByStatus.slice(from, from + limit);

    return {
      success: true,
      data: pagedData,
      total,
      counts: {
        active: activeCount,
        completed: completedCount,
        all: enhancedAll.length,
      },
    };
  } catch (err: any) {
    console.error("Error fetching all production plans:", err);
    return { success: false, error: err.message };
  }
}

export async function getProductionPlansByRange(params: {
  nomorMc: string;
  fromPotongan: number;
  toPotongan: number;
}) {
  try {
    const supabase = await createClient();
    const mc = String(params.nomorMc || "").trim().toUpperCase();
    const start = Math.min(Number(params.fromPotongan) || 0, Number(params.toPotongan) || 0);
    const end = Math.max(Number(params.fromPotongan) || 0, Number(params.toPotongan) || 0);

    if (!mc || start <= 0 || end <= 0) {
      return { success: false, error: "Mesin dan range potongan wajib diisi dengan angka valid.", data: [] };
    }
    if (end - start > 200) {
      return { success: false, error: "Maksimal range sekali cetak adalah 200 potongan.", data: [] };
    }

    const { data, error } = await supabase
      .from("production_plans")
      .select("*")
      .ilike("nomor_mc", mc)
      .gte("potongan_ke", start)
      .lte("potongan_ke", end)
      .order("potongan_ke", { ascending: true });

    if (error) throw error;

    return {
      success: true,
      data: data || [],
    };
  } catch (err: any) {
    console.error("Error fetching production plans by range:", err);
    return { success: false, error: err.message || "Gagal mengambil data range potongan.", data: [] };
  }
}

export async function deleteProductionPlan(id: string) {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("production_plans")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error("Error deleting production plan:", err);
    return { success: false, error: err.message };
  }
}

export async function getRecentPlansByMachine(nomorMc: string) {
  try {
    const supabase = await createClient();
    const cleanMc = nomorMc?.trim();
    if (!cleanMc) return { success: true, data: [] };

    // Fetch records from ACTUAL production history
    const { data, error } = await supabase
      .from("production_headers")
      .select("tgl, potongan_ke, design_id, pick, course, no_order_barang, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran, rpm, status_matching, pcs, tanggal_jam")
      .eq("nomor_mc", cleanMc)
      .not("design_id", "is", null)
      .neq("design_id", "")
      .neq("panel_no", "Downtime Mekanik (Direct)")
      .neq("panel_no", "BERHENTI")
      .order("tanggal_jam", { ascending: false })
      .limit(60);

    if (error) throw error;

    // Filter to get unique configurations based on potongan_ke and design_id
    const uniquePlans: any[] = [];
    const seen = new Set();

    if (data) {
      for (const row of data) {
        const key = `${row.potongan_ke ?? ""}-${row.design_id ?? ""}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniquePlans.push({
            id: `${row.potongan_ke ?? "none"}-${row.design_id || ""}`, // synthetic ID for the dropdown
            nomor_mc: cleanMc,
            tgl: row.tgl || (row.tanggal_jam ? String(row.tanggal_jam).slice(0, 10) : ""),
            potongan_ke: row.potongan_ke,
            design_id: row.design_id,
            pick: row.pick,
            course: row.course,
            no_order_barang: row.no_order_barang,
            no_customer: row.no_customer,
            jenis_benang_dasar: row.jenis_benang_dasar,
            liner: row.liner,
            heavy: row.heavy,
            shadow: row.shadow,
            pinggiran: row.pinggiran,
            rpm: row.rpm ? String(row.rpm) : "",
            status_matching: row.status_matching || "",
            pcs: row.pcs || null,
          });
          if (uniquePlans.length >= 10) break;
        }
      }
    }

    return { success: true, data: uniquePlans };
  } catch (err: any) {
    console.error("Error fetching recent plans:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Mengambil data header terakhir untuk suatu mesin (nomorMc).
 * Jika potonganKe ditentukan:
 * 1. Mengambil dari production_plans jika admin sudah mengatur jadwal khusus potongan tersebut.
 * 2. Mengambil dari production_headers untuk potongan tersebut jika sudah pernah diisi.
 * Jika tidak ditemukan atau potonganKe tidak ditentukan:
 * 3. Mengambil record valid terakhir dari production_headers untuk mesin tersebut (potongan terakhir).
 * 4. Fallback ke production_plans terakhir jika tabel history masih kosong.
 */
export async function getLatestMachineHeader(nomorMc: string, potonganKe?: number) {
  try {
    const supabase = await createClient();
    const cleanMc = nomorMc?.trim();
    if (!cleanMc) {
      return { success: true, data: null };
    }

    // 1. Jika potonganKe ditentukan, utamakan production_plans khusus potongan ini
    if (potonganKe && !isNaN(potonganKe)) {
      const { data: planData } = await supabase
        .from("production_plans")
        .select("*")
        .eq("nomor_mc", cleanMc)
        .eq("potongan_ke", potonganKe)
        .maybeSingle();

      if (planData) {
        const maxPanelRes = await getMaxPanelConfig(cleanMc, potonganKe);
        return {
          success: true,
          data: {
            ...planData,
            max_panel: maxPanelRes !== null ? maxPanelRes : planData.max_panel || null,
            source: "plan",
          },
        };
      }

      // Cek apakah ada riwayat untuk potongan_ke yang sama persis
      const { data: headerForPotongan } = await supabase
        .from("production_headers")
        .select("potongan_ke, design_id, pick, course, no_order_barang, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran, rpm, status_matching, pcs")
        .eq("nomor_mc", cleanMc)
        .eq("potongan_ke", potonganKe)
        .not("design_id", "is", null)
        .neq("design_id", "")
        .neq("panel_no", "Downtime Mekanik (Direct)")
        .neq("panel_no", "BERHENTI")
        .order("tanggal_jam", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (headerForPotongan) {
        const maxPanelRes = await getMaxPanelConfig(cleanMc, potonganKe);
        return {
          success: true,
          data: {
            ...headerForPotongan,
            max_panel: maxPanelRes,
            source: "history_exact_potongan",
          },
        };
      }
    }

    // 2. Ambil data produksi riwayat terakhir dari mesin ini
    const { data: latestHeader } = await supabase
      .from("production_headers")
      .select("potongan_ke, design_id, pick, course, no_order_barang, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran, rpm, status_matching, pcs, tanggal_jam")
      .eq("nomor_mc", cleanMc)
      .not("design_id", "is", null)
      .neq("design_id", "")
      .neq("panel_no", "Downtime Mekanik (Direct)")
      .neq("panel_no", "BERHENTI")
      .order("tanggal_jam", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestHeader) {
      const potNo = Number(latestHeader.potongan_ke) || undefined;
      const maxPanelRes = potNo ? await getMaxPanelConfig(cleanMc, potNo) : null;
      return {
        success: true,
        data: {
          ...latestHeader,
          max_panel: maxPanelRes,
          source: "latest_history",
        },
      };
    }

    // 3. Fallback: ambil dari production_plans terakhir untuk mesin ini jika tabel production_headers kosong
    const { data: latestPlan } = await supabase
      .from("production_plans")
      .select("*")
      .eq("nomor_mc", cleanMc)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestPlan) {
      const potNo = Number(latestPlan.potongan_ke) || undefined;
      const maxPanelRes = potNo ? await getMaxPanelConfig(cleanMc, potNo) : null;
      return {
        success: true,
        data: {
          ...latestPlan,
          max_panel: maxPanelRes !== null ? maxPanelRes : latestPlan.max_panel || null,
          source: "latest_plan",
        },
      };
    }

    return { success: true, data: null };
  } catch (err: any) {
    console.error("Error in getLatestMachineHeader:", err);
    return { success: false, error: err.message };
  }
}

