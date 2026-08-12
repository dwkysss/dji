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
} from "@/actions/continuous-actions";
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
  Send,
  Scissors,
  AlertTriangle,
  Info,
  Lock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import HeaderSummaryCard from "./HeaderSummaryCard";
import dynamic from "next/dynamic";

// Dynamic imports: code-split heavy components to reduce initial JS bundle
const ProductionHeaderModal = dynamic(() => import("./ProductionHeaderModal"), {
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

const METER_TOUR_STEPS = [
  {
    target: "meter-mode-switch",
    title: "Jenis Input Meteran",
    description:
      "Mode Kontinu digunakan untuk input per roll atau meteran. Kalau hanya input per panel, pindah ke mode Panel.",
  },
  {
    target: "meter-final-report",
    title: "Laporan Meteran Akhir",
    description:
      "Gunakan tombol ini saat shift selesai atau roll sudah dipotong untuk mengisi start meter, finish meter, dan total produksi.",
  },
  {
    target: "meter-header-summary",
    title: "Data Header",
    description:
      "Cek operator, shift, mesin, design, status matching, dan potongan sebelum mengirim data meteran atau titik cacat.",
  },
  {
    target: "meter-pcs-detail",
    title: "Titik Cacat per PCS",
    description:
      "Centang jika ada cacat atau kendala, lalu pilih kategori dan minimal satu detail masalah.",
  },
  {
    target: "meter-pcs-detail",
    title: "Timer Downtime",
    description:
      "Saat kendala dicentang, timer downtime muncul. Mulai saat masalah terjadi dan stop saat mesin kembali jalan.",
  },
  {
    target: "meter-cut-roll",
    title: "Potong Kain",
    description:
      "Centang ini hanya untuk potongan terakhir dalam roll, lalu lanjut isi total produksi meteran.",
  },
  {
    target: "meter-submit-defect",
    title: "Kirim Titik Cacat",
    description:
      "Gunakan tombol ini untuk mengirim laporan titik cacat tanpa mengisi laporan meteran akhir.",
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
  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<
    (ContinuousFormInput & { id?: string }) | null
  >(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [backupOperator, setBackupOperator] = useState("");
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourRect, setTourRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

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
  const [isLastRoll, setIsLastRoll] = useState(false);
  const [showAdvancedActions, setShowAdvancedActions] = useState(false);
  const [activeInfo, setActiveInfo] = useState<string | null>(null);
  const [showReportCardInfo, setShowReportCardInfo] = useState(false);

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
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
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

  useEffect(() => {
    const startMeterTour = () => {
      if (isEdit) return;
      setTourStepIndex(0);
      setIsMeterModalOpen(false);
      setIsTourOpen(true);
    };

    window.addEventListener("dji:start-meter-tour", startMeterTour);
    return () =>
      window.removeEventListener("dji:start-meter-tour", startMeterTour);
  }, [isEdit]);

  useEffect(() => {
    if (!isTourOpen) return;

    const currentStep = METER_TOUR_STEPS[tourStepIndex];
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
    if (watchJenisLaporan === "Selesai Istirahat") {
      refreshAutomaticMeterStart();
    }
  }, [watchJenisLaporan]);

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
      setValue("meterAwal", nextMeterStart, {
        shouldDirty: false,
        shouldValidate: Boolean(getValues("meterAkhir")),
      });
      setIsMeterAwalLocked(true);
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
        setValue("meterAwal", nextMeterStartStr, {
          shouldDirty: false,
          shouldValidate: Boolean(watchMeterAkhir),
        });
        setIsMeterAwalLocked(true);
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
        if (plan.rpm) setValue("rpm", plan.rpm);
        if (plan.pcs_count && typeof plan.pcs_count === "number") {
          handleChangePcsCount(plan.pcs_count, true);
        }
      }
    }, 600); // Add 600ms delay mirip getLastPanelNoByPotongan

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [isEdit, watchMeterAkhir, watchNomorMc, watchPotonganKe, watchJenisLaporan, setValue]);

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
    setErrorMsg(msg || "Terdapat kesalahan validasi. Silakan periksa form.");
  };

  const onSubmit = async (data: ContinuousFormInput) => {
    const currentMc = data.nomorMc || getValues("nomorMc") || watch("nomorMc") || "";
    if (currentMc && machineInputTypes[currentMc.toUpperCase()] === "PANEL") {
      setIsSubmitting(false);
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

    // Otomatis set isPanelGagal jika ada PCS yang BS
    if (data.pcsData?.some((p) => p.isBs)) {
      data.isPanelGagal = true;
    }

    // Ambil nama operator asli
    data.pic = getOperatorName(data.operatorId) || "";
    data.grupName = getGroupName(data.groupId);
    data.designName = getDesignName(data.designId);
    data.created_by_name = user?.fullName || null;

    if (backupOperator) {
      data.backupOperator = backupOperator;
    }

    const isIstirahatReport = data.jenisLaporan === "Mulai Istirahat" || data.jenisLaporan === "Selesai Istirahat";
    const meterAkhirNum = parseFormMeterValue(data.meterAkhir);
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
          setErrorMsg(`Finish Meter (${meterAkhirNum}m) tidak boleh lebih besar dari Target (${meterAwalNum}m).`);
          return;
        }
      } else {
        if (meterAkhirNum <= meterAwalNum) {
          setIsSubmitting(false);
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

      let result;
      if (isEdit && initialData?.id) {
        result = await updateContinuousReport(initialData.id, data);
      } else {
        result = await submitContinuousReport(data);
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

    let nextJenisLaporan = watch("jenisLaporan");
    if (nextJenisLaporan === "Mulai Istirahat") {
      nextJenisLaporan = "Selesai Istirahat";
    } else if (nextJenisLaporan === "Selesai Istirahat") {
      nextJenisLaporan = "";
    }

    const submittedMeterAkhir = successData?.meterAkhir;
    const nextMeterAwal = (submittedMeterAkhir && String(submittedMeterAkhir).trim() !== "" && !wasLastRoll)
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
      downtimeEvents: [],
    });

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

  const currentTourStep = METER_TOUR_STEPS[tourStepIndex];
  const isLastTourStep = tourStepIndex === METER_TOUR_STEPS.length - 1;
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

  return (
    <div className="w-full bg-gradient-to-br from-emerald-50/40 via-white to-white border border-[#e9ecef] rounded-[24px] p-6 sm:p-8 shadow-[0_8px_30px_rgba(16,185,129,0.06)] text-slate-800 relative overflow-hidden">
      {/* Decorative background shape */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-100/30 via-emerald-50/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none -z-10"></div>

      <div className="relative">
        {/* Segmented Control for Mode Switching */}
        <div
          data-tour="meter-mode-switch"
          className="flex w-full bg-slate-100/80 p-1.5 rounded-2xl mb-8 border border-slate-200/60 shadow-inner"
        >
          <a
            href="/input"
            className="flex-1 flex items-center justify-center py-3.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-white/60 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5 opacity-70 hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                <Box className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-black uppercase tracking-wider leading-none">
                  PANEL
                </span>
              </div>
            </div>
          </a>
          <div className="flex-1 flex items-center justify-center py-3.5 rounded-xl bg-white shadow-sm border border-slate-200 text-emerald-600 relative overflow-hidden group cursor-default">
            <div className="absolute inset-0 bg-emerald-50/50 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <div className="relative flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <ClipboardList className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-black uppercase tracking-wider leading-none">
                  METER
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-100 pb-4 mb-6 gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Form Input Produksi (Meteran)
              </h3>
              <p className="text-xs text-slate-400 font-normal mt-1">
                Data Header akan otomatis tersimpan untuk roll/meteran berikutnya.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsHistoryDrawerOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 text-xs font-black shadow-md shadow-amber-200 transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <History className="w-4 h-4 stroke-[2.5]" />
              <span>Riwayat Shift Ini</span>
            </button>
          </div>

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
              <strong className="block font-bold mb-1">Perhatian Saat Mengedit Data</strong>
              Form ini mengedit <b>seluruh laporan (termasuk PCS/potongan lain)</b>. Jangan menekan tombol "Hapus" pada potongan lain kecuali Anda benar-benar ingin menghapusnya secara permanen dari laporan. Tambahkan/edit masalah langsung melalui tombol <b>Tambah Masalah</b>.
            </div>
          </div>
        )}


        <form
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          className="space-y-4"
        >
          <div className="bg-white border border-slate-200 shadow-sm rounded-[20px] p-3 sm:p-4 lg:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-[3fr_2fr] gap-3 sm:gap-4 lg:gap-5 items-stretch">
              <div data-tour="meter-header-summary" className="w-full h-full">
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

              {/* Tombol Pemicu Pop-up Meteran */}
              <div
                data-tour="meter-final-report"
                className="w-full min-h-full p-3 sm:p-4 lg:p-6 bg-emerald-50/80 border-2 border-emerald-200 rounded-2xl relative shadow-md flex flex-col justify-center"
              >
                <button
                  type="button"
                  onClick={() => setShowReportCardInfo((prev) => !prev)}
                  className={`absolute top-2.5 right-2.5 transition-colors z-20 cursor-pointer p-0.5 rounded-full ${showReportCardInfo
                      ? "text-emerald-900"
                      : "text-emerald-600/80 hover:text-emerald-800"
                    }`}
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

                <div className="absolute -top-3.5 lg:-top-4 left-1/2 -translate-x-1/2 bg-emerald-600 px-3 lg:px-5 py-1 lg:py-1.5 text-[9px] lg:text-[11px] font-black text-white uppercase tracking-widest border-2 border-white rounded-full shadow-md whitespace-nowrap">
                  {watch("nomorMc") === "T2A"
                    ? "Laporan Meter"
                    : "Laporan Hasil"}
                </div>

                <div className="mt-3 flex flex-col items-center justify-center text-center gap-4">
                  <div>
                    <h4 className="text-sm sm:text-base lg:text-lg font-black text-emerald-900">
                      {watch("nomorMc") === "T2A"
                        ? "Laporan Meter"
                        : "Laporan Istirahat dan Shift"}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await refreshAutomaticMeterStart();
                      setIsMeterModalOpen(true);
                    }}
                    className="w-full max-w-xs px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-sm font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <FileText className="w-5 h-5" />
                    {watch("nomorMc") === "T2A"
                      ? "Lapor Meter"
                      : "Lapor Meter Terakhir"}
                  </button>
                </div>
              </div>
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

          <div className="flex flex-col w-full mb-6">
            <div data-tour="downtime" className="w-full">
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
                isPanelType={false}
              />
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
            className="w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-xl border-2 border-rose-300 border-dashed text-rose-600 font-bold text-sm hover:bg-rose-50 hover:text-rose-700 hover:border-rose-400 transition-all duration-200"
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
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 mt-6">
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
                  if (watch("nomorMc") !== "T2A") {
                    setValue("meterAwal", "");
                  }
                  setValue("meterAkhir", "");
                  handleSubmit(onSubmit, onInvalid)();
                }}
                disabled={isSubmitting}
                className={`w-full h-12 rounded-xl active:scale-[0.99] disabled:opacity-50 text-white text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-md ${isLastRoll ? "bg-slate-400 hover:bg-slate-500" : "bg-[#0070bc] hover:bg-[#004777]"}`}
              >
                {isSubmitting ? (
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
                className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl flex flex-col animate-scaleIn relative overflow-hidden max-h-[95vh] md:max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 opacity-10"></div>

                <div className="flex justify-between items-center mb-6 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800">
                        {isLastRoll ? "Laporan Potong Kain" : "Laporan Meteran"}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {isLastRoll ? "Isi meteran untuk potong kain" : "Isi di akhir shift"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMeterModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4 relative z-10 overflow-y-auto max-h-[48vh] sm:max-h-[58vh] pr-1 -mr-1 custom-scrollbar">
                  {watch("nomorMc") === "T2A" ? (
                    <div className="space-y-3">
                      {isMeterAwalLocked && originalT2ATarget !== null && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <ClipboardList className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-blue-800 uppercase">
                              Target Produksi Awal
                            </p>
                            <p className="text-base font-black text-blue-700">
                              {originalT2ATarget} m
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-600 uppercase">
                          {isMeterAwalLocked
                            ? "Start Meter"
                            : "Target Produksi (meter)"}
                        </label>
                        <input
                          type="number"
                          step="any"
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          {...register("meterAwal")}
                          readOnly={isMeterAwalLocked}
                          className={`h-12 px-4 rounded-xl border text-base font-semibold outline-none transition-all ${isMeterAwalLocked
                            ? "bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed"
                            : "bg-white border-slate-200 focus:border-emerald-400"
                            }`}
                          placeholder="Contoh: 600"
                        />
                        {isMeterAwalLocked && (
                          <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            Dilanjutkan dari sisa meter shift sebelumnya.
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-600 uppercase">
                          Finish Meter (Counter Mesin)
                        </label>
                        <input
                          type="number"
                          step="any"
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          {...register("meterAkhir")}
                          className="h-12 px-4 rounded-xl bg-white border border-slate-200 text-base font-semibold focus:border-emerald-400 outline-none transition-all text-right"
                          placeholder="Masukkan angka di mesin saat ini"
                        />
                      </div>

                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <label className="text-[10px] font-bold text-emerald-800 uppercase flex justify-between items-center mb-1">
                          <span>Total Produksi</span>
                        </label>
                        <div className="text-right text-lg font-black text-emerald-700">
                          {(() => {
                            const akhirStr = watch("meterAkhir");
                            if (!akhirStr || akhirStr.trim() === "")
                              return "0 m";
                            const t =
                              parseFloat(watch("meterAwal") || "0") || 0;
                            const p = parseFloat(akhirStr) || 0;
                            const rem = Math.max(t - p, 0);
                            return `${rem} m`;
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-600 uppercase">
                          Start Meter Otomatis
                        </label>
                        <input
                          type="number"
                          step="any"
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          {...register("meterAwal")}
                          readOnly
                          className="h-12 px-4 rounded-xl bg-slate-100 border border-slate-200 text-base font-semibold text-slate-700 outline-none transition-all cursor-not-allowed"
                          placeholder="Otomatis dari finish terakhir"
                        />
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                          Potongan baru mulai dari 0. Jika shift sebelumnya
                          belum potong kain, nilai ini mengikuti finish meter
                          terakhir.
                        </p>
                        {errors.meterAwal && (
                          <span className="text-red-500 text-[10px] font-bold mt-0.5">
                            {errors.meterAwal.message}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-600 uppercase">
                          {watchJenisLaporan === "Mulai Istirahat"
                            ? "Meter Ketika Istirahat"
                            : watchJenisLaporan === "Selesai Istirahat"
                              ? "Meter Selesai Istirahat"
                              : "Finish Meter"}
                        </label>
                        <input
                          type="number"
                          step="any"
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          {...register("meterAkhir")}
                          className="h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-base font-semibold focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                          placeholder="Contoh: 250"
                        />
                        {errors.meterAkhir && (
                          <span className="text-red-500 text-[10px] font-bold mt-0.5">
                            {errors.meterAkhir.message}
                          </span>
                        )}
                      </div>

                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mt-2">
                        <label className="text-[10px] font-bold text-emerald-800 uppercase flex justify-between items-center mb-1">
                          <span>Total Hasil Produksi</span>
                          <span className="text-[9px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded font-black uppercase">
                            Auto Calculate
                          </span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          readOnly
                          tabIndex={-1}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          {...register("hasilProduksiMeter")}
                          className="w-full h-12 px-4 rounded-xl bg-emerald-100/50 border border-emerald-300 text-lg font-black text-emerald-700 outline-none shadow-sm text-right cursor-not-allowed select-none"
                          placeholder="0"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-4 relative z-10 bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">
                    Jenis Laporan Meter
                  </label>
                  <input type="hidden" id="jenisLaporan" {...register("jenisLaporan")} />
                  {isLastRoll ? (
                    <div className="grid grid-cols-1 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setValue("jenisLaporan", "", { shouldDirty: true, shouldValidate: true })}
                        className="w-full px-3 py-3 rounded-xl border-2 border-[#0070bc] bg-sky-50 text-[#0070bc] text-xs font-bold transition-all flex items-center justify-center text-center gap-1 shadow-sm"
                      >
                        <span className="block font-black uppercase">Laporan Potong Kain</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setValue("jenisLaporan", "", { shouldDirty: true, shouldValidate: true })}
                          className={`px-3 py-2.5 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center justify-center text-center gap-1 shadow-sm active:scale-[0.98] ${watchJenisLaporan === ""
                              ? "border-[#0070bc] bg-sky-50 text-[#0070bc] scale-[1.01]"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                        >
                          <span className="block font-black uppercase">Laporan Oper Shift</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setValue("jenisLaporan", "Mulai Istirahat", { shouldDirty: true, shouldValidate: true })}
                          className={`px-3 py-2.5 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center justify-center text-center gap-1 shadow-sm ${watchJenisLaporan === "Mulai Istirahat"
                              ? "border-amber-500 bg-amber-50 text-amber-700 scale-[1.01]"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
                            }`}
                        >
                          <span className="block font-black uppercase">Mulai Istirahat</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setValue("jenisLaporan", "Selesai Istirahat", { shouldDirty: true, shouldValidate: true })}
                          className={`px-3 py-2.5 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center justify-center text-center gap-1 shadow-sm ${watchJenisLaporan === "Selesai Istirahat"
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700 scale-[1.01]"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
                            }`}
                        >
                          <span className="block font-black uppercase">Selesai Istirahat</span>
                        </button>
                      </div>

                      {watchJenisLaporan === "Mulai Istirahat" && (
                        <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                          <label className="text-[10px] font-black text-amber-800 uppercase block mb-1">
                            Siapa yang menjaga mesin (Backup)?
                          </label>
                          <select
                            value={backupOperator}
                            onChange={(e) => setBackupOperator(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-amber-300 text-sm font-semibold text-slate-700 bg-white focus:ring-2 focus:ring-amber-400 outline-none"
                          >
                            <option value="">-- Pilih Operator --</option>
                            {(() => {
                              const currentOperatorId = watch("operatorId");
                              const currentOp = operators.find(o => o.id.toString() === currentOperatorId);
                              const backupOps = currentOp?.shift
                                ? operators.filter(o => o.shift === currentOp.shift && o.id.toString() !== currentOperatorId)
                                : operators;
                              return backupOps.map(op => (
                                <option key={op.id} value={op.name}>{op.name}</option>
                              ));
                            })()}
                          </select>
                        </div>
                      )}
                    </>
                  )}
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
                          await refreshAutomaticMeterStart();
                          const isValid = await trigger([
                            "meterAwal",
                            "meterAkhir",
                          ]);
                          if (!isValid) return;

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
                        }}
                        disabled={isSubmitting}
                        className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-500/20 flex justify-center items-center gap-2 text-sm"
                      >
                        {isSubmitting ? (
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
                        className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors text-sm"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await refreshAutomaticMeterStart();
                          const isValid = await trigger([
                            "meterAwal",
                            "meterAkhir",
                          ]);
                          if (!isValid) return;

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
                        }}
                        disabled={isSubmitting}
                        className="flex-[2] py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-500/20 flex justify-center items-center gap-2 text-sm"
                      >
                        {isSubmitting ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Simpan & Kirim Meteran
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>

        {isTourOpen && currentTourStep && (
          <div className="fixed inset-0 z-[70]">
            <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]" />
            {tourRect && (
              <div
                className="absolute rounded-2xl border-2 border-emerald-300 bg-white/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.45),0_0_0_6px_rgba(16,185,129,0.18)] transition-all duration-200 pointer-events-none"
                style={{
                  top: Math.max(tourRect.top - 8, 8),
                  left: Math.max(tourRect.left - 8, 8),
                  width: tourRect.width + 16,
                  height: tourRect.height + 16,
                }}
              />
            )}
            <div
              className="absolute w-[calc(100vw-2rem)] max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-5"
              style={{ top: tourCardTop, left: tourCardLeft }}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                    Step {tourStepIndex + 1} dari {METER_TOUR_STEPS.length}
                  </p>
                  <h4 className="text-base font-black text-slate-900 mt-1">
                    {currentTourStep.title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={closeTour}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors shrink-0"
                  aria-label="Tutup tour"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                {currentTourStep.description}
              </p>
              <div className="flex items-center gap-2 mt-5">
                <button
                  type="button"
                  onClick={() =>
                    setTourStepIndex((step) => Math.max(step - 1, 0))
                  }
                  disabled={tourStepIndex === 0}
                  className="h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={
                    isLastTourStep
                      ? closeTour
                      : () => setTourStepIndex((step) => step + 1)
                  }
                  className="flex-1 h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {isLastTourStep ? "Selesai" : "Lanjut"}
                  {!isLastTourStep && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}

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
                    className="w-full py-3 bg-[#0070bc] text-white font-bold rounded-xl active:scale-95 transition-all text-sm"
                  >
                    {isEdit ? "Kembali ke Riwayat" : "Input Masalah Berikutnya"}
                  </button>
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
                  : `Apakah Anda yakin ingin mengurangi jumlah PCS menjadi ${pcsConfirmModal.targetCount} pcs? Kolom isian meter untuk PCS di atas nomor tersebut akan hilang.`}
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
                  className="flex-1 py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl active:scale-95 transition-all text-sm"
                >
                  Ya, Ubah
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE-OVER DRAWER RIWAYAT SHIFT */}
        <ContinuousHistoryDrawer
          isOpen={isHistoryDrawerOpen}
          onClose={() => setIsHistoryDrawerOpen(false)}
          currentNomorMc={watch("nomorMc")}
          currentPotonganKe={watch("potonganKe")}
        />
      </div>
    </div>
  );
}
