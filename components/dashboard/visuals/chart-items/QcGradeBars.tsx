"use client";

import React from "react";
import { ChartDataItem } from "../chartDataUtils";

export interface QcGradeBarsProps {
  d: ChartDataItem;
  groupCenter: number;
  maxChartValue: number;
  totalBars: number;
  chartType: "BAR" | "LINE";
  isActive: boolean;
  chartGradeFilter: "ALL" | "GRADE_A" | "GRADE_B" | "BS" | "UNGRADED";
  activeFilter: string;
  getTooltipX: (offsetStart: number, offsetEnd: number, offsetMiddle: number) => number;
  getTooltipTextX: (offsetStart: number, offsetEnd: number) => number;
}

export default function QcGradeBars({
  d,
  groupCenter,
  maxChartValue,
  totalBars,
  chartType,
  isActive,
  chartGradeFilter,
  activeFilter,
  getTooltipX,
  getTooltipTextX,
}: QcGradeBarsProps) {
  if (chartGradeFilter === "ALL") {
    if (activeFilter === "PROBLEMS") {
      const hTotal = maxChartValue > 0 ? (d.total / maxChartValue) * 175 : 0;
      const displayHTotal = Math.max(hTotal, 1.5);
      const yTotal = 195 - displayHTotal;
      const barW = 24;
      const xTotal = groupCenter - 12;

      return (
        <>
          {chartType === "BAR" && (
            <>
              <rect
                x={xTotal}
                y={yTotal}
                width={barW}
                height={displayHTotal}
                rx="4"
                fill="#ef4444"
                className="transition-all duration-500 ease-out hover:opacity-85 cursor-pointer"
              />
              <text
                x={xTotal + barW / 2}
                y={yTotal - 4}
                fill="#475569"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
                className={`transition-opacity duration-200 ${
                  isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"
                }`}
              >
                {d.total}
              </text>
            </>
          )}

          {chartType === "LINE" && (
            <g
              className={`transition-opacity duration-200 pointer-events-none ${
                isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"
              }`}
            >
              <line
                x1={groupCenter}
                y1={20}
                x2={groupCenter}
                y2={195}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <rect
                x={getTooltipX(5, 55, 25)}
                y={20}
                width={50}
                height={25}
                rx="6"
                fill="#ffffff"
                stroke="#e2e8f0"
                strokeWidth="1"
                className="shadow-sm"
              />
              <text
                x={getTooltipTextX(30, 30)}
                y={35}
                fill="#1e293b"
                fontSize="9"
                fontWeight="extrabold"
                textAnchor="middle"
              >{`Total: ${d.total}`}</text>
            </g>
          )}
        </>
      );
    }

    // QC_GRADE ALL (4 grouped bars)
    const hA = maxChartValue > 0 ? (d.gradeA_sum / maxChartValue) * 175 : 0;
    const hB = maxChartValue > 0 ? (d.gradeB_sum / maxChartValue) * 175 : 0;
    const hBS = maxChartValue > 0 ? (d.bs_sum / maxChartValue) * 175 : 0;
    const hUN = maxChartValue > 0 ? (d.ungraded_sum / maxChartValue) * 175 : 0;

    const displayHA = Math.max(hA, 1.5);
    const displayHB = Math.max(hB, 1.5);
    const displayHBS = Math.max(hBS, 1.5);
    const displayHUN = Math.max(hUN, 1.5);

    const yA = 195 - displayHA;
    const yB = 195 - displayHB;
    const yBS = 195 - displayHBS;
    const yUN = 195 - displayHUN;

    const barW = totalBars <= 4 ? 16 : 10;
    const gap = totalBars <= 4 ? 3 : 2;
    const groupW = 4 * barW + 3 * gap;
    const xA = groupCenter - groupW / 2;
    const xB = xA + barW + gap;
    const xBS = xB + barW + gap;
    const xUN = xBS + barW + gap;

    return (
      <>
        {chartType === "BAR" && (
          <>
            <rect
              x={xA}
              y={yA}
              width={barW}
              height={displayHA}
              rx="3"
              fill="#0070bc"
              className="transition-all duration-500 ease-out hover:opacity-85 cursor-pointer"
            />
            <rect
              x={xB}
              y={yB}
              width={barW}
              height={displayHB}
              rx="3"
              fill="#f59e0b"
              className="transition-all duration-500 ease-out hover:opacity-85 cursor-pointer"
            />
            <rect
              x={xBS}
              y={yBS}
              width={barW}
              height={displayHBS}
              rx="3"
              fill="#ef4444"
              className="transition-all duration-500 ease-out hover:opacity-85 cursor-pointer"
            />
            <rect
              x={xUN}
              y={yUN}
              width={barW}
              height={displayHUN}
              rx="3"
              fill="#94a3b8"
              className="transition-all duration-500 ease-out hover:opacity-85 cursor-pointer"
            />

            <text
              x={xA + barW / 2}
              y={yA - 4}
              fill="#475569"
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
              className={`transition-opacity duration-200 ${
                isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"
              }`}
            >
              {d.gradeA_sum}
            </text>
            <text
              x={xB + barW / 2}
              y={yB - 4}
              fill="#475569"
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
              className={`transition-opacity duration-200 ${
                isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"
              }`}
            >
              {d.gradeB_sum}
            </text>
            <text
              x={xBS + barW / 2}
              y={yBS - 4}
              fill="#475569"
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
              className={`transition-opacity duration-200 ${
                isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"
              }`}
            >
              {d.bs_sum}
            </text>
            <text
              x={xUN + barW / 2}
              y={yUN - 4}
              fill="#64748b"
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
              className={`transition-opacity duration-200 ${
                isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"
              }`}
            >
              {d.ungraded_sum}
            </text>
            <text
              x={groupCenter}
              y={12}
              fill="#1e293b"
              fontSize="9"
              fontWeight="extrabold"
              textAnchor="middle"
              className={`transition-opacity duration-200 ${
                isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"
              }`}
            >
              {d.total > 0 ? `Total: ${d.total}` : ""}
            </text>
          </>
        )}

        {chartType === "LINE" && (
          <g
            className={`transition-opacity duration-200 pointer-events-none ${
              isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"
            }`}
          >
            <line
              x1={groupCenter}
              y1={20}
              x2={groupCenter}
              y2={195}
              stroke="#94a3b8"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <rect
              x={getTooltipX(5, 95, 45)}
              y={5}
              width={90}
              height={68}
              rx="6"
              fill="#ffffff"
              stroke="#e2e8f0"
              strokeWidth="1"
              className="shadow-sm"
            />
            <text
              x={getTooltipTextX(50, 50)}
              y={17}
              fill="#0070bc"
              fontSize="9"
              fontWeight="extrabold"
              textAnchor="middle"
            >
              Grade A: <tspan fill="#334155">{d.gradeA_sum}</tspan>
            </text>
            <text
              x={getTooltipTextX(50, 50)}
              y={29}
              fill="#f59e0b"
              fontSize="9"
              fontWeight="extrabold"
              textAnchor="middle"
            >
              Grade B: <tspan fill="#334155">{d.gradeB_sum}</tspan>
            </text>
            <text
              x={getTooltipTextX(50, 50)}
              y={41}
              fill="#ef4444"
              fontSize="9"
              fontWeight="extrabold"
              textAnchor="middle"
            >
              BS: <tspan fill="#334155">{d.bs_sum}</tspan>
            </text>
            <text
              x={getTooltipTextX(50, 50)}
              y={53}
              fill="#64748b"
              fontSize="9"
              fontWeight="extrabold"
              textAnchor="middle"
            >
              Ungraded: <tspan fill="#334155">{d.ungraded_sum}</tspan>
            </text>
            <text
              x={getTooltipTextX(50, 50)}
              y={65}
              fill="#1e293b"
              fontSize="9"
              fontWeight="extrabold"
              textAnchor="middle"
            >
              {d.total > 0 ? `Total: ${d.total}` : ""}
            </text>
          </g>
        )}
      </>
    );
  }

  // Specific Single Grade in QC_GRADE Mode
  let value = d.total;
  let barFill = "#111111";

  if (chartGradeFilter === "GRADE_A") {
    value = d.gradeA_sum;
    barFill = "#0070bc";
  } else if (chartGradeFilter === "GRADE_B") {
    value = d.gradeB_sum;
    barFill = "#f59e0b";
  } else if (chartGradeFilter === "BS") {
    value = d.bs_sum;
    barFill = "#ef4444";
  } else if (chartGradeFilter === "UNGRADED") {
    value = d.ungraded_sum;
    barFill = "#94a3b8";
  }

  const hVal = maxChartValue > 0 ? (value / maxChartValue) * 175 : 0;
  const displayHVal = Math.max(hVal, 1.5);
  const yVal = 195 - displayHVal;
  const barW = totalBars <= 4 ? 36 : 28;
  const xVal = groupCenter - barW / 2;

  return (
    <>
      {chartType === "BAR" && (
        <>
          <rect
            x={xVal}
            y={yVal}
            width={barW}
            height={displayHVal}
            rx="6"
            fill={barFill}
            className="transition-all duration-500 ease-out cursor-pointer hover:opacity-85"
          />
          <text
            x={groupCenter}
            y={yVal - 6}
            fill="#475569"
            fontSize="9"
            fontWeight="extrabold"
            textAnchor="middle"
          >
            {value}
          </text>
        </>
      )}

      {chartType === "LINE" && (
        <g
          className={`transition-opacity duration-200 pointer-events-none ${
            isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"
          }`}
        >
          <line
            x1={groupCenter}
            y1={20}
            x2={groupCenter}
            y2={195}
            stroke="#94a3b8"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <rect
            x={getTooltipX(5, 45, 20)}
            y={yVal > 40 ? yVal - 30 : yVal + 10}
            width={40}
            height={20}
            rx="4"
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="1"
            className="shadow-sm"
          />
          <text
            x={getTooltipTextX(25, 25)}
            y={yVal > 40 ? yVal - 16 : yVal + 24}
            fill={barFill}
            fontSize="10"
            fontWeight="extrabold"
            textAnchor="middle"
          >
            {value}
          </text>
        </g>
      )}
    </>
  );
}
