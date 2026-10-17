"use client";

import React from "react";
import { ChartDataItem } from "./chartDataUtils";
import ProductionChartLines from "./ProductionChartLines";
import ProductionChartItem from "./ProductionChartItem";

export interface ProductionChartSvgProps {
  chartData: ChartDataItem[];
  maxChartValue: number;
  chartType: "BAR" | "LINE";
  qualityViewMode: "QC_GRADE" | "OPERATOR_STATUS";
  operatorStatusFilter: "ALL" | "CEKLIS" | "SILANG";
  chartGradeFilter: "ALL" | "GRADE_A" | "GRADE_B" | "BS" | "UNGRADED";
  activeFilter: string;
  activeChartBar: number | null;
  setActiveChartBar: React.Dispatch<React.SetStateAction<number | null>>;
}

export default function ProductionChartSvg({
  chartData,
  maxChartValue,
  chartType,
  qualityViewMode,
  operatorStatusFilter,
  chartGradeFilter,
  activeFilter,
  activeChartBar,
  setActiveChartBar,
}: ProductionChartSvgProps) {
  const svgWidth = Math.max(800, chartData.length * 100);
  const totalWidth = svgWidth - 60; // 40 left padding, 20 right padding
  const spacing = totalWidth / Math.max(chartData.length, 1);
  const totalBars = chartData.length;

  return (
    <div className="flex-1 relative flex flex-col mt-4">
      <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar pb-4 w-full flex flex-col">
        <div
          style={{ minWidth: `${svgWidth}px` }}
          className="relative mx-auto w-full flex-1 min-h-[250px]"
        >
          <svg
            viewBox={`0 0 ${svgWidth} 250`}
            className="absolute inset-0 w-full h-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <pattern
                id="diagonalStripes"
                width="16"
                height="16"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
              >
                <rect width="8" height="16" fill="#111111" />
                <rect x="8" width="8" height="16" fill="#444444" />
              </pattern>
            </defs>

            {/* Horizontal grid lines */}
            <line x1="40" y1="20" x2={svgWidth - 20} y2="20" stroke="#f1f3f5" strokeWidth="1" />
            <line x1="40" y1="63.75" x2={svgWidth - 20} y2="63.75" stroke="#f1f3f5" strokeWidth="1" />
            <line x1="40" y1="107.5" x2={svgWidth - 20} y2="107.5" stroke="#f1f3f5" strokeWidth="1" />
            <line x1="40" y1="151.25" x2={svgWidth - 20} y2="151.25" stroke="#f1f3f5" strokeWidth="1" />
            <line x1="40" y1="195" x2={svgWidth - 20} y2="195" stroke="#e9ecef" strokeWidth="1.5" />

            {/* Y-Axis text labels */}
            <text x="30" y="24" fill="#a1a1aa" fontSize="9" fontWeight="bold" textAnchor="end">
              {Math.round(maxChartValue)}
            </text>
            <text x="30" y="67.75" fill="#a1a1aa" fontSize="9" fontWeight="bold" textAnchor="end">
              {Math.round(maxChartValue * 0.75)}
            </text>
            <text x="30" y="111.5" fill="#a1a1aa" fontSize="9" fontWeight="bold" textAnchor="end">
              {Math.round(maxChartValue * 0.5)}
            </text>
            <text x="30" y="155.25" fill="#a1a1aa" fontSize="9" fontWeight="bold" textAnchor="end">
              {Math.round(maxChartValue * 0.25)}
            </text>

            {/* Polylines for LINE chart */}
            {chartType === "LINE" && (
              <ProductionChartLines
                chartData={chartData}
                totalWidth={totalWidth}
                maxChartValue={maxChartValue}
                qualityViewMode={qualityViewMode}
                operatorStatusFilter={operatorStatusFilter}
                chartGradeFilter={chartGradeFilter}
              />
            )}

            {/* Chart Columns / Bars / Dots */}
            {chartData.map((d, index) => (
              <ProductionChartItem
                key={d.label}
                d={d}
                index={index}
                chartDataLength={chartData.length}
                spacing={spacing}
                totalBars={totalBars}
                maxChartValue={maxChartValue}
                chartType={chartType}
                qualityViewMode={qualityViewMode}
                operatorStatusFilter={operatorStatusFilter}
                chartGradeFilter={chartGradeFilter}
                activeFilter={activeFilter}
                isActive={activeChartBar === index}
                onToggleActive={() =>
                  setActiveChartBar(activeChartBar === index ? null : index)
                }
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
