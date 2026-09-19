"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getMaxPanelConfig,
  saveMaxPanelConfig,
  deleteMaxPanelConfig,
  getAllMaxPanelConfigs,
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

    const maxPanel = await getMaxPanelConfig(nomorMc, potonganKe);

    if (!data) {
      if (maxPanel) {
        return {
          success: true,
          data: { nomor_mc: nomorMc, potongan_ke: potonganKe, max_panel: maxPanel },
        };
      }
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        ...data,
        max_panel: maxPanel !== null ? maxPanel : data.max_panel || null,
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
    const { max_panel, input_type, ...cleanPayload } = data;

    // Save max_panel config if provided
    if (max_panel !== undefined && data.nomor_mc && data.potongan_ke) {
      if (Number(max_panel) > 0) {
        await saveMaxPanelConfig(data.nomor_mc, Number(max_panel), data.potongan_ke);
      } else {
        await deleteMaxPanelConfig(data.nomor_mc, data.potongan_ke);
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

export async function getAllProductionPlans(page: number = 1, limit: number = 20, search: string = "") {
  try {
    const supabase = await createClient();
    
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    let query = supabase
      .from("production_plans")
      .select("*", { count: "exact" });
      
    if (search) {
      query = query.ilike("nomor_mc", `%${search}%`);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const maxPanelRes = await getAllMaxPanelConfigs();
    const maxPanelMap = maxPanelRes.data || {};

    const enhancedData = (data || []).map((p: any) => {
      const mcUpper = String(p.nomor_mc || "").toUpperCase().trim();
      const specKey = `${mcUpper}:${p.potongan_ke}`;
      const maxPanel = maxPanelMap[specKey] || maxPanelMap[mcUpper] || p.max_panel || null;
      return {
        ...p,
        max_panel: maxPanel,
      };
    });

    return { success: true, data: enhancedData, total: count || 0 };
  } catch (err: any) {
    console.error("Error fetching all production plans:", err);
    return { success: false, error: err.message };
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
      .select("potongan_ke, design_id, pick, course, no_order_barang, no_customer, jenis_benang_dasar, liner, heavy, shadow, pinggiran, rpm, status_matching, pcs, tanggal_jam")
      .eq("nomor_mc", cleanMc)
      .not("design_id", "is", null)
      .neq("design_id", "")
      .neq("panel_no", "Downtime Mekanik (Direct)")
      .neq("panel_no", "BERHENTI")
      .order("tanggal_jam", { ascending: false })
      .limit(25);

    if (error) throw error;

    // Filter to get unique configurations based on potongan_ke and design_id
    const uniquePlans: any[] = [];
    const seen = new Set();
    
    if (data) {
      for (const row of data) {
        const key = `${row.potongan_ke}-${row.design_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniquePlans.push({
            id: row.potongan_ke + "-" + (row.design_id || ""), // synthetic ID for the dropdown
            nomor_mc: cleanMc,
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
          if (uniquePlans.length >= 5) break;
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

