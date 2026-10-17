"use client";

import React from "react";
import { SlidersHorizontal } from "lucide-react";

export interface MetricModeSlicerProps {
  metricMode: "PCS" | "METER";
  setMetricMode: (mode: "PCS" | "METER") => void;
  setSelectedMachines: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function MetricModeSlicer({
  metricMode,
  setMetricMode,
  setSelectedMachines,
}: MetricModeSlicerProps) {
  return (
    <div className="bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-1.5 sm:px-3 sm:py-2 shadow-[0_8px_30px_rgba(0,0,0,0.015)] col-span-2 sm:col-span-1 lg:w-auto shrink-0 flex items-center justify-between sm:justify-start gap-2 sm:gap-2.5">
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="p-1 rounded-lg bg-slate-50 border border-slate-200/60 text-slate-400 shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] sm:text-xs font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
          Kategori:
        </span>
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-50 p-1 rounded-xl border border-slate-150 shrink-0">
        <button
          onClick={() => {
            setMetricMode("PCS");
            setSelectedMachines([]);
          }}
          className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer text-center ${
            metricMode === "PCS"
              ? "bg-white text-slate-800 shadow-xs border border-slate-150"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Panel
        </button>
        <button
          onClick={() => {
            setMetricMode("METER");
            setSelectedMachines([]);
          }}
          className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer text-center ${
            metricMode === "METER"
              ? "bg-white text-slate-800 shadow-xs border border-slate-150"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Meteran
        </button>
      </div>
    </div>
  );
}
