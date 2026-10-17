"use client";

import React from "react";
import OeeKpiCards from "./kpi/OeeKpiCards";
import ClassicKpiCards from "./kpi/ClassicKpiCards";

export interface DashboardKpiCardsProps {
  dashboardViewType: "CLASSIC" | "OEE";
  isRefreshing: boolean;
  isLoadingInitial: boolean;
  transactionsCount: number;
  cachedKpiSummary: any;
  gradeLabel: string;
  stats: {
    totalProduksi: number;
    totalProduksiMeter: number;
    persentaseCacatPanel: number;
    persentaseCacatMeteran: number;
    countMasalahPanel: number;
    countMasalahMeteran: number;
    totalPanelValid: number;
    efisiensi: number;
    totalDowntimeDetik: number;
    countMasalah: number;
    oee: number;
    availability: number;
    performance: number;
    quality: number;
    fpyPanel: number;
    fpyMeteran: number;
    totalHasilPcs: number;
    totalTarget: number;
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

export default function DashboardKpiCards({
  dashboardViewType,
  isRefreshing,
  isLoadingInitial,
  transactionsCount,
  cachedKpiSummary,
  gradeLabel,
  stats,
  deltas,
  activeFilter,
  setActiveFilter,
  metricMode,
  setMetricMode,
  handleTouchStart,
  handleTouchEndMetric,
}: DashboardKpiCardsProps) {
  return (
    <>
      {/* Active Refreshing Indicator: High-tech progress shimmer line */}
      {isRefreshing && (
        <div className="relative w-full h-1 bg-sky-100/70 rounded-full overflow-hidden mb-2.5 shadow-xs">
          <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-sky-400 via-[#0070bc] to-sky-400 rounded-full animate-progressShimmer shadow-[0_0_10px_rgba(0,112,188,0.6)]" />
        </div>
      )}

      {/* Grid KPI Cards / Slicer Buttons */}
      <div
        data-tour="dashboard-kpi"
        className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-5"
      >
        {dashboardViewType === "OEE" ? (
          <OeeKpiCards
            gradeLabel={gradeLabel}
            stats={stats}
            deltas={deltas}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            metricMode={metricMode}
            setMetricMode={setMetricMode}
            handleTouchStart={handleTouchStart}
            handleTouchEndMetric={handleTouchEndMetric}
          />
        ) : (
          <ClassicKpiCards
            isRefreshing={isRefreshing}
            isLoadingInitial={isLoadingInitial}
            transactionsCount={transactionsCount}
            cachedKpiSummary={cachedKpiSummary}
            gradeLabel={gradeLabel}
            stats={stats}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            metricMode={metricMode}
            setMetricMode={setMetricMode}
            handleTouchStart={handleTouchStart}
            handleTouchEndMetric={handleTouchEndMetric}
          />
        )}
      </div>
    </>
  );
}
