import { isBsAwalAkhir, isPanelGagalCacat, hasRealDefect } from "@/lib/mending-grade-utils";
import { DashboardTransaction, DefectStatsParams } from "./kpi-types";
import { isMeterItem } from "./meter-classification";
import { aggregatePcsGroup, aggregateMeterGroup } from "./production-counter";

const IGNORED_DETAIL_KEYWORDS = [
  "GAGAL CACAT",
  "ISTIRAHAT",
  "START",
  "FINISH",
  "SISA",
  "POTONGAN",
];

const IGNORED_CATEGORIES = new Set(["", "X", "G", "BS"]);

export const hasDefectStatusOrProblem = (item: DashboardTransaction): boolean => {
  if (item.status_qc === "Recheck" || item.grade === "BS") return true;
  return Boolean(item.kategori_masalah && item.kategori_masalah.trim() !== "");
};

export const isQualifiedDefect = (item: DashboardTransaction): boolean => {
  if (isBsAwalAkhir(item) || isPanelGagalCacat(item) || !hasRealDefect(item)) return false;
  return hasDefectStatusOrProblem(item);
};

export const isPanelDefect = (item: DashboardTransaction): boolean => {
  if (!isQualifiedDefect(item) || isMeterItem(item)) return false;
  return item.panel_no !== undefined && item.panel_no !== null && !isNaN(Number(item.panel_no));
};

export const isMeterDefect = (item: DashboardTransaction): boolean => {
  if (!isQualifiedDefect(item)) return false;
  return isMeterItem(item);
};

export function calculateDefectStats(params: DefectStatsParams) {
  const { gradeScoped, totalProduksi, totalProduksiMeter } = params;

  const pcsSums = aggregatePcsGroup(gradeScoped);
  const meterSums = aggregateMeterGroup(gradeScoped);

  const countMasalahPanel = pcsSums.silang_sum;
  const totalPanelValid = totalProduksi;
  const persentaseCacatPanel =
    totalPanelValid > 0 ? (countMasalahPanel / totalPanelValid) * 100 : 0;
  const fpyPanel = Math.max(0, 100 - persentaseCacatPanel);

  const countMasalahMeteran = meterSums.silang_sum;
  const persentaseCacatMeteran =
    totalProduksiMeter > 0 ? (countMasalahMeteran / totalProduksiMeter) * 100 : 0;
  const fpyMeteran = Math.max(0, 100 - persentaseCacatMeteran);

  return {
    countMasalahPanel,
    totalPanelValid,
    persentaseCacatPanel,
    fpyPanel,
    countMasalahMeteran,
    persentaseCacatMeteran,
    fpyMeteran,
    quality: fpyPanel,
  };
}

export function countProblemDetails(detailMasalah?: string): number {
  if (!detailMasalah || detailMasalah.trim() === "") return 0;
  const details = detailMasalah
    .split(/[,|]/)
    .map((d) => d.replace(/\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "").trim())
    .filter((d) => {
      if (d === "") return false;
      const upper = d.toUpperCase();
      return !IGNORED_DETAIL_KEYWORDS.some((kw) => upper.includes(kw));
    });
  return details.length;
}

export function countProblemCategories(kategoriMasalah?: string): number {
  if (!kategoriMasalah || kategoriMasalah.trim() === "") return 0;
  const cats = kategoriMasalah
    .split(",")
    .map((c) => c.trim())
    .filter((c) => {
      if (IGNORED_CATEGORIES.has(c)) return false;
      const upper = c.toUpperCase();
      return !upper.includes("ISTIRAHAT") && !upper.includes("GAGAL CACAT");
    });
  return cats.length;
}

export function countProblemBlocks(keteranganCacat?: string): number {
  if (!keteranganCacat || typeof keteranganCacat !== "string") return 0;
  const matches = keteranganCacat.match(/Blok\s*\d+/gi);
  return matches ? matches.length : 0;
}

export function getItemProblemCount(item: DashboardTransaction): number {
  const detailsCount = countProblemDetails(item.detail_masalah);
  const categoryCount = countProblemCategories(item.kategori_masalah);
  const ketStr = item.keterangan_cacat || (item as any).keterangan || "";
  const blockCount = countProblemBlocks(ketStr);

  return Math.max(1, detailsCount, categoryCount, blockCount);
}

export function calculateTotalProblemsCount(gradeScoped: DashboardTransaction[]): number {
  const problemItems = gradeScoped.filter(isQualifiedDefect);
  return problemItems.reduce((acc, item) => acc + getItemProblemCount(item), 0);
}
