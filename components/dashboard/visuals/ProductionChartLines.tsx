"use client";

import React from "react";
import { ChartDataItem } from "./chartDataUtils";

export interface ProductionChartLinesProps {
  chartData: ChartDataItem[];
  totalWidth: number;
  maxChartValue: number;
  qualityViewMode: "QC_GRADE" | "OPERATOR_STATUS";
  operatorStatusFilter: "ALL" | "CEKLIS" | "SILANG";
  chartGradeFilter: "ALL" | "GRADE_A" | "GRADE_B" | "BS" | "UNGRADED";
}

export default function ProductionChartLines({
  chartData,
  totalWidth,
  maxChartValue,
  qualityViewMode,
  operatorStatusFilter,
  chartGradeFilter,
}: ProductionChartLinesProps) {
  const getX = (index: number) => {
    const spacing = totalWidth / Math.max(chartData.length, 1);
    return 40 + spacing * index + spacing / 2;
  };

  const getY = (val: number) => {
    const h = maxChartValue > 0 ? (val / maxChartValue) * 175 : 0;
    return 195 - Math.max(h, 1.5);
  };

  const getPoints = (getValue: (d: ChartDataItem) => number) => {
    return chartData
      .map((d, index) => `${getX(index)},${getY(getValue(d))}`)
      .join(" ");
  };

  if (qualityViewMode === "OPERATOR_STATUS") {
    return (
      <>
        {(operatorStatusFilter === "ALL" || operatorStatusFilter === "CEKLIS") && (
          <polyline
            points={getPoints((d) => d.ceklis_sum)}
            fill="none"
            stroke="#0070bc"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {(operatorStatusFilter === "ALL" || operatorStatusFilter === "SILANG") && (
          <polyline
            points={getPoints((d) => d.silang_sum)}
            fill="none"
            stroke="#ef4444"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </>
    );
  }

  return (
    <>
      {chartGradeFilter === "ALL" && (
        <polyline
          points={getPoints((d) => d.total)}
          fill="none"
          stroke="#334155"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {chartGradeFilter === "GRADE_A" && (
        <polyline
          points={getPoints((d) => d.gradeA_sum)}
          fill="none"
          stroke="#0070bc"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {chartGradeFilter === "GRADE_B" && (
        <polyline
          points={getPoints((d) => d.gradeB_sum)}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {chartGradeFilter === "BS" && (
        <polyline
          points={getPoints((d) => d.bs_sum)}
          fill="none"
          stroke="#ef4444"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {chartGradeFilter === "UNGRADED" && (
        <polyline
          points={getPoints((d) => d.ungraded_sum)}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </>
  );
}
