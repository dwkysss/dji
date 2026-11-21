"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchQCHistory } from "@/actions/qc-actions";
import { REGISTERED_MACHINES } from "@/lib/constants";
import { getShiftDate } from "@/lib/shift-utils";
import DateRangePicker from "@/components/ui/DateRangePicker";
import {
  Search,
  Loader2,
  RefreshCw,
  Calendar,
  Package,
  Filter,
  X,
  Eye,
  Clock,
  User,
  Hash,
  Box,
  ClipboardList,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Cpu,
  Scissors,
  QrCode,
} from "lucide-react";
import ProductTour, { ProductTourStep } from "@/components/ProductTour";
import QrScannerModal, { ParsedDjiQr } from "@/components/modals/QrScannerModal";

const QC_HISTORY_TOUR_STEPS: ProductTourStep[] = [
  {
    target: "qc-history-header",
    title: "Riwayat Inspeksi QC",
    description:
      "Halaman ini untuk mencari dan meninjau hasil inspeksi QC yang sudah dikirim.",
  },
  {
    target: "qc-history-filter",
    title: "Filter Riwayat",
    description:
      "Gunakan tanggal inspeksi dan nomor mesin sebagai filter utama.",
  },

  {
    target: "qc-history-results",
    title: "Hasil Pencarian",
    description:
      "Daftar hasil menampilkan waktu inspeksi, petugas, panel/PCS, dan ringkasan ceklis/silang.",
  },
  {
    target: "qc-history-results",
    title: "Detail QC",
    description:
      "Klik ikon mata pada baris hasil untuk membuka detail inspeksi QC.",
  },
];

const QC_OPERATORS = [
  { id: "Nurdin", name: "Nurdin" },
  { id: "Hendra", name: "Hendra" },
  { id: "Taufik", name: "Taufik" },
];

const calculateDurationStr = (start?: string | null, finish?: string | null, pauseSec: number = 0, elapsedSec?: number | null) => {
  if (!start && !finish && (elapsedSec === undefined || elapsedSec === null)) {
    return "-";
  }

  let totalSec = 0;

  if (elapsedSec !== undefined && elapsedSec !== null && elapsedSec >= 0) {
    totalSec = elapsedSec;
  } else if (start && finish) {
    const parseSecs = (str: string) => {
      const match = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (!match) return null;
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const s = match[3] ? parseInt(match[3], 10) : 0;
      return h * 3600 + m * 60 + s;
    };

    const sSecs = parseSecs(start);
    const fSecs = parseSecs(finish);
    if (sSecs !== null && fSecs !== null) {
      let diff = fSecs - sSecs;
      if (diff < 0) diff += 24 * 3600;
      totalSec = Math.max(0, diff - pauseSec);
    } else {
      return "-";
    }
  } else {
    return "-";
  }

  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hours > 0) {
    return mins > 0 ? `${hours}j ${mins}m` : `${hours}j`;
  }
  if (mins > 0) {
    return secs > 0 ? `${mins}m ${secs}d` : `${mins} mnt`;
  }
  return `${secs} dtk`;
};

export default function QCHistoryPage() {
  const router = useRouter();

  const [filters, setFilters] = useState<{
    date: string;
    startDate: string;
    endDate: string;
    nomor_mc: string;
    petugas_ids: string[];
    design_id: string;
    potongan_ke: string;
    no_customer: string;
  }>({
    date: "",
    startDate: "",
    endDate: "",
    nomor_mc: "",
    petugas_ids: [],
    design_id: "",
    potongan_ke: "",
    no_customer: "",
  });

  const filtersRef = React.useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [expandedHistoryKeys, setExpandedHistoryKeys] = useState<Record<string, boolean>>({});

  const toggleHistoryRow = (key: string) => {
    setExpandedHistoryKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const fetchQCHistory = async (currentFilters = filters, showLoader = false) => {
    if (showLoader) setIsLoading(true);
    try {
      const res = await searchQCHistory(currentFilters);
      if (res.success && res.data) {
        setData(res.data);
        setHasSearched(true);
      }
    } catch (err) {
      console.error("Failed to fetch QC history", err);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    const initialFilters = {
      date: "",
      startDate: "",
      endDate: "",
      nomor_mc: "",
      petugas_ids: [],
      design_id: "",
      potongan_ke: "",
      no_customer: "",
    };
    setFilters(initialFilters);
    filtersRef.current = initialFilters;
    fetchQCHistory(initialFilters, true);

    // Auto-refresh every 10 seconds using latest active filters
    const interval = setInterval(() => {
      fetchQCHistory(filtersRef.current, false);
    }, 10000);

    // Refetch on window focus
    const handleFocus = () => {
      fetchQCHistory(filtersRef.current, false);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const handleSearch = async (e?: React.FormEvent, customFilters?: any) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const activeFilters = customFilters || filters;
      const res = await searchQCHistory(activeFilters);
      if (res.success && res.data) {
        setData(res.data);
        setHasSearched(true);
        setCurrentPage(1); // Reset to first page on new search
      } else {
        setErrorMsg(res.error || "Gagal mengambil data riwayat.");
      }
    } catch (err: any) {
      setErrorMsg("Terjadi kesalahan jaringan.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQrScan = (parsed: ParsedDjiQr) => {
    const nextFilters = {
      date: "",
      startDate: "",
      endDate: "",
      nomor_mc: parsed.nomor_mc || "",
      petugas_ids: [] as string[],
      design_id: !parsed.potongan_ke && parsed.design_id ? parsed.design_id : "",
      potongan_ke: parsed.potongan_ke || "",
      no_customer: "",
    };
    setFilters(nextFilters);
    handleSearch(undefined, nextFilters);
  };

  const handleOpenDetail = (group: any) => {
    router.push(`/qc/history/detail?id=${group.id}`);
  };

  const groupedData = data;
  const totalPages = Math.ceil(groupedData.length / itemsPerPage);
  const paginatedData = groupedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="w-full max-w-6xl mx-auto pb-20 animate-fadeIn">
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Filter Card with Integrated Header */}
      <div
        data-tour="qc-history-filter"
        className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200/80 relative z-20 mb-4 sm:mb-6"
      >
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-6 right-6 h-[3px] bg-gradient-to-r from-sky-400 via-[#0070bc] to-indigo-500 rounded-full opacity-80 z-10" />

        {/* Header Section inside Card */}
        <div
          data-tour="qc-history-header"
          className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-5 pb-4 mb-4 sm:mb-5 rounded-t-2xl bg-gradient-to-br from-slate-50/90 via-white to-sky-50/40 border-b border-slate-200/70 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#0070bc] via-sky-600 to-[#004777] text-white flex items-center justify-center shadow-md shadow-[#0070bc]/25 shrink-0 ring-4 ring-sky-100/80">
              <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 animate-[spin_12s_linear_infinite]" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight leading-tight">
                Riwayat Inspeksi QC
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5 leading-snug">
                Tinjau riwayat hasil inspeksi QC dan buka detail laporan jika diperlukan.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 w-full lg:w-auto shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setIsQrScannerOpen(true)}
              className="group/qr h-9 sm:h-10 pl-2 pr-3.5 rounded-xl bg-gradient-to-r from-[#0070bc] to-[#005a96] hover:from-[#005a96] hover:to-[#004777] active:scale-[0.98] text-white text-xs font-extrabold shadow-sm shadow-[#0070bc]/20 hover:shadow-md hover:shadow-[#0070bc]/30 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <span className="w-6 h-6 rounded-lg bg-white/15 group-hover/qr:bg-white/25 flex items-center justify-center transition-colors shrink-0">
                <QrCode className="w-3.5 h-3.5 text-white" />
              </span>
              <span>Scan QR</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setIsTourOpen(true)}
                className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg bg-white hover:bg-sky-50 text-slate-700 hover:text-[#0070bc] border border-slate-200/70 hover:border-sky-200 text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#0070bc] shrink-0" />
                <span>Tutorial</span>
              </button>

              {(filters.startDate || filters.nomor_mc || filters.potongan_ke) && (
                <button
                  type="button"
                  onClick={() => {
                    const resetFilters = {
                      date: "",
                      startDate: "",
                      endDate: "",
                      nomor_mc: "",
                      petugas_ids: [] as string[],
                      design_id: "",
                      potongan_ke: "",
                      no_customer: "",
                    };
                    setFilters(resetFilters);
                    filtersRef.current = resetFilters;
                    handleSearch(undefined, resetFilters);
                  }}
                  className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200/80 hover:border-rose-600 text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap animate-fadeIn"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Form */}
        <form onSubmit={handleSearch} className="flex flex-col gap-4 mt-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 items-end">
            {/* TANGGAL INSPEKSI */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-500" />
                <span>Tanggal Inspeksi</span>
              </label>
              <DateRangePicker
                startDate={filters.startDate}
                endDate={filters.endDate}
                onChange={(s, e) => {
                  const next = {
                    ...filters,
                    startDate: s || "",
                    endDate: e || "",
                    date: s || "",
                  };
                  setFilters(next);
                  filtersRef.current = next;
                  handleSearch(undefined, next);
                }}
                placeholder="Pilih Tanggal / Rentang..."
              />
            </div>

            {/* NOMOR MESIN */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                <span>Nomor Mesin</span>
              </label>
              <div className="relative">
                <select
                  value={filters.nomor_mc}
                  onChange={(e) =>
                    setFilters({ ...filters, nomor_mc: e.target.value })
                  }
                  className="h-11 px-3 sm:px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none transition-all text-xs sm:text-sm font-semibold text-slate-700 shadow-xs w-full cursor-pointer appearance-none pr-8 truncate"
                >
                  <option value="">-- Semua Mesin --</option>
                  {REGISTERED_MACHINES.map((mc) => (
                    <option key={mc} value={mc}>
                      Mesin {mc}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* POTONGAN KE */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-amber-500" />
                <span>Potongan Ke</span>
              </label>
              <input
                type="number"
                value={filters.potongan_ke}
                onChange={(e) =>
                  setFilters({ ...filters, potongan_ke: e.target.value })
                }
                className="h-11 px-3 sm:px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none transition-all text-xs sm:text-sm font-semibold text-slate-700 placeholder:text-slate-400 placeholder:font-normal shadow-xs w-full"
                placeholder="Cari Potongan..."
              />
            </div>

            {/* BUTTON SUBMIT */}
            <button
              type="submit"
              disabled={isLoading}
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#0070bc] to-[#005a96] hover:from-[#005a96] hover:to-[#004777] active:scale-[0.98] disabled:opacity-50 text-white text-sm font-extrabold transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-[#0070bc]/25 hover:shadow-lg hover:shadow-[#0070bc]/35 cursor-pointer w-full group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mencari...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                  <span>Cari Data</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Result Section */}
      {hasSearched && (
        <div
          data-tour="qc-history-results"
          className="space-y-4 animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#0070bc]" />
              Daftar Riwayat Inspeksi QC
            </h2>
            <div className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
              {groupedData.length} Data Ditemukan
            </div>
          </div>

          {groupedData.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Mobile & Tablet View (< lg): Responsive Collapsible Table / Accordion List (Child Row Expansion) */}
              <div className="lg:hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-3 sm:px-4 py-2.5 grid grid-cols-12 items-center gap-2 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-5 pl-7">Mesin & Potongan</div>
                  <div className="col-span-3 text-center">PCS</div>
                  <div className="col-span-4 text-right pr-1">Aksi</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {paginatedData.map((group: any, idx: number) => {
                    const header = group.header || {};
                    const isMeteran = header?.panel_no === "METERAN";
                    const pcsVal = group.pcs_index || group.detail?.pcs_index || "-";
                    const rowKey = `${group.nomor_mc || "mc"}_${group.potongan_ke || "pot"}_${pcsVal}_${idx}`;
                    const isExpanded = !!expandedHistoryKeys[rowKey];
                    const totalQtyLabel = isMeteran
                      ? `${group.inspeksi_ceklis || 0} Meter`
                      : `${(group.inspeksi_ceklis || 0) + (group.inspeksi_silang || 0) || group.items?.length || 0} Panel`;
                    const durasiLabel = calculateDurationStr(
                      group.start_inspect,
                      group.finish_inspect,
                      group.pause_seconds || 0,
                      group.elapsed_seconds
                    );

                    return (
                      <div
                        key={rowKey}
                        className={`transition-colors ${
                          isExpanded ? "bg-sky-50/30" : "bg-white hover:bg-slate-50/70"
                        }`}
                      >
                        {/* Baris Utama (Collapsed Summary Row) */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleHistoryRow(rowKey)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleHistoryRow(rowKey);
                            }
                          }}
                          className="px-3 sm:px-4 py-3 grid grid-cols-12 items-center gap-2 cursor-pointer select-none"
                        >
                          {/* Kolom 1: Indikator Expand + Connected Split-Badge (Mesin | Pot.) */}
                          <div className="col-span-5 flex items-center gap-2 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-200 ${
                                isExpanded
                                  ? "bg-[#0070bc] text-white border-[#0070bc] shadow-2xs"
                                  : "bg-slate-100 text-slate-500 border-slate-200/80"
                              }`}
                              title={isExpanded ? "Tutup rincian" : "Buka rincian"}
                            >
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </span>

                            <div className="inline-flex items-center rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden shrink-0">
                              <span className="h-7 px-2.5 bg-[#0070bc] text-white font-black text-xs flex items-center justify-center">
                                {group.nomor_mc || "-"}
                              </span>
                              <span className="h-7 px-2.5 bg-slate-50/90 text-slate-800 flex items-center gap-1 border-l border-slate-200/80">
                                <Scissors className="w-3 h-3 text-amber-500 shrink-0" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                  Pot.
                                </span>
                                <span className="text-xs font-black text-slate-800">
                                  {group.potongan_ke || "-"}
                                </span>
                              </span>
                            </div>
                          </div>

                          {/* Kolom 2: PCS & Status Ringkas */}
                          <div className="col-span-3 flex flex-col sm:flex-row items-center justify-center gap-1">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-slate-100 font-extrabold text-slate-700 text-[11px] border border-slate-200/70 whitespace-nowrap">
                              PCS {pcsVal}
                            </span>
                            {group.inspeksi_silang > 0 ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 font-black text-[9px] whitespace-nowrap">
                                {group.inspeksi_silang} Cacat
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-black text-[9px] whitespace-nowrap">
                                Normal
                              </span>
                            )}
                          </div>

                          {/* Kolom 3: Tombol Aksi Cepat (Tactile Capsule + Icon Pod) */}
                          <div
                            className="col-span-4 flex items-center justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(group)}
                              className="group/btn h-8 sm:h-9 pl-1.5 pr-2 sm:pr-2.5 rounded-xl font-extrabold text-[11px] sm:text-xs transition-all duration-200 flex items-center gap-1.5 sm:gap-2 active:scale-95 border bg-sky-50/90 hover:bg-[#0070bc] text-[#0070bc] hover:text-white border-sky-200/90 hover:border-[#0070bc] shadow-2xs hover:shadow-md hover:shadow-[#0070bc]/20 cursor-pointer whitespace-nowrap"
                            >
                              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-[#0070bc] text-white group-hover/btn:bg-white group-hover/btn:text-[#0070bc] flex items-center justify-center transition-colors shadow-2xs shrink-0">
                                <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              </span>
                              <span>Detail</span>
                              <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/btn:opacity-100 group-hover/btn:translate-x-0.5 transition-all shrink-0 hidden sm:inline-block" />
                            </button>
                          </div>
                        </div>

                        {/* Panel Detail Bawah (Expanded Child Row - Vertical Row Stack) */}
                        {isExpanded && (
                          <div className="px-3 sm:px-4 pb-3.5 pt-2.5 bg-slate-50/90 border-t border-slate-200/70 animate-fadeIn">
                            <div className="flex flex-col divide-y divide-slate-100 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden text-xs">
                              {/* 1. Desain & Tipe */}
                              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">
                                  Desain & Tipe
                                </span>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-extrabold text-slate-800 truncate">
                                    {group.design_id || "-"}
                                  </span>
                                  {isMeteran ? (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-purple-100 text-purple-700 uppercase tracking-wider shrink-0">
                                      METERAN
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider shrink-0">
                                      PANEL
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 2. QTY & Hasil Inspeksi */}
                              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">
                                  QTY & Hasil Inspeksi
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                  <span className="font-extrabold text-slate-800">
                                    {totalQtyLabel}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[10px] whitespace-nowrap">
                                    ✓ {group.inspeksi_ceklis || 0} Normal
                                  </span>
                                  {group.inspeksi_silang > 0 && (
                                    <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-black text-[10px] whitespace-nowrap">
                                      ✗ {group.inspeksi_silang} Cacat
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 3. Petugas QC */}
                              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">
                                  Petugas QC
                                </span>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-black text-slate-600 shrink-0">
                                    {(group.petugas_inspeksi || "Q")[0]}
                                  </span>
                                  <span className="font-extrabold text-slate-800 truncate">
                                    {group.petugas_inspeksi || "-"}
                                    {group.petugas_inspeksi_2
                                      ? ` & ${group.petugas_inspeksi_2}`
                                      : ""}
                                  </span>
                                </div>
                              </div>

                              {/* 4. Waktu & Durasi */}
                              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">
                                  Waktu & Durasi
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                  {group.tanggal_inspeksi && (
                                    <span className="text-slate-500 font-semibold">
                                      {group.tanggal_inspeksi} •
                                    </span>
                                  )}
                                  <span className="font-mono font-bold text-slate-700 text-[11px]">
                                    {group.start_inspect
                                      ? String(group.start_inspect).slice(0, 5)
                                      : "-"}
                                    {group.finish_inspect
                                      ? ` - ${String(group.finish_inspect).slice(0, 5)}`
                                      : ""}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 font-extrabold text-[10px]">
                                    {durasiLabel}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Desktop / Laptop Table View (>= lg) */}
              <div className="hidden lg:block overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-4 whitespace-nowrap">Mesin & Desain</th>
                      <th className="px-4 py-4 text-center whitespace-nowrap">Potongan & PCS</th>
                      <th className="px-4 py-4 text-center whitespace-nowrap">Panjang / QTY</th>
                      <th className="px-4 py-4 whitespace-nowrap">Petugas QC</th>
                      <th className="px-4 py-4 text-center whitespace-nowrap">Hasil Inspeksi</th>
                      <th className="px-4 py-4 whitespace-nowrap">Waktu Inspeksi</th>
                      <th className="px-4 py-4 text-center whitespace-nowrap">Durasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedData.map((group: any, idx: number) => {
                      const header = group.header || {};
                      const isMeteran = header?.panel_no === "METERAN";

                      return (
                        <tr
                          key={idx}
                          onClick={() => handleOpenDetail(group)}
                          className="hover:bg-sky-50/50 transition-all group/row cursor-pointer"
                        >
                          <td className="px-4 py-3.5">
                            <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                              {group.nomor_mc || "-"}
                              {isMeteran ? (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-purple-100 text-purple-700 uppercase tracking-wider">METERAN</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">PANEL</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              {group.design_id || "-"}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700 text-xs border border-slate-200/60">
                                Pot. {group.potongan_ke || "-"}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 font-bold text-xs">
                                PCS {group.pcs_index || group.detail?.pcs_index || "-"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="font-extrabold text-slate-800 text-xs">
                              {isMeteran
                                ? `${group.inspeksi_ceklis || 0} Meter`
                                : `${(group.inspeksi_ceklis || 0) + (group.inspeksi_silang || 0) || group.items?.length || 0} Panel`}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-extrabold shrink-0 border border-slate-200">
                                {(group.petugas_inspeksi || "Q")[0]}
                              </div>
                              <div>
                                <div>{group.petugas_inspeksi || "-"}</div>
                                {group.petugas_inspeksi_2 && (
                                  <div className="text-[10px] text-slate-400 font-medium">& {group.petugas_inspeksi_2}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="inline-flex items-center justify-center gap-1.5 flex-wrap">
                              {group.inspeksi_silang === 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-emerald-200/60">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Normal
                                </span>
                              ) : (
                                <>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-emerald-200/60">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    {group.inspeksi_ceklis} Normal
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-rose-200/60">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    {group.inspeksi_silang} Cacat
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex flex-col text-xs">
                              <span className="font-bold text-slate-700 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                {group.start_inspect || "-"} - {group.finish_inspect || "-"}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium pl-4">
                                {group.tanggal_inspeksi}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 font-extrabold text-xs">
                              {calculateDurationStr(group.start_inspect, group.finish_inspect, group.pause_seconds || 0, group.elapsed_seconds)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50">
                  <div className="text-xs text-slate-500 font-medium">
                    Menampilkan <span className="font-bold text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-bold text-slate-700">{Math.min(currentPage * itemsPerPage, groupedData.length)}</span> dari <span className="font-bold text-slate-700">{groupedData.length}</span> data
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Sebelumnya
                    </button>
                    
                    <div className="flex items-center gap-1 hidden sm:flex">
                      {Array.from({ length: totalPages }).map((_, i) => {
                        const pageNum = i + 1;
                        if (
                          pageNum === 1 || 
                          pageNum === totalPages || 
                          (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors flex items-center justify-center ${
                                currentPage === pageNum
                                  ? "bg-[#0070bc] text-white border border-[#0070bc]"
                                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        } else if (
                          pageNum === currentPage - 2 || 
                          pageNum === currentPage + 2
                        ) {
                          return <span key={pageNum} className="text-slate-400 text-xs px-1">...</span>;
                        }
                        return null;
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                <Package className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-1">
                Data Tidak Ditemukan
              </h3>
              <p className="text-slate-500 text-sm max-w-sm">
                Tidak ada data riwayat QC yang sesuai dengan kriteria filter
                Anda. Silakan coba sesuaikan filter pencarian.
              </p>
            </div>
          )}
        </div>
      )}

      <QrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onScanSuccess={handleQrScan}
        title="Scan QR Riwayat Inspeksi QC"
      />

      <ProductTour
        steps={QC_HISTORY_TOUR_STEPS}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />
    </div>
  );
}
