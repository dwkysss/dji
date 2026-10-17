"use client";

import React from "react";
import { ChartDataItem } from "../chartDataUtils";

export interface OperatorStatusBarsProps {
  d: ChartDataItem;
  groupCenter: number;
  maxChartValue: number;
  totalBars: number;
  chartType: "BAR" | "LINE";
  isActive: boolean;
  operatorStatusFilter: "ALL" | "CEKLIS" | "SILANG";
  getTooltipX: (offsetStart: number, offsetEnd: number, offsetMiddle: number) => number;
  getTooltipTextX: (offsetStart: number, offsetEnd: number) => number;
}

export default function OperatorStatusBars({
  d,
  groupCenter,
  maxChartValue,
  totalBars,
  chartType,
  isActive,
  operatorStatusFilter,
  getTooltipX,
  getTooltipTextX,
}: OperatorStatusBarsProps) {
  if (operatorStatusFilter === "ALL") {
    const hCeklis = maxChartValue > 0 ? (d.ceklis_sum / maxChartValue) * 175 : 0;
    const hSilang = maxChartValue > 0 ? (d.silang_sum / maxChartValue) * 175 : 0;
    const displayHCeklis = Math.max(hCeklis, 1.5);
    const displayHSilang = Math.max(hSilang, 1.5);
    const yCeklis = 195 - displayHCeklis;
    const ySilang = 195 - displayHSilang;

    const barW = totalBars <= 4 ? 20 : 14;
    const gap = totalBars <= 4 ? 4 : 2;
    const groupW = 2 * barW + gap;
    const xCeklis = groupCenter - groupW / 2;
    const xSilang = xCeklis + barW + gap;

    return (
      <>
        {chartType === "BAR" && (
          <>
            <rect
              x={xCeklis}
              y={yCeklis}
              width={barW}
              height={displayHCeklis}
              rx="4"
              fill="#0070bc"
              className="transition-all duration-500 ease-out hover:opacity-85 cursor-pointer"
            />
            <rect
              x={xSilang}
              y={ySilang}
              width={barW}
              height={displayHSilang}
              rx="4"
              fill="#ef4444"
              className="transition-all duration-500 ease-out hover:opacity-85 cursor-pointer"
            />
            <text
              x={xCeklis + barW / 2}
              y={yCeklis - 4}
              fill="#0070bc"
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
              className={`transition-opacity duration-200 ${
                isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"
              }`}
            >
              {d.ceklis_sum}
            </text>
            <text
              x={xSilang + barW / 2}
              y={ySilang - 4}
              fill="#ef4444"
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
              className={`transition-opacity duration-200 ${
                isActive ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"
              }`}
            >
              {d.silang_sum}
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
              {d.ceklis_sum + d.silang_sum > 0 ? `Total: ${d.ceklis_sum + d.silang_sum}` : ""}
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
              y={10}
              width={90}
              height={48}
              rx="6"
              fill="#ffffff"
              stroke="#e2e8f0"
              strokeWidth="1"
              className="shadow-sm"
            />
            <text
              x={getTooltipTextX(50, 50)}
              y={24}
              fill="#0070bc"
              fontSize="9"
              fontWeight="extrabold"
              textAnchor="middle"
            >
              Normal: <tspan fill="#334155">{d.ceklis_sum}</tspan>
            </text>
            <text
              x={getTooltipTextX(50, 50)}
              y={36}
              fill="#ef4444"
              fontSize="9"
              fontWeight="extrabold"
              textAnchor="middle"
            >
              Cacat: <tspan fill="#334155">{d.silang_sum}</tspan>
            </text>
            <text
              x={getTooltipTextX(50, 50)}
              y={48}
              fill="#1e293b"
              fontSize="9"
              fontWeight="extrabold"
              textAnchor="middle"
            >
              Total: {d.ceklis_sum + d.silang_sum}
            </text>
          </g>
        )}
      </>
    );
  }

  // Single Operator Status (Ceklis or Silang)
  const isCeklis = operatorStatusFilter === "CEKLIS";
  const value = isCeklis ? d.ceklis_sum : d.silang_sum;
  const barFill = isCeklis ? "#0070bc" : "#ef4444";
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
