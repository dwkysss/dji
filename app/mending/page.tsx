"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Loader2,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle,
  Eye,
  Scissors,
  Clock,
  HelpCircle,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Package,
  Box,
  Edit3,
  Trash2,
  Pause,
  Play,
  Timer,
  RotateCcw,
} from "lucide-react";
import ProductTour, { ProductTourStep } from "@/components/ProductTour";
import MendingModal from "@/components/forms/MendingModal";
import ProductionDetailModal from "@/components/ProductionDetailModal";
import HeaderSummaryCard from "@/components/forms/HeaderSummaryCard";
import CompactHeaderCard from "@/components/forms/CompactHeaderCard";
import SessionTimerHeader from "@/components/forms/SessionTimerHeader";
import { formatHHMM, formatTimerSeconds } from "@/lib/shift-utils";
import { createProblemDetail, getProblemCategories, getProblemDetailsGrouped } from "@/actions/problem-detail-actions";
import {
  getPendingMendingDetailsByDate,
  getMendingDetailsByGroup,
} from "@/actions/mending-actions";
import { insertMissingPanel, deleteProductionDetailRow, addQCDefectDetail } from "@/actions/qc-actions";
import { getEmployeeHistoryDetail } from "@/actions/employee-actions";
import { getBlockRequiredDefects } from "@/actions/machine-config-actions";
import {
  getTimerSession,
  upsertTimerSession,
  deleteTimerSession,
  getActiveTimerSessions,
} from "@/actions/timer-actions";
import MeterMendingTable from "./components/MeterMendingTable";
import PanelMendingTable from "./components/PanelMendingTable";

const DEFAULT_PROBLEM_DETAILS: Record<string, string[]> = {
  A: ["L1/L2/L3 Benang timbul putus", "Benang lolos", "Bolong corak", "Benang narik/Kendor", "Benang Nyilang", "Perbaikan/Beset benang Dasar", "Benang Kejepit/Jebol/Kusut", "Jalur benang"],
  B: ["Jarum pattern patah/bengkok", "Ganti Jacquard", "Ganti jarum Compoun Nedle, pattern", "Ngampul", "Ganti dari scaloop ke non scaloop atau sebaliknya", "Ngegaris/Stopline", "Keluar Jarum", "Ganti String bar", "Ganti PBO", "Pressan As beam kendor", "Tensi tensioner"],
  C: ["Loading design/Ganti Design", "Perbaikan corak/revisi", "Salah ganti design", "Error design", "Proofing/PCB", "Ganti Pattern Disk", "Ganti pick"],
  D: ["Ganti benang dasar L1/L2", "Salah ganti benang dasar", "Ganti benang Pattern Linner", "Ganti benang Pattern Heavy", "Ganti benang Pattern Shadow", "Ganti benang pattern keseluruhan (L,H,S)", "salah ganti benang pattern", "Ngelancarin", "Over Cone/Rewind", "Tunggu benang dasar dari warping", "Tunggu benang (benang belum datang)"],
  E: ["Error Servo Drive", "Ganti motor servo", "Sensor Benang/Laser Stop", "Perbaikan Eletrik lainnya", "Konsleting", "Perbaikan listrik"],
  F: ["Perbaikan cilynder Angin", "Ganti Bellow", "Perbaikan gear/Take Up Roll", "Ganti rantai/pertensi", "Ganti Black grip roll", "Ganti Oli", "Pelumasan/greace pada mesin", "Ganti Vanbelt", "Perawatan Panel Listrik", "Servis Overhaul"],
  G: ["Hari Libur", "Tidak ada order", "Tunggu info", "Demo", "Bencana/gempa/banjir", "Istirahat selama buka puasa"]
};

const DEFAULT_PROBLEM_CATEGORIES = [
  { id: "A", name: "Cacat Kain / Benang" },
  { id: "B", name: "Masalah Mesin / Jarum" },
  { id: "C", name: "Desain / Jacquard" },
  { id: "D", name: "Bahan / Benang" },
  { id: "E", name: "Elektrik / Sensor" },
  { id: "F", name: "Mekanik / Perawatan" },
  { id: "G", name: "Lain-lain / Downtime" },
];

const cleanMeterVal = (val: any) => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  const clean = str.replace(/PCS\s*\d+\s*:\s*/gi, "");
  return clean.replace(/[a-zA-Z\s]+$/g, "").trim();
};

const getActualMeter = (item: any, h: any) => {
  if (item.meter_kain !== null && item.meter_kain !== undefined && String(item.meter_kain).trim() !== "") {
    const clean = cleanMeterVal(item.meter_kain);
    const parsed = parseFloat(clean);
    if (!isNaN(parsed)) return parsed;
  }
  if (item.detail_masalah) {
    const meterMatch = item.detail_masalah.match(/\(Titik:\s*([A-Za-z0-9\s.\-]+)\)/i);
    if (meterMatch && meterMatch[1]) {
      const clean = cleanMeterVal(meterMatch[1]);
      const parsed = parseFloat(clean);
      if (!isNaN(parsed)) return parsed;
    }
  }
  const isIstirahat = (!!item.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") || 
                       !!item.kategori_masalah?.toUpperCase().includes("ISTIRAHAT")) && 
                      !item.kategori_masalah && !item.detail_masalah;
  const isFinishReport = h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "";
  if ((isIstirahat || isFinishReport) && (h.meter_akhir || h.meter_awal)) {
    const clean = cleanMeterVal(h.meter_akhir || h.meter_awal);
    const parsed = parseFloat(clean);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
};

const MENDING_TOUR_STEPS: ProductTourStep[] = [
  {
    target: "mending-header",
    title: "Proses Mending",
    description:
      "Mulai dari halaman ini untuk memilih batch produksi yang perlu diperbaiki oleh tim mending.",
  },
  {
    target: "mending-filter",
    title: "Pilih Batch",
    description:
      "Pilih mesin, desain, dan potongan lalu tekan Cari Batch untuk memuat antrean panel atau roll yang bermasalah.",
  },
  {
    target: "mending-pcs",
    title: "Pilih PCS",
    description:
      "Setelah batch ditemukan, pilih nomor PCS yang ingin dikerjakan dan perhatikan jam mulai mending yang tercatat otomatis.",
  },
  {
    target: "mending-details",
    title: "Beri Hasil Mending",
    description:
      "Cek detail masalah, lalu pilih Grade A, B, atau BS untuk setiap item sebelum mengirim rangkuman.",
  },
  {
    target: "mending-submit",
    title: "Kirim Inspeksi",
    description:
      "Tombol ini aktif setelah semua item pada PCS terpilih sudah diberi hasil mending.",
  },
];

export default function MendingPage() {
  const [searchTanggal, setSearchTanggal] = useState("");
  const [searchMesin, setSearchMesin] = useState("");
  const [searchPotongan, setSearchPotongan] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const [allDetails, setAllDetails] = useState<any[]>([]);
  const [activeMendingPcs, setActiveMendingPcs] = useState<{ nomor_mc: string, design_id: string, potongan_ke: string, pcs_index: string } | null>(null);
  const [fullActiveMendingDetails, setFullActiveMendingDetails] = useState<any[]>([]);
  const [startMendingTime, setStartMendingTime] = useState<string>("");
  const [startTimeIso, setStartTimeIso] = useState<string | null>(null);
  const [pausedAt, setPausedAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [isPaused, setIsPaused] = useState(false);
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [activeSessionsMap, setActiveSessionsMap] = useState<Map<string, any>>(new Map());

  const fetchActiveSessions = async () => {
    const res = await getActiveTimerSessions("mending");
    if (res.success && res.data) {
      const map = new Map<string, any>();
      res.data.forEach((s: any) => {
        const key = `${s.nomor_mc}_${s.design_id}_${s.potongan_ke}_${s.pcs_index}`;
        map.set(key, s);
      });
      setActiveSessionsMap(map);
    }
  };

  const [problemCategories, setProblemCategories] = useState(DEFAULT_PROBLEM_CATEGORIES);
  const [problemDetailsMap, setProblemDetailsMap] = useState<Record<string, string[]>>(DEFAULT_PROBLEM_DETAILS);

  useEffect(() => {
    // Parallelize metadata fetching on page load
    Promise.all([
      fetchActiveSessions(),
      getProblemCategories(),
      getProblemDetailsGrouped(),
    ]).then(([_, catRes, groupRes]) => {
      if (catRes?.success && catRes.categories && catRes.categories.length > 0) {
        const mapped = catRes.categories.map((c) => ({
          id: c.kode,
          name: c.label.toLowerCase().includes("kode") ? c.label : `Kode ${c.kode}: ${c.label}`,
        }));
        setProblemCategories(mapped);
      }
      if (groupRes?.success && groupRes.grouped && Object.keys(groupRes.grouped).length > 0) {
        setProblemDetailsMap(groupRes.grouped);
      }
    }).catch((e) => console.error("Error loading parallel metadata:", e));
  }, []);

  // 1-second interval to tick nowMs when active (updates UI in real time, immune to tab throttle drift)
  useEffect(() => {
    if (!activeMendingPcs) return;
    setNowMs(Date.now());
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [activeMendingPcs]);

  // Dynamically compute real-time elapsed seconds from start time and pause duration
  const elapsedSeconds = React.useMemo(() => {
    if (!startTimeIso) return 0;
    const startMs = new Date(startTimeIso).getTime();
    if (isNaN(startMs)) return 0;

    const endMs = isPaused && pausedAt ? new Date(pausedAt).getTime() : nowMs;
    const totalSec = Math.floor((endMs - startMs) / 1000) - pauseSeconds;
    return Math.max(0, totalSec);
  }, [startTimeIso, isPaused, pausedAt, nowMs, pauseSeconds]);

  // Periodic auto-sync active timer session to DB every 5 seconds
  useEffect(() => {
    if (!activeMendingPcs) return;
    const syncInterval = setInterval(() => {
      upsertTimerSession({
        type: "mending",
        nomor_mc: activeMendingPcs.nomor_mc,
        design_id: activeMendingPcs.design_id,
        potongan_ke: activeMendingPcs.potongan_ke,
        pcs_index: activeMendingPcs.pcs_index,
        start_time: startTimeIso || undefined,
        is_paused: isPaused,
        pause_seconds: pauseSeconds,
        paused_at: pausedAt,
        elapsed_seconds: elapsedSeconds,
      });
    }, 5000);
    return () => clearInterval(syncInterval);
  }, [activeMendingPcs, startTimeIso, isPaused, pauseSeconds, pausedAt, elapsedSeconds]);

  const handleTogglePause = async () => {
    const nextPause = !isPaused;
    const nowIso = new Date().toISOString();
    let nextPauseSeconds = pauseSeconds;
    let nextPausedAt: string | null = null;

    if (nextPause) {
      // Pausing session
      nextPausedAt = nowIso;
      setPausedAt(nextPausedAt);
    } else {
      // Resuming session
      if (pausedAt) {
        const duration = Math.floor((new Date(nowIso).getTime() - new Date(pausedAt).getTime()) / 1000);
        if (duration > 0) {
          nextPauseSeconds += duration;
        }
      }
      setPauseSeconds(nextPauseSeconds);
      setPausedAt(null);
    }

    setIsPaused(nextPause);

    if (activeMendingPcs) {
      await upsertTimerSession({
        type: "mending",
        nomor_mc: activeMendingPcs.nomor_mc,
        design_id: activeMendingPcs.design_id,
        potongan_ke: activeMendingPcs.potongan_ke,
        pcs_index: activeMendingPcs.pcs_index,
        start_time: startTimeIso || undefined,
        is_paused: nextPause,
        pause_seconds: nextPauseSeconds,
        paused_at: nextPausedAt,
        elapsed_seconds: elapsedSeconds,
      });
      fetchActiveSessions();
    }
  };

  const handleCancelMending = async () => {
    if (activeMendingPcs) {
      await deleteTimerSession("mending", activeMendingPcs.nomor_mc, activeMendingPcs.design_id, activeMendingPcs.potongan_ke, activeMendingPcs.pcs_index);
      fetchActiveSessions();
    }
    setActiveMendingPcs(null);
    setFullActiveMendingDetails([]);
    setSelections({});
    setIsCancelConfirmOpen(false);
  };

  const [selections, setSelections] = useState<Record<string, string>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Tambah Panel Modal State
  const [insertPanelMode, setInsertPanelMode] = useState<"insert" | "append" | null>(null);
  const [insertPanelAt, setInsertPanelAt] = useState<string>("");
  const [isInsertingPanel, setIsInsertingPanel] = useState(false);
  const [insertPanelError, setInsertPanelError] = useState<string | null>(null);
  const [insertPanelHasDefect, setInsertPanelHasDefect] = useState(false);
  const [insertPanelIsBs, setInsertPanelIsBs] = useState(false);

  // States for defect selection within Insert Panel Modal
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<Record<string, string[]>>({});
  const [inputBloks, setInputBloks] = useState<Record<string, string>>({});
  const [insertPanelKeterangan, setInsertPanelKeterangan] = useState<string>("");
  const [manualInputDetails, setManualInputDetails] = useState<Record<string, string>>({});
  const [requiredBlockDefects, setRequiredBlockDefects] = useState<string[]>([]);

  // Add Defect Modal State (METERAN only)
  const [isDefectModalOpen, setIsDefectModalOpen] = useState(false);
  const [defectMeterKain, setDefectMeterKain] = useState("");
  const [defectKategori, setDefectKategori] = useState<string[]>([]);
  const [defectDetailMap, setDefectDetailMap] = useState<Record<string, string[]>>({});
  const [defectKeterangan, setDefectKeterangan] = useState("");
  const [isSubmittingDefect, setIsSubmittingDefect] = useState(false);
  const [defectError, setDefectError] = useState<string | null>(null);
  const [qcDefectManualInput, setQcDefectManualInput] = useState<Record<string, string>>({});

  const handleAddQcDefectManual = (catId: string) => {
    const text = (qcDefectManualInput[catId] || "").trim();
    if (!text) return;
    setDefectDetailMap((prev) => {
      const current = prev[catId] || [];
      if (current.includes(text)) return prev;
      return { ...prev, [catId]: [...current, text] };
    });
    setQcDefectManualInput((prev) => ({ ...prev, [catId]: "" }));
    try {
      createProblemDetail({ kategori: catId, nama_detail: text });
    } catch (e) {}
  };

  const handleDefectToggleKategori = (catId: string) => {
    setDefectKategori((prev) => {
      const isChecking = !prev.includes(catId);
      if (isChecking) {
        return [...prev, catId];
      } else {
        setDefectDetailMap((old) => {
          const next = { ...old };
          delete next[catId];
          return next;
        });
        return prev.filter((c) => c !== catId);
      }
    });
  };

  const handleSubmitDefect = async () => {
    if (!defectMeterKain) { setDefectError("Posisi Meter Kain wajib diisi."); return; }
    if (parseFloat(defectMeterKain) < 0) { setDefectError("Posisi Meter Kain tidak boleh bernilai negatif."); return; }
    if (defectKategori.length === 0) { setDefectError("Pilih minimal 1 Kategori Masalah."); return; }
    const missingDetails = defectKategori.some((cat) => !defectDetailMap[cat] || defectDetailMap[cat].length === 0);
    if (missingDetails) { setDefectError("Wajib memilih Detail Masalah untuk setiap Kategori yang dicentang."); return; }
    
    const meteranHeaderId = detailsToDisplay.length > 0 ? detailsToDisplay[0]?.header_id : null;
    if (!meteranHeaderId) { setDefectError("Tidak ditemukan header ID untuk batch ini."); return; }

    const m = parseFloat(defectMeterKain);
    let targetHeaderId = meteranHeaderId;
    if (!isNaN(m) && detailsToDisplay.length > 0) {
      // Cari titik data yang nilai meter kainnya <= m (inputan meter)
      const validPoints = detailsToDisplay.filter((d: any) => {
        const itemMeter = getActualMeter(d, d.production_headers);
        return itemMeter !== null && itemMeter <= m;
      });

      if (validPoints.length > 0) {
        // Ambil titik data dengan meter terdekat di bawah/sama dengan inputan meter
        const closestPoint = validPoints[validPoints.length - 1];
        if (closestPoint?.header_id || closestPoint?.production_headers?.id) {
          targetHeaderId = closestPoint.header_id || closestPoint.production_headers.id;
        }
      } else {
        // Jika m lebih kecil dari semua titik meter, ambil header dari titik data pertama
        const firstPoint = detailsToDisplay[0];
        if (firstPoint?.header_id || firstPoint?.production_headers?.id) {
          targetHeaderId = firstPoint.header_id || firstPoint.production_headers.id;
        }
      }
    }

    if (!targetHeaderId) { setDefectError("Tidak ditemukan header ID untuk batch ini."); return; }

    setIsSubmittingDefect(true);
    setDefectError(null);
    try {
      const combinedDetailsList: string[] = [];
      defectKategori.forEach((cat) => {
        const details = [...(defectDetailMap[cat] || [])];
        const manual = (qcDefectManualInput[cat] || "").trim();
        if (manual && !details.includes(manual)) {
          details.push(manual);
          try { createProblemDetail({ kategori: cat, nama_detail: manual }); } catch (e) {}
        }
        if (details.length > 0) {
          combinedDetailsList.push(details.join(", "));
        }
      });
      const combinedDetails = combinedDetailsList.join(" | ");

      const res = await addQCDefectDetail({
        headerId: targetHeaderId,
        meterKain: defectMeterKain,
        kategoriMasalah: defectKategori,
        detailMasalah: combinedDetails || undefined,
        keteranganCacat: defectKeterangan || undefined,
        pcsIndex: activeMendingPcs ? parseInt(activeMendingPcs.pcs_index) : undefined,
        finalInspectionId: 3,
      });

      if (res.success && activeMendingPcs) {
        setIsDefectModalOpen(false);
        setDefectMeterKain(""); setDefectKategori([]); setDefectDetailMap({}); setDefectKeterangan(""); setQcDefectManualInput({});
        await refreshActiveMendingDetails(activeMendingPcs.nomor_mc, activeMendingPcs.design_id, activeMendingPcs.potongan_ke, activeMendingPcs.pcs_index);
      } else {
        setDefectError(res.error || "Gagal menyimpan temuan cacat.");
      }
    } catch (err: any) {
      setDefectError(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmittingDefect(false);
    }
  };

  useEffect(() => {
    const loadRequiredDefects = async () => {
      const saved = localStorage.getItem("dji_required_block_defects");
      if (saved) {
        try {
          setRequiredBlockDefects(JSON.parse(saved));
        } catch (e) {}
      }
      const res = await getBlockRequiredDefects();
      if (res.success && res.data) {
        setRequiredBlockDefects(res.data);
        try {
          localStorage.setItem("dji_required_block_defects", JSON.stringify(res.data));
        } catch (e) {}
      }
    };
    loadRequiredDefects();
    window.addEventListener("storage_dji_required_block_defects", loadRequiredDefects);
    return () => window.removeEventListener("storage_dji_required_block_defects", loadRequiredDefects);
  }, []);

  const handleAddPanelManualDetail = (catId: string) => {
    const text = (manualInputDetails[catId] || "").trim();
    if (!text) return;
    setSelectedDetails((prev) => {
      const current = prev[catId] || [];
      if (current.includes(text)) return prev;
      return { ...prev, [catId]: [...current, text] };
    });
    setManualInputDetails((prev) => ({ ...prev, [catId]: "" }));
  };

  const handleInsertPanel = async () => {
    setIsInsertingPanel(true);
    setInsertPanelError(null);

    try {
      if (!fullActiveMendingDetails || fullActiveMendingDetails.length === 0) {
        setInsertPanelError("Tidak ditemukan rincian data.");
        setIsInsertingPanel(false);
        return;
      }

      const sortedBatchDetails = [...fullActiveMendingDetails].sort((a: any, b: any) => {
        const pA = parseInt(a.production_headers?.panel_no || "0");
        const pB = parseInt(b.production_headers?.panel_no || "0");
        return pA - pB;
      });

      let targetHeaderId = sortedBatchDetails[0]?.production_headers?.id;
      if (insertPanelMode === "insert" && insertPanelAt) {
        const targetPanelNo = parseInt(insertPanelAt);
        const targetDetail = sortedBatchDetails.find(d => parseInt(d.production_headers?.panel_no || "0") === targetPanelNo);
        if (targetDetail) {
          targetHeaderId = targetDetail.production_headers?.id;
        } else {
          const precedingDetails = sortedBatchDetails.filter(d => parseInt(d.production_headers?.panel_no || "0") < targetPanelNo);
          if (precedingDetails.length > 0) {
            targetHeaderId = precedingDetails[precedingDetails.length - 1].production_headers?.id;
          }
        }
      } else if (insertPanelMode === "append" && sortedBatchDetails.length > 0) {
        targetHeaderId = sortedBatchDetails[sortedBatchDetails.length - 1]?.production_headers?.id;
      }

      if (!targetHeaderId) {
        setInsertPanelError("Header ID tidak ditemukan.");
        setIsInsertingPanel(false);
        return;
      }

      let kategoriStr: string | undefined = undefined;
      let detailStr: string | undefined = undefined;

      if (insertPanelHasDefect && selectedCategories.length > 0) {
        kategoriStr = selectedCategories.join(", ");
        const detailParts: string[] = [];
        selectedCategories.forEach((catId) => {
          const details = [...(selectedDetails[catId] || [])];
          const manual = (manualInputDetails[catId] || "").trim();
          if (manual && !details.includes(manual)) {
            details.push(manual);
            try { createProblemDetail({ kategori: catId, nama_detail: manual }); } catch (e) {}
          }
          if (details.length > 0) {
            detailParts.push(details.join(", "));
          }
        });
        if (detailParts.length > 0) {
          detailStr = detailParts.join(" | ");
        }
      }

      const keteranganParts: string[] = [];
      const bloksList: string[] = [];
      selectedCategories.forEach((catId) => {
        if ((catId === "A" || catId === "B") && inputBloks[catId]?.trim()) {
          bloksList.push(inputBloks[catId].trim());
        }
      });
      if (bloksList.length > 0) {
        keteranganParts.push(bloksList.join(", "));
      }
      if (insertPanelKeterangan?.trim()) {
        keteranganParts.push(insertPanelKeterangan.trim());
      }

      const targetPcsIndex = activeMendingPcs ? parseInt(activeMendingPcs.pcs_index) : 1;
      const targetFinalInspectionId = insertPanelMode === "insert" && insertPanelIsBs
        ? 4
        : (selectedCategories.length > 0 ? 3 : (fullActiveMendingDetails[0]?.final_inspection_id || 1));

      const res = await insertMissingPanel({
        refHeaderId: targetHeaderId,
        insertAt: insertPanelMode === "insert" ? parseInt(insertPanelAt) : undefined,
        appendToEnd: insertPanelMode === "append",
        pcsIndex: targetPcsIndex,
        kategoriMasalah: selectedCategories.length > 0 ? selectedCategories : undefined,
        detailMasalah: detailStr,
        keteranganCacat: keteranganParts.join(", ") || undefined,
        isBs: insertPanelMode === "insert" && insertPanelIsBs,
        finalInspectionId: targetFinalInspectionId,
      });

      if (res.success && activeMendingPcs) {
        setInsertPanelMode(null);
        setInsertPanelAt("");
        setInsertPanelHasDefect(false);
        setInsertPanelIsBs(false);
        setSelectedCategories([]);
        setSelectedDetails({});
        setInputBloks({});
        setInsertPanelKeterangan("");
        await refreshActiveMendingDetails(activeMendingPcs.nomor_mc, activeMendingPcs.design_id, activeMendingPcs.potongan_ke, activeMendingPcs.pcs_index);
      } else {
        setInsertPanelError(res.error || "Gagal menyisipkan panel.");
      }
    } catch (err: any) {
      setInsertPanelError(err.message);
    } finally {
      setIsInsertingPanel(false);
    }
  };

  useEffect(() => {
    handleSearch(searchTanggal);
  }, [searchTanggal]);

  const handleSearch = async (tanggal: string) => {
    setIsSearching(true);
    setErrorMsg(null);
    setAllDetails([]);
    setActiveMendingPcs(null);
    setSelections({});
    setSearchMesin("");
    setSearchPotongan("");
    setCurrentPage(1);

    const queryTanggal = tanggal === "" ? "all" : tanggal;
    const res = await getPendingMendingDetailsByDate(queryTanggal);
    if (res.success && res.data) {
      setAllDetails(res.data);
      setPendingCount(res.pendingCount || 0);
    } else {
      setErrorMsg(res.error || "Gagal mencari data.");
      setPendingCount(0);
    }
    setIsSearching(false);
  };

  const uniqueMesins = React.useMemo(() => {
    return Array.from(new Set(allDetails.map(d => d.production_headers?.nomor_mc).filter(Boolean)));
  }, [allDetails]);

  const uniquePotongans = React.useMemo(() => {
    return Array.from(new Set(allDetails
      .filter(d => !searchMesin || d.production_headers?.nomor_mc === searchMesin)
      .map(d => d.production_headers?.potongan_ke)
      .filter(Boolean)));
  }, [allDetails, searchMesin]);

  const groupedPcsList = React.useMemo(() => {
    const batchPcsMap = new Map<string, Set<number>>();
    allDetails.forEach((d: any) => {
      const h = d.production_headers;
      if (!h) return;
      const batchKey = `${h.nomor_mc}_${h.design_id}_${h.potongan_ke}`;
      if (!batchPcsMap.has(batchKey)) {
        batchPcsMap.set(batchKey, new Set<number>());
      }
      const pcsNum = parseInt(d.pcs_index, 10);
      if (!isNaN(pcsNum)) {
        batchPcsMap.get(batchKey)!.add(pcsNum);
      }
    });

    const map = new Map<string, any>();
    allDetails.forEach((d: any) => {
      const h = d.production_headers;
      if (searchMesin && String(h?.nomor_mc) !== String(searchMesin)) return;
      if (searchPotongan && String(h?.potongan_ke) !== String(searchPotongan)) return;

      const batchKey = `${h?.nomor_mc}_${h?.design_id}_${h?.potongan_ke}`;
      const pcsSet = batchPcsMap.get(batchKey);
      const maxPcs = pcsSet && pcsSet.size > 0 ? Math.max(...Array.from(pcsSet)) : parseInt(d.pcs_index, 10) || 1;

      const key = `${batchKey}_${d.pcs_index}`;
      if (!map.has(key)) {
        map.set(key, {
          nomor_mc: h?.nomor_mc,
          design_id: h?.design_id,
          potongan_ke: h?.potongan_ke,
          pcs_index: d.pcs_index,
          total_pcs: maxPcs,
          meter_kain: d.meter_kain || null,
          header: h,
          detailsCount: 0,
          totalHasilProduksi: 0,
          lastInputTime: h?.tanggal_jam || h?.created_at || null
        });
      }
      const group = map.get(key);
      group.detailsCount++;
      group.totalHasilProduksi += (d.jml_hasil_produksi || 0);
      if (d.meter_kain) group.meter_kain = d.meter_kain;
      const ts = h?.tanggal_jam || h?.created_at;
      if (ts) {
        if (!group.lastInputTime || new Date(ts) > new Date(group.lastInputTime)) {
          group.lastInputTime = ts;
        }
      }
    });

    const list = Array.from(map.values());
    return list.sort((a: any, b: any) => {
      const timeA = a.lastInputTime ? new Date(a.lastInputTime).getTime() : 0;
      const timeB = b.lastInputTime ? new Date(b.lastInputTime).getTime() : 0;
      if (sortOrder === "asc") {
        if (timeA !== timeB) return timeA - timeB;
        return String(a.nomor_mc || "").localeCompare(String(b.nomor_mc || ""));
      } else {
        if (timeA !== timeB) return timeB - timeA;
        return String(a.nomor_mc || "").localeCompare(String(b.nomor_mc || ""));
      }
    });
  }, [allDetails, searchMesin, searchPotongan, sortOrder]);

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(groupedPcsList.length / ITEMS_PER_PAGE);
  const currentPcsList = React.useMemo(() => {
    return groupedPcsList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [groupedPcsList, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchMesin, searchPotongan, searchTanggal, sortOrder]);

  const refreshActiveMendingDetails = async (mc: string, des: string, pot: string, pcs: string, initSelections: boolean = false) => {
    const res = await getMendingDetailsByGroup(mc, des, pot, pcs);
    if (res.success && res.data) {
      setFullActiveMendingDetails(res.data);
      
      setSelections((prev) => {
        const next = initSelections ? {} : { ...prev };
        res.data.forEach((item: any) => {
          if (!next[item.id]) {
            const hasDefect = item.indikator_stop || (item.kategori_masalah && item.kategori_masalah.trim() !== "");
            if (item.final_inspection_id === 4) {
              next[item.id] = "BS";
            } else if (item.final_inspection_id === 3) {
              next[item.id] = "B";
            } else {
              if (!hasDefect) {
                next[item.id] = "A";
              } else {
                next[item.id] = "B";
              }
            }
          }
        });
        return next;
      });
    }
  };

  const handleStartMending = async (nomor_mc: string, design_id: string, potongan_ke: string, pcs_index: string) => {
    setActiveMendingPcs({ nomor_mc: String(nomor_mc), design_id: String(design_id), potongan_ke: String(potongan_ke), pcs_index: String(pcs_index) });
    setSelections({});
    const now = new Date();
    setNowMs(now.getTime());
    const defaultIso = now.toISOString();

    // 1. Fetch details to inspect existing item/header timestamps
    const detailsRes = await getMendingDetailsByGroup(String(nomor_mc), String(design_id), String(potongan_ke), String(pcs_index));
    const fetchedDetails = detailsRes.success && detailsRes.data ? detailsRes.data : [];
    setFullActiveMendingDetails(fetchedDetails);

    // Initialize selections for fetched details
    setSelections((prev) => {
      const next = { ...prev };
      fetchedDetails.forEach((item: any) => {
        if (!next[item.id]) {
          const hasDefect = item.indikator_stop || (item.kategori_masalah && item.kategori_masalah.trim() !== "");
          if (item.final_inspection_id === 4) {
            next[item.id] = "BS";
          } else if (item.final_inspection_id === 3) {
            next[item.id] = "B";
          } else {
            next[item.id] = !hasDefect ? "A" : "B";
          }
        }
      });
      return next;
    });

    // 2. Check DB for active timer session
    const sessionRes = await getTimerSession("mending", nomor_mc, design_id, potongan_ke, pcs_index);
    let startIso: string = defaultIso;

    if (sessionRes.success && sessionRes.data && sessionRes.data.start_time) {
      const s = sessionRes.data;
      setIsPaused(s.is_paused || false);
      setPauseSeconds(s.pause_seconds || 0);
      setPausedAt(s.paused_at || null);
      startIso = s.start_time;
    } else {
      setIsPaused(false);
      setPauseSeconds(0);
      setPausedAt(null);

      const upsertRes = await upsertTimerSession({
        type: "mending",
        nomor_mc: String(nomor_mc),
        design_id: String(design_id),
        potongan_ke: String(potongan_ke),
        pcs_index: String(pcs_index),
        start_time: defaultIso,
        is_paused: false,
        pause_seconds: 0,
        elapsed_seconds: 0,
      });
      if (upsertRes.success && upsertRes.data?.start_time) {
        startIso = upsertRes.data.start_time;
      }
      fetchActiveSessions();
    }

    if (/^\d{1,2}:\d{2}$/.test(startIso)) {
      const [hStr, mStr] = startIso.split(":");
      const d = new Date();
      d.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);
      startIso = d.toISOString();
    }

    setStartTimeIso(startIso);
    setStartMendingTime(formatHHMM(startIso));
  };

  const [detailToDelete, setDetailToDelete] = useState<{ id: string, name: string } | null>(null);
  const [isDeletingDetail, setIsDeletingDetail] = useState(false);

  const detailsToDisplay = React.useMemo(() => {
    if (!fullActiveMendingDetails) return [];
    
    return [...fullActiveMendingDetails].sort((a: any, b: any) => {
      const hA = a.production_headers || {};
      const hB = b.production_headers || {};
      const panelA = hA.panel_no;
      const panelB = hB.panel_no;

      if (panelA === "METERAN" || panelB === "METERAN") {
        // Urutkan berdasarkan header (sesi operator) via tanggal_jam
        const hjA = String(hA.tanggal_jam || "");
        const hjB = String(hB.tanggal_jam || "");
        if (hjA !== hjB) return hjA.localeCompare(hjB);

        // Dalam sesi operator yang sama, urutkan berdasarkan meter_kain
        // Baris ISTIRAHAT / FINISH tanpa meter_kain diletakkan di akhir grup
        const isSpecialA = ((!!a.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") || !!a.kategori_masalah?.toUpperCase().includes("ISTIRAHAT"))
              && !a.kategori_masalah && !a.detail_masalah)
          || (hA.meter_akhir !== null && hA.meter_akhir !== undefined
              && String(hA.meter_akhir).trim() !== ""
              && (a.meter_kain === null || a.meter_kain === undefined));
        const isSpecialB = ((!!b.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") || !!b.kategori_masalah?.toUpperCase().includes("ISTIRAHAT"))
              && !b.kategori_masalah && !b.detail_masalah)
          || (hB.meter_akhir !== null && hB.meter_akhir !== undefined
              && String(hB.meter_akhir).trim() !== ""
              && (b.meter_kain === null || b.meter_kain === undefined));

        if (isSpecialA && !isSpecialB) return 1;
        if (!isSpecialA && isSpecialB) return -1;
        if (isSpecialA && isSpecialB) return 0;

        const valA = getActualMeter(a, hA);
        const valB = getActualMeter(b, hB);
        const mA = valA !== null ? valA : Infinity;
        const mB = valB !== null ? valB : Infinity;
        if (mA === Infinity && mB === Infinity) return 0;
        return mA - mB;
      } else {
        const numA = parseInt(panelA, 10);
        const numB = parseInt(panelB, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          if (numA !== numB) return numA - numB;
        }
        return String(panelA || "").localeCompare(String(panelB || ""), undefined, { numeric: true });
      }
    });
  }, [fullActiveMendingDetails]);

  const isMeteranBatch = detailsToDisplay.length > 0 && detailsToDisplay[0]?.production_headers?.panel_no === "METERAN";

  const displayItems = React.useMemo(() => {
    if (!isMeteranBatch) {
      const processed = detailsToDisplay.map((item) => {
        const h = item.production_headers || {};
        const opr = h.operators?.nama_operator || h.pic || "";
        const grp = h.groups?.nama_grup || "";
        const tgl = h.tgl || "";
        const operatorStr = (grp ? `(${grp}) ` : '') + opr;

        const isIstirahat = (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT");
        const isFinish = item.keterangan_cacat === "FINISH" || item.production_headers?.panel_no === "FINISH";
        const isStart = item.keterangan_cacat === "START" || item.production_headers?.panel_no === "START";
        const isGradable = !isFinish && !isStart;

        let extractedBackupOp = h.operator_backup || "";
        if (!extractedBackupOp && item.keterangan_cacat) {
          const match = item.keterangan_cacat.match(/\(Backup:\s*([^)]+)\)/i);
          if (match && match[1]) {
            extractedBackupOp = match[1].trim();
          }
        }

        let displayDetail = item.detail_masalah || "";
        let displayKeterangan = item.keterangan_cacat || "";
        let oprStr = opr;
        
        if (displayKeterangan.includes("ISTIRAHAT")) {
          oprStr = "Istirahat";
          displayKeterangan = displayKeterangan.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
          displayKeterangan = displayKeterangan.replace(/^,\s*|\s*,\s*$/g, "");
        }

        let cacatLines: string[] = [];
        const katsRaw = item.kategori_masalah;
        const kats = katsRaw ? (Array.isArray(katsRaw) ? katsRaw : katsRaw.split(",").map((s: string) => s.trim())) : [];
        
        const pushDetailsForCat = (k: string, d: string) => {
          if (!d) {
            cacatLines.push(k);
            return;
          }
          const knownDetailsForCat = problemDetailsMap[k] || DEFAULT_PROBLEM_DETAILS[k] || [];
          const matchedDetails: string[] = [];
          let remainingD = d;
          const sortedKnown = [...knownDetailsForCat].sort((a, b) => b.length - a.length);
          sortedKnown.forEach(known => {
            if (remainingD.includes(known)) {
              matchedDetails.push(known);
              remainingD = remainingD.replace(known, "");
            }
          });
          if (matchedDetails.length > 0) {
            const customParts = remainingD.split(",").map((s: string) => s.trim()).filter(Boolean);
            matchedDetails.forEach(match => cacatLines.push(`${k} - ${match}`));
            customParts.forEach(custom => cacatLines.push(`${k} - ${custom}`));
          } else {
            const parts = d.split(",").map((s: string) => s.trim()).filter(Boolean);
            parts.forEach(p => cacatLines.push(`${k} - ${p}`));
          }
        };

        if (kats.length > 0) {
          if (displayDetail.includes(" | ")) {
            const catDetails = displayDetail.split(" | ");
            for (let i = 0; i < Math.max(kats.length, catDetails.length); i++) {
              const k = kats[i] || "Unknown";
              const d = catDetails[i] || "";
              pushDetailsForCat(k, d);
            }
          } else if (displayDetail) {
            if (kats.length === 1) {
              pushDetailsForCat(kats[0], displayDetail);
            } else {
              const dets = displayDetail.split(", ");
              if (kats.length === dets.length) {
                for (let i = 0; i < kats.length; i++) {
                  pushDetailsForCat(kats[i], dets[i]);
                }
              } else {
                dets.forEach((det: string) => {
                  let foundKat = "Unknown";
                  for (const [kat, detList] of Object.entries(problemDetailsMap || DEFAULT_PROBLEM_DETAILS)) {
                    if ((detList as string[]).some((d: string) => det.toLowerCase().includes(d.toLowerCase()))) {
                      foundKat = kat;
                      break;
                    }
                  }
                  cacatLines.push(`${foundKat !== "Unknown" ? foundKat + " - " : ""}${det}`);
                });
              }
            }
          } else {
            cacatLines.push(kats.join(", "));
          }
        } else if (displayDetail) {
          cacatLines.push(displayDetail);
        }

        let ketCacat = displayKeterangan;
        const hasTambahanQC = ketCacat.includes("[TAMBAHAN QC]");
        ketCacat = ketCacat.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
        ketCacat = ketCacat.replace(/\[TAMBAHAN QC\]/gi, "").trim();
        ketCacat = ketCacat.replace(/^,\s*|\s*,\s*$/g, "");

        if (ketCacat) {
          if (cacatLines.length > 0) {
            const parts = ketCacat.split(",").map((s: string) => s.trim()).filter(Boolean);
            if (cacatLines.length === 1 && parts.length > 1) {
              const cleanAllBlocks = parts
                .map((p: string) => p.replace(/blok\s*/gi, "").trim())
                .filter(Boolean)
                .join(", ");
              cacatLines = cacatLines.map((line) =>
                line.match(/\(Blok/i) ? line : `${line} (Blok ${cleanAllBlocks})`
              );
            } else {
              cacatLines = cacatLines.map((line, i) => {
                if (line.match(/\(Blok/i)) return line;
                const lineKat = line.includes(" - ") ? line.split(" - ")[0].trim() : "";
                let partIndex = i;
                const katsRaw2 = item.kategori_masalah;
                const kats2 = katsRaw2 ? (Array.isArray(katsRaw2) ? katsRaw2 : katsRaw2.split(",").map((s: any) => s.trim())) : [];
                if (lineKat && kats2.includes(lineKat)) {
                  partIndex = kats2.indexOf(lineKat);
                }
                if (parts[partIndex] && parts[partIndex] !== "") {
                  const cleanB = parts[partIndex].replace(/blok\s*/gi, "").trim();
                  return `${line} (Blok ${cleanB})`;
                } else if (parts[parts.length - 1] && parts[parts.length - 1] !== "") {
                  const cleanB = parts[parts.length - 1].replace(/blok\s*/gi, "").trim();
                  return `${line} (Blok ${cleanB})`;
                }
                return line;
              });
            }
          } else {
            const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
            cacatLines.push(`(Blok ${cleanB})`);
          }
        }

        if (hasTambahanQC) {
          if (cacatLines.length === 0) {
            cacatLines.push("[TAMBAHAN QC]");
          } else {
            for (let i = 0; i < cacatLines.length; i++) {
              cacatLines[i] = cacatLines[i] + " [TAMBAHAN QC]";
            }
          }
        }

        const cacatText = cacatLines.join("\n");

        return {
          item,
          isIstirahat,
          isFinish,
          isStart,
          isGradable,
          opr,
          grp,
          tgl,
          operatorStr,
          oprStr,
          cacatText,
          backupOpName: extractedBackupOp,
        };
      });

      const items: any[] = [];
      let currentOpCount = 0;
      let currentOpIds: string[] = [];
      let firstRowTgl = "";
      let lastTgl = "";
      let lastGrp = "";
      let lastOpr = "";

      processed.forEach((p, i) => {
        const { item, isIstirahat, isFinish, isStart, isGradable, opr, grp, tgl, operatorStr, oprStr, cacatText } = p;

        const isBS = item.jml_hasil_produksi === 0 || item.status_inspeksi === "BS" || item.final_inspection_id === 4 || selections[item.id] === "BS";
        if (isGradable && !isBS) {
          currentOpCount += 1;
        }
        if (isGradable) {
          currentOpIds.push(item.id);
        }

        let showTgl = false;
        let showGrp = false;
        let showOpr = false;

        if (i === 0) {
          // Baris pertama data: Tanggal, Group, dan Operator WAJIB terisi (Rule 1)
          showTgl = true;
          showGrp = true;
          showOpr = true;
          firstRowTgl = tgl;
        } else {
          // Jika beda operator (Rule 2, 3, 4): Tanggal, Group, dan Operator ditampilkan di baris pertama data operator tersebut
          if (opr !== lastOpr) {
            showTgl = true;
            showGrp = true;
            showOpr = true;
          } else if (tgl !== firstRowTgl && tgl !== lastTgl) {
            // Kolom tanggal juga ditampilkan jika tanggalnya berbeda
            showTgl = true;
          }
        }

        lastTgl = tgl;
        lastGrp = grp;
        lastOpr = opr;

        items.push({
          ...item,
          isMeter: false,
          isStartRow: false,
          isIstirahat,
          isFinishReport: isFinish,
          displayNo: item.production_headers?.panel_no || "-",
          meterDisplay: "-",
          cacatDisplay: cacatText,
          backupOpName: p.backupOpName,
          isGradable,
          showTgl,
          showGrp,
          showOpr,
          oprBase: opr,
          oprStr,
          grpStr: grp,
          tglStr: tgl,
          hasErrorDetail: !!item.kategori_masalah || !!item.detail_masalah
        });

        let nextOprStr = null;
        if (i + 1 < processed.length) {
          nextOprStr = processed[i + 1].operatorStr;
        }

        if (nextOprStr === null || nextOprStr !== operatorStr) {
          if (currentOpCount > 0) {
            const [prevGrp, prevOpr] = operatorStr.includes(") ") 
              ? [operatorStr.match(/\(([^)]+)\)/)?.[1] || "", operatorStr.replace(/^\([^)]+\)\s*/, "")]
              : ["", operatorStr];

            items.push({
              id: `total-${operatorStr}-${Math.random()}`,
              isTotalRow: true,
              totalLabel: `Total Produksi${prevGrp ? ` (${prevGrp})` : ""} ${prevOpr}:`,
              totalCount: currentOpCount,
              countA: currentOpIds.filter(id => selections[id] === "A").length,
              countB: currentOpIds.filter(id => selections[id] === "B").length,
              countBS: currentOpIds.filter(id => selections[id] === "BS").length,
            });
          }
          currentOpCount = 0;
          currentOpIds = [];
        }
      });

      return items;
    }

    const items: any[] = [];
    let globalRowCount = 0;
    let prevOperatorLastMeter: number | null = null;
    let currentOpStartMeter: number | null = null;
    let currentOpLastMeter: number | null = null;
    let currentOpCacatCount = 0;
    let lastOprString = "";

    let grandTotalStartMeter: number | null = null;
    let grandTotalLastMeter: number | null = null;
    let grandTotalCacatCount = 0;

    // cleanMeterVal is defined globally at the top

    detailsToDisplay.forEach((item, idx) => {
      const h = item.production_headers || {};
      const opr = h.operators?.nama_operator || h.pic || "";
      const grp = h.groups?.nama_grup || "";
      const operatorStr = (grp ? `(${grp}) ` : '') + opr;

      if (items.length === 0) {
        lastOprString = operatorStr;
      }

      let isSameAsPrev = false;
      if (operatorStr !== lastOprString && items.length > 0) {
        const totalMeter = currentOpStartMeter !== null && currentOpLastMeter !== null
          ? Math.abs(currentOpLastMeter - currentOpStartMeter)
          : null;
        const [prevGrp, prevOpr] = lastOprString.includes(") ") 
          ? [lastOprString.match(/\(([^)]+)\)/)?.[1] || "", lastOprString.replace(/^\([^)]+\)\s*/, "")]
          : ["", lastOprString];

        const normalMeter = totalMeter !== null ? Math.max(0, totalMeter - currentOpCacatCount) : 0;
        const cacatMeter = currentOpCacatCount;

        items.push({
          id: `total-${lastOprString}-${Math.random()}`,
          isTotalRow: true,
          totalLabel: `Total Produksi${prevGrp ? ` (${prevGrp})` : ""} ${prevOpr}:`,
          totalMeter: totalMeter !== null ? `${totalMeter} Meter` : "-",
          normalMeter: totalMeter !== null ? `${normalMeter} Meter` : "-",
          cacatMeter: totalMeter !== null ? `${cacatMeter} Meter` : "-",
        });
        prevOperatorLastMeter = currentOpLastMeter;
        currentOpStartMeter = null;
        currentOpLastMeter = null;
        currentOpCacatCount = 0;
        lastOprString = operatorStr;
        isSameAsPrev = false;
      } else if (items.length > 0) {
        isSameAsPrev = true;
      }

      let hasIstirahatFromDefects = false;
      let hasRealDefects = false;

      const detailStr = (item.detail_masalah || "").toUpperCase();
      const katStr = (item.kategori_masalah || "").toUpperCase();
      const ketStr = (item.keterangan_cacat || "").toUpperCase();

      const hasIstirahatText = detailStr.includes("ISTIRAHAT") || katStr.includes("ISTIRAHAT") || ketStr.includes("ISTIRAHAT");

      if (item.production_defects && Array.isArray(item.production_defects) && item.production_defects.length > 0) {
        item.production_defects.forEach((d: any) => {
          if ((d.kategori || "").toUpperCase().includes("ISTIRAHAT") || (d.detail || "").toUpperCase().includes("ISTIRAHAT")) {
            hasIstirahatFromDefects = true;
          } else {
            hasRealDefects = true;
          }
        });
      } else {
        const cleanDetailNoIstirahat = (item.detail_masalah || "").replace(/istirahat/gi, "").replace(/G\s*-\s*/gi, "").trim();
        if (cleanDetailNoIstirahat.length > 0) {
          hasRealDefects = true;
        } else if (item.kategori_masalah && katStr !== "G" && !katStr.includes("ISTIRAHAT")) {
          hasRealDefects = true;
        }
      }

      const hasIstirahatRaw = hasIstirahatText || hasIstirahatFromDefects;
      const hasIstirahat = hasIstirahatRaw && !hasRealDefects;
      const isIstirahat = hasIstirahat;
      const isFinishReport = h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "";

      let cacatLines: string[] = [];
      const katsRaw = item.kategori_masalah;
      const kats = katsRaw ? (Array.isArray(katsRaw) ? katsRaw : katsRaw.split(",").map((s: string) => s.trim())) : [];
      
      const pushDetailsForCat = (k: string, d: string) => {
        if (!d) {
          cacatLines.push(k);
          return;
        }
        const knownDetailsForCat = problemDetailsMap[k] || DEFAULT_PROBLEM_DETAILS[k] || [];
        const matchedDetails: string[] = [];
        let remainingD = d;
        const sortedKnown = [...knownDetailsForCat].sort((a, b) => b.length - a.length);
        sortedKnown.forEach(known => {
          if (remainingD.includes(known)) {
            matchedDetails.push(known);
            remainingD = remainingD.replace(known, "");
          }
        });
        if (matchedDetails.length > 0) {
          const customParts = remainingD.split(",").map((s: string) => s.trim()).filter(Boolean);
          matchedDetails.forEach(match => cacatLines.push(`${k} - ${match}`));
          customParts.forEach(custom => cacatLines.push(`${k} - ${custom}`));
        } else {
          const parts = d.split(",").map((s: string) => s.trim()).filter(Boolean);
          parts.forEach(p => cacatLines.push(`${k} - ${p}`));
        }
      };

      const cleanDetail = item.detail_masalah 
        ? item.detail_masalah.replace(/\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "").replace(/\|\s*$/, "").replace(/,\s*$/, "").trim()
        : "";

      if (kats.length > 0) {
        if (cleanDetail.includes(" | ")) {
          const catDetails = cleanDetail.split(" | ");
          for (let i = 0; i < Math.max(kats.length, catDetails.length); i++) {
            const k = kats[i] || "Unknown";
            const d = catDetails[i] || "";
            pushDetailsForCat(k, d);
          }
        } else if (cleanDetail) {
          if (kats.length === 1) {
            pushDetailsForCat(kats[0], cleanDetail);
          } else {
            const dets = cleanDetail.split(", ");
            if (kats.length === dets.length) {
              for (let i = 0; i < kats.length; i++) {
                pushDetailsForCat(kats[i], dets[i]);
              }
            } else {
              dets.forEach((det: string) => {
                let foundKat = "Unknown";
                for (const [kat, detList] of Object.entries(problemDetailsMap || DEFAULT_PROBLEM_DETAILS)) {
                  if ((detList as string[]).some((d: string) => det.toLowerCase().includes(d.toLowerCase()))) {
                    foundKat = kat;
                    break;
                  }
                }
                cacatLines.push(`${foundKat !== "Unknown" ? foundKat + " - " : ""}${det}`);
              });
            }
          }
        } else {
          cacatLines.push(kats.join(", "));
        }
      } else if (item.detail_masalah) {
        cacatLines.push(item.detail_masalah);
      }

      let ketCacat = item.keterangan_cacat || "";
      const hasTambahanQC = ketCacat.includes("[TAMBAHAN QC]");
      ketCacat = ketCacat.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
      ketCacat = ketCacat.replace(/\[TAMBAHAN QC\]/gi, "").trim();
      ketCacat = ketCacat.replace(/^,\s*|\s*,\s*$/g, "");

      if (ketCacat) {
        if (cacatLines.length > 0) {
          const parts = ketCacat.split(",").map((s: string) => s.trim()).filter(Boolean);
          if (cacatLines.length === 1 && parts.length > 1) {
            const cleanAllBlocks = parts
              .map((p: string) => p.replace(/blok\s*/gi, "").trim())
              .filter(Boolean)
              .join(", ");
            cacatLines = cacatLines.map((line) =>
              line.match(/\(Blok/i) ? line : `${line} (Blok ${cleanAllBlocks})`
            );
          } else {
            cacatLines = cacatLines.map((line, i) => {
              if (line.match(/\(Blok/i)) return line;
              const lineKat = line.includes(" - ") ? line.split(" - ")[0].trim() : "";
              let partIndex = i;
              const katsRaw2 = item.kategori_masalah;
              const kats2 = katsRaw2 ? (Array.isArray(katsRaw2) ? katsRaw2 : katsRaw2.split(",").map((s: any) => s.trim())) : [];
              if (lineKat && kats2.includes(lineKat)) {
                partIndex = kats2.indexOf(lineKat);
              }
              if (parts[partIndex] && parts[partIndex] !== "") {
                const cleanB = parts[partIndex].replace(/blok\s*/gi, "").trim();
                return `${line} (Blok ${cleanB})`;
              } else if (parts[parts.length - 1] && parts[parts.length - 1] !== "") {
                const cleanB = parts[parts.length - 1].replace(/blok\s*/gi, "").trim();
                return `${line} (Blok ${cleanB})`;
              }
              return line;
            });
          }
        } else {
          const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
          cacatLines.push(`(Blok ${cleanB})`);
        }
      }

      if (hasTambahanQC) {
        if (cacatLines.length === 0) {
          cacatLines.push("[TAMBAHAN QC]");
        } else {
          cacatLines = cacatLines.map(line => line + " [TAMBAHAN QC]");
        }
      }

      const combinedCacat = cacatLines.join("\n");
      const hasErrorDetail = !!item.kategori_masalah || !!item.detail_masalah;

      let meterDisplay = "-";
      if (item.meter_kain !== null && item.meter_kain !== undefined && String(item.meter_kain).trim() !== "") {
        meterDisplay = cleanMeterVal(item.meter_kain);
      } else if (item.detail_masalah) {
        const meterMatch = item.detail_masalah.match(/\(Titik:\s*([A-Za-z0-9\s.\-]+)\)/i);
        if (meterMatch && meterMatch[1]) {
          meterDisplay = cleanMeterVal(meterMatch[1]);
        }
      }
      
      if (meterDisplay === "-") {
        if ((isIstirahat || isFinishReport) && (h.meter_akhir || h.meter_awal)) {
          meterDisplay = cleanMeterVal(h.meter_akhir || h.meter_awal);
        }
      }

      if (!isSameAsPrev) {
        const startTglStr = h.tgl || "-";
        const startMeter = prevOperatorLastMeter !== null
          ? String(prevOperatorLastMeter)
          : (h.meter_awal !== undefined && h.meter_awal !== null ? cleanMeterVal(h.meter_awal) : "0");

        items.push({
          id: `start-${idx}-${Math.random()}`,
          isStartRow: true,
          isMeter: true,
          displayNo: (globalRowCount + 1).toString(),
          tglStr: startTglStr,
          grpStr: grp,
          oprStr: opr,
          meterDisplay: startMeter,
          cacatDisplay: "START",
          isGradable: false,
          showTgl: true,
          showGrp: true,
          showOpr: true,
          hasErrorDetail: false
        });
        globalRowCount += 1;
        const startMeterVal = parseFloat(cleanMeterVal(startMeter));
        if (!isNaN(startMeterVal)) {
          if (currentOpStartMeter === null) currentOpStartMeter = startMeterVal;
          currentOpLastMeter = startMeterVal;
          if (grandTotalStartMeter === null) grandTotalStartMeter = startMeterVal;
          grandTotalLastMeter = startMeterVal;
        }
        isSameAsPrev = true;
      }

      const finalOprStr = isSameAsPrev ? "" : opr;
      const finalGrpStr = isSameAsPrev ? "" : grp;
      const finalTglStr = isSameAsPrev ? "" : h.tgl || "-";

      const showTgl = !isSameAsPrev;
      const showGrp = !isSameAsPrev;
      const showOpr = !isSameAsPrev;

      const isGradable = !isIstirahat && (!isFinishReport || hasErrorDetail);
      const cacatForMeter = combinedCacat
        .split("\n")
        .map((line: string) => line.replace(/\s*\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "").trim())
        .filter((line: string) => {
          if (!line) return false;
          if (line.includes(" - ")) {
            const detailPart = line.split(" - ").slice(1).join(" - ").trim();
            const withoutBlok = detailPart.replace(/\s*\(Blok[^)]*\)/gi, "").trim();
            return withoutBlok.length > 0;
          }
          return true;
        })
        .join("\n");
      let backupOpName = "";
      if (hasIstirahat) {
        let extractedBackupOp = h.operator_backup || "";
        if (!extractedBackupOp && item.keterangan_cacat) {
          const match = item.keterangan_cacat.match(/\(Backup:\s*([^)]+)\)/i);
          if (match && match[1]) {
            extractedBackupOp = match[1].trim();
          }
        }
        backupOpName = extractedBackupOp;
      }

      const cacatText = hasIstirahat && !hasErrorDetail ? "ISTIRAHAT" : (isFinishReport && !hasErrorDetail ? "FINISH" : (hasErrorDetail && cacatForMeter ? cacatForMeter : "-"));

      const isPlaceholder = meterDisplay === "-" && !hasErrorDetail && !isIstirahat && !isFinishReport;
      if (!isPlaceholder) {
        items.push({
          ...item,
          isStartRow: false,
          isMeter: true,
          isIstirahat,
          hasIstirahat,
          isFinishReport,
          displayNo: (globalRowCount + 1).toString(),
          tglStr: finalTglStr,
          grpStr: finalGrpStr,
          oprStr: finalOprStr,
          meterDisplay,
          cacatDisplay: cacatText,
          backupOpName,
          isGradable,
          showTgl: hasIstirahat ? false : showTgl,
          showGrp: hasIstirahat ? false : showGrp,
          showOpr: hasIstirahat ? true : showOpr,
          hasErrorDetail
        });
        globalRowCount += 1;

        const meterVal = parseFloat(cleanMeterVal(meterDisplay));
        if (!isNaN(meterVal)) {
          if (currentOpStartMeter === null) currentOpStartMeter = meterVal;
          currentOpLastMeter = meterVal;
          if (grandTotalStartMeter === null) grandTotalStartMeter = meterVal;
          grandTotalLastMeter = meterVal;
        }

        const isDefectRow = !isIstirahat && (hasRealDefects || hasTambahanQC || !!item.kategori_masalah);
        if (isDefectRow) {
          currentOpCacatCount += 1;
          grandTotalCacatCount += 1;
        }
      }
    });

    if (items.length > 0 && currentOpStartMeter !== null && currentOpLastMeter !== null) {
      const totalMeter = Math.abs(currentOpLastMeter - currentOpStartMeter);
      const [lastGrp, lastOprOnly] = lastOprString.includes(") ") 
        ? [lastOprString.match(/\(([^)]+)\)/)?.[1] || "", lastOprString.replace(/^\([^)]+\)\s*/, "")]
        : ["", lastOprString];

      items.push({
        id: `total-last-${lastOprString}-${Math.random()}`,
        isTotalRow: true,
        totalLabel: `Total Produksi${lastGrp ? ` (${lastGrp})` : ""} ${lastOprOnly}:`,
        totalMeter: `${totalMeter} Meter`,
      });
    }

    return items;
  }, [detailsToDisplay, isMeteranBatch, selections]);

  const gradableItems = React.useMemo(() => {
    return displayItems.filter((item: any) => item.isGradable);
  }, [displayItems]);

  const handleDeleteDetail = async () => {
    if (!detailToDelete) return;
    setIsDeletingDetail(true);
    const res = await deleteProductionDetailRow(detailToDelete.id);
    if (res.success) {
      setDetailToDelete(null);
      handleSearch(searchTanggal);
      if (activeMendingPcs) {
        refreshActiveMendingDetails(activeMendingPcs.nomor_mc, activeMendingPcs.design_id, activeMendingPcs.potongan_ke, activeMendingPcs.pcs_index);
      }
    } else {
      alert("Gagal menghapus data: " + res.error);
    }
    setIsDeletingDetail(false);
  };

  const handleSelectGrade = (detailId: string, grade: string) => {
    setSelections((prev) => ({ ...prev, [detailId]: grade }));
  };

  useEffect(() => {
    if (!activeMendingPcs) return;
    const autoSelections: Record<string, string> = {};
    for (const d of detailsToDisplay) {
      const detailStr = (d.detail_masalah || "").toUpperCase();
      const katStr = (d.kategori_masalah || "").toUpperCase();
      const ketStr = (d.keterangan_cacat || "").toUpperCase();
      const hasIstirahatText = detailStr.includes("ISTIRAHAT") || katStr.includes("ISTIRAHAT") || ketStr.includes("ISTIRAHAT");
      const cleanDetailNoIstirahat = (d.detail_masalah || "").replace(/istirahat/gi, "").replace(/G\s*-\s*/gi, "").trim();
      const hasRealDefects = cleanDetailNoIstirahat.length > 0 || (d.kategori_masalah && katStr !== "G" && !katStr.includes("ISTIRAHAT"));
      const isIstirahatOnly = hasIstirahatText && !hasRealDefects;

      if (isIstirahatOnly) {
        autoSelections[d.id] = "A";
      } else if (d.final_inspection_id === 1 || d.final_inspection_id === 2) {
        autoSelections[d.id] = "A"; // Ceklis → auto Grade A
      } else if (d.final_inspection_id === 3) {
        autoSelections[d.id] = "B"; // Silang → auto Grade B
      } else if (d.final_inspection_id === 4) {
        autoSelections[d.id] = "BS"; // BS → auto Grade BS
      }
    }
    setSelections((prev) => ({ ...autoSelections, ...prev }));
  }, [activeMendingPcs, detailsToDisplay]);

  const handleOpenDetail = async (headerId: string) => {
    setDetailModalOpen(true);
    setIsDetailLoading(true);
    setDetailData(null);
    try {
      const res = await getEmployeeHistoryDetail(headerId);
      if (res.success && res.data) {
        setDetailData(res.data);
      } else {
        alert("Gagal memuat detail: " + (res.error || "Unknown Error"));
        setDetailModalOpen(false);
      }
    } catch (err) {
      alert("Terjadi kesalahan jaringan.");
      setDetailModalOpen(false);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const isAllSelected = gradableItems.length > 0 && gradableItems.every((d) => selections[d.id]);
  const totalGradable = gradableItems.filter((item: any) => !(item.jml_hasil_produksi === 0 || item.status_inspeksi === "BS" || item.final_inspection_id === 4 || selections[item.id] === "BS")).length;
  const totalA = gradableItems.filter((item: any) => selections[item.id] === "A").length;
  const totalB = gradableItems.filter((item: any) => selections[item.id] === "B").length;
  const totalBS = gradableItems.filter((item: any) => selections[item.id] === "BS").length;
  const firstDetail = detailsToDisplay.length > 0 ? detailsToDisplay[0] : null;
  const h = firstDetail?.production_headers || {};
  const compactProps = {
    nomorMc: h.nomor_mc || "-",
    shiftName: h.groups?.nama_grup || "-",
    operatorName: h.operators?.nama_operator || h.pic || "-",
    design: h.design_id || "-",
    pcsCount: detailsToDisplay.length,
    panelPotongan: `${h.panel_no || "-"} / ${h.potongan_ke || "-"}`,
    courseRpm: `${h.course || "-"} / ${h.rpm || "-"}`,
    noCustomer: h.no_customer || "-",
    noOrder: h.no_order_barang || "-",
    tanggalPotong: h.tanggal_potong || "-",
    statusMatching: h.status_matching || "-",
    pick: String(h.pick || "-"),
    benangDasar: h.jenis_benang_dasar || "-",
    liner: h.liner || "-",
    heavy: h.heavy || "-",
    shadow: h.shadow || "-",
    pinggiran: h.pinggiran || "-",
    tanggalProduksi: h.tanggal_jam || h.created_at || h.tgl || "-",
    rollNo: firstDetail?.roll_no || "-"
  };

  const renderInsertPanelModal = () => {
    if (!insertPanelMode) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-150">
            <h2 className="text-lg font-extrabold text-slate-800">
              Tambah Panel
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Pilih apakah ingin menyisipkan panel baru di urutan tertentu atau menambahkannya di bagian paling akhir.
            </p>
          </div>

          <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
            {insertPanelError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {insertPanelError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-2">
                Pilih Tipe Penambahan
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setInsertPanelMode("append");
                    setInsertPanelAt("");
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition-all ${
                    insertPanelMode === "append"
                      ? "border-[#0070bc] bg-sky-50 text-[#0070bc] font-bold"
                      : "border-slate-200 text-slate-500 hover:border-slate-350 bg-white"
                  }`}
                >
                  <span className="text-xs font-extrabold">Tambah di Akhir</span>
                  <span className="text-[10px] opacity-75 mt-1 font-medium leading-tight">Urutan terakhir</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInsertPanelMode("insert");
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition-all ${
                    insertPanelMode === "insert"
                      ? "border-[#0070bc] bg-sky-50 text-[#0070bc] font-bold"
                      : "border-slate-200 text-slate-500 hover:border-slate-350 bg-white"
                  }`}
                >
                  <span className="text-xs font-extrabold">Sisipkan Tengah</span>
                  <span className="text-[10px] opacity-75 mt-1 font-medium leading-tight">Posisi tertentu</span>
                </button>
              </div>
            </div>

            {insertPanelMode === "insert" && (
              <div className="animate-fadeIn">
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-2">
                  Sisipkan ke Nomor Panel <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={insertPanelAt}
                  onChange={(e) => setInsertPanelAt(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 focus:border-[#0070bc] focus:ring-4 focus:ring-[#0070bc]/10 outline-none font-medium text-slate-700 transition-all mb-3"
                  placeholder="Contoh: 3"
                />
                
                <div className="flex items-center gap-3 py-2 px-3 rounded-lg border border-rose-100 bg-rose-50/50">
                  <input
                    type="checkbox"
                    id="insertPanelIsBs"
                    checked={insertPanelIsBs}
                    onChange={(e) => {
                      setInsertPanelIsBs(e.target.checked);
                      if (e.target.checked) {
                        setInsertPanelHasDefect(true);
                      }
                    }}
                    className="w-4 h-4 text-rose-600 rounded border-rose-300 focus:ring-rose-500 cursor-pointer"
                  />
                  <label
                    htmlFor="insertPanelIsBs"
                    className="text-xs font-bold text-rose-700 cursor-pointer select-none"
                  >
                    Tandai sebagai Barang Sisa (BS)
                  </label>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 pl-1 font-medium leading-tight">
                  * Jika dicentang, nomor panel lain tidak akan bergeser, dan panel {insertPanelAt || "?"} akan memiliki 2 baris data (1 Normal & 1 BS).
                </p>
              </div>
            )}

            {/* Defect toggle switch */}
            <div className="flex items-center gap-3 py-3 border-t border-slate-100 mt-2">
              <input
                type="checkbox"
                id="insertPanelHasDefect"
                checked={insertPanelHasDefect}
                onChange={(e) => {
                  setInsertPanelHasDefect(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedCategories([]);
                    setSelectedDetails({});
                    setInputBloks({});
                    setInsertPanelKeterangan("");
                  }
                }}
                className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
              />
              <label
                htmlFor="insertPanelHasDefect"
                className="text-xs font-bold text-slate-700 cursor-pointer select-none"
              >
                Laporkan temuan masalah / cacat pada panel ini?
              </label>
            </div>

            {insertPanelHasDefect && (
              <div className="space-y-4 pt-2 border-t border-slate-100 animate-fadeIn">
                <label className="text-xs font-bold text-slate-700 uppercase block">
                  Pilih Temuan Cacat / Masalah
                </label>
                <div className="space-y-2">
                  {problemCategories.map((cat) => (
                    <div key={cat.id} className="flex flex-col gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories((prev) => [...prev, cat.id]);
                            } else {
                              setSelectedCategories((prev) => prev.filter((c) => c !== cat.id));
                              setSelectedDetails((prev) => {
                                const next = { ...prev };
                                delete next[cat.id];
                                return next;
                              });
                              setInputBloks((prev) => {
                                const next = { ...prev };
                                delete next[cat.id];
                                return next;
                              });
                            }
                          }}
                          className="peer sr-only"
                        />
                        <div className="p-3 rounded-xl border-2 border-slate-100 bg-white text-xs font-bold text-slate-650 peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 transition-all hover:border-slate-350">
                          {cat.name}
                        </div>
                      </label>

                      {selectedCategories.includes(cat.id) && problemDetailsMap[cat.id] && (
                        <div className="pl-4 pr-2 py-2 border-l-2 border-sky-200 ml-2 animate-in slide-in-from-top-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">
                            Pilih Detail Masalah
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {problemDetailsMap[cat.id].map((detail) => (
                              <label key={detail} className="cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedDetails[cat.id]?.includes(detail) || false}
                                  onChange={(e) => {
                                    const current = selectedDetails[cat.id] || [];
                                    if (e.target.checked) {
                                      setSelectedDetails((prev) => ({
                                        ...prev,
                                        [cat.id]: [...current, detail],
                                      }));
                                    } else {
                                      setSelectedDetails((prev) => ({
                                        ...prev,
                                        [cat.id]: current.filter((d) => d !== detail),
                                      }));
                                    }
                                  }}
                                  className="peer sr-only"
                                />
                                <div className="p-2 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-600 peer-checked:bg-sky-500 peer-checked:border-sky-500 peer-checked:text-white transition-all hover:bg-slate-50 text-center">
                                  {detail}
                                </div>
                              </label>
                            ))}

                            {(selectedDetails[cat.id] || [])
                              .filter((d) => !(problemDetailsMap[cat.id] || []).includes(d))
                              .map((customDetail) => (
                                <div key={customDetail} className="relative flex items-center">
                                  <div className="flex-1 p-2.5 rounded-lg border border-sky-500 bg-sky-500 text-white text-[10px] font-semibold flex items-center justify-between shadow-xs">
                                    <span className="truncate">{customDetail}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedDetails((prev) => ({
                                          ...prev,
                                          [cat.id]: (prev[cat.id] || []).filter((d) => d !== customDetail),
                                        }));
                                      }}
                                      className="ml-1 p-0.5 hover:bg-sky-600 rounded text-white cursor-pointer"
                                      title="Hapus detail manual"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>

                          {cat.id === "G" && (
                            <div className="mt-3 pt-3 border-t border-sky-100">
                              <label className="text-[10px] font-bold text-slate-600 uppercase mb-1.5 flex items-center justify-between">
                                <span className="flex items-center gap-1 text-slate-700">
                                  <Edit3 className="w-3 h-3 text-sky-600" />
                                  Input Masalah Manual (Jika tidak ada di pilihan)
                                </span>
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={manualInputDetails[cat.id] || ""}
                                  onChange={(e) =>
                                    setManualInputDetails((prev) => ({ ...prev, [cat.id]: e.target.value }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleAddPanelManualDetail(cat.id);
                                    }
                                  }}
                                  placeholder="Ketik detail masalah manual di sini..."
                                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 placeholder:text-slate-400"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddPanelManualDetail(cat.id)}
                                  disabled={!(manualInputDetails[cat.id] || "").trim()}
                                  className="px-3 py-2 bg-sky-500 text-white font-bold text-xs rounded-lg hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Tambah</span>
                                </button>
                              </div>
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-650 uppercase">Keterangan Tambahan (Opsional)</label>
                  <textarea
                    value={insertPanelKeterangan}
                    onChange={(e) => setInsertPanelKeterangan(e.target.value)}
                    rows={2}
                    className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:bg-white focus:border-[#0070bc] focus:ring-2 focus:ring-[#0070bc]/10 outline-none transition-all resize-none"
                    placeholder="Tuliskan keterangan tambahan jika ada..."
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-5 border-t border-slate-150 bg-slate-50 flex justify-end gap-3">
            <button
              onClick={() => setInsertPanelMode(null)}
              className="h-11 px-5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              disabled={
                isInsertingPanel || 
                (insertPanelMode === "insert" && !insertPanelAt) ||
                (insertPanelHasDefect && selectedCategories.some(cat => {
                  const hasDetails = (selectedDetails[cat] || []).length > 0;
                  const hasManual = (manualInputDetails[cat] || "").trim().length > 0;
                  return !hasDetails && !hasManual;
                }))
              }
              onClick={handleInsertPanel}
              className="h-11 px-6 rounded-xl bg-[#0070bc] hover:bg-[#004777] active:scale-95 disabled:opacity-50 text-white font-bold transition-all flex items-center gap-2"
            >
              {isInsertingPanel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Simpan Panel
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (activeMendingPcs) {
    return (
      <div className="w-full max-w-6xl mx-auto pb-10 animate-fadeIn">
        <SessionTimerHeader
          title={`Mending PCS Ke-${activeMendingPcs.pcs_index}`}
          icon={<Scissors className="w-6 h-6 text-rose-500 shrink-0" />}
          onBack={async () => {
            if (activeMendingPcs) {
              await upsertTimerSession({
                type: "mending",
                nomor_mc: activeMendingPcs.nomor_mc,
                design_id: activeMendingPcs.design_id,
                potongan_ke: activeMendingPcs.potongan_ke,
                pcs_index: activeMendingPcs.pcs_index,
                start_time: startTimeIso || undefined,
                is_paused: isPaused,
                pause_seconds: pauseSeconds,
                elapsed_seconds: elapsedSeconds,
              });
            }
            setActiveMendingPcs(null);
          }}
          backLabel="Kembali"
          startTime={startMendingTime}
          elapsedSeconds={elapsedSeconds}
          isPaused={isPaused}
          onTogglePause={handleTogglePause}
          onCancel={() => setIsCancelConfirmOpen(true)}
          cancelLabel="Batal Mending"
          pauseLabel="Mending"
        />



        <div className="mb-6">
          <CompactHeaderCard {...compactProps} />
        </div>

        {!isMeteranBatch && detailsToDisplay.length > 0 && (
          <div className="mb-4 flex justify-end animate-fadeIn">
            <button
              onClick={() => {
                setInsertPanelMode("append");
                setInsertPanelAt("");
                setInsertPanelHasDefect(false);
                setInsertPanelIsBs(false);
                setSelectedCategories([]);
                setSelectedDetails({});
                setInputBloks({});
                setInsertPanelKeterangan("");
              }}
              className="h-11 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-purple-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Panel
            </button>
          </div>
        )}

        {isMeteranBatch && detailsToDisplay.length > 0 && (
          <div className="mb-4 flex justify-end animate-fadeIn">
            <button
              onClick={() => setIsDefectModalOpen(true)}
              className="h-11 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-rose-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Temuan Cacat Baru
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {detailsToDisplay.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                <CheckCircle className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Tidak ada panel/roll untuk di-mending.</h3>
            </div>
          ) : detailsToDisplay.length === 1 && !detailsToDisplay[0].kategori_masalah ? (
            <div className="p-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 border border-emerald-100">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">PCS Normal Bebas Cacat</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-sm">
                PCS ini tidak memiliki catatan masalah dari proses QC. Anda dapat langsung menyelesaikan mending.
              </p>
              
              <button
                onClick={() => {
                  handleSelectGrade(detailsToDisplay[0].id, "A");
                  setIsModalOpen(true);
                }}
                className="h-12 px-8 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Selesaikan Mending Cepat
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                {isMeteranBatch ? (
                  <MeterMendingTable
                    displayItems={displayItems}
                    selections={selections}
                    onSelectGrade={handleSelectGrade}
                    onOpenDetail={handleOpenDetail}
                    onDeleteDetail={setDetailToDelete}
                  />
                ) : (
                  <PanelMendingTable
                    displayItems={displayItems}
                    selections={selections}
                    onSelectGrade={handleSelectGrade}
                    onOpenDetail={handleOpenDetail}
                    onDeleteDetail={setDetailToDelete}
                    totalGradable={totalGradable}
                    totalA={totalA}
                    totalB={totalB}
                    totalBS={totalBS}
                  />
                )}
              </div>
              <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end">
                <button
                  disabled={!isAllSelected}
                  onClick={() => setIsModalOpen(true)}
                  className={`h-12 px-8 rounded-xl font-bold text-sm text-white flex items-center gap-2 transition-all duration-300 ${isAllSelected ? "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 active:scale-95" : "bg-slate-300 cursor-not-allowed"}`}
                >
                  <CheckCircle className="w-5 h-5" />
                  Isi Rangkuman & Kirim Inspeksi
                </button>
              </div>
            </>
          )}
        </div>
        
        {/* Cancel Mending Confirmation Modal */}
        {isCancelConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4 mx-auto">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-center text-slate-800 mb-2">Batalkan Mending PCS?</h3>
              <p className="text-xs text-center text-slate-500 mb-6 leading-relaxed">
                Sesi timer dan draft mending PCS ini akan dibatalkan & direset. Anda akan kembali ke antrean utama.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsCancelConfirmOpen(false)}
                  className="flex-1 h-11 rounded-xl font-bold text-slate-600 hover:bg-slate-100 text-xs transition-colors cursor-pointer"
                >
                  Tetap Lanjut
                </button>
                <button
                  onClick={handleCancelMending}
                  className="flex-1 h-11 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 text-xs transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  Ya, Batalkan
                </button>
              </div>
            </div>
          </div>
        )}

        {isModalOpen && (
          <MendingModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            headerData={{ details: detailsToDisplay }}
            selections={selections}
            detailData={detailsToDisplay}
            startMendingTime={startMendingTime}
            pauseSeconds={pauseSeconds}
            elapsedSeconds={elapsedSeconds}
            onSuccess={async () => {
              setIsModalOpen(false);
              if (activeMendingPcs) {
                await deleteTimerSession("mending", activeMendingPcs.nomor_mc, activeMendingPcs.design_id, activeMendingPcs.potongan_ke, activeMendingPcs.pcs_index);
                fetchActiveSessions();
              }
              setActiveMendingPcs(null);
              handleSearch(searchTanggal);
            }}
          />
        )}
        
        <ProductionDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          detailData={detailData}
          isLoading={isDetailLoading}
          hideEdit={true}
        />
        
        {isDefectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-rose-500" /> Tambah Temuan Cacat Baru
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Catat temuan cacat baru yang ditemukan saat mending kain meteran.</p>
                </div>
                <button onClick={() => { setIsDefectModalOpen(false); setDefectError(null); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-5 custom-scrollbar">
                {defectError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {defectError}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Posisi Meter Kain <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={defectMeterKain}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e") e.preventDefault();
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDefectMeterKain(val);
                      if (val !== "" && (isNaN(parseFloat(val)) || parseFloat(val) < 0)) {
                        setDefectError("Posisi Meter Kain tidak boleh bernilai kurang dari 0.");
                      } else if (defectError === "Posisi Meter Kain tidak boleh bernilai kurang dari 0.") {
                        setDefectError(null);
                      }
                    }}
                    className="h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-base font-semibold focus:bg-white focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all"
                    placeholder="Contoh: 75"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-rose-600 uppercase">Kategori Masalah <span className="text-rose-500">*</span> (Pilih 1 atau lebih)</label>
                  <div className="flex flex-col gap-2 mt-1">
                    {problemCategories.map((c) => {
                      const isChecked = defectKategori.includes(c.id);
                      return (
                        <div key={c.id} className="flex flex-col gap-1">
                          <label className="cursor-pointer block">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleDefectToggleKategori(c.id)}
                              className="peer sr-only"
                            />
                            <div className="p-3.5 rounded-xl border-2 border-slate-100 bg-white text-xs font-bold text-slate-700 peer-checked:border-rose-500 peer-checked:bg-rose-50/50 peer-checked:text-rose-700 transition-all hover:border-slate-200 shadow-sm flex items-center justify-between">
                              <span>{c.name}</span>
                              {isChecked && <CheckCircle className="w-4 h-4 text-rose-500 shrink-0 ml-2" />}
                            </div>
                          </label>
                          {isChecked && (
                            <div className="pl-4 pr-2 py-2 border-l-2 border-rose-200 ml-2 animate-fadeIn mt-1 flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Pilih Detail Masalah</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                                 {(problemDetailsMap[c.id] || []).map((p) => {
                                  const currentList = defectDetailMap[c.id] || [];
                                  const isDetailChecked = currentList.includes(p);
                                  return (
                                    <label key={`${c.id}-${p}`} className="cursor-pointer block">
                                      <input
                                        type="checkbox"
                                        checked={isDetailChecked}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setDefectDetailMap((prev) => ({
                                              ...prev,
                                              [c.id]: [...(prev[c.id] || []), p]
                                            }));
                                          } else {
                                            setDefectDetailMap((prev) => ({
                                              ...prev,
                                              [c.id]: (prev[c.id] || []).filter((item) => item !== p)
                                            }));
                                          }
                                        }}
                                        className="peer sr-only"
                                      />
                                      <div className="p-2.5 rounded-xl border border-slate-150 bg-white text-[11px] font-semibold text-slate-655 peer-checked:border-rose-450 peer-checked:bg-rose-50/30 peer-checked:text-rose-700 transition-all hover:border-slate-200 flex items-center justify-between shadow-sm">
                                        <span>{p}</span>
                                        {isDetailChecked && <CheckCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 ml-1" />}
                                      </div>
                                    </label>
                                  );
                                })}

                                {(defectDetailMap[c.id] || [])
                                  .filter((p) => !(problemDetailsMap[c.id] || []).includes(p))
                                  .map((customDetail) => (
                                    <div key={`${c.id}-${customDetail}`} className="relative flex items-center">
                                      <div className="flex-1 p-2.5 rounded-xl border border-rose-450 bg-rose-50/30 text-rose-700 text-[11px] font-semibold flex items-center justify-between shadow-sm">
                                        <span className="truncate">{customDetail}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDefectDetailMap((prev) => ({
                                              ...prev,
                                              [c.id]: (prev[c.id] || []).filter((d) => d !== customDetail),
                                            }));
                                          }}
                                          className="ml-1 p-0.5 hover:bg-rose-100 rounded text-rose-600 cursor-pointer"
                                          title="Hapus detail manual"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                              </div>

                              {c.id === "G" && (
                                <div className="mt-2 pt-2 border-t border-rose-100 col-span-full">
                                  <label className="text-[10px] font-bold text-slate-600 uppercase mb-1 flex items-center justify-between">
                                    <span className="flex items-center gap-1 text-slate-700">
                                      <Edit3 className="w-3 h-3 text-rose-500" />
                                      Input Masalah Manual (Jika tidak ada di pilihan)
                                    </span>
                                  </label>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={qcDefectManualInput[c.id] || ""}
                                      onChange={(e) =>
                                        setQcDefectManualInput((prev) => ({ ...prev, [c.id]: e.target.value }))
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          handleAddQcDefectManual(c.id);
                                        }
                                      }}
                                      placeholder="Ketik detail masalah manual di sini..."
                                      className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-rose-450 font-medium text-slate-800 placeholder:text-slate-400"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAddQcDefectManual(c.id)}
                                      disabled={!(qcDefectManualInput[c.id] || "").trim()}
                                      className="px-3 py-1.5 bg-rose-500 text-white font-bold text-xs rounded-lg hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Tambah</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Keterangan Tambahan</label>
                  <textarea value={defectKeterangan} onChange={(e) => setDefectKeterangan(e.target.value)} rows={3} className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:bg-white focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all resize-none" placeholder="Tuliskan keterangan tambahan jika ada..." />
                </div>
              </div>
              <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button onClick={() => { setIsDefectModalOpen(false); setDefectError(null); }} className="h-11 px-5 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all">Batal</button>
                <button disabled={isSubmittingDefect || !defectMeterKain || isNaN(parseFloat(defectMeterKain)) || parseFloat(defectMeterKain) < 0} onClick={handleSubmitDefect} className="h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-rose-600/20">
                  {isSubmittingDefect ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Simpan Temuan
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Pop up modal hapus rincian */}
        {detailToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
              <div className="flex items-center gap-3 mb-4 text-rose-600">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold">Hapus Baris Data?</h3>
              </div>
              
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Anda yakin ingin menghapus baris rincian data ini secara permanen?<br/>
                <span className="font-semibold block mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100 text-slate-800">
                  {detailToDelete.name}
                </span>
              </p>
              
              <div className="flex gap-3 justify-end mt-4">
                <button
                  onClick={() => setDetailToDelete(null)}
                  disabled={isDeletingDetail}
                  className="px-4 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteDetail}
                  disabled={isDeletingDetail}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isDeletingDetail ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Ya, Hapus Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Insert Panel Modal */}
        {renderInsertPanelModal()}
      </div>
    );
  }

  // Render Table View (Main Page)
  return (
    <div className="w-full max-w-6xl mx-auto pb-24 sm:pb-28">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Scissors className="w-6 h-6 text-rose-500" />
            Proses Mending
          </h1>
          <p className="text-sm font-semibold text-slate-500">
            Total antrean baris yang belum dimending: <span className="text-rose-500 font-bold">{groupedPcsList.length} Antrean</span>
          </p>
        </div>

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

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 items-end gap-4 w-full">
          <div className="flex flex-col gap-1 w-full">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
              <span>Tanggal</span>
            </label>
            <input
              type="date"
              value={searchTanggal}
              onChange={(e) => setSearchTanggal(e.target.value)}
              className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-rose-400 focus:bg-white outline-none w-full cursor-pointer"
            />
          </div>
          <div className="flex flex-col gap-1 w-full">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Mesin
            </label>
            <select
              value={searchMesin}
              onChange={(e) => setSearchMesin(e.target.value)}
              className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-rose-400 focus:bg-white outline-none w-full cursor-pointer"
            >
              <option value="">Semua Mesin</option>
              {uniqueMesins.map(m => (
                <option key={String(m)} value={String(m)}>{String(m)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 w-full">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Potongan
            </label>
            <select
              value={searchPotongan}
              onChange={(e) => setSearchPotongan(e.target.value)}
              className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-rose-400 focus:bg-white outline-none w-full cursor-pointer"
            >
              <option value="">Semua Potongan</option>
              {uniquePotongans.map(p => (
                <option key={String(p)} value={String(p)}>{String(p)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 w-full">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Urutan Waktu
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
              className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-rose-400 focus:bg-white outline-none w-full cursor-pointer"
            >
              <option value="desc">Terbaru</option>
              <option value="asc">Terlama</option>
            </select>
          </div>
          <button
            onClick={() => handleSearch(searchTanggal)}
            disabled={isSearching}
            className="h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm shrink-0 w-full col-span-1 sm:col-span-2 md:col-span-1"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Cari Data
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fadeIn">
        {groupedPcsList.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Package className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-1">
              Tidak Ada Antrean Mending
            </h3>
            <p className="text-sm text-slate-500">
              Tidak ditemukan data produksi yang perlu dimending pada tanggal ini.
            </p>
          </div>
        ) : (
          <div>
            {/* Mobile & Tablet Card View (< md) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 md:hidden">
              {currentPcsList.map((g: any) => {
                const sessionKey = `${g.nomor_mc}_${g.design_id}_${g.potongan_ke}_${g.pcs_index}`;
                const session = activeSessionsMap.get(sessionKey);
                const isPausedItem = session?.is_paused;
                const isProcessingItem = session && !session.is_paused;

                return (
                  <div key={sessionKey} className={`p-4 rounded-2xl border transition-all ${isPausedItem ? "bg-amber-50/50 border-amber-300" : (isProcessingItem ? "bg-emerald-50/30 border-emerald-300" : "bg-white border-slate-200 shadow-xs hover:shadow-sm")}`}>
                    {/* Top Section: ONLY Mesin, Potongan & PCS */}
                    <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="inline-flex items-center justify-center h-8 px-3 rounded-lg bg-[#0070bc]/10 text-[#0070bc] font-black text-xs">
                          {g.header?.nomor_mc}
                        </div>
                        <div className="inline-flex items-center justify-center h-8 px-3 rounded-lg bg-slate-100 text-slate-800 font-extrabold text-xs border border-slate-200/80">
                          #{g.header?.potongan_ke || "-"}
                        </div>
                      </div>
                      <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-100 font-extrabold text-slate-800 text-xs border border-slate-200/60 shadow-xs">
                        PCS {g.pcs_index} / {g.total_pcs || g.pcs_index}
                      </div>
                    </div>

                    {/* Middle Section: Tanggal/Waktu & Desain */}
                    <div className="flex flex-col gap-2 mb-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Tanggal & Waktu</span>
                        <span className="font-bold text-slate-800 text-right">
                          {g.header?.tgl || "-"} {g.header?.tanggal_jam ? `(${new Date(g.header.tanggal_jam).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })})` : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Desain</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 whitespace-nowrap">{g.header?.design_id}</span>
                          {g.header?.panel_no === "METERAN" ? (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-purple-100 text-purple-700 uppercase tracking-wider">METERAN</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">PANEL</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Section: Action Button */}
                    <button
                      onClick={() => handleStartMending(g.nomor_mc, g.design_id, g.potongan_ke, g.pcs_index)}
                      className={`w-full h-10 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm ${
                        isPausedItem 
                          ? "bg-amber-500 hover:bg-amber-600 text-white" 
                          : (isProcessingItem ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white")
                      }`}
                    >
                      {isPausedItem ? (
                        <><Play className="w-3.5 h-3.5 fill-white" /> Lanjut Mending</>
                      ) : isProcessingItem ? (
                        <><Play className="w-3.5 h-3.5 fill-white" /> Buka Mending</>
                      ) : (
                        <><Scissors className="w-3.5 h-3.5" /> Mulai Mending</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[700px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="sticky left-0 z-20 bg-slate-50 px-6 py-4 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Tanggal & Waktu</th>
                    <th className="px-6 py-4">Nomor Mesin</th>
                    <th className="px-6 py-4">Potongan</th>
                    <th className="px-6 py-4">Desain</th>
                    <th className="px-6 py-4 text-center">PCS Ke</th>
                    <th className="px-6 py-4 text-center whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                  {currentPcsList.map((g: any) => {
                    const sessionKey = `${g.nomor_mc}_${g.design_id}_${g.potongan_ke}_${g.pcs_index}`;
                    const session = activeSessionsMap.get(sessionKey);
                    const isPausedItem = session?.is_paused;
                    const isProcessingItem = session && !session.is_paused;

                    return (
                      <tr key={sessionKey} className={`hover:bg-slate-50/50 transition-colors ${isPausedItem ? "bg-amber-50/40" : ""}`}>
                        <td className="sticky left-0 z-10 bg-white px-6 py-4 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="font-bold text-slate-800">
                            {g.header?.tgl || "-"}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {g.header?.tanggal_jam 
                              ? new Date(g.header.tanggal_jam).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) 
                              : "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="inline-flex items-center min-w-[3rem] h-8 px-3 rounded-lg bg-[#0070bc]/10 text-[#0070bc] font-bold">
                            {g.header?.nomor_mc}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                            #{g.header?.potongan_ke || "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-800 font-bold flex items-center gap-2 whitespace-nowrap">
                            {g.header?.design_id}
                            {g.header?.panel_no === "METERAN" ? (
                              <span className="px-2 py-0.5 rounded text-[9px] font-black bg-purple-100 text-purple-700 uppercase tracking-wider">METERAN</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">PANEL</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-100 font-extrabold text-slate-700 text-xs whitespace-nowrap border border-slate-200/60 shadow-xs">
                              {g.pcs_index} / {g.total_pcs || g.pcs_index}
                            </div>
                            {isPausedItem && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-black text-[10px] animate-pulse">
                                <Pause className="w-3 h-3 fill-amber-600" /> DIPAUSE
                              </span>
                            )}
                            {isProcessingItem && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px]">
                                <Play className="w-3 h-3 fill-emerald-600" /> PROSES
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          {isPausedItem ? (
                            <button
                              onClick={() => handleStartMending(g.nomor_mc, g.design_id, g.potongan_ke, g.pcs_index)}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 mx-auto cursor-pointer whitespace-nowrap"
                            >
                              <Play className="w-3.5 h-3.5 fill-white" /> Lanjut Mending
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartMending(g.nomor_mc, g.design_id, g.potongan_ke, g.pcs_index)}
                              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-sm flex items-center gap-1.5 mx-auto"
                            >
                              <Scissors className="w-3.5 h-3.5" />
                              {isProcessingItem ? "Buka Mending" : "Mulai Mending"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>        
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                <span className="text-xs font-medium text-slate-500">
                  Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, groupedPcsList.length)} dari {groupedPcsList.length} antrean
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${currentPage === p ? "bg-rose-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Insert Panel Modal */}
      {renderInsertPanelModal()}

      <ProductTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        steps={MENDING_TOUR_STEPS}
      />
    </div>
  );
}
