"use server";

import { createClient } from "@/lib/supabase/server";
import { getShiftDate } from "@/lib/shift-utils";
import { getDefectMeterLength } from "@/lib/defect-format-utils";

export interface ShiftOperatorPerformance {
  operatorId: number | string;
  operatorName: string;
  shiftGroup: string;
  totalOutput: number;
  panelCount: number;
  meterCount: number;
  totalDefects: number;
  totalDefectsPanel: number;
  totalDefectsMeter: number;
  defectRate: number;
  totalDowntimeSeconds: number;
  totalDowntimeMinutes: number;
  gradeA: number;
  gradeB: number;
  gradeBS: number;
  gradeUngraded: number;
  qualityScore: number; // % Grade A
  machinesOperated: string[];
  shiftCount: number;
  contributionPercent: number;
  performanceRating: "Top Performer" | "Good" | "Needs Attention";
}

export interface ShiftMachinePerformance {
  machineId: string;
  machineType: "PANEL" | "METERAN";
  totalOutput: number;
  panelCount: number;
  meterCount: number;
  totalDefects: number;
  totalDowntimeSeconds: number;
  totalDowntimeMinutes: number;
  defectRate: number;
  operators: string[];
  designs: string[];
}

export interface ShiftDailyTrend {
  day: number;
  date: string;
  output: number;
  panelCount: number;
  meterCount: number;
  defects: number;
  defectsPanel: number;
  defectsMeter: number;
  downtimeMinutes: number;
  activeOperators: number;
  activeMachines: string[];
}

export interface ShiftCategoryProblem {
  category: string;
  name: string;
  color: string;
  count: number;
  downtimeMinutes: number;
  percentage: number;
  topIssues: { issue: string; count: number }[];
}

export interface ShiftPerformanceSummary {
  month: number;
  year: number;
  shiftGroup: string;
  fabricType: "all" | "panel" | "meter";
  unit: string;
  totalOutput: number;
  totalPanel: number;
  totalMeter: number;
  totalDefects: number;
  totalDefectsPanel: number;
  totalDefectsMeter: number;
  defectRate: number;
  defectRatePanel: number;
  defectRateMeter: number;
  totalDowntimeSeconds: number;
  totalDowntimeMinutes: number;
  totalDowntimeHours: number;
  gradeA: number;
  gradeB: number;
  gradeBS: number;
  gradeUngraded: number;
  qualityScore: number;
  // Segregated Grade Quality
  gradeA_Panel: number;
  gradeB_Panel: number;
  gradeBS_Panel: number;
  qualityScore_Panel: number;
  gradeA_Meter: number;
  gradeB_Meter: number;
  gradeBS_Meter: number;
  qualityScore_Meter: number;
  totalOperators: number;
  activeDays: number;
  avgDailyOutput: number;
  avgDailyDowntimeMinutes: number;
  topOperator?: string;
  topIssueCategory?: string;
  dailyTrends: ShiftDailyTrend[];
  operators: ShiftOperatorPerformance[];
  machines: ShiftMachinePerformance[];
  problemCategories: ShiftCategoryProblem[];
}

const CATEGORY_NAMES: Record<string, { name: string; color: string }> = {
  A: { name: "Benang Timbul / Putus", color: "#ef4444" },
  B: { name: "Jarum / Jacquard / Pattern", color: "#f97316" },
  C: { name: "Loading / Ganti Desain", color: "#eab308" },
  D: { name: "Benang Dasar / Warping", color: "#06b6d4" },
  E: { name: "Elektrik & Servo Drive", color: "#3b82f6" },
  F: { name: "Mekanik & Perawatan Mesin", color: "#8b5cf6" },
  G: { name: "Lain-lain / Mati Listrik", color: "#64748b" },
};

/**
 * Fetch and calculate monthly performance data for Shift Leader (Kepala Shift)
 * Supports distinct filtering by Fabric Type: "all" | "panel" | "meter"
 */
export async function getMonthlyShiftPerformance(
  month: number,
  year: number,
  shiftGroup: string = "A", // "A" | "B" | "C" | "all"
  machineFilter?: string,
  fabricType: "all" | "panel" | "meter" = "all"
): Promise<{ success: boolean; data?: ShiftPerformanceSummary; error?: string }> {
  try {
    const supabase = await createClient();

    // 1. Calculate date boundaries for the given month (with padding for shifts spanning midnight)
    const startDate = new Date(year, month - 1, 1).toISOString().split("T")[0];
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];
    const prevDate = new Date(year, month - 1, 0).toISOString().split("T")[0];
    const nextDate = new Date(year, month, 2).toISOString().split("T")[0];
    const daysInMonth = new Date(year, month, 0).getDate();

    // 2. Fetch paginated production details joined with headers
    let rawDetails: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("production_details")
        .select(`
          id,
          meter_kain,
          jml_hasil_produksi,
          kategori_masalah,
          detail_masalah,
          keterangan_cacat,
          status_inspeksi,
          status_mending,
          final_inspection_id,
          is_deleted,
          production_defects (
            id,
            kategori,
            detail,
            meter,
            blok
          ),
          production_headers!inner (
            id,
            nomor_mc,
            tgl,
            tanggal_jam,
            panel_no,
            potongan_ke,
            total_produksi_meter,
            meter_awal,
            meter_akhir,
            pcs,
            design_id,
            total_downtime_detik,
            pic,
            groups ( nama_grup ),
            operators ( id, nama_operator )
          )
        `)
        .gte("production_headers.tgl", prevDate)
        .lte("production_headers.tgl", nextDate)
        .eq("is_deleted", false);

      if (machineFilter && machineFilter !== "all") {
        query = query.eq("production_headers.nomor_mc", machineFilter);
      }

      if (fabricType === "meter") {
        query = query.eq("production_headers.panel_no", "METERAN");
      } else if (fabricType === "panel") {
        query = query.neq("production_headers.panel_no", "METERAN");
      }

      const { data: pageData, error } = await query.range(from, to);

      if (error) {
        console.error("Error fetching shift performance data:", error);
        return { success: false, error: "Gagal mengambil data produksi: " + error.message };
      }

      if (pageData && pageData.length > 0) {
        rawDetails.push(...pageData);
        if (pageData.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    // 3. Helper to determine shift date (Shift 3: 23:10 - 07:10 belongs to start date)
    function getShiftInfo(tglStr: string, timestampStr?: string): { day: number; month: number; year: number; shiftDateStr: string } {
      const targetStr = timestampStr || tglStr;
      const shiftDateStr = getShiftDate(targetStr);
      const parts = shiftDateStr.split("-");
      return {
        year: parseInt(parts[0]) || year,
        month: parseInt(parts[1]) || month,
        day: parseInt(parts[2]) || 1,
        shiftDateStr,
      };
    }

    // 4. Initialize Data Aggregators
    const dailyMap = new Map<number, ShiftDailyTrend>();
    for (let d = 1; d <= daysInMonth; d++) {
      const dayDateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      dailyMap.set(d, {
        day: d,
        date: dayDateStr,
        output: 0,
        panelCount: 0,
        meterCount: 0,
        defects: 0,
        defectsPanel: 0,
        defectsMeter: 0,
        downtimeMinutes: 0,
        activeOperators: 0,
        activeMachines: [],
      });
    }

    const dailyOperatorsMap = new Map<number, Set<string>>();
    const dailyMachinesMap = new Map<number, Set<string>>();
    for (let d = 1; d <= daysInMonth; d++) {
      dailyOperatorsMap.set(d, new Set<string>());
      dailyMachinesMap.set(d, new Set<string>());
    }

    const operatorMap = new Map<string, ShiftOperatorPerformance>();
    const machineMap = new Map<string, ShiftMachinePerformance>();
    const categoryStatsMap = new Map<string, { count: number; downtimeSeconds: number; issues: Map<string, number> }>();
    Object.keys(CATEGORY_NAMES).forEach((cat) => {
      categoryStatsMap.set(cat, { count: 0, downtimeSeconds: 0, issues: new Map<string, number>() });
    });

    const processedHeadersForDowntime = new Set<string>();
    const activeDaysSet = new Set<number>();

    let totalPanel = 0;
    let totalMeter = 0;
    let totalDefects = 0;
    let totalDefectsPanel = 0;
    let totalDefectsMeter = 0;
    let totalDowntimeSeconds = 0;
    let totalGradeA = 0;
    let totalGradeB = 0;
    let totalGradeBS = 0;
    let totalUngraded = 0;

    let gradeA_Panel = 0;
    let gradeB_Panel = 0;
    let gradeBS_Panel = 0;
    let gradeA_Meter = 0;
    let gradeB_Meter = 0;
    let gradeBS_Meter = 0;

    // 5. Process and Aggregate Details
    rawDetails.forEach((row: any) => {
      const header = row.production_headers;
      if (!header || !header.tgl) return;

      const groupName = (header.groups?.nama_grup || "").trim().toUpperCase();
      // Filter by shift group if not "all"
      if (shiftGroup !== "all" && groupName !== shiftGroup.toUpperCase()) {
        return;
      }

      const shiftInfo = getShiftInfo(header.tgl, header.tanggal_jam);
      // Ensure row belongs to the target month & year
      if (shiftInfo.month !== month || shiftInfo.year !== year) {
        return;
      }

      const day = shiftInfo.day;
      activeDaysSet.add(day);

      const opName = (header.operators?.nama_operator || header.pic || "Operator Tak Dikenal").trim();
      const opId = header.operators?.id || opName;
      const mcId = (header.nomor_mc || "MC-Unknown").trim().toUpperCase();
      const isMeteran = String(header.panel_no || "").toUpperCase() === "METERAN";

      // Track active operator & machine per day
      dailyOperatorsMap.get(day)?.add(opName);
      dailyMachinesMap.get(day)?.add(mcId);

      // Process Downtime once per header
      if (!processedHeadersForDowntime.has(header.id)) {
        processedHeadersForDowntime.add(header.id);
        const dtSec = Number(header.total_downtime_detik) || 0;
        totalDowntimeSeconds += dtSec;

        const dailyItem = dailyMap.get(day);
        if (dailyItem) {
          dailyItem.downtimeMinutes += Math.round(dtSec / 60);
        }
      }

      // Check if item is special / deleted / BS awal-akhir
      const pNo = String(header.panel_no || "").toUpperCase();
      const isBsAwalAkhir = pNo.includes("AWAL") || pNo.includes("AKHIR") || 
                           String(row.keterangan_cacat || "").toUpperCase().includes("SISA AWAL") ||
                           String(row.keterangan_cacat || "").toUpperCase().includes("SISA AKHIR");

      const isIstirahat = (!!row.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") ||
                           !!row.kategori_masalah?.toUpperCase().includes("ISTIRAHAT")) &&
                          !row.kategori_masalah && !row.detail_masalah;

      // Calculate Production Output
      let rowOutput = 0;
      let rowPanel = 0;
      let rowMeter = 0;

      if (!isBsAwalAkhir && !isIstirahat) {
        if (isMeteran) {
          // For meter fabric: if header has meter_awal and meter_akhir
          const mEnd = Number(header.meter_akhir) || 0;
          const mStart = Number(header.meter_awal) || 0;
          const deltaM = Math.max(0, mEnd - mStart);
          rowOutput = deltaM > 0 ? deltaM : (Number(row.jml_hasil_produksi) || 0);
          rowMeter = rowOutput;
          totalMeter += rowOutput;
        } else {
          // For panel: regular panels count as 1 output (excluding BS rows as per rule)
          const isBS = row.jml_hasil_produksi === 0 || row.status_inspeksi === "BS" || row.status_mending === "BS";
          if (!isBS) {
            rowOutput = 1;
            rowPanel = 1;
            totalPanel += 1;
          }
        }
      }

      // Calculate Defects & Categories
      let defectCountForRow = 0;
      const hasRealDefects = !isIstirahat && (
        (row.production_defects && row.production_defects.length > 0) ||
        (row.kategori_masalah && row.kategori_masalah !== "G" && !String(row.kategori_masalah).includes("ISTIRAHAT")) ||
        (row.keterangan_cacat && (row.keterangan_cacat.includes("[TAMBAHAN QC]") || row.keterangan_cacat.includes("QC:")))
      );

      if (hasRealDefects) {
        defectCountForRow = isMeteran ? getDefectMeterLength(row) : 1;
        totalDefects += defectCountForRow;
        if (isMeteran) totalDefectsMeter += defectCountForRow;
        else totalDefectsPanel += defectCountForRow;

        // Categorize problems (A - G)
        const cats = new Set<string>();
        if (row.production_defects && Array.isArray(row.production_defects) && row.production_defects.length > 0) {
          row.production_defects.forEach((d: any) => {
            const k = (d.kategori || "A").trim().toUpperCase();
            if (CATEGORY_NAMES[k]) cats.add(k);
            const det = d.detail || "";
            if (det) {
              const stat = categoryStatsMap.get(k);
              if (stat) {
                stat.issues.set(det, (stat.issues.get(det) || 0) + 1);
              }
            }
          });
        } else if (row.kategori_masalah) {
          const rawCats = String(row.kategori_masalah).split(/[,|]/).map((s) => s.trim().toUpperCase());
          rawCats.forEach((k) => {
            if (CATEGORY_NAMES[k]) cats.add(k);
          });
          if (row.detail_masalah) {
            const detParts = String(row.detail_masalah).split(/[,|]/).map((s) => s.trim());
            detParts.forEach((det) => {
              cats.forEach((k) => {
                const stat = categoryStatsMap.get(k);
                if (stat) {
                  stat.issues.set(det, (stat.issues.get(det) || 0) + 1);
                }
              });
            });
          }
        }

        cats.forEach((catKey) => {
          const stat = categoryStatsMap.get(catKey);
          if (stat) {
            stat.count += defectCountForRow;
          }
        });
      }

      // Calculate Grades (Mending/Inspection)
      let mendingGrade = (row.status_mending || "").trim().toUpperCase();
      if (!mendingGrade) {
        // Fallback to inspection grade
        if (row.final_inspection_id === 1) mendingGrade = "A";
        else if (row.final_inspection_id === 2 || row.final_inspection_id === 3) mendingGrade = "B";
        else if (row.final_inspection_id === 4) mendingGrade = "BS";
      }

      let gA = 0, gB = 0, gBS = 0, gUngraded = 0;
      if (mendingGrade === "A") {
        totalGradeA += 1;
        gA = 1;
        if (isMeteran) gradeA_Meter += 1;
        else gradeA_Panel += 1;
      } else if (mendingGrade === "B") {
        totalGradeB += 1;
        gB = 1;
        if (isMeteran) gradeB_Meter += 1;
        else gradeB_Panel += 1;
      } else if (mendingGrade === "BS") {
        totalGradeBS += 1;
        gBS = 1;
        if (isMeteran) gradeBS_Meter += 1;
        else gradeBS_Panel += 1;
      } else {
        totalUngraded += 1;
        gUngraded = 1;
      }

      // Update Daily Trend
      const dailyItem = dailyMap.get(day);
      if (dailyItem) {
        dailyItem.output += rowOutput;
        dailyItem.panelCount += rowPanel;
        dailyItem.meterCount += rowMeter;
        dailyItem.defects += defectCountForRow;
        if (isMeteran) dailyItem.defectsMeter += defectCountForRow;
        else dailyItem.defectsPanel += defectCountForRow;
      }

      // Update Operator Stats
      if (!operatorMap.has(opName)) {
        operatorMap.set(opName, {
          operatorId: opId,
          operatorName: opName,
          shiftGroup: groupName || shiftGroup,
          totalOutput: 0,
          panelCount: 0,
          meterCount: 0,
          totalDefects: 0,
          totalDefectsPanel: 0,
          totalDefectsMeter: 0,
          defectRate: 0,
          totalDowntimeSeconds: 0,
          totalDowntimeMinutes: 0,
          gradeA: 0,
          gradeB: 0,
          gradeBS: 0,
          gradeUngraded: 0,
          qualityScore: 100,
          machinesOperated: [],
          shiftCount: 0,
          contributionPercent: 0,
          performanceRating: "Good",
        });
      }

      const opStat = operatorMap.get(opName)!;
      opStat.totalOutput += rowOutput;
      opStat.panelCount += rowPanel;
      opStat.meterCount += rowMeter;
      opStat.totalDefects += defectCountForRow;
      if (isMeteran) opStat.totalDefectsMeter += defectCountForRow;
      else opStat.totalDefectsPanel += defectCountForRow;
      opStat.gradeA += gA;
      opStat.gradeB += gB;
      opStat.gradeBS += gBS;
      opStat.gradeUngraded += gUngraded;
      if (!opStat.machinesOperated.includes(mcId)) {
        opStat.machinesOperated.push(mcId);
      }

      // Update Machine Stats
      if (!machineMap.has(mcId)) {
        machineMap.set(mcId, {
          machineId: mcId,
          machineType: isMeteran ? "METERAN" : "PANEL",
          totalOutput: 0,
          panelCount: 0,
          meterCount: 0,
          totalDefects: 0,
          totalDowntimeSeconds: 0,
          totalDowntimeMinutes: 0,
          defectRate: 0,
          operators: [],
          designs: [],
        });
      }

      const mcStat = machineMap.get(mcId)!;
      mcStat.totalOutput += rowOutput;
      mcStat.panelCount += rowPanel;
      mcStat.meterCount += rowMeter;
      mcStat.totalDefects += defectCountForRow;
      if (!mcStat.operators.includes(opName)) mcStat.operators.push(opName);
      const dsId = header.design_id ? String(header.design_id).trim() : "";
      if (dsId && !mcStat.designs.includes(dsId)) mcStat.designs.push(dsId);
    });

    // 6. Post-Processing Daily Trend Data
    const dailyTrends: ShiftDailyTrend[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const item = dailyMap.get(d)!;
      item.activeOperators = dailyOperatorsMap.get(d)?.size || 0;
      item.activeMachines = Array.from(dailyMachinesMap.get(d) || []);
      dailyTrends.push(item);
    }

    // 7. Post-Processing Operators List & Ratings
    const totalOutputSum = fabricType === "panel" ? totalPanel : fabricType === "meter" ? totalMeter : (totalPanel + totalMeter);
    const operatorList = Array.from(operatorMap.values()).map((op) => {
      const totalGraded = op.gradeA + op.gradeB + op.gradeBS;
      op.qualityScore = totalGraded > 0 ? Math.round((op.gradeA / totalGraded) * 100) : 100;
      op.defectRate = op.totalOutput > 0 ? Number(((op.totalDefects / op.totalOutput) * 100).toFixed(1)) : 0;
      op.contributionPercent = totalOutputSum > 0 ? Number(((op.totalOutput / totalOutputSum) * 100).toFixed(1)) : 0;

      // Rating determination
      if (op.qualityScore >= 90 && op.defectRate <= 5 && op.totalOutput > 0) {
        op.performanceRating = "Top Performer";
      } else if (op.defectRate > 15 || op.qualityScore < 70) {
        op.performanceRating = "Needs Attention";
      } else {
        op.performanceRating = "Good";
      }

      return op;
    });

    // Sort operators by total output descending
    operatorList.sort((a, b) => b.totalOutput - a.totalOutput);

    // 8. Post-Processing Machines List
    const machineList = Array.from(machineMap.values()).map((mc) => {
      mc.defectRate = mc.totalOutput > 0 ? Number(((mc.totalDefects / mc.totalOutput) * 100).toFixed(1)) : 0;
      return mc;
    });
    machineList.sort((a, b) => b.totalOutput - a.totalOutput);

    // 9. Post-Processing Problem Categories
    const totalProblemCount = Array.from(categoryStatsMap.values()).reduce((acc, c) => acc + c.count, 0);
    const problemCategories: ShiftCategoryProblem[] = Object.keys(CATEGORY_NAMES).map((catKey) => {
      const info = CATEGORY_NAMES[catKey];
      const stat = categoryStatsMap.get(catKey)!;
      const issuesSorted = Array.from(stat.issues.entries())
        .map(([issue, count]) => ({ issue, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        category: catKey,
        name: `${catKey} - ${info.name}`,
        color: info.color,
        count: stat.count,
        downtimeMinutes: Math.round(stat.downtimeSeconds / 60),
        percentage: totalProblemCount > 0 ? Number(((stat.count / totalProblemCount) * 100).toFixed(1)) : 0,
        topIssues: issuesSorted,
      };
    });
    problemCategories.sort((a, b) => b.count - a.count);

    // 10. Summary Metrics
    const activeDaysCount = activeDaysSet.size;
    const avgDailyOutput = activeDaysCount > 0 ? Math.round(totalOutputSum / activeDaysCount) : 0;
    const totalDowntimeMinutes = Math.round(totalDowntimeSeconds / 60);
    const totalDowntimeHours = Number((totalDowntimeSeconds / 3600).toFixed(1));
    const avgDailyDowntimeMinutes = activeDaysCount > 0 ? Math.round(totalDowntimeMinutes / activeDaysCount) : 0;
    
    const overallTotalGraded = totalGradeA + totalGradeB + totalGradeBS;
    const qualityScore = overallTotalGraded > 0 ? Math.round((totalGradeA / overallTotalGraded) * 100) : 100;
    
    const gradedPanelTotal = gradeA_Panel + gradeB_Panel + gradeBS_Panel;
    const qualityScore_Panel = gradedPanelTotal > 0 ? Math.round((gradeA_Panel / gradedPanelTotal) * 100) : 100;
    
    const gradedMeterTotal = gradeA_Meter + gradeB_Meter + gradeBS_Meter;
    const qualityScore_Meter = gradedMeterTotal > 0 ? Math.round((gradeA_Meter / gradedMeterTotal) * 100) : 100;

    const overallDefectRate = totalOutputSum > 0 ? Number(((totalDefects / totalOutputSum) * 100).toFixed(1)) : 0;
    const defectRatePanel = totalPanel > 0 ? Number(((totalDefectsPanel / totalPanel) * 100).toFixed(1)) : 0;
    const defectRateMeter = totalMeter > 0 ? Number(((totalDefectsMeter / totalMeter) * 100).toFixed(1)) : 0;

    const unit = fabricType === "panel" ? "Panel" : fabricType === "meter" ? "Meter" : "Campuran (Panel & Meter)";

    const summary: ShiftPerformanceSummary = {
      month,
      year,
      shiftGroup: shiftGroup.toUpperCase(),
      fabricType,
      unit,
      totalOutput: totalOutputSum,
      totalPanel,
      totalMeter,
      totalDefects,
      totalDefectsPanel,
      totalDefectsMeter,
      defectRate: overallDefectRate,
      defectRatePanel,
      defectRateMeter,
      totalDowntimeSeconds,
      totalDowntimeMinutes,
      totalDowntimeHours,
      gradeA: totalGradeA,
      gradeB: totalGradeB,
      gradeBS: totalGradeBS,
      gradeUngraded: totalUngraded,
      qualityScore,
      gradeA_Panel,
      gradeB_Panel,
      gradeBS_Panel,
      qualityScore_Panel,
      gradeA_Meter,
      gradeB_Meter,
      gradeBS_Meter,
      qualityScore_Meter,
      totalOperators: operatorList.length,
      activeDays: activeDaysCount,
      avgDailyOutput,
      avgDailyDowntimeMinutes,
      topOperator: operatorList.length > 0 ? operatorList[0].operatorName : "-",
      topIssueCategory: problemCategories.length > 0 && problemCategories[0].count > 0 ? problemCategories[0].name : "Tidak ada",
      dailyTrends,
      operators: operatorList,
      machines: machineList,
      problemCategories,
    };

    return { success: true, data: summary };
  } catch (err: any) {
    console.error("Exception in getMonthlyShiftPerformance:", err);
    return { success: false, error: err.message || "Terjadi kesalahan saat memproses data kinerja shift." };
  }
}
