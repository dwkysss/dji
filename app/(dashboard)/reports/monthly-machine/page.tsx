"use client";

import { useState, useEffect } from "react";
import { getMonthlyMachineReport, MonthlyMachineReportData } from "@/actions/report-actions";
import { getMachineStatuses } from "@/actions/dashboard-actions";
import { FileSpreadsheet, Loader2, Calendar, Monitor, AlertCircle, ArrowLeft, CloudUpload, X, Info, CheckCircle2 } from "lucide-react";
import Link from "next/link";

// Helper to format seconds as HH:MM:SS
const formatHHMMSS = (totalSec: number) => {
  if (!totalSec || totalSec <= 0) return "00:00:00";
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return [hours, minutes, seconds]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
};

export default function MonthlyMachineReportPage() {
  const [machines, setMachines] = useState<string[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  const [reportData, setReportData] = useState<MonthlyMachineReportData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMeterMachine, setIsMeterMachine] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Modal State for Keterangan
  const [modalData, setModalData] = useState<{ isOpen: boolean; title: string; contentObj: Record<string, string[]> | null }>({
    isOpen: false,
    title: "",
    contentObj: null,
  });

  useEffect(() => {
    // Fetch available machines
    const fetchMachines = async () => {
      const res = await getMachineStatuses();
      if (res.success && res.data) {
        const mcList = res.data.map(m => m.mesin_id).sort();
        setMachines(mcList);
        if (mcList.length > 0) {
          setSelectedMachine(mcList[0]);
        }
      } else {
        // Fallback
        setMachines(["R1", "R2", "R3B", "R1C", "R2C", "R11", "R12", "R16", "T1C", "T2A"]);
        setSelectedMachine("R1");
      }
    };
    fetchMachines();
  }, []);

  useEffect(() => {
    if (selectedMachine && selectedMonth && selectedYear) {
      loadReportData();
    }
  }, [selectedMachine, selectedMonth, selectedYear]);

  const loadReportData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getMonthlyMachineReport(selectedMonth, selectedYear, selectedMachine);
      if (res.success && res.data) {
        setReportData(res.data);
        setIsMeterMachine(res.isMeterMachine || false);
      } else {
        setError(res.error || "Gagal mengambil laporan.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };


  const syncToGoogleSheets = async () => {
    setIsSyncing(true);
    try {
      const sheetUrl = process.env.NEXT_PUBLIC_REPORT_GOOGLE_SHEET_URL;
      if (!sheetUrl) {
        setToast({
          type: "error",
          title: "Konfigurasi URL Belum Ada",
          message: "URL Google Sheets belum diatur di .env (NEXT_PUBLIC_REPORT_GOOGLE_SHEET_URL)",
        });
        return;
      }

      const wsData: any[][] = [];
      const headerRow1 = [
        "Tanggal", "Desain", "Keterangan", isMeterMachine ? "Pick" : "Courses", "RPM", "Eff 100%", 
        "Team", "Nama Operator", "Hasil Produksi", "Persentase dari 100%",
        "Jumlah Cacat", "Persentase Cacat", 
        "KODE TINDAKAN", "", "", "", "", "", "", "", 
        "Downtime (Detik)", "Persentase Waktu Efektif"
      ];
      const headerRow2 = [
        "", "", "", "", "", "", 
        "", "", "", "",
        "", "", 
        "A", "B", "C", "D", "E", "F", "G", "H",
        "", ""
      ];
      wsData.push(headerRow1);
      wsData.push(headerRow2);
      
      const shiftDurationSecs = 28800;
      
      reportData.forEach((dayData) => {
        const teamsToRender = dayData.orderedTeams || [
          { teamName: "A", data: dayData.teamData["A"] },
          { teamName: "B", data: dayData.teamData["B"] },
          { teamName: "C", data: dayData.teamData["C"] },
        ];
        teamsToRender.forEach((teamObj, idx) => {
          const isFirst = idx === 0;
          const team = teamObj.teamName;
          const td = teamObj.data;
          
          const p100 = td.hasil_produksi > 0 && td.eff_100 > 0 ? ((td.hasil_produksi / td.eff_100) * 100).toFixed(2) + "%" : "0.00%";
          const pCacat = td.jumlah_cacat > 0 && td.hasil_produksi > 0 ? ((td.jumlah_cacat / td.hasil_produksi) * 100).toFixed(2) + "%" : "0.00%";
          const pEff = ((shiftDurationSecs - td.downtime_detik) / shiftDurationSecs * 100).toFixed(2) + "%";
          
          let ketString = "";
          if (td.keterangan_per_kategori) {
            ketString = Object.entries(td.keterangan_per_kategori)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([kat, details]) => {
                const counts: Record<string, number> = {};
                (details as string[]).forEach((d) => {
                  const key = d?.trim() || "Detail umum";
                  counts[key] = (counts[key] || 0) + 1;
                });
                const formatted = Object.entries(counts).map(([d, cnt]) => cnt > 1 ? `${d} (${cnt}x)` : d);
                return formatted.length > 0 ? `[${kat}] ${formatted.join(", ")}` : `[${kat}]`;
              }).join(" | ");
          }

          wsData.push([
            isFirst ? dayData.tanggal : "",
            td.desain || "",
            ketString,
            td.courses || "",
            td.rpm || "",
            td.eff_100 || "",
            team,
            td.operator_name,
            td.hasil_produksi,
            p100,
            td.jumlah_cacat,
            pCacat,
            td.kode_tindakan["A"] || 0,
            td.kode_tindakan["B"] || 0,
            td.kode_tindakan["C"] || 0,
            td.kode_tindakan["D"] || 0,
            td.kode_tindakan["E"] || 0,
            td.kode_tindakan["F"] || 0,
            td.kode_tindakan["G"] || 0,
            td.kode_tindakan["H"] || 0,
            formatHHMMSS(td.downtime_detik),
            pEff
          ]);
        });
      });

      const response = await fetch(sheetUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ 
          action: "sync_monthly_report", 
          machine: selectedMachine,
          sheetName: selectedMachine,
          month: selectedMonth,
          year: selectedYear,
          data: wsData 
        }),
      });

      if (!response.ok) throw new Error("Gagal terhubung ke Google Sheets API.");
      setToast({
        type: "success",
        title: "Sinkronisasi Berhasil",
        message: `Sukses sinkronisasi laporan ${selectedMachine} ke Google Sheets!`,
      });
    } catch (err: any) {
      setToast({
        type: "error",
        title: "Sinkronisasi Gagal",
        message: err.message || "Terjadi kesalahan saat terhubung ke Google Sheets.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const exportToExcel = () => {
    import("xlsx").then((XLSX) => {
      const wb = XLSX.utils.book_new();
      const wsData: any[][] = [];
      
      // Main Headers
      const headerRow1 = [
        "Tanggal", "Desain", "Keterangan", isMeterMachine ? "Pick" : "Courses", "RPM", "Eff 100%", 
        "Team", "Nama Operator", "Hasil Produksi", "Persentase dari 100%",
        "Jumlah Cacat", "Persentase Cacat", 
        "KODE TINDAKAN", "", "", "", "", "", "", "", 
        "Downtime (HH:MM:SS)", "Persentase Waktu Efektif"
      ];
      const headerRow2 = [
        "", "", "", "", "", "", 
        "", "", "", "",
        "", "", 
        "A", "B", "C", "D", "E", "F", "G", "H",
        "", ""
      ];
      wsData.push(headerRow1);
      wsData.push(headerRow2);
      
      const shiftDurationSecs = 28800;
      
      reportData.forEach((dayData) => {
        const teamsToRender = dayData.orderedTeams || [
          { teamName: "A", data: dayData.teamData["A"] },
          { teamName: "B", data: dayData.teamData["B"] },
          { teamName: "C", data: dayData.teamData["C"] },
        ];
        teamsToRender.forEach((teamObj, idx) => {
          const isFirst = idx === 0;
          const team = teamObj.teamName;
          const td = teamObj.data;
          
          const p100 = td.hasil_produksi > 0 && td.eff_100 > 0 ? ((td.hasil_produksi / td.eff_100) * 100).toFixed(2) + "%" : "0.00%";
          const pCacat = td.jumlah_cacat > 0 && td.hasil_produksi > 0 ? ((td.jumlah_cacat / td.hasil_produksi) * 100).toFixed(2) + "%" : "0.00%";
          const pEff = ((shiftDurationSecs - td.downtime_detik) / shiftDurationSecs * 100).toFixed(2) + "%";
          
          let ketString = "";
          if (td.keterangan_per_kategori) {
            ketString = Object.entries(td.keterangan_per_kategori)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([kat, details]) => {
                const counts: Record<string, number> = {};
                (details as string[]).forEach((d) => {
                  const key = d?.trim() || "Detail umum";
                  counts[key] = (counts[key] || 0) + 1;
                });
                const formatted = Object.entries(counts).map(([d, cnt]) => cnt > 1 ? `${d} (${cnt}x)` : d);
                return formatted.length > 0 ? `[${kat}] ${formatted.join(", ")}` : `[${kat}]`;
              }).join(" | ");
          }

          const row = [
            isFirst ? dayData.tanggal : "",
            td.desain || "",
            ketString,
            td.courses || "",
            td.rpm || "",
            td.eff_100 || "",
            team,
            td.operator_name,
            td.hasil_produksi,
            p100,
            td.jumlah_cacat,
            pCacat,
            td.kode_tindakan["A"] || 0,
            td.kode_tindakan["B"] || 0,
            td.kode_tindakan["C"] || 0,
            td.kode_tindakan["D"] || 0,
            td.kode_tindakan["E"] || 0,
            td.kode_tindakan["F"] || 0,
            td.kode_tindakan["G"] || 0,
            td.kode_tindakan["H"] || 0,
            formatHHMMSS(td.downtime_detik),
            pEff
          ];
          wsData.push(row);
        });
      });
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      const colWidths = [
        { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
        { wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 20 }
      ];
      ws['!cols'] = colWidths;
      
      const merges = [];
      // Header merges
      merges.push({ s: { r: 0, c: 12 }, e: { r: 0, c: 19 } }); // KODE TINDAKAN span 8 cols
      for (let c = 0; c < 22; c++) {
        if (c < 12 || c > 19) {
          merges.push({ s: { r: 0, c: c }, e: { r: 1, c: c } }); // Vertical merge for others
        }
      }

      let startRow = 2; // Data starts at row index 2
      for (let i = 0; i < reportData.length; i++) {
        merges.push({ s: { r: startRow, c: 0 }, e: { r: startRow + 2, c: 0 } });
        startRow += 3;
      }
      ws['!merges'] = merges;
      
      XLSX.utils.book_append_sheet(wb, ws, selectedMachine);
      const fileName = `Laporan_Bulanan_${selectedMachine}_${selectedMonth}_${selectedYear}.xlsx`;
      XLSX.writeFile(wb, fileName);
    });
  };


  const months = [
    { value: 1, label: "Januari" }, { value: 2, label: "Februari" }, { value: 3, label: "Maret" },
    { value: 4, label: "April" }, { value: 5, label: "Mei" }, { value: 6, label: "Juni" },
    { value: 7, label: "Juli" }, { value: 8, label: "Agustus" }, { value: 9, label: "September" },
    { value: 10, label: "Oktober" }, { value: 11, label: "November" }, { value: 12, label: "Desember" }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const shiftDurationSecs = 28800; // 8 hours

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans pb-24">
      {/* Header */}
      <div className="max-w-[1400px] mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <Link href="/dashboard" className="hover:text-slate-800 transition-colors flex items-center gap-1 text-sm font-semibold">
                <ArrowLeft className="w-4 h-4" /> Kembali
              </Link>
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center shadow-inner">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              Laporan Bulanan Mesin
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Laporan rekapitulasi produksi dan cacat per bulan untuk masing-masing mesin.</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
              <Monitor className="w-4 h-4 text-slate-400" />
              <select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer min-w-[80px]"
              >
                {machines.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
              >
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <span className="text-slate-300 font-bold">/</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            
            <button 
              onClick={loadReportData}
              disabled={isLoading}
              className="bg-sky-600 hover:bg-sky-700 text-white p-2.5 rounded-xl shadow-md transition-all flex items-center justify-center min-w-[44px]"
              title="Tampilkan Data"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Monitor className="w-5 h-5" />}
            </button>
            <button
              onClick={syncToGoogleSheets}
              disabled={isSyncing || reportData.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 px-4 rounded-xl shadow-md transition-all flex items-center gap-2 font-bold text-sm disabled:opacity-50"
              title="Sync ke Google Sheets"
            >
              {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CloudUpload className="w-5 h-5" />}
              <span className="hidden lg:inline">Sync ke Sheet</span>
            </button>
            <button
              onClick={exportToExcel}
              disabled={isLoading || reportData.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 px-4 rounded-xl shadow-md transition-all flex items-center gap-2 font-bold text-sm disabled:opacity-50"
              title="Download Excel"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 font-semibold animate-fadeIn">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden relative">
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-[#e67e22]/20 to-orange-50 px-6 py-4 border-b border-orange-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="px-5 py-2 bg-[#e67e22] text-white font-black text-xl rounded-lg shadow-sm">
                {selectedMachine}
              </div>
              <div className="text-sm font-bold text-slate-600">
                01/{selectedMonth.toString().padStart(2, '0')}/{selectedYear} - {new Date(selectedYear, selectedMonth, 0).getDate()}/{selectedMonth.toString().padStart(2, '0')}/{selectedYear}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto custom-scrollbar relative min-h-[400px]">
            {isLoading && (
              <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
                  <p className="font-bold text-slate-500 text-sm animate-pulse">Menyusun Laporan...</p>
                </div>
              </div>
            )}
            
            <table className="w-full border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-slate-100/80 text-[10px] font-black text-slate-700 uppercase tracking-widest text-center">
                  <th className="border border-slate-300 p-2 min-w-[40px] sticky left-0 bg-slate-100/90 z-20">Tanggal</th>
                  <th className="border border-slate-300 p-2 min-w-[100px]">Desain</th>
                  <th className="border border-slate-300 p-2 min-w-[120px]">Keterangan</th>
                  <th className="border border-slate-300 p-2 min-w-[70px]">{isMeterMachine ? "Pick" : "Courses"}</th>
                  <th className="border border-slate-300 p-2 min-w-[60px]">RPM</th>
                  <th className="border border-slate-300 p-2 min-w-[60px]">Eff 100%</th>
                  <th className="border border-slate-300 p-2 min-w-[50px] bg-sky-50">Team</th>
                  <th className="border border-slate-300 p-2 min-w-[120px]">Nama Operator</th>
                  <th className="border border-slate-300 p-2 min-w-[70px]">Hasil Produksi</th>
                  <th className="border border-slate-300 p-2 min-w-[80px]">Persentase dari 100%</th>
                  <th className="border border-slate-300 p-2 min-w-[70px]">Jumlah Cacat</th>
                  <th className="border border-slate-300 p-2 min-w-[80px]">Persentase Cacat</th>
                  <th colSpan={8} className="border border-slate-300 p-1 bg-amber-50">Kode Tindakan</th>
                  <th className="border border-slate-300 p-2 min-w-[100px]">Downtime (HH:MM:SS)</th>
                  <th className="border border-slate-300 p-2 min-w-[90px]">Persentase Waktu Efektif</th>
                </tr>
                <tr className="bg-slate-100/60 text-[10px] font-bold text-slate-600 text-center">
                  <th colSpan={12} className="border border-slate-300"></th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">A</th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">B</th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">C</th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">D</th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">E</th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">F</th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">G</th>
                  <th className="border border-slate-300 p-1 w-8 bg-amber-50/50">H</th>
                  <th colSpan={2} className="border border-slate-300"></th>
                </tr>
              </thead>
              <tbody className="text-[11px] font-semibold text-slate-700 bg-white">
                {reportData.map((dayData) => {
                  const teamsToRender = dayData.orderedTeams || [
                    { teamName: "A", data: dayData.teamData["A"] },
                    { teamName: "B", data: dayData.teamData["B"] },
                    { teamName: "C", data: dayData.teamData["C"] },
                  ];
                  return teamsToRender.map((teamObj, idx) => {
                    const isFirst = idx === 0;
                    const team = teamObj.teamName;
                    const td = teamObj.data;
                    
                    const p100 = td.hasil_produksi > 0 && td.eff_100 > 0 ? ((td.hasil_produksi / td.eff_100) * 100).toFixed(2) + "%" : "0.00%";
                    const pCacat = td.jumlah_cacat > 0 && td.hasil_produksi > 0 ? ((td.jumlah_cacat / td.hasil_produksi) * 100).toFixed(2) + "%" : "0.00%";
                    const pEff = ((shiftDurationSecs - td.downtime_detik) / shiftDurationSecs * 100).toFixed(2) + "%";

                    // The background color for Team cell in excel is often light orange for empty or plain.
                    // We'll alternate slightly for rows to look like the image.
                    const rowBgClass = team === "B" ? "bg-[#fdf9f4]" : (team === "C" ? "bg-[#faf5ec]" : "bg-white");
                    
                    let ketString = "";
                    if (td.keterangan_per_kategori) {
                      ketString = Object.entries(td.keterangan_per_kategori)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([kat, details]) => {
                          const counts: Record<string, number> = {};
                          (details as string[]).forEach((d) => {
                            const key = d?.trim() || "Detail umum";
                            counts[key] = (counts[key] || 0) + 1;
                          });
                          const formatted = Object.entries(counts).map(([d, cnt]) => cnt > 1 ? `${d} (${cnt}x)` : d);
                          return formatted.length > 0 ? `[${kat}] ${formatted.join(", ")}` : `[${kat}]`;
                        }).join(" | ");
                    }

                    return (
                      <tr key={`${dayData.tanggal}-${team}`} className={`${rowBgClass} hover:bg-sky-50/50 transition-colors`}>
                        {isFirst && (
                          <td rowSpan={3} className="border border-slate-300 p-2 text-center sticky left-0 bg-slate-50 z-10">{dayData.tanggal}</td>
                        )}
                        <td className="border border-slate-300 p-2 text-center font-bold text-slate-800">{td.desain || ""}</td>
                        <td className="border border-slate-300 p-2 text-center text-slate-500 text-xs">
                          {Object.keys(td.keterangan_per_kategori || {}).length > 0 ? (
                            <button
                              onClick={() => setModalData({ isOpen: true, title: `Keterangan (Tgl ${dayData.tanggal} Tim ${team})`, contentObj: td.keterangan_per_kategori! })}
                              className="w-full text-left truncate max-w-[120px] hover:text-sky-600 transition-colors group relative flex items-center justify-between"
                            >
                              <span className="truncate">{ketString}</span>
                              <Info className="w-3 h-3 ml-1 shrink-0 opacity-50 group-hover:opacity-100" />
                            </button>
                          ) : ""}
                        </td>
                        <td className="border border-slate-300 p-1.5 text-center bg-slate-50/50 font-medium">{td.courses || ""}</td>
                        <td className="border border-slate-300 p-1.5 text-center bg-slate-50/50 font-medium">{td.rpm || ""}</td>
                        <td className="border border-slate-300 p-1.5 text-center bg-slate-50/50 font-medium">{td.eff_100 || ""}</td>
                        <td className="border border-slate-300 p-1.5 text-center font-black text-slate-500 bg-slate-50/50">{team}</td>
                        <td className="border border-slate-300 p-1.5 px-3 truncate max-w-[120px]">{td.operator_name}</td>
                        <td className="border border-slate-300 p-1.5 text-center bg-sky-50/30">{td.hasil_produksi}</td>
                        <td className="border border-slate-300 p-1.5 text-center font-medium">{p100}</td>
                        <td className="border border-slate-300 p-1.5 text-center bg-rose-50/40 text-rose-700">{td.jumlah_cacat}</td>
                        <td className="border border-slate-300 p-1.5 text-center text-rose-600 font-medium">{pCacat}</td>
                        
                        {/* KODE TINDAKAN */}
                        {["A", "B", "C", "D", "E", "F", "G", "H"].map(k => (
                          <td key={k} className="border border-slate-300 p-1 text-center text-slate-500">
                            {td.kode_tindakan[k] || 0}
                          </td>
                        ))}
                        
                        <td className="border border-slate-300 p-1.5 text-center text-orange-600 bg-orange-50/30 font-bold whitespace-nowrap">{formatHHMMSS(td.downtime_detik)}</td>
                        <td className="border border-slate-300 p-1.5 text-center font-bold text-emerald-600">{pEff}</td>
                      </tr>
                    );
                  });
                })}

                {reportData.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={24} className="p-8 text-center text-slate-500 font-semibold">
                      Belum ada data untuk bulan dan mesin ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal for Keterangan */}
      {modalData.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-slate-100 animate-scaleUp">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <h3 className="font-bold text-slate-800">{modalData.title}</h3>
              <button 
                onClick={() => setModalData({ ...modalData, isOpen: false })}
                className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              {modalData.contentObj && Object.entries(modalData.contentObj).length > 0 ? (
                <div className="flex flex-col gap-4">
                  {Object.entries(modalData.contentObj).sort(([a], [b]) => a.localeCompare(b)).map(([kat, details]) => (
                    <div key={kat} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="font-black text-slate-700 text-sm mb-2 flex items-center gap-2">
                        <span className="bg-amber-100 text-amber-700 w-6 h-6 flex items-center justify-center rounded-md font-bold">{kat}</span>
                        <span>Kategori {kat}</span>
                      </div>
                      {details.length > 0 ? (
                        <ul className="space-y-2">
                          {(() => {
                            const counts: Record<string, number> = {};
                            (details as string[]).forEach((d) => {
                              const key = d?.trim() || "Detail umum";
                              counts[key] = (counts[key] || 0) + 1;
                            });
                            return Object.entries(counts).map(([d, cnt], i) => (
                              <li key={i} className="flex items-center justify-between text-xs text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200/80 shadow-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                  <span className="font-medium text-slate-800">{d}</span>
                                </div>
                                <span className={`font-extrabold px-2 py-0.5 rounded-md text-[11px] border shrink-0 ${cnt > 1 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                  {cnt}x kejadian
                                </span>
                              </li>
                            ));
                          })()}
                        </ul>
                      ) : (
                        <p className="text-slate-400 text-sm italic">Tidak ada detail spesifik.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic text-center py-4">Tidak ada keterangan.</p>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50 shrink-0">
              <button
                onClick={() => setModalData({ ...modalData, isOpen: false })}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Modern Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3.5 bg-slate-900/95 text-white px-5 py-4 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md animate-fadeIn max-w-md">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              toast.type === "success"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : toast.type === "error"
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : toast.type === "error" ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <Info className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-white tracking-wide uppercase">
              {toast.title}
            </h4>
            <p className="text-xs font-medium text-slate-300 mt-0.5 leading-relaxed break-words">
              {toast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
