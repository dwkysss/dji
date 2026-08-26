"use server";

import { createClient } from "@/lib/supabase/server";
import { getShiftDate, parseAsWibDate } from "@/lib/shift-utils";

export interface MonthlyMachineReportData {
  tanggal: number;
  desain: string;
  teamData: Record<string, TeamData>; // Keyed by Group (A, B, C)
  orderedTeams?: { teamName: string; data: TeamData }[];
}

export interface TeamData {
  operator_name: string;
  hasil_produksi: number;
  jumlah_cacat: number;
  downtime_detik: number;
  courses: string;
  rpm: number;
  eff_100: number;
  kode_tindakan: Record<string, number>;
  desain?: string;
  keterangan?: string;
  keterangan_per_kategori?: Record<string, string[]>;
  earliestTimestamp?: string;
}

const PROBLEM_DETAILS: Record<string, string[]> = {
  A: ["L1/L2/L3 Benang timbul putus", "Benang lolos", "Bolong corak", "Benang narik/Kendor", "Benang Nyilang", "Perbaikan/Beset benang Dasar", "Benang Kejepit/Jebol/Kusut", "Jalur benang"],
  B: ["Jarum pattern patah/bengkok", "Ganti Jacquard", "Ganti jarum Compoun Nedle, pattern", "Ngampul", "Ganti dari scaloop ke non scaloop atau sebaliknya", "Ngegaris/Stopline", "Keluar Jarum", "Ganti String bar", "Ganti PBO", "Pressan As beam kendor", "Tensi tensioner"],
  C: ["Loading design/Ganti Design", "Perbaikan corak/revisi", "Salah ganti design", "Error design", "Proofing/PCB", "Ganti Pattern Disk", "Ganti pick"],
  D: ["Ganti benang dasar L1/L2", "Salah ganti benang dasar", "Ganti benang Pattern Linner", "Ganti benang Pattern Heavy", "Ganti benang Pattern Shadow", "Ganti benang pattern keseluruhan (L,H,S)", "salah ganti benang pattern", "Ngelancarin", "Over Cone/Rewind", "Tunggu benang dasar dari warping", "Tunggu benang (benang belum datang)"],
  E: ["Error Servo Drive", "Ganti motor servo", "Sensor Benang/Laser Stop", "Perbaikan Eletrik lainnya", "Konsleting", "Perbaikan listrik"],
  F: ["Perbaikan cilynder Angin", "Ganti Bellow", "Perbaikan gear/Take Up Roll", "Ganti rantai/pertensi", "Ganti Black grip roll", "Ganti Oli", "Pelumasan/greace pada mesin", "Ganti Vanbelt", "Perawatan Panel Listrik", "Servis Overhaul"],
  G: ["Hari Libur", "Tidak ada order", "Tunggu info", "Demo", "Bencana/gempa/banjir", "Istirahat selama buka puasa", "Tunggu Sparepart", "Mati Listrik"],
};

export async function getMonthlyMachineReport(
  month: number,
  year: number,
  machineId: string
) {
  try {
    const supabase = await createClient();

    // Construct start and end dates for the month
    const startDate = new Date(year, month - 1, 1).toISOString().split("T")[0];
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];
    // Fetch records slightly wider to catch Shift 3 spanning midnight
    const prevDate = new Date(year, month - 1, 0).toISOString().split("T")[0];
    const nextDate = new Date(year, month, 2).toISOString().split("T")[0];

    // Fetch all production details joined with headers for the specific machine and month (paginated to overcome 1000 limit)
    let data: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data: pageData, error } = await supabase
        .from("production_details")
        .select(`
          id,
          jml_hasil_produksi,
          kategori_masalah,
          detail_masalah,
          indikator_stop,
          production_defects(kategori, detail),
          production_headers!inner (
            id,
            nomor_mc,
            tgl,
            tanggal_jam,
            panel_no,
            potongan_ke,
            total_produksi_meter,
            pcs,
            design_id,
            course,
            pick,
            rpm,
            total_downtime_detik,
            pic,
            groups ( nama_grup ),
            operators ( nama_operator )
          )
        `)
        .eq("production_headers.nomor_mc", machineId)
        .gte("production_headers.tgl", prevDate)
        .lte("production_headers.tgl", nextDate)
        .range(from, to);

      if (error) {
        console.error("Error fetching report data:", error);
        throw new Error("Gagal mengambil data laporan: " + error.message);
      }

      if (pageData && pageData.length > 0) {
        data.push(...pageData);
        if (pageData.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    // Process data to aggregate by date (1-31) and team (A, B, C)
    const reportMap = new Map<number, MonthlyMachineReportData>();

    // Initialize map with all days in the month
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      reportMap.set(d, {
        tanggal: d,
        desain: "",
        teamData: {
          "A": createEmptyTeamData(),
          "B": createEmptyTeamData(),
          "C": createEmptyTeamData(),
        },
      });
    }

    // Helper to determine shift name
    function getShiftNameFromDate(dt: Date): string {
      const hourStr = dt.toLocaleTimeString("en-US", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false });
      const minStr = dt.toLocaleTimeString("en-US", { timeZone: "Asia/Jakarta", minute: "2-digit" });
      const hour = parseInt(hourStr);
      const min = parseInt(minStr);
      const totalMinutes = (isNaN(hour) ? 0 : hour) * 60 + (isNaN(min) ? 0 : min);
      if (totalMinutes >= 430 && totalMinutes < 910) return "Shift 1";
      if (totalMinutes >= 910 && totalMinutes < 1390) return "Shift 2";
      return "Shift 3";
    }

    // Deduplicate unique headers and sort them chronologically
    const headersMap = new Map<string, any>();
    data?.forEach((row: any) => {
      const h = row.production_headers;
      if (h && !headersMap.has(h.id)) {
        headersMap.set(h.id, h);
      }
    });

    const sortedHeaders = Array.from(headersMap.values()).sort((a: any, b: any) => {
      const tsA = a.tanggal_jam || a.tgl || "";
      const tsB = b.tanggal_jam || b.tgl || "";
      return String(tsA).localeCompare(String(tsB));
    });

    // Pre-calculate shift assignment with continuation rule for overtime / same operator
    const headerAssignment = new Map<string, { shiftDateStr: string; day: number; month: number; year: number; groupName: string; operatorName: string }>();
    let prevAssigned: { shiftDateStr: string; shiftName: string; groupName: string; operatorName: string; timestamp: Date } | null = null;

    sortedHeaders.forEach((h: any) => {
      const ts = h.tanggal_jam || h.tgl;
      const dt = parseAsWibDate(ts);
      const naturalShiftDateStr = getShiftDate(ts);
      const naturalShiftName = getShiftNameFromDate(dt);
      const opr = (h.operators?.nama_operator || h.pic || "").trim();
      const grp = (h.groups?.nama_grup || "A").trim().toUpperCase();

      let assignedShiftDateStr = naturalShiftDateStr;
      let assignedShiftName = naturalShiftName;
      let assignedGroup = grp;

      if (prevAssigned) {
        const isShiftBoundaryCrossed = naturalShiftDateStr !== prevAssigned.shiftDateStr || naturalShiftName !== prevAssigned.shiftName;
        const isSameOperator = opr && prevAssigned.operatorName && opr.toLowerCase() === prevAssigned.operatorName.toLowerCase();
        
        const timeDiffMs = dt.getTime() - prevAssigned.timestamp.getTime();
        const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

        // Jika melewati batas jam kerja normal tetapi diinput oleh operator yang sama dalam rentang kerja bersambung (< 5 jam)
        if (isShiftBoundaryCrossed && isSameOperator && timeDiffHours < 5 && timeDiffHours >= 0) {
          assignedShiftDateStr = prevAssigned.shiftDateStr;
          assignedShiftName = prevAssigned.shiftName;
          assignedGroup = prevAssigned.groupName;
        }
      }

      const parts = assignedShiftDateStr.split("-");
      const assignedObj = {
        shiftDateStr: assignedShiftDateStr,
        day: parseInt(parts[2]) || 1,
        month: parseInt(parts[1]) || 1,
        year: parseInt(parts[0]) || 2026,
        groupName: assignedGroup,
        operatorName: opr,
      };

      headerAssignment.set(h.id, assignedObj);
      prevAssigned = {
        shiftDateStr: assignedShiftDateStr,
        shiftName: assignedShiftName,
        groupName: assignedGroup,
        operatorName: opr,
        timestamp: dt,
      };
    });

    // To prevent double counting downtime per header, keep track of processed headers per team
    const processedHeaders = new Set<string>();
    // To track unique panels and whether they have failed/stopped
    const processedPanels = new Map<string, { countedForTeam: string | null, isFailed: boolean }>();
    const processedDefectivePanels = new Set<string>();

    let isMeterMachine = false;

    data?.forEach((row: any) => {
      const header = row.production_headers;
      if (!header || !header.tgl) return;
      
      if (header.panel_no === "METERAN") {
        isMeterMachine = true;
      }

      const assignment = headerAssignment.get(header.id);
      if (!assignment) return;
      if (assignment.month !== month || assignment.year !== year) return;

      const day = assignment.day;
      const reportDay = reportMap.get(day);
      if (!reportDay) return;

      const groupName = assignment.groupName || "A"; // Default to A if null
      const operatorName = assignment.operatorName || header.operators?.nama_operator || header.pic || "";

      // Update shift/day metadata
      if (header.design_id && !reportDay.desain) reportDay.desain = header.design_id;

      // Ensure the team exists in the map
      if (!reportDay.teamData[groupName]) {
        reportDay.teamData[groupName] = createEmptyTeamData();
      }

      const team = reportDay.teamData[groupName];

      // Track earliest timestamp for shift ordering
      const timeStamp = header.tanggal_jam || String(header.id);
      if (timeStamp) {
        if (!team.earliestTimestamp || timeStamp < team.earliestTimestamp) {
          team.earliestTimestamp = timeStamp;
        }
      }

      if (operatorName && !team.operator_name) {
        team.operator_name = operatorName;
      }
      
      // Update team-specific courses, rpm, efficiency, and design
      if (header.panel_no === "METERAN") {
        if (header.pick && !team.courses) team.courses = header.pick;
      } else {
        if (header.course && !team.courses) team.courses = header.course;
      }
      
      if (header.rpm && !team.rpm) team.rpm = header.rpm;
      if (header.design_id && !team.desain) team.desain = header.design_id;
      
      if (team.rpm > 0 && team.courses) {
        const courseNum = parseFloat(team.courses);
        if (!isNaN(courseNum) && courseNum > 0) {
          if (header.panel_no === "METERAN") {
            team.eff_100 = Math.round((team.rpm * 8 * 60) / (courseNum * 100));
          } else {
            team.eff_100 = Math.round((team.rpm * 8 * 60) / courseNum);
          }
        }
      }

      // Aggregate defects (BS AWAL and BS AKHIR are not machine defect incidents, so skip them)
      const panelNoStr = String(header.panel_no || "").toUpperCase();
      const isBsAwalAkhir = panelNoStr.includes("BS AWAL") || panelNoStr.includes("BS AKHIR");
      const isBerhenti = panelNoStr === "BERHENTI";

      if (!team.keterangan_per_kategori) {
        team.keterangan_per_kategori = {};
      }
      const addKeterangan = (kat: string, detail: string) => {
        if (!kat || kat === "Unknown" || kat === "BS" || kat === "G") return;
        const d = detail.trim();
        if (!d) return;
        const dUpper = d.toUpperCase();
        if (
          dUpper.includes("SISA AWAL POTONGAN") ||
          dUpper.includes("SISA AKHIR POTONGAN") ||
          dUpper.includes("GAGAL CACAT") ||
          dUpper.includes("ISTIRAHAT") ||
          dUpper.includes("START") ||
          dUpper.includes("FINISH")
        ) return;
        if (!team.keterangan_per_kategori![kat]) team.keterangan_per_kategori![kat] = [];
        team.keterangan_per_kategori![kat].push(d);
      };

      const addDefectCode = (k: string) => {
        const code = k.replace("KODE ", "").trim().toUpperCase();
        if (!code || code === "BS" || code === "G") return;
        if (!team.kode_tindakan[code]) team.kode_tindakan[code] = 0;
        team.kode_tindakan[code] += 1;
      };

      let cleanD = row.detail_masalah 
        ? String(row.detail_masalah).replace(/\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "").replace(/\|\s*$/, "").replace(/,\s*$/, "").trim()
        : "";
        
      const katsRaw = row.kategori_masalah || "";
      let kats = katsRaw === "X" ? [] : katsRaw.split(",")
        .map((s: string) => s.trim().toUpperCase())
        .filter((k: string) => Boolean(k) && k !== "BS" && k !== "G" && !k.includes("ISTIRAHAT") && !k.includes("GAGAL CACAT"));

      const recordedKats = new Set<string>();
      let hasRealDefectsOnRow = false;

      const addDefectKeterangan = (kat: string, detail: string) => {
        if (!kat || kat === "BS" || kat === "G") return;
        const d = detail.trim();
        const dUpper = d.toUpperCase();
        if (
          dUpper.includes("GAGAL CACAT") ||
          dUpper.includes("ISTIRAHAT") ||
          dUpper.includes("START") ||
          dUpper.includes("FINISH") ||
          dUpper.includes("SISA AWAL POTONGAN") ||
          dUpper.includes("SISA AKHIR POTONGAN")
        ) {
          return;
        }
        hasRealDefectsOnRow = true;
        addDefectCode(kat);
        recordedKats.add(kat);
        if (d) {
          addKeterangan(kat, d);
        }
      };

      if (!isBsAwalAkhir && !isBerhenti) {
        // If production_defects array exists and has entries, use it directly as source of truth
        if (row.production_defects && Array.isArray(row.production_defects) && row.production_defects.length > 0) {
          const seenRowDefects = new Set<string>();
          row.production_defects.forEach((d: any) => {
            const k = (d.kategori || "").toUpperCase().trim();
            const det = (d.detail || "").trim();
            const defKey = `${k}|${det}|${d.blok || ''}|${d.meter || ''}`;
            if (seenRowDefects.has(defKey)) return;
            seenRowDefects.add(defKey);

            if (k && k !== "G" && k !== "BS") {
              addDefectKeterangan(k, det);
            }
          });
        } else {
          // Fallback to text parsing for legacy data where production_defects relation is empty
          if (cleanD) {
            const allKnownProblems: { kat: string; detail: string }[] = [];
            for (const [kat, detList] of Object.entries(PROBLEM_DETAILS || {})) {
              if (kat === "G") continue;
              detList.forEach(det => {
                allKnownProblems.push({ kat, detail: det });
              });
            }
            allKnownProblems.sort((a, b) => b.detail.length - a.detail.length);

            let remainingD = cleanD;

            allKnownProblems.forEach(known => {
              const escapedDetail = known.detail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(escapedDetail, "gi");
              if (regex.test(remainingD)) {
                addDefectKeterangan(known.kat, known.detail);
                remainingD = remainingD.replace(regex, "");
              }
            });

            const leftoverParts = remainingD.split(/\||,/)
              .map(s => s.trim())
              .filter((s: string) => {
                if (!s) return false;
                const sUpper = s.toUpperCase();
                return (
                  !sUpper.includes("SISA AWAL POTONGAN") &&
                  !sUpper.includes("SISA AKHIR POTONGAN") &&
                  !sUpper.includes("GAGAL CACAT") &&
                  !sUpper.includes("ISTIRAHAT") &&
                  !sUpper.includes("START") &&
                  !sUpper.includes("FINISH")
                );
              });
            
            leftoverParts.forEach(part => {
              const targetKat = kats.length > 0 ? kats[0] : "A";
              addDefectKeterangan(targetKat, part);
            });
          }

          kats.forEach((k: string) => {
            if (k && k !== "BS" && k !== "G" && !recordedKats.has(k)) {
              addDefectKeterangan(k, "");
            }
          });
        }

        // Count 1 defective panel (menghitung jumlah panel cacat, bukan frekuensi detail masalah)
        if (hasRealDefectsOnRow) {
          if (header.panel_no === "METERAN") {
            team.jumlah_cacat += 1;
          } else {
            const cutScope = header.potongan_ke || header.design_id || header.id;
            const defectPanelKey = `${day}-${groupName}-${cutScope}-${panelNoStr}`;
            if (!processedDefectivePanels.has(defectPanelKey)) {
              processedDefectivePanels.add(defectPanelKey);
              team.jumlah_cacat += 1;
            }
          }
        }
      }

      // Add downtime ONLY ONCE per header (skip BS AWAL and BS AKHIR so they never duplicate panel downtime)
      if (!processedHeaders.has(header.id)) {
        processedHeaders.add(header.id);
        if (!isBsAwalAkhir) {
          team.downtime_detik += (header.total_downtime_detik || 0);
        }
        
        if (header.panel_no === "METERAN") {
          // For meter machines, add total_produksi_meter ONCE per header
          if (header.total_produksi_meter && header.total_produksi_meter > 0) {
            team.hasil_produksi += header.total_produksi_meter;
          }
        }
      }

      // For normal machines (panel), count unique panel_no strings per team, ignoring GAGAL, BS and BERHENTI strings
      if (header.panel_no && header.panel_no !== "METERAN") {
        const panelNoStr = String(header.panel_no).toUpperCase();
        
        const isBerhenti = panelNoStr === "BERHENTI";
        const isGagal = panelNoStr.includes("(GAGAL)") || 
                        panelNoStr.includes("(BS)") || 
                        panelNoStr.includes("BS AWAL") || 
                        panelNoStr.includes("BS AKHIR") || 
                        panelNoStr === "BS" || 
                        panelNoStr.startsWith("BS ") ||
                        (row.jml_hasil_produksi === 0);
        
        if (!isBerhenti && !isGagal) {
          const cutScope = header.potongan_ke || header.design_id || header.id;
          const panelKey = `${day}-${groupName}-${cutScope}-${panelNoStr}`;
          
          if (!processedPanels.has(panelKey)) {
            processedPanels.set(panelKey, { countedForTeam: groupName, isFailed: false });
            team.hasil_produksi += 1;
          }
        }
      }
    });

    // --- FETCH MECHANIC DOWNTIME ---
    // Mechanic dummy headers do not have production_details, so they were missed by the inner join above.
    // We fetch them directly from downtime_records joined with production_headers.
    const { data: dtData, error: dtError } = await supabase
      .from("downtime_records")
      .select(`
        kategori,
        detail,
        durasi_detik,
        header_id,
        production_headers!inner (
          id,
          tgl,
          panel_no,
          groups ( nama_grup )
        )
      `)
      .eq("production_headers.nomor_mc", machineId)
      .eq("production_headers.panel_no", "Downtime Mekanik (Direct)")
      .gte("production_headers.tgl", startDate)
      .lte("production_headers.tgl", endDate);

    if (!dtError && dtData) {
      dtData.forEach((row: any) => {
        const header = row.production_headers;
        if (!header || !header.tgl) return;

        const dateObj = new Date(header.tgl);
        const day = dateObj.getDate();
        const groupName = header.groups?.nama_grup || "A";

        const reportDay = reportMap.get(day);
        if (!reportDay) return;

        if (!reportDay.teamData[groupName]) {
          reportDay.teamData[groupName] = createEmptyTeamData();
        }
        const team = reportDay.teamData[groupName];

        // Add Keterangan for Mechanic
        if (row.kategori && row.kategori !== "Unknown") {
          if (!team.keterangan_per_kategori) team.keterangan_per_kategori = {};
          if (!team.keterangan_per_kategori[row.kategori]) team.keterangan_per_kategori[row.kategori] = [];
          const d = (row.detail || "").trim();
          if (d) {
            team.keterangan_per_kategori[row.kategori].push(d);
          }
        }
      });
      
      // Fetch the headers directly to get total_downtime_detik safely.
      const { data: mechHeaders } = await supabase
        .from("production_headers")
        .select("id, tgl, total_downtime_detik, groups(nama_grup)")
        .eq("nomor_mc", machineId)
        .eq("panel_no", "Downtime Mekanik (Direct)")
        .gte("tgl", startDate)
        .lte("tgl", endDate);
        
      if (mechHeaders) {
        mechHeaders.forEach((h: any) => {
          if (!h.tgl) return;
          const day = new Date(h.tgl).getDate();
          const groupName = h.groups?.nama_grup || "A";
          const reportDay = reportMap.get(day);
          if (reportDay && reportDay.teamData[groupName]) {
             if (!processedHeaders.has(h.id)) {
               processedHeaders.add(h.id);
               reportDay.teamData[groupName].downtime_detik += (h.total_downtime_detik || 0);
             }
          }
        });
      }
    }
    // --- END FETCH MECHANIC DOWNTIME ---

    // Helper to determine shift 1 team and cyclic rotation (A -> B -> C -> A)
    function getPrevTeam(team: string): string {
      if (team === "A") return "C";
      if (team === "B") return "A";
      if (team === "C") return "B";
      return "A";
    }

    function getShift1TeamFromRecord(teamName: string, dateStr?: string): string {
      if (!dateStr) return teamName;
      try {
        const dt = parseAsWibDate(dateStr);
        const hourStr = dt.toLocaleTimeString("en-US", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false });
        const minStr = dt.toLocaleTimeString("en-US", { timeZone: "Asia/Jakarta", minute: "2-digit" });
        const hour = parseInt(hourStr);
        const min = parseInt(minStr);
        const totalMinutes = (isNaN(hour) ? 0 : hour) * 60 + (isNaN(min) ? 0 : min);

        if (totalMinutes >= 430 && totalMinutes < 910) {
          // Shift 1: 07:10 - 15:10
          return teamName;
        } else if (totalMinutes >= 910 && totalMinutes < 1390) {
          // Shift 2: 15:10 - 23:10
          return getPrevTeam(teamName);
        } else {
          // Shift 3: 23:10 - 07:10
          return getPrevTeam(getPrevTeam(teamName));
        }
      } catch (e) {
        return teamName;
      }
    }

    function getTeamCycle(shift1Team: string): string[] {
      const t = (shift1Team || "A").toUpperCase().trim();
      if (t === "B") return ["B", "C", "A"];
      if (t === "C") return ["C", "A", "B"];
      return ["A", "B", "C"];
    }

    let lastKnownShift1Team = "A";
    const sortedDayValues = Array.from(reportMap.values()).sort((a, b) => a.tanggal - b.tanggal);

    const results = sortedDayValues.map((dayData) => {
      let earliestRecord: { team: string; timestamp: string } | null = null;

      ["A", "B", "C"].forEach((teamName) => {
        const td = dayData.teamData[teamName];
        if (td && td.earliestTimestamp) {
          if (!earliestRecord || td.earliestTimestamp < (earliestRecord as { team: string; timestamp: string }).timestamp) {
            earliestRecord = { team: teamName, timestamp: td.earliestTimestamp };
          }
        }
      });

      let shift1Team = lastKnownShift1Team;
      if (earliestRecord) {
        const rec = earliestRecord as { team: string; timestamp: string };
        shift1Team = getShift1TeamFromRecord(rec.team, rec.timestamp);
        lastKnownShift1Team = shift1Team;
      }

      const cycle = getTeamCycle(shift1Team);
      const orderedTeams = cycle.map((t) => ({
        teamName: t,
        data: dayData.teamData[t] || createEmptyTeamData(),
      }));

      return {
        ...dayData,
        orderedTeams,
      };
    });

    return { success: true, data: results, isMeterMachine };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function createEmptyTeamData(): TeamData {
  return {
    operator_name: "",
    hasil_produksi: 0,
    jumlah_cacat: 0,
    downtime_detik: 0,
    courses: "",
    rpm: 0,
    eff_100: 0,
    kode_tindakan: {
      "A": 0, "B": 0, "C": 0, "D": 0, "E": 0, "F": 0, "G": 0, "H": 0
    }
  };
}
