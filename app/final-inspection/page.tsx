"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Hash,
  ClipboardList,
  CheckCircle2,
  RefreshCw,
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
  MapPin,
  SlidersHorizontal,
} from "lucide-react";
import FinalInspectionModal from "@/components/forms/FinalInspectionModal";
import ProductionDetailModal from "@/components/ProductionDetailModal";
import QCEditDetailModal from "@/components/forms/QCEditDetailModal";
import CompactHeaderCard from "@/components/forms/CompactHeaderCard";
import SessionTimerHeader from "@/components/forms/SessionTimerHeader";
import { formatHHMM, formatTimerSeconds } from "@/lib/shift-utils";
import { createProblemDetail, getProblemCategories, getProblemDetailsGrouped } from "@/actions/problem-detail-actions";
import {
  getPendingFinalInspectionDetailsByDate,
  getFinalInspectionDetailsByGroup,
  searchPendingFinalInspectionBatches,
} from "@/actions/final-inspection-actions";
import { insertMissingPanel, deleteProductionDetailRow, bulkDeleteProductionDetailRows, addQCDefectDetail } from "@/actions/qc-actions";
import { getEmployeeHistoryDetail } from "@/actions/employee-actions";
import { getBlockRequiredDefects } from "@/actions/machine-config-actions";
import {
  getTimerSession,
  upsertTimerSession,
  deleteTimerSession,
  getActiveTimerSessions,
} from "@/actions/timer-actions";
import { REGISTERED_MACHINES } from "@/lib/constants";
import MeterFinalInspectionTable from "./components/MeterFinalInspectionTable";
import PanelFinalInspectionTable from "./components/PanelFinalInspectionTable";
import { formatDefectLinesWithNumbering, getDefectMeterLength, calculateMeterDefectPoints } from "@/lib/defect-format-utils";
import { calculateOverallGradeData } from "@/lib/mending-grade-utils";

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

export default function FinalInspectionPage() {
  const [searchTanggal, setSearchTanggal] = useState("");
  const [searchMesin, setSearchMesin] = useState("");
  const [searchPotongan, setSearchPotongan] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const [allDetails, setAllDetails] = useState<any[]>([]);
  const [activeFinalPcs, setActiveFinalPcs] = useState<{ nomor_mc: string, design_id: string, potongan_ke: string, pcs_index: string } | null>(null);
  const [fullActiveFinalDetails, setFullActiveFinalDetails] = useState<any[]>([]);
  const [startFinalTime, setStartFinalTime] = useState<string>("");
  const [startTimeIso, setStartTimeIso] = useState<string | null>(null);
  const [pausedAt, setPausedAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [isPaused, setIsPaused] = useState(false);
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [activeSessionsMap, setActiveSessionsMap] = useState<Map<string, any>>(new Map());

  const fetchActiveSessions = async () => {
    const res = await getActiveTimerSessions("final_inspection");
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

  useEffect(() => {
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

  useEffect(() => {
    if (!activeFinalPcs) return;
    setNowMs(Date.now());
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [activeFinalPcs]);

  const elapsedSeconds = React.useMemo(() => {
    if (!startTimeIso) return 0;
    const startMs = new Date(startTimeIso).getTime();
    if (isNaN(startMs)) return 0;

    const endMs = isPaused && pausedAt ? new Date(pausedAt).getTime() : nowMs;
    const totalSec = Math.floor((endMs - startMs) / 1000) - pauseSeconds;
    return Math.max(0, totalSec);
  }, [startTimeIso, isPaused, pausedAt, nowMs, pauseSeconds]);

  useEffect(() => {
    if (!activeFinalPcs) return;
    const syncInterval = setInterval(() => {
      upsertTimerSession({
        type: "final_inspection",
        nomor_mc: activeFinalPcs.nomor_mc,
        design_id: activeFinalPcs.design_id,
        potongan_ke: activeFinalPcs.potongan_ke,
        pcs_index: activeFinalPcs.pcs_index,
        start_time: startTimeIso || undefined,
        is_paused: isPaused,
        pause_seconds: pauseSeconds,
        paused_at: pausedAt,
        elapsed_seconds: elapsedSeconds,
      });
    }, 5000);
    return () => clearInterval(syncInterval);
  }, [activeFinalPcs, startTimeIso, isPaused, pauseSeconds, pausedAt, elapsedSeconds]);

  const handleTogglePause = async () => {
    const nextPause = !isPaused;
    const nowIso = new Date().toISOString();
    let nextPauseSeconds = pauseSeconds;
    let nextPausedAt: string | null = null;

    if (nextPause) {
      nextPausedAt = nowIso;
      setPausedAt(nextPausedAt);
    } else {
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

    if (activeFinalPcs) {
      await upsertTimerSession({
        type: "final_inspection",
        nomor_mc: activeFinalPcs.nomor_mc,
        design_id: activeFinalPcs.design_id,
        potongan_ke: activeFinalPcs.potongan_ke,
        pcs_index: activeFinalPcs.pcs_index,
        start_time: startTimeIso || undefined,
        is_paused: nextPause,
        pause_seconds: nextPauseSeconds,
        paused_at: nextPausedAt,
        elapsed_seconds: elapsedSeconds,
      });
      fetchActiveSessions();
    }
  };

  const [selections, setSelections] = useState<Record<string, string>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Bulk Selection & Multiple Deletion States
  const [selectedDetailIds, setSelectedDetailIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [pendingBulkDeleteMode, setPendingBulkDeleteMode] = useState<"permanent" | "keep_slot" | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const handleToggleSelectDetail = (id: string) => {
    setSelectedDetailIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = (ids: string[]) => {
    setSelectedDetailIds((prev) => {
      const allIn = ids.every((id) => prev.includes(id));
      if (allIn) {
        return prev.filter((id) => !ids.includes(id));
      } else {
        const set = new Set([...prev, ...ids]);
        return Array.from(set);
      }
    });
  };

  const handleBulkSetGrade = (grade: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      selectedDetailIds.forEach((id) => {
        next[id] = grade;
      });
      return next;
    });
  };

  const handleBulkDelete = async (mode: "permanent" | "keep_slot" = "permanent") => {
    if (selectedDetailIds.length === 0) return;
    setIsDeletingBulk(true);
    try {
      const res = await bulkDeleteProductionDetailRows(selectedDetailIds, mode);
      if (res.success) {
        setSelectedDetailIds([]);
        setIsBulkDeleteModalOpen(false);
        setPendingBulkDeleteMode(null);
        if (activeFinalPcs) {
          await refreshActiveFinalDetails(
            activeFinalPcs.nomor_mc,
            activeFinalPcs.design_id,
            activeFinalPcs.potongan_ke,
            activeFinalPcs.pcs_index
          );
        }
        const queryTanggal = searchTanggal === "" ? "all" : searchTanggal;
        getPendingFinalInspectionDetailsByDate(queryTanggal).then((qRes) => {
          if (qRes.success && qRes.data) {
            setAllDetails(qRes.data);
            setPendingCount(qRes.pendingCount || 0);
          }
        });
      } else {
        alert("Gagal menghapus data: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [selectedDetailForEdit, setSelectedDetailForEdit] = useState<any | null>(null);
  const [isEditDetailModalOpen, setIsEditDetailModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add_qc" | "edit">("add_qc");

  const handleOpenAddQC = (detail: any) => {
    setSelectedDetailForEdit(detail);
    setModalMode("add_qc");
    setIsEditDetailModalOpen(true);
  };

  const handleOpenEditDetail = (detail: any) => {
    setSelectedDetailForEdit(detail);
    setModalMode("edit");
    setIsEditDetailModalOpen(true);
  };

  // Tambah Panel Modal State
  const [insertPanelMode, setInsertPanelMode] = useState<"insert" | "append" | null>(null);
  const [insertPanelAt, setInsertPanelAt] = useState<string>("");
  const [isInsertingPanel, setIsInsertingPanel] = useState(false);
  const [insertPanelError, setInsertPanelError] = useState<string | null>(null);
  const [insertPanelHasDefect, setInsertPanelHasDefect] = useState(false);
  const [insertPanelIsBs, setInsertPanelIsBs] = useState(false);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<Record<string, string[]>>({});
  const [inputBloks, setInputBloks] = useState<Record<string, string>>({});
  const [insertPanelKeterangan, setInsertPanelKeterangan] = useState<string>("");
  const [manualInputDetails, setManualInputDetails] = useState<Record<string, string>>({});
  const [requiredBlockDefects, setRequiredBlockDefects] = useState<string[]>([]);

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
      if (isNaN(awal) || isNaN(akhir)) {
        setDefectError("Rentang meter awal dan akhir wajib diisi angka.");
        return;
      }
      if (awal >= akhir) {
        setDefectError("Meter awal harus lebih kecil dari meter akhir.");
        return;
      }
      targetMeter = String(awal);
      titikRangeStr = `${awal}-${akhir}`;
    } else {
      if (!defectMeterKain || isNaN(parseFloat(defectMeterKain))) {
        setDefectError("Meter kain wajib diisi dengan angka.");
        return;
      }
    }

    if (defectKategori.length === 0) {
      setDefectError("Wajib memilih minimal satu kategori masalah/cacat.");
      return;
    }

    const unselectedCat = defectKategori.find(
      (cat) => (!defectDetailMap[cat] || defectDetailMap[cat].length === 0)
    );
    if (unselectedCat) {
      setDefectError(`Kategori ${unselectedCat} telah dipilih, tetapi belum ada rincian masalah yang dipilih.`);
      return;
    }

    const firstHeader = fullActiveFinalDetails[0]?.production_headers;
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
          const afterMatch = headerList.find(h => h.meterAkhir !== null && h.meterAkhir >= m);
          if (afterMatch) {
            targetHeaderId = afterMatch.headerId;
          } else {
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
        pcsIndex: activeFinalPcs ? parseInt(activeFinalPcs.pcs_index) : undefined,
        finalInspectionId: 3,
      });

      if (res.success) {
        setIsDefectModalOpen(false);
        setDefectMeterKain("");
        setDefectMeterAwal("");
        setDefectMeterAkhir("");
        setDefectKategori([]);
        setDefectDetailMap({});
        setDefectKeterangan("");
        setDefectInputMode("single");

        if (activeFinalPcs) {
          await refreshActiveFinalDetails(
            activeFinalPcs.nomor_mc,
            activeFinalPcs.design_id,
            activeFinalPcs.potongan_ke,
            activeFinalPcs.pcs_index
          );
        }
      } else {
        setDefectError(res.error || "Gagal menambahkan cacat.");
      }
    } catch (e: any) {
      setDefectError(e.message || "Terjadi kesalahan server.");
    } finally {
      setIsSubmittingDefect(false);
    }
  };

  const handleOpenDetailModal = async (headerId: string) => {
    setIsDetailLoading(true);
    setDetailModalOpen(true);
    const res = await getEmployeeHistoryDetail(headerId);
    if (res.success) {
      setDetailData(res.data);
    } else {
      alert("Gagal memuat detail data");
      setDetailModalOpen(false);
    }
    setIsDetailLoading(false);
  };

  const handleOpenInsertPanel = (mode: "insert" | "append", targetPanelNo?: string) => {
    setInsertPanelMode(mode);
    setInsertPanelAt(targetPanelNo || "");
    setInsertPanelError(null);
    setInsertPanelHasDefect(false);
    setInsertPanelIsBs(false);
    setSelectedCategories([]);
    setSelectedDetails({});
    setInputBloks({});
    setInsertPanelKeterangan("");
  };

  const handleAddPanelManualDetail = (catId: string) => {
    const text = (manualInputDetails[catId] || "").trim();
    if (!text) return;
    setSelectedDetails((prev) => {
      const current = prev[catId] || [];
      if (current.includes(text)) return prev;
      return { ...prev, [catId]: [...current, text] };
    });
    setManualInputDetails((prev) => ({ ...prev, [catId]: "" }));
    try {
      createProblemDetail({ kategori: catId, nama_detail: text });
    } catch (e) {}
  };

  const handleToggleCategory = (catId: string) => {
    setSelectedCategories((prev) => {
      const isChecking = !prev.includes(catId);
      if (isChecking) {
        return [...prev, catId];
      } else {
        setSelectedDetails((old) => {
          const next = { ...old };
          delete next[catId];
          return next;
        });
        return prev.filter((c) => c !== catId);
      }
    });
  };

  const handleToggleDetail = (catId: string, detailName: string) => {
    setSelectedDetails((prev) => {
      const current = prev[catId] || [];
      const isSelecting = !current.includes(detailName);
      let updated: string[];
      if (isSelecting) {
        updated = [...current, detailName];
      } else {
        updated = current.filter((d) => d !== detailName);
      }
      return { ...prev, [catId]: updated };
    });
  };

  const handleInsertPanel = async () => {
    if (!activeFinalPcs) return;

    if (insertPanelMode === "insert" && !insertPanelAt) {
      setInsertPanelError("Nomor panel target wajib dipilih.");
      return;
    }

    if (insertPanelHasDefect) {
      if (selectedCategories.length === 0) {
        setInsertPanelError("Pilih minimal satu kategori masalah / cacat.");
        return;
      }
      const missingDetails = selectedCategories.some((cat) => {
        const details = selectedDetails[cat] || [];
        const manual = (manualInputDetails[cat] || "").trim();
        return details.length === 0 && !manual;
      });
      if (missingDetails) {
        setInsertPanelError("Setiap kategori yang dipilih harus memiliki minimal satu rincian masalah.");
        return;
      }
    }

    setIsInsertingPanel(true);
    setInsertPanelError(null);

    const sortedBatchDetails = [...fullActiveFinalDetails].sort((a: any, b: any) => {
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

    let detailStr: string | undefined = undefined;
    if (insertPanelHasDefect && selectedCategories.length > 0) {
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

    const targetPcsIndex = activeFinalPcs ? parseInt(activeFinalPcs.pcs_index) : 1;
    const targetFinalInspectionId = insertPanelMode === "insert" && insertPanelIsBs
      ? 4
      : (selectedCategories.length > 0 ? 3 : (fullActiveFinalDetails[0]?.final_inspection_id || 1));

    try {
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

      if (res.success) {
        setInsertPanelMode(null);
        await refreshActiveFinalDetails(
          activeFinalPcs.nomor_mc,
          activeFinalPcs.design_id,
          activeFinalPcs.potongan_ke,
          activeFinalPcs.pcs_index
        );
      } else {
        setInsertPanelError(res.error || "Gagal menyisipkan panel.");
      }
    } catch (e: any) {
      setInsertPanelError(e.message || "Terjadi kesalahan server.");
    } finally {
      setIsInsertingPanel(false);
    }
  };

  const [detailToDelete, setDetailToDelete] = useState<{
    id: string;
    name: string;
    panelNo?: string;
  } | null>(null);
  const [pendingDeleteMode, setPendingDeleteMode] = useState<"permanent" | "keep_slot" | null>(null);
  const [isDeletingDetail, setIsDeletingDetail] = useState(false);

  const handleRequestDeleteDetail = (val: { id: string; panelNo?: string; name?: string }) => {
    setPendingDeleteMode(null);
    setDetailToDelete({
      id: val.id,
      name: val.name || "Rincian cacat ini",
      panelNo: val.panelNo,
    });
  };

  const handleDeleteDetail = async (mode: "permanent" | "keep_slot" = "permanent") => {
    if (!detailToDelete) return;
    setIsDeletingDetail(true);
    try {
      const res = await deleteProductionDetailRow(detailToDelete.id, mode);
      if (res.success) {
        setDetailToDelete(null);
        setPendingDeleteMode(null);
        if (activeFinalPcs) {
          await refreshActiveFinalDetails(
            activeFinalPcs.nomor_mc,
            activeFinalPcs.design_id,
            activeFinalPcs.potongan_ke,
            activeFinalPcs.pcs_index
          );
        }
        const queryTanggal = searchTanggal === "" ? "all" : searchTanggal;
        getPendingFinalInspectionDetailsByDate(queryTanggal).then((qRes) => {
          if (qRes.success && qRes.data) {
            setAllDetails(qRes.data);
            setPendingCount(qRes.pendingCount || 0);
          }
        });
      } else {
        alert("Gagal menghapus data: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsDeletingDetail(false);
    }
  };

  const [pendingBatches, setPendingBatches] = useState<any[]>([]);
  const [totalData, setTotalData] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const fetchPendingBatches = async (
    date = searchTanggal,
    nomor_mc = searchMesin,
    potongan_ke = searchPotongan,
    page = currentPage,
    showLoader = true
  ) => {
    if (showLoader) setIsSearching(true);
    setErrorMsg(null);
    try {
      const res = await searchPendingFinalInspectionBatches({
        date: date || undefined,
        nomor_mc: nomor_mc || undefined,
        potongan_ke: potongan_ke || undefined,
        page,
        limit: 15,
      });
      if (res.success && res.data) {
        setPendingBatches(res.data);
        setCurrentPage(res.page || 1);
        setTotalPages(res.totalPages || 1);
        setTotalData(res.total || 0);
      } else {
        setErrorMsg(res.error || "Gagal memuat antrean final inspek.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat memuat data.");
    } finally {
      if (showLoader) setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchPendingBatches("", "", "", 1);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPendingBatches(searchTanggal, searchMesin, searchPotongan, 1);
  };

  const handleResetSearch = () => {
    setSearchTanggal("");
    setSearchMesin("");
    setSearchPotongan("");
    fetchPendingBatches("", "", "", 1);
  };

  const refreshActiveFinalDetails = async (nomor_mc: string, design_id: string, potongan_ke: string, pcs_index: string) => {
    const res = await getFinalInspectionDetailsByGroup(nomor_mc, design_id, potongan_ke, pcs_index);
    if (res.success && res.data) {
      setFullActiveFinalDetails(res.data);
    }
  };

  const handleStartFinal = async (batch: any) => {
    setIsSearching(true);
    setErrorMsg(null);

    const sessionKey = `${batch.nomor_mc}_${batch.potongan_ke}_${batch.pcs_index || 1}`;
    const savedSession = activeSessionsMap.get(sessionKey);

    const res = await getFinalInspectionDetailsByGroup(
      batch.nomor_mc,
      batch.design_id,
      String(batch.potongan_ke),
      String(batch.pcs_index || 1)
    );
    if (res.success && res.data) {
      setFullActiveFinalDetails(res.data);

      const initSelections: Record<string, string> = {};
      res.data.forEach((d: any) => {
        if (d.status_final_mending) {
          initSelections[d.id] = d.status_final_mending;
        } else if (d.status_mending) {
          initSelections[d.id] = d.status_mending;
        } else {
          initSelections[d.id] = "A";
        }
      });
      setSelections(initSelections);

      if (savedSession) {
        setStartTimeIso(savedSession.start_time || new Date().toISOString());
        setStartFinalTime(savedSession.start_time ? formatHHMM(savedSession.start_time) : formatHHMM(new Date().toISOString()));
        setIsPaused(savedSession.is_paused || false);
        setPauseSeconds(savedSession.pause_seconds || 0);
        setPausedAt(savedSession.paused_at || null);
      } else {
        const nowIso = new Date().toISOString();
        setStartTimeIso(nowIso);
        setStartFinalTime(formatHHMM(nowIso));
        setIsPaused(false);
        setPauseSeconds(0);
        setPausedAt(null);
        await upsertTimerSession({
          type: "final_inspection",
          nomor_mc: batch.nomor_mc,
          design_id: batch.design_id,
          potongan_ke: String(batch.potongan_ke),
          pcs_index: String(batch.pcs_index || 1),
          start_time: nowIso,
          is_paused: false,
          pause_seconds: 0,
          elapsed_seconds: 0,
        });
        fetchActiveSessions();
      }

      setActiveFinalPcs({
        nomor_mc: batch.nomor_mc,
        design_id: batch.design_id,
        potongan_ke: String(batch.potongan_ke),
        pcs_index: String(batch.pcs_index || 1),
      });
    } else {
      setErrorMsg(res.error || "Gagal memuat rincian final inspek.");
    }
    setIsSearching(false);
  };

  const handleSelectGrade = (id: string, grade: string) => {
    setSelections((prev) => ({
      ...prev,
      [id]: prev[id] === grade ? "" : grade,
    }));
  };

  const handleSetAllGrade = (grade: string) => {
    const updated: Record<string, string> = { ...selections };
    fullActiveFinalDetails.forEach((d: any) => {
      if (!d.is_deleted && d.status_inspeksi !== "Dihapus" && d.status_mending !== "Dihapus") {
        updated[d.id] = grade;
      }
    });
    setSelections(updated);
  };

  // Formatting active details
  const isMeteranBatch = fullActiveFinalDetails.length > 0 && fullActiveFinalDetails[0]?.production_headers?.panel_no === "METERAN";

  const detailsToDisplay = React.useMemo(() => {
    if (!fullActiveFinalDetails) return [];
    
    return [...fullActiveFinalDetails].sort((a: any, b: any) => {
      const hA = a.production_headers || {};
      const hB = b.production_headers || {};
      const panelA = hA.panel_no;
      const panelB = hB.panel_no;

      if (panelA === "METERAN" || panelB === "METERAN") {
        const hjA = String(hA.tanggal_jam || "");
        const hjB = String(hB.tanggal_jam || "");
        if (hjA !== hjB) return hjA.localeCompare(hjB);

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
        const pAStr = String(panelA || "").trim().toUpperCase();
        const pBStr = String(panelB || "").trim().toUpperCase();

        const isAwalA = pAStr.includes("AWAL");
        const isAwalB = pBStr.includes("AWAL");
        if (isAwalA && !isAwalB) return -1;
        if (!isAwalA && isAwalB) return 1;

        const isAkhirA = pAStr.includes("AKHIR");
        const isAkhirB = pBStr.includes("AKHIR");
        if (isAkhirA && !isAkhirB) return 1;
        if (!isAkhirA && isAkhirB) return -1;

        const numA = parseInt(pAStr, 10);
        const numB = parseInt(pBStr, 10);
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
        return pAStr.localeCompare(pBStr, undefined, { numeric: true });
      }
    });
  }, [fullActiveFinalDetails]);

  const displayItems = React.useMemo(() => {
    if (!isMeteranBatch) {
      const processed = detailsToDisplay.map((item) => {
        const h = item.production_headers || {};
        const opr = h.operators?.nama_operator || h.pic || "";
        const grp = h.groups?.nama_grup || "";
        const tgl = h.tgl || "";
        const operatorStr = (grp ? `(${grp}) ` : '') + opr;

        let extractedBackupOp = h.operator_backup || "";
        if (!extractedBackupOp && item.keterangan_cacat) {
          const match = item.keterangan_cacat.match(/\(Backup:\s*([^)]+)\)/i);
          if (match && match[1]) {
            extractedBackupOp = match[1].trim();
          }
        }

        const isIstirahat = !!extractedBackupOp || (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT");
        const hasIstirahat = isIstirahat;
        const isFinish = item.keterangan_cacat === "FINISH" || item.production_headers?.panel_no === "FINISH";
        const isStart = item.keterangan_cacat === "START" || item.production_headers?.panel_no === "START";

        let displayDetail = item.detail_masalah || "";
        let displayKeterangan = item.keterangan_cacat || "";
        let oprStr = opr;
        
        if (displayKeterangan.includes("ISTIRAHAT") || !!extractedBackupOp) {
          oprStr = "Istirahat";
          displayKeterangan = displayKeterangan.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
          displayKeterangan = displayKeterangan.replace(/^,\s*|\s*,\s*$/g, "");
        }

        const rawPanelNo = item.production_headers?.panel_no || "-";
        const isBsAwal = String(rawPanelNo).toUpperCase().includes("AWAL");
        const isBsAkhir = String(rawPanelNo).toUpperCase().includes("AKHIR");
        const isSisa = isBsAwal || isBsAkhir;

        let ketCacat = displayKeterangan;
        const hasRawTambahanQCTag = ketCacat.includes("[TAMBAHAN QC]");
        ketCacat = ketCacat.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
        ketCacat = ketCacat.replace(/\(?Backup:\s*[^)]+\)?/gi, "").trim();
        ketCacat = ketCacat.replace(/\[TAMBAHAN QC\]/gi, "").trim();
        ketCacat = ketCacat.replace(/^,\s*|\s*,\s*$/g, "").trim();

        let cacatLines: string[] = [];
        const katsRaw = item.kategori_masalah;
        const kats = katsRaw ? (Array.isArray(katsRaw) ? katsRaw : katsRaw.split(",").map((s: string) => s.trim())) : [];
        
        if (isSisa) {
          cacatLines = [isBsAwal ? "Sisa Awal Potongan" : "Sisa Akhir Potongan"];
        } else {
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
                    for (const [kat, detList] of Object.entries(problemDetailsMap || DEFAULT_PROBLEM_DETAILS || {})) {
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

          const hasDefectsArray = item.production_defects && Array.isArray(item.production_defects) && item.production_defects.length > 0;

          if (ketCacat && !hasDefectsArray) {
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
                  if (line.includes("[QC]") || line.includes("[TAMBAHAN QC]") || line.includes("[TAMBAHAN MENDING]")) return line;
                  const lineKat = line.includes(" - ") ? line.split(" - ")[0].trim() : "";
                  let partIndex = i;
                  const katsRaw2 = item.kategori_masalah;
                  const kats2 = katsRaw2 ? (Array.isArray(katsRaw2) ? katsRaw2 : katsRaw2.split(",").map((s: any) => s.trim())) : [];
                  if (lineKat && kats2.includes(lineKat)) {
                    partIndex = kats2.indexOf(lineKat);
                  }
                  if (partIndex < parts.length && parts[partIndex] && parts[partIndex] !== "") {
                    const cleanB = parts[partIndex].replace(/blok\s*/gi, "").trim();
                    return cleanB ? `${line} (Blok ${cleanB})` : line;
                  }
                  return line;
                });
              }
            } else {
              const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
              if (cleanB && !cleanB.toLowerCase().includes("backup") && !cleanB.toLowerCase().includes("istirahat") && cleanB !== "()" && cleanB !== "-") {
                cacatLines.push(`(Blok ${cleanB})`);
              }
            }
          }
        }

        const isPanelInsertedByQc = !!item.is_inserted_qc || !!item.keterangan_cacat?.includes("[TAMBAHAN QC]") || !!item.production_headers?.keterangan_cacat?.includes("[TAMBAHAN QC]") || (String(item.production_headers?.panel_no || "").includes("QC"));
        const hasTambahanQC = !!item.detail_masalah?.includes("[QC]") || (item.production_defects && item.production_defects.some((d: any) => d.detail?.includes("[QC]")));
        const hasTambahanMnd = !!item.keterangan_cacat?.includes("[TAMBAHAN MENDING]") || !!item.production_headers?.keterangan_cacat?.includes("[TAMBAHAN MENDING]");

        cacatLines = formatDefectLinesWithNumbering(cacatLines);

        const isDeleted = !!item.is_deleted || item.status_inspeksi === "Dihapus" || item.status_mending === "Dihapus" || item.status_final_mending === "Dihapus" || (item.keterangan_cacat || "").includes("[DIHAPUS]");
        const isGradable = !isFinish && !isStart && !isDeleted;
        const cacatText = isDeleted ? "[Panel Dihapus]" : cacatLines.join("\n");

        return {
          item,
          isIstirahat,
          hasIstirahat,
          isFinish,
          isStart,
          isGradable,
          isDeleted,
          opr,
          grp,
          tgl,
          operatorStr,
          oprStr,
          cacatText,
          backupOpName: extractedBackupOp,
          isPanelInsertedByQc,
          hasTambahanQC,
          hasTambahanMnd,
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
        const { item, isIstirahat, hasIstirahat, isFinish, isStart, isGradable, isDeleted, opr, grp, tgl, operatorStr, oprStr, cacatText, isPanelInsertedByQc, hasTambahanQC, hasTambahanMnd } = p;

        const isBS = item.jml_hasil_produksi === 0 || item.status_inspeksi === "BS" || item.final_inspection_id === 4 || selections[item.id] === "BS";
        if (isGradable && !isBS && !isDeleted) {
          currentOpCount += 1;
        }
        if (isGradable && !isDeleted) {
          currentOpIds.push(item.id);
        }

        let showTgl = false;
        let showGrp = false;
        let showOpr = false;

        if (i === 0) {
          showTgl = true;
          showGrp = true;
          showOpr = true;
          firstRowTgl = tgl;
        } else {
          if (opr !== lastOpr) {
            showTgl = true;
            showGrp = true;
            showOpr = true;
          } else if (tgl !== firstRowTgl && tgl !== lastTgl) {
            showTgl = true;
          }
        }

        lastTgl = tgl;
        lastGrp = grp;
        lastOpr = opr;

        let hasRealDefects = false;
        const isBsPanel = String(item.production_headers?.panel_no || "").toUpperCase().includes("AWAL") || 
                          String(item.production_headers?.panel_no || "").toUpperCase().includes("AKHIR") || 
                          String(item.production_headers?.panel_no || "").includes("(BS)") || 
                          item.jml_hasil_produksi === 0 || 
                          item.status_inspeksi === "BS";
        if (isBsPanel) {
          hasRealDefects = true;
        } else if (item.production_defects && Array.isArray(item.production_defects) && item.production_defects.length > 0) {
          hasRealDefects = item.production_defects.some((d: any) => {
            const k = (d.kategori || "").toUpperCase().trim();
            const det = (d.detail || "").toUpperCase().trim();
            if (k.includes("ISTIRAHAT") || det.includes("ISTIRAHAT")) return false;
            if (det.includes("GAGAL CACAT") || k === "G") return false;
            return true;
          });
        } else {
          const katStr = (item.kategori_masalah || "").toUpperCase().trim();
          const detStr = (item.detail_masalah || "").toUpperCase().trim();
          if (katStr && katStr !== "G" && !katStr.includes("ISTIRAHAT") && !katStr.includes("GAGAL CACAT")) {
            hasRealDefects = true;
          }
          if (detStr && !detStr.includes("ISTIRAHAT") && !detStr.includes("START") && !detStr.includes("FINISH") && !detStr.includes("GAGAL CACAT")) {
            hasRealDefects = true;
          }
        }
        if (hasTambahanQC) hasRealDefects = true;

        const isGagalCacatOnly = (
          (item.detail_masalah || "").toUpperCase().includes("GAGAL CACAT") ||
          (item.keterangan_cacat || "").toUpperCase().includes("GAGAL CACAT") ||
          (item.kategori_masalah || "").toUpperCase() === "G" ||
          (item.production_defects && item.production_defects.some((d: any) => (d.detail || "").toUpperCase().includes("GAGAL CACAT") || (d.kategori || "").toUpperCase() === "G"))
        ) && !hasRealDefects;

        items.push({
          ...item,
          isMeter: false,
          isStartRow: false,
          isIstirahat,
          hasIstirahat,
          isDeleted,
          isFinishReport: isFinish,
          displayNo: item.production_headers?.panel_no || "-",
          meterDisplay: "-",
          cacatDisplay: cacatText,
          backupOpName: p.backupOpName,
          isGradable: isGradable && !isDeleted,
          hasRealDefects,
          isGagalCacatOnly,
          showTgl,
          showGrp,
          showOpr,
          tglStr: tgl,
          grpStr: grp,
          oprBase: opr,
          oprStr,
          isPanelInsertedByQc,
          hasTambahanQC,
          hasTambahanMnd,
        });

        const nextP = processed[i + 1];
        const isLastRowOfOperator = !nextP || nextP.opr !== opr;
        if (isLastRowOfOperator && currentOpIds.length > 0 && processed.length > currentOpIds.length) {
          const aCount = currentOpIds.filter((id) => selections[id] === "A").length;
          const bCount = currentOpIds.filter((id) => selections[id] === "B").length;
          const bsCount = currentOpIds.filter((id) => {
            const it = detailsToDisplay.find((d) => d.id === id);
            return (it && (it.jml_hasil_produksi === 0 || it.status_inspeksi === "BS" || it.final_inspection_id === 4)) || selections[id] === "BS";
          }).length;

          items.push({
            id: `total-${opr}-${i}`,
            isTotalRow: true,
            totalLabel: `Total Operator ${opr}:`,
            totalCount: currentOpCount,
            countA: aCount,
            countB: bCount,
            countBS: bsCount,
          });
          currentOpCount = 0;
          currentOpIds = [];
        }
      });

      return items;
    }

    // METERAN batch mapping
    let globalRowCount = 0;
    const items: any[] = [];
    let prevOperatorLastMeter: number | null = null;
    let currentOpStartMeter: number | null = null;
    let currentOpLastMeter: number | null = null;
    let currentOpDefectItems: any[] = [];
    let lastOprString = "";

    let grandTotalStartMeter: number | null = null;
    let grandTotalLastMeter: number | null = null;
    let grandTotalDefectItems: any[] = [];

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

        const cacatPoints = calculateMeterDefectPoints(currentOpDefectItems);
        const normalMeter = totalMeter !== null ? Math.max(0, totalMeter - cacatPoints) : 0;

        items.push({
          id: `total-${lastOprString}-${Math.random()}`,
          isTotalRow: true,
          totalLabel: `Total Produksi${prevGrp ? ` (${prevGrp})` : ""} ${prevOpr}:`,
          totalMeter: totalMeter !== null ? `${totalMeter} Meter` : "-",
          normalMeter: totalMeter !== null ? `${normalMeter} Meter` : "-",
          cacatMeter: totalMeter !== null ? `${cacatPoints} Titik / Meter` : "-",
        });
        prevOperatorLastMeter = currentOpLastMeter;
        currentOpStartMeter = null;
        currentOpLastMeter = null;
        currentOpDefectItems = [];
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

      const isPanelInsertedByQc = !!item.is_inserted_qc || !!item.keterangan_cacat?.includes("[TAMBAHAN QC]") || !!item.production_headers?.keterangan_cacat?.includes("[TAMBAHAN QC]");
      const hasTambahanQC = !!item.detail_masalah?.includes("[QC]") || (item.production_defects && item.production_defects.some((d: any) => d.detail?.includes("[QC]")));
      const hasTambahanMnd = !!item.keterangan_cacat?.includes("[TAMBAHAN MENDING]") || !!item.production_headers?.keterangan_cacat?.includes("[TAMBAHAN MENDING]");

      const isIstirahat = hasIstirahatFromDefects || hasIstirahatText;
      const hasIstirahat = isIstirahat;
      const isFinishReport = ((item.keterangan_cacat || "").toUpperCase() === "FINISH" || (item.production_headers?.panel_no || "").toUpperCase() === "FINISH") && !hasRealDefects;

      let combinedCacat = "";
      if (item.production_defects && Array.isArray(item.production_defects) && item.production_defects.length > 0) {
        combinedCacat = item.production_defects
          .filter((d: any) => {
            const k = (d.kategori || "").toUpperCase();
            const det = (d.detail || "").toUpperCase();
            return !k.includes("ISTIRAHAT") && !det.includes("ISTIRAHAT");
          })
          .map((d: any) => {
            const kStr = d.kategori ? `${d.kategori} - ` : "";
            const bStr = d.blok ? ` (Blok ${d.blok})` : "";
            return `${kStr}${d.detail || ""}${bStr}`;
          })
          .join("\n");
      } else {
        const dClean = (item.detail_masalah || "").replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
        const kClean = (item.keterangan_cacat || "").replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
        const parts = [dClean, kClean].filter(Boolean);
        combinedCacat = parts.join(" | ");
      }

      let meterDisplay = "-";
      if (item.meter_kain !== null && item.meter_kain !== undefined && String(item.meter_kain).trim() !== "") {
        meterDisplay = cleanMeterVal(item.meter_kain);
      } else if (item.detail_masalah) {
        const meterMatch = item.detail_masalah.match(/\(Titik:\s*([A-Za-z0-9\s.\-]+)\)/i);
        if (meterMatch && meterMatch[1]) {
          meterDisplay = cleanMeterVal(meterMatch[1]);
        }
      }

      const hasErrorDetail = Boolean(combinedCacat && combinedCacat !== "-" && combinedCacat !== "START" && combinedCacat !== "FINISH" && !combinedCacat.includes("ISTIRAHAT"));

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

      const isStartMarker = ((item.keterangan_cacat || "").toUpperCase() === "START" || (item.production_headers?.panel_no || "").toUpperCase() === "START" || (item.meter_kain === "0" && !hasRealDefects && (item.keterangan_cacat === "START" || !item.keterangan_cacat))) && !hasRealDefects;
      const isGradable = !isIstirahat && !isStartMarker && (!isFinishReport || hasErrorDetail);
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

      const isPlaceholder = (meterDisplay === "-" && !hasErrorDetail && !isIstirahat && !isFinishReport) || isStartMarker;
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
          currentOpDefectItems.push(item);
          grandTotalDefectItems.push(item);
        }
      }
    });

    if (items.length > 0 && currentOpStartMeter !== null && currentOpLastMeter !== null) {
      const totalMeter = Math.abs(currentOpLastMeter - currentOpStartMeter);
      const [lastGrp, lastOprOnly] = lastOprString.includes(") ") 
        ? [lastOprString.match(/\(([^)]+)\)/)?.[1] || "", lastOprString.replace(/^\([^)]+\)\s*/, "")]
        : ["", lastOprString];

      const cacatPoints = calculateMeterDefectPoints(currentOpDefectItems);
      const normalMeter = Math.max(0, totalMeter - cacatPoints);

      items.push({
        id: `total-last-${lastOprString}-${Math.random()}`,
        isTotalRow: true,
        totalLabel: `Total Produksi${lastGrp ? ` (${lastGrp})` : ""} ${lastOprOnly}:`,
        totalMeter: `${totalMeter} Meter`,
        normalMeter: `${normalMeter} Meter`,
        cacatMeter: `${cacatPoints} Titik / Meter`,
      });
    }

    return items;
  }, [detailsToDisplay, isMeteranBatch, selections, problemDetailsMap]);

  // Overall grade calculation
  const overallGradeData = React.useMemo(() => {
    return calculateOverallGradeData(
      displayItems.map((it: any) => ({
        ...it,
        hasil_final: selections[it.id] || it.status_final_mending || it.status_mending || "A",
      })),
      isMeteranBatch
    );
  }, [displayItems, selections, isMeteranBatch]);

  const gradableItems = React.useMemo(() => {
    return displayItems.filter((item: any) => item.isGradable && !item.isDeleted && !item.isTotalRow);
  }, [displayItems]);

  const countA = displayItems.filter((i) => selections[i.id] === "A" && !i.isDeleted && !i.isTotalRow).length;
  const countB = displayItems.filter((i) => selections[i.id] === "B" && !i.isDeleted && !i.isTotalRow).length;
  const countBS = displayItems.filter((i) => (selections[i.id] === "BS" || !i.isGradable) && !i.isDeleted && !i.isTotalRow).length;
  const totalPanelsCount = displayItems.filter((i) => !i.isDeleted && !i.isTotalRow).length;

  const totalGradable = gradableItems.filter((item: any) => !(item.jml_hasil_produksi === 0 || item.status_inspeksi === "BS" || item.final_inspection_id === 4 || selections[item.id] === "BS")).length;
  const isAllGraded = gradableItems.length > 0 && gradableItems.every((i) => Boolean(selections[i.id]));

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
    return oldest || detailsToDisplay[0]?.production_headers?.tanggal_jam || detailsToDisplay[0]?.production_headers?.tgl || "-";
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

  const compactProps = React.useMemo(() => {
    return {
      nomorMc: getHeaderField((ph) => ph.nomor_mc, activeFinalPcs?.nomor_mc || "-"),
      shiftName: getHeaderField((ph) => ph.groups?.nama_grup, "-"),
      operatorName: getHeaderField((ph) => ph.operators?.nama_operator || ph.pic, "-"),
      design: getHeaderField((ph) => ph.design_id, activeFinalPcs?.design_id || "-"),
      pcsCount: detailsToDisplay.length,
      panelPotongan: `${getHeaderField((ph) => ph.panel_no, "-")} / ${getHeaderField((ph) => ph.potongan_ke, activeFinalPcs?.potongan_ke || "-")}`,
      potonganKe: String(getHeaderField((ph) => ph.potongan_ke, activeFinalPcs?.potongan_ke || "-")),
      courseRpm: `${getHeaderField((ph) => ph.course, "-")} / ${getHeaderField((ph) => ph.rpm, "-")}`,
      course: String(getHeaderField((ph) => ph.course, "-")),
      rpm: String(getHeaderField((ph) => ph.rpm, "-")),
      noCustomer: getHeaderField((ph) => ph.no_customer, "-"),
      noOrder: getHeaderField((ph) => ph.no_order_barang, "-"),
      tanggalProduksi: resolvedTanggalProduksi,
      tanggalPotong: resolvedTanggalPotong,
      statusMatching: getHeaderField((ph) => ph.status_matching, "-"),
      pick: String(getHeaderField((ph) => ph.pick, "-")),
      benangDasar: getHeaderField((ph) => ph.jenis_benang_dasar, "-"),
      liner: getHeaderField((ph) => ph.liner, "-"),
      heavy: getHeaderField((ph) => ph.heavy, "-"),
      shadow: getHeaderField((ph) => ph.shadow, "-"),
      pinggiran: getHeaderField((ph) => ph.pinggiran, "-"),
      rollNo: detailsToDisplay[0]?.roll_no || "-",
    };
  }, [detailsToDisplay, activeFinalPcs, resolvedTanggalProduksi, resolvedTanggalPotong]);

  const handleCancelFinal = async () => {
    if (activeFinalPcs) {
      await deleteTimerSession(
        "final_inspection",
        activeFinalPcs.nomor_mc,
        activeFinalPcs.design_id,
        activeFinalPcs.potongan_ke,
        activeFinalPcs.pcs_index
      );
      await fetchActiveSessions();
    }
    setIsCancelConfirmOpen(false);
    setActiveFinalPcs(null);
    setFullActiveFinalDetails([]);
    setSelections({});
    fetchPendingBatches(searchTanggal, searchMesin, searchPotongan, 1);
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
              Pilih apakah ingin menyisipkan panel di nomor tertentu (label DOUBLE) atau menambahkannya di bagian paling akhir.
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
                  <span className="text-[10px] opacity-75 mt-1 font-medium leading-tight">Duplikat (DOUBLE)</span>
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
                  className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 focus:border-[#0070bc] focus:ring-4 focus:ring-[#0070bc]/10 outline-none font-medium text-slate-700 transition-all"
                  placeholder="Contoh: 3"
                />
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2 leading-tight">
                  ℹ️ Panel berikutnya <strong>tidak bergeser</strong>. Panel {insertPanelAt || "target"} akan memiliki 2 baris dengan badge <strong>DOUBLE</strong>.
                </p>
              </div>
            )}

            {/* Checkboxes for BS & Defect */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {insertPanelMode === "insert" ? (
                <label
                  htmlFor="insertPanelIsBs"
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between cursor-pointer select-none ${
                    insertPanelIsBs
                      ? "border-rose-300 bg-rose-50/70 shadow-xs"
                      : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/80"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="insertPanelIsBs"
                      checked={insertPanelIsBs}
                      onChange={(e) => {
                        setInsertPanelIsBs(e.target.checked);
                      }}
                      className="w-4 h-4 text-rose-600 rounded border-rose-300 focus:ring-rose-500 cursor-pointer shrink-0"
                    />
                    <span className="text-xs font-bold text-rose-700">
                      Barang Sisa (BS)
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 pl-6 leading-tight">
                    Tandai baris ini sebagai panel sisa/BS.
                  </p>
                </label>
              ) : null}

              <label
                htmlFor="insertPanelHasDefect"
                className={`p-3 rounded-xl border transition-all flex flex-col justify-between cursor-pointer select-none ${
                  insertPanelMode !== "insert" ? "sm:col-span-2" : ""
                } ${
                  insertPanelHasDefect
                    ? "border-emerald-300 bg-emerald-50/70 shadow-xs"
                    : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/80"
                }`}
              >
                <div className="flex items-center gap-2.5">
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
                      }
                    }}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Laporkan Temuan Cacat?
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 pl-6 leading-tight">
                  Pilih kategori masalah (Kode A/B/C/D...) dan nomor blok.
                </p>
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
              </div>
            )}
          </div>

          <div className="p-5 border-t border-slate-150 bg-slate-50 flex justify-end gap-3">
            <button
              onClick={() => setInsertPanelMode(null)}
              className="h-11 px-5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
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
              className="h-11 px-6 rounded-xl bg-[#0070bc] hover:bg-[#004777] active:scale-95 disabled:opacity-50 text-white font-bold transition-all flex items-center gap-2 cursor-pointer"
            >
              {isInsertingPanel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Simpan Panel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ACTIVE FINAL INSPECTION VIEW
  if (activeFinalPcs) {
    return (
      <div className="w-full max-w-6xl mx-auto pb-10 animate-fadeIn">
        <SessionTimerHeader
          title={`Final Inspek PCS Ke-${activeFinalPcs.pcs_index}`}
          icon={<ClipboardCheck className="w-6 h-6 text-emerald-600 shrink-0" />}
          onBack={async () => {
            if (activeFinalPcs) {
              await upsertTimerSession({
                type: "final_inspection",
                nomor_mc: activeFinalPcs.nomor_mc,
                design_id: activeFinalPcs.design_id,
                potongan_ke: activeFinalPcs.potongan_ke,
                pcs_index: activeFinalPcs.pcs_index,
                start_time: startTimeIso || undefined,
                is_paused: isPaused,
                pause_seconds: pauseSeconds,
                elapsed_seconds: elapsedSeconds,
              });
              await fetchActiveSessions();
            }
            setActiveFinalPcs(null);
          }}
          backLabel="Kembali"
          startTime={startFinalTime}
          elapsedSeconds={elapsedSeconds}
          isPaused={isPaused}
          onTogglePause={handleTogglePause}
          onCancel={() => setIsCancelConfirmOpen(true)}
          cancelLabel="Batal Final Inspek"
          pauseLabel="Final Inspek"
        />

        <div className="mb-6">
          <CompactHeaderCard {...compactProps} />
        </div>

        {/* Overall Grade Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-linear-to-r from-emerald-800 to-teal-800 text-white shadow-lg flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center font-black text-xl border border-white/20">
              {overallGradeData.overallGrade}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                Grade Keseluruhan Final
              </div>
              <div className="text-sm font-semibold text-white/90">
                Total Cacat: {overallGradeData.totalCacat} {isMeteranBatch ? "meter" : "panel"} dari {overallGradeData.totalQty} {isMeteranBatch ? "meter" : "panel"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs bg-white/10 px-4 py-2 rounded-xl border border-white/20 font-bold">
            <span>Grade A: {countA}</span>
            <span>•</span>
            <span>Grade B: {countB}</span>
            <span>•</span>
            <span>BS: {countBS}</span>
          </div>
        </div>

        {/* Top Action Bar (Clean right-aligned Tambah Panel button) */}
        {!isMeteranBatch && displayItems.length > 0 && (
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
              className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Panel
            </button>
          </div>
        )}

        {isMeteranBatch && displayItems.length > 0 && (
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

        {/* Bulk Action Bar */}
        {selectedDetailIds.length > 0 && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between flex-wrap gap-2 animate-fadeIn">
            <span className="text-xs font-bold text-emerald-900">
              {selectedDetailIds.length} baris terpilih
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkSetGrade("A")}
                className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 cursor-pointer"
              >
                Set Grade A
              </button>
              <button
                onClick={() => handleBulkSetGrade("B")}
                className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 cursor-pointer"
              >
                Set Grade B
              </button>
              <button
                onClick={() => handleBulkSetGrade("BS")}
                className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 cursor-pointer"
              >
                Set BS
              </button>
              <button
                onClick={() => {
                  setPendingBulkDeleteMode(null);
                  setIsBulkDeleteModalOpen(true);
                }}
                className="px-2.5 py-1 bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-200 cursor-pointer"
              >
                Hapus Terpilih
              </button>
            </div>
          </div>
        )}

        {/* Inspection Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            {isMeteranBatch ? (
              <MeterFinalInspectionTable
                displayItems={displayItems}
                selections={selections}
                onSelectGrade={handleSelectGrade}
                onOpenDetail={handleOpenDetailModal}
                onOpenAddQC={handleOpenAddQC}
                onOpenEditDetail={handleOpenEditDetail}
                onDeleteDetail={handleRequestDeleteDetail}
                selectedDetailIds={selectedDetailIds}
                onToggleSelectDetail={handleToggleSelectDetail}
                onToggleSelectAll={handleToggleSelectAll}
              />
            ) : (
              <PanelFinalInspectionTable
                displayItems={displayItems}
                selections={selections}
                onSelectGrade={handleSelectGrade}
                onOpenDetail={handleOpenDetailModal}
                onOpenAddQC={handleOpenAddQC}
                onOpenEditDetail={handleOpenEditDetail}
                onDeleteDetail={handleRequestDeleteDetail}
                selectedDetailIds={selectedDetailIds}
                onToggleSelectDetail={handleToggleSelectDetail}
                onToggleSelectAll={handleToggleSelectAll}
                totalGradable={totalGradable}
                totalA={countA}
                totalB={countB}
                totalBS={countBS}
              />
            )}
          </div>
        </div>

        {/* Submit Bottom Bar */}
        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-600 font-medium">
            Status: <span className="font-bold text-slate-800">{countA + countB + countBS} dari {totalPanelsCount} rincian terisi</span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={!isAllGraded}
            className={`px-6 py-3 rounded-xl font-black text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              isAllGraded
                ? "bg-linear-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
                : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>Kirim Final Inspek ({countA + countB + countBS}/{totalPanelsCount})</span>
          </button>
        </div>

        {/* Cancel Final Confirmation Modal */}
        {isCancelConfirmOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4 mx-auto">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-center text-slate-800 mb-2">Batalkan Final Inspek PCS?</h3>
              <p className="text-xs text-center text-slate-500 mb-6 leading-relaxed">
                Sesi timer dan draft final inspek PCS ini akan dibatalkan & direset. Anda akan kembali ke antrean utama.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsCancelConfirmOpen(false)}
                  className="flex-1 h-11 rounded-xl font-bold text-slate-600 hover:bg-slate-100 text-xs transition-colors cursor-pointer"
                >
                  Tetap Lanjut
                </button>
                <button
                  onClick={handleCancelFinal}
                  className="flex-1 h-11 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 text-xs transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  Ya, Batalkan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pop up modal hapus rincian (Single Delete) */}
        {detailToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-in zoom-in-95 duration-200">
              {pendingDeleteMode === null ? (
                /* Step 1: Pilih Opsi Hapus */
                <>
                  <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-3 mx-auto">
                    <AlertTriangle className="w-6 h-6 text-rose-600" />
                  </div>
                  <h3 className="text-lg font-bold text-center text-slate-800 mb-1">Pilih Opsi Hapus Panel</h3>
                  <p className="text-xs text-center text-slate-500 mb-5">
                    Panel: <span className="font-semibold text-slate-700">{detailToDelete.panelNo ? `Panel ${detailToDelete.panelNo} - ` : ""}{detailToDelete.name}</span>
                  </p>
                  
                  <div className="flex flex-col gap-3 mb-5">
                    {/* Opsi 1: Hapus Baris Panel (Permanen / Nomor Tetap) */}
                    <button
                      type="button"
                      onClick={() => setPendingDeleteMode("permanent")}
                      className="flex items-start gap-3 p-3.5 rounded-xl border-2 border-rose-100 bg-rose-50/40 hover:bg-rose-50 hover:border-rose-300 text-left transition-all group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm group-hover:scale-105 transition-transform">
                        1
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-slate-800 group-hover:text-rose-700 transition-colors flex items-center justify-between">
                          <span>Hapus Baris Panel</span>
                          <span className="text-[10px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded font-semibold">Permanen</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Hapus data baris ini sepenuhnya dari database. Nomor panel lain <span className="font-semibold text-rose-600">tidak akan bergeser</span>.
                        </p>
                      </div>
                    </button>

                    {/* Opsi 2: Tandai Dihapus (Nomor Tetap) */}
                    <button
                      type="button"
                      onClick={() => setPendingDeleteMode("keep_slot")}
                      className="flex items-start gap-3 p-3.5 rounded-xl border-2 border-amber-100 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-300 text-left transition-all group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm group-hover:scale-105 transition-transform">
                        2
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-slate-800 group-hover:text-amber-800 transition-colors flex items-center justify-between">
                          <span>Tandai Dihapus (Nomor Tetap)</span>
                          <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-semibold">Nomor Tetap</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Nomor panel tetap berada di posisinya (tidak bergeser), panel diberi tanda <span className="font-semibold text-rose-600">DIHAPUS</span>, dan tidak dihitung dalam total penjumlahan panel.
                        </p>
                      </div>
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setDetailToDelete(null);
                        setPendingDeleteMode(null);
                      }}
                      className="w-full h-10 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </>
              ) : (
                /* Step 2: Layar Konfirmasi Kedua */
                <>
                  <div className={`w-12 h-12 rounded-full ${pendingDeleteMode === "permanent" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"} flex items-center justify-center mb-3 mx-auto`}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-center text-slate-800 mb-1">Konfirmasi Penghapusan</h3>
                  <p className="text-xs text-center text-slate-500 mb-4">
                    Apakah Anda yakin ingin melanjutkan tindakan ini?
                  </p>

                  {pendingDeleteMode === "permanent" ? (
                    <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 mb-5 text-left">
                      <div className="flex items-center gap-2 mb-1 font-bold text-xs text-rose-800">
                        <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px]">1</span>
                        Opsi 1: Hapus Baris Panel (Permanen)
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        Data baris <span className="font-semibold text-rose-700">{detailToDelete.panelNo ? `Panel ${detailToDelete.panelNo}` : detailToDelete.name}</span> akan <strong>dihapus permanen</strong>. Nomor panel lain <strong>tidak akan bergeser</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 mb-5 text-left">
                      <div className="flex items-center gap-2 mb-1 font-bold text-xs text-amber-900">
                        <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">2</span>
                        Opsi 2: Tandai Dihapus (Nomor Tetap)
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        Nomor panel <span className="font-semibold text-amber-800">{detailToDelete.panelNo ? `Panel ${detailToDelete.panelNo}` : detailToDelete.name}</span> akan <strong>tetap di tempat</strong> dan berstatus <strong>DIHAPUS</strong> (tidak dihitung dalam total penjumlahan panel).
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setPendingDeleteMode(null)}
                      disabled={isDeletingDetail}
                      className="flex-1 h-11 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 border border-slate-200 cursor-pointer"
                    >
                      Kembali
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDetail(pendingDeleteMode)}
                      disabled={isDeletingDetail}
                      className={`flex-1 h-11 rounded-xl font-bold text-xs text-white ${pendingDeleteMode === "permanent" ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20" : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"} shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer`}
                    >
                      {isDeletingDetail ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Ya, Hapus Data
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Modal Hapus Massal / Bulk Delete */}
        {isBulkDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-in zoom-in-95 duration-200">
              {pendingBulkDeleteMode === null ? (
                /* Step 1: Pilih Opsi Hapus */
                <>
                  <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-3 mx-auto">
                    <Trash2 className="w-6 h-6 text-rose-600" />
                  </div>
                  <h3 className="text-lg font-bold text-center text-slate-800 mb-1">
                    Hapus {selectedDetailIds.length} {isMeteranBatch ? "Titik Meter" : "Baris Panel"}
                  </h3>
                  <p className="text-xs text-center text-slate-500 mb-5">
                    Pilih metode penghapusan untuk <strong className="text-slate-700">{selectedDetailIds.length} baris</strong> terpilih:
                  </p>

                  <div className="flex flex-col gap-3 mb-5">
                    {/* Opsi 1: Hapus Permanen */}
                    <button
                      type="button"
                      onClick={() => setPendingBulkDeleteMode("permanent")}
                      className="flex items-start gap-3 p-3.5 rounded-xl border-2 border-rose-100 bg-rose-50/40 hover:bg-rose-50 hover:border-rose-300 text-left transition-all group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm group-hover:scale-105 transition-transform">
                        1
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-slate-800 group-hover:text-rose-700 transition-colors flex items-center justify-between">
                          <span>Hapus Baris Terpilih</span>
                          <span className="text-[10px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded font-semibold">Permanen</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Hapus data {selectedDetailIds.length} baris ini sepenuhnya dari database. Nomor panel lain <span className="font-semibold text-rose-600">tidak akan bergeser</span>.
                        </p>
                      </div>
                    </button>

                    {/* Opsi 2: Tandai Dihapus (Nomor Tetap) */}
                    <button
                      type="button"
                      onClick={() => setPendingBulkDeleteMode("keep_slot")}
                      className="flex items-start gap-3 p-3.5 rounded-xl border-2 border-amber-100 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-300 text-left transition-all group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm group-hover:scale-105 transition-transform">
                        2
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-slate-800 group-hover:text-amber-800 transition-colors flex items-center justify-between">
                          <span>Tandai Dihapus (Nomor Tetap)</span>
                          <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-semibold">Nomor Tetap</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Nomor panel tetap berada di posisinya, status diubah menjadi <span className="font-semibold text-rose-600">DIHAPUS</span>, dan tidak dihitung dalam total penjumlahan.
                        </p>
                      </div>
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsBulkDeleteModalOpen(false);
                        setPendingBulkDeleteMode(null);
                      }}
                      className="w-full h-10 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </>
              ) : (
                /* Step 2: Konfirmasi */
                <>
                  <div className={`w-12 h-12 rounded-full ${pendingBulkDeleteMode === "permanent" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"} flex items-center justify-center mb-3 mx-auto`}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-center text-slate-800 mb-1">
                    Konfirmasi Hapus {selectedDetailIds.length} {isMeteranBatch ? "Titik Meter" : "Baris"}
                  </h3>
                  <p className="text-xs text-center text-slate-500 mb-4">
                    Apakah Anda yakin ingin menghapus <strong className="text-slate-700">{selectedDetailIds.length} baris</strong> terpilih?
                  </p>

                  {pendingBulkDeleteMode === "permanent" ? (
                    <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 mb-5 text-left">
                      <div className="flex items-center gap-2 mb-1 font-bold text-xs text-rose-800">
                        <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px]">1</span>
                        Hapus Permanen ({selectedDetailIds.length} Baris)
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        Sebanyak <strong>{selectedDetailIds.length} baris</strong> akan <strong>dihapus permanen</strong>. Nomor panel lain <strong>tidak akan bergeser</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 mb-5 text-left">
                      <div className="flex items-center gap-2 mb-1 font-bold text-xs text-amber-900">
                        <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">2</span>
                        Tandai Dihapus ({selectedDetailIds.length} Baris)
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        Sebanyak <strong>{selectedDetailIds.length} baris</strong> akan berstatus <strong>DIHAPUS</strong> (nomor panel tetap berada di posisinya).
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={isDeletingBulk}
                      onClick={() => setPendingBulkDeleteMode(null)}
                      className="flex-1 h-11 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                    >
                      Kembali
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingBulk}
                      onClick={() => handleBulkDelete(pendingBulkDeleteMode)}
                      className={`flex-1 h-11 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 ${
                        pendingBulkDeleteMode === "permanent"
                          ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                          : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                      }`}
                    >
                      {isDeletingBulk ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Menghapus...</span>
                        </>
                      ) : (
                        <span>Ya, Hapus {selectedDetailIds.length} Baris</span>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tambah Panel Modal */}
        {renderInsertPanelModal()}

        {/* Modals */}
        <FinalInspectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            if (activeFinalPcs) {
              deleteTimerSession("final_inspection", activeFinalPcs.nomor_mc, activeFinalPcs.design_id, activeFinalPcs.potongan_ke, activeFinalPcs.pcs_index);
              fetchActiveSessions();
            }
            setActiveFinalPcs(null);
            setFullActiveFinalDetails([]);
            setSelections({});
            fetchPendingBatches(searchTanggal, searchMesin, searchPotongan, 1);
          }}
          headerData={{ details: fullActiveFinalDetails }}
          detailData={fullActiveFinalDetails}
          selections={selections}
          startFinalTime={startFinalTime}
          pauseSeconds={pauseSeconds}
          elapsedSeconds={elapsedSeconds}
        />

        <ProductionDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          detailData={detailData}
          isLoading={isDetailLoading}
        />

        {selectedDetailForEdit && (
          <QCEditDetailModal
            isOpen={isEditDetailModalOpen}
            onClose={() => {
              setIsEditDetailModalOpen(false);
              setSelectedDetailForEdit(null);
            }}
            detail={selectedDetailForEdit}
            onSuccess={() => {
              if (activeFinalPcs) {
                refreshActiveFinalDetails(
                  activeFinalPcs.nomor_mc,
                  activeFinalPcs.design_id,
                  activeFinalPcs.potongan_ke,
                  activeFinalPcs.pcs_index
                );
              }
            }}
          />
        )}
      </div>
    );
  }

  // QUEUE LIST VIEW (Exact Mirror of Riwayat Mending)
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 animate-fadeIn p-4 md:p-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center text-[#0070bc]">
              <RefreshCw className="w-5 h-5" />
            </div>
            Riwayat Mending Siap Final
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Daftar batch mending yang siap diverifikasi untuk tahap final inspection.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-red-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="flex flex-col gap-1 w-full">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Tanggal Mending
              </label>
              <input
                type="date"
                value={searchTanggal}
                onChange={(e) => setSearchTanggal(e.target.value)}
                className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:bg-white outline-none transition-all shadow-sm w-full"
              />
            </div>

            <div className="flex flex-col gap-1 w-full">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                Nomor Mesin
              </label>
              <select
                value={searchMesin}
                onChange={(e) => setSearchMesin(e.target.value)}
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
                value={searchPotongan}
                onChange={(e) => setSearchPotongan(e.target.value)}
                className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:bg-white outline-none transition-all shadow-sm w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetSearch}
                className="h-11 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={isSearching}
                className="h-11 px-6 rounded-xl bg-[#0070bc] hover:bg-[#004777] active:scale-95 disabled:opacity-50 text-white text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm flex-1 cursor-pointer"
              >
                {isSearching ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Cari Data
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Result Section */}
      <div className="space-y-4 animate-fadeIn">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#0070bc]" />
            Daftar Riwayat Mending Siap Final
          </h2>
          <div className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
            {totalData} Data Ditemukan
          </div>
        </div>

        {isSearching ? (
          <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-[#0070bc]" />
            <span className="text-xs font-medium">Memuat data antrean...</span>
          </div>
        ) : pendingBatches.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">Tidak ada antrean final inspek</h3>
            <p className="text-xs text-slate-500">
              {searchTanggal
                ? `Tidak ditemukan antrean mending pada tanggal ${searchTanggal}. Coba tekan "Reset" untuk melihat semua data.`
                : "Seluruh potongan yang selesai mending telah diverifikasi pada tahap final inspek."}
            </p>
          </div>
        ) : (
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
                  {pendingBatches.map((d: any, idx: number) => {
                    const isMeteran = d.panel_no === "METERAN" || d.header?.panel_no === "METERAN";
                    const gradeAVal = d.mending_grade_a ?? 0;
                    const gradeBVal = d.mending_grade_b ?? 0;
                    const gradeBSVal = d.mending_grade_bs ?? 0;
                    const durasiStr = calculateDurationStr(d.start_mending, d.finish_mending, d.pause_seconds || 0, d.elapsed_seconds);

                    return (
                      <tr
                        key={d.id || idx}
                        onClick={() => handleStartFinal(d)}
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
                              PCS {d.pcs_index || 1}
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
                            {gradeAVal === 0 && gradeBVal === 0 && gradeBSVal === 0 && (
                              <span className="text-xs text-slate-400 font-medium">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {d.start_mending && d.finish_mending
                              ? `${d.start_mending} - ${d.finish_mending}`
                              : d.start_mending || "-"}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                            {d.tanggal_mending || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="text-xs font-bold text-amber-700">
                            {durasiStr}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500">
              Halaman {currentPage} dari {totalPages} ({totalData} total data)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1 || isSearching}
                onClick={() => {
                  const newPage = currentPage - 1;
                  setCurrentPage(newPage);
                  fetchPendingBatches(searchTanggal, searchMesin, searchPotongan, newPage);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Sebelumnya
              </button>
              <button
                disabled={currentPage >= totalPages || isSearching}
                onClick={() => {
                  const newPage = currentPage + 1;
                  setCurrentPage(newPage);
                  fetchPendingBatches(searchTanggal, searchMesin, searchPotongan, newPage);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
