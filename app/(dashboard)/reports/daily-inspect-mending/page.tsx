"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  FileSpreadsheet,
  Calendar,
  Search,
  RefreshCw,
  Download,
  Filter,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  getDailyInspectMendingReport,
  DailyInspectMendingRow,
} from "@/actions/daily-inspect-mending-actions";

const MACHINES = [
  "ALL",
  "R1",
  "R2",
  "R1C",
  "R2C",
  "R3B",
  "R11",
  "R12",
  "R16",
  "T1C",
  "T2A",
];

export default function DailyInspectMendingPage() {
  const [data, setData] = useState<DailyInspectMendingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [selectedMachine, setSelectedMachine] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await getDailyInspectMendingReport({
        machine: selectedMachine,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: searchQuery || undefined,
      });
      if (res.success) {
        setData(res.data);
      } else {
        console.error("Gagal memuat data:", res.error);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMachine, dateFrom, dateTo]);

  // Handler quick date preset
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "ALL") {
      setDateFrom("");
      setDateTo("");
    } else if (preset === "TODAY") {
      const tStr = formatDate(today);
      setDateFrom(tStr);
      setDateTo(tStr);
    } else if (preset === "YESTERDAY") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yStr = formatDate(y);
      setDateFrom(yStr);
      setDateTo(yStr);
    } else if (preset === "7DAYS") {
      const past = new Date(today);
      past.setDate(past.getDate() - 7);
      setDateFrom(formatDate(past));
      setDateTo(formatDate(today));
    } else if (preset === "THIS_MONTH") {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(formatDate(startOfMonth));
      setDateTo(formatDate(today));
    }
  };

  // Filtered by search client-side for ultra-fast typing response
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase().trim();
    return data.filter(
      (r) =>
        r.nomor_mc.toLowerCase().includes(q) ||
        r.design_id.toLowerCase().includes(q) ||
        String(r.potongan_ke).includes(q) ||
        r.petugas_inspect.toLowerCase().includes(q) ||
        r.petugas_mending.toLowerCase().includes(q) ||
        r.petugas_final.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  // Metrics summary
  const summary = useMemo(() => {
    let totalPanel = 0;
    let totalMeter = 0;
    let inspectedCount = 0;
    let mendedCount = 0;
    let finalCount = 0;

    filteredData.forEach((r) => {
      if (r.qty_panel) totalPanel += r.qty_panel;
      if (r.qty_meter) totalMeter += r.qty_meter;
      if (r.finish_inspect || r.tgl_inspect) inspectedCount++;
      if (r.finish_mending || r.tgl_mending) mendedCount++;
      if (r.finish_final || r.tgl_final) finalCount++;
    });

    return {
      totalRows: filteredData.length,
      totalPanel,
      totalMeter,
      inspectedCount,
      mendedCount,
      finalCount,
    };
  }, [filteredData]);

  // Export to Excel with grouped header layout
  const handleExportExcel = () => {
    if (filteredData.length === 0) return;

    // Build multi-tier header array
    const exportRows: any[] = [
      // Row 1: Title
      ["LAPORAN HARIAN HASIL INSPECT DAN MENDING 2026"],
      [
        `Mesin: ${selectedMachine === "ALL" ? "Semua Mesin" : selectedMachine} | Tanggal Export: ${new Date().toLocaleDateString("id-ID")}`,
      ],
      [], // Empty row
      // Row 4: Top Group Headers
      [
        "NO",
        "DATA POTONG KAIN",
        "",
        "",
        "",
        "",
        "",
        "",
        "DATA INSPEKSI (QC)",
        "",
        "",
        "",
        "DATA MENDING",
        "",
        "",
        "",
        "DATA FINAL",
        "",
        "",
        "",
      ],
      // Row 5: Column Subheaders
      [
        "No",
        "Tgl Potong",
        "Design",
        "Mesin",
        "Potongan Ke",
        "PCS Ke",
        "Qty Panel",
        "Qty Meter",
        "Tgl Inspect",
        "Petugas",
        "Jam Mulai",
        "Jam Selesai",
        "Tgl Mending",
        "Petugas",
        "Jam Mulai",
        "Jam Selesai",
        "Tgl Final",
        "Petugas",
        "Jam Mulai",
        "Jam Selesai",
      ],
    ];

    // Data rows
    filteredData.forEach((r, idx) => {
      exportRows.push([
        idx + 1,
        r.tgl_potong || "-",
        r.design_id || "-",
        r.nomor_mc,
        r.potongan_ke,
        r.pcs_index,
        r.qty_panel !== null ? r.qty_panel : "",
        r.qty_meter !== null ? r.qty_meter : "",
        r.tgl_inspect || "-",
        r.petugas_inspect || "-",
        r.start_inspect || "-",
        r.finish_inspect || "-",
        r.tgl_mending || "-",
        r.petugas_mending || "-",
        r.start_mending || "-",
        r.finish_mending || "-",
        r.tgl_final || "-",
        r.petugas_final || "-",
        r.start_final || "-",
        r.finish_final || "-",
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(exportRows);

    // Merge group header cells
    worksheet["!merges"] = [
      { s: { r: 3, c: 1 }, e: { r: 3, c: 7 } }, // DATA POTONG KAIN
      { s: { r: 3, c: 8 }, e: { r: 3, c: 11 } }, // DATA INSPEKSI (QC)
      { s: { r: 3, c: 12 }, e: { r: 3, c: 15 } }, // DATA MENDING
      { s: { r: 3, c: 16 }, e: { r: 3, c: 19 } }, // DATA FINAL
    ];

    // Set column widths
    worksheet["!cols"] = [
      { wch: 5 }, // No
      { wch: 12 }, // Tgl Potong
      { wch: 15 }, // Design
      { wch: 8 }, // Mesin
      { wch: 10 }, // Pot. Ke
      { wch: 8 }, // PCS Ke
      { wch: 10 }, // Qty Panel
      { wch: 10 }, // Qty Meter
      { wch: 12 }, // Tgl Inspect
      { wch: 18 }, // Petugas Inspect
      { wch: 10 }, // Jam Mulai
      { wch: 10 }, // Jam Selesai
      { wch: 12 }, // Tgl Mending
      { wch: 18 }, // Petugas Mending
      { wch: 10 }, // Jam Mulai
      { wch: 10 }, // Jam Selesai
      { wch: 12 }, // Tgl Final
      { wch: 18 }, // Petugas Final
      { wch: 10 }, // Jam Mulai
      { wch: 10 }, // Jam Selesai
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inspect & Mending Harian");
    XLSX.writeFile(
      workbook,
      `Laporan_Harian_Inspect_Mending_${selectedMachine}_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER CARD - Enterprise Gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-[#003366] to-[#0070bc] p-6 md:p-8 text-white shadow-xl shadow-slate-900/10">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-20 w-48 h-48 rounded-full bg-sky-400/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-sky-200 text-xs font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-sky-300" />
              <span>JURNAL GABUNGAN HARIAN</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-sky-400" />
              Laporan Harian Inspect & Mending
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Rekapitulasi logbook harian menyeluruh dari potong kain, inspeksi (QC), mending, hingga final inspect & mending untuk seluruh mesin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="h-11 px-4 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 text-white font-bold text-xs flex items-center gap-2 backdrop-blur-md transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              <span>Muat Ulang</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredData.length === 0}
              className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Potongan
            </div>
            <div className="text-xl font-black text-slate-800 font-mono">
              {summary.totalRows}{" "}
              <span className="text-xs font-medium text-slate-500">Roll/Pcs</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Volume Produksi
            </div>
            <div className="text-lg font-black text-slate-800 font-mono flex items-center gap-2">
              <span>{summary.totalPanel} <span className="text-xs font-semibold text-slate-500">Pnl</span></span>
              <span className="text-slate-300">|</span>
              <span>{summary.totalMeter} <span className="text-xs font-semibold text-slate-500">Mtr</span></span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Inspeksi (QC)
            </div>
            <div className="text-xl font-black text-indigo-700 font-mono">
              {summary.inspectedCount}{" "}
              <span className="text-xs font-medium text-slate-500">
                / {summary.totalRows} Selesai
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Mending & Final
            </div>
            <div className="text-xl font-black text-teal-700 font-mono">
              {summary.mendedCount}{" "}
              <span className="text-xs font-medium text-slate-500">
                Mnd · {summary.finalCount} Fnl
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        {/* Machine Pill Buttons */}
        <div>
          <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Pilih Mesin</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MACHINES.map((mc) => {
              const active = selectedMachine === mc;
              return (
                <button
                  key={mc}
                  type="button"
                  onClick={() => setSelectedMachine(mc)}
                  className={`h-9 px-3.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                    active
                      ? "bg-[#003366] text-white shadow-md shadow-blue-950/20 scale-102"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  {mc === "ALL" ? "Semua Mesin" : mc}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Filter & Search Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { id: "ALL", label: "Semua" },
                { id: "TODAY", label: "Hari Ini" },
                { id: "YESTERDAY", label: "Kemarin" },
                { id: "7DAYS", label: "7 Hari" },
                { id: "THIS_MONTH", label: "Bulan Ini" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleDatePresetChange(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    datePreset === p.id
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Date Range */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDatePreset("CUSTOM");
                  setDateFrom(e.target.value);
                }}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-hidden focus:border-indigo-500"
              />
              <span className="text-slate-400 font-bold text-xs">s/d</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDatePreset("CUSTOM");
                  setDateTo(e.target.value);
                }}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari design, potongan, petugas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-hidden focus:border-indigo-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* TABLE CONTAINER */}
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
            <div className="text-sm font-black text-slate-700">
              Memuat Data Laporan Harian...
            </div>
            <div className="text-xs text-slate-400">
              Menggabungkan data potong, inspeksi, mending, dan final
            </div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
            <div className="text-base font-black text-slate-800">
              Tidak Ada Data Ditemukan
            </div>
            <div className="text-xs text-slate-500 max-w-sm mx-auto">
              Tidak ada data yang sesuai dengan filter mesin ({selectedMachine}) atau rentang tanggal yang dipilih.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[1360px]">
              {/* TWO-TIER MULTI-LEVEL HEADER */}
              <thead>
                {/* TIER 1: GROUP HEADERS */}
                <tr className="text-white text-center font-black tracking-wider text-[11px] select-none">
                  <th className="bg-slate-900 border-r border-b border-slate-700 py-2.5 px-3 w-12" rowSpan={2}>
                    NO
                  </th>
                  <th
                    colSpan={7}
                    className="bg-[#003366] border-r border-b border-blue-900/60 py-2.5 px-4 tracking-wider uppercase"
                  >
                    DATA POTONG KAIN
                  </th>
                  <th
                    colSpan={4}
                    className="bg-[#1e40af] border-r border-b border-indigo-900/60 py-2.5 px-4 tracking-wider uppercase"
                  >
                    DATA INSPEKSI (QC)
                  </th>
                  <th
                    colSpan={4}
                    className="bg-[#0f766e] border-r border-b border-teal-900/60 py-2.5 px-4 tracking-wider uppercase"
                  >
                    DATA MENDING
                  </th>
                  <th
                    colSpan={4}
                    className="bg-[#334155] border-b border-slate-700 py-2.5 px-4 tracking-wider uppercase"
                  >
                    DATA FINAL
                  </th>
                </tr>

                {/* TIER 2: COLUMN HEADERS */}
                <tr className="bg-slate-100 text-slate-700 font-black text-[10px] tracking-wider uppercase border-b-2 border-slate-300 select-none">
                  {/* Potong Kain Columns */}
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Tgl Potong</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Design</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Mesin</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Pot. Ke</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">PCS Ke</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Qty Pnl</th>
                  <th className="py-2.5 px-3 border-r-2 border-slate-400 text-center">Qty Mtr</th>

                  {/* Inspect Columns */}
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Tgl Inspect</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Petugas</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Jam Mulai</th>
                  <th className="py-2.5 px-3 border-r-2 border-slate-400 text-center">Jam Selesai</th>

                  {/* Mending Columns */}
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Tgl Mending</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Petugas</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Jam Mulai</th>
                  <th className="py-2.5 px-3 border-r-2 border-slate-400 text-center">Jam Selesai</th>

                  {/* Final Columns */}
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Tgl Final</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Petugas</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Jam Mulai</th>
                  <th className="py-2.5 px-3 text-center">Jam Selesai</th>
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                {filteredData.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-sky-50/70 transition-colors ${
                        isEven ? "bg-white" : "bg-slate-50/50"
                      }`}
                    >
                      {/* No */}
                      <td className="py-3 px-3 text-center font-bold text-slate-500 border-r border-slate-200">
                        {idx + 1}
                      </td>

                      {/* DATA POTONG */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {row.tgl_potong || "-"}
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {row.design_id || "-"}
                      </td>
                      <td className="py-3 px-3 text-center border-r border-slate-200">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-black font-mono text-[11px]">
                          {row.nomor_mc}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-[#0070bc] border-r border-slate-200">
                        {row.potongan_ke}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 border-r border-slate-200">
                        {row.pcs_index}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 border-r border-slate-200">
                        {row.qty_panel !== null ? row.qty_panel : "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 border-r-2 border-slate-400">
                        {row.qty_meter !== null ? `${row.qty_meter}` : "-"}
                      </td>

                      {/* DATA INSPECT */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {row.tgl_inspect || "-"}
                      </td>
                      <td className="py-3 px-3 font-bold text-indigo-900 border-r border-slate-200 whitespace-nowrap">
                        {row.petugas_inspect || "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600 border-r border-slate-200">
                        {row.start_inspect || "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600 border-r-2 border-slate-400">
                        {row.finish_inspect || "-"}
                      </td>

                      {/* DATA MENDING */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {row.tgl_mending || "-"}
                      </td>
                      <td className="py-3 px-3 font-bold text-teal-900 border-r border-slate-200 whitespace-nowrap">
                        {row.petugas_mending || "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600 border-r border-slate-200">
                        {row.start_mending || "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600 border-r-2 border-slate-400">
                        {row.finish_mending || "-"}
                      </td>

                      {/* DATA FINAL */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {row.tgl_final || "-"}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800 border-r border-slate-200 whitespace-nowrap">
                        {row.petugas_final || "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600 border-r border-slate-200">
                        {row.start_final || "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600">
                        {row.finish_final || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
