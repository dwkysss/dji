"use client";

import React, { useState, useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { DashboardTransaction } from "@/hooks/useDashboardKpis";
import { buildChartData, getNiceChartMax } from "./chartDataUtils";
import DashboardChartControls from "./DashboardChartControls";
import ProductionChartSvg from "./ProductionChartSvg";
import DashboardChartLegend from "./DashboardChartLegend";

export interface DashboardProductionChartProps {
  filteredData: DashboardTransaction[];
  metricMode: "PCS" | "METER";
  activeFilter: "ALL" | "LOLOS" | "EFISIENSI" | "PROBLEMS" | "NOL_PRODUKSI";
  chartGradeFilter: "ALL" | "GRADE_A" | "GRADE_B" | "BS" | "UNGRADED";
  setChartGradeFilter: (val: "ALL" | "GRADE_A" | "GRADE_B" | "BS" | "UNGRADED") => void;
  qualityViewMode: "QC_GRADE" | "OPERATOR_STATUS";
  setQualityViewMode: (mode: "QC_GRADE" | "OPERATOR_STATUS") => void;
  isSingleDay: boolean;
  categoryList: [string, number][];
  isLoading?: boolean;
}

export default function DashboardProductionChart({
  filteredData,
  metricMode,
  activeFilter,
  chartGradeFilter,
  setChartGradeFilter,
  qualityViewMode,
  setQualityViewMode,
  isSingleDay,
  categoryList,
  isLoading,
}: DashboardProductionChartProps) {
  const [operatorStatusFilter, setOperatorStatusFilter] = useState<"ALL" | "CEKLIS" | "SILANG">("ALL");
  const [chartGroupBy, setChartGroupBy] = useState<
    "HARI" | "DESIGN" | "PEGAWAI" | "GROUP" | "MESIN" | "KATEGORI"
  >("HARI");
  const [chartType, setChartType] = useState<"BAR" | "LINE">("BAR");
  const [activeChartBar, setActiveChartBar] = useState<number | null>(null);

  const chartData = useMemo(() => {
    return buildChartData({
      filteredData,
      chartGroupBy,
      metricMode,
      qualityViewMode,
      isSingleDay,
      activeFilter,
      categoryList,
    });
  }, [filteredData, chartGroupBy, metricMode, qualityViewMode, isSingleDay, activeFilter, categoryList]);

  const maxChartValue = useMemo(() => {
    if (activeFilter === "PROBLEMS") {
      const maxProblemCount = Math.max(
        ...categoryList.map(([, count]) => count),
        0
      );
      return getNiceChartMax(maxProblemCount);
    }

    if (qualityViewMode === "OPERATOR_STATUS") {
      const maxVisibleValue = Math.max(
        ...chartData.map((item) => {
          if (operatorStatusFilter === "CEKLIS") return item.ceklis_sum;
          if (operatorStatusFilter === "SILANG") return item.silang_sum;
          return Math.max(item.total, item.ceklis_sum, item.silang_sum);
        }),
        0
      );
      return getNiceChartMax(maxVisibleValue);
    }

    const maxVisibleValue = Math.max(
      ...chartData.map((item) => {
        if (chartGradeFilter === "GRADE_A") return item.gradeA_sum;
        if (chartGradeFilter === "GRADE_B") return item.gradeB_sum;
        if (chartGradeFilter === "BS") return item.bs_sum;
        if (chartGradeFilter === "UNGRADED") return item.ungraded_sum;

        return Math.max(
          item.total,
          item.gradeA_sum,
          item.gradeB_sum,
          item.bs_sum,
          item.ungraded_sum
        );
      }),
      0
    );

    return getNiceChartMax(maxVisibleValue);
  }, [activeFilter, categoryList, chartData, chartGradeFilter, qualityViewMode, operatorStatusFilter]);

  return (
    <div className="lg:col-span-2 bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
      <DashboardChartControls
        qualityViewMode={qualityViewMode}
        setQualityViewMode={setQualityViewMode}
        chartGroupBy={chartGroupBy}
        setChartGroupBy={setChartGroupBy}
        isSingleDay={isSingleDay}
        chartType={chartType}
        setChartType={setChartType}
        chartGradeFilter={chartGradeFilter}
        setChartGradeFilter={setChartGradeFilter}
        operatorStatusFilter={operatorStatusFilter}
        setOperatorStatusFilter={setOperatorStatusFilter}
      />

      {isLoading && filteredData.length === 0 ? (
        <div className="flex-1 min-h-[250px] flex flex-col items-center justify-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 mt-4">
          <div className="flex items-end gap-3 h-28 mb-4">
            <div className="w-10 sm:w-12 bg-sky-200/70 rounded-t-md animate-pulse h-14" />
            <div className="w-10 sm:w-12 bg-[#0070bc]/60 rounded-t-md animate-pulse h-24 delay-75" />
            <div className="w-10 sm:w-12 bg-sky-300/70 rounded-t-md animate-pulse h-18 delay-150" />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-sky-700">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0070bc]" />
            <span>Memuat visual grafik produksi...</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">
            Menyelaraskan data shift & rincian mutu
          </p>
        </div>
      ) : (
        <ProductionChartSvg
          chartData={chartData}
          maxChartValue={maxChartValue}
          chartType={chartType}
          qualityViewMode={qualityViewMode}
          operatorStatusFilter={operatorStatusFilter}
          chartGradeFilter={chartGradeFilter}
          activeFilter={activeFilter}
          activeChartBar={activeChartBar}
          setActiveChartBar={setActiveChartBar}
        />
      )}

      <DashboardChartLegend qualityViewMode={qualityViewMode} />
    </div>
  );
}
