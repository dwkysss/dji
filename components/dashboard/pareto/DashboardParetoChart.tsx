"use client";

import React from "react";
import { ParetoItem } from "./paretoUtils";

export interface DashboardParetoChartProps {
  list: ParetoItem[];
  showAllParetoCards: boolean;
  paretoMode: "COUNT" | "DURATION";
}

export default function DashboardParetoChart({
  list,
  showAllParetoCards,
  paretoMode,
}: DashboardParetoChartProps) {
  if (list.length === 0) {
    return (
      <div className="relative w-full h-80 mx-auto flex items-center justify-center my-4">
        <div className="text-center py-12 text-sm text-slate-400 font-bold">
          Tidak ada data cacat/downtime pada periode terpilih
        </div>
      </div>
    );
  }

  const displayList = showAllParetoCards ? list : list.slice(0, 12);
  const maxValue = Math.max(...displayList.map((item) => item.value), 1);
  const svgWidth = Math.max(800, displayList.length * 85);
  const svgHeight = 280;
  const paddingLeft = 55;
  const paddingRight = 65;
  const paddingTop = 32;
  const paddingBottom = 75;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const barSpacing = chartWidth / displayList.length;
  const barWidth = Math.max(18, Math.min(46, barSpacing * 0.48));

  const y80 = paddingTop + chartHeight - 0.8 * chartHeight;

  const pointsStr = displayList
    .map((item, idx) => {
      const x = paddingLeft + barSpacing * idx + barSpacing / 2;
      const y = paddingTop + chartHeight - (item.cumulativePct / 100) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  // Generate accurate Left Y Axis Ticks & Grid Lines
  const yTicks: { val: number; label: string; y: number }[] = [];
  if (paretoMode === "COUNT") {
    const steps = maxValue <= 5 ? maxValue : 4;
    for (let i = 0; i <= steps; i++) {
      const val = Math.round((maxValue / steps) * i);
      const y = paddingTop + chartHeight - (val / maxValue) * chartHeight;
      if (!yTicks.some((t) => t.val === val)) {
        yTicks.push({ val, label: val.toString(), y });
      }
    }
  } else {
    const maxMin = Math.ceil(maxValue / 60) || 1;
    const steps = maxMin <= 5 ? maxMin : 4;
    for (let i = 0; i <= steps; i++) {
      const minVal = Math.round((maxMin / steps) * i);
      const y = paddingTop + chartHeight - (minVal / maxMin) * chartHeight;
      if (!yTicks.some((t) => t.val === minVal)) {
        yTicks.push({ val: minVal, label: `${minVal}m`, y });
      }
    }
  }

  return (
    <div className="relative w-full h-80 mx-auto flex items-center justify-center my-4 overflow-x-auto custom-scrollbar">
      <div style={{ minWidth: `${svgWidth}px` }} className="w-full h-full">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full overflow-visible"
        >
          {/* Left Y Axis Grid Lines & Labels */}
          {yTicks.map((tick) => (
            <g key={`ytick-${tick.val}`}>
              <line
                x1={paddingLeft}
                y1={tick.y}
                x2={svgWidth - paddingRight}
                y2={tick.y}
                stroke={tick.val === 0 ? "#cbd5e1" : "#f1f5f9"}
                strokeWidth={tick.val === 0 ? "1.5" : "1"}
              />
              <text
                x={paddingLeft - 8}
                y={tick.y + 3}
                textAnchor="end"
                fontSize="9"
                fontWeight="bold"
                fill="#64748b"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* 80% Cutoff Line for Cumulative % */}
          <line
            x1={paddingLeft}
            y1={y80}
            x2={svgWidth - paddingRight}
            y2={y80}
            stroke="#e11d48"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity="0.85"
          />
          {/* Dedicated 80% Cutoff Pill on Right Margin */}
          <rect
            x={svgWidth - paddingRight - 84}
            y={y80 - 10}
            width="78"
            height="18"
            rx="5"
            fill="#fff1f2"
            stroke="#fecdd3"
            strokeWidth="1"
          />
          <text
            x={svgWidth - paddingRight - 45}
            y={y80 + 3}
            textAnchor="middle"
            fontSize="8.5"
            fontWeight="black"
            fill="#be123c"
          >
            Batas 80%
          </text>

          {/* Right Y Axis Ticks (Cumulative %) */}
          <text
            x={svgWidth - paddingRight + 8}
            y={paddingTop + 4}
            textAnchor="start"
            fontSize="9"
            fontWeight="bold"
            fill="#4f46e5"
          >
            100%
          </text>
          <text
            x={svgWidth - paddingRight + 8}
            y={y80 + 3}
            textAnchor="start"
            fontSize="9"
            fontWeight="black"
            fill="#be123c"
          >
            80%
          </text>
          <text
            x={svgWidth - paddingRight + 8}
            y={paddingTop + chartHeight + 3}
            textAnchor="start"
            fontSize="9"
            fontWeight="bold"
            fill="#4f46e5"
          >
            0%
          </text>

          {/* Bars */}
          {displayList.map((item, idx) => {
            const calcHeight = (item.value / maxValue) * chartHeight;
            const barHeight = item.value > 0 ? Math.max(10, calcHeight) : 0;
            const x = paddingLeft + barSpacing * idx + (barSpacing - barWidth) / 2;
            const y = paddingTop + chartHeight - barHeight;
            const barColor = item.isVital80
              ? idx === 0
                ? "#0070bc"
                : "#0284c7"
              : "#94a3b8";

            return (
              <g key={item.code} className="group/pareto-bar cursor-pointer">
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="5"
                  fill={barColor}
                  opacity="0.92"
                  className="transition-all hover:opacity-100 hover:brightness-110"
                >
                  <title>{`${item.friendlyName}: ${item.value} (${item.individualPct}%)`}</title>
                </rect>
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="black"
                  fill={
                    item.isVital80
                      ? idx === 0
                        ? "#004777"
                        : "#0369a1"
                      : "#475569"
                  }
                >
                  {paretoMode === "COUNT"
                    ? item.value
                    : `${Math.round(item.value / 60)}m`}
                </text>
                {/* Rotated X-Axis Label (-35deg) for full readability */}
                <g
                  transform={`translate(${
                    x + barWidth / 2
                  }, ${paddingTop + chartHeight + 14}) rotate(-35)`}
                >
                  <text
                    x={0}
                    y={0}
                    textAnchor="end"
                    fontSize="9.5"
                    fontWeight={item.isVital80 ? "900" : "700"}
                    fill={
                      item.isVital80
                        ? idx === 0
                          ? "#0070bc"
                          : "#0369a1"
                        : "#64748b"
                    }
                    className="select-none"
                  >
                    <title>{item.friendlyName}</title>
                    {item.friendlyName.length > 20
                      ? item.friendlyName.substring(0, 18) + "…"
                      : item.friendlyName}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Cumulative Line & Dots */}
          {displayList.length > 0 && (
            <>
              <polyline
                points={pointsStr}
                fill="none"
                stroke="#4f46e5"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {displayList.map((item, idx) => {
                const x = paddingLeft + barSpacing * idx + barSpacing / 2;
                const y =
                  paddingTop +
                  chartHeight -
                  (item.cumulativePct / 100) * chartHeight;
                return (
                  <g key={`dot-${item.code}`} className="group/dot cursor-pointer">
                    <circle
                      cx={x}
                      cy={y}
                      r="4.5"
                      fill="#ffffff"
                      stroke="#4f46e5"
                      strokeWidth="2.5"
                    />
                    {/* Pill Badge for Cumulative % */}
                    <rect
                      x={x - 17}
                      y={y - 20}
                      width="34"
                      height="14"
                      rx="4"
                      fill="#ffffff"
                      stroke="#c7d2fe"
                      strokeWidth="1"
                      className="shadow-xs pointer-events-none"
                    />
                    <text
                      x={x}
                      y={y - 9.5}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="black"
                      fill="#4338ca"
                      className="pointer-events-none"
                    >
                      {item.cumulativePct}%
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
