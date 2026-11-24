"use server";

import { createClient } from "@/lib/supabase/server";
import { searchEmployeeHistory } from "@/actions/employee-actions";
import { getGoogleSheetEndpoint } from "@/actions/google-sheet-actions";
import { generateLhpPdfBase64 } from "@/lib/lhp-pdf-generator";

const EXCLUDED_ARCHIVE_MACHINES = new Set(["R13", "R14"]);

function formatPetugasNames(names: string[]): string {
  const unique = Array.from(new Set(names.map((n) => String(n || "").trim()).filter(Boolean)));
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} & ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")}, & ${unique[unique.length - 1]}`;
}

async function loadBatchForPdf(params: {
  nomorMc: string;
  potonganKe: number | string;
  designId?: string;
}) {
  const mc = String(params.nomorMc || "").trim().toUpperCase();
  const potStr = String(params.potonganKe || "").trim();
  const potNum = Number(potStr);
  if (!mc || !potStr) return null;

  const supabase = await createClient();

  const [res, qcRes, mendingRes] = await Promise.all([
    searchEmployeeHistory({
      nomor_mc: mc,
      potongan_ke: potStr,
      design_id: params.designId || undefined,
      includeDetails: true,
    }),
    !isNaN(potNum)
      ? supabase
          .from("qc_inspection_batches")
          .select("*")
          .ilike("nomor_mc", mc)
          .eq("potongan_ke", potNum)
          .order("pcs_index", { ascending: true })
      : Promise.resolve({ data: [] }),
    !isNaN(potNum)
      ? supabase
          .from("mending_batches")
          .select("*")
          .ilike("nomor_mc", mc)
          .eq("potongan_ke", potNum)
          .order("pcs_index", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  if (!res.success || !res.data || res.data.length === 0) return null;

  const exact = res.data.find(
    (b: any) =>
      String(b.nomor_mc || "").trim().toUpperCase() === mc &&
      String(b.potongan_ke) === potStr
  );
  const batch = exact || res.data[0];

  // Aggregate QC Inspection summary across PCS
  const qcRows: any[] = qcRes.data || [];
  let qcSummary: any = null;
  if (qcRows.length > 0) {
    const petugasAll: string[] = [];
    let totalBerat = 0;
    let totalCeklis = 0;
    let totalSilang = 0;
    const starts: string[] = [];
    const finishes: string[] = [];
    const dates: string[] = [];

    qcRows.forEach((q: any) => {
      if (q.petugas_inspeksi) petugasAll.push(q.petugas_inspeksi);
      if (q.petugas_inspeksi_2) petugasAll.push(q.petugas_inspeksi_2);
      if (q.petugas_inspeksi_3) petugasAll.push(q.petugas_inspeksi_3);
      if (Number(q.berat_kain) > 0) totalBerat += Number(q.berat_kain);
      if (Number(q.inspeksi_ceklis) > 0) totalCeklis += Number(q.inspeksi_ceklis);
      if (Number(q.inspeksi_silang) > 0) totalSilang += Number(q.inspeksi_silang);
      if (q.start_inspect) starts.push(String(q.start_inspect));
      if (q.finish_inspect) finishes.push(String(q.finish_inspect));
      if (q.tanggal_inspeksi) dates.push(String(q.tanggal_inspeksi));
    });

    starts.sort();
    finishes.sort();
    dates.sort();

    qcSummary = {
      tanggal_inspeksi: dates[dates.length - 1] || "",
      petugas: formatPetugasNames(petugasAll),
      start_inspect: starts[0] || "",
      finish_inspect: finishes[finishes.length - 1] || "",
      berat_kain: totalBerat > 0 ? Math.round(totalBerat * 100) / 100 : null,
      total_ceklis: totalCeklis,
      total_silang: totalSilang,
    };
  }

  // Aggregate Mending summary across PCS
  const mendingRows: any[] = mendingRes.data || [];
  let mendingSummary: any = null;
  if (mendingRows.length > 0) {
    const petugasAll: string[] = [];
    let totalPanel = 0;
    let gradeA = 0;
    let gradeB = 0;
    let gradeBS = 0;
    const starts: string[] = [];
    const finishes: string[] = [];
    const dates: string[] = [];

    mendingRows.forEach((m: any) => {
      if (m.petugas_mending) petugasAll.push(m.petugas_mending);
      if (Number(m.total_panel) > 0) totalPanel += Number(m.total_panel);
      if (Number(m.mending_grade_a) > 0) gradeA += Number(m.mending_grade_a);
      if (Number(m.mending_grade_b) > 0) gradeB += Number(m.mending_grade_b);
      if (Number(m.mending_grade_bs) > 0) gradeBS += Number(m.mending_grade_bs);
      if (m.start_mending) starts.push(String(m.start_mending));
      if (m.finish_mending) finishes.push(String(m.finish_mending));
      if (m.tanggal_mending) dates.push(String(m.tanggal_mending));
    });

    starts.sort();
    finishes.sort();
    dates.sort();

    mendingSummary = {
      tanggal_mending: dates[dates.length - 1] || "",
      petugas: formatPetugasNames(petugasAll),
      start_mending: starts[0] || "",
      finish_mending: finishes[finishes.length - 1] || "",
      total_panel: totalPanel > 0 ? totalPanel : null,
      grade_a: gradeA,
      grade_b: gradeB,
      grade_bs: gradeBS,
    };
  }

  return {
    ...batch,
    qc_summary: qcSummary,
    mending_summary: mendingSummary,
  };
}

/**
 * Generates LHP PDF for a batch and returns base64 + fileName for direct download.
 */
export async function downloadBatchPdfBase64(params: {
  nomorMc: string;
  potonganKe: number | string;
  designId?: string;
}): Promise<{
  success: boolean;
  pdfBase64?: string;
  fileName?: string;
  error?: string;
}> {
  try {
    const batch = await loadBatchForPdf(params);
    if (!batch) {
      return { success: false, error: "Data riwayat potongan tidak ditemukan." };
    }

    const generated = generateLhpPdfBase64(batch);
    return {
      success: true,
      pdfBase64: generated.pdfBase64,
      fileName: generated.fileName,
    };
  } catch (err: any) {
    console.error("[Drive PDF] Error downloadBatchPdfBase64:", err);
    return { success: false, error: err?.message || "Gagal membuat PDF laporan." };
  }
}

/**
 * Generates LHP PDF for a single batch (per potongan) and uploads it to Google Drive
 * via the configured Google Apps Script Web App (`drive_pdf_archive`).
 */
export async function archiveBatchPdfToDrive(params: {
  nomorMc: string;
  potonganKe: number | string;
  designId?: string;
}): Promise<{
  success: boolean;
  skipped?: boolean;
  fileUrl?: string;
  fileName?: string;
  folderPath?: string;
  error?: string;
}> {
  try {
    const mc = String(params.nomorMc || "").trim().toUpperCase();
    if (!mc || EXCLUDED_ARCHIVE_MACHINES.has(mc)) {
      return { success: false, skipped: true };
    }

    const endpoint = await getGoogleSheetEndpoint("drive_pdf_archive");
    if (!endpoint.url) {
      return {
        success: false,
        skipped: true,
        error:
          "URL Web App Arsip PDF Google Drive belum dikonfigurasi di menu Integrasi Google Sheets.",
      };
    }

    const batch = await loadBatchForPdf(params);
    if (!batch) {
      return { success: false, error: "Data riwayat potongan tidak ditemukan." };
    }

    const generated = generateLhpPdfBase64(batch);
    const folderPath = [generated.folderYear, generated.folderMonth, generated.folderMachine];

    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "follow",
      body: JSON.stringify({
        action: "upload_pdf",
        rootFolderId: endpoint.spreadsheetId || "",
        folderPath,
        fileName: generated.fileName,
        pdfBase64: generated.pdfBase64,
      }),
    });

    const rawText = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return {
        success: false,
        error: `Respon Google Drive Script bukan JSON (HTTP ${res.status}). Pastikan Web App sudah di-deploy ulang dengan akses "Anyone".`,
      };
    }

    if (parsed?.status === "success") {
      return {
        success: true,
        fileUrl: parsed.fileUrl || "",
        fileName: parsed.fileName || generated.fileName,
        folderPath: parsed.folderPath || folderPath.join(" / "),
      };
    }

    return {
      success: false,
      error: parsed?.message || "Gagal mengunggah PDF ke Google Drive.",
    };
  } catch (err: any) {
    console.error("[Drive PDF] Error archiveBatchPdfToDrive:", err);
    return { success: false, error: err?.message || "Gagal mengunggah PDF ke Google Drive." };
  }
}

/**
 * Non-blocking fire-and-forget trigger for automatic PDF archiving to Google Drive
 * after Potong Kain, QC Inspection, Mending, or Final Inspection.
 */
export async function triggerAutoArchivePdfToDrive(params: {
  nomorMc: string;
  potonganKe: number | string;
  designId?: string;
}): Promise<void> {
  const mc = String(params.nomorMc || "").trim().toUpperCase();
  const pot = params.potonganKe;
  if (!mc || !pot || Number(pot) <= 0 || EXCLUDED_ARCHIVE_MACHINES.has(mc)) return;

  setImmediate(() => {
    (async () => {
      try {
        const res = await archiveBatchPdfToDrive({
          nomorMc: mc,
          potonganKe: pot,
          designId: params.designId,
        });
        if (res.success) {
          console.log(`[Drive PDF] Auto-archive sukses: ${res.fileName} -> ${res.folderPath}`);
        } else if (!res.skipped) {
          console.warn(`[Drive PDF] Auto-archive gagal (${mc} Pot.${pot}):`, res.error);
        }
      } catch (err: any) {
        console.error(`[Drive PDF] Unhandled auto-archive error (${mc} Pot.${pot}):`, err?.message || err);
      }
    })();
  });
}
