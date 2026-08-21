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
