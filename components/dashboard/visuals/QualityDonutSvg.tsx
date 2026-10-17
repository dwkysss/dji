"use client";

import React from "react";
import { QualityStats } from "./qualityDonutUtils";

export interface QualityDonutSvgProps {
  qualityViewMode: "QC_GRADE" | "OPERATOR_STATUS";
  qualityStats: QualityStats;
}

export default function QualityDonutSvg({
  qualityViewMode,
  qualityStats,
}: QualityDonutSvgProps) {
  const { pctA, pctB, pctBS, pctUngraded, pctCeklis, pctSilang } = qualityStats;

  return (
    <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="transparent"
          stroke="#f1f5f9"
          strokeWidth="12"
        />
        {qualityViewMode === "OPERATOR_STATUS" ? (
          <>
            {pctCeklis > 0 && (
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#0070bc"
                strokeWidth="12"
                strokeDasharray={`${(pctCeklis / 100) * 251.2} 251.2`}
                strokeDashoffset="0"
                className="transition-all duration-1000 ease-out"
              />
            )}
            {pctSilang > 0 && (
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#ef4444"
                strokeWidth="12"
                strokeDasharray={`${(pctSilang / 100) * 251.2} 251.2`}
                strokeDashoffset={`-${(pctCeklis / 100) * 251.2}`}
                className="transition-all duration-1000 ease-out"
              />
            )}
          </>
        ) : (
          <>
            {pctA > 0 && (
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#0070bc"
                strokeWidth="12"
                strokeDasharray={`${(pctA / 100) * 251.2} 251.2`}
                strokeDashoffset="0"
                className="transition-all duration-1000 ease-out"
              />
            )}
            {pctB > 0 && (
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#f59e0b"
                strokeWidth="12"
                strokeDasharray={`${(pctB / 100) * 251.2} 251.2`}
                strokeDashoffset={`-${(pctA / 100) * 251.2}`}
                className="transition-all duration-1000 ease-out"
              />
            )}
            {pctBS > 0 && (
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#ef4444"
                strokeWidth="12"
                strokeDasharray={`${(pctBS / 100) * 251.2} 251.2`}
                strokeDashoffset={`-${((pctA + pctB) / 100) * 251.2}`}
                className="transition-all duration-1000 ease-out"
              />
            )}
            {pctUngraded > 0 && (
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#94a3b8"
                strokeWidth="12"
                strokeDasharray={`${(pctUngraded / 100) * 251.2} 251.2`}
                strokeDashoffset={`-${((pctA + pctB + pctBS) / 100) * 251.2}`}
                className="transition-all duration-1000 ease-out"
              />
            )}
          </>
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-black text-slate-800 tracking-tight">
          {qualityViewMode === "OPERATOR_STATUS"
            ? `${Math.round(pctCeklis)}%`
            : `${Math.round(pctA)}%`}
        </span>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
          {qualityViewMode === "OPERATOR_STATUS" ? "NORMAL" : "GRADE A"}
        </span>
      </div>
    </div>
  );
}
