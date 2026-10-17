import { DEFAULT_PROBLEM_DETAILS } from "@/lib/constants";
import { isBsAwalAkhir, isPanelGagalCacat, hasRealDefect } from "@/lib/mending-grade-utils";
import { isMeterItem } from "@/hooks/useDashboardKpis";

export interface ParetoItem {
  name: string;
  friendlyName: string;
  code: string;
  category?: string;
  count: number;
  downtime: number;
  value: number;
  individualPct: number;
  cumulativePct: number;
  isVital80: boolean;
}

export const CATEGORY_NAMES: Record<string, string> = {
  A: "Benang Timbul/Lolos",
  B: "Jarum/Jacquard",
  C: "Design/Proofing",
  D: "Benang Dasar/Rewind",
  E: "Servo/Elektrik",
  F: "Cylinder/Mekanik",
  G: "Lain-lain/Libur",
  H: "Mekanik Direct",
  BS: "Barang Sortir / Reject",
};

export const PROBLEM_DETAILS_MAP: Record<string, string[]> = {
  A: [
    "L1/L2/L3 Benang timbul putus",
    "Benang lolos",
    "Bolong corak",
    "L1/L2/L3 Benang timbul",
    "Benang Nyilang",
    "Benang narik/Kendor",
    "Perbaikan/Beset benang Dasar",
    "Benang Kejepit/Jebol/Kusut",
    "Jalur benang",
    "Beda warna benang/salah benang",
  ],
  B: [
    "Jarum pattern patah/bengkok",
    "Jarum dasar patah/bengkok",
    "Ganti Jacquard",
    "Ganti Tali Jacquard",
    "Ganti Per Jacquard",
    "Ganti Module",
    "Ganti Magnet",
    "Layar Komputer Error/Mati",
    "Ganti jarum Compoun Nedle, pattern",
    "Ngampul",
    "Ganti dari scaloop ke non scaloop atau sebaliknya",
    "Ngegaris/Stopline",
    "Keluar Jarum",
    "Ganti String bar",
    "Ganti PBO",
    "Pressan As beam kendor",
    "Tensi tensioner",
    "Stripe/garis jarum",
    "Lubang/bolong",
    "Beda warna/stripe",
  ],
  C: [
    "Loading design/Ganti Design",
    "Perbaikan corak/revisi",
    "Salah ganti design",
    "Error design",
    "Proofing/PCB",
    "Ganti Pattern Disk",
    "Ganti pick",
    "Setel kain tebal/tipis",
    "Lolos kain ganti artikel",
    "Setting benang awal",
    "Ganti Jarum / Olah Mesin",
  ],
  D: [
    "Ganti benang dasar L1/L2",
    "Salah ganti benang dasar",
    "Ganti benang Pattern Linner",
    "Ganti benang Pattern Heavy",
    "Ganti benang Pattern Shadow",
    "Ganti benang pattern keseluruhan (L,H,S)",
    "salah ganti benang pattern",
    "Ngelancarin",
    "Over Cone/Rewind",
    "Tunggu benang dasar dari warping",
    "Tunggu benang (benang belum datang)",
    "Menunggu mekanik",
    "Menunggu benang",
    "Cleaning mesin",
    "Istirahat",
  ],
  E: [
    "Error Servo Drive",
    "Ganti motor servo",
    "Sensor Benang/Laser Stop",
    "Perbaikan Eletrik lainnya",
    "Konsleting",
    "Perbaikan listrik",
  ],
  F: [
    "Perbaikan cilynder Angin",
    "Ganti Bellow",
    "Perbaikan gear/Take Up Roll",
    "Ganti rantai/pertensi",
    "Ganti Black grip roll",
    "Ganti Oli",
    "Pelumasan/greace pada mesin",
    "Ganti Vanbelt",
    "Perawatan Panel Listrik",
    "Servis Overhaul",
  ],
  G: [
    "Hari Libur",
    "Tidak ada order",
    "Tunggu info",
    "Demo",
    "Bencana/gempa/banjir",
    "Istirahat selama buka puasa",
    "Tunggu Sparepart",
    "Mati Listrik",
  ],
};

export const getMachineKey = (item: any): string => {
  const m = item.mesin_id || item.no_mesin || item.mesin || item.nama_mesin;
  return m && String(m).trim() !== "" ? String(m).trim() : "";
};

export function getAvailableParetoMachines(transactions: any[]): string[] {
  const machines = new Set<string>();
  transactions.forEach((item) => {
    const m = getMachineKey(item);
    if (m) machines.add(m);
  });
  return Array.from(machines).sort();
}

export function computeParetoData({
  dateFilteredTransactions,
  metricMode,
  paretoMode,
  paretoGroupBy,
  selectedParetoMachine,
}: {
  dateFilteredTransactions: any[];
  metricMode: "PCS" | "METER";
  paretoMode: "COUNT" | "DURATION";
  paretoGroupBy: "KATEGORI" | "MESIN";
  selectedParetoMachine: string;
}): { list: ParetoItem[]; totalCount: number; totalDowntime: number } {
  const isMeterMode = metricMode === "METER";
  const categoryScoped = dateFilteredTransactions.filter((item) => {
    const isMeter = isMeterItem(item);
    return isMeterMode ? isMeter : !isMeter;
  });

  const transactionsToAnalyze =
    selectedParetoMachine === "ALL"
      ? categoryScoped
      : categoryScoped.filter((item) => getMachineKey(item) === selectedParetoMachine);

  const itemMap = new Map<
    string,
    { count: number; downtime: number; category?: string }
  >();

  if (paretoGroupBy === "KATEGORI") {
    const problemData = transactionsToAnalyze.filter(
      (item) =>
        !isBsAwalAkhir(item) &&
        !isPanelGagalCacat(item) &&
        hasRealDefect(item) &&
        (item.grade === "BS" ||
          (item.kategori_masalah && item.kategori_masalah.trim() !== "") ||
          (item.detail_masalah && item.detail_masalah.trim() !== ""))
    );

    const mergedProblemDetailsMap: Record<string, string[]> = {};
    const allCategories = ["A", "B", "C", "D", "E", "F", "G"];
    allCategories.forEach((cat) => {
      const defaultList = DEFAULT_PROBLEM_DETAILS[cat] || [];
      const extraList = PROBLEM_DETAILS_MAP[cat] || [];
      mergedProblemDetailsMap[cat] = Array.from(
        new Set([...defaultList, ...extraList])
      );
    });

    const getCategoryForDetail = (
      detailStr: string,
      fallbackCategory?: string
    ): string => {
      const cleanStr = detailStr
        .replace(/\s*\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "")
        .trim();
      if (!cleanStr) return "X";

      // 1. Exact match against registered defect names (case-insensitive)
      for (const [cat, details] of Object.entries(mergedProblemDetailsMap)) {
        if (details.some((d) => d.toLowerCase() === cleanStr.toLowerCase())) {
          return cat;
        }
      }

      // 2. Substring match
      for (const [cat, details] of Object.entries(mergedProblemDetailsMap)) {
        if (
          details.some(
            (d) =>
              cleanStr.toLowerCase().includes(d.toLowerCase()) ||
              d.toLowerCase().includes(cleanStr.toLowerCase())
          )
        ) {
          return cat;
        }
      }

      // 3. Fallback to item.kategori_masalah
      if (
        fallbackCategory &&
        fallbackCategory.trim() !== "" &&
        fallbackCategory !== "X"
      ) {
        const cats = fallbackCategory
          .split(/[,/]/)
          .map((c) => c.trim().toUpperCase())
          .filter((c) => c.length === 1 && c >= "A" && c <= "Z");
        const realDefectCat = cats.find((c) => c !== "G");
        if (realDefectCat) return realDefectCat;
        if (cats.length > 0) return cats[0];
      }
      return "X";
    };

    problemData.forEach((item) => {
      let detailsList: string[] = [];
      if (item.detail_masalah && item.detail_masalah.trim() !== "") {
        detailsList = item.detail_masalah
          .split(",")
          .map((d: string) => d.trim())
          .filter((d: string) => d !== "");
      }

      // Filter out non-defect entries
      detailsList = detailsList.filter((det) => {
        const upper = det.toUpperCase();
        return (
          !upper.includes("SISA AWAL") &&
          !upper.includes("SISA AKHIR") &&
          !upper.includes("POTONGAN AWAL") &&
          !upper.includes("POTONGAN AKHIR") &&
          !upper.includes("SISA POTONGAN") &&
          !upper.includes("GAGAL CACAT") &&
          upper !== "START" &&
          upper !== "FINISH" &&
          upper !== "ISTIRAHAT"
        );
      });

      if (detailsList.length === 0) {
        if (
          item.kategori_masalah &&
          item.kategori_masalah.trim() !== "" &&
          item.kategori_masalah !== "X" &&
          item.kategori_masalah !== "G" &&
          !item.kategori_masalah.toUpperCase().includes("GAGAL CACAT")
        ) {
          const cat = item.kategori_masalah.trim().toUpperCase();
          const desc = CATEGORY_NAMES[cat] || "Masalah Lain";
          detailsList.push(`[${cat}] ${desc}`);
        } else if (
          item.grade === "BS" &&
          !isBsAwalAkhir(item) &&
          !isPanelGagalCacat(item)
        ) {
          detailsList.push("[X] Panel BS (Tanpa Detail)");
        }
      }

      const downtime = item.total_downtime_detik || 0;
      const downtimeShare =
        detailsList.length > 0 ? downtime / detailsList.length : downtime;

      detailsList.forEach((det) => {
        const cleanDet = det
          .replace(/\s*\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "")
          .trim();
        if (!cleanDet) return;

        const cleanName =
          cleanDet.replace(/^\[[A-Z0-9]+\]\s*/i, "").trim() || cleanDet;
        const cat = getCategoryForDetail(cleanName, item.kategori_masalah);

        const key = cleanName;
        const existing = itemMap.get(key) || {
          count: 0,
          downtime: 0,
          category: cat,
        };
        itemMap.set(key, {
          count: existing.count + 1,
          downtime: existing.downtime + downtimeShare,
          category: existing.category || cat,
        });
      });
    });
  } else {
    // Group by MESIN
    transactionsToAnalyze.forEach((item) => {
      if (isBsAwalAkhir(item)) return;
      const isDefect =
        !isPanelGagalCacat(item) &&
        hasRealDefect(item) &&
        (item.status_qc === "Recheck" ||
          item.grade === "BS" ||
          (item.kategori_masalah && item.kategori_masalah.trim() !== ""));
      const downtime = item.total_downtime_detik || 0;
      if (!isDefect && downtime === 0) return;

      const key = getMachineKey(item) || "Mesin -";
      const existing = itemMap.get(key) || {
        count: 0,
        downtime: 0,
        category: undefined,
      };
      itemMap.set(key, {
        count: existing.count + (isDefect ? 1 : 0),
        downtime: existing.downtime + downtime,
        category: undefined,
      });
    });
  }

  const list = Array.from(itemMap.entries()).map(([code, data]) => {
    let friendlyName = code;
    if (paretoGroupBy === "KATEGORI") {
      friendlyName = code;
    } else {
      friendlyName = code.startsWith("Mesin") ? code : `Mesin ${code}`;
    }
    return {
      name: code,
      friendlyName,
      code,
      category: (data as any).category,
      count: data.count,
      downtime: data.downtime,
    };
  });

  if (paretoMode === "COUNT") {
    list.sort((a, b) => b.count - a.count);
  } else {
    list.sort((a, b) => b.downtime - a.downtime);
  }

  const totalCount = list.reduce((sum, item) => sum + item.count, 0);
  const totalDowntime = list.reduce((sum, item) => sum + item.downtime, 0);

  let cumulativeSum = 0;
  let crossed80 = false;
  const itemsWithCumulative: ParetoItem[] = list.map((item) => {
    const value = paretoMode === "COUNT" ? item.count : item.downtime;
    const total = paretoMode === "COUNT" ? totalCount : totalDowntime;
    cumulativeSum += value;
    const cumulativePct = total > 0 ? (cumulativeSum / total) * 100 : 0;
    const roundedCumPct = parseFloat(cumulativePct.toFixed(1));
    const individualPct =
      total > 0 ? parseFloat(((value / total) * 100).toFixed(1)) : 0;

    const isVital80 = !crossed80;
    if (roundedCumPct >= 80) {
      crossed80 = true;
    }

    return {
      ...item,
      value,
      individualPct,
      cumulativePct: roundedCumPct,
      isVital80,
    };
  });

  return { list: itemsWithCumulative, totalCount, totalDowntime };
}
