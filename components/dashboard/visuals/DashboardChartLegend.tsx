"use client";

import React from "react";

export interface DashboardChartLegendProps {
  qualityViewMode: "QC_GRADE" | "OPERATOR_STATUS";
}

export default function DashboardChartLegend({ qualityViewMode }: DashboardChartLegendProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-3.5 mt-3 border-t border-slate-100/60">
      {qualityViewMode === "OPERATOR_STATUS" ? (
        <>
          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-600 uppercase tracking-wider">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0070bc] flex items-center justify-center text-white text-[7px] font-black">
              ✓
            </span>
            <span>Normal</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-600 uppercase tracking-wider">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] flex items-center justify-center text-white text-[7px] font-black">
              ✕
            </span>
            <span>Cacat</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-600 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#0070bc]" />
            <span>Grade A</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-600 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            <span>Grade B</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-600 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
            <span>BS</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-600 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#94a3b8]" />
            <span>Belum Diinspeksi</span>
          </div>
        </>
      )}
    </div>
  );
}
