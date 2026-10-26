"use server";

import { createClient } from "@/lib/supabase/server";
import { getShiftDate, parseAsWibDate, getShiftName } from "@/lib/shift-utils";
import { PROBLEM_DETAILS } from "@/lib/constants";

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
  potong_kain_list?: string[];
  earliestTimestamp?: string;
}


export async function getMonthlyMachineReport(
  month: number,
  year: number,
  machineId: string
) {
  try {
    const supabase = await createClient();

    // Fetch machine configuration to check input_type & default_pcs
    const { data: mcConfig } = await supabase
      .from("machine_configs")
      .select("default_pcs, input_type")
      .eq("nomor_mc", machineId)
      .maybeSingle();

    const isConfiguredMeter =
      mcConfig?.input_type === "METER" ||
      mcConfig?.input_type === "METERAN" ||
      machineId.toUpperCase() === "R11" ||
      machineId.toUpperCase() === "R12";
    const defaultPcsForMachine =
      Number(mcConfig?.default_pcs) > 0 ? Number(mcConfig?.default_pcs) : (isConfiguredMeter ? 3 : 1);

    // Construct start and end dates for the month
    const mStr = String(month).padStart(2, "0");
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const startDate = `${year}-${mStr}-01`;
    const endDate = `${year}-${mStr}-${String(lastDayOfMonth).padStart(2, "0")}`;

    // Wider bounds (5 days before and 5 days after) so Shift 3 and boundary days are never missed
    const prevDateObj = new Date(year, month - 1, -4);
    const prevDate = `${prevDateObj.getFullYear()}-${String(prevDateObj.getMonth() + 1).padStart(2, "0")}-${String(prevDateObj.getDate()).padStart(2, "0")}`;
    const nextDateObj = new Date(year, month - 1, lastDayOfMonth + 5);
    const nextDate = `${nextDateObj.getFullYear()}-${String(nextDateObj.getMonth() + 1).padStart(2, "0")}-${String(nextDateObj.getDate()).padStart(2, "0")}`;

    // 1. Fetch all production_headers directly with pagination.
    // Querying production_headers by indexed fields (nomor_mc, tgl) is fast (< 1s for thousands of records)
    // and avoids Postgres statement timeouts (code 57014) caused by deep joining and offsetting production_details.
    let allHeaders: any[] = [];
    let headerPage = 0;
    const headerPageSize = 1000;
    let hasMoreHeaders = true;

    while (hasMoreHeaders) {
      const from = headerPage * headerPageSize;
      const to = from + headerPageSize - 1;
      const { data: hPage, error: hErr } = await supabase
        .from("production_headers")
        .select(`
          id,
          nomor_mc,
          tgl,
          tanggal_jam,
          panel_no,
          potongan_ke,
          tanggal_potong,
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
        `)
        .eq("nomor_mc", machineId)
        .gte("tgl", prevDate)
        .lte("tgl", nextDate)
        .order("tgl", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);

      if (hErr) {
        console.error("Error fetching report headers:", hErr);
        throw new Error("Gagal mengambil data header laporan: " + hErr.message);
      }

      if (hPage && hPage.length > 0) {
        allHeaders.push(...hPage);
        if (hPage.length < headerPageSize) {
          hasMoreHeaders = false;
        } else {
          headerPage++;
        }
      } else {
        hasMoreHeaders = false;
      }
    }

    // 2. Fetch corresponding production_details in safe URL-length chunks (chunk size 60 UUIDs)
    // with concurrency control to avoid Nginx 502 Bad Gateway and connection limits.
    const allHeaderIds = allHeaders.map((h) => h.id);
    let allDetails: any[] = [];

    if (allHeaderIds.length > 0) {
      const chunkSize = 60;
      const chunks: string[][] = [];
      for (let i = 0; i < allHeaderIds.length; i += chunkSize) {
        chunks.push(allHeaderIds.slice(i, i + chunkSize));
      }

      const concurrency = 5;
      for (let i = 0; i < chunks.length; i += concurrency) {
        const batch = chunks.slice(i, i + concurrency);
        const results = await Promise.all(
          batch.map((chunkIds) =>
            supabase
              .from("production_details")
              .select(`
                id,
                header_id,
                jml_hasil_produksi,
                kategori_masalah,
                detail_masalah,
                indikator_stop,
                production_defects ( kategori, detail )
              `)
              .in("header_id", chunkIds)
          )
        );

        for (const res of results) {
          if (res.error) {
            console.error("Error fetching report details chunk:", res.error);
            throw new Error("Gagal mengambil detail laporan: " + res.error.message);
          }
          if (res.data) {
            allDetails.push(...res.data);
          }
        }
      }
    }

    // 3. Map details with headers and ensure headers without details (stops/downtime) are also represented
    const detailsByHeader = new Map<string, any[]>();
    allDetails.forEach((d) => {
      if (!detailsByHeader.has(d.header_id)) {
        detailsByHeader.set(d.header_id, []);
      }
      detailsByHeader.get(d.header_id)!.push(d);
    });

    const data: any[] = [];
    allHeaders.forEach((header) => {
      const details = detailsByHeader.get(header.id);
      if (details && details.length > 0) {
        details.forEach((d) => {
          data.push({
            ...d,
            production_headers: header,
          });
        });
      } else {
        data.push({
          id: `hdr-${header.id}`,
          jml_hasil_produksi: 0,
          kategori_masalah: "",
          detail_masalah: "",
          indikator_stop: null,
          production_defects: [],
          production_headers: header,
        });
      }
    });

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
      return getShiftName(dt);
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
      let ts = h.tanggal_jam || h.tgl;
      if (h.panel_no === "BERHENTI" && h.tgl) {
        const shiftDateOfTs = getShiftDate(ts);
        if (shiftDateOfTs !== h.tgl) {
          ts = `${h.tgl} 08:00:00`;
        }
      }
      const dt = parseAsWibDate(ts);
      const naturalShiftDateStr = getShiftDate(ts);
      const naturalShiftName = getShiftNameFromDate(dt);
      let opr = (h.operators?.nama_operator || h.pic || "").trim();
      if (h.panel_no === "BERHENTI" && (!h.operator_id || opr.toUpperCase() === "ADMIN" || !opr)) {
        opr = "-";
      }
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

    // Identifikasi header yang merupakan momen Potong Kain
    const cutHeaderIds = new Map<string, string>(); // headerId -> potonganKe string

    // 1. Kelompokkan headers per potongan_ke
    const headersByPotongan = new Map<string, any[]>();
    sortedHeaders.forEach((h: any) => {
      if (h.potongan_ke !== undefined && h.potongan_ke !== null && String(h.potongan_ke).trim() !== "") {
        const potKey = String(h.potongan_ke).trim();
        if (!headersByPotongan.has(potKey)) headersByPotongan.set(potKey, []);
        headersByPotongan.get(potKey)!.push(h);
      }
    });

    // 2. Untuk setiap potongan_ke, temukan header penutup (Potong Kain)
    headersByPotongan.forEach((hList, potKey) => {
      // Prioritas 1: Header dengan panel_no BS AKHIR
      const bsAkhir = hList.find((h) => String(h.panel_no || "").toUpperCase().includes("BS AKHIR"));
      if (bsAkhir) {
        cutHeaderIds.set(bsAkhir.id, potKey);
        return;
      }

      // Prioritas 2: Jika ada tanggal_potong pada potongan ini (misal meteran)
      const hasTanggalPotong = hList.some((h) => Boolean(h.tanggal_potong));
      if (hasTanggalPotong) {
        // Ambil header terakhir secara kronologis dari potongan tersebut
        const lastH = hList[hList.length - 1];
        if (lastH) {
          cutHeaderIds.set(lastH.id, potKey);
        }
      }
    });

    // To prevent double counting downtime per header, keep track of processed headers per team
    const processedHeaders = new Set<string>();
    // To track unique panels and whether they have failed/stopped
    const processedPanels = new Map<string, { countedForTeam: string | null, isFailed: boolean }>();
    const processedDefectivePanels = new Set<string>();

    // Map to track production output per operator per day & group to pick the operator with the highest production
    const operatorOutputPerDayTeam = new Map<string, Map<string, number>>();

    let isMeterMachine = isConfiguredMeter;

    data?.forEach((row: any) => {
      const header = row.production_headers;
      if (!header || !header.tgl) return;
      
      if (header.panel_no === "METERAN" || isConfiguredMeter) {
        isMeterMachine = true;
      }

      const assignment = headerAssignment.get(header.id);
      if (!assignment) return;
      if (assignment.month !== month || assignment.year !== year) return;

      const day = assignment.day;
      const reportDay = reportMap.get(day);
      if (!reportDay) return;

      const groupName = assignment.groupName || "A"; // Default to A if null
      let operatorName = assignment.operatorName || header.operators?.nama_operator || header.pic || "";
      if (header.panel_no === "BERHENTI" && (!header.operator_id || operatorName.toUpperCase() === "ADMIN" || !operatorName)) {
        operatorName = "-";
      }

      const dayTeamKey = `${day}-${groupName}`;
      const cleanOp = (operatorName || "").trim();
      if (cleanOp && cleanOp !== "-") {
        if (!operatorOutputPerDayTeam.has(dayTeamKey)) {
          operatorOutputPerDayTeam.set(dayTeamKey, new Map<string, number>());
        }
        const opMap = operatorOutputPerDayTeam.get(dayTeamKey)!;
        if (!opMap.has(cleanOp)) {
          opMap.set(cleanOp, 0);
        }
      }

      // Update shift/day metadata
      if (header.design_id && !reportDay.desain) reportDay.desain = header.design_id;

      // Ensure the team exists in the map
      if (!reportDay.teamData[groupName]) {
        reportDay.teamData[groupName] = createEmptyTeamData();
      }

      const team = reportDay.teamData[groupName];

      if (cutHeaderIds.has(header.id)) {
        const potNum = cutHeaderIds.get(header.id)!;
        if (!team.potong_kain_list) {
          team.potong_kain_list = [];
        }
        if (!team.potong_kain_list.includes(potNum)) {
          team.potong_kain_list.push(potNum);
        }
      }

      // Track earliest timestamp for shift ordering
      const timeStamp = header.tanggal_jam || String(header.id);
      if (timeStamp) {
        if (!team.earliestTimestamp || timeStamp < team.earliestTimestamp) {
          team.earliestTimestamp = timeStamp;
        }
      }

      if (operatorName && (!team.operator_name || team.operator_name === "-")) {
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
        if (!kat || kat === "Unknown" || kat === "BS") return;
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
        if (!code || code === "BS") return;
        if (!team.kode_tindakan[code]) team.kode_tindakan[code] = 0;
        team.kode_tindakan[code] += 1;
      };

      let cleanD = row.detail_masalah 
        ? String(row.detail_masalah).replace(/\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "").replace(/\|\s*$/, "").replace(/,\s*$/, "").trim()
        : "";
        
      const katsRaw = row.kategori_masalah || "";
      let kats = katsRaw === "X" ? [] : katsRaw.split(",")
        .map((s: string) => s.trim().toUpperCase())
        .filter((k: string) => Boolean(k) && k !== "BS" && !k.includes("ISTIRAHAT") && !k.includes("GAGAL CACAT"));

      const recordedKats = new Set<string>();
      let hasRealDefectsOnRow = false;

      const addDefectKeterangan = (kat: string, detail: string) => {
        if (!kat || kat === "BS") return;
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
        if (kat !== "G") {
          hasRealDefectsOnRow = true;
        }
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

            if (k && k !== "BS") {
              addDefectKeterangan(k, det);
            }
          });
        } else {
          // Fallback to text parsing for legacy data where production_defects relation is empty
          if (cleanD) {
            const allKnownProblems: { kat: string; detail: string }[] = [];
            for (const [kat, detList] of Object.entries(PROBLEM_DETAILS || {})) {
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
            if (k && k !== "BS" && !recordedKats.has(k)) {
              addDefectKeterangan(k, "");
            }
          });
        }

        // Count 1 defective panel / point (untuk panel dihitung per panel unik, untuk meter dibagi jumlah pcs)
        if (hasRealDefectsOnRow) {
          if (header.panel_no === "METERAN" || isConfiguredMeter || isMeterMachine) {
            const pcsCount = Number(header.pcs) > 0 ? Number(header.pcs) : defaultPcsForMachine;
            team.jumlah_cacat += (1 / pcsCount);
          } else {
            const cutScope = header.potongan_ke || header.design_id || header.id;
            const defectPanelKey = `${day}-${groupName}-${cutScope}-${panelNoStr}`;
            if (!processedDefectivePanels.has(defectPanelKey)) {
              processedDefectivePanels.add(defectPanelKey);
              team.jumlah_cacat += 1;
            }
          }
        }
      } else if (isBerhenti) {
        // Mesin berstatus berhenti (LIBUR, MAINTENANCE, RUSAK, dsb.)
        const kat = (row.kategori_masalah || "G").trim().toUpperCase();
        const det = (row.detail_masalah || "LIBUR").trim();
        if (kat && det) {
          addKeterangan(kat, det);
          addDefectCode(kat);
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
            if (cleanOp && cleanOp !== "-") {
              const opMap = operatorOutputPerDayTeam.get(dayTeamKey);
              if (opMap) {
                opMap.set(cleanOp, (opMap.get(cleanOp) || 0) + header.total_produksi_meter);
              }
            }
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
            if (cleanOp && cleanOp !== "-") {
              const opMap = operatorOutputPerDayTeam.get(dayTeamKey);
              if (opMap) {
                opMap.set(cleanOp, (opMap.get(cleanOp) || 0) + 1);
              }
            }
          }
        }
      }
    });

    // Tetapkan nama operator per tim/shift berdasarkan operator dengan hasil produksi terbanyak
    reportMap.forEach((reportDay, dayNum) => {
      ["A", "B", "C"].forEach((grp) => {
        const team = reportDay.teamData[grp];
        if (!team) return;
        const dayTeamKey = `${dayNum}-${grp}`;
        const opMap = operatorOutputPerDayTeam.get(dayTeamKey);
        if (opMap && opMap.size > 0) {
          let maxProd = -1;
          let bestOp = "";
          for (const [op, prod] of opMap.entries()) {
            if (prod > maxProd) {
              maxProd = prod;
              bestOp = op;
            }
          }
          if (bestOp) {
            team.operator_name = bestOp;
          }
        }
      });
    });

    // Pastikan semua momen potong kain terdata pada teamData meskipun header tidak memiliki baris detail cacat
    cutHeaderIds.forEach((potNum, hId) => {
      const assignment = headerAssignment.get(hId);
      if (!assignment) return;
      if (assignment.month !== month || assignment.year !== year) return;
      const reportDay = reportMap.get(assignment.day);
      if (!reportDay) return;
      const groupName = assignment.groupName || "A";
      if (!reportDay.teamData[groupName]) {
        reportDay.teamData[groupName] = createEmptyTeamData();
      }
      const team = reportDay.teamData[groupName];
      if (!team.potong_kain_list) {
        team.potong_kain_list = [];
      }
      if (!team.potong_kain_list.includes(potNum)) {
        team.potong_kain_list.push(potNum);
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
        if (!header || (!header.tgl && !header.tanggal_jam)) return;

        const ts = header.tanggal_jam || header.tgl;
        const shiftDateStr = getShiftDate(ts);
        const [yStr, mStr, dStr] = shiftDateStr.split("-");
        const headerYear = parseInt(yStr);
        const headerMonth = parseInt(mStr);
        const day = parseInt(dStr);

        if (headerMonth !== month || headerYear !== year) return;

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
        .select("id, tgl, tanggal_jam, total_downtime_detik, groups(nama_grup)")
        .eq("nomor_mc", machineId)
        .eq("panel_no", "Downtime Mekanik (Direct)")
        .gte("tgl", startDate)
        .lte("tgl", endDate);
        
      if (mechHeaders) {
        mechHeaders.forEach((h: any) => {
          if (!h.tgl && !h.tanggal_jam) return;
          const ts = h.tanggal_jam || h.tgl;
          const shiftDateStr = getShiftDate(ts);
          const [yStr, mStr, dStr] = shiftDateStr.split("-");
          const headerYear = parseInt(yStr);
          const headerMonth = parseInt(mStr);
          const day = parseInt(dStr);

          if (headerMonth !== month || headerYear !== year) return;

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
        const shift = getShiftName(dt);
        if (shift === "Shift 1") {
          return teamName;
        } else if (shift === "Shift 2") {
          return getPrevTeam(teamName);
        } else {
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

      ["A", "B", "C"].forEach((teamName) => {
        const td = dayData.teamData[teamName];
        if (td && (isMeterMachine || isConfiguredMeter)) {
          // Pembulatan ke bilangan bulat terdekat tanpa desimal (< 0.5 ke bawah, >= 0.5 ke atas)
          td.jumlah_cacat = Math.round(td.jumlah_cacat);
        }
      });

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
    },
    potong_kain_list: [],
  };
}
