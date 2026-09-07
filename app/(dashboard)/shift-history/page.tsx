"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { searchEmployeeHistory } from "@/actions/employee-actions";
import { REGISTERED_MACHINES } from "@/lib/constants";
import { getShiftDate } from "@/lib/shift-utils";
import {
  Search,
  Loader2,
  RefreshCw,
  Calendar,
  Package,
  Hash,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  ClipboardList,
  RotateCcw,
  Cpu,
  Scissors,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DateRangePicker from "@/components/ui/DateRangePicker";

// Helper Fallbacks (if DB fetch fails)
const FALLBACK_OPERATORS = [
  // Shift A
  { id: 1, name: "Rohmat", shift: "A" },
  { id: 2, name: "M.Alwi", shift: "A" },
  { id: 3, name: "Anwar", shift: "A" },
  { id: 4, name: "Jaya", shift: "A" },
  { id: 5, name: "Riki S", shift: "A" },
  { id: 6, name: "Sandi M", shift: "A" },
  { id: 7, name: "Padlan", shift: "A" },
  { id: 8, name: "Rissa A", shift: "A" },
  { id: 9, name: "Devi K", shift: "A" },
  { id: 10, name: "Novi S", shift: "A" },
  { id: 11, name: "Udin", shift: "A" },
  // Shift B
  { id: 12, name: "Irfan", shift: "B" },
  { id: 13, name: "Anton", shift: "B" },
  { id: 14, name: "Ahmad S", shift: "B" },
  { id: 15, name: "Saepudin", shift: "B" },
  { id: 16, name: "Parid", shift: "B" },
  { id: 17, name: "Noval", shift: "B" },
  { id: 18, name: "Sigit", shift: "B" },
  { id: 19, name: "Rani Y", shift: "B" },
  { id: 20, name: "Yanti P", shift: "B" },
  { id: 21, name: "Irma P", shift: "B" },
  { id: 22, name: "Aris W", shift: "B" },
  // Shift C
  { id: 23, name: "Tubagus", shift: "C" },
  { id: 24, name: "Andri Y", shift: "C" },
  { id: 25, name: "Royana", shift: "C" },
  { id: 26, name: "Komara", shift: "C" },
  { id: 27, name: "Sopian", shift: "C" },
  { id: 28, name: "Iki S", shift: "C" },
  { id: 29, name: "Hardi", shift: "C" },
  { id: 30, name: "Rini D", shift: "C" },
  { id: 31, name: "Neneng", shift: "C" },
  { id: 32, name: "Rina R", shift: "C" },
  { id: 33, name: "Farhan", shift: "C" },
];
const FALLBACK_DESIGNS = [
  { id: 1, name: "TCD 5826 XA" },
  { id: 2, name: "DL 5675 CO" },
  { id: 3, name: "DL 5167 CO" },
  { id: 4, name: "DL 5169 CO" },
  { id: 5, name: "DL 6460 CR" },
  { id: 6, name: "DL 5162 CO" },
  { id: 7, name: "DL 5168 CO" },
];
const FALLBACK_GROUPS = [
  { id: 1, name: "A" },
  { id: 2, name: "B" },
  { id: 3, name: "C" },
];

export default function ShiftHistoryPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<{
    date: string;
    startDate: string;
    endDate: string;
    nomor_mc: string;
    group_id: string;
    operator_ids: string[];
    design_id: string;
    potongan_ke: string;
    tanggal_potong: string;
    no_customer: string;
  }>({
    date: "",
    startDate: "",
    endDate: "",
    nomor_mc: "",
    group_id: "",
    operator_ids: [],
    design_id: "",
    potongan_ke: "",
    tanggal_potong: "",
    no_customer: "",
  });

  const [data, setData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [sortBy, setSortBy] = useState<"time" | "downtime" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Dropdown States
  const [operators, setOperators] = useState<any[]>(FALLBACK_OPERATORS);
  const [designs, setDesigns] = useState<any[]>(FALLBACK_DESIGNS);
  const [groups, setGroups] = useState<any[]>(FALLBACK_GROUPS);

  // Load from session storage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const today = getShiftDate(new Date());
      const cachedFilters = sessionStorage.getItem("dji_shift_history_filters");

      let initialFilters = { ...filters };
      if (cachedFilters) {
        try {
          const parsed = JSON.parse(cachedFilters);
          initialFilters = { ...parsed };
          if (!initialFilters.startDate && initialFilters.date) {
            initialFilters.startDate = initialFilters.date;
            initialFilters.endDate = initialFilters.date;
          }
          if (!initialFilters.operator_ids) {
            initialFilters.operator_ids = [];
          }
        } catch (e) {}
      } else {
        initialFilters.date = today;
        initialFilters.startDate = today;
        initialFilters.endDate = today;
      }
      setFilters(initialFilters);

      // Auto-search on mount
      (async () => {
        setIsLoading(true);
        try {
          const res = await searchEmployeeHistory({
            ...initialFilters,
            startDate: initialFilters.startDate || initialFilters.date,
            endDate: initialFilters.endDate || initialFilters.date,
            page: 1,
            perPage,
            sortBy,
            sortDir,
          });
          if (res.success && res.data) {
            setData(res.data);
            setTotalCount(res.total || 0);
            setHasSearched(true);
            sessionStorage.setItem("dji_shift_history_data", JSON.stringify(res.data));
            sessionStorage.setItem("dji_shift_history_searched", "true");
          }
        } catch (err) {
          console.error("Auto-search failed", err);
        } finally {
          setIsLoading(false);
        }
      })();

      // Load dropdowns from Supabase
      async function loadDbData() {
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();

          if (
            !process.env.NEXT_PUBLIC_SUPABASE_URL ||
            process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
          ) {
            setOperators(FALLBACK_OPERATORS);
            setDesigns(FALLBACK_DESIGNS);
            setGroups(FALLBACK_GROUPS);
            return;
          }

          const { data: opData } = await supabase
            .from("operators")
            .select("id, nama_operator");
          if (opData && opData.length > 0) {
            // Use fallback list
          } else {
            setOperators(FALLBACK_OPERATORS);
          }

          const { data: dsData } = await supabase
            .from("designs")
            .select("id, nama_design");
          if (dsData && dsData.length > 0)
            setDesigns(
              dsData.map((d: any) => ({ id: d.id, name: d.nama_design }))
            );
          else setDesigns(FALLBACK_DESIGNS);

          const { data: gpData } = await supabase
            .from("groups")
            .select("id, nama_grup");
          if (gpData && gpData.length > 0)
            setGroups(
              gpData.map((g: any) => ({ id: g.id, name: g.nama_grup }))
            );
          else setGroups(FALLBACK_GROUPS);
        } catch (e) {
          console.warn("Gagal fetch dropdowns, gunakan fallback", e);
          setOperators(FALLBACK_OPERATORS);
          setDesigns(FALLBACK_DESIGNS);
          setGroups(FALLBACK_GROUPS);
        }
      }

      loadDbData();
    }
  }, []);

  const handleSearch = async (e?: React.FormEvent, customFilters?: any) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const activeFilters = customFilters || filters;
      sessionStorage.setItem("dji_shift_history_filters", JSON.stringify(activeFilters));
      setCurrentPage(1);
      const searchPayload = {
        ...activeFilters,
        date: activeFilters.startDate,
        startDate: activeFilters.startDate,
        endDate: activeFilters.endDate || activeFilters.startDate,
        page: 1,
        perPage,
        sortBy,
        sortDir,
      };
      const res = await searchEmployeeHistory(searchPayload);
      if (res.success && res.data) {
        setData(res.data);
        setTotalCount(res.total || 0);
        setHasSearched(true);
        sessionStorage.setItem("dji_shift_history_data", JSON.stringify(res.data));
        sessionStorage.setItem("dji_shift_history_searched", "true");
      } else {
        setErrorMsg(res.error || "Gagal mengambil data riwayat.");
      }
    } catch (err: any) {
      setErrorMsg("Terjadi kesalahan jaringan.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch page when pagination or sorting changes
  useEffect(() => {
    if (!hasSearched) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const searchPayload = {
          ...filters,
          date: filters.startDate,
          startDate: filters.startDate,
          endDate: filters.endDate || filters.startDate,
          page: currentPage,
          perPage,
          sortBy,
          sortDir,
        };
        const res = await searchEmployeeHistory(searchPayload);
        if (cancelled) return;
        if (res.success && res.data) {
          setData(res.data);
          setTotalCount(res.total || 0);
        } else {
          setErrorMsg(res.error || "Gagal mengambil data riwayat.");
        }
      } catch (err) {
        if (!cancelled) setErrorMsg("Terjadi kesalahan jaringan.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentPage, perPage, sortBy, sortDir]);

  const handleRowClick = async (batch: any) => {
    const searchParams = new URLSearchParams({
      mc: batch.nomor_mc || "",
      potongan: batch.potongan_ke || "",
    });
    if (batch.design_id) searchParams.set("design", batch.design_id);
    if (batch.tgl) searchParams.set("tgl", batch.tgl);

    router.push(`/shift-history/detail?${searchParams.toString()}`);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  useEffect(
    () => setCurrentPage(1),
    [
      filters.startDate,
      filters.endDate,
      filters.nomor_mc,
      filters.group_id,
      filters.design_id,
      filters.potongan_ke,
      filters.no_customer,
      perPage,
      sortBy,
      sortDir,
    ]
  );

  const pagedData = data;

  return (
    <div className="w-full max-w-6xl mx-auto pb-10 animate-fadeIn">
      {/* Integrated Header & Filter Card */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200/80 relative mb-6">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-6 right-6 h-[3px] bg-gradient-to-r from-sky-400 via-[#0070bc] to-indigo-500 rounded-full opacity-80" />

        {/* Header Section inside Card */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#0070bc] via-sky-600 to-blue-700 text-white flex items-center justify-center shadow-lg shadow-[#0070bc]/25 shrink-0 ring-4 ring-sky-50 transition-transform duration-300 hover:scale-105">
              <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 animate-[spin_12s_linear_infinite]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  Riwayat Input Produksi
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  Kepala Shift
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Tinjau seluruh riwayat input produksi dan lakukan koreksi/penghapusan baris data panel jika diperlukan.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col gap-4 mt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* TANGGAL PRODUKSI / RENTANG */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sky-500" />
                  <span>Tanggal Produksi</span>
                </span>
                {(filters.startDate || filters.nomor_mc || filters.potongan_ke) && (
                  <button
                    type="button"
                    onClick={() => {
                      const resetFilters = {
                        date: "",
                        startDate: "",
                        endDate: "",
                        nomor_mc: "",
                        group_id: "",
                        operator_ids: [] as string[],
                        design_id: "",
                        potongan_ke: "",
                        tanggal_potong: "",
                        no_customer: "",
                      };
                      setFilters(resetFilters);
                      sessionStorage.removeItem("dji_shift_history_filters");
                      handleSearch(undefined, resetFilters);
                    }}
                    className="text-[10px] text-rose-500 hover:text-rose-600 font-extrabold transition-all lowercase cursor-pointer"
                  >
                    [reset filter]
                  </button>
                )}
              </label>
              <DateRangePicker
                startDate={filters.startDate}
                endDate={filters.endDate}
                onChange={(start, end) => {
                  setFilters((prev) => ({
                    ...prev,
                    startDate: start,
                    endDate: end,
                    date: start,
                  }));
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
                  className="h-11 px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none transition-all text-sm font-semibold text-slate-700 shadow-xs w-full cursor-pointer appearance-none"
                >
                  <option value="">-- Pilih Mesin --</option>
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
                className="h-11 px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none transition-all text-sm font-semibold text-slate-700 placeholder:text-slate-400 placeholder:font-normal shadow-xs w-full"
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

      {/* Error Alert */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium">
          {errorMsg}
        </div>
      )}

      {/* Table Container */}
      <div>
        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 text-center flex flex-col items-center justify-center gap-3 animate-fadeIn">
            <Loader2 className="w-8 h-8 text-[#0070bc] animate-spin" />
            <h3 className="text-sm font-bold text-slate-800">
              Memuat Riwayat Produksi...
            </h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Sedang mengambil data riwayat input dari server.
            </p>
          </div>
        ) : hasSearched ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fadeIn">
            {data.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                  <Package className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">
                  Tidak ada riwayat.
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Belum ada data produksi yang sesuai dengan filter pencarian Anda.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      <th className="px-2 py-2 pl-3">Tanggal</th>
                      <th
                        className="px-4 py-2.5 cursor-pointer"
                        onClick={() => {
                          if (sortBy === "time")
                            setSortDir(sortDir === "asc" ? "desc" : "asc");
                          else {
                            setSortBy("time");
                            setSortDir("desc");
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          Waktu
                          {sortBy === "time" ? (
                            sortDir === "asc" ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )
                          ) : null}
                        </div>
                      </th>
                      <th className="px-2 py-2">Mesin</th>
                      <th className="px-2 py-2">Design</th>
                      <th className="px-2 py-2 text-center">Potongan</th>
                      <th className="px-2 py-2 text-center">Qty</th>
                      <th
                        className="px-2 py-2 cursor-pointer text-center"
                        onClick={() => {
                          if (sortBy === "downtime")
                            setSortDir(sortDir === "asc" ? "desc" : "asc");
                          else {
                            setSortBy("downtime");
                            setSortDir("desc");
                          }
                        }}
                      >
                        <div className="flex items-center gap-1 justify-center">
                          Downtime
                          {sortBy === "downtime" ? (
                            sortDir === "asc" ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )
                          ) : null}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-700">
                    {pagedData.map((batch: any, idx) => {
                      let jam = "-";
                      if (batch.waktu_input_terakhir) {
                        const dateObj = new Date(batch.waktu_input_terakhir);
                        if (!isNaN(dateObj.getTime())) {
                          jam = dateObj.toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        } else {
                          jam = batch.waktu_input_terakhir.split(/[ T]/)[1] || "-";
                        }
                      }

                      const formatDurationNice = (totalSec: number | string) => {
                        const sec =
                          typeof totalSec === "string"
                            ? parseInt(totalSec) || 0
                            : totalSec || 0;
                        if (sec <= 0) return "-";
                        const hours = Math.floor(sec / 3600);
                        const minutes = Math.floor((sec % 3600) / 60);
                        const seconds = sec % 60;
                        if (hours > 0) {
                          if (minutes > 0) return `${hours} Jam ${minutes} Mnt`;
                          return `${hours} Jam`;
                        }
                        if (minutes > 0) {
                          if (seconds > 0) return `${minutes} Mnt ${seconds} Dtk`;
                          return `${minutes} Mnt`;
                        }
                        return `${seconds} Dtk`;
                      };

                      return (
                        <tr
                          key={idx}
                          onClick={() => handleRowClick(batch)}
                          className="hover:bg-sky-50/50 cursor-pointer transition-colors group"
                        >
                          <td className="px-2 py-2 pl-3 whitespace-nowrap">
                            <span className="font-bold text-slate-800">
                              {batch.tgl || "-"}
                            </span>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className="text-slate-600">{jam}</span>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className="font-bold text-[#0070bc]">
                              {batch.nomor_mc || "-"}
                            </span>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {batch.design_id || "-"}
                          </td>
                          <td className="px-2 py-2 text-center whitespace-nowrap font-bold text-slate-700">
                            Ke-{batch.potongan_ke || "-"}
                          </td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">
                            {batch.total_panels === 0 &&
                            batch.total_meter === 0 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-fuchsia-100 text-fuchsia-700">
                                Laporan Downtime Khusus
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">
                                {batch.is_meter
                                  ? `${batch.total_meter || 0} Meter`
                                  : `${batch.total_panels} Panel`}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">
                            {batch.total_downtime_detik > 0 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                                {formatDurationNice(batch.total_downtime_detik)}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50">
                  <div className="text-xs text-slate-600">
                    Menampilkan{" "}
                    {totalCount === 0
                      ? 0
                      : (currentPage - 1) * perPage + 1}{" "}
                    - {Math.min(currentPage * perPage, totalCount)} dari{" "}
                    {totalCount}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={perPage}
                      onChange={(e) => setPerPage(Number(e.target.value))}
                      className="h-9 px-2 rounded-lg bg-white border border-slate-200 text-xs cursor-pointer"
                    >
                      {[10, 20, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n} / halaman
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-xs disabled:opacity-50 cursor-pointer"
                    >
                      Prev
                    </button>
                    <span className="text-xs text-slate-600">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage >= totalPages}
                      className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-xs disabled:opacity-50 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-10 flex flex-col items-center justify-center text-center bg-white rounded-2xl shadow-sm border border-slate-200 border-dashed">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
              <Search className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">
              Siap Mencari Data
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Gunakan filter di atas untuk mencari riwayat spesifik yang Anda butuhkan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
