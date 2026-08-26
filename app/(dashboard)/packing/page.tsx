"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { 
  getAvailablePackingQueue, 
  saveBatchPackingSession, 
  getPackingHistory, 
  deletePackingBatch,
  PackingQueueItem,
  PackingBatchRecord
} from "@/actions/packing-actions";
import { 
  Package, 
  Search, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Play, 
  Pause, 
  RotateCcw, 
  User, 
  Calendar, 
  Cpu, 
  Scissors, 
  Layers, 
  History, 
  Sparkles, 
  Trash2, 
  Check, 
  X,
  ListChecks,
  Boxes,
  Layers2,
  CheckCheck
} from "lucide-react";
import { REGISTERED_MACHINES } from "@/lib/constants";

// Standard Inspector Names (matching QC, Mending & Final Inspection)
const QC_INSPECTOR_NAMES = [
  "Nurdin",
  "Hendra",
  "Taufik",
  "Dede Oting",
  "Andri",
  "Yudi"
];

// Format seconds into HH:MM:SS
const formatDuration = (totalSeconds: number) => {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

// Format human friendly duration
const formatHumanDuration = (totalSeconds: number) => {
  if (totalSeconds < 60) return `${totalSeconds} dtk`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins < 60) {
    return secs > 0 ? `${mins}m ${secs}d` : `${mins} mnt`;
  }
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}j ${remMins}m` : `${hrs} jam`;
};

// Format time to HH:mm
const getCurrentTimeHHMM = () => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
};

export default function PackingPage() {
  const { user } = useAuth();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");

  // Queue state
  const [queueItems, setQueueItems] = useState<PackingQueueItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);

  // History state
  const [historyItems, setHistoryItems] = useState<PackingBatchRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Filter state for Queue
  const [queueSearch, setQueueSearch] = useState("");
  const [filterMesin, setFilterMesin] = useState("");

  // Filter state for History
  const [historyFilters, setHistoryFilters] = useState({
    tanggal: "",
    nomor_mc: "",
    potongan_ke: "",
    petugas: "",
  });

  // ==================== TIME & TIMERS (LOGIKA INSPEK/MENDING) ====================
  const [startTime, setStartTime] = useState<string>("");
  const [finishTime, setFinishTime] = useState<string>("");
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // ==================== OPERATOR & FORM INPUTS ====================
  const [petugas1, setPetugas1] = useState<string>("");
  const [petugas2, setPetugas2] = useState<string>("");
  const [keterangan, setKeterangan] = useState<string>("");

  // ==================== SELECTIONS (KOTAK-KOTAK KECIL) ====================
  const [selectedQueueIds, setSelectedQueueIds] = useState<Set<number>>(new Set());

  // ==================== SUMMARY MODAL STATE ====================
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<PackingBatchRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load Queue on mount
  useEffect(() => {
    fetchQueue();
  }, []);

  // Set default logged in user if match inspector list
  useEffect(() => {
    if (user?.fullName && !petugas1) {
      const match = QC_INSPECTOR_NAMES.find(
        (name) => name.toLowerCase() === user.fullName.toLowerCase()
      );
      if (match) {
        setPetugas1(match);
      }
    }
  }, [user]);

  // Load History when tab changes
  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab, historyFilters]);

  // Timer Tick (Stopwatch Realtime)
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const fetchQueue = async () => {
    setIsLoadingQueue(true);
    try {
      const res = await getAvailablePackingQueue();
      if (res.success && res.data) {
        setQueueItems(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await getPackingHistory(historyFilters);
      if (res.success && res.data) {
        setHistoryItems(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Stopwatch Controls (Mulai / Pause / Lanjutkan / Reset)
  const handleStartTimer = () => {
    if (!startTime) {
      setStartTime(getCurrentTimeHHMM());
    }
    setTimerRunning(true);
  };

  const handlePauseTimer = () => {
    setTimerRunning(false);
  };

  const handleResetTimer = () => {
    if (elapsedSeconds > 0) {
      if (!confirm("Reset waktu stopwatch kembali ke 0?")) return;
    }
    setTimerRunning(false);
    setElapsedSeconds(0);
    setStartTime("");
    setFinishTime("");
  };

  // Toggle selection for a small tile/card
  const handleToggleCard = (id: number) => {
    setSelectedQueueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all / Deselect all
  const handleSelectAll = (itemsToSelect: PackingQueueItem[]) => {
    const allSelected = itemsToSelect.every((i) => selectedQueueIds.has(i.id));
    setSelectedQueueIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        itemsToSelect.forEach((i) => next.delete(i.id));
      } else {
        itemsToSelect.forEach((i) => next.add(i.id));
      }
      return next;
    });
  };

  // Open Summary Modal
  const handleOpenSummaryModal = () => {
    if (selectedQueueIds.size === 0) {
      alert("Pilih minimal satu kotak potongan kain yang telah di-pack!");
      return;
    }
    if (!petugas1) {
      alert("Pilih nama Petugas Packing terlebih dahulu!");
      return;
    }

    // Auto set finish time if empty
    if (!finishTime) {
      setFinishTime(getCurrentTimeHHMM());
    }
    // Pause stopwatch
    setTimerRunning(false);
    setErrorMessage(null);
    setIsSummaryModalOpen(true);
  };

  // Save the packing session from summary modal
  const handleConfirmSave = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const startStr = startTime || getCurrentTimeHHMM();
      const finishStr = finishTime || getCurrentTimeHHMM();

      const selectedItemsList = queueItems
        .filter((item) => selectedQueueIds.has(item.id))
        .map((item) => ({
          final_inspection_batch_id: item.id,
          nomor_mc: item.nomor_mc,
          design_id: item.design_id,
          potongan_ke: item.potongan_ke,
          pcs_index: item.pcs_index,
        }));

      const res = await saveBatchPackingSession({
        selected_items: selectedItemsList,
        tanggal_packing: todayStr,
        petugas_packing: petugas1,
        petugas_packing_2: petugas2 || undefined,
        start_packing: startStr,
        finish_packing: finishStr,
        elapsed_seconds: elapsedSeconds,
        pause_seconds: 0,
        keterangan_packing: keterangan || undefined,
      });

      if (res.success) {
        // Reset states
        setTimerRunning(false);
        setElapsedSeconds(0);
        setStartTime("");
        setFinishTime("");
        setKeterangan("");
        setSelectedQueueIds(new Set());
        setIsSummaryModalOpen(false);

        setSuccessToast(
          `Data packing berhasil disimpan! ${selectedItemsList.length} potongan kain selesai dicatat.`
        );
        setTimeout(() => setSuccessToast(null), 5000);
        fetchQueue();
      } else {
        setErrorMessage(res.error || "Gagal menyimpan data packing.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePackingRecord = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deletePackingBatch(itemToDelete.id);
      if (res.success) {
        setItemToDelete(null);
        fetchHistory();
        fetchQueue();
        setSuccessToast("Data packing berhasil dibatalkan dan dikembalikan ke antrian.");
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        alert(res.error || "Gagal menghapus data packing");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Queue Cards
  const filteredQueue = useMemo(() => {
    return queueItems.filter((item) => {
      if (filterMesin && item.nomor_mc !== filterMesin) {
        return false;
      }
      if (queueSearch.trim()) {
        const q = queueSearch.toLowerCase();
        const matchMc = item.nomor_mc.toLowerCase().includes(q);
        const matchDesign = item.design_id.toLowerCase().includes(q);
        const matchPot = String(item.potongan_ke).includes(q);
        if (!matchMc && !matchDesign && !matchPot) return false;
      }
      return true;
    });
  }, [queueItems, filterMesin, queueSearch]);

  // Selected Queue Items
  const selectedItemsList = useMemo(() => {
    return queueItems.filter((item) => selectedQueueIds.has(item.id));
  }, [queueItems, selectedQueueIds]);

  // History KPIs
  const historyStats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayItems = historyItems.filter((h) => h.tanggal_packing === today);
    const totalPacked = historyItems.length;
    const todayPacked = todayItems.length;

    const totalSeconds = historyItems.reduce((acc, h) => acc + (h.elapsed_seconds || 0), 0);
    const avgSeconds = totalPacked > 0 ? Math.round(totalSeconds / totalPacked) : 0;

    return {
      totalPacked,
      todayPacked,
      avgDuration: formatHumanDuration(avgSeconds),
      totalDuration: formatHumanDuration(totalSeconds),
    };
  }, [historyItems]);

  return (
    <div className="w-full max-w-[1600px] mx-auto pb-28 animate-fadeIn">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-xs font-bold">{successToast}</span>
        </div>
      )}

      {/* HEADER CARD */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-200 text-white shrink-0">
            <Package className="w-7 h-7 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Pengerjaan & Tracking Packing
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 uppercase tracking-wide">
                Sesi Keseluruhan
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-500 mt-0.5">
              Jalankan stopwatch saat pengerjaan packing, lalu klik kotak potongan kain yang selesai dikerjakan.
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "queue"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            Antrian & Stopwatch
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
              {queueItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "history"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="w-3.5 h-3.5 text-sky-600" />
            Riwayat Packing
          </button>
        </div>
      </div>

      {/* ===================== TAB 1: ANTRIAN & STOPWATCH ===================== */}
      {activeTab === "queue" && (
        <div className="space-y-6 animate-fadeIn">
          {/* SECTION 1: KONTROL WAKTU & PETUGAS (LOGIKA SAMA DENGAN QC & MENDING) */}
          <div className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-200">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              
              {/* Kolom Stopwatch Realtime (5 Kolom) */}
              <div className="lg:col-span-5 bg-linear-to-br from-slate-900 via-slate-800 to-slate-950 rounded-2xl p-5 text-white shadow-md border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">
                      Stopwatch Realtime
                    </span>
                  </div>
                  {timerRunning ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Berjalan
                    </span>
                  ) : elapsedSeconds > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Dijeda
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-700 text-slate-300">
                      Standby
                    </span>
                  )}
                </div>

                <div className="text-4xl sm:text-5xl font-black font-mono tracking-wider text-amber-400 py-1 text-center drop-shadow-md">
                  {formatDuration(elapsedSeconds)}
                </div>

                {/* Kontrol Stopwatch */}
                <div className="flex items-center justify-center gap-2 pt-3 border-t border-slate-800 mt-2">
                  {!timerRunning ? (
                    <button
                      type="button"
                      onClick={handleStartTimer}
                      className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/20"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {elapsedSeconds > 0 ? "Lanjutkan" : "Mulai Stopwatch"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePauseTimer}
                      className="px-5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      Jeda (Pause)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleResetTimer}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                    title="Reset Timer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                </div>
              </div>

              {/* Kolom Form Waktu & Petugas (7 Kolom) */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Waktu Mulai */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">
                    Waktu Mulai
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none w-full bg-slate-50 transition-all"
                  />
                </div>

                {/* Waktu Selesai */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">
                    Waktu Selesai
                  </label>
                  <input
                    type="time"
                    value={finishTime}
                    onChange={(e) => setFinishTime(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none w-full bg-slate-50 transition-all"
                  />
                </div>

                {/* Petugas 1 (Dropdown) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                    Petugas Packing 1 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={petugas1}
                    onChange={(e) => setPetugas1(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none w-full bg-white transition-all cursor-pointer"
                  >
                    <option value="">-- Pilih Petugas --</option>
                    {QC_INSPECTOR_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Petugas 2 (Dropdown) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                    Petugas Packing 2 (Helper)
                  </label>
                  <select
                    value={petugas2}
                    onChange={(e) => setPetugas2(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none w-full bg-white transition-all cursor-pointer"
                  >
                    <option value="">-- Pilih Petugas (Opsional) --</option>
                    {QC_INSPECTOR_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Keterangan */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">
                    Catatan / Keterangan Packing (Opsional)
                  </label>
                  <input
                    type="text"
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    placeholder="Contoh: Polybag tebal, label barcode lengkap, dll..."
                    className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none w-full bg-slate-50 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: KOTAK-KOTAK KECIL DAFTAR KAIN SIAP PACKING */}
          <div className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-200">
            {/* Header & Filter Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-amber-500" />
                  Daftar Kain Siap Packing
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Klik kotak-kotak di bawah untuk memilih potongan kain mana saja yang telah selesai Anda pack.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Search Mesin / Potongan */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder="Cari mesin / potongan..."
                    className="h-9 pl-8 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium outline-none w-44 focus:bg-white focus:border-amber-500"
                  />
                </div>

                {/* Filter Mesin Dropdown */}
                <select
                  value={filterMesin}
                  onChange={(e) => setFilterMesin(e.target.value)}
                  className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="">Semua Mesin</option>
                  {REGISTERED_MACHINES.map((m) => (
                    <option key={m} value={m}>Mesin {m}</option>
                  ))}
                </select>

                {/* Tombol Pilih Semua */}
                {filteredQueue.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSelectAll(filteredQueue)}
                    className="h-9 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    {filteredQueue.every((i) => selectedQueueIds.has(i.id))
                      ? "Batal Semua"
                      : "Pilih Semua"}
                  </button>
                )}

                <span className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-black shadow-2xs">
                  {selectedQueueIds.size} / {filteredQueue.length} Terpilih
                </span>
              </div>
            </div>

            {/* KOTAK-KOTAK KECIL GRID */}
            {isLoadingQueue ? (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
                <p className="text-xs font-bold text-slate-600">Memuat Potongan Siap Pack...</p>
              </div>
            ) : filteredQueue.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-3 border border-amber-100 text-amber-400">
                  <Package className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-black text-slate-700">Tidak Ada Potongan Tersedia</h4>
                <p className="text-xs text-slate-400 mt-0.5">Semua potongan yang lulus Final Inspek sudah di-pack.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {filteredQueue.map((item) => {
                  const isSelected = selectedQueueIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleCard(item.id)}
                      className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? "bg-emerald-50 border-2 border-emerald-500 shadow-md shadow-emerald-500/10 scale-[1.02]"
                          : "bg-white border-slate-200 hover:border-amber-400 hover:shadow-md hover:scale-[1.01]"
                      }`}
                    >
                      {/* Checkmark Indicator */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}

                      {/* Header Badge (Mesin & Potongan) */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 bg-slate-900 text-amber-300 font-black rounded-lg text-[10px]">
                          {item.nomor_mc}
                        </span>
                        <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 font-black rounded-lg text-[10px]">
                          Ke-{item.potongan_ke}
                        </span>
                      </div>

                      {/* Desain */}
                      <div className="font-black text-slate-800 text-xs tracking-tight truncate" title={item.design_id}>
                        {item.design_id}
                      </div>

                      {/* Footer Info */}
                      <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-between border-t border-slate-100 pt-1.5">
                        <span>{item.total_panel} {item.is_meteran ? "Mtr" : "Pnl"}</span>
                        <span className="text-emerald-700 font-extrabold">A:{item.final_grade_a}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* STICKY BOTTOM ACTION BAR */}
          {selectedQueueIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-6 py-3.5 rounded-full shadow-2xl border border-slate-700/60 flex items-center gap-5 animate-in slide-in-from-bottom-5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-black">
                  {selectedQueueIds.size} Potongan Dipilih
                </span>
                {elapsedSeconds > 0 && (
                  <span className="text-xs font-mono text-amber-400 ml-1">
                    (⏱️ {formatDuration(elapsedSeconds)})
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleOpenSummaryModal}
                className="px-5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                Simpan Data Packing
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 2: RIWAYAT PACKING ===================== */}
      {activeTab === "history" && (
        <div className="space-y-6 animate-fadeIn">
          {/* KPI STATS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dipack Hari Ini</p>
                <h3 className="text-2xl font-black text-slate-800">{historyStats.todayPacked} <span className="text-xs font-semibold text-slate-400">Potongan</span></h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Selesai Dipack</p>
                <h3 className="text-2xl font-black text-slate-800">{historyStats.totalPacked} <span className="text-xs font-semibold text-slate-400">Potongan</span></h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rata-rata Waktu Sesi</p>
                <h3 className="text-2xl font-black text-slate-800">{historyStats.avgDuration}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Jam Kerja Packing</p>
                <h3 className="text-2xl font-black text-slate-800">{historyStats.totalDuration}</h3>
              </div>
            </div>
          </div>

          {/* FILTER RIWAYAT */}
          <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-sky-600" />
                Filter Riwayat Packing
              </span>
              {(historyFilters.tanggal || historyFilters.nomor_mc || historyFilters.potongan_ke || historyFilters.petugas) && (
                <button
                  type="button"
                  onClick={() => setHistoryFilters({ tanggal: "", nomor_mc: "", potongan_ke: "", petugas: "" })}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Filter
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Tanggal Packing
                </label>
                <input
                  type="date"
                  value={historyFilters.tanggal}
                  onChange={(e) => setHistoryFilters({ ...historyFilters, tanggal: e.target.value })}
                  className="h-11 px-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 outline-none w-full transition-all shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-slate-400" />
                  Mesin
                </label>
                <select
                  value={historyFilters.nomor_mc}
                  onChange={(e) => setHistoryFilters({ ...historyFilters, nomor_mc: e.target.value })}
                  className="h-11 px-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 outline-none w-full transition-all cursor-pointer shadow-inner"
                >
                  <option value="">-- Semua Mesin --</option>
                  {REGISTERED_MACHINES.map((m) => (
                    <option key={m} value={m}>Mesin {m}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-slate-400" />
                  Potongan Ke
                </label>
                <input
                  type="text"
                  value={historyFilters.potongan_ke}
                  onChange={(e) => setHistoryFilters({ ...historyFilters, potongan_ke: e.target.value })}
                  placeholder="Contoh: 345..."
                  className="h-11 px-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 outline-none w-full transition-all shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Petugas Packing
                </label>
                <select
                  value={historyFilters.petugas}
                  onChange={(e) => setHistoryFilters({ ...historyFilters, petugas: e.target.value })}
                  className="h-11 px-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 outline-none w-full transition-all cursor-pointer shadow-inner"
                >
                  <option value="">-- Semua Petugas --</option>
                  {QC_INSPECTOR_NAMES.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* TABLE RIWAYAT */}
          {isLoadingHistory ? (
            <div className="bg-white rounded-[28px] p-16 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-10 h-10 text-sky-600 animate-spin mb-4" />
              <h3 className="text-lg font-black text-slate-800 mb-1">Memuat Riwayat Packing...</h3>
            </div>
          ) : historyItems.length === 0 ? (
            <div className="bg-white rounded-[28px] p-16 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100 shadow-inner">
                <History className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-700 mb-1">Belum Ada Riwayat Packing</h3>
              <p className="text-slate-500 text-xs max-w-md mx-auto font-medium">
                Pengerjaan packing yang telah selesai akan otomatis tercatat dan tersimpan di sini.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500">
                      <th className="py-3.5 px-4 font-black text-[11px] uppercase tracking-wider">Tanggal & Jam Sesi</th>
                      <th className="py-3.5 px-4 font-black text-[11px] uppercase tracking-wider">Mesin</th>
                      <th className="py-3.5 px-4 font-black text-[11px] uppercase tracking-wider">Desain</th>
                      <th className="py-3.5 px-4 font-black text-[11px] uppercase tracking-wider">Potongan</th>
                      <th className="py-3.5 px-4 font-black text-[11px] uppercase tracking-wider">Petugas Packing</th>
                      <th className="py-3.5 px-4 font-black text-[11px] uppercase tracking-wider text-center">Durasi Sesi</th>
                      <th className="py-3.5 px-4 font-black text-[11px] uppercase tracking-wider">Keterangan</th>
                      <th className="py-3.5 px-4 font-black text-[11px] uppercase tracking-wider text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {historyItems.map((record) => (
                      <tr key={record.id} className="hover:bg-sky-50/30 transition-colors">
                        <td className="py-4 px-4 font-bold text-slate-800">
                          <div>{record.tanggal_packing}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">
                            {record.start_packing} - {record.finish_packing}
                          </div>
                        </td>
                        <td className="py-4 px-4 font-bold">
                          <span className="px-3 py-1 bg-slate-900 text-amber-300 font-black rounded-xl text-xs inline-block shadow-2xs">
                            {record.nomor_mc}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-extrabold text-slate-800 text-sm tracking-tight">
                          {record.design_id}
                        </td>
                        <td className="py-4 px-4 font-bold">
                          <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-black text-xs inline-block shadow-2xs">
                            Ke-{record.potongan_ke}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{record.petugas_packing}</span>
                          </div>
                          {record.petugas_packing_2 && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Helper: {record.petugas_packing_2}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 font-black text-xs rounded-xl inline-block shadow-2xs">
                            ⏱️ {formatHumanDuration(record.elapsed_seconds)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-500 font-medium">
                          {record.keterangan_packing || "-"}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setItemToDelete(record)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                            title="Batalkan / Hapus Data Packing"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== MODAL RINGKASAN LAPORAN (SUMMARY MODAL) ===================== */}
      {isSummaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-200">
                  <ListChecks className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    Ringkasan Pengerjaan Packing
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Pastikan rincian potongan dan waktu pengerjaan sudah benar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSummaryModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Ringkasan Waktu & Stopwatch */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold">Waktu Mulai:</span>
                  <span className="font-mono font-black text-slate-800">{startTime || "-"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold">Waktu Selesai:</span>
                  <span className="font-mono font-black text-slate-800">{finishTime || "-"}</span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-slate-200 pt-2">
                  <span className="text-slate-500 font-bold">Total Durasi Stopwatch:</span>
                  <span className="font-mono font-black text-emerald-700 text-sm">
                    {formatDuration(elapsedSeconds)} ({formatHumanDuration(elapsedSeconds)})
                  </span>
                </div>
              </div>

              {/* Ringkasan Petugas */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="text-xs flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Petugas 1 (Utama):</span>
                  <span className="font-black text-slate-800">{petugas1}</span>
                </div>
                {petugas2 && (
                  <div className="text-xs flex items-center justify-between">
                    <span className="text-slate-500 font-bold">Petugas 2 (Helper):</span>
                    <span className="font-black text-slate-800">{petugas2}</span>
                  </div>
                )}
                {keterangan && (
                  <div className="text-xs flex items-center justify-between border-t border-slate-200 pt-1.5">
                    <span className="text-slate-500 font-bold">Catatan:</span>
                    <span className="font-medium text-slate-700 italic">{keterangan}</span>
                  </div>
                )}
              </div>

              {/* Rincian Potongan Terpilih (Chips) */}
              <div>
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block mb-2">
                  Potongan yang Dipack ({selectedItemsList.length} Potongan):
                </label>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
                  {selectedItemsList.map((item) => (
                    <div
                      key={item.id}
                      className="px-2.5 py-1 bg-white rounded-xl border border-slate-200 text-xs font-extrabold text-slate-800 flex items-center gap-1.5 shadow-2xs"
                    >
                      <span className="px-1.5 py-0.5 bg-slate-900 text-amber-300 rounded-md text-[10px]">
                        {item.nomor_mc}
                      </span>
                      <span>Ke-{item.potongan_ke}</span>
                      <span className="text-[10px] text-slate-400 font-medium">({item.design_id})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setIsSummaryModalOpen(false)}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
              >
                Kembali
              </button>

              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-lg shadow-emerald-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 stroke-[3]" />
                )}
                Konfirmasi & Simpan Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== DELETE CONFIRMATION MODAL ===================== */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-[28px] max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-base font-black text-slate-800">
                Batalkan Data Packing?
              </h3>
            </div>

            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Apakah Anda yakin ingin menghapus data packing untuk Mesin{" "}
              <strong>{itemToDelete.nomor_mc}</strong> Potongan{" "}
              <strong>Ke-{itemToDelete.potongan_ke}</strong>? Potongan kain ini akan
              dikembalikan ke antrian siap pack.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeletePackingRecord}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Ya, Batalkan Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
