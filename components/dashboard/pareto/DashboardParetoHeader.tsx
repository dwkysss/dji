"use client";

import React from "react";
import { BarChart2 } from "lucide-react";

export interface DashboardParetoHeaderProps {
  paretoGroupBy: "KATEGORI" | "MESIN";
  setParetoGroupBy: (val: "KATEGORI" | "MESIN") => void;
  availableParetoMachines: string[];
  selectedParetoMachine: string;
  setSelectedParetoMachine: (val: string) => void;
  paretoMode: "COUNT" | "DURATION";
  setParetoMode: (val: "COUNT" | "DURATION") => void;
}

export default function DashboardParetoHeader({
  paretoGroupBy,
  setParetoGroupBy,
  availableParetoMachines,
  selectedParetoMachine,
  setSelectedParetoMachine,
  paretoMode,
  setParetoMode,
}: DashboardParetoHeaderProps) {
  return (
    <div className="border-b border-slate-100 pb-4 mb-5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-sky-50 text-[#0070bc] rounded-2xl border border-sky-100 shadow-xs shrink-0">
          <BarChart2 className="w-5 h-5" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base sm:text-lg font-extrabold text-slate-800">
              Analisis Pareto (Aturan 80/20)
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-[#0070bc] border border-sky-200/80 uppercase tracking-wide">
              Prinsip 80/20
            </span>
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Identifikasi 20% faktor utama (
            {paretoGroupBy === "KATEGORI"
              ? "Kategori Masalah"
              : "Mesin Produksi"}
            ) yang menyumbang 80% total masalah & downtime
          </p>
        </div>
      </div>

      {/* Filter Controls Group */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-2.5 w-full xl:w-auto">
        {/* Group By Selector */}
        <div className="flex items-center justify-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/80">
          <button
            onClick={() => setParetoGroupBy("KATEGORI")}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              paretoGroupBy === "KATEGORI"
                ? "bg-white text-[#0070bc] shadow-xs border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Detail Masalah
          </button>
          <button
            onClick={() => setParetoGroupBy("MESIN")}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              paretoGroupBy === "MESIN"
                ? "bg-white text-[#0070bc] shadow-xs border border-slate-200"
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
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-extrabold py-2 sm:py-1.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0070bc] cursor-pointer w-full sm:w-auto"
          >
            <option value="ALL">Semua Mesin</option>
            {availableParetoMachines.map((m) => (
              <option key={m} value={m}>
                {m.startsWith("Mesin") ? m : `Mesin ${m}`}
              </option>
            ))}
          </select>
        )}

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-slate-200 mx-0.5" />

        {/* Metric Mode Selector */}
        <div className="flex items-center justify-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/80">
          <button
            onClick={() => setParetoMode("COUNT")}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              paretoMode === "COUNT"
                ? "bg-white text-[#0070bc] shadow-xs border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Frekuensi Masalah
          </button>
          <button
            onClick={() => setParetoMode("DURATION")}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              paretoMode === "DURATION"
                ? "bg-white text-[#0070bc] shadow-xs border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Durasi Downtime
          </button>
        </div>
      </div>
    </div>
  );
}
