"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Loader2,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Package,
  X,
  Plus,
  Clock,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Box,
  Edit3,
  Play,
  Pause,
  Timer,
  RotateCcw,
  Trash2,
  MapPin,
  SlidersHorizontal,
  Calendar,
  ChevronDown,
  Cpu,
  Scissors,
} from "lucide-react";
import DateRangePicker from "@/components/ui/DateRangePicker";
import QCInspectionModal from "@/components/forms/QCInspectionModal";
import QCEditDetailModal from "@/components/forms/QCEditDetailModal";
import QCBulkEditModal from "@/components/forms/QCBulkEditModal";
import ProductionDetailModal from "@/components/ProductionDetailModal";
import DeletePanelModal from "@/components/forms/DeletePanelModal";
import InsertPanelModal, { InsertPanelPayload } from "@/components/forms/InsertPanelModal";
import ProductTour, { ProductTourStep } from "@/components/ProductTour";
import { createProblemDetail, getProblemCategories, getProblemDetailsGrouped } from "@/actions/problem-detail-actions";
import {
  addQCDefectDetail,
  getAllPendingQCDetails,
  getPendingQCDetailsByBatch,
  insertMissingPanel,
  deleteProductionDetailRow,
} from "@/actions/qc-actions";
import { getEmployeeHistoryDetail } from "@/actions/employee-actions";
import { getBlockRequiredDefects } from "@/actions/machine-config-actions";
import {
  getTimerSession,
  upsertTimerSession,
  deleteTimerSession,
  getActiveTimerSessions,
} from "@/actions/timer-actions";
import PanelQCTable from "./components/PanelQCTable";
import MeterQCTable from "./components/MeterQCTable";
import CompactHeaderCard from "@/components/forms/CompactHeaderCard";
import SessionTimerHeader from "@/components/forms/SessionTimerHeader";
import { formatHHMM, formatTimerSeconds } from "@/lib/shift-utils";
import { isPanelGagalCacatAja } from "@/lib/mending-grade-utils";

// Problem categories matching ContinuousForm
const QC_INSPECTION_TOUR_STEPS: ProductTourStep[] = [
  {
    target: "qc-inspection-header",
    title: "Inspeksi QC",
    description:
      "Halaman ini dipakai untuk mencari data produksi yang menunggu inspeksi QC.",
  },
  {
    target: "qc-inspection-filter",
    title: "Filter Data",
    description:
      "Gunakan filter Tanggal dan Mesin untuk mencari antrean QC.",
  },
  {
    target: "qc-inspection-results",
    title: "Panel untuk Dinilai",
    description:
      "Nilai setiap panel dengan ceklis atau silang. Data normal otomatis cenderung dipilih ceklis, data bermasalah dipilih silang.",
  },
  {
    target: "qc-inspection-submit",
    title: "Kirim Inspeksi",
    description:
      "Setelah semua panel punya hasil, lanjut isi rangkuman dan kirim inspeksi.",
  },
];

const DEFAULT_PROBLEM_CATEGORIES = [
  { id: "A", name: "Kode A: Masalah dan Perbaikan Benang" },
  { id: "B", name: "Kode B: Perbaikan Jarum dan Element Rajutan (Mechanical)" },
  { id: "C", name: "Kode C: Pengaturan dan Design stup" },
  { id: "D", name: "Kode D: Bahan Baku dan penggantian Benang" },
  { id: "E", name: "Kode E: Masalah Kelistrikan" },
  { id: "F", name: "Kode F: Perawatan Mesin,Perbaikan Mekanik (maintenance)" },
  { id: "G", name: "Kode G: Faktor Eksternal dan Non-Teknis" },
];

import { DEFAULT_PROBLEM_DETAILS, REGISTERED_MACHINES, PROBLEM_DETAILS, GROUPED_PROBLEM_DETAILS } from "@/lib/constants";

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

  // Scan other details in the same header (from pre-fetched data)
  if (h && h.production_details && h.production_details.length > 0) {
    for (const d of h.production_details) {
      if (d.meter_kain !== null && d.meter_kain !== undefined && String(d.meter_kain).trim() !== "") {
        const clean = cleanMeterVal(d.meter_kain);
        const parsed = parseFloat(clean);
        if (!isNaN(parsed)) return parsed;
      }
      if (d.detail_masalah) {
        const meterMatch = d.detail_masalah.match(/\(Titik:\s*([A-Za-z0-9\s.\-]+)\)/i);
        if (meterMatch && meterMatch[1]) {
          const clean = cleanMeterVal(meterMatch[1]);
          const parsed = parseFloat(clean);
          if (!isNaN(parsed)) return parsed;
        }
      }
    }
  }

  const isIstirahat = (!!item.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") || 
                       !!item.kategori_masalah?.toUpperCase().includes("ISTIRAHAT")) && 
                      !item.kategori_masalah && !item.detail_masalah &&
                      h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "";
  const isFinishReport = h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "";
  if ((isIstirahat || isFinishReport) && (h.meter_akhir || h.meter_awal)) {
    const clean = cleanMeterVal(h.meter_akhir || h.meter_awal);
    const parsed = parseFloat(clean);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
};

const formatLastInputDate = (isoString: string | null) => {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch (e) {
    return "-";
  }
};

const formatLastInputTime = (isoString: string | null) => {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "-";
  }
};

const formatDurationSeconds = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}j ${m}m ${s}d`;
  if (m > 0) return `${m}m ${s}d`;
  return `${s}d`;
};

export default function QCPage() {
  const [searchStartDate, setSearchStartDate] = useState("");
  const [searchEndDate, setSearchEndDate] = useState("");
  const [searchTanggal, setSearchTanggal] = useState("");
  const [searchMesin, setSearchMesin] = useState("");
  const [searchPotongan, setSearchPotongan] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTourOpen, setIsTourOpen] = useState(false);
  
  const [allDetails, setAllDetails] = useState<any[]>([]);
  const [activeQcPcs, setActiveQcPcs] = useState<{ nomor_mc: string, design_id: string, potongan_ke: string, pcs_index: string } | null>(null);
  const [fullActiveQcDetails, setFullActiveQcDetails] = useState<any[]>([]);
  const [startInspectTime, setStartInspectTime] = useState<string>("");
  const [startTimeIso, setStartTimeIso] = useState<string | null>(null);
  const [pausedAt, setPausedAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [isPaused, setIsPaused] = useState(false);
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [activeSessionsMap, setActiveSessionsMap] = useState<Map<string, any>>(new Map());

  const fetchActiveSessions = async () => {
    const res = await getActiveTimerSessions("qc");
    if (res.success && res.data) {
      const map = new Map<string, any>();
      res.data.forEach((s: any) => {
        const key = `${s.nomor_mc}_${s.potongan_ke}_${s.pcs_index}`;
        map.set(key, s);
      });
      setActiveSessionsMap(map);
    }
  };

  const [problemCategories, setProblemCategories] = useState(DEFAULT_PROBLEM_CATEGORIES);
  const [problemDetailsMap, setProblemDetailsMap] = useState<Record<string, string[]>>(DEFAULT_PROBLEM_DETAILS);
  const [dynamicGroupMapping, setDynamicGroupMapping] = useState<Record<string, { groupName: string; items: string[] }[]>>(GROUPED_PROBLEM_DETAILS);
  const [selectedDetailForEdit, setSelectedDetailForEdit] = useState<any | null>(null);
  const [isEditDetailModalOpen, setIsEditDetailModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add_qc" | "edit">("add_qc");

  const handleOpenAddQC = (detail: any) => {
    setSelectedDetailForEdit(detail);
    setModalMode("add_qc");
    setIsEditDetailModalOpen(true);
  };

  const handleOpenEditQC = (detail: any) => {
    setSelectedDetailForEdit(detail);
    setModalMode("edit");
    setIsEditDetailModalOpen(true);
  };

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
      if (groupRes?.success) {
        if (groupRes.grouped && Object.keys(groupRes.grouped).length > 0) {
          setProblemDetailsMap(groupRes.grouped);
        }
        if (groupRes.groupMapping) {
          setDynamicGroupMapping(groupRes.groupMapping);
        }
      }
      setIsLoadingFilters(false);
    }).catch((e) => console.error("Error loading parallel metadata:", e));
  }, []);

  // 1-second interval to tick nowMs when active (updates UI in real time, immune to tab throttle drift)
  useEffect(() => {
    if (!activeQcPcs) return;
    setNowMs(Date.now());
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [activeQcPcs]);

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
    if (!activeQcPcs) return;
    const syncInterval = setInterval(() => {
      upsertTimerSession({
        type: "qc",
        nomor_mc: activeQcPcs.nomor_mc,
        design_id: activeQcPcs.design_id,
        potongan_ke: activeQcPcs.potongan_ke,
        pcs_index: activeQcPcs.pcs_index,
        start_time: startTimeIso || undefined,
        is_paused: isPaused,
        pause_seconds: pauseSeconds,
        paused_at: pausedAt,
        elapsed_seconds: elapsedSeconds,
      });
    }, 5000);
    return () => clearInterval(syncInterval);
  }, [activeQcPcs, startTimeIso, isPaused, pauseSeconds, pausedAt, elapsedSeconds]);

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

    if (activeQcPcs) {
      await upsertTimerSession({
        type: "qc",
        nomor_mc: activeQcPcs.nomor_mc,
        design_id: activeQcPcs.design_id,
        potongan_ke: activeQcPcs.potongan_ke,
        pcs_index: activeQcPcs.pcs_index,
        start_time: startTimeIso || undefined,
        is_paused: nextPause,
        pause_seconds: nextPauseSeconds,
        paused_at: nextPausedAt,
        elapsed_seconds: elapsedSeconds,
      });
      fetchActiveSessions();
    }
  };

  const handleCancelQC = async () => {
    if (activeQcPcs) {
      await deleteTimerSession("qc", activeQcPcs.nomor_mc, activeQcPcs.design_id, activeQcPcs.potongan_ke, activeQcPcs.pcs_index);
      fetchActiveSessions();
    }
    setActiveQcPcs(null);
    setFullActiveQcDetails([]);
    setSelections({});
    setIsCancelConfirmOpen(false);
  };

  const [availableFilters, setAvailableFilters] = useState<any[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);

  // Map of detailId -> finalInspectionId (1, 2, or 3)
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Bulk Selection & Edit States
  const [selectedDetailIds, setSelectedDetailIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailToDelete, setDetailToDelete] = useState<any>(null);
  const [insertPanelMode, setInsertPanelMode] = useState<"insert" | "append" | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [requiredBlockDefects, setRequiredBlockDefects] = useState<string[]>([]);

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

  // Add Defect Modal State (METERAN only)
  const [isDefectModalOpen, setIsDefectModalOpen] = useState(false);
  const [defectInputMode, setDefectInputMode] = useState<"single" | "range">("single");
  const [defectMeterKain, setDefectMeterKain] = useState("");
  const [defectMeterAwal, setDefectMeterAwal] = useState("");
  const [defectMeterAkhir, setDefectMeterAkhir] = useState("");
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

  const saveQCFilters = (sDate: string, eDate: string, m: string, p: string, s: "desc" | "asc") => {
    try {
      const payload = { startDate: sDate, endDate: eDate, tanggal: sDate, mesin: m, potongan: p, sortOrder: s };
      sessionStorage.setItem("dji_qc_filters", JSON.stringify(payload));
      localStorage.setItem("dji_qc_filters", JSON.stringify(payload));
    } catch (e) {}
  };

  useEffect(() => {
    let initStart = "";
    let initEnd = "";
    let initM = "";
    let initP = "";
    let initS: "desc" | "asc" = "desc";

    try {
      const saved = sessionStorage.getItem("dji_qc_filters") || localStorage.getItem("dji_qc_filters");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.startDate !== undefined) { initStart = parsed.startDate; setSearchStartDate(parsed.startDate); }
        else if (parsed.tanggal !== undefined) { initStart = parsed.tanggal; setSearchStartDate(parsed.tanggal); }
        if (parsed.endDate !== undefined) { initEnd = parsed.endDate; setSearchEndDate(parsed.endDate); }
        else if (initStart) { initEnd = initStart; setSearchEndDate(initStart); }
        if (initStart) setSearchTanggal(initStart);
        if (parsed.mesin !== undefined) { initM = parsed.mesin; setSearchMesin(parsed.mesin); }
        if (parsed.potongan !== undefined) { initP = parsed.potongan; setSearchPotongan(parsed.potongan); }
        if (parsed.sortOrder === "asc" || parsed.sortOrder === "desc") { initS = parsed.sortOrder; setSortOrder(parsed.sortOrder); }
      }
    } catch (e) {}

    handleSearch(initStart, initEnd, initM, initP);
  }, []);

  const handleSearch = async (startDate?: string, endDate?: string, mesin?: string, potongan?: string) => {
    setIsSearching(true);
    setErrorMsg(null);
    setAllDetails([]);
    setActiveQcPcs(null);
    setSelections({});
    setCurrentPage(1);

    const sDate = startDate !== undefined ? startDate : searchStartDate;
    const eDate = endDate !== undefined ? endDate : searchEndDate;
    const m = mesin !== undefined ? mesin : searchMesin;
    const p = potongan !== undefined ? potongan : searchPotongan;

    saveQCFilters(sDate, eDate, m, p, sortOrder);

    const res = await getAllPendingQCDetails({
      startDate: sDate || undefined,
      endDate: eDate || undefined,
      mesin: m || undefined,
      potongan: p || undefined,
    });
    
    if (res.success && res.data) {
      setAllDetails(res.data);
    } else {
      let msg = res.error || "Gagal mencari data.";
      if (typeof msg === "string" && (msg.includes("502") || msg.includes("Bad Gateway") || msg.includes("<html") || msg.includes("<!DOCTYPE"))) {
        msg = "Koneksi ke server terputus (502 Bad Gateway). Silakan coba lagi atau gunakan filter tanggal/mesin yang lebih spesifik.";
      }
      setErrorMsg(msg);
    }
    setIsSearching(false);
  };

  const groupedPcsList = React.useMemo(() => {
    const batchPcsMap = new Map<string, Set<number>>();
    allDetails.forEach((d: any) => {
      const h = d.production_headers;
      if (!h) return;
      const batchKey = `${h.nomor_mc}_${h.potongan_ke}`;
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

      const batchKey = `${h?.nomor_mc}_${h?.potongan_ke}`;
      const pcsSet = batchPcsMap.get(batchKey);
      const maxPcs = pcsSet && pcsSet.size > 0 ? Math.max(...Array.from(pcsSet)) : parseInt(d.pcs_index, 10) || 1;

      const isTricoteMachine = String(h?.nomor_mc || "").trim().toUpperCase().startsWith("T");
      const pcsIndex = d.pcs_index ? String(d.pcs_index) : "1";
      const key = isTricoteMachine ? `${batchKey}_tricote` : `${batchKey}_${pcsIndex}`;
      if (!map.has(key)) {
        const displayPcs = (isTricoteMachine && pcsSet && pcsSet.size > 1)
          ? Array.from(pcsSet).sort((a, b) => a - b).join(" & ")
          : pcsIndex;
        map.set(key, {
          nomor_mc: h?.nomor_mc,
          design_id: h?.design_id,
          potongan_ke: h?.potongan_ke,
          pcs_index: displayPcs,
          start_pcs_index: pcsIndex,
          total_pcs: maxPcs,
          isTricote: isTricoteMachine,
          meter_kain: d.meter_kain || null,
          header: h,
          detailsCount: 0,
          totalHasilProduksi: 0,
          lastInputTime: h?.tanggal_jam || null
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
          group.header = h;
          group.design_id = h?.design_id;
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
  }, [searchMesin, searchTanggal, searchPotongan, sortOrder]);

  const handleStartQC = async (nomor_mc: string, design_id: string, potongan_ke: string, pcs_index: string) => {
    setActiveQcPcs({ nomor_mc: String(nomor_mc), design_id: String(design_id), potongan_ke: String(potongan_ke), pcs_index: String(pcs_index) });
    setSelections({});
    const now = new Date();
    setNowMs(now.getTime());
    const defaultIso = now.toISOString();

    const isTricote = String(nomor_mc || "").trim().toUpperCase().startsWith("T");

    // 1. Fetch details first (Mesin Tricote / Awalan T memuat seluruh PCS sekaligus untuk diinspeksi bersamaan)
    const res = await getPendingQCDetailsByBatch(nomor_mc, design_id, potongan_ke);
    const filteredByPcs = (res.success && res.data)
      ? (isTricote ? res.data : res.data.filter((d: any) => String(d.pcs_index || "1") === String(pcs_index || "1")))
      : [];
    setFullActiveQcDetails(filteredByPcs);

    // 2. Check DB for active session
    const sessionRes = await getTimerSession("qc", nomor_mc, design_id, potongan_ke, pcs_index);
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
        type: "qc",
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
    setStartInspectTime(formatHHMM(startIso));
  };

  const detailsToDisplay = React.useMemo(() => {
    if (!fullActiveQcDetails) return [];
    
    return [...fullActiveQcDetails].sort((a: any, b: any) => {
      const hA = a.production_headers || {};
      const hB = b.production_headers || {};
      const panelA = hA.panel_no;
      const panelB = hB.panel_no;

      if (panelA === "METERAN" || panelB === "METERAN") {
        const valA = getActualMeter(a, hA);
        const valB = getActualMeter(b, hB);
        const mA = valA !== null ? valA : Infinity;
        const mB = valB !== null ? valB : Infinity;

        if (mA !== mB) {
          return mA - mB;
        }

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

        const hjA = String(hA.tanggal_jam || "");
        const hjB = String(hB.tanggal_jam || "");
        return hjA.localeCompare(hjB);
      } else {
        const numA = parseInt(panelA, 10);
        const numB = parseInt(panelB, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          if (numA !== numB) return numA - numB;
          const isQcA = !!a.isPanelInsertedByQc || !!a.keterangan_cacat?.includes("[TAMBAHAN QC]") || !!a.keterangan_cacat?.includes("[TAMBAHAN MENDING]") || !!a.hasTambahanQC || !!a.hasTambahanMnd || (!!a.keterangan_qc && a.keterangan_qc !== "-");
          const isQcB = !!b.isPanelInsertedByQc || !!b.keterangan_cacat?.includes("[TAMBAHAN QC]") || !!b.keterangan_cacat?.includes("[TAMBAHAN MENDING]") || !!b.hasTambahanQC || !!b.hasTambahanMnd || (!!b.keterangan_qc && b.keterangan_qc !== "-");
          if (!isQcA && isQcB) return -1;
          if (isQcA && !isQcB) return 1;
          const diffJml = (b.jml_hasil_produksi || 0) - (a.jml_hasil_produksi || 0);
          if (diffJml !== 0) return diffJml;
          const timeA = new Date(a.created_at || a.created_date || 0).getTime();
          const timeB = new Date(b.created_at || b.created_date || 0).getTime();
          if (timeA !== timeB && !isNaN(timeA) && !isNaN(timeB)) return timeA - timeB;
          return String(a.id || "").localeCompare(String(b.id || ""));
        }
        return String(panelA || "").localeCompare(String(panelB || ""), undefined, { numeric: true });
      }
    });
  }, [fullActiveQcDetails]);

  const isMeteranBatch = detailsToDisplay.length > 0 && detailsToDisplay[0]?.production_headers?.panel_no === "METERAN";
  const meteranHeaderId = detailsToDisplay.length > 0 ? detailsToDisplay[0]?.header_id : null;

  const checkIsDefectRow = (d: any) => {
    if (!d) return false;
    if (d.isStartRow || d.cacatDisplay === "START" || d.cacatDisplay === "FINISH" || d.cacatDisplay === "ISTIRAHAT") {
      return false;
    }
    if (d.isIstirahat || d.hasIstirahat) return false;

    let hasRealDefects = false;
    if (d.production_defects && Array.isArray(d.production_defects) && d.production_defects.length > 0) {
      d.production_defects.forEach((def: any) => {
        const k = (def.kategori || "").toUpperCase();
        const det = (def.detail || "").toUpperCase();
        if (!k.includes("ISTIRAHAT") && !det.includes("ISTIRAHAT") && !det.includes("GAGAL CACAT") && k !== "G") {
          hasRealDefects = true;
        }
      });
    }

    const katStr = (d.kategori_masalah || "").toUpperCase();
    const detStr = (d.detail_masalah || "").toUpperCase();
    const ketStr = (d.keterangan_cacat || "").toUpperCase();

    if (ketStr.includes("START") || ketStr.includes("FINISH")) return false;
    if (katStr === "G" && !d.hasTambahanQC && (!d.production_defects || d.production_defects.length === 0)) return false;

    if (!hasRealDefects) {
      if (katStr && katStr !== "G" && !katStr.includes("ISTIRAHAT") && !katStr.includes("GAGAL CACAT")) {
        hasRealDefects = true;
      }
      if (
        detStr &&
        !detStr.includes("ISTIRAHAT") &&
        !detStr.includes("START") &&
        !detStr.includes("FINISH") &&
        !detStr.includes("GAGAL CACAT")
      ) {
        if (
          (d.kategori_masalah && katStr !== "G" && !katStr.includes("GAGAL CACAT")) ||
          (d.production_defects && d.production_defects.length > 0) ||
          d.hasTambahanQC
        ) {
          hasRealDefects = true;
        }
      }
    }

    if (d.hasTambahanQC) hasRealDefects = true;

    return hasRealDefects;
  };

  useEffect(() => {
    if (detailsToDisplay.length > 0) {
      setSelections((prev) => {
        const newSelections: Record<string, number> = {};
        const isMeteran = detailsToDisplay.some(
          (it) => it.production_headers?.panel_no === "METERAN" || (it.meter_kain !== null && it.meter_kain !== undefined && String(it.meter_kain).trim() !== "")
        );

        detailsToDisplay.forEach((d) => {
          if (d.is_deleted || d.status_inspeksi === "Dihapus") return;
          const pNo = String(d.production_headers?.panel_no || "").toUpperCase();
          const isSisa = pNo.includes("AWAL") || pNo.includes("AKHIR");
          const isGagalCacat = isPanelGagalCacatAja(d);

          if (prev[d.id]) {
            newSelections[d.id] = prev[d.id];
          } else if (d.final_inspection_id && [1, 2, 3, 4].includes(d.final_inspection_id)) {
            newSelections[d.id] = d.final_inspection_id;
          } else if (isGagalCacat) {
            // Gagal Cacat adalah false alarm (tidak ada cacat), selalu default Ceklis (1)
            newSelections[d.id] = 1;
          } else if (isMeteran) {
            // Pada kain meteran, jml_hasil_produksi === 0 adalah normal untuk titik stop/event non-yield (bukan lembaran BS)
            if (d.status_inspeksi === "BS" || d.kategori_masalah === "BS" || d.isBs) {
              newSelections[d.id] = 4;
            } else {
              newSelections[d.id] = 1;
            }
          } else if (isSisa || d.status_inspeksi === "BS" || d.kategori_masalah === "BS" || pNo.includes("(BS)") || d.jml_hasil_produksi === 0) {
            newSelections[d.id] = 4;
          } else {
            // Default ketika masuk ke inspeksi adalah semua ceklis (✓), termasuk jika ada cacat
            newSelections[d.id] = 1;
          }
        });
        return newSelections;
      });
    }
  }, [detailsToDisplay]);

  const handleSelectGrade = (detailId: string, grade: number) => {
    setSelections((prev) => ({ ...prev, [detailId]: grade }));
  };

  const handleToggleSelectDetail = (id: string) => {
    setSelectedDetailIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllDetails = (selectAll: boolean) => {
    if (!selectAll) {
      setSelectedDetailIds([]);
    } else {
      const allIds = detailsToDisplay
        .filter((d) => !d.is_deleted && d.status_inspeksi !== "Dihapus")
        .map((d) => d.id);
      setSelectedDetailIds(allIds);
    }
  };

  const handleBulkSetGrade = (grade: number) => {
    setSelections((prev) => {
      const next = { ...prev };
      selectedDetailIds.forEach((id) => {
        next[id] = grade;
      });
      return next;
    });
  };

  const handleBulkSuccess = async (_updatedData: any, _targetIds: string[]) => {
    setSelectedDetailIds([]);

    if (activeQcPcs) {
      const refreshRes = await getPendingQCDetailsByBatch(activeQcPcs.nomor_mc, activeQcPcs.design_id, activeQcPcs.potongan_ke);
      if (refreshRes.success && refreshRes.data) {
        const filteredByPcs = refreshRes.data.filter((d: any) => String(d.pcs_index) === activeQcPcs.pcs_index);
        setFullActiveQcDetails(filteredByPcs);
      }
    }
  };

  const isAllSelected =
    detailsToDisplay.length > 0 &&
    detailsToDisplay.every((d) => {
      if (d.is_deleted || d.status_inspeksi === "Dihapus") return true;
      return !!selections[d.id];
    });
  
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
    let targetMeter = defectMeterKain;
    let titikRangeStr = "";

    if (defectInputMode === "range") {
      const awal = parseFloat(defectMeterAwal);
      const akhir = parseFloat(defectMeterAkhir);
      if (isNaN(awal) || awal < 0) {
        setDefectError("Meter Awal harus diisi angka yang valid (>= 0).");
        return;
      }
      if (isNaN(akhir) || akhir < 0) {
        setDefectError("Meter Akhir harus diisi angka yang valid (>= 0).");
        return;
      }
      if (akhir <= awal) {
        setDefectError("Meter Akhir harus lebih besar dari Meter Awal.");
        return;
      }
      targetMeter = String(awal);
      titikRangeStr = `(Titik: ${defectMeterAwal} - ${defectMeterAkhir})`;
    } else {
      if (!defectMeterKain) { setDefectError("Posisi Meter Kain wajib diisi."); return; }
      if (parseFloat(defectMeterKain) < 0) { setDefectError("Posisi Meter Kain tidak boleh bernilai negatif."); return; }
      targetMeter = defectMeterKain;
    }

    if (defectKategori.length === 0) { setDefectError("Pilih minimal 1 Kategori Masalah."); return; }
    const missingDetails = defectKategori.some((cat) => !defectDetailMap[cat] || defectDetailMap[cat].length === 0);
    if (missingDetails) { setDefectError("Wajib memilih Detail Masalah untuk setiap Kategori yang dicentang."); return; }
    
    const meteranHeaderId = detailsToDisplay.length > 0 ? (detailsToDisplay[0]?.header_id || detailsToDisplay[0]?.production_headers?.id) : null;
    if (!meteranHeaderId) { setDefectError("Tidak ditemukan header ID untuk batch ini."); return; }

    const m = parseFloat(targetMeter);
    let targetHeaderId = meteranHeaderId;
    if (!isNaN(m) && detailsToDisplay.length > 0) {
      const headersMap = new Map<string, {
        headerId: string;
        meterAwal: number | null;
        meterAkhir: number | null;
        tanggalJam: string;
      }>();

      detailsToDisplay.forEach((d: any) => {
        const h = d.production_headers;
        const hId = d.header_id || h?.id;
        if (hId && !headersMap.has(hId)) {
          const mAwal = h?.meter_awal !== undefined && h?.meter_awal !== null && String(h.meter_awal).trim() !== ""
            ? parseFloat(cleanMeterVal(h.meter_awal))
            : null;
          const mAkhir = h?.meter_akhir !== undefined && h?.meter_akhir !== null && String(h.meter_akhir).trim() !== ""
            ? parseFloat(cleanMeterVal(h.meter_akhir))
            : null;
          headersMap.set(hId, {
            headerId: hId,
            meterAwal: !isNaN(mAwal as number) ? mAwal : null,
            meterAkhir: !isNaN(mAkhir as number) ? mAkhir : null,
            tanggalJam: String(h?.tanggal_jam || ""),
          });
        }
      });

      const headerList = Array.from(headersMap.values()).sort((a, b) => {
        if (a.meterAwal !== null && b.meterAwal !== null) return a.meterAwal - b.meterAwal;
        return a.tanggalJam.localeCompare(b.tanggalJam);
      });

      if (headerList.length > 0) {
        // 1. Exact range match: meterAwal <= m <= meterAkhir
        const exactMatch = headerList.find(h => {
          if (h.meterAwal !== null && h.meterAkhir !== null) {
            return m >= h.meterAwal && m <= h.meterAkhir;
          }
          if (h.meterAwal !== null) return m >= h.meterAwal;
          if (h.meterAkhir !== null) return m <= h.meterAkhir;
          return false;
        });

        if (exactMatch) {
          targetHeaderId = exactMatch.headerId;
        } else {
          // 2. Earliest header ending at or after m
          const afterMatch = headerList.find(h => h.meterAkhir !== null && h.meterAkhir >= m);
          if (afterMatch) {
            targetHeaderId = afterMatch.headerId;
          } else {
            // 3. Last header if m exceeds all
            targetHeaderId = headerList[headerList.length - 1].headerId;
          }
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
      let combinedDetails = combinedDetailsList.join(" | ");
      if (titikRangeStr) {
        combinedDetails = combinedDetails ? `${combinedDetails} ${titikRangeStr}` : titikRangeStr;
      }

      const res = await addQCDefectDetail({
        headerId: targetHeaderId,
        meterKain: targetMeter,
        kategoriMasalah: defectKategori,
        detailMasalah: combinedDetails || undefined,
        keteranganCacat: defectKeterangan || undefined,
        pcsIndex: activeQcPcs ? parseInt(activeQcPcs.pcs_index) : undefined,
        finalInspectionId: 3,
      });
      if (res.success && activeQcPcs) {
        setIsDefectModalOpen(false);
        setDefectMeterKain(""); setDefectMeterAwal(""); setDefectMeterAkhir(""); setDefectKategori([]); setDefectDetailMap({}); setDefectKeterangan(""); setQcDefectManualInput({});
        
        // Refresh active table data
        const refreshRes = await getPendingQCDetailsByBatch(activeQcPcs.nomor_mc, activeQcPcs.design_id, activeQcPcs.potongan_ke);
        if (refreshRes.success && refreshRes.data) {
          const filteredByPcs = refreshRes.data.filter((d: any) => String(d.pcs_index) === activeQcPcs.pcs_index);
          setFullActiveQcDetails(filteredByPcs);
        }
      } else {
        setDefectError(res.error || "Gagal menyimpan temuan cacat.");
      }
    } catch (err: any) {
      setDefectError(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmittingDefect(false);
    }
  };

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

  const handleInsertPanelSubmit = async (payload: InsertPanelPayload) => {
    if (!activeQcPcs) {
      throw new Error("Pcs aktif tidak ditemukan.");
    }
    const batchDetails = fullActiveQcDetails;
    if (batchDetails.length === 0) {
      throw new Error("Tidak ditemukan data header untuk batch ini.");
    }

    const sortedBatchDetails = [...batchDetails].sort((a, b) => {
      const pA = parseInt(a.production_headers?.panel_no || "0");
      const pB = parseInt(b.production_headers?.panel_no || "0");
      return pA - pB;
    });

    let refDetail = sortedBatchDetails[sortedBatchDetails.length - 1];

    if (payload.mode === "insert" && payload.insertAt) {
      const targetPanelNo = payload.insertAt;
      const targetDetail = sortedBatchDetails.find(d => parseInt(d.production_headers?.panel_no || "0") === targetPanelNo);
      if (targetDetail) {
        refDetail = targetDetail;
      } else {
        const precedingDetails = sortedBatchDetails.filter(d => parseInt(d.production_headers?.panel_no || "0") < targetPanelNo);
        if (precedingDetails.length > 0) refDetail = precedingDetails[precedingDetails.length - 1];
      }
    }

    const res = await insertMissingPanel({
      refHeaderId: refDetail.header_id,
      insertAt: payload.mode === "insert" ? payload.insertAt : undefined,
      appendToEnd: payload.mode === "append",
      pcsIndex: parseInt(activeQcPcs.pcs_index) || 1,
      kategoriMasalah: payload.kategoriMasalah,
      detailMasalah: payload.detailMasalah,
      keteranganCacat: payload.keteranganCacat,
      isBs: payload.mode === "insert" && payload.isBs,
    });

    if (res.success) {
      setInsertPanelMode(null);
      const refreshRes = await getPendingQCDetailsByBatch(activeQcPcs.nomor_mc, activeQcPcs.design_id, activeQcPcs.potongan_ke);
      if (refreshRes.success && refreshRes.data) {
        const filteredByPcs = refreshRes.data.filter((d: any) => String(d.pcs_index) === activeQcPcs.pcs_index);
        setFullActiveQcDetails(filteredByPcs);
      }
      return true;
    } else {
      throw new Error(res.error || "Gagal menyisipkan panel.");
    }
  };

  const handleDeletePanel = async (mode: "permanent" | "keep_slot" = "permanent") => {
    if (!detailToDelete || !activeQcPcs) return;
    setIsDeleting(true);
    try {
      const res = await deleteProductionDetailRow(detailToDelete.id, mode);
      if (res.success) {
        setDetailToDelete(null);
        // refresh active QC details
        const refreshRes = await getPendingQCDetailsByBatch(activeQcPcs.nomor_mc, activeQcPcs.design_id, activeQcPcs.potongan_ke);
        if (refreshRes.success && refreshRes.data) {
          const filteredByPcs = refreshRes.data.filter((d: any) => String(d.pcs_index) === activeQcPcs.pcs_index);
          setFullActiveQcDetails(filteredByPcs);
        }
      } else {
        alert("Gagal menghapus: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const firstDetail = detailsToDisplay.length > 0 ? detailsToDisplay[0] : null;
  const dummyHeaderData = {
    design_id: activeQcPcs?.design_id || "",
    potongan_ke: activeQcPcs?.potongan_ke || "",
    operator: firstDetail?.production_headers?.pic || firstDetail?.production_headers?.operators?.nama_operator || "-",
    nomor_mc: activeQcPcs?.nomor_mc || "-",
    details: detailsToDisplay,
  };

  const h = firstDetail?.production_headers || {};

  const getHeaderField = (getter: (head: any) => any, fallback: string = "-") => {
    for (const d of detailsToDisplay) {
      const val = getter(d.production_headers || {});
      if (val !== undefined && val !== null && val !== "" && val !== "-") {
        return val;
      }
    }
    return fallback;
  };

  const resolvedTanggalProduksi = (() => {
    let oldest = "";
    detailsToDisplay.forEach((d: any) => {
      const ph = d.production_headers;
      const ts = ph?.tanggal_jam || ph?.created_at || ph?.tgl;
      if (ts && (!oldest || String(ts).localeCompare(String(oldest)) < 0)) {
        oldest = ts;
      }
    });
    return oldest || h.tanggal_jam || h.created_at || h.tgl || "-";
  })();

  const resolvedTanggalPotong = (() => {
    let latestTs = "";
    detailsToDisplay.forEach((d: any) => {
      const ph = d.production_headers;
      const ts = ph?.tanggal_jam || ph?.created_at || ph?.tgl;
      if (ts && (!latestTs || String(ts).localeCompare(String(latestTs)) > 0)) {
        latestTs = ts;
      }
    });

    const bsAkhir = detailsToDisplay.find((d: any) => {
      const pNo = String(d.production_headers?.panel_no || "").trim().toUpperCase();
      return pNo.includes("AKHIR") || pNo === "BS AKHIR";
    });

    const explicitPotong = bsAkhir?.production_headers?.tanggal_potong
      || detailsToDisplay.find((d: any) => d.production_headers?.tanggal_potong && String(d.production_headers?.tanggal_potong).trim() !== "")?.production_headers?.tanggal_potong;

    if (explicitPotong) {
      const latestDate = latestTs ? latestTs.split("T")[0].split(" ")[0] : "";
      if (latestDate && latestDate.localeCompare(explicitPotong) > 0) {
        return latestTs || latestDate;
      }
      return explicitPotong;
    }

    return latestTs || "-";
  })();

  const compactProps = {
    nomorMc: getHeaderField((ph) => ph.nomor_mc, activeQcPcs?.nomor_mc || "-"),
    shiftName: getHeaderField((ph) => ph.groups?.nama_grup, "-"),
    operatorName: getHeaderField((ph) => ph.operators?.nama_operator || ph.pic, "-"),
    design: getHeaderField((ph) => ph.design_id, activeQcPcs?.design_id || "-"),
    pcsCount: detailsToDisplay.length,
    panelPotongan: `${getHeaderField((ph) => ph.panel_no, "-")} / ${getHeaderField((ph) => ph.potongan_ke, activeQcPcs?.potongan_ke || "-")}`,
    courseRpm: `${getHeaderField((ph) => ph.course, "-")} / ${getHeaderField((ph) => ph.rpm, "-")}`,
    noCustomer: getHeaderField((ph) => ph.no_customer, "-"),
    noOrder: getHeaderField((ph) => ph.no_order_barang, "-"),
    tanggalPotong: resolvedTanggalPotong,
    statusMatching: getHeaderField((ph) => ph.status_matching, "-"),
    pick: String(getHeaderField((ph) => ph.pick, "-")),
    benangDasar: getHeaderField((ph) => ph.jenis_benang_dasar, "-"),
    liner: getHeaderField((ph) => ph.liner, "-"),
    heavy: getHeaderField((ph) => ph.heavy, "-"),
    shadow: getHeaderField((ph) => ph.shadow, "-"),
    pinggiran: getHeaderField((ph) => ph.pinggiran, "-"),
    tanggalProduksi: resolvedTanggalProduksi,
    rollNo: firstDetail?.roll_no || "-"
  };

  const isTricoteMachine = String(activeQcPcs?.nomor_mc || "").trim().toUpperCase().startsWith("T");
  const distinctPcsList = React.useMemo(() => {
    if (!isTricoteMachine) return [];
    const pcsSet = new Set<string>();
    detailsToDisplay.forEach((d: any) => {
      pcsSet.add(String(d.pcs_index || "1"));
    });
    return Array.from(pcsSet).sort((a: string, b: string) => parseInt(a, 10) - parseInt(b, 10));
  }, [detailsToDisplay, isTricoteMachine]);

  if (activeQcPcs) {
    return (
      <div className="w-full max-w-6xl mx-auto pb-10">
        <SessionTimerHeader
          title={isTricoteMachine && distinctPcsList.length > 1 ? `Inspeksi Simultan Mesin ${activeQcPcs.nomor_mc} (${distinctPcsList.map((p: string) => `PCS ${p}`).join(" & ")})` : `Inspeksi PCS ${activeQcPcs.pcs_index}`}
          icon={<ClipboardCheck className="w-6 h-6 text-sky-500 shrink-0" />}
          onBack={async () => {
            if (activeQcPcs) {
              await upsertTimerSession({
                type: "qc",
                nomor_mc: activeQcPcs.nomor_mc,
                design_id: activeQcPcs.design_id,
                potongan_ke: activeQcPcs.potongan_ke,
                pcs_index: activeQcPcs.pcs_index,
                start_time: startTimeIso || undefined,
                is_paused: isPaused,
                pause_seconds: pauseSeconds,
                elapsed_seconds: elapsedSeconds,
              });
            }
            setActiveQcPcs(null);
            setFullActiveQcDetails([]);
            handleSearch(searchTanggal);
          }}
          backLabel="Kembali ke Antrean"
          startTime={startInspectTime}
          elapsedSeconds={elapsedSeconds}
          isPaused={isPaused}
          onTogglePause={handleTogglePause}
          onCancel={() => setIsCancelConfirmOpen(true)}
          cancelLabel="Batal Inspeksi"
          onHelp={() => setIsTourOpen(true)}
          pauseLabel="Inspeksi"
        />



        {String(activeQcPcs?.nomor_mc || "").trim().toUpperCase().startsWith("T") && (
          <div className="mb-4 bg-sky-50 border border-sky-200 rounded-2xl p-4 flex items-center justify-between gap-4 text-sky-900 shadow-sm animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-600 text-white font-black text-base flex items-center justify-center shadow-md shadow-sky-600/20 shrink-0">
                T
              </div>
              <div>
                <h4 className="font-bold text-sm text-sky-950 flex items-center gap-2">
                  Mesin Tricote ({activeQcPcs?.nomor_mc})
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-200 text-sky-800 tracking-wider">
                    INSPEKSI & MENDING BERSAMAAN
                  </span>
                </h4>
                <p className="text-xs text-sky-700 mt-0.5">
                  Setelah selesai submit inspeksi QC, data Mending otomatis terisi dan langsung masuk ke Laporan Produksi dengan hasil Grade Keseluruhan.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <CompactHeaderCard {...compactProps} />
        </div>

        {!isMeteranBatch && detailsToDisplay.length > 0 && (
          <div className="mb-4 flex justify-end animate-fadeIn">
            <button
              onClick={() => setInsertPanelMode("append")}
              className="h-11 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-purple-600/20"
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
              className="h-11 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-rose-600/20"
            >
              <Plus className="w-4 h-4" />
              Tambah Temuan Cacat Baru
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          {detailsToDisplay.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Semua Panel di PCS ini sudah diinspeksi.</h3>
            </div>
          ) : (
            <>
              {isTricoteMachine && distinctPcsList.length > 1 ? (
                <div className="p-4 sm:p-5 space-y-6">
                  <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#0070bc] text-white flex items-center justify-center font-black text-xs shadow-sm">
                        T
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">
                          Mode Inspeksi Bersamaan (Mesin Tricote / Awalan T)
                        </h4>
                        <p className="text-xs text-sky-700 font-semibold mt-0.5">
                          Terdapat {distinctPcsList.length} tabel PCS aktif yang diinspeksi secara simultan.
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-[#0070bc] text-white uppercase tracking-wider">
                      {distinctPcsList.map(p => `PCS ${p}`).join(" & ")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                    {distinctPcsList.map((pcsNum) => {
                      const pcsDetails = detailsToDisplay.filter((d: any) => String(d.pcs_index || "1") === pcsNum);
                      return (
                        <div key={pcsNum} className="bg-white rounded-2xl border-2 border-sky-200 shadow-sm overflow-hidden flex flex-col">
                          <div className="px-5 py-3.5 bg-gradient-to-r from-sky-100/70 via-sky-50 to-indigo-50 border-b border-sky-200 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-lg bg-[#0070bc] text-white flex items-center justify-center font-black text-xs shadow-sm">
                                {pcsNum}
                              </span>
                              <div>
                                <h4 className="font-black text-sm text-slate-900">
                                  Tabel PCS {pcsNum}
                                </h4>
                                <span className="text-[11px] font-bold text-sky-700">
                                  Total {pcsDetails.length} {isMeteranBatch ? "Meter / Baris" : "Panel"}
                                </span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-white text-sky-800 border border-sky-200">
                              Potongan {activeQcPcs.potongan_ke}
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            {isMeteranBatch ? (
                              <MeterQCTable
                                detailsToDisplay={pcsDetails}
                                handleSelectGrade={handleSelectGrade}
                                handleOpenEditQC={handleOpenEditQC}
                                handleOpenAddQC={handleOpenAddQC}
                                selections={selections}
                                setDetailToDelete={setDetailToDelete}
                                selectedIds={selectedDetailIds}
                                onToggleSelect={handleToggleSelectDetail}
                                onSelectAll={(selectAll) => {
                                  const ids = pcsDetails.map((d: any) => d.id);
                                  setSelectedDetailIds((prev) => selectAll ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id)));
                                }}
                              />
                            ) : (
                              <PanelQCTable
                                detailsToDisplay={pcsDetails}
                                handleSelectGrade={handleSelectGrade}
                                handleOpenDetail={handleOpenDetail}
                                handleOpenEditQC={handleOpenEditQC}
                                handleOpenAddQC={handleOpenAddQC}
                                selections={selections}
                                setDetailToDelete={setDetailToDelete}
                                selectedIds={selectedDetailIds}
                                onToggleSelect={handleToggleSelectDetail}
                                onSelectAll={(selectAll) => {
                                  const ids = pcsDetails.map((d: any) => d.id);
                                  setSelectedDetailIds((prev) => selectAll ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id)));
                                }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-center">
                    <h5 className="font-black text-slate-700 tracking-wide text-sm">
                      PCS {activeQcPcs.pcs_index}
                    </h5>
                  </div>
                  {isMeteranBatch ? (
                    <MeterQCTable
                      detailsToDisplay={detailsToDisplay}
                      handleSelectGrade={handleSelectGrade}
                      handleOpenEditQC={handleOpenEditQC}
                      handleOpenAddQC={handleOpenAddQC}
                      selections={selections}
                      setDetailToDelete={setDetailToDelete}
                      selectedIds={selectedDetailIds}
                      onToggleSelect={handleToggleSelectDetail}
                      onSelectAll={handleSelectAllDetails}
                    />
                  ) : (
                    <PanelQCTable
                      detailsToDisplay={detailsToDisplay}
                      handleSelectGrade={handleSelectGrade}
                      handleOpenDetail={handleOpenDetail}
                      handleOpenEditQC={handleOpenEditQC}
                      handleOpenAddQC={handleOpenAddQC}
                      selections={selections}
                      setDetailToDelete={setDetailToDelete}
                      selectedIds={selectedDetailIds}
                      onToggleSelect={handleToggleSelectDetail}
                      onSelectAll={handleSelectAllDetails}
                    />
                  )}
                </>
              )}

              {/* Floating / Sticky Bulk Action Bar */}
              {selectedDetailIds.length > 0 && (
                <div className="sticky bottom-4 z-40 mx-4 my-2 p-3.5 bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/80 text-white flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-black text-sm">
                      {selectedDetailIds.length}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-white">
                        {selectedDetailIds.length} {isMeteranBatch ? "Titik Meter" : "Panel"} Dipilih
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Beri keterangan cacat atau ubah status inspeksi secara massal
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIsBulkEditOpen(true)}
                      className="px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-xl font-extrabold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Beri Keterangan & Cacat Bersama
                    </button>

                    <div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block"></div>

                    <button
                      type="button"
                      onClick={() => handleBulkSetGrade(1)}
                      className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Set Grade Pass untuk semua yang terpilih"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      ✓ Ceklis Semua
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBulkSetGrade(3)}
                      className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Set Grade Silang untuk semua yang terpilih"
                    >
                      <X className="w-3.5 h-3.5" />
                      ✗ Silang Semua
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBulkSetGrade(4)}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-600 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Set Grade BS untuk semua yang terpilih"
                    >
                      BS Semua
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedDetailIds([])}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                      title="Batal Pilih"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
              
              <div data-tour="qc-inspection-submit" className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end">
                <button
                  disabled={!isAllSelected}
                  onClick={() => setIsModalOpen(true)}
                  className={`h-12 px-8 rounded-xl font-bold text-sm text-white flex items-center gap-2 transition-all duration-300 ${
                    isAllSelected ? "bg-[#0070bc] hover:bg-[#004777] shadow-lg shadow-[#0070bc]/30 active:scale-95" : "bg-slate-300 cursor-not-allowed"
                  }`}
                >
                  <CheckCircle className="w-5 h-5" />
                  Isi Rangkuman & Kirim Inspeksi
                </button>
              </div>
            </>
          )}
        </div>

        {/* Cancel QC Confirmation Modal */}
        {isCancelConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4 mx-auto">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-center text-slate-800 mb-2">Batalkan Inspeksi PCS?</h3>
              <p className="text-xs text-center text-slate-500 mb-6 leading-relaxed">
                Sesi timer dan draft inspeksi PCS ini akan dibatalkan & direset. Anda akan kembali ke antrean utama.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsCancelConfirmOpen(false)}
                  className="flex-1 h-11 rounded-xl font-bold text-slate-600 hover:bg-slate-100 text-xs transition-colors cursor-pointer"
                >
                  Tetap Lanjut
                </button>
                <button
                  onClick={handleCancelQC}
                  className="flex-1 h-11 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 text-xs transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  Ya, Batalkan
                </button>
              </div>
            </div>
          </div>
        )}

        {isModalOpen && (
          <QCInspectionModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            headerData={dummyHeaderData}
            selections={selections}
            startInspectTime={startInspectTime}
            pauseSeconds={pauseSeconds}
            elapsedSeconds={elapsedSeconds}
            onSuccess={async () => {
              setIsModalOpen(false);
              if (activeQcPcs) {
                await deleteTimerSession("qc", activeQcPcs.nomor_mc, activeQcPcs.design_id, activeQcPcs.potongan_ke, activeQcPcs.pcs_index);
                fetchActiveSessions();
              }
              setActiveQcPcs(null);
              setFullActiveQcDetails([]);
              setSelections({});
              handleSearch(searchTanggal, searchMesin, searchPotongan);
            }}
          />
        )}

        {isEditDetailModalOpen && selectedDetailForEdit && (
          <QCEditDetailModal
            isOpen={isEditDetailModalOpen}
            onClose={() => {
              setIsEditDetailModalOpen(false);
              setSelectedDetailForEdit(null);
            }}
            detail={selectedDetailForEdit}
            problemCategories={problemCategories}
            problemDetailsMap={problemDetailsMap}
            allBatchDetails={detailsToDisplay}
            currentGrade={selections[selectedDetailForEdit.id]}
            mode={modalMode}
            selectedDetailIds={selectedDetailIds}
            onSuccess={async (detailIdOrIds, newGrade, updatedData) => {
              const targetIds = Array.isArray(detailIdOrIds) ? detailIdOrIds : [detailIdOrIds];
              if (newGrade !== undefined) {
                setSelections((prev) => {
                  const next = { ...prev };
                  targetIds.forEach((id) => {
                    next[id] = newGrade;
                  });
                  return next;
                });
              }
              setSelectedDetailIds([]);
              if (activeQcPcs) {
                const refreshRes = await getPendingQCDetailsByBatch(activeQcPcs.nomor_mc, activeQcPcs.design_id, activeQcPcs.potongan_ke);
                if (refreshRes.success && refreshRes.data) {
                  const filteredByPcs = refreshRes.data.filter((d: any) => String(d.pcs_index) === activeQcPcs.pcs_index);
                  setFullActiveQcDetails(filteredByPcs);
                }
              }
            }}
          />
        )}

        {/* Bulk Edit Modal */}
        {isBulkEditOpen && (
          <QCBulkEditModal
            isOpen={isBulkEditOpen}
            onClose={() => setIsBulkEditOpen(false)}
            selectedDetails={detailsToDisplay.filter((d) => selectedDetailIds.includes(d.id))}
            onSuccess={handleBulkSuccess}
          />
        )}
        
        {/* Same Modals for Defect & Detail as before */}
        <ProductionDetailModal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} detailData={detailData} isLoading={isDetailLoading} hideEdit={true} />
        {isDefectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            {/* Same Defect Modal UI */}
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-rose-500" /> Tambah Temuan Cacat Baru
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Catat temuan cacat baru yang ditemukan saat inspeksi kain meteran.</p>
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
                {/* Mode Selector */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDefectInputMode("single");
                      setDefectError(null);
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      defectInputMode === "single"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    Titik Tunggal (1 Meter)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDefectInputMode("range");
                      setDefectError(null);
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      defectInputMode === "range"
                        ? "bg-white text-rose-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-rose-500" />
                    Rentang Panjang (Meter Awal - Akhir)
                  </button>
                </div>

                {defectInputMode === "single" ? (
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
                ) : (
                  <div className="flex flex-col gap-2 bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-rose-900 uppercase flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-rose-500" />
                        Rentang Meter Kerusakan <span className="text-rose-500">*</span>
                      </label>
                      {defectMeterAwal && defectMeterAkhir && !isNaN(parseFloat(defectMeterAwal)) && !isNaN(parseFloat(defectMeterAkhir)) && parseFloat(defectMeterAkhir) > parseFloat(defectMeterAwal) && (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-200 text-rose-800 text-[11px] font-black tracking-wide">
                          Panjang: {parseFloat(defectMeterAkhir) - parseFloat(defectMeterAwal)} Meter
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 block mb-1">Meter Awal (m)</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={defectMeterAwal}
                          onKeyDown={(e) => {
                            if (e.key === "-" || e.key === "e") e.preventDefault();
                          }}
                          onChange={(e) => {
                            setDefectMeterAwal(e.target.value);
                            setDefectError(null);
                          }}
                          className="h-11 px-3.5 rounded-xl bg-white border border-rose-200 text-sm font-bold text-slate-800 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all w-full"
                          placeholder="Contoh: 20"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 block mb-1">Meter Akhir (m)</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={defectMeterAkhir}
                          onKeyDown={(e) => {
                            if (e.key === "-" || e.key === "e") e.preventDefault();
                          }}
                          onChange={(e) => {
                            setDefectMeterAkhir(e.target.value);
                            setDefectError(null);
                          }}
                          className="h-11 px-3.5 rounded-xl bg-white border border-rose-200 text-sm font-bold text-slate-800 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all w-full"
                          placeholder="Contoh: 45"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-rose-700/80">
                      Temuan akan otomatis dicatat sebagai cacat bersambung dari meter awal hingga meter akhir.
                    </p>
                  </div>
                )}
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
                <button
                  disabled={
                    isSubmittingDefect ||
                    (defectInputMode === "single"
                      ? !defectMeterKain || isNaN(parseFloat(defectMeterKain)) || parseFloat(defectMeterKain) < 0
                      : !defectMeterAwal || !defectMeterAkhir || isNaN(parseFloat(defectMeterAwal)) || isNaN(parseFloat(defectMeterAkhir)) || parseFloat(defectMeterAkhir) <= parseFloat(defectMeterAwal))
                  }
                  onClick={handleSubmitDefect}
                  className="h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-rose-600/20 cursor-pointer"
                >
                  {isSubmittingDefect ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Simpan Temuan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Insert Panel Modal */}
        <InsertPanelModal
          isOpen={!!insertPanelMode}
          defaultMode={insertPanelMode || "append"}
          onClose={() => setInsertPanelMode(null)}
          onSubmit={handleInsertPanelSubmit}
          problemCategories={problemCategories}
          problemDetailsMap={problemDetailsMap}
          dynamicGroupMapping={dynamicGroupMapping}
        />

        {/* Delete Detail Modal */}
        <DeletePanelModal
          isOpen={!!detailToDelete}
          item={detailToDelete}
          onClose={() => setDetailToDelete(null)}
          onConfirm={handleDeletePanel}
          isDeleting={isDeleting}
        />
      </div>
    );
  }

  // --- Render Table View (Main Page) ---
  return (
    <div className="w-full max-w-6xl mx-auto pb-24 sm:pb-28">
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-400 hover:text-red-700 transition-colors p-1 rounded-lg hover:bg-red-100/50 cursor-pointer"
            title="Tutup pesan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Card with Integrated Header */}
      <div
        data-tour="qc-inspection-filter"
        className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200/80 relative mb-6"
      >
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-6 right-6 h-[3px] bg-gradient-to-r from-sky-400 via-[#0070bc] to-indigo-500 rounded-full opacity-80" />

        {/* Header Section inside Card */}
        <div
          data-tour="qc-header"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#0070bc] via-sky-600 to-blue-700 text-white flex items-center justify-center shadow-lg shadow-[#0070bc]/25 shrink-0 ring-4 ring-sky-50 transition-transform duration-300 hover:scale-105">
              <ClipboardCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                Inspeksi QC
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">
                Total antrean: <span className="text-[#0070bc] font-bold">{groupedPcsList.length} PCS Pending</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsTourOpen(true)}
            className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer shrink-0"
          >
            <HelpCircle className="w-4 h-4 text-[#0070bc]" />
            Tutorial
          </button>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 items-end gap-4 w-full mt-5">
          {/* TANGGAL */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-500" />
                <span>Tanggal</span>
              </span>
              {(searchStartDate || searchMesin || searchPotongan) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchStartDate("");
                    setSearchEndDate("");
                    setSearchTanggal("");
                    setSearchMesin("");
                    setSearchPotongan("");
                    saveQCFilters("", "", "", "", sortOrder);
                    handleSearch("", "", "", "");
                  }}
                  className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors hover:underline cursor-pointer normal-case"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  Reset
                </button>
              )}
            </label>
            <DateRangePicker
              startDate={searchStartDate}
              endDate={searchEndDate}
              onChange={(s, e) => {
                setSearchStartDate(s || "");
                setSearchEndDate(e || "");
                setSearchTanggal(s || "");
                saveQCFilters(s || "", e || "", searchMesin, searchPotongan, sortOrder);
                handleSearch(s || "", e || "", searchMesin, searchPotongan);
              }}
              placeholder="Pilih Tanggal / Rentang..."
            />
          </div>

          {/* MESIN */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-500" />
              <span>Mesin</span>
            </label>
            <div className="relative">
              <select
                value={searchMesin}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchMesin(val);
                  saveQCFilters(searchStartDate, searchEndDate, val, searchPotongan, sortOrder);
                }}
                className="h-11 px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none transition-all text-sm font-semibold text-slate-700 shadow-xs w-full cursor-pointer appearance-none"
              >
                <option value="">Semua Mesin</option>
                {REGISTERED_MACHINES.map((m) => (
                  <option key={String(m)} value={String(m)}>
                    {String(m)}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* POTONGAN */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-amber-500" />
              <span>Potongan</span>
            </label>
            <input
              type="number"
              value={searchPotongan}
              onChange={(e) => {
                const val = e.target.value;
                setSearchPotongan(val);
                saveQCFilters(searchStartDate, searchEndDate, searchMesin, val, sortOrder);
              }}
              className="h-11 px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none transition-all text-sm font-semibold text-slate-700 placeholder:text-slate-400 placeholder:font-normal shadow-xs w-full"
              placeholder="Cari Potongan..."
            />
          </div>

          {/* URUTAN WAKTU */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Urutan Waktu</span>
            </label>
            <div className="relative">
              <select
                value={sortOrder}
                onChange={(e) => {
                  const val = e.target.value as "desc" | "asc";
                  setSortOrder(val);
                  saveQCFilters(searchStartDate, searchEndDate, searchMesin, searchPotongan, val);
                }}
                className="h-11 px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none transition-all text-sm font-semibold text-slate-700 shadow-xs w-full cursor-pointer appearance-none"
              >
                <option value="desc">Terbaru</option>
                <option value="asc">Terlama</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* CARI DATA BUTTON */}
          <button
            onClick={() => handleSearch(searchStartDate, searchEndDate, searchMesin, searchPotongan)}
            disabled={isSearching}
            className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#0070bc] to-[#005a96] hover:from-[#005a96] hover:to-[#004777] active:scale-[0.98] disabled:opacity-50 text-white text-sm font-extrabold transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-[#0070bc]/25 hover:shadow-lg hover:shadow-[#0070bc]/35 cursor-pointer w-full col-span-1 sm:col-span-2 md:col-span-1 group"
          >
            {isSearching ? (
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
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fadeIn">
        {groupedPcsList.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Package className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-1">
              Tidak Ada Antrean QC
            </h3>
            <p className="text-sm text-slate-500">
              Tidak ditemukan data produksi yang perlu diinspeksi.
            </p>
          </div>
        ) : (
          <div>
            {/* Mobile & Tablet Card View (< md) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 md:hidden">
              {currentPcsList.map((g: any) => {
                const targetPcs = g.start_pcs_index || g.pcs_index;
                const sessionKey = `${g.nomor_mc}_${g.potongan_ke}_${targetPcs}`;
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
                        PCS {g.pcs_index} {g.isTricote ? "" : `/ ${g.total_pcs || g.pcs_index}`}
                      </div>
                    </div>

                    {/* Middle Section: Tanggal/Waktu & Desain */}
                    <div className="flex flex-col gap-2 mb-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Tanggal & Waktu</span>
                        <span className="font-bold text-slate-800 text-right">
                          {formatLastInputDate(g.lastInputTime)} ({formatLastInputTime(g.lastInputTime)})
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
                      onClick={() => handleStartQC(g.nomor_mc, g.design_id, g.potongan_ke, targetPcs)}
                      className={`w-full h-10 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm ${
                        isPausedItem 
                          ? "bg-amber-500 hover:bg-amber-600 text-white" 
                          : (isProcessingItem ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-[#0070bc] hover:bg-[#004777] text-white")
                      }`}
                    >
                      {isPausedItem ? (
                        <><Play className="w-3.5 h-3.5 fill-white" /> Lanjut Inspeksi</>
                      ) : isProcessingItem ? (
                        <><Play className="w-3.5 h-3.5 fill-white" /> Buka Inspeksi</>
                      ) : (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> Mulai Inspeksi</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[650px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="px-2 py-2">Mesin</th>
                    <th className="px-2 py-2">Potongan</th>
                    <th className="px-2 py-2">Tanggal</th>
                    <th className="px-2 py-2">Jam</th>
                    <th className="px-2 py-2">Desain</th>
                    <th className="px-2 py-2 text-center">PCS</th>
                    <th className="px-2 py-2 text-center whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-700">
                  {currentPcsList.map((g: any) => {
                    const targetPcs = g.start_pcs_index || g.pcs_index;
                    const sessionKey = `${g.nomor_mc}_${g.potongan_ke}_${targetPcs}`;
                    const session = activeSessionsMap.get(sessionKey);
                    const isPausedItem = session?.is_paused;
                    const isProcessingItem = session && !session.is_paused;

                    return (
                      <tr key={sessionKey} className={`hover:bg-slate-50/50 transition-colors ${isPausedItem ? "bg-amber-50/40" : ""}`}>
                        <td className="px-2 py-2">
                          <div className="inline-flex items-center min-w-[3rem] h-8 px-3 rounded-lg bg-[#0070bc]/10 text-[#0070bc] font-bold">
                            {g.header?.nomor_mc}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="text-[11px] text-slate-800 font-bold uppercase tracking-wider">
                            #{g.header?.potongan_ke || "-"}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <span className="text-[10px] text-slate-500 font-semibold">{formatLastInputDate(g.lastInputTime)}</span>
                        </td>
                        <td className="px-2 py-2">
                          <span className="text-[10px] text-slate-500 font-semibold">{formatLastInputTime(g.lastInputTime)}</span>
                        </td>
                        <td className="px-2 py-2">
                          <div className="text-slate-800 font-bold flex items-center gap-1 whitespace-nowrap">
                            {g.header?.design_id}
                            {g.header?.panel_no === "METERAN" ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-purple-100 text-purple-700 uppercase tracking-wider">METERAN</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">PANEL</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-slate-100 font-extrabold text-slate-700 text-xs whitespace-nowrap border border-slate-200/60 shadow-xs">
                              {g.pcs_index} {g.isTricote ? "" : `/ ${g.total_pcs || g.pcs_index}`}
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
                        <td className="px-2 py-2 text-center whitespace-nowrap">
                          {isPausedItem ? (
                            <button
                              onClick={() => handleStartQC(g.nomor_mc, g.design_id, g.potongan_ke, targetPcs)}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 mx-auto cursor-pointer whitespace-nowrap"
                            >
                              <Play className="w-3.5 h-3.5 fill-white" /> Lanjut Inspeksi
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartQC(g.nomor_mc, g.design_id, g.potongan_ke, targetPcs)}
                              className="px-4 py-2 bg-[#0070bc] hover:bg-[#004777] active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-sm flex items-center gap-1.5 mx-auto"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {isProcessingItem ? "Buka Inspeksi" : "Mulai Inspeksi"}
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-700 px-3">
                    Hal {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ProductTour steps={QC_INSPECTION_TOUR_STEPS} isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} />
    </div>
  );
}
