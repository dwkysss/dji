"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getMendingReportOptions, getMendingReportData } from "@/actions/mending-actions";
import { 
  FileSpreadsheet, 
  Search, 
  Loader2, 
  AlertTriangle, 
  Download,
  Filter
} from "lucide-react";
import * as xlsx from "xlsx";

export default function LaporanPotongKainPage() {
  const [options, setOptions] = useState<{ mesins: string[] }>({ mesins: [] });
  const [filters, setFilters] = useState({ nomor_mc: "R1", tahun: new Date().getFullYear().toString() });
  
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchReportData = async (mc: string, year: string) => {
    if (!mc) {
      setErrorMsg("Pilih Nomor Mesin terlebih dahulu.");
      return;
    }
    
    setIsLoading(true);
    setErrorMsg(null);
    setHasSearched(true);
    
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

  const calculateOverallGrade = (batch: any) => {
    const isMeter = batch.header?.panel_no === "METERAN";
    let totalQty = 0;
    let totalCacat = 0;
    if (isMeter) {
      batch.items?.forEach((i: any) => {
        totalQty = Math.max(totalQty, Number(i.detail?.jml_hasil_produksi || 0));
        if (i.detail?.kategori_masalah || i.hasil_mending === "B" || i.hasil_mending === "BS") {
          totalCacat += 1;
        }
      });
      if (totalQty === 0) totalQty = 300;
    } else {
      batch.items?.forEach((i: any) => {
        totalQty += Number(i.detail?.jml_hasil_produksi || 0);
        if (i.detail?.kategori_masalah || i.hasil_mending === "B" || i.hasil_mending === "BS") {
          totalCacat += Number(i.detail?.jml_hasil_produksi || 1);
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
      const potonganKe = batch.potongan_ke || "";
      
      const grade = calculateOverallGrade(batch);
      
      const tglMending = batch.tanggal_mending || "";
      const customer = header.no_customer || "";
      const ket = batch.keterangan_mending || "";

      return {
        tanggalBeres,
        obStm,
        obDji: "", // manual fill
        design,
        lebar: "", // manual fill
        rollPnl: panelCount,
        qtyKg,
        jam,
        shift,
        potonganKe,
        grade,
        tglMending,
        tglPengiriman: "", // manual fill
        customer,
        ket
      };
    }).sort((a, b) => Number(a.potonganKe) - Number(b.potonganKe));
  }, [data]);

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
    wsData.push([]);

    // Table Headers (exactly as requested)
    wsData.push([
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
      "GRADE MENDING",
      "Tanggal Selesai Mending",
      "Tanggal Pengiriman",
      "Customer",
      "KETERANGAN"
    ]);

    // Data rows
    processedData.forEach(row => {
      wsData.push([
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
        row.grade,
        row.tglMending,
        row.tglPengiriman,
        row.customer,
        row.ket
      ]);
    });

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    
    ws["!cols"] = [
      { wch: 15 }, // TGL BERES
      { wch: 18 }, // OB STM
      { wch: 15 }, // OB DJI
      { wch: 25 }, // DESIGN
      { wch: 10 }, // LEBAR
      { wch: 10 }, // ROLL/PNL
      { wch: 10 }, // QTY
      { wch: 10 }, // JAM
      { wch: 12 }, // SHIFT
      { wch: 12 }, // POTONGAN KE
      { wch: 15 }, // GRADE
      { wch: 15 }, // TGL SELESAI
      { wch: 15 }, // TGL PENGIRIMAN
      { wch: 15 }, // CUSTOMER
      { wch: 30 }, // KET
    ];

    xlsx.utils.book_append_sheet(wb, ws, `DATA POTONG MC ${filters.nomor_mc}`);
    xlsx.writeFile(wb, `DATA POTONG KAIN TAHUN ${filters.tahun} - MC ${filters.nomor_mc}.xlsx`);
  };

  return (
    <div className="p-4 md:p-8 w-full max-w-[1600px] mx-auto space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0070bc]/10 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-[#0070bc]" />
            </div>
            Laporan Potong Kain
          </h1>
          <p className="text-slate-500 mt-2 font-medium">
            Tampilkan dan ekspor data hasil mending per mesin berdasarkan format Laporan Produksi.
          </p>
        </div>
        
        {processedData.length > 0 && (
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Download className="w-5 h-5" />
            <span>Export ke Excel</span>
          </button>
        )}
      </div>

      {/* Filter Card */}
      <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-4 md:p-6">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Nomor Mesin <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={filters.nomor_mc}
                onChange={(e) => setFilters({ ...filters, nomor_mc: e.target.value })}
                className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:border-[#0070bc] focus:ring-4 focus:ring-[#0070bc]/10 transition-all appearance-none"
              >
                <option value="">Pilih Mesin...</option>
                {options.mesins.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <Filter className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
            </div>
          </div>
          
          <div className="flex-1 space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Tahun
            </label>
            <div className="relative">
              <select
                value={filters.tahun}
                onChange={(e) => setFilters({ ...filters, tahun: e.target.value })}
                className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:border-[#0070bc] focus:ring-4 focus:ring-[#0070bc]/10 transition-all appearance-none"
              >
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
              <FileSpreadsheet className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isLoading || !filters.nomor_mc}
              className="w-full md:w-auto h-12 px-8 bg-[#0070bc] hover:bg-[#005ba1] text-white font-bold rounded-xl shadow-lg shadow-[#0070bc]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Mencari...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>Tampilkan</span>
                </>
              )}
            </button>
          </div>
        </form>

        {errorMsg && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-800">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Data Table */}
      {hasSearched && processedData.length > 0 && (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col h-[600px] w-full overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-700">
              Hasil Laporan - Mesin {filters.nomor_mc}
            </h3>
            <span className="text-sm font-semibold text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200">
              Total {processedData.length} Batch/Potongan
            </span>
          </div>
          
          <div className="flex-1 overflow-x-auto overflow-y-auto w-full relative">
            <div className="p-4 min-w-[1400px] w-full">
              <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-y border-slate-200/60">
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Tanggal Beres</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">OB STM</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">OB DJI</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Design</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Lebar</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Roll/PNL</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">QTY (KG)</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Jam</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Shift/Team</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Potongan Ke</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Grade Mending</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Tanggal Selesai</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Tgl Pengiriman</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Keterangan</th>
                </tr>
              </thead>
                <tbody className="divide-y divide-slate-100">
                  {processedData.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium whitespace-nowrap">{row.tanggalBeres || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium whitespace-nowrap">{row.obStm || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium whitespace-nowrap">{row.obDji || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-bold whitespace-nowrap">{row.design || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium whitespace-nowrap">{row.lebar || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-bold text-center">{row.rollPnl || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-bold text-center">{row.qtyKg || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium text-center">{row.jam || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium whitespace-nowrap">{row.shift || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-bold text-center text-[#0070bc]">{row.potonganKe || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-bold text-emerald-600 whitespace-nowrap">{row.grade || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium whitespace-nowrap">{row.tglMending || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium whitespace-nowrap">{row.tglPengiriman || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium whitespace-nowrap">{row.customer || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium max-w-xs truncate" title={row.ket}>{row.ket || "-"}</td>
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
    </div>
  );
}
