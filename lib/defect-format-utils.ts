/**
 * Format defect lines replacing category letters (e.g. "A - ", "B - ", "Kode A: ")
 * with sequential defect numbers (e.g. "1 - ", "2 - ") per row.
 */
export function formatDefectLinesWithNumbering(lines: string[]): string[] {
  let defectIndex = 1;
  return lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return trimmed;
    
    // Check if it's special non-defect metadata or already formatted QC note
    const isSpecial = trimmed.includes("Sisa Awal Potongan") || 
                      trimmed.includes("Sisa Akhir Potongan") ||
                      trimmed.startsWith("[Panel Dihapus]") ||
                      trimmed === "[TAMBAHAN QC]" ||
                      trimmed.startsWith("[DIHAPUS]") ||
                      trimmed.startsWith("QC:");
    if (isSpecial) return line;

    // Remove letter category prefix or existing numbering if present (e.g. "A - ", "B. ", "1. ", "1 - ")
    let clean = trimmed.replace(/^([A-Z0-9]\s*[-.]\s*|\d+\.\s*)/i, "").trim();
    clean = clean.replace(/^Kode\s*[A-Z0-9]+:\s*/i, "").trim();

    const numPrefix = `${defectIndex}. `;
    defectIndex++;
    return `${numPrefix}${clean}`;
  });
}

/**
 * Calculate defect meter length for meter fabric.
 * If range (e.g. "410 - 420" or "(Titik: 410 - 420)"), returns Math.abs(akhir - awal).
 * If single point, returns 1.
 */
export function getDefectMeterLength(item: any): number {
  if (!item) return 1;

  // 1. Check detail_masalah for (Titik: awal - akhir)
  if (item.detail_masalah) {
    const match = String(item.detail_masalah).match(/\(Titik:\s*([0-9.]+)\s*-\s*([0-9.]+)\)/i);
    if (match && match[1] && match[2]) {
      const awal = parseFloat(match[1]);
      const akhir = parseFloat(match[2]);
      if (!isNaN(awal) && !isNaN(akhir) && akhir > awal) {
        return akhir - awal;
      }
    }
  }

  // 2. Check meter_kain or meterDisplay for "awal - akhir"
  const meterStr = String(item.meter_kain || item.meterDisplay || "");
  if (meterStr.includes("-")) {
    const cleanStr = meterStr.replace(/PCS\s*\d+\s*:\s*/gi, "").replace(/[a-zA-Z\s]+$/g, "").trim();
    const parts = cleanStr.split("-").map(p => parseFloat(p.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] > parts[0]) {
      return parts[1] - parts[0];
    }
  }

  return 1;
}

/**
 * Calculate estimated defect points per 5 meter blocks for meter fabric.
 * Rule: 
 * 1. 1 point per 5 meters. If defect is on meter 1 & 3 (interval 1-5m), it counts as 1 point.
 * 2. When inspector inputs a defect range (e.g. 410-420), it is automatically counted as 1 point only.
 */
export function calculateMeterDefectPoints(items: any[]): number {
  if (!items || items.length === 0) return 0;
  const occupiedBuckets = new Set<number>();
  let unassignedDefectPoints = 0;

  items.forEach((item) => {
    if (!item) return;
    const isIstirahat =
      ((!!item.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") ||
        !!item.kategori_masalah?.toUpperCase().includes("ISTIRAHAT")) &&
        !item.kategori_masalah &&
        !item.detail_masalah) ||
      item.cacatDisplay === "START" ||
      item.cacatDisplay === "FINISH" ||
      item.cacatDisplay === "ISTIRAHAT";

    if (isIstirahat) return;

    let foundMeter = false;

    // 1. Check from detail_masalah (Titik: awal - akhir) or (Titik: single)
    if (item.detail_masalah) {
      const rangeMatch = String(item.detail_masalah).match(
        /\(Titik:\s*([0-9.]+)\s*-\s*([0-9.]+)\)/i
      );
      if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
        const startM = parseFloat(rangeMatch[1]);
        if (!isNaN(startM) && startM > 0) {
          // Range meter cacat dihitung otomatis sebagai 1 point saja
          const bucket = Math.max(0, Math.floor((startM - 1) / 5));
          occupiedBuckets.add(bucket);
          foundMeter = true;
        }
      } else {
        const singleMatch = String(item.detail_masalah).match(/\(Titik:\s*([0-9.]+)\)/i);
        if (singleMatch && singleMatch[1]) {
          const singleM = parseFloat(singleMatch[1]);
          if (!isNaN(singleM) && singleM > 0) {
            const bucket = Math.max(0, Math.floor((singleM - 1) / 5));
            occupiedBuckets.add(bucket);
            foundMeter = true;
          }
        }
      }
    }

    // 2. Check from meter_kain or meterDisplay
    if (!foundMeter) {
      const meterStr = String(item.meter_kain || item.meterDisplay || "");
      if (meterStr.includes("-")) {
        const cleanStr = meterStr
          .replace(/PCS\s*\d+\s*:\s*/gi, "")
          .replace(/[a-zA-Z\s]+$/g, "")
          .trim();
        const parts = cleanStr.split("-").map((p) => parseFloat(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && parts[0] > 0) {
          // Range meter cacat dihitung otomatis sebagai 1 point saja
          const bucket = Math.max(0, Math.floor((parts[0] - 1) / 5));
          occupiedBuckets.add(bucket);
          foundMeter = true;
        }
      } else if (meterStr.trim()) {
        const cleanStr = meterStr
          .replace(/PCS\s*\d+\s*:\s*/gi, "")
          .replace(/[a-zA-Z\s]+$/g, "")
          .trim();
        const singleM = parseFloat(cleanStr);
        if (!isNaN(singleM) && singleM > 0) {
          const bucket = Math.max(0, Math.floor((singleM - 1) / 5));
          occupiedBuckets.add(bucket);
          foundMeter = true;
        }
      }
    }

    // 3. Check from production_defects.meter
    if (!foundMeter && item.production_defects && Array.isArray(item.production_defects) && item.production_defects.length > 0) {
      item.production_defects.forEach((d: any) => {
        if (d.meter !== null && d.meter !== undefined) {
          const mVal = parseFloat(String(d.meter));
          if (!isNaN(mVal) && mVal > 0) {
            occupiedBuckets.add(Math.max(0, Math.floor((mVal - 1) / 5)));
            foundMeter = true;
          }
        }
      });
    }

    if (!foundMeter) {
      const hasRealDefects =
        (item.production_defects && item.production_defects.length > 0) ||
        (item.kategori_masalah && item.kategori_masalah !== "G") ||
        (item.keterangan_cacat &&
          (item.keterangan_cacat.includes("[TAMBAHAN QC]") || item.keterangan_cacat.includes("QC:"))) ||
        item.hasTambahanQC;

      if (hasRealDefects) {
        unassignedDefectPoints += 1;
      }
    }
  });

  return occupiedBuckets.size + unassignedDefectPoints;
}
