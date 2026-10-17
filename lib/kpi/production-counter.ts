import { isBsAwalAkhir, isPanelGagalCacat, hasRealDefect } from "@/lib/mending-grade-utils";
import { DashboardTransaction } from "./kpi-types";
import { isMeterItem } from "./meter-classification";

export interface PcsGroupSums {
  gradeA_sum: number;
  gradeB_sum: number;
  bs_sum: number;
  ungraded_sum: number;
  ceklis_sum: number;
  silang_sum: number;
  totalMeterItems?: number;
}

export function groupItemsByCut(items: DashboardTransaction[]): DashboardTransaction[][] {
  const cutMap: { [key: string]: DashboardTransaction[] } = {};
  items.forEach((item) => {
    if (
      item.panel_no !== undefined &&
      item.panel_no !== null &&
      !isNaN(Number(item.panel_no)) &&
      (item.hasil_meter || 0) === 0 &&
      !isMeterItem(item)
    ) {
      const key = `${item.mesin_id}_${item.design}_${item.potongan_ke || "default"}`;
      if (!cutMap[key]) cutMap[key] = [];
      cutMap[key].push(item);
    }
  });
  return Object.values(cutMap);
}

export function groupCutByPanelNo(cutItems: DashboardTransaction[]): DashboardTransaction[][] {
  const panelByNoMap = new Map<number, DashboardTransaction[]>();
  cutItems.forEach((i) => {
    const pNo = Number(i.panel_no);
    if (!isNaN(pNo)) {
      if (!panelByNoMap.has(pNo)) panelByNoMap.set(pNo, []);
      panelByNoMap.get(pNo)!.push(i);
    }
  });
  return Array.from(panelByNoMap.values());
}

export function evaluatePanelQuality(panelRows: DashboardTransaction[]): {
  grade: "A" | "B" | "BS" | "UNGRADED";
  isSilang: boolean | null;
} {
  const hasBS = panelRows.some((i) => i.grade === "BS");
  const hasB = panelRows.some((i) => i.grade === "GRADE B");
  const hasA = panelRows.some((i) => i.grade === "GRADE A");

  const grade = hasA ? "A" : hasB ? "B" : hasBS ? "BS" : "UNGRADED";

  const firstItem = panelRows[0];
  if (isBsAwalAkhir(firstItem)) {
    return { grade, isSilang: null };
  }

  const isSilang = panelRows.some(
    (i) =>
      !isPanelGagalCacat(i) &&
      hasRealDefect(i) &&
      (i.status_qc === "Recheck" ||
        i.grade === "BS" ||
        (i.kategori_masalah && i.kategori_masalah.trim() !== ""))
  );

  return { grade, isSilang };
}

export function aggregatePcsGroup(items: DashboardTransaction[]): PcsGroupSums {
  let gradeA_sum = 0;
  let gradeB_sum = 0;
  let bs_sum = 0;
  let ungraded_sum = 0;
  let ceklis_sum = 0;
  let silang_sum = 0;

  const cutGroups = groupItemsByCut(items);

  cutGroups.forEach((cutItems) => {
    const panelGroups = groupCutByPanelNo(cutItems);

    panelGroups.forEach((panelRows) => {
      const { grade, isSilang } = evaluatePanelQuality(panelRows);

      if (grade === "A") gradeA_sum++;
      else if (grade === "B") gradeB_sum++;
      else if (grade === "BS") bs_sum++;
      else ungraded_sum++;

      if (isSilang !== null) {
        if (isSilang) silang_sum++;
        else ceklis_sum++;
      }
    });
  });

  return {
    gradeA_sum,
    gradeB_sum,
    bs_sum,
    ungraded_sum,
    ceklis_sum,
    silang_sum,
    totalMeterItems: 0,
  };
}

export function aggregateMeterGroup(items: DashboardTransaction[]): PcsGroupSums {
  const uniqueHeadersMap = new Map<string, DashboardTransaction>();
  items.forEach((item) => {
    if (item.header_id && !uniqueHeadersMap.has(item.header_id)) {
      uniqueHeadersMap.set(item.header_id, item);
    }
  });

  const uniqueItems = Array.from(uniqueHeadersMap.values());
  const gradeA_sum = uniqueItems
    .filter((i) => i.grade === "GRADE A")
    .reduce((acc, curr) => acc + (parseFloat(curr.hasil_meter as any) || 0), 0);
  const gradeB_sum = uniqueItems
    .filter((i) => i.grade === "GRADE B")
    .reduce((acc, curr) => acc + (parseFloat(curr.hasil_meter as any) || 0), 0);
  const bs_sum = uniqueItems
    .filter((i) => i.grade === "BS")
    .reduce((acc, curr) => acc + (parseFloat(curr.hasil_meter as any) || 0), 0);
  const ungraded_sum = uniqueItems
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
  const silangMeter = items.filter(
    (i) =>
      !isBsAwalAkhir(i) &&
      !isPanelGagalCacat(i) &&
      (hasRealDefect(i) || i.status_qc === "Recheck")
  ).length;

  const silang_sum = silangMeter;
  const ceklis_sum = Math.max(0, totalMeterItems - silangMeter);

  return {
    gradeA_sum,
    gradeB_sum,
    bs_sum,
    ungraded_sum,
    ceklis_sum,
    silang_sum,
    totalMeterItems,
  };
}

export function countUniquePanels(
  productionOnly: DashboardTransaction[],
  gradeFilter: string = "ALL"
): number {
  const sums = aggregatePcsGroup(productionOnly);
  if (gradeFilter === "GRADE_A") return sums.gradeA_sum;
  if (gradeFilter === "GRADE_B") return sums.gradeB_sum;
  if (gradeFilter === "BS") return sums.bs_sum;
  if (gradeFilter === "UNGRADED") return sums.ungraded_sum;
  return sums.gradeA_sum + sums.gradeB_sum + sums.bs_sum + sums.ungraded_sum;
}

export function calculateProductionVolumes(productionOnly: DashboardTransaction[]) {
  const meterSums = aggregateMeterGroup(productionOnly);
  const uniqueHeadersMap = new Map<string, DashboardTransaction>();
  productionOnly.forEach((item) => {
    if (item.header_id && !uniqueHeadersMap.has(item.header_id)) {
      uniqueHeadersMap.set(item.header_id, item);
    }
  });
  const uniqueHeaders = Array.from(uniqueHeadersMap.values());

  const totalProduksiMeter = meterSums.totalMeterItems || 0;
  const totalTarget = uniqueHeaders.reduce((acc, curr) => acc + curr.target_pcs, 0);
  const totalHasilPcs = productionOnly.reduce((acc, curr) => acc + curr.hasil_pcs, 0);
  const totalItems = uniqueHeaders.length;

  return { totalProduksiMeter, totalTarget, totalHasilPcs, totalItems };
}
