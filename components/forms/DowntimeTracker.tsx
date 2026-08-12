"use client";

import React, { useState, useEffect, useRef } from "react";
import { useFieldArray, Control, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Play, Square, Timer, AlertTriangle, Plus, X, Trash2, Box, CheckCircle2, RefreshCw, FileText, Lock, User, ClipboardList, Info, Edit3 } from "lucide-react";
import { ContinuousFormInput } from "@/lib/schemas";
import { submitMechanicDowntime } from "@/actions/mechanic-actions";
import { getProblemDetailsGrouped, createProblemDetail } from "@/actions/problem-detail-actions";
import { getBlockRequiredDefects } from "@/actions/machine-config-actions";
import WifiDowntimeTrigger from "./WifiDowntimeTrigger";
import { useWifiContext } from "@/lib/wifi-context";

const PROBLEM_CATEGORIES = [
  { id: "A", name: "Kode A: Masalah dan Perbaikan Benang" },
  { id: "B", name: "Kode B: Perbaikan Jarum dan Element Rajutan (Mechanical)" },
  { id: "C", name: "Kode C: Pengaturan dan Design stup" },
  { id: "D", name: "Kode D: Bahan Baku dan penggantian Benang" },
  { id: "E", name: "Kode E: Masalah Kelistrikan" },
  { id: "F", name: "Kode F: Perawatan Mesin,Perbaikan Mekanik (maintenance)" },
  { id: "G", name: "Kode G: Faktor Eksternal dan Non-Teknis" },
];

const PROBLEM_DETAILS: Record<string, string[]> = {
  A: [
    "L1/L2/L3 Benang timbul putus",
    "Benang lolos",
    "Bolong corak",
    "Benang narik/Kendor",
    "Benang Nyilang",
    "Perbaikan/Beset benang Dasar",
    "Benang Kejepit/Jebol/Kusut",
    "Jalur benang",
  ],
  B: [
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
  C: [
    "Loading design/Ganti Design",
    "Perbaikan corak/revisi",
    "Salah ganti design",
    "Error design",
    "Proofing/PCB",
    "Ganti Tali Jacquard",
  ],
  D: [
    "Ganti Benang dasar (Matiin/Naikin Beam)",
    "Ganti Tali/Benang Timbul",
    "Ganti benang sambungan",
    "Beam Habis",
    "Cek stok benang",
  ],
  E: [
    "Masalah Listrik Utama mati",
    "Perbaikan Inverter/dinamo",
    "Korsleting (Jalur Putus)",
    "Perbaikan Sensor/limit switch",
    "Perbaikan panel kontrol",
  ],
  F: [
    "Ganti Oli",
    "Perbaikan as patah",
    "Perbaikan gear",
    "Pembersihan mesin",
    "Perbaikan Roller",
    "Ganti Bearing",
    "Ganti Panbel",
    "Perbaikan/ganti rantai",
  ],
  G: [
    "Istirahat",
    "Izin/sakit",
    "Tunggu material (benang/sparepart)",
    "Ganti Operator (Oplos Shift)",
    "Breafing",
    "Masalah Listrik Pabrik/Mati lampu",
    "Bencana alam (Banjir, Gempa, dll)",
  ],
};

interface DowntimeTrackerProps {
  control: any;
  watch: any;
  setValue?: any;
  showBlockInput?: boolean;
  showMeterInput?: boolean;
  defaultMeter?: string;
  defaultPcsIndex?: string;
  operators?: { id: number | string; name: string; shift?: string }[];
  currentOperatorName?: string;
  isEdit?: boolean;
  onRegisterTimerControls?: (controls: {
    isTimerRunning: boolean;
    onStartTimer: (source?: any) => void;
    onStopTimer: (source?: any) => void;
  }) => void;
  isPanelType?: boolean;
  viewMode?: "all" | "timer_only" | "events_only";
}

export default function DowntimeTracker({
  control,
  watch,
  setValue,
  showBlockInput,
  showMeterInput,
  defaultMeter,
  defaultPcsIndex,
  operators = [],
  currentOperatorName = "",
  isEdit = false,
  onRegisterTimerControls,
  isPanelType = false,
  viewMode = "all",
}: DowntimeTrackerProps) {
  const {
    connectionStatus,
    isSimulationMode,
    toggleSimulationMode,
    triggerM1Start,
    triggerM1Stop,
    triggerM2Start,
    triggerM2Stop,
  } = useWifiContext();
  const isWifiConnected = connectionStatus === "terhubung";

  const { fields, append, remove, update, replace } = useFieldArray({
    control,
    name: "downtimeEvents",
  });

  const currentDowntimeEvents = watch("downtimeEvents");

  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStartRef, setTimerStartRef] = useState<number | null>(null);
  const [liveTimerSeconds, setLiveTimerSeconds] = useState(0);

  const timerSourceRef = useRef<string>("Manual");
  const [currentTimerSource, setCurrentTimerSource] = useState<string>("Manual");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [tempDuration, setTempDuration] = useState(0);
  const accumulatedSecRef = useRef<number>(0);
  const activeTimerStartRef = useRef<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<Record<string, string[]>>({});
  const [inputBloks, setInputBloks] = useState<Record<string, string>>({});
  const [inputMeters, setInputMeters] = useState<Record<string, string>>({});
  const [selectedPcsKeList, setSelectedPcsKeList] = useState<string[]>([]);
  const [selectedUnclassifiedIds, setSelectedUnclassifiedIds] = useState<string[]>([]);
  const [batchClassifyIds, setBatchClassifyIds] = useState<string[]>([]);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [dikerjakanOleh, setDikerjakanOleh] = useState<string>("Operator");
  const [namaPenanganan, setNamaPenanganan] = useState<string>("");
  const [unresolvedDowntime, setUnresolvedDowntime] = useState<any>(null);
  const [isSavingMechanic, setIsSavingMechanic] = useState(false);

  const [requiredBlockDefects, setRequiredBlockDefects] = useState<string[]>([
    "L1/L2/L3 Benang timbul putus",
    "Benang lolos",
    "Bolong corak",
    "Jarum pattern patah/bengkok",
    "Ganti Jacquard",
  ]);
  const [blockValidationError, setBlockValidationError] = useState<string | null>(null);
  const [showBlockInfo, setShowBlockInfo] = useState(false);
  const [dynamicProblemDetails, setDynamicProblemDetails] = useState<Record<string, string[]>>(PROBLEM_DETAILS);
  const [manualInputDetails, setManualInputDetails] = useState<Record<string, string>>({});

  const handleAddManualDetail = (catId: string) => {
    const text = (manualInputDetails[catId] || "").trim();
    if (!text) return;

    if (!selectedCategories.includes(catId)) {
      setSelectedCategories((prev) => [...prev, catId]);
    }

    setSelectedDetails((prev) => {
      const current = prev[catId] || [];
      if (current.includes(text)) return prev;
      return {
        ...prev,
        [catId]: [...current, text],
      };
    });

    setManualInputDetails((prev) => ({
      ...prev,
      [catId]: "",
    }));

    try {
      createProblemDetail({ kategori: catId, nama_detail: text }).then((res) => {
        if (res.success) {
          setDynamicProblemDetails((prev) => {
            const list = prev[catId] || [];
            if (list.includes(text)) return prev;
            return { ...prev, [catId]: [...list, text] };
          });
        }
      });
    } catch (e) {}
  };

  useEffect(() => {
    if (!showModal) return;
    getProblemDetailsGrouped().then((res) => {
      if (res.success && res.grouped && Object.keys(res.grouped).length > 0) {
        setDynamicProblemDetails((prev) => ({
          ...prev,
          ...res.grouped,
        }));
      }
    });
  }, [showModal]);

  useEffect(() => {
    const loadRequiredDefects = async () => {
      try {
        const saved = localStorage.getItem("dji_required_block_defects");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRequiredBlockDefects(parsed);
          }
        }
      } catch (e) { }

      try {
        const res = await getBlockRequiredDefects();
        if (res.success && res.data && Array.isArray(res.data) && res.data.length > 0) {
          setRequiredBlockDefects(res.data);
          try {
            localStorage.setItem("dji_required_block_defects", JSON.stringify(res.data));
          } catch (e) {}
        }
      } catch (e) {}
    };

    loadRequiredDefects();
    window.addEventListener("storage_dji_required_block_defects", loadRequiredDefects);
    return () => window.removeEventListener("storage_dji_required_block_defects", loadRequiredDefects);
  }, [showModal]);

  // Machine Blocking (Approach A) State
  const targetMc = watch("nomorMc") || "";
  const [activeBlock, setActiveBlock] = useState<any>(null);
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [handoffNotes, setHandoffNotes] = useState("");
  const [handoffOperatorName, setHandoffOperatorName] = useState("");
  const [handoffShift, setHandoffShift] = useState("A");
  const [blockLiveSeconds, setBlockLiveSeconds] = useState(0);
  const [isUnblockingBlock, setIsUnblockingBlock] = useState(false);
  const [showConfirmBlockModal, setShowConfirmBlockModal] = useState(false);
  const [showConfirmCancelModal, setShowConfirmCancelModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [progressNoteText, setProgressNoteText] = useState("");

  useEffect(() => {
    if (!targetMc) return;
    try {
      const saved = localStorage.getItem(`dji_machine_block_${targetMc}`);
      if (saved) {
        setActiveBlock(JSON.parse(saved));
      } else {
        setActiveBlock(null);
      }
    } catch (e) { }
  }, [targetMc]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeBlock && activeBlock.startTime) {
      interval = setInterval(() => {
        setBlockLiveSeconds(Math.floor((Date.now() - activeBlock.startTime) / 1000));
      }, 1000);
    } else {
      setBlockLiveSeconds(0);
    }
    return () => clearInterval(interval);
  }, [activeBlock]);

  const handleInitiateBlock = () => {
    if (!targetMc) {
      alert("Silakan pilih nomor mesin terlebih dahulu.");
      return;
    }
    setShowConfirmBlockModal(true);
  };

  const executeBlockMachine = () => {
    const now = Date.now();
    const isoDate = new Date().toISOString().split("T")[0];
    const initialShift = watch("groupId") || "A";
    const newBlock = {
      id: `block-${now}`,
      nomorMc: targetMc,
      startTime: now,
      startTimeStr: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      startDateStr: new Date().toLocaleDateString("id-ID"),
      dateIso: isoDate,
      initialReporter: currentOperatorName || "Operator",
      handoffLogs: [
        {
          id: `log-${now}`,
          startTime: now,
          operatorName: currentOperatorName || "Operator Aktif",
          shift: initialShift,
          timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          dateStr: new Date().toLocaleDateString("id-ID"),
          dateIso: isoDate,
          notes: "Mulai Memblokir Mesin (Perbaikan Berlangsung)"
        }
      ]
    };
    setActiveBlock(newBlock);
    localStorage.setItem(`dji_machine_block_${targetMc}`, JSON.stringify(newBlock));
    setShowConfirmBlockModal(false);
  };

  const handleCancelBlock = () => {
    if (!activeBlock) return;
    setShowConfirmCancelModal(true);
  };

  const executeCancelBlock = () => {
    localStorage.removeItem(`dji_machine_block_${targetMc}`);
    setActiveBlock(null);
    setBlockLiveSeconds(0);
    setShowConfirmCancelModal(false);
  };

  const handleAddHandoffLog = () => {
    if (!activeBlock) return;
    const now = Date.now();
    const isoDate = new Date().toISOString().split("T")[0];
    const targetOp = handoffOperatorName || currentOperatorName || "Operator Aktif";
    const newLog = {
      id: `log-${now}`,
      startTime: now,
      operatorName: targetOp,
      shift: watch("groupId") || "A",
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      dateStr: new Date().toLocaleDateString("id-ID"),
      dateIso: isoDate,
      notes: `Serah terima shift ke ${targetOp}`
    };
    const updated = {
      ...activeBlock,
      handoffLogs: [...(activeBlock.handoffLogs || []), newLog]
    };
    setActiveBlock(updated);
    localStorage.setItem(`dji_machine_block_${targetMc}`, JSON.stringify(updated));
    setShowHandoffModal(false);
  };

  const handleAddProgressNote = () => {
    if (!activeBlock || !progressNoteText.trim()) return;
    const now = Date.now();
    const isoDate = new Date().toISOString().split("T")[0];
    const currentOp = handoffOperatorName || currentOperatorName || activeBlock.initialReporter || "Operator";
    const newLog = {
      id: `log-${now}`,
      startTime: now,
      operatorName: currentOp,
      shift: watch("groupId") || "A",
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      dateStr: new Date().toLocaleDateString("id-ID"),
      dateIso: isoDate,
      notes: progressNoteText.trim()
    };
    const updated = {
      ...activeBlock,
      handoffLogs: [...(activeBlock.handoffLogs || []), newLog]
    };
    setActiveBlock(updated);
    localStorage.setItem(`dji_machine_block_${targetMc}`, JSON.stringify(updated));
    setProgressNoteText("");
    setShowAddNoteModal(false);
  };

  const handleUnblockMachine = () => {
    if (!activeBlock) return;
    const durationSec = Math.floor((Date.now() - activeBlock.startTime) / 1000);
    setTempDuration(durationSec);
    setDikerjakanOleh("Perbaikan Khusus");
    setIsUnblockingBlock(true);
    setShowModal(true);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dji_unresolved_downtime");
      if (saved) {
        setUnresolvedDowntime(JSON.parse(saved));
      } else {
        setUnresolvedDowntime(null);
      }
    } catch (e) { }
  }, [currentDowntimeEvents?.length]);

  const pcsData = watch("pcsData") || [];
  // Derive the actual PCS keys from pcsData.pcsIndex (not sequential index)
  // e.g. if editing PCS 2, pcsData = [{pcsIndex:"2"}] → pcsKeys = ["2"]
  const pcsKeys: string[] = pcsData.length > 0
    ? pcsData.map((p: any) => p.pcsIndex ? p.pcsIndex.toString() : "1")
    : ["1"];
  const pcsCount = pcsKeys.length;

  const hasMissingMeter = Boolean(
    showMeterInput &&
    dikerjakanOleh === "Operator" &&
    !isUnblockingBlock &&
    (pcsKeys.length === 1
      ? (!inputMeters[pcsKeys[0]] || inputMeters[pcsKeys[0]].trim() === "")
      : (selectedPcsKeList.length > 0 && selectedPcsKeList.some((k) => !inputMeters[k] || inputMeters[k].trim() === "")))
  );

  useEffect(() => {
    // 1. Recover saved timer if it exists (for long downtimes)
    const savedStart = localStorage.getItem("dji_active_downtime_start");
    if (savedStart && !isTimerRunning) {
      const parsed = parseInt(savedStart);
      const elapsedSec = (Date.now() - parsed) / 1000;
      // Jika timer tersimpan di local storage sudah berumur > 24 jam (86.400 detik), anggap basi/dibuang!
      if (elapsedSec > 24 * 3600) {
        localStorage.removeItem("dji_active_downtime_start");
        localStorage.removeItem("dji_active_timer_source");
        activeTimerStartRef.current = null;
      } else {
        activeTimerStartRef.current = parsed;
        setTimerStartRef(parsed);
        setIsTimerRunning(true);
      }
    }

    // 2. Setup the interval for live ticking
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timerStartRef) {
      interval = setInterval(() => {
        setLiveTimerSeconds(Math.floor((Date.now() - timerStartRef) / 1000));
      }, 1000);
    } else if (!isTimerRunning) {
      setLiveTimerSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerStartRef]);

  useEffect(() => {
    if (onRegisterTimerControls) {
      onRegisterTimerControls({
        isTimerRunning,
        onStartTimer: handleStartTimer,
        onStopTimer: handleStopTimer,
      });
    }
  }, [isTimerRunning, onRegisterTimerControls]);

  const [showCancelTimerConfirmModal, setShowCancelTimerConfirmModal] = useState(false);

  const handleStartTimer = (source?: any) => {
    const now = Date.now();
    if (activeTimerStartRef.current !== null) {
      const elapsedSec = (now - activeTimerStartRef.current) / 1000;
      // Jika timer aktif di background berjalan kurang dari 24 jam, tetap gunakan timer tersebut
      if (elapsedSec < 24 * 3600) {
        return;
      }
      // Jika > 24 jam, buang timer lama dan timpa dengan timer baru 'now'
    }

    if (showModal) {
      handleCloseModal();
    }

    activeTimerStartRef.current = now;
    setIsTimerRunning(true);
    setTimerStartRef(now);
    setLiveTimerSeconds(0);
    localStorage.setItem("dji_active_downtime_start", now.toString());

    const srcStr = typeof source === "string" ? source : (source?.source || "Manual");
    const isEsp32 = srcStr.includes("ESP32") || srcStr.includes("mDNS") || srcStr.includes("WebSocket") || srcStr.includes("Wi-Fi");
    const normalizedSource = isEsp32 ? "ESP32_WiFi" : "Manual";
    timerSourceRef.current = normalizedSource;
    setCurrentTimerSource(normalizedSource);
    localStorage.setItem("dji_active_timer_source", normalizedSource);
  };

  const handleCancelTimer = () => {
    setShowCancelTimerConfirmModal(true);
  };

  const executeCancelTimer = () => {
    activeTimerStartRef.current = null;
    setIsTimerRunning(false);
    setTimerStartRef(null);
    setLiveTimerSeconds(0);
    accumulatedSecRef.current = 0;
    setTempDuration(0);
    localStorage.removeItem("dji_active_downtime_start");
    localStorage.removeItem("dji_active_timer_source");
    setShowCancelTimerConfirmModal(false);
  };

  // Pre-fill meter input when the modal opens and defaultMeter is provided
  useEffect(() => {
    if (showModal && defaultMeter) {
      const preFilledMeters: Record<string, string> = {};
      if (pcsKeys.length === 1) {
        preFilledMeters[pcsKeys[0]] = defaultMeter;
      } else {
        // Fill all PCS slots with the default meter as a suggestion
        pcsKeys.forEach(k => {
          preFilledMeters[k] = defaultMeter;
        });
      }
      setInputMeters(prev => {
        // Only pre-fill slots that are currently empty
        const merged: Record<string, string> = { ...preFilledMeters };
        Object.entries(prev).forEach(([k, v]) => {
          if (v && v.trim()) merged[k] = v;
        });
        return merged;
      });
    }
  }, [showModal, defaultMeter, pcsKeys.join(",")]);

  const handleOpenModal = () => {
    setEditingIndex(null);
    accumulatedSecRef.current = 0;
    setTempDuration(0);
    setSelectedCategories([]);
    setSelectedDetails({});
    setInputBloks({});
    setInputMeters({});
    setDikerjakanOleh("Operator");
    setNamaPenanganan("");
    setIsUnblockingBlock(false);
    setCurrentTimerSource("Manual");

    if (defaultPcsIndex && pcsKeys.includes(defaultPcsIndex)) {
      setSelectedPcsKeList([defaultPcsIndex]);
    } else if (pcsKeys.length === 1) {
      setSelectedPcsKeList([...pcsKeys]);
    } else {
      setSelectedPcsKeList([]);
    }

    setShowModal(true);
  };

  const updateFormDowntimeEvents = (nextEvents: any[]) => {
    if (setValue) {
      const sum = nextEvents.reduce((acc: number, curr: any) => acc + (curr.durasiDetik || 0), 0);
      setValue("downtimeEvents", nextEvents, { shouldDirty: true, shouldValidate: true });
      setValue("totalDowntime", String(sum), { shouldDirty: true, shouldValidate: true });
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingIndex(null);
    setTempDuration(0);
    setIsUnblockingBlock(false);
    setBatchClassifyIds([]);
    setSelectedCategories([]);
    setSelectedDetails({});
    setInputBloks({});
    setInputMeters({});
    setDikerjakanOleh("Operator");
    setNamaPenanganan("");
  };

  const handleResolveSensorGlitch = (index: number) => {
    const currentList = watch("downtimeEvents") || fields || [];
    const targetEvent = currentList[index] || fields[index];
    if (!targetEvent) return;

    const updatedEvent = {
      ...targetEvent,
      isResolved: true,
      isSensorGlitch: true,
      problems: [
        {
          kategori: "G",
          details: ["Gagal Cacat"],
        },
      ],
    };

    const updatedList = [...currentList];
    updatedList[index] = updatedEvent;
    update(index, updatedEvent);
    updateFormDowntimeEvents(updatedList);
  };

  const handleOpenClassifyModal = (index: number, fallbackEvent?: any) => {
    const currentList = watch("downtimeEvents") || fields || [];
    const targetEvent = currentList[index] || fields[index] || fallbackEvent;
    if (!targetEvent) return;

    setEditingIndex(index);
    setTempDuration(targetEvent.durasiDetik || 0);
    accumulatedSecRef.current = targetEvent.durasiDetik || 0;
    setCurrentTimerSource(targetEvent.triggerSource || "Manual");
    setSelectedCategories([]);
    setSelectedDetails({});
    setInputBloks({});
    setInputMeters({});
    setDikerjakanOleh("Operator");
    setNamaPenanganan("");
    setIsUnblockingBlock(false);

    if (defaultPcsIndex && pcsKeys.includes(defaultPcsIndex)) {
      setSelectedPcsKeList([defaultPcsIndex]);
    } else if (pcsKeys.length === 1) {
      setSelectedPcsKeList([...pcsKeys]);
    } else {
      setSelectedPcsKeList([]);
    }

    setShowModal(true);
  };

  const handleToggleSelectAllUnclassified = () => {
    const currentList = watch("downtimeEvents") || fields || [];
    const unclassifiedItems = currentList
      .map((evt: any, index: number) => ({
        id: evt.id || `evt-${index}`,
        isPending: evt.isResolved === false || (!evt.isResolved && (!evt.problems || evt.problems.length === 0))
      }))
      .filter((item: any) => item.isPending);

    const allSelected = unclassifiedItems.length > 0 && unclassifiedItems.every((item: any) => selectedUnclassifiedIds.includes(item.id));

    if (allSelected) {
      setSelectedUnclassifiedIds([]);
    } else {
      setSelectedUnclassifiedIds(unclassifiedItems.map((item: any) => item.id));
    }
  };

  const handleToggleSelectUnclassified = (id: string) => {
    setSelectedUnclassifiedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBatchResolveSensorGlitch = () => {
    if (selectedUnclassifiedIds.length === 0) return;
    const currentList = watch("downtimeEvents") || fields || [];
    const updatedList = [...currentList];

    selectedUnclassifiedIds.forEach((targetId) => {
      const index = updatedList.findIndex((e: any, idx: number) => (e.id || `evt-${idx}`) === targetId);
      if (index !== -1) {
        updatedList[index] = {
          ...updatedList[index],
          isResolved: true,
          isSensorGlitch: true,
          problems: [
            {
              kategori: "G",
              details: ["Gagal Cacat"],
            },
          ],
        };
        update(index, updatedList[index]);
      }
    });

    setSelectedUnclassifiedIds([]);
    updateFormDowntimeEvents(updatedList);
  };

  const handleOpenBatchClassifyModal = () => {
    if (selectedUnclassifiedIds.length === 0) return;
    setBatchClassifyIds([...selectedUnclassifiedIds]);
    setEditingIndex(null);

    const currentList = watch("downtimeEvents") || fields || [];
    const totalSelectedSec = selectedUnclassifiedIds.reduce((sum: number, id: string) => {
      const item = currentList.find((e: any, idx: number) => (e.id || `evt-${idx}`) === id);
      return sum + (item?.durasiDetik || 0);
    }, 0);

    setTempDuration(totalSelectedSec);
    setCurrentTimerSource("Manual");
    setSelectedCategories([]);
    setSelectedDetails({});
    setInputBloks({});
    setInputMeters({});
    setDikerjakanOleh("Operator");
    setNamaPenanganan("");
    setIsUnblockingBlock(false);

    if (defaultPcsIndex && pcsKeys.includes(defaultPcsIndex)) {
      setSelectedPcsKeList([defaultPcsIndex]);
    } else if (pcsKeys.length === 1) {
      setSelectedPcsKeList([...pcsKeys]);
    } else {
      setSelectedPcsKeList([]);
    }

    setShowModal(true);
  };

  const handleStopTimer = (source?: any) => {
    const savedStartStr = localStorage.getItem("dji_active_downtime_start");
    const startTimestamp = activeTimerStartRef.current || (savedStartStr ? parseInt(savedStartStr) : null);

    if (startTimestamp === null) {
      return;
    }

    const savedSource = localStorage.getItem("dji_active_timer_source");
    const srcStr = typeof source === "string" ? source : (source?.source || savedSource || timerSourceRef.current || "Manual");
    const isEsp32 = srcStr.includes("ESP32") || srcStr.includes("mDNS") || srcStr.includes("WebSocket") || srcStr.includes("Wi-Fi");
    const finalSource = isEsp32 ? "ESP32_WiFi" : "Manual";
    setCurrentTimerSource(finalSource);

    activeTimerStartRef.current = null;
    localStorage.removeItem("dji_active_downtime_start");
    localStorage.removeItem("dji_active_timer_source");

    setIsTimerRunning(false);
    setTimerStartRef(null);
    setLiveTimerSeconds(0);
    accumulatedSecRef.current = 0;

    setIsUnblockingBlock(false);
    setDikerjakanOleh("Operator");
    setNamaPenanganan("");

    const rawDuration = Math.max(0, Math.floor((Date.now() - startTimestamp) / 1000));
    // Batasi durasi maksimum 24 jam (86.400 detik) agar perbaikan lama sah tetap tercatat utuh 100%
    const MAX_ALLOWED_SEC = 24 * 3600;
    const finalDuration = rawDuration > MAX_ALLOWED_SEC ? MAX_ALLOWED_SEC : (rawDuration < 1 ? 1 : rawDuration);

    const startTimeStr = new Date(startTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newUnclassifiedEvent: any = {
      id: Date.now().toString(),
      durasiDetik: finalDuration,
      pcsKe: "Semua",
      dikerjakanOleh: currentOperatorName || "Operator",
      problems: [],
      triggerSource: finalSource,
      stopStartTime: startTimeStr,
      isResolved: false,
    };

    const currentList = watch("downtimeEvents") || fields || [];
    const newIndex = currentList.length;
    const updatedList = [...currentList, newUnclassifiedEvent];
    append(newUnclassifiedEvent);
    updateFormDowntimeEvents(updatedList);

    const pendingItems = updatedList.filter(
      (evt: any) => evt.isResolved === false || (!evt.isResolved && (!evt.problems || evt.problems.length === 0))
    );

    if (isEsp32) {
      if (pendingItems.length === 1) {
        // Jika baru 1 event antrean dari ESP32, langsung buka modal klasifikasi
        handleOpenClassifyModal(newIndex, newUnclassifiedEvent);
      } else {
        // Jika ada lebih dari 1 event antrean beruntun, tutup modal dan alihkan semua ke antrean
        handleCloseModal();
      }
    } else {
      handleOpenClassifyModal(newIndex, newUnclassifiedEvent);
    }
  };

  const handleSaveNonDefectStop = () => {
    const pcsKeStr = dikerjakanOleh === "Operator"
      ? (selectedPcsKeList.length === pcsCount ? "Semua" : (selectedPcsKeList.length > 0 ? selectedPcsKeList.join(", ") : "Semua"))
      : "Semua";

    const dikerjakanGabungan = currentOperatorName || "Operator";

    const nonDefectProblems = [
      {
        kategori: "G",
        details: ["Gagal Cacat"],
      },
    ];

    const currentList = watch("downtimeEvents") || fields || [];
    const targetObj = editingIndex !== null ? currentList[editingIndex] : null;

    const finalEvent: any = {
      id: targetObj?.id || Date.now().toString(),
      durasiDetik: tempDuration,
      pcsKe: pcsKeStr,
      dikerjakanOleh: dikerjakanGabungan,
      problems: nonDefectProblems,
      triggerSource: targetObj?.triggerSource || currentTimerSource,
      isResolved: true,
      isSensorGlitch: true,
    };

    let updatedList = [...currentList];
    if (batchClassifyIds.length > 0) {
      updatedList = currentList.map((e: any, i: number) => {
        const id = e.id || `evt-${i}`;
        if (batchClassifyIds.includes(id)) {
          return {
            ...e,
            pcsKe: pcsKeStr,
            dikerjakanOleh: dikerjakanGabungan,
            problems: nonDefectProblems,
            isResolved: true,
            isSensorGlitch: true,
          };
        }
        return e;
      });
      batchClassifyIds.forEach((targetId) => {
        const idx = currentList.findIndex((e: any, i: number) => (e.id || `evt-${i}`) === targetId);
        if (idx !== -1) update(idx, updatedList[idx]);
      });
    } else if (editingIndex !== null) {
      updatedList[editingIndex] = finalEvent;
      update(editingIndex, finalEvent);
    } else {
      updatedList.push(finalEvent);
      append(finalEvent);
    }

    updateFormDowntimeEvents(updatedList);
    handleCloseModal();

    setEditingIndex(null);
    setShowModal(false);

    if (activeBlock) {
      localStorage.removeItem(`dji_machine_block_${targetMc}`);
      setActiveBlock(null);
    }

    setIsTimerRunning(false);
    setTimerStartRef(null);
    setLiveTimerSeconds(0);
    accumulatedSecRef.current = 0;
    setTempDuration(0);
    localStorage.removeItem("dji_active_downtime_start");
    setIsUnblockingBlock(false);
    setDikerjakanOleh("Operator");
    setNamaPenanganan("");
  };

  const handleSaveEvent = async () => {
    if (selectedCategories.length === 0) return;
    if (dikerjakanOleh === "Operator" && selectedPcsKeList.length === 0) return;
    if (hasMissingMeter) return;

    for (const catId of selectedCategories) {
      const details = selectedDetails[catId] || [];
      const reqDetails = details.filter((d) => requiredBlockDefects.includes(d));
      if (reqDetails.length > 0) {
        const blockVal = inputBloks[catId]?.trim();
        if (!blockVal) {
          setBlockValidationError(`Nomor blok WAJIB DIISI untuk masalah: "${reqDetails.join(", ")}"`);
          return;
        }
      }
    }
    setBlockValidationError(null);

    const meterStr = pcsKeys.length === 1
      ? inputMeters[pcsKeys[0]]?.trim()
      : Object.entries(inputMeters)
        .filter(([k, v]) => selectedPcsKeList.includes(k) && v.trim() !== "")
        .map(([pcs, val]) => `PCS ${pcs}: ${val.trim()}`)
        .join(", ");

    const problems = selectedCategories.map(catId => {
      let details = [...(selectedDetails[catId] || [])];
      const manualText = (manualInputDetails[catId] || "").trim();
      if (manualText && !details.includes(manualText)) {
        details.push(manualText);
        try {
          createProblemDetail({ kategori: catId, nama_detail: manualText });
        } catch (e) {}
      }
      return {
        kategori: catId,
        details: details,
        blok: inputBloks[catId]?.trim() !== "" ? inputBloks[catId]?.trim() : undefined,
        meter: dikerjakanOleh === "Operator" ? (meterStr || undefined) : undefined,
      };
    });

    const pcsKeStr = dikerjakanOleh === "Operator"
      ? (selectedPcsKeList.length === pcsCount ? "Semua" : selectedPcsKeList.join(", "))
      : "Semua";

    let dikerjakanGabungan = dikerjakanOleh;
    if (dikerjakanOleh === "Operator") {
      dikerjakanGabungan = currentOperatorName || "Operator";
    } else {
      const pj = namaPenanganan || currentOperatorName || "Operator";
      dikerjakanGabungan = `Perbaikan Khusus (${pj})`;
    }

    const currentList = watch("downtimeEvents") || fields || [];
    const targetObj = editingIndex !== null ? currentList[editingIndex] : null;

    let finalEvent: any = {
      id: targetObj?.id || Date.now().toString(),
      durasiDetik: tempDuration,
      pcsKe: pcsKeStr,
      dikerjakanOleh: dikerjakanGabungan,
      problems: problems,
      handoffLogs: activeBlock?.handoffLogs || undefined,
      triggerSource: targetObj?.triggerSource || currentTimerSource,
      isResolved: true,
    };

    if (dikerjakanOleh !== "Operator") {
      setIsSavingMechanic(true);
      try {
        if (activeBlock && activeBlock.handoffLogs && activeBlock.handoffLogs.length > 0) {
          const logs = activeBlock.handoffLogs;
          const unblockTime = Date.now();

          for (let i = 0; i < logs.length; i++) {
            const currentLog = logs[i];
            const logStart = currentLog.startTime || activeBlock.startTime || (unblockTime - (tempDuration || 60) * 1000);
            const nextTime = (i < logs.length - 1 && logs[i + 1]?.startTime) ? logs[i + 1].startTime : unblockTime;
            const diff = Math.floor((nextTime - logStart) / 1000);
            const segDurationSec = (isNaN(diff) || diff <= 0) ? (tempDuration || 1) : diff;

            const splitEvent = {
              id: `split-${Date.now()}-${i}`,
              durasiDetik: segDurationSec,
              pcsKe: "Semua",
              dikerjakanOleh: `Perbaikan Khusus (${currentLog.operatorName || "Operator"})`,
              problems: problems,
              shift: currentLog.shift || watch("groupId") || "A",
              notes: currentLog.notes
            };

            const res = await submitMechanicDowntime({
              nomorMc: watch("nomorMc") || "",
              operatorId: watch("operatorId") || "",
              groupId: currentLog.shift || watch("groupId") || "A",
              designId: watch("designId") || "",
              tanggalProduksi: currentLog.dateIso || new Date().toISOString().split("T")[0],
              potonganKe: watch("potonganKe") || "",
              downtimeEvent: splitEvent,
              createdTime: logStart,
            });

            if (!res.success) {
              console.error("Error submitting split downtime segment:", res.error);
            }
          }

          setShowModal(false);
          setEditingIndex(null);
          localStorage.removeItem(`dji_machine_block_${targetMc}`);
          setActiveBlock(null);
          if (unresolvedDowntime) {
            setUnresolvedDowntime(null);
            localStorage.removeItem("dji_unresolved_downtime");
          }
          setIsTimerRunning(false);
          setTimerStartRef(null);
          setLiveTimerSeconds(0);
          localStorage.removeItem("dji_active_downtime_start");
          setIsSavingMechanic(false);
          setIsUnblockingBlock(false);
          setDikerjakanOleh("Operator");
          setNamaPenanganan("");
          return;
        }

        const res = await submitMechanicDowntime({
          nomorMc: watch("nomorMc") || "",
          operatorId: watch("operatorId") || "",
          groupId: watch("groupId") || "",
          designId: watch("designId") || "",
          tanggalProduksi: watch("tanggalProduksi") || "",
          potonganKe: watch("potonganKe") || "",
          downtimeEvent: finalEvent,
          createdTime: activeBlock?.startTime || undefined,
        });
        if (res.success) {
          setShowModal(false);
          setEditingIndex(null);
          if (activeBlock) {
            localStorage.removeItem(`dji_machine_block_${targetMc}`);
            setActiveBlock(null);
          }
          if (unresolvedDowntime) {
            setUnresolvedDowntime(null);
            localStorage.removeItem("dji_unresolved_downtime");
          }
          setIsTimerRunning(false);
          setTimerStartRef(null);
          setLiveTimerSeconds(0);
          accumulatedSecRef.current = 0;
          setTempDuration(0);
          localStorage.removeItem("dji_active_downtime_start");
          setIsSavingMechanic(false);
          setIsUnblockingBlock(false);
          setDikerjakanOleh("Operator");
          setNamaPenanganan("");
          return;
        } else {
          alert("Gagal mengirim downtime khusus: " + res.error);
        }
      } catch (err) {
        alert("Gagal mengirim downtime khusus.");
      }
      setIsSavingMechanic(false);
      return;
    }

    let updatedList = [...currentList];
    if (batchClassifyIds.length > 0) {
      updatedList = currentList.map((e: any, i: number) => {
        const id = e.id || `evt-${i}`;
        if (batchClassifyIds.includes(id)) {
          return {
            ...e,
            pcsKe: pcsKeStr,
            dikerjakanOleh: dikerjakanGabungan,
            problems: problems,
            handoffLogs: activeBlock?.handoffLogs || undefined,
            triggerSource: e.triggerSource || currentTimerSource,
            isResolved: true,
          };
        }
        return e;
      });
      batchClassifyIds.forEach((targetId) => {
        const idx = currentList.findIndex((e: any, i: number) => (e.id || `evt-${i}`) === targetId);
        if (idx !== -1) update(idx, updatedList[idx]);
      });
    } else if (editingIndex !== null) {
      updatedList[editingIndex] = finalEvent;
      update(editingIndex, finalEvent);
    } else {
      updatedList.push(finalEvent);
      append(finalEvent);
    }

    updateFormDowntimeEvents(updatedList);
    handleCloseModal();

    if (activeBlock) {
      localStorage.removeItem(`dji_machine_block_${targetMc}`);
      setActiveBlock(null);
    }

    setIsTimerRunning(false);
    setTimerStartRef(null);
    setLiveTimerSeconds(0);
    accumulatedSecRef.current = 0;
    localStorage.removeItem("dji_active_downtime_start");
    if (unresolvedDowntime) {
      setUnresolvedDowntime(null);
      localStorage.removeItem("dji_unresolved_downtime");
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatShiftLabel = (shiftVal: any) => {
    if (!shiftVal) return "A";
    const str = String(shiftVal).trim();
    if (str === "1" || str.toUpperCase() === "A") return "A";
    if (str === "2" || str.toUpperCase() === "B") return "B";
    if (str === "3" || str.toUpperCase() === "C") return "C";
    return str;
  };

  return (
    <div className={showMeterInput ? "grid grid-cols-1 sm:grid-cols-2 gap-4 items-start" : "flex flex-col gap-3 sm:gap-4 lg:gap-5 w-full self-start"}>
      {viewMode !== "events_only" && (
        <>
          {/* 1. SEKSI BLOCK MESIN & BLUETOOTH TRIGGER */}
          <div className="flex flex-col gap-4 w-full">
        {!activeBlock ? (
          <div className={`bg-slate-50 border-2 border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between ${showMeterInput ? "min-h-[195px]" : "min-h-[156px]"}`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      Block Mesin
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowBlockInfo((prev) => !prev)}
                      className="p-1 rounded-full text-sky-600 hover:bg-sky-100/80 transition-colors cursor-pointer"
                      title="Klik untuk info Block Mesin"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-extrabold text-slate-700 bg-slate-200 px-2.5 py-1 rounded-full border border-slate-300 shrink-0 self-start sm:self-auto">
                Mesin Stop
              </span>
            </div>

            {showBlockInfo && (
              <div className="my-2 p-2.5 bg-sky-50 border border-sky-200/80 rounded-xl text-[10px] font-medium text-sky-900 flex items-start gap-2 animate-fadeIn shadow-xs">
                <Info className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed flex-1">
                  Untuk perbaikan berat / mesin mati total lintas shift (tanpa produksi kain)
                </p>
                <button
                  type="button"
                  onClick={() => setShowBlockInfo(false)}
                  className="text-sky-400 hover:text-sky-800 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleInitiateBlock}
              className="flex items-center justify-center gap-2 w-full h-11 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wide rounded-2xl transition-all shadow-md shadow-slate-800/20 active:scale-[0.98] cursor-pointer"
            >
              <Lock className="w-4 h-4" /> Block Mesin
            </button>
          </div>
        ) : (
          /* Banner Active Block Mesin (Multi Shift) - Minimalist & Sleek */
          <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-3xl shadow-xs animate-fadeIn space-y-3">
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide truncate">
                    Mesin Diblok (Dalam Perbaikan)
                  </h4>
                  <p className="text-[10px] font-semibold text-slate-500 mt-0.5 leading-snug">
                    Mulai perbaikan {activeBlock.startDateStr} pkl {activeBlock.startTimeStr} • Pelapor: <strong className="text-slate-700">{activeBlock.initialReporter}</strong>
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 bg-white/80 px-2.5 py-1 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Total Stop:</span>
                <span className="text-sm font-black text-slate-800 font-mono">
                  {formatTimer(blockLiveSeconds)}
                </span>
              </div>
            </div>

            {/* Handoff Logs List */}
            {activeBlock.handoffLogs && activeBlock.handoffLogs.length > 1 && (
              <div className="bg-white rounded-2xl p-3 border border-slate-200 space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-slate-600 uppercase tracking-wider block">
                  <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
                  <span>Riwayat Serah Terima ({activeBlock.handoffLogs.length}):</span>
                </div>
                {activeBlock.handoffLogs.map((log: any, lIdx: number) => (
                  <div key={log.id || lIdx} className="text-[10px] text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100 leading-relaxed">
                    <div className="flex justify-between items-center text-[9px] font-extrabold text-slate-700 mb-0.5">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        {log.operatorName} ({formatShiftLabel(log.shift)})
                      </span>
                      <span className="text-slate-500">{log.dateStr} • {log.timestamp}</span>
                    </div>
                    <p className="text-slate-600 font-medium pl-4">{log.notes}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons Container */}
            <div className="pt-1.5 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddNoteModal(true)}
                  className="w-full py-2 px-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-xs transition-all border border-slate-200/80 flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Catat Progres</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowHandoffModal(true)}
                  className="w-full py-2 px-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-extrabold text-xs transition-all border border-sky-200/70 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Serah Terima</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleUnblockMachine}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-[0.98] cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>UNBLOCK MESIN</span>
              </button>

              <div className="flex justify-center pt-0.5">
                <button
                  type="button"
                  onClick={handleCancelBlock}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50/80 font-bold text-[11px] transition-all flex items-center gap-1.5 px-3 py-1 rounded-lg cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 shrink-0" />
                  <span>Batalkan Block</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

          {/* 2. CARD DOWNTIME UTAMA (KHUSUS TIMER & KONTROL MESIN) */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 relative overflow-hidden mb-4">
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center justify-between gap-1.5 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 shrink-0">
                    <Timer className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-800 whitespace-nowrap">
                    Downtime
                  </h3>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400">Total: </span>
                  <span className="text-sm sm:text-base font-black text-amber-600">
                    {formatTimer((watch("downtimeEvents") || fields || []).reduce((acc: number, curr: any) => acc + (curr.durasiDetik || 0), 0))}
                  </span>
                </div>
              </div>

              {isTimerRunning && !(currentTimerSource === "ESP32_WiFi" || currentTimerSource?.includes("ESP32")) && (
                <div className="flex justify-start pt-1">
                  <button
                    type="button"
                    onClick={handleCancelTimer}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 font-bold text-[11px] transition-all flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-200/80 cursor-pointer animate-fadeIn shadow-sm"
                  >
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>Batalkan Timer</span>
                  </button>
                </div>
              )}
            </div>

            {/* Banner Masalah Lanjut Shift (jika ada) */}
            {unresolvedDowntime && !isTimerRunning && !isEdit && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-2xl mb-4 flex flex-col gap-3 animate-fadeIn">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-xs font-black text-yellow-800 uppercase">Terdapat Masalah Tertunda</h4>
                    <p className="text-[10px] font-medium text-yellow-700 leading-relaxed mt-0.5">
                      Shift sebelumnya meninggalkan catatan masalah yang belum selesai.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStartTimer}
                  className="flex items-center justify-center gap-2 w-full h-10 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-xs uppercase tracking-wide rounded-xl transition-all shadow-sm"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Mulai Lanjutkan Perbaikan
                </button>
              </div>
            )}

            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl w-full">
              {isEdit ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleOpenModal}
                    className="flex items-center justify-center gap-2 w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wide rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-[0.98] cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Masalah / Downtime
                  </button>
                </div>
              ) : !isTimerRunning ? (
                <div className="flex flex-col gap-2">
                  {tempDuration > 0 && (editingIndex !== null || batchClassifyIds.length > 0) ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowModal(true)}
                        className="flex items-center justify-center gap-2 w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wide rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-[0.98] cursor-pointer"
                      >
                        <AlertTriangle className="w-4 h-4 fill-current" />
                        <span>Lanjutkan Simpan Downtime ({formatTimer(tempDuration)})</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelTimer}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 font-bold text-[11px] transition-all flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200/80 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5 shrink-0" />
                        <span>Hapus Hitungan ({formatTimer(tempDuration)})</span>
                      </button>
                    </>
                  ) : isWifiConnected ? (
                    <div className="flex flex-col items-center justify-center p-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-center gap-1.5">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>ESP32 Wi-Fi Terhubung</span>
                      </div>
                      <p className="text-[10px] text-emerald-600/90 font-medium leading-tight">
                        Timer downtime dikontrol otomatis oleh sensor mesin.
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartTimer}
                      className="flex items-center justify-center gap-2 w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wide rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-[0.98] cursor-pointer"
                    >
                      <AlertTriangle className="w-4 h-4 fill-current" />
                      Mulai Manual
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="w-full bg-white border-2 border-amber-200 rounded-2xl h-14 flex items-center justify-center">
                    <span className="text-2xl font-black text-amber-600 font-mono tracking-wider animate-pulse">
                      {formatTimer(liveTimerSeconds)}
                    </span>
                  </div>
                  {currentTimerSource === "ESP32_WiFi" || currentTimerSource?.includes("ESP32") ? (
                    <div className="flex flex-col items-center justify-center p-3 bg-amber-100/90 border border-amber-300 rounded-2xl text-center gap-1">
                      <div className="flex items-center gap-1.5 text-amber-900 font-extrabold text-xs">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" />
                        <span>Sensor ESP32 Berjalan</span>
                      </div>
                      <p className="text-[10px] text-amber-800 font-medium leading-tight">
                        Timer akan berhenti & membuka form secara otomatis saat mesin nyala kembali.
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopTimer}
                      className="flex items-center justify-center gap-2 w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-sm uppercase tracking-wide rounded-2xl transition-all shadow-md shadow-emerald-500/20 active:scale-[0.98] cursor-pointer"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      Stop & Simpan
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 3. CARD ANTREAN & RIWAYAT KENDALA MESIN (SATUAN CARD MANDIRI) */}
      {viewMode !== "timer_only" && (fields.length > 0 || (() => {
        const currentList = watch("downtimeEvents") || fields || [];
        return currentList.some((evt: any) => evt.isResolved === false || (!evt.isResolved && (!evt.problems || evt.problems.length === 0)));
      })()) && (
        <div className="bg-white rounded-3xl p-3.5 sm:p-4 shadow-sm border border-slate-200/90 border-t-4 border-t-amber-400 mb-4 relative overflow-hidden animate-fadeIn">
          <div className={viewMode === "events_only" ? "grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-start" : "flex flex-col gap-4"}>
            {/* SECTION A: ANTREAN EVENT BELUM DIKLASIFIKASI */}
            {(() => {
              const currentList = watch("downtimeEvents") || fields || [];
              const unclassifiedItems = currentList
                .map((evt: any, index: number) => {
                  const isPending = evt.isResolved === false || (!evt.isResolved && (!evt.problems || evt.problems.length === 0));
                  return { evt, index, id: evt.id || `evt-${index}`, isPending };
                })
                .filter((item: any) => item.isPending);

              if (unclassifiedItems.length === 0) return null;

              const isAllSelected = unclassifiedItems.length > 0 && unclassifiedItems.every((item: any) => selectedUnclassifiedIds.includes(item.id));
              const hasResolvedEvents = currentList.some((evt: any) => evt.isResolved !== false && (evt.isResolved || (evt.problems && evt.problems.length > 0)));

              const sectionAClass = viewMode === "events_only"
                ? (hasResolvedEvents ? "border-b sm:border-b-0 sm:border-r border-amber-100 pb-3 sm:pb-0 sm:pr-3 min-w-0" : "sm:col-span-2")
                : (hasResolvedEvents ? "pb-3 border-b border-amber-100" : "");

              return (
                <div className={sectionAClass}>
                  {/* Concise Header Bar */}
                  <div className="flex items-center justify-between gap-1.5 mb-2.5 min-w-0 flex-wrap">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                      <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider whitespace-nowrap">
                        ANTREAN
                      </h4>
                      <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-2xs whitespace-nowrap">
                        {unclassifiedItems.length} Event
                      </span>
                    </div>

                    <label className="flex items-center gap-1 cursor-pointer bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-300/80 text-[10px] font-extrabold text-amber-950 shadow-2xs transition-all select-none shrink-0">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleToggleSelectAllUnclassified}
                        className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <span>Pilih Semua</span>
                    </label>
                  </div>

                  {/* Batch Action Bar */}
                  {selectedUnclassifiedIds.length > 0 && (
                    <div className="flex flex-col bg-amber-100/90 border border-amber-300 rounded-2xl p-2 mb-2.5 gap-1.5 animate-fadeIn min-w-0">
                      <span className="text-[10px] font-black text-amber-950">
                        📌 Terpilih {selectedUnclassifiedIds.length} dari {unclassifiedItems.length} Event
                      </span>
                      <div className="flex flex-col gap-1 w-full">
                        <button
                          type="button"
                          onClick={handleBatchResolveSensorGlitch}
                          className="w-full py-1.5 px-2 text-[10px] font-black text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95 text-center flex items-center justify-center gap-1"
                          title="Tandai semua event terpilih sebagai Gagal Cacat"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Semua Gagal Cacat</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenBatchClassifyModal}
                          className="w-full py-1.5 px-2 text-[10px] font-black text-white bg-sky-500 hover:bg-sky-600 border border-sky-600 rounded-xl transition-all shadow-md shadow-sky-500/20 cursor-pointer active:scale-95 text-center flex items-center justify-center gap-1"
                          title="Isi detail kendala/cacat untuk semua event terpilih"
                        >
                          <span>Klasifikasi Sekaligus ({selectedUnclassifiedIds.length})</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Event Items List */}
                  <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar min-w-0">
                    {unclassifiedItems.map(({ evt: event, index, id: eventId }: { evt: any; index: number; id: string }) => {
                      const isSelected = selectedUnclassifiedIds.includes(eventId);

                      return (
                        <div
                          key={eventId}
                          className={`flex flex-col p-2 border rounded-xl gap-1.5 transition-all min-w-0 ${
                            isSelected
                              ? "bg-amber-100/90 border-amber-400 ring-2 ring-amber-300/60 shadow-xs"
                              : "bg-amber-50/50 border-amber-200/90 hover:bg-amber-100/50 shadow-2xs"
                          }`}
                        >
                          {/* Row 1: Checkbox + Duration + Time */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectUnclassified(eventId)}
                              className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                            />
                            <span className="text-[10px] font-mono font-black text-amber-950 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300/80 shadow-2xs">
                              {formatTimer(event.durasiDetik)}
                            </span>
                            {event.stopStartTime && (
                              <span className="text-[10px] text-slate-600 font-bold truncate">
                                • Jam {event.stopStartTime}
                              </span>
                            )}
                          </div>

                          {/* Row 2: Action Buttons */}
                          <div className="flex items-center gap-1.5 w-full pt-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResolveSensorGlitch(index);
                              }}
                              className="flex-1 py-1 px-1.5 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200/90 border border-emerald-300/80 rounded-lg transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-95 text-center whitespace-nowrap"
                              title="Tandai sebagai false alarm (gagal cacat)"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Gagal Cacat</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenClassifyModal(index);
                              }}
                              className="flex-1 py-1 px-1.5 text-[10px] font-black text-white bg-amber-500 hover:bg-amber-600 border border-amber-600 rounded-lg transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-95 text-center whitespace-nowrap"
                              title="Isi detail kendala/cacat kain"
                            >
                              <span>+ Klasifikasi</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* SECTION B: RIWAYAT KENDALA MESIN (YANG SUDAH DIKLASIFIKASI) */}
            {(() => {
              const currentList = watch("downtimeEvents") || fields || [];
              const resolvedEvents = currentList.filter((evt: any) => evt.isResolved !== false && (evt.isResolved || (evt.problems && evt.problems.length > 0)));
              if (resolvedEvents.length === 0) return null;

              const hasPending = currentList.some((evt: any) => evt.isResolved === false || (!evt.isResolved && (!evt.problems || evt.problems.length === 0)));

              return (
                <div className={viewMode === "events_only" ? (hasPending ? "" : "sm:col-span-2") : ""}>
                  <div className="flex items-center justify-between mb-2.5 min-w-0">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                      <span>RIWAYAT BERHENTI:</span>
                    </h4>
                    <span className="bg-slate-100/80 text-slate-700 text-[9px] px-2.5 py-0.5 rounded-full border border-slate-200 uppercase tracking-wider font-extrabold whitespace-nowrap">
                      {resolvedEvents.length} KEJADIAN
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                    {currentList.map((event: any, index: number) => {
                      const isResolved = event.isResolved !== false && (event.isResolved || (event.problems && event.problems.length > 0));
                      if (!isResolved) return null;

                      return (
                        <div key={event.id || index} className="flex flex-row items-start justify-between p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl gap-2 shadow-2xs">
                          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-xs font-mono">
                                {formatTimer(event.durasiDetik)}
                              </span>
                              {(() => {
                                const meterStr = event.meter || (event.problems && event.problems.length > 0 ? event.problems[0]?.meter : null);

                                if (!event.pcsKe || event.pcsKe === "Semua") {
                                  if (meterStr) {
                                    return (
                                      <span className="text-[9px] font-extrabold text-sky-600 bg-sky-50 border border-sky-100/80 px-1.5 py-0.5 rounded">
                                        {meterStr.includes("PCS") ? meterStr : `Meter: ${meterStr}`}
                                      </span>
                                    );
                                  }
                                  return null;
                                }

                                const pcsArray = event.pcsKe.split(",").map((s: string) => s.trim());
                                const meterMap: Record<string, string> = {};

                                if (meterStr) {
                                  if (meterStr.includes("PCS")) {
                                    meterStr.split(",").forEach((m: string) => {
                                      const match = m.match(/PCS (\d+):\s*(.+)/);
                                      if (match) {
                                        meterMap[match[1]] = match[2];
                                      }
                                    });
                                  } else {
                                    meterMap[pcsArray[0]] = meterStr;
                                  }
                                }

                                return pcsArray.map((pcs: string) => (
                                  <span key={pcs} className="text-[9px] font-extrabold text-sky-600 bg-sky-50 border border-sky-100/80 px-1.5 py-0.5 rounded">
                                    PCS {pcs} {meterMap[pcs] ? `(${meterMap[pcs]}m)` : ""}
                                  </span>
                                ));
                              })()}

                              {event.dikerjakanOleh && (() => {
                                const isSpecial = event.dikerjakanOleh.includes('Mekanik') || 
                                                  event.dikerjakanOleh.includes('Teknisi') || 
                                                  event.dikerjakanOleh.includes('Perbaikan Khusus');
                                const cleanName = event.dikerjakanOleh.replace(/^Operator\s*/i, "").replace(/^\((.*)\)$/, "$1").trim();
                                return (
                                  <span className={`inline-flex text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-xs border ${
                                    isSpecial ? 'bg-fuchsia-600 text-white border-fuchsia-700' : 'bg-indigo-600 text-white border-indigo-700'
                                  }`}>
                                    {cleanName}
                                  </span>
                                );
                              })()}

                              {event.isSubmitted && (
                                <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Terkirim
                                </span>
                              )}
                            </div>

                            {/* Handle backward compatibility for old data struct */}
                            {event.kategori && typeof event.kategori === "string" && (
                              <div className="text-[11px] text-slate-650 pl-0.5 leading-relaxed break-words">
                                <span className="font-black text-slate-800">{event.kategori}:</span> {event.detail}
                                {event.blok && (
                                  <span className="inline-flex font-bold text-sky-700 bg-sky-50/50 px-1 py-0.5 rounded items-center gap-0.5 text-[9px] ml-1.5 border border-sky-100/60">
                                    <Box className="w-2.5 h-2.5" /> Blok {event.blok}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Handle array-based problems struct */}
                            {event.problems && event.problems.map((prob: any, pIdx: number) => {
                              const codeLabel = `${prob.kategori}:`;
                              const detailStr = Array.isArray(prob.details) ? prob.details.join(", ") : (prob.details || "");

                              return (
                                <div key={pIdx} className="pl-2 border-l-2 border-slate-200/90 ml-0.5 my-1 text-[11px] text-slate-800 leading-relaxed break-words">
                                  <span className="font-black text-slate-900 mr-1">{codeLabel}</span>
                                  <span className="font-medium text-slate-700">{detailStr}</span>
                                  {prob.blok && (
                                    <span className="inline-flex font-bold text-sky-700 bg-sky-50/50 px-1 py-0.5 rounded items-center gap-0.5 text-[9px] ml-1.5 border border-sky-100/60">
                                      <Box className="w-2.5 h-2.5" /> Blok {prob.blok}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                        {event.triggerSource === "ESP32_WiFi" || event.triggerSource?.includes("ESP32") ? (
                          <div
                            className="p-1.5 text-slate-400 bg-slate-100 rounded-lg shrink-0 self-start cursor-not-allowed border border-slate-200"
                            title="Data downtime otomatis dari sensor ESP32 tidak dapat dihapus"
                          >
                            <Lock className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              remove(index);
                              if (setValue) {
                                const currentEvents = watch("downtimeEvents") || [];
                                const updated = currentEvents.filter((_: any, i: number) => i !== index);
                                const sum = updated.reduce((acc: number, curr: any) => acc + (curr.durasiDetik || 0), 0);
                                setValue("totalDowntime", String(sum), { shouldDirty: true, shouldValidate: true });
                              }
                            }}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 self-start cursor-pointer"
                            title="Hapus Downtime Manual"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          </div>
        </div>
      )}

      {/* Modal Input Masalah */}
      {showModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseModal();
            }
          }}
        >
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh]">
            {/* Top Bar Simulasi ESP32 di Dalam Modal (Disembunyikan, ubah false ke true jika ingin mengaktifkan kembali) */}
            {false && (
              <div className="bg-purple-950 text-white px-3.5 py-2 flex items-center justify-between gap-2 border-b border-purple-800 text-xs shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider truncate text-purple-200">Simulasi ESP32:</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSimulationMode) toggleSimulationMode(true);
                      const mc = watch("nomorMc") || "";
                      const isM2 = mc.endsWith("11") || mc.includes("M2");
                      const src = "ESP32_WiFi";
                      if (isM2) triggerM2Start(src);
                      else triggerM1Start(src);
                    }}
                    className="py-1 px-2.5 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-extrabold rounded-lg transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1 whitespace-nowrap"
                    title="Simulasikan mesin terhenti kembali saat modal masih terbuka"
                  >
                    <Square className="w-3 h-3 fill-current shrink-0" />
                    <span>Simulasi Stop Mesin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const mc = watch("nomorMc") || "";
                      const isM2 = mc.endsWith("11") || mc.includes("M2");
                      const src = "ESP32_WiFi";
                      if (isM2) triggerM2Stop(src);
                      else triggerM1Stop(src);
                    }}
                    className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold rounded-lg transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1 whitespace-nowrap"
                    title="Simulasikan mesin menyala kembali"
                  >
                    <Play className="w-3 h-3 fill-current shrink-0" />
                    <span>Simulasi Nyala Mesin</span>
                  </button>
                </div>
              </div>
            )}

            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
                  <Timer className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                    <h3 className="font-black text-slate-800 text-sm sm:text-base">
                      {batchClassifyIds.length > 0 ? `Klasifikasi Sekaligus (${batchClassifyIds.length} Event)` : "Simpan Downtime"}
                    </h3>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-orange-200/90 rounded-xl shadow-2xs hover:bg-orange-50 transition-colors" title="Ketuk untuk mengubah durasi secara manual">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {batchClassifyIds.length > 0 ? "Total Durasi:" : "Durasi (Mnt:Dtk):"}
                      </span>
                      <div className="flex items-center font-mono font-black text-xs sm:text-sm text-orange-600 bg-orange-100/50 px-1.5 py-0.5 rounded-lg border border-orange-200/50">
                        <input
                          type="number"
                          min="0"
                          className="w-7 text-center bg-transparent outline-none p-0 m-0 border-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none font-mono font-black cursor-pointer hover:bg-orange-200/50 rounded transition-colors"
                          value={Math.floor(tempDuration / 60)}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                            setTempDuration((isNaN(val) ? 0 : val) * 60 + (tempDuration % 60));
                          }}
                        />
                        <span className="text-orange-400 font-bold mx-0.5">:</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          className="w-7 text-center bg-transparent outline-none p-0 m-0 border-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none font-mono font-black cursor-pointer hover:bg-orange-200/50 rounded transition-colors"
                          value={tempDuration % 60 < 10 && tempDuration % 60 !== 0 ? `0${tempDuration % 60}` : tempDuration % 60}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                            setTempDuration(Math.floor(tempDuration / 60) * 60 + (isNaN(val) ? 0 : Math.min(59, val)));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4 sm:space-y-5">
              {dikerjakanOleh === "Operator" && !isUnblockingBlock && pcsCount > 1 && (
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-inner mt-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">
                    Masalah terjadi pada PCS ke-berapa?
                  </label>
                  <p className="text-[9px] text-slate-400 font-semibold mb-3">
                    Ketuk untuk memilih/melepas pilihan PCS. Masalah harus terjadi minimal pada 1 PCS.
                  </p>
                  <div className={`grid gap-2 w-full ${pcsCount === 2 ? "grid-cols-2" :
                    pcsCount === 3 ? "grid-cols-3" :
                      pcsCount === 4 ? "grid-cols-4" :
                        pcsCount === 5 ? "grid-cols-5" :
                          "grid-cols-3 sm:grid-cols-6"
                    }`}>
                    {pcsKeys.map((pcsKey) => {
                      const isSelected = selectedPcsKeList.includes(pcsKey);
                      const isMeterEmpty = isSelected && showMeterInput && (!inputMeters[pcsKey] || inputMeters[pcsKey].trim() === "");
                      return (
                        <div key={pcsKey} className="flex flex-col gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPcsKeList((prev) => {
                                if (prev.includes(pcsKey)) {
                                  // Hapus meter input juga jika unselect
                                  setInputMeters((m) => {
                                    const next = { ...m };
                                    delete next[pcsKey];
                                    return next;
                                  });
                                  return prev.filter((x) => x !== pcsKey);
                                } else {
                                  return [...prev, pcsKey];
                                }
                              });
                            }}
                            className={`w-full h-12 flex items-center justify-center rounded-xl text-xs font-black transition-all border shadow-sm ${isSelected
                              ? "bg-sky-500 border-sky-500 text-white"
                              : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                              }`}
                          >
                            {pcsKey}
                          </button>
                          {showMeterInput && isSelected && (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={inputMeters[pcsKey] || ""}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*?)\..*/g, "$1");
                                setInputMeters(prev => ({ ...prev, [pcsKey]: val }));
                              }}
                              placeholder="Meter..."
                              className={`w-full h-8 px-2 text-center rounded-lg border text-[10px] font-bold font-mono transition-all animate-fadeIn ${isMeterEmpty
                                  ? "border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500 text-rose-700 bg-rose-50 placeholder:text-rose-300"
                                  : "border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 bg-emerald-50"
                                }`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {selectedPcsKeList.length === 0 ? (
                    <p className="text-[10px] text-red-500 font-bold mt-2 animate-pulse">
                      * Wajib memilih minimal 1 PCS yang bermasalah!
                    </p>
                  ) : showMeterInput && selectedPcsKeList.some((k) => !inputMeters[k] || inputMeters[k].trim() === "") ? (
                    <p className="text-[10px] text-rose-600 font-bold mt-2 animate-pulse flex items-center gap-1">
                      Wajib mengisi nilai meter untuk setiap PCS yang dipilih!
                    </p>
                  ) : null}
                </div>
              )}

              {dikerjakanOleh === "Operator" && !isUnblockingBlock && showMeterInput && pcsKeys.length === 1 && (
                <div className={`p-4 rounded-2xl border shadow-sm transition-all animate-fadeIn ${!inputMeters[pcsKeys[0]] || inputMeters[pcsKeys[0]].trim() === ""
                    ? "bg-rose-50/70 border-rose-300"
                    : "bg-emerald-50 border-emerald-200/60"
                  }`}>
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                    <Box className="w-4 h-4 text-emerald-600" />
                    Posisi Letak Meter <span className="text-rose-500 font-black">* (Wajib Diisi)</span>
                  </label>
                  <p className="text-[9px] text-slate-500 font-semibold mb-3">
                    Isi dengan angka desimal, misal 15.5 atau 20
                  </p>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={inputMeters[pcsKeys[0]] || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*?)\..*/g, "$1");
                      setInputMeters(prev => ({ ...prev, [pcsKeys[0]]: val }));
                    }}
                    placeholder="Contoh: 15.5"
                    className={`w-full h-11 px-4 rounded-xl border focus:outline-none focus:ring-2 text-sm font-bold text-slate-700 placeholder:font-medium placeholder:text-slate-400 bg-white shadow-inner transition-all ${!inputMeters[pcsKeys[0]] || inputMeters[pcsKeys[0]].trim() === ""
                        ? "border-rose-400 focus:ring-rose-500"
                        : "border-emerald-300 focus:ring-emerald-500"
                      }`}
                  />
                  {(!inputMeters[pcsKeys[0]] || inputMeters[pcsKeys[0]].trim() === "") && (
                    <p className="text-[10px] font-bold text-rose-600 mt-2 flex items-center gap-1 animate-pulse">
                      Nilai meter wajib diisi sebelum menyimpan downtime!
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-2 block">Pilih Kategori Masalah</label>
                <div className="grid grid-cols-1 gap-2">
                  {PROBLEM_CATEGORIES.map((cat) => (
                    <div key={cat.id} className="flex flex-col gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="checkbox"
                          name="kategori"
                          value={cat.id}
                          checked={selectedCategories.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories((prev) => [...prev, cat.id]);
                            } else {
                              setSelectedCategories((prev) => prev.filter((c) => c !== cat.id));
                              // Remove details and blok for this category
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
                        <div className="p-3 rounded-xl border-2 border-slate-100 bg-white text-sm font-semibold text-slate-600 peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 transition-all hover:border-slate-300">
                          {cat.name}
                        </div>
                      </label>

                      {selectedCategories.includes(cat.id) && (dynamicProblemDetails[cat.id] || PROBLEM_DETAILS[cat.id]) && (
                        <div className="pl-4 pr-2 py-2 border-l-2 border-sky-200 ml-2 animate-in slide-in-from-top-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Pilih Detail Masalah</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(dynamicProblemDetails[cat.id] || PROBLEM_DETAILS[cat.id] || []).map((detail) => (
                              <label key={detail} className="cursor-pointer">
                                <input
                                  type="checkbox"
                                  name={`detail-${cat.id}`}
                                  value={detail}
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
                                <div className="p-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-550 peer-checked:bg-sky-500 peer-checked:border-sky-500 peer-checked:text-white transition-all hover:bg-slate-50 text-center">
                                  {detail}
                                </div>
                              </label>
                            ))}

                            {(selectedDetails[cat.id] || [])
                              .filter((d) => !(dynamicProblemDetails[cat.id] || PROBLEM_DETAILS[cat.id] || []).includes(d))
                              .map((customDetail) => (
                                <div key={customDetail} className="relative flex items-center">
                                  <div className="flex-1 p-2.5 rounded-lg border border-sky-500 bg-sky-500 text-white text-xs font-semibold flex items-center justify-between shadow-xs">
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
                                      handleAddManualDetail(cat.id);
                                    }
                                  }}
                                  placeholder="Ketik detail masalah manual di sini..."
                                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 placeholder:text-slate-400"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddManualDetail(cat.id)}
                                  disabled={!(manualInputDetails[cat.id] || "").trim()}
                                  className="px-3 py-2 bg-sky-500 text-white font-bold text-xs rounded-lg hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Tambah</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {showBlockInput !== false && (() => {
                            const details = selectedDetails[cat.id] || [];
                            const reqDetails = details.filter((d) => requiredBlockDefects.includes(d));
                            const isRequired = reqDetails.length > 0;

                            if (!isRequired || details.length === 0) return null;

                            const isMissing = isRequired && (!inputBloks[cat.id] || inputBloks[cat.id]?.trim() === "");

                            return (() => {
                              const currentBlokVal = inputBloks[cat.id] || "";
                              const blockList = currentBlokVal
                                ? currentBlokVal.split(",").map((s) => s.trim())
                                : [""];

                              const updateBlockList = (newList: string[]) => {
                                setBlockValidationError(null);
                                const joined = newList
                                  .map((s) => s.replace(/[^0-9\-,\s]/g, ""))
                                  .join(", ");
                                setInputBloks((prev) => ({ ...prev, [cat.id]: joined }));
                              };

                              return (
                                <div className={`mt-3 p-3 rounded-xl border transition-all ${isMissing
                                  ? "bg-rose-50/80 border-rose-300 ring-2 ring-rose-200"
                                  : "bg-sky-50 border-sky-100"
                                  }`}>
                                  <label className="text-[10px] font-extrabold uppercase mb-1.5 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-slate-800">
                                      <Box className="w-3.5 h-3.5 text-[#0070bc]" />
                                      Lokasi / Nomor Blok {isRequired && <span className="text-rose-500 font-black">*</span>}
                                    </span>
                                    {isRequired ? (
                                      <span className="bg-rose-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        Wajib Diisi
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-bold text-[9px]">Opsional</span>
                                    )}
                                  </label>

                                  <div className="flex flex-wrap items-center gap-2">
                                    {blockList.map((itemVal, bIdx) => (
                                      <div key={bIdx} className="flex items-center gap-1">
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          maxLength={2}
                                          value={itemVal}
                                          onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
                                            const nextList = [...blockList];
                                            nextList[bIdx] = val;
                                            updateBlockList(nextList);
                                          }}
                                          placeholder={bIdx === 0 ? "Blok (15)" : `Blok ${bIdx + 1}`}
                                          className={`w-28 h-9 px-3 rounded-lg border text-center font-bold text-xs text-slate-800 placeholder:font-medium placeholder:text-slate-400 bg-white ${isMissing
                                            ? "border-rose-400 focus:ring-2 focus:ring-rose-500"
                                            : "border-sky-200 focus:ring-2 focus:ring-sky-500"
                                            }`}
                                        />
                                        {blockList.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const nextList = blockList.filter((_, i) => i !== bIdx);
                                              updateBlockList(nextList);
                                            }}
                                            className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors shrink-0"
                                            title="Hapus blok"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    ))}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateBlockList([...blockList, ""]);
                                      }}
                                      className="w-9 h-9 rounded-lg bg-white hover:bg-sky-100/60 border border-sky-200 text-[#0070bc] flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                                      title="Tambah Blok"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {isMissing && (
                                    <p className="text-[10px] font-bold text-rose-600 mt-1.5">
                                      Admin menginstruksikan nomor blok wajib diisi untuk masalah ini.
                                    </p>
                                  )}
                                </div>
                              );
                            })();
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button
                type="button"
                onClick={handleSaveNonDefectStop}
                className="flex-1 h-12 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 px-3 text-center"
                title="Simpan sebagai Gagal Cacat"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Gagal Cacat</span>
              </button>
              <button
                type="button"
                onClick={handleSaveEvent}
                disabled={
                  selectedCategories.length === 0 ||
                  selectedCategories.some(cat => {
                    const hasDetails = (selectedDetails[cat] || []).length > 0;
                    const hasManual = !!(manualInputDetails[cat] || "").trim();
                    return !hasDetails && !hasManual;
                  }) ||
                  (dikerjakanOleh === "Operator" && pcsKeys.length > 1 && selectedPcsKeList.length === 0) ||
                  hasMissingMeter
                }
                className="flex-1 h-12 bg-sky-500 text-white font-bold text-xs sm:text-sm rounded-xl hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
              >
                {isSavingMechanic ? "Mengirim..." : (unresolvedDowntime ? "Selesaikan Perbaikan" : "Simpan Masalah")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Serah Terima Shift (Pengantian Operator) */}
      {showHandoffModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-indigo-100 flex items-center justify-between bg-indigo-50">
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-black text-indigo-950 text-sm sm:text-base">Serah Terima Shift</h3>
                  <p className="text-[10px] text-indigo-700 font-semibold">Ganti petugas operator untuk shift berikutnya</p>
                </div>
              </div>
              <button onClick={() => setShowHandoffModal(false)} className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="text-[10px] font-extrabold text-slate-600 uppercase mb-1 block">Petugas Shift Baru *</label>
                <select
                  value={handoffOperatorName || currentOperatorName}
                  onChange={(e) => setHandoffOperatorName(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {currentOperatorName && <option value={currentOperatorName}>{currentOperatorName} (Operator Aktif)</option>}
                  {operators
                    .filter(op => op.name !== currentOperatorName)
                    .map(op => (
                      <option key={op.id} value={op.name}>{op.name}</option>
                    ))
                  }
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
              <button
                type="button"
                onClick={() => setShowHandoffModal(false)}
                className="flex-1 h-11 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddHandoffLog}
                className="flex-[2] h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Simpan Ganti Shift</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Catat Progres Perbaikan */}
      {showAddNoteModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-purple-100 flex items-center justify-between bg-purple-50">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="font-black text-purple-950 text-sm sm:text-base">Catat Progres Perbaikan</h3>
                  <p className="text-[10px] text-purple-700 font-semibold">Tambah catatan perkembang penanganan mesin</p>
                </div>
              </div>
              <button onClick={() => setShowAddNoteModal(false)} className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="text-[10px] font-extrabold text-slate-600 uppercase mb-1 block">Catatan Progres Perbaikan *</label>
                <textarea
                  rows={3}
                  value={progressNoteText}
                  onChange={(e) => setProgressNoteText(e.target.value)}
                  placeholder="Contoh: Pembongkaran dinamo selesai. Lanjut ganti bearing..."
                  className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none text-xs font-semibold text-slate-700 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddNoteModal(false)}
                className="flex-1 h-11 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddProgressNote}
                disabled={!progressNoteText.trim()}
                className="flex-[2] h-11 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-purple-600/20 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                <span>Simpan Catatan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Block Mesin */}
      {showConfirmBlockModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <Lock className="w-8 h-8 text-slate-700 mx-auto" />
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">
                  Konfirmasi Block Mesin
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed">
                  Apakah Anda yakin ingin memblokir <strong className="text-slate-800">Mesin {targetMc}</strong>? Mesin akan ditandai dalam status perbaikan khusus.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmBlockModal(false)}
                  className="h-11 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={executeBlockMachine}
                  className="h-11 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs transition-all shadow-md shadow-slate-800/20 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-4 h-4" />
                  <span>Ya, Block Mesin</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Batalkan Block */}
      {showConfirmCancelModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-red-100 overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">
                  Batalkan Block Mesin?
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed">
                  Apakah Anda yakin ingin membatalkan status Block <strong className="text-red-600">Mesin {targetMc}</strong>? Status block akan dibersihkan tanpa disimpan ke database.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmCancelModal(false)}
                  className="h-11 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={executeCancelBlock}
                  className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition-all shadow-md shadow-red-600/20 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>Ya, Batalkan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Batalkan Timer Downtime */}
      {showCancelTimerConfirmModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-red-100 overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">
                  Batalkan Timer Downtime?
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed">
                  Apakah Anda yakin ingin membatalkan timer perbaikan ini? Waktu terhitung (<strong className="text-red-600 font-mono">{formatTimer(liveTimerSeconds)}</strong>) akan direset dan <span className="underline decoration-red-400">tidak akan disimpan</span>.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelTimerConfirmModal(false)}
                  className="h-11 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Tidak, Lanjutkan
                </button>
                <button
                  type="button"
                  onClick={executeCancelTimer}
                  className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition-all shadow-md shadow-red-600/20 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>Ya, Batalkan Timer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
