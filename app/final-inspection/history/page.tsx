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
  Cpu,
  Scissors,
} from "lucide-react";
import { REGISTERED_MACHINES } from "@/lib/constants";

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
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200/80 relative mb-6">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-6 right-6 h-[3px] bg-gradient-to-r from-sky-400 via-[#0070bc] to-indigo-500 rounded-full opacity-80" />

        {/* Header Section inside Card */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#0070bc] via-sky-600 to-blue-700 text-white flex items-center justify-center shadow-lg shadow-[#0070bc]/25 shrink-0 ring-4 ring-sky-50 transition-transform duration-300 hover:scale-105">
              <ClipboardCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                Riwayat Final Inspek Mending
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Daftar seluruh batch yang telah diverifikasi pada tahap Final Inspek Mending.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/final-inspection")}
            className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer shrink-0"
          >
            <ClipboardCheck className="w-4 h-4 text-[#0070bc]" />
            <span>Ke Halaman Final Inspek</span>
          </button>
        </div>

        {/* Filter Form */}
        <form onSubmit={handleSearch} className="flex flex-col gap-4 mt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* TANGGAL FINAL */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sky-500" />
                  <span>Tanggal Final</span>
                </span>
                {(filters.startDate || filters.nomor_mc || filters.potongan_ke || filters.design_id) && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors hover:underline cursor-pointer normal-case"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    Reset
                  </button>
                )}
              </label>
              <DateRangePicker
                startDate={filters.startDate}
                endDate={filters.endDate}
                onChange={(s, e) =>
                  setFilters({ ...filters, startDate: s || "", endDate: e || "", date: s || "" })
                }
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
                  className="h-11 px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none transition-all text-sm font-semibold text-slate-700 shadow-xs w-full cursor-pointer appearance-none"
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
                className="h-11 px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none transition-all text-sm font-semibold text-slate-700 placeholder:text-slate-400 placeholder:font-normal shadow-xs w-full"
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
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
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
    </div>
  );
}
