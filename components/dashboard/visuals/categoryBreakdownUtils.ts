import { DEFAULT_PROBLEM_DETAILS } from "@/lib/constants";
import { isBsAwalAkhir, isPanelGagalCacat, hasRealDefect } from "@/lib/mending-grade-utils";
import { DashboardTransaction } from "@/hooks/useDashboardKpis";

export function extractItemProblemCategories(
  item: DashboardTransaction,
  mergedProblemDetailsMap: Record<string, string[]>
): string[] {
  let cats: string[] = [];

  if (
    item.kategori_masalah &&
    item.kategori_masalah.trim() !== "" &&
    item.kategori_masalah !== "X" &&
    item.kategori_masalah !== "G"
  ) {
    cats = item.kategori_masalah
      .split(",")
      .map((c) => c.trim())
      .filter(
        (c) =>
          c !== "" &&
          c !== "X" &&
          c !== "G" &&
          !c.toUpperCase().includes("GAGAL CACAT")
      );
  }

  if (cats.length === 0 && item.detail_masalah && item.detail_masalah.trim() !== "") {
    for (const [kat, detList] of Object.entries(mergedProblemDetailsMap)) {
      if (detList.some((d) => item.detail_masalah!.toLowerCase().includes(d.toLowerCase()))) {
        cats.push(kat);
        break;
      }
    }
  }

  return cats;
}

export function extractItemBlockCount(item: DashboardTransaction): number {
  let itemCount = 1;
  const ket = item.keterangan_cacat || (item as any).keterangan || "";
  if (ket && typeof ket === "string") {
    const blockMatches = ket.match(/Blok\s*\d+/gi);
    if (blockMatches && blockMatches.length > 0) {
      itemCount = Math.max(itemCount, blockMatches.length);
    }
  }
  return itemCount;
}

export function buildCategoryBreakdown(dateFilteredTransactions: DashboardTransaction[]): {
  list: [string, number][];
  total: number;
} {
  const mergedProblemDetailsMap: Record<string, string[]> = {};
  const allCategories = ["A", "B", "C", "D", "E", "F", "G"];
  allCategories.forEach((cat) => {
    mergedProblemDetailsMap[cat] = Array.from(new Set(DEFAULT_PROBLEM_DETAILS[cat] || []));
  });

  const problemData = dateFilteredTransactions.filter(
    (item) =>
      !isBsAwalAkhir(item) &&
      !isPanelGagalCacat(item) &&
      hasRealDefect(item) &&
      (item.status_qc === "Recheck" ||
        item.grade === "BS" ||
        (item.kategori_masalah && item.kategori_masalah.trim() !== ""))
  );

  const catMap = new Map<string, number>();

  problemData.forEach((item) => {
    const itemCount = extractItemBlockCount(item);
    const cats = extractItemProblemCategories(item, mergedProblemDetailsMap);

    if (cats.length > 0) {
      const share = Math.max(1, Math.floor(itemCount / cats.length));
      cats.forEach((c) => catMap.set(c, (catMap.get(c) || 0) + share));
    } else {
      const fallbackCat = item.grade === "BS" ? "BS" : "X";
      catMap.set(fallbackCat, (catMap.get(fallbackCat) || 0) + itemCount);
    }
  });

  const total = Array.from(catMap.values()).reduce((sum, count) => sum + count, 0);
  const list = Array.from(catMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return { list, total };
}
