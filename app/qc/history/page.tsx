"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchQCHistory } from "@/actions/qc-actions";
import { REGISTERED_MACHINES } from "@/lib/constants";
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

  const [isTourOpen, setIsTourOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

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
      nomor_mc: "",
      petugas_ids: [],
      design_id: "",
      potongan_ke: "",
      no_customer: "",
    };
    setFilters(initialFilters);
    fetchQCHistory(initialFilters, true);

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchQCHistory(filters, false);
    }, 10000);

    // Refetch on window focus
    const handleFocus = () => {
      fetchQCHistory(filters, false);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await searchQCHistory(filters);
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
      <div
        data-tour="qc-history-header"
        className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
      >
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <RefreshCw className="w-6 h-6 text-[#0070bc]" />
          Riwayat Inspeksi QC
        </h1>

        <button
          type="button"
          onClick={() => setIsTourOpen(true)}
          className="h-11 px-4 rounded-full bg-[#0070bc] hover:bg-[#004777] text-white text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2 self-start"
        >
          <HelpCircle className="w-4 h-4" /> Tutorial
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
        data-tour="qc-history-filter"
        className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6"
      >
        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="flex flex-col gap-1 w-full">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5" />
                Tanggal Inspeksi
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
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 whitespace-nowrap">
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
                {REGISTERED_MACHINES.map((mc) => (
                  <option key={mc} value={mc}>
                    {mc}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 w-full">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 whitespace-nowrap">
                Potongan Ke
              </label>
              <input
                type="number"
                value={filters.potongan_ke}
                onChange={(e) =>
                  setFilters({ ...filters, potongan_ke: e.target.value })
                }
                className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:bg-white outline-none transition-all shadow-sm w-full"
                placeholder="Cari Potongan..."
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
          data-tour="qc-history-results"
          className="space-y-4 animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-600" />
              Hasil Pencarian
            </h2>
            <div className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
              {groupedData.length} Data Ditemukan
            </div>
          </div>

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
              <div className="overflow-x-auto">
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

      <ProductTour
        steps={QC_HISTORY_TOUR_STEPS}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />
    </div>
  );
}
