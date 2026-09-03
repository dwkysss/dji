import { calculateMeterDefectPoints } from "@/lib/defect-format-utils";

export const isBsAwalAkhir = (item: any): boolean => {
  if (!item) return false;
  const pNo = String(
    item.panelNo ||
      item.panel_no ||
      item.panel_no_str ||
      item.keterangan_cacat ||
      item.detail_masalah ||
      item.keterangan ||
      item.detail?.keterangan_cacat ||
      item.detail?.detail_masalah ||
      item.detail?.panel_no ||
      ""
  ).toUpperCase();
  return (
    pNo.includes("AWAL") ||
    pNo.includes("AKHIR") ||
    pNo.includes("SISA AWAL") ||
    pNo.includes("SISA AKHIR") ||
    pNo.includes("SISA POTONGAN") ||
    pNo.includes("POTONGAN AWAL") ||
    pNo.includes("POTONGAN AKHIR")
  );
};

/**
 * Memeriksa apakah sebuah baris/panel memiliki cacat fisik nyata (mengabaikan Istirahat, Gagal Cacat, Start/Finish, Scrap).
 */
export const hasRealDefect = (item: any): boolean => {
  if (!item) return false;
  if (isBsAwalAkhir(item)) return false;

  const defects = item.production_defects || item.detail?.production_defects;
  if (Array.isArray(defects) && defects.length > 0) {
    return defects.some((d: any) => {
      const k = String(d.kategori || "").toUpperCase().trim();
      const det = String(d.detail || "").toUpperCase().trim();
      if (k.includes("ISTIRAHAT") || det.includes("ISTIRAHAT")) return false;
      if (det.includes("GAGAL CACAT") || k === "G") return false;
      if (
        det === "START" ||
        det === "FINISH" ||
        det.includes("SISA") ||
        det.includes("POTONGAN")
      )
        return false;
      return true;
    });
  }

  const katStr = String(
    item.kategori_masalah || item.detail?.kategori_masalah || ""
  )
    .toUpperCase()
    .trim();
  const detStr = String(
    item.detail_masalah || item.detail?.detail_masalah || ""
  )
    .toUpperCase()
    .trim();
  const ketStr = String(
    item.keterangan_cacat || item.detail?.keterangan_cacat || ""
  )
    .toUpperCase()
    .trim();

  // Jika ada [TAMBAHAN QC], itu adalah temuan cacat riil dari QC
  if (ketStr.includes("[TAMBAHAN QC]")) return true;

  // Cek apakah ada kategori masalah riil (selain G, BS, X, ISTIRAHAT, GAGAL CACAT)
  const categories = katStr
    .split(",")
    .map((c) => c.trim())
    .filter(
      (c) =>
        c !== "" &&
        c !== "G" &&
        c !== "BS" &&
        c !== "X" &&
        !c.includes("ISTIRAHAT") &&
        !c.includes("GAGAL CACAT")
    );

  if (categories.length > 0) return true;

  // Cek detail masalah
  const details = detStr
    .split(/[,|]/)
    .map((d) => d.replace(/\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "").trim())
    .filter(
      (d) =>
        d !== "" &&
        !d.includes("GAGAL CACAT") &&
        !d.includes("ISTIRAHAT") &&
        !d.includes("START") &&
        !d.includes("FINISH") &&
        !d.includes("SISA AWAL") &&
        !d.includes("SISA AKHIR") &&
        !d.includes("SISA POTONGAN") &&
        !d.includes("POTONGAN AWAL") &&
        !d.includes("POTONGAN AKHIR") &&
        !d.includes("OPLOS SHIFT") &&
        !d.includes("GANTI OPERATOR")
    );

  if (details.length > 0) return true;

  return false;
};

/**
 * Memeriksa apakah sebuah baris/panel HANYA memiliki status "Gagal Cacat" tanpa cacat riil lainnya ("gagal cacat aja").
 * Aturan Dashboard: Jika sebuah panel gagal cacat aja, maka jangan dihitung sebagai cacat.
 * Jika panel memiliki cacat fisik lain (misal: "A, G" / "Perbaikan Meped, Gagal Cacat"), maka BUKAN "gagal cacat aja"
 * sehingga tetap dihitung sebagai cacat dari masalah riilnya.
 */
export const isPanelGagalCacatAja = (item: any): boolean => {
  if (!item) return false;

  // Jika panel memiliki cacat riil, maka BUKAN "gagal cacat aja"
  if (hasRealDefect(item)) return false;

  const det = String(
    item.detail_masalah ||
      item.keterangan_cacat ||
      item.keterangan ||
      item.detail?.detail_masalah ||
      item.detail?.keterangan_cacat ||
      ""
  ).toUpperCase();

  const kat = String(
    item.kategori_masalah ||
      item.detail?.kategori_masalah ||
      ""
  ).toUpperCase();

  const pNo = String(
    item.panel_no_str ||
      item.panel_no ||
      item.panelNo ||
      ""
  ).toUpperCase();

  if (det.includes("GAGAL CACAT") || pNo.includes("GAGAL CACAT")) return true;
  if (kat === "G" || kat === "GAGAL CACAT") return true;

  const defects = item.production_defects || item.detail?.production_defects;
  if (Array.isArray(defects) && defects.length > 0) {
    return defects.some((d: any) => {
      const k = String(d.kategori || "").toUpperCase().trim();
      const dt = String(d.detail || "").toUpperCase().trim();
      return dt.includes("GAGAL CACAT") || k === "G";
    });
  }

  return false;
};

// Export alias untuk kemudahan
export const isPanelGagalCacat = isPanelGagalCacatAja;

export const calculateOverallGradeData = (
  items: any[],
  isMeter: boolean,
  totalMeterSum?: number,
  cacatPointsOverride?: number
) => {
  let totalQty = 0;
  let totalCacat = 0;
  const unit = isMeter ? "Meter" : "Panel";

  if (isMeter) {
    if (totalMeterSum !== undefined && totalMeterSum > 0) {
      totalQty = totalMeterSum;
    } else {
      (items || []).forEach((i: any) => {
        totalQty = Math.max(totalQty, Number(i.detail?.jml_hasil_produksi || 0));
      });
      if (totalQty === 0) totalQty = 300;
    }

    if (cacatPointsOverride !== undefined) {
      totalCacat = cacatPointsOverride;
    } else {
      const cacatItems: any[] = [];
      (items || []).forEach((i: any) => {
        if (isBsAwalAkhir(i)) return;
        const isSpecial =
          ((!!i.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") ||
            !!i.kategori_masalah?.toUpperCase().includes("ISTIRAHAT")) &&
            !i.kategori_masalah &&
            !i.detail_masalah) ||
          i.cacatDisplay === "START" ||
          i.cacatDisplay === "FINISH" ||
          i.cacatDisplay === "ISTIRAHAT";
        if (isSpecial) return;

        // Prioritas: Final Inspek Mending -> Mending -> QC
        const effectiveGrade = (
          i.hasil_final ||
          i.status_final_mending ||
          i.detail?.status_final_mending ||
          i.hasil_mending ||
          i.status_mending ||
          i.detail?.status_mending ||
          ""
        ).toString().trim().toUpperCase();

        if (effectiveGrade === "B" || effectiveGrade === "BS" || effectiveGrade === "SILANG") {
          cacatItems.push(i.detail || i);
        }
      });
      totalCacat = calculateMeterDefectPoints(cacatItems);
    }
  } else {
    // Panel: Panel BS Awal dan BS Akhir tidak disertakan
    const regularItems = (items || []).filter((i: any) => !isBsAwalAkhir(i));
    totalQty = regularItems.length;

    // Total Cacat diambil dari SETELAH FINAL INSPEK MENDING (atau Mending)
    regularItems.forEach((i: any) => {
      const effectiveGrade = (
        i.hasil_final ||
        i.status_final_mending ||
        i.detail?.status_final_mending ||
        i.hasil_mending ||
        i.status_mending ||
        i.detail?.status_mending ||
        ""
      ).toString().trim().toUpperCase();

      if (effectiveGrade === "B" || effectiveGrade === "BS" || effectiveGrade === "SILANG") {
        totalCacat += 1;
      }
    });
  }

  let overallGrade = "-";
  let bucket = 0;

  if (totalQty > 0) {
    if (isMeter) {
      bucket = 300;
      if (totalQty > 450) bucket = 500;
      else if (totalQty > 400) bucket = 450;
      else if (totalQty > 350) bucket = 400;
      else if (totalQty > 300) bucket = 350;
      else bucket = 300;

      let limitA = 9, limitB = 15, limitC = 21;
      if (bucket === 350) { limitA = 11; limitB = 18; limitC = 25; }
      if (bucket === 400) { limitA = 12; limitB = 20; limitC = 28; }
      if (bucket === 450) { limitA = 14; limitB = 23; limitC = 32; }
      if (bucket === 500) { limitA = 15; limitB = 25; limitC = 35; }

      if (totalCacat <= limitA) overallGrade = "A";
      else if (totalCacat <= limitB) overallGrade = "B";
      else if (totalCacat <= limitC) overallGrade = "C";
      else overallGrade = "D";
    } else {
      bucket = 50;
      if (totalQty > 125) bucket = 150;
      else if (totalQty > 120) bucket = 125;
      else if (totalQty > 100) bucket = 120;
      else if (totalQty > 75) bucket = 100;
      else if (totalQty > 65) bucket = 75;
      else if (totalQty > 50) bucket = 65;
      else bucket = 50;

      let limitA = 5, limitB = 8, limitC = 9;
      if (bucket === 65) { limitA = 7; limitB = 10; limitC = 13; }
      if (bucket === 75) { limitA = 8; limitB = 12; limitC = 15; }
      if (bucket === 100) { limitA = 10; limitB = 15; limitC = 19; }
      if (bucket === 120) { limitA = 12; limitB = 18; limitC = 23; }
      if (bucket === 125) { limitA = 13; limitB = 19; limitC = 25; }
      if (bucket === 150) { limitA = 15; limitB = 23; limitC = 29; }

      if (totalCacat <= limitA) overallGrade = "A";
      else if (totalCacat <= limitB) overallGrade = "B";
      else if (totalCacat <= limitC) overallGrade = "C";
      else overallGrade = "D";
    }
  }

  return {
    overallGrade,
    bucket,
    totalQty,
    totalCacat,
    unit
  };
};
