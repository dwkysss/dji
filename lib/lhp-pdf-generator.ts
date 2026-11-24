import fs from "fs";
import path from "path";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDefectLinesWithNumbering } from "@/lib/defect-format-utils";
import { formatDurationSmart } from "@/lib/shift-utils";

const BULAN_ID = [
  "01 - Januari",
  "02 - Februari",
  "03 - Maret",
  "04 - April",
  "05 - Mei",
  "06 - Juni",
  "07 - Juli",
  "08 - Agustus",
  "09 - September",
  "10 - Oktober",
  "11 - November",
  "12 - Desember",
];

let cachedLogoDataUrl: string | null | undefined = undefined;
function getLogoDataUrl(): string | null {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  try {
    const logoPath = path.join(process.cwd(), "public", "assets", "dji-logo.png");
    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      cachedLogoDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
      return cachedLogoDataUrl;
    }
  } catch {}
  cachedLogoDataUrl = null;
  return null;
}

const extractDate = (ts?: string): string => {
  if (!ts) return "-";
  if (ts.includes("T")) return ts.split("T")[0];
  if (ts.includes(" ")) return ts.split(" ")[0];
  return ts;
};

function formatFullDateTime(dateVal?: string): string {
  if (!dateVal || dateVal === "-" || dateVal === "—") return "-";
  try {
    const str = String(dateVal).trim();
    if (!str) return "-";
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    let dt: Date;
    if (str.includes("T")) {
      dt = new Date(str);
    } else if (str.includes(" ")) {
      const parts = str.split(" ");
      const dPart = parts[0];
      const tPart = parts[1] || "00:00:00";
      if (str.includes("Z") || str.includes("+") || str.includes("-", 10)) dt = new Date(str);
      else dt = new Date(`${dPart}T${tPart}`);
    } else {
      dt = new Date(str);
    }
    if (isNaN(dt.getTime())) return str;
    const year = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" });
    const month = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta", month: "2-digit" });
    const day = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta", day: "2-digit" });
    const timeStr = dt
      .toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      .replace(/\./g, ":");
    return `${year}-${month}-${day} ${timeStr}`;
  } catch {
    return dateVal;
  }
}

const cleanMeterVal = (val: any): string =>
  val === null || val === undefined
    ? ""
    : String(val)
        .replace(/PCS\s*\d+\s*:\s*/gi, "")
        .replace(/[a-zA-Z\s]+$/g, "")
        .trim()
        .replace(/\b0+(\d+)\b/g, "$1");

const buildCacatText = (item: any): string => {
  const lines: string[] = [];
  if (Array.isArray(item.production_defects) && item.production_defects.length > 0) {
    item.production_defects.forEach((d: any) => {
      if (
        (d.kategori || "").toUpperCase().includes("ISTIRAHAT") ||
        (d.detail || "").toUpperCase().includes("ISTIRAHAT")
      ) {
        return;
      }
      const k = d.kategori || "";
      const det = d.detail || "";
      const b = d.blok || "";
      let line = k && det ? `${k} - ${det}` : k || det;
      if (b) line += ` (b. ${String(b).replace(/blok\s*/gi, "").trim()})`;
      if (line && !lines.includes(line)) lines.push(line);
    });
  }

  if (lines.length === 0) {
    const k = item.kategori_masalah || "";
    const d = item.detail_masalah || "";
    const ketCacat = (item.keterangan_cacat || "")
      .replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "")
      .trim();

    const kList = k.split(",").map((s: string) => s.trim()).filter(Boolean);
    const dList = d.split(",").map((s: string) => s.trim()).filter(Boolean);

    if (kList.length > 1 || dList.length > 1) {
      const maxLen = Math.max(kList.length, dList.length);
      for (let i = 0; i < maxLen; i++) {
        const cat = kList[i] || kList[0] || "";
        const det = dList[i] || dList[0] || "";
        let line = cat && det ? `${cat} - ${det}` : cat || det;
        if (ketCacat) {
          const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
          if (cleanB) line += ` (b. ${cleanB})`;
        }
        if (line && !lines.includes(line)) lines.push(line);
      }
    } else {
      let line = k && d ? `${k} - ${d}` : k || d;
      if (ketCacat) {
        const isJustBlok =
          /^blok\s*\d+(\s*,\s*blok\s*\d+)*$/i.test(ketCacat) ||
          /^\d+(\s*,\s*\d+)*$/.test(ketCacat) ||
          /^blok\s*$/i.test(ketCacat);
        const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
        if (
          cleanB &&
          !cleanB.toLowerCase().includes("backup") &&
          !cleanB.toLowerCase().includes("istirahat") &&
          cleanB !== "()" &&
          cleanB !== "-"
        ) {
          if (line) line += ` (b. ${cleanB})`;
          else if (!isJustBlok) line = ketCacat;
        }
      }
      if (line && !lines.includes(line)) lines.push(line);
    }
  }

  const numbered = formatDefectLinesWithNumbering(lines);
  return numbered.length > 0 ? numbered.join("\n").replace(/\bbenang\b/gi, "B.") : "-";
};

const formatDurationNice = (totalSec: number | string) =>
  formatDurationSmart(totalSec, { zeroText: "-" });

const getGrade = (panel: any, detail: any): "A" | "B" | "BS" | "" => {
  const ketCacat = (detail?.keterangan_cacat || panel?.keterangan_cacat || "").toUpperCase();
  const katMasalah = (detail?.kategori_masalah || panel?.kategori_masalah || "").toUpperCase();
  const panelNo = String(panel?.panel_no || "").toUpperCase();
  if (ketCacat === "START" || ketCacat === "FINISH") return "";
  if (
    ketCacat.includes("BS") ||
    ketCacat.includes("GAGAL") ||
    katMasalah.includes("BS") ||
    panelNo.includes("BS") ||
    panelNo.includes("GAGAL")
  ) {
    return "BS";
  }
  const inspId = detail?.final_inspection_id ?? panel?.final_inspection_id ?? 1;
  if (inspId === 3 || String(inspId) === "3") return "BS";
  if (inspId === 2 || String(inspId) === "2") return "B";
  if (detail?.kategori_masalah || detail?.detail_masalah) return "B";
  return "A";
};

function groupByPcs(rawPanels: any[]) {
  const pcsGroups: { [key: string]: any[] } = {};

  const uniqueById = new Map<string, any>();
  (rawPanels || []).forEach((panel: any) => {
    if (!uniqueById.has(panel.id)) {
      uniqueById.set(panel.id, { ...panel, production_details: [...(panel.production_details || [])] });
    }
  });

  const deduplicatedPanels = Array.from(uniqueById.values());
  const finalPanels: any[] = [];
  const seenPanelNo = new Map<string, any>();

  deduplicatedPanels.forEach((panel: any) => {
    if (panel.panel_no === "METERAN") {
      finalPanels.push(panel);
    } else {
      const key = panel.panel_no;
      const existing = seenPanelNo.get(key);
      if (existing) {
        existing.production_details.push(...(panel.production_details || []));
        const existingPcs = parseInt(existing.pcs || "1");
        const newPcs = parseInt(panel.pcs || "1");
        if (newPcs > existingPcs) existing.pcs = newPcs.toString();
      } else {
        seenPanelNo.set(key, panel);
      }
    }
  });
  finalPanels.push(...Array.from(seenPanelNo.values()));

  let maxBatchPcs = 1;
  finalPanels.forEach((p: any) => {
    const pPcs = parseInt(p.pcs || "1");
    if (pPcs > maxBatchPcs) maxBatchPcs = pPcs;
    if (Array.isArray(p.production_details)) {
      p.production_details.forEach((d: any) => {
        const dPcs = d.pcs_index ? parseInt(d.pcs_index) : 1;
        if (dPcs > maxBatchPcs) maxBatchPcs = dPcs;
      });
    }
  });

  finalPanels.forEach((panel: any) => {
    if (
      panel.panel_no === "Downtime Mekanik (Direct)" ||
      String(panel.panel_no || "").toUpperCase() === "BERHENTI" ||
      panel.pcs === 0 ||
      panel.pcs === "0"
    ) {
      return;
    }
    const isMeterInput = panel.panel_no === "METERAN";
    const totalPcs = isMeterInput
      ? Math.max(maxBatchPcs, parseInt(panel.pcs ?? "1"))
      : parseInt(panel.pcs ?? "1");

    for (let i = 1; i <= totalPcs; i++) {
      const pcsKey = i.toString();
      if (!pcsGroups[pcsKey]) pcsGroups[pcsKey] = [];
      const panelClone = { ...panel };
      panelClone.production_details =
        (panel.production_details || []).filter((d: any) => {
          const pIndex = d.pcs_index ? parseInt(d.pcs_index) : 1;
          return pIndex === i;
        });
      pcsGroups[pcsKey].push(panelClone);
    }
  });

  return pcsGroups;
}

function buildPanelRows(panels: any[], shiftName: string) {
  const sorted = [...panels]
    .filter((p: any) => p.panel_no !== "METERAN")
    .sort((a, b) => {
      const pAStr = String(a.panel_no || "").trim().toUpperCase();
      const pBStr = String(b.panel_no || "").trim().toUpperCase();

      const isAwalA = pAStr.includes("AWAL");
      const isAwalB = pBStr.includes("AWAL");
      if (isAwalA && !isAwalB) return -1;
      if (!isAwalA && isAwalB) return 1;

      const isAkhirA = pAStr.includes("AKHIR");
      const isAkhirB = pBStr.includes("AKHIR");
      if (isAkhirA && !isAkhirB) return 1;
      if (!isAkhirA && isAkhirB) return -1;

      const pA = parseInt(pAStr || "0");
      const pB = parseInt(pBStr || "0");
      if (pA === pB) return String(a.tanggal_jam || "").localeCompare(String(b.tanggal_jam || ""));
      return pA - pB;
    });

  let lastTgl = "";
  let lastGrp = "";
  let lastOpr = "";
  const rows: any[] = [];

  sorted.forEach((panel: any) => {
    const details = panel.production_details || [];
    const detailList = details.length > 0 ? details : [{}];

    detailList.forEach((detail: any, di: number) => {
      const ts = panel.tanggal_jam || panel.created_at || "";
      const tglStr = extractDate(ts);
      const grpStr = panel.groups?.nama_grup || shiftName || "-";
      const oprStr = panel.operators?.nama_operator || panel.pic || "-";

      const hasBackupOp = Boolean(
        panel.operator_backup &&
          String(panel.operator_backup).trim() !== "" &&
          String(panel.operator_backup).trim() !== "-"
      );
      const isIstirahat =
        hasBackupOp ||
        (detail.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") ||
        (detail.kategori_masalah || "").toUpperCase().includes("ISTIRAHAT");

      let hasRealDefect = false;
      if (Array.isArray(detail.production_defects) && detail.production_defects.length > 0) {
        hasRealDefect = detail.production_defects.some((d: any) => {
          const k = (d.kategori || "").toUpperCase().trim();
          const det = (d.detail || "").toUpperCase().trim();
          if (k.includes("ISTIRAHAT") || det.includes("ISTIRAHAT")) return false;
          if (det.includes("GAGAL CACAT") || k === "G") return false;
          return true;
        });
      } else {
        const katStr = (detail.kategori_masalah || "").toUpperCase().trim();
        const detStr = (detail.detail_masalah || "").toUpperCase().trim();
        if (katStr && katStr !== "G" && !katStr.includes("ISTIRAHAT") && !katStr.includes("GAGAL CACAT")) {
          hasRealDefect = true;
        }
        if (
          detStr &&
          !detStr.includes("ISTIRAHAT") &&
          !detStr.includes("START") &&
          !detStr.includes("FINISH") &&
          !detStr.includes("GAGAL CACAT")
        ) {
          hasRealDefect = true;
        }
      }
      if ((detail.keterangan_cacat || "").includes("[TAMBAHAN QC]")) {
        hasRealDefect = true;
      }

      const hasDefect = hasRealDefect;
      const isGagal =
        String(panel.panel_no || "").toUpperCase().includes("GAGAL") ||
        String(panel.panel_no || "").toUpperCase().includes("BS");

      const isFirstRow = rows.length === 0;
      const showTgl = di === 0 ? tglStr !== lastTgl || oprStr !== lastOpr : false;
      const showGrp = di === 0 ? grpStr !== lastGrp || oprStr !== lastOpr : false;
      const showOpr = di === 0 ? oprStr !== lastOpr : false;

      if (di === 0) {
        if (showTgl) lastTgl = tglStr;
        if (showGrp) lastGrp = grpStr;
        if (showOpr) lastOpr = oprStr;
      }

      const mergedDetail = {
        ...detail,
        production_defects: detail.production_defects || panel.production_defects,
      };
      const cacatText = buildCacatText(mergedDetail);
      const downtimeSec = panel.total_downtime_detik || 0;
      const downtimeStr = di === 0 && downtimeSec > 0 ? formatDurationNice(downtimeSec) : "-";

      const isFinish =
        (detail.keterangan_cacat || "").toUpperCase() === "FINISH" ||
        (panel.meter_akhir !== null &&
          panel.meter_akhir !== undefined &&
          String(panel.meter_akhir || "").trim() !== "" &&
          !detail.kategori_masalah &&
          !detail.detail_masalah);

      const grade = isFinish ? "" : getGrade(panel, detail);

      let backupOpName = "";
      if (isIstirahat) {
        backupOpName =
          panel.operator_backup && String(panel.operator_backup).trim() !== "-"
            ? String(panel.operator_backup).trim()
            : "";
        if (!backupOpName) {
          const searchStr = `${panel.pic || ""} ${panel.jenis_laporan || ""} ${detail.keterangan_cacat || ""} ${detail.detail_masalah || ""}`;
          const m = searchStr.match(/Backup:\s*([^)\],]+)/i);
          if (m && m[1]) backupOpName = m[1].trim();
        }
      }

      const isBsAwal = String(panel.panel_no || "").toUpperCase().includes("AWAL");
      const isBsAkhir = String(panel.panel_no || "").toUpperCase().includes("AKHIR");
      const isSisa = isBsAwal || isBsAkhir;

      const displayCacat = isSisa
        ? isBsAwal
          ? "Sisa Awal Potongan"
          : "Sisa Akhir Potongan"
        : isFinish
        ? "FINISH"
        : isIstirahat && backupOpName
        ? cacatText && cacatText !== "-"
          ? `${backupOpName}\n${cacatText}`
          : backupOpName
        : cacatText;

      rows.push({
        panelNo: panel.panel_no,
        tglStr,
        grpStr,
        oprStr,
        showTgl,
        showGrp,
        showOpr,
        isFirstRow,
        isIstirahat,
        isFinish,
        hasDefect,
        isGagal,
        cacatText: displayCacat,
        downtimeStr,
        grade,
      });
    });
  });

  return rows;
}

const sanitizeFilePart = (val: string): string =>
  String(val || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Draws a crisp vector checkmark (✓) centered in a jsPDF cell
function drawCheckmark(doc: jsPDF, cx: number, cy: number, size = 1.6) {
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.32);
  doc.line(cx - size * 0.55, cy + size * 0.05, cx - size * 0.1, cy + size * 0.5);
  doc.line(cx - size * 0.1, cy + size * 0.5, cx + size * 0.65, cy - size * 0.55);
}

// Draws a crisp vector X centered in a jsPDF cell
function drawCross(doc: jsPDF, cx: number, cy: number, size = 1.2) {
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.line(cx - size * 0.5, cy - size * 0.5, cx + size * 0.5, cy + size * 0.5);
  doc.line(cx + size * 0.5, cy - size * 0.5, cx - size * 0.5, cy + size * 0.5);
}

const CHECK_TOKEN = "__CHECK__";
const CROSS_TOKEN = "__CROSS__";

export interface GeneratedLhpPdfResult {
  pdfBase64: string;
  fileName: string;
  folderYear: string;
  folderMonth: string;
  folderMachine: string;
}

export function generateLhpPdfBase64(detailData: any): GeneratedLhpPdfResult {
  const mcClean = String(detailData?.nomor_mc || "MC").trim().toUpperCase();
  const potStr = String(detailData?.potongan_ke || "0").trim();
  const designClean = String(detailData?.design_id || "-").trim();

  const rawPanels: any[] = detailData?.panels || [];
  const shiftName = rawPanels[0]?.groups?.nama_grup || "-";
  const isMeterMode = rawPanels.some((p: any) => String(p.panel_no || "").toUpperCase() === "METERAN");
  const pcsGroups = groupByPcs(rawPanels);
  const sortedPcsKeys = Object.keys(pcsGroups).sort((a, b) => parseInt(a) - parseInt(b));
  if (sortedPcsKeys.length === 0) sortedPcsKeys.push("1");

  const totalPanelCount = Object.values(pcsGroups).reduce((sum, arr) => sum + arr.length, 0);
  const needsLandscape = sortedPcsKeys.length > 2 || totalPanelCount > 60;

  const doc = new jsPDF({
    orientation: needsLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 8;
  const contentWidth = pageWidth - marginX * 2;

  // Compute exact oldest (TGL PRODUKSI) and latest (TGL POTONG) timestamps just like PrintableProductionReport
  let oldestTs = detailData?.tanggal_jam || detailData?.created_at || detailData?.tgl || "";
  let latestTs = detailData?.waktu_input_terakhir || detailData?.tanggal_jam || detailData?.created_at || detailData?.tgl || "";
  rawPanels.forEach((p: any) => {
    const tsAll = p.tanggal_jam || p.created_at || p.tgl;
    if (tsAll && (!oldestTs || String(tsAll).localeCompare(String(oldestTs)) < 0)) {
      oldestTs = tsAll;
    }
    const tsCut = p.tanggal_jam || p.created_at;
    if (tsCut && (!latestTs || String(tsCut).localeCompare(String(tsCut)) > 0)) {
      latestTs = tsCut;
    }
  });

  const tglProdDisplay = formatFullDateTime(oldestTs || "-");
  const tglPotongDisplay = formatFullDateTime(latestTs || detailData?.tanggal_potong || "-");

  const tglProdDateOnly = extractDate(oldestTs || detailData?.tgl || "");
  const refDate = /^\d{4}-\d{2}-\d{2}$/.test(tglProdDateOnly)
    ? new Date(`${tglProdDateOnly}T08:00:00+07:00`)
    : new Date();
  const folderYear = String(refDate.getFullYear());
  const folderMonth = BULAN_ID[refDate.getMonth()] || "01 - Januari";

  const nowWibDate = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const nowWibTime = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(/\./g, ".");

  // ── 1. Document Header (with DJI Logo) ────────────────────────────────────
  const logoDataUrl = getLogoDataUrl();
  const titleX = logoDataUrl ? marginX + 9 : marginX;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", marginX, 7.5, 7.2, 7.2);
    } catch {}
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("PT. DENTELLE JAYA INFINITEX", titleX, 11);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text("LAPORAN HASIL PRODUKSI & KENDALA MESIN RAJUT", titleX, 14.3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`NO: LHP/${mcClean}/${potStr}/${folderYear}`, pageWidth - marginX, 11, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${nowWibDate}  •  ${nowWibTime} WIB`, pageWidth - marginX, 14.3, { align: "right" });

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.55);
  doc.line(marginX, 16.5, pageWidth - marginX, 16.5);

  // ── 2. Metadata Box (SPESIFIKASI PRODUKSI | MATERIAL BENANG) ──────────────
  const totalProduksiStr = isMeterMode
    ? `${detailData?.total_meter || detailData?.total_panels || 0} Meter`
    : `${detailData?.total_panels || 0} Panel`;

  const totalDtSec =
    detailData?.total_downtime_detik ??
    detailData?.total_downtime ??
    rawPanels.reduce((s: number, p: any) => s + (Number(p.total_downtime_detik) || 0), 0);
  const totalDtStr = formatDurationSmart(totalDtSec || 0, { zeroText: "0 Dtk" });

  const boxY = 18.5;
  const boxH = 26.5;
  const splitX = marginX + contentWidth * 0.5;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.25);
  doc.rect(marginX, boxY, contentWidth, boxH);
  doc.line(splitX, boxY, splitX, boxY + boxH);

  // Section titles with subtle bottom divider
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text("SPESIFIKASI PRODUKSI", marginX + 2, boxY + 4);
  doc.text("MATERIAL BENANG", splitX + 2, boxY + 4);
  doc.setDrawColor(203, 213, 225);
  doc.line(marginX + 2, boxY + 5.2, splitX - 2, boxY + 5.2);
  doc.line(splitX + 2, boxY + 5.2, pageWidth - marginX - 2, boxY + 5.2);

  const specLeftCol1 = [
    ["NOMOR MESIN", `: ${mcClean}`],
    ["DESIGN", `: ${designClean}`],
    ["TGL PRODUKSI", `: ${tglProdDisplay}`],
    ["TGL POTONG", `: ${tglPotongDisplay}`],
    ["NO. ORDER", `: ${detailData?.no_order_barang || "-"}`],
    ["NO. CUSTOMER", `: ${detailData?.no_customer || "-"}`],
  ];
  const specLeftCol2 = [
    ["POTONGAN KE", `: ${potStr}`],
    ["PICK", `: ${detailData?.pick || "-"}`],
    ["COURSE", `: ${detailData?.course || "-"}`],
    ["RPM", `: ${detailData?.rpm || "-"}`],
    ["TOT. PRODUKSI", `: ${totalProduksiStr}`],
    ["TOT. DOWNTIME", `: ${totalDtStr}`],
  ];
  const specRight = [
    ["JENIS BENANG DASAR", `: ${detailData?.jenis_benang_dasar || "-"}`],
    ["LINER", `: ${detailData?.liner || "-"}`],
    ["HEAVY", `: ${detailData?.heavy || "-"}`],
    ["SHADOW", `: ${detailData?.shadow || "-"}`],
    ["PINGGIRAN", `: ${detailData?.pinggiran || "-"}`],
  ];

  doc.setFontSize(6.2);
  specLeftCol1.forEach((row, idx) => {
    const y = boxY + 8.5 + idx * 3.1;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text(row[0], marginX + 2, y);
    doc.setTextColor(15, 23, 42);
    doc.text(row[1].substring(0, 24), marginX + 21, y);
  });

  const col2X = marginX + contentWidth * 0.275;
  specLeftCol2.forEach((row, idx) => {
    const y = boxY + 8.5 + idx * 3.1;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text(row[0], col2X, y);
    doc.setTextColor(15, 23, 42);
    doc.text(row[1].substring(0, 18), col2X + 20, y);
  });

  specRight.forEach((row, idx) => {
    const y = boxY + 8.5 + idx * 3.1;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text(row[0], splitX + 2, y);
    doc.setTextColor(15, 23, 42);
    doc.text(row[1].substring(0, 44), splitX + 31, y);
  });

  let cursorY = boxY + boxH + 3.5;
  let prodGradeA = 0;
  let prodGradeB = 0;
  let prodGradeBS = 0;

  // ── 3. Per-PCS Tables (Exact PrintableProductionReport format) ────────────
  const headRow = [
    isMeterMode ? "MTR" : "PNL",
    "TGL",
    "GRP",
    "OPERATOR",
    "KET",
    "KETERANGAN CACAT",
    "DT",
    "A",
    "B",
    "BS",
  ];

  const renderPanelAutoTable = (
    rowsToRender: any[],
    startY: number,
    leftMargin: number,
    rightMargin: number,
    tableW: number,
    isSplit: boolean
  ): number => {
    const body = rowsToRender.map((r) => {
      const ketToken = r.isFinish
        ? ""
        : r.hasDefect || r.isGagal
        ? CROSS_TOKEN
        : CHECK_TOKEN;

      const opDisplay = r.isFirstRow
        ? r.oprStr
        : r.isIstirahat
        ? "Istirahat"
        : r.showOpr
        ? r.oprStr
        : "";

      return [
        String(r.panelNo || "-"),
        r.showTgl ? r.tglStr : "",
        r.showGrp ? r.grpStr : "",
        opDisplay,
        ketToken,
        r.cacatText || "-",
        r.downtimeStr || "-",
        r.grade === "A" ? CHECK_TOKEN : "",
        r.grade === "B" ? CHECK_TOKEN : "",
        r.grade === "BS" ? CHECK_TOKEN : "",
      ];
    });

    const fSize = isSplit ? 5.6 : 6.5;
    const cPad = isSplit ? 0.9 : 1.1;

    autoTable(doc, {
      startY,
      margin: { left: leftMargin, right: rightMargin },
      tableWidth: tableW,
      head: [headRow],
      body,
      theme: "grid",
      styles: {
        fontSize: fSize,
        cellPadding: cPad,
        lineColor: [180, 192, 206],
        lineWidth: 0.15,
        textColor: [15, 23, 42],
        valign: "middle",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [15, 23, 42],
        fontStyle: "bold",
        halign: "center",
        fontSize: fSize,
        lineColor: [148, 163, 184],
        lineWidth: 0.2,
      },
      columnStyles: isSplit
        ? {
            0: { halign: "center", fontStyle: "bold", cellWidth: tableW * 0.085 },
            1: { halign: "center", cellWidth: tableW * 0.13 },
            2: { halign: "center", cellWidth: tableW * 0.06 },
            3: { cellWidth: tableW * 0.125 },
            4: { halign: "center", cellWidth: tableW * 0.06 },
            5: { cellWidth: tableW * 0.265 },
            6: { halign: "center", cellWidth: tableW * 0.115 },
            7: { halign: "center", cellWidth: tableW * 0.05 },
            8: { halign: "center", cellWidth: tableW * 0.05 },
            9: { halign: "center", cellWidth: tableW * 0.06 },
          }
        : {
            0: { halign: "center", fontStyle: "bold", cellWidth: tableW * 0.075 },
            1: { halign: "center", cellWidth: tableW * 0.12 },
            2: { halign: "center", cellWidth: tableW * 0.055 },
            3: { cellWidth: tableW * 0.13 },
            4: { halign: "center", cellWidth: tableW * 0.055 },
            5: { cellWidth: tableW * 0.29 },
            6: { halign: "center", cellWidth: tableW * 0.11 },
            7: { halign: "center", cellWidth: tableW * 0.055 },
            8: { halign: "center", cellWidth: tableW * 0.055 },
            9: { halign: "center", cellWidth: tableW * 0.055 },
          },
      didParseCell: (data) => {
        if (data.section === "body") {
          const raw = String(data.cell.raw || "");
          if (raw === CHECK_TOKEN || raw === CROSS_TOKEN) {
            data.cell.text = [""];
          }
          // Italicize "Istirahat" in OPERATOR column
          if (data.column.index === 3 && raw === "Istirahat") {
            data.cell.styles.fontStyle = "italic";
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === "body") {
          const raw = String(data.cell.raw || "");
          const cx = data.cell.x + data.cell.width / 2;
          const cy = data.cell.y + data.cell.height / 2;
          if (raw === CHECK_TOKEN) {
            drawCheckmark(doc, cx, cy, isSplit ? 1.5 : 1.8);
          } else if (raw === CROSS_TOKEN) {
            drawCross(doc, cx, cy, isSplit ? 1.15 : 1.35);
          }
        }
      },
    });

    return (doc as any).lastAutoTable?.finalY || startY;
  };

  sortedPcsKeys.forEach((pcsKey) => {
    const pcsPanels = pcsGroups[pcsKey] || [];
    const isMeterPcs = pcsPanels.some((p: any) => p.panel_no === "METERAN");

    // Banner
    if (cursorY > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      cursorY = 10;
    }

    const panelRows = isMeterPcs
      ? pcsPanels
          .sort((a: any, b: any) => String(a.tanggal_jam || "").localeCompare(String(b.tanggal_jam || "")))
          .map((p: any, idx: number) => {
            const det = (p.production_details && p.production_details[0]) || {};
            const isIst =
              (det.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") ||
              (det.kategori_masalah || "").toUpperCase().includes("ISTIRAHAT");
            return {
              panelNo: cleanMeterVal(det.meter_kain || p.meter_akhir || p.meter_awal || "-") || "-",
              tglStr: extractDate(p.tanggal_jam || p.tgl),
              grpStr: p.groups?.nama_grup || shiftName || "-",
              oprStr: p.operators?.nama_operator || p.pic || "-",
              showTgl: idx === 0,
              showGrp: idx === 0,
              showOpr: idx === 0,
              isIstirahat: isIst,
              hasDefect: !isIst && Boolean(det.kategori_masalah && det.kategori_masalah !== "G"),
              isGagal: false,
              cacatText: isIst ? p.operator_backup || "-" : buildCacatText(det),
              downtimeStr: p.total_downtime_detik > 0 ? formatDurationNice(p.total_downtime_detik) : "-",
              grade: isIst ? "" : getGrade(p, det),
            };
          })
      : buildPanelRows(pcsPanels, shiftName);

    // Accumulate production grade counts for footer
    panelRows.forEach((r: any) => {
      if (r.grade === "A") prodGradeA++;
      else if (r.grade === "B") prodGradeB++;
      else if (r.grade === "BS") prodGradeBS++;
    });

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.rect(marginX, cursorY, contentWidth, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const pcsTitle = `PCS ${pcsKey}`;
    const pcsSub = `(${isMeterPcs ? "Mode Meter" : `${panelRows.length} panel`})`;
    const titleW = doc.getTextWidth(pcsTitle);
    doc.text(pcsTitle, pageWidth / 2 - 8, cursorY + 4.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(pcsSub, pageWidth / 2 - 8 + titleW + 2, cursorY + 4.1);
    cursorY += 6;

    // Exact same threshold as PrintableProductionReport: split 2 columns if portrait & > 15 rows
    const useTwoCols = !isMeterPcs && !needsLandscape && panelRows.length > 15;

    if (useTwoCols) {
      const mid = Math.ceil(panelRows.length / 2);
      const gap = 2.5;
      const halfW = (contentWidth - gap) / 2;
      const leftEnd = renderPanelAutoTable(
        panelRows.slice(0, mid),
        cursorY,
        marginX,
        pageWidth - marginX - halfW,
        halfW,
        true
      );
      const rightEnd = renderPanelAutoTable(
        panelRows.slice(mid),
        cursorY,
        marginX + halfW + gap,
        marginX,
        halfW,
        true
      );
      cursorY = Math.max(leftEnd, rightEnd) + 4;
    } else {
      cursorY =
        renderPanelAutoTable(panelRows, cursorY, marginX, marginX, contentWidth, false) + 4;
    }
  });

  // ── 4. Official Inspection & Mending Footer (Auto-filled when QC/Mending data exists) ──
  const footerHeightNeeded = 56;
  if (cursorY + footerHeightNeeded > doc.internal.pageSize.getHeight() - 8) {
    doc.addPage();
    cursorY = 10;
  }

  const qcSum = detailData?.qc_summary || null;
  const mendSum = detailData?.mending_summary || null;

  const fmtTimeOnly = (val?: string): string => {
    if (!val) return "";
    const s = String(val).trim();
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.substring(0, 5);
    const full = formatFullDateTime(s);
    const parts = full.split(" ");
    return parts.length > 1 ? parts[1].substring(0, 5) : full;
  };

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.25);
  doc.setTextColor(51, 65, 85);

  // Row 1: Col1 (42%) | Col2 (38%) | Col3 (20%)
  const r1Y = cursorY;
  const r1H = 19;
  const c1W = contentWidth * 0.42;
  const c2W = contentWidth * 0.38;
  const c3W = contentWidth * 0.2;
  const c2X = marginX + c1W;
  const c3X = c2X + c2W;

  doc.rect(marginX, r1Y, c1W, r1H);
  doc.rect(c2X, r1Y, c2W, r1H);
  doc.rect(c3X, r1Y, c3W, r1H);

  // Col 1 rows (with auto-filled values if available)
  const beratInspectStr = qcSum?.berat_kain ? `${qcSum.berat_kain} Kg` : "";
  const totalPanelInspectStr = mendSum?.total_panel
    ? `${mendSum.total_panel} ${isMeterMode ? "Meter" : "Panel"}`
    : qcSum && (qcSum.total_ceklis || qcSum.total_silang)
    ? `${(qcSum.total_ceklis || 0) + (qcSum.total_silang || 0)} ${isMeterMode ? "Meter" : "Panel"}`
    : "";

  const col1Rows: [string, string][] = [
    ["Berat Produksi", beratInspectStr],
    ["Total Panel Setelah di Inspecting", totalPanelInspectStr],
    ["Berat Inspecting", beratInspectStr],
  ];
  doc.setFontSize(6.5);
  col1Rows.forEach(([lbl, val], i) => {
    const rowY = r1Y + (i + 1) * (r1H / 3);
    if (i < 2) {
      doc.setDrawColor(203, 213, 225);
      doc.line(marginX, rowY, c2X, rowY);
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(lbl, marginX + 2, rowY - 2);
    doc.text(":", marginX + 43, rowY - 2);
    if (val) {
      doc.setTextColor(15, 23, 42);
      doc.text(val, marginX + 45.5, rowY - 2);
    }
  });

  // Col 2: KET | Produksi | Setelah Inspect
  doc.setDrawColor(148, 163, 184);
  const k1X = c2X + c2W * 0.5;
  const k2X = c2X + c2W * 0.75;
  doc.line(k1X, r1Y, k1X, r1Y + r1H);
  doc.line(k2X, r1Y, k2X, r1Y + r1H);
  const subRowH = r1H / 4;
  for (let i = 1; i < 4; i++) {
    doc.setDrawColor(i === 1 ? 148 : 203, i === 1 ? 163 : 213, i === 1 ? 184 : 225);
    doc.line(c2X, r1Y + subRowH * i, c3X, r1Y + subRowH * i);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.setTextColor(51, 65, 85);
  doc.text("KET", c2X + 2, r1Y + 3.4);
  doc.text("Produksi", k1X + (c2W * 0.25) / 2, r1Y + 3.4, { align: "center" });
  doc.text("Setelah Inspect", k2X + (c2W * 0.25) / 2, r1Y + 3.4, { align: "center" });

  const gradeSummaryRows: [string, string, string][] = [
    ["Total Grade A", String(prodGradeA), mendSum ? String(mendSum.grade_a ?? 0) : ""],
    ["Total Grade B", String(prodGradeB), mendSum ? String(mendSum.grade_b ?? 0) : ""],
    ["BS", String(prodGradeBS), mendSum ? String(mendSum.grade_bs ?? 0) : ""],
  ];
  gradeSummaryRows.forEach(([lbl, prodVal, afterVal], i) => {
    const yText = r1Y + subRowH * (i + 2) - 1.3;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(lbl, c2X + 2, yText);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(prodVal, k1X + (c2W * 0.25) / 2, yText, { align: "center" });
    if (afterVal !== "") {
      doc.text(afterVal, k2X + (c2W * 0.25) / 2, yText, { align: "center" });
    }
  });

  // Col 3: Tanggal + (Petugas Inspect)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.setTextColor(51, 65, 85);
  const tglInspectStr = qcSum?.tanggal_inspeksi
    ? `Tanggal: ${extractDate(qcSum.tanggal_inspeksi)}`
    : "Tanggal, ................... 202";
  doc.text(tglInspectStr, c3X + c3W / 2, r1Y + 4, { align: "center" });
  if (qcSum?.petugas) {
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(6.5);
    doc.text(qcSum.petugas.substring(0, 26), c3X + c3W / 2, r1Y + 12.2, { align: "center" });
  }
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(6);
  doc.text("(Petugas Inspect)", c3X + c3W / 2, r1Y + r1H - 1.8, { align: "center" });

  // Row 2: Hasil Matching + TTD KA-Shift (30%) | Inspect & Mending fields (70%)
  const r2Y = r1Y + r1H + 3;
  const r2H = 31;
  const m1W = contentWidth * 0.3;
  const m2W = contentWidth * 0.7;
  const m2X = marginX + m1W;

  doc.setDrawColor(148, 163, 184);
  doc.rect(marginX, r2Y, m1W, r2H);
  doc.rect(m2X, r2Y, m2W, r2H);

  // Left box: Hasil Matching + TTD KA-Shift
  doc.line(marginX, r2Y + 5.5, m2X, r2Y + 5.5);
  doc.line(marginX + m1W * 0.55, r2Y, marginX + m1W * 0.55, r2Y + 5.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text("Hasil Matching", marginX + 2, r2Y + 3.8);
  const matchingVal = detailData?.status_matching && detailData.status_matching !== "-" ? String(detailData.status_matching) : "";
  if (matchingVal) {
    doc.setTextColor(15, 23, 42);
    doc.text(matchingVal.substring(0, 14), marginX + m1W * 0.57, r2Y + 3.8);
  }
  doc.setTextColor(51, 65, 85);
  doc.text("TTD KA-Shift", marginX + m1W / 2, r2Y + 11, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("(........................)", marginX + m1W / 2, r2Y + r2H - 3, { align: "center" });

  // Right box: Start/Finish Inspect & Mending (auto-filled when available)
  const mFields: [string, string][] = [
    ["Start Inspect", fmtTimeOnly(qcSum?.start_inspect)],
    ["Finish Inspect", fmtTimeOnly(qcSum?.finish_inspect)],
    ["", ""],
    ["Tanggal Mending", mendSum?.tanggal_mending ? extractDate(mendSum.tanggal_mending) : ""],
    ["Petugas Mending", mendSum?.petugas || ""],
    ["", ""],
    ["Start Mending", fmtTimeOnly(mendSum?.start_mending)],
    ["Finish Mending", fmtTimeOnly(mendSum?.finish_mending)],
  ];
  const mRowH = r2H / mFields.length;
  doc.setFontSize(6.2);
  mFields.forEach(([lbl, val], i) => {
    const yLine = r2Y + mRowH * (i + 1);
    if (i < mFields.length - 1) {
      doc.setDrawColor(203, 213, 225);
      doc.line(m2X, yLine, pageWidth - marginX, yLine);
    }
    if (lbl) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      doc.text(lbl, m2X + 2, yLine - 1.1);
      doc.text(":", m2X + 34, yLine - 1.1);
      if (val) {
        doc.setTextColor(15, 23, 42);
        doc.text(val.substring(0, 48), m2X + 36.5, yLine - 1.1);
      }
    }
  });

  // Extract pure base64
  const dataUri = doc.output("datauristring");
  const pdfBase64 = dataUri.includes(",") ? dataUri.split(",")[1] : dataUri;

  const safeDesign = sanitizeFilePart(designClean);
  const fileName = `LHP_${sanitizeFilePart(mcClean)}_Pot${sanitizeFilePart(potStr)}${
    safeDesign && safeDesign !== "-" ? `_${safeDesign}` : ""
  }.pdf`;

  return {
    pdfBase64,
    fileName,
    folderYear,
    folderMonth,
    folderMachine: mcClean,
  };
}
