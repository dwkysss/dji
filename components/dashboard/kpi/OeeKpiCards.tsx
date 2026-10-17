"use client";

import React from "react";
import DeltaBadge from "./DeltaBadge";
import { formatDuration } from "./kpiUtils";

export interface OeeKpiCardsProps {
  gradeLabel: string;
  stats: {
    oee: number;
    availability: number;
    performance: number;
    quality: number;
    fpyPanel: number;
    fpyMeteran: number;
    totalDowntimeDetik: number;
    totalHasilPcs: number;
    totalTarget: number;
    countMasalahPanel: number;
    countMasalahMeteran: number;
    totalPanelValid: number;
    totalProduksiMeter: number;
  };
  deltas: {
    oee: { value: number; type: "up" | "down" | "neutral" };
    availability: { value: number; type: "up" | "down" | "neutral" };
    performance: { value: number; type: "up" | "down" | "neutral" };
    totalProduksiMeter: { value: number; type: "up" | "down" | "neutral" };
    quality: { value: number; type: "up" | "down" | "neutral" };
  };
  activeFilter: "ALL" | "LOLOS" | "EFISIENSI" | "PROBLEMS" | "NOL_PRODUKSI";
  setActiveFilter: (filter: "ALL" | "LOLOS" | "EFISIENSI" | "PROBLEMS" | "NOL_PRODUKSI") => void;
  metricMode: "PCS" | "METER";
  setMetricMode: (mode: "PCS" | "METER") => void;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchEndMetric: (e: React.TouchEvent) => void;
}

export default function OeeKpiCards({
  gradeLabel,
  stats,
  deltas,
  activeFilter,
  setActiveFilter,
  metricMode,
  setMetricMode,
  handleTouchStart,
  handleTouchEndMetric,
}: OeeKpiCardsProps) {
  return (
    <>
      {/* Card 1: OEE Score (Master KPI) */}
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl h-full min-h-[11rem] bg-[#004777] shadow-xl ring-2 ring-[#0070bc] ring-offset-2 text-white p-5 flex flex-col justify-between transition-all duration-300 group">
        <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-sky-400/20 blur-xl group-hover:scale-125 transition-all duration-300 pointer-events-none" />

        <div className="flex justify-between items-start relative z-10">
          <span className="text-sky-100 text-[10px] font-bold uppercase tracking-wider">
            Overall OEE Score ({gradeLabel})
          </span>
          <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white text-[10px] font-bold">
            OEE
          </span>
        </div>
        <div className="mt-2 relative z-10">
          <div className="text-4xl font-black tracking-tight flex items-baseline gap-1">
            {stats.oee.toFixed(1)}%
          </div>
          <div className="flex flex-col mt-2 gap-1 text-[10px] text-sky-200 font-semibold border-t border-white/10 pt-2">
            <div className="flex justify-between">
              <span>Availability:</span>
              <span>{stats.availability.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Performance:</span>
              <span>{stats.performance.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Quality (FPY):</span>
              <span>{stats.quality.toFixed(1)}%</span>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 text-[10px] text-sky-100/90 font-bold">
            <span>Delta vs prior:</span>
            <span
              className={`font-black ${
                deltas.oee.type === "up"
                  ? "text-emerald-400"
                  : deltas.oee.type === "down"
                  ? "text-rose-400"
                  : "text-sky-200"
              }`}
            >
              {deltas.oee.type === "up"
                ? "▲ +"
                : deltas.oee.type === "down"
                ? "▼ "
                : ""}
              {deltas.oee.value}%
            </span>
          </div>
        </div>
      </div>

      {/* Card 2: Availability (Ketersediaan Mesin) */}
      <div
        onClick={() => setActiveFilter("ALL")}
        className={`relative overflow-hidden rounded-xl sm:rounded-2xl h-full min-h-[11rem] border border-[#e9ecef] cursor-pointer p-5 flex flex-col justify-between transition-all duration-300 ${
          activeFilter === "ALL" && metricMode === "PCS"
            ? "bg-slate-50/50 border-slate-500 text-slate-800 shadow-md"
            : "bg-white border-[#e9ecef] text-slate-800 hover:scale-[1.01] hover:shadow-xs"
        }`}
      >
        <div className="flex justify-between items-start relative z-10">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            Availability (Ketersediaan)
          </span>
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-100 text-slate-500">
            A
          </span>
        </div>
        <div className="mt-2 relative z-10">
          <div className="text-3xl font-black tracking-tight text-slate-800 flex items-baseline gap-1">
            {stats.availability.toFixed(1)}%
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] font-extrabold text-slate-500">
            <span>
              Downtime: {formatDuration(stats.totalDowntimeDetik)}
            </span>
          </div>
          <div className="mt-3 border-t border-slate-100 pt-2 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold">
              Tren:
            </span>
            <DeltaBadge delta={deltas.availability} />
          </div>
        </div>
      </div>

      {/* Card 3: Performance (Kinerja Produksi) */}
      <div
        className="relative overflow-hidden rounded-xl sm:rounded-2xl h-full min-h-[11rem] border transition-all duration-300 flex flex-col bg-white border-[#e9ecef] text-slate-800 hover:scale-[1.01] hover:shadow-xs"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEndMetric}
      >
        <div
          className="flex h-full w-[200%] transition-transform duration-500 ease-in-out"
          style={{
            transform: `translateX(-${metricMode === "PCS" ? 0 : 50}%)`,
          }}
        >
          {/* Slide 0: Performance Pcs */}
          <div
            onClick={() => setMetricMode("PCS")}
            className="w-1/2 cursor-pointer p-5 flex flex-col justify-between h-full relative"
          >
            <div className="flex justify-between items-start relative z-10">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                Performance Rate (PANEL)
              </span>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-100 text-slate-500">
                P
              </span>
            </div>
            <div className="mt-2 relative z-10">
              <div className="text-3xl font-black tracking-tight text-slate-800">
                {stats.performance.toFixed(1)}%
              </div>
              <div className="flex items-center gap-1 mt-1 text-[11px] text-[#0070bc] font-bold">
                <span>
                  {stats.totalHasilPcs.toLocaleString()} /{" "}
                  {stats.totalTarget.toLocaleString()} Panel
                </span>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-2 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold">
                  Tren:
                </span>
                <DeltaBadge delta={deltas.performance} />
              </div>
            </div>
          </div>

          {/* Slide 1: Production Meter */}
          <div
            onClick={() => setMetricMode("METER")}
            className="w-1/2 cursor-pointer p-5 flex flex-col justify-between h-full relative"
          >
            <div className="flex justify-between items-start relative z-10">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                Volume Produksi (METER)
              </span>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-100 text-slate-500">
                V
              </span>
            </div>
            <div className="mt-2 relative z-10">
              <div className="text-3xl font-black tracking-tight text-slate-800">
                {stats.totalProduksiMeter.toLocaleString()} m
              </div>
              <div className="flex items-center gap-1 mt-1 text-[11px] text-[#0070bc] font-bold">
                <span>Total Gulungan</span>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-2 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold">
                  Tren:
                </span>
                <DeltaBadge delta={deltas.totalProduksiMeter} />
              </div>
            </div>
          </div>
        </div>

        {/* Dots Indicator */}
        <div
          className="absolute bottom-3 right-3 flex items-center gap-1 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setMetricMode("PCS")}
            className="p-3 -m-3 cursor-pointer"
            title="Geser ke PCS"
          >
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                metricMode === "PCS" ? "w-4 bg-slate-800" : "w-1.5 bg-slate-300"
              }`}
            />
          </button>
          <button
            onClick={() => setMetricMode("METER")}
            className="p-3 -m-3 cursor-pointer ml-3"
            title="Geser ke METER"
          >
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                metricMode === "METER" ? "w-4 bg-slate-800" : "w-1.5 bg-slate-300"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Card 4: Quality / FPY (First Pass Yield) */}
      <div
        className="relative overflow-hidden rounded-xl sm:rounded-2xl h-full min-h-[11rem] border transition-all duration-300 flex flex-col bg-white border-[#e9ecef] text-slate-800 hover:scale-[1.01] hover:shadow-xs"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEndMetric}
      >
        <div
          className="flex h-full w-[200%] transition-transform duration-500 ease-in-out"
          style={{
            transform: `translateX(-${metricMode === "PCS" ? 0 : 50}%)`,
          }}
        >
          {/* Slide 0: Quality Panel */}
          <div
            onClick={() => setMetricMode("PCS")}
            className="w-1/2 cursor-pointer p-5 flex flex-col justify-between h-full relative"
          >
            <div className="flex justify-between items-start relative z-10">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                First Pass Yield (Panel)
              </span>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-100 text-slate-500">
                Q
              </span>
            </div>
            <div className="mt-2 relative z-10">
              <div className="text-3xl font-black tracking-tight text-slate-800">
                {stats.fpyPanel.toFixed(1)}%
              </div>
              <div className="flex items-center gap-1 mt-1 text-[11px] text-[#0070bc] font-bold">
                <span>
                  Cacat: {stats.countMasalahPanel} dari {stats.totalPanelValid} panel
                </span>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-2 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold">
                  Tren:
                </span>
                <DeltaBadge delta={deltas.quality} />
              </div>
            </div>
          </div>

          {/* Slide 1: Quality Meteran */}
          <div
            onClick={() => setMetricMode("METER")}
            className="w-1/2 cursor-pointer p-5 flex flex-col justify-between h-full relative"
          >
            <div className="flex justify-between items-start relative z-10">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                Quality Rate (METER)
              </span>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-100 text-slate-500">
                Q
              </span>
            </div>
            <div className="mt-2 relative z-10">
              <div className="text-3xl font-black tracking-tight text-slate-800">
                {stats.fpyMeteran.toFixed(1)}%
              </div>
              <div className="flex items-center gap-1 mt-1 text-[11px] text-[#0070bc] font-bold">
                <span>
                  Cacat: {stats.countMasalahMeteran} titik / {stats.totalProduksiMeter.toFixed(0)}m
                </span>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-2 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold">
                  Tren:
                </span>
                <DeltaBadge delta={deltas.quality} />
              </div>
            </div>
          </div>
        </div>

        {/* Dots Indicator */}
        <div
          className="absolute bottom-3 right-3 flex items-center gap-1 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setMetricMode("PCS")}
            className="p-3 -m-3 cursor-pointer"
            title="Geser ke Quality Panel"
          >
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                metricMode === "PCS" ? "w-4 bg-slate-800" : "w-1.5 bg-slate-300"
              }`}
            />
          </button>
          <button
            onClick={() => setMetricMode("METER")}
            className="p-3 -m-3 cursor-pointer ml-3"
            title="Geser ke Quality Meter"
          >
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                metricMode === "METER" ? "w-4 bg-slate-800" : "w-1.5 bg-slate-300"
              }`}
            />
          </button>
        </div>
      </div>
    </>
  );
}
