"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getBatchesForBarcode } from "@/actions/barcode-actions";
import { getMachineConfigs } from "@/actions/machine-config-actions";
import { REGISTERED_MACHINES } from "@/lib/constants";
import {
  Search,
  Loader2,
  QrCode,
  Filter,
  RefreshCw,
  Hash,
  FileText,
  CheckCircle,
  Package,
  AlertTriangle,
  X,
  Download,
  HelpCircle,
  Scissors,
  Award,
  Calendar,
  Layers,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import ProductTour, { ProductTourStep } from "@/components/ProductTour";

const MENDING_BARCODE_TOUR_STEPS: ProductTourStep[] = [
  {
    target: "mending-barcode-header",
    title: "Cetak Barcode Mending",
    description:
      "Halaman ini digunakan untuk mencetak barcode / QR Code hasil akhir pengerjaan mending dengan Grade Keseluruhan otomatis.",
  },
  {
    target: "mending-barcode-filter",
    title: "Filter Batch",
    description:
      "Saring batch berdasarkan nomor mesin, design, atau potongan untuk menemukan batch kain yang diinginkan.",
  },
  {
    target: "mending-barcode-results",
    title: "Daftar Batch Mending",
    description:
      "Lihat daftar batch mending beserta Grade Keseluruhan otomatis. Klik Cetak Barcode untuk membuka jendela pratinjau.",
  },
];

function BarcodeContent() {
  const searchParams = useSearchParams();
  const initialMc = searchParams.get("mc") || "";
  const initialPot = searchParams.get("potongan") || "";
  const initialDesign = searchParams.get("design") || "";

  const [filters, setFilters] = useState<{
    nomor_mc: string;
    design_id: string;
    potongan_ke: string;
  }>({
    nomor_mc: initialMc,
    design_id: initialDesign,
    potongan_ke: initialPot,
  });

  const [allData, setAllData] = useState<any[]>([]);
  const [registeredMachines, setRegisteredMachines] = useState<string[]>(REGISTERED_MACHINES);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Print Modal State
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gradeInput, setGradeInput] = useState<string>("A");
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Auto-load all mended batches and registered machines on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [res, cfgRes] = await Promise.all([
          getBatchesForBarcode({}),
          getMachineConfigs(),
        ]);

        if (res.success && res.data) {
          setAllData(res.data);
        } else {
          setErrorMsg(res.error || "Gagal mengambil data batch mending.");
        }

        if (cfgRes.success && cfgRes.data && cfgRes.data.length > 0) {
          const cfgMcList = cfgRes.data.map((c: any) => c.nomor_mc?.trim().toUpperCase()).filter(Boolean);
          const combined = Array.from(new Set([...REGISTERED_MACHINES, ...cfgMcList]));
          setRegisteredMachines(combined);
        }
      } catch (err: any) {
        setErrorMsg("Terjadi kesalahan jaringan saat memuat data.");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const uniqueDesign = Array.from(
    new Set(allData.map((d) => d.design_id).filter(Boolean))
  ).sort();

  // Client-side filtering
  const filteredData = allData.filter((batch) => {
    if (filters.nomor_mc && batch.nomor_mc !== filters.nomor_mc) return false;
    if (filters.design_id && batch.design_id !== filters.design_id) return false;
    if (filters.potongan_ke.trim()) {
      const pSearch = filters.potongan_ke.trim().toLowerCase();
      const pBatch = String(batch.potongan_ke || "").toLowerCase();
      if (pBatch !== pSearch && !pBatch.includes(pSearch)) return false;
    }
    return true;
  });

  const handleOpenPrint = (batch: any) => {
    setSelectedBatch(batch);
    // Automatically pre-fill grade input with overall_grade from mending
    setGradeInput(batch.overall_grade || "A");
    setIsModalOpen(true);
  };

  const getQRDataString = (batch: any, grade: string) => {
    const obj = {
      kode_design: batch.design_id || "-",
      nomor_mesin: batch.nomor_mc || "-",
      potongan_ke: batch.potongan_ke || "-",
      berat_kain: batch.berat_kain ? `${batch.berat_kain} kg` : "0 kg",
      jumlah_panel: batch.jumlah_panel || 1,
      pcs_ke: batch.pcs_index || "-",
      no_order: batch.no_order_barang || "-",
      grade: grade,
      no_customer: batch.no_customer || "-",
      tanggal: batch.tgl || "-",
    };
    return JSON.stringify(obj, null, 2);
  };

  const handlePrint = () => {
    const node = document.getElementById("print-area");
    if (!node) return;

    let iframe = document.getElementById("barcode-print-iframe") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "barcode-print-iframe";
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
      return;
    }

    const qrSvg = node.querySelector("svg")?.outerHTML || "";
    const beratKainText = (selectedBatch?.berat_kain && selectedBatch.berat_kain > 0)
      ? `${selectedBatch.berat_kain} Kg`
      : "-";
    const jumlahText = selectedBatch?.is_meteran
      ? `${selectedBatch?.jumlah_panel} Meter`
      : `${selectedBatch?.jumlah_panel} Panel`;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Label Barcode - MC ${selectedBatch?.nomor_mc || "-"} / POT ${selectedBatch?.potongan_ke || "-"}</title>
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
              padding: 18px 16px;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 12px;
              background: #ffffff;
            }
            .title {
              font-size: 22px;
              font-weight: 900;
              text-align: center;
              letter-spacing: -0.5px;
              color: #0f172a;
            }
            .grade-badge {
              display: inline-block;
              margin-top: 4px;
              padding: 3px 14px;
              border-radius: 9999px;
              background-color: #0f172a;
              color: #ffffff;
              font-size: 12px;
              font-weight: 900;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            .qr-wrapper {
              background: #ffffff;
              padding: 6px;
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .qr-wrapper svg {
              width: 170px;
              height: 170px;
              display: block;
            }
            .info-table {
              width: 100%;
              border-top: 2px dashed #cbd5e1;
              padding-top: 12px;
              display: flex;
              flex-direction: column;
              gap: 6px;
              font-size: 11px;
              font-weight: 600;
              color: #334155;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .info-row span:last-child {
              color: #0f172a;
              font-weight: 800;
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div style="text-align: center;">
              <div class="title">PT DJI</div>
              <div class="grade-badge">GRADE ${gradeInput}</div>
            </div>
            <div class="qr-wrapper">
              ${qrSvg}
            </div>
            <div class="info-table">
              <div class="info-row">
                <span>Desain:</span>
                <span>${selectedBatch?.design_id || "-"}</span>
              </div>
              <div class="info-row">
                <span>No Customer:</span>
                <span>${selectedBatch?.no_customer || "-"}</span>
              </div>
              <div class="info-row">
                <span>Mesin / Potongan:</span>
                <span>MC ${selectedBatch?.nomor_mc || "-"} / Pot ${selectedBatch?.potongan_ke || "-"}</span>
              </div>
              <div class="info-row">
                <span>PCS / Roll:</span>
                <span>PCS ${selectedBatch?.pcs_index || "-"}</span>
              </div>
              <div class="info-row">
                <span>Jumlah:</span>
                <span>${jumlahText}</span>
              </div>
              <div class="info-row">
                <span>Berat Kain:</span>
                <span>${beratKainText}</span>
              </div>
              <div class="info-row">
                <span>Tanggal:</span>
                <span>${selectedBatch?.tgl || "-"}</span>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);
  };

  const handleDownload = async () => {
    const node = document.getElementById("print-area");
    if (!node) return;

    try {
      const dataUrl = await toPng(node, {
        quality: 1,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `Barcode_Mending_MC${selectedBatch?.nomor_mc}_POT${selectedBatch?.potongan_ke}_PCS${selectedBatch?.pcs_index}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Gagal mendownload barcode", err);
    }
  };

  const getGradeBadgeColor = (grade: string) => {
    switch (grade) {
      case "A":
        return "bg-emerald-500 text-white border-emerald-600";
      case "B":
        return "bg-amber-500 text-white border-amber-600";
      case "C":
        return "bg-orange-500 text-white border-orange-600";
      case "D":
      case "BS":
        return "bg-rose-500 text-white border-rose-600";
      default:
        return "bg-slate-500 text-white border-slate-600";
    }
  };

  return (
    <div className="w-full h-full pb-20 animate-fadeIn">
      <div className="max-w-6xl mx-auto print:hidden">
        {/* Header */}
        <div
          data-tour="mending-barcode-header"
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold mb-2 border border-emerald-200/60">
              <Scissors className="w-3.5 h-3.5" />
              <span>Modul Mending</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <QrCode className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600" />
              <span>Cetak Barcode Mending</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Cetak barcode &amp; label QR Code hasil akhir pengerjaan mending. Nilai grade otomatis diambil dari <strong>Grade Keseluruhan (Overall Grade)</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsTourOpen(true)}
            className="h-10 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-2 self-start md:self-auto cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" /> Tutorial
          </button>
        </div>

        {/* Filter Card */}
        <div
          data-tour="mending-barcode-filter"
          className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 mb-6 relative z-10"
        >
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex flex-col gap-1 w-full sm:w-1/3">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Nomor Mesin
              </label>
              <select
                value={filters.nomor_mc}
                onChange={(e) =>
                  setFilters({ ...filters, nomor_mc: e.target.value })
                }
                className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:border-emerald-500 focus:bg-white outline-none w-full font-bold text-slate-800"
              >
                <option value="">Semua Mesin</option>
                {registeredMachines.map((m: any) => (
                  <option key={m} value={m}>
                    Mesin {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 w-full sm:w-1/3">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Design ID
              </label>
              <select
                value={filters.design_id}
                onChange={(e) =>
                  setFilters({ ...filters, design_id: e.target.value })
                }
                className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:border-emerald-500 focus:bg-white outline-none w-full font-bold text-slate-800"
              >
                <option value="">Semua Design</option>
                {uniqueDesign.map((d: any) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 w-full sm:w-1/3">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Potongan Ke
              </label>
              <input
                type="text"
                value={filters.potongan_ke}
                onChange={(e) =>
                  setFilters({ ...filters, potongan_ke: e.target.value })
                }
                placeholder="Ketik nomor potongan... (misal: 100)"
                className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:border-emerald-500 focus:bg-white outline-none w-full font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>
          </div>

          {(filters.nomor_mc || filters.design_id || filters.potongan_ke) && (
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500 font-semibold">
                Menampilkan <strong>{filteredData.length}</strong> dari {allData.length} batch mending
              </span>
              <button
                type="button"
                onClick={() =>
                  setFilters({ nomor_mc: "", design_id: "", potongan_ke: "" })
                }
                className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Reset Filter
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 text-rose-700 text-sm font-bold flex items-center gap-3 border border-rose-200 animate-fadeIn">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Results */}
        <div data-tour="mending-barcode-results" className="space-y-4 relative z-0">
          {isLoading ? (
            <div className="bg-white rounded-3xl shadow-xs border border-slate-200 p-12 flex flex-col items-center justify-center text-center animate-fadeIn">
              <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
              <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1">
                Memuat Data Batch Mending...
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                Menghitung grade keseluruhan otomatis untuk setiap batch kain.
              </p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-xs border border-slate-200 p-12 flex flex-col items-center justify-center text-center animate-fadeIn">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Package className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1">
                {allData.length === 0
                  ? "Belum Ada Data Mending"
                  : "Batch Tidak Ditemukan"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                {allData.length === 0
                  ? "Belum ada batch yang selesai dikerjakan pada halaman Mending."
                  : "Coba sesuaikan filter mesin, desain, atau nomor potongan Anda."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredData.map((batch, i) => (
                <div
                  key={batch.id || i}
                  className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Badges Bar */}
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase border border-slate-200">
                          MC {batch.nomor_mc}
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase border border-emerald-200">
                          POT {batch.potongan_ke}
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-[10px] font-extrabold uppercase border border-purple-200">
                          PCS {batch.pcs_index}
                        </span>
                      </div>

                      {/* Overall Grade Pill */}
                      <div
                        className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wider uppercase shadow-xs flex items-center gap-1 shrink-0 ${getGradeBadgeColor(
                          batch.overall_grade
                        )}`}
                        title={`Grade Keseluruhan Hasil Mending: ${batch.overall_grade}`}
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>GRADE {batch.overall_grade}</span>
                      </div>
                    </div>

                    {/* Design Name */}
                    <h3 className="text-base sm:text-lg font-black text-slate-900 mb-4 truncate">
                      {batch.design_id || "-"}
                    </h3>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-2.5 mb-5">
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {batch.is_meteran ? "Panjang Kain" : "Jumlah Panel"}
                        </span>
                        <span className="block text-sm font-black text-slate-800 mt-0.5">
                          {batch.is_meteran ? `${batch.jumlah_panel} Meter` : `${batch.jumlah_panel} Panel`}
                        </span>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Berat Kain
                        </span>
                        <span className="block text-sm font-black text-slate-800 mt-0.5">
                          {batch.berat_kain > 0 ? `${batch.berat_kain} Kg` : "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
                      <span>Tanggal: {batch.tgl}</span>
                      <span>Order: {batch.no_order_barang}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenPrint(batch)}
                      className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-black text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Cetak Barcode</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ProductTour
          steps={MENDING_BARCODE_TOUR_STEPS}
          isOpen={isTourOpen}
          onClose={() => setIsTourOpen(false)}
        />

        {/* Print Barcode Modal */}
        {isModalOpen && selectedBatch && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:p-0 print:items-start print:bg-white">
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm print:hidden"
              onClick={() => setIsModalOpen(false)}
            />

            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 max-h-[90vh] print:shadow-none print:w-full print:max-w-none print:h-screen print:max-h-none print:rounded-none">
              {/* Modal Header - Hidden during print */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 print:hidden">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">
                      Cetak Barcode Mending
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Label QR Code Hasil Pengerjaan Mending
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto print:p-0 print:overflow-visible custom-scrollbar">
                {/* Printable Area */}
                <div
                  id="print-area"
                  className="flex flex-col items-center justify-center p-2 bg-white"
                >
                  <div className="border-4 border-slate-900 p-6 rounded-3xl flex flex-col items-center gap-4 bg-white shadow-xs print:shadow-none print:border-black print:rounded-none w-full max-w-sm">
                    <div className="text-center">
                      <h3 className="font-black text-2xl text-slate-900 tracking-tight">
                        PT DJI
                      </h3>
                      <div className="inline-block mt-1 px-4 py-1 rounded-full bg-slate-950 text-white text-sm font-black tracking-wider uppercase">
                        GRADE {gradeInput}
                      </div>
                    </div>

                    <div className="bg-white p-2.5 border-2 border-slate-100 rounded-2xl print:border-none shadow-xs">
                      <QRCodeSVG
                        value={getQRDataString(selectedBatch, gradeInput)}
                        size={180}
                        level="Q"
                        includeMargin={false}
                      />
                    </div>

                    <div className="w-full space-y-1.5 border-t-2 border-dashed border-slate-300 pt-4 text-xs font-semibold text-slate-700">
                      <div className="flex justify-between">
                        <span>Desain:</span>
                        <span className="font-black text-slate-900 text-right">
                          {selectedBatch.design_id}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>No Customer:</span>
                        <span className="font-bold text-slate-900 text-right">
                          {selectedBatch.no_customer || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mesin / Potongan:</span>
                        <span className="font-black text-slate-900">
                          MC {selectedBatch.nomor_mc} / Pot {selectedBatch.potongan_ke}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>PCS / Roll:</span>
                        <span className="font-bold text-slate-900">
                          PCS {selectedBatch.pcs_index}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Jumlah:</span>
                        <span className="font-bold text-slate-900">
                          {selectedBatch.is_meteran ? `${selectedBatch.jumlah_panel} Meter` : `${selectedBatch.jumlah_panel} Panel`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Berat Kain:</span>
                        <span className="font-bold text-slate-900">
                          {selectedBatch.berat_kain > 0 ? `${selectedBatch.berat_kain} Kg` : "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tanggal:</span>
                        <span className="font-bold text-slate-900">
                          {selectedBatch.tgl || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer - Hidden during print */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/70 print:hidden">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Gambar</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-black transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Cetak Label</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global CSS for Print */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
        @media print {
          body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          @page {
            margin: 0;
            size: auto;
          }
          #print-area {
            width: 100% !important;
            height: 100vh !important;
            display: flex !important;
            flex-direction: column;
            align-items: center !important;
            justify-content: flex-start !important;
            padding-top: 2rem !important;
          }
        }
      `,
          }}
        />
      </div>
    </div>
  );
}

export default function MendingBarcodePage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
          <p className="text-xs text-slate-400 font-bold">Memuat Halaman Barcode...</p>
        </div>
      }
    >
      <BarcodeContent />
    </Suspense>
  );
}
