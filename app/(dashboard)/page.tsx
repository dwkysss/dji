"use client";

import React, { useState, useMemo, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { RefreshCw } from "lucide-react";
import { getRealProductionsData } from "@/actions/dashboard-actions";
import { getShiftDate } from "@/lib/shift-utils";
import { REGISTERED_MACHINES } from "@/lib/constants";
import { getOperatorsList } from "@/actions/operator-actions";
import ProductTour, { ProductTourStep } from "@/components/ProductTour";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardKpiCards from "@/components/dashboard/DashboardKpiCards";
import DashboardSlicers from "@/components/dashboard/DashboardSlicers";
import DashboardAttendanceView from "@/components/dashboard/DashboardAttendanceView";
import MonthlyRekapModal from "@/components/dashboard/MonthlyRekapModal";
import DashboardLeaderboardSection from "@/components/dashboard/DashboardLeaderboardSection";
import { DashboardParetoSection } from "@/components/dashboard/DashboardParetoSection";
import DashboardVisualsSection from "@/components/dashboard/DashboardVisualsSection";
import { useDashboardKpis, DashboardTransaction } from "@/hooks/useDashboardKpis";

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

// In-memory cache to persist dashboard transactions across client navigation without reloading
let cachedDashboardTransactions: DashboardTransaction[] | null = null;
let cachedDashboardIsLive = false;
let isFetchingDashboardData = false;
let isFullDashboardCached = false;
let cachedEarliestDate: string | null = null;

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [, startTransition] = useTransition();
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<
    "ALL" | "LOLOS" | "EFISIENSI" | "PROBLEMS" | "NOL_PRODUKSI"
  >("ALL");
  const [transactions, setTransactions] = useState<DashboardTransaction[]>(
    () => cachedDashboardTransactions || [],
  );
  const [isLive, setIsLive] = useState<boolean>(() => cachedDashboardIsLive);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Strategi 1: Cache Ringkasan KPI (~500 byte di localStorage, anti-penuh)
  const [cachedKpiSummary, setCachedKpiSummary] = useState<{
    stats?: any;
    deltas?: any;
    savedAt?: string;
  } | null>(null);

  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(
    () => !cachedDashboardTransactions || cachedDashboardTransactions.length === 0,
  );

  useEffect(() => {
    try {
      const todayShift = getShiftDate(new Date());
      const savedCacheStr = localStorage.getItem("dji_dashboard_cache");
      if (savedCacheStr) {
        const parsed = JSON.parse(savedCacheStr);
        // Pastikan cache masih untuk hari operasional saat ini
        if (parsed && parsed.shiftDate === todayShift) {
          if (parsed.stats) {
            setCachedKpiSummary({
              stats: parsed.stats,
              deltas: parsed.deltas,
              savedAt: parsed.savedAt,
            });
          }
          if (Array.isArray(parsed.transactions) && parsed.transactions.length > 0) {
            if (!cachedDashboardTransactions || cachedDashboardTransactions.length === 0) {
              cachedDashboardTransactions = parsed.transactions;
              setTransactions(parsed.transactions);
              setIsLoadingInitial(false);
            }
          }
        } else {
          // Jika hari sudah berganti, bersihkan cache lama agar tidak menampilkan data kemarin di KPI hari ini
          localStorage.removeItem("dji_dashboard_cache");
          localStorage.removeItem("dji_dashboard_kpi_summary");
          setCachedKpiSummary(null);
        }
      } else {
        const savedLegacy = localStorage.getItem("dji_dashboard_kpi_summary");
        if (savedLegacy) {
          const legacyParsed = JSON.parse(savedLegacy);
          if (legacyParsed?.savedAt) {
            const legacyShift = getShiftDate(new Date(legacyParsed.savedAt));
            if (legacyShift === todayShift) {
              setCachedKpiSummary(legacyParsed);
            } else {
              localStorage.removeItem("dji_dashboard_kpi_summary");
            }
          }
        }
      }
    } catch (e) {
      console.warn("Gagal membaca cache dashboard:", e);
    }
  }, []);

  // Dashboard View Mode (Produksi vs Kehadiran)
  const [dashboardMode, setDashboardMode] = useState<"PRODUKSI" | "KEHADIRAN">(
    "PRODUKSI",
  );

  // Metric View Mode (OEE vs CLASSIC)
  const [dashboardViewType] = useState<"OEE" | "CLASSIC">(
    "CLASSIC",
  );

  // Metric Mode State (controls sliders for PCS vs METER)
  const [metricMode, setMetricMode] = useState<"PCS" | "METER">("PCS");

  // Date Filtering State
  const [dateRangeMode, setDateRangeMode] = useState<
    "TODAY" | "7DAYS" | "30DAYS" | "CUSTOM"
  >("TODAY");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Grade breakdown filter for Chart
  const [chartGradeFilter, setChartGradeFilter] = useState<
    "ALL" | "GRADE_A" | "GRADE_B" | "BS" | "UNGRADED"
  >("ALL");

  // Machine Filter State
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
  const [isMachineDropdownOpen, setIsMachineDropdownOpen] = useState(false);
  const machineDropdownRef = useRef<HTMLDivElement>(null);

  // Operator Filter State
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const [isOperatorDropdownOpen, setIsOperatorDropdownOpen] = useState(false);
  const operatorDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        machineDropdownRef.current &&
        !machineDropdownRef.current.contains(event.target as Node)
      ) {
        setIsMachineDropdownOpen(false);
      }
      if (
        operatorDropdownRef.current &&
        !operatorDropdownRef.current.contains(event.target as Node)
      ) {
        setIsOperatorDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  // Role Protection: Redirect non-admin/manager roles away from the heavy dashboard
  useEffect(() => {
    if (user) {
      if (user.role === "operator") {
        router.replace("/input");
      } else if (user.role === "inspeksi" || user.role === "qc") {
        router.replace("/qc");
      } else if (user.role === "mending") {
        router.replace("/mending");
      }
    }
  }, [user, router]);

  // Load real production data from Supabase (with client-side navigation caching)
  const loadLiveData = async (
    forceRefresh = false,
    customOptions?: { startDate?: string; endDate?: string; fetchAll?: boolean },
  ) => {
    if (isFetchingDashboardData && !forceRefresh) return;
    if (
      !forceRefresh &&
      !customOptions &&
      cachedDashboardTransactions &&
      cachedDashboardTransactions.length > 0 &&
      isFullDashboardCached
    ) {
      return;
    }
    isFetchingDashboardData = true;
    if (forceRefresh) setIsRefreshing(true);

    try {
      const res = await getRealProductionsData(customOptions);
      if (res.success && res.data) {
        const rawData = res.data as DashboardTransaction[];
        cachedDashboardTransactions = rawData;
        cachedDashboardIsLive = true;
        if (!customOptions) {
          isFullDashboardCached = true;
        }
        if (customOptions?.startDate) {
          if (!cachedEarliestDate || customOptions.startDate < cachedEarliestDate) {
            cachedEarliestDate = customOptions.startDate;
          }
        }

        // Simpan snapshot transaksi ke cache lokal agar saat reload halaman, grafik & KPI langsung sinkron
        try {
          const todayShift = getShiftDate(new Date());
          const existingCacheStr = localStorage.getItem("dji_dashboard_cache");
          const existingCache = existingCacheStr ? JSON.parse(existingCacheStr) : {};
          const txsToCache = rawData.slice(0, 500);
          const newCache = {
            ...existingCache,
            shiftDate: todayShift,
            savedAt: new Date().toISOString(),
            transactions: txsToCache,
          };
          localStorage.setItem("dji_dashboard_cache", JSON.stringify(newCache));
        } catch (storageErr) {
          console.warn("Gagal menyimpan transaksi ke cache lokal:", storageErr);
        }

        // Non-blocking state update via startTransition so UI navigation stays responsive
        startTransition(() => {
          setTransactions(rawData);
          setIsLive(true);
        });
      } else if (!res.success) {
        console.error("Failed to load dashboard data:", res.error);
      }
    } catch (err) {
      console.error("Error calling getRealProductionsData:", err);
    } finally {
      isFetchingDashboardData = false;
      setIsRefreshing(false);
      setIsLoadingInitial(false);
    }
  };

  useEffect(() => {
    // Jangan load data berat jika user bukan admin/manager
    if (
      user &&
      (user.role === "operator" ||
        user.role === "inspeksi" ||
        user.role === "qc" ||
        user.role === "mending")
    ) {
      return;
    }
    // Jika data 35 hari sudah lengkap di memori, jangan reload lagi saat pindah halaman!
    if (
      cachedDashboardTransactions &&
      cachedDashboardTransactions.length > 0 &&
      isFullDashboardCached
    ) {
      return;
    }

    // Hitung tanggal cut-off shift kerja operasional hari ini (dengan buffer 1 hari untuk shift 3 malam)
    const shiftToday = getShiftDate(new Date());
    const prevDate = new Date();
    prevDate.setDate(prevDate.getDate() - 1);
    const yesterdayStr = prevDate.toISOString().split("T")[0];
    const todayStartDate = yesterdayStr < shiftToday ? yesterdayStr : shiftToday;

    const runInitialLoad = async () => {
      // Ambil data Hari Ini secara ringan & cepat (< 200ms)
      if (!cachedDashboardTransactions || cachedDashboardTransactions.length === 0) {
        await loadLiveData(false, { startDate: todayStartDate });
      }
    };

    runInitialLoad();
  }, [user]);

  // Jika user berpindah ke filter 7 Hari atau 30 Hari, muat range tanggal tersebut jika belum ter-cache
  useEffect(() => {
    if (isFullDashboardCached) return;

    const now = new Date();
    if (dateRangeMode === "7DAYS") {
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 7);
      const start7Str = past7.toISOString().split("T")[0];
      if (!cachedEarliestDate || cachedEarliestDate > start7Str) {
        loadLiveData(true, { startDate: start7Str });
      }
    } else if (dateRangeMode === "30DAYS") {
      const past30 = new Date(now);
      past30.setDate(now.getDate() - 30);
      const start30Str = past30.toISOString().split("T")[0];
      if (!cachedEarliestDate || cachedEarliestDate > start30Str) {
        loadLiveData(true, { startDate: start30Str });
      }
    }
  }, [dateRangeMode]);

  // Handle custom date range if requested outside loaded window
  useEffect(() => {
    if (dateRangeMode === "CUSTOM" && startDate) {
      const reqDate = new Date(startDate);
      const minLoadedDate = transactions.reduce<Date | null>((min, t) => {
        const d = new Date(t.tanggal);
        if (isNaN(d.getTime())) return min;
        return !min || d < min ? d : min;
      }, null);

      if (minLoadedDate && reqDate < minLoadedDate) {
        loadLiveData(true, { startDate, endDate: endDate || undefined });
      }
    }
  }, [dateRangeMode, startDate, endDate]);

  // Machines Grouped by Type (Mesin R vs Mesin T vs Lainnya)
  const machinesByType = useMemo(() => {
    const allSet = new Set<string>(REGISTERED_MACHINES);
    transactions.forEach((t) => {
      if (t.mesin_id) allSet.add(t.mesin_id);
    });

    const map: { R: string[]; T: string[]; Lainnya: string[] } = {
      R: [],
      T: [],
      Lainnya: [],
    };

    allSet.forEach((m) => {
      const upper = m.toUpperCase();
      if (upper.startsWith("R")) {
        map.R.push(m);
      } else if (upper.startsWith("T")) {
        map.T.push(m);
      } else {
        map.Lainnya.push(m);
      }
    });

    const sortFn = (a: string, b: string) =>
      a.localeCompare(b, undefined, { numeric: true });
    map.R.sort(sortFn);
    map.T.sort(sortFn);
    map.Lainnya.sort(sortFn);

    return map;
  }, [transactions]);

  // Label for Machine Trigger Button
  const machineButtonLabel = useMemo(() => {
    if (selectedMachines.length === 0) return "Semua";

    const isAllR =
      machinesByType.R.length > 0 &&
      selectedMachines.length === machinesByType.R.length &&
      machinesByType.R.every((m) => selectedMachines.includes(m));
    if (isAllR) return "Mesin R";

    const isAllT =
      machinesByType.T.length > 0 &&
      selectedMachines.length === machinesByType.T.length &&
      machinesByType.T.every((m) => selectedMachines.includes(m));
    if (isAllT) return "Mesin T";

    if (selectedMachines.length === 1) return selectedMachines[0];
    return `${selectedMachines.length} Terpilih`;
  }, [selectedMachines, machinesByType]);

  // Master Operator List State (loaded from database / fallback)
  const [operatorList, setOperatorList] = useState<{ name: string; shift: string }[]>(() =>
    FALLBACK_OPERATORS.map((op) => ({ name: op.name, shift: op.shift })),
  );

  // Load dynamic operator list from database
  useEffect(() => {
    getOperatorsList()
      .then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          setOperatorList(
            res.data.map((d) => ({
              name: d.nama_operator,
              shift: d.shift || "A",
            })),
          );
        }
      })
      .catch(() => {});
  }, []);

  // Operators Grouped by Shift (A, B, C, and Lainnya)
  const operatorsByShift = useMemo(() => {
    const shiftMap: Record<string, string[]> = {
      A: [],
      B: [],
      C: [],
      Lainnya: [],
    };

    const registeredNames = new Set<string>();

    operatorList.forEach((op) => {
      registeredNames.add(op.name);
      const s = (op.shift || "A").toUpperCase();
      if (s === "A" || s === "B" || s === "C") {
        shiftMap[s].push(op.name);
      } else {
        shiftMap.Lainnya.push(op.name);
      }
    });

    const txnOps = new Set(
      transactions.map((t) => t.nama_operator).filter(Boolean),
    );
    txnOps.forEach((opName) => {
      if (!registeredNames.has(opName)) {
        shiftMap.Lainnya.push(opName);
      }
    });

    Object.keys(shiftMap).forEach((k) => {
      shiftMap[k].sort((a, b) => a.localeCompare(b));
    });

    return shiftMap;
  }, [operatorList, transactions]);

  // Label for Operator Trigger Button
  const operatorButtonLabel = useMemo(() => {
    if (selectedOperators.length === 0) return "Semua";

    const isShift = (shiftKey: "A" | "B" | "C") => {
      const list = operatorsByShift[shiftKey] || [];
      return (
        list.length > 0 &&
        selectedOperators.length === list.length &&
        list.every((n) => selectedOperators.includes(n))
      );
    };

    if (isShift("A")) return "Tim A";
    if (isShift("B")) return "Tim B";
    if (isShift("C")) return "Tim C";

    if (selectedOperators.length === 1) return selectedOperators[0];
    return `${selectedOperators.length} Terpilih`;
  }, [selectedOperators, operatorsByShift]);

  // Unique Operators for Attendance and Filters
  const uniqueOperators = useMemo<string[]>(() => {
    const set = new Set<string>();
    operatorList.forEach((op) => set.add(op.name));
    transactions.forEach((t) => {
      if (t.nama_operator) set.add(t.nama_operator);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [operatorList, transactions]);

  // Filter transactions by date range, operator, and machine
  const dateFilteredTransactions = useMemo(() => {
    let result = transactions;

    const now = new Date();
    const todayStr = getShiftDate(now);

    result = result.filter((item) => {
      const itemDate = new Date(item.tanggal);
      if (isNaN(itemDate.getTime())) return true;

      if (dateRangeMode === "TODAY") {
        return (
          item.tanggal === todayStr ||
          itemDate.toLocaleDateString("en-CA") === todayStr
        );
      }

      if (dateRangeMode === "7DAYS") {
        const past7 = new Date(now);
        past7.setDate(now.getDate() - 7);
        const start7Str = past7.toISOString().split("T")[0];
        return item.tanggal >= start7Str;
      }

      if (dateRangeMode === "30DAYS") {
        const past30 = new Date(now);
        past30.setDate(now.getDate() - 30);
        const start30Str = past30.toISOString().split("T")[0];
        return item.tanggal >= start30Str;
      }

      if (dateRangeMode === "CUSTOM") {
        if (!startDate && !endDate) return true;
        if (startDate && item.tanggal < startDate) return false;
        if (endDate && item.tanggal > endDate) return false;
        return true;
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

  // Main KPI calculations via custom hook
  const { stats, deltas, gradeLabel } = useDashboardKpis({
    transactions,
    dateFilteredTransactions,
    dateRangeMode,
    startDate,
    endDate,
    selectedOperators,
    selectedMachines,
    chartGradeFilter,
    metricMode,
    cachedKpiSummary,
  });

  const handleResetFilters = () => {
    setActiveFilter("ALL");
    setChartGradeFilter("ALL");
    setDateRangeMode("TODAY");
    setStartDate("");
    setEndDate("");
    setSelectedOperators([]);
    setSelectedMachines([]);
    setIsOperatorDropdownOpen(false);
    setIsMachineDropdownOpen(false);
    setMetricMode("PCS");
  };

  const handleManualRefresh = () => {
    if (dateRangeMode === "TODAY") {
      const shiftToday = getShiftDate(new Date());
      const prevDate = new Date();
      prevDate.setDate(prevDate.getDate() - 1);
      const yesterdayStr = prevDate.toISOString().split("T")[0];
      const todayStartDate = yesterdayStr < shiftToday ? yesterdayStr : shiftToday;
      loadLiveData(true, { startDate: todayStartDate });
    } else if (dateRangeMode === "7DAYS") {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 7);
      loadLiveData(true, { startDate: past7.toISOString().split("T")[0] });
    } else if (dateRangeMode === "30DAYS") {
      const past30 = new Date();
      past30.setDate(past30.getDate() - 30);
      loadLiveData(true, { startDate: past30.toISOString().split("T")[0] });
    } else if (dateRangeMode === "CUSTOM" && startDate) {
      loadLiveData(true, { startDate, endDate: endDate || undefined });
    } else {
      loadLiveData(true);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Header */}
      <DashboardHeader
        isLive={isLive}
        dashboardMode={dashboardMode}
        setDashboardMode={setDashboardMode}
        setIsTourOpen={setIsTourOpen}
        setIsMonthlyRekapModalOpen={setIsMonthlyRekapModalOpen}
        handleManualRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
        handleResetFilters={handleResetFilters}
      />

      {/* Slicers Container */}
      <DashboardSlicers
        dateRangeMode={dateRangeMode}
        setDateRangeMode={setDateRangeMode}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        metricMode={metricMode}
        setMetricMode={setMetricMode}
        selectedMachines={selectedMachines}
        setSelectedMachines={setSelectedMachines}
        isMachineDropdownOpen={isMachineDropdownOpen}
        setIsMachineDropdownOpen={setIsMachineDropdownOpen}
        machineDropdownRef={machineDropdownRef}
        machineButtonLabel={machineButtonLabel}
        machinesByType={machinesByType}
        selectedOperators={selectedOperators}
        setSelectedOperators={setSelectedOperators}
        isOperatorDropdownOpen={isOperatorDropdownOpen}
        setIsOperatorDropdownOpen={setIsOperatorDropdownOpen}
        operatorDropdownRef={operatorDropdownRef}
        operatorButtonLabel={operatorButtonLabel}
        operatorsByShift={operatorsByShift}
      />

      {dashboardMode === "PRODUKSI" ? (
        <>
          {/* Subtle Live Sync Notice if using cached summary */}
          {transactions.length === 0 && cachedKpiSummary && (
            <div className="mb-2.5 flex items-center justify-between px-3.5 py-1.5 bg-sky-50 border border-sky-200/70 rounded-xl text-xs text-[#0070bc] shadow-sm animate-fadeIn">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0070bc]" />
                <span className="font-semibold">
                  Menampilkan ringkasan tersimpan • Menyinkronkan data live...
                </span>
              </div>
              {cachedKpiSummary.savedAt && (
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Tersimpan:{" "}
                  {new Date(cachedKpiSummary.savedAt).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          )}

          {/* Loading Notice saat pertama kali buka belum ada cache */}
          {isLoadingInitial && transactions.length === 0 && !cachedKpiSummary && (
            <div className="mb-2.5 flex items-center justify-between px-3.5 py-1.5 bg-sky-50/80 border border-sky-200/70 rounded-xl text-xs text-[#0070bc] shadow-sm animate-pulse">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0070bc]" />
                <span className="font-semibold">
                  Menghubungkan ke database & memuat data produksi hari ini...
                </span>
              </div>
            </div>
          )}

          {/* Dashboard KPI Cards (Classic & OEE) */}
          <DashboardKpiCards
            dashboardViewType={dashboardViewType}
            isRefreshing={isRefreshing}
            isLoadingInitial={isLoadingInitial}
            transactionsCount={transactions.length}
            cachedKpiSummary={cachedKpiSummary}
            gradeLabel={gradeLabel}
            stats={stats}
            deltas={deltas}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            metricMode={metricMode}
            setMetricMode={setMetricMode}
            handleTouchStart={handleTouchStart}
            handleTouchEndMetric={handleTouchEndMetric}
          />

          {/* Grid Dashboard Visuals */}
          <DashboardVisualsSection
            dateFilteredTransactions={dateFilteredTransactions}
            metricMode={metricMode}
            activeFilter={activeFilter}
            chartGradeFilter={chartGradeFilter}
            setChartGradeFilter={setChartGradeFilter}
            dateRangeMode={dateRangeMode}
            startDate={startDate}
            endDate={endDate}
            isLoading={isLoadingInitial || (transactions.length === 0 && Boolean(cachedKpiSummary))}
          />

          {/* Leaderboard Section (Top/Bottom Performers) */}
          <DashboardLeaderboardSection
            metricMode={metricMode}
            dateFilteredTransactions={dateFilteredTransactions}
          />

          {/* Full-Width Dedicated Pareto Analysis Section at Bottom */}
          <DashboardParetoSection
            dateFilteredTransactions={dateFilteredTransactions}
            metricMode={metricMode}
          />
        </>
      ) : (
        <DashboardAttendanceView
          operatorList={operatorList}
          transactions={transactions}
          uniqueOperators={uniqueOperators}
          operatorsByShift={operatorsByShift}
          dateRangeMode={dateRangeMode}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {/* Monthly Rekap Modal */}
      <MonthlyRekapModal
        isOpen={isMonthlyRekapModalOpen}
        onClose={() => setIsMonthlyRekapModalOpen(false)}
        exportMonth={exportMonth}
        setExportMonth={setExportMonth}
        exportYear={exportYear}
        setExportYear={setExportYear}
        onDownload={handleDownloadMonthlyRekap}
      />

      <ProductTour
        steps={DASHBOARD_TOUR_STEPS}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />
    </div>
  );
}
