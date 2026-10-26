"use client";

import React, { useState, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { continuousFormSchema, ContinuousFormInput } from "@/lib/schemas";
import { useAuth } from "@/lib/auth-context";
import { uploadProductionPhoto } from "@/actions/employee-actions";
import {
  submitContinuousReport,
  updateContinuousReport,
  getLastMeterStartByBatch,
  getOriginalT2ATarget,
  checkOperatorHandoverStatus,
  submitOperatorHandover,
} from "@/actions/continuous-actions";
import { getProductionPlan, getLatestMachineHeader } from "@/actions/plan-actions";
import { getMachineConfigs } from "@/actions/machine-config-actions";
import { getOperatorsList } from "@/actions/operator-actions";
import { createClient } from "@/lib/supabase/client";
import { getJakartaDateTimeString } from "@/lib/shift-utils";
import { triggerPiggybackSync } from "@/lib/offline-store";
import ProductTour, { ProductTourStep } from "@/components/ProductTour";
import { useInputTheme } from "@/lib/input-theme-context";
import { cn } from "@/lib/utils";

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
  History,
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
  ArrowRightLeft,
  Send,
  Scissors,
  AlertTriangle,
  Info,
  Lock,
  PowerOff,
  TrendingUp,
  Calculator,
} from "lucide-react";
import { useRouter } from "next/navigation";
import HeaderSummaryCard from "./HeaderSummaryCard";
import dynamic from "next/dynamic";
import WifiDowntimeTrigger from "./WifiDowntimeTrigger";

// Dynamic imports: code-split heavy components to reduce initial JS bundle
const ProductionHeaderModal = dynamic(() => import("./ProductionHeaderModal"), {
  ssr: false,
});
const MachineStopModal = dynamic(() => import("./MachineStopModal"), {
  ssr: false,
});
import DowntimeTracker from "./DowntimeTracker";
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

const METER_TOUR_STEPS: ProductTourStep[] = [
  {
    target: "meter-mode-switch",
    badge: "JENIS INPUT",
    title: "Pilihan Mode Input Meteran",
    description:
      "Mode ini dikhususkan untuk mesin kain kontinu / meteran (seperti mesin R11, R12, T2A, dsb).",
    tips: [
      "Pencatatan produksi dihitung berdasarkan panjang meter kain (bukan lembar panel).",
      "Pindah ke tab PANEL jika Anda mencatat mesin dengan inputan per nomor panel.",
    ],
  },
  {
    target: "meter-stop-machine",
    badge: "STATUS KHUSUS",
    title: "Lapor Mesin Mati / Berhenti Total",
    description:
      "Gunakan tombol ini jika mesin berhenti beroperasi sepanjang shift tanpa menghasilkan meter kain.",
    tips: [
      "Mencegah mesin dianggap mangkir pada KPI dan Laporan Bulanan.",
      "Status berhenti langsung tercatat tanpa perlu mengisi meteran kain.",
    ],
  },
  {
    target: "meter-potongan-history",
    badge: "RIWAYAT CEPAT",
    title: "Riwayat Meteran Potongan Ini",
    description:
      "Buka laci riwayat cepat untuk memantau data meteran dan titik cacat yang sudah direkam pada potongan aktif.",
    tips: [
      "Melihat daftar titik cacat, downtime, dan status laporan meteran.",
      "Memastikan inputan sebelumnya sudah terekam dengan baik.",
    ],
  },
  {
    target: "meter-header-summary",
    badge: "PARAMETER UTAMA",
    title: "Ringkasan Header Mesin Meteran",
    description:
      "Menampilkan parameter mesin aktif: Operator, Shift, Nomor Mesin, Desain, Target Meter, dan Potongan Ke.",
    tips: [
      "Klik kartu ini atau tombol 'Ubah Header' untuk memperbarui parameter produksi.",
      "Data header otomatis tersimpan dan digunakan untuk pelaporan berkelanjutan.",
    ],
  },
  {
    target: "meter-final-report",
    badge: "LAPORAN AKHIR",
    title: "Laporan Meteran Akhir",
    description:
      "Gunakan tombol ini untuk membuka formulir pelaporan meteran: mengisi Meter Awal, Meter Akhir, dan Total Produksi Meter.",
    tips: [
      "Diisi saat shift selesai atau saat kain telah dipotong/selesai satu roll.",
      "Hasil produksi meter bersih otomatis dihitung dari selisih meter akhir dan meter awal.",
    ],
  },
  {
    target: "block-mesin",
    badge: "PERBAIKAN BERAT",
    title: "Fitur Block Mesin (Multi-Shift)",
    description:
      "Gunakan fitur Block Mesin jika mesin meteran mengalami kerusakan mekanik lama atau stop melintasi pergantian shift.",
    tips: [
      "Tekan tombol 'BLOCK MESIN' untuk mengunci status mesin dan menghitung total lama perbaikan.",
      "Tersedia fitur 'Catatan Shift' untuk serah terima ke operator shift berikutnya.",
      "Tekan tombol 'BUKA BLOCK' ketika perbaikan selesai dan mesin siap dijalankan kembali.",
    ],
  },
  {
    target: "downtime-timer",
    badge: "TIMER DOWNTIME",
    title: "Timer Downtime & Titik Meter Cacat",
    description:
      "Catat waktu henti (downtime) dan titik meter saat mesin berhenti sementara karena kendala operasional atau benang putus.",
    tips: [
      "Tekan 'MULAI MANUAL' (atau otomatis jika terhubung IoT) saat mesin berhenti.",
      "Ketik posisi meter kain saat kendala ditemukan pada kolom Meter Kain.",
      "Pilih kategori masalah (Kode A - G) lalu tekan 'STOP' saat mesin berjalan normal kembali.",
    ],
  },
  {
    target: "meter-cut-roll",
    badge: "POTONG ROLL",
    title: "Tandai Potong Kain / Roll",
    description:
      "Centang opsi ini jika roll kain sudah selesai dan dipotong pada shift ini.",
    tips: [
      "Menandai penutupan roll pada nomor potongan saat ini.",
      "Tanggal potong otomatis terisi sesuai tanggal hari ini.",
    ],
  },
  {
    target: "meter-submit-defect",
    badge: "KIRIM DATA",
    title: "Kirim Titik Cacat / Laporan",
    description:
      "Kirim laporan titik cacat atau simpan hasil meteran kain setelah data terisi lengkap.",
    tips: [
      "Tombol ini menyimpan titik cacat ke database produksi.",
      "Mendukung mode offline jika jaringan internet terputus.",
    ],
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

type ContinuousFormProps = {
  isEdit?: boolean;
  initialData?: any;
  defaultMeter?: string;
  defaultPcsIndex?: string;
};

function parseFormMeterValue(value: string | null | undefined): number | null {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  const num = parseFloat(String(value));
  return Number.isFinite(num) ? num : null;
}

function getJakartaDateString() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function ContinuousForm({
  initialData,
  isEdit,
  defaultMeter,
  defaultPcsIndex,
}: ContinuousFormProps = {}) {
  const { user } = useAuth();
  const { isDark } = useInputTheme();
  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingSubmit, setIsProcessingSubmit] = useState(false);
  const pendingDowntimeEventsRef = useRef<any[]>([]);
  const [successData, setSuccessData] = useState<
    (ContinuousFormInput & { id?: string }) | null
  >(null);
  const [successAutoCloseSeconds, setSuccessAutoCloseSeconds] = useState<number>(3);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [backupOperator, setBackupOperator] = useState("");
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);

  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const { getAllPendingPayloads } = await import("@/lib/offline-store");
        const items = await getAllPendingPayloads();
        setPendingOfflineCount(items.length);
      } catch (e) {}
    };

    updatePendingCount();
    window.addEventListener("dji_offline_queue_changed", updatePendingCount);
    window.addEventListener("dji_trigger_sync", updatePendingCount);
    return () => {
      window.removeEventListener("dji_offline_queue_changed", updatePendingCount);
      window.removeEventListener("dji_trigger_sync", updatePendingCount);
    };
  }, []);

  const router = useRouter();

  // States untuk dynamic dropdown dari Supabase
  const [operators, setOperators] = useState(FALLBACK_OPERATORS);
  const [designs, setDesigns] = useState(FALLBACK_DESIGNS);
  const [groups, setGroups] = useState(FALLBACK_GROUPS);

  // Accordion UI State
  const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);
  const [highlightPotonganKe, setHighlightPotonganKe] = useState(false);
  const [highlightOperator, setHighlightOperator] = useState(false);

  // Pop-up Modal State
  const [isMeterModalOpen, setIsMeterModalOpen] = useState(false);
  const [isLoadingMeterStart, setIsLoadingMeterStart] = useState(false);
  const [isLastRoll, setIsLastRoll] = useState(false);
  const [showAdvancedActions, setShowAdvancedActions] = useState(false);
  const [activeInfo, setActiveInfo] = useState<string | null>(null);
  const [showReportCardInfo, setShowReportCardInfo] = useState(false);

  // Timer Controls State untuk menghubungkan WifiDowntimeTrigger dengan DowntimeTracker
  const [timerControls, setTimerControls] = useState<{
    isTimerRunning: boolean;
    onStartTimer: (source?: any) => void;
    onStopTimer: (source?: any) => void;
  } | null>(null);

  const handleCancelAdvancedActions = () => {
    setIsLastRoll(false);
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
    async function loadMachineTypes() {
      const cfgRes = await getMachineConfigs();
      if (cfgRes.success && cfgRes.data) {
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
    }
    loadMachineTypes();
  }, []);

  useEffect(() => {
    async function loadOperators() {
      const res = await getOperatorsList();
      if (res.success && res.data && res.data.length > 0) {
        setOperators(
          res.data.map((op) => ({
            id: op.id,
            name: op.nama_operator,
            shift: op.shift,
          }))
        );
      }
    }
    loadOperators();
  }, []);

  useEffect(() => {
    const startMeterTour = () => {
      if (isEdit) return;
      setIsMeterModalOpen(false);
      setIsTourOpen(true);
    };

    window.addEventListener("dji:start-meter-tour", startMeterTour);
    return () =>
      window.removeEventListener("dji:start-meter-tour", startMeterTour);
  }, [isEdit]);

  // States untuk upload foto
  const [isUploading, setIsUploading] = useState<{
    before: boolean;
    after: boolean;
  }>({ before: false, after: false });
  const [previews, setPreviews] = useState<{
    before: string | null;
    after: string | null;
  }>({ before: null, after: null });
  const [isMeterAwalLocked, setIsMeterAwalLocked] = useState(true);
  const [handoverWarning, setHandoverWarning] = useState<{
    needsMeterAwal: boolean;
    lastOperator: string | null;
    lastMeter: number;
    opStartMeter?: number;
  } | null>(null);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [handoverInputMeter, setHandoverInputMeter] = useState<string>("");
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);
  const [handoverModalError, setHandoverModalError] = useState<string | null>(null);
  const prevOperatorRef = useRef<string>("");
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [stopModalSuccessMsg, setStopModalSuccessMsg] = useState<string | null>(null);
  const [originalT2ATarget, setOriginalT2ATarget] = useState<number | null>(
    null,
  );

  // Timer State for Downtime
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStartRef, setTimerStartRef] = useState<number | null>(null);
  const [timerStopRef, setTimerStopRef] = useState<number | null>(null);
  const [firstProblemTime, setFirstProblemTime] = useState<number | null>(null);
  const [liveTimerSeconds, setLiveTimerSeconds] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timerStartRef) {
      interval = setInterval(() => {
        const elapsedMs = Date.now() - timerStartRef;
        setLiveTimerSeconds(Math.floor(elapsedMs / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerStartRef]);

  const handleStartTimer = () => {
    setIsTimerRunning(true);
    const now = Date.now();
    setTimerStartRef(now);
    if (!firstProblemTime) {
      setFirstProblemTime(now);
    }
    setLiveTimerSeconds(0);
  };

  const handleStopTimer = () => {
    if (!isTimerRunning) return;
    setIsTimerRunning(false);

    const now = Date.now();

    // Calculate elapsed seconds
    const elapsedMs = now - (timerStartRef || now);
    const elapsedSecs = Math.ceil(elapsedMs / 1000);

    const currentTotalStr = watch("totalDowntime");
    const currentTotal = parseInt(currentTotalStr || "0") || 0;

    const newTotal = currentTotal + elapsedSecs;
    setValue("totalDowntime", String(newTotal), {
      shouldValidate: true,
      shouldDirty: true,
    });

    setTimerStartRef(null);
    setTimerStopRef(now);
    setLiveTimerSeconds(0);
  };

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Hubungkan ke Supabase secara dinamis
  useEffect(() => {
    async function loadDbData() {
      try {
        const supabase = createClient();
        if (
          !process.env.NEXT_PUBLIC_SUPABASE_URL ||
          process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
        ) {
          return;
        }

        const { data: opData } = await supabase
          .from("operators")
          .select("id, nama_operator");
        if (opData && opData.length > 0) {
          // KITA GUNAKAN FALLBACK DULU KARENA MINTA SESUAI GAMBAR BARU (SHIFT A,B,C)
          // setOperators(opData.map((o: any) => ({ id: o.id, name: o.nama_operator })));
        }

        const { data: dsData } = await supabase
          .from("designs")
          .select("id, nama_design");
        if (dsData && dsData.length > 0) {
          setDesigns(
            dsData.map((d: any) => ({ id: d.id, name: d.nama_design })),
          );
        }

        const { data: gpData } = await supabase
          .from("groups")
          .select("id, nama_grup");
        if (gpData && gpData.length > 0) {
          setGroups(gpData.map((g: any) => ({ id: g.id, name: g.nama_grup })));
        }
      } catch (err) {
        console.warn(
          "Koneksi Supabase real gagal atau belum disemai, menggunakan data fallback dari Excel.",
          err,
        );
      }
    }
    loadDbData();
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<ContinuousFormInput>({
    mode: "onBlur",
    resolver: zodResolver(continuousFormSchema),
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
      totalDowntime: "",
      meterAwal: "",
      meterAkhir: "",
      hasilProduksiMeter: "",
      targetMeter: "",
      pcsData: [
        {
          pcsIndex: "1",
          jmlHasilProduksi: "0",
          meterKain: "",
          rollNo: "",
        },
      ],
    },
  });

  useEffect(() => {
    if (initialData && isEdit) {
      let isLaporanIstirahat = false;
      let isSebelumIstirahat = false;

      if (initialData.details && initialData.details.length > 0) {
        isLaporanIstirahat = initialData.details.some((d: any) =>
          (d.keterangan_cacat || "").toUpperCase().includes("[LAPORAN ISTIRAHAT]")
        );
        isSebelumIstirahat = initialData.details.some((d: any) =>
          (d.keterangan_cacat || "").toUpperCase().includes("[SEBELUM ISTIRAHAT]")
        );
      }

      let jenisLaporanVal = "";
      if (isLaporanIstirahat) jenisLaporanVal = "Selesai Istirahat";
      else if (isSebelumIstirahat) jenisLaporanVal = "Mulai Istirahat";

      const isMeterAkhirEdit = defaultMeter && (
        String(initialData.meter_akhir) === String(defaultMeter) ||
        String(initialData.meter_awal) === String(defaultMeter)
      );
      const hasMeterAkhirOnly = initialData.meter_akhir !== null && initialData.meter_akhir !== undefined && (!initialData.details || initialData.details.length === 0 || isLaporanIstirahat || isSebelumIstirahat);

      if (isMeterAkhirEdit || isLaporanIstirahat || isSebelumIstirahat || hasMeterAkhirOnly) {
        setIsMeterModalOpen(true);
      }

      let parsedDowntimeEvents: any[] = [];
      try {
        if (initialData.downtime_events) {
          parsedDowntimeEvents = typeof initialData.downtime_events === 'string'
            ? JSON.parse(initialData.downtime_events)
            : initialData.downtime_events;
        } else if (initialData.details && initialData.details.some((d: any) => d.kategori_masalah && d.kategori_masalah !== "X")) {
          // Reconstruct downtimeEvents from legacy details to prevent data loss
          const legacyEvents: any[] = [];
          initialData.details.forEach((d: any) => {
            if (d.kategori_masalah && d.kategori_masalah !== "X") {
              const kats = d.kategori_masalah.split(",").map((s: string) => s.trim());
              const dets = d.detail_masalah ? d.detail_masalah.split(",").map((s: string) => s.trim()) : [];
              const bloks = d.keterangan_cacat ? d.keterangan_cacat.replace(/\[SEBELUM ISTIRAHAT\]|\[LAPORAN ISTIRAHAT\]/g, "").split(",").map((s: string) => s.trim()) : [];

              const problems = kats.map((k: string, i: number) => {
                let det = dets[i] || "";
                let blok = bloks[i] || "";
                blok = blok.replace(/Blok\s*/i, "").trim();
                let meter = "";
                // Extract meter from detail if present
                const meterMatch = det.match(/\(Titik:\s*([^)]+)m\)/);
                if (meterMatch) {
                  meter = meterMatch[1];
                  det = det.replace(/\(Titik:\s*[^)]+m\)/, "").trim();
                }

                // Coba cocokan dengan pattern defect jika mungkin, karena det bisa saja bukan exact match dengan detailMasalahSelection
                const allPossibleDetails = NEW_PROBLEMS[k] || [];
                const matchedDetails: string[] = [];
                allPossibleDetails.forEach((possible: string) => {
                  if (det.includes(possible)) {
                    matchedDetails.push(possible);
                    det = det.replace(possible, "").replace(/^[\s,-]+|[\s,-]+$/g, "");
                  }
                });

                // Combine matched details and any leftover string as specific issue
                const finalDetails = matchedDetails.length > 0 ? matchedDetails : (det ? [det] : []);

                return {
                  kategori: k,
                  details: finalDetails,
                  blok: blok || undefined,
                  meter: meter || undefined,
                };
              });

              legacyEvents.push({
                id: Math.random().toString(36).substring(2, 9),
                durasiDetik: legacyEvents.length === 0 && initialData.total_downtime_detik ? parseInt(initialData.total_downtime_detik) : 0,
                pcsKe: d.pcs_index ? d.pcs_index.toString() : "1",
                problems
              });
            }
          });
          parsedDowntimeEvents = legacyEvents;
        }
      } catch (e) {
        console.error("Error parsing downtime_events", e);
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
        totalDowntime: parsedDowntimeEvents.length > 0
          ? String(parsedDowntimeEvents.reduce((acc: number, curr: any) => acc + (curr.durasiDetik || 0), 0))
          : "0",
        meterAwal: String(initialData.meter_awal || ""),
        meterAkhir: String(initialData.meter_akhir || ""),
        hasilProduksiMeter: String(initialData.total_produksi_meter || ""),
        targetMeter: initialData.target_meter
          ? String(initialData.target_meter)
          : "",
        jenisLaporan: jenisLaporanVal,
        downtimeEvents: parsedDowntimeEvents,
        pcsData: (() => {
          if (!initialData.details || initialData.details.length === 0) {
            const count = initialData.pcs ? parseInt(initialData.pcs) : 1;
            return Array.from({ length: count }, (_, i) => ({
              pcsIndex: String(i + 1),
              jmlHasilProduksi: "0",
              meterKain: "",
              rollNo: "",
            }));
          }
          const headerPcs = initialData.pcs ? parseInt(initialData.pcs) : 1;
          const detailMaxPcs = Math.max(...initialData.details.map((d: any) => d.pcs_index ? parseInt(d.pcs_index) : 1));
          const totalPcs = Math.max(headerPcs, detailMaxPcs);

          const list = [];
          for (let i = 1; i <= totalPcs; i++) {
            const key = i.toString();
            const d = initialData.details.find((x: any) => String(x.pcs_index || "1") === key);
            if (d) {
              list.push({
                pcsIndex: key,
                jmlHasilProduksi: "0",
                meterKain: d.meter_kain || "",
                rollNo: d.roll_no || "",
                isBs: d.kategori_masalah === "X" || Boolean(d.kategori_masalah && d.kategori_masalah.includes("BS"))
              });
            } else {
              list.push({
                pcsIndex: key,
                jmlHasilProduksi: "0",
                meterKain: "",
                rollNo: "",
                isBs: false
              });
            }
          }
          return list;
        })()
      });
    }
  }, [initialData, isEdit, reset, defaultMeter]);

  const watchGroupId = watch("groupId");
  const watchJenisLaporan = watch("jenisLaporan") || "";
  const selectedGroup = groups.find((g) => g.id.toString() === watchGroupId);
  const activeShiftName = selectedGroup ? selectedGroup.name : "A";

  const activeOperators = React.useMemo(() => {
    return operators.filter((op: any) => op.shift === activeShiftName || !op.shift);
  }, [operators, activeShiftName]);

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
    const validCount = Math.max(1, Math.min(100, Math.floor(Number(targetCount) || 1)));
    if (validCount > fields.length) {
      // Append directly without confirmation for increasing
      for (let i = fields.length; i < validCount; i++) {
        append({
          pcsIndex: String(i + 1),
          jmlHasilProduksi: "1",
          meterKain: "",
        });
      }
    } else if (validCount < fields.length) {
      if (forceDirect) {
        const countToRemove = fields.length - validCount;
        for (let i = 0; i < countToRemove; i++) {
          if (fields.length - 1 - i >= 0) {
            remove(fields.length - 1 - i);
          }
        }
      } else {
        // Show confirmation dialog before reducing PCS count since it deletes data
        setPcsConfirmModal({
          isOpen: true,
          targetCount: validCount,
          actionType: "decrement",
        });
      }
    }
  };

  // Auto calculate total hasil produksi meter
  const watchMeterAwal = watch("meterAwal");
  const watchMeterAkhir = watch("meterAkhir");
  const watchNomorMc = watch("nomorMc");
  const watchPotonganKe = watch("potonganKe");

  const prevNomorMcRef = useRef<string>("");
  // Standalone effect to sync Machine Config (Default PCS & Input Type) as soon as machine selection changes
  useEffect(() => {
    if (isEdit || !watchNomorMc) return;

    let isMounted = true;
    async function syncMachineConfig() {
      const cfgRes = await getMachineConfigs();
      if (!isMounted || !cfgRes.success || !cfgRes.data) return;

      const currentMc = watchNomorMc.trim().toUpperCase();
      const match = cfgRes.data.find(
        (c) => c.nomor_mc.trim().toUpperCase() === currentMc
      );

      if (match) {
        if (prevNomorMcRef.current !== currentMc) {
          prevNomorMcRef.current = currentMc;
          if (match.default_pcs && typeof match.default_pcs === "number") {
            handleChangePcsCount(match.default_pcs, true);
          }
        }
        if (match.input_type) {
          setMachineInputTypes((prev) => ({
            ...prev,
            [currentMc]: match.input_type === "METER" ? "METER" : "PANEL",
          }));
        }
      }
    }

    syncMachineConfig();
    return () => {
      isMounted = false;
    };
  }, [watchNomorMc, isEdit]);

  useEffect(() => {
    if (watchMeterAkhir && watchMeterAkhir.trim() !== "") {
      const awal = parseFloat(watchMeterAwal || "0") || 0;
      const akhir = parseFloat(watchMeterAkhir) || 0;
      if (!isNaN(awal) && !isNaN(akhir)) {
        if (watchNomorMc === "T2A") {
          setValue("hasilProduksiMeter", String(Math.max(awal - akhir, 0)));
        } else {
          setValue("hasilProduksiMeter", String(Math.max(akhir - awal, 0)));
        }
      }
    } else {
      setValue("hasilProduksiMeter", "");
    }
  }, [watchMeterAwal, watchMeterAkhir, watchNomorMc, setValue]);


  useEffect(() => {
    const currentOperatorId = watch("operatorId");
    const currentOp = operators.find((o) => o.id.toString() === currentOperatorId);
    const shiftToUse = currentOp?.shift || activeShiftName;

    if (watchJenisLaporan === "Selesai Istirahat") {
      refreshAutomaticMeterStart();
      setBackupOperator((prev) => {
        const isPrevValid = Boolean(prev && operators.some((o) => o.shift === shiftToUse && o.name === prev && o.id.toString() !== currentOperatorId));
        if (isPrevValid) return prev;

        const saved = typeof window !== "undefined" ? localStorage.getItem(`dji_last_backup_operator_${shiftToUse}`) : null;
        const isSavedValid = Boolean(saved && operators.some((o) => o.shift === shiftToUse && o.name === saved && o.id.toString() !== currentOperatorId));
        return isSavedValid && saved ? saved : "";
      });
    } else if (watchJenisLaporan === "Mulai Istirahat") {
      setBackupOperator((prev) => {
        const isPrevValid = Boolean(prev && operators.some((o) => o.shift === shiftToUse && o.name === prev && o.id.toString() !== currentOperatorId));
        if (isPrevValid) return prev;

        const saved = typeof window !== "undefined" ? localStorage.getItem(`dji_last_backup_operator_${shiftToUse}`) : null;
        const isSavedValid = Boolean(saved && operators.some((o) => o.shift === shiftToUse && o.name === saved && o.id.toString() !== currentOperatorId));
        return isSavedValid && saved ? saved : "";
      });
    }
  }, [watchJenisLaporan, activeShiftName, watch("operatorId"), operators]);

  // Validasi keamanan: Jika backupOperator di state tidak sesuai dengan shift yang aktif, reset otomatis
  useEffect(() => {
    if (!backupOperator) return;
    const currentOperatorId = watch("operatorId");
    const currentOp = operators.find((o) => o.id.toString() === currentOperatorId);
    const shiftToUse = currentOp?.shift || activeShiftName;
    const isValid = operators.some((o) => o.shift === shiftToUse && o.name === backupOperator && o.id.toString() !== currentOperatorId);
    if (!isValid) {
      setBackupOperator("");
      try {
        localStorage.removeItem(`dji_last_backup_operator_${shiftToUse}`);
        localStorage.removeItem("dji_last_backup_operator");
      } catch {}
    }
  }, [activeShiftName, watch("operatorId"), operators, backupOperator]);

  useEffect(() => {
    if (isMeterModalOpen) {
      refreshAutomaticMeterStart();
    }
  }, [isMeterModalOpen]);

  const refreshAutomaticMeterStart = async () => {
    if (isEdit) return;

    const nomorMc = getValues("nomorMc");
    const potonganKe = getValues("potonganKe");
    if (!nomorMc || !potonganKe) {
      setValue("meterAwal", "");
      return;
    }

    const result = await getLastMeterStartByBatch({
      nomorMc,
      potonganKe,
    });

    const nextMeterStart = result.success
      ? String(result.meterStart ?? 0)
      : "0";

    const nextMeterStartNum = result.success ? (result.meterStart ?? 0) : 0;
    const nomorMcStr = getValues("nomorMc");

    if (nomorMcStr === "T2A") {
      if (nextMeterStartNum > 0) {
        // Continuing same roll from previous shift — lock with previous remaining
        setValue("meterAwal", String(nextMeterStartNum), {
          shouldDirty: false,
          shouldValidate: Boolean(getValues("meterAkhir")),
        });
        setIsMeterAwalLocked(true);
        // Fetch original target for display
        getOriginalT2ATarget({
          nomorMc: nomorMcStr,
          potonganKe: getValues("potonganKe"),
        }).then((res) => {
          if (res.success && res.originalTarget)
            setOriginalT2ATarget(res.originalTarget);
        });
      } else {
        // New roll or after cut — let user type target
        setIsMeterAwalLocked(false);
        setOriginalT2ATarget(null);
      }
    } else {
      const currentOpName = getOperatorName(getValues("operatorId"));
      const handoverRes = await checkOperatorHandoverStatus({
        nomorMc,
        potonganKe,
        currentOperator: currentOpName,
      });

      if (handoverRes.success && handoverRes.needsMeterAwalInput) {
        setHandoverWarning({
          needsMeterAwal: true,
          lastOperator: handoverRes.lastOperatorName,
          lastMeter: handoverRes.lastRecordedMeter,
          opStartMeter: handoverRes.opStartMeter,
        });
        setIsMeterAwalLocked(true);
        if (!getValues("meterAwal") && handoverRes.lastRecordedMeter > 0) {
          setValue("meterAwal", String(handoverRes.lastRecordedMeter), {
            shouldDirty: false,
            shouldValidate: Boolean(getValues("meterAkhir")),
          });
        }
      } else {
        setHandoverWarning(null);
        setValue("meterAwal", nextMeterStart, {
          shouldDirty: false,
          shouldValidate: Boolean(getValues("meterAkhir")),
        });
        setIsMeterAwalLocked(true);
      }
    }
  };

  useEffect(() => {
    if (isEdit) return;

    if (!watchNomorMc || !watchPotonganKe || isNaN(parseInt(watchPotonganKe))) {
      return;
    }

    let isActive = true;
    const timeoutId = setTimeout(async () => {
      if (!isActive) return;

      // Skip logic for T2A if it's a new roll, handled below

      const result = await getLastMeterStartByBatch({
        nomorMc: watchNomorMc,
        potonganKe: watchPotonganKe,
      });

      if (!isActive) return;
      const nextMeterStartNum = result.success ? (result.meterStart ?? 0) : 0;
      const nextMeterStartStr = String(nextMeterStartNum);

      if (watchNomorMc === "T2A") {
        if (nextMeterStartNum > 0) {
          setValue("meterAwal", nextMeterStartStr, {
            shouldDirty: false,
            shouldValidate: Boolean(watchMeterAkhir),
          });
          setIsMeterAwalLocked(true);
          // Fetch original target for display
          getOriginalT2ATarget({
            nomorMc: watchNomorMc,
            potonganKe: watchPotonganKe,
          }).then((res) => {
            if (isActive && res.success && res.originalTarget)
              setOriginalT2ATarget(res.originalTarget);
          });
        } else {
          setIsMeterAwalLocked(false);
          setOriginalT2ATarget(null);
          // If the user hasn't typed anything yet, ensure it's empty
          if (!watchMeterAwal) {
            setValue("meterAwal", "", { shouldDirty: false });
          }
        }
      } else {
        const currentOpName = getOperatorName(getValues("operatorId"));
        const handoverRes = await checkOperatorHandoverStatus({
          nomorMc: watchNomorMc,
          potonganKe: watchPotonganKe,
          currentOperator: currentOpName,
        });

        if (handoverRes.success && handoverRes.needsMeterAwalInput) {
          setHandoverWarning({
            needsMeterAwal: true,
            lastOperator: handoverRes.lastOperatorName,
            lastMeter: handoverRes.lastRecordedMeter,
            opStartMeter: handoverRes.opStartMeter,
          });
          setIsMeterAwalLocked(true);

          const currentOpId = watch("operatorId");
          if (currentOpId && (!prevOperatorRef.current || currentOpId !== prevOperatorRef.current)) {
            setHandoverInputMeter(handoverRes.lastRecordedMeter > 0 ? String(handoverRes.lastRecordedMeter) : "");
            setHandoverModalError(null);
            setIsHandoverModalOpen(true);
          }
          prevOperatorRef.current = currentOpId || "";

          if (!getValues("meterAwal") && handoverRes.lastRecordedMeter > 0) {
            setValue("meterAwal", String(handoverRes.lastRecordedMeter), {
              shouldDirty: false,
              shouldValidate: Boolean(watchMeterAkhir),
            });
          }
        } else {
          setHandoverWarning(null);
          setValue("meterAwal", nextMeterStartStr, {
            shouldDirty: false,
            shouldValidate: Boolean(watchMeterAkhir),
          });
          setIsMeterAwalLocked(true);
          prevOperatorRef.current = watch("operatorId") || "";
        }
      }

      // Fetch Production Plan (Admin)
      const planRes = await getProductionPlan(watchNomorMc, parseInt(watchPotonganKe));
      if (isActive && planRes.success && planRes.data) {
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
        if (plan.pcs_count && typeof plan.pcs_count === "number") {
          handleChangePcsCount(plan.pcs_count, true);
        }
        if (plan.max_panel || plan.target_meter) {
          setValue("targetMeter", String(plan.max_panel || plan.target_meter));
        }
      }
    }, 600); // Add 600ms delay mirip getLastPanelNoByPotongan

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [isEdit, watchMeterAkhir, watchNomorMc, watchPotonganKe, watchJenisLaporan, watch("operatorId"), setValue]);

  // Load Draft or Header Data dari LocalStorage
  useEffect(() => {
    if (isEdit) return;

    const savedDraft = localStorage.getItem("dji_form_draft_continuous");
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
          if (
            key !== "lastRollNo" &&
            key !== "pcsCount" &&
            key !== "tanggalPotong" &&
            key !== "meterAwal"
          ) {
            setValue(key as keyof ContinuousFormInput, parsed[key], {
              shouldValidate: false,
              shouldDirty: false,
            });
          }
        });
        setValue("tanggalPotong", "", { shouldValidate: false, shouldDirty: false });
        setIsHeaderModalOpen(false);
      } catch (e) {
        console.error("Gagal load header dari storage", e);
      }
    }
  }, [setValue, isEdit, reset]);

  // Subscribe to all form changes to save draft
  useEffect(() => {
    if (isEdit) return;
    const subscription = watch((value) => {
      localStorage.setItem("dji_form_draft_continuous", JSON.stringify(value));
    });
    return () => subscription.unsubscribe();
  }, [watch, isEdit]);

  // Handler untuk mengecek dan memicu modal serah terima shift secara instan saat operator diganti
  const checkAndPromptHandover = async (customOpId?: string) => {
    const opId = customOpId ?? getValues("operatorId");
    const opName = getOperatorName(opId);
    const mc = getValues("nomorMc");
    const pot = getValues("potonganKe");

    if (!mc || !pot || !opName) return;

    try {
      const handoverRes = await checkOperatorHandoverStatus({
        nomorMc: mc,
        potonganKe: pot,
        currentOperator: opName,
      });

      if (handoverRes.success && handoverRes.needsMeterAwalInput) {
        setHandoverWarning({
          needsMeterAwal: true,
          lastOperator: handoverRes.lastOperatorName,
          lastMeter: handoverRes.lastRecordedMeter,
          opStartMeter: handoverRes.opStartMeter,
        });
        setHandoverInputMeter(handoverRes.lastRecordedMeter > 0 ? String(handoverRes.lastRecordedMeter) : "");
        setHandoverModalError(null);
        setIsHandoverModalOpen(true);
      } else {
        setHandoverWarning(null);
      }
    } catch (err) {
      console.error("Gagal memeriksa status serah terima operator:", err);
    }
  };

  const handleConfirmHandover = async () => {
    if (!handoverInputMeter || handoverInputMeter.trim() === "") {
      setHandoverModalError("Counter meter serah terima wajib diisi!");
      return;
    }

    const meterNum = parseFloat(handoverInputMeter);
    if (isNaN(meterNum) || meterNum < 0) {
      setHandoverModalError("Counter meter harus berupa angka yang valid!");
      return;
    }

    const lastMeter = handoverWarning?.lastMeter || 0;
    if (meterNum < lastMeter) {
      setHandoverModalError(`Counter meter tidak boleh lebih kecil dari ${lastMeter}m (meter tercatat sebelumnya).`);
      return;
    }

    const currentOpName = getOperatorName(getValues("operatorId"));
    const mc = getValues("nomorMc");
    const pot = getValues("potonganKe");

    try {
      setIsSubmittingHandover(true);
      setHandoverModalError(null);

      const res = await submitOperatorHandover({
        nomorMc: mc,
        potonganKe: pot,
        incomingOperator: currentOpName,
        handoverMeter: meterNum,
      });

      if (res.success) {
        setValue("meterAwal", String(res.handoverMeter), {
          shouldDirty: false,
          shouldValidate: Boolean(getValues("meterAkhir")),
        });
        setIsMeterAwalLocked(true);
        setHandoverWarning(null);
        setIsHandoverModalOpen(false);
      } else {
        setHandoverModalError(res.message || "Gagal melakukan serah terima shift.");
      }
    } catch (err: any) {
      console.error("Gagal serah terima shift:", err);
      setHandoverModalError(err?.message || "Terjadi kesalahan saat memproses serah terima shift.");
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  // Handler for form validation failures — extracts readable error messages
  const onInvalid = (fieldErrors: any) => {
    // Extract the first error message from nested errors
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
          const msg = extractMessage(obj[key]);
          if (msg) return msg;
        }
      }
      return null;
    };

    const msg = extractMessage(fieldErrors);
    setIsProcessingSubmit(false);
    setErrorMsg(msg || "Terdapat kesalahan validasi. Silakan periksa form.");
  };

  const onSubmit = async (data: ContinuousFormInput) => {
    setIsProcessingSubmit(true);
    const currentMc = data.nomorMc || getValues("nomorMc") || watch("nomorMc") || "";
    if (currentMc && machineInputTypes[currentMc.toUpperCase()] === "PANEL") {
      setIsSubmitting(false);
      setIsProcessingSubmit(false);
      setErrorMsg(`Mesin ${currentMc} telah dikunci oleh Admin khusus untuk input PANEL. Anda tidak dapat mengisi form Meter untuk mesin ini.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    const uppercaseFields: (keyof ContinuousFormInput)[] = ["designId", "pick", "course", "noOrderBarang", "noCustomer", "jenisBenangDasar", "liner", "heavy", "shadow", "pinggiran", "rpm"];
    uppercaseFields.forEach(field => {
      if (typeof data[field] === "string") {
        (data as any)[field] = (data[field] as string).toUpperCase();
      }
    });

    let adjustedMsg = "";
    if (timerStopRef && firstProblemTime) {
      const now = Date.now();
      const gapSeconds = (now - timerStopRef) / 1000;
      if (gapSeconds > 20) {
        const actualDowntime = Math.ceil((now - firstProblemTime) / 1000);
        const oldDowntime = data.totalDowntime || "0";
        data.totalDowntime = String(actualDowntime);
        setValue("totalDowntime", String(actualDowntime), {
          shouldValidate: true,
          shouldDirty: true,
        });
        adjustedMsg = `Waktu downtime otomatis disesuaikan dari ${oldDowntime} detik menjadi ${actualDowntime} detik karena jeda pengiriman form lebih dari 20 detik.`;
      }
    }

    // Gunakan idempotency key dari ref yang stabil
    data.idempotencyKey = idempotencyKeyRef.current;

    // Catat waktu asli submit (WIB) dari perangkat operator saat tombol ditekan
    if (!data.submittedAt) {
      data.submittedAt = getJakartaDateTimeString();
    }

    // Filter dan pisahkan event yang sudah selesai (resolved) vs antrean pending
    const allDowntime = data.downtimeEvents || [];
    const resolvedDowntime = allDowntime.filter(
      (evt: any) => evt.isResolved !== false && (evt.isResolved || (evt.problems && evt.problems.length > 0))
    );
    const unclassifiedDowntime = allDowntime.filter(
      (evt: any) => evt.isResolved === false || (!evt.isResolved && (!evt.problems || evt.problems.length === 0))
    );

    pendingDowntimeEventsRef.current = unclassifiedDowntime;
    data.downtimeEvents = resolvedDowntime;

    // Otomatis set isPanelGagal jika ada PCS yang BS
    if (data.pcsData?.some((p) => p.isBs)) {
      data.isPanelGagal = true;
    }

    // Ambil nama operator asli
    data.pic = getOperatorName(data.operatorId) || "";
    data.grupName = getGroupName(data.groupId);
    data.designName = getDesignName(data.designId);
    data.created_by_name = user?.fullName || null;

    const meterAkhirNum = parseFormMeterValue(data.meterAkhir);
    const hasMeterAkhirInput = Boolean(data.meterAkhir && String(data.meterAkhir).trim() !== "");

    if (!hasMeterAkhirInput) {
      // Jika ini pelaporan titik cacat / downtime murni (tanpa mengisi meter akhir):
      // Jangan set jenisLaporan sebagai checkpoint istirahat/masuk
      data.jenisLaporan = "";
      // Namun jika sedang dalam masa istirahat aktif (Selesai Istirahat = belum masuk kembali), dan backup operator valid se-shift:
      const isInActiveBreak = watchJenisLaporan === "Selesai Istirahat";
      const currentOperatorId = watch("operatorId");
      const currentOp = operators.find((o) => o.id.toString() === currentOperatorId);
      const shiftToUse = currentOp?.shift || activeShiftName;
      const isBackupValid = Boolean(backupOperator && operators.some((o) => o.shift === shiftToUse && o.name === backupOperator && o.id.toString() !== currentOperatorId));

      if (isInActiveBreak && isBackupValid) {
        data.backupOperator = backupOperator;
      } else {
        data.backupOperator = undefined;
      }
    } else {
      if (data.jenisLaporan === "Mulai Istirahat" || data.jenisLaporan === "Selesai Istirahat") {
        const currentOperatorId = watch("operatorId");
        const currentOp = operators.find((o) => o.id.toString() === currentOperatorId);
        const shiftToUse = currentOp?.shift || activeShiftName;
        const isBackupValid = Boolean(backupOperator && operators.some((o) => o.shift === shiftToUse && o.name === backupOperator && o.id.toString() !== currentOperatorId));

        if (!backupOperator || !isBackupValid) {
          setIsSubmitting(false);
          setIsProcessingSubmit(false);
          setErrorMsg(`Wajib memilih Operator Backup dari Shift ${shiftToUse} yang menjaga mesin saat ${data.jenisLaporan}.`);
          return;
        }
        data.backupOperator = backupOperator;
      } else {
        data.backupOperator = undefined;
      }
    }

    const isIstirahatReport = hasMeterAkhirInput && (data.jenisLaporan === "Mulai Istirahat" || data.jenisLaporan === "Selesai Istirahat");
    const isT2ACutSubmit = data.nomorMc === "T2A" && meterAkhirNum === 0;
    const effectiveIsLastRoll = isLastRoll || isT2ACutSubmit || Boolean(data.tanggalPotong);

    if (isT2ACutSubmit) {
      setIsLastRoll(true);
    }

    const effectiveTanggalPotong = effectiveIsLastRoll
      ? data.tanggalPotong || getJakartaDateString()
      : "";
    data.tanggalPotong = effectiveTanggalPotong;

    const meterAwalNum = parseFormMeterValue(data.meterAwal || watch("meterAwal"));
    if (meterAkhirNum !== null && meterAwalNum !== null && !isT2ACutSubmit) {
      if (currentMc.toUpperCase() === "T2A") {
        if (meterAkhirNum > meterAwalNum) {
          setIsSubmitting(false);
          setIsProcessingSubmit(false);
          setErrorMsg(`Finish Meter (${meterAkhirNum}m) tidak boleh lebih besar dari Target (${meterAwalNum}m).`);
          return;
        }
      } else {
        if (meterAkhirNum <= meterAwalNum) {
          setIsSubmitting(false);
          setIsProcessingSubmit(false);
          setErrorMsg(`Finish Meter (${meterAkhirNum}m) harus lebih besar dari Start Meter (${meterAwalNum}m).`);
          return;
        }
      }
    }

    // T2A: meterAwal = Target, meterAkhir = Counter reading, total calculated on backend
    const isT2A = data.nomorMc === "T2A";
    if (isT2A && !isT2ACutSubmit) {
      if (
        !data.meterAwal ||
        data.meterAwal.toString().trim() === "" ||
        data.meterAwal === "0"
      ) {
        setErrorMsg(
          "Untuk mesin T2A, masukkan Target Produksi terlebih dahulu.",
        );
        setIsSubmitting(false);
        setIsProcessingSubmit(false);
        return;
      }
    }

    // Gabungkan detailMasalahMap ke spesifikMasalah (Logic lama, sekarang diambil alih Backend jika pakai downtimeEvents)

    // Save Header Data to LocalStorage automatically on submit
    const lastRollNo =
      data.pcsData && data.pcsData.length > 0 ? data.pcsData[0].rollNo : "";

    const headerDataToSave = {
      operatorId: data.operatorId,
      groupId: data.groupId,
      designId: data.designId,
      nomorMc: data.nomorMc,
      statusMatching: data.statusMatching || "",
      tanggalProduksi: data.tanggalProduksi,
      tanggalPotong: effectiveTanggalPotong,
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
      targetMeter: data.targetMeter,
      pic: data.pic,
      potonganKe: data.potonganKe,
      isPanelGagal: data.isPanelGagal || false,
      pcsCount: data.pcsData ? data.pcsData.length : 1,
      meterAwal:
        data.meterAkhir && !effectiveIsLastRoll
          ? data.meterAkhir
          : effectiveIsLastRoll
            ? ""
            : data.meterAwal,
      meterAkhir: "",
      hasilProduksiMeter: "",
      lastRollNo: lastRollNo,
      mesinMasihStop: data.mesinMasihStop || false,
    };

    if (!isEdit) {
      if (data.mesinMasihStop) {
        if (data.downtimeEvents && data.downtimeEvents.length > 0) {
          const lastEvent = data.downtimeEvents[data.downtimeEvents.length - 1];
          localStorage.setItem("dji_unresolved_downtime", JSON.stringify({
            ...lastEvent,
            durasiDetik: 0
          }));
        }
      } else {
        localStorage.removeItem("dji_unresolved_downtime");
      }

      localStorage.setItem("dji_form_header", JSON.stringify(headerDataToSave));
    }

    try {
      if (!navigator.onLine) {
        const { addPendingPayload } = await import("@/lib/offline-store");
        await addPendingPayload("continuous", data);
        localStorage.removeItem("dji_form_draft_continuous");
        setSuccessData({
          ...data,
          isOfflineSaved: true,
          autoAdjustedDowntimeMsg: adjustedMsg,
          isCutSubmit: isT2ACutSubmit,
        } as any);
        return;
      }

      let result: any;
      // Batas toleransi sinyal lag: 7 detik (sesuai instruksi). Jika lewat 7s, langsung selamatkan data ke penyimpanan lokal
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Network timeout: koneksi database lambat")), 7000)
      );

      if (isEdit && initialData?.id) {
        result = await Promise.race([
          updateContinuousReport(initialData.id, data),
          timeoutPromise
        ]);
      } else {
        result = await Promise.race([
          submitContinuousReport(data),
          timeoutPromise
        ]);
      }

      if (result.success) {
        if (!isEdit) {
          localStorage.removeItem("dji_form_draft_continuous");
        }
        setSuccessData({
          ...data,
          id: isEdit ? initialData.id : (result as any).productionId,
          autoAdjustedDowntimeMsg: adjustedMsg,
          isCutSubmit: isT2ACutSubmit,
        } as any);

        // Inputan ini sukses terkirim langsung (sinyal lancar), picu pengiriman antrean data lokal tertunda
        triggerPiggybackSync();
      } else {
        setErrorMsg(result.error || "Gagal menyimpan laporan produksi rajut.");
      }
    } catch (err: any) {
      if (
        err.message?.includes("fetch") ||
        err.message?.includes("Network") ||
        err.message?.includes("timeout") ||
        !navigator.onLine
      ) {
        const { addPendingPayload } = await import("@/lib/offline-store");
        await addPendingPayload("continuous", data);
        if (!isEdit) {
          localStorage.removeItem("dji_form_draft_continuous");
        }
        setSuccessData({
          ...data,
          isOfflineSaved: true,
          autoAdjustedDowntimeMsg: adjustedMsg,
          isCutSubmit: isT2ACutSubmit,
        } as any);
      } else {
        console.error("Uncaught exception in onSubmit:", err);
        setErrorMsg(`Terjadi kesalahan sistem: ${err.message || err}`);
      }
    } finally {
      setIsSubmitting(false);
      setIsProcessingSubmit(false);
    }
  };

  const handleClearHeader = () => {
    if (window.confirm("Yakin ingin mereset/mengosongkan data Header?")) {
      localStorage.removeItem("dji_form_header");
      localStorage.removeItem("dji_form_draft_continuous");
      localStorage.removeItem("dji_active_downtime_start");
      reset({
        ...watch(), // Keep current panel inputs
        nomorMc: "",
        tanggalPotong: "",
        pick: "",
        noOrderBarang: "",
        jenisBenangDasar: "",
        liner: "",
        heavy: "",
        shadow: "",
        pinggiran: "",
        course: "",
        rpm: "",
        potonganKe: "",
        totalDowntime: "",
        meterAwal: "",
        meterAkhir: "",
        hasilProduksiMeter: "",
        pcsData: [
          {
            pcsIndex: "1",
            meterKain: "",
          },
        ],
      });
      setIsLastRoll(false);
      setIsHeaderModalOpen(true);
    }
  };

  const handleCloseSuccess = () => {
    setIsProcessingSubmit(false);
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
    const submittedJenis = successData?.jenisLaporan;
    const isIstirahatSubmitted = submittedJenis === "Mulai Istirahat" || submittedJenis === "Selesai Istirahat";
    const wasLastRoll = isLastRoll || Boolean(successData?.tanggalPotong);
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
      meterKain: "",
    }));

    // Jika mesinMasihStop, potonganKe tidak naik agar Shift 2 bisa lanjutkan panel yang sama
    const wasMesinMasihStop = (() => {
      try {
        const h = localStorage.getItem("dji_form_header");
        if (h) return JSON.parse(h).mesinMasihStop || false;
      } catch (e) { }
      return false;
    })();

    const wasPanelGagal = (() => {
      try {
        const h = localStorage.getItem("dji_form_header");
        if (h) return JSON.parse(h).isPanelGagal || false;
      } catch (e) { }
      return false;
    })();

    const currentPotongan = parseInt(watch("potonganKe") || "0", 10);
    const nextPotongan =
      wasLastRoll && !isNaN(currentPotongan) && !wasMesinMasihStop && !wasPanelGagal
        ? String(currentPotongan + 1)
        : watch("potonganKe");

    const submittedMeterAkhir = successData?.meterAkhir;
    const isMeterCheckpointSubmitted = Boolean(submittedMeterAkhir && String(submittedMeterAkhir).trim() !== "");

    let nextJenisLaporan = watch("jenisLaporan");
    // Transisi status istirahat/masuk HANYA dilakukan jika yang baru saja disubmit adalah laporan checkpoint meter akhir
    if (isMeterCheckpointSubmitted) {
      if (submittedJenis === "Mulai Istirahat") {
        nextJenisLaporan = "Selesai Istirahat";
      } else if (submittedJenis === "Selesai Istirahat") {
        nextJenisLaporan = "";
        try {
          localStorage.removeItem(`dji_last_backup_operator_${activeShiftName}`);
          localStorage.removeItem("dji_last_backup_operator");
        } catch {}
        setBackupOperator("");
      }
    }

    const nextMeterAwal = (isMeterCheckpointSubmitted && submittedMeterAkhir && String(submittedMeterAkhir).trim() !== "" && !wasLastRoll)
      ? String(submittedMeterAkhir)
      : (wasLastRoll ? "" : watch("meterAwal"));

    reset({
      ...watch(),
      jenisLaporan: nextJenisLaporan,
      potonganKe: nextPotongan,
      mesinMasihStop: false,

      pcsData:
        newPcsData.length > 0
          ? newPcsData
          : [
            {
              pcsIndex: "1",
              meterKain: "",
            },
          ],
      totalDowntime: "",
      meterAwal: nextMeterAwal,
      meterAkhir: "",
      hasilProduksiMeter: "",
      tanggalPotong: "",
      targetMeter: wasLastRoll ? "" : watch("targetMeter"),
      downtimeEvents: pendingDowntimeEventsRef.current || [],
    });

    const preservedPending = pendingDowntimeEventsRef.current || [];
    pendingDowntimeEventsRef.current = [];

    // Jika masih ada sisa antrean yang belum diklasifikasi, simpan ke draft agar tidak hilang saat reload
    if (preservedPending.length > 0) {
      try {
        const currentDraft = {
          ...watch(),
          downtimeEvents: preservedPending,
        };
        localStorage.setItem("dji_form_draft_continuous", JSON.stringify(currentDraft));
      } catch (e) { }
    }

    // Refresh idempotency key setelah sukses submit
    idempotencyKeyRef.current = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15);

    setIsLastRoll(false);
    setIsTimerRunning(false);
    setTimerStartRef(null);
    setTimerStopRef(null);
    localStorage.removeItem("dji_active_downtime_start");
    setFirstProblemTime(null);
    setLiveTimerSeconds(0);
    setPreviews({ before: null, after: null });

    const wasMeterAkhirSubmitted = Boolean(successData?.meterAkhir && String(successData.meterAkhir).trim() !== "");
    const wasAkhirShift = !isIstirahatSubmitted && (submittedJenis === "Akhir Shift" || wasMeterAkhirSubmitted) && !wasLastRoll;

    if (wasLastRoll) {
      setIsHeaderModalOpen(true);
      setHighlightPotonganKe(true);
      setHighlightOperator(false);
    } else if (wasAkhirShift) {
      setIsHeaderModalOpen(true);
      setHighlightPotonganKe(false);
      setHighlightOperator(true);
    } else {
      setHighlightPotonganKe(false);
      setHighlightOperator(false);
    }
  };

  const handleCloseSuccessRef = useRef(handleCloseSuccess);
  useEffect(() => {
    handleCloseSuccessRef.current = handleCloseSuccess;
  });

  useEffect(() => {
    if (!successData) return;
    setSuccessAutoCloseSeconds(3);

    const timer = setTimeout(() => {
      handleCloseSuccessRef.current();
    }, 3000);

    const interval = setInterval(() => {
      setSuccessAutoCloseSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [successData]);

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

  return (
    <div
      className={cn(
        "w-full border rounded-2xl sm:rounded-[24px] p-4 sm:p-6 lg:p-8 relative overflow-hidden transition-colors duration-300",
        isDark
          ? "bg-slate-900/95 border-slate-800 text-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          : "bg-white border-[#e9ecef] text-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.015)]"
      )}
    >
      {/* Decorative background shape */}
      <div
        className={cn(
          "absolute top-0 right-0 w-96 h-96 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none -z-10 transition-colors",
          isDark
            ? "bg-gradient-to-br from-emerald-500/10 via-slate-800/10 to-transparent"
            : "bg-gradient-to-br from-emerald-100/30 via-emerald-50/20 to-transparent"
        )}
      ></div>

      <div className="relative">
        {/* Segmented Control for Mode Switching */}
        <div
          data-tour="meter-mode-switch"
          className={cn(
            "flex w-full p-1.5 rounded-2xl mb-4 sm:mb-8 border shadow-inner transition-colors",
            isDark
              ? "bg-slate-950/80 border-slate-800"
              : "bg-slate-100/80 border-slate-200/60"
          )}
        >
          <a
            href="/input?mode=panel"
            onClick={() => {
              localStorage.setItem("last_input_route", "/input");
            }}
            className={cn(
              "flex-1 flex items-center justify-center py-2.5 sm:py-3.5 rounded-xl transition-all cursor-pointer",
              isDark
                ? "text-slate-400 hover:text-blue-400 hover:bg-slate-900/60"
                : "text-slate-500 hover:text-blue-600 hover:bg-white/60"
            )}
          >
            <div className="flex items-center gap-2 sm:gap-2.5 opacity-70 hover:opacity-100 transition-opacity">
              <div
                className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0",
                  isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-600"
                )}
              >
                <Box className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider leading-none">
                  PANEL
                </span>
              </div>
            </div>
          </a>
          <div
            className={cn(
              "flex-1 flex items-center justify-center py-2.5 sm:py-3.5 rounded-xl shadow-sm border relative overflow-hidden group cursor-default transition-colors",
              isDark
                ? "bg-slate-900 border-slate-700 text-emerald-400"
                : "bg-white border-slate-200 text-emerald-600"
            )}
          >
            <div
              className={cn(
                "absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300",
                isDark ? "bg-emerald-950/30" : "bg-emerald-50/50"
              )}
            ></div>
            <div className="relative flex items-center gap-2 sm:gap-2.5">
              <div
                className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0",
                  isDark ? "bg-emerald-950 text-emerald-400" : "bg-emerald-100 text-emerald-600"
                )}
              >
                <ClipboardList className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider leading-none">
                  METER
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Top Header */}
        <div
          className={cn(
            "flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 sm:pb-4 mb-4 sm:mb-6 gap-3 sm:gap-4 transition-colors",
            isDark ? "border-slate-800" : "border-slate-100"
          )}
        >
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                "text-base font-bold whitespace-nowrap",
                isDark ? "text-slate-100" : "text-slate-900"
              )}
            >
              Form Input Produksi (Meteran)
            </h3>
            <p
              className={cn(
                "text-xs font-normal mt-0.5 sm:mt-1",
                isDark ? "text-slate-400" : "text-slate-400"
              )}
            >
              Data Header akan otomatis tersimpan untuk roll/meteran berikutnya.
            </p>
          </div>

          <div className="flex flex-row items-center gap-2 w-full sm:w-auto shrink-0 flex-nowrap overflow-x-auto sm:overflow-visible">
            <button
              data-tour="meter-stop-machine"
              type="button"
              onClick={() => setIsStopModalOpen(true)}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap group flex-1 sm:flex-initial"
              title="Lapor jika mesin mati/rusak/standby selama shift ini tanpa ada hasil kain"
            >
              <PowerOff className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform shrink-0" />
              <span>Mesin Mati</span>
            </button>
            <button
              data-tour="meter-potongan-history"
              type="button"
              onClick={() => setIsHistoryDrawerOpen(true)}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-white hover:bg-sky-50 text-slate-700 hover:text-[#0070bc] border border-slate-200 hover:border-sky-300 shadow-2xs text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap group flex-1 sm:flex-initial"
            >
              <History className="w-4 h-4 text-slate-500 group-hover:text-[#0070bc] transition-colors shrink-0" />
              <span>Riwayat Potongan Ini</span>
            </button>
          </div>
        </div>

        {stopModalSuccessMsg && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xs font-bold text-emerald-900 leading-snug">
                {stopModalSuccessMsg}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStopModalSuccessMsg(null)}
              className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {watch("nomorMc") && machineInputTypes[watch("nomorMc").toUpperCase()] === "PANEL" && (
          <div className="p-3 bg-indigo-50 border border-indigo-200/80 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-100/80 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wide leading-none">
                  Mesin {watch("nomorMc")} Di-set Input PANEL
                </h4>
                <p className="text-[11px] font-medium text-indigo-700 leading-snug mt-1">
                  Admin mengatur mesin ini khusus untuk pelaporan <strong>Panel</strong>.
                </p>
              </div>
            </div>
            <a
              href={`/input?mc=${encodeURIComponent(watch("nomorMc"))}`}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <span>Pindah Form Panel</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50/50 border border-red-100 text-red-700 rounded-xl flex items-start gap-2.5 text-xs font-semibold animate-fadeIn">
          <AlertCircle
            className="w-4 h-4 shrink-0 text-red-500"
            strokeWidth={2}
          />
          <span>{errorMsg}</span>
        </div>
      )}

      {isEdit && (
        <div className="mb-6 p-4 bg-yellow-50/50 border border-yellow-200 text-yellow-800 rounded-xl flex items-start gap-3 text-sm animate-fadeIn shadow-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-500" strokeWidth={2} />
          <div>
            <strong className="block font-bold mb-1">Hati-Hati Saat Mengedit Data!</strong>
          </div>
        </div>
      )}


      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        className="space-y-4"
      >
        <div className={cn(
          "shadow-sm rounded-[20px] p-3 sm:p-4 lg:p-5 transition-colors",
          isDark ? "bg-slate-900/60 border border-slate-800" : "bg-white border border-slate-200"
        )}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-5 items-start">
            {/* Kolom Kiri: Info Header & Info Laporan Meter */}
            <div className="flex flex-col gap-3 sm:gap-4 lg:gap-5 self-start sm:min-h-[345px]">
              <div data-tour="meter-header-summary" className="w-full">
                <HeaderSummaryCard
                  operatorName={getOperatorName(watch("operatorId"))}
                  shiftName={activeShiftName}
                  nomorMc={watch("nomorMc") || ""}
                  design={watch("designId") || ""}
                  statusMatching={watch("statusMatching") || ""}
                  potonganKe={watch("potonganKe")}
                  onEdit={() => {
                    setIsHeaderModalOpen(true);
                    setHighlightPotonganKe(false);
                    setHighlightOperator(false);
                  }}
                  showEditButton
                  showEditButtonPlacement="bottom"
                />
              </div>

              {/* Banner Peringatan Serah Terima Shift (Jika Operator Berubah & Operator Sebelumnya Belum Finish) */}
              {handoverWarning?.needsMeterAwal && (
                <div
                  className={cn(
                    "w-full p-4 border-2 rounded-2xl flex flex-col gap-2.5 shadow-xs animate-fadeIn transition-colors",
                    isDark
                      ? "bg-amber-950/40 border-amber-800/80 text-amber-200"
                      : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 text-amber-950"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <ArrowRightLeft className="w-4 h-4" />
                    </div>
                    <div>
                      <h4
                        className={cn(
                          "text-xs font-black uppercase tracking-wider",
                          isDark ? "text-amber-300" : "text-amber-950"
                        )}
                      >
                        Serah Terima Shift
                      </h4>
                      <p
                        className={cn(
                          "text-[11px] font-semibold leading-snug",
                          isDark ? "text-amber-300/80" : "text-amber-800"
                        )}
                      >
                        Operator sebelumnya <strong>{handoverWarning.lastOperator}</strong> (s.d. {handoverWarning.lastMeter}m) belum lapor finish.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHandoverInputMeter(handoverWarning.lastMeter > 0 ? String(handoverWarning.lastMeter) : "");
                      setHandoverModalError(null);
                      setIsHandoverModalOpen(true);
                    }}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Input Meter Serah Terima
                  </button>
                </div>
              )}

              {/* Tombol Pemicu Pop-up Meteran (Sejajar dengan Card Nomor Panel pada form panel) */}
              <div
                data-tour="meter-final-report"
                className={cn(
                  "w-full p-4 sm:p-5 rounded-3xl relative shadow-sm flex flex-col justify-center min-h-[140px] transition-colors",
                  isDark
                    ? "bg-slate-900/95 border-2 border-emerald-900/60 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
                    : "bg-emerald-50/80 border-2 border-emerald-200"
                )}
              >
                <button
                  type="button"
                  onClick={() => setShowReportCardInfo((prev) => !prev)}
                  className={cn(
                    "absolute top-2.5 right-2.5 transition-colors z-20 cursor-pointer p-0.5 rounded-full",
                    isDark
                      ? showReportCardInfo
                        ? "text-emerald-400 bg-slate-800"
                        : "text-slate-400 hover:text-emerald-400"
                      : showReportCardInfo
                        ? "text-emerald-900"
                        : "text-emerald-600/80 hover:text-emerald-800"
                  )}
                  title="Info Laporan"
                >
                  <Info className="w-4 h-4" />
                </button>

                {showReportCardInfo && (
                  <div className="absolute top-10 left-2.5 right-2.5 p-3 bg-slate-900 text-white text-[11px] font-medium leading-relaxed rounded-xl z-30 shadow-xl border border-slate-700 animate-fadeIn">
                    {watch("nomorMc") === "T2A"
                      ? "Gunakan tombol di bawah untuk melaporkan meter produksi."
                      : "Gunakan tombol di bawah jika ingin istirahat, jika beres potongan atau shift selesai."}
                  </div>
                )}

                <div
                  className={cn(
                    "absolute -top-3.5 lg:-top-4 left-1/2 -translate-x-1/2 bg-emerald-600 px-3 lg:px-5 py-1 lg:py-1.5 text-[9px] lg:text-[11px] font-black text-white uppercase tracking-widest border-2 rounded-full shadow-md whitespace-nowrap transition-colors",
                    isDark ? "border-slate-900 shadow-emerald-950/40" : "border-white"
                  )}
                >
                  {watch("nomorMc") === "T2A"
                    ? "Laporan Meter"
                    : "Laporan Hasil"}
                </div>

                <div className="mt-1.5 flex flex-col items-center justify-center text-center gap-3">
                  <div>
                    <h4
                      className={cn(
                        "text-sm font-black tracking-tight transition-colors",
                        isDark ? "text-slate-100" : "text-emerald-950"
                      )}
                    >
                      {watch("nomorMc") === "T2A"
                        ? "Pelaporan Meter Produksi"
                        : "Pelaporan Akhir Meter"}
                    </h4>
                    {watch("nomorMc") !== "T2A" && (
                      <div className="flex items-center justify-center gap-1.5 flex-wrap mt-2">
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border shadow-2xs transition-colors",
                            isDark
                              ? "bg-emerald-950/70 text-emerald-300 border-emerald-800/80"
                              : "bg-emerald-100/90 text-emerald-900 border-emerald-300"
                          )}
                        >
                          Oper Shift
                        </span>
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border shadow-2xs transition-colors",
                            isDark
                              ? "bg-amber-950/70 text-amber-300 border-amber-800/80"
                              : "bg-amber-100/90 text-amber-900 border-amber-300"
                          )}
                        >
                          Istirahat
                        </span>
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border shadow-2xs transition-colors",
                            isDark
                              ? "bg-teal-950/70 text-teal-300 border-teal-800/80"
                              : "bg-teal-100/90 text-teal-900 border-teal-300"
                          )}
                        >
                          Masuk
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={isLoadingMeterStart}
                    onClick={async () => {
                      try {
                        setIsLoadingMeterStart(true);
                        await refreshAutomaticMeterStart();
                        setIsMeterModalOpen(true);
                      } catch (err) {
                        console.error("Gagal memuat meter awal:", err);
                        setIsMeterModalOpen(true);
                      } finally {
                        setIsLoadingMeterStart(false);
                      }
                    }}
                    className={cn(
                      "w-full max-w-xs px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-sm font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer",
                      isDark ? "shadow-emerald-950/50" : "shadow-emerald-600/20",
                      isLoadingMeterStart ? "opacity-75 cursor-not-allowed pointer-events-none" : ""
                    )}
                  >
                    {isLoadingMeterStart ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Memuat Data Meter...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5" />
                        <span>
                          {watch("nomorMc") === "T2A"
                            ? "Lapor Meter"
                            : "Lapor Meter Terakhir"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Banner Wi-Fi Trigger ESP32 (Disimpan tepat di bawah Card Laporan Hasil) */}
              {!isEdit && timerControls && (
                <div className="w-full">
                  <WifiDowntimeTrigger
                    selectedMachineCode={watch("nomorMc")}
                    onStartTimer={timerControls.onStartTimer}
                    onStopTimer={timerControls.onStopTimer}
                    isTimerRunning={timerControls.isTimerRunning}
                  />
                </div>
              )}
            </div>

            {/* Kolom Kanan: Downtime Tracker (Timer & Blok) */}
            <div className="flex flex-col w-full self-start">
              <div className="w-full">
                <input type="hidden" {...register("totalDowntime")} />
                <DowntimeTracker
                  control={control}
                  setValue={setValue}
                  watch={watch}
                  showBlockInput={true}
                  showMeterInput={true}
                  defaultMeter={defaultMeter}
                  defaultPcsIndex={defaultPcsIndex}
                  operators={activeOperators}
                  currentOperatorName={getOperatorName(watch("operatorId"))}
                  isEdit={isEdit}
                  onRegisterTimerControls={setTimerControls}
                  isPanelType={false}
                  viewMode="timer_only"
                  onAutoSubmit={() => {
                    if (isSubmitting || isProcessingSubmit) return;
                    setIsProcessingSubmit(true);
                    handleSubmit(onSubmit, onInvalid)();
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section Merentang Penuh (Full Width): Antrean & Riwayat Kendala Mesin */}
          <div className="w-full mt-4">
            <DowntimeTracker
              control={control}
              setValue={setValue}
              watch={watch}
              showBlockInput={true}
              showMeterInput={true}
              defaultMeter={defaultMeter}
              defaultPcsIndex={defaultPcsIndex}
              operators={activeOperators}
              currentOperatorName={getOperatorName(watch("operatorId"))}
              isEdit={isEdit}
              isPanelType={false}
              viewMode="events_only"
              onAutoSubmit={() => {
                if (isSubmitting || isProcessingSubmit) return;
                setIsProcessingSubmit(true);
                handleSubmit(onSubmit, onInvalid)();
              }}
            />

            {/* Tombol Kirim Titik Cacat Manual jika ada data di riwayat berhenti */}
            {(() => {
              const dtEvents = watch("downtimeEvents") || [];
              const resolvedEvents = dtEvents.filter((evt: any) => evt.isResolved !== false && (evt.isResolved || (evt.problems && evt.problems.length > 0)));
              if (resolvedEvents.length === 0) return null;

              return (
                <div className="w-full mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (isSubmitting || isProcessingSubmit) return;
                      setIsProcessingSubmit(true);
                      handleSubmit(onSubmit, onInvalid)();
                    }}
                    disabled={isSubmitting || isProcessingSubmit}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-sky-600 to-[#0070bc] hover:from-sky-700 hover:to-[#005a96] active:scale-95 text-white text-xs font-black rounded-xl shadow-md shadow-sky-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting || isProcessingSubmit ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>Kirim Titik Cacat ({resolvedEvents.length} Kejadian)</span>
                  </button>
                </div>
              );
            })()}
          </div>

          {/* ARRAY OF PCS (HIDDEN) - use actual pcsIndex from field data, not sequential position */}
          {/* NOTE: Do NOT use value={index+1} here — that overwrites pcsIndex and breaks PCS 2, 3, etc. on edit */}
          <div className="hidden">
            {fields.map((field: any, index) => (
              <input
                key={field.id}
                type="hidden"
                {...register(`pcsData.${index}.pcsIndex` as const)}
                defaultValue={field.pcsIndex || (index + 1)}
              />
            ))}
          </div>
        </div>

        {(errors.pcsData as any)?.message && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 mb-6 animate-pulse">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-xs font-bold text-red-600">
              {(errors.pcsData as any)?.message}
            </p>
          </div>
        )}
        {(errors.pcsData as any)?.root?.message && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 mb-6 animate-pulse">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-xs font-bold text-red-600">
              {(errors.pcsData as any)?.root?.message}
            </p>
          </div>
        )}

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
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-xl border-2 border-dashed font-bold text-sm transition-all duration-200 cursor-pointer active:scale-98",
            isDark
              ? "border-rose-500/70 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 hover:text-rose-200 hover:border-rose-400 shadow-xs"
              : "border-rose-300 bg-rose-50/50 text-rose-600 hover:bg-rose-100/70 hover:text-rose-700 hover:border-rose-400"
          )}
        >
          {showAdvancedActions ? (
            <>Tutup Opsi Lanjutan</>
          ) : (
            <>Potong Kain & BS</>
          )}
        </button>

        {/* Tindakan Akhir Panel Modal Pop-Up */}
        {showAdvancedActions && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
            onClick={handleCancelAdvancedActions}
          >
            <div
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-scaleIn"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50">
                <h3 className="font-black text-slate-800 text-lg">
                  Opsi Lanjutan Meter
                </h3>
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
                {(() => {
                  const currentPcsData = watch("pcsData") || [];
                  const hasBsSelected = currentPcsData.some((p) => p?.isBs);

                  return (
                    <>
                      <div className="flex flex-col gap-2 relative" data-tour="meter-cut-roll">
                        <label className={`relative flex flex-col items-center justify-center p-4 h-32 rounded-2xl border-2 transition-all duration-300 text-center ${hasBsSelected
                          ? "bg-slate-100 border-slate-200 text-slate-400 opacity-40 cursor-not-allowed pointer-events-none grayscale"
                          : isLastRoll
                            ? "bg-gradient-to-br from-[#0070bc] to-[#004777] border-transparent shadow-lg shadow-sky-500/30 text-white cursor-pointer"
                            : "bg-white border-slate-200 hover:border-sky-300 text-slate-600 hover:bg-sky-50 cursor-pointer"
                          }`}>
                          <input
                            type="checkbox"
                            disabled={hasBsSelected}
                            checked={isLastRoll}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setIsLastRoll(checked);
                              if (checked) {
                                setValue("tanggalPotong", new Date().toISOString().split("T")[0]);
                                if (fields && fields.length > 0) {
                                  fields.forEach((_, i) => setValue(`pcsData.${i}.isBs` as const, false));
                                }
                              } else {
                                setValue("tanggalPotong", "");
                              }
                            }}
                            className="hidden"
                          />
                          <Scissors className={`w-8 h-8 mb-2 transition-transform duration-300 ${isLastRoll ? "-rotate-12 scale-110" : "text-slate-400"}`} style={{ transform: isLastRoll ? "scaleX(-1) rotate(12deg)" : "scaleX(-1)" }} />
                          <span className="font-black uppercase text-xs tracking-wide">Potong Kain</span>

                          {isLastRoll && (
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
                            : isLastRoll ? "bg-white/20 text-white hover:bg-white/30" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            }`}
                        >
                          <Info className="w-4 h-4" />
                        </button>
                        {activeInfo === "potong" && (
                          <div className="absolute top-12 left-0 w-full p-3 bg-slate-800 text-white text-[11px] leading-relaxed rounded-xl z-50 shadow-xl animate-fadeIn">
                            Tandai khusus untuk potongan terakhir dalam roll kain.
                          </div>
                        )}

                        {isLastRoll && (
                          <div className="animate-fadeIn mt-1">
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
                          <div className={`relative flex flex-col items-center justify-center p-4 min-h-32 h-auto rounded-2xl border-2 transition-all duration-300 text-center shadow-sm ${isLastRoll
                            ? "bg-slate-100 border-slate-200 text-slate-400 opacity-40 cursor-not-allowed pointer-events-none grayscale"
                            : "bg-gradient-to-br from-rose-50 to-white border-rose-200"
                            }`}>
                            <AlertCircle className="w-7 h-7 mb-2 text-rose-500" />
                            <span className="font-black uppercase text-xs text-rose-700 tracking-wide mb-2">Tandai PCS BS</span>

                            <div className="flex flex-wrap justify-center gap-1.5 w-full">
                              {fields.map((field, index) => (
                                <div key={field.id} className="relative flex-1 min-w-[45%] z-10">
                                  <input
                                    type="checkbox"
                                    id={`pcsBs-${index}`}
                                    disabled={isLastRoll}
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
                              Klik tombol PCS yang cacat/rusak. Otomatis akan menahan nomor urut potongan selanjutnya.
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="p-4 sm:p-5 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelAdvancedActions}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all uppercase tracking-wider cursor-pointer"
                >
                  Batal
                </button>
                {isLastRoll ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setShowAdvancedActions(false);
                      setValue("jenisLaporan", "");
                      await refreshAutomaticMeterStart();
                      setIsMeterModalOpen(true);
                    }}
                    className="flex-1 h-12 sm:h-14 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-900/20 transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-5 h-5" />
                    <span>Lanjut Isi Total Meter</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting || isProcessingSubmit}
                    onClick={() => {
                      if (isSubmitting || isProcessingSubmit) return;
                      setIsProcessingSubmit(true);
                      setShowAdvancedActions(false);
                      handleSubmit(onSubmit, onInvalid)();
                    }}
                    className="flex-1 h-12 sm:h-14 bg-[#0070bc] hover:bg-[#004777] active:scale-[0.98] text-white font-black text-sm rounded-xl shadow-lg shadow-sky-900/20 transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
                    <span>{isSubmitting || isProcessingSubmit ? "Menyimpan..." : "Kirim Laporan Sekarang"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Indikator Antrean Data Tertunda Akibat Lag */}
        {pendingOfflineCount > 0 && (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200/90 rounded-2xl text-amber-900 text-xs font-semibold shadow-xs mt-6 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span><strong>{pendingOfflineCount} data</strong> tersimpan di perangkat (antre kirim saat ada sinyal)</span>
            </div>
            <button
              type="button"
              onClick={() => triggerPiggybackSync()}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
            >
              Kirim Sekarang
            </button>
          </div>
        )}

        <div className="flex flex-col gap-4 mt-4">
          {watch("nomorMc") && machineInputTypes[watch("nomorMc").toUpperCase()] === "PANEL" ? (
            <button
              type="button"
              disabled
              className="w-full h-12 rounded-xl bg-slate-200 text-slate-500 font-extrabold text-xs uppercase tracking-wide cursor-not-allowed flex items-center justify-center gap-2 border border-slate-300"
            >
              <Lock className="w-4 h-4 text-slate-500" />
              <span>Ditolak: Mesin {watch("nomorMc")} Khusus Input PANEL</span>
            </button>
          ) : (
            <button
              data-tour="meter-submit-defect"
              type="button"
              onClick={() => {
                if (isSubmitting || isProcessingSubmit) return;
                setIsProcessingSubmit(true);
                if (watch("nomorMc") !== "T2A") {
                  setValue("meterAwal", "");
                }
                setValue("meterAkhir", "");
                handleSubmit(onSubmit, onInvalid)();
              }}
              disabled={isSubmitting || isProcessingSubmit}
              className={`w-full h-12 rounded-xl active:scale-[0.99] disabled:opacity-50 text-white text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-md ${isLastRoll ? "bg-slate-400 hover:bg-slate-500" : "bg-[#0070bc] hover:bg-[#004777]"}`}
            >
              {isSubmitting || isProcessingSubmit ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />{" "}
                  {isEdit
                    ? "Simpan Perubahan Cacat"
                    : "Kirim Laporan Titik Cacat"}
                </>
              )}
            </button>
          )}
        </div>

        {isMeterModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
            onClick={() => setIsMeterModalOpen(false)}
          >
            <div
              data-tour="meter-modal"
              className={cn(
                "w-full max-w-lg sm:max-w-xl rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col animate-scaleIn relative overflow-hidden max-h-[92vh] overflow-y-auto custom-scrollbar transition-colors",
                isDark ? "bg-slate-900 border border-slate-800 text-slate-100" : "bg-white text-slate-800"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={cn(
                  "absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 pointer-events-none transition-opacity",
                  isDark ? "opacity-20" : "opacity-10"
                )}
              ></div>

              <div className="flex justify-between items-center mb-3 relative z-10">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors shadow-xs",
                      isDark ? "bg-emerald-950/70 text-emerald-400 border border-emerald-800/60" : "bg-emerald-100 text-emerald-600"
                    )}
                  >
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={cn("text-base font-black transition-colors", isDark ? "text-slate-100" : "text-slate-800")}>
                        {isLastRoll ? "Laporan Potong Kain" : "Laporan Meteran"}
                      </h3>
                      <span className={cn(
                        "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider",
                        isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                      )}>
                        {watch("nomorMc") || "R11"}
                      </span>
                    </div>
                    <p className={cn("text-[10px] font-semibold transition-colors mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
                      {isLastRoll ? "Isi meteran untuk potong kain" : "Isi di akhir shift kerja"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMeterModalOpen(false)}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer",
                    isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200" : "bg-slate-100 hover:bg-slate-200 text-slate-500"
                  )}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 relative z-10">
                {watch("nomorMc") === "T2A" ? (
                  <div className="space-y-3">
                    {isMeterAwalLocked && originalT2ATarget !== null && (
                      <div
                        className={cn(
                          "p-2.5 rounded-xl flex items-center justify-between border transition-colors",
                          isDark ? "bg-blue-950/40 border-blue-800/80 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-800"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-blue-500" />
                          <span className="text-[10px] font-bold uppercase">Target Produksi Awal</span>
                        </div>
                        <span className="text-sm font-black">{originalT2ATarget} m</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className={cn(
                        "p-3 rounded-2xl border flex flex-col justify-between transition-colors",
                        isDark ? "bg-slate-950/80 border-slate-800" : "bg-slate-50 border-slate-200"
                      )}>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <label className={cn("text-[10px] font-black uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>
                            {isMeterAwalLocked ? "Start Meter" : "Target Produksi"}
                          </label>
                          <span className={cn(
                            "text-[8.5px] font-extrabold px-1.5 py-0.5 rounded-full uppercase",
                            isDark ? "bg-slate-800 text-slate-400" : "bg-slate-200/80 text-slate-600"
                          )}>
                            Target
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 my-0.5">
                          <input
                            type="number"
                            step="any"
                            {...register("meterAwal")}
                            readOnly={isMeterAwalLocked}
                            className={cn(
                              "w-full text-xl sm:text-2xl font-black font-mono bg-transparent outline-none",
                              isDark ? "text-slate-300" : "text-slate-800"
                            )}
                          />
                          <span className="text-xs font-bold text-slate-400 shrink-0">m</span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium leading-tight truncate">
                          {isMeterAwalLocked ? "Dari sisa shift sebelumnya" : "Target meter kain"}
                        </p>
                      </div>

                      <div className={cn(
                        "p-3 rounded-2xl border-2 flex flex-col justify-between transition-all",
                        isDark
                          ? "bg-slate-950 border-emerald-500/80 focus-within:ring-2 focus-within:ring-emerald-500/30"
                          : "bg-white border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-200 shadow-xs"
                      )}>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <label className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Finish Meter *
                          </label>
                          <span className="text-[8.5px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 uppercase">
                            Counter
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 my-0.5">
                          <input
                            type="number"
                            step="1"
                            inputMode="numeric"
                            autoFocus
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            {...register("meterAkhir")}
                            placeholder="0"
                            className={cn(
                              "w-full text-xl sm:text-2xl font-black font-mono bg-transparent outline-none",
                              isDark ? "text-slate-100 placeholder:text-slate-600" : "text-slate-900 placeholder:text-slate-300"
                            )}
                          />
                          <span className="text-xs font-bold text-slate-400 shrink-0">m</span>
                        </div>
                        <p className="text-[9px] text-emerald-600/80 dark:text-emerald-400 font-medium leading-tight truncate">
                          Counter mesin saat ini
                        </p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "p-3 rounded-2xl border flex items-center justify-between transition-colors shadow-2xs",
                        isDark ? "bg-emerald-950/40 border-emerald-800/80" : "bg-emerald-50/90 border-emerald-200"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                          isDark ? "bg-emerald-900/60 text-emerald-300" : "bg-emerald-200/70 text-emerald-800"
                        )}>
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <span className={cn("text-[9.5px] font-extrabold uppercase tracking-wider block", isDark ? "text-emerald-300" : "text-emerald-900")}>
                            Total Produksi
                          </span>
                          <span className={cn("text-[9px] font-medium block", isDark ? "text-emerald-400/80" : "text-emerald-700/80")}>
                            Target - Finish Meter
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={cn("text-2xl sm:text-3xl font-black font-mono", isDark ? "text-emerald-300" : "text-emerald-600")}>
                          {(() => {
                            const akhirStr = watch("meterAkhir");
                            if (!akhirStr || akhirStr.trim() === "") return "0";
                            const t = parseFloat(watch("meterAwal") || "0") || 0;
                            const p = parseFloat(akhirStr) || 0;
                            return String(Math.max(t - p, 0));
                          })()}
                        </span>
                        <span className={cn("text-xs font-black ml-1", isDark ? "text-emerald-400" : "text-emerald-700")}>m</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {handoverWarning?.needsMeterAwal && (
                      <div
                        className={cn(
                          "p-3 border rounded-xl flex items-start gap-2.5 text-xs shadow-xs transition-colors",
                          isDark
                            ? "bg-amber-950/40 border-amber-800/80 text-amber-200"
                            : "bg-amber-50 border-amber-300 text-amber-900"
                        )}
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                          <span className={cn("font-bold block mb-0.5", isDark ? "text-amber-300" : "text-amber-950")}>Serah Terima Shift Otomatis</span>
                          Operator sebelumnya (<b>{handoverWarning.lastOperator}</b>) belum melaporkan finish shift.
                          Counter meter yang Anda masukkan di bawah akan otomatis <b>menutup shift {handoverWarning.lastOperator}</b>, dan shift Anda akan langsung dimulai dari counter tersebut.
                        </div>
                      </div>
                    )}

                    {/* Grid Start & Finish Meter (Side-by-Side 2 Kolom) */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Box 1: Start Meter */}
                      <div
                        className={cn(
                          "p-3 rounded-2xl border flex flex-col justify-between transition-colors",
                          isDark
                            ? "bg-slate-950/80 border-slate-800"
                            : "bg-slate-50 border-slate-200"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <label className={cn("text-[10px] font-black uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>
                            Start Meter
                          </label>
                          <span className={cn(
                            "text-[8.5px] font-extrabold px-1.5 py-0.5 rounded-full uppercase",
                            isDark ? "bg-slate-800 text-slate-400" : "bg-slate-200/80 text-slate-600"
                          )}>
                            Otomatis
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 my-0.5">
                          <input
                            type="number"
                            step="any"
                            tabIndex={-1}
                            readOnly
                            {...register("meterAwal")}
                            className={cn(
                              "w-full text-xl sm:text-2xl font-black font-mono bg-transparent outline-none cursor-not-allowed select-none",
                              isDark ? "text-slate-300" : "text-slate-800"
                            )}
                          />
                          <span className="text-xs font-bold text-slate-400 shrink-0">m</span>
                        </div>
                        <p className={cn("text-[9px] font-medium leading-tight truncate", isDark ? "text-slate-500" : "text-slate-500")}>
                          Dari finish shift sebelumnya
                        </p>
                      </div>

                      {/* Box 2: Finish Meter (Input Counter Mesin) */}
                      <div
                        className={cn(
                          "p-3 rounded-2xl border-2 flex flex-col justify-between transition-all",
                          isDark
                            ? "bg-slate-950 border-emerald-500/80 focus-within:ring-2 focus-within:ring-emerald-500/30"
                            : "bg-white border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-200 shadow-xs"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <label className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            {watchJenisLaporan === "Mulai Istirahat"
                              ? "Meter Istirahat"
                              : watchJenisLaporan === "Selesai Istirahat"
                                ? "Meter Masuk"
                                : (handoverWarning?.needsMeterAwal ? "Meter Serah Terima" : "Finish Meter *")}
                          </label>
                          <span className="text-[8.5px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 uppercase">
                            Counter
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 my-0.5">
                          <input
                            type="number"
                            step="1"
                            inputMode="numeric"
                            autoFocus
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            onKeyDown={(e) => {
                              if (e.key === "," || e.key === "." || e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                                e.preventDefault();
                              }
                            }}
                            {...register("meterAkhir")}
                            placeholder="Contoh: 250"
                            className={cn(
                              "w-full text-xl sm:text-2xl font-black font-mono bg-transparent outline-none",
                              isDark ? "text-slate-100 placeholder:text-slate-600" : "text-slate-900 placeholder:text-slate-300"
                            )}
                          />
                          <span className="text-xs font-bold text-slate-400 shrink-0">m</span>
                        </div>
                        <p className={cn("text-[9px] font-medium leading-tight truncate", isDark ? "text-emerald-400/80" : "text-emerald-600/90")}>
                          Input angka mesin saat ini
                        </p>
                      </div>
                    </div>
                    {errors.meterAkhir && (
                      <span className="text-red-500 text-[10px] font-bold block -mt-1">
                        {errors.meterAkhir.message}
                      </span>
                    )}

                    {/* Total Hasil Produksi Highlight Banner */}
                    <div
                      className={cn(
                        "p-3 rounded-2xl border flex items-center justify-between transition-colors shadow-2xs",
                        isDark ? "bg-emerald-950/40 border-emerald-800/80" : "bg-emerald-50/90 border-emerald-200"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                            isDark ? "bg-emerald-900/60 text-emerald-300" : "bg-emerald-200/70 text-emerald-800"
                          )}
                        >
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <span className={cn("text-[9.5px] font-extrabold uppercase tracking-wider block", isDark ? "text-emerald-300" : "text-emerald-900")}>
                            Total Hasil Produksi
                          </span>
                          <span className={cn("text-[9px] font-medium block", isDark ? "text-emerald-400/80" : "text-emerald-700/80")}>
                            Finish Meter - Start Meter (Otomatis)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 text-right">
                        <input
                          type="hidden"
                          {...register("hasilProduksiMeter")}
                        />
                        <span className={cn("text-2xl sm:text-3xl font-black font-mono", isDark ? "text-emerald-300" : "text-emerald-600")}>
                          {watch("hasilProduksiMeter") || "0"}
                        </span>
                        <span className={cn("text-xs font-black", isDark ? "text-emerald-400" : "text-emerald-700")}>m</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Jenis Laporan Meter */}
                <div
                  className={cn(
                    "border p-3 rounded-2xl flex flex-col gap-1.5 transition-colors",
                    isDark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
                  )}
                >
                  <label className={cn("text-[10px] font-black uppercase tracking-wider transition-colors", isDark ? "text-slate-400" : "text-slate-600")}>
                    Jenis Laporan Meter
                  </label>
                  <input type="hidden" id="jenisLaporan" {...register("jenisLaporan")} />
                  {isLastRoll ? (
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setValue("jenisLaporan", "", { shouldDirty: true, shouldValidate: true })}
                        className={cn(
                          "w-full px-3 py-2.5 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center text-center gap-1 shadow-xs cursor-pointer",
                          isDark
                            ? "border-sky-500 bg-sky-950/50 text-sky-300"
                            : "border-[#0070bc] bg-sky-50 text-[#0070bc]"
                        )}
                      >
                        <span className="block font-black uppercase">Laporan Potong Kain</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setValue("jenisLaporan", "", { shouldDirty: true, shouldValidate: true })}
                          className={cn(
                            "px-2 py-2 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center justify-center text-center gap-0.5 shadow-2xs active:scale-[0.98] cursor-pointer",
                            watchJenisLaporan === ""
                              ? isDark
                                ? "border-sky-500 bg-sky-950/60 text-sky-300"
                                : "border-[#0070bc] bg-sky-50 text-[#0070bc] shadow-xs"
                              : isDark
                                ? "border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-850"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <span className="block font-black text-[11px] uppercase">Oper Shift</span>
                          <span className="block text-[8.5px] opacity-75 font-semibold">Laporan Akhir</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setValue("jenisLaporan", "Mulai Istirahat", { shouldDirty: true, shouldValidate: true })}
                          className={cn(
                            "px-2 py-2 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center justify-center text-center gap-0.5 shadow-2xs active:scale-[0.98] cursor-pointer",
                            watchJenisLaporan === "Mulai Istirahat"
                              ? isDark
                                ? "border-amber-500 bg-amber-950/60 text-amber-300"
                                : "border-amber-500 bg-amber-50 text-amber-700 shadow-xs"
                              : isDark
                                ? "border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-850"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <span className="block font-black text-[11px] uppercase">Istirahat</span>
                          <span className="block text-[8.5px] opacity-75 font-semibold">Mau Istirahat</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setValue("jenisLaporan", "Selesai Istirahat", { shouldDirty: true, shouldValidate: true })}
                          className={cn(
                            "px-2 py-2 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center justify-center text-center gap-0.5 shadow-2xs active:scale-[0.98] cursor-pointer",
                            watchJenisLaporan === "Selesai Istirahat"
                              ? isDark
                                ? "border-emerald-500 bg-emerald-950/60 text-emerald-300"
                                : "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xs"
                              : isDark
                                ? "border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-850"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <span className="block font-black text-[11px] uppercase">Masuk</span>
                          <span className="block text-[8.5px] opacity-75 font-semibold">Masuk Kembali</span>
                        </button>
                      </div>

                      {(watchJenisLaporan === "Mulai Istirahat" || watchJenisLaporan === "Selesai Istirahat") && (
                        <div
                          className={cn(
                            "mt-2 p-2.5 rounded-xl border transition-colors",
                            isDark ? "bg-amber-950/30 border-amber-800/60" : "bg-amber-50 border-amber-200"
                          )}
                        >
                          <label className={cn("text-[9.5px] font-black uppercase block mb-1 transition-colors", isDark ? "text-amber-300" : "text-amber-800")}>
                            Siapa yang menjaga mesin (Backup) - Shift {activeShiftName}?
                          </label>
                          <select
                            value={backupOperator}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBackupOperator(val);
                              const currentOperatorId = watch("operatorId");
                              const currentOp = operators.find((o) => o.id.toString() === currentOperatorId);
                              const shiftToUse = currentOp?.shift || activeShiftName;
                              try {
                                if (val) {
                                  localStorage.setItem(`dji_last_backup_operator_${shiftToUse}`, val);
                                } else {
                                  localStorage.removeItem(`dji_last_backup_operator_${shiftToUse}`);
                                }
                              } catch {}
                            }}
                            className={cn(
                              "w-full h-9 px-3 rounded-lg border text-xs font-semibold outline-none transition-colors",
                              isDark
                                ? "bg-slate-900 border-amber-800/80 text-slate-200 focus:ring-2 focus:ring-amber-500"
                                : "bg-white border-amber-300 text-slate-700 focus:ring-2 focus:ring-amber-400"
                            )}
                          >
                            <option value="">-- Pilih Operator Backup (Shift {activeShiftName}) --</option>
                            {(() => {
                              const currentOperatorId = watch("operatorId");
                              const currentOp = operators.find((o) => o.id.toString() === currentOperatorId);
                              const shiftToUse = currentOp?.shift || activeShiftName;
                              const backupOps = operators.filter(
                                (o) => o.shift === shiftToUse && o.id.toString() !== currentOperatorId?.toString()
                              );
                              if (backupOps.length === 0) {
                                return <option value="" disabled>Tidak ada operator lain di Shift {shiftToUse}</option>;
                              }
                              return backupOps.map((op) => (
                                <option key={op.id} value={op.name}>{op.name}</option>
                              ));
                            })()}
                          </select>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6 relative z-10">
                {watch("nomorMc") === "T2A" && !isMeterAwalLocked ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const target = watch("meterAwal");
                        if (
                          !target ||
                          target.trim() === "" ||
                          target === "0"
                        ) {
                          setErrorMsg(
                            "Masukkan Target Produksi terlebih dahulu.",
                          );
                          return;
                        }
                        localStorage.setItem(
                          "dji_form_draft_continuous",
                          JSON.stringify(watch()),
                        );
                        setIsMeterModalOpen(false);
                        setErrorMsg(null);
                        setSuccessData({ isTargetSaved: true } as any);
                      }}
                      className="flex-1 py-3.5 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex justify-center items-center gap-2 text-sm"
                    >
                      <Save className="w-4 h-4" />
                      Simpan
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (isSubmitting || isProcessingSubmit) return;
                        setIsProcessingSubmit(true);
                        try {
                          await refreshAutomaticMeterStart();
                          const isValid = await trigger([
                            "meterAwal",
                            "meterAkhir",
                          ]);
                          if (!isValid) {
                            setIsProcessingSubmit(false);
                            return;
                          }

                          const currentMc = watch("nomorMc");
                          const currentMeterAkhir = parseFloat(
                            watch("meterAkhir") || "0",
                          );
                          if (currentMc === "T2A" && currentMeterAkhir === 0) {
                            setIsLastRoll(true);
                            setValue(
                              "tanggalPotong",
                              getJakartaDateString(),
                            );
                          }

                          const currentPcs = watch("pcsData") || [];
                          const cleanPcs = currentPcs.map((pcs) => ({
                            ...pcs,
                            indikatorStop: false,
                            kategoriMasalah: [],
                            detailMasalahMap: undefined,
                            detailMasalah: "",
                            spesifikMasalah: "",
                            keteranganCacat: "",
                          }));
                          setValue("pcsData", cleanPcs);
                          setValue("totalDowntime", "");

                          setIsMeterModalOpen(false);
                          handleSubmit(onSubmit, onInvalid)();
                        } catch (err) {
                          setIsProcessingSubmit(false);
                        }
                      }}
                      disabled={isSubmitting || isProcessingSubmit}
                      className={cn(
                        "flex-1 py-3.5 active:scale-95 text-white font-bold rounded-xl transition-all flex justify-center items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed",
                        isDark
                          ? "bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-lg shadow-blue-900/30"
                          : "bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/20"
                      )}
                    >
                      {isSubmitting || isProcessingSubmit ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Kirim
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsMeterModalOpen(false)}
                      className={cn(
                        "flex-1 py-3.5 font-bold rounded-xl transition-colors text-sm cursor-pointer",
                        isDark
                          ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                      )}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (isSubmitting || isProcessingSubmit) return;
                        setIsProcessingSubmit(true);
                        try {
                          await refreshAutomaticMeterStart();
                          const isValid = await trigger([
                            "meterAwal",
                            "meterAkhir",
                          ]);
                          if (!isValid) {
                            setIsProcessingSubmit(false);
                            return;
                          }

                          const currentMc = watch("nomorMc");
                          const currentMeterAkhir = parseFloat(
                            watch("meterAkhir") || "0",
                          );

                          // JIKA OPERATOR SEBELUMNYA BELUM FINISH DAN INI ADALAH LAPORAN OPER SHIFT:
                          // Simpan serah terima shift secara otomatis agar header penutup tercatat atas nama operator lama!
                          if (handoverWarning?.needsMeterAwal && watchJenisLaporan === "") {
                            const lastMeter = handoverWarning?.lastMeter || 0;
                            if (currentMeterAkhir < lastMeter) {
                              setErrorMsg(`Counter meter tidak boleh lebih kecil dari ${lastMeter}m (meter tercatat sebelumnya).`);
                              setIsProcessingSubmit(false);
                              return;
                            }

                            try {
                              setIsSubmitting(true);
                              setErrorMsg(null);
                              const res = await submitOperatorHandover({
                                nomorMc: watch("nomorMc"),
                                potonganKe: watch("potonganKe"),
                                incomingOperator: getOperatorName(watch("operatorId")),
                                handoverMeter: currentMeterAkhir,
                              });

                              if (res.success) {
                                setValue("meterAwal", String(res.handoverMeter), {
                                  shouldDirty: false,
                                  shouldValidate: false,
                                });
                                setValue("meterAkhir", "");
                                setValue("hasilProduksiMeter", "");
                                setIsMeterAwalLocked(true);
                                setHandoverWarning(null);
                                setIsMeterModalOpen(false);
                                setSuccessMsg(`Serah terima shift berhasil! Shift ${res.lastOperatorName} telah ditutup pada meter ${res.handoverMeter}m. Shift Anda dimulai dari ${res.handoverMeter}m.`);
                                return;
                              } else {
                                setErrorMsg(res.message || "Gagal melakukan serah terima shift.");
                                return;
                              }
                            } catch (err: any) {
                              setErrorMsg(err?.message || "Terjadi kesalahan saat serah terima shift.");
                              return;
                            } finally {
                              setIsSubmitting(false);
                              setIsProcessingSubmit(false);
                            }
                          }

                          if (currentMc === "T2A" && currentMeterAkhir === 0) {
                            setIsLastRoll(true);
                            setValue(
                              "tanggalPotong",
                              getJakartaDateString(),
                            );
                          }

                          const currentPcs = watch("pcsData") || [];
                          const cleanPcs = currentPcs.map((pcs) => ({
                            ...pcs,
                            indikatorStop: false,
                            kategoriMasalah: [],
                            detailMasalahMap: undefined,
                            detailMasalah: "",
                            spesifikMasalah: "",
                            keteranganCacat: "",
                          }));
                          setValue("pcsData", cleanPcs);
                          setValue("totalDowntime", "");

                          setIsMeterModalOpen(false);
                          handleSubmit(onSubmit, onInvalid)();
                        } catch (err) {
                          setIsProcessingSubmit(false);
                        }
                      }}
                      disabled={isSubmitting || isProcessingSubmit}
                      className={cn(
                        "flex-[2] py-3.5 active:scale-95 text-white font-bold rounded-xl transition-all flex justify-center items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed",
                        isDark
                          ? "bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-lg shadow-blue-900/30"
                          : "bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/20"
                      )}
                    >
                      {isSubmitting || isProcessingSubmit ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {handoverWarning?.needsMeterAwal && watchJenisLaporan === "" ? "Simpan Serah Terima Shift" : "Simpan & Kirim Meteran"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Interactive Tour Guide */}
      <ProductTour
        steps={METER_TOUR_STEPS}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        accentClass="text-emerald-600"
        buttonClass="bg-emerald-600 hover:bg-emerald-700"
      />

      {/* Modal Sukses */}
      {successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center animate-scaleIn text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            {(successData as any).isTargetSaved ? (
              <>
                <h4 className="text-lg font-bold text-slate-800">
                  Target Tersimpan
                </h4>
                <p className="text-xs text-slate-500 mt-1 mb-5">
                  Target Produksi {watch("meterAwal")} meter telah disimpan
                  untuk potongan ke-{watch("potonganKe")}.
                </p>
                <button
                  onClick={() => setSuccessData(null)}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl active:scale-95 transition-all text-sm"
                >
                  OK
                </button>
              </>
            ) : (
              <>
                <h4 className="text-lg font-bold text-slate-800">
                  {(successData as any).isOfflineSaved
                    ? "Tersimpan Offline"
                    : "Laporan Berhasil Disimpan"}
                </h4>
                <p className="text-xs text-slate-500 mt-1 mb-5">
                  {(successData as any).isOfflineSaved
                    ? (successData as any).isCutSubmit
                      ? `Tanggal potong Potongan ke-${successData.potonganKe} antre dikirim otomatis saat sinyal pulih.`
                      : `Data Potongan ke-${successData.potonganKe} antre dikirim otomatis saat sinyal pulih.`
                    : (successData as any).isCutSubmit
                      ? `Laporan meteran Potongan ke-${successData.potonganKe} terekam. Tanggal potong juga diupdate pada semua data sebelumnya.`
                      : `Data laporan untuk Potongan ke-${successData.potonganKe} telah terekam.`}
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
                  className="w-full py-3 bg-[#0070bc] hover:bg-[#005a96] text-white font-bold rounded-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-sky-900/10"
                >
                  <span>{isEdit ? "Kembali ke Riwayat" : "Input Masalah Berikutnya"}</span>
                  <span className="text-xs font-mono bg-white/20 px-1.5 py-0.5 rounded-md">
                    ({successAutoCloseSeconds}s)
                  </span>
                </button>
                <div className="w-full mt-3">
                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0070bc] transition-all duration-1000 ease-linear rounded-full"
                      style={{ width: `${(successAutoCloseSeconds / 3) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">
                    Menutup otomatis dalam {successAutoCloseSeconds} detik...
                  </p>
                </div>
              </>
            )}
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div
            className={cn(
              "w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center animate-scaleIn text-center relative overflow-hidden transition-colors border",
              isDark
                ? "bg-slate-900 border-slate-800 text-slate-100"
                : "bg-white border-slate-100 text-slate-800"
            )}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-sky-500"></div>
            <div
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors",
                isDark ? "bg-sky-950/70 text-sky-400 border border-sky-800/60" : "bg-sky-50 text-sky-500"
              )}
            >
              <AlertCircle className="w-8 h-8" />
            </div>
            <h4 className={cn("text-lg font-bold transition-colors", isDark ? "text-slate-100" : "text-slate-800")}>
              {pcsConfirmModal.actionType === "increment"
                ? "Tambah PCS?"
                : "Hapus PCS?"}
            </h4>
            <p className={cn("text-sm mt-2 mb-6 leading-relaxed transition-colors", isDark ? "text-slate-400" : "text-slate-600")}>
              {pcsConfirmModal.actionType === "increment"
                ? `Apakah Anda yakin ingin menambah jumlah PCS menjadi ${pcsConfirmModal.targetCount} pcs?`
                : `Apakah Anda yakin ingin mengurangi jumlah PCS menjadi ${pcsConfirmModal.targetCount} pcs? Kolom isian meter untuk PCS di atas nomor tersebut akan hilang.`}
            </p>
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={() => setPcsConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className={cn(
                  "flex-1 py-3 font-bold rounded-xl active:scale-95 transition-all text-sm cursor-pointer",
                  isDark
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                )}
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
                        meterKain: "",
                      });
                    }
                  } else {
                    for (let i = fields.length - 1; i >= pcsConfirmModal.targetCount; i--) {
                      remove(i);
                    }
                  }
                  setPcsConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                className="flex-1 py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl active:scale-95 transition-all text-sm cursor-pointer"
              >
                Ya, Ubah
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SERAH TERIMA SHIFT (PERGANTIAN OPERATOR) */}
      {isHandoverModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
            onClick={() => !isSubmittingHandover && setIsHandoverModalOpen(false)}
          />
          <div
            className={cn(
              "relative rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border flex flex-col transition-colors",
              isDark
                ? "bg-slate-900 border-slate-800 text-slate-100"
                : "bg-white border-slate-100 text-slate-900"
            )}
          >
            {/* Header Modal */}
            <div
              className={cn(
                "px-6 py-5 border-b flex items-center justify-between transition-colors",
                isDark
                  ? "bg-slate-950/80 border-slate-800"
                  : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200/80"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={cn("text-base font-black tracking-tight", isDark ? "text-slate-100" : "text-slate-900")}>
                    Serah Terima Shift
                  </h3>
                  <p className={cn("text-xs font-semibold", isDark ? "text-slate-400" : "text-slate-500")}>
                    Mesin {watchNomorMc} • Potongan #{watchPotonganKe}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmittingHandover}
                onClick={() => setIsHandoverModalOpen(false)}
                className={cn(
                  "p-2 rounded-full transition-colors cursor-pointer",
                  isDark
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-6 flex flex-col gap-4">
              {/* Card info status operator */}
              <div
                className={cn(
                  "p-4 border rounded-2xl flex items-start gap-3 transition-colors",
                  isDark
                    ? "bg-amber-950/30 border-amber-800/60 text-amber-200"
                    : "bg-amber-50/80 border-amber-200 text-amber-900"
                )}
              >
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs font-semibold leading-relaxed">
                  {(() => {
                    const lastOp = handoverWarning?.lastOperator || "sebelumnya";
                    const lastM = handoverWarning?.lastMeter || 0;
                    const startM = handoverWarning?.opStartMeter || 0;

                    if (lastM > startM && startM > 0) {
                      return (
                        <>
                          Pergantian operator dari <strong>{lastOp}</strong> (mulai dari <strong>{startM}m</strong>, terakhir tercatat di <strong>{lastM}m</strong> belum lapor finish).
                        </>
                      );
                    }
                    if (startM > 0) {
                      return (
                        <>
                          Pergantian operator dari <strong>{lastOp}</strong> (mulai dari <strong>{startM}m</strong>, belum lapor finish).
                        </>
                      );
                    }
                    if (lastM > 0) {
                      return (
                        <>
                          Pergantian operator dari <strong>{lastOp}</strong> (tercatat s.d. <strong>{lastM}m</strong> belum lapor finish).
                        </>
                      );
                    }
                    return (
                      <>
                        Pergantian operator dari <strong>{lastOp}</strong> (potongan baru dari <strong>0m</strong>, belum lapor finish).
                      </>
                    );
                  })()}
                  <div className={cn("mt-1 text-[11px] font-medium", isDark ? "text-amber-300/80" : "text-amber-800")}>
                    Masukkan counter meter mesin saat serah terima agar sisa produksi operator sebelumnya tertutup otomatis dan shift Anda (<strong>{getOperatorName(watch("operatorId"))}</strong>) dimulai dari meter tersebut.
                  </div>
                </div>
              </div>

              {/* Input counter meter */}
              <div className="flex flex-col gap-1.5">
                <label className={cn("text-xs font-black uppercase tracking-wider flex items-center justify-between", isDark ? "text-slate-300" : "text-slate-700")}>
                  <span>Counter Meter Saat Serah Terima</span>
                  <span
                    className={cn(
                      "text-[9px] font-black px-2 py-0.5 rounded-full uppercase transition-colors",
                      isDark ? "bg-amber-950/80 text-amber-300 border border-amber-800/60" : "bg-amber-100 text-amber-700"
                    )}
                  >
                    Wajib Diisi
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    autoFocus
                    value={handoverInputMeter}
                    onChange={(e) => {
                      setHandoverInputMeter(e.target.value);
                      setHandoverModalError(null);
                    }}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    placeholder={`Misal: ${handoverWarning?.lastMeter ? handoverWarning.lastMeter + 10 : 100}`}
                    className={cn(
                      "w-full h-13 px-4 pr-16 rounded-2xl border-2 text-lg font-black outline-none transition-all shadow-inner",
                      isDark
                        ? "bg-slate-950 border-slate-800 text-white focus:border-amber-500 focus:bg-slate-900"
                        : "bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500 focus:bg-white"
                    )}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase">
                    Meter
                  </span>
                </div>
              </div>

              {/* Live Preview Kalkulasi */}
              {(() => {
                const inputNum = parseFloat(handoverInputMeter);
                const lastMeter = handoverWarning?.lastMeter || 0;
                const startMeter = handoverWarning?.opStartMeter || 0;
                const baseStart = startMeter > 0 ? startMeter : 0;

                if (!isNaN(inputNum)) {
                  if (inputNum < lastMeter) {
                    return (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-bold text-red-500 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <span>Counter meter tidak boleh kurang dari {lastMeter}m!</span>
                      </div>
                    );
                  }
                  const diff = Math.max(0, inputNum - baseStart);
                  return (
                    <div
                      className={cn(
                        "p-3 border rounded-xl flex flex-col gap-1 text-[11px] font-semibold transition-colors",
                        isDark ? "bg-slate-950/60 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200/80 text-slate-600"
                      )}
                    >
                      <div className="flex justify-between">
                        <span>Sisa produksi {handoverWarning?.lastOperator}:</span>
                        <span className={cn("font-bold", isDark ? "text-slate-200" : "text-slate-800")}>+{diff} meter ({baseStart}m &rarr; {inputNum}m)</span>
                      </div>
                      <div
                        className={cn(
                          "flex justify-between border-t pt-1 font-bold",
                          isDark ? "border-slate-800 text-emerald-400" : "border-slate-200/60 text-emerald-700"
                        )}
                      >
                        <span>Shift Anda dimulai dari:</span>
                        <span>{inputNum} meter</span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Error Message */}
              {handoverModalError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-bold text-red-500 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{handoverModalError}</span>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div
              className={cn(
                "px-6 py-4 border-t flex items-center justify-end gap-2.5 transition-colors",
                isDark ? "bg-slate-950/80 border-slate-800" : "bg-slate-50 border-slate-100"
              )}
            >
              <button
                type="button"
                disabled={isSubmittingHandover}
                onClick={() => setIsHandoverModalOpen(false)}
                className={cn(
                  "px-5 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer",
                  isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-200/70"
                )}
              >
                Nanti Saja
              </button>
              <button
                type="button"
                disabled={isSubmittingHandover}
                onClick={handleConfirmHandover}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs rounded-xl shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-70 disabled:pointer-events-none"
              >
                {isSubmittingHandover ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Konfirmasi & Mulai Shift
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL UBAH HEADER */}
      <ProductionHeaderModal
        isOpen={isHeaderModalOpen}
        onClose={() => {
          setIsHeaderModalOpen(false);
          setHighlightPotonganKe(false);
          setHighlightOperator(false);
          try {
            const currentHeader = {
              nomorMc: watch("nomorMc"),
              operatorId: watch("operatorId"),
              groupId: watchGroupId,
              potonganKe: watch("potonganKe"),
              designId: watch("designId"),
              rpm: watch("rpm"),
              pick: watch("pick"),
              course: watch("course"),
              statusMatching: watch("statusMatching"),
              noOrderBarang: watch("noOrderBarang"),
              noCustomer: watch("noCustomer"),
              jenisBenangDasar: watch("jenisBenangDasar"),
              liner: watch("liner"),
              heavy: watch("heavy"),
              shadow: watch("shadow"),
              pinggiran: watch("pinggiran"),
            };
            localStorage.setItem("dji_form_header", JSON.stringify(currentHeader));
          } catch (e) {}
          checkAndPromptHandover();
        }}
        register={register}
        errors={errors}
        watch={watch}
        setValue={setValue}
        groups={groups}
        operators={activeOperators.length > 0 ? activeOperators : operators}
        activeShiftName={activeShiftName}
        onClearHeader={handleClearHeader}
        highlightPotonganKe={highlightPotonganKe}
        highlightOperator={highlightOperator}
        pcsCount={fields.length}
        onChangePcsCount={handleChangePcsCount}
      />

      {/* MODAL LAPOR MESIN BERHENTI / MATI */}
      <MachineStopModal
        isOpen={isStopModalOpen}
        onClose={() => setIsStopModalOpen(false)}
        nomorMc={watch("nomorMc") || ""}
        operatorId={watch("operatorId") || ""}
        operatorName={getOperatorName(watch("operatorId")) || ""}
        groupId={watchGroupId || "1"}
        shiftName={activeShiftName}
        potonganKe={watch("potonganKe")}
        designId={watch("designId") || ""}
        rpm={watch("rpm") || ""}
        pick={watch("pick") || ""}
        course={watch("course") || ""}
        onSuccess={(msg) => {
          setStopModalSuccessMsg(msg || "Laporan mesin berhenti berhasil disimpan!");
          setTimeout(() => setStopModalSuccessMsg(null), 7000);
        }}
      />

      {/* SLIDE-OVER DRAWER RIWAYAT SHIFT */}
      <ContinuousHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        currentNomorMc={watch("nomorMc")}
        currentPotonganKe={watch("potonganKe")}
        panelType="METERAN"
      />

      {/* FULLSCREEN LOADING OVERLAY SAAT MENGIRIM DATA / KENDALA */}
      {(isSubmitting || isProcessingSubmit) && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-md transition-all animate-fadeIn select-none p-4">
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-7 sm:p-8 shadow-2xl shadow-slate-950/20 border border-slate-200/80 overflow-hidden text-center flex flex-col items-center animate-scaleIn">
            {/* Ambient Background Glow */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-28 bg-sky-100/80 rounded-full blur-2xl pointer-events-none" />

            {/* High-Tech Animated Radar / Dual-Ring Loader */}
            <div className="relative w-20 h-20 flex items-center justify-center mb-5">
              <div className="absolute inset-0 rounded-full bg-sky-400/15 blur-xl animate-pulse" />
              <div className="absolute inset-0 rounded-full border-2 border-slate-100 border-t-[#0070bc] border-r-sky-400 animate-spin" />
              <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0070bc] to-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/30">
                <UploadCloud className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Tag / Category Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200/80 text-slate-600 text-[10px] font-extrabold uppercase tracking-wider mb-2">
              <Database className="w-3 h-3 text-[#0070bc]" />
              <span>Sinkronisasi Data</span>
            </div>

            {/* Title & Description */}
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Mengirim Data Laporan...
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium max-w-xs">
              Mohon tunggu sebentar, sistem sedang merekam transaksi dan kendala ke server database.
            </p>

            {/* Shimmer Animated Progress Bar */}
            <div className="w-full mt-5 mb-4">
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0070bc] to-transparent w-full animate-progressShimmer" />
              </div>
            </div>

            {/* Safety Notice Badge (Clean SVG Icon, No Emojis) */}
            <div className="flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-500 text-[11px] font-semibold">
              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Jangan tutup atau me-refresh halaman</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
