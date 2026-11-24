"use client";

import React, { useState, useMemo, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Printer,
  X,
  QrCode,
  Layers,
  ExternalLink,
  Scissors,
  LayoutGrid,
} from "lucide-react";
import { PlanBarcodeData } from "./ProductionPlanBarcodeModal";

interface BatchA4BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: PlanBarcodeData[];
}

type GridPresetKey = "2x3" | "2x2" | "1x2";

interface GridPresetConfig {
  key: GridPresetKey;
  label: string;
  orientation: "portrait" | "landscape";
  perPage: number;
  cols: number;
  rows: number;
  sizeHint: string;
  previewQrSize: number;
}

const GRID_PRESETS: Record<GridPresetKey, GridPresetConfig> = {
  "2x3": {
    key: "2x3",
    label: "2×3 (6 / A4)",
    orientation: "portrait",
    perPage: 6,
    cols: 2,
    rows: 3,
    sizeHint: "~9,5 × 9,1 cm",
    previewQrSize: 88,
  },
  "2x2": {
    key: "2x2",
    label: "2×2 Lanskap (4 / A4)",
    orientation: "landscape",
    perPage: 4,
    cols: 2,
    rows: 2,
    sizeHint: "~14,0 × 9,7 cm",
    previewQrSize: 108,
  },
  "1x2": {
    key: "1x2",
    label: "1×2 (2 / A4)",
    orientation: "portrait",
    perPage: 2,
    cols: 1,
    rows: 2,
    sizeHint: "~19,4 × 13,8 cm",
    previewQrSize: 145,
  },
};

interface LabelItem {
  key: string;
  mcClean: string;
  potongan_ke: number;
  design_id: string;
  no_customer: string;
  mcPotText: string;
  pcsRollText: string;
  jumlahText: string;
  beratKainText: string;
  tanggalText: string;
  gradeText: string;
  trackPath: string;
  qrTrackingUrl: string;
}

const cleanVal = (val?: string | number | null): string => {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  return str === "" || str === "-" ? "" : str;
};

export default function BatchA4BarcodeModal({
  isOpen,
  onClose,
  plans,
}: BatchA4BarcodeModalProps) {
  const [gridPreset, setGridPreset] = useState<GridPresetKey>("2x2");
  const [expandAllPcs, setExpandAllPcs] = useState<boolean>(true);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  const preset = GRID_PRESETS[gridPreset];

  const publicBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const labelItems: LabelItem[] = useMemo(() => {
    const items: LabelItem[] = [];

    for (const plan of plans) {
      const mcClean = String(plan.nomor_mc || "").trim().toUpperCase();
      const isMeter =
        plan.input_type === "METER" ||
        (mcClean &&
          (mcClean.startsWith("R11") ||
            mcClean.startsWith("R12") ||
            mcClean.startsWith("R16") ||
            mcClean.startsWith("T")));

      const designText = cleanVal(plan.design_id);
      const noCustomerText = cleanVal(plan.no_customer);
      const jumlahRaw = cleanVal(plan.jumlah);
      const jumlahText = jumlahRaw
        ? /[a-zA-Z]/.test(jumlahRaw)
          ? jumlahRaw
          : `${jumlahRaw} ${isMeter ? "Meter" : "Panel"}`
        : "";
      const beratRaw = cleanVal(plan.berat_kain);
      const beratKainText =
        beratRaw && beratRaw !== "0"
          ? /kg/i.test(beratRaw)
            ? beratRaw
            : `${beratRaw} Kg`
          : "";
      const tanggalText = cleanVal(plan.tanggal);
      const gradeText = cleanVal(plan.grade);

      const totalPcs = Math.max(1, Number(plan.pcs_count) || 1);
      const countToGenerate = expandAllPcs && totalPcs > 1 ? totalPcs : 1;

      for (let i = 1; i <= countToGenerate; i++) {
        const hasMultiPcs = totalPcs > 1;
        const pcsRollText = hasMultiPcs
          ? expandAllPcs
            ? `PCS ${i} dari ${totalPcs}`
            : `${totalPcs} PCS`
          : `1 ${isMeter ? "Roll" : "PCS"}`;

        const trackPath = `/track/${encodeURIComponent(mcClean)}/${plan.potongan_ke}${
          hasMultiPcs && expandAllPcs ? `?pcs=${i}` : ""
        }`;

        items.push({
          key: `${mcClean}-${plan.potongan_ke}-pcs${i}-${items.length}`,
          mcClean,
          potongan_ke: plan.potongan_ke,
          design_id: designText,
          no_customer: noCustomerText,
          mcPotText: `MC ${mcClean} / Pot ${plan.potongan_ke}`,
          pcsRollText,
          jumlahText,
          beratKainText,
          tanggalText,
          gradeText,
          trackPath,
          qrTrackingUrl: `${publicBaseUrl}${trackPath}`,
        });
      }
    }

    return items;
  }, [plans, expandAllPcs, publicBaseUrl]);

  const pages: LabelItem[][] = useMemo(() => {
    const result: LabelItem[][] = [];
    for (let i = 0; i < labelItems.length; i += preset.perPage) {
      result.push(labelItems.slice(i, i + preset.perPage));
    }
    return result;
  }, [labelItems, preset.perPage]);

  const hasAnyMultiPcs = useMemo(
    () => plans.some((p) => Number(p.pcs_count || 1) > 1),
    [plans]
  );

  if (!isOpen || plans.length === 0) return null;

  const handlePrintA4 = () => {
    const container = previewContainerRef.current;
    if (!container) return;

    setIsPrinting(true);

    const svgMap = new Map<string, string>();
    const qrNodes = container.querySelectorAll<HTMLElement>("[data-qr-key]");
    qrNodes.forEach((el) => {
      const k = el.getAttribute("data-qr-key");
      const svg = el.querySelector("svg")?.outerHTML;
      if (k && svg) svgMap.set(k, svg);
    });

    let iframe = document.getElementById(
      "batch-a4-barcode-print-iframe"
    ) as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "batch-a4-barcode-print-iframe";
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

    const logoUrl = `${window.location.origin}/assets/dji-logo.png`;

    const pagesHtml = pages
      .map((pageItems, pageIdx) => {
        const cardsHtml = pageItems
          .map((item) => {
            const qrSvg = svgMap.get(item.key) || "";
            const pv = (v: string) => (v ? v : "&nbsp;");

            return `
              <div class="cell">
                <div class="card">
                  <div class="card-header">
                    <div class="brand">
                      <img src="${logoUrl}" alt="DJI" class="brand-logo" />
                    </div>
                    <div class="mc-badge">MC ${item.mcClean} • POT ${item.potongan_ke}</div>
                  </div>
                  <div class="card-body">
                    <div class="left-col">
                      <div class="qr-box">
                        ${qrSvg}
                      </div>
                      <div class="grade-box">
                        <div class="grade-lbl">GRADE</div>
                        <div class="grade-val">${pv(item.gradeText)}</div>
                      </div>
                    </div>
                    <div class="info-col">
                      <div class="row"><span class="lbl">Desain:</span><span class="val">${pv(item.design_id)}</span></div>
                      <div class="row"><span class="lbl">No Customer:</span><span class="val">${pv(item.no_customer)}</span></div>
                      <div class="row"><span class="lbl">Mesin / Potongan:</span><span class="val">${item.mcPotText}</span></div>
                      <div class="row"><span class="lbl">PCS / Roll:</span><span class="val">${item.pcsRollText}</span></div>
                      <div class="row"><span class="lbl">Jumlah:</span><span class="val">${pv(item.jumlahText)}</span></div>
                      <div class="row"><span class="lbl">Berat Kain:</span><span class="val">${pv(item.beratKainText)}</span></div>
                      <div class="row"><span class="lbl">Tanggal:</span><span class="val">${pv(item.tanggalText)}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            `;
          })
          .join("");

        return `
          <div class="a4-page preset-${gridPreset} ${pageIdx < pages.length - 1 ? "page-break" : ""}">
            ${cardsHtml}
          </div>
        `;
      })
      .join("");

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak QR Potongan A4 — ${preset.label} (${labelItems.length} Label)</title>
          <style>
            @page {
              size: A4 ${preset.orientation};
              margin: 8mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background: #ffffff;
              color: #000000;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .a4-page {
              width: ${preset.orientation === "landscape" ? "280mm" : "194mm"};
              height: ${preset.orientation === "landscape" ? "193mm" : "280mm"};
              display: grid;
              gap: 0;
            }
            .preset-2x3 {
              grid-template-columns: repeat(2, 1fr);
              grid-template-rows: repeat(3, 1fr);
            }
            .preset-2x2 {
              grid-template-columns: repeat(2, 1fr);
              grid-template-rows: repeat(2, 1fr);
            }
            .preset-1x2 {
              grid-template-columns: 1fr;
              grid-template-rows: repeat(2, 1fr);
            }
            .page-break {
              page-break-after: always;
              break-after: page;
            }
            .cell {
              border: 0.75pt dashed #94a3b8;
              padding: 3.5mm;
              display: flex;
              align-items: stretch;
              justify-content: stretch;
              overflow: hidden;
            }
            .card {
              width: 100%;
              height: 100%;
              border: 1.8pt solid #0f172a;
              border-radius: 4mm;
              padding: 3.5mm 4mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              background: #ffffff;
            }
            .card-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 1.2pt solid #0f172a;
              padding-bottom: 2mm;
            }
            .brand {
              display: flex;
              align-items: center;
            }
            .brand-logo {
              height: 7mm;
              width: auto;
              object-fit: contain;
              display: block;
            }
            .mc-badge {
              font-size: 10.5pt;
              font-weight: 900;
              color: #000000;
              border: 1.2pt solid #0f172a;
              border-radius: 2mm;
              padding: 0.8mm 2.5mm;
              letter-spacing: 0.3px;
            }
            .card-body {
              flex: 1;
              display: flex;
              align-items: center;
              gap: 2.5mm;
              padding: 1.5mm 0;
            }
            .left-col {
              flex-shrink: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 2mm;
            }
            .qr-box {
              flex-shrink: 0;
              width: 31mm;
              height: 31mm;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 1mm;
              border: 0.75pt solid #e2e8f0;
              border-radius: 2mm;
            }
            .qr-box svg {
              width: 28mm;
              height: 28mm;
              display: block;
            }
            .grade-box {
              width: 31mm;
              border: 1.6pt solid #0f172a;
              border-radius: 2mm;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              background: #ffffff;
            }
            .grade-lbl {
              background: #0f172a;
              color: #ffffff;
              text-align: center;
              font-size: 7pt;
              font-weight: 900;
              letter-spacing: 0.8px;
              padding: 0.7mm 1mm;
              line-height: 1.1;
            }
            .grade-val {
              height: 10.5mm;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16pt;
              font-weight: 900;
              color: #000000;
            }
            .info-col {
              flex: 1;
              min-width: 0;
              display: flex;
              flex-direction: column;
              gap: 1.1mm;
            }
            .row {
              display: flex;
              flex-direction: row;
              justify-content: space-between;
              align-items: baseline;
              gap: 1.5mm;
              line-height: 1.2;
              border-bottom: 0.5pt dotted #cbd5e1;
              padding-bottom: 0.8mm;
            }
            .lbl {
              font-size: 6.8pt;
              font-weight: 700;
              color: #475569;
              white-space: nowrap;
            }
            .val {
              font-size: 7.4pt;
              font-weight: 800;
              color: #000000;
              text-align: right;
              word-break: break-word;
            }
            .card-footer {
              border-top: 0.75pt dashed #94a3b8;
              padding-top: 1.8mm;
              text-align: center;
              font-size: 7.5pt;
              font-weight: 700;
              color: #334155;
            }

            /* ── Preset 2x2 Lanskap (4 label / A4 Landscape — ~14,0 × 9,7 cm) ── */
            .preset-2x2 .cell {
              padding: 4mm;
            }
            .preset-2x2 .card {
              padding: 4.5mm 5.5mm;
              border-width: 2pt;
            }
            .preset-2x2 .card-header {
              padding-bottom: 2.2mm;
              border-bottom-width: 1.4pt;
            }
            .preset-2x2 .brand-logo {
              height: 9mm;
            }
            .preset-2x2 .mc-badge {
              font-size: 12.5pt;
              padding: 1mm 3.5mm;
              border-width: 1.4pt;
            }
            .preset-2x2 .card-body {
              flex-direction: row;
              align-items: center;
              gap: 5.5mm;
              padding: 2.5mm 0;
            }
            .preset-2x2 .left-col {
              gap: 2.5mm;
            }
            .preset-2x2 .qr-box {
              width: 44mm;
              height: 44mm;
              padding: 1.5mm;
            }
            .preset-2x2 .qr-box svg {
              width: 40mm;
              height: 40mm;
            }
            .preset-2x2 .grade-box {
              width: 44mm;
              border-width: 1.8pt;
            }
            .preset-2x2 .grade-lbl {
              font-size: 8.5pt;
              padding: 1mm 1.5mm;
            }
            .preset-2x2 .grade-val {
              height: 12.5mm;
              font-size: 20pt;
            }
            .preset-2x2 .info-col {
              gap: 1.6mm;
            }
            .preset-2x2 .row {
              flex-direction: row;
              justify-content: space-between;
              align-items: baseline;
              border-bottom: 0.6pt dotted #cbd5e1;
              padding-bottom: 1mm;
            }
            .preset-2x2 .lbl {
              font-size: 8.5pt;
            }
            .preset-2x2 .val {
              font-size: 9.5pt;
              text-align: right;
            }
            .preset-2x2 .card-footer {
              font-size: 8.5pt;
              padding-top: 2mm;
            }

            /* ── Preset 1x2 (2 label / A4 — Setengah A4 Ekstra Besar) ── */
            .preset-1x2 .cell {
              padding: 5mm;
            }
            .preset-1x2 .card {
              padding: 6mm 8mm;
              border-width: 2.2pt;
            }
            .preset-1x2 .card-header {
              padding-bottom: 3mm;
              border-bottom-width: 1.6pt;
            }
            .preset-1x2 .brand-logo {
              height: 12mm;
            }
            .preset-1x2 .mc-badge {
              font-size: 15pt;
              padding: 1.5mm 4.5mm;
              border-width: 1.6pt;
            }
            .preset-1x2 .card-body {
              gap: 8mm;
              padding: 4mm 0;
            }
            .preset-1x2 .left-col {
              gap: 3.5mm;
            }
            .preset-1x2 .qr-box {
              width: 62mm;
              height: 62mm;
              padding: 2mm;
            }
            .preset-1x2 .qr-box svg {
              width: 57mm;
              height: 57mm;
            }
            .preset-1x2 .grade-box {
              width: 62mm;
              border-width: 2.2pt;
              border-radius: 3mm;
            }
            .preset-1x2 .grade-lbl {
              font-size: 10.5pt;
              letter-spacing: 1.2px;
              padding: 1.3mm 2mm;
            }
            .preset-1x2 .grade-val {
              height: 17mm;
              font-size: 26pt;
            }
            .preset-1x2 .info-col {
              gap: 2.2mm;
            }
            .preset-1x2 .row {
              flex-direction: row;
              justify-content: space-between;
              align-items: baseline;
              border-bottom: 0.75pt dotted #cbd5e1;
              padding-bottom: 1.4mm;
            }
            .preset-1x2 .lbl {
              font-size: 10.5pt;
            }
            .preset-1x2 .val {
              font-size: 11.5pt;
              text-align: right;
            }
            .preset-1x2 .card-footer {
              font-size: 10pt;
              padding-top: 2.5mm;
            }
          </style>
        </head>
        <body>
          ${pagesHtml}
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200/80 flex items-center justify-center text-[#0070bc] shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                <span>Cetak QR Kertas A4</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-sky-100 text-[#0070bc] font-bold">
                  {labelItems.length} Label • {pages.length} Lembar A4
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                Mode {preset.label} ({preset.sizeHint}) • Hemat tinta hitam-putih • Garis potong lurus
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options Bar: Grid Selector + Multi-PCS Toggle */}
        <div className="px-4 sm:px-5 py-2.5 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          {/* Grid Preset Switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              <LayoutGrid className="w-3.5 h-3.5 text-[#0070bc]" />
              Tata Letak A4:
            </span>
            <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 gap-1">
              {(["2x3", "2x2", "1x2"] as GridPresetKey[]).map((key) => {
                const cfg = GRID_PRESETS[key];
                const isActive = gridPreset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setGridPreset(key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#0070bc] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {hasAnyMultiPcs ? (
              <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-sky-50/70 border border-sky-200/70 px-3 py-1.5 rounded-xl">
                <input
                  type="checkbox"
                  checked={expandAllPcs}
                  onChange={(e) => setExpandAllPcs(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#0070bc] cursor-pointer"
                />
                <Layers className="w-3.5 h-3.5 text-[#0070bc]" />
                <span className="text-[11px] font-bold text-slate-700">
                  Cetak semua PCS (1, 2, dst)
                </span>
              </label>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
                <Scissors className="w-3.5 h-3.5 text-slate-400" />
                Garis putus-putus siap gunting
              </span>
            )}
          </div>
        </div>

        {/* A4 Visual Preview Area */}
        <div
          ref={previewContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/80 space-y-6"
        >
          {pages.map((pageItems, pageIdx) => (
            <div key={pageIdx} className="space-y-2">
              <div
                className={`flex items-center justify-between mx-auto px-1 ${
                  preset.orientation === "landscape" ? "max-w-[780px]" : "max-w-[680px]"
                }`}
              >
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Lembar A4 {preset.orientation === "landscape" ? "Lanskap" : "Potret"} #{pageIdx + 1} dari {pages.length}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {pageItems.length} / {preset.perPage} slot terisi ({preset.sizeHint})
                </span>
              </div>

              {/* Simulated A4 Sheet */}
              <div
                className={`mx-auto bg-white shadow-md border border-slate-300 rounded-xl p-3 sm:p-4 ${
                  preset.orientation === "landscape" ? "max-w-[780px]" : "max-w-[680px]"
                }`}
              >
                <div
                  className={`grid gap-0 ${
                    gridPreset === "1x2"
                      ? "grid-cols-1"
                      : "grid-cols-1 sm:grid-cols-2"
                  }`}
                >
                  {pageItems.map((item) => (
                    <div
                      key={item.key}
                      className="border border-dashed border-slate-300 p-2 sm:p-2.5 flex"
                    >
                      <div
                        className={`w-full border-2 border-slate-900 rounded-xl flex flex-col justify-between bg-white ${
                          gridPreset === "1x2"
                            ? "p-4 sm:p-5 gap-3"
                            : gridPreset === "2x2"
                            ? "p-3 sm:p-3.5 gap-2.5"
                            : "p-2.5 gap-2"
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1.5 gap-2">
                          <img
                            src="/assets/dji-logo.png"
                            alt="Logo DJI"
                            className={`object-contain w-auto shrink-0 ${
                              gridPreset === "1x2"
                                ? "h-9"
                                : gridPreset === "2x2"
                                ? "h-7"
                                : "h-6"
                            }`}
                          />
                          <span
                            className={`font-black text-slate-900 border border-slate-900 rounded-md px-2 py-0.5 ${
                              gridPreset === "1x2"
                                ? "text-sm px-3"
                                : gridPreset === "2x2"
                                ? "text-xs"
                                : "text-[11px]"
                            }`}
                          >
                            MC {item.mcClean} • POT {item.potongan_ke}
                          </span>
                        </div>

                        {/* Card Body */}
                        <div
                          className={`flex items-center py-1 flex-row ${
                            gridPreset === "1x2"
                              ? "gap-5"
                              : gridPreset === "2x2"
                              ? "gap-3.5"
                              : "gap-3"
                          }`}
                        >
                          <div className="shrink-0 flex flex-col items-center gap-1.5">
                            <div
                              data-qr-key={item.key}
                              className="p-1.5 border border-slate-200 rounded-lg bg-white"
                            >
                              <QRCodeSVG
                                value={item.qrTrackingUrl}
                                size={preset.previewQrSize}
                                level="M"
                                includeMargin={false}
                              />
                            </div>
                            <div
                              className={`w-full border-2 border-slate-900 rounded-lg overflow-hidden flex flex-col bg-white ${
                                gridPreset === "1x2"
                                  ? "rounded-xl"
                                  : "rounded-lg"
                              }`}
                            >
                              <div
                                className={`bg-slate-900 text-white text-center font-black uppercase tracking-widest leading-none ${
                                  gridPreset === "1x2"
                                    ? "text-[11px] py-1.5"
                                    : gridPreset === "2x2"
                                    ? "text-[9.5px] py-1"
                                    : "text-[8px] py-0.5"
                                }`}
                              >
                                GRADE
                              </div>
                              <div
                                className={`flex items-center justify-center font-black text-slate-900 ${
                                  gridPreset === "1x2"
                                    ? "h-12 text-3xl"
                                    : gridPreset === "2x2"
                                    ? "h-9 text-2xl"
                                    : "h-8 text-lg"
                                }`}
                              >
                                {item.gradeText || "\u00A0"}
                              </div>
                            </div>
                          </div>

                          <div
                            className={`flex-1 min-w-0 w-full ${
                              gridPreset === "1x2"
                                ? "space-y-1.5 text-xs sm:text-sm"
                                : gridPreset === "2x2"
                                ? "space-y-1 text-[10.5px]"
                                : "space-y-0.5 text-[9.5px]"
                            }`}
                          >
                            {[
                              { label: "Desain:", val: item.design_id },
                              { label: "No Customer:", val: item.no_customer },
                              { label: "Mesin / Potongan:", val: item.mcPotText },
                              { label: "PCS / Roll:", val: item.pcsRollText },
                              { label: "Jumlah:", val: item.jumlahText },
                              { label: "Berat Kain:", val: item.beratKainText },
                              { label: "Tanggal:", val: item.tanggalText },
                            ].map((row) => (
                              <div
                                key={row.label}
                                className={`flex items-baseline justify-between gap-1.5 border-b border-dotted border-slate-200 ${
                                  gridPreset === "2x3" ? "pb-0.5" : "pb-1"
                                }`}
                              >
                                <span
                                  className={`font-bold text-slate-500 shrink-0 ${
                                    gridPreset === "2x3"
                                      ? "text-[8.5px]"
                                      : gridPreset === "2x2"
                                      ? "text-[9.5px]"
                                      : "text-[11px]"
                                  }`}
                                >
                                  {row.label}
                                </span>
                                <span className="font-extrabold text-slate-900 text-right truncate">
                                  {row.val || "\u00A0"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Card Footer (Preview link only) */}
                        <div className="border-t border-dashed border-slate-300 pt-1.5 flex items-center justify-end gap-1">
                          <a
                            href={item.trackPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-[#0070bc] hover:underline"
                            title="Preview Halaman Scan"
                          >
                            <span>Preview</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-5 py-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={handlePrintA4}
            disabled={isPrinting}
            className="px-5 py-2.5 text-xs font-black text-white bg-[#0070bc] hover:bg-[#005a96] rounded-xl transition-all shadow-sm shadow-blue-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>
              {isPrinting
                ? "Menyiapkan A4..."
                : `Cetak ${pages.length} Lembar A4 (${preset.label})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
