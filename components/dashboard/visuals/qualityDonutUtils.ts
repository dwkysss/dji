import { isBsAwalAkhir, isPanelGagalCacat, hasRealDefect } from "@/lib/mending-grade-utils";
import { DashboardTransaction, isMeterItem } from "@/hooks/useDashboardKpis";

export interface QualityStats {
  totalA: number;
  totalB: number;
  totalBS: number;
  totalUngraded: number;
  totalCeklis: number;
  totalSilang: number;
  totalQuality: number;
  totalOperator: number;
  pctA: number;
  pctB: number;
  pctBS: number;
  pctUngraded: number;
  pctCeklis: number;
  pctSilang: number;
}

function computePcsQualityStats(filteredData: DashboardTransaction[]) {
  let totalA = 0;
  let totalB = 0;
  let totalBS = 0;
  let totalUngraded = 0;
  let totalCeklis = 0;
  let totalSilang = 0;

  const panelMap = new Map<string, DashboardTransaction[]>();

  filteredData.forEach((item) => {
    if ((item.hasil_meter || 0) > 0 || isMeterItem(item)) return;
    if (isBsAwalAkhir(item)) return;
    const panelStr = String(item.panel_no_str || item.panel_no || "").toUpperCase().trim();
    if (
      !panelStr ||
      panelStr.includes("DOWNTIME") ||
      panelStr === "BERHENTI" ||
      panelStr.includes("(GAGAL)") ||
      panelStr.includes("(BS)") ||
      panelStr.includes("BS AWAL") ||
      panelStr.includes("BS AKHIR")
    ) {
      return;
    }
    const cutKey = item.potongan_ke || item.design || item.header_id;
    const key = `${item.tanggal}_${item.mesin_id}_${cutKey}_${panelStr}_${item.header_id}`;
    if (!panelMap.has(key)) panelMap.set(key, []);
    panelMap.get(key)!.push(item);
  });

  panelMap.forEach((panelItems) => {
    const isPanelSilang = panelItems.some(
      (i) =>
        !isPanelGagalCacat(i) &&
        hasRealDefect(i) &&
        (i.status_qc === "Recheck" ||
          i.grade === "BS" ||
          (i.kategori_masalah && i.kategori_masalah.trim() !== ""))
    );

    if (isPanelSilang) totalSilang++;
    else totalCeklis++;

    const hasBS = panelItems.some((i) => i.grade === "BS");
    const hasB = panelItems.some((i) => i.grade === "GRADE B");
    const hasA = panelItems.some((i) => i.grade === "GRADE A");

    if (hasBS) totalBS++;
    else if (hasB) totalB++;
    else if (hasA) totalA++;
    else totalUngraded++;
  });

  return { totalA, totalB, totalBS, totalUngraded, totalCeklis, totalSilang };
}

function computeMeterQualityStats(filteredData: DashboardTransaction[]) {
  const uniqueHeadersMap = new Map<string, DashboardTransaction>();
  filteredData.forEach((item) => {
    if (item.header_id && !uniqueHeadersMap.has(item.header_id)) {
      uniqueHeadersMap.set(item.header_id, item);
    }
  });

  const uniqueItems = Array.from(uniqueHeadersMap.values());
  const totalA = uniqueItems
    .filter((i) => i.grade === "GRADE A")
    .reduce((acc, curr) => acc + (parseFloat(curr.hasil_meter as any) || 0), 0);
  const totalB = uniqueItems
    .filter((i) => i.grade === "GRADE B")
    .reduce((acc, curr) => acc + (parseFloat(curr.hasil_meter as any) || 0), 0);
  const totalBS = uniqueItems
    .filter((i) => i.grade === "BS")
    .reduce((acc, curr) => acc + (parseFloat(curr.hasil_meter as any) || 0), 0);
  const totalUngraded = uniqueItems
    .filter(
      (i) =>
        i.grade === "UNGRADED" ||
        !["GRADE A", "GRADE B", "BS"].includes(i.grade)
    )
    .reduce((acc, curr) => acc + (parseFloat(curr.hasil_meter as any) || 0), 0);

  const totalMeterItems = uniqueItems.reduce(
    (acc, curr) => acc + (parseFloat(curr.hasil_meter as any) || 0),
    0
  );
  const silangMeter = filteredData.filter(
    (i) =>
      !isBsAwalAkhir(i) &&
      !isPanelGagalCacat(i) &&
      (hasRealDefect(i) || i.status_qc === "Recheck")
  ).length;

  const totalSilang = silangMeter;
  const totalCeklis = Math.max(0, totalMeterItems - silangMeter);

  return { totalA, totalB, totalBS, totalUngraded, totalCeklis, totalSilang };
}

export function computeQualityStats(
  filteredData: DashboardTransaction[],
  metricMode: "PCS" | "METER"
): QualityStats {
  const counts =
    metricMode === "PCS"
      ? computePcsQualityStats(filteredData)
      : computeMeterQualityStats(filteredData);

  const totalQuality = counts.totalA + counts.totalB + counts.totalBS + counts.totalUngraded;
  const totalOperator = counts.totalCeklis + counts.totalSilang;

  const pctA = totalQuality > 0 ? (counts.totalA / totalQuality) * 100 : 0;
  const pctB = totalQuality > 0 ? (counts.totalB / totalQuality) * 100 : 0;
  const pctBS = totalQuality > 0 ? (counts.totalBS / totalQuality) * 100 : 0;
  const pctUngraded = totalQuality > 0 ? (counts.totalUngraded / totalQuality) * 100 : 0;

  const pctCeklis = totalOperator > 0 ? (counts.totalCeklis / totalOperator) * 100 : 0;
  const pctSilang = totalOperator > 0 ? (counts.totalSilang / totalOperator) * 100 : 0;

  return {
    ...counts,
    totalQuality,
    totalOperator,
    pctA,
    pctB,
    pctBS,
    pctUngraded,
    pctCeklis,
    pctSilang,
  };
}
