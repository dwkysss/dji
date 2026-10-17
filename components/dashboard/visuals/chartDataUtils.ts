import { getShiftName } from "@/lib/shift-utils";
import { DashboardTransaction } from "@/hooks/useDashboardKpis";
import { aggregatePcsGroup, aggregateMeterGroup, PcsGroupSums } from "./chartAggregationUtils";

export * from "./categoryBreakdownUtils";
export * from "./chartAggregationUtils";

export function getTransactionShift(item: DashboardTransaction): "Shift 1" | "Shift 2" | "Shift 3" {
  if (item.shift) return item.shift;
  const ts = item.tanggal_jam || (item as any).created_at;
  if (ts && (String(ts).includes(":") || String(ts).includes("T"))) {
    return getShiftName(ts);
  }
  return "Shift 1";
}

export const getNiceChartMax = (rawValue: number, minimum = 5): number => {
  if (!Number.isFinite(rawValue) || rawValue <= minimum) return minimum;

  const roughTick = rawValue / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughTick)));
  const normalized = roughTick / magnitude;
  const niceNormalized =
    normalized <= 1 ? 1 :
      normalized <= 2 ? 2 :
        normalized <= 2.5 ? 2.5 :
          normalized <= 5 ? 5 :
            10;

  return niceNormalized * magnitude * 4;
};

export interface ChartDataItem extends PcsGroupSums {
  label: string;
  total: number;
}

export function getChartGroups(
  chartGroupBy: "HARI" | "DESIGN" | "PEGAWAI" | "GROUP" | "MESIN" | "KATEGORI",
  filteredData: DashboardTransaction[],
  isSingleDay: boolean
): string[] {
  if (chartGroupBy === "HARI") {
    if (isSingleDay) return ["Shift 1", "Shift 2", "Shift 3"];
    const dates = Array.from(new Set(filteredData.map((item) => item.tanggal)));
    const sorted = dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return sorted.length > 0 ? sorted : [new Date().toISOString().split("T")[0]];
  }
  if (chartGroupBy === "DESIGN") {
    return Array.from(new Set(filteredData.map((item) => item.design || "Tanpa Design"))).sort();
  }
  if (chartGroupBy === "PEGAWAI") {
    const operatorVolume: Record<string, number> = {};
    filteredData.forEach((item) => {
      operatorVolume[item.nama_operator] = (operatorVolume[item.nama_operator] || 0) + item.hasil_pcs;
    });
    return Object.keys(operatorVolume).sort((a, b) => operatorVolume[b] - operatorVolume[a]);
  }
  if (chartGroupBy === "GROUP") {
    return Array.from(new Set(filteredData.map((item) => item.group || "Tanpa Group"))).sort();
  }
  if (chartGroupBy === "MESIN") {
    return Array.from(new Set(filteredData.map((item) => item.mesin_id || "Tanpa Mesin"))).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.replace(/\D/g, "")) || 0;
      return numA !== numB ? numA - numB : a.localeCompare(b);
    });
  }
  return [];
}

export function filterGroupItems(
  groupName: string,
  chartGroupBy: "HARI" | "DESIGN" | "PEGAWAI" | "GROUP" | "MESIN" | "KATEGORI",
  filteredData: DashboardTransaction[],
  isSingleDay: boolean
): DashboardTransaction[] {
  if (chartGroupBy === "HARI") {
    return isSingleDay
      ? filteredData.filter((item) => getTransactionShift(item) === groupName)
      : filteredData.filter((item) => item.tanggal === groupName);
  }
  if (chartGroupBy === "DESIGN") {
    return filteredData.filter((item) => (item.design || "Tanpa Design") === groupName);
  }
  if (chartGroupBy === "PEGAWAI") {
    return filteredData.filter((item) => item.nama_operator === groupName);
  }
  if (chartGroupBy === "GROUP") {
    return filteredData.filter((item) => (item.group || "Tanpa Group") === groupName);
  }
  if (chartGroupBy === "MESIN") {
    return filteredData.filter((item) => (item.mesin_id || "Tanpa Mesin") === groupName);
  }
  return [];
}

export function formatGroupLabel(
  groupName: string,
  chartGroupBy: "HARI" | "DESIGN" | "PEGAWAI" | "GROUP" | "MESIN" | "KATEGORI",
  isSingleDay: boolean
): string {
  if (chartGroupBy === "HARI" && !isSingleDay) {
    const d = new Date(groupName);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    }
  }
  return groupName;
}

export interface BuildChartDataParams {
  filteredData: DashboardTransaction[];
  chartGroupBy: "HARI" | "DESIGN" | "PEGAWAI" | "GROUP" | "MESIN" | "KATEGORI";
  metricMode: "PCS" | "METER";
  qualityViewMode: "QC_GRADE" | "OPERATOR_STATUS";
  isSingleDay: boolean;
  activeFilter: string;
  categoryList: [string, number][];
}

export function buildChartData({
  filteredData,
  chartGroupBy,
  metricMode,
  qualityViewMode,
  isSingleDay,
  activeFilter,
  categoryList,
}: BuildChartDataParams): ChartDataItem[] {
  if (activeFilter === "PROBLEMS") {
    return categoryList.map(([cat, count]) => ({
      label: cat,
      gradeA_sum: 0,
      gradeB_sum: 0,
      bs_sum: 0,
      ungraded_sum: 0,
      ceklis_sum: 0,
      silang_sum: count,
      total: count,
      totalMeterItems: 0,
    }));
  }

  const groups = getChartGroups(chartGroupBy, filteredData, isSingleDay);

  return groups.map((groupName) => {
    const items = filterGroupItems(groupName, chartGroupBy, filteredData, isSingleDay);
    const sums = metricMode === "PCS" ? aggregatePcsGroup(items) : aggregateMeterGroup(items);

    const total =
      qualityViewMode === "OPERATOR_STATUS"
        ? sums.ceklis_sum + sums.silang_sum
        : sums.gradeA_sum + sums.gradeB_sum + sums.bs_sum + sums.ungraded_sum;

    return {
      label: formatGroupLabel(groupName, chartGroupBy, isSingleDay),
      ...sums,
      total,
    };
  });
}
