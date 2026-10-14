"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  getDesignReportOptions,
  getDesignReportData,
  DesignReportGroup,
  DesignReportRow,
  DesignReportSummary,
} from "@/actions/design-report-actions";
import { REGISTERED_MACHINES } from "@/lib/constants";
import {
  FileSpreadsheet,
  Search,
  Loader2,
  AlertTriangle,
  Download,
  Filter,
  Calendar,
  RotateCw,
  Layers,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  ChevronDown,
  Info,
  ShieldCheck,
  Package,
  CalendarDays,
  ArrowUpDown,
  Check,
  X,
} from "lucide-react";
import * as xlsx from "xlsx";

const MONTH_LIST = [
  { value: "1", label: "Januari", short: "Jan" },
  { value: "2", label: "Februari", short: "Feb" },
  { value: "3", label: "Maret", short: "Mar" },
  { value: "4", label: "April", short: "Apr" },
  { value: "5", label: "Mei", short: "Mei" },
  { value: "6", label: "Juni", short: "Jun" },
  { value: "7", label: "Juli", short: "Jul" },
  { value: "8", label: "Agustus", short: "Agu" },
  { value: "9", label: "September", short: "Sep" },
  { value: "10", label: "Oktober", short: "Okt" },
  { value: "11", label: "November", short: "Nov" },
  { value: "12", label: "Desember", short: "Des" },
];

export default function LaporanPerDesignPage() {
  const currentMonthStr = (new Date().getMonth() + 1).toString(); // e.g. "10"
  const currentYearStr = new Date().getFullYear().toString();

  const [selectedMachine, setSelectedMachine] = useState<string>("R1");
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  // Multi-Bulan: Array of string month numbers, default: current month ["10"]
  const [selectedMonths, setSelectedMonths] = useState<string[]>([currentMonthStr]);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState<boolean>(false);
  const monthPickerRef = useRef<HTMLDivElement>(null);

  const [selectedDesign, setSelectedDesign] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  // Toggle: Sertakan potongan dari bulan sebelumnya untuk desain yang aktif di bulan terpilih (default: true)
  const [includeCrossMonth, setIncludeCrossMonth] = useState<boolean>(true);

  const [availableDesigns, setAvailableDesigns] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([currentYearStr]);

  const [reportGroups, setReportGroups] = useState<DesignReportGroup[]>([]);
  const [grandSummary, setGrandSummary] = useState<DesignReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // In-memory cache for 0ms instant switching
  const [cache, setCache] = useState<
    Record<
      string,
      { groups: DesignReportGroup[]; grandSummary?: DesignReportSummary }
    >
  >({});

  // Close month picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        monthPickerRef.current &&
        !monthPickerRef.current.contains(event.target as Node)
      ) {
        setIsMonthPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const [isExportingAll, setIsExportingAll] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setIsExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. Load Filter Options on Mount
  useEffect(() => {
    getDesignReportOptions().then((res) => {
      if (res.success && res.data) {
        setAvailableDesigns(res.data.designs || []);
        if (res.data.years && res.data.years.length > 0) {
          setAvailableYears(res.data.years);
        }
      }
    });
  }, []);

  // 2. Fetch Data when Filters change
  useEffect(() => {
    fetchData(selectedMachine, selectedYear, selectedMonths, selectedDesign, includeCrossMonth);
  }, [selectedMachine, selectedYear, selectedMonths, selectedDesign, includeCrossMonth]);

  const fetchData = async (
    mc: string,
    year: string,
    months: string[],
    design: string,
    crossMonth: boolean
  ) => {
    const monthKey = months.slice().sort((a, b) => Number(a) - Number(b)).join(",");
    const cacheKey = `${mc}__${year}__${monthKey}__${design}__${crossMonth ? "cross" : "strict"}`;

    if (cache[cacheKey]) {
      setReportGroups(cache[cacheKey].groups);
      setGrandSummary(cache[cacheKey].grandSummary || null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await getDesignReportData(mc, year, months, design, crossMonth);
      if (res.success && res.data) {
        setReportGroups(res.data);
        setGrandSummary(res.grandSummary || null);

        setCache((prev) => ({
          ...prev,
          [cacheKey]: {
            groups: res.data || [],
            grandSummary: res.grandSummary,
          },
        }));
      } else {
        setErrorMsg(res.error || "Gagal memuat data laporan per design.");
        setReportGroups([]);
        setGrandSummary(null);
      }
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan saat mengambil data.");
      setReportGroups([]);
      setGrandSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    const monthKey = selectedMonths.slice().sort((a, b) => Number(a) - Number(b)).join(",");
    const cacheKey = `${selectedMachine}__${selectedYear}__${monthKey}__${selectedDesign}__${includeCrossMonth ? "cross" : "strict"}`;
    setCache((prev) => {
      const next = { ...prev };
      delete next[cacheKey];
      return next;
    });
    fetchData(selectedMachine, selectedYear, selectedMonths, selectedDesign, includeCrossMonth);
  };

  // Toggle single month in multi-select
  const toggleMonth = (mVal: string) => {
    setSelectedMonths((prev) => {
      if (prev.includes(mVal)) {
        // Jangan biarkan kosong sama sekali, minimal 1 bulan
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== mVal);
      } else {
        return [...prev, mVal];
      }
    });
  };

  const selectAllMonths = () => {
    setSelectedMonths(MONTH_LIST.map((m) => m.value));
  };

  const selectCurrentMonthOnly = () => {
    setSelectedMonths([currentMonthStr]);
  };

  const selectLastThreeMonths = () => {
    const curr = parseInt(currentMonthStr, 10);
    const months = [
      curr === 1 ? 12 : curr === 2 ? 11 : curr - 2,
      curr === 1 ? 12 : curr - 1,
      curr,
    ].map((m) => (m <= 0 ? 12 + m : m).toString());
    setSelectedMonths(Array.from(new Set(months)));
  };

  // Label tampilan bulan yang dipilih
  const selectedMonthsLabel = useMemo(() => {
    if (selectedMonths.length === 12) {
      return "Semua Bulan (1 Tahun)";
    }
    if (selectedMonths.length === 1) {
      const found = MONTH_LIST.find((m) => m.value === selectedMonths[0]);
      return found ? found.label : "1 Bulan";
    }
    const sorted = [...selectedMonths].sort((a, b) => Number(a) - Number(b));
    const names = sorted
      .map((val) => MONTH_LIST.find((m) => m.value === val)?.short)
      .filter(Boolean);
    return `${names.join(", ")} (${selectedMonths.length} Bulan)`;
  }, [selectedMonths]);

  // Filter & Urutkan baris berdasarkan nomor potongan
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const processed = reportGroups
      .map((grp) => {
        let matchingRows = grp.rows;
        if (q) {
          matchingRows = grp.rows.filter(
            (r) =>
              r.noPot.toString().includes(q) ||
              r.tanggalPotong.toLowerCase().includes(q) ||
              r.designId.toLowerCase().includes(q)
          );
        }

        if (matchingRows.length === 0) return null;

        // Urutkan baris berdasarkan nomor potongan sesuai arah sortDirection
        const sortedRows = [...matchingRows].sort((a, b) =>
          sortDirection === "asc" ? a.noPot - b.noPot : b.noPot - a.noPot
        );

        let totalProdPanel = 0;
        let totalProdA = 0;
        let totalProdB = 0;
        let totalInspA = 0;
        let totalInspB = 0;
        let inspectedPanels = 0;
        let inspectedCuts = 0;

        sortedRows.forEach((r) => {
          totalProdPanel += r.totalProdPanel;
          totalProdA += r.gradeA_prod;
          totalProdB += r.gradeB_prod;
          if (r.status !== "UNINSPECTED" && r.gradeA_inspect !== null && r.gradeB_inspect !== null) {
            totalInspA += r.gradeA_inspect;
            totalInspB += r.gradeB_inspect;
            inspectedPanels += r.totalProdPanel;
            inspectedCuts++;
          }
        });

        const gradeA_prod_pct =
          totalProdPanel > 0 ? (totalProdA / totalProdPanel) * 100 : 0;
        const gradeB_prod_pct =
          totalProdPanel > 0 ? (totalProdB / totalProdPanel) * 100 : 0;
        const gradeA_inspect_pct =
          inspectedPanels > 0 ? (totalInspA / inspectedPanels) * 100 : 0;
        const gradeB_inspect_pct =
          inspectedPanels > 0 ? (totalInspB / inspectedPanels) * 100 : 0;

        return {
          ...grp,
          rows: sortedRows,
          summary: {
            totalPotongan: sortedRows.length,
            totalProdPanel,
            inspectedCuts,
            inspectedPanels,
            gradeA_prod: totalProdA,
            gradeA_prod_pct: Number(gradeA_prod_pct.toFixed(2)),
            gradeA_inspect: totalInspA,
            gradeA_inspect_pct: Number(gradeA_inspect_pct.toFixed(2)),
            gradeB_prod: totalProdB,
            gradeB_prod_pct: Number(gradeB_prod_pct.toFixed(2)),
            gradeB_inspect: totalInspB,
            gradeB_inspect_pct: Number(gradeB_inspect_pct.toFixed(2)),
          },
        };
      })
      .filter(Boolean) as DesignReportGroup[];

    // Urutkan antar-grup berdasarkan nomor potongan di grup tersebut
    processed.sort((a, b) => {
      const potA = a.rows.length > 0 ? a.rows[0].noPot : 0;
      const potB = b.rows.length > 0 ? b.rows[0].noPot : 0;
      return sortDirection === "asc" ? potA - potB : potB - potA;
    });

    // Re-index nomor grup NO (1, 2, 3...)
    processed.forEach((grp, gIdx) => {
      grp.index = gIdx + 1;
      grp.rows.forEach((r, rIdx) => {
        r.no = rIdx === 0 ? grp.index : rIdx + 1;
      });
    });

    return processed;
  }, [reportGroups, searchQuery, sortDirection]);

  // Overall KPI Metrics
  const kpiMetrics = useMemo(() => {
    let totalPot = 0;
    let totalPanel = 0;
    let totalProdA = 0;
    let totalInspA = 0;
    let totalProdB = 0;
    let totalInspB = 0;
    let totalInspectedPanels = 0;

    filteredGroups.forEach((grp) => {
      totalPot += grp.summary.totalPotongan;
      totalPanel += grp.summary.totalProdPanel;
      totalProdA += grp.summary.gradeA_prod;
      totalInspA += grp.summary.gradeA_inspect;
      totalProdB += grp.summary.gradeB_prod;
      totalInspB += grp.summary.gradeB_inspect;
      totalInspectedPanels += grp.summary.inspectedPanels ?? grp.summary.totalProdPanel;
    });

    const avgProdA_pct = totalPanel > 0 ? (totalProdA / totalPanel) * 100 : 0;
    const avgInspA_pct = totalInspectedPanels > 0 ? (totalInspA / totalInspectedPanels) * 100 : 0;
    const avgProdB_pct = totalPanel > 0 ? (totalProdB / totalPanel) * 100 : 0;
    const avgInspB_pct = totalInspectedPanels > 0 ? (totalInspB / totalInspectedPanels) * 100 : 0;
    const deltaA = avgInspA_pct - avgProdA_pct;

    return {
      totalDesigns: filteredGroups.length,
      totalPot,
      totalPanel,
      avgProdA_pct: avgProdA_pct.toFixed(2),
      avgInspA_pct: avgInspA_pct.toFixed(2),
      avgProdB_pct: avgProdB_pct.toFixed(2),
      avgInspB_pct: avgInspB_pct.toFixed(2),
      deltaA: deltaA.toFixed(2),
    };
  }, [filteredGroups]);

  const formatPct = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return "—";
    return `${val.toFixed(2).replace(".", ",")}%`;
  };

  const buildWorksheetForGroups = (
    groups: DesignReportGroup[],
    summaryData?: DesignReportSummary | null
  ) => {
    const wsData: any[][] = [];
    const merges: any[] = [];

    // Row 0: Header Level 1 (Excel Row 1)
    wsData.push([
      "NO",
      "Tanggal potong",
      "KODE",
      "NO.POT",
      "TOTAL",
      "PANEL",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

    // Row 1: Header Level 2 (Excel Row 2)
    wsData.push([
      "",
      "",
      "DESIGN",
      "",
      "PROD",
      "GRADE A",
      "",
      "",
      "",
      "GRADE B",
      "",
      "",
      "",
    ]);

    // Row 2: Sub-Header Level 3 (Excel Row 3)
    wsData.push([
      "",
      "",
      "",
      "",
      "PANEL",
      "JML PNL",
      "% PROD",
      "JML PNL",
      "%INSPECT",
      "JML PNL",
      "% PROD",
      "JML PNL",
      "%INSPECT",
    ]);

    // Header Merges (Persis Layout Sheet Acuan Master)
    merges.push({ s: { r: 0, c: 0 }, e: { r: 2, c: 0 } }); // NO (A1:A3)
    merges.push({ s: { r: 0, c: 1 }, e: { r: 2, c: 1 } }); // Tanggal potong (B1:B3)
    merges.push({ s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }); // KODE DESIGN (C1:C2)
    merges.push({ s: { r: 0, c: 3 }, e: { r: 2, c: 3 } }); // NO.POT (D1:D3)
    merges.push({ s: { r: 0, c: 5 }, e: { r: 0, c: 12 } }); // PANEL (F1:M1)
    merges.push({ s: { r: 1, c: 5 }, e: { r: 1, c: 8 } }); // GRADE A (F2:I2)
    merges.push({ s: { r: 1, c: 9 }, e: { r: 1, c: 12 } }); // GRADE B (J2:M2)

    let currentRow = 3; // Baris data mulai index 3 (Baris 4 di Excel)

    groups.forEach((grp) => {
      const startRow = currentRow;
      const numRows = grp.rows.length;
      const endRow = startRow + numRows - 1;

      grp.rows.forEach((r, rIdx) => {
        const excelR = currentRow + 1; // 1-indexed Excel row
        const isUninspected = r.status === "UNINSPECTED" || r.gradeA_inspect === null;

        const rowCells: any[] = [
          // Col 0 (A): NO
          rIdx === 0 ? { t: "n", v: grp.index } : "",
          // Col 1 (B): Tanggal potong (murni tanggal, tanpa teks badge bulan)
          { t: "s", v: r.tanggalPotong },
          // Col 2 (C): KODE DESIGN
          rIdx === 0 ? { t: "s", v: grp.designId } : "",
          // Col 3 (D): NO.POT (angka murni, tanpa teks keterangan)
          { t: "n", v: r.noPot },
          // Col 4 (E): TOTAL PROD PANEL
          { t: "n", v: r.totalProdPanel },
          // Col 5 (F): GRADE A JML PNL (PROD)
          { t: "n", v: r.gradeA_prod },
          // Col 6 (G): GRADE A % PROD (Formula F/E)
          r.totalProdPanel > 0
            ? {
                t: "n",
                f: `F${excelR}/E${excelR}`,
                v: r.gradeA_prod_pct / 100,
                z: "0.00%",
              }
            : { t: "n", v: 0, z: "0.00%" },
          // Col 7 (H): GRADE A JML PNL (INSPECT)
          isUninspected
            ? { t: "s", v: "-" }
            : { t: "n", v: r.gradeA_inspect },
          // Col 8 (I): GRADE A % INSPECT (Formula H/E)
          isUninspected || r.gradeA_inspect_pct === null
            ? { t: "s", v: "-" }
            : r.totalProdPanel > 0
            ? {
                t: "n",
                f: `H${excelR}/E${excelR}`,
                v: r.gradeA_inspect_pct / 100,
                z: "0.00%",
              }
            : { t: "n", v: 0, z: "0.00%" },
          // Col 9 (J): GRADE B JML PNL (PROD)
          { t: "n", v: r.gradeB_prod },
          // Col 10 (K): GRADE B % PROD (Formula J/E)
          r.totalProdPanel > 0
            ? {
                t: "n",
                f: `J${excelR}/E${excelR}`,
                v: r.gradeB_prod_pct / 100,
                z: "0.00%",
              }
            : { t: "n", v: 0, z: "0.00%" },
          // Col 11 (L): GRADE B JML PNL (INSPECT)
          isUninspected
            ? { t: "s", v: "-" }
            : { t: "n", v: r.gradeB_inspect },
          // Col 12 (M): GRADE B % INSPECT (Formula L/E)
          isUninspected || r.gradeB_inspect_pct === null
            ? { t: "s", v: "-" }
            : r.totalProdPanel > 0
            ? {
                t: "n",
                f: `L${excelR}/E${excelR}`,
                v: r.gradeB_inspect_pct / 100,
                z: "0.00%",
              }
            : { t: "n", v: 0, z: "0.00%" },
        ];

        wsData.push(rowCells);
        currentRow++;
      });

      // Merge NO dan KODE DESIGN jika lebih dari 1 baris
      if (numRows > 1) {
        merges.push({ s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } });
        merges.push({ s: { r: startRow, c: 2 }, e: { r: endRow, c: 2 } });
      }

      // Baris TOTAL Per Desain
      const totalRowIdx = currentRow;
      const totalExcelR = totalRowIdx + 1;
      const startExcelR = startRow + 1;
      const endExcelR = endRow + 1;

      const totalRowCells: any[] = [
        { t: "s", v: `TOTAL · ${grp.designId}` },
        "",
        "",
        "",
        // Col E: Total Prod Panel
        {
          t: "n",
          f: `SUM(E${startExcelR}:E${endExcelR})`,
          v: grp.summary.totalProdPanel,
        },
        // Col F: Total Grade A Prod
        {
          t: "n",
          f: `SUM(F${startExcelR}:F${endExcelR})`,
          v: grp.summary.gradeA_prod,
        },
        // Col G: % Grade A Prod
        grp.summary.totalProdPanel > 0
          ? {
              t: "n",
              f: `F${totalExcelR}/E${totalExcelR}`,
              v: grp.summary.gradeA_prod_pct / 100,
              z: "0.00%",
            }
          : { t: "n", v: 0, z: "0.00%" },
        // Col H: Total Grade A Inspect
        {
          t: "n",
          f: `SUM(H${startExcelR}:H${endExcelR})`,
          v: grp.summary.gradeA_inspect,
        },
        // Col I: % Grade A Inspect
        grp.summary.inspectedCuts === grp.summary.totalPotongan && grp.summary.totalProdPanel > 0
          ? {
              t: "n",
              f: `H${totalExcelR}/E${totalExcelR}`,
              v: grp.summary.gradeA_inspect_pct / 100,
              z: "0.00%",
            }
          : {
              t: "n",
              v: grp.summary.gradeA_inspect_pct / 100,
              z: "0.00%",
            },
        // Col J: Total Grade B Prod
        {
          t: "n",
          f: `SUM(J${startExcelR}:J${endExcelR})`,
          v: grp.summary.gradeB_prod,
        },
        // Col K: % Grade B Prod
        grp.summary.totalProdPanel > 0
          ? {
              t: "n",
              f: `J${totalExcelR}/E${totalExcelR}`,
              v: grp.summary.gradeB_prod_pct / 100,
              z: "0.00%",
            }
          : { t: "n", v: 0, z: "0.00%" },
        // Col L: Total Grade B Inspect
        {
          t: "n",
          f: `SUM(L${startExcelR}:L${endExcelR})`,
          v: grp.summary.gradeB_inspect,
        },
        // Col M: % Grade B Inspect
        grp.summary.inspectedCuts === grp.summary.totalPotongan && grp.summary.totalProdPanel > 0
          ? {
              t: "n",
              f: `L${totalExcelR}/E${totalExcelR}`,
              v: grp.summary.gradeB_inspect_pct / 100,
              z: "0.00%",
            }
          : {
              t: "n",
              v: grp.summary.gradeB_inspect_pct / 100,
              z: "0.00%",
            },
      ];

      wsData.push(totalRowCells);
      merges.push({ s: { r: totalRowIdx, c: 0 }, e: { r: totalRowIdx, c: 3 } });
      currentRow++;

      // Spacer row
      wsData.push([]);
      currentRow++;
    });

    // Grand Total Row (jika lebih dari 1 desain)
    if (groups.length > 1 && summaryData) {
      const grandRowIdx = currentRow;
      wsData.push([
        { t: "s", v: `GRAND TOTAL SELURUH DESAIN (${summaryData.totalPotongan} Potongan)` },
        "",
        "",
        "",
        { t: "n", v: summaryData.totalProdPanel },
        { t: "n", v: summaryData.gradeA_prod },
        { t: "n", v: summaryData.gradeA_prod_pct / 100, z: "0.00%" },
        { t: "n", v: summaryData.gradeA_inspect },
        { t: "n", v: summaryData.gradeA_inspect_pct / 100, z: "0.00%" },
        { t: "n", v: summaryData.gradeB_prod },
        { t: "n", v: summaryData.gradeB_prod_pct / 100, z: "0.00%" },
        { t: "n", v: summaryData.gradeB_inspect },
        { t: "n", v: summaryData.gradeB_inspect_pct / 100, z: "0.00%" },
      ]);
      merges.push({ s: { r: grandRowIdx, c: 0 }, e: { r: grandRowIdx, c: 3 } });
      currentRow++;
    }

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    ws["!merges"] = merges;
    ws["!cols"] = [
      { wch: 6 },  // A: NO
      { wch: 15 }, // B: Tanggal potong
      { wch: 18 }, // C: KODE DESIGN
      { wch: 18 }, // D: NO.POT
      { wch: 12 }, // E: TOTAL PROD PANEL
      { wch: 10 }, // F: JML PNL (A PROD)
      { wch: 10 }, // G: % PROD (A)
      { wch: 10 }, // H: JML PNL (A INSPECT)
      { wch: 11 }, // I: %INSPECT (A)
      { wch: 10 }, // J: JML PNL (B PROD)
      { wch: 10 }, // K: % PROD (B)
      { wch: 10 }, // L: JML PNL (B INSPECT)
      { wch: 11 }, // M: %INSPECT (B)
    ];

    return ws;
  };

  const handleExportCurrentMachine = () => {
    if (filteredGroups.length === 0) return;
    setIsExporting(true);
    setIsExportMenuOpen(false);

    try {
      const wb = xlsx.utils.book_new();
      const ws = buildWorksheetForGroups(filteredGroups, grandSummary);

      xlsx.utils.book_append_sheet(wb, ws, selectedMachine);

      const monthNameFile =
        selectedMonths.length === 12
          ? "1_TAHUN"
          : `BULAN_${selectedMonths.slice().sort((a, b) => Number(a) - Number(b)).join("-")}`;

      xlsx.writeFile(
        wb,
        `LAPORAN_PER_DESIGN_${selectedMachine}_${monthNameFile}_${selectedYear}.xlsx`
      );
    } catch (err: any) {
      alert("Gagal mengunduh file Excel: " + (err.message || "Error"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAllMachines = async () => {
    setIsExporting(true);
    setIsExportingAll(true);
    setIsExportMenuOpen(false);

    try {
      const wb = xlsx.utils.book_new();

      // Ambil data untuk seluruh mesin secara paralel
      const results = await Promise.all(
        REGISTERED_MACHINES.map((mc) =>
          getDesignReportData(
            mc,
            selectedYear,
            selectedMonths,
            selectedDesign,
            includeCrossMonth
          )
        )
      );

      REGISTERED_MACHINES.forEach((mc, idx) => {
        const res = results[idx];
        const groups = res.success && res.data ? res.data : [];
        const summary = res.grandSummary || null;

        const ws = buildWorksheetForGroups(groups, summary);
        xlsx.utils.book_append_sheet(wb, ws, mc);
      });

      const monthNameFile =
        selectedMonths.length === 12
          ? "1_TAHUN"
          : `BULAN_${selectedMonths.slice().sort((a, b) => Number(a) - Number(b)).join("-")}`;

      xlsx.writeFile(
        wb,
        `LAPORAN_PER_DESIGN_SEMUA_MESIN_${monthNameFile}_${selectedYear}.xlsx`
      );
    } catch (err: any) {
      alert("Gagal mengunduh file Excel semua mesin: " + (err.message || "Error"));
    } finally {
      setIsExporting(false);
      setIsExportingAll(false);
    }
  };

  return (
    <div className="p-3 sm:p-5 md:p-8 w-full max-w-[1700px] mx-auto space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* 1. Header Banner */}
      <div className="relative overflow-visible z-40 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-slate-900 via-[#003366] to-[#0070bc] p-4 sm:p-6 shadow-2xl text-white">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner shrink-0">
              <FileSpreadsheet className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white drop-shadow">
                  Laporan Per Design
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Mesin {selectedMachine}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-200 border border-sky-400/30">
                  {selectedMonthsLabel} {selectedYear}
                </span>
              </div>
              <p className="text-white/70 text-xs sm:text-sm font-medium mt-1">
                Perbandingan Grade Produksi vs Hasil Inspeksi & Mending · Pengelompokan Utuh Per Desain (Bisa Multi-Bulan)
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-10 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-40"
              title="Refresh data"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-300" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Export Dropdown Menu */}
            <div className="relative" ref={exportMenuRef}>
              <div className="inline-flex rounded-xl shadow-lg shadow-emerald-950/30 overflow-hidden">
                <button
                  type="button"
                  onClick={handleExportCurrentMachine}
                  disabled={isLoading || isExporting || filteredGroups.length === 0}
                  className="h-10 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-40"
                  title={`Export Excel Mesin ${selectedMachine}`}
                >
                  {isExporting && !isExportingAll ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Export Excel ({selectedMachine})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsExportMenuOpen((prev) => !prev)}
                  disabled={isLoading || isExporting}
                  className="h-10 px-2.5 bg-emerald-700 hover:bg-emerald-600 border-l border-emerald-500/40 text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
                  title="Pilihan Export Excel"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${isExportMenuOpen ? "rotate-180" : ""}`} />
                </button>
              </div>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Format & Pilihan Export Excel
                  </div>

                  <button
                    type="button"
                    onClick={handleExportCurrentMachine}
                    disabled={filteredGroups.length === 0 || isExporting}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors flex items-start gap-2.5 group cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-emerald-600">
                        Mesin {selectedMachine} (Tab Aktif)
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        1 Sheet ({selectedMachine}) dengan rumus persentase & format sheet acuan
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportAllMachines}
                    disabled={isExporting}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors flex items-start gap-2.5 group cursor-pointer mt-1"
                  >
                    {isExportingAll ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#0070bc] mt-0.5 shrink-0" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4 text-[#0070bc] mt-0.5 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-[#0070bc]">
                        Semua Mesin (Multi-Tab Workbook)
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        1 File Excel berisi tab R1, R2, R3B, R11, R12, dll. persis sheet master
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Machine Tabs */}
        <div className="mt-5 pt-4 border-t border-white/15">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-300" />
              Pilih Mesin (Tab Sheet):
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/20">
            {REGISTERED_MACHINES.map((mc) => {
              const isActive = selectedMachine === mc;
              return (
                <button
                  key={mc}
                  type="button"
                  onClick={() => setSelectedMachine(mc)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isActive
                      ? "bg-white text-[#003366] shadow-md shadow-black/20 scale-105"
                      : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                  }`}
                >
                  <span>{mc}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Filter Bar (Multi-Bulan Popover, Tahun, Design, Sort, Search) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 relative z-30">
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Multi-Bulan Popover Selector */}
          <div className="relative" ref={monthPickerRef}>
            <button
              type="button"
              onClick={() => setIsMonthPickerOpen((prev) => !prev)}
              className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-all cursor-pointer"
            >
              <CalendarDays className="w-4 h-4 text-[#0070bc]" />
              <span className="text-slate-500 text-[11px]">Bulan:</span>
              <span className="font-black text-[#0070bc] max-w-[170px] truncate">
                {selectedMonthsLabel}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  isMonthPickerOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu Multi-Bulan */}
            {isMonthPickerOpen && (
              <div className="absolute left-0 top-full mt-2 w-[310px] sm:w-[340px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-3">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
                      Pilih Bulan
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Bisa pilih satu atau gabungan beberapa bulan
                    </p>
                  </div>
                  <button
                    onClick={() => setIsMonthPickerOpen(false)}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={selectAllMonths}
                    className="px-2 py-1.5 text-[10px] font-bold rounded-lg bg-sky-50 dark:bg-sky-950/60 text-[#0070bc] hover:bg-sky-100 transition-all cursor-pointer text-center"
                  >
                    Semua Bulan
                  </button>
                  <button
                    type="button"
                    onClick={selectCurrentMonthOnly}
                    className="px-2 py-1.5 text-[10px] font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition-all cursor-pointer text-center"
                  >
                    Bulan Ini Saja
                  </button>
                  <button
                    type="button"
                    onClick={selectLastThreeMonths}
                    className="px-2 py-1.5 text-[10px] font-bold rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-all cursor-pointer text-center"
                  >
                    3 Bln Terakhir
                  </button>
                </div>

                {/* Grid 12 Bulan */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {MONTH_LIST.map((m) => {
                    const isSelected = selectedMonths.includes(m.value);
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => toggleMonth(m.value)}
                        className={`px-2 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "bg-[#0070bc] text-white shadow-sm shadow-[#0070bc]/30 scale-[1.02]"
                            : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                        }`}
                      >
                        <span>{m.short}</span>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>

                {/* Footer Info */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">
                    Terpilih: <b>{selectedMonths.length} Bulan</b>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsMonthPickerOpen(false)}
                    className="px-3 py-1 rounded-lg bg-[#0070bc] text-white font-bold text-xs hover:bg-[#005a96] transition-all cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Filter Tahun */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-slate-500 text-[11px]">Tahun:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent font-black text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
            >
              {availableYears.map((y) => (
                <option key={y} value={y} className="text-slate-900">
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Design */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-slate-500 text-[11px]">Design:</span>
            <select
              value={selectedDesign}
              onChange={(e) => setSelectedDesign(e.target.value)}
              className="bg-transparent font-black text-slate-800 dark:text-slate-100 outline-none cursor-pointer max-w-[160px] truncate"
            >
              <option value="ALL" className="text-slate-900">
                Semua Design
              </option>
              {availableDesigns.map((d) => (
                <option key={d} value={d} className="text-slate-900">
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Tombol Urutan Nomor Potongan */}
          <button
            type="button"
            onClick={() =>
              setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
            }
            className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-all cursor-pointer select-none"
            title="Klik untuk mengubah arah urutan nomor potongan (Terkecil/Terbesar)"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[#0070bc]" />
            <span className="text-slate-500 text-[11px]">No. Pot:</span>
            <span className="font-black text-[#0070bc]">
              {sortDirection === "asc"
                ? "Terkecil → Terbesar"
                : "Terbesar → Terkecil"}
            </span>
          </button>

          {/* Toggle Lintas Bulan (Cross-Month History) */}
          <button
            type="button"
            onClick={() => setIncludeCrossMonth((prev) => !prev)}
            className={`flex items-center gap-1.5 border px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
              includeCrossMonth
                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 shadow-sm"
                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60"
            }`}
            title="Jika aktif, potongan dari bulan sebelumnya untuk desain yang sama akan otomatis disertakan agar riwayat potongan lengkap"
          >
            <span className="text-slate-500 text-[11px]">Bawa Bln Lalu:</span>
            <span className="font-black">
              {includeCrossMonth ? "Aktif (Otomatis)" : "Mati (Ketat)"}
            </span>
          </button>
        </div>

        {/* Search Potongan */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari No. Pot / Tanggal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#0070bc]/30"
          />
        </div>
      </div>

      {/* 4. KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Desain */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Desain Aktif
            </p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
              {kpiMetrics.totalDesigns}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              {kpiMetrics.totalPot} Total Potongan
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-[#0070bc] flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* Total Panel Produksi */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Panel Produksi
            </p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
              {kpiMetrics.totalPanel.toLocaleString()}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Panel potongan valid
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Grade A Inspect vs Prod */}
        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-4 shadow-sm flex items-center justify-between bg-emerald-50/20">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Grade A (Inspect)
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {kpiMetrics.avgInspA_pct}%
              </h3>
              <span className="text-[11px] font-bold text-slate-400">
                (Prod: {kpiMetrics.avgProdA_pct}%)
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-black mt-0.5 text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+{kpiMetrics.deltaA}% setelah mending</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Grade B Inspect vs Prod */}
        <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 rounded-2xl p-4 shadow-sm flex items-center justify-between bg-rose-50/20">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Grade B (Inspect)
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {kpiMetrics.avgInspB_pct}%
              </h3>
              <span className="text-[11px] font-bold text-slate-400">
                (Prod: {kpiMetrics.avgProdB_pct}%)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Cacat berkurang setelah perbaikan
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center font-bold">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 5. Main Table: Laporan Per Design */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden relative z-10">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-10 h-10 animate-spin text-[#0070bc]" />
            <p className="text-sm font-bold animate-pulse">
              Memproses & menggabungkan data per design untuk {selectedMonthsLabel} {selectedYear}...
            </p>
          </div>
        ) : errorMsg ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Gagal Memuat Data
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              {errorMsg}
            </p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 rounded-xl bg-[#0070bc] text-white text-xs font-bold hover:bg-[#005a96] transition-all cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-slate-700 dark:text-slate-300">
              Tidak Ada Data Ditemukan
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Belum ada data potongan kain untuk mesin <b>{selectedMachine}</b> pada periode <b>{selectedMonthsLabel} {selectedYear}</b>.
            </p>
            {selectedMonths.length < 12 && (
              <button
                onClick={selectAllMonths}
                className="mt-3 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>Lihat Semua Bulan</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                {/* Header Row 1 */}
                <tr className="bg-[#00284d] text-white border-b border-slate-700 text-[11px] font-black uppercase tracking-wider">
                  <th
                    rowSpan={2}
                    className="border border-slate-700 px-3 py-3 w-12 text-center whitespace-nowrap"
                  >
                    NO
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-700 px-3 py-3 text-center min-w-[105px] whitespace-nowrap"
                  >
                    Tanggal<br />potong
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-700 px-4 py-3 text-left min-w-[150px] whitespace-nowrap"
                  >
                    KODE<br />DESIGN
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-700 px-3 py-3 w-16 text-center whitespace-nowrap"
                  >
                    NO.POT
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-700 px-3 py-3 w-20 text-center whitespace-nowrap leading-tight"
                  >
                    TOTAL<br />PROD<br />PANEL
                  </th>

                  {/* Header Hijau: GRADE A */}
                  <th
                    colSpan={4}
                    className="border border-slate-700 px-3 py-2 bg-emerald-700 text-white font-black tracking-widest text-center"
                  >
                    PANEL · GRADE A
                  </th>

                  {/* Header Merah: GRADE B */}
                  <th
                    colSpan={4}
                    className="border border-slate-700 px-3 py-2 bg-rose-700 text-white font-black tracking-widest text-center"
                  >
                    GRADE B
                  </th>
                </tr>

                {/* Header Row 2: Sub-headers */}
                <tr className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                  <th className="border border-slate-700 bg-amber-400 text-slate-900 px-2.5 py-1.5 whitespace-nowrap">
                    JML PNL
                  </th>
                  <th className="border border-slate-700 bg-amber-400 text-slate-900 px-2.5 py-1.5 whitespace-nowrap">
                    % PROD
                  </th>
                  <th className="border border-slate-700 bg-amber-300 text-slate-900 px-2.5 py-1.5 whitespace-nowrap">
                    JML PNL
                  </th>
                  <th className="border border-slate-700 bg-amber-300 text-slate-900 px-2.5 py-1.5 whitespace-nowrap">
                    %INSPECT
                  </th>

                  <th className="border border-slate-700 bg-amber-400 text-slate-900 px-2.5 py-1.5 whitespace-nowrap">
                    JML PNL
                  </th>
                  <th className="border border-slate-700 bg-amber-400 text-slate-900 px-2.5 py-1.5 whitespace-nowrap">
                    % PROD
                  </th>
                  <th className="border border-slate-700 bg-amber-300 text-slate-900 px-2.5 py-1.5 whitespace-nowrap">
                    JML PNL
                  </th>
                  <th className="border border-slate-700 bg-amber-300 text-slate-900 px-2.5 py-1.5 whitespace-nowrap">
                    %INSPECT
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                {filteredGroups.map((grp) => {
                  return (
                    <React.Fragment key={grp.designId}>
                      {grp.rows.map((row, rIdx) => {
                        const isEven = rIdx % 2 === 0;
                        const isFirst = rIdx === 0;
                        const isUninspected = row.status === "UNINSPECTED" || row.gradeA_inspect === null;
                        const isImproved = !isUninspected && row.gradeA_inspect !== null && row.gradeA_inspect > row.gradeA_prod;
                        const delta = !isUninspected && row.gradeA_inspect_pct !== null ? row.gradeA_inspect_pct - row.gradeA_prod_pct : 0;

                        return (
                          <tr
                            key={`${row.designId}_${row.noPot}`}
                            className={`hover:bg-sky-50/70 dark:hover:bg-slate-800/60 transition-colors ${
                              row.isFromEarlierMonth
                                ? "bg-amber-50/30 dark:bg-amber-950/20"
                                : isEven
                                ? "bg-white dark:bg-slate-900"
                                : "bg-slate-50/50 dark:bg-slate-800/30"
                            }`}
                          >
                            {/* NO */}
                            {isFirst ? (
                              <td
                                rowSpan={grp.rows.length}
                                className="border border-slate-200 dark:border-slate-800 px-3 py-2 text-center font-black text-slate-700 dark:text-slate-300 bg-slate-100/40 dark:bg-slate-800/40 align-middle"
                              >
                                {grp.index}
                              </td>
                            ) : null}

                            {/* Tanggal Potong */}
                            <td className="border border-slate-200 dark:border-slate-800 px-3 py-2 text-center font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <span>{row.tanggalPotong}</span>
                                {row.isFromEarlierMonth && (
                                  <span
                                    className="px-1.5 py-0.5 text-[9px] font-black rounded bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                    title={`Potongan dibuat pada bulan ${row.monthBadge || "sebelumnya"} (kelanjutan desain ini)`}
                                  >
                                    {row.monthBadge || "Lalu"}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* KODE DESIGN */}
                            {isFirst ? (
                              <td
                                rowSpan={grp.rows.length}
                                className="border border-slate-200 dark:border-slate-800 px-4 py-2 text-left font-black text-slate-900 dark:text-slate-100 bg-slate-50/60 dark:bg-slate-800/30 align-middle whitespace-nowrap"
                              >
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[#0070bc]" />
                                    <span>{grp.designId}</span>
                                  </div>
                                  {grp.hasCrossMonthRows && (
                                    <span className="inline-flex items-center text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full w-fit">
                                      +{grp.earlierMonthCount} pot. dari bln lalu
                                    </span>
                                  )}
                                </div>
                              </td>
                            ) : null}

                            {/* NO.POT */}
                            <td className="border border-slate-200 dark:border-slate-800 px-3 py-2 text-center font-black text-[#003366] dark:text-sky-300">
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <span>{row.noPot}</span>
                                {row.status === "UNINSPECTED" && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40">
                                    Belum Inspek
                                  </span>
                                )}
                                {row.status === "QC_ONLY" && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/60 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/40">
                                    Tahap QC
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* TOTAL PROD PANEL */}
                            <td className="border border-slate-200 dark:border-slate-800 px-3 py-2 text-center font-black text-slate-800 dark:text-slate-100">
                              {row.totalProdPanel}
                            </td>

                            {/* GRADE A: JML PNL (PROD) */}
                            <td className="border border-slate-200 dark:border-slate-800 px-2.5 py-2 text-center font-bold text-slate-700 dark:text-slate-200">
                              {row.gradeA_prod}
                            </td>

                            {/* GRADE A: % PROD */}
                            <td className="border border-slate-200 dark:border-slate-800 px-2.5 py-2 text-center font-mono text-slate-600 dark:text-slate-300">
                              {formatPct(row.gradeA_prod_pct)}
                            </td>

                            {/* GRADE A: JML PNL (INSPECT) */}
                            <td className="border border-slate-200 dark:border-slate-800 px-2.5 py-2 text-center font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20">
                              {isUninspected || row.gradeA_inspect === null ? (
                                <span className="text-slate-400 font-bold">—</span>
                              ) : (
                                row.gradeA_inspect
                              )}
                            </td>

                            {/* GRADE A: % INSPECT */}
                            <td className="border border-slate-200 dark:border-slate-800 px-2.5 py-2 text-center font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20">
                              {isUninspected || row.gradeA_inspect_pct === null ? (
                                <span className="text-slate-400 font-bold">—</span>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <span>{formatPct(row.gradeA_inspect_pct)}</span>
                                  {isImproved && (
                                    <span
                                      className="text-[9px] text-emerald-600 font-bold"
                                      title={`Kenaikan +${delta.toFixed(1)}%`}
                                    >
                                      ▲
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* GRADE B: JML PNL (PROD) */}
                            <td className="border border-slate-200 dark:border-slate-800 px-2.5 py-2 text-center font-bold text-slate-700 dark:text-slate-200">
                              {row.gradeB_prod}
                            </td>

                            {/* GRADE B: % PROD */}
                            <td className="border border-slate-200 dark:border-slate-800 px-2.5 py-2 text-center font-mono text-slate-600 dark:text-slate-300">
                              {formatPct(row.gradeB_prod_pct)}
                            </td>

                            {/* GRADE B: JML PNL (INSPECT) */}
                            <td
                              className={`border border-slate-200 dark:border-slate-800 px-2.5 py-2 text-center font-black text-rose-700 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-950/20 ${
                                row.gradeB_inspect !== null && row.gradeB_inspect > 15 ? "bg-amber-100/70 font-black" : ""
                              }`}
                            >
                              {isUninspected || row.gradeB_inspect === null ? (
                                <span className="text-slate-400 font-bold">—</span>
                              ) : (
                                row.gradeB_inspect
                              )}
                            </td>

                            {/* GRADE B: % INSPECT */}
                            <td className="border border-slate-200 dark:border-slate-800 px-2.5 py-2 text-center font-mono font-black text-rose-700 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-950/20">
                              {isUninspected || row.gradeB_inspect_pct === null ? (
                                <span className="text-slate-400 font-bold">—</span>
                              ) : (
                                formatPct(row.gradeB_inspect_pct)
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Baris Rekapitulasi / Total Per Desain (Gabungan Seluruh Potongan Desain Ini) */}
                      <tr className="bg-emerald-600/90 text-white font-black text-xs border-y-2 border-emerald-700">
                        <td
                          colSpan={4}
                          className="border border-emerald-700 px-4 py-2.5 text-center tracking-wider uppercase text-emerald-100"
                        >
                          TOTAL · {grp.designId} ({grp.summary.totalPotongan} Potongan)
                        </td>
                        <td className="border border-emerald-700 px-3 py-2.5 text-center text-white text-sm">
                          {grp.summary.totalProdPanel}
                        </td>

                        {/* Total Grade A Prod */}
                        <td className="border border-emerald-700 px-2.5 py-2.5 text-center text-emerald-100">
                          {grp.summary.gradeA_prod}
                        </td>
                        <td className="border border-emerald-700 px-2.5 py-2.5 text-center font-mono text-emerald-100">
                          {formatPct(grp.summary.gradeA_prod_pct)}
                        </td>

                        {/* Total Grade A Inspect */}
                        <td className="border border-emerald-700 px-2.5 py-2.5 text-center text-white text-sm underline decoration-amber-300 decoration-2">
                          {grp.summary.gradeA_inspect}
                        </td>
                        <td className="border border-emerald-700 px-2.5 py-2.5 text-center font-mono text-white text-sm underline decoration-amber-300 decoration-2">
                          {formatPct(grp.summary.gradeA_inspect_pct)}
                        </td>

                        {/* Total Grade B Prod */}
                        <td className="border border-emerald-700 px-2.5 py-2.5 text-center text-emerald-100">
                          {grp.summary.gradeB_prod}
                        </td>
                        <td className="border border-emerald-700 px-2.5 py-2.5 text-center font-mono text-emerald-100">
                          {formatPct(grp.summary.gradeB_prod_pct)}
                        </td>

                        {/* Total Grade B Inspect */}
                        <td className="border border-emerald-700 px-2.5 py-2.5 text-center text-white text-sm">
                          {grp.summary.gradeB_inspect}
                        </td>
                        <td className="border border-emerald-700 px-2.5 py-2.5 text-center font-mono text-white text-sm">
                          {formatPct(grp.summary.gradeB_inspect_pct)}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {/* Grand Total Row */}
                {filteredGroups.length > 1 && grandSummary && (
                  <tr className="bg-slate-900 text-white font-black text-xs border-t-4 border-slate-950">
                    <td
                      colSpan={4}
                      className="border border-slate-800 px-4 py-3 text-center tracking-widest uppercase text-amber-300"
                    >
                      GRAND TOTAL SELURUH DESAIN ({grandSummary.totalPotongan} Potongan)
                    </td>
                    <td className="border border-slate-800 px-3 py-3 text-center text-amber-300 text-sm">
                      {grandSummary.totalProdPanel}
                    </td>

                    {/* Grade A Prod */}
                    <td className="border border-slate-800 px-2.5 py-3 text-center">
                      {grandSummary.gradeA_prod}
                    </td>
                    <td className="border border-slate-800 px-2.5 py-3 text-center font-mono">
                      {formatPct(grandSummary.gradeA_prod_pct)}
                    </td>

                    {/* Grade A Inspect */}
                    <td className="border border-slate-800 px-2.5 py-3 text-center text-emerald-400 text-sm">
                      {grandSummary.gradeA_inspect}
                    </td>
                    <td className="border border-slate-800 px-2.5 py-3 text-center font-mono text-emerald-400 text-sm">
                      {formatPct(grandSummary.gradeA_inspect_pct)}
                    </td>

                    {/* Grade B Prod */}
                    <td className="border border-slate-800 px-2.5 py-3 text-center">
                      {grandSummary.gradeB_prod}
                    </td>
                    <td className="border border-slate-800 px-2.5 py-3 text-center font-mono">
                      {formatPct(grandSummary.gradeB_prod_pct)}
                    </td>

                    {/* Grade B Inspect */}
                    <td className="border border-slate-800 px-2.5 py-3 text-center text-rose-400 text-sm">
                      {grandSummary.gradeB_inspect}
                    </td>
                    <td className="border border-slate-800 px-2.5 py-3 text-center font-mono text-rose-400 text-sm">
                      {formatPct(grandSummary.gradeB_inspect_pct)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Footer Notes */}
      <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#0070bc] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-700 dark:text-slate-300">
            Catatan Pengelompokan Multi-Bulan Laporan Per Design:
          </p>
          <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
            <li>
              <b>Multi-Bulan Tergabung:</b> Jika satu desain berjalan melintasi beberapa bulan (misal September hingga Oktober), seluruh potongannya otomatis <b>disatukan ke dalam 1 tabel kelompok desain</b> dengan total akhir yang terhitung secara akurat.
            </li>
            <li>
              <b>Grade A (Produksi):</b> Jumlah panel normal yang diinput operator tanpa catatan cacat produksi.
            </li>
            <li>
              <b>Grade B (Produksi):</b> Jumlah panel yang memiliki temuan cacat saat diinput operator produksi.
            </li>
            <li>
              <b>Grade A & B (Inspect):</b> Hasil evaluasi final setelah proses inspeksi QC dan perbaikan mending.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
