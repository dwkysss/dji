"use client";

import React from "react";
import { ChartDataItem } from "./chartDataUtils";
import OperatorStatusBars from "./chart-items/OperatorStatusBars";
import QcGradeBars from "./chart-items/QcGradeBars";

export interface ProductionChartItemProps {
  d: ChartDataItem;
  index: number;
  chartDataLength: number;
  spacing: number;
  totalBars: number;
  maxChartValue: number;
  chartType: "BAR" | "LINE";
  qualityViewMode: "QC_GRADE" | "OPERATOR_STATUS";
  operatorStatusFilter: "ALL" | "CEKLIS" | "SILANG";
  chartGradeFilter: "ALL" | "GRADE_A" | "GRADE_B" | "BS" | "UNGRADED";
  activeFilter: string;
  isActive: boolean;
  onToggleActive: () => void;
}

export default function ProductionChartItem({
  d,
  index,
  chartDataLength,
  spacing,
  totalBars,
  maxChartValue,
  chartType,
  qualityViewMode,
  operatorStatusFilter,
  chartGradeFilter,
  activeFilter,
  isActive,
  onToggleActive,
}: ProductionChartItemProps) {
  const groupCenter = 40 + spacing * index + spacing / 2;

  // Helper for tooltip X coordinate to prevent clipping on boundaries
  const getTooltipX = (offsetStart: number, offsetEnd: number, offsetMiddle: number) => {
    if (index === 0) return groupCenter + offsetStart;
    if (index === chartDataLength - 1) return groupCenter - offsetEnd;
    return groupCenter - offsetMiddle;
  };

  const getTooltipTextX = (offsetStart: number, offsetEnd: number) => {
    if (index === 0) return groupCenter + offsetStart;
    if (index === chartDataLength - 1) return groupCenter - offsetEnd;
    return groupCenter;
  };

  return (
    <g
      key={d.label}
      className="group/bar cursor-pointer"
      onClick={onToggleActive}
    >
      {index > 0 && (
        <line
          x1={40 + spacing * index}
          y1={195}
          x2={40 + spacing * index}
          y2={205}
          stroke="#cbd5e1"
          strokeWidth="2"
        />
      )}

      {/* Invisible hit area for hover and click */}
      <rect
        x={40 + spacing * index}
        y={20}
        width={spacing}
        height={175}
        fill="transparent"
        className="cursor-pointer"
      />

      {/* Content Rendering Delegated to Focused Sub-components */}
      {qualityViewMode === "OPERATOR_STATUS" ? (
        <OperatorStatusBars
          d={d}
          groupCenter={groupCenter}
          maxChartValue={maxChartValue}
          totalBars={totalBars}
          chartType={chartType}
          isActive={isActive}
          operatorStatusFilter={operatorStatusFilter}
          getTooltipX={getTooltipX}
          getTooltipTextX={getTooltipTextX}
        />
      ) : (
        <QcGradeBars
          d={d}
          groupCenter={groupCenter}
          maxChartValue={maxChartValue}
          totalBars={totalBars}
          chartType={chartType}
          isActive={isActive}
          chartGradeFilter={chartGradeFilter}
          activeFilter={activeFilter}
          getTooltipX={getTooltipX}
          getTooltipTextX={getTooltipTextX}
        />
      )}

      {/* X-Axis Label */}
      <text
        x={groupCenter}
        y={218}
        fill="#475569"
        fontSize="10"
        fontWeight="extrabold"
        textAnchor="middle"
      >
        {d.label.length > 12 ? d.label.substring(0, 10) + "..." : d.label}
      </text>

      {/* Subtitle for shift timing */}
      {d.label.startsWith("Shift") && (
        <text
          x={groupCenter}
          y={231}
          fill="#94a3b8"
          fontSize="8"
          fontWeight="bold"
          textAnchor="middle"
        >
          {d.label === "Shift 1"
            ? "07:10 - 15:10 WIB"
            : d.label === "Shift 2"
            ? "15:10 - 23:10 WIB"
            : "23:10 - 07:10 WIB"}
        </text>
      )}
    </g>
  );
}
