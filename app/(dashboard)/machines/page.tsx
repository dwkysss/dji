"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getMachineStatuses, MachineStatus } from "@/actions/dashboard-actions";
import { getMachineConfigs, upsertAllMachineConfigs, MachineConfig, getBlockRequiredDefects, saveBlockRequiredDefects } from "@/actions/machine-config-actions";
import {
  Activity,
  Power,
  Clock,
  RefreshCw,
  HelpCircle,
  Settings2,
  Save,
  X,
  User,
  ChevronRight,
  BarChart3,
  Search,
  Cpu,
  SlidersHorizontal,
  Zap,
  AlertCircle,
  TrendingUp,
  Sliders,
  Layers,
  Sparkles,
  Box,
  CheckCircle2,
} from "lucide-react";
import ProductTour, { ProductTourStep } from "@/components/ProductTour";

const MASTER_PROBLEM_CATEGORIES: Record<string, { label: string; desc: string; items: string[] }> = {
  A: {
    label: "Kategori A",
    desc: "Benang Timbul / Lolos",
    items: [
      "L1/L2/L3 Benang timbul putus",
      "Benang lolos",
      "Bolong corak",
      "Benang narik/Kendor",
      "Benang Nyilang",
      "Perbaikan/Beset benang Dasar",
      "Benang Kejepit/Jebol/Kusut",
      "Jalur benang",
    ],
  },
  B: {
    label: "Kategori B",
    desc: "Jarum / Jacquard",
    items: [
      "Jarum pattern patah/bengkok",
      "Ganti Jacquard",
      "Ganti jarum Compoun Nedle, pattern",
      "Ngampul",
      "Ganti dari scaloop ke non scaloop atau sebaliknya",
      "Ngegaris/Stopline",
      "Keluar Jarum",
      "Ganti String bar",
      "Ganti PBO",
      "Pressan As beam kendor",
      "Tensi tensioner",
    ],
  },
  C: {
    label: "Kategori C",
    desc: "Design / Proofing",
    items: [
      "Loading design/Ganti Design",
      "Perbaikan corak/revisi",
      "Salah ganti design",
      "Error design",
      "Proofing/PCB",
      "Ganti Pattern Disk",
      "Ganti pick",
    ],
  },
  D: {
    label: "Kategori D",
    desc: "Benang Dasar / Rewind",
    items: [
      "Ganti benang dasar L1/L2",
      "Salah ganti benang dasar",
      "Ganti benang Pattern Linner",
      "Ganti benang Pattern Heavy",
      "Ganti benang Pattern Shadow",
      "Ganti benang pattern keseluruhan (L,H,S)",
      "salah ganti benang pattern",
      "Ngelancarin",
      "Over Cone/Rewind",
      "Tunggu benang dasar dari warping",
      "Tunggu benang (benang belum datang)",
    ],
  },
  E: {
    label: "Kategori E",
    desc: "Servo / Elektrik",
    items: [
      "Error Servo Drive",
      "Ganti motor servo",
      "Sensor Benang/Laser Stop",
      "Perbaikan Eletrik lainnya",
      "Konsleting",
      "Perbaikan listrik",
    ],
  },
  F: {
    label: "Kategori F",
    desc: "Cylinder / Mekanik",
    items: [
      "Perbaikan cilynder Angin",
      "Ganti Bellow",
      "Perbaikan gear/Take Up Roll",
      "Ganti rantai/pertensi",
      "Ganti Black grip roll",
      "Ganti Oli",
      "Pelumasan/greace pada mesin",
      "Ganti Vanbelt",
      "Perawatan Panel Listrik",
      "Servis Overhaul",
    ],
  },
  G: {
    label: "Kategori G",
    desc: "Lain-lain / Operational",
    items: [
      "Hari Libur",
      "Tidak ada order",
      "Tunggu info",
      "Demo",
      "Bencana/gempa/banjir",
      "Istirahat selama buka puasa",
      "Tunggu Sparepart",
      "Mati Listrik",
    ],
  },
};

const MACHINE_TOUR_STEPS: ProductTourStep[] = [
  {
    target: "machine-header",
    title: "Monitoring Mesin",
    description: "Pantau aktivitas & status operasional mesin produksi secara real-time.",
  },
  {
    target: "machine-summary",
    title: "Ringkasan Status",
    description: "Klik pada salah satu kartu ringkasan untuk memfilter daftar mesin.",
  },
  {
    target: "machine-grid",
    title: "Kartu Mesin",
    description: "Klik kartu mesin untuk membuka analisis detail per-blok dan riwayat downtime.",
  },
];

type FilterStatus = "Semua" | "Beroperasi" | "Idle" | "Tidak Aktif";

export default function MachinesPage() {
  const router = useRouter();
  const [machines, setMachines] = useState<MachineStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("Semua");
  const [configs, setConfigs] = useState<MachineConfig[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  };

  const [configTab, setConfigTab] = useState<"MACHINES" | "BLOCK_REQUIRED">("MACHINES");
  const [requiredBlockDefects, setRequiredBlockDefects] = useState<string[]>([
    "L1/L2/L3 Benang timbul putus",
    "Benang lolos",
    "Bolong corak",
    "Jarum pattern patah/bengkok",
    "Ganti Jacquard",
  ]);

  const toggleRequiredDefect = (item: string) => {
    setRequiredBlockDefects((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dji_required_block_defects");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRequiredBlockDefects(parsed);
          return;
        }
      }
    } catch (e) {}

    getBlockRequiredDefects().then((res) => {
      if (res.success && res.data && res.data.length > 0) {
        setRequiredBlockDefects(res.data);
      }
    });
  }, [isConfigModalOpen]);

  const fetchStatuses = async () => {
    try {
      setLoading(true);
      const res = await getMachineStatuses();
      if (res.success && res.data) {
        setMachines(res.data);
        setError(null);
        setLastRefresh(new Date());
      } else {
        setError(res.error || "Gagal memuat status mesin.");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigs = async () => {
    const res = await getMachineConfigs();
    if (res.success && res.data) {
      setConfigs(res.data);
      try {
        const mapPcs: Record<string, number> = {};
        const mapTypes: Record<string, string> = {};
        res.data.forEach((c) => {
          mapPcs[c.nomor_mc] = c.default_pcs;
          mapTypes[c.nomor_mc] = c.input_type;
        });
        localStorage.setItem("dji_machine_configs", JSON.stringify(mapPcs));
        localStorage.setItem("dji_machine_input_types", JSON.stringify(mapTypes));
      } catch (e) {}
    }
  };

  useEffect(() => { fetchConfigs(); }, []);
  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(() => { fetchStatuses(); }, 60000);
    return () => clearInterval(interval);
  }, []);

  const totalOperating = useMemo(() => machines.filter((m) => m.status === "Beroperasi").length, [machines]);
  const totalIdle = useMemo(() => machines.filter((m) => m.status === "Idle").length, [machines]);
  const totalTidakAktif = useMemo(() => machines.filter((m) => m.status === "Tidak Aktif").length, [machines]);
  const operatingPct = useMemo(() => machines.length === 0 ? 0 : Math.round((totalOperating / machines.length) * 100), [machines.length, totalOperating]);

  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      const matchesStatus = statusFilter === "Semua" || m.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || m.mesin_id.toLowerCase().includes(q) || m.nama_operator.toLowerCase().includes(q) || m.design.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [machines, statusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8">

      {/* ── Top Bar Header ── */}
      <div
        data-tour="machine-header"
        className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-100/80 flex items-center justify-center text-[#0070bc] shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-800 tracking-tight">Monitoring Mesin</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                LIVE
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Pantau status operasional & aktivitas mesin rajut secara real-time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto justify-end">
          {/* Last Refresh Badge */}
          <div className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 font-medium flex items-center gap-2.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Update: <strong className="text-slate-800 font-mono font-bold">{lastRefresh ? lastRefresh.toLocaleTimeString("id-ID") : "—"}</strong></span>
            <button
              onClick={fetchStatuses}
              disabled={loading}
              className={`p-1 rounded-md hover:bg-slate-200/70 text-slate-600 transition-all cursor-pointer ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsConfigModalOpen(true)}
            className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Settings2 className="w-4 h-4 text-[#0070bc] shrink-0" />
            <span>Default Mesin</span>
          </button>

          <button
            type="button"
            onClick={() => setIsTourOpen(true)}
            className="h-10 px-3.5 rounded-xl border border-sky-100 bg-sky-50 hover:bg-sky-100 text-[#0070bc] text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Tutorial</span>
          </button>
        </div>
      </div>

      {/* ── KPI Stat Grid Cards ── */}
      <div
        data-tour="machine-summary"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      >
        {/* Total Mesin Card */}
        <div
          onClick={() => setStatusFilter("Semua")}
          className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
            statusFilter === "Semua"
              ? "bg-sky-50/80 border-sky-300 text-slate-900 shadow-sm ring-1 ring-sky-200/60"
              : "bg-white border-slate-200/80 text-slate-800 hover:border-slate-300 hover:shadow-xs"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Total Mesin Rajut
              </span>
              <div className="text-3xl font-black tracking-tight mt-1 text-slate-900">
                {machines.length} <span className="text-xs font-bold text-slate-400">Unit</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-sky-100/70 text-[#0070bc]">
              <Layers className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold">
            <span className="text-slate-500">Efisiensi Operasional</span>
            <span className="text-[#0070bc]">{operatingPct}%</span>
          </div>
        </div>

        {/* Beroperasi Card */}
        <div
          onClick={() => setStatusFilter("Beroperasi")}
          className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
            statusFilter === "Beroperasi"
              ? "bg-emerald-50/80 border-emerald-300 text-slate-900 shadow-sm ring-1 ring-emerald-200/60"
              : "bg-white border-slate-200/80 text-slate-800 hover:border-emerald-200 hover:shadow-xs"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Beroperasi Saat Ini
              </span>
              <div className="text-3xl font-black tracking-tight mt-1 text-slate-900">
                {totalOperating} <span className="text-xs font-bold text-slate-400">Mesin</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-100/70 text-emerald-600">
              <Zap className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Aktif produksi
            </span>
            <span className="text-emerald-800">{operatingPct}% Total</span>
          </div>
        </div>

        {/* Idle Card */}
        <div
          onClick={() => setStatusFilter("Idle")}
          className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
            statusFilter === "Idle"
              ? "bg-amber-50/80 border-amber-300 text-slate-900 shadow-sm ring-1 ring-amber-200/60"
              : "bg-white border-slate-200/80 text-slate-800 hover:border-amber-200 hover:shadow-xs"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Idle / Standby
              </span>
              <div className="text-3xl font-black tracking-tight mt-1 text-slate-900">
                {totalIdle} <span className="text-xs font-bold text-slate-400">Mesin</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-amber-100/70 text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold">
            <span className="text-slate-500">Menunggu Antrean</span>
            <span className="text-amber-700">{machines.length > 0 ? Math.round((totalIdle / machines.length) * 100) : 0}%</span>
          </div>
        </div>

        {/* Off Card */}
        <div
          onClick={() => setStatusFilter("Tidak Aktif")}
          className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
            statusFilter === "Tidak Aktif"
              ? "bg-slate-100/90 border-slate-300 text-slate-900 shadow-sm ring-1 ring-slate-200/60"
              : "bg-white border-slate-200/80 text-slate-800 hover:border-slate-300 hover:shadow-xs"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Tidak Aktif / Off
              </span>
              <div className="text-3xl font-black tracking-tight mt-1 text-slate-900">
                {totalTidakAktif} <span className="text-xs font-bold text-slate-400">Mesin</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-200/70 text-slate-600">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold">
            <span className="text-slate-500">Libur / Stop</span>
            <span className="text-slate-700">{machines.length > 0 ? Math.round((totalTidakAktif / machines.length) * 100) : 0}%</span>
          </div>
        </div>
      </div>

      {/* ── Search & Segmented Filter Bar ── */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Filter Status Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
          {(["Semua", "Beroperasi", "Idle", "Tidak Aktif"] as FilterStatus[]).map((status) => {
            const isActive = statusFilter === status;
            const count =
              status === "Semua" ? machines.length
              : status === "Beroperasi" ? totalOperating
              : status === "Idle" ? totalIdle
              : totalTidakAktif;

            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span>{status}</span>
                <span
                  className={`px-2 py-0.5 text-[10px] rounded-lg font-black ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor mesin, operator, design..."
            className="w-full h-10 pl-10 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#0070bc] focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl mb-6 text-xs font-bold flex items-center gap-2">
          <X className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && machines.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs animate-pulse space-y-4">
              <div className="flex justify-between items-center">
                <div className="w-24 h-4 bg-slate-200 rounded-md" />
                <div className="w-16 h-4 bg-slate-200 rounded-full" />
              </div>
              <div className="h-12 bg-slate-200 rounded-2xl w-1/2 mx-auto my-4" />
              <div className="space-y-2">
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredMachines.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs flex flex-col items-center justify-center my-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <Cpu className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Tidak ada mesin ditemukan</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Tidak ditemukan mesin yang cocok dengan kata kunci <strong>"{searchQuery}"</strong> atau filter <strong>"{statusFilter}"</strong>.
          </p>
          {(searchQuery || statusFilter !== "Semua") && (
            <button
              onClick={() => { setSearchQuery(""); setStatusFilter("Semua"); }}
              className="mt-4 px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl transition-all hover:bg-slate-800 cursor-pointer shadow-sm"
            >
              Reset Filter & Pencarian
            </button>
          )}
        </div>
      ) : (
        /* ── Machine Cards Grid ── */
        <div
          data-tour="machine-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          {filteredMachines.map((machine) => {
            const isOperating = machine.status === "Beroperasi";
            const isIdle = machine.status === "Idle";
            const isInactive = machine.status === "Tidak Aktif";

            return (
              <div
                key={machine.mesin_id}
                onClick={() => router.push(`/machines/${machine.mesin_id}`)}
                className={`group bg-white rounded-2xl shadow-xs border transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 ${
                  isInactive
                    ? "border-slate-200 bg-slate-50/50"
                    : isIdle
                    ? "border-amber-200 hover:border-amber-400"
                    : "border-emerald-200 hover:border-emerald-400"
                }`}
              >
                {/* Header Status Bar */}
                <div
                  className={`px-4 py-3 border-b flex justify-between items-center ${
                    isOperating
                      ? "bg-emerald-50/80 border-emerald-100"
                      : isIdle
                      ? "bg-amber-50/80 border-amber-100"
                      : "bg-slate-100/80 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      {isOperating && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      )}
                      <span
                        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                          isOperating ? "bg-emerald-500" : isIdle ? "bg-amber-500" : "bg-slate-400"
                        }`}
                      />
                    </span>
                    <span
                      className={`text-xs font-black uppercase tracking-wider ${
                        isOperating ? "text-emerald-800" : isIdle ? "text-amber-800" : "text-slate-600"
                      }`}
                    >
                      {machine.status}
                    </span>
                  </div>

                  {machine.last_input_time !== "-" && (
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow-2xs ${
                        isOperating
                          ? "bg-white text-emerald-700 border border-emerald-200"
                          : isIdle
                          ? "bg-white text-amber-700 border border-amber-200"
                          : "bg-slate-200/80 text-slate-600"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{machine.last_input_time}</span>
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="text-center my-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                      Nomor Mesin
                    </span>
                    <div
                      className={`text-3xl sm:text-4xl font-black tracking-tight font-mono ${
                        isOperating
                          ? "text-slate-900"
                          : isIdle
                          ? "text-slate-800"
                          : "text-slate-400"
                      }`}
                    >
                      {machine.mesin_id}
                    </div>
                  </div>

                  <div className="space-y-2.5 mt-4">
                    {/* Operator */}
                    <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                      <span className="text-slate-500 font-medium flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Operator
                      </span>
                      <span
                        className={`font-black uppercase text-xs truncate max-w-[140px] text-right ${
                          isInactive ? "text-slate-400" : "text-slate-800"
                        }`}
                      >
                        {machine.nama_operator}
                      </span>
                    </div>

                    {/* Desain Aktif */}
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Desain Aktif</span>
                      <span
                        className={`font-bold text-[11px] px-2.5 py-0.5 rounded-md truncate max-w-[140px] ${
                          isOperating
                            ? "bg-blue-50 text-[#0070bc] border border-blue-100"
                            : isIdle
                            ? "bg-amber-50 text-amber-700 border border-amber-100"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {machine.design}
                      </span>
                    </div>

                    {/* Potongan Ke */}
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Potongan Ke</span>
                      <span
                        className={`font-black text-[11px] px-2.5 py-0.5 rounded-md ${
                          machine.potongan_ke && machine.potongan_ke !== "-"
                            ? "bg-slate-100 text-slate-800 border border-slate-200 font-mono"
                            : "text-slate-400"
                        }`}
                      >
                        {machine.potongan_ke && machine.potongan_ke !== "-" ? `#${machine.potongan_ke}` : "-"}
                      </span>
                    </div>

                    {/* Tanggal Update */}
                    <div className="flex justify-between items-center text-xs pb-1">
                      <span className="text-slate-400">Tgl Update</span>
                      <span className="text-slate-500 font-medium">
                        {machine.last_input_date !== "-" ? machine.last_input_date : "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#0070bc] group-hover:bg-blue-50/50 transition-colors">
                  <span className="flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-[#0070bc]" />
                    Analisis Blok
                  </span>
                  <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Pengaturan Default & Aturan Mesin */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden animate-scaleIn">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-[#0070bc]">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-800">
                    Pengaturan Default & Aturan Mesin
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Kelola parameter default mesin & instruksi wajib nomor blok.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Sub Header Tabs */}
            <div className="px-6 pt-3 pb-0 bg-slate-50/50 border-b border-slate-200/60 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfigTab("MACHINES")}
                className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                  configTab === "MACHINES"
                    ? "border-[#0070bc] text-[#0070bc] bg-white shadow-xs"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Cpu className="w-4 h-4" />
                <span>Parameter Default Mesin</span>
              </button>

              <button
                type="button"
                onClick={() => setConfigTab("BLOCK_REQUIRED")}
                className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                  configTab === "BLOCK_REQUIRED"
                    ? "border-[#0070bc] text-[#0070bc] bg-white shadow-xs"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Box className="w-4 h-4 text-rose-600" />
                <span>Aturan Wajib Nomor Blok ({requiredBlockDefects.length})</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
              {configTab === "MACHINES" ? (
                <>
                  <div className="text-xs text-slate-600 bg-blue-50/80 p-3.5 rounded-2xl border border-blue-100 flex items-start gap-2.5">
                    <SlidersHorizontal className="w-4 h-4 text-[#0070bc] shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Catatan:</strong> Parameter ini otomatis digunakan sebagai default saat Admin membuat Jadwal Produksi baru atau saat Operator menginput laporan.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {configs.map((cfg, idx) => (
                      <div
                        key={cfg.nomor_mc}
                        className="flex flex-col gap-2.5 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="bg-slate-900 text-white font-black px-3 py-1 rounded-xl text-xs tracking-wider font-mono">
                            {cfg.nomor_mc}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                          <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                            <span className="text-[11px] font-bold text-slate-500">
                              PCS:
                            </span>
                            <input
                              type="number"
                              min="1"
                              max="50"
                              value={cfg.default_pcs}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                const newConfigs = [...configs];
                                newConfigs[idx].default_pcs = val;
                                setConfigs(newConfigs);
                              }}
                              className="w-12 h-7 text-center rounded-md font-black text-[#0070bc] bg-slate-50 focus:bg-white outline-none text-xs"
                            />
                          </div>

                          <div className="flex items-center p-0.5 bg-slate-200/70 rounded-xl border border-slate-200">
                            <button
                              type="button"
                              onClick={() => {
                                const newConfigs = [...configs];
                                newConfigs[idx].input_type = "PANEL";
                                setConfigs(newConfigs);
                              }}
                              className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                cfg.input_type === "PANEL"
                                  ? "bg-[#0070bc] text-white shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              PANEL
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newConfigs = [...configs];
                                newConfigs[idx].input_type = "METER";
                                setConfigs(newConfigs);
                              }}
                              className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                cfg.input_type === "METER"
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              METER
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* TAB 2: BLOCK REQUIREMENT CONFIGURATION */
                <div className="space-y-4">
                  <div className="text-xs text-rose-950 bg-rose-50/80 p-3.5 rounded-2xl border border-rose-200/80 flex items-start gap-2.5">
                    <Box className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Aturan Wajib Nomor Blok:</strong> Centang detail masalah di bawah yang <strong>WAJIB BLOK</strong>. Jika diatur <strong>TIDAK BLOK</strong>, kolom isian nomor blok tidak akan muncul di form operator.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {Object.entries(MASTER_PROBLEM_CATEGORIES).map(([catCode, catGroup]) => (
                      <div key={catCode} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                        <div className="flex items-center justify-between mb-2.5 border-b border-slate-200 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="bg-slate-900 text-white font-black text-xs px-2.5 py-0.5 rounded-md">
                              {catCode}
                            </span>
                            <span className="text-xs font-black text-slate-800">{catGroup.desc}</span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-400">
                            {catGroup.items.filter((item) => requiredBlockDefects.includes(item)).length} / {catGroup.items.length} Wajib
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {catGroup.items.map((item) => {
                            const isReq = requiredBlockDefects.includes(item);
                            return (
                              <button
                                type="button"
                                key={item}
                                onClick={() => toggleRequiredDefect(item)}
                                className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between select-none active:scale-95 ${
                                  isReq
                                    ? "bg-rose-50 border-rose-300 text-rose-950 shadow-xs"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                }`}
                              >
                                <span className="pr-2 text-left">{item}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                                    isReq
                                      ? "bg-rose-600 text-white"
                                      : "bg-slate-200 text-slate-600"
                                  }`}
                                >
                                  {isReq ? "WAJIB BLOK" : "TIDAK BLOK"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Ubah parameter di atas, lalu klik <strong>Selesai & Simpan Semua</strong>.
              </p>
              <div className="flex items-center gap-2 ml-auto sm:ml-0 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={savingConfig}
                  onClick={async () => {
                    setSavingConfig(true);
                    try {
                      const mapPcs: Record<string, number> = {};
                      const mapTypes: Record<string, string> = {};
                      configs.forEach((cfg) => {
                        if (cfg.nomor_mc) {
                          const mcRaw = cfg.nomor_mc.trim();
                          const mcUpper = mcRaw.toUpperCase();
                          mapPcs[mcRaw] = cfg.default_pcs;
                          mapPcs[mcUpper] = cfg.default_pcs;
                          mapTypes[mcRaw] = cfg.input_type;
                          mapTypes[mcUpper] = cfg.input_type;
                        }
                      });
                      localStorage.setItem("dji_machine_configs", JSON.stringify(mapPcs));
                      localStorage.setItem("dji_machine_input_types", JSON.stringify(mapTypes));
                      localStorage.setItem("dji_required_block_defects", JSON.stringify(requiredBlockDefects));
                      window.dispatchEvent(new Event("storage_dji_required_block_defects"));
                    } catch (e) {}

                    await upsertAllMachineConfigs(configs);
                    await saveBlockRequiredDefects(requiredBlockDefects);

                    setSavingConfig(false);
                    setIsConfigModalOpen(false);
                    showToast("Seluruh Konfigurasi & Aturan Wajib Nomor Blok Berhasil Disimpan!");
                  }}
                  className="px-6 py-2.5 rounded-xl bg-[#0070bc] hover:bg-[#004777] active:scale-95 text-white text-xs font-bold shadow-md shadow-sky-900/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingConfig ? "Menyimpan..." : "Selesai & Simpan Semua"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Modern Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700/80 animate-fadeIn">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-black text-white">{toastMessage}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Perubahan telah tersimpan secara otomatis.</p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <ProductTour
        steps={MACHINE_TOUR_STEPS}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />
    </div>
  );
}
