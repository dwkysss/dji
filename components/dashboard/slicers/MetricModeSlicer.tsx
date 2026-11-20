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
    <div className="bg-slate-50/75 border border-slate-200/75 rounded-xl px-2.5 py-2 col-span-2 lg:w-auto shrink-0 flex items-center justify-between lg:justify-start gap-2.5">
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-6 h-6 rounded-lg bg-white border border-slate-200/80 text-[#0070bc] flex items-center justify-center shrink-0 shadow-2xs">
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
          Kategori
        </span>
      </div>
      <div className="flex items-center gap-0.5 bg-slate-200/60 p-0.5 rounded-lg shrink-0">
        <button
          type="button"
          onClick={() => {
            setMetricMode("PCS");
            setSelectedMachines([]);
          }}
          className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer text-center whitespace-nowrap ${
            metricMode === "PCS"
              ? "bg-[#0070bc] text-white shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          Panel
        </button>
        <button
          type="button"
          onClick={() => {
            setMetricMode("METER");
            setSelectedMachines([]);
          }}
          className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer text-center whitespace-nowrap ${
            metricMode === "METER"
              ? "bg-[#0070bc] text-white shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          All Over
        </button>
      </div>
    </div>
  );
}
