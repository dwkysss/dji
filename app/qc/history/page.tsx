"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchQCHistory } from "@/actions/qc-actions";
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
  if (elapsedSec !== undefined && elapsedSec !== null && elapsedSec > 0) {
    const hours = Math.floor(elapsedSec / 3600);
    const mins = Math.floor((elapsedSec % 3600) / 60);
    const secs = elapsedSec % 60;
    if (hours > 0) return `${hours}j ${mins}m`;
    if (mins === 0 && secs > 0) return `${secs} dtk`;
    return `${mins} mnt`;
  }
  if (!start || !finish) return "-";

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
  if (sSecs === null || fSecs === null) return "-";

  let diff = fSecs - sSecs;
  if (diff < 0) diff += 24 * 3600;

  if (pauseSec > 0) {
    diff = Math.max(0, diff - pauseSec);
  }

  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = diff % 60;

  if (hours > 0) return `${hours}j ${mins}m`;
  if (mins === 0 && secs > 0) return `${secs} dtk`;
  return `${mins} mnt`;
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

  // Load from session storage on mount
  useEffect(() => {
    // Auto fetch all history data on initial mount
    setIsLoading(true);
    const initialFilters = {
      date: "",
      nomor_mc: "",
      petugas_ids: [],
      design_id: "",
      potongan_ke: "",
      no_customer: "",
    };
    setFilters(initialFilters);
    searchQCHistory(initialFilters).then((res) => {
      if (res.success && res.data) {
        setData(res.data);
        setHasSearched(true);
      }
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
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

          {groupedData.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                      <th className="px-3 py-3 lg:px-4 lg:py-4 whitespace-nowrap">Start</th>
                      <th className="px-3 py-3 lg:px-4 lg:py-4 whitespace-nowrap">Finish</th>
                      <th className="px-3 py-3 lg:px-4 lg:py-4 text-center whitespace-nowrap">Durasi</th>
                      <th className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap">Mesin & Desain</th>
                      <th className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap">Potongan</th>
                      <th className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap">Petugas QC</th>
                      <th className="px-3 py-3 lg:px-6 lg:py-4 text-center whitespace-nowrap">PCS</th>
                      <th className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap">Jumlah QTY</th>
                      <th className="px-3 py-3 lg:px-6 lg:py-4 text-center whitespace-nowrap">Hasil Inspeksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedData.map((group: any, idx: number) => {
                      const header = group.header || {};

                      return (
                        <tr
                          key={idx}
                          onClick={() => handleOpenDetail(group)}
                          className="hover:bg-sky-50/50 transition-colors group/row cursor-pointer"
                        >
                          <td className="px-3 py-3 lg:px-4 lg:py-4 font-mono text-slate-800 text-xs font-bold whitespace-nowrap">
                            {group.tanggal_inspeksi} {group.start_inspect || "-"}
                          </td>
                          <td className="px-3 py-3 lg:px-4 lg:py-4 font-mono text-slate-800 text-xs font-bold whitespace-nowrap">
                            {group.tanggal_inspeksi} {group.finish_inspect || "-"}
                          </td>
                          <td className="px-3 py-3 lg:px-4 lg:py-4 font-extrabold text-amber-700 text-xs text-center whitespace-nowrap">
                            {calculateDurationStr(group.start_inspect, group.finish_inspect, group.pause_seconds || 0, group.elapsed_seconds)}
                          </td>
                          <td className="px-3 py-3 lg:px-6 lg:py-4">
                            <div className="font-bold text-slate-800">
                              {group.nomor_mc || "-"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {group.design_id || "-"}
                            </div>
                          </td>
                          <td className="px-3 py-3 lg:px-6 lg:py-4">
                            <div className="font-bold text-slate-800 uppercase tracking-wider">
                              {group.potongan_ke || "-"}
                            </div>
                          </td>
                          <td className="px-3 py-3 lg:px-6 lg:py-4">
                            <div className="font-bold text-slate-800">
                              {group.petugas_inspeksi || "-"}
                            </div>
                            {group.petugas_inspeksi_2 && (
                              <div className="text-xs text-slate-500">
                                & {group.petugas_inspeksi_2}
                              </div>
                            )}
                            {group.petugas_inspeksi_3 && (
                              <div className="text-xs text-slate-500">
                                & {group.petugas_inspeksi_3}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 lg:px-6 lg:py-4">
                            <div className="font-bold text-slate-800 text-center">
                              {group.pcs_index || group.detail?.pcs_index}
                            </div>
                          </td>
                          <td className="px-3 py-3 lg:px-6 lg:py-4">
                            <div className="text-sm font-semibold text-slate-600">
                              {header?.panel_no === "METERAN"
                                ? `${group.inspeksi_ceklis || 0} Meter`
                                : `${group.items?.length || 0} Panel`}
                            </div>
                          </td>
                          <td className="px-3 py-3 lg:px-6 lg:py-4 text-center">
                            <div className="text-sm font-bold text-slate-800 flex items-center justify-center gap-3">
                              {group.inspeksi_silang === 0 ? (
                                <span className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                  Normal
                                </span>
                              ) : (
                                <>
                                  <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    {group.inspeksi_ceklis} Normal
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <XCircle className="w-4 h-4 text-rose-500" />
                                    {group.inspeksi_silang} Cacat
                                  </span>
                                </>
                              )}
                            </div>
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
