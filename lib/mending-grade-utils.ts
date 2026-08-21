export const isBsAwalAkhir = (item: any): boolean => {
  const pNo = String(
    item.panelNo ||
      item.panel_no ||
      item.keterangan_cacat ||
      item.detail?.keterangan_cacat ||
      ""
  ).toUpperCase();
  return pNo.includes("AWAL") || pNo.includes("AKHIR");
};

export const calculateOverallGradeData = (
  items: any[],
  isMeter: boolean,
  totalMeterSum?: number
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

      // Diambil dari SETELAH INSPECT (hasil_mending), bukan data produksi
      if (i.hasil_mending === "B" || i.hasil_mending === "BS") {
        totalCacat += 1;
      }
    });
  } else {
    // Panel: Panel BS Awal dan BS Akhir tidak disertakan
    const regularItems = (items || []).filter((i: any) => !isBsAwalAkhir(i));
    totalQty = regularItems.length;

    // Total Cacat diambil dari SETELAH INSPECT (hasil_mending)
    regularItems.forEach((i: any) => {
      if (i.hasil_mending === "B" || i.hasil_mending === "BS") {
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
