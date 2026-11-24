"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import {
  Printer,
  Download,
  X,
  QrCode,
  Check,
  Copy,
  ExternalLink,
  Layers,
} from "lucide-react";

export interface PlanBarcodeData {
  id?: string;
  nomor_mc: string;
  potongan_ke: number;
  design_id?: string;
  no_customer?: string;
  no_order_barang?: string;
  pcs_count?: number;
  target_meter?: number;
  target_panel?: number;
  max_panel?: number;
  input_type?: "PANEL" | "METER";
  jumlah?: string | number | null;
  berat_kain?: string | number | null;
  tanggal?: string | null;
  grade?: string | null;
  created_at?: string;
}

const cleanBarcodeValue = (val?: string | number | null): string => {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  return str === "" || str === "-" ? "" : str;
};

interface ProductionPlanBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanBarcodeData | null;
}

export default function ProductionPlanBarcodeModal({
  isOpen,
  onClose,
  plan,
}: ProductionPlanBarcodeModalProps) {
  const [pcsIndexInput, setPcsIndexInput] = useState<string>("1");
  const [isCopied, setIsCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (plan) {
      setPcsIndexInput("1");
    }
  }, [plan]);

  if (!isOpen || !plan) return null;

  const mcClean = String(plan.nomor_mc || "").trim().toUpperCase();
  const isMeter =
    plan.input_type === "METER" ||
    (mcClean &&
      (mcClean.startsWith("R11") ||
        mcClean.startsWith("R12") ||
        mcClean.startsWith("R16") ||
        mcClean.startsWith("T")));

  const designText = cleanBarcodeValue(plan.design_id);
  const noCustomerText = cleanBarcodeValue(plan.no_customer);
  const jumlahRaw = cleanBarcodeValue(plan.jumlah);
  const jumlahText = jumlahRaw
    ? /[a-zA-Z]/.test(jumlahRaw)
      ? jumlahRaw
      : `${jumlahRaw} ${isMeter ? "Meter" : "Panel"}`
    : "";
  const beratRaw = cleanBarcodeValue(plan.berat_kain);
  const beratKainText =
    beratRaw && beratRaw !== "0"
      ? /kg/i.test(beratRaw)
        ? beratRaw
        : `${beratRaw} Kg`
      : "";
  const tanggalText = cleanBarcodeValue(plan.tanggal);
  const gradeText = cleanBarcodeValue(plan.grade);

  const hasMultiPcs = Boolean(plan.pcs_count && plan.pcs_count > 1);
  const pcsRollText = hasMultiPcs
    ? `PCS ${pcsIndexInput} dari ${plan.pcs_count}`
    : `1 ${isMeter ? "Roll" : "PCS"}`;

  // Dynamic QR Tracking URL (otomatis mengikuti domain aktif atau NEXT_PUBLIC_APP_URL)
  const trackPath = `/track/${encodeURIComponent(mcClean)}/${plan.potongan_ke}${
    hasMultiPcs ? `?pcs=${pcsIndexInput}` : ""
  }`;
  const publicBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const qrTrackingUrl = `${publicBaseUrl}${trackPath}`;

  const handlePrint = () => {
    const node = document.getElementById("plan-barcode-print-area");
    if (!node) return;

    setIsPrinting(true);

    let iframe = document.getElementById("plan-barcode-print-iframe") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "plan-barcode-print-iframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      setIsPrinting(false);
      return;
    }

    const qrSvg = node.querySelector("svg")?.outerHTML || "";

    const renderPrintVal = (val: string) =>
      val ? val : "&nbsp;";

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Label Tracking - MC ${mcClean} / POT ${plan.potongan_ke}</title>
          <style>
            @page {
              size: auto;
              margin: 4mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background-color: #ffffff;
              display: flex;
              justify-content: center;
              align-items: flex-start;
              padding: 8px;
              color: #0f172a;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .label-card {
              width: 320px;
              border: 3.5px solid #0f172a;
              border-radius: 20px;
              padding: 16px 14px;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 10px;
              background: #ffffff;
            }
            .header-box {
              text-align: center;
              width: 100%;
            }
            .company-logo {
              height: 30px;
              width: auto;
              object-fit: contain;
              display: block;
              margin: 0 auto 4px;
            }
            .badge-potongan {
              display: inline-block;
              margin-top: 3px;
              padding: 2px 12px;
              border-radius: 9999px;
              background-color: #0070bc;
              color: #ffffff;
              font-size: 10.5px;
              font-weight: 900;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            .qr-wrapper {
              background: #ffffff;
              padding: 6px;
              border-radius: 12px;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 6px;
            }
            .qr-wrapper svg {
              width: 155px;
              height: 155px;
              display: block;
            }
            .qr-code-id {
              font-size: 13px;
              font-weight: 900;
              letter-spacing: 0.6px;
              color: #0f172a;
              background: #f1f5f9;
              padding: 2px 10px;
              border-radius: 8px;
            }
            .info-table {
              width: 100%;
              border-top: 2px dashed #cbd5e1;
              padding-top: 10px;
              display: flex;
              flex-direction: column;
              gap: 6px;
              font-size: 11.5px;
              font-weight: 600;
              color: #334155;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              line-height: 1.35;
              min-height: 17px;
            }
            .info-label {
              color: #475569;
              font-weight: 700;
            }
            .info-val {
              color: #0f172a;
              font-weight: 800;
              text-align: right;
              min-width: 80px;
            }
            .grade-box {
              width: 100%;
              margin-top: 6px;
              border: 2.5px solid #0f172a;
              border-radius: 12px;
              overflow: hidden;
              display: flex;
              align-items: stretch;
              min-height: 46px;
              background: #ffffff;
            }
            .grade-label {
              background: #0f172a;
              color: #ffffff;
              padding: 8px 14px;
              font-size: 13px;
              font-weight: 900;
              letter-spacing: 1px;
              display: flex;
              align-items: center;
              justify-content: center;
              text-transform: uppercase;
              flex-shrink: 0;
            }
            .grade-val {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 24px;
              font-weight: 900;
              color: #0f172a;
              letter-spacing: 1px;
              padding: 4px 12px;
            }
            .footer-note {
              width: 100%;
              border-top: 1px solid #e2e8f0;
              padding-top: 8px;
              margin-top: 2px;
              text-align: center;
              font-size: 9.5px;
              font-weight: 700;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div class="header-box">
              <img src="${window.location.origin}/assets/dji-logo.png" alt="Logo DJI" class="company-logo" />
              <div class="badge-potongan">TRACKING POTONGAN KAIN</div>
            </div>
            <div class="qr-wrapper">
              ${qrSvg}
              <div class="qr-code-id">MC ${mcClean} • POT ${plan.potongan_ke}</div>
            </div>
            <div class="info-table">
              <div class="info-row">
                <span class="info-label">Desain:</span>
                <span class="info-val">${renderPrintVal(designText)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">No Customer:</span>
                <span class="info-val">${renderPrintVal(noCustomerText)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Mesin / Potongan:</span>
                <span class="info-val">MC ${mcClean} / Pot ${plan.potongan_ke}</span>
              </div>
              <div class="info-row">
                <span class="info-label">PCS / Roll:</span>
                <span class="info-val">${pcsRollText}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Jumlah:</span>
                <span class="info-val">${renderPrintVal(jumlahText)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Berat Kain:</span>
                <span class="info-val">${renderPrintVal(beratKainText)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Tanggal:</span>
                <span class="info-val">${renderPrintVal(tanggalText)}</span>
              </div>
            </div>
            <div class="grade-box">
              <div class="grade-label">GRADE</div>
              <div class="grade-val">${renderPrintVal(gradeText)}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    const triggerPrint = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setIsPrinting(false);
    };

    const imgs = Array.from(doc.querySelectorAll("img"));
    if (imgs.length === 0 || imgs.every((img) => img.complete)) {
      setTimeout(triggerPrint, 250);
    } else {
      let printed = false;
      const runOnce = () => {
        if (printed) return;
        printed = true;
        setTimeout(triggerPrint, 150);
      };
      Promise.all(
        imgs.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) return resolve();
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
        )
      ).then(runOnce);
      setTimeout(runOnce, 2000);
    }
  };

  const handleDownloadPng = async () => {
    const node = document.getElementById("plan-barcode-print-area");
    if (!node) return;

    setIsDownloading(true);
    try {
      const dataUrl = await toPng(node, {
        quality: 1,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `QR_Tracking_MC${mcClean}_POT${plan.potongan_ke}${
        hasMultiPcs ? `_PCS${pcsIndexInput}` : ""
      }.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Gagal mendownload barcode:", err);
      alert("Gagal mengunduh gambar barcode.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(qrTrackingUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200/80 flex items-center justify-center text-[#0070bc] shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                QR Tracking Potongan
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-[#0070bc] font-bold">
                  MC {mcClean} / Pot {plan.potongan_ke}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                QR Dinamis yang otomatis update data live dari Rencana hingga Mending
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left: Info & Actions */}
            <div className="space-y-4">
              {/* Dynamic QR Explanation Box */}
              <div className="p-4 bg-sky-50/70 border border-sky-100 rounded-2xl space-y-2">
                <div className="text-xs font-black text-[#0070bc] flex items-center gap-1.5">
                  <QrCode className="w-4 h-4" />
                  QR Dinamis (Live Tracking)
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Kolom yang datanya belum tersedia saat jadwal produksi (seperti{" "}
                  <strong>No Customer</strong>, <strong>Jumlah</strong>, <strong>Berat Kain</strong>,
                  atau <strong>Tanggal</strong>) sengaja dikosongkan agar bisa diisi manual dengan
                  pulpen. Saat QR di-scan, halaman tracking tetap menampilkan data aktual terbaru.
                </p>
              </div>

              {/* PCS Selector jika mesin multi-PCS */}
              {hasMultiPcs && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#0070bc]" />
                    Pilihan PCS Label
                  </label>
                  <select
                    value={pcsIndexInput}
                    onChange={(e) => setPcsIndexInput(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {Array.from({ length: plan.pcs_count || 1 }).map((_, i) => (
                      <option key={i + 1} value={String(i + 1)}>
                        PCS {i + 1} (dari {plan.pcs_count} PCS)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Link Tracking Box */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
                <div className="text-[11px] font-bold text-slate-500">Link Tujuan QR Code:</div>
                <div className="text-[11px] font-mono font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 break-all">
                  {qrTrackingUrl}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <a
                    href={trackPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-3 bg-white border border-sky-200 text-[#0070bc] hover:bg-sky-50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Preview Scan</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="py-2 px-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Pratinjau Label Fisik */}
            <div className="flex flex-col items-center justify-center bg-slate-100/60 p-4 rounded-2xl border border-slate-200/60">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                Pratinjau Label Fisik
              </span>

              {/* Area Cetak yang akan dikonversi ke Print / PNG */}
              <div
                id="plan-barcode-print-area"
                className="w-[280px] bg-white border-[3px] border-slate-900 rounded-2xl p-4 flex flex-col items-center gap-2.5 shadow-md"
              >
                <div className="text-center w-full flex flex-col items-center">
                  <img
                    src="/assets/dji-logo.png"
                    alt="Logo DJI"
                    className="h-8 w-auto object-contain mb-1"
                  />
                  <div className="inline-block px-2.5 py-0.5 rounded-full bg-[#0070bc] text-white text-[10px] font-black tracking-wider uppercase">
                    TRACKING POTONGAN KAIN
                  </div>
                </div>

                {/* Dynamic QR Code */}
                <div className="p-2 bg-white rounded-xl flex flex-col items-center justify-center gap-1.5">
                  <QRCodeSVG
                    value={qrTrackingUrl}
                    size={145}
                    level="M"
                    includeMargin={false}
                  />
                  <span className="text-xs font-black tracking-wide text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md">
                    MC {mcClean} • POT {plan.potongan_ke}
                  </span>
                </div>

                {/* 7 Standardized Label Rows (empty fields left blank for manual write-in) */}
                <div className="w-full border-t-2 border-dashed border-slate-300 pt-2.5 flex flex-col gap-1.5 text-[11px]">
                  <div className="flex justify-between items-center gap-2 min-h-[16px]">
                    <span className="font-bold text-slate-600">Desain:</span>
                    <span className="font-extrabold text-slate-900 text-right truncate max-w-[165px]">
                      {designText || "\u00A0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2 min-h-[16px]">
                    <span className="font-bold text-slate-600">No Customer:</span>
                    <span className="font-extrabold text-slate-900 text-right truncate max-w-[165px]">
                      {noCustomerText || "\u00A0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2 min-h-[16px]">
                    <span className="font-bold text-slate-600">Mesin / Potongan:</span>
                    <span className="font-extrabold text-slate-900 text-right">
                      MC {mcClean} / Pot {plan.potongan_ke}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2 min-h-[16px]">
                    <span className="font-bold text-slate-600">PCS / Roll:</span>
                    <span className="font-extrabold text-slate-900 text-right">
                      {pcsRollText}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2 min-h-[16px]">
                    <span className="font-bold text-slate-600">Jumlah:</span>
                    <span className="font-extrabold text-slate-900 text-right">
                      {jumlahText || "\u00A0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2 min-h-[16px]">
                    <span className="font-bold text-slate-600">Berat Kain:</span>
                    <span className="font-extrabold text-slate-900 text-right">
                      {beratKainText || "\u00A0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2 min-h-[16px]">
                    <span className="font-bold text-slate-600">Tanggal:</span>
                    <span className="font-extrabold text-slate-900 text-right">
                      {tanggalText || "\u00A0"}
                    </span>
                  </div>
                </div>

                {/* Highlighted Grade Write-In Box */}
                <div className="w-full mt-1 border-[2.5px] border-slate-900 rounded-xl overflow-hidden flex items-stretch min-h-[44px] bg-white">
                  <div className="bg-slate-900 text-white px-3.5 py-2 text-xs font-black tracking-widest uppercase flex items-center justify-center shrink-0">
                    GRADE
                  </div>
                  <div className="flex-1 flex items-center justify-center text-2xl font-black text-slate-900 tracking-wider px-3">
                    {gradeText || "\u00A0"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={isDownloading}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? "Mengunduh..." : "Download PNG"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-4 py-2 text-xs font-black text-white bg-[#0070bc] hover:bg-[#005a96] rounded-xl transition-all shadow-sm shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? "Mencetak..." : "Cetak Label QR"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
