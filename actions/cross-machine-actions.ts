"use server";

import { getMonthlyMachineReport, MonthlyMachineReportData } from "@/actions/report-actions";
import { getMachineStatuses } from "@/actions/dashboard-actions";
import { REGISTERED_MACHINES } from "@/lib/constants";

export interface MachineTeamMetric {
  machineId: string;
  isMeterMachine: boolean;
  activeDaysCount: number;
  hasData: boolean;
  hasilProduksi: {
    A: number;
    B: number;
    C: number;
    total: number;
  };
  effTeam: {
    A: number;
    B: number;
    C: number;
    avg: number;
  };
  cacatPerTeam: {
    A: number;
    B: number;
    C: number;
    avg: number;
  };
}

export interface CrossMachineReportSummary {
  month: number;
  year: number;
  monthName: string;
  machines: MachineTeamMetric[];
  totalRow: {
    hasilProduksi: {
      A: number;
      B: number;
      C: number;
      total: number;
    };
    effTeam: {
      A: number;
      B: number;
      C: number;
      avg: number;
    };
    cacatPerTeam: {
      A: number;
      B: number;
      C: number;
      avg: number;
    };
  };
}

export interface CrossMachineWeeklySummary extends CrossMachineReportSummary {
  weekNumber: number;
  weekLabel: string;
  startDate: number;
  endDate: number;
}

export interface DualPeriodCrossMachineReport {
  currentPeriod: CrossMachineReportSummary;
  previousPeriod: CrossMachineReportSummary;
  currentWeeklySummaries: CrossMachineWeeklySummary[];
  kpiComparison: {
    totalProductionCurrent: number;
    totalProductionPrevious: number;
    productionGrowthPercent: number;
    avgEffCurrent: number;
    avgEffPrevious: number;
    effDeltaPercent: number;
    avgDefectCurrent: number;
    avgDefectPrevious: number;
    defectDeltaPercent: number;
  };
}

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

// Ordered standard machine list matching report priority
const ORDERED_MACHINE_LIST = [
  "R1",
  "R2",
  "R3B",
  "R16",
  "R1C",
  "R2C",
  "R11",
  "R12",
  "T1C",
  "T2A",
];

/**
 * Calculates team breakdown metrics for a single machine's monthly data
 */
function computeMachineTeamMetrics(
  machineId: string,
  reportData: MonthlyMachineReportData[],
  isMeterMachine: boolean
): MachineTeamMetric {
  // Hitung jumlah hari aktif produksi (hari yang memiliki data/operator)
  const activeDaysCount =
    reportData.filter((d) =>
      Object.values(d.teamData).some(
        (td) =>
          (td.hasil_produksi && td.hasil_produksi > 0) ||
          (td.eff_100 && td.eff_100 > 0) ||
          (td.operator_name && td.operator_name.trim() !== "")
      )
    ).length || reportData.length || 1;

  const hasilProduksi = { A: 0, B: 0, C: 0, total: 0 };
  const teamShiftPercentages = { A: 0, B: 0, C: 0 };
  const teamCacatPercentages = { A: 0, B: 0, C: 0 };

  let totalItemsCount = 0;

  reportData.forEach((dayData) => {
    const teamsToIterate = dayData.orderedTeams || [
      { teamName: "A", data: dayData.teamData["A"] },
      { teamName: "B", data: dayData.teamData["B"] },
      { teamName: "C", data: dayData.teamData["C"] },
    ];

    teamsToIterate.forEach((teamObj) => {
      const t = teamObj.teamName as "A" | "B" | "C";
      const td = teamObj.data;
      if (!td) return;

      const hp = td.hasil_produksi || 0;
      const eff100 = td.eff_100 || 0;
      const jc = td.jumlah_cacat || 0;

      if (t === "A" || t === "B" || t === "C") {
        hasilProduksi[t] += hp;
        totalItemsCount += hp + jc + eff100;

        // Persentase Efisiensi shift
        if (hp > 0 && eff100 > 0) {
          teamShiftPercentages[t] += (hp / eff100) * 100;
        }

        // Persentase Cacat shift
        if (jc > 0 && hp > 0) {
          teamCacatPercentages[t] += (jc / hp) * 100;
        }
      }
    });
  });

  hasilProduksi.total = hasilProduksi.A + hasilProduksi.B + hasilProduksi.C;

  const effTeam = {
    A: activeDaysCount > 0 ? teamShiftPercentages.A / activeDaysCount : 0,
    B: activeDaysCount > 0 ? teamShiftPercentages.B / activeDaysCount : 0,
    C: activeDaysCount > 0 ? teamShiftPercentages.C / activeDaysCount : 0,
    avg: 0,
  };
  effTeam.avg = (effTeam.A + effTeam.B + effTeam.C) / 3;

  const cacatPerTeam = {
    A: activeDaysCount > 0 ? teamCacatPercentages.A / activeDaysCount : 0,
    B: activeDaysCount > 0 ? teamCacatPercentages.B / activeDaysCount : 0,
    C: activeDaysCount > 0 ? teamCacatPercentages.C / activeDaysCount : 0,
    avg: 0,
  };
  cacatPerTeam.avg = (cacatPerTeam.A + cacatPerTeam.B + cacatPerTeam.C) / 3;

  const hasData = totalItemsCount > 0 || hasilProduksi.total > 0;

  return {
    machineId,
    isMeterMachine,
    activeDaysCount,
    hasData,
    hasilProduksi,
    effTeam,
    cacatPerTeam,
  };
}

function buildReportSummary(
  month: number,
  year: number,
  machines: MachineTeamMetric[]
): CrossMachineReportSummary {
  const totalHasilA = machines.reduce((acc, m) => acc + m.hasilProduksi.A, 0);
  const totalHasilB = machines.reduce((acc, m) => acc + m.hasilProduksi.B, 0);
  const totalHasilC = machines.reduce((acc, m) => acc + m.hasilProduksi.C, 0);
  const totalHasilAll = totalHasilA + totalHasilB + totalHasilC;

  // Active machines count for average calculations
  const activeMachines = machines.filter((m) => m.hasData);
  const count = activeMachines.length || machines.length || 1;

  const avgEffA = machines.reduce((acc, m) => acc + m.effTeam.A, 0) / count;
  const avgEffB = machines.reduce((acc, m) => acc + m.effTeam.B, 0) / count;
  const avgEffC = machines.reduce((acc, m) => acc + m.effTeam.C, 0) / count;
  const avgEffTotal = (avgEffA + avgEffB + avgEffC) / 3;

  const avgCacatA = machines.reduce((acc, m) => acc + m.cacatPerTeam.A, 0) / count;
  const avgCacatB = machines.reduce((acc, m) => acc + m.cacatPerTeam.B, 0) / count;
  const avgCacatC = machines.reduce((acc, m) => acc + m.cacatPerTeam.C, 0) / count;
  const avgCacatTotal = (avgCacatA + avgCacatB + avgCacatC) / 3;

  return {
    month,
    year,
    monthName: MONTH_NAMES[month - 1] || `Bulan ${month}`,
    machines,
    totalRow: {
      hasilProduksi: {
        A: totalHasilA,
        B: totalHasilB,
        C: totalHasilC,
        total: totalHasilAll,
      },
      effTeam: {
        A: avgEffA,
        B: avgEffB,
        C: avgEffC,
        avg: avgEffTotal,
      },
      cacatPerTeam: {
        A: avgCacatA,
        B: avgCacatB,
        C: avgCacatC,
        avg: avgCacatTotal,
      },
    },
  };
}

/**
 * Fetches and calculates cross-machine monthly and weekly performance matrices
 */
export async function getCrossMachineReportWithWeeks(
  month: number,
  year: number
): Promise<{
  monthlySummary: CrossMachineReportSummary;
  weeklySummaries: CrossMachineWeeklySummary[];
}> {
  // Determine machine list
  let machineList = ORDERED_MACHINE_LIST;
  try {
    const res = await getMachineStatuses();
    if (res?.success && res.data && res.data.length > 0) {
      const activeIds = res.data.map((s: any) => s.nomor_mc).filter(Boolean);
      // Merge with registered machines to ensure complete display
      const mergedSet = new Set([...ORDERED_MACHINE_LIST, ...activeIds, ...REGISTERED_MACHINES]);
      machineList = Array.from(mergedSet).sort((a, b) => {
        const idxA = ORDERED_MACHINE_LIST.indexOf(a);
        const idxB = ORDERED_MACHINE_LIST.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });
    }
  } catch (err) {
    console.error("Error fetching machine statuses for cross-machine report:", err);
  }

  // Fetch report data for all machines in parallel
  const rawMachineReports = await Promise.all(
    machineList.map(async (mId) => {
      try {
        const { data, isMeterMachine } = await getMonthlyMachineReport(month, year, mId);
        return {
          mId,
          data: data || [],
          isMeterMachine: Boolean(isMeterMachine),
        };
      } catch (e) {
        console.error(`Error calculating metrics for machine ${mId}:`, e);
        return {
          mId,
          data: [] as MonthlyMachineReportData[],
          isMeterMachine: mId.startsWith("T") || mId.includes("M"),
        };
      }
    })
  );

  // 1. Full Month Summary
  const monthlyMachines = rawMachineReports.map(({ mId, data, isMeterMachine }) =>
    computeMachineTeamMetrics(mId, data, isMeterMachine)
  );
  const monthlySummary = buildReportSummary(month, year, monthlyMachines);

  // 2. Weekly Summaries
  const daysInMonth = new Date(year, month, 0).getDate();
  const weekDefinitions = [
    { weekNumber: 1, startDate: 1, endDate: 7 },
    { weekNumber: 2, startDate: 8, endDate: 14 },
    { weekNumber: 3, startDate: 15, endDate: 21 },
    { weekNumber: 4, startDate: 22, endDate: 28 },
  ];
  if (daysInMonth >= 29) {
    weekDefinitions.push({
      weekNumber: 5,
      startDate: 29,
      endDate: daysInMonth,
    });
  }

  const weeklySummaries: CrossMachineWeeklySummary[] = weekDefinitions.map((w) => {
    const weekMachines = rawMachineReports.map(({ mId, data, isMeterMachine }) => {
      const filteredDays = data.filter((d: any) => {
        const dayNum = d.tanggal !== undefined ? d.tanggal : d.day;
        return dayNum >= w.startDate && dayNum <= w.endDate;
      });
      return computeMachineTeamMetrics(mId, filteredDays, isMeterMachine);
    });

    const summary = buildReportSummary(month, year, weekMachines);
    return {
      ...summary,
      weekNumber: w.weekNumber,
      weekLabel: `Minggu ${w.weekNumber} (Tgl ${w.startDate} - ${w.endDate})`,
      startDate: w.startDate,
      endDate: w.endDate,
    };
  });

  return { monthlySummary, weeklySummaries };
}

/**
 * Fetches and calculates cross-machine monthly performance matrix
 */
export async function getCrossMachineMonthlyReport(
  month: number,
  year: number
): Promise<CrossMachineReportSummary> {
  const { monthlySummary } = await getCrossMachineReportWithWeeks(month, year);
  return monthlySummary;
}

/**
 * Fetches dual-period report (selected month + previous month) with weekly breakdown & comparison KPIs
 */
export async function getDualPeriodMachineReport(
  month: number,
  year: number
): Promise<DualPeriodCrossMachineReport> {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const [currentResult, previousSummary] = await Promise.all([
    getCrossMachineReportWithWeeks(month, year),
    getCrossMachineMonthlyReport(prevMonth, prevYear),
  ]);

  const currentPeriod = currentResult.monthlySummary;
  const previousPeriod = previousSummary;
  const currentWeeklySummaries = currentResult.weeklySummaries;

  const prodCur = currentPeriod.totalRow.hasilProduksi.total;
  const prodPrev = previousPeriod.totalRow.hasilProduksi.total;
  const prodGrowth =
    prodPrev > 0 ? ((prodCur - prodPrev) / prodPrev) * 100 : prodCur > 0 ? 100 : 0;

  const effCur = currentPeriod.totalRow.effTeam.avg;
  const effPrev = previousPeriod.totalRow.effTeam.avg;
  const effDelta = effCur - effPrev;

  const defCur = currentPeriod.totalRow.cacatPerTeam.avg;
  const defPrev = previousPeriod.totalRow.cacatPerTeam.avg;
  const defDelta = defCur - defPrev;

  return {
    currentPeriod,
    previousPeriod,
    currentWeeklySummaries,
    kpiComparison: {
      totalProductionCurrent: prodCur,
      totalProductionPrevious: prodPrev,
      productionGrowthPercent: prodGrowth,
      avgEffCurrent: effCur,
      avgEffPrevious: effPrev,
      effDeltaPercent: effDelta,
      avgDefectCurrent: defCur,
      avgDefectPrevious: defPrev,
      defectDeltaPercent: defDelta,
    },
  };
}
