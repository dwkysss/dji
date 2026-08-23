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
