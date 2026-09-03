"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ArrowUpRight,
  TrendingUp,
  SlidersHorizontal,
  RefreshCw,
  Calendar,
  BarChart2,
  Palette,
  Users,
  AlertTriangle,
  Layers,
  Cpu,
  Download,
  FileText,
  Table as TableIcon,
  HelpCircle,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getRealProductionsData } from "@/actions/dashboard-actions";
import { isBsAwalAkhir, isPanelGagalCacat, hasRealDefect } from "@/lib/mending-grade-utils";
import ProductTour, { ProductTourStep } from "@/components/ProductTour";

const DASHBOARD_TOUR_STEPS: ProductTourStep[] = [
  {
    target: "dashboard-header",
    title: "Ringkasan Dashboard",
    description:
      "Header ini menunjukkan mode dashboard, sumber data, tombol reset filter, dan akses untuk memulai ulang Tutorial kapan saja.",
  },
  {
    target: "dashboard-slicers",
    title: "Filter Dashboard",
    description:
      "Gunakan range waktu, kategori panel/meteran, dan filter pegawai untuk mengubah semua angka serta grafik di halaman.",
  },
  {
    target: "dashboard-kpi",
    title: "Kartu KPI",
    description:
      "Kartu ini bisa diklik untuk mengganti sudut pandang data seperti total produksi, cacat QC, efisiensi, dan masalah.",
  },
  {
    target: "dashboard-visuals",
    title: "Grafik Analisis",
    description:
      "Bagian grafik membantu membaca tren produksi dan kualitas berdasarkan tanggal, desain, pegawai, atau grup.",
  },
  {
    target: "dashboard-leaderboard",
    title: "Leaderboard",
    description:
      "Lihat operator dan mesin terproduktif serta daftar mesin yang perlu perhatian dari sisi cacat atau downtime.",
  },
];

interface Transaction {
  id: string | number;
  tanggal: string;
  hari: string;
  header_id: string;
  panel_no?: number;
  panel_no_str?: string;
  is_dummy_downtime?: boolean;
  potongan_ke?: string;
  nama_operator: string;
  mesin_id: string;
  hasil_pcs: number;
  hasil_meter?: number;
  posisi_meter?: number;
  target_pcs: number;
  status_qc: "Lolos" | "Recheck";
  rpm_mesin: number;
  grade: "GRADE A" | "GRADE B" | "BS" | "UNGRADED";
  design: string;
  group?: string;
  is_production?: boolean;
  total_downtime_detik?: number;
  kategori_masalah?: string;
  detail_masalah?: string;
  keterangan_cacat?: string;
}

const dummyData: Transaction[] = [
  {
    id: 1,
    header_id: "1",
    tanggal: "2026-05-18",
    hari: "SEN",
    nama_operator: "Budi Santoso",
    mesin_id: "KNIT-001",
    hasil_pcs: 240,
    target_pcs: 250,
    status_qc: "Lolos",
    rpm_mesin: 850,
    grade: "GRADE A",
    design: "Design A",
    group: "Grup A",
  },
  {
    id: 2,
    header_id: "2",
    tanggal: "2026-05-18",
    hari: "SEN",
    nama_operator: "Rina Wijaya",
    mesin_id: "KNIT-003",
    hasil_pcs: 220,
    target_pcs: 230,
    status_qc: "Lolos",
    rpm_mesin: 840,
    grade: "GRADE B",
    design: "Design B",
    group: "Grup B",
  },
  {
    id: 3,
    header_id: "3",
    tanggal: "2026-05-19",
    hari: "SEL",
    nama_operator: "Siti Rahma",
    mesin_id: "KNIT-002",
    hasil_pcs: 180,
    target_pcs: 200,
    status_qc: "Recheck",
    rpm_mesin: 720,
    grade: "BS",
    design: "Design A",
    group: "Grup A",
  },
  {
    id: 4,
    header_id: "4",
    tanggal: "2026-05-19",
    hari: "SEL",
    nama_operator: "Ahmad Fauzi",
    mesin_id: "KNIT-004",
    hasil_pcs: 230,
    target_pcs: 230,
    status_qc: "Lolos",
    rpm_mesin: 860,
    grade: "GRADE A",
    design: "Design C",
    group: "Grup C",
  },
  {
    id: 5,
    header_id: "5",
    tanggal: "2026-05-20",
    hari: "RAB",
    nama_operator: "Doni Setiawan",
    mesin_id: "KNIT-001",
    hasil_pcs: 250,
    target_pcs: 250,
    status_qc: "Lolos",
    rpm_mesin: 850,
    grade: "GRADE A",
    design: "Design A",
    group: "Grup A",
  },
  {
    id: 6,
    header_id: "6",
    tanggal: "2026-05-20",
    hari: "RAB",
    nama_operator: "Eko Prasetyo",
    mesin_id: "KNIT-003",
    hasil_pcs: 190,
    target_pcs: 210,
    status_qc: "Recheck",
    rpm_mesin: 780,
    grade: "BS",
    design: "Design B",
    group: "Grup B",
  },
  {
    id: 7,
    header_id: "7",
    tanggal: "2026-05-21",
    hari: "KAM",
    nama_operator: "Budi Santoso",
    mesin_id: "KNIT-001",
    hasil_pcs: 245,
    target_pcs: 245,
    status_qc: "Lolos",
    rpm_mesin: 855,
    grade: "GRADE A",
    design: "Design A",
    group: "Grup A",
  },
  {
    id: 8,
    header_id: "8",
    tanggal: "2026-05-21",
    hari: "KAM",
    nama_operator: "Dewi Lestari",
    mesin_id: "KNIT-002",
    hasil_pcs: 235,
    target_pcs: 240,
    status_qc: "Lolos",
    rpm_mesin: 845,
    grade: "GRADE B",
    design: "Design C",
    group: "Grup C",
  },
  {
    id: 9,
    header_id: "9",
    tanggal: "2026-05-22",
    hari: "JUM",
    nama_operator: "Rina Wijaya",
    mesin_id: "KNIT-003",
    hasil_pcs: 260,
    target_pcs: 260,
    status_qc: "Lolos",
    rpm_mesin: 860,
    grade: "GRADE A",
    design: "Design B",
    group: "Grup B",
  },
  {
    id: 10,
    header_id: "10",
    tanggal: "2026-05-22",
    hari: "JUM",
    nama_operator: "Siti Rahma",
    mesin_id: "KNIT-002",
    hasil_pcs: 170,
    target_pcs: 200,
    status_qc: "Recheck",
    rpm_mesin: 690,
    grade: "BS",
    design: "Design A",
    group: "Grup A",
  },
  {
    id: 11,
    header_id: "11",
    tanggal: "2026-05-23",
    hari: "SAB",
    nama_operator: "Ahmad Fauzi",
    mesin_id: "KNIT-004",
    hasil_pcs: 150,
    target_pcs: 160,
    status_qc: "Lolos",
    rpm_mesin: 820,
    grade: "GRADE B",
    design: "Design C",
    group: "Grup C",
  },
  {
    id: 12,
    header_id: "12",
    tanggal: "2026-05-23",
    hari: "SAB",
    nama_operator: "Doni Setiawan",
    mesin_id: "KNIT-001",
    hasil_pcs: 140,
    target_pcs: 140,
    status_qc: "Lolos",
    rpm_mesin: 830,
    grade: "GRADE A",
    design: "Design A",
    group: "Grup A",
  },
  {
    id: 13,
    header_id: "13",
    tanggal: "2026-05-24",
    hari: "MIN",
    nama_operator: "Eko Prasetyo",
    mesin_id: "KNIT-003",
    hasil_pcs: 120,
    target_pcs: 130,
    status_qc: "Lolos",
    rpm_mesin: 810,
    grade: "GRADE A",
    design: "Design B",
    group: "Grup B",
  },
];

const DeltaBadge = ({
  delta,
  isLowerBetter = false,
}: {
  delta: { value: number; type: "up" | "down" | "flat" };
  isLowerBetter?: boolean;
}) => {
  if (delta.type === "flat" || delta.value === 0) {
    return (
      <span className="text-[10px] text-slate-400 font-extrabold ml-1.5">
        0.0% vs periode lalu
      </span>
    );
  }
  const isUp = delta.type === "up";
  const isGood = isLowerBetter ? !isUp : isUp;
  const colorClass = isGood
    ? "text-emerald-600 bg-emerald-50 border-emerald-100"
    : "text-rose-600 bg-rose-50 border-rose-100";
  const sign = isUp ? "+" : "";
  const arrow = isUp ? "▲" : "▼";

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold border ${colorClass} ml-1.5`}
    >
      {arrow} {sign}
      {delta.value}% vs periode lalu
    </span>
  );
};

const formatDuration = (seconds: number) => {
  if (seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}j`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  return parts.join(" ");
};

const formatTotalHours = (seconds: number) => {
  const h = (seconds / 3600).toFixed(1);
  return `${h.replace(/\.0$/, "")} jam`;
};

const getNiceChartMax = (rawValue: number, minimum = 5) => {
  if (!Number.isFinite(rawValue) || rawValue <= minimum) return minimum;

  const roughTick = rawValue / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughTick)));
  const normalized = roughTick / magnitude;
  const niceNormalized =
    normalized <= 1 ? 1 :
      normalized <= 2 ? 2 :
        normalized <= 2.5 ? 2.5 :
          normalized <= 5 ? 5 :
            10;

  return niceNormalized * magnitude * 4;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<
    "ALL" | "LOLOS" | "EFISIENSI" | "PROBLEMS" | "NOL_PRODUKSI"
  >("ALL");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllParetoCards, setShowAllParetoCards] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // Dashboard View Mode (Produksi vs Kehadiran)
  const [dashboardMode, setDashboardMode] = useState<"PRODUKSI" | "KEHADIRAN">(
    "PRODUKSI",
  );

  // Metric View Mode (OEE vs CLASSIC)
  const [dashboardViewType, setDashboardViewType] = useState<"OEE" | "CLASSIC">(
    "CLASSIC",
  );

  // Metric Mode State (controls sliders for PCS vs METER)
  const [metricMode, setMetricMode] = useState<"PCS" | "METER">("PCS");

  // Date Filtering State
  const [dateRangeMode, setDateRangeMode] = useState<
    "TODAY" | "7DAYS" | "30DAYS" | "CUSTOM"
  >("7DAYS");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Grade breakdown filter for Chart
  const [chartGradeFilter, setChartGradeFilter] = useState<
    "ALL" | "GRADE_A" | "GRADE_B" | "BS" | "UNGRADED"
  >("ALL");

  // Chart Dimension State
  const [chartGroupBy, setChartGroupBy] = useState<
    "HARI" | "DESIGN" | "PEGAWAI" | "GROUP" | "MESIN" | "KATEGORI"
  >("HARI");

  // Chart Type State
  const [chartType, setChartType] = useState<"BAR" | "LINE">("BAR");

  // Machine Filter State
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
  const [isMachineDropdownOpen, setIsMachineDropdownOpen] = useState(false);

  // Operator Filter State
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const [isOperatorDropdownOpen, setIsOperatorDropdownOpen] = useState(false);

  // Rekap Table Expansion State
  const [isRekapExpanded, setIsRekapExpanded] = useState(false);

  // Monthly Rekap Export State
  const [isMonthlyRekapModalOpen, setIsMonthlyRekapModalOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState<number>(
    new Date().getMonth() + 1,
  );
  const [exportYear, setExportYear] = useState<number>(
    new Date().getFullYear(),
  );

  const handleDownloadMonthlyRekap = () => {
    window.open(
      `/api/export?month=${exportMonth}&year=${exportYear}`,
      "_blank",
    );
    setIsMonthlyRekapModalOpen(false);
  };

  // Swipe State for mobile
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) =>
    setTouchStartX(e.touches[0].clientX);
  const handleTouchEndMetric = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (diff > 40) setMetricMode("METER");
    else if (diff < -40) setMetricMode("PCS");
    setTouchStartX(null);
  };

  // Active chart bar for mobile tap
  const [activeChartBar, setActiveChartBar] = useState<number | null>(null);

  // Load real production data from Supabase
  useEffect(() => {
    async function loadLiveData() {
      try {
        const res = await getRealProductionsData();
        console.log("Dashboard Live Data Response:", res);
        if (res.success && res.data) {
          setTransactions(res.data);
          setIsLive(true);
        } else if (!res.success) {
          console.error("Failed to load dashboard data:", res.error);
        }
      } catch (err) {
        console.error("Error calling getRealProductionsData:", err);
      }
    }
    loadLiveData();
  }, []);

  // Unique Machines for Filter Dropdown
  const uniqueMachines = useMemo(() => {
    const macs = new Set(transactions.map((t) => t.mesin_id));
    return Array.from(macs).filter(Boolean).sort();
  }, [transactions]);

  // Unique Operators for Filter Dropdown
  const uniqueOperators = useMemo(() => {
    const ops = new Set(transactions.map((t) => t.nama_operator));
    return Array.from(ops).sort();
  }, [transactions]);

  // Filter transactions by date range and operator
  const dateFilteredTransactions = useMemo(() => {
    let result = transactions;

    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA");

    result = result.filter((item) => {
      const itemDate = new Date(item.tanggal);
      if (isNaN(itemDate.getTime())) return true;

      if (dateRangeMode === "TODAY") {
        return itemDate.toLocaleDateString("en-CA") === todayStr;
      }

      if (dateRangeMode === "7DAYS") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return itemDate >= sevenDaysAgo && itemDate <= now;
      }

      if (dateRangeMode === "30DAYS") {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return itemDate >= thirtyDaysAgo && itemDate <= now;
      }

      if (dateRangeMode === "CUSTOM") {
        if (!startDate && !endDate) return true;
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        if (start && end) {
          end.setHours(23, 59, 59, 999);
          return itemDate >= start && itemDate <= end;
        } else if (start) {
          return itemDate >= start;
        } else if (end) {
          end.setHours(23, 59, 59, 999);
          return itemDate <= end;
        }
      }

      return true;
    });

    if (selectedOperators.length > 0) {
      result = result.filter((item) =>
        selectedOperators.includes(item.nama_operator),
      );
    }

    if (selectedMachines.length > 0) {
      result = result.filter((item) =>
        selectedMachines.includes(item.mesin_id),
      );
    }

    return result;
  }, [transactions, dateRangeMode, startDate, endDate, selectedOperators, selectedMachines]);

  // KPI Calculations (Pivot values calculated from active dataset, filtered by grade)
  // Helper to calculate stats for a given transaction list
  const calculateStatsForDataset = (
    dataset: Transaction[],
    gradeFilter: string,
  ) => {
    let gradeScoped = dataset;
    if (gradeFilter === "GRADE_A") {
      gradeScoped = dataset.filter((item) => item.grade === "GRADE A");
    } else if (gradeFilter === "GRADE_B") {
      gradeScoped = dataset.filter((item) => item.grade === "GRADE B");
    } else if (gradeFilter === "BS") {
      gradeScoped = dataset.filter((item) => item.grade === "BS");
    }

    const productionOnly = gradeScoped.filter((item) => item.is_production);

    const uniqueHeadersMap = new Map<string, (typeof productionOnly)[0]>();
    productionOnly.forEach((item) => {
      if (item.header_id && !uniqueHeadersMap.has(item.header_id)) {
        uniqueHeadersMap.set(item.header_id, item);
      }
    });
    const uniqueHeaders = Array.from(uniqueHeadersMap.values());

    // Hitung total panel unik hasil produksi (sesuai dengan standar Laporan Produksi & Chart)
    const uniquePanelsSet = new Set<string>();
    productionOnly.forEach((item) => {
      if ((item.hasil_meter || 0) > 0) return;
      const panelStr = String(item.panel_no_str || item.panel_no || "").toUpperCase().trim();
      if (
        !panelStr ||
        panelStr.includes("DOWNTIME") ||
        panelStr === "BERHENTI" ||
        panelStr.includes("(GAGAL)") ||
        panelStr.includes("(BS)")
      ) {
        return;
      }
      const cutKey = item.potongan_ke || item.design || item.header_id;
      const key = `${item.tanggal}_${item.mesin_id}_${cutKey}_${panelStr}_${item.header_id}`;
      uniquePanelsSet.add(key);
    });
    const totalProduksi = uniquePanelsSet.size;

    const totalProduksiMeter = uniqueHeaders.reduce(
      (acc, curr) => acc + (parseFloat(curr.hasil_meter as any) || 0),
      0,
    );
    const totalTarget = uniqueHeaders.reduce(
      (acc, curr) => acc + curr.target_pcs,
      0,
    );
    const totalHasilPcs = productionOnly.reduce(
      (acc, curr) => acc + curr.hasil_pcs,
      0,
    ); // Keep raw sum since it's detail-level pcs
    const totalItems = uniqueHeaders.length;

    // Cacat Panel (Count unique header_ids with problems, ignoring Gagal Cacat and BS Awal/Akhir)
    const countMasalahPanel = new Set(
      gradeScoped
        .filter(
          (item) =>
            !isBsAwalAkhir(item) &&
            !isPanelGagalCacat(item) &&
            hasRealDefect(item) &&
            item.status_qc === "Recheck" &&
            item.is_production &&
            (item.hasil_meter || 0) === 0 &&
            (item.posisi_meter || 0) === 0 &&
            item.panel_no !== undefined &&
            item.panel_no !== null &&
            !isNaN(Number(item.panel_no)),
        )
        .map((item) => item.header_id),
    ).size;

    const totalPanelValid = totalProduksi;
    const persentaseCacatPanel =
      totalPanelValid > 0 ? (countMasalahPanel / totalPanelValid) * 100 : 0;
    const fpyPanel = Math.max(0, 100 - persentaseCacatPanel);

    // Cacat Meteran (Count raw detail problem rows, ignoring Gagal Cacat)
    const countMasalahMeteran = gradeScoped.filter(
      (item) =>
        !isBsAwalAkhir(item) &&
        !isPanelGagalCacat(item) &&
        hasRealDefect(item) &&
        item.status_qc === "Recheck" &&
        item.is_production &&
        (item.posisi_meter || 0) > 0,
    ).length;
    const persentaseCacatMeteran =
      totalProduksiMeter > 0
        ? (countMasalahMeteran / totalProduksiMeter) * 100
        : 0;
    const fpyMeteran = Math.max(0, 100 - persentaseCacatMeteran);

    // Availability / Ketersediaan Waktu (menggunakan jumlah hari unik: 24 jam per hari, atau 8 jam per shift jika filter 1 pegawai)
    const uniqueDatesCount = new Set(gradeScoped.map((item) => item.tanggal)).size || 1;
    const hoursPerDay = selectedOperators.length > 0 ? 8 : 24;
    const totalDetikTersedia = uniqueDatesCount * hoursPerDay * 3600;

    const uniqueGradeScopedHeadersMap = new Map<
      string,
      (typeof gradeScoped)[0]
    >();
    gradeScoped.forEach((item) => {
      if (item.header_id && !uniqueGradeScopedHeadersMap.has(item.header_id)) {
        uniqueGradeScopedHeadersMap.set(item.header_id, item);
      }
    });
    const uniqueGradeScopedHeaders = Array.from(
      uniqueGradeScopedHeadersMap.values(),
    );
    const totalDowntimeDetik = uniqueGradeScopedHeaders.reduce(
      (acc, curr) => acc + (curr.total_downtime_detik || 0),
      0,
    );
    const totalDetikKerjaEfektif = Math.max(
      0,
      totalDetikTersedia - totalDowntimeDetik,
    );
    const availability =
      totalDetikTersedia > 0
        ? (totalDetikKerjaEfektif / totalDetikTersedia) * 100
        : 0;

    // Performance Rate
    const performance =
      totalTarget > 0 ? (totalHasilPcs / totalTarget) * 100 : 0;

    // Quality Rate (FPY Panel is the representative standard)
    const quality = fpyPanel;

    // OEE Score
    const oee =
      (availability / 100) * (performance / 100) * (quality / 100) * 100;

    // Total Masalah Umum (mengabaikan Gagal Cacat dan Kategori G)
    let countMasalah = 0;
    gradeScoped
      .filter(
        (item) =>
          !isBsAwalAkhir(item) &&
          !isPanelGagalCacat(item) &&
          hasRealDefect(item) &&
          (item.status_qc === "Recheck" || item.grade === "BS" || (item.kategori_masalah && item.kategori_masalah.trim() !== ""))
      )
      .forEach((item) => {
        let itemCount = 1;
        if (item.kategori_masalah && item.kategori_masalah.trim() !== "") {
          const cats = item
            .kategori_masalah.split(",")
            .map((c) => c.trim())
            .filter((c) => c !== "" && c !== "X" && c !== "G" && c !== "BS" && !c.toUpperCase().includes("ISTIRAHAT") && !c.toUpperCase().includes("GAGAL CACAT"));
          itemCount = Math.max(itemCount, cats.length);
        }

        const ket = (item as any).keterangan_cacat || (item as any).keterangan || "";
        if (ket && typeof ket === "string") {
          const blockMatches = ket.match(/Blok\s*\d+/gi);
          if (blockMatches && blockMatches.length > 0) {
            itemCount = Math.max(itemCount, blockMatches.length);
          }
        }

        countMasalah += itemCount;
      });

    const countNolProduksi = gradeScoped.filter(
      (item) => item.hasil_pcs === 0,
    ).length;
    const totalPanel = gradeScoped.length;

    return {
      totalProduksi,
      totalProduksiMeter,
      totalTarget,
      totalHasilPcs,
      availability,
      performance,
      quality,
      oee,
      efisiensi: availability, // alias for backwards compatibility
      countMasalah,
      totalItems,
      totalPanel,
      countNolProduksi,
      countMasalahPanel,
      totalPanelValid,
      persentaseCacatPanel,
      fpyPanel,
      countMasalahMeteran,
      persentaseCacatMeteran,
      fpyMeteran,
      totalDetikTersedia,
      totalDowntimeDetik,
    };
  };

  // Filter transactions for prior period comparison
  const prevFilteredTransactions = useMemo(() => {
    let result = transactions;
    const now = new Date();

    if (dateRangeMode === "TODAY") {
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      result = result.filter((item) => item.tanggal === yesterdayStr);
    } else if (dateRangeMode === "7DAYS") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(now.getDate() - 14);

      result = result.filter((item) => {
        const itemDate = new Date(item.tanggal);
        if (isNaN(itemDate.getTime())) return false;
        return itemDate >= fourteenDaysAgo && itemDate < sevenDaysAgo;
      });
    } else if (dateRangeMode === "30DAYS") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(now.getDate() - 60);

      result = result.filter((item) => {
        const itemDate = new Date(item.tanggal);
        if (isNaN(itemDate.getTime())) return false;
        return itemDate >= sixtyDaysAgo && itemDate < thirtyDaysAgo;
      });
    } else if (dateRangeMode === "CUSTOM") {
      if (!startDate && !endDate) return [];
      const start = startDate ? new Date(startDate) : new Date();
      const end = endDate ? new Date(endDate) : new Date();

      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

      const prevStart = new Date(start);
      prevStart.setDate(start.getDate() - diffDays);
      const prevEnd = new Date(start);

      result = result.filter((item) => {
        const itemDate = new Date(item.tanggal);
        if (isNaN(itemDate.getTime())) return false;
        return itemDate >= prevStart && itemDate < prevEnd;
      });
    }

    if (selectedOperators.length > 0) {
      result = result.filter((item) =>
        selectedOperators.includes(item.nama_operator),
      );
    }

    if (selectedMachines.length > 0) {
      result = result.filter((item) =>
        selectedMachines.includes(item.mesin_id),
      );
    }

    return result;
  }, [transactions, dateRangeMode, startDate, endDate, selectedOperators, selectedMachines]);

  // Current transactions to perform clean deltas
  const currentHalfFilteredTransactions = useMemo(() => {
    return dateFilteredTransactions;
  }, [dateFilteredTransactions]);

  // Main KPI calculations
  const stats = useMemo(() => {
    const modeScoped = dateFilteredTransactions.filter((item) => {
      const isMeter =
        (item.hasil_meter || 0) > 0 || (item.posisi_meter || 0) > 0;
      return metricMode === "METER" ? isMeter : !isMeter;
    });
    return calculateStatsForDataset(modeScoped, chartGradeFilter);
  }, [dateFilteredTransactions, chartGradeFilter, metricMode]);

  // Delta computations for active vs prior period
  const deltas = useMemo(() => {
    const calculateDelta = (
      curr: number,
      prev: number,
    ): { value: number; type: "up" | "down" | "flat" } => {
      if (prev === 0) {
        if (curr > 0) return { value: 100, type: "up" };
        return { value: 0, type: "flat" };
      }
      const diff = curr - prev;
      const pct = (diff / prev) * 100;
      return {
        value: parseFloat(pct.toFixed(1)),
        type: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
      };
    };

    const calculatePointDelta = (
      curr: number,
      prev: number,
    ): { value: number; type: "up" | "down" | "flat" } => {
      const diff = curr - prev;
      return {
        value: parseFloat(diff.toFixed(1)),
        type: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
      };
    };

    const modeScopedDelta = currentHalfFilteredTransactions.filter((item) => {
      const isMeter =
        (item.hasil_meter || 0) > 0 || (item.posisi_meter || 0) > 0;
      return metricMode === "METER" ? isMeter : !isMeter;
    });
    const modeScopedPrev = prevFilteredTransactions.filter((item) => {
      const isMeter =
        (item.hasil_meter || 0) > 0 || (item.posisi_meter || 0) > 0;
      return metricMode === "METER" ? isMeter : !isMeter;
    });

    const statsForDelta = calculateStatsForDataset(
      modeScopedDelta,
      chartGradeFilter,
    );
    const statsForPrev = calculateStatsForDataset(
      modeScopedPrev,
      chartGradeFilter,
    );

    return {
      oee: calculatePointDelta(statsForDelta.oee, statsForPrev.oee),
      availability: calculatePointDelta(
        statsForDelta.availability,
        statsForPrev.availability,
      ),
      performance: calculatePointDelta(
        statsForDelta.performance,
        statsForPrev.performance,
      ),
      quality: calculatePointDelta(statsForDelta.quality, statsForPrev.quality),
      totalProduksi: calculateDelta(
        statsForDelta.totalProduksi,
        statsForPrev.totalProduksi,
      ),
      totalProduksiMeter: calculateDelta(
        statsForDelta.totalProduksiMeter,
        statsForPrev.totalProduksiMeter,
      ),
      countMasalah: calculateDelta(
        statsForDelta.countMasalah,
        statsForPrev.countMasalah,
      ),
    };
  }, [
    currentHalfFilteredTransactions,
    prevFilteredTransactions,
    chartGradeFilter,
    metricMode,
  ]);

  // Leaderboard data hook (Top/Bottom Performers)
  const leaderboard = useMemo(() => {
    const isMeterMode = metricMode === "METER";
    const leaderboardData = dateFilteredTransactions.filter((item) => {
      if (!item.is_production || !item.header_id) return false;
      const isMeter = (item.hasil_meter || 0) > 0 || (item.posisi_meter || 0) > 0;
      return isMeterMode ? isMeter : !isMeter;
    });

    // 1. Top Operators, mengikuti mode Panel/Meteran.
    const operatorMap: Record<
      string,
      { headers: Set<string>; meterHeaders: Map<string, number>; panelSet: Set<string>; group: string }
    > = {};
    leaderboardData.forEach((item) => {
      if (item.grade === "BS") return;

      if (!operatorMap[item.nama_operator]) {
        operatorMap[item.nama_operator] = {
          headers: new Set(),
          meterHeaders: new Map(),
          panelSet: new Set(),
          group: item.group || "Tanpa Group",
        };
      }

      operatorMap[item.nama_operator].headers.add(item.header_id);
      operatorMap[item.nama_operator].meterHeaders.set(
        item.header_id,
        Math.max(
          operatorMap[item.nama_operator].meterHeaders.get(item.header_id) || 0,
          parseFloat(item.hasil_meter as any) || 0,
        ),
      );

      if (
        item.panel_no !== undefined &&
        item.panel_no !== null &&
        !isNaN(Number(item.panel_no)) &&
        (item.hasil_meter || 0) === 0
      ) {
        const key = `${item.mesin_id}_${item.design}_${item.potongan_ke}_${Number(item.panel_no)}`;
        operatorMap[item.nama_operator].panelSet.add(key);
      }
    });
    const topOperators = Object.entries(operatorMap)
      .map(([name, data]) => {
        const meter = Array.from(data.meterHeaders.values()).reduce(
          (sum, value) => sum + value,
          0,
        );
        const totalPanel = data.panelSet.size;
        return {
          name,
          value: isMeterMode ? meter : totalPanel,
          pcs: totalPanel,
          meter,
          group: data.group,
        };
      })
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // 2. Top Machines, mengikuti mode Panel/Meteran.
    const machineMap: Record<
      string,
      {
        headers: Set<string>;
        meterHeaders: Map<string, number>;
        downtimeHeaders: Map<string, number>;
        panelSet: Set<string>;
      }
    > = {};
    leaderboardData.forEach((item) => {
      if (item.grade === "BS") return;

      if (!machineMap[item.mesin_id]) {
        machineMap[item.mesin_id] = {
          headers: new Set(),
          meterHeaders: new Map(),
          downtimeHeaders: new Map(),
          panelSet: new Set(),
        };
      }

      machineMap[item.mesin_id].headers.add(item.header_id);
      machineMap[item.mesin_id].meterHeaders.set(
        item.header_id,
        Math.max(
          machineMap[item.mesin_id].meterHeaders.get(item.header_id) || 0,
          parseFloat(item.hasil_meter as any) || 0,
        ),
      );
      machineMap[item.mesin_id].downtimeHeaders.set(
        item.header_id,
        item.total_downtime_detik || 0,
      );

      if (
        item.panel_no !== undefined &&
        item.panel_no !== null &&
        !isNaN(Number(item.panel_no)) &&
        (item.hasil_meter || 0) === 0
      ) {
        const key = `${item.mesin_id}_${item.design}_${item.potongan_ke}_${Number(item.panel_no)}`;
        machineMap[item.mesin_id].panelSet.add(key);
      }
    });
    const topMachines = Object.entries(machineMap)
      .map(([id, data]) => {
        const meter = Array.from(data.meterHeaders.values()).reduce(
          (sum, value) => sum + value,
          0,
        );
        const downtime = Array.from(data.downtimeHeaders.values()).reduce(
          (sum, val) => sum + val,
          0,
        );
        const totalPanel = data.panelSet.size;
        return {
          id,
          value: isMeterMode ? meter : totalPanel,
          pcs: totalPanel,
          meter,
          downtime,
        };
      })
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // 3. Critical Machines (ranked by total Recheck counts or downtime)
    const criticalMachineMap: Record<
      string,
      { defects: number; downtimeHeaders: Map<string, number> }
    > = {};
    leaderboardData.forEach((item) => {
      if (!criticalMachineMap[item.mesin_id]) {
        criticalMachineMap[item.mesin_id] = {
          defects: 0,
          downtimeHeaders: new Map(),
        };
      }
      if (!isBsAwalAkhir(item) && !isPanelGagalCacat(item) && hasRealDefect(item) && (item.status_qc === "Recheck" || item.grade === "BS" || (item.kategori_masalah && item.kategori_masalah.trim() !== ""))) {
        criticalMachineMap[item.mesin_id].defects += 1;
      }
      criticalMachineMap[item.mesin_id].downtimeHeaders.set(
        item.header_id,
        item.total_downtime_detik || 0,
      );
    });
    const criticalMachines = Object.entries(criticalMachineMap)
      .map(([id, data]) => {
        const downtime = Array.from(data.downtimeHeaders.values()).reduce(
          (sum, val) => sum + val,
          0,
        );
        return { id, defects: data.defects, downtime };
      })
      .filter((m) => m.defects > 0 || m.downtime > 0)
      .sort((a, b) => b.defects - a.defects || b.downtime - a.downtime)
      .slice(0, 5);

    return { topOperators, topMachines, criticalMachines };
  }, [dateFilteredTransactions, metricMode]);

  // Pareto Chart State and Hook for Quality Problems & Machines
  const [paretoMode, setParetoMode] = useState<"COUNT" | "DURATION">("COUNT");
  const [paretoGroupBy, setParetoGroupBy] = useState<"KATEGORI" | "MESIN">("KATEGORI");
  const [selectedParetoMachine, setSelectedParetoMachine] = useState<string>("ALL");

  const getMachineKey = (item: any) => {
    const m = item.mesin_id || item.no_mesin || item.mesin || item.nama_mesin;
    return m && String(m).trim() !== "" ? String(m).trim() : "";
  };

  const availableParetoMachines = useMemo(() => {
    const machines = new Set<string>();
    dateFilteredTransactions.forEach((item) => {
      const m = getMachineKey(item);
      if (m) machines.add(m);
    });
    return Array.from(machines).sort();
  }, [dateFilteredTransactions]);

  const paretoProblemData = useMemo(() => {
    const CATEGORY_NAMES: Record<string, string> = {
      A: "Benang Timbul/Lolos",
      B: "Jarum/Jacquard",
      C: "Design/Proofing",
      D: "Benang Dasar/Rewind",
      E: "Servo/Elektrik",
      F: "Cylinder/Mekanik",
      G: "Lain-lain/Libur",
      H: "Mekanik Direct",
      BS: "Barang Sortir / Reject",
    };

    const transactionsToAnalyze = selectedParetoMachine === "ALL"
      ? dateFilteredTransactions
      : dateFilteredTransactions.filter((item) => getMachineKey(item) === selectedParetoMachine);

    const itemMap = new Map<string, { count: number; downtime: number }>();

    if (paretoGroupBy === "KATEGORI") {
      const problemData = transactionsToAnalyze.filter(
        (item) =>
          !isBsAwalAkhir(item) &&
          !isPanelGagalCacat(item) &&
          hasRealDefect(item) &&
          (item.grade === "BS" ||
          (item.kategori_masalah && item.kategori_masalah.trim() !== "") ||
          (item.detail_masalah && item.detail_masalah.trim() !== ""))
      );

      const PROBLEM_DETAILS_MAP: Record<string, string[]> = {
        A: [
          "L1/L2/L3 Benang timbul putus",
          "Benang lolos",
          "Bolong corak",
          "L1/L2/L3 Benang timbul",
          "Benang Nyilang",
          "Benang narik/Kendor",
          "Perbaikan/Beset benang Dasar",
          "Benang Kejepit/Jebol/Kusut",
          "Jalur benang",
          "Beda warna benang/salah benang",
        ],
        B: [
          "Jarum pattern patah/bengkok",
          "Jarum dasar patah/bengkok",
          "Ganti Jacquard",
          "Ganti Tali Jacquard",
          "Ganti Per Jacquard",
          "Ganti Module",
          "Ganti Magnet",
          "Layar Komputer Error/Mati",
          "Ganti jarum Compoun Nedle, pattern",
          "Ngampul",
          "Ganti dari scaloop ke non scaloop atau sebaliknya",
          "Ngegaris/Stopline",
          "Keluar Jarum",
          "Ganti String bar",
          "Ganti PBO",
          "Pressan As beam kendor",
          "Tensi tensioner",
          "Stripe/garis jarum",
          "Lubang/bolong",
          "Beda warna/stripe",
        ],
        C: [
          "Loading design/Ganti Design",
          "Perbaikan corak/revisi",
          "Salah ganti design",
          "Error design",
          "Proofing/PCB",
          "Ganti Pattern Disk",
          "Ganti pick",
          "Setel kain tebal/tipis",
          "Lolos kain ganti artikel",
          "Setting benang awal",
          "Ganti Jarum / Olah Mesin",
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
          "Menunggu mekanik",
          "Menunggu benang",
          "Cleaning mesin",
          "Istirahat",
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

      const getCategoryForDetail = (detailStr: string, fallbackCategory?: string): string => {
        const cleanStr = detailStr.replace(/\s*\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "").trim();
        for (const [cat, details] of Object.entries(PROBLEM_DETAILS_MAP)) {
          if (details.some(d => cleanStr.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(cleanStr.toLowerCase()))) {
            return cat;
          }
        }
        if (fallbackCategory && fallbackCategory.trim() !== "" && fallbackCategory !== "X") {
          const firstCat = fallbackCategory.split(/[,/]/)[0].trim().toUpperCase();
          if (firstCat && firstCat.length === 1 && firstCat >= "A" && firstCat <= "Z") {
            return firstCat;
          }
        }
        return "X";
      };

      problemData.forEach((item) => {
        let detailsList: string[] = [];
        if (item.detail_masalah && item.detail_masalah.trim() !== "") {
          detailsList = item.detail_masalah.split(",").map(d => d.trim()).filter(d => d !== "");
        }

        // Filter out any non-defect / scrap / gagal cacat entries from detailsList
        detailsList = detailsList.filter((det) => {
          const upper = det.toUpperCase();
          return (
            !upper.includes("SISA AWAL") &&
            !upper.includes("SISA AKHIR") &&
            !upper.includes("POTONGAN AWAL") &&
            !upper.includes("POTONGAN AKHIR") &&
            !upper.includes("SISA POTONGAN") &&
            !upper.includes("GAGAL CACAT") &&
            upper !== "START" &&
            upper !== "FINISH" &&
            upper !== "ISTIRAHAT"
          );
        });

        if (detailsList.length === 0) {
          if (item.kategori_masalah && item.kategori_masalah.trim() !== "" && item.kategori_masalah !== "X" && item.kategori_masalah !== "G" && !item.kategori_masalah.toUpperCase().includes("GAGAL CACAT")) {
            const cat = item.kategori_masalah.trim().toUpperCase();
            const desc = CATEGORY_NAMES[cat] || "Masalah Lain";
            detailsList.push(`[${cat}] ${desc}`);
          } else if (item.grade === "BS" && !isBsAwalAkhir(item) && !isPanelGagalCacat(item)) {
            detailsList.push("[X] Panel BS (Tanpa Detail)");
          }
        }

        const downtime = item.total_downtime_detik || 0;
        const downtimeShare = detailsList.length > 0 ? downtime / detailsList.length : downtime;

        detailsList.forEach((det) => {
          // Clean out (Titik: XXXm) suffix so defects at different meters aggregate into the SAME category!
          const cleanDet = det.replace(/\s*\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "").trim();
          if (!cleanDet) return;

          let formattedName = cleanDet;
          if (!cleanDet.startsWith("[")) {
            const cat = getCategoryForDetail(cleanDet, item.kategori_masalah);
            formattedName = `[${cat}] ${cleanDet}`;
          }
          const key = formattedName;
          const existing = itemMap.get(key) || { count: 0, downtime: 0 };
          itemMap.set(key, {
            count: existing.count + 1,
            downtime: existing.downtime + downtimeShare,
          });
        });
      });
    } else {
      // Group by MESIN: hitung jumlah kejadian masalah/cacat sesungguhnya per mesin (mengabaikan Gagal Cacat)
      transactionsToAnalyze.forEach((item) => {
        if (isBsAwalAkhir(item)) return;
        const isDefect = !isPanelGagalCacat(item) && hasRealDefect(item) && (item.status_qc === "Recheck" || item.grade === "BS" || (item.kategori_masalah && item.kategori_masalah.trim() !== ""));
        const downtime = item.total_downtime_detik || 0;
        if (!isDefect && downtime === 0) return;

        const key = getMachineKey(item) || "Mesin -";
        const existing = itemMap.get(key) || { count: 0, downtime: 0 };
        itemMap.set(key, {
          count: existing.count + (isDefect ? 1 : 0),
          downtime: existing.downtime + downtime,
        });
      });
    }

    const list = Array.from(itemMap.entries()).map(([code, data]) => {
      let friendlyName = code;
      if (paretoGroupBy === "KATEGORI") {
        friendlyName = code;
      } else {
        friendlyName = code.startsWith("Mesin") ? code : `Mesin ${code}`;
      }
      return {
        name: code,
        friendlyName,
        code,
        count: data.count,
        downtime: data.downtime,
      };
    });

    if (paretoMode === "COUNT") {
      list.sort((a, b) => b.count - a.count);
    } else {
      list.sort((a, b) => b.downtime - a.downtime);
    }

    const totalCount = list.reduce((sum, item) => sum + item.count, 0);
    const totalDowntime = list.reduce((sum, item) => sum + item.downtime, 0);

    let cumulativeSum = 0;
    let crossed80 = false;
    const itemsWithCumulative = list.map((item) => {
      const value = paretoMode === "COUNT" ? item.count : item.downtime;
      const total = paretoMode === "COUNT" ? totalCount : totalDowntime;
      cumulativeSum += value;
      const cumulativePct = total > 0 ? (cumulativeSum / total) * 100 : 0;
      const roundedCumPct = parseFloat(cumulativePct.toFixed(1));

      const isVital80 = !crossed80;
      if (roundedCumPct >= 80) {
        crossed80 = true;
      }

      return {
        ...item,
        value,
        cumulativePct: roundedCumPct,
        isVital80,
      };
    });

    return { list: itemsWithCumulative, totalCount, totalDowntime };
  }, [dateFilteredTransactions, paretoMode, paretoGroupBy, selectedParetoMachine]);

  // Human-readable grade label for KPI card subtitles
  const gradeLabel = useMemo(() => {
    if (chartGradeFilter === "GRADE_A") return "Grade A";
    if (chartGradeFilter === "GRADE_B") return "Grade B";
    if (chartGradeFilter === "BS") return "BS";
    if (chartGradeFilter === "UNGRADED") return "Belum Diinspeksi";
    return "Semua Grade";
  }, [chartGradeFilter]);

  // Filter criteria logic
  const filteredData = useMemo(() => {
    const validProductionData = dateFilteredTransactions.filter(
      (item) => item.is_production,
    );

    switch (activeFilter) {
      case "LOLOS":
        return validProductionData.filter((item) => item.status_qc === "Lolos" || isPanelGagalCacat(item) || !hasRealDefect(item));
      case "EFISIENSI":
        return validProductionData.filter((item) => {
          const ef =
            item.target_pcs > 0 ? (item.hasil_pcs / item.target_pcs) * 100 : 0;
          return ef >= 90;
        });
      case "PROBLEMS":
        return dateFilteredTransactions.filter(
          (item) => !isBsAwalAkhir(item) && !isPanelGagalCacat(item) && hasRealDefect(item) && (item.status_qc === "Recheck" || item.grade === "BS" || (item.kategori_masalah && item.kategori_masalah.trim() !== "")),
        );
      case "NOL_PRODUKSI":
        return validProductionData.filter((item) => item.hasil_pcs === 0);
      case "ALL":
      default:
        return validProductionData;
    }
  }, [activeFilter, dateFilteredTransactions]);

  const categoryBreakdown = useMemo(() => {
    const PROBLEM_DETAILS_MAP: Record<string, string[]> = {
      A: [
        "L1/L2/L3 Benang timbul putus",
        "L1/L2/L3 Benang timbul tebal",
        "Benang lolos",
        "Jarum timbul patah/bengkok",
        "Over-lap/double lap",
        "Pattern timbul cacat",
        "Proofing timbul cacat",
      ],
      B: [
        "Jarum pattern patah/bengkok",
        "Ganti jarum Compoun Nedle, pattern",
        "Ganti Jacquard",
        "Stripe/garis jarum",
        "Lubang/bolong",
        "Beda warna/stripe",
      ],
    };

    const problemData = dateFilteredTransactions.filter(
      (item) =>
        !isBsAwalAkhir(item) &&
        !isPanelGagalCacat(item) &&
        hasRealDefect(item) &&
        (item.status_qc === "Recheck" || item.grade === "BS" || (item.kategori_masalah && item.kategori_masalah.trim() !== "")),
    );
    const catMap = new Map<string, number>();

    problemData.forEach((item) => {
      let itemCount = 1;
      let cats: string[] = [];

      if (item.kategori_masalah && item.kategori_masalah.trim() !== "" && item.kategori_masalah !== "X" && item.kategori_masalah !== "G") {
        cats = item
          .kategori_masalah.split(",")
          .map((c) => c.trim())
          .filter((c) => c !== "" && c !== "X" && c !== "G" && !c.toUpperCase().includes("GAGAL CACAT"));
      }

      if (cats.length === 0 && item.detail_masalah && item.detail_masalah.trim() !== "") {
        for (const [kat, detList] of Object.entries(PROBLEM_DETAILS_MAP)) {
          if (detList.some((d) => item.detail_masalah!.includes(d))) {
            cats.push(kat);
            break;
          }
        }
      }

      const ket = item.keterangan_cacat || (item as any).keterangan || "";
      if (ket && typeof ket === "string") {
        const blockMatches = ket.match(/Blok\s*\d+/gi);
        if (blockMatches && blockMatches.length > 0) {
          itemCount = Math.max(itemCount, blockMatches.length);
        }
      }

      if (cats.length > 0) {
        cats.forEach((c) => {
          catMap.set(c, (catMap.get(c) || 0) + Math.max(1, Math.floor(itemCount / cats.length)));
        });
      } else {
        const fallbackCat = item.grade === "BS" ? "BS" : "X";
        catMap.set(fallbackCat, (catMap.get(fallbackCat) || 0) + itemCount);
      }
    });

    const total = Array.from(catMap.values()).reduce(
      (sum, count) => sum + count,
      0,
    );
    // Sort alphabetically by category code
    const list = Array.from(catMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    return { list, total };
  }, [dateFilteredTransactions]);

  // Attendance Logic
  const attendanceStats = useMemo(() => {
    // Total registered employees
    const totalPegawai = uniqueOperators.length;

    // Filter transactions strictly by the selected date range to find who was present
    // Note: We use dateFilteredTransactions without selectedOperators filter for attendance
    // to correctly calculate overall attendance.
    let dateScoped = transactions;
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA");

    dateScoped = dateScoped.filter((item) => {
      const itemDate = new Date(item.tanggal);
      if (isNaN(itemDate.getTime())) return true;
      if (dateRangeMode === "TODAY")
        return itemDate.toLocaleDateString("en-CA") === todayStr;
      if (dateRangeMode === "7DAYS") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return itemDate >= sevenDaysAgo && itemDate <= now;
      }
      if (dateRangeMode === "30DAYS") {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return itemDate >= thirtyDaysAgo && itemDate <= now;
      }
      if (dateRangeMode === "CUSTOM") {
        if (!startDate && !endDate) return true;
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (start && end) {
          end.setHours(23, 59, 59, 999);
          return itemDate >= start && itemDate <= end;
        } else if (start) return itemDate >= start;
        else if (end) {
          end.setHours(23, 59, 59, 999);
          return itemDate <= end;
        }
      }
      return true;
    });

    const hadirOperators = new Set(dateScoped.map((t) => t.nama_operator));
    const countHadir = hadirOperators.size;
    const countTidakHadir = Math.max(0, totalPegawai - countHadir);
    const persentaseHadir =
      totalPegawai > 0 ? (countHadir / totalPegawai) * 100 : 0;

    const listTidakHadir = uniqueOperators.filter(
      (op) => !hadirOperators.has(op),
    );

    return {
      totalPegawai,
      countHadir,
      countTidakHadir,
      persentaseHadir,
      listTidakHadir,
    };
  }, [transactions, uniqueOperators, dateRangeMode, startDate, endDate]);

  // Aggregate daily production data for dynamic chart, segmented by grade
  const chartData = useMemo(() => {
    if (activeFilter === "PROBLEMS") {
      return categoryBreakdown.list.map(([cat, count]) => {
        return {
          label: cat,
          gradeA_sum: 0,
          gradeB_sum: 0,
          bs_sum: 0,
          ungraded_sum: 0,
          total: count,
        };
      });
    }

    let groups: string[] = [];

    if (chartGroupBy === "HARI") {
      // Get unique dates from the filtered data and sort them chronologically
      const dates = Array.from(
        new Set(filteredData.map((item) => item.tanggal)),
      );
      groups = dates.sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime(),
      );

      // If no data, show at least today's date
      if (groups.length === 0) {
        groups = [new Date().toISOString().split("T")[0]];
      }
    } else if (chartGroupBy === "DESIGN") {
      // Get unique designs, sorted
      const designs = Array.from(
        new Set(filteredData.map((item) => item.design || "Tanpa Design")),
      );
      groups = designs.sort();
    } else if (chartGroupBy === "PEGAWAI") {
      // Get all operators by volume
      const operatorVolume: Record<string, number> = {};
      filteredData.forEach((item) => {
        operatorVolume[item.nama_operator] =
          (operatorVolume[item.nama_operator] || 0) + item.hasil_pcs;
      });
      groups = Object.keys(operatorVolume).sort(
        (a, b) => operatorVolume[b] - operatorVolume[a],
      );
    } else if (chartGroupBy === "GROUP") {
      const g = Array.from(
        new Set(filteredData.map((item) => item.group || "Tanpa Group")),
      );
      groups = g.sort();
    } else if (chartGroupBy === "MESIN") {
      const m = Array.from(
        new Set(filteredData.map((item) => item.mesin_id || "Tanpa Mesin")),
      );
      groups = m.sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.replace(/\D/g, "")) || 0;
        return numA !== numB ? numA - numB : a.localeCompare(b);
      });
    }

    return groups.map((groupName) => {
      let items: Transaction[] = [];
      if (chartGroupBy === "HARI") {
        items = filteredData.filter((item) => item.tanggal === groupName);
      } else if (chartGroupBy === "DESIGN") {
        items = filteredData.filter(
          (item) => (item.design || "Tanpa Design") === groupName,
        );
      } else if (chartGroupBy === "PEGAWAI") {
        items = filteredData.filter((item) => item.nama_operator === groupName);
      } else if (chartGroupBy === "GROUP") {
        items = filteredData.filter(
          (item) => (item.group || "Tanpa Group") === groupName,
        );
      } else if (chartGroupBy === "MESIN") {
        items = filteredData.filter(
          (item) => (item.mesin_id || "Tanpa Mesin") === groupName,
        );
      }

      let gradeA_sum = 0;
      let gradeB_sum = 0;
      let bs_sum = 0;
      let ungraded_sum = 0;

      if (metricMode === "PCS") {
        const cutMap: { [key: string]: typeof items } = {};
        items.forEach((item) => {
          if (
            item.panel_no !== undefined &&
            item.panel_no !== null &&
            !isNaN(Number(item.panel_no)) &&
            (item.hasil_meter || 0) === 0
          ) {
            const key = `${item.mesin_id}_${item.design}_${item.potongan_ke}`;
            if (!cutMap[key]) cutMap[key] = [];
            cutMap[key].push(item);
          }
        });

        Object.values(cutMap).forEach((cutItems) => {
          const presentPanels = new Set<number>();

          cutItems.forEach((i) => {
            const pNo = Number(i.panel_no);
            presentPanels.add(pNo);
            if (i.grade === "GRADE A") gradeA_sum++;
            else if (i.grade === "GRADE B") gradeB_sum++;
            else if (i.grade === "BS") bs_sum++;
            else ungraded_sum++;
          });

          const uninspectedCount = Math.max(0, presentPanels.size - cutItems.length);
          ungraded_sum += uninspectedCount;
        });
      } else {
        const uniqueHeadersMap = new Map<string, (typeof items)[0]>();
        items.forEach((item) => {
          if (item.header_id && !uniqueHeadersMap.has(item.header_id)) {
            uniqueHeadersMap.set(item.header_id, item);
          }
        });
        const uniqueItems = Array.from(uniqueHeadersMap.values());
        gradeA_sum = uniqueItems
          .filter((i) => i.grade === "GRADE A")
          .reduce(
            (acc, curr) => acc + (parseFloat(curr.hasil_meter as any) || 0),
            0,
          );
        gradeB_sum = uniqueItems
          .filter((i) => i.grade === "GRADE B")
          .reduce(
            (acc, curr) => acc + (parseFloat(curr.hasil_meter as any) || 0),
            0,
          );
        bs_sum = uniqueItems
          .filter((i) => i.grade === "BS")
          .reduce(
            (acc, curr) => acc + (parseFloat(curr.hasil_meter as any) || 0),
            0,
          );
        ungraded_sum = uniqueItems
          .filter(
            (i) =>
              i.grade === "UNGRADED" ||
              !["GRADE A", "GRADE B", "BS"].includes(i.grade),
          )
          .reduce(
            (acc, curr) => acc + (parseFloat(curr.hasil_meter as any) || 0),
            0,
          );
      }

      const total = gradeA_sum + gradeB_sum + bs_sum + ungraded_sum;

      let displayLabel = groupName;
      if (chartGroupBy === "HARI") {
        const d = new Date(groupName);
        if (!isNaN(d.getTime())) {
          displayLabel = d.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
          });
        }
      }

      return {
        label: displayLabel,
        gradeA_sum,
        gradeB_sum,
        bs_sum,
        ungraded_sum,
        total,
      };
    });
  }, [filteredData, chartGroupBy, metricMode]);

  const maxChartValue = useMemo(() => {
    if (activeFilter === "PROBLEMS") {
      const maxProblemCount = Math.max(
        ...categoryBreakdown.list.map(([, count]) => count),
        0,
      );
      return getNiceChartMax(maxProblemCount);
    }

    const maxVisibleValue = Math.max(
      ...chartData.map((item) => {
        if (chartGradeFilter === "GRADE_A") return item.gradeA_sum;
        if (chartGradeFilter === "GRADE_B") return item.gradeB_sum;
        if (chartGradeFilter === "BS") return item.bs_sum;
        if (chartGradeFilter === "UNGRADED") return item.ungraded_sum;

        return Math.max(
          item.total,
          item.gradeA_sum,
          item.gradeB_sum,
          item.bs_sum,
          item.ungraded_sum,
        );
      }),
      0,
    );

    return getNiceChartMax(maxVisibleValue);
  }, [activeFilter, categoryBreakdown.list, chartData, chartGradeFilter]);

  const handleResetFilters = () => {
    setActiveFilter("ALL");
    setChartGradeFilter("ALL");
    setDateRangeMode("7DAYS");
    setStartDate("");
    setEndDate("");
    setSelectedOperators([]);
    setSelectedMachines([]);
    setIsOperatorDropdownOpen(false);
    setIsMachineDropdownOpen(false);
    setMetricMode("PCS");
  };

  // Rekap Data (Group x Hari)
  const rekapData = useMemo(() => {
    const dates = Array.from(
      new Set(dateFilteredTransactions.map((t) => t.tanggal)),
    ).sort();
    const groups = Array.from(
      new Set(dateFilteredTransactions.map((t) => t.group || "Tanpa Group")),
    ).sort();

    const data = dates.map((date) => {
      const row: any = { tanggal: date };
      let total = 0;
      groups.forEach((group) => {
        const sum = dateFilteredTransactions
          .filter(
            (t) => t.tanggal === date && (t.group || "Tanpa Group") === group,
          )
          .reduce(
            (acc, curr) =>
              acc +
              (metricMode === "PCS" ? curr.hasil_pcs : curr.hasil_meter || 0),
            0,
          );
        row[group] = sum;
        total += sum;
      });
      row.total = total;
      return row;
    });

    const grandTotals: any = { tanggal: "Total" };
    let absoluteTotal = 0;
    groups.forEach((group) => {
      const sum = data.reduce((acc, curr) => acc + (curr[group] as number), 0);
      grandTotals[group] = sum;
      absoluteTotal += sum;
    });
    grandTotals.total = absoluteTotal;

    return { dates, groups, data, grandTotals };
  }, [dateFilteredTransactions, metricMode]);

  const handleExportExcel = async () => {
    const XLSX = await import("xlsx");

    // 1. Sheet Ringkasan (Summary)
    const totalData = dateFilteredTransactions.length;
    let totalPcs = 0;
    let gradeA = 0,
      gradeB = 0,
      bs = 0,
      ungraded = 0;
    let lolos = 0,
      recheck = 0;

    const operatorMap: Record<string, number> = {};
    const designMap: Record<string, number> = {};
    const groupMap: Record<string, number> = {};

    dateFilteredTransactions.forEach((t) => {
      totalPcs += t.hasil_pcs;

      if (t.grade === "GRADE A") gradeA++;
      else if (t.grade === "GRADE B") gradeB++;
      else if (t.grade === "BS") bs++;
      else ungraded++;

      const isDefect = !isPanelGagalCacat(t) && hasRealDefect(t);
      if (t.status_qc === "Lolos" || !isDefect) lolos++;
      else if (t.status_qc === "Recheck" && isDefect) recheck++;

      operatorMap[t.nama_operator] =
        (operatorMap[t.nama_operator] || 0) + t.hasil_pcs;
      const d = t.design || "Tanpa Design";
      designMap[d] = (designMap[d] || 0) + t.hasil_pcs;
      const g = t.group || "Tanpa Group";
      groupMap[g] = (groupMap[g] || 0) + t.hasil_pcs;
    });

    const topOperators = Object.entries(operatorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topDesigns = Object.entries(designMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const summaryData = [
      ["RINGKASAN LAPORAN PRODUKSI"],
      [],
      ["1. OVERVIEW"],
      ["Total Transaksi (Baris)", totalData],
      ["Total Produksi (Pcs)", totalPcs],
      [],
      ["2. KUALITAS PRODUK (Berdasarkan Panel)"],
      ["Lolos QC", lolos],
      ["Recheck", recheck],
      ["GRADE A", gradeA],
      ["GRADE B", gradeB],
      ["BS", bs],
      ["Belum Diinspeksi", ungraded],
      [],
      ["3. PERFORMA GRUP (Pcs)"],
      ...Object.entries(groupMap).map(([g, val]) => [g, val]),
      [],
      ["4. TOP 5 OPERATOR (Pcs)"],
      ...topOperators.map(([op, val], idx) => [`${idx + 1}. ${op}`, val]),
      [],
      ["5. TOP 5 DESAIN (Pcs)"],
      ...topDesigns.map(([d, val], idx) => [`${idx + 1}. ${d}`, val]),
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

    // 2. Sheet Rekap (Original)
    const wsData = [];
    wsData.push(["Tanggal", ...rekapData.groups, "Total"]);
    rekapData.data.forEach((row) => {
      wsData.push([
        row.tanggal,
        ...rekapData.groups.map((g) => row[g]),
        row.total,
      ]);
    });
    wsData.push([
      "Total",
      ...rekapData.groups.map((g) => rekapData.grandTotals[g]),
      rekapData.grandTotals.total,
    ]);

    const wsRekap = XLSX.utils.aoa_to_sheet(wsData);

    // Create workbook and append sheets
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan Laporan");
    XLSX.utils.book_append_sheet(wb, wsRekap, "Rekap Produksi Harian");
    XLSX.writeFile(wb, "Laporan_Produksi.xlsx");
  };

  const handleExportPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    await import("jspdf-autotable");

    const doc = new jsPDF();
    doc.text("Rekap Produksi Harian per Grup", 14, 15);

    const head = [["Tanggal", ...rekapData.groups, "Total"]];
    const body = rekapData.data.map((row) => [
      row.tanggal,
      ...rekapData.groups.map((g) => row[g]),
      row.total,
    ]);
    const foot = [
      [
        "Total",
        ...rekapData.groups.map((g) => rekapData.grandTotals[g]),
        rekapData.grandTotals.total,
      ],
    ];

    (doc as any).autoTable({
      head,
      body,
      foot,
      startY: 20,
      theme: "grid",
      headStyles: { fillColor: [0, 112, 188] },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: "bold",
      },
      styles: { fontSize: 8 },
    });

    doc.save("Rekap_Produksi_Harian.pdf");
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Header */}
      <div
        data-tour="dashboard-header"
        className="bg-white border border-[#e9ecef] rounded-[24px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.015)] relative z-10"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                <span className="bg-gradient-to-r from-slate-900 via-[#004777] to-[#0070bc] bg-clip-text text-transparent drop-shadow-sm">
                  DASHBOARD
                </span>
              </h1>
              {isLive ? (
                <span
                  title="Indikator Biru: Terhubung ke Database"
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border border-sky-100 shadow-[0_2px_10px_-3px_rgba(14,165,233,0.15)] cursor-help"
                >
                  <span className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.6)] animate-pulse" />
                </span>
              ) : (
                <span
                  title="Indikator Abu: Terputus dari Database (Demo)"
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm cursor-help"
                >
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsTourOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3.5 py-1.5 text-xs font-extrabold text-[#0070bc] shadow-sm transition-all hover:bg-sky-100"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Tutorial
            </button>
            <button
              type="button"
              onClick={() => setIsMonthlyRekapModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[#0070bc] px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-[#005a96]"
              title="Download Rekap Laporan Bulanan"
            >
              <Download className="w-3.5 h-3.5" />
              Rekap Excel
            </button>
            {/* Dashboard Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200 shadow-inner">
              <button
                onClick={() => setDashboardMode("PRODUKSI")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${dashboardMode === "PRODUKSI"
                  ? "bg-white text-[#0070bc] shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                  }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Produksi
              </button>
              <button
                onClick={() => setDashboardMode("KEHADIRAN")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${dashboardMode === "KEHADIRAN"
                  ? "bg-white text-emerald-600 shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                  }`}
              >
                <Users className="w-3.5 h-3.5" />
                Kehadiran
              </button>
            </div>

            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 hover:text-[#0070bc] hover:border-sky-200 rounded-full border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 group"
              title="Reset Slicer"
            >
              <RefreshCw className="w-3.5 h-3.5 transition-transform duration-500 group-hover:rotate-180" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Slicers Container */}
      <div
        data-tour="dashboard-slicers"
        className="flex flex-col lg:flex-row lg:flex-wrap xl:flex-nowrap gap-4"
      >
        {/* Date Range Slicer */}
        <div className="flex-1 flex flex-wrap items-center justify-between gap-2 bg-white border border-[#e9ecef] rounded-[24px] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)] w-full">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/60 text-slate-400">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mr-1 whitespace-nowrap">
              Range Waktu:
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-150">
              <button
                onClick={() => setDateRangeMode("TODAY")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${dateRangeMode === "TODAY"
                  ? "bg-white text-slate-800 shadow-xs border border-slate-150"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => setDateRangeMode("7DAYS")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${dateRangeMode === "7DAYS"
                  ? "bg-white text-slate-800 shadow-xs border border-slate-150"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                7 Hari
              </button>
              <button
                onClick={() => setDateRangeMode("30DAYS")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${dateRangeMode === "30DAYS"
                  ? "bg-white text-slate-800 shadow-xs border border-slate-150"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                30 Hari
              </button>
              <button
                onClick={() => setDateRangeMode("CUSTOM")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${dateRangeMode === "CUSTOM"
                  ? "bg-white text-slate-800 shadow-xs border border-slate-150"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                Kustom
              </button>
            </div>

            {/* Custom Calendar Inputs (Only visible when CUSTOM is active) */}
            {dateRangeMode === "CUSTOM" && (
              <div className="flex items-center gap-3 animate-fadeIn">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Mulai:
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Sampai:
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Metric Mode Slicer */}
        <div className="flex items-center justify-between gap-2 bg-white border border-[#e9ecef] rounded-[24px] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)] lg:shrink-0 w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/60 text-slate-400">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mr-1 whitespace-nowrap">
              Kategori:
            </span>
          </div>
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-150">
            <button
              onClick={() => setMetricMode("PCS")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${metricMode === "PCS"
                ? "bg-white text-slate-800 shadow-xs border border-slate-150"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              Panel
            </button>
            <button
              onClick={() => setMetricMode("METER")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${metricMode === "METER"
                ? "bg-white text-slate-800 shadow-xs border border-slate-150"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              Meteran
            </button>
          </div>
        </div>

        {/* Entity Filters (Machine & Operator) */}
        <div className="flex flex-col gap-3 bg-white border border-[#e9ecef] rounded-[24px] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)] lg:shrink-0 flex-1 lg:flex-none">

          {/* Machine Slicer */}
          <div className="flex items-center justify-between w-full gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/60 text-slate-400">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mr-1">
                Mesin:
              </span>
            </div>
            <div className="relative">
              <button
                onClick={() => setIsMachineDropdownOpen(!isMachineDropdownOpen)}
                className="bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 font-bold cursor-pointer min-w-[120px] flex justify-between items-center"
              >
                <span className="truncate max-w-[100px]">
                  {selectedMachines.length === 0
                    ? "Semua"
                    : `${selectedMachines.length} Terpilih`}
                </span>
                <span className="text-[9px] ml-2 text-slate-400">▼</span>
              </button>

              {isMachineDropdownOpen && (
                <div className="absolute top-full mt-2 right-0 w-56 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-50 p-3 max-h-[300px] flex flex-col">
                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase">
                      Pilih Mesin
                    </span>
                    <button
                      onClick={() => setIsMachineDropdownOpen(false)}
                      className="text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50 px-2 py-0.5 rounded"
                    >
                      Tutup
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
                    <label className="flex items-center gap-2.5 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg group">
                      <input
                        type="checkbox"
                        checked={selectedMachines.length === 0}
                        onChange={() => setSelectedMachines([])}
                        className="accent-sky-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span
                        className={`text-xs font-bold transition-colors ${selectedMachines.length === 0 ? "text-sky-700" : "text-slate-600 group-hover:text-slate-800"}`}
                      >
                        Semua Mesin
                      </span>
                    </label>
                    <div className="h-px bg-slate-100 my-1" />
                    {uniqueMachines.map((mac) => (
                      <label
                        key={mac}
                        className="flex items-center gap-2.5 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg group"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMachines.includes(mac)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMachines((prev) => [...prev, mac]);
                            } else {
                              setSelectedMachines((prev) =>
                                prev.filter((m) => m !== mac),
                              );
                            }
                          }}
                          className="accent-sky-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span
                          className={`text-xs font-semibold transition-colors ${selectedMachines.includes(mac) ? "text-sky-700" : "text-slate-600 group-hover:text-slate-800"}`}
                        >
                          {mac}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="w-full h-px bg-slate-100 shrink-0" />

          {/* Operator Slicer */}
          <div className="flex items-center justify-between w-full gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/60 text-slate-400">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mr-1">
                Pegawai:
              </span>
            </div>
            <div className="relative">
              <button
                onClick={() => setIsOperatorDropdownOpen(!isOperatorDropdownOpen)}
                className="bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 font-bold cursor-pointer min-w-[120px] flex justify-between items-center"
              >
                <span className="truncate max-w-[100px]">
                  {selectedOperators.length === 0
                    ? "Semua"
                    : `${selectedOperators.length} Terpilih`}
                </span>
                <span className="text-[9px] ml-2 text-slate-400">▼</span>
              </button>

              {isOperatorDropdownOpen && (
                <div className="absolute top-full mt-2 right-0 w-64 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-50 p-3 max-h-[300px] flex flex-col">
                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase">
                      Pilih Pegawai
                    </span>
                    <button
                      onClick={() => setIsOperatorDropdownOpen(false)}
                      className="text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50 px-2 py-0.5 rounded"
                    >
                      Tutup
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
                    <label className="flex items-center gap-2.5 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg group">
                      <input
                        type="checkbox"
                        checked={selectedOperators.length === 0}
                        onChange={() => setSelectedOperators([])}
                        className="accent-sky-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span
                        className={`text-xs font-bold transition-colors ${selectedOperators.length === 0 ? "text-sky-700" : "text-slate-600 group-hover:text-slate-800"}`}
                      >
                        Semua Pegawai
                      </span>
                    </label>
                    <div className="h-px bg-slate-100 my-1" />
                    {uniqueOperators.map((op) => (
                      <label
                        key={op}
                        className="flex items-center gap-2.5 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg group"
                      >
                        <input
                          type="checkbox"
                          checked={selectedOperators.includes(op)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOperators((prev) => [...prev, op]);
                            } else {
                              setSelectedOperators((prev) =>
                                prev.filter((o) => o !== op),
                              );
                            }
                          }}
                          className="accent-sky-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span
                          className={`text-xs font-semibold transition-colors ${selectedOperators.includes(op) ? "text-sky-700" : "text-slate-600 group-hover:text-slate-800"}`}
                        >
                          {op}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {dashboardMode === "PRODUKSI" ? (
        <>
          {/* Grid KPI Cards / Slicer Buttons */}
          <div
            data-tour="dashboard-kpi"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {dashboardViewType === "OEE" ? (
              <>
                {/* Card 1: OEE Score (Master KPI) */}
                <div className="relative overflow-hidden rounded-[24px] h-full min-h-[11rem] bg-[#004777] shadow-xl ring-2 ring-[#0070bc] ring-offset-2 text-white p-5 flex flex-col justify-between transition-all duration-300 group">
                  {/* Background decoration */}
                  <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-sky-400/20 blur-xl group-hover:scale-125 transition-all duration-300 pointer-events-none" />

                  <div className="flex justify-between items-start relative z-10">
                    <span className="text-sky-100 text-[10px] font-bold uppercase tracking-wider">
                      Overall OEE Score ({gradeLabel})
                    </span>
                    <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white text-[10px] font-bold">
                      OEE
                    </span>
                  </div>
                  <div className="mt-2 relative z-10">
                    <div className="text-4xl font-black tracking-tight flex items-baseline gap-1">
                      {stats.oee.toFixed(1)}%
                    </div>
                    <div className="flex flex-col mt-2 gap-1 text-[10px] text-sky-200 font-semibold border-t border-white/10 pt-2">
                      <div className="flex justify-between">
                        <span>Availability:</span>
                        <span>{stats.availability.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Performance:</span>
                        <span>{stats.performance.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Quality (FPY):</span>
                        <span>{stats.quality.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 text-[10px] text-sky-100/90 font-bold">
                      <span>Delta vs prior:</span>
                      <span
                        className={`font-black ${deltas.oee.type === "up" ? "text-emerald-400" : deltas.oee.type === "down" ? "text-rose-400" : "text-sky-200"}`}
                      >
                        {deltas.oee.type === "up"
                          ? "▲ +"
                          : deltas.oee.type === "down"
                            ? "▼ "
                            : ""}
                        {deltas.oee.value}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Availability (Ketersediaan Mesin) */}
                <div
                  onClick={() => setActiveFilter("ALL")}
                  className={`relative overflow-hidden rounded-[24px] h-full min-h-[11rem] border border-[#e9ecef] cursor-pointer p-5 flex flex-col justify-between transition-all duration-300 ${activeFilter === "ALL" && metricMode === "PCS"
                    ? "bg-slate-50/50 border-slate-500 text-slate-800 shadow-md"
                    : "bg-white border-[#e9ecef] text-slate-800 hover:scale-[1.01] hover:shadow-xs"
                    }`}
                >
                  <div className="flex justify-between items-start relative z-10">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                      Availability (Ketersediaan)
                    </span>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-100 text-slate-500">
                      A
                    </span>
                  </div>
                  <div className="mt-2 relative z-10">
                    <div className="text-3xl font-black tracking-tight text-slate-800 flex items-baseline gap-1">
                      {stats.availability.toFixed(1)}%
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-extrabold text-slate-500">
                      <span>
                        Downtime: {formatDuration(stats.totalDowntimeDetik)}
                      </span>
                    </div>
                    <div className="mt-3 border-t border-slate-100 pt-2 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold">
                        Tren:
                      </span>
                      <DeltaBadge delta={deltas.availability} />
                    </div>
                  </div>
                </div>

                {/* Card 3: Performance (Kinerja Produksi) */}
                <div
                  className={`relative overflow-hidden rounded-[24px] h-full min-h-[11rem] border transition-all duration-300 flex flex-col bg-white border-[#e9ecef] text-slate-800 hover:scale-[1.01] hover:shadow-xs`}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEndMetric}
                >
                  {/* Slide Container */}
                  <div
                    className="flex h-full w-[200%] transition-transform duration-500 ease-in-out"
                    style={{
                      transform: `translateX(-${metricMode === "PCS" ? 0 : 50}%)`,
                    }}
                  >
                    {/* Slide 0: Performance Pcs */}
                    <div
                      onClick={() => {
                        setMetricMode("PCS");
                      }}
                      className="w-1/2 cursor-pointer p-5 flex flex-col justify-between h-full relative"
                    >
                      <div className="flex justify-between items-start relative z-10">
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                          Performance Rate (PANEL)
                        </span>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-100 text-slate-500">
                          P
                        </span>
                      </div>
                      <div className="mt-2 relative z-10">
                        <div className="text-3xl font-black tracking-tight text-slate-800">
                          {stats.performance.toFixed(1)}%
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-[#0070bc] font-bold">
                          <span>
                            {stats.totalHasilPcs.toLocaleString()} /{" "}
                            {stats.totalTarget.toLocaleString()} Panel
                          </span>
                        </div>
                        <div className="mt-3 border-t border-slate-100 pt-2 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-bold">
                            Tren:
                          </span>
                          <DeltaBadge delta={deltas.performance} />
                        </div>
                      </div>
                    </div>

                    {/* Slide 1: Production Meter */}
                    <div
                      onClick={() => {
                        setMetricMode("METER");
                      }}
                      className="w-1/2 cursor-pointer p-5 flex flex-col justify-between h-full relative"
                    >
                      <div className="flex justify-between items-start relative z-10">
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                          Volume Produksi (METER)
                        </span>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-100 text-slate-500">
                          V
                        </span>
                      </div>
                      <div className="mt-2 relative z-10">
                        <div className="text-3xl font-black tracking-tight text-slate-800">
                          {stats.totalProduksiMeter.toLocaleString()} m
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-[#0070bc] font-bold">
                          <span>Total Gulungan</span>
                        </div>
                        <div className="mt-3 border-t border-slate-100 pt-2 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-bold">
                            Tren:
                          </span>
                          <DeltaBadge delta={deltas.totalProduksiMeter} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dots Indicator */}
                  <div
                    className="absolute bottom-3 right-3 flex items-center gap-1 z-20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setMetricMode("PCS");
                      }}
                      className="p-3 -m-3 cursor-pointer"
                      title="Geser ke PCS"
                    >
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${metricMode === "PCS" ? "w-4 bg-slate-800" : "w-1.5 bg-slate-300"}`}
                      />
                    </button>
                    <button
                      onClick={() => {
                        setMetricMode("METER");
                      }}
                      className="p-3 -m-3 cursor-pointer ml-3"
                      title="Geser ke METER"
                    >
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${metricMode === "METER" ? "w-4 bg-slate-800" : "w-1.5 bg-slate-300"}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Card 4: Quality / FPY (First Pass Yield) */}
                <div
                  className={`relative overflow-hidden rounded-[24px] h-full min-h-[11rem] border transition-all duration-300 flex flex-col bg-white border-[#e9ecef] text-slate-800 hover:scale-[1.01] hover:shadow-xs`}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEndMetric}
                >
                  {/* Slide Container */}
                  <div
                    className="flex h-full w-[200%] transition-transform duration-500 ease-in-out"
                    style={{
                      transform: `translateX(-${metricMode === "PCS" ? 0 : 50}%)`,
                    }}
                  >
                    {/* Slide 0: Quality Panel */}
                    <div
                      onClick={() => {
                        setMetricMode("PCS");
                      }}
                      className="w-1/2 cursor-pointer p-5 flex flex-col justify-between h-full relative"
                    >
                      <div className="flex justify-between items-start relative z-10">
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                          First Pass Yield (Panel)
                        </span>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-100 text-slate-500">
                          Q
                        </span>
                      </div>
                      <div className="mt-2 relative z-10">
                        <div className="text-3xl font-black tracking-tight text-slate-800">
                          {stats.fpyPanel.toFixed(1)}%
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-[#0070bc] font-bold">
                          <span>
                            Cacat: {stats.countMasalahPanel} dari{" "}
                            {stats.totalPanelValid} panel
                          </span>
                        </div>
                        <div className="mt-3 border-t border-slate-100 pt-2 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-bold">
                            Tren:
                          </span>
                          <DeltaBadge delta={deltas.quality} />
                        </div>
                      </div>
                    </div>

                    {/* Slide 1: Quality Meteran */}
                    <div
                      onClick={() => {
                        setMetricMode("METER");
                      }}
                      className="w-1/2 cursor-pointer p-5 flex flex-col justify-between h-full relative"
                    >
                      <div className="flex justify-between items-start relative z-10">
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                          Quality Rate (METER)
                        </span>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-100 text-slate-500">
                          Q
                        </span>
                      </div>
                      <div className="mt-2 relative z-10">
                        <div className="text-3xl font-black tracking-tight text-slate-800">
                          {stats.fpyMeteran.toFixed(1)}%
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-[#0070bc] font-bold">
                          <span>
                            Cacat: {stats.countMasalahMeteran} titik /{" "}
                            {stats.totalProduksiMeter.toFixed(0)}m
                          </span>
                        </div>
                        <div className="mt-3 border-t border-slate-100 pt-2 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-bold">
                            Tren:
                          </span>
                          <DeltaBadge delta={deltas.quality} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dots Indicator */}
                  <div
                    className="absolute bottom-3 right-3 flex items-center gap-1 z-20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setMetricMode("PCS");
                      }}
                      className="p-3 -m-3 cursor-pointer"
                      title="Geser ke Quality Panel"
                    >
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${metricMode === "PCS" ? "w-4 bg-slate-800" : "w-1.5 bg-slate-300"}`}
                      />
                    </button>
                    <button
                      onClick={() => {
                        setMetricMode("METER");
                      }}
                      className="p-3 -m-3 cursor-pointer ml-3"
                      title="Geser ke Quality Meter"
                    >
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${metricMode === "METER" ? "w-4 bg-slate-800" : "w-1.5 bg-slate-300"}`}
                      />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* CLASSIC Card 1: Hasil Produksi (Slider Slicer) */}
                <div
                  className={`relative overflow-hidden rounded-[24px] h-full min-h-[11rem] group transition-all duration-300 flex flex-col ${activeFilter === "ALL"
                    ? "bg-[#004777] shadow-xl scale-[1.03] ring-2 ring-[#0070bc] ring-offset-2 text-white"
                    : "bg-[#0070bc] shadow-md hover:scale-[1.01] text-white"
                    }`}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEndMetric}
                >
                  <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-sky-400/20 blur-xl group-hover:scale-125 transition-all duration-300 pointer-events-none" />
                  <div
                    className="flex h-full w-[200%] transition-transform duration-500 ease-in-out"
                    style={{
                      transform: `translateX(-${metricMode === "PCS" ? 0 : 50}%)`,
                    }}
                  >
                    <div
                      onClick={() => {
                        setActiveFilter("ALL");
                        setMetricMode("PCS");
                      }}
                      className="w-1/2 cursor-pointer p-5 flex flex-col justify-between h-full relative"
                    >
                      <div className="flex justify-between items-start relative z-10">
                        <span className="text-sky-100 text-[10px] font-bold uppercase tracking-wider">
                          Total Produksi ({gradeLabel})
                        </span>
                        <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white text-[10px] font-bold">
                          All
                        </span>
                      </div>
                      <div className="mt-2 relative z-10">
                        <div className="text-3xl font-black tracking-tight flex items-baseline gap-1">
                          {stats.totalProduksi.toLocaleString()}
                          <span className="text-sm font-semibold opacity-80">
                            Panel
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-sky-200 font-semibold">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Panel</span>
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => {
                        setActiveFilter("ALL");
                        setMetricMode("METER");
                      }}
                      className="w-1/2 cursor-pointer p-5 flex flex-col justify-between h-full relative"
                    >
                      <div className="flex justify-between items-start relative z-10">
                        <span className="text-sky-100 text-[10px] font-bold uppercase tracking-wider">
                          Total Produksi ({gradeLabel})
                        </span>
                        <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white text-[10px] font-bold">
                          All
                        </span>
                      </div>
                      <div className="mt-2 relative z-10">
                        <div className="text-3xl font-black tracking-tight flex items-baseline gap-1">
                          {stats.totalProduksiMeter.toLocaleString()}
                          <span className="text-sm font-semibold opacity-80">
                            Meter
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-sky-200 font-semibold">
                          <Layers className="w-3.5 h-3.5" />
                          <span>Bentuk Gulungan</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="absolute bottom-3 right-3 flex items-center gap-1 z-20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setMetricMode("PCS");
                      }}
                      className="p-3 -m-3 cursor-pointer"
                      title="Geser ke PCS"
                    >
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${metricMode === "PCS" ? "w-4 bg-white" : "w-1.5 bg-sky-350"}`}
                      />
                    </button>
                    <button
                      onClick={() => {
                        setMetricMode("METER");
                      }}
                      className="p-3 -m-3 cursor-pointer ml-3"
                      title="Geser ke METER"
                    >
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${metricMode === "METER" ? "w-4 bg-white" : "w-1.5 bg-sky-350"}`}
                      />
                    </button>
                  </div>
                </div>

                {/* CLASSIC Card 2: Lolos QC */}
                <div
                  className={`relative overflow-hidden rounded-[24px] h-full min-h-[11rem] group border transition-all duration-300 flex flex-col ${activeFilter === "LOLOS"
                    ? "bg-sky-50/50 border-sky-500 text-slate-800 shadow-md scale-[1.03] ring-2 ring-sky-500"
                    : "bg-white border-[#e9ecef] text-slate-800 hover:scale-[1.01] hover:shadow-xs"
                    }`}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEndMetric}
                >
                  <div
                    className="flex h-full w-[200%] transition-transform duration-500 ease-in-out"
                    style={{
                      transform: `translateX(-${metricMode === "PCS" ? 0 : 50}%)`,
                    }}
                  >
                    <div
                      onClick={() => {
                        setActiveFilter("LOLOS");
                        setMetricMode("PCS");
                      }}
                      className="w-1/2 cursor-pointer p-5 flex flex-col justify-between h-full relative"
                    >
                      <div className="flex justify-between items-start relative z-10">
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                          Cacat Produksi Panel ({gradeLabel})
                        </span>
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${activeFilter === "LOLOS"
                            ? "bg-sky-100 text-[#0070bc]"
                            : "bg-slate-100 text-slate-500"
                            }`}
                        >
                          QC
                        </span>
                      </div>
                      <div className="mt-2 relative z-10">
                        <div className="text-3xl font-black tracking-tight text-slate-800">
                          {stats.persentaseCacatPanel.toFixed(1)}%
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-[#0070bc] font-bold">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>
                            {stats.countMasalahPanel} panel cacat dari{" "}
                            {stats.totalPanelValid} panel
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => {
                        setActiveFilter("LOLOS");
                        setMetricMode("METER");
                      }}
                      className="w-1/2 cursor-pointer p-5 flex flex-col justify-between h-full relative"
                    >
                      <div className="flex justify-between items-start relative z-10">
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                          Cacat Produksi Meteran ({gradeLabel})
                        </span>
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${activeFilter === "LOLOS"
                            ? "bg-sky-100 text-[#0070bc]"
                            : "bg-slate-100 text-slate-500"
                            }`}
                        >
                          QC
                        </span>
                      </div>
                      <div className="mt-2 relative z-10">
                        <div className="text-3xl font-black tracking-tight text-slate-800">
                          {stats.persentaseCacatMeteran.toFixed(1)}%
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-[#0070bc] font-bold">
                          <Layers className="w-3.5 h-3.5" />
                          <span>{stats.countMasalahMeteran} titik</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="absolute bottom-3 right-3 flex items-center gap-1 z-20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setMetricMode("PCS");
                        if (activeFilter === "LOLOS") setActiveFilter("LOLOS");
                      }}
                      className="p-3 -m-3 cursor-pointer"
                      title="Geser ke QC Panel"
                    >
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${metricMode === "PCS" ? (activeFilter === "LOLOS" ? "w-4 bg-sky-500" : "w-4 bg-slate-800") : "w-1.5 bg-slate-300 hover:bg-slate-400"}`}
                      />
                    </button>
                    <button
                      onClick={() => {
                        setMetricMode("METER");
                        if (activeFilter === "LOLOS") setActiveFilter("LOLOS");
                      }}
                      className="p-3 -m-3 cursor-pointer ml-3"
                      title="Geser ke QC Meter"
                    >
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${metricMode === "METER" ? (activeFilter === "LOLOS" ? "w-4 bg-sky-500" : "w-4 bg-slate-800") : "w-1.5 bg-slate-300 hover:bg-slate-400"}`}
                      />
                    </button>
                  </div>
                </div>

                {/* CLASSIC Card 3: Efisiensi Waktu */}
                <div
                  onClick={() => setActiveFilter("EFISIENSI")}
                  className={`relative overflow-hidden rounded-[24px] h-full min-h-[11rem] border border-[#e9ecef] cursor-pointer p-5 flex flex-col justify-between transition-all duration-300 ${activeFilter === "EFISIENSI"
                    ? "bg-emerald-50/40 shadow-[0_8px_30px_rgba(16,185,129,0.12)] text-slate-800"
                    : "bg-white hover:shadow-xs text-slate-800"
                    }`}
                >
                  {activeFilter === "EFISIENSI" && (
                    <div className="absolute inset-0 ring-2 ring-emerald-500 rounded-[24px] pointer-events-none" />
                  )}
                  <div className="flex justify-between items-start relative z-10">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                      Efisiensi Waktu Kerja ({gradeLabel})
                    </span>
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${activeFilter === "EFISIENSI"
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-slate-100 text-slate-500"
                        }`}
                    >
                      %
                    </span>
                  </div>
                  <div className="mt-2 relative z-10">
                    <div className="text-3xl font-black tracking-tight text-slate-800">
                      {stats.efisiensi.toFixed(1)}%
                    </div>
                    <div
                      className={`flex items-center gap-1.5 mt-1 text-[11px] font-extrabold ${stats.totalDowntimeDetik > 0 ? "text-amber-600" : "text-emerald-600"}`}
                    >
                      {stats.totalDowntimeDetik > 0 ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>
                            Downtime: {formatDuration(stats.totalDowntimeDetik)}{" "}
                            / Total:{" "}
                            {formatTotalHours(stats.totalDetikTersedia)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>
                            Downtime: 0s / Total:{" "}
                            {formatTotalHours(stats.totalDetikTersedia)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* CLASSIC Card 4: Masalah */}
                <div
                  onClick={() => {
                    setActiveFilter("PROBLEMS");
                    setMetricMode("PCS");
                  }}
                  className={`relative overflow-hidden rounded-[24px] h-full min-h-[11rem] border border-[#e9ecef] cursor-pointer p-5 flex flex-col justify-between transition-all duration-300 ${activeFilter === "PROBLEMS"
                    ? "bg-red-50/40 shadow-[0_8px_30px_rgba(239,68,68,0.12)] text-slate-800"
                    : "bg-white hover:shadow-xs text-slate-800"
                    }`}
                >
                  {activeFilter === "PROBLEMS" && (
                    <div className="absolute inset-0 ring-2 ring-red-500 rounded-[24px] pointer-events-none" />
                  )}
                  <div className="flex justify-between items-start relative z-10">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                      Masalah ({gradeLabel})
                    </span>
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${activeFilter === "PROBLEMS"
                        ? "bg-red-100 text-red-600 animate-pulse"
                        : "bg-slate-100 text-slate-500"
                        }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="mt-2 relative z-10">
                    <div className="text-3xl font-black tracking-tight text-slate-800">
                      {stats.countMasalah} Masalah
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-red-600 font-extrabold">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span>Butuh Pemeriksaan</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Grid Dashboard Visuals */}
          <div
            data-tour="dashboard-visuals"
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Dynamic Production Trend Chart */}
            <div className="lg:col-span-2 bg-white border border-[#e9ecef] rounded-[32px] p-6 flex flex-col shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    Tren Hasil Produksi & Analisis Kualitas
                  </h3>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    Filter Aktif:{" "}
                    <span className="font-extrabold text-[#0070bc] uppercase">
                      {activeFilter}
                    </span>
                  </p>
                </div>

                {/* Chart Control Toggles */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Chart View Toggles */}
                  <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setChartGroupBy("HARI")}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1 ${chartGroupBy === "HARI"
                        ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                      <BarChart2 className="w-3 h-3" /> Tanggal
                    </button>
                    <button
                      onClick={() => setChartGroupBy("DESIGN")}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1 ${chartGroupBy === "DESIGN"
                        ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                      <Palette className="w-3 h-3" /> Design
                    </button>
                    <button
                      onClick={() => setChartGroupBy("PEGAWAI")}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1 ${chartGroupBy === "PEGAWAI"
                        ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                      <Users className="w-3 h-3" /> Pegawai
                    </button>
                    <button
                      onClick={() => setChartGroupBy("GROUP")}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1 ${chartGroupBy === "GROUP"
                        ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                      <Layers className="w-3 h-3" /> Group
                    </button>
                    <button
                      onClick={() => setChartGroupBy("MESIN")}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1 ${chartGroupBy === "MESIN"
                        ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                      <Cpu className="w-3 h-3" /> Mesin
                    </button>
                  </div>

                  {/* Chart Type Toggles */}
                  <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setChartType("BAR")}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer ${chartType === "BAR"
                        ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                      Bar
                    </button>
                    <button
                      onClick={() => setChartType("LINE")}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer ${chartType === "LINE"
                        ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                      Line
                    </button>
                  </div>

                  {/* Grade Slicer Toggles */}
                  <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setChartGradeFilter("ALL")}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer ${chartGradeFilter === "ALL"
                        ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => setChartGradeFilter("GRADE_A")}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer ${chartGradeFilter === "GRADE_A"
                        ? "bg-sky-600 text-white shadow-xs"
                        : "text-[#0070bc] hover:bg-sky-50"
                        }`}
                    >
                      Grade A
                    </button>
                    <button
                      onClick={() => setChartGradeFilter("GRADE_B")}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer ${chartGradeFilter === "GRADE_B"
                        ? "bg-amber-500 text-white shadow-xs"
                        : "text-amber-700 hover:bg-amber-50"
                        }`}
                    >
                      Grade B
                    </button>
                    <button
                      onClick={() => setChartGradeFilter("BS")}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer ${chartGradeFilter === "BS"
                        ? "bg-rose-500 text-white shadow-xs"
                        : "text-rose-700 hover:bg-rose-50"
                        }`}
                    >
                      BS
                    </button>
                    <button
                      onClick={() => setChartGradeFilter("UNGRADED")}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer ${chartGradeFilter === "UNGRADED"
                        ? "bg-slate-500 text-white shadow-xs"
                        : "text-slate-500 hover:bg-slate-50"
                        }`}
                    >
                      Belum Diinspeksi
                    </button>
                  </div>
                </div>
              </div>
              {/* SVG Custom Dynamic Grouped Bar Chart */}
              <div className="flex-1 relative flex flex-col mt-4">
                {(() => {
                  const svgWidth = Math.max(800, chartData.length * 100);
                  const totalWidth = svgWidth - 60; // 40 left padding, 20 right padding
                  return (
                    <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar pb-4 w-full flex flex-col">
                      <div
                        style={{ minWidth: `${svgWidth}px` }}
                        className="relative mx-auto w-full flex-1 min-h-[250px]"
                      >
                        <svg
                          viewBox={`0 0 ${svgWidth} 250`}
                          className="absolute inset-0 w-full h-full overflow-visible"
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <pattern
                              id="diagonalStripes"
                              width="16"
                              height="16"
                              patternTransform="rotate(45)"
                              patternUnits="userSpaceOnUse"
                            >
                              <rect width="8" height="16" fill="#111111" />
                              <rect
                                x="8"
                                width="8"
                                height="16"
                                fill="#444444"
                              />
                            </pattern>
                          </defs>

                          {/* Horizontal grid lines */}
                          <line
                            x1="40"
                            y1="20"
                            x2={svgWidth - 20}
                            y2="20"
                            stroke="#f1f3f5"
                            strokeWidth="1"
                          />
                          <line
                            x1="40"
                            y1="63.75"
                            x2={svgWidth - 20}
                            y2="63.75"
                            stroke="#f1f3f5"
                            strokeWidth="1"
                          />
                          <line
                            x1="40"
                            y1="107.5"
                            x2={svgWidth - 20}
                            y2="107.5"
                            stroke="#f1f3f5"
                            strokeWidth="1"
                          />
                          <line
                            x1="40"
                            y1="151.25"
                            x2={svgWidth - 20}
                            y2="151.25"
                            stroke="#f1f3f5"
                            strokeWidth="1"
                          />
                          <line
                            x1="40"
                            y1="195"
                            x2={svgWidth - 20}
                            y2="195"
                            stroke="#e9ecef"
                            strokeWidth="1.5"
                          />

                          {/* Y-Axis text labels */}
                          <text
                            x="30"
                            y="24"
                            fill="#a1a1aa"
                            fontSize="9"
                            fontWeight="bold"
                            textAnchor="end"
                          >
                            {Math.round(maxChartValue)}
                          </text>
                          <text
                            x="30"
                            y="67.75"
                            fill="#a1a1aa"
                            fontSize="9"
                            fontWeight="bold"
                            textAnchor="end"
                          >
                            {Math.round(maxChartValue * 0.75)}
                          </text>
                          <text
                            x="30"
                            y="111.5"
                            fill="#a1a1aa"
                            fontSize="9"
                            fontWeight="bold"
                            textAnchor="end"
                          >
                            {Math.round(maxChartValue * 0.5)}
                          </text>
                          <text
                            x="30"
                            y="155.25"
                            fill="#a1a1aa"
                            fontSize="9"
                            fontWeight="bold"
                            textAnchor="end"
                          >
                            {Math.round(maxChartValue * 0.25)}
                          </text>

                          {/* Polylines for LINE chart */}
                          {chartType === "LINE" && (
                            <>
                              {chartGradeFilter === "ALL" && (
                                <polyline
                                  points={chartData
                                    .map((d, index) => {
                                      const spacing =
                                        totalWidth /
                                        Math.max(chartData.length, 1);
                                      const cx =
                                        40 + spacing * index + spacing / 2;
                                      const h =
                                        maxChartValue > 0
                                          ? (d.total / maxChartValue) * 175
                                          : 0;
                                      return `${cx},${195 - Math.max(h, 1.5)}`;
                                    })
                                    .join(" ")}
                                  fill="none"
                                  stroke="#334155"
                                  strokeWidth="3.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              )}
                              {chartGradeFilter === "GRADE_A" && (
                                <polyline
                                  points={chartData
                                    .map((d, index) => {
                                      const spacing =
                                        totalWidth /
                                        Math.max(chartData.length, 1);
                                      const cx =
                                        40 + spacing * index + spacing / 2;
                                      const h =
                                        maxChartValue > 0
                                          ? (d.gradeA_sum / maxChartValue) * 175
                                          : 0;
                                      return `${cx},${195 - Math.max(h, 1.5)}`;
                                    })
                                    .join(" ")}
                                  fill="none"
                                  stroke="#0070bc"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              )}
                              {chartGradeFilter === "GRADE_B" && (
                                <polyline
                                  points={chartData
                                    .map((d, index) => {
                                      const spacing =
                                        totalWidth /
                                        Math.max(chartData.length, 1);
                                      const cx =
                                        40 + spacing * index + spacing / 2;
                                      const h =
                                        maxChartValue > 0
                                          ? (d.gradeB_sum / maxChartValue) * 175
                                          : 0;
                                      return `${cx},${195 - Math.max(h, 1.5)}`;
                                    })
                                    .join(" ")}
                                  fill="none"
                                  stroke="#f59e0b"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              )}
                              {chartGradeFilter === "BS" && (
                                <polyline
                                  points={chartData
                                    .map((d, index) => {
                                      const spacing =
                                        totalWidth /
                                        Math.max(chartData.length, 1);
                                      const cx =
                                        40 + spacing * index + spacing / 2;
                                      const h =
                                        maxChartValue > 0
                                          ? (d.bs_sum / maxChartValue) * 175
                                          : 0;
                                      return `${cx},${195 - Math.max(h, 1.5)}`;
                                    })
                                    .join(" ")}
                                  fill="none"
                                  stroke="#ef4444"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              )}
                              {chartGradeFilter === "ALL" && (
                                <polyline
                                  points={chartData
                                    .map((d, index) => {
                                      const spacing =
                                        totalWidth /
                                        Math.max(chartData.length, 1);
                                      const cx =
                                        40 + spacing * index + spacing / 2;
                                      const h =
                                        maxChartValue > 0
                                          ? (d.ungraded_sum / maxChartValue) *
                                          175
                                          : 0;
                                      return `${cx},${195 - Math.max(h, 1.5)}`;
                                    })
                                    .join(" ")}
                                  fill="none"
                                  stroke="#94a3b8"
                                  strokeWidth="2"
                                  strokeDasharray="4 4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              )}
                              {chartGradeFilter === "UNGRADED" && (
                                <polyline
                                  points={chartData
                                    .map((d, index) => {
                                      const spacing =
                                        totalWidth /
                                        Math.max(chartData.length, 1);
                                      const cx =
                                        40 + spacing * index + spacing / 2;
                                      const h =
                                        maxChartValue > 0
                                          ? (d.ungraded_sum / maxChartValue) *
                                          175
                                          : 0;
                                      return `${cx},${195 - Math.max(h, 1.5)}`;
                                    })
                                    .join(" ")}
                                  fill="none"
                                  stroke="#94a3b8"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              )}
                            </>
                          )}

                          {/* Bars (Dynamic Groups) */}
                          {chartData.map((d, index) => {
                            const totalBars = chartData.length;
                            // Calculate spacing based on number of bars to keep them aligned
                            const spacing = totalWidth / Math.max(totalBars, 1);
                            // Center align items horizontally
                            const groupCenter =
                              40 + spacing * index + spacing / 2;

                            // Active state for mobile tap
                            const isActive = activeChartBar === index;

                            // Grouped Rendering Logic
                            if (chartGradeFilter === "ALL") {
                              if (activeFilter === "PROBLEMS") {
                                const hTotal =
                                  maxChartValue > 0
                                    ? (d.total / maxChartValue) * 175
                                    : 0;
                                const displayHTotal = Math.max(hTotal, 1.5);
                                const yTotal = 195 - displayHTotal;
                                const barW = 24;
                                const xTotal = groupCenter - 12;

                                return (
                                  <g
                                    key={d.label}
                                    className="group/bar cursor-pointer"
                                    onClick={() =>
                                      setActiveChartBar(isActive ? null : index)
                                    }
                                  >
                                    {/* X-Axis Tick */}
                                    {index > 0 && (
                                      <line
                                        x1={40 + spacing * index}
                                        y1={195}
                                        x2={40 + spacing * index}
                                        y2={205}
                                        stroke="#cbd5e1"
                                        strokeWidth="2"
                                      />
                                    )}

                                    {/* Hover tool */}
                                    <rect
                                      x={40 + spacing * index}
                                      y={20}
                                      width={spacing}
                                      height={175}
                                      fill="transparent"
                                      className="cursor-pointer"
                                    />

                                    {chartType === "BAR" && (
                                      <rect
                                        x={xTotal}
                                        y={yTotal}
                                        width={barW}
                                        height={displayHTotal}
                                        rx="4"
                                        fill="#ef4444"
                                        className="transition-all duration-500 ease-out hover:opacity-85 cursor-pointer"
                                      />
                                    )}

                                    {chartType === "BAR" && (
                                      <text
                                        x={xTotal + barW / 2}
                                        y={yTotal - 4}
                                        fill="#475569"
                                        fontSize="9"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                        className={`transition-opacity duration-200 ${isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"}`}
                                      >
                                        {d.total}
                                      </text>
                                    )}

                                    {/* Unified Tooltip for LINE chart */}
                                    {chartType === "LINE" && (
                                      <g
                                        className={`transition-opacity duration-200 pointer-events-none ${isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"}`}
                                      >
                                        {/* Crosshair Line */}
                                        <line
                                          x1={groupCenter}
                                          y1={20}
                                          x2={groupCenter}
                                          y2={195}
                                          stroke="#94a3b8"
                                          strokeDasharray="3 3"
                                          strokeWidth="1"
                                        />

                                        <rect
                                          x={
                                            index === 0
                                              ? groupCenter + 5
                                              : index === chartData.length - 1
                                                ? groupCenter - 55
                                                : groupCenter - 25
                                          }
                                          y={20}
                                          width={50}
                                          height={25}
                                          rx="6"
                                          fill="#ffffff"
                                          stroke="#e2e8f0"
                                          strokeWidth="1"
                                          className="shadow-sm"
                                        />
                                        <text
                                          x={
                                            index === 0
                                              ? groupCenter + 30
                                              : index === chartData.length - 1
                                                ? groupCenter - 30
                                                : groupCenter
                                          }
                                          y={35}
                                          fill="#1e293b"
                                          fontSize="9"
                                          fontWeight="extrabold"
                                          textAnchor="middle"
                                        >{`Total: ${d.total}`}</text>
                                      </g>
                                    )}

                                    {/* X-Axis Label */}
                                    <text
                                      x={groupCenter}
                                      y={220}
                                      fill="#94a3b8"
                                      fontSize="10"
                                      fontWeight="extrabold"
                                      textAnchor="middle"
                                    >
                                      {d.label.length > 12
                                        ? d.label.substring(0, 10) + "..."
                                        : d.label}
                                    </text>
                                  </g>
                                );
                              }

                              const hA =
                                maxChartValue > 0
                                  ? (d.gradeA_sum / maxChartValue) * 175
                                  : 0;
                              const hB =
                                maxChartValue > 0
                                  ? (d.gradeB_sum / maxChartValue) * 175
                                  : 0;
                              const hBS =
                                maxChartValue > 0
                                  ? (d.bs_sum / maxChartValue) * 175
                                  : 0;
                              const hUN =
                                maxChartValue > 0
                                  ? (d.ungraded_sum / maxChartValue) * 175
                                  : 0;

                              const displayHA = Math.max(hA, 1.5);
                              const displayHB = Math.max(hB, 1.5);
                              const displayHBS = Math.max(hBS, 1.5);
                              const displayHUN = Math.max(hUN, 1.5);

                              const yA = 195 - displayHA;
                              const yB = 195 - displayHB;
                              const yBS = 195 - displayHBS;
                              const yUN = 195 - displayHUN;

                              const barW = 10;
                              const xA = groupCenter - 24;
                              const xB = groupCenter - 12;
                              const xBS = groupCenter;
                              const xUN = groupCenter + 12;

                              return (
                                <g
                                  key={d.label}
                                  className="group/bar cursor-pointer"
                                  onClick={() =>
                                    setActiveChartBar(isActive ? null : index)
                                  }
                                >
                                  {/* X-Axis Tick Mark for Grouping Clarity */}
                                  {index > 0 && (
                                    <line
                                      x1={40 + spacing * index}
                                      y1={195}
                                      x2={40 + spacing * index}
                                      y2={205}
                                      stroke="#cbd5e1"
                                      strokeWidth="2"
                                    />
                                  )}

                                  {/* Hover Tooltip Zone */}
                                  <rect
                                    x={40 + spacing * index}
                                    y={20}
                                    width={spacing}
                                    height={175}
                                    fill="transparent"
                                    className="cursor-pointer"
                                  />

                                  {chartType === "BAR" && (
                                    <>
                                      {/* Grade A Section */}
                                      <rect
                                        x={xA}
                                        y={yA}
                                        width={barW}
                                        height={displayHA}
                                        rx="3"
                                        fill="#0070bc"
                                        className="transition-all duration-500 ease-out hover:opacity-85 cursor-pointer"
                                      />
                                      {/* Grade B Section */}
                                      <rect
                                        x={xB}
                                        y={yB}
                                        width={barW}
                                        height={displayHB}
                                        rx="3"
                                        fill="#f59e0b"
                                        className="transition-all duration-500 ease-out hover:opacity-85 cursor-pointer"
                                      />
                                      {/* BS Section */}
                                      <rect
                                        x={xBS}
                                        y={yBS}
                                        width={barW}
                                        height={displayHBS}
                                        rx="3"
                                        fill="#ef4444"
                                        className="transition-all duration-500 ease-out hover:opacity-85 cursor-pointer"
                                      />
                                      {/* Ungraded Section */}
                                      <rect
                                        x={xUN}
                                        y={yUN}
                                        width={barW}
                                        height={displayHUN}
                                        rx="3"
                                        fill="#94a3b8"
                                        className="transition-all duration-500 ease-out hover:opacity-85 cursor-pointer"
                                      />
                                    </>
                                  )}

                                  {/* Labels on top of bars */}
                                  {chartType === "BAR" && (
                                    <>
                                      <text
                                        x={xA + barW / 2}
                                        y={yA - 4}
                                        fill="#475569"
                                        fontSize="8"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                        className={`transition-opacity duration-200 ${isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"}`}
                                      >
                                        {d.gradeA_sum}
                                      </text>
                                      <text
                                        x={xB + barW / 2}
                                        y={yB - 4}
                                        fill="#475569"
                                        fontSize="8"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                        className={`transition-opacity duration-200 ${isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"}`}
                                      >
                                        {d.gradeB_sum}
                                      </text>
                                      <text
                                        x={xBS + barW / 2}
                                        y={yBS - 4}
                                        fill="#475569"
                                        fontSize="8"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                        className={`transition-opacity duration-200 ${isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"}`}
                                      >
                                        {d.bs_sum}
                                      </text>
                                      <text
                                        x={xUN + barW / 2}
                                        y={yUN - 4}
                                        fill="#64748b"
                                        fontSize="8"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                        className={`transition-opacity duration-200 ${isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"}`}
                                      >
                                        {d.ungraded_sum}
                                      </text>

                                      {/* Total summary below tooltip */}
                                      <text
                                        x={groupCenter}
                                        y={12}
                                        fill="#1e293b"
                                        fontSize="9"
                                        fontWeight="extrabold"
                                        textAnchor="middle"
                                        className={`transition-opacity duration-200 ${isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"}`}
                                      >
                                        {d.total > 0 ? `Total: ${d.total}` : ""}
                                      </text>
                                    </>
                                  )}

                                  {/* Unified Tooltip for LINE chart */}
                                  {chartType === "LINE" && (
                                    <g
                                      className={`transition-opacity duration-200 pointer-events-none ${isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"}`}
                                    >
                                      {/* Crosshair Line */}
                                      <line
                                        x1={groupCenter}
                                        y1={20}
                                        x2={groupCenter}
                                        y2={195}
                                        stroke="#94a3b8"
                                        strokeDasharray="3 3"
                                        strokeWidth="1"
                                      />

                                      {/* Tooltip Box */}
                                      <rect
                                        x={
                                          index === 0
                                            ? groupCenter + 5
                                            : index === chartData.length - 1
                                              ? groupCenter - 95
                                              : groupCenter - 45
                                        }
                                        y={5}
                                        width={90}
                                        height={68}
                                        rx="6"
                                        fill="#ffffff"
                                        stroke="#e2e8f0"
                                        strokeWidth="1"
                                        className="shadow-sm"
                                      />

                                      {/* Tooltip Text Data */}
                                      <text
                                        x={
                                          index === 0
                                            ? groupCenter + 50
                                            : index === chartData.length - 1
                                              ? groupCenter - 50
                                              : groupCenter
                                        }
                                        y={17}
                                        fill="#0070bc"
                                        fontSize="9"
                                        fontWeight="extrabold"
                                        textAnchor="middle"
                                      >
                                        Grade A:{" "}
                                        <tspan fill="#334155">
                                          {d.gradeA_sum}
                                        </tspan>
                                      </text>
                                      <text
                                        x={
                                          index === 0
                                            ? groupCenter + 50
                                            : index === chartData.length - 1
                                              ? groupCenter - 50
                                              : groupCenter
                                        }
                                        y={29}
                                        fill="#f59e0b"
                                        fontSize="9"
                                        fontWeight="extrabold"
                                        textAnchor="middle"
                                      >
                                        Grade B:{" "}
                                        <tspan fill="#334155">
                                          {d.gradeB_sum}
                                        </tspan>
                                      </text>
                                      <text
                                        x={
                                          index === 0
                                            ? groupCenter + 50
                                            : index === chartData.length - 1
                                              ? groupCenter - 50
                                              : groupCenter
                                        }
                                        y={41}
                                        fill="#ef4444"
                                        fontSize="9"
                                        fontWeight="extrabold"
                                        textAnchor="middle"
                                      >
                                        BS:{" "}
                                        <tspan fill="#334155">{d.bs_sum}</tspan>
                                      </text>
                                      <text
                                        x={
                                          index === 0
                                            ? groupCenter + 50
                                            : index === chartData.length - 1
                                              ? groupCenter - 50
                                              : groupCenter
                                        }
                                        y={53}
                                        fill="#64748b"
                                        fontSize="9"
                                        fontWeight="extrabold"
                                        textAnchor="middle"
                                      >
                                        Ungraded:{" "}
                                        <tspan fill="#334155">
                                          {d.ungraded_sum}
                                        </tspan>
                                      </text>
                                      <text
                                        x={
                                          index === 0
                                            ? groupCenter + 50
                                            : index === chartData.length - 1
                                              ? groupCenter - 50
                                              : groupCenter
                                        }
                                        y={65}
                                        fill="#1e293b"
                                        fontSize="9"
                                        fontWeight="extrabold"
                                        textAnchor="middle"
                                      >
                                        {d.total > 0 ? `Total: ${d.total}` : ""}
                                      </text>
                                    </g>
                                  )}

                                  {/* X-Axis Label */}
                                  <text
                                    x={groupCenter}
                                    y={220}
                                    fill="#94a3b8"
                                    fontSize="10"
                                    fontWeight="extrabold"
                                    textAnchor="middle"
                                  >
                                    {d.label.length > 12
                                      ? d.label.substring(0, 10) + "..."
                                      : d.label}
                                  </text>
                                </g>
                              );
                            } else {
                              // Single Grade Filter Mode
                              let value = d.total;
                              let barFill = "#111111";

                              if (chartGradeFilter === "GRADE_A") {
                                value = d.gradeA_sum;
                                barFill = "#0070bc";
                              } else if (chartGradeFilter === "GRADE_B") {
                                value = d.gradeB_sum;
                                barFill = "#f59e0b";
                              } else if (chartGradeFilter === "BS") {
                                value = d.bs_sum;
                                barFill = "#ef4444";
                              } else if (chartGradeFilter === "UNGRADED") {
                                value = d.ungraded_sum;
                                barFill = "#94a3b8";
                              }

                              const hVal =
                                maxChartValue > 0
                                  ? (value / maxChartValue) * 175
                                  : 0;
                              const displayHVal = Math.max(hVal, 1.5);
                              const yVal = 195 - displayHVal;
                              const barW = 28;
                              const xVal = groupCenter - barW / 2;

                              return (
                                <g
                                  key={d.label}
                                  className="group/bar cursor-pointer"
                                  onClick={() =>
                                    setActiveChartBar(isActive ? null : index)
                                  }
                                >
                                  {/* X-Axis Tick Mark for Grouping Clarity */}
                                  {index > 0 && (
                                    <line
                                      x1={40 + spacing * index}
                                      y1={195}
                                      x2={40 + spacing * index}
                                      y2={205}
                                      stroke="#cbd5e1"
                                      strokeWidth="2"
                                    />
                                  )}

                                  {/* Hover Tooltip Zone */}
                                  <rect
                                    x={40 + spacing * index}
                                    y={20}
                                    width={spacing}
                                    height={175}
                                    fill="transparent"
                                    className="cursor-pointer"
                                  />

                                  {chartType === "BAR" && (
                                    <rect
                                      x={xVal}
                                      y={yVal}
                                      width={barW}
                                      height={displayHVal}
                                      rx="6"
                                      fill={barFill}
                                      className="transition-all duration-500 ease-out cursor-pointer hover:opacity-85"
                                    />
                                  )}

                                  {/* Permanent Value Label on Top (BAR only) */}
                                  {chartType === "BAR" && (
                                    <text
                                      x={groupCenter}
                                      y={yVal - 6}
                                      fill="#475569"
                                      fontSize="9"
                                      fontWeight="extrabold"
                                      textAnchor="middle"
                                    >
                                      {value}
                                    </text>
                                  )}

                                  {/* Unified Tooltip for LINE chart (Single Mode) */}
                                  {chartType === "LINE" && (
                                    <g
                                      className={`transition-opacity duration-200 pointer-events-none ${isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"}`}
                                    >
                                      <line
                                        x1={groupCenter}
                                        y1={20}
                                        x2={groupCenter}
                                        y2={195}
                                        stroke="#94a3b8"
                                        strokeDasharray="3 3"
                                        strokeWidth="1"
                                      />
                                      <rect
                                        x={
                                          index === 0
                                            ? groupCenter + 5
                                            : index === chartData.length - 1
                                              ? groupCenter - 45
                                              : groupCenter - 20
                                        }
                                        y={yVal > 40 ? yVal - 30 : yVal + 10}
                                        width={40}
                                        height={20}
                                        rx="4"
                                        fill="#ffffff"
                                        stroke="#e2e8f0"
                                        strokeWidth="1"
                                        className="shadow-sm"
                                      />
                                      <text
                                        x={
                                          index === 0
                                            ? groupCenter + 25
                                            : index === chartData.length - 1
                                              ? groupCenter - 25
                                              : groupCenter
                                        }
                                        y={yVal > 40 ? yVal - 16 : yVal + 24}
                                        fill={barFill}
                                        fontSize="10"
                                        fontWeight="extrabold"
                                        textAnchor="middle"
                                      >
                                        {value}
                                      </text>
                                    </g>
                                  )}

                                  {/* X-Axis Label */}
                                  <text
                                    x={groupCenter}
                                    y="215"
                                    fill="#94a3b8"
                                    fontSize="9"
                                    fontWeight="extrabold"
                                    textAnchor="middle"
                                  >
                                    {d.label.length > 12
                                      ? d.label.substring(0, 10) + "..."
                                      : d.label}
                                  </text>
                                </g>
                              );
                            }
                          })}
                        </svg>
                      </div>
                    </div>
                  );
                })()}

                {/* Legend Indicators */}
                <div className="flex flex-wrap items-center justify-center gap-4 pt-3.5 mt-3 border-t border-slate-100/60">
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-600 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-[#0070bc]" />
                    <span>Grade A (Lolos)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-600 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                    <span>Grade B (Lolos)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-600 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                    <span>BS (Recheck)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-600 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-[#94a3b8]" />
                    <span>Belum Diinspeksi</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality Breakdown Donut Chart */}
            {(() => {
              let totalA = 0;
              let totalB = 0;
              let totalBS = 0;
              let totalUngraded = 0;

              if (metricMode === "PCS") {
                totalA = new Set(
                  filteredData
                    .filter((i) => i.grade === "GRADE A")
                    .map((i) => i.header_id),
                ).size;
                totalB = new Set(
                  filteredData
                    .filter((i) => i.grade === "GRADE B")
                    .map((i) => i.header_id),
                ).size;
                totalBS = new Set(
                  filteredData
                    .filter((i) => i.grade === "BS")
                    .map((i) => i.header_id),
                ).size;
                totalUngraded = new Set(
                  filteredData
                    .filter(
                      (i) =>
                        i.grade === "UNGRADED" ||
                        !["GRADE A", "GRADE B", "BS"].includes(i.grade),
                    )
                    .map((i) => i.header_id),
                ).size;
              } else {
                const uniqueHeadersMap = new Map<
                  string,
                  (typeof filteredData)[0]
                >();
                filteredData.forEach((item) => {
                  if (item.header_id && !uniqueHeadersMap.has(item.header_id)) {
                    uniqueHeadersMap.set(item.header_id, item);
                  }
                });
                const uniqueItems = Array.from(uniqueHeadersMap.values());
                totalA = uniqueItems
                  .filter((i) => i.grade === "GRADE A")
                  .reduce(
                    (acc, curr) =>
                      acc + (parseFloat(curr.hasil_meter as any) || 0),
                    0,
                  );
                totalB = uniqueItems
                  .filter((i) => i.grade === "GRADE B")
                  .reduce(
                    (acc, curr) =>
                      acc + (parseFloat(curr.hasil_meter as any) || 0),
                    0,
                  );
                totalBS = uniqueItems
                  .filter((i) => i.grade === "BS")
                  .reduce(
                    (acc, curr) =>
                      acc + (parseFloat(curr.hasil_meter as any) || 0),
                    0,
                  );
                totalUngraded = uniqueItems
                  .filter(
                    (i) =>
                      i.grade === "UNGRADED" ||
                      !["GRADE A", "GRADE B", "BS"].includes(i.grade),
                  )
                  .reduce(
                    (acc, curr) =>
                      acc + (parseFloat(curr.hasil_meter as any) || 0),
                    0,
                  );
              }

              const totalQuality = totalA + totalB + totalBS + totalUngraded;

              const pctA = totalQuality > 0 ? (totalA / totalQuality) * 100 : 0;
              const pctB = totalQuality > 0 ? (totalB / totalQuality) * 100 : 0;
              const pctBS =
                totalQuality > 0 ? (totalBS / totalQuality) * 100 : 0;
              const pctUngraded =
                totalQuality > 0 ? (totalUngraded / totalQuality) * 100 : 0;

              return (
                <div className="space-y-6 flex flex-col flex-1">
                  <div className="bg-white border border-[#e9ecef] rounded-[32px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col justify-between flex-1">
                    <div>
                      <div className="border-b border-slate-100 pb-4 mb-6 flex justify-between items-start">
                        <div>
                          <h3 className="text-base font-extrabold text-slate-800">
                            Ringkasan Kualitas
                          </h3>
                          <p className="text-[11px] text-slate-400 font-semibold">
                            Persentase barang berdasarkan Grade
                          </p>
                        </div>
                        <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-sky-50 text-sky-600 flex items-center gap-1 shrink-0">
                          {totalQuality} {metricMode === "PCS" ? "Panel" : "Meter"}
                        </span>
                      </div>

                      {/* Donut Chart Visual */}
                      <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
                        <svg
                          viewBox="0 0 100 100"
                          className="w-full h-full transform -rotate-90"
                        >
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="transparent"
                            stroke="#f1f5f9"
                            strokeWidth="12"
                          />
                          {pctA > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              stroke="#0070bc"
                              strokeWidth="12"
                              strokeDasharray={`${(pctA / 100) * 251.2} 251.2`}
                              strokeDashoffset="0"
                              className="transition-all duration-1000 ease-out"
                            />
                          )}
                          {pctB > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              stroke="#f59e0b"
                              strokeWidth="12"
                              strokeDasharray={`${(pctB / 100) * 251.2} 251.2`}
                              strokeDashoffset={`-${(pctA / 100) * 251.2}`}
                              className="transition-all duration-1000 ease-out"
                            />
                          )}
                          {pctBS > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              stroke="#ef4444"
                              strokeWidth="12"
                              strokeDasharray={`${(pctBS / 100) * 251.2} 251.2`}
                              strokeDashoffset={`-${((pctA + pctB) / 100) * 251.2}`}
                              className="transition-all duration-1000 ease-out"
                            />
                          )}
                          {pctUngraded > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              stroke="#94a3b8"
                              strokeWidth="12"
                              strokeDasharray={`${(pctUngraded / 100) * 251.2} 251.2`}
                              strokeDashoffset={`-${((pctA + pctB + pctBS) / 100) * 251.2}`}
                              className="transition-all duration-1000 ease-out"
                            />
                          )}
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-3xl font-black text-slate-800 tracking-tight">
                            {Math.round(pctA)}%
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            GRADE A
                          </span>
                        </div>
                      </div>

                      {/* Breakdown List */}
                      <div className="mt-8 space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full bg-[#0070bc]" />
                            <span className="text-xs font-extrabold text-slate-700">
                              Grade A (Lolos)
                            </span>
                          </div>
                          <div className="text-right flex items-baseline gap-1.5">
                            <span className="text-sm font-black text-slate-800">
                              {totalA}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {metricMode === "PCS" ? "Panel" : "Meter"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                            <span className="text-xs font-extrabold text-slate-700">
                              Grade B (Lolos)
                            </span>
                          </div>
                          <div className="text-right flex items-baseline gap-1.5">
                            <span className="text-sm font-black text-slate-800">
                              {totalB}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {metricMode === "PCS" ? "Panel" : "Meter"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
                            <span className="text-xs font-extrabold text-slate-700">
                              BS (Recheck)
                            </span>
                          </div>
                          <div className="text-right flex items-baseline gap-1.5">
                            <span className="text-sm font-black text-slate-800">
                              {totalBS}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {metricMode === "PCS" ? "Panel" : "Meter"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full bg-[#94a3b8]" />
                            <span className="text-xs font-extrabold text-slate-700">
                              Belum Diinspeksi (Ungraded)
                            </span>
                          </div>
                          <div className="text-right flex items-baseline gap-1.5">
                            <span className="text-sm font-black text-slate-800">
                              {totalUngraded}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {metricMode === "PCS" ? "Panel" : "Meter"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 mt-6 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                        Ringkasan Kualifikasi
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Leaderboard Section (Top/Bottom Performers) */}
          <div
            data-tour="dashboard-leaderboard"
            className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6"
          >
            {/* Card 1: Top Operators */}
            <div className="bg-white border border-[#e9ecef] rounded-[32px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col justify-between transition-all duration-300 hover:shadow-md">
              <div>
                <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
                      <Users className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-800">
                      Operator Terbaik (Top 5)
                    </h3>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 uppercase">
                    {metricMode === "METER" ? "Hasil Meter" : "Hasil Panel"}
                  </span>
                </div>
                <div className="space-y-2">
                  {leaderboard.topOperators.length > 0 ? (
                    leaderboard.topOperators.map((op, idx) => (
                      <div
                        key={op.name}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${idx === 0
                              ? "bg-amber-100 text-amber-700"
                              : idx === 1
                                ? "bg-slate-200 text-slate-700"
                                : idx === 2
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">
                              {op.name}
                            </span>
                            <span className="text-[9px] font-medium text-slate-400">
                              {op.group}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-black text-slate-800">
                          {metricMode === "METER"
                            ? `${op.meter.toLocaleString()} meter`
                            : `${op.pcs.toLocaleString()} panel`}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-400 font-bold">
                      Tidak ada data
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Top Machines */}
            <div className="bg-white border border-[#e9ecef] rounded-[32px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col justify-between transition-all duration-300 hover:shadow-md">
              <div>
                <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-sky-50 rounded-lg text-sky-600">
                      <SlidersHorizontal className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-800">
                      Mesin Terproduktif (Top 5)
                    </h3>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 uppercase">
                    {metricMode === "METER" ? "Hasil Meter" : "Hasil Panel"}
                  </span>
                </div>
                <div className="space-y-2">
                  {leaderboard.topMachines.length > 0 ? (
                    leaderboard.topMachines.map((m, idx) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${idx === 0
                              ? "bg-sky-100 text-sky-700"
                              : "bg-slate-100 text-slate-500"
                              }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            {m.id}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-slate-800">
                            {metricMode === "METER"
                              ? `${m.meter.toLocaleString()} meter`
                              : `${m.pcs.toLocaleString()} panel`}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-400 font-bold">
                      Tidak ada data
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Card 3: Critical Machines */}
            <div className="bg-white border border-[#e9ecef] rounded-[32px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col justify-between transition-all duration-300 hover:shadow-md relative overflow-hidden">
              {leaderboard.criticalMachines.length > 0 && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />
              )}
              <div>
                <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-red-50 rounded-lg text-red-500">
                      <AlertTriangle className="w-4 h-4 animate-pulse" />
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-800">
                      Perlu Inspeksi (Bottom 5)
                    </h3>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-700 uppercase">
                    Cacat / Downtime
                  </span>
                </div>
                <div className="space-y-2">
                  {leaderboard.criticalMachines.length > 0 ? (
                    leaderboard.criticalMachines.map((m, idx) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-red-55/20 border border-transparent hover:border-red-100/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black bg-red-100 text-red-700 animate-pulse">
                            ⚠️
                          </span>
                          <span className="text-xs font-bold text-red-700">
                            {m.id}
                          </span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="text-xs font-black text-rose-600">
                            {m.defects} cacat
                          </span>
                          {m.downtime > 0 && (
                            <span className="text-[10px] font-bold text-amber-600 mt-0.5">
                              ⏳ {formatDuration(m.downtime)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-emerald-600 font-extrabold flex flex-col items-center gap-1">
                      <span>✅ Semua Mesin Optimal</span>
                      <span className="text-[9px] text-slate-400 font-medium">
                        0 record cacat/downtime
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Full-Width Dedicated Pareto Analysis Section at Bottom */}
          {(() => {
            const vitalFewItems = paretoProblemData.list.filter((item) => item.isVital80);
            const list = paretoProblemData.list;

            return (
              <div className="bg-white border border-[#e9ecef] rounded-[32px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] mt-6">
                {/* Header */}
                <div className="border-b border-slate-100 pb-4 mb-5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100/60 shadow-xs">
                      <BarChart2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-extrabold text-slate-800">
                          Analisis Pareto (Aturan 80/20)
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 uppercase tracking-wide">
                          Prinsip 80/20
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">
                        Identifikasi 20% faktor utama ({paretoGroupBy === "KATEGORI" ? "Kategori Masalah" : "Mesin Produksi"}) yang menyumbang 80% total masalah & downtime
                      </p>
                    </div>
                  </div>

                  {/* Filter Controls Group */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Group By Selector */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                      <button
                        onClick={() => setParetoGroupBy("KATEGORI")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${paretoGroupBy === "KATEGORI"
                          ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                          : "text-slate-500 hover:text-slate-800"
                          }`}
                      >
                        Detail Masalah
                      </button>
                      <button
                        onClick={() => setParetoGroupBy("MESIN")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${paretoGroupBy === "MESIN"
                          ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                          : "text-slate-500 hover:text-slate-800"
                          }`}
                      >
                        Per Mesin Produksi
                      </button>
                    </div>

                    {/* Machine Filter Dropdown */}
                    {availableParetoMachines.length > 0 && (
                      <select
                        value={selectedParetoMachine}
                        onChange={(e) => setSelectedParetoMachine(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-extrabold py-1.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                      >
                        <option value="ALL">Semua Mesin</option>
                        {availableParetoMachines.map((m) => (
                          <option key={m} value={m}>
                            {m.startsWith("Mesin") ? m : `Mesin ${m}`}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Metric Mode Selector */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                      <button
                        onClick={() => setParetoMode("COUNT")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${paretoMode === "COUNT"
                          ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                          : "text-slate-500 hover:text-slate-800"
                          }`}
                      >
                        Frekuensi Masalah
                      </button>
                      <button
                        onClick={() => setParetoMode("DURATION")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${paretoMode === "DURATION"
                          ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                          : "text-slate-500 hover:text-slate-800"
                          }`}
                      >
                        Durasi Downtime
                      </button>
                    </div>
                  </div>
                </div>

                {/* Vital Few Banner */}
                {vitalFewItems.length > 0 && (
                  <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 border border-amber-200/80 flex items-start gap-3 text-xs shadow-xs">
                    <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 font-black text-xs shadow-sm">
                      80%
                    </div>
                    <div className="flex-1">
                      <span className="font-extrabold text-amber-950 text-sm block mb-1">
                        Vital Few (Penyebab Dominan Utama):
                      </span>
                      <p className="text-amber-900/90 text-xs leading-relaxed">
                        {paretoGroupBy === "KATEGORI" ? "Kategori " : "Mesin "}
                        <span className="font-black text-amber-950 underline decoration-amber-400 decoration-2">
                          {vitalFewItems.map((i) => i.friendlyName).join(", ")}
                        </span>{" "}
                        bertanggung jawab atas <strong className="font-black">80% dari total masalah/downtime</strong>. Fokus perbaikan pada {paretoGroupBy === "KATEGORI" ? "kategori" : "mesin"} ini akan memberikan hasil perbaikan terbesar!
                      </p>
                    </div>
                  </div>
                )}

                {/* Main Full-Width SVG Pareto Chart */}
                <div className="relative w-full h-72 mx-auto flex items-center justify-center my-4 overflow-x-auto custom-scrollbar">
                  {list.length > 0 ? (
                    (() => {
                      const displayList = showAllParetoCards ? list : list.slice(0, 12);
                      const maxValue = Math.max(...displayList.map((item) => item.value), 1);
                      const svgWidth = Math.max(750, displayList.length * 80);
                      const svgHeight = 240;
                      const paddingLeft = 50;
                      const paddingRight = 50;
                      const paddingTop = 30;
                      const paddingBottom = 40;

                      const chartWidth = svgWidth - paddingLeft - paddingRight;
                      const chartHeight = svgHeight - paddingTop - paddingBottom;
                      const barSpacing = chartWidth / displayList.length;
                      const barWidth = Math.max(16, Math.min(48, barSpacing * 0.5));

                      const y80 = paddingTop + chartHeight - 0.8 * chartHeight;

                      const pointsStr = displayList
                        .map((item, idx) => {
                          const x = paddingLeft + barSpacing * idx + barSpacing / 2;
                          const y = paddingTop + chartHeight - (item.cumulativePct / 100) * chartHeight;
                          return `${x},${y}`;
                        })
                        .join(" ");

                      // Generate accurate Left Y Axis Ticks & Grid Lines
                      const yTicks: { val: number; label: string; y: number }[] = [];
                      if (paretoMode === "COUNT") {
                        const steps = maxValue <= 5 ? maxValue : 4;
                        for (let i = 0; i <= steps; i++) {
                          const val = Math.round((maxValue / steps) * i);
                          const y = paddingTop + chartHeight - (val / maxValue) * chartHeight;
                          if (!yTicks.some((t) => t.val === val)) {
                            yTicks.push({ val, label: val.toString(), y });
                          }
                        }
                      } else {
                        const maxMin = Math.ceil(maxValue / 60) || 1;
                        const steps = maxMin <= 5 ? maxMin : 4;
                        for (let i = 0; i <= steps; i++) {
                          const minVal = Math.round((maxMin / steps) * i);
                          const y = paddingTop + chartHeight - (minVal / maxMin) * chartHeight;
                          if (!yTicks.some((t) => t.val === minVal)) {
                            yTicks.push({ val: minVal, label: `${minVal}m`, y });
                          }
                        }
                      }

                      return (
                        <div style={{ minWidth: `${svgWidth}px` }} className="w-full h-full">
                          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full">
                            {/* Left Y Axis Grid Lines & Labels */}
                            {yTicks.map((tick) => (
                              <g key={`ytick-${tick.val}`}>
                                <line
                                  x1={paddingLeft}
                                  y1={tick.y}
                                  x2={svgWidth - paddingRight}
                                  y2={tick.y}
                                  stroke={tick.val === 0 ? "#cbd5e1" : "#f1f5f9"}
                                  strokeWidth={tick.val === 0 ? "1.5" : "1"}
                                />
                                <text
                                  x={paddingLeft - 8}
                                  y={tick.y + 3}
                                  textAnchor="end"
                                  fontSize="9"
                                  fontWeight="bold"
                                  fill="#64748b"
                                >
                                  {tick.label}
                                </text>
                              </g>
                            ))}

                            {/* 80% Cutoff Line for Cumulative % */}
                            <line
                              x1={paddingLeft}
                              y1={y80}
                              x2={svgWidth - paddingRight}
                              y2={y80}
                              stroke="#ef4444"
                              strokeWidth="1.5"
                              strokeDasharray="5 4"
                            />
                            <text
                              x={paddingLeft + 8}
                              y={y80 - 6}
                              fontSize="9"
                              fontWeight="black"
                              fill="#ef4444"
                            >
                              Batas Pareto 80%
                            </text>

                            {/* Right Y Axis Ticks (Cumulative %) */}
                            <text x={svgWidth - paddingRight + 8} y={paddingTop + 4} textAnchor="start" fontSize="9" fontWeight="bold" fill="#ef4444">
                              100%
                            </text>
                            <text x={svgWidth - paddingRight + 8} y={y80 + 3} textAnchor="start" fontSize="9" fontWeight="black" fill="#ef4444">
                              80%
                            </text>
                            <text x={svgWidth - paddingRight + 8} y={paddingTop + chartHeight + 3} textAnchor="start" fontSize="9" fontWeight="bold" fill="#ef4444">
                              0%
                            </text>

                            {/* Bars */}
                            {displayList.map((item, idx) => {
                              const calcHeight = (item.value / maxValue) * chartHeight;
                              const barHeight = item.value > 0 ? Math.max(10, calcHeight) : 0;
                              const x = paddingLeft + barSpacing * idx + (barSpacing - barWidth) / 2;
                              const y = paddingTop + chartHeight - barHeight;
                              const barColor = item.isVital80 ? (idx === 0 ? "#f59e0b" : "#fbbf24") : "#94a3b8";

                              return (
                                <g key={item.code} className="group/pareto-bar cursor-pointer">
                                  <rect x={x} y={y} width={barWidth} height={barHeight} rx="4" fill={barColor} opacity="0.9" className="transition-all hover:opacity-100 hover:brightness-105" />
                                  <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize="9" fontWeight="black" fill="#334155">
                                    {paretoMode === "COUNT" ? item.value : `${Math.round(item.value / 60)}m`}
                                  </text>
                                  <text x={x + barWidth / 2} y={paddingTop + chartHeight + 16} textAnchor="middle" fontSize="9" fontWeight="extrabold" fill={item.isVital80 ? "#b45309" : "#64748b"}>
                                    {paretoGroupBy === "KATEGORI"
                                      ? (item.name.length > 14 ? item.name.substring(0, 12) + "..." : item.name)
                                      : (item.code.startsWith("Mesin") ? item.code : `M-${item.code}`)}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Line & Dots */}
                            {displayList.length > 0 && (
                              <>
                                <polyline points={pointsStr} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                {displayList.map((item, idx) => {
                                  const x = paddingLeft + barSpacing * idx + barSpacing / 2;
                                  const y = paddingTop + chartHeight - (item.cumulativePct / 100) * chartHeight;
                                  return (
                                    <g key={`dot-${item.code}`} className="group/dot cursor-pointer">
                                      <circle cx={x} cy={y} r="4" fill="#ffffff" stroke="#ef4444" strokeWidth="2.5" />
                                      <text x={x} y={y - 10} textAnchor="middle" fontSize="9" fontWeight="black" fill="#ef4444" className="opacity-90 group-hover/dot:opacity-100 transition-opacity bg-white">
                                        {item.cumulativePct}%
                                      </text>
                                    </g>
                                  );
                                })}
                              </>
                            )}
                          </svg>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center py-12 text-sm text-slate-400 font-bold">
                      Tidak ada data cacat/downtime pada periode terpilih
                    </div>
                  )}
                </div>

                {/* Category Cards Grid */}
                {(() => {
                  const maxInitialVisible = 4;
                  const visibleCards = showAllParetoCards ? list : list.slice(0, maxInitialVisible);
                  const remainingCount = list.length - maxInitialVisible;

                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6">
                        {visibleCards.map((item, idx) => (
                          <div
                            key={item.code}
                            className={`p-3.5 rounded-2xl transition-all border ${item.isVital80
                              ? "bg-amber-50/50 border-amber-200/80 shadow-xs hover:border-amber-300"
                              : "bg-slate-50/40 border-slate-200/60 hover:border-slate-300"
                              }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] ${item.isVital80 ? "bg-amber-500 text-white shadow-xs" : "bg-slate-300 text-slate-700"
                                    }`}
                                >
                                  {idx + 1}
                                </span>
                                <span className="text-xs font-black text-slate-800">
                                  {item.friendlyName}
                                </span>
                              </div>
                              {item.isVital80 && (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300/80">
                                  Vital 80%
                                </span>
                              )}
                            </div>

                            <div className="flex items-baseline justify-between pt-1 border-t border-slate-200/40 mt-2">
                              <span className="text-[10px] text-slate-400 font-semibold">
                                Kumulatif: <strong className="text-slate-700 font-extrabold">{item.cumulativePct}%</strong>
                              </span>
                              <div className="text-right">
                                {paretoMode === "COUNT" ? (
                                  <span className="text-sm font-black text-slate-800">
                                    {item.count} <span className="text-[10px] text-slate-400 font-bold">kejadian</span>
                                  </span>
                                ) : (
                                  <span className="text-sm font-black text-slate-800">
                                    {Math.round(item.downtime / 60)} <span className="text-[10px] text-slate-400 font-bold">menit</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {list.length > maxInitialVisible && (
                        <div className="flex justify-center mt-4 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowAllParetoCards(!showAllParetoCards)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-extrabold border border-slate-200 shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                          >
                            {showAllParetoCards ? (
                              <>
                                <ChevronUp className="w-4 h-4 text-slate-500" />
                                Tampilkan Lebih Sedikit
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                                Lihat Lebih Banyak ({remainingCount} detail masalah lagi)
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            );
          })()}

          {/* Rekap Data Section */}
        </>
      ) : (
        <div className="space-y-6 animate-fadeIn">
          {/* Attendance KPI Cards */}
          <div
            data-tour="dashboard-kpi"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            <div className="bg-white border border-[#e9ecef] rounded-[24px] p-5 flex flex-col justify-between h-full min-h-[11rem] shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
              <div className="flex justify-between items-start">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  Total Pegawai Pabrik
                </span>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-50 text-slate-600">
                  <Users className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-2">
                <div className="text-3xl font-black tracking-tight text-slate-800">
                  {attendanceStats.totalPegawai}{" "}
                  <span className="text-sm font-semibold opacity-80">
                    Orang
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-500 font-bold">
                  Terdaftar dalam sistem
                </div>
              </div>
            </div>

            <div className="bg-[#0070bc] rounded-[24px] p-5 flex flex-col justify-between h-full min-h-[11rem] shadow-md text-white relative overflow-hidden group hover:scale-[1.01] transition-transform">
              <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-sky-400/20 blur-xl group-hover:scale-125 transition-all duration-300 pointer-events-none" />
              <div className="flex justify-between items-start relative z-10">
                <span className="text-sky-100 text-[10px] font-bold uppercase tracking-wider">
                  Pegawai Hadir
                </span>
                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
                  <Users className="w-3.5 h-3.5 text-white" />
                </span>
              </div>
              <div className="mt-2 relative z-10">
                <div className="text-3xl font-black tracking-tight flex items-baseline gap-1">
                  {attendanceStats.countHadir}{" "}
                  <span className="text-sm font-semibold opacity-80">
                    Orang
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-sky-200 font-semibold">
                  Tercatat memproduksi barang
                </div>
              </div>
            </div>

            <div className="bg-rose-50/40 border border-rose-100 rounded-[24px] p-5 flex flex-col justify-between h-full min-h-[11rem] shadow-[0_8px_30px_rgba(0,0,0,0.015)] relative">
              {attendanceStats.countTidakHadir > 0 && (
                <div className="absolute inset-0 ring-2 ring-rose-500 rounded-[24px] pointer-events-none" />
              )}
              <div className="flex justify-between items-start">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  Tidak Hadir / 0 Hasil
                </span>
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${attendanceStats.countTidakHadir > 0 ? "bg-rose-100 text-rose-600 animate-pulse" : "bg-slate-50 text-slate-500"}`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-2">
                <div className="text-3xl font-black tracking-tight text-slate-800">
                  {attendanceStats.countTidakHadir}{" "}
                  <span className="text-sm font-semibold opacity-80 text-slate-500">
                    Orang
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-600 font-bold">
                  Pegawai tidak ada rekaman hari ini
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#e9ecef] rounded-[24px] p-5 flex flex-col justify-between h-full min-h-[11rem] shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
              <div className="flex justify-between items-start">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  Tingkat Kehadiran
                </span>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-emerald-50 text-emerald-600">
                  <TrendingUp className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-2">
                <div className="text-3xl font-black tracking-tight text-slate-800">
                  {attendanceStats.persentaseHadir.toFixed(1)}%
                </div>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-600 font-bold">
                  Persentase dari total pegawai
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List Absen */}
            <div className="bg-white border border-[#e9ecef] rounded-[32px] p-6 flex flex-col shadow-[0_8px_30px_rgba(0,0,0,0.02)] h-[400px]">
              <div className="border-b border-slate-100 pb-4 mb-4">
                <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  Daftar Tidak Hadir
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">
                  Pegawai yang belum memiliki rekaman produksi di rentang waktu
                  ini.
                </p>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {attendanceStats.listTidakHadir.length > 0 ? (
                  attendanceStats.listTidakHadir.map((op) => (
                    <div
                      key={op}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100/50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                          {op.substring(0, 2)}
                        </div>
                        <span className="text-sm font-semibold text-slate-700">
                          {op}
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold text-rose-500 bg-rose-50 px-2 py-1 rounded-md">
                        ABSENT
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <Users className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-xs font-semibold">
                      Semua pegawai hadir!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Attendance Chart Mockup/Placeholder */}
            <div className="lg:col-span-2 bg-white border border-[#e9ecef] rounded-[32px] p-6 flex flex-col shadow-[0_8px_30px_rgba(0,0,0,0.02)] h-[400px]">
              <div className="border-b border-slate-100 pb-4 mb-4">
                <h3 className="text-base font-extrabold text-slate-800">
                  Visualisasi Kehadiran
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">
                  Gunakan grafik ini untuk memantau tren kehadiran operator.
                </p>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <BarChart2 className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-500">
                  Grafik Tren Kehadiran
                </p>
                <p className="text-xs text-slate-400 mt-1 text-center max-w-sm">
                  Data kehadiran saat ini diturunkan langsung dari produksi
                  (Hadir/Tidak). Grafik analitik historis penuh akan diaktifkan
                  setelah sistem input absensi siap.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Monthly Rekap Modal */}
      {isMonthlyRekapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Download className="w-5 h-5 text-[#0070bc]" />
                Download Rekap Bulanan
              </h3>
              <button
                onClick={() => setIsMonthlyRekapModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 p-1.5 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Bulan
                </label>
                <select
                  value={exportMonth}
                  onChange={(e) => setExportMonth(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#0070bc]/30 focus:border-[#0070bc]"
                >
                  <option value={1}>Januari</option>
                  <option value={2}>Februari</option>
                  <option value={3}>Maret</option>
                  <option value={4}>April</option>
                  <option value={5}>Mei</option>
                  <option value={6}>Juni</option>
                  <option value={7}>Juli</option>
                  <option value={8}>Agustus</option>
                  <option value={9}>September</option>
                  <option value={10}>Oktober</option>
                  <option value={11}>November</option>
                  <option value={12}>Desember</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Tahun
                </label>
                <select
                  value={exportYear}
                  onChange={(e) => setExportYear(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#0070bc]/30 focus:border-[#0070bc]"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
              <button
                onClick={() => setIsMonthlyRekapModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDownloadMonthlyRekap}
                className="px-5 py-2 text-sm font-bold text-white bg-[#0070bc] hover:bg-[#005a96] rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Generate Excel
              </button>
            </div>
          </div>
        </div>
      )}

      <ProductTour
        steps={DASHBOARD_TOUR_STEPS}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />
    </div>
  );
}
