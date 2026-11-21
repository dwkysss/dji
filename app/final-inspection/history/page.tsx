"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchFinalInspectionHistory } from "@/actions/final-inspection-actions";
import DateRangePicker from "@/components/ui/DateRangePicker";
import {
  Search,
  Loader2,
  Calendar,
  Package,
  X,
  Clock,
  Hash,
  Box,
  ClipboardCheck,
  AlertTriangle,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Eye,
  Cpu,
  Scissors,
  QrCode,
} from "lucide-react";
import { REGISTERED_MACHINES } from "@/lib/constants";
import { getShiftDate } from "@/lib/shift-utils";
import QrScannerModal, { ParsedDjiQr } from "@/components/modals/QrScannerModal";

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

export default function FinalInspectionHistoryPage() {
  const router = useRouter();
  
  const [filters, setFilters] = useState<{
    date: string;
    startDate: string;
    endDate: string;
    nomor_mc: string;
    design_id: string;
    potongan_ke: string;
  }>({
    date: "",
    startDate: "",
    endDate: "",
    nomor_mc: "",
    design_id: "",
    potongan_ke: "",
  });

  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const [expandedHistoryKeys, setExpandedHistoryKeys] = useState<Record<string, boolean>>({});

  const toggleHistoryRow = (key: string) => {
    setExpandedHistoryKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const fetchHistoryData = async (currentFilters = filters, page = currentPage, showLoader = false) => {
    if (showLoader) setIsLoading(true);
    try {
      const res = await searchFinalInspectionHistory({ ...currentFilters, page, limit: 15 });
      if (res.success && res.data) {
        setData(res.data);
        setCurrentPage(res.pagination?.page || 1);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalData(res.pagination?.total || 0);
      } else {
        setErrorMsg(res.error || "Gagal memuat riwayat.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat memuat riwayat.");
    } finally {
      setIsLoading(false);
      setHasSearched(true);
    }
  };

  useEffect(() => {
    fetchHistoryData(filters, 1, true);
  }, []);

  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  const handleQrScan = (parsed: ParsedDjiQr) => {
    const nextFilters = {
      date: "",
      startDate: "",
      endDate: "",
      nomor_mc: parsed.nomor_mc || "",
      design_id: !parsed.potongan_ke && parsed.design_id ? parsed.design_id : "",
      potongan_ke: parsed.potongan_ke || "",
    };
    setFilters(nextFilters);
    setCurrentPage(1);
    fetchHistoryData(nextFilters, 1, true);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchHistoryData(filters, 1, true);
  };

  const handleReset = () => {
    const resetFilters = {
      date: "",
      startDate: "",
      endDate: "",
      nomor_mc: "",
      design_id: "",
      potongan_ke: "",
    };
    setFilters(resetFilters);
    setCurrentPage(1);
    fetchHistoryData(resetFilters, 1, true);
  };

  return (
    <div className="w-full max-w-6xl mx-auto pb-20 animate-fadeIn">
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Filter Card with Integrated Header */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200/80 relative z-20 mb-4 sm:mb-6">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-6 right-6 h-[3px] bg-gradient-to-r from-sky-400 via-[#0070bc] to-indigo-500 rounded-full opacity-80 z-10" />

        {/* Header Section inside Card */}
        <div className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-5 pb-4 mb-4 sm:mb-5 rounded-t-2xl bg-gradient-to-br from-slate-50/90 via-white to-sky-50/40 border-b border-slate-200/70 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#0070bc] via-sky-600 to-[#004777] text-white flex items-center justify-center shadow-md shadow-[#0070bc]/25 shrink-0 ring-4 ring-sky-100/80">
              <ClipboardCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight leading-tight">
                Riwayat Final Inspek Mending
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5 leading-snug">
                Daftar seluruh batch yang telah diverifikasi pada tahap Final Inspek Mending.
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
                onClick={() => router.push("/final-inspection")}
                className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg bg-white hover:bg-sky-50 text-slate-700 hover:text-[#0070bc] border border-slate-200/70 hover:border-sky-200 text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-[#0070bc] shrink-0" />
                <span>Final Inspek</span>
              </button>

              {(filters.startDate || filters.nomor_mc || filters.potongan_ke) && (
                <button
                  type="button"
                  onClick={handleReset}
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
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:gap-4 mt-4 sm:mt-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 items-end">
            {/* TANGGAL FINAL */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-500" />
                <span>Tanggal Final</span>
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
                  setCurrentPage(1);
                  fetchHistoryData(next, 1, true);
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
                  onChange={(e) => setFilters({ ...filters, nomor_mc: e.target.value })}
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
                placeholder="Cari Potongan..."
                value={filters.potongan_ke}
                onChange={(e) => setFilters({ ...filters, potongan_ke: e.target.value })}
                className="h-11 px-3 sm:px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none transition-all text-xs sm:text-sm font-semibold text-slate-700 placeholder:text-slate-400 placeholder:font-normal shadow-xs w-full"
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
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-[#0070bc]" />
              Daftar Riwayat Final Inspek Mending
            </h2>
            <div className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
              {totalData} Data Ditemukan
            </div>
          </div>

          {data.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Mobile & Tablet View (< lg): Responsive Collapsible Table / Accordion List (Child Row Expansion) */}
              <div className="lg:hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-3 sm:px-4 py-2.5 grid grid-cols-12 items-center gap-2 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-5 pl-7">Mesin & Potongan</div>
                  <div className="col-span-3 text-center">PCS</div>
                  <div className="col-span-4 text-right pr-1">Aksi</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {data.map((d: any, idx: number) => {
                    const isMeteran = d.is_meteran || d.header?.panel_no === "METERAN";
                    const gradeAVal = d.final_grade_a ?? 0;
                    const gradeBVal = d.final_grade_b ?? 0;
                    const gradeBSVal = d.final_grade_bs ?? 0;
                    const pcsVal = d.pcs_index || d.detail?.pcs_index || "1";
                    const rowKey = `${d.id || idx}_${d.nomor_mc || "mc"}_${d.potongan_ke || "pot"}_${pcsVal}`;
                    const isExpanded = !!expandedHistoryKeys[rowKey];
                    const totalQtyLabel = isMeteran
                      ? `${gradeAVal} Meter`
                      : `${d.total_panel || 0} Panel`;
                    const durasiLabel = calculateDurationStr(
                      d.start_final,
                      d.finish_final,
                      d.pause_seconds,
                      d.elapsed_seconds
                    );
                    const petugasLabel = [
                      d.petugas_final,
                      d.petugas_final_2,
                      d.petugas_final_3,
                    ]
                      .filter(Boolean)
                      .join(" & ") || "-";

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
                                {d.nomor_mc || "-"}
                              </span>
                              <span className="h-7 px-2.5 bg-slate-50/90 text-slate-800 flex items-center gap-1 border-l border-slate-200/80">
                                <Scissors className="w-3 h-3 text-amber-500 shrink-0" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                  Pot.
                                </span>
                                <span className="text-xs font-black text-slate-800">
                                  {d.potongan_ke || "-"}
                                </span>
                              </span>
                            </div>
                          </div>

                          {/* Kolom 2: PCS & Ringkasan Hasil Final */}
                          <div className="col-span-3 flex flex-col sm:flex-row items-center justify-center gap-1 flex-wrap">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-slate-100 font-extrabold text-slate-700 text-[11px] border border-slate-200/70 whitespace-nowrap">
                              PCS {pcsVal}
                            </span>
                            {gradeBSVal > 0 ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 font-black text-[9px] whitespace-nowrap">
                                BS: {gradeBSVal}
                              </span>
                            ) : gradeBVal > 0 ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-black text-[9px] whitespace-nowrap">
                                B: {gradeBVal}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-black text-[9px] whitespace-nowrap">
                                A: {gradeAVal}
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
                              onClick={() =>
                                router.push(`/final-inspection/history/detail?id=${d.id}`)
                              }
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
                                    {d.design_id || "-"}
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

                              {/* 2. QTY & Hasil Final */}
                              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">
                                  QTY & Hasil Final
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                  <span className="font-extrabold text-slate-800">
                                    {totalQtyLabel}
                                  </span>
                                  {gradeAVal > 0 && (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[10px] whitespace-nowrap">
                                      A: {gradeAVal}
                                    </span>
                                  )}
                                  {gradeBVal > 0 && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-black text-[10px] whitespace-nowrap">
                                      B: {gradeBVal}
                                    </span>
                                  )}
                                  {gradeBSVal > 0 && (
                                    <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-black text-[10px] whitespace-nowrap">
                                      BS: {gradeBSVal}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 3. Petugas Final */}
                              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">
                                  Petugas Final
                                </span>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-black text-slate-600 shrink-0">
                                    {(d.petugas_final || "P")[0]}
                                  </span>
                                  <span className="font-extrabold text-slate-800 truncate">
                                    {petugasLabel}
                                  </span>
                                </div>
                              </div>

                              {/* 4. Waktu & Durasi */}
                              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">
                                  Waktu & Durasi
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                  {d.tanggal_final && (
                                    <span className="text-slate-500 font-semibold">
                                      {d.tanggal_final} •
                                    </span>
                                  )}
                                  <span className="font-mono font-bold text-slate-700 text-[11px]">
                                    {d.start_final
                                      ? String(d.start_final).slice(0, 5)
                                      : "-"}
                                    {d.finish_final
                                      ? ` - ${String(d.finish_final).slice(0, 5)}`
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
                <table className="w-full min-w-[700px] text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-4 whitespace-nowrap">Mesin & Desain</th>
                      <th className="px-4 py-4 text-center whitespace-nowrap">Potongan & PCS</th>
                      <th className="px-4 py-4 text-center whitespace-nowrap">Panjang / QTY</th>
                      <th className="px-4 py-4 whitespace-nowrap">Petugas Final</th>
                      <th className="px-4 py-4 text-center whitespace-nowrap">Hasil Final Inspek</th>
                      <th className="px-4 py-4 whitespace-nowrap">Waktu Final</th>
                      <th className="px-4 py-4 text-center whitespace-nowrap">Durasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.map((d: any, idx: number) => {
                      const isMeteran = d.is_meteran || d.header?.panel_no === "METERAN";
                      const gradeAVal = d.final_grade_a ?? 0;
                      const gradeBVal = d.final_grade_b ?? 0;
                      const gradeBSVal = d.final_grade_bs ?? 0;

                      return (
                        <tr
                          key={d.id || idx}
                          onClick={() => router.push(`/final-inspection/history/detail?id=${d.id}`)}
                          className="hover:bg-sky-50/50 transition-all group/row cursor-pointer"
                        >
                          <td className="px-4 py-3.5">
                            <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                              {d.nomor_mc || "-"}
                              {isMeteran ? (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-purple-100 text-purple-700 uppercase tracking-wider">METERAN</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">PANEL</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              {d.design_id || "-"}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700 text-xs border border-slate-200/60">
                                Pot. {d.potongan_ke || "-"}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 font-bold text-xs">
                                PCS {d.pcs_index || d.detail?.pcs_index || "1"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="font-extrabold text-slate-800 text-xs">
                              {isMeteran ? `${gradeAVal} Meter` : `${d.total_panel || 0} Panel`}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-extrabold shrink-0 border border-slate-200">
                                {(d.petugas_final || "P")[0]}
                              </div>
                              <div>
                                <div>{d.petugas_final || "-"}</div>
                                {d.petugas_final_2 && (
                                  <div className="text-[10px] text-slate-400 font-medium">& {d.petugas_final_2}</div>
                                )}
                                {d.petugas_final_3 && (
                                  <div className="text-[10px] text-slate-400 font-medium">& {d.petugas_final_3}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="inline-flex items-center justify-center gap-1.5 flex-wrap">
                              {gradeAVal > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-emerald-200/60">
                                  A: {gradeAVal}{isMeteran ? " M" : ""}
                                </span>
                              )}
                              {gradeBVal > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-amber-200/60">
                                  B: {gradeBVal}{isMeteran ? " T" : ""}
                                </span>
                              )}
                              {gradeBSVal > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-rose-200/60">
                                  BS: {gradeBSVal}{isMeteran ? " T" : ""}
                                </span>
                              )}
                              {gradeAVal === 0 && gradeBVal === 0 && gradeBSVal === 0 && (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex flex-col text-xs">
                              <span className="font-bold text-slate-700 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                {d.start_final || "-"} - {d.finish_final || "-"}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium pl-4">
                                {d.tanggal_final}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono text-xs font-semibold text-slate-600">
                            {calculateDurationStr(d.start_final, d.finish_final, d.pause_seconds, d.elapsed_seconds)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage <= 1}
                      onClick={() => fetchHistoryData(filters, currentPage - 1, true)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Sebelumnya
                    </button>
                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() => fetchHistoryData(filters, currentPage + 1, true)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">Tidak ada data riwayat</h3>
              <p className="text-xs text-slate-400 mt-1">Coba gunakan filter pencarian yang lain.</p>
            </div>
          )}
        </div>
      )}
      <QrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onScanSuccess={handleQrScan}
        title="Scan QR Riwayat Final Inspek"
      />
    </div>
  );
}
