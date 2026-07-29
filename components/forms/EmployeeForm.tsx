"use client";

import React, { useState, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productionFormSchema, ProductionFormInput } from "@/lib/schemas";
import { useAuth } from "@/lib/auth-context";
import {
  createProductionReport,
  uploadProductionPhoto,
  getLastPanelNoByPotongan,
  updateProductionReport,
} from "@/actions/employee-actions";
import { getProductionPlan } from "@/actions/plan-actions";
import { getMachineConfigs } from "@/actions/machine-config-actions";
import { getOperatorsList } from "@/actions/operator-actions";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  RefreshCw,
  UploadCloud,
  X,
  Camera,
  Database,
  FileText,
  Settings2,
  Trash2,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Save,
  Plus,
  Box,
  ClipboardList,
  Play,
  Square,
  Timer,
  ArrowLeft,
  ArrowRight,
  Scissors,
  Info,
  Lock,
  AlertTriangle,
  Hash,
  History,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import HeaderSummaryCard from "./HeaderSummaryCard";

// Dynamic imports: these components are code-split into separate JS chunks.
// They are NOT downloaded on initial page load, reducing TBT significantly.
const ProductionHeaderModal = dynamic(() => import("./ProductionHeaderModal"), {
  ssr: false,
});
import DowntimeTracker from "./DowntimeTracker";
const BluetoothDowntimeTrigger = dynamic(
  () => import("./BluetoothDowntimeTrigger"),
  { ssr: false }
);
const ContinuousHistoryDrawer = dynamic(
  () => import("./ContinuousHistoryDrawer"),
  { ssr: false }
);

// DATA FALLBACK DARI EXCEL
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

// NEW PROBLEM KATEGORI (A-H)
const NEW_PROBLEM_CATEGORIES = [
  { id: "A", name: "Kode A: Masalah dan Perbaikan Benang" },
  { id: "B", name: "Kode B: Perbaikan Jarum dan Element Rajutan (Mechanical)" },
  { id: "C", name: "Kode C: Pengaturan dan Design stup" },
  { id: "D", name: "Kode D: Bahan Baku dan penggantian Benang" },
  { id: "E", name: "Kode E: Masalah Kelistrikan" },
  { id: "F", name: "Kode F: Perawatan Mesin,Perbaikan Mekanik (maintenance)" },
  { id: "G", name: "Kode G: Faktor Eksternal dan Non-Teknis" },
];

const PANEL_TOUR_STEPS = [
  {
    target: "mode-switch",
    title: "Jenis Input",
    description:
      "Pastikan mode Panel aktif untuk input per panel. Kalau input per roll atau meteran, pindah ke Kontinu.",
  },
  {
    target: "header-summary",
    title: "Data Header",
    description:
      "Cek operator, shift, mesin, design, status matching, dan potongan. Tekan kartu ini untuk mengubah header.",
  },
  {
    target: "panel-info",
    title: "Nomor Panel",
    description:
      "Nomor panel terisi otomatis dari potongan dan mesin. Setelah kirim, sistem menyiapkan nomor berikutnya.",
  },
  {
    target: "pcs-detail",
    title: "Detail PCS",
    description:
      "Centang kalau ada cacat atau kendala pada PCS. Setelah dicentang, pilih kategori dan minimal satu detail masalah.",
  },
  {
    target: "pcs-detail",
    title: "Timer Downtime",
    description:
      "Saat kendala dicentang, timer downtime muncul di bawah detail PCS. Mulai saat masalah terjadi dan stop saat mesin kembali jalan.",
  },
  {
    target: "cut-panel",
    title: "Potong Kain",
    description:
      "Centang ini hanya jika panel yang sedang diinput adalah panel terakhir dalam roll.",
  },
  {
    target: "submit-panel",
    title: "Kirim Laporan",
    description:
      "Kirim setelah semua data benar. Kalau offline, data akan masuk antrean sinkronisasi otomatis.",
  },
];

const NEW_PROBLEMS: Record<string, string[]> = {
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
    "Ganti Pattern Disk",
    "Ganti pick",
  ],
  D: [
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
  E: [
    "Error Servo Drive",
    "Ganti motor servo",
    "Sensor Benang/Laser Stop",
    "Perbaikan Eletrik lainnya",
    "Konsleting",
    "Perbaikan listrik",
  ],
  F: [
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
  G: [
    "Hari Libur",
    "Tidak ada order",
    "Tunggu info",
    "Demo",
    "Bencana/gempa/banjir",
    "Istirahat selama buka puasa",
    "Tunggu Sparepart",
    "Mati Listrik",
  ],
};

// Client-side image compression helper
const compressImage = (
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.7,
): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = document.createElement("img");
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

type EmployeeFormProps = {
  initialData?: any;
  isEdit?: boolean;
};

export default function EmployeeForm({
  initialData,
  isEdit,
}: EmployeeFormProps = {}) {
  const { user } = useAuth();
  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15)
  );
  // Cache machine configs in a ref to avoid re-fetching on every machine change
  const machineConfigsRef = useRef<any[]>([]);
  // Timer ref for debouncing localStorage draft saves
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<
    (ProductionFormInput & { id?: string }) | null
  >(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLastPanel, setIsLastPanel] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourRect, setTourRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  // Photo States
  const [fotoBefore, setFotoBefore] = useState<File | null>(null);
  const [fotoAfter, setFotoAfter] = useState<File | null>(null);

  const router = useRouter();

  // States untuk dynamic dropdown dari Supabase
  const [operators, setOperators] = useState(FALLBACK_OPERATORS);
  const [designs, setDesigns] = useState(FALLBACK_DESIGNS);
  const [groups, setGroups] = useState(FALLBACK_GROUPS);

  // Accordion UI State
  const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);
  const [highlightPotonganKe, setHighlightPotonganKe] = useState(false);
  const [highlightOperator, setHighlightOperator] = useState(false);
  const [showAdvancedActions, setShowAdvancedActions] = useState(false);
  const [activeInfo, setActiveInfo] = useState<string | null>(null);
  const [timerControls, setTimerControls] = useState<{
    isTimerRunning: boolean;
    onStartTimer: (source?: any) => void;
    onStopTimer: (source?: any) => void;
  } | null>(null);

  const handleCancelAdvancedActions = () => {
    setIsLastPanel(false);
    setValue("tanggalPotong", "");
    if (fields && fields.length > 0) {
      fields.forEach((_, index) => {
        setValue(`pcsData.${index}.isBs` as const, false);
      });
    }
    setActiveInfo(null);
    setShowAdvancedActions(false);
  };
  const [machineInputTypes, setMachineInputTypes] = useState<Record<string, "PANEL" | "METER">>({});

  useEffect(() => {
    async function loadAllData() {
      // Fetch machine configs and operators in parallel at mount
      const [cfgRes, opRes] = await Promise.all([
        getMachineConfigs(),
        getOperatorsList(),
      ]);

      if (cfgRes.success && cfgRes.data) {
        machineConfigsRef.current = cfgRes.data;
        const typeMap: Record<string, "PANEL" | "METER"> = {};
        const pcsMap: Record<string, number> = {};
        cfgRes.data.forEach((c) => {
          typeMap[c.nomor_mc.toUpperCase()] = c.input_type === "METER" ? "METER" : "PANEL";
          pcsMap[c.nomor_mc.toUpperCase()] = c.default_pcs || 1;
        });
        setMachineInputTypes(typeMap);
        try {
          localStorage.setItem("dji_machine_input_types", JSON.stringify(typeMap));
          localStorage.setItem("dji_machine_configs", JSON.stringify(pcsMap));
        } catch (e) { }
      } else {
        let localTypes: Record<string, "PANEL" | "METER"> = {};
        try {
          const saved = localStorage.getItem("dji_machine_input_types");
          if (saved) localTypes = JSON.parse(saved);
        } catch (e) { }
        setMachineInputTypes(localTypes);
      }

      if (opRes.success && opRes.data && opRes.data.length > 0) {
        setOperators(
          opRes.data.map((op) => ({
            id: op.id,
            name: op.nama_operator,
            shift: op.shift,
          }))
        );
      }
    }
    loadAllData();
  }, []);

  // States untuk upload foto
  const [isUploading, setIsUploading] = useState<{
    before: boolean;
    after: boolean;
  }>({ before: false, after: false });

  // Backup Operator state
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupOperatorName, setBackupOperatorName] = useState("");

  // Break Warning Modal state
  const [breakWarningModal, setBreakWarningModal] = useState<{
    isOpen: boolean;
    timeStr: string;
    shiftName: string;
    allowedRange: string;
    pendingEvent: any;
  }>({
    isOpen: false,
    timeStr: "",
    shiftName: "",
    allowedRange: "",
    pendingEvent: null,
  });

  const handleConfirmBreakWarning = () => {
    if (breakWarningModal.pendingEvent) {
      register("jenisLaporan").onChange(breakWarningModal.pendingEvent);
    } else {
      setValue("jenisLaporan", "Istirahat");
    }
    setBreakWarningModal({ isOpen: false, timeStr: "", shiftName: "", allowedRange: "", pendingEvent: null });
    setShowBackupModal(true);
  };

  const handleCancelBreakWarning = () => {
    setValue("jenisLaporan", "Normal");
    setBreakWarningModal({ isOpen: false, timeStr: "", shiftName: "", allowedRange: "", pendingEvent: null });
  };

  // Persist backupOperatorName to localStorage for drafts
  useEffect(() => {
    if (isEdit) return;
    const saved = localStorage.getItem("dji_backup_operator_name");
    if (saved) {
      setBackupOperatorName(saved);
    }
  }, [isEdit]);

  useEffect(() => {
    if (isEdit) return;
    localStorage.setItem("dji_backup_operator_name", backupOperatorName);
  }, [backupOperatorName, isEdit]);

  const [previews, setPreviews] = useState<{
    before: string | null;
    after: string | null;
  }>({ before: null, after: null });



  useEffect(() => {
    const startPanelTour = () => {
      if (isEdit) return;
      setTourStepIndex(0);
      setIsTourOpen(true);
    };

    window.addEventListener("dji:start-panel-tour", startPanelTour);
    return () =>
      window.removeEventListener("dji:start-panel-tour", startPanelTour);
  }, [isEdit]);

  useEffect(() => {
    if (!isTourOpen) return;

    const currentStep = PANEL_TOUR_STEPS[tourStepIndex];
    const element = document.querySelector(
      `[data-tour="${currentStep.target}"]`,
    );

    const updateTourRect = () => {
      if (!element) {
        setTourRect(null);
        return;
      }

      const rect = element.getBoundingClientRect();
      setTourRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }

    const timeoutId = window.setTimeout(updateTourRect, 220);
    window.addEventListener("resize", updateTourRect);
    window.addEventListener("scroll", updateTourRect, true);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", updateTourRect);
      window.removeEventListener("scroll", updateTourRect, true);
    };
  }, [isTourOpen, tourStepIndex]);

  const closeTour = () => {
    setIsTourOpen(false);
    setTourStepIndex(0);
  };

  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);


  // Load designs & groups from Supabase lazily when the Header Modal opens
  useEffect(() => {
    if (!isHeaderModalOpen) return;
    async function loadDesignsAndGroups() {
      try {
        if (
          !process.env.NEXT_PUBLIC_SUPABASE_URL ||
          process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
        ) {
          return;
        }
        const supabase = createClient();
        const [dsResult, gpResult] = await Promise.all([
          supabase.from("designs").select("id, nama_design"),
          supabase.from("groups").select("id, nama_grup"),
        ]);
        if (dsResult.data && dsResult.data.length > 0) {
          setDesigns(dsResult.data.map((d: any) => ({ id: d.id, name: d.nama_design })));
        }
        if (gpResult.data && gpResult.data.length > 0) {
          setGroups(gpResult.data.map((g: any) => ({ id: g.id, name: g.nama_grup })));
        }
      } catch (err) {
        console.warn("Gagal load designs/groups dari Supabase, menggunakan fallback.", err);
      }
    }
    loadDesignsAndGroups();
  }, [isHeaderModalOpen]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    getValues,
    formState: { errors },
  } = useForm<ProductionFormInput>({
    mode: "onBlur",
    resolver: zodResolver(productionFormSchema),
    defaultValues: {
      operatorId: "3",
      groupId: "2",
      designId: "1",
      nomorMc: "",
      tanggalProduksi: new Date().toISOString().split("T")[0],
      tanggalPotong: "",
      pick: "",
      noOrderBarang: "",
      jenisBenangDasar: "",
      liner: "",
      heavy: "",
      shadow: "",
      pinggiran: "",
      rpm: "",
      statusMatching: "",
      potonganKe: "",
      course: "",
      pic: "",
      fotoBefore: null,
      fotoAfter: null,
      panelNo: "1",
      isPanelGagal: false,
      totalDowntime: "",
      pcsData: [
        {
          pcsIndex: "1",
          jmlHasilProduksi: "1",
        },
      ],
    },
  });

  useEffect(() => {
    if (initialData && isEdit) {
      let isIstirahat = false;
      if (initialData.details && initialData.details.length > 0) {
        isIstirahat = initialData.details.some((d: any) =>
          (d.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") ||
          (d.detail_masalah || "").toUpperCase().includes("ISTIRAHAT")
        );
      }

      let parsedDowntimeEvents: any[] = [];
      try {
        if (initialData.downtime_events) {
          parsedDowntimeEvents = typeof initialData.downtime_events === 'string'
            ? JSON.parse(initialData.downtime_events)
            : initialData.downtime_events;
        }
      } catch (e) {
        console.error("Error parsing downtime_events", e);
      }

      let rawPanelNo = String(initialData.panel_no || "1");
      let isGagal = false;
      if (rawPanelNo.includes("(GAGAL)") || rawPanelNo.includes("(BS)")) {
        isGagal = true;
        rawPanelNo = rawPanelNo.replace(/\(GAGAL\)/g, "").replace(/\(BS\)/g, "").trim();
      }

      reset({
        operatorId: String(initialData.operator_id || ""),
        groupId: String(initialData.group_id || ""),
        designId: String(initialData.design_id || ""),
        nomorMc: initialData.nomor_mc || "",
        statusMatching: initialData.status_matching || "",
        tanggalProduksi:
          initialData.tgl || new Date().toISOString().split("T")[0],
        tanggalPotong: initialData.tanggal_potong || "",
        pick: initialData.pick || "",
        noOrderBarang: initialData.no_order_barang || "",
        jenisBenangDasar: initialData.jenis_benang_dasar || "",
        liner: initialData.liner || "",
        heavy: initialData.heavy || "",
        shadow: initialData.shadow || "",
        pinggiran: initialData.pinggiran || "",
        rpm: String(initialData.rpm || ""),
        potonganKe: String(initialData.potongan_ke || ""),
        course: initialData.course || "",
        pic: initialData.pic || "",
        panelNo: rawPanelNo,
        isPanelGagal: isGagal,
        totalDowntime: String(initialData.total_downtime_detik || ""),
        jenisLaporan: isIstirahat ? "Istirahat" : (initialData.operator_backup ? `Istirahat (Backup: ${initialData.operator_backup})` : ""),
        downtimeEvents: parsedDowntimeEvents,
        pcsData:
          initialData.details && initialData.details.length > 0
            ? initialData.details.map((d: any, index: number) => ({
              pcsIndex: String(d.pcs_index || index + 1),
              jmlHasilProduksi: String(d.jml_hasil_produksi || "1"),
              isBs: d.kategori_masalah === "X" || Boolean(d.kategori_masalah && d.kategori_masalah.includes("BS"))
            }))
            : [
              {
                pcsIndex: "1",
                jmlHasilProduksi: "1",
              },
            ],
        operatorBackup: initialData.operator_backup || "",
      });
      if (initialData.tanggal_potong) {
        setIsLastPanel(true);
      }

      if (initialData.operator_backup) {
        setBackupOperatorName(initialData.operator_backup);
      }
    }
  }, [initialData, isEdit, reset]);

  const watchGroupId = watch("groupId");
  const selectedGroup = groups.find((g) => g.id.toString() === watchGroupId);
  const activeShiftName = selectedGroup ? selectedGroup.name : "A";

  const activeOperators = operators.filter(
    (op: any) => op.shift === activeShiftName || !op.shift,
  );

  const { fields, append, remove } = useFieldArray({
    control,
    name: "pcsData",
  });

  const [pcsConfirmModal, setPcsConfirmModal] = useState<{
    isOpen: boolean;
    targetCount: number;
    actionType: "increment" | "decrement";
  }>({
    isOpen: false,
    targetCount: 0,
    actionType: "increment",
  });

  const handleChangePcsCount = (targetCount: number, forceDirect = false) => {
    if (targetCount > fields.length) {
      // Append directly without confirmation for increasing
      for (let i = fields.length; i < targetCount; i++) {
        append({
          pcsIndex: String(i + 1),
          jmlHasilProduksi: "1",
        });
      }
    } else if (targetCount < fields.length) {
      if (forceDirect) {
        while (fields.length > targetCount) {
          remove(fields.length - 1);
        }
      } else {
        // Show confirmation dialog before reducing PCS count since it deletes data
        setPcsConfirmModal({
          isOpen: true,
          targetCount,
          actionType: "decrement",
        });
      }
    }
  };

  // Load Draft or Header Data dari LocalStorage
  useEffect(() => {
    if (isEdit) return;

    const savedDraft = localStorage.getItem("dji_form_draft_panel");
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        reset(parsed);
        setIsHeaderModalOpen(false);
        return;
      } catch (e) {
        console.error("Gagal load draft dari storage", e);
      }
    }

    const savedHeader = localStorage.getItem("dji_form_header");
    if (savedHeader) {
      try {
        const parsed = JSON.parse(savedHeader);
        Object.keys(parsed).forEach((key) => {
          if (key !== "lastRollNo" && key !== "nextPanelNo") {
            setValue(key as keyof ProductionFormInput, parsed[key], {
              shouldValidate: false,
              shouldDirty: false,
            });
          }
        });
        setIsHeaderModalOpen(false);
      } catch (e) {
        console.error("Gagal load header dari storage", e);
      }
    }
  }, [setValue, isEdit, reset]);

  // Subscribe to all form changes to save draft (debounced to avoid blocking main thread on every keystroke)
  useEffect(() => {
    if (isEdit) return;
    const subscription = watch((value) => {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = setTimeout(() => {
        localStorage.setItem("dji_form_draft_panel", JSON.stringify(value));
      }, 300);
    });
    return () => {
      clearTimeout(draftSaveTimerRef.current);
      subscription.unsubscribe();
    };
  }, [watch, isEdit]);

  const watchPotonganKe = watch("potonganKe");
  const watchNomorMc = watch("nomorMc");
  const watchOperatorId = watch("operatorId");
  const watchPanelNo = watch("panelNo");

  const prevNomorMcRef = useRef<string>("");
  // Sync machine config from cached ref (no extra network request)
  useEffect(() => {
    if (isEdit || !watchNomorMc) return;

    const currentMc = watchNomorMc.trim().toUpperCase();
    if (prevNomorMcRef.current === currentMc) return;
    prevNomorMcRef.current = currentMc;

    // Use cached configs from mount if available, else fallback to localStorage
    const configs = machineConfigsRef.current.length > 0
      ? machineConfigsRef.current
      : (() => {
          try {
            const saved = localStorage.getItem("dji_machine_configs");
            return saved ? JSON.parse(saved) : [];
          } catch { return []; }
        })();

    const match = Array.isArray(configs)
      ? configs.find((c: any) => c.nomor_mc?.trim().toUpperCase() === currentMc)
      : null;

    if (match) {
      if (match.default_pcs && typeof match.default_pcs === "number") {
        handleChangePcsCount(match.default_pcs, true);
      }
      if (match.input_type) {
        setMachineInputTypes((prev) => ({
          ...prev,
          [currentMc]: match.input_type === "METER" ? "METER" : "PANEL",
        }));
      }
    }
  }, [watchNomorMc, isEdit]);

  // Fetch the next panelNo when potonganKe or nomorMc changes
  useEffect(() => {
    if (
      isEdit ||
      !watchPotonganKe ||
      isNaN(parseInt(watchPotonganKe)) ||
      !watchNomorMc
    ) {
      return;
    }
    const timeoutId = setTimeout(async () => {
      try {
        const res = await getLastPanelNoByPotongan(
          parseInt(watchPotonganKe),
          watchNomorMc,
        );
        if (res.success && res.nextPanelNo) {
          setValue("panelNo", res.nextPanelNo.toString());
        }

        // Fetch Production Plan (Admin)
        const planRes = await getProductionPlan(watchNomorMc, parseInt(watchPotonganKe));
        if (planRes.success && planRes.data) {
          const plan = planRes.data;
          if (plan.design_id) setValue("designId", plan.design_id);
          if (plan.pick) setValue("pick", plan.pick);
          if (plan.course) setValue("course", plan.course);
          if (plan.no_order_barang) setValue("noOrderBarang", plan.no_order_barang);
          if (plan.no_customer) setValue("noCustomer", plan.no_customer);
          if (plan.jenis_benang_dasar) setValue("jenisBenangDasar", plan.jenis_benang_dasar);
          if (plan.liner) setValue("liner", plan.liner);
          if (plan.heavy) setValue("heavy", plan.heavy);
          if (plan.shadow) setValue("shadow", plan.shadow);
          if (plan.pinggiran) setValue("pinggiran", plan.pinggiran);
          if (plan.rpm) setValue("rpm", plan.rpm);
          if (plan.pcs_count && typeof plan.pcs_count === "number") {
            handleChangePcsCount(plan.pcs_count, true);
          }
        }
      } catch (e) { }
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [watchPotonganKe, watchNomorMc, setValue, isEdit]);

  const onInvalid = (fieldErrors: any) => {
    const extractMessage = (obj: any): string | null => {
      if (!obj) return null;
      if (typeof obj === "string") return obj;
      if (obj.message && typeof obj.message === "string") return obj.message;
      if (Array.isArray(obj)) {
        for (const item of obj) {
          const msg = extractMessage(item);
          if (msg) return msg;
        }
      }
      if (typeof obj === "object") {
        for (const key of Object.keys(obj)) {
          if (key === "ref" || key === "type") continue;
          const msg = extractMessage(obj[key]);
          if (msg) {
            // Jika pesan tidak mengandung bracket, tambahkan nama field agar jelas
            return msg.startsWith("[") ? msg : `[${key}] ${msg}`;
          }
        }
      }
      return null;
    };

    const msg = extractMessage(fieldErrors);
    setErrorMsg(msg || "Terdapat kesalahan validasi. Silakan periksa form.");
  };

  const onSubmit = async (data: ProductionFormInput) => {
    const currentMc = data.nomorMc || watchNomorMc || "";
    if (currentMc && machineInputTypes[currentMc.toUpperCase()] === "METER") {
      setIsSubmitting(false);
      setErrorMsg(`Mesin ${currentMc} telah dikunci oleh Admin khusus untuk input METER. Anda tidak dapat mengisi form Panel untuk mesin ini.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    const uppercaseFields: (keyof ProductionFormInput)[] = ["designId", "pick", "course", "noOrderBarang", "noCustomer", "jenisBenangDasar", "liner", "heavy", "shadow", "pinggiran", "rpm"];
    uppercaseFields.forEach(field => {
      if (typeof data[field] === "string") {
        (data as any)[field] = (data[field] as string).toUpperCase();
      }
    });
    // Gunakan idempotency key dari ref yang stabil
    data.idempotencyKey = idempotencyKeyRef.current;

    // Otomatis set isPanelGagal jika ada PCS yang BS
    if (data.pcsData?.some((p) => p.isBs)) {
      data.isPanelGagal = true;
    }

    if (data.jenisLaporan === "Istirahat" && backupOperatorName) {
      data.jenisLaporan = `Istirahat (Backup: ${backupOperatorName})`;
    }

    // Add backup operator name to payload if exists
    data.operatorBackup = backupOperatorName || undefined;

    // Ambil nama operator asli
    data.pic = getOperatorName(data.operatorId) || "";
    data.grupName = getGroupName(data.groupId);
    data.designName = getDesignName(data.designId);
    data.created_by_name = user?.fullName || null;



    // Save Header Data to LocalStorage automatically on submit
    // Save Header Data to LocalStorage automatically on submit
    const currentPanelNo = data.panelNo;
    let nextPanelNo = "1";
    if (currentPanelNo) {
      const match = currentPanelNo.match(/\d+$/);
      if (match) {
        const num = parseInt(match[0], 10);
        nextPanelNo = currentPanelNo.replace(/\d+$/, (num + 1).toString());
      } else {
        nextPanelNo = currentPanelNo + " 1";
      }
    }

    const isCutSubmit = !isEdit && !!data.tanggalPotong;
    const submitData: ProductionFormInput = isCutSubmit
      ? { ...data, panelNo: "" }
      : data;

    // Jika mesinMasihStop atau ada panel gagal/BS, tahan nomor panel (tidak maju)
    // Operator harus menginput panel fisik yang valid untuk nomor panel ini terlebih dahulu
    const hasBs = data.pcsData && data.pcsData.some((p: any) => p.isBs);
    let nextPanelNoForSave = isCutSubmit ? "1" : nextPanelNo;
    if ((data.mesinMasihStop || data.isPanelGagal || hasBs) && !isCutSubmit) {
      const cleanCurrentPanelNo = currentPanelNo ? currentPanelNo.replace(/\s*\(BS\)/gi, "").trim() : "";
      nextPanelNoForSave = cleanCurrentPanelNo || currentPanelNo || nextPanelNo; // tetap di nomor panel yang sama untuk panel valid
      if (data.mesinMasihStop && data.downtimeEvents && data.downtimeEvents.length > 0) {
        const lastEvent = data.downtimeEvents[data.downtimeEvents.length - 1];
        localStorage.setItem("dji_unresolved_downtime", JSON.stringify({
          ...lastEvent,
          durasiDetik: 0 // Reset waktu, shift baru mulai hitung dari 0
        }));
      }
    } else {
      localStorage.removeItem("dji_unresolved_downtime");
    }

    if (!isEdit) {
      const headerDataToSave = {
        operatorId: data.operatorId,
        groupId: data.groupId,
        designId: data.designId,
        nomorMc: data.nomorMc,
        tanggalProduksi: data.tanggalProduksi,
        tanggalPotong: "",
        pick: data.pick,
        noOrderBarang: data.noOrderBarang,
        noCustomer: data.noCustomer,
        jenisBenangDasar: data.jenisBenangDasar,
        liner: data.liner,
        heavy: data.heavy,
        shadow: data.shadow,
        pinggiran: data.pinggiran,
        course: data.course,
        rpm: data.rpm,
        pic: data.pic,
        potonganKe: data.potonganKe,
        nextPanelNo: nextPanelNoForSave, // we store the next available panel no
      };
      localStorage.setItem("dji_form_header", JSON.stringify(headerDataToSave));
    }

    try {
      if (!navigator.onLine) {
        const { addPendingPayload } = await import("@/lib/offline-store");
        await addPendingPayload("employee", submitData);
        if (!isEdit) {
          localStorage.removeItem("dji_form_draft_panel");
        }
        setSuccessData({
          ...data,
          isOfflineSaved: true,

          isCutSubmit,
        } as any);
        return;
      }

      let result;
      if (isEdit && initialData?.id) {
        result = await updateProductionReport(initialData.id, submitData);
      } else {
        result = await createProductionReport(submitData);
      }

      if (result.success) {
        if (!isEdit) {
          localStorage.removeItem("dji_form_draft_panel");
        }
        setSuccessData({
          ...data,
          id: isEdit ? initialData.id : (result as any).productionId,
          isCutSubmit,
        } as any);
      } else {
        setErrorMsg(result.error || "Gagal menyimpan laporan produksi rajut.");
      }
    } catch (err: any) {
      if (
        err.message?.includes("fetch") ||
        err.message?.includes("Network") ||
        !navigator.onLine
      ) {
        const { addPendingPayload } = await import("@/lib/offline-store");
        await addPendingPayload("employee", submitData);
        if (!isEdit) {
          localStorage.removeItem("dji_form_draft_panel");
        }
        setSuccessData({
          ...data,
          isOfflineSaved: true,
          isCutSubmit,
        } as any);
      } else {
        console.error("Uncaught exception in onSubmit:", err);
        setErrorMsg(`Terjadi kesalahan sistem: ${err.message || err}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearHeader = () => {
    if (window.confirm("Yakin ingin mereset/mengosongkan data Header?")) {
      localStorage.removeItem("dji_form_header");
      localStorage.removeItem("dji_form_draft_panel"); 
      localStorage.removeItem("dji_backup_operator_name");
      localStorage.removeItem("dji_active_downtime_start");
      reset({
        ...watch(), // Keep current panel inputs
        nomorMc: "",
        tanggalPotong: "",
        pick: "",
        noOrderBarang: "",
        noCustomer: "",
        jenisBenangDasar: "",
        liner: "",
        heavy: "",
        shadow: "",
        pinggiran: "",
        course: "",
        rpm: "",
        potonganKe: "",
        panelNo: "1",
        isPanelGagal: false,
        totalDowntime: "",
        pcsData: [
          {
            pcsIndex: "1",
            jmlHasilProduksi: "",
          },
        ],
      });
      setIsLastPanel(false);
      setIsHeaderModalOpen(true);
    }
  };
  const handleCloseSuccess = () => {
    if (isEdit) {
      sessionStorage.removeItem("dji_history_data");
      sessionStorage.removeItem("dji_history_searched");
      if (successData) {
        const mc = successData.nomorMc || "";
        const design = successData.designId || "";
        const potongan = successData.potonganKe || "";
        const tgl = successData.tanggalProduksi || "";
        router.push(`/history/detail?mc=${mc}&design=${design}&potongan=${potongan}&tgl=${tgl}`);
      } else {
        router.back();
      }
      return;
    }

    const wasLastPanel = !!successData?.tanggalPotong;

    setSuccessData(null);
    const savedHeader = localStorage.getItem("dji_form_header");
    let nextPanelNo = "1";
    if (savedHeader) {
      try {
        const parsed = JSON.parse(savedHeader);
        if (parsed.nextPanelNo) nextPanelNo = parsed.nextPanelNo;
      } catch (e) { }
    }
    const currentPcsData = watch("pcsData") || [];
    const newPcsData = currentPcsData.map((pcs, index) => ({
      pcsIndex: (index + 1).toString(),
      jmlHasilProduksi: "1",
    }));

    const currentPotongan = parseInt(watchPotonganKe || "0");
    const nextPotongan =
      wasLastPanel && !isNaN(currentPotongan)
        ? String(currentPotongan + 1)
        : watchPotonganKe;

    // Jika mesinMasihStop, gunakan panelNo yang sama (dari localStorage yang sudah disimpan dengan nextPanelNo = currentPanelNo)
    // nextPanelNo dari localStorage sudah memegang nomor panel yang sama

    reset({
      ...watch(),
      potonganKe: nextPotongan,
      panelNo: nextPanelNo,
      isPanelGagal: false,
      mesinMasihStop: false,
      pcsData:
        newPcsData.length > 0
          ? newPcsData
          : [
            {
              pcsIndex: "1",
              jmlHasilProduksi: "1",
            },
          ],
      totalDowntime: "",
      tanggalPotong: "",
      downtimeEvents: [],
    });
    localStorage.removeItem("dji_active_downtime_start");

    // Refresh idempotency key setelah sukses submit
    idempotencyKeyRef.current = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15);

    setIsLastPanel(false);

    setPreviews({ before: null, after: null });

    const submittedJenis = successData?.jenisLaporan;
    const wasAkhirShift = submittedJenis === "Akhir Shift";

    if (wasLastPanel || wasAkhirShift) {
      setIsHeaderModalOpen(true);
      if (wasLastPanel) setHighlightPotonganKe(true);
      if (wasAkhirShift) setHighlightOperator(true);
    }
  };

  const currentTourStep = PANEL_TOUR_STEPS[tourStepIndex];
  const isLastTourStep = tourStepIndex === PANEL_TOUR_STEPS.length - 1;
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 768;
  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1024;
  const tourCardTop = tourRect
    ? Math.min(
      Math.max(tourRect.top + tourRect.height + 16, 16),
      Math.max(viewportHeight - 260, 16),
    )
    : 96;
  const tourCardLeft = tourRect
    ? Math.min(Math.max(tourRect.left, 16), Math.max(viewportWidth - 368, 16))
    : 16;

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "before" | "after",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading((prev) => ({ ...prev, [type]: true }));
      setErrorMsg(null);

      const compressedFile = await compressImage(file);
      const objectUrl = URL.createObjectURL(compressedFile);
      setPreviews((prev) => ({ ...prev, [type]: objectUrl }));

      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
      ) {
        await new Promise((r) => setTimeout(r, 1000));
        setValue(
          type === "before" ? "fotoBefore" : "fotoAfter",
          `mock_url_${type}_${Date.now()}`,
        );
        setIsUploading((prev) => ({ ...prev, [type]: false }));
        return;
      }

      const base64Data = await fileToBase64(compressedFile);
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

      const uploadResult = await uploadProductionPhoto(base64Data, fileName);
      if (!uploadResult.success || !uploadResult.publicUrl) {
        throw new Error(uploadResult.error || "Gagal mengunggah foto.");
      }

      setValue(
        type === "before" ? "fotoBefore" : "fotoAfter",
        uploadResult.publicUrl,
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Gagal mengunggah foto ${type}: ${errorMessage}`);
      setPreviews((prev) => ({ ...prev, [type]: null }));
    } finally {
      setIsUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const removePhoto = (type: "before" | "after") => {
    setPreviews((prev) => ({ ...prev, [type]: null }));
    setValue(type === "before" ? "fotoBefore" : "fotoAfter", null);
  };

  const getOperatorName = (id: string) =>
    operators.find((o) => o.id.toString() === id)?.name || id;
  const getGroupName = (id: string) =>
    groups.find((g) => g.id.toString() === id)?.name || `Grup ${id}`;
  const getDesignName = (id: string) =>
    designs.find((d) => d.id.toString() === id)?.name || id;

  // Pre-compute values used multiple times in JSX to avoid repeated watch() calls
  const currentOperatorName = getOperatorName(watchOperatorId);
  const isMeterMachine = watchNomorMc ? machineInputTypes[watchNomorMc.toUpperCase()] === "METER" : false;

  return (
    <div className="w-full max-w-5xl mx-auto bg-gradient-to-br from-blue-50/40 via-white to-white border border-[#e9ecef] rounded-[24px] p-4 sm:p-6 lg:p-8 shadow-[0_8px_30px_rgba(0,112,188,0.06)] text-slate-800 relative overflow-hidden">
      {/* Decorative background shape */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-100/30 via-blue-50/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none -z-10"></div>

      <div className="relative">
        {/* Segmented Control for Mode Switching */}
        <div
          data-tour="mode-switch"
          className="flex w-full bg-slate-100/80 p-1.5 rounded-2xl mb-8 border border-slate-200/60 shadow-inner"
        >
          <div className="flex-1 flex items-center justify-center py-3.5 rounded-xl bg-white shadow-sm border border-slate-200 text-[#0070bc] relative overflow-hidden group cursor-default">
            <div className="absolute inset-0 bg-blue-50/50 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <div className="relative flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <Box className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-black uppercase tracking-wider leading-none">
                  PANEL
                </span>
              </div>
            </div>
          </div>
          <a
            href="/input-meter"
            className="flex-1 flex items-center justify-center py-3.5 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-white/60 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5 opacity-70 hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                <ClipboardList className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-bold uppercase tracking-wider leading-none">
                  METER
                </span>
              </div>
            </div>
          </a>
        </div>
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-100 pb-4 mb-6 gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Form Input Produksi (Jenis Panel)
              </h3>
              <p className="text-xs text-slate-400 font-normal mt-1">
                Data Header akan otomatis tersimpan untuk panel berikutnya.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsHistoryDrawerOpen(true)}
              className="px-3.5 py-2 rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 text-xs font-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <History className="w-4 h-4 stroke-[2.5]" />
              <span>Riwayat Shift Ini</span>
            </button>
          </div>

          {isMeterMachine && (
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100/80 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-amber-900 uppercase tracking-wide leading-none">
                    Mesin {watchNomorMc} Di-set Input METER
                  </h4>
                  <p className="text-[11px] font-medium text-amber-700 leading-snug mt-1">
                    Admin mengatur mesin ini khusus untuk pelaporan <strong>Meteran / Roll</strong>.
                  </p>
                </div>
              </div>
              <a
                href={`/input-meter?mc=${encodeURIComponent(watchNomorMc)}`}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <span>Pindah Form Meter</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
          <div className="bg-white border border-slate-200 shadow-sm rounded-[20px] p-3 sm:p-4 lg:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-5 items-start">
              {/* Kolom Kiri: Info Header & Info Panel */}
              <div className="flex flex-col gap-3 sm:gap-4 lg:gap-5 self-start sm:min-h-[345px]">
                <div data-tour="header-summary" className="w-full">
                  <HeaderSummaryCard
                    operatorName={currentOperatorName}
                    shiftName={activeShiftName}
                    nomorMc={watchNomorMc || ""}
                    design={watch("designId") || ""}
                    statusMatching={watch("statusMatching") || ""}
                    potonganKe={watchPotonganKe}
                    onEdit={() => setIsHeaderModalOpen(true)}
                    showEditButton
                    showEditButtonPlacement="bottom"
                  />
                </div>

                {/* Data Panel Umum */}
                <div
                  data-tour="panel-info"
                  className="w-full flex-1 bg-slate-50 border-2 border-slate-200 rounded-3xl overflow-hidden relative min-h-[100px] grid grid-cols-2"
                >
                  <input type="hidden" {...register("panelNo")} />

                  {/* Kiri: Label */}
                  <div className="flex flex-col items-center justify-center gap-1.5 border-r border-slate-200 p-4">
                    <div className="w-7 h-7 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                      <Hash className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest text-center">
                      Nomor Panel:
                    </span>
                  </div>

                  {/* Kanan: Angka */}
                  <div className="flex items-center justify-center p-4">
                    <span className="text-5xl sm:text-6xl font-black text-slate-800 leading-none">
                      {String(watchPanelNo || "-")}
                    </span>
                  </div>

                  {errors.panelNo && (
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-red-500 text-[10px] font-bold whitespace-nowrap">
                      {errors.panelNo.message}
                    </span>
                  )}
                </div>

                {/* Banner Bluetooth Trigger ESP32 (Disimpan tepat di bawah Card Nomor Panel) */}
                {!isEdit && timerControls && (
                  <div className="w-full">
                    <BluetoothDowntimeTrigger
                      onStartTimer={timerControls.onStartTimer}
                      onStopTimer={timerControls.onStopTimer}
                      isTimerRunning={timerControls.isTimerRunning}
                    />
                  </div>
                )}
              </div>

              {/* Kolom Kanan: Downtime Tracker */}
              <div className="flex flex-col w-full self-start">
                <div data-tour="downtime" className="w-full">
                  <input type="hidden" {...register("totalDowntime")} />
                  <DowntimeTracker
                    control={control}
                    setValue={setValue}
                    watch={watch}
                    showBlockInput={true}
                    operators={activeOperators}
                    currentOperatorName={currentOperatorName}
                    isEdit={isEdit}
                    onRegisterTimerControls={setTimerControls}
                  />
                </div>
              </div>
            </div>

            <ProductionHeaderModal
              isOpen={isHeaderModalOpen}
              onClose={() => {
                setIsHeaderModalOpen(false);
                setHighlightPotonganKe(false);
                setHighlightOperator(false);
              }}
              register={register}
              errors={errors}
              watch={watch}
              groups={groups}
              operators={activeOperators}
              activeShiftName={activeShiftName}
              onClearHeader={handleClearHeader}
              highlightPotonganKe={highlightPotonganKe}
              highlightOperator={highlightOperator}
              pcsCount={fields.length}
              onChangePcsCount={handleChangePcsCount}
            />

            {/* Hidden PCS fields to match the array structure for form submission */}
            {fields.map((field, index) => (
              <input
                key={field.id}
                type="hidden"
                {...register(`pcsData.${index}.jmlHasilProduksi` as const)}
              />
            ))}
          </div>


          {/* Tindakan Akhir Panel Toggle Button */}
          <button
            type="button"
            onClick={() => {
              if (showAdvancedActions) {
                handleCancelAdvancedActions();
              } else {
                setShowAdvancedActions(true);
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-xl border-2 border-rose-300 border-dashed text-rose-600 font-bold text-sm hover:bg-rose-50 hover:text-rose-700 hover:border-rose-400 transition-all duration-200"
          >
            {showAdvancedActions ? (
              <>Tutup Opsi Lanjutan</>
            ) : (
              <>Potong Kain & BS</>
            )}
          </button>

          {/* Tindakan Akhir Panel Modal */}
          {showAdvancedActions && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn" onClick={handleCancelAdvancedActions}>
              <div
                className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-scaleIn"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-black text-slate-800 text-lg">Opsi Lanjutan Panel</h3>
                  <button
                    type="button"
                    onClick={handleCancelAdvancedActions}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div
                  className="p-5 sm:p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/30 custom-scrollbar"
                  onClick={() => setActiveInfo(null)}
                >
                  {/* Potong Kain Toggle */}
                  <div className="flex flex-col gap-2 relative" data-tour="cut-panel">
                    <label className={`relative flex flex-col items-center justify-center p-4 h-32 rounded-2xl border-2 cursor-pointer transition-all duration-300 text-center ${isLastPanel
                        ? "bg-gradient-to-br from-[#0070bc] to-[#004777] border-transparent shadow-lg shadow-sky-500/30 text-white"
                        : "bg-white border-slate-200 hover:border-sky-300 text-slate-600 hover:bg-sky-50"
                      }`}>
                      <input
                        type="checkbox"
                        checked={isLastPanel}
                        onChange={(e) => {
                          setIsLastPanel(e.target.checked);
                          if (e.target.checked) {
                            setValue("tanggalPotong", new Date().toISOString().split("T")[0]);
                          } else {
                            setValue("tanggalPotong", "");
                          }
                        }}
                        className="hidden"
                      />
                      <Scissors className={`w-8 h-8 mb-2 transition-transform duration-300 ${isLastPanel ? "-rotate-12 scale-110" : "text-slate-400"}`} style={{ transform: isLastPanel ? "scaleX(-1) rotate(12deg)" : "scaleX(-1)" }} />
                      <span className="font-black uppercase text-xs tracking-wide">Potong Kain</span>

                      {isLastPanel && (
                        <div className="absolute top-2 right-2 bg-white/20 rounded-full p-1">
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </label>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveInfo(activeInfo === "potong" ? null : "potong");
                      }}
                      className={`absolute top-2 left-2 p-1.5 rounded-lg transition-colors z-20 ${activeInfo === "potong"
                          ? "bg-slate-800 text-white"
                          : isLastPanel ? "bg-white/20 text-white hover:bg-white/30" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        }`}
                    >
                      <Info className="w-4 h-4" />
                    </button>
                    {activeInfo === "potong" && (
                      <div className="absolute top-12 left-0 w-full p-3 bg-slate-800 text-white text-[11px] leading-relaxed rounded-xl z-50 shadow-xl animate-fadeIn">
                        Tandai khusus untuk potongan terakhir dalam roll kain.
                      </div>
                    )}

                    {isLastPanel && (
                      <div className="animate-fadeIn">
                        <input
                          type="date"
                          {...register("tanggalPotong")}
                          className="h-10 px-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none shadow-sm w-full text-center"
                        />
                      </div>
                    )}
                  </div>

                  {/* Pilih PCS yang BS */}
                  {fields.length > 0 && (
                    <div className="flex flex-col gap-2 relative">
                      <div className="relative flex flex-col items-center justify-center p-4 min-h-32 h-auto rounded-2xl border-2 bg-gradient-to-br from-rose-50 to-white border-rose-200 text-center shadow-sm">
                        <AlertCircle className="w-7 h-7 mb-2 text-rose-500" />
                        <span className="font-black uppercase text-xs text-rose-700 tracking-wide mb-2">Tandai PCS BS</span>

                        <div className="flex flex-wrap justify-center gap-1.5 w-full">
                          {fields.map((field, index) => (
                            <div key={field.id} className="relative flex-1 min-w-[45%] z-10">
                              <input
                                type="checkbox"
                                id={`pcsBs-${index}`}
                                {...register(`pcsData.${index}.isBs` as const)}
                                className="peer hidden"
                              />
                              <label htmlFor={`pcsBs-${index}`} className="flex items-center justify-center cursor-pointer py-1.5 px-2 rounded-lg border-2 bg-white border-rose-200 text-rose-600 font-bold text-[10px] uppercase transition-all duration-300 hover:border-rose-400 hover:bg-rose-50 peer-checked:bg-rose-500 peer-checked:border-rose-600 peer-checked:text-white peer-checked:shadow-md">
                                PCS {index + 1}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveInfo(activeInfo === "pcs" ? null : "pcs");
                        }}
                        className={`absolute top-2 left-2 p-1.5 rounded-lg transition-colors z-20 ${activeInfo === "pcs" ? "bg-slate-800 text-white" : "bg-rose-100 text-rose-400 hover:bg-rose-200"
                          }`}
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      {activeInfo === "pcs" && (
                        <div className="absolute top-12 left-0 w-full p-3 bg-slate-800 text-white text-[11px] leading-relaxed rounded-xl z-50 shadow-xl animate-fadeIn">
                          Klik tombol PCS yang cacat/rusak. Otomatis akan menahan nomor urut panel selanjutnya.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-5 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancelAdvancedActions}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all uppercase tracking-wider cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setShowAdvancedActions(false);
                      handleSubmit(onSubmit, onInvalid)();
                    }}
                    className="flex-1 h-12 sm:h-14 bg-[#0070bc] hover:bg-[#004777] active:scale-[0.98] text-white font-black text-sm rounded-xl shadow-lg shadow-sky-900/20 transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
                    <span>{isSubmitting ? "Menyimpan..." : "Kirim Laporan Sekarang"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col gap-3">
            <label className="text-xs font-bold text-slate-700 uppercase">
              Jenis Laporan / Info Istirahat
            </label>

            <div className="grid grid-cols-2 gap-3">
              {/* Normal */}
              <div className="relative">
                <input
                  type="radio"
                  id="jenisLaporanNormal"
                  value=""
                  {...register("jenisLaporan")}
                  onChange={(e) => {
                    register("jenisLaporan").onChange(e);
                    setBackupOperatorName("");
                  }}
                  className="peer hidden"
                />
                <label
                  htmlFor="jenisLaporanNormal"
                  className="flex items-center justify-center p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 text-center bg-white border-slate-200 hover:border-[#0070bc]/40 hover:bg-sky-50 text-slate-600 font-black text-xs sm:text-sm uppercase peer-checked:border-[#0070bc] peer-checked:bg-sky-50 peer-checked:text-[#0070bc] shadow-sm peer-checked:shadow-md"
                >
                  Normal
                </label>
              </div>

              {/* Istirahat */}
              <div className="relative">
                <input
                  type="radio"
                  id="jenisLaporanIstirahat"
                  value="Istirahat"
                  {...register("jenisLaporan")}
                  onChange={(e) => {
                    const now = new Date();
                    const currentHour = now.getHours();
                    const currentMin = now.getMinutes();
                    const timeVal = currentHour + currentMin / 60;

                    let isAllowed = false;
                    let shiftName = "";
                    let allowedRange = "";

                    if (timeVal >= 7.166 && timeVal < 15.166) {
                      shiftName = "Shift 1";
                      allowedRange = "10:00 - 13:00";
                      if (timeVal >= 10.0 && timeVal < 13.0) {
                        isAllowed = true;
                      }
                    } else if (timeVal >= 15.166 && timeVal < 23.166) {
                      shiftName = "Shift 2";
                      allowedRange = "18:00 - 21:00";
                      if (timeVal >= 18.0 && timeVal < 21.0) {
                        isAllowed = true;
                      }
                    } else {
                      shiftName = "Shift 3";
                      allowedRange = "02:00 - 05:00";
                      if (currentHour >= 2 && currentHour < 5) {
                        isAllowed = true;
                      }
                    }

                    if (!isAllowed) {
                      const timeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`;
                      e.persist?.();
                      setBreakWarningModal({
                        isOpen: true,
                        timeStr,
                        shiftName,
                        allowedRange,
                        pendingEvent: e,
                      });
                      return;
                    }

                    register("jenisLaporan").onChange(e);
                    setShowBackupModal(true);
                  }}
                  className="peer hidden"
                />
                <label
                  htmlFor="jenisLaporanIstirahat"
                  className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 text-center bg-white border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-600 font-black text-xs sm:text-sm uppercase peer-checked:border-amber-500 peer-checked:bg-gradient-to-br peer-checked:from-amber-400 peer-checked:to-amber-500 peer-checked:text-white shadow-sm peer-checked:shadow-md peer-checked:shadow-amber-500/30"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span>Istirahat</span>
                    {backupOperatorName && (
                      <span className="text-[9px] sm:text-[10px] bg-white/20 text-amber-900 px-2 py-0.5 rounded-md mt-0.5 font-bold tracking-wide">
                        {backupOperatorName}
                      </span>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">
              Pilih <strong>Istirahat</strong> jika panel ini adalah hasil kerja saat Anda beristirahat (operator pengganti).
            </p>
          </div>

          {/* Kirim Button */}
          {isMeterMachine ? (
            <button
              type="button"
              disabled
              className="w-full h-12 rounded-xl bg-slate-200 text-slate-500 font-extrabold text-xs uppercase tracking-wide cursor-not-allowed flex items-center justify-center gap-2 border border-slate-300"
            >
              <Lock className="w-4 h-4 text-slate-500" />
              <span>Ditolak: Mesin {watchNomorMc} Khusus Input METER</span>
            </button>
          ) : (
            <button
              data-tour="submit-panel"
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl bg-[#0070bc] hover:bg-[#004777] active:scale-[0.99] disabled:opacity-50 text-white text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-md"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />{" "}
                  {isEdit ? "Simpan Perubahan" : "Kirim Laporan Panel"}
                </>
              )}
            </button>
          )}
        </form>

        {isTourOpen && currentTourStep && (
          <div className="fixed inset-0 z-[70]" onClick={closeTour}>
            <div className="absolute inset-0 bg-slate-950/55" />
          </div>
        )}

        {/* Modal Sukses */}
        {successData && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn"
            onClick={handleCloseSuccess}
          >
            <div
              className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center animate-scaleIn text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-800">
                {(successData as any).isOfflineSaved
                  ? "Tersimpan Offline"
                  : "Laporan Berhasil Disimpan"}
              </h4>
              <p className="text-xs text-slate-500 mt-1 mb-5">
                {(successData as any)?.isCutSubmit
                  ? (successData as any)?.isOfflineSaved
                    ? `Data potong kain Potongan ${successData?.potonganKe} antre dikirim otomatis saat sinyal pulih.`
                    : `Potong kain untuk Potongan ${successData?.potonganKe} berhasil diupdate tanpa membuat baris panel baru.`
                  : (successData as any)?.isOfflineSaved
                    ? `Data Panel #${successData?.panelNo} antre dikirim otomatis saat sinyal pulih.`
                    : `Data laporan untuk Panel #${successData?.panelNo} (Potongan ${successData?.potonganKe}) telah terekam.`}
              </p>
              {(successData as any).autoAdjustedDowntimeMsg && (
                <div className="w-full mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left shadow-inner">
                  <p className="text-[11px] font-bold text-amber-700 leading-snug">
                    <AlertCircle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                    {(successData as any).autoAdjustedDowntimeMsg}
                  </p>
                </div>
              )}
              <button
                onClick={handleCloseSuccess}
                className="w-full py-3 bg-[#0070bc] text-white font-bold rounded-xl active:scale-95 transition-all text-sm"
              >
                {isEdit ? "Kembali ke Riwayat" : "Input Panel Berikutnya"}
              </button>
            </div>
          </div>
        )}

        {/* Modal Peringatan/Error */}
        {errorMsg && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn"
            onClick={() => setErrorMsg(null)}
          >
            <div
              className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center animate-scaleIn text-center relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-red-500"></div>
              <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-800">Peringatan!</h4>
              <p className="text-sm font-semibold text-slate-600 mt-2 mb-6 leading-relaxed">
                {errorMsg}
              </p>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl active:scale-95 transition-all text-sm"
              >
                Tutup & Perbaiki
              </button>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi Perubahan Jumlah PCS */}
        {pcsConfirmModal.isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center animate-scaleIn text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-sky-500"></div>
              <div className="w-14 h-14 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-800">
                {pcsConfirmModal.actionType === "increment"
                  ? "Tambah PCS?"
                  : "Hapus PCS?"}
              </h4>
              <p className="text-sm text-slate-600 mt-2 mb-6 leading-relaxed">
                {pcsConfirmModal.actionType === "increment"
                  ? `Apakah Anda yakin ingin menambah jumlah PCS menjadi ${pcsConfirmModal.targetCount} pcs?`
                  : `Apakah Anda yakin ingin mengurangi jumlah PCS menjadi ${pcsConfirmModal.targetCount} pcs? Tindakan ini akan menghapus data yang berkaitan dengan PCS di atas nomor tersebut.`}
              </p>
              <div className="flex w-full gap-3">
                <button
                  type="button"
                  onClick={() => setPcsConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl active:scale-95 transition-all text-sm"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pcsConfirmModal.actionType === "increment") {
                      for (let i = fields.length; i < pcsConfirmModal.targetCount; i++) {
                        append({
                          pcsIndex: String(i + 1),
                          jmlHasilProduksi: "1",
                        });
                      }
                    } else {
                      for (let i = fields.length - 1; i >= pcsConfirmModal.targetCount; i--) {
                        remove(i);
                      }
                    }
                    setPcsConfirmModal(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="flex-1 py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl active:scale-95 transition-all text-sm"
                >
                  Ya, Ubah
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Backup Operator */}
        {showBackupModal && (() => {
          const currentOperatorId = watchOperatorId;
          const currentOperator = operators.find((o: any) => o.id.toString() === currentOperatorId);
          const currentShift = currentOperator?.shift;
          const backupOperators = operators.filter((o: any) => o.shift === currentShift && o.id.toString() !== currentOperatorId);

          return (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
              <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl flex flex-col animate-scaleIn relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-orange-500"></div>
                <h4 className="text-lg font-bold text-slate-800 mb-2">Pilih Backup</h4>
                <p className="text-xs text-slate-500 mb-4">Siapa yang menjaga mesin ini (Backup) saat Anda beristirahat?</p>

                <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto mb-4 p-1">
                  {backupOperators.length > 0 ? backupOperators.map((op: any) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => {
                        setBackupOperatorName(op.name || op.nama_operator);
                        setShowBackupModal(false);
                      }}
                      className={`text-left px-4 py-3 rounded-xl border transition-all ${backupOperatorName === (op.name || op.nama_operator) ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold shadow-sm' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      {op.name || op.nama_operator}
                    </button>
                  )) : (
                    <p className="text-sm text-slate-500 text-center py-4">Tidak ada operator se-shift yang terdaftar.</p>
                  )}
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowBackupModal(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
                  >
                    Batal / Nanti
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Modal Custom Peringatan Jam Istirahat */}
        {breakWarningModal.isOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-scaleUp">
              {/* Banner / Header */}
              <div className="p-6 bg-gradient-to-br from-amber-500 to-orange-500 text-white text-center relative overflow-hidden flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 shadow-inner">
                  <AlertTriangle className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight uppercase">Peringatan Jam Istirahat</h3>
                <p className="text-xs text-amber-100 font-medium mt-1">
                  Pencatatan istirahat terdeteksi di luar jam wajar
                </p>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 space-y-4">
                <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500 uppercase tracking-wider">Jam Saat Ini:</span>
                    <span className="font-black font-mono text-amber-700 text-sm bg-amber-100 px-2.5 py-0.5 rounded-lg border border-amber-200">
                      {breakWarningModal.timeStr} WIB
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500 uppercase tracking-wider">Jam Istirahat Wajar {breakWarningModal.shiftName}:</span>
                    <span className="font-black text-slate-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                      {breakWarningModal.allowedRange}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 font-semibold leading-relaxed text-center">
                  Apakah Anda yakin tetap ingin memilih jenis laporan <strong>Istirahat</strong>?
                </p>

                {/* Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelBreakWarning}
                    className="w-full py-3 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wide transition-all active:scale-95 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBreakWarning}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs uppercase tracking-wide shadow-md shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
                  >
                    Ya, Lanjutkan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <ContinuousHistoryDrawer
          isOpen={isHistoryDrawerOpen}
          onClose={() => setIsHistoryDrawerOpen(false)}
          currentNomorMc={watchNomorMc}
          currentPotonganKe={watchPotonganKe}
        />
      </div>
    </div>
  );
}
