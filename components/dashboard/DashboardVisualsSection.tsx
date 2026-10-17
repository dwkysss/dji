"use client";

import React, { useState, useMemo } from "react";
import { DashboardTransaction, isMeterItem } from "@/hooks/useDashboardKpis";
import { isBsAwalAkhir, isPanelGagalCacat, hasRealDefect } from "@/lib/mending-grade-utils";
import { buildCategoryBreakdown } from "./visuals/chartDataUtils";
import DashboardProductionChart from "./visuals/DashboardProductionChart";
import DashboardQualityDonut from "./visuals/DashboardQualityDonut";

export interface DashboardVisualsSectionProps {
  dateFilteredTransactions: DashboardTransaction[];
  metricMode: "PCS" | "METER";
  activeFilter: "ALL" | "LOLOS" | "EFISIENSI" | "PROBLEMS" | "NOL_PRODUKSI";
  chartGradeFilter: "ALL" | "GRADE_A" | "GRADE_B" | "BS" | "UNGRADED";
  setChartGradeFilter: (val: "ALL" | "GRADE_A" | "GRADE_B" | "BS" | "UNGRADED") => void;
  dateRangeMode: "TODAY" | "7DAYS" | "30DAYS" | "CUSTOM";
  startDate?: string;
  endDate?: string;
  isLoading?: boolean;
}

export const DashboardVisualsSection: React.FC<DashboardVisualsSectionProps> = ({
  dateFilteredTransactions,
  metricMode,
  activeFilter,
  chartGradeFilter,
  setChartGradeFilter,
  dateRangeMode,
  startDate,
  endDate,
  isLoading,
}) => {
  const [qualityViewMode, setQualityViewMode] = useState<"QC_GRADE" | "OPERATOR_STATUS">("QC_GRADE");

  // Filter criteria logic
  const filteredData = useMemo(() => {
    const isMeterMode = metricMode === "METER";
    const categoryScoped = dateFilteredTransactions.filter((item) => {
      const isMeter = isMeterItem(item);
      return isMeterMode ? isMeter : !isMeter;
    });

    const validProductionData = categoryScoped.filter(
      (item) => item.is_production,
    );

    switch (activeFilter) {
      case "LOLOS":
        return validProductionData.filter(
          (item) => item.status_qc === "Lolos" || isPanelGagalCacat(item) || !hasRealDefect(item)
        );
      case "EFISIENSI":
        return validProductionData.filter((item) => {
          const ef = item.target_pcs > 0 ? (item.hasil_pcs / item.target_pcs) * 100 : 0;
          return ef >= 90;
        });
      case "PROBLEMS":
        return categoryScoped.filter(
          (item) =>
            !isBsAwalAkhir(item) &&
            !isPanelGagalCacat(item) &&
            hasRealDefect(item) &&
            (item.status_qc === "Recheck" ||
              item.grade === "BS" ||
              (item.kategori_masalah && item.kategori_masalah.trim() !== ""))
        );
      case "NOL_PRODUKSI":
        return validProductionData.filter((item) => item.hasil_pcs === 0);
      case "ALL":
      default:
        return validProductionData;
    }
  }, [activeFilter, dateFilteredTransactions, metricMode]);

  const categoryBreakdown = useMemo(() => {
    return buildCategoryBreakdown(dateFilteredTransactions);
  }, [dateFilteredTransactions]);

  // Deteksi apakah dashboard sedang menampilkan rentang waktu 1 hari saja
  const isSingleDay = useMemo(() => {
    if (dateRangeMode === "TODAY") return true;
    if (dateRangeMode === "CUSTOM" && startDate && endDate && startDate === endDate) return true;
    const uniqueDates = new Set(filteredData.map((d) => d.tanggal).filter(Boolean));
    return uniqueDates.size <= 1;
  }, [dateRangeMode, startDate, endDate, filteredData]);

  return (
    <div
      data-tour="dashboard-visuals"
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      <DashboardProductionChart
        filteredData={filteredData}
        metricMode={metricMode}
        activeFilter={activeFilter}
        chartGradeFilter={chartGradeFilter}
        setChartGradeFilter={setChartGradeFilter}
        qualityViewMode={qualityViewMode}
        setQualityViewMode={setQualityViewMode}
        isSingleDay={isSingleDay}
        categoryList={categoryBreakdown.list}
        isLoading={isLoading}
      />
      <DashboardQualityDonut
        filteredData={filteredData}
        metricMode={metricMode}
        qualityViewMode={qualityViewMode}
        setQualityViewMode={setQualityViewMode}
        isLoading={isLoading}
      />
    </div>
  );
};

export default DashboardVisualsSection;
