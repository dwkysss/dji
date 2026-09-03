"use client";

import React, { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Layers,
  Info,
} from "lucide-react";
import { CrossMachineReportSummary, MachineTeamMetric } from "@/actions/cross-machine-actions";

interface MonthlyPerformanceChartsProps {
  period: CrossMachineReportSummary;
}

export default function MonthlyPerformanceCharts({ period }: MonthlyPerformanceChartsProps) {
  const [activeTab, setActiveTab] = useState<"ALL" | "PROD" | "EFF" | "DEFECT">("ALL");
  const [hoveredIndex, setHoveredIndex] = useState<{ chart: string; mcIndex: number } | null>(null);

  const machines = period.machines || [];
  // Filter active machines or all machines with data
  const displayMachines = machines.filter((m) => m.hasData || m.hasilProduksi.total > 0 || m.effTeam.avg > 0);
  const activeList = displayMachines.length > 0 ? displayMachines : machines;

  // 1. Max values for scaling
  const maxProd = Math.max(
    ...activeList.map((m) => Math.max(m.hasilProduksi.A, m.hasilProduksi.B, m.hasilProduksi.C)),
    10
  );
  // Round up maxProd nicely
  const niceMaxProd = Math.ceil(maxProd / 10) * 10 || 50;

  const maxEff = 100;
  const maxDefectRaw = Math.max(
    ...activeList.map((m) => Math.max(m.cacatPerTeam.A, m.cacatPerTeam.B, m.cacatPerTeam.C)),
    15
  );
  const niceMaxDefect = Math.ceil(maxDefectRaw / 5) * 5 || 25;

  return (
    <div className="space-y-6">
      {/* Chart Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-sky-700 uppercase tracking-wider mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Grafik Evaluasi Performa Bulanan</span>
          </div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Visualisasi Matriks Mesin — {period.monthName} {period.year}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Perbandingan komprehensif hasil produksi, efisiensi kerja, dan tingkat cacat per tim (A, B, C) untuk setiap mesin.
          </p>
        </div>

        {/* Tab Filter */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1.5 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Semua Grafik (3)
          </button>
          <button
            onClick={() => setActiveTab("PROD")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "PROD" ? "bg-white text-sky-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            📦 Hasil Produksi
          </button>
          <button
            onClick={() => setActiveTab("EFF")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "EFF" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            ⚡ Efisiensi
          </button>
          <button
            onClick={() => setActiveTab("DEFECT")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "DEFECT" ? "bg-white text-rose-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            ⚠️ Rasio Cacat
          </button>
        </div>
      </div>

      {/* Grid of 3 Charts */}
      <div className={`grid gap-6 ${activeTab === "ALL" ? "grid-cols-1 xl:grid-cols-3" : "grid-cols-1"}`}>
        {/* ─────────────────────────────────────────────────────────────
            GRAFIK 1: HASIL PRODUKSI PER TIM & MESIN
        ───────────────────────────────────────────────────────────── */}
        {(activeTab === "ALL" || activeTab === "PROD") && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 tracking-tight">Hasil Produksi per Tim</h3>
                    <p className="text-[11px] text-slate-400">Total output kain per mesin (Panel / Meter)</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                  Total: {period.totalRow.hasilProduksi.total.toLocaleString("id-ID")}
                </span>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 py-2 border-y border-slate-100 mb-4 text-xs font-bold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-[#0070bc]"></span>
                  <span>Tim A ({period.totalRow.hasilProduksi.A})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-[#0284c7]"></span>
                  <span>Tim B ({period.totalRow.hasilProduksi.B})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-[#38bdf8]"></span>
                  <span>Tim C ({period.totalRow.hasilProduksi.C})</span>
                </div>
              </div>

              {/* Bar Chart Container */}
              <div className="h-64 w-full relative flex items-end pt-4 pb-6 px-2">
                {/* Y-Axis Guide Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 text-[10px] text-slate-400 font-mono">
                  <div className="border-b border-dashed border-slate-200 w-full flex justify-between">
                    <span>{niceMaxProd}</span>
                  </div>
                  <div className="border-b border-dashed border-slate-200 w-full flex justify-between">
                    <span>{Math.round(niceMaxProd / 2)}</span>
                  </div>
                  <div className="border-b border-slate-200 w-full flex justify-between">
                    <span>0</span>
                  </div>
                </div>

                {/* Floating Safe Tooltip Overlay (Never clipped) */}
                {hoveredIndex?.chart === "prod" && activeList[hoveredIndex.mcIndex] && (
                  <div
                    className={`absolute top-0 z-30 bg-slate-900/95 backdrop-blur-sm text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs pointer-events-none animate-fadeIn transition-all ${
                      hoveredIndex.mcIndex > activeList.length / 2 ? "left-2" : "right-2"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 border-b border-slate-700 pb-1.5 mb-1.5">
                      <span className="font-extrabold text-sky-300">Mesin {activeList[hoveredIndex.mcIndex].machineId}</span>
                      <span className="font-mono font-bold text-sky-400">Total: {activeList[hoveredIndex.mcIndex].hasilProduksi.total}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-[11px]">
                      <div className="flex flex-col">
                        <span className="text-slate-400 font-medium">Tim A</span>
                        <span className="font-mono font-bold text-white text-sm">{activeList[hoveredIndex.mcIndex].hasilProduksi.A}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 font-medium">Tim B</span>
                        <span className="font-mono font-bold text-white text-sm">{activeList[hoveredIndex.mcIndex].hasilProduksi.B}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 font-medium">Tim C</span>
                        <span className="font-mono font-bold text-white text-sm">{activeList[hoveredIndex.mcIndex].hasilProduksi.C}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bars per Machine */}
                <div className="flex items-end justify-between w-full h-full gap-2 z-10 min-w-[300px]">
                  {activeList.map((m, idx) => {
                    const heightA = niceMaxProd > 0 ? (m.hasilProduksi.A / niceMaxProd) * 100 : 0;
                    const heightB = niceMaxProd > 0 ? (m.hasilProduksi.B / niceMaxProd) * 100 : 0;
                    const heightC = niceMaxProd > 0 ? (m.hasilProduksi.C / niceMaxProd) * 100 : 0;
                    const isHovered = hoveredIndex?.chart === "prod" && hoveredIndex?.mcIndex === idx;

                    return (
                      <div
                        key={m.machineId}
                        className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                        onMouseEnter={() => setHoveredIndex({ chart: "prod", mcIndex: idx })}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        {/* Bars Group (A, B, C) */}
                        <div className={`flex items-end justify-center gap-0.5 w-full h-[85%] rounded-lg transition-all p-0.5 ${
                          isHovered ? "bg-sky-50/80 ring-2 ring-sky-400" : ""
                        }`}>
                          {/* Bar A */}
                          <div
                            style={{ height: `${Math.max(heightA, 2)}%` }}
                            className="w-2.5 sm:w-3.5 bg-[#0070bc] hover:brightness-110 rounded-t-sm transition-all duration-300 relative"
                            title={`Tim A: ${m.hasilProduksi.A}`}
                          />
                          {/* Bar B */}
                          <div
                            style={{ height: `${Math.max(heightB, 2)}%` }}
                            className="w-2.5 sm:w-3.5 bg-[#0284c7] hover:brightness-110 rounded-t-sm transition-all duration-300 relative"
                            title={`Tim B: ${m.hasilProduksi.B}`}
                          />
                          {/* Bar C */}
                          <div
                            style={{ height: `${Math.max(heightC, 2)}%` }}
                            className="w-2.5 sm:w-3.5 bg-[#38bdf8] hover:brightness-110 rounded-t-sm transition-all duration-300 relative"
                            title={`Tim C: ${m.hasilProduksi.C}`}
                          />
                        </div>

                        {/* Machine X-Label */}
                        <span className={`text-[11px] font-bold mt-1.5 transition-colors ${
                          isHovered ? "text-sky-600 font-extrabold scale-105" : "text-slate-600"
                        }`}>
                          {m.machineId}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center gap-1.5 mt-2">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Arahkan kursor ke tiap mesin untuk melihat detail angka per tim.</span>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            GRAFIK 2: EFISIENSI TIM PER MESIN (%)
        ───────────────────────────────────────────────────────────── */}
        {(activeTab === "ALL" || activeTab === "EFF") && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 tracking-tight">Efisiensi Tim per Mesin</h3>
                    <p className="text-[11px] text-slate-400">Rata-rata persentase efisiensi per tim (%)</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  Rata-rata: {period.totalRow.effTeam.avg.toFixed(2)}%
                </span>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 py-2 border-y border-slate-100 mb-4 text-xs font-bold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-emerald-700"></span>
                  <span>Tim A ({period.totalRow.effTeam.A.toFixed(1)}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-emerald-500"></span>
                  <span>Tim B ({period.totalRow.effTeam.B.toFixed(1)}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-emerald-300"></span>
                  <span>Tim C ({period.totalRow.effTeam.C.toFixed(1)}%)</span>
                </div>
              </div>

              {/* Bar Chart Container */}
              <div className="h-64 w-full relative flex items-end pt-4 pb-6 px-2">
                {/* Y-Axis Guide Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 text-[10px] text-slate-400 font-mono">
                  <div className="border-b border-dashed border-slate-200 w-full flex justify-between">
                    <span>100%</span>
                  </div>
                  <div className="border-b border-dashed border-slate-200 w-full flex justify-between">
                    <span>50%</span>
                  </div>
                  <div className="border-b border-slate-200 w-full flex justify-between">
                    <span>0%</span>
                  </div>
                </div>

                {/* Floating Safe Tooltip Overlay (Never clipped) */}
                {hoveredIndex?.chart === "eff" && activeList[hoveredIndex.mcIndex] && (
                  <div
                    className={`absolute top-0 z-30 bg-slate-900/95 backdrop-blur-sm text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs pointer-events-none animate-fadeIn transition-all ${
                      hoveredIndex.mcIndex > activeList.length / 2 ? "left-2" : "right-2"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 border-b border-slate-700 pb-1.5 mb-1.5">
                      <span className="font-extrabold text-emerald-300">Mesin {activeList[hoveredIndex.mcIndex].machineId}</span>
                      <span className="font-mono font-bold text-emerald-400">Rata-rata: {activeList[hoveredIndex.mcIndex].effTeam.avg.toFixed(2)}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-[11px]">
                      <div className="flex flex-col">
                        <span className="text-slate-400 font-medium">Tim A</span>
                        <span className="font-mono font-bold text-white text-sm">{activeList[hoveredIndex.mcIndex].effTeam.A.toFixed(1)}%</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 font-medium">Tim B</span>
                        <span className="font-mono font-bold text-white text-sm">{activeList[hoveredIndex.mcIndex].effTeam.B.toFixed(1)}%</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 font-medium">Tim C</span>
                        <span className="font-mono font-bold text-white text-sm">{activeList[hoveredIndex.mcIndex].effTeam.C.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bars per Machine */}
                <div className="flex items-end justify-between w-full h-full gap-2 z-10 min-w-[300px]">
                  {activeList.map((m, idx) => {
                    const heightA = (m.effTeam.A / maxEff) * 100;
                    const heightB = (m.effTeam.B / maxEff) * 100;
                    const heightC = (m.effTeam.C / maxEff) * 100;
                    const isHovered = hoveredIndex?.chart === "eff" && hoveredIndex?.mcIndex === idx;

                    return (
                      <div
                        key={m.machineId}
                        className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                        onMouseEnter={() => setHoveredIndex({ chart: "eff", mcIndex: idx })}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        {/* Bars Group (A, B, C) */}
                        <div className={`flex items-end justify-center gap-0.5 w-full h-[85%] rounded-lg transition-all p-0.5 ${
                          isHovered ? "bg-emerald-50/80 ring-2 ring-emerald-400" : ""
                        }`}>
                          {/* Bar A */}
                          <div
                            style={{ height: `${Math.max(heightA, 2)}%` }}
                            className="w-2.5 sm:w-3.5 bg-emerald-700 hover:brightness-110 rounded-t-sm transition-all duration-300 relative"
                            title={`Tim A: ${m.effTeam.A.toFixed(2)}%`}
                          />
                          {/* Bar B */}
                          <div
                            style={{ height: `${Math.max(heightB, 2)}%` }}
                            className="w-2.5 sm:w-3.5 bg-emerald-500 hover:brightness-110 rounded-t-sm transition-all duration-300 relative"
                            title={`Tim B: ${m.effTeam.B.toFixed(2)}%`}
                          />
                          {/* Bar C */}
                          <div
                            style={{ height: `${Math.max(heightC, 2)}%` }}
                            className="w-2.5 sm:w-3.5 bg-emerald-300 hover:brightness-110 rounded-t-sm transition-all duration-300 relative"
                            title={`Tim C: ${m.effTeam.C.toFixed(2)}%`}
                          />
                        </div>

                        {/* Machine X-Label */}
                        <span className={`text-[11px] font-bold mt-1.5 transition-colors ${
                          isHovered ? "text-emerald-700 font-extrabold scale-105" : "text-slate-600"
                        }`}>
                          {m.machineId}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center gap-1.5 mt-2">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Efisiensi dihitung berdasarkan persentase pencapaian target 100%.</span>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            GRAFIK 3: RASIO CACAT PER TIM (%)
        ───────────────────────────────────────────────────────────── */}
        {(activeTab === "ALL" || activeTab === "DEFECT") && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 tracking-tight">Rasio Cacat per Tim</h3>
                    <p className="text-[11px] text-slate-400">Rasio cacat terhadap hasil produksi (%)</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                  Rata-rata: {period.totalRow.cacatPerTeam.avg.toFixed(2)}%
                </span>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 py-2 border-y border-slate-100 mb-4 text-xs font-bold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-rose-700"></span>
                  <span>Tim A ({period.totalRow.cacatPerTeam.A.toFixed(1)}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-rose-500"></span>
                  <span>Tim B ({period.totalRow.cacatPerTeam.B.toFixed(1)}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-rose-300"></span>
                  <span>Tim C ({period.totalRow.cacatPerTeam.C.toFixed(1)}%)</span>
                </div>
              </div>

              {/* Bar Chart Container */}
              <div className="h-64 w-full relative flex items-end pt-4 pb-6 px-2">
                {/* Y-Axis Guide Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 text-[10px] text-slate-400 font-mono">
                  <div className="border-b border-dashed border-slate-200 w-full flex justify-between">
                    <span>{niceMaxDefect}%</span>
                  </div>
                  <div className="border-b border-dashed border-slate-200 w-full flex justify-between">
                    <span>{Math.round(niceMaxDefect / 2)}%</span>
                  </div>
                  <div className="border-b border-slate-200 w-full flex justify-between">
                    <span>0%</span>
                  </div>
                </div>

                {/* Floating Safe Tooltip Overlay (Never clipped) */}
                {hoveredIndex?.chart === "defect" && activeList[hoveredIndex.mcIndex] && (
                  <div
                    className={`absolute top-0 z-30 bg-slate-900/95 backdrop-blur-sm text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs pointer-events-none animate-fadeIn transition-all ${
                      hoveredIndex.mcIndex > activeList.length / 2 ? "left-2" : "right-2"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 border-b border-slate-700 pb-1.5 mb-1.5">
                      <span className="font-extrabold text-rose-300">Mesin {activeList[hoveredIndex.mcIndex].machineId}</span>
                      <span className="font-mono font-bold text-rose-400">Rata-rata: {activeList[hoveredIndex.mcIndex].cacatPerTeam.avg.toFixed(2)}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-[11px]">
                      <div className="flex flex-col">
                        <span className="text-slate-400 font-medium">Tim A</span>
                        <span className="font-mono font-bold text-white text-sm">{activeList[hoveredIndex.mcIndex].cacatPerTeam.A.toFixed(1)}%</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 font-medium">Tim B</span>
                        <span className="font-mono font-bold text-white text-sm">{activeList[hoveredIndex.mcIndex].cacatPerTeam.B.toFixed(1)}%</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 font-medium">Tim C</span>
                        <span className="font-mono font-bold text-white text-sm">{activeList[hoveredIndex.mcIndex].cacatPerTeam.C.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bars per Machine */}
                <div className="flex items-end justify-between w-full h-full gap-2 z-10 min-w-[300px]">
                  {activeList.map((m, idx) => {
                    const heightA = niceMaxDefect > 0 ? (m.cacatPerTeam.A / niceMaxDefect) * 100 : 0;
                    const heightB = niceMaxDefect > 0 ? (m.cacatPerTeam.B / niceMaxDefect) * 100 : 0;
                    const heightC = niceMaxDefect > 0 ? (m.cacatPerTeam.C / niceMaxDefect) * 100 : 0;
                    const isHovered = hoveredIndex?.chart === "defect" && hoveredIndex?.mcIndex === idx;

                    return (
                      <div
                        key={m.machineId}
                        className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                        onMouseEnter={() => setHoveredIndex({ chart: "defect", mcIndex: idx })}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        {/* Bars Group (A, B, C) */}
                        <div className={`flex items-end justify-center gap-0.5 w-full h-[85%] rounded-lg transition-all p-0.5 ${
                          isHovered ? "bg-rose-50/80 ring-2 ring-rose-400" : ""
                        }`}>
                          {/* Bar A */}
                          <div
                            style={{ height: `${Math.max(heightA, 2)}%` }}
                            className="w-2.5 sm:w-3.5 bg-rose-700 hover:brightness-110 rounded-t-sm transition-all duration-300 relative"
                            title={`Tim A: ${m.cacatPerTeam.A.toFixed(2)}%`}
                          />
                          {/* Bar B */}
                          <div
                            style={{ height: `${Math.max(heightB, 2)}%` }}
                            className="w-2.5 sm:w-3.5 bg-rose-500 hover:brightness-110 rounded-t-sm transition-all duration-300 relative"
                            title={`Tim B: ${m.cacatPerTeam.B.toFixed(2)}%`}
                          />
                          {/* Bar C */}
                          <div
                            style={{ height: `${Math.max(heightC, 2)}%` }}
                            className="w-2.5 sm:w-3.5 bg-rose-300 hover:brightness-110 rounded-t-sm transition-all duration-300 relative"
                            title={`Tim C: ${m.cacatPerTeam.C.toFixed(2)}%`}
                          />
                        </div>

                        {/* Machine X-Label */}
                        <span className={`text-[11px] font-bold mt-1.5 transition-colors ${
                          isHovered ? "text-rose-700 font-extrabold scale-105" : "text-slate-600"
                        }`}>
                          {m.machineId}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center gap-1.5 mt-2">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Semakin rendah rasio cacat, semakin baik performa mesin dan kualitas kain.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
