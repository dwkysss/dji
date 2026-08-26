"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchFinalInspectionHistory } from "@/actions/final-inspection-actions";
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
    nomor_mc: string;
    design_id: string;
    potongan_ke: string;
  }>({
    date: "",
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
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-[#0070bc]" />
            Riwayat Final Inspek Mending
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Daftar seluruh batch yang telah diverifikasi pada tahap Final Inspek Mending
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/final-inspection")}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-2 text-sm font-bold text-[#0070bc] shadow-sm transition-all hover:bg-sky-100 cursor-pointer shrink-0"
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Ke Halaman Final Inspek</span>
        </button>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Filter Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="flex flex-col gap-1 w-full">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Tanggal Final
              </label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:bg-white outline-none transition-all shadow-sm w-full"
              />
            </div>

            <div className="flex flex-col gap-1 w-full">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                Nomor Mesin
              </label>
              <select
                value={filters.nomor_mc}
                onChange={(e) => setFilters({ ...filters, nomor_mc: e.target.value })}
                className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:bg-white outline-none transition-all shadow-sm w-full"
              >
                <option value="">-- Semua Mesin --</option>
                {REGISTERED_MACHINES.map((mc) => (
                  <option key={mc} value={mc}>
                    {mc}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 w-full">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5" />
                Potongan Ke
              </label>
              <input
                type="number"
                placeholder="Cari Potongan..."
                value={filters.potongan_ke}
                onChange={(e) => setFilters({ ...filters, potongan_ke: e.target.value })}
                className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:bg-white outline-none transition-all shadow-sm w-full"
              />
            </div>

            <div className="flex items-center gap-2 w-full">
              <button
                type="submit"
                disabled={isLoading}
                className="h-11 px-6 rounded-xl bg-[#0070bc] hover:bg-[#004777] active:scale-95 disabled:opacity-50 text-white text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm w-full cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Cari Data
              </button>
              {(filters.date || filters.nomor_mc || filters.potongan_ke || filters.design_id) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="h-11 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold transition-all duration-200 flex items-center justify-center cursor-pointer shrink-0"
                  title="Reset Filter"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
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
