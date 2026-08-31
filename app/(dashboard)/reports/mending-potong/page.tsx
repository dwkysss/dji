"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getMendingReportOptions, getMendingReportData } from "@/actions/mending-actions";
import { REGISTERED_MACHINES } from "@/lib/constants";
import { 
  syncPotongKainToGoogleSheet, 
  syncAllPotongKainMachines, 
  getPotongKainScheduleSettings, 
  updatePotongKainScheduleSettings,
  getPotongKainSyncStatus,
  unmarkPotongKainSynced,
  resetPotongKainSyncStatus
} from "@/actions/google-sheet-actions";
import { 
  FileSpreadsheet, 
  Search, 
  Loader2, 
  AlertTriangle, 
  Download,
  Filter,
  Monitor,
  RotateCw,
  RotateCcw,
  Check,
  Calendar,
  CloudUpload,
  Zap,
  Clock,
  Settings,
  ShieldCheck,
  CheckCircle2,
  X,
  Info
} from "lucide-react";
import * as xlsx from "xlsx";

export default function LaporanPotongKainPage() {
  const [options, setOptions] = useState<{ mesins: string[] }>({ mesins: [] });
  const [filters, setFilters] = useState({ nomor_mc: "R1", tahun: new Date().getFullYear().toString() });
  
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync & Schedule States
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("17:00");
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleSafeMode, setScheduleSafeMode] = useState(true);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleMachines, setScheduleMachines] = useState<string[]>([...REGISTERED_MACHINES]); // default semua mesin

  // Single Machine Sync Modal
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSafeMode, setSyncSafeMode] = useState(true);

  // All Machines Sync Modal
  const [isSyncAllModalOpen, setIsSyncAllModalOpen] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncAllResults, setSyncAllResults] = useState<any[] | null>(null);

  // Per-potongan Sync Status (Opsi 2: Status Flag & Trial Mode)
  const [syncedKeys, setSyncedKeys] = useState<string[]>([]);
  const [isUnsyncingKey, setIsUnsyncingKey] = useState<string | null>(null);
  const [isResettingSync, setIsResettingSync] = useState(false);
  const [syncOnlyUnsynced, setSyncOnlyUnsynced] = useState(true);

  // Toast Notification
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);

  const loadSyncStatus = async (mc: string) => {
    try {
      const res = await getPotongKainSyncStatus(mc);
      if (res.success) {
        setSyncedKeys(res.syncedKeys || []);
      }
    } catch {}
  };

  // Load Schedule Settings on Mount
  useEffect(() => {
    getPotongKainScheduleSettings().then((res) => {
      if (res.success) {
        setScheduleTime(res.time);
        setScheduleEnabled(res.enabled);
        setScheduleSafeMode(res.safeMode);
      }
    }).catch(() => {});
  }, []);

  const fetchReportData = async (mc: string, year: string) => {
    if (!mc) {
      setErrorMsg("Pilih Nomor Mesin terlebih dahulu.");
      return;
    }
    
    setIsLoading(true);
    setErrorMsg(null);
    setHasSearched(true);
    
    // Ambil status sync untuk mesin ini
    loadSyncStatus(mc);
    
    try {
      const res = await getMendingReportData(mc);
      if (res.success && res.data) {
        const filteredByYear = res.data.filter((d: any) => {
          if (!year) return true;
          const tgl = d.header?.tanggal_potong || d.header?.tgl || d.tanggal_mending;
          if (!tgl) return false;
          return tgl.startsWith(year);
        });
        
        setData(filteredByYear);
        if (filteredByYear.length === 0) {
          setErrorMsg("Tidak ada data ditemukan untuk mesin ini pada tahun terpilih.");
        }
      } else {
        setErrorMsg(res.error || "Gagal mengambil data laporan.");
        setData([]);
      }
    } catch (err: any) {
      setErrorMsg("Terjadi kesalahan jaringan.");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveScheduleSetting = async () => {
    setIsSavingSchedule(true);
    try {
      const res = await updatePotongKainScheduleSettings({
        time: scheduleTime,
        enabled: scheduleEnabled,
        safeMode: scheduleSafeMode,
      });

      if (res.success) {
        setIsScheduleModalOpen(false);
        setToast({
          type: "success",
          title: "Jadwal Auto-Sync Tersimpan",
          message: `Jadwal sinkronisasi otomatis harian Potong Kain berhasil disetel ke pukul ${scheduleTime} WIB!`,
        });
      } else {
        setToast({
          type: "error",
          title: "Gagal Menyimpan Jadwal",
          message: res.error || "Gagal menyimpan konfigurasi jadwal.",
        });
      }
    } catch (err: any) {
      setToast({
        type: "error",
        title: "Gagal Menyimpan Jadwal",
        message: err.message || "Terjadi kesalahan sistem.",
      });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const executeSingleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncPotongKainToGoogleSheet(
        filters.nomor_mc, 
        filters.tahun, 
        syncSafeMode,
        undefined, // default bulan ini
        syncOnlyUnsynced
      );
      setIsSyncModalOpen(false);
      if (res.success) {
        await loadSyncStatus(filters.nomor_mc);
        setToast({
          type: "success",
          title: "Sinkronisasi Berhasil",
          message: res.message || `Data mesin ${filters.nomor_mc} berhasil disinkronkan ke Google Sheet!`,
        });
      } else {
        setToast({
          type: "error",
          title: "Sinkronisasi Gagal",
          message: res.error || "Gagal menyinkronkan data ke Google Sheet.",
        });
      }
    } catch (err: any) {
      setToast({
        type: "error",
        title: "Sinkronisasi Gagal",
        message: err.message || "Terjadi kesalahan jaringan.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const executeSyncAll = async () => {
    setIsSyncingAll(true);
    setSyncAllResults(null);
    try {
      const res = await syncAllPotongKainMachines(filters.tahun, syncSafeMode, undefined, syncOnlyUnsynced);
      setSyncAllResults(res.results);
      await loadSyncStatus(filters.nomor_mc);
      if (res.success) {
        setToast({
          type: "success",
          title: "Sinkronisasi Selesai",
          message: res.message,
        });
      } else {
        setToast({
          type: "error",
          title: "Sebagian / Seluruh Mesin Gagal",
          message: res.message || "Beberapa mesin gagal disinkronkan.",
        });
      }
    } catch (err: any) {
      setToast({
        type: "error",
        title: "Sinkronisasi Gagal",
        message: err.message || "Terjadi kesalahan sistem.",
      });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleUnsyncSingle = async (batchKey: string) => {
    setIsUnsyncingKey(batchKey);
    try {
      const res = await unmarkPotongKainSynced(filters.nomor_mc, batchKey);
      if (res.success) {
        setSyncedKeys((prev) => prev.filter((k) => k !== batchKey));
        setToast({
          type: "info",
          title: "Status Di-Unsync",
          message: `Potongan ${batchKey.split("_")[0]} telah direset menjadi 'Belum Sync'. Anda bisa uji coba sync ulang.`,
        });
      } else {
        setToast({
          type: "error",
          title: "Gagal Unsync",
          message: res.error || "Gagal membatalkan status sync.",
        });
      }
    } catch {
      setToast({
        type: "error",
        title: "Gagal Unsync",
        message: "Terjadi kesalahan sistem saat membatalkan status sync.",
      });
    } finally {
      setIsUnsyncingKey(null);
    }
  };

  const handleResetMachineSync = async () => {
    const isConfirmed = window.confirm(
      `Reset semua status sync untuk mesin ${filters.nomor_mc}?\n\nSemua baris akan kembali menjadi 'Belum Sync' untuk kebutuhan trial / uji coba.`
    );
    if (!isConfirmed) return;

    setIsResettingSync(true);
    try {
      const res = await resetPotongKainSyncStatus(filters.nomor_mc);
      if (res.success) {
        setSyncedKeys([]);
        setToast({
          type: "success",
          title: "Reset Status Sync Berhasil",
          message: `Seluruh data mesin ${filters.nomor_mc} telah direset menjadi 'Belum Sync'.`,
        });
      } else {
        setToast({
          type: "error",
          title: "Gagal Reset",
          message: res.error || "Gagal mereset status sync.",
        });
      }
    } catch {
      setToast({
        type: "error",
        title: "Gagal Reset",
        message: "Terjadi kesalahan sistem.",
      });
    } finally {
      setIsResettingSync(false);
    }
  };

  useEffect(() => {
    getMendingReportOptions().then(res => {
      if (res.success && res.data) {
        setOptions({
          mesins: (res.data.mesins as string[]).sort()
        });
      }
    });
    
    // Auto load R1 on mount
    fetchReportData("R1", new Date().getFullYear().toString());
  }, []);

  // Format Jam dari tanggal_jam
  const extractTime = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    } catch {
      return "";
    }
  };

  const isBsAwalAkhir = (item: any) => {
    const pNo = String(
      item.detail?.header?.panel_no ||
      item.header?.panel_no ||
      item.detail?.panel_no ||
      item.panel_no ||
      ""
    ).trim().toUpperCase();
    return pNo.includes("AWAL") || pNo.includes("AKHIR");
  };

  const calculateOverallGrade = (batch: any) => {
    const isMeter = batch.header?.panel_no === "METERAN";
    let totalQty = 0;
    let totalCacat = 0;

    if (isMeter) {
      batch.items?.forEach((i: any) => {
        totalQty = Math.max(totalQty, Number(i.detail?.jml_hasil_produksi || 0));
        if (isBsAwalAkhir(i)) return;
        const isSpecial =
          ((!!i.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") ||
            !!i.kategori_masalah?.toUpperCase().includes("ISTIRAHAT")) &&
            !i.kategori_masalah &&
            !i.detail_masalah) ||
          i.cacatDisplay === "START" ||
          i.cacatDisplay === "FINISH" ||
          i.cacatDisplay === "ISTIRAHAT";
        if (isSpecial) return;

        // Diambil dari SETELAH INSPECT (hasil_mending), bukan data produksi
        if (i.hasil_mending === "B" || i.hasil_mending === "BS") {
          totalCacat += 1;
        }
      });
      if (totalQty === 0) totalQty = 300;
    } else {
      // Panel: Panel BS Awal dan BS Akhir tidak disertakan
      const regularItems = (batch.items || []).filter((i: any) => !isBsAwalAkhir(i));
      totalQty = regularItems.length;

      // Total Cacat diambil dari SETELAH INSPECT (hasil_mending)
      regularItems.forEach((i: any) => {
        if (i.hasil_mending === "B" || i.hasil_mending === "BS") {
          totalCacat += 1;
        }
      });
    }

    let overallGrade = "-";
    let bucket = 0;
    if (totalQty > 0) {
      if (isMeter) {
        bucket = 300;
        if (totalQty > 450) bucket = 500;
        else if (totalQty > 400) bucket = 450;
        else if (totalQty > 350) bucket = 400;
        else if (totalQty > 300) bucket = 350;
        else bucket = 300;

        let limitA = 9, limitB = 15, limitC = 21;
        if (bucket === 350) { limitA = 11; limitB = 18; limitC = 25; }
        if (bucket === 400) { limitA = 12; limitB = 20; limitC = 28; }
        if (bucket === 450) { limitA = 14; limitB = 23; limitC = 32; }
        if (bucket === 500) { limitA = 15; limitB = 25; limitC = 35; }

        if (totalCacat <= limitA) overallGrade = "A";
        else if (totalCacat <= limitB) overallGrade = "B";
        else if (totalCacat <= limitC) overallGrade = "C";
        else overallGrade = "D";
      } else {
        bucket = 50;
        if (totalQty > 125) bucket = 150;
        else if (totalQty > 120) bucket = 125;
        else if (totalQty > 100) bucket = 120;
        else if (totalQty > 75) bucket = 100;
        else if (totalQty > 65) bucket = 75;
        else if (totalQty > 50) bucket = 65;
        else bucket = 50;

        let limitA = 5, limitB = 8, limitC = 9;
        if (bucket === 65) { limitA = 7; limitB = 10; limitC = 13; }
        if (bucket === 75) { limitA = 8; limitB = 12; limitC = 15; }
        if (bucket === 100) { limitA = 10; limitB = 15; limitC = 19; }
        if (bucket === 120) { limitA = 12; limitB = 18; limitC = 23; }
        if (bucket === 125) { limitA = 13; limitB = 19; limitC = 25; }
        if (bucket === 150) { limitA = 15; limitB = 23; limitC = 29; }

        if (totalCacat <= limitA) overallGrade = "A";
        else if (totalCacat <= limitB) overallGrade = "B";
        else if (totalCacat <= limitC) overallGrade = "C";
        else overallGrade = "D";
      }
    }
    return overallGrade;
  };

const formatKeteranganMending = (rawKet?: string | null): string => {
  if (!rawKet) return "-";
  
  let elapsedSec = 0;
  const mElapsed = rawKet.match(/\[ELAPSED:(\d+)\]/i);
  if (mElapsed && mElapsed[1]) {
    elapsedSec = parseInt(mElapsed[1], 10);
  }
  
  const cleanNotes = rawKet
    .replace(/\[ELAPSED:\d+\]/gi, "")
    .replace(/\[PAUSE:\d+\]/gi, "")
    .trim();
  
  let durationStr = "";
  if (elapsedSec > 0) {
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    if (mins > 0 && secs > 0) {
      durationStr = `${mins}m ${secs}s`;
    } else if (mins > 0) {
      durationStr = `${mins}m`;
    } else {
      durationStr = `${secs}s`;
    }
  }
  
  if (cleanNotes && durationStr) {
    return `${cleanNotes} (Durasi: ${durationStr})`;
  } else if (cleanNotes) {
    return cleanNotes;
  } else if (durationStr) {
    return `Durasi: ${durationStr}`;
  }
  
  return "-";
};

  const processedData = useMemo(() => {
    return data.map(batch => {
      const header = batch.header || {};
      const firstItem = batch.items?.[0] || {};
      
      const tanggalBeres = header.tanggal_potong || header.tgl || "";
      const obRaw = header.no_order_barang || "";
      let obStm = "";
      let obDji = "";
      if (obRaw.toUpperCase().includes("DJI") || obRaw.toUpperCase().includes("DEX")) {
        obDji = obRaw;
      } else {
        obStm = obRaw;
      }
      const design = header.design_id || "";
      
      // Hitung total panel termasuk panel BS (dihitung satu-satu)
      let panelCount = batch.total_panel || 0;
      if (batch.items && batch.items.length > 0) {
        let regPanels = 0;
        let totalBs = 0;

        batch.items.forEach((it: any) => {
          const pNo = String(it.detail?.header?.panel_no || it.header?.panel_no || "").trim().toUpperCase();
          if (pNo.includes("BS") || pNo.includes("AWAL") || pNo.includes("AKHIR") || it.detail?.jml_hasil_produksi === 0) {
            totalBs += 1;
          } else if (pNo !== "METERAN" && pNo !== "START" && pNo !== "FINISH") {
            regPanels += 1;
          }
        });

        if (regPanels > 0 || totalBs > 0) {
          panelCount = regPanels + totalBs;
        }
      }
      
      let qtyKg = firstItem.qc_batch?.berat_kain;
      if (!qtyKg && batch.items) {
        // Fallback cari qc batch dari item lain jika ada
        const it = batch.items.find((i: any) => i.qc_batch?.berat_kain);
        if (it) qtyKg = it.qc_batch?.berat_kain;
      }
      qtyKg = qtyKg || 0;
      
      const jam = extractTime(header.tanggal_jam);
      
      const groupNames = new Set<string>();
      if (header.groups?.nama_grup) groupNames.add(header.groups.nama_grup);
      batch.items?.forEach((i: any) => {
        if (i.detail?.header?.groups?.nama_grup) {
          groupNames.add(i.detail.header.groups.nama_grup);
        }
      });
      const shift = Array.from(groupNames).join(", ") || "-";
      const potonganKe = String(batch.potongan_ke || "");
      const pcsKe = String(batch.pcs_index || firstItem.detail?.pcs_index || "1");
      const batchKey = `${potonganKe}_${pcsKe}`;
      const isSynced = syncedKeys.includes(batchKey);
      
      const grade = calculateOverallGrade(batch);
      
      const tglMending = batch.tanggal_mending || batch.tanggal_final || "";
      const customer = header.no_customer || "";
      const ket = formatKeteranganMending(batch.keterangan_mending || batch.keterangan_final);

      return {
        batchKey,
        isSynced,
        tanggalBeres,
        obStm,
        obDji,
        design,
        lebar: header.lebar || "",
        rollPnl: panelCount,
        qtyKg,
        jam,
        shift,
        potonganKe,
        pcsKe,
        grade,
        tglMending,
        tglPengiriman: "", // manual fill
        customer,
        ket
      };
    }).sort((a, b) => {
      const potA = Number(a.potonganKe) || 0;
      const potB = Number(b.potonganKe) || 0;
      if (potA !== potB) return potA - potB;
      return Number(a.pcsKe || 1) - Number(b.pcsKe || 1);
    });
  }, [data, syncedKeys]);

  const unsyncedCount = useMemo(() => {
    return processedData.filter((r: any) => !r.isSynced).length;
  }, [processedData]);

  const syncedCount = useMemo(() => {
    return processedData.filter((r: any) => r.isSynced).length;
  }, [processedData]);

  const isMultiPcs = useMemo(() => {
    // 1. Cek apakah ada data yang memiliki pcsKe > 1 di dataset saat ini
    const hasMultiplePcsInData = processedData.some((r: any) => Number(r.pcsKe) > 1);
    // 2. Daftar mesin yang terkonfigurasi Multi-PCS: R1C, R2C, R3B, R11, R12, R16, T1C, T2A
    const isKnownMultiPcsMachine = ["R1C", "R2C", "R3B", "R11", "R12", "R16", "T1C", "T2A"].includes(filters.nomor_mc);
    return hasMultiplePcsInData || isKnownMultiPcsMachine;
  }, [filters.nomor_mc, processedData]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await fetchReportData(filters.nomor_mc, filters.tahun);
  };

  const handleExportExcel = () => {
    if (processedData.length === 0) return;

    const wb = xlsx.utils.book_new();
    const wsData: any[][] = [];

    // Header 1 (Tahun)
    wsData.push([`TAHUN ${filters.tahun}`]);
    if (isMultiPcs) {
      wsData.push(["PENULISAN PCS 1,2, DAN 3 KEBAAWAH JANGAN KE PINGGIR"]);
    } else {
      wsData.push([]);
    }

    // Table Headers (Dinamis: sesuai ada/tidaknya kolom PCS di Google Sheet mesin tersebut)
    const headers = [
      "TANGGAL BERES PRODUKSI",
      "OB STM",
      "OB DJI",
      "DESIGN",
      "LEBAR",
      "ROLL/PNL",
      "QTY (KG)",
      "JAM",
      "SHIFT/TEAM",
      "POTONGAN KE",
      ...(isMultiPcs ? ["PCS KE"] : []),
      "GRADE MENDING",
      "Tanggal Selesai Mending",
      "Tanggal Pengiriman",
      "Customer",
      "KETERANGAN"
    ];
    wsData.push(headers);

    // Data rows
    processedData.forEach(row => {
      const rowData = [
        row.tanggalBeres,
        row.obStm,
        row.obDji,
        row.design,
        row.lebar,
        row.rollPnl,
        row.qtyKg,
        row.jam,
        row.shift,
        row.potonganKe,
        ...(isMultiPcs ? [row.pcsKe || "1"] : []),
        row.grade,
        row.tglMending,
        row.tglPengiriman,
        row.customer,
        row.ket
      ];
      wsData.push(rowData);
    });

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    
    ws["!cols"] = [
      { wch: 15 }, // TANGGAL BERES PRODUKSI
      { wch: 18 }, // OB STM
      { wch: 15 }, // OB DJI
      { wch: 25 }, // DESIGN
      { wch: 10 }, // LEBAR
      { wch: 10 }, // ROLL/PNL
      { wch: 10 }, // QTY (KG)
      { wch: 10 }, // JAM
      { wch: 12 }, // SHIFT/TEAM
      { wch: 14 }, // POTONGAN KE
      ...(isMultiPcs ? [{ wch: 10 }] : []), // PCS KE
      { wch: 15 }, // GRADE MENDING
      { wch: 20 }, // Tanggal Selesai Mending
      { wch: 18 }, // Tanggal Pengiriman
      { wch: 15 }, // Customer
      { wch: 30 }, // KETERANGAN
    ];

    xlsx.utils.book_append_sheet(wb, ws, `DATA POTONG MC ${filters.nomor_mc}`);
    xlsx.writeFile(wb, `DATA POTONG KAIN TAHUN ${filters.tahun} - MC ${filters.nomor_mc}.xlsx`);
  };

  return (
    <div className="p-4 md:p-8 w-full max-w-[1600px] mx-auto space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-[#003366] to-[#0070bc] p-5 md:p-6 shadow-2xl">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#0070bc]/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-40 w-48 h-48 bg-sky-500/20 rounded-full blur-2xl translate-y-1/2 pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left: Title Group */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center shrink-0 shadow-lg">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-3">
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                  Laporan Potong Kain
                </h1>
                {/* Inline Auto-Sync pill */}
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="h-7 px-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer group"
                  title="Klik untuk mengatur jam sinkronisasi otomatis harian"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    {scheduleEnabled && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${scheduleEnabled ? "bg-emerald-400" : "bg-white/40"}`}></span>
                  </span>
                  <span className="text-white/70">Auto-Sync</span>
                  <span className="font-black font-mono text-white">{scheduleTime}</span>
                  <span className="text-white/50 text-[10px]">WIB</span>
                  <Settings className="w-3 h-3 text-white/50 group-hover:text-white transition-colors" />
                </button>
              </div>
              <p className="text-white/60 text-xs font-medium mt-1">
                Rekapitulasi data hasil mending per mesin · Format Laporan Produksi
              </p>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Sync Mesin */}
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              disabled={isLoading || processedData.length === 0}
              className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-40 backdrop-blur-sm"
              title={`Sinkronkan data mesin ${filters.nomor_mc} ke Google Sheets`}
            >
              <CloudUpload className="w-4 h-4" />
              <span>Sync Mesin</span>
            </button>

            {/* Sync Semua Mesin */}
            <button
              type="button"
              onClick={() => {
                setSyncAllResults(null);
                setIsSyncAllModalOpen(true);
              }}
              disabled={isLoading}
              className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-40 backdrop-blur-sm"
              title="Sinkronkan seluruh 10 mesin ke Google Sheets"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Sync Semua</span>
            </button>

            {/* Primary CTA: Export Excel */}
            {processedData.length > 0 && (
              <button
                onClick={handleExportExcel}
                className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/30"
                title="Download File Excel"
              >
                <Download className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modern Filter & Machine Selector Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-100 p-5 md:p-6 space-y-5">
        {/* Machine Buttons Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Monitor className="w-4 h-4 text-[#0070bc]" />
              <span>PILIH NOMOR MESIN ({REGISTERED_MACHINES.length} MESIN TERSEDIA)</span>
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2">
            {REGISTERED_MACHINES.map((mc) => {
              const isSelected = filters.nomor_mc === mc;
              return (
                <button
                  key={mc}
                  type="button"
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, nomor_mc: mc }));
                    fetchReportData(mc, filters.tahun);
                  }}
                  disabled={isLoading}
                  className={`h-12 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
                    isSelected
                      ? "bg-gradient-to-tr from-[#0070bc] to-[#008deb] text-white shadow-lg shadow-[#0070bc]/30 scale-[1.03] ring-2 ring-sky-400/40"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 hover:border-slate-300 hover:scale-[1.01] active:scale-95"
                  }`}
                >
                  <span>{mc}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white animate-fadeIn" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Toolbar: Tahun & Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 rounded-2xl border border-slate-200 w-full sm:w-auto">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tahun:</span>
              <select
                value={filters.tahun}
                onChange={(e) => {
                  const y = e.target.value;
                  setFilters((prev) => ({ ...prev, tahun: y }));
                  if (filters.nomor_mc) fetchReportData(filters.nomor_mc, y);
                }}
                className="bg-transparent text-sm font-black text-slate-800 outline-none cursor-pointer"
              >
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => fetchReportData(filters.nomor_mc, filters.tahun)}
              disabled={isLoading || !filters.nomor_mc}
              className="h-11 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              title="Refresh / Muat Ulang Data"
            >
              <RotateCw className={`w-4 h-4 text-slate-600 ${isLoading ? "animate-spin" : ""}`} />
              <span>Muat Ulang Data</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 animate-fadeIn">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-rose-800">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Data Table */}
      {hasSearched && processedData.length > 0 && (
        <div className="space-y-3">
          {/* Sub-bar Status Sync Mesin */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Status Sync ({filters.tahun}):</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>{unsyncedCount} Belum Sync</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>{syncedCount} Tersinkron</span>
              </span>
            </div>

            {syncedCount > 0 && (
              <button
                type="button"
                onClick={handleResetMachineSync}
                disabled={isResettingSync}
                className="h-8 px-3 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-600 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                title="Reset semua status sync mesin ini menjadi 'Belum Sync' (khusus untuk kebutuhan uji coba / trial)"
              >
                {isResettingSync ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                )}
                <span>Reset Sync Mesin Ini (Trial)</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Scrollable Table */}
            <div className="overflow-x-auto overflow-y-auto max-h-[520px] w-full">
              <table className="w-full text-xs border-collapse" style={{ minWidth: "980px" }}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#003366] text-white">
                    {/* Nomor */}
                    <th className="border border-slate-600/40 px-2 py-2.5 text-center font-black uppercase tracking-wide w-10 whitespace-nowrap">
                      No
                    </th>
                    {/* Status Sync */}
                    <th className="border border-slate-600/40 px-3 py-2.5 text-center font-black uppercase tracking-wide leading-tight whitespace-nowrap">
                      Status<br/>Sync
                    </th>
                    <th className="border border-slate-600/40 px-3 py-2.5 text-center font-black uppercase tracking-wide leading-tight">
                      Tgl Beres<br/>Produksi
                    </th>
                    <th className="border border-slate-600/40 px-3 py-2.5 text-left font-black uppercase tracking-wide whitespace-nowrap">
                      OB STM
                    </th>
                    <th className="border border-slate-600/40 px-3 py-2.5 text-left font-black uppercase tracking-wide whitespace-nowrap">
                      OB DJI
                    </th>
                    <th className="border border-slate-600/40 px-3 py-2.5 text-left font-black uppercase tracking-wide whitespace-nowrap">
                      Design
                    </th>
                    <th className="border border-slate-600/40 px-3 py-2.5 text-center font-black uppercase tracking-wide whitespace-nowrap">
                      Lebar
                    </th>
                    <th className="border border-slate-600/40 px-3 py-2.5 text-center font-black uppercase tracking-wide whitespace-nowrap">
                      Roll/Pnl
                    </th>
                    <th className="border border-slate-600/40 px-3 py-2.5 text-center font-black uppercase tracking-wide leading-tight">
                      Qty<br/>(Kg)
                    </th>
                    <th className="border border-slate-600/40 px-3 py-2.5 text-center font-black uppercase tracking-wide whitespace-nowrap">
                      Jam
                    </th>
                    <th className="border border-slate-600/40 px-3 py-2.5 text-center font-black uppercase tracking-wide whitespace-nowrap">
                      Shift
                    </th>
                    <th className="border border-slate-600/40 px-3 py-2.5 text-center font-black uppercase tracking-wide leading-tight">
                      Pot.<br/>Ke
                    </th>
                    {isMultiPcs && (
                      <th className="border border-amber-400/60 px-3 py-2.5 text-center font-black uppercase tracking-wide bg-amber-600/80 leading-tight">
                        PCS<br/>Ke
                      </th>
                    )}
                    <th className="border border-slate-600/40 px-3 py-2.5 text-center font-black uppercase tracking-wide whitespace-nowrap">
                      Grade
                    </th>
                    <th className="border border-slate-600/40 px-3 py-2.5 text-center font-black uppercase tracking-wide leading-tight">
                      Tgl Selesai<br/>Mending
                    </th>
                    <th className="border border-slate-600/40 px-3 py-2.5 text-center font-black uppercase tracking-wide leading-tight">
                      Tgl<br/>Pengiriman
                    </th>
                    <th className="border border-slate-600/40 px-3 py-2.5 text-left font-black uppercase tracking-wide whitespace-nowrap">
                      Customer
                    </th>
                    <th className="border border-slate-600/40 px-3 py-2.5 text-left font-black uppercase tracking-wide whitespace-nowrap">
                      Keterangan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {processedData.map((row: any, i: number) => (
                    <tr
                      key={i}
                      className={`transition-colors hover:bg-sky-50/60 ${
                        i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                      }`}
                    >
                      {/* Nomor urut */}
                      <td className="border border-slate-200 px-2 py-2 text-center text-slate-400 font-bold w-10">
                        {i + 1}
                      </td>
                      {/* Status Sync Column */}
                      <td className="border border-slate-200 px-2 py-1.5 text-center whitespace-nowrap">
                        {row.isSynced ? (
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-black">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Tersinkron</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUnsyncSingle(row.batchKey)}
                              disabled={isUnsyncingKey === row.batchKey}
                              className="px-1.5 py-0.5 rounded-md bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 border border-slate-200 text-slate-500 text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 active:scale-95"
                              title="Klik untuk unsync (ubah kembali jadi Belum Sync untuk tes trial)"
                            >
                              {isUnsyncingKey === row.batchKey ? (
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <RotateCcw className="w-2.5 h-2.5 text-slate-500" />
                              )}
                              <span>Unsync</span>
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-black">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Belum Sync</span>
                          </span>
                        )}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 font-bold text-slate-800 whitespace-nowrap">
                        {row.tanggalBeres || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.obStm || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.obDji || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 font-black text-slate-900 whitespace-nowrap">
                        {row.design || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-center text-slate-700">
                        {row.lebar || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-center font-black font-mono text-slate-800">
                        {row.rollPnl || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-center font-black font-mono text-slate-800">
                        {row.qtyKg || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-center font-mono text-slate-600">
                        {row.jam || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-center text-slate-700">
                        {row.shift || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-center font-black font-mono text-[#0070bc]">
                        {row.potonganKe || <span className="text-slate-300">-</span>}
                      </td>
                      {isMultiPcs && (
                        <td className="border border-amber-200 px-3 py-2 text-center bg-amber-50/60">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs font-black font-mono">
                            {row.pcsKe || "1"}
                          </span>
                        </td>
                      )}
                      <td className="border border-slate-200 px-3 py-2 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-6 rounded-md text-xs font-black ${
                          row.grade === "A"
                            ? "bg-emerald-100 text-emerald-800"
                            : row.grade === "B"
                            ? "bg-amber-100 text-amber-800"
                            : row.grade === "C"
                            ? "bg-orange-100 text-orange-800"
                            : row.grade === "D"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {row.grade || "-"}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-center text-slate-600 whitespace-nowrap">
                        {row.tglMending || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-center text-slate-600 whitespace-nowrap">
                        {row.tglPengiriman || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.customer || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-slate-600 max-w-[180px] truncate" title={row.ket}>
                        {row.ket || <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {hasSearched && processedData.length === 0 && !isLoading && !errorMsg && (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
            <Search className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">Data Tidak Ditemukan</h3>
          <p className="text-slate-500 text-sm max-w-sm">
            Tidak ada data potong kain/mending yang ditemukan untuk mesin dan tahun terpilih.
          </p>
        </div>
      )}

      {/* MODAL SYNC 1 MESIN */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <CloudUpload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">
                    Sync Mesin {filters.nomor_mc}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    Kirim data ke tab Google Sheet "{filters.nomor_mc}"
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSyncing && setIsSyncModalOpen(false)}
                disabled={isSyncing}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-medium text-slate-600">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mesin:</span>
                  <span className="font-black text-slate-800 font-mono">{filters.nomor_mc}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tahun:</span>
                  <span className="font-black text-indigo-700 font-mono">
                    {filters.tahun}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Data:</span>
                  <span className="font-bold text-slate-700">
                    <span className="text-amber-600 font-black">{unsyncedCount} belum sync</span> · <span className="text-emerald-600 font-black">{syncedCount} tersinkron</span>
                  </span>
                </div>
              </div>

              {/* Pilihan Target Data */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  Target Data yang Dikirim
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSyncOnlyUnsynced(true)}
                    className={`h-13 px-2.5 rounded-xl border-2 font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                      syncOnlyUnsynced
                        ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 shadow-2xs"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-black text-xs">Hanya Data Baru</span>
                    <span className="text-[10px] font-semibold text-indigo-600">({unsyncedCount} belum sync)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSyncOnlyUnsynced(false)}
                    className={`h-13 px-2.5 rounded-xl border-2 font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                      !syncOnlyUnsynced
                        ? "border-amber-500 bg-amber-50/80 text-amber-900 shadow-2xs"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-black text-xs">Semua Data</span>
                    <span className="text-[10px] font-semibold text-amber-700">(Trial Re-sync)</span>
                  </button>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Mode Eksekusi di Google Sheet
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSyncSafeMode(true)}
                    className={`h-10 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      syncSafeMode 
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-2xs" 
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    🛡️ Mode Aman
                  </button>
                  <button
                    type="button"
                    onClick={() => setSyncSafeMode(false)}
                    className={`h-10 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      !syncSafeMode 
                        ? "border-amber-500 bg-amber-50 text-amber-800 shadow-2xs" 
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    🔄 Timpa Semua
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                disabled={isSyncing}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeSingleSync}
                disabled={isSyncing}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengirim ke Sheet...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" />
                    <span>Mulai Sinkronisasi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SYNC SEMUA 10 MESIN */}
      {isSyncAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 sm:p-7 flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base sm:text-lg">
                    Sync Seluruh 10 Mesin Potong Kain
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    Otomatis sinkronkan data bulan ini ({new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })}) ke seluruh tab Google Sheets
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSyncingAll && setIsSyncAllModalOpen(false)}
                disabled={isSyncingAll}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Mode Selection */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSyncSafeMode(true)}
                  className={`h-11 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    syncSafeMode 
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-2xs" 
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  🛡️ Mode Aman
                </button>
                <button
                  type="button"
                  onClick={() => setSyncSafeMode(false)}
                  className={`h-11 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    !syncSafeMode 
                      ? "border-amber-500 bg-amber-50 text-amber-800 shadow-2xs" 
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  🔄 Timpa Semua
                </button>
              </div>

              {/* Daftar 10 Mesin */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                  Daftar 10 Mesin Target
                </label>
                <div className="grid grid-cols-5 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  {REGISTERED_MACHINES.map((m) => {
                    const mResult = syncAllResults?.find((r) => r.machine === m);
                    const isSuccess = mResult && mResult.success;
                    const isFailed = mResult && !mResult.success;
                    return (
                      <div 
                        key={m}
                        className={`px-2 py-1.5 rounded-xl border text-xs font-black flex items-center justify-between transition-all ${
                          isSuccess
                            ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                            : isFailed
                            ? "bg-rose-100 border-rose-300 text-rose-800"
                            : isSyncingAll
                            ? "bg-amber-50 border-amber-200 text-amber-700 animate-pulse"
                            : "bg-white border-slate-200 text-slate-700"
                        }`}
                      >
                        <span>{m}</span>
                        {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        {isFailed && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                        {!mResult && isSyncingAll && <Loader2 className="w-3 h-3 animate-spin text-amber-600" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setIsSyncAllModalOpen(false)}
                disabled={isSyncingAll}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={executeSyncAll}
                disabled={isSyncingAll}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 active:scale-95 text-white font-black text-xs shadow-lg shadow-amber-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSyncingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyinkronkan 10 Mesin...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Mulai Sync Semua Mesin</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PENGATURAN JADWAL AUTO-SYNC POTONG KAIN */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 sm:p-7 flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base sm:text-lg">
                    Jadwal Auto-Sync Potong Kain
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    Otomatisasi Laporan Potong Kain Harian (WIB)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSavingSchedule && setIsScheduleModalOpen(false)}
                disabled={isSavingSchedule}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Status Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">
                    Status Sinkronisasi Otomatis
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {scheduleEnabled ? "Otomatis berjalan setiap hari" : "Auto-sync sedang dinonaktifkan"}
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600 relative"></div>
                </label>
              </div>

              {/* Time Picker */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Waktu Eksekusi Harian (Format Jam WIB)
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="h-12 px-4 rounded-2xl bg-white border-2 border-amber-200 text-sm font-black text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none w-full transition-all shadow-2xs"
                />
              </div>

              {/* Machine Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-[#0070bc]" />
                    Mesin yang Disinkronkan
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setScheduleMachines([...REGISTERED_MACHINES])}
                      className="text-[10px] font-bold text-[#0070bc] hover:underline cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setScheduleMachines([])}
                      className="text-[10px] font-bold text-slate-400 hover:underline cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {REGISTERED_MACHINES.map((mc) => {
                    const isSelected = scheduleMachines.includes(mc);
                    return (
                      <button
                        key={mc}
                        type="button"
                        onClick={() => {
                          setScheduleMachines((prev) =>
                            isSelected ? prev.filter((m) => m !== mc) : [...prev, mc]
                          );
                        }}
                        className={`h-9 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer relative ${
                          isSelected
                            ? "bg-[#0070bc] text-white shadow-sm shadow-[#0070bc]/30"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center">
                            <Check className="w-2 h-2 text-white" />
                          </span>
                        )}
                        {mc}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  {scheduleMachines.length === 0
                    ? "⚠️ Tidak ada mesin dipilih — auto-sync tidak akan berjalan"
                    : `${scheduleMachines.length} dari ${REGISTERED_MACHINES.length} mesin akan disinkronkan`}
                </p>
              </div>

              {/* Mode Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Mode Eksekusi Data
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleSafeMode(true)}
                    className={`h-11 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      scheduleSafeMode 
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-2xs" 
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    🛡️ Mode Aman
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleSafeMode(false)}
                    className={`h-11 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      !scheduleSafeMode 
                        ? "border-amber-500 bg-amber-50 text-amber-800 shadow-2xs" 
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    🔄 Timpa Semua
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                disabled={isSavingSchedule}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleSaveScheduleSetting}
                disabled={isSavingSchedule}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 active:scale-95 text-white font-black text-xs shadow-lg shadow-amber-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                Simpan Jadwal
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
              <AlertTriangle className="w-5 h-5" />
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
