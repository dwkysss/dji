"use client";

import React from "react";
import { Download, X } from "lucide-react";

export interface MonthlyRekapModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportMonth: number;
  setExportMonth: (month: number) => void;
  exportYear: number;
  setExportYear: (year: number) => void;
  onDownload: () => void;
}

export default function MonthlyRekapModal({
  isOpen,
  onClose,
  exportMonth,
  setExportMonth,
  exportYear,
  setExportYear,
  onDownload,
}: MonthlyRekapModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Download className="w-5 h-5 text-[#0070bc]" />
            Download Rekap Bulanan
          </h3>
          <button
            onClick={onClose}
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
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            onClick={onDownload}
            className="px-5 py-2 text-sm font-bold text-white bg-[#0070bc] hover:bg-[#005a96] rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Generate Excel
          </button>
        </div>
      </div>
    </div>
  );
}
