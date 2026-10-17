"use client";

import React, { useMemo } from "react";
import { ShieldCheck, CheckCircle2, RefreshCw } from "lucide-react";
import { DashboardTransaction } from "@/hooks/useDashboardKpis";
import { computeQualityStats } from "./qualityDonutUtils";
import QualityDonutSvg from "./QualityDonutSvg";
import QualityDonutBreakdownList from "./QualityDonutBreakdownList";

export interface DashboardQualityDonutProps {
  filteredData: DashboardTransaction[];
  metricMode: "PCS" | "METER";
  qualityViewMode: "QC_GRADE" | "OPERATOR_STATUS";
  setQualityViewMode: (mode: "QC_GRADE" | "OPERATOR_STATUS") => void;
  isLoading?: boolean;
}

export default function DashboardQualityDonut({
  filteredData,
  metricMode,
  qualityViewMode,
  setQualityViewMode,
  isLoading,
}: DashboardQualityDonutProps) {
  const qualityStats = useMemo(() => {
    return computeQualityStats(filteredData, metricMode);
  }, [filteredData, metricMode]);

  const totalValue =
    qualityViewMode === "OPERATOR_STATUS"
      ? qualityStats.totalOperator
      : qualityStats.totalQuality;

  const unitLabel = metricMode === "PCS" ? "Panel" : "Meter";

  return (
    <div className="space-y-6 flex flex-col flex-1">
      <div className="bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col justify-between flex-1">
        <div>
          <div className="border-b border-slate-100 pb-4 mb-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-800 tracking-tight">
                  {qualityViewMode === "OPERATOR_STATUS"
                    ? "Status Input Operator"
                    : "Ringkasan Kualitas"}
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                  {qualityViewMode === "OPERATOR_STATUS"
                    ? "Proporsi Normal vs Cacat"
                    : "Persentase barang berdasarkan Grade"}
                </p>
              </div>
              <span className="text-[11px] font-black px-3 py-1 rounded-full bg-sky-50 text-[#0070bc] border border-sky-100/80 whitespace-nowrap shadow-2xs shrink-0">
                {totalValue} {unitLabel}
              </span>
            </div>

            {/* Mode Switcher Controls */}
            <div className="mt-3 flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100/60">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                Mode:
              </span>
              <div className="inline-flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setQualityViewMode("QC_GRADE")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                    qualityViewMode === "QC_GRADE"
                      ? "bg-white text-[#0070bc] shadow-xs border border-slate-200/80"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  Grade QC
                </button>
                <button
                  type="button"
                  onClick={() => setQualityViewMode("OPERATOR_STATUS")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                    qualityViewMode === "OPERATOR_STATUS"
                      ? "bg-white text-emerald-600 shadow-xs border border-slate-200/80"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Input Operator
                </button>
              </div>
            </div>
          </div>

          {isLoading && filteredData.length === 0 ? (
            <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 mt-2">
              <div className="w-20 h-20 rounded-full border-4 border-sky-100 border-t-[#0070bc] animate-spin mb-3.5" />
              <div className="flex items-center gap-2 text-xs font-bold text-sky-700">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0070bc]" />
                <span>Memuat ringkasan mutu...</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                Mengkalkulasi proporsi grade QC
              </p>
            </div>
          ) : (
            <>
              <QualityDonutSvg
                qualityViewMode={qualityViewMode}
                qualityStats={qualityStats}
              />

              <QualityDonutBreakdownList
                qualityViewMode={qualityViewMode}
                metricMode={metricMode}
                qualityStats={qualityStats}
              />
            </>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4 mt-6 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            {qualityViewMode === "OPERATOR_STATUS"
              ? "Ringkasan Status Operator"
              : "Ringkasan Kualifikasi"}
          </span>
        </div>
      </div>
    </div>
  );
}
