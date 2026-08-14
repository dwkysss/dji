"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchMendingHistory } from "@/actions/mending-actions";
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
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import ProductTour, { ProductTourStep } from "@/components/ProductTour";

const MENDING_HISTORY_TOUR_STEPS: ProductTourStep[] = [
  {
    target: "mending-history-header",
    title: "Riwayat Mending",
    description:
      "Halaman ini dipakai untuk mencari dan meninjau hasil mending yang sudah pernah dikirim.",
  },
  {
    target: "mending-history-filter",
    title: "Filter Utama",
    description:
      "Cari data berdasarkan tanggal mending dan nomor mesin sebagai filter utama.",
  },
  {
    target: "mending-history-advanced",
    title: "Filter Lanjutan",
    description:
      "Buka filter lanjutan untuk menyaring berdasarkan petugas, desain, potongan, atau nomor customer.",
  },
  {
    target: "mending-history-results",
    title: "Hasil Pencarian",
    description:
      "Bagian ini menampilkan riwayat yang cocok beserta tombol detail untuk melihat isi mending lebih lengkap.",
  },
];

const MENDING_OPERATORS = [
  { id: "Dede Oting", name: "Dede Oting" },
  { id: "Andri", name: "Andri" },
  { id: "Yudi", name: "Yudi" },
];

const calculateDurationStr = (start?: string | null, finish?: string | null, pauseSec: number = 0, elapsedSec?: number | null) => {
  let totalSec = 0;

  if (elapsedSec !== undefined && elapsedSec !== null && elapsedSec > 0) {
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
    }
  }

  if (totalSec <= 0) return "-";

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

export default function MendingHistoryPage() {
  const router = useRouter();
  
  const [filters, setFilters] = useState<{
    date: string;
    nomor_mc: string;
    petugas_ids: string[];
    design_id: string;
    potongan_ke: string;
    no_customer: string;
  }>({
    date: "",
    nomor_mc: "",
    petugas_ids: [],
    design_id: "",
    potongan_ke: "",
    no_customer: "",
  });

  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalData, setTotalData] = useState(0);

  // Removed Detail Modal State

  const fetchHistoryData = async (currentFilters = filters, page = currentPage, showLoader = false) => {
    if (showLoader) setIsLoading(true);
    try {
      const res = await searchMendingHistory({ ...currentFilters, page, limit: 15 });
      if (res.success && res.data) {
        setData(res.data);
        setCurrentPage(res.page || 1);
        setTotalPages(res.totalPages || 1);
        setTotalData(res.total || 0);
        setHasSearched(true);
      }
    } catch (err) {
      console.error("Failed to fetch mending history", err);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    let initialFilters = { ...filters };
    if (typeof window !== "undefined") {
      const cachedFilters = sessionStorage.getItem("dji_mending_history_filters");
      if (cachedFilters) {
        try {
          const parsed = JSON.parse(cachedFilters);
          if (!parsed.petugas_ids) parsed.petugas_ids = [];
          initialFilters = parsed;
          setFilters(parsed);
        } catch (e) {}
      }
    }

    // Initial fetch directly from database
    fetchHistoryData(initialFilters, 1, true);

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchHistoryData(filters, currentPage, false);
    }, 10000);

    // Refetch on window focus
    const handleFocus = () => {
      fetchHistoryData(filters, currentPage, false);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const handleSearch = async (e?: React.FormEvent, page: number = 1) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      sessionStorage.setItem(
        "dji_mending_history_filters",
        JSON.stringify(filters),
      );

      const res = await searchMendingHistory({ ...filters, page, limit: 15 });
      if (res.success && res.data) {
        setData(res.data);
        setCurrentPage(res.page || 1);
        setTotalPages(res.totalPages || 1);
        setTotalData(res.total || 0);
        setHasSearched(true);
        sessionStorage.setItem(
          "dji_mending_history_data_v2",
          JSON.stringify(res.data),
        );
        sessionStorage.setItem("dji_mending_history_searched", "true");
      } else {
        setErrorMsg(res.error || "Gagal mengambil data riwayat.");
      }
    } catch (err: any) {
      setErrorMsg("Terjadi kesalahan jaringan.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDetail = (d: any) => {
    router.push(`/mending/history/detail?id=${d.id}`);
  };

  return (
    <div className="w-full max-w-6xl mx-auto pb-20 animate-fadeIn">
      <div
        data-tour="mending-history-header"
        className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-[#0070bc]" />
            Riwayat Mending
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setIsTourOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-2 text-sm font-bold text-[#0070bc] shadow-sm transition-all hover:bg-sky-100"
        >
          <HelpCircle className="w-4 h-4" />
          Tutorial
        </button>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Filter Card */}
      <div
        data-tour="mending-history-filter"
        className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6"
      >
        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="flex flex-col gap-1 w-full">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Tanggal Mending
              </label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) =>
                  setFilters({ ...filters, date: e.target.value })
                }
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
                onChange={(e) =>
                  setFilters({ ...filters, nomor_mc: e.target.value })
                }
                className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:bg-white outline-none transition-all shadow-sm w-full"
              >
                <option value="">-- Semua Mesin --</option>
                {[
                  "R1",
                  "R2",
                  "R3B",
                  "R1C",
                  "R2C",
                  "R11",
                  "R12",
                  "R16",
                  "T1C",
                  "T2A",
                  "Warping D6",
                  "Winding",
                ].map((mc) => (
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
                onChange={(e) =>
                  setFilters({ ...filters, potongan_ke: e.target.value })
                }
                className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:bg-white outline-none transition-all shadow-sm w-full"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="h-11 px-6 rounded-xl bg-[#0070bc] hover:bg-[#004777] active:scale-95 disabled:opacity-50 text-white text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm w-full"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Cari Data
            </button>

          </div>
        </form>
      </div>

      {/* Result Section */}
      {hasSearched && (
        <div
          data-tour="mending-history-results"
          className="space-y-4 animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#0070bc]" />
              Daftar Riwayat Mending
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
                      <th className="px-4 py-4 whitespace-nowrap">Petugas</th>
                      <th className="px-4 py-4 text-center whitespace-nowrap">Hasil Mending</th>
                      <th className="px-4 py-4 whitespace-nowrap">Waktu Inspeksi</th>
                      <th className="px-4 py-4 text-center whitespace-nowrap">Durasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.map((d: any, idx: number) => {
                      let gradeA = 0,
                        gradeB = 0,
                        gradeBS = 0;
                      (d.items || []).forEach((item: any) => {
                        if (item.hasil_mending === "A") gradeA++;
                        if (item.hasil_mending === "B") gradeB++;
                        if (item.hasil_mending === "BS") gradeBS++;
                      });

                      const isMeteran = d.header?.panel_no === "METERAN";
                      const gradeAVal = isMeteran ? (d.mending_grade_a || Number(d.header?.meter_akhir) || 0) : gradeA;
                      const gradeBVal = isMeteran ? (d.mending_grade_b ?? 0) : gradeB;
                      const gradeBSVal = isMeteran ? (d.mending_grade_bs ?? 0) : gradeBS;

                      return (
                        <tr
                          key={d.id || idx}
                          onClick={() => handleOpenDetail(d)}
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
                                PCS {d.pcs_index || d.detail?.pcs_index || "-"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="font-extrabold text-slate-800 text-xs">
                              {isMeteran ? `${gradeAVal} Meter` : `${d.total_panel || d.items?.length || 0} Panel`}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-extrabold shrink-0 border border-slate-200">
                                {(d.petugas_mending || "P")[0]}
                              </div>
                              {d.petugas_mending || "-"}
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
                              {gradeAVal === 0 &&
                                gradeBVal === 0 &&
                                gradeBSVal === 0 && <span className="text-slate-400 text-xs font-bold">-</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex flex-col text-xs">
                              <span className="font-bold text-slate-700 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                {d.start_mending || "-"} - {d.finish_mending || "-"}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium pl-4">
                                {d.tanggal_mending}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 font-extrabold text-xs">
                              {calculateDurationStr(d.start_mending, d.finish_mending, d.pause_seconds || 0, d.elapsed_seconds)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination UI */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                  <div className="text-sm text-slate-500 font-medium">
                    Menampilkan <span className="text-slate-900 font-bold">{(currentPage - 1) * 15 + 1}</span> - <span className="text-slate-900 font-bold">{Math.min(currentPage * 15, totalData)}</span> dari <span className="text-slate-900 font-bold">{totalData}</span> riwayat
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSearch(undefined, currentPage - 1)}
                      disabled={currentPage === 1 || isLoading}
                      className="px-3 py-1.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                              onClick={() => handleSearch(undefined, pageNum)}
                              disabled={isLoading}
                              className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors flex items-center justify-center ${
                                currentPage === pageNum
                                  ? "bg-[#0070bc] text-white border border-[#0070bc]"
                                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        } else if (
                          pageNum === currentPage - 2 || 
                          pageNum === currentPage + 2
                        ) {
                          return <span key={pageNum} className="text-slate-400 text-sm px-1">...</span>;
                        }
                        return null;
                      })}
                    </div>

                    <button
                      onClick={() => handleSearch(undefined, currentPage + 1)}
                      disabled={currentPage >= totalPages || isLoading}
                      className="px-3 py-1.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                Tidak ada data riwayat mending yang sesuai dengan kriteria
                filter Anda. Silakan coba sesuaikan filter pencarian.
              </p>
            </div>
          )}
        </div>
      )}

      <ProductTour
        steps={MENDING_HISTORY_TOUR_STEPS}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />

    </div>
  );
}
