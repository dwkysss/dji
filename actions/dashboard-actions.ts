"use server";

import { createClient } from "@/lib/supabase/server";
import { getShiftDate } from "@/lib/shift-utils";

export interface RealProductionItem {
  id: string;
  tanggal: string;
  hari: string;
  header_id: string;
  panel_no?: number;
  panel_no_str?: string;
  is_dummy_downtime?: boolean;
  potongan_ke?: string;
  nama_operator: string;
  mesin_id: string;
  hasil_pcs: number;
  hasil_meter?: number;
  posisi_meter?: number;
  target_pcs: number;
  status_qc: "Lolos" | "Recheck";
  rpm_mesin: number;
  grade: "GRADE A" | "GRADE B" | "BS" | "UNGRADED";
  design: string;
  group?: string;
  is_production: boolean;
  total_downtime_detik?: number;
  kategori_masalah?: string;
  detail_masalah?: string;
  keterangan_cacat?: string;
}

const DAYS_MAP = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"];

function getHariFromTanggal(tglStr: string): string {
  try {
    const d = new Date(tglStr);
    if (isNaN(d.getTime())) return "SEN";
    return DAYS_MAP[d.getDay()] || "SEN";
  } catch {
    return "SEN";
  }
}



export async function getRealProductionsData(): Promise<{
  success: boolean;
  data?: RealProductionItem[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateLimit = thirtyDaysAgo.toISOString().split("T")[0];

    // Query 1: Get dashboard view data
    const { data, error } = await supabase
      .from("dashboard_production_view")
      .select("*")
      .gte("tanggal", dateLimit)
      .order("tanggal", { ascending: false });

    if (error) {
      console.error("Dashboard error fetching dashboard_production_view:", error);
      throw error;
    }

    // Query 2: Fetch header timestamps for exact shift date attribution
    const headerIds = Array.from(
      new Set(
        (data || [])
          .map((item: any) => item.header_id)
          .filter(Boolean),
      ),
    );

    const headerTimeMap = new Map<string, string>();
    if (headerIds.length > 0) {
      const { data: headersData } = await supabase
        .from("production_headers")
        .select("id, tanggal_jam")
        .in("id", headerIds);

      (headersData || []).forEach((h: any) => {
        if (h.id && h.tanggal_jam) {
          headerTimeMap.set(String(h.id), String(h.tanggal_jam));
        }
      });
    }

    const mappedData: RealProductionItem[] = (data || []).map((item: any) => {
      const isProduction = (item.hasil_pcs || 0) > 0 || (item.posisi_meter || 0) > 0 || (item.hasil_meter || 0) > 0;
      
      const mesinId = item.mesin_id || `KNIT-001`;
      
      const actualOperator = item.pic || item.nama_operator || item.created_by_name || "Operator Unknown";

      const rawPanelNo = item.panel_no ? String(item.panel_no).trim() : "";
      const isDummyDowntime = rawPanelNo.includes("Downtime") || rawPanelNo === "BERHENTI";
      const parsedPanelNo = !isNaN(parseInt(rawPanelNo)) ? parseInt(rawPanelNo) : undefined;
      
      const headerTs = headerTimeMap.get(String(item.header_id));
      const targetTs = item.tanggal_jam || item.created_at || headerTs || item.tanggal;
      const shiftTanggal = getShiftDate(targetTs);

      return {
        id: item.id || `header_${item.header_id}_${Math.random().toString().slice(2, 8)}`,
        header_id: String(item.header_id),
        panel_no: parsedPanelNo,
        panel_no_str: rawPanelNo,
        is_dummy_downtime: isDummyDowntime,
        potongan_ke: item.potongan_ke || undefined,
        tanggal: shiftTanggal,
        hari: getHariFromTanggal(shiftTanggal),
        nama_operator: actualOperator,
        mesin_id: mesinId,
        hasil_pcs: item.hasil_pcs || 0,
        hasil_meter: item.hasil_meter || 0,
        posisi_meter: item.posisi_meter || 0,
        target_pcs: item.target_pcs || 0,
        status_qc: item.status_qc as "Lolos" | "Recheck",
        rpm_mesin: item.rpm_mesin || 800,
        grade: item.grade as "GRADE A" | "GRADE B" | "BS" | "UNGRADED",
        design: item.design || "Tanpa Design",
        group: item.group || "Tanpa Group",
        is_production: isProduction,
        total_downtime_detik: item.total_downtime_detik || 0,
        kategori_masalah: item.kategori_masalah || undefined,
        detail_masalah: item.detail_masalah || undefined,
        keterangan_cacat: item.keterangan_cacat || undefined,
      };
    });

    return { success: true, data: mappedData };
  } catch (err: any) {
    console.error("Dashboard server action error:", err);
    return { success: false, error: err.message || "Failed to load live data." };
  }
}

export interface MachineStatus {
  mesin_id: string;
  status: "Beroperasi" | "Idle" | "Tidak Aktif";
  nama_operator: string;
  design: string;
  potongan_ke?: number | string;
  last_input_date: string;
  last_input_time?: string;
}

export async function getMachineStatuses(): Promise<{ success: boolean; data?: MachineStatus[]; error?: string }> {
  try {
    const supabase = await createClient();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateLimit = thirtyDaysAgo.toISOString().split("T")[0];

    // Query production_headers and join operators to get the operator's name
    const { data, error } = await supabase
      .from("production_headers")
      .select("nomor_mc, tgl, design_id, potongan_ke, tanggal_jam, operators(nama_operator), created_by_name, pic")
      .gte("tgl", dateLimit)
      .order("tanggal_jam", { ascending: false });

    if (error) {
      console.error("Error fetching machine statuses:", error);
      throw error;
    }

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    
    // Create a map to store the latest record for each machine from DB
    const latestPerMachine = new Map<string, any>();
    (data || []).forEach((row: any) => {
      if (row.nomor_mc && !latestPerMachine.has(row.nomor_mc)) {
        latestPerMachine.set(row.nomor_mc, row);
      }
    });

    const ALL_MACHINES = ["R1", "R2", "R3B", "R1C", "R2C", "R11", "R12", "R16", "T1C", "T2A", "Warping D6", "Winding"];
    
    const results: MachineStatus[] = ALL_MACHINES.map((mesin_id) => {
      const row = latestPerMachine.get(mesin_id);
      
      if (!row) {
        return {
          mesin_id,
          status: "Tidak Aktif",
          nama_operator: "-",
          design: "-",
          potongan_ke: "-",
          last_input_date: "-",
          last_input_time: "-"
        };
      }

      let lastTime = "-";
      let status: "Beroperasi" | "Idle" | "Tidak Aktif" = "Tidak Aktif";

      if (row.tanggal_jam) {
        const dateObj = new Date(row.tanggal_jam);
        if (!isNaN(dateObj.getTime())) {
          lastTime = dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(/:/g, ".");
          
          const diffMs = now.getTime() - dateObj.getTime();
          const diffMinutes = Math.floor(diffMs / 60000);
          
          if (row.tgl === today) {
            if (diffMinutes <= 10) {
              status = "Beroperasi";
            } else {
              status = "Idle";
            }
          } else {
            status = "Tidak Aktif";
          }
        } else {
          lastTime = row.tanggal_jam.split(/[ T]/)[1]?.slice(0, 5) || "-";
          status = row.tgl === today ? "Idle" : "Tidak Aktif";
        }
      }
      
      return {
        mesin_id,
        status,
        nama_operator: (row.operators as any)?.nama_operator || row.pic || row.created_by_name || "-",
        design: row.design_id || "-",
        potongan_ke: row.potongan_ke || "-",
        last_input_date: row.tgl,
        last_input_time: lastTime
      };
    });

    // Sort machines alphabetically
    results.sort((a, b) => a.mesin_id.localeCompare(b.mesin_id));

    return { success: true, data: results };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load machine statuses." };
  }
}

export interface BlockProblemItem {
  id: string;
  tgl: string;
  tanggal_jam: string;
  nomor_mc: string;
  potongan_ke: string;
  panel_no?: string;
  blok: string;
  operator: string;
  kategori: string;
  detail_masalah: string;
  durasi_detik: number;
  sumber: "Downtime" | "Cacat Produksi" | "QC";
}

export interface BlockSummary {
  blok: string;
  total_kejadian: number;
  total_durasi_detik: number;
  kategori_utama: string;
  operator_terbanyak: string;
  masalah_list: BlockProblemItem[];
}

export async function getMachineBlockAnalytics(nomorMc: string, daysBack: number = 30): Promise<{
  success: boolean;
  summary?: BlockSummary[];
  allEvents?: BlockProblemItem[];
  stats?: {
    totalProblems: number;
    totalDurationSec: number;
    topProblematicBlock: string;
    topCategory: string;
  };
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - daysBack);
    const dateLimitStr = dateLimit.toISOString().split("T")[0];

    // Query headers for the specific machine
    const { data: headers, error: headersErr } = await supabase
      .from("production_headers")
      .select("id, nomor_mc, potongan_ke, panel_no, downtime_events, total_downtime_detik, tanggal_jam, operators(nama_operator), groups(nama_grup), pic, created_by_name, production_details(kategori_masalah, detail_masalah)")
      .ilike("nomor_mc", nomorMc)
      .gte("tgl", dateLimitStr)
      .order("tanggal_jam", { ascending: false });

    if (headersErr) {
      console.error("Error fetching headers for block analytics:", headersErr);
    }

    const allEvents: BlockProblemItem[] = [];

    (headers || []).forEach((p: any) => {
      const oprName = (p.operators as any)?.nama_operator || p.pic || p.created_by_name || "Operator";
      const shiftName = (p.groups as any)?.nama_grup ? `Shift ${(p.groups as any).nama_grup}` : "";
      const fullOperator = shiftName ? `(${shiftName}) ${oprName}` : oprName;
      const tglStr = p.tanggal_jam ? new Date(p.tanggal_jam).toISOString().split("T")[0] : "-";
      const timeStr = p.tanggal_jam ? new Date(p.tanggal_jam).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(/:/g, ".") : "-";

      // 1. Parse downtime_events JSON
      if (p.downtime_events) {
        let dtArray: any[] = [];
        try {
          dtArray = typeof p.downtime_events === "string" ? JSON.parse(p.downtime_events) : p.downtime_events;
        } catch (e) {}

        if (Array.isArray(dtArray)) {
          dtArray.forEach((ev: any, idx: number) => {
            const durationSec = parseInt(ev.durasiDetik || ev.durasi) || 0;
            const evOperator = ev.dikerjakanOleh || fullOperator;

            if (Array.isArray(ev.problems) && ev.problems.length > 0) {
              ev.problems.forEach((prob: any, pIdx: number) => {
                let rawBlok = prob.blok || prob.noBlok || "";
                
                // Fallback: try regex match from detail/kategori
                if (!rawBlok) {
                  const combinedText = `${prob.kategori || ""} ${Array.isArray(prob.details) ? prob.details.join(" ") : (prob.details || "")}`;
                  const match = combinedText.match(/(?:blok|block)\s*([0-9\-]+)/i);
                  if (match) rawBlok = match[1];
                }

                let formattedBlok = "Umum / Non-Blok";
                if (rawBlok) {
                  const cleaned = String(rawBlok).trim();
                  formattedBlok = /^\d+/.test(cleaned) ? `Blok ${cleaned}` : cleaned;
                }

                const detailStr = Array.isArray(prob.details) ? prob.details.join(", ") : (prob.details || "-");
                const katStr = prob.kategori || "Downtime";

                allEvents.push({
                  id: `${p.id}-dt-${idx}-${pIdx}`,
                  tgl: tglStr,
                  tanggal_jam: `${tglStr} ${timeStr}`,
                  nomor_mc: p.nomor_mc,
                  potongan_ke: String(p.potongan_ke || "-"),
                  panel_no: String(p.panel_no || "-"),
                  blok: formattedBlok,
                  operator: evOperator,
                  kategori: katStr,
                  detail_masalah: detailStr,
                  durasi_detik: durationSec,
                  sumber: "Downtime"
                });
              });
            }
          });
        }
      } 
      
      // 2. Parse production_details
      if (Array.isArray(p.production_details)) {
        p.production_details.forEach((det: any, dIdx: number) => {
          let rawBlok = "";
          const combinedText = `${det.kategori_masalah || ""} ${det.detail_masalah || ""}`;
          const match = combinedText.match(/(?:blok|block)\s*([0-9\-]+)/i);
          if (match) rawBlok = match[1];

          if (rawBlok || det.kategori_masalah || det.detail_masalah) {
             let formattedBlok = rawBlok ? (`Blok ${rawBlok.trim()}`) : "Umum / Non-Blok";

             allEvents.push({
                id: `${p.id}-det-${dIdx}`,
                tgl: tglStr,
                tanggal_jam: `${tglStr} ${timeStr}`,
                nomor_mc: p.nomor_mc,
                potongan_ke: String(p.potongan_ke || "-"),
                panel_no: String(p.panel_no || "-"),
                blok: formattedBlok,
                operator: fullOperator,
                kategori: det.kategori_masalah || "Cacat Produksi",
                detail_masalah: det.detail_masalah || "-",
                durasi_detik: parseInt(p.total_downtime_detik) || 0,
                sumber: "Cacat Produksi"
             });
          }
        });
      }
    });

    // Group allEvents by blok
    const blockMap = new Map<string, BlockProblemItem[]>();
    allEvents.forEach((ev) => {
      const key = ev.blok;
      if (!blockMap.has(key)) blockMap.set(key, []);
      blockMap.get(key)!.push(ev);
    });

    const summary: BlockSummary[] = Array.from(blockMap.entries()).map(([blok, list]) => {
      // Find top category
      const katCount: Record<string, number> = {};
      const oprCount: Record<string, number> = {};
      let totalDur = 0;

      list.forEach((item) => {
        katCount[item.kategori] = (katCount[item.kategori] || 0) + 1;
        oprCount[item.operator] = (oprCount[item.operator] || 0) + 1;
        totalDur += item.durasi_detik || 0;
      });

      const sortedKat = Object.entries(katCount).sort((a, b) => b[1] - a[1]);
      const sortedOpr = Object.entries(oprCount).sort((a, b) => b[1] - a[1]);

      return {
        blok,
        total_kejadian: list.length,
        total_durasi_detik: totalDur,
        kategori_utama: sortedKat[0]?.[0] || "-",
        operator_terbanyak: sortedOpr[0]?.[0] || "-",
        masalah_list: list
      };
    });

    // Sort summary by total_kejadian desc, then total_durasi_detik desc
    summary.sort((a, b) => b.total_kejadian - a.total_kejadian || b.total_durasi_detik - a.total_durasi_detik);

    const totalProblems = allEvents.length;
    const totalDurationSec = allEvents.reduce((acc, curr) => acc + curr.durasi_detik, 0);

    // Find top overall category
    const catMap: Record<string, number> = {};
    allEvents.forEach((e) => {
      catMap[e.kategori] = (catMap[e.kategori] || 0) + 1;
    });
    const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

    return {
      success: true,
      summary,
      allEvents,
      stats: {
        totalProblems,
        totalDurationSec,
        topProblematicBlock: summary[0]?.blok || "-",
        topCategory: topCat
      }
    };
  } catch (err: any) {
    console.error("Error in getMachineBlockAnalytics:", err);
    return { success: false, error: err.message || "Failed to load block analytics." };
  }
}

