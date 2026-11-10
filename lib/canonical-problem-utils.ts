import { PROBLEM_DETAILS } from "./constants";

/**
 * Logika Mode Fleksibel (Objek + Aksi):
 * 1. Jika kombinasi cocok dengan item yang SUDAH ADA di instan -> nilainya sama dengan instan
 * 2. Jika di fleksibel BELUM ADA di instan (contoh: L1 + Keluar Jarum) -> maka BUAT BARU AJA ("Keluar Jarum L1")!
 */
export function getFlexibleProblemDetail(
  catId: string,
  obj: string,
  act: string,
  existingInstantList?: string[]
): string {
  const o = (obj || "").trim();
  const a = (act || "").trim();
  if (!o && !a) return "";
  if (!o) return a;
  if (!a) return o;

  const oUpper = o.toUpperCase();
  const aUpper = a.toUpperCase();
  const cat = (catId || "").toUpperCase().trim();

  // 1. Cek apakah kombinasi objek + aksi ini COCOK dengan yang SUDAH ADA di instan
  // Kategori A
  if (cat === "A") {
    // Keluar Jarum:
    // L2/L3 -> ada di instan "Keluar Jarum L2/L3"
    if (aUpper.includes("KELUAR JARUM") && (oUpper === "L2/L3" || oUpper === "L2" || oUpper === "L3")) {
      return "Keluar Jarum L2/L3";
    }
    // Benang Timbul -> ada di instan "Keluar Jarum Timbul"
    if (aUpper.includes("KELUAR JARUM") && oUpper.includes("TIMBUL")) {
      return "Keluar Jarum Timbul";
    }
    // Catatan: Jika L1 -> GA ADA di instan, akan lanjut ke bawah untuk dibuat baru: "Keluar Jarum L1"!

    // Putus:
    if (aUpper === "PUTUS") {
      if (oUpper === "L1") return "L1 Putus";
      if (oUpper === "L2/L3" || oUpper === "L2" || oUpper === "L3") return "L2/L3 Putus";
      if (oUpper.includes("TIMBUL")) return "Benang Timbul Putus";
    }

    // Narik / Kendor:
    if (aUpper.includes("NARIK") || aUpper.includes("KENDOR")) {
      if (oUpper.includes("TIMBUL") || oUpper === "BENANG") return "Benang Narik/Kendor";
    }

    // Bolong:
    if (aUpper.includes("BOLONG")) {
      if (oUpper.includes("CORAK")) return "Bolong Corak";
      if (oUpper.includes("DASAR")) return "Bolong Dasar";
    }

    // Jalur Benang:
    if (oUpper.includes("JALUR BENANG")) return "Perbaikan Jalur Benang";

    // Floating:
    if (aUpper.includes("FLOATING") || oUpper.includes("FLOATING")) return "Floating Keanyam";

    // Meped:
    if (aUpper.includes("MEPED") || oUpper.includes("MEPED")) return "Perbaikan Meped";

    // Benang Nyilang:
    if (aUpper.includes("NYILANG") && oUpper.includes("BENANG")) return "Benang Nyilang";

    // Benang Lolos:
    if (aUpper.includes("LOLOS") && oUpper.includes("BENANG")) return "Benang Lolos";

    // Benang Kejepit:
    if (aUpper.includes("KEJEPIT") || aUpper.includes("JEBOL") || aUpper.includes("KUSUT")) return "Benang Kejepit/Jebol/Kusut";
  }

  // Kategori B
  if (cat === "B") {
    if (oUpper.includes("PATTERN") && (aUpper.includes("PATAH") || aUpper.includes("BENGKOK"))) {
      return "Jarum pattern patah/bengkok";
    }
    if (oUpper.includes("JACQUARD") && (aUpper.includes("GANTI") || aUpper.includes("BARU"))) {
      return "Ganti Jacquard";
    }
    if (oUpper.includes("STRING BAR") && (aUpper.includes("GANTI") || aUpper.includes("BARU"))) {
      return "Ganti String bar";
    }
    if (oUpper.includes("PBO") && (aUpper.includes("GANTI") || aUpper.includes("BARU"))) {
      return "Ganti PBO";
    }
    if (oUpper.includes("COMPOUND") && (aUpper.includes("GANTI") || aUpper.includes("BARU"))) {
      return "Ganti jarum Compoun Nedle, pattern";
    }
    if (oUpper.includes("AS BEAM") && aUpper.includes("KENDOR")) {
      return "Pressan As beam kendor";
    }
    if (oUpper.includes("TENSIONER") || aUpper.includes("TENSI")) {
      return "Tensi tensioner";
    }
    if (aUpper.includes("STOPLINE") || aUpper.includes("NGEGARIS")) {
      return "Ngegaris/Stopline";
    }
    if (aUpper.includes("NGAMPUL")) return "Ngampul";
    if (aUpper.includes("KELUAR JARUM")) return "Keluar Jarum";
  }

  // Kategori C
  if (cat === "C") {
    if (oUpper.includes("DESIGN") && (aUpper.includes("LOADING") || aUpper.includes("GANTI"))) {
      return "Loading design/Ganti Design";
    }
    if (oUpper.includes("DESIGN") && aUpper.includes("SALAH")) return "Salah ganti design";
    if (oUpper.includes("DESIGN") && aUpper.includes("ERROR")) return "Error design";
    if (oUpper.includes("CORAK") && (aUpper.includes("REVISI") || aUpper.includes("PERBAIKAN"))) return "Perbaikan corak/revisi";
    if (oUpper.includes("PATTERN DISK")) return "Ganti Pattern Disk";
    if (oUpper.includes("PICK")) return "Ganti pick";
    if (oUpper.includes("PROOFING") || oUpper.includes("PCB")) return "Proofing/PCB";
  }

  // Kategori D
  if (cat === "D") {
    if ((oUpper.includes("DASAR") || oUpper.includes("L1")) && aUpper.includes("SALAH")) return "Salah ganti benang dasar";
    if ((oUpper.includes("DASAR") || oUpper.includes("L1")) && aUpper.includes("TUNGGU")) return "Tunggu benang dasar dari warping";
    if ((oUpper.includes("DASAR") || oUpper.includes("L1")) && aUpper.includes("GANTI")) return "Ganti benang dasar L1/L2";
    if (oUpper.includes("LINNER") || oUpper.includes("LINER")) return "Ganti benang Pattern Linner";
    if (oUpper.includes("HEAVY")) return "Ganti benang Pattern Heavy";
    if (oUpper.includes("SHADOW")) return "Ganti benang Pattern Shadow";
    if (oUpper.includes("KESELURUHAN") || (oUpper.includes("L") && oUpper.includes("H") && oUpper.includes("S"))) return "Ganti benang pattern keseluruhan (L,H,S)";
    if (aUpper.includes("LANCARIN")) return "Ngelancarin";
    if (aUpper.includes("CONE") || aUpper.includes("REWIND")) return "Over Cone/Rewind";
  }

  // Cek apakah persis cocok dengan salah satu item di list instan
  const instantList = existingInstantList || PROBLEM_DETAILS[cat] || [];
  const directMatch = instantList.find(
    (item) => item.toLowerCase() === `${o} ${a}`.toLowerCase() || item.toLowerCase() === `${a} ${o}`.toLowerCase()
  );
  if (directMatch) return directMatch;

  // 2. KALO DI FLEKSIBEL GA ADA DARI YANG INSTAN: TETEP OBJEK + AKSI!
  return `${o} ${a}`;
}

/**
 * Pemetaan Backend (BE) / Perhitungan Laporan & Agregasi:
 * Mengelompokkan variasi objek + aksi ke master problem detail yang sudah ada di database/laporan.
 */
export function mapToCanonicalProblem(katId: string, rawDetail: string): string {
  if (!rawDetail) return "";
  const d = rawDetail.trim();
  const dUpper = d.toUpperCase();
  const cat = (katId || "").toUpperCase().trim();

  // Kategori A (Masalah Benang)
  if (cat === "A") {
    // Keluar Jarum L1 atau L2/L3 dikelompokkan ke master "Keluar Jarum L2/L3"
    if (dUpper.includes("KELUAR JARUM") && (dUpper.includes("L1") || dUpper.includes("L2") || dUpper.includes("L3"))) {
      return "Keluar Jarum L2/L3";
    }
    // Keluar Jarum Timbul
    if (dUpper.includes("KELUAR JARUM") && dUpper.includes("TIMBUL")) {
      return "Keluar Jarum Timbul";
    }
    // Bolong Corak
    if (dUpper.includes("BOLONG") && dUpper.includes("CORAK")) {
      return "Bolong Corak";
    }
    // Bolong Dasar
    if (dUpper.includes("BOLONG") && dUpper.includes("DASAR")) {
      return "Bolong Dasar";
    }
    // Perbaikan Jalur Benang
    if (dUpper.includes("JALUR BENANG")) {
      return "Perbaikan Jalur Benang";
    }
    // Floating
    if (dUpper.includes("FLOATING")) {
      return "Floating Keanyam";
    }
    // Meped
    if (dUpper.includes("MEPED")) {
      return "Perbaikan Meped";
    }
    // Benang Narik / Kendor
    if (dUpper.includes("NARIK") || dUpper.includes("KENDOR")) {
      return "Benang Narik/Kendor";
    }
  }

  // Kategori B (Masalah Jarum & Mekanik)
  if (cat === "B") {
    if (dUpper.includes("JARUM") && dUpper.includes("PATTERN") && (dUpper.includes("PATAH") || dUpper.includes("BENGKOK"))) {
      return "Jarum pattern patah/bengkok";
    }
    if (dUpper.includes("JACQUARD")) return "Ganti Jacquard";
    if (dUpper.includes("STRING BAR") || dUpper.includes("STRINGBAR")) return "Ganti String bar";
    if (dUpper.includes("PBO")) return "Ganti PBO";
    if (dUpper.includes("COMPOUND") || dUpper.includes("COMPOUN")) return "Ganti jarum Compoun Nedle, pattern";
    if (dUpper.includes("AS BEAM")) return "Pressan As beam kendor";
    if (dUpper.includes("TENSIONER") || dUpper.includes("TENSI")) return "Tensi tensioner";
    if (dUpper.includes("STOPLINE") || dUpper.includes("NGEGARIS")) return "Ngegaris/Stopline";
    if (dUpper.includes("NGAMPUL")) return "Ngampul";
    if (dUpper.includes("KELUAR JARUM")) return "Keluar Jarum";
  }

  // Kategori C (Design & Setup)
  if (cat === "C") {
    if (dUpper.includes("DESIGN") && (dUpper.includes("LOADING") || dUpper.includes("GANTI"))) return "Loading design/Ganti Design";
    if (dUpper.includes("DESIGN") && dUpper.includes("SALAH")) return "Salah ganti design";
    if (dUpper.includes("DESIGN") && dUpper.includes("ERROR")) return "Error design";
    if (dUpper.includes("CORAK") && (dUpper.includes("REVISI") || dUpper.includes("PERBAIKAN"))) return "Perbaikan corak/revisi";
    if (dUpper.includes("PATTERN DISK")) return "Ganti Pattern Disk";
    if (dUpper.includes("PICK")) return "Ganti pick";
    if (dUpper.includes("PROOFING") || dUpper.includes("PCB")) return "Proofing/PCB";
  }

  // Kategori D (Bahan Baku)
  if (cat === "D") {
    if ((dUpper.includes("L1") || dUpper.includes("L2") || dUpper.includes("DASAR")) && dUpper.includes("SALAH GANTI")) return "Salah ganti benang dasar";
    if ((dUpper.includes("L1") || dUpper.includes("L2") || dUpper.includes("DASAR")) && (dUpper.includes("TUNGGU") || dUpper.includes("WARPING"))) return "Tunggu benang dasar dari warping";
    if ((dUpper.includes("L1") || dUpper.includes("L2") || dUpper.includes("DASAR")) && dUpper.includes("GANTI")) return "Ganti benang dasar L1/L2";
    if (dUpper.includes("LINNER") || dUpper.includes("LINER")) return "Ganti benang Pattern Linner";
    if (dUpper.includes("HEAVY")) return "Ganti benang Pattern Heavy";
    if (dUpper.includes("SHADOW")) return "Ganti benang Pattern Shadow";
    if (dUpper.includes("KESELURUHAN") || (dUpper.includes("L") && dUpper.includes("H") && dUpper.includes("S"))) return "Ganti benang pattern keseluruhan (L,H,S)";
    if (dUpper.includes("LANCARIN") || dUpper.includes("NGELANCARIN")) return "Ngelancarin";
    if (dUpper.includes("CONE") || dUpper.includes("REWIND")) return "Over Cone/Rewind";
  }

  // Jika cocok persis dengan salah satu item master di PROBLEM_DETAILS
  const knownList = PROBLEM_DETAILS[cat] || [];
  const exactMatch = knownList.find(
    (item) => item.toLowerCase() === d.toLowerCase()
  );
  if (exactMatch) return exactMatch;

  // Fallback: kembalikan string apa adanya
  return d;
}
