"use client";

import React from "react";
import { QualityStats } from "./qualityDonutUtils";

export interface QualityDonutBreakdownListProps {
  qualityViewMode: "QC_GRADE" | "OPERATOR_STATUS";
  metricMode: "PCS" | "METER";
  qualityStats: QualityStats;
}

export default function QualityDonutBreakdownList({
  qualityViewMode,
  metricMode,
  qualityStats,
}: QualityDonutBreakdownListProps) {
  const {
    totalA,
    totalB,
    totalBS,
    totalUngraded,
    totalCeklis,
    totalSilang,
    pctCeklis,
    pctSilang,
  } = qualityStats;

  const unitLabel = metricMode === "PCS" ? "Panel" : "Meter";

  if (qualityViewMode === "OPERATOR_STATUS") {
    return (
      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded-full bg-sky-100 text-[#0070bc] flex items-center justify-center text-[10px] font-black">
              ✓
            </span>
            <div>
              <span className="text-xs font-extrabold text-slate-700 block">
                Normal
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">
                {pctCeklis.toFixed(1)}% dari total input
              </span>
            </div>
          </div>
          <div className="text-right flex items-baseline gap-1.5">
            <span className="text-sm font-black text-slate-800">
              {totalCeklis}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">
              {unitLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] font-black">
              ✕
            </span>
            <div>
              <span className="text-xs font-extrabold text-slate-700 block">
                Cacat
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">
                {pctSilang.toFixed(1)}% dari total input
              </span>
            </div>
          </div>
          <div className="text-right flex items-baseline gap-1.5">
            <span className="text-sm font-black text-slate-800">
              {totalSilang}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">
              {unitLabel}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-3">
      <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-[#0070bc]" />
          <span className="text-xs font-extrabold text-slate-700">
            Grade A (Lolos)
          </span>
        </div>
        <div className="text-right flex items-baseline gap-1.5">
          <span className="text-sm font-black text-slate-800">{totalA}</span>
          <span className="text-[10px] text-slate-400 font-bold">{unitLabel}</span>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
          <span className="text-xs font-extrabold text-slate-700">
            Grade B (Lolos)
          </span>
        </div>
        <div className="text-right flex items-baseline gap-1.5">
          <span className="text-sm font-black text-slate-800">{totalB}</span>
          <span className="text-[10px] text-slate-400 font-bold">{unitLabel}</span>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
          <span className="text-xs font-extrabold text-slate-700">
            BS (Recheck)
          </span>
        </div>
        <div className="text-right flex items-baseline gap-1.5">
          <span className="text-sm font-black text-slate-800">{totalBS}</span>
          <span className="text-[10px] text-slate-400 font-bold">{unitLabel}</span>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-[#94a3b8]" />
          <div>
            <span className="text-xs font-extrabold text-slate-700 block">
              Belum Diinspeksi (Ungraded)
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">
              Input: {totalCeklis} Ceklis • {totalSilang} Silang
            </span>
          </div>
        </div>
        <div className="text-right flex items-baseline gap-1.5">
          <span className="text-sm font-black text-slate-800">{totalUngraded}</span>
          <span className="text-[10px] text-slate-400 font-bold">{unitLabel}</span>
        </div>
      </div>
    </div>
  );
}
