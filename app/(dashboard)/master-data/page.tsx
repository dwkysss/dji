"use client";

import { useState, useEffect } from "react";
import { getMasterData } from "@/actions/master-data-actions";
import { FileSpreadsheet, Download, RefreshCw, Search } from "lucide-react";
import * as XLSX from "xlsx";

export default function MasterDataPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Default: start of current month to today
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  
  const [filterMesin, setFilterMesin] = useState("");
  const [filterPotongan, setFilterPotongan] = useState("");
  const [filterOperator, setFilterOperator] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await getMasterData(startDate, endDate);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        console.error("Error fetching data:", result.error);
        alert("Gagal memuat data master: " + result.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExportExcel = () => {
    if (data.length === 0) {
      alert("Tidak ada data untuk diexport!");
      return;
    }

    // 1. Buat Worksheet dari Data JSON (Gunakan data yang difilter)
    const ws = XLSX.utils.json_to_sheet(filteredData);

    // 2. Buat Workbook dan tambahkan Worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MasterData");

    // 3. Simpan File Excel
    XLSX.writeFile(wb, `Master_Data_${startDate}_sd_${endDate}.xlsx`);
  };

  const filteredData = data.filter(row => {
    let match = true;
    if (filterMesin && row.mesin) {
      if (!String(row.mesin).toLowerCase().includes(filterMesin.toLowerCase())) match = false;
    }
    if (filterPotongan && row.potongan_ke) {
      if (!String(row.potongan_ke).toLowerCase().includes(filterPotongan.toLowerCase())) match = false;
    }
    if (filterOperator && row.operator) {
      if (!String(row.operator).toLowerCase().includes(filterOperator.toLowerCase())) match = false;
    }
    return match;
  });

  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="p-2.5 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-full flex flex-col min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)] min-w-0">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-200 shrink-0">
            <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">Master Data</h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500">Tampilan rekapitulasi data 100% realtime</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full lg:w-auto">
          {/* Baris 1: Filter Tanggal & Tombol */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 bg-white p-2.5 sm:p-2 rounded-xl shadow-xs border border-slate-200 lg:justify-end">
            <div className="flex items-center justify-between sm:justify-start gap-2 px-1 sm:px-2">
              <span className="text-xs font-bold text-slate-600">Mulai:</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs sm:text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-500 font-semibold"
              />
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2 px-1 sm:px-2">
              <span className="text-xs font-bold text-slate-600">Sampai:</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs sm:text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-500 font-semibold"
              />
            </div>
            <button 
              onClick={fetchData}
              disabled={loading}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 sm:px-3 sm:py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 font-bold text-xs sm:text-sm w-full sm:w-auto cursor-pointer"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Refresh Data
            </button>
          </div>

          {/* Baris 2: Filter Pencarian */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 bg-white p-2.5 sm:p-2 rounded-xl shadow-xs border border-slate-200 lg:justify-end">
            <div className="flex items-center gap-2 px-1 sm:px-2">
              <span className="text-xs font-bold text-slate-600 min-w-[50px] sm:min-w-0">Mesin:</span>
              <input 
                type="text" 
                value={filterMesin}
                onChange={(e) => setFilterMesin(e.target.value)}
                placeholder="R1..."
                className="text-xs sm:text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-500 w-full sm:w-20 font-semibold"
              />
            </div>
            <div className="flex items-center gap-2 px-1 sm:px-2 border-t sm:border-t-0 sm:border-l border-slate-100 pt-2 sm:pt-0 sm:pl-3">
              <span className="text-xs font-bold text-slate-600 min-w-[50px] sm:min-w-0">Potongan:</span>
              <input 
                type="text" 
                value={filterPotongan}
                onChange={(e) => setFilterPotongan(e.target.value)}
                placeholder="550..."
                className="text-xs sm:text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-500 w-full sm:w-24 font-semibold"
              />
            </div>
            <div className="flex items-center gap-2 px-1 sm:px-2 border-t sm:border-t-0 sm:border-l border-slate-100 pt-2 sm:pt-0 sm:pl-3">
              <span className="text-xs font-bold text-slate-600 min-w-[50px] sm:min-w-0">Operator:</span>
              <input 
                type="text" 
                value={filterOperator}
                onChange={(e) => setFilterOperator(e.target.value)}
                placeholder="Nama..."
                className="text-xs sm:text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-500 w-full sm:w-32 font-semibold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shrink-0">
        <p className="text-xs sm:text-sm font-bold text-slate-600">
          Menampilkan <span className="text-emerald-600">{filteredData.length}</span> baris data
        </p>
        <button 
          onClick={handleExportExcel}
          disabled={filteredData.length === 0}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Export ke Excel (.xlsx)
        </button>
      </div>

      {/* DATA TABLE */}
      <div className="flex-1 overflow-auto no-scrollbar bg-white border border-slate-200 rounded-2xl shadow-xs relative min-h-[350px]">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 p-4 text-center">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
            <p className="font-bold text-xs sm:text-sm text-slate-600 animate-pulse">Memuat jutaan data secara realtime...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
            <p className="font-bold text-xs sm:text-sm text-slate-400">Tidak ada data untuk filter tersebut.</p>
          </div>
        ) : null}

        <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[700px]">
          <thead className="sticky top-0 bg-slate-100 shadow-xs z-20">
            <tr>
              <th className="p-3 border-b border-r border-slate-200 font-extrabold text-slate-700 sticky left-0 bg-slate-100 z-30 shadow-[1px_0_0_0_#e2e8f0]">
                No
              </th>
              {headers.map(h => (
                <th key={h} className="p-3 border-b border-r border-slate-200 font-extrabold text-slate-700 capitalize">
                  {h.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, i) => (
              <tr key={i} className="hover:bg-emerald-50/50 transition-colors group">
                <td className="p-3 border-b border-r border-slate-100 font-bold text-slate-500 sticky left-0 bg-white group-hover:bg-emerald-50/50 z-10 shadow-[1px_0_0_0_#f1f5f9]">
                  {i + 1}
                </td>
                {headers.map(h => (
                  <td key={h} className="p-3 border-b border-r border-slate-100 text-slate-600 font-medium max-w-[200px] truncate">
                    {row[h] !== null ? String(row[h]) : "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
