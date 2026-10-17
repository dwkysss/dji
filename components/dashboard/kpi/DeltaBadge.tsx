"use client";

import React from "react";

export interface DeltaBadgeProps {
  delta?: { value: number; type: "up" | "down" | "neutral" };
  isLowerBetter?: boolean;
}

export const DeltaBadge: React.FC<DeltaBadgeProps> = ({
  delta,
  isLowerBetter = false,
}) => {
  if (!delta || delta.value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200/60 ml-1.5">
        - 0% vs periode lalu
      </span>
    );
  }

  const isUp = delta.type === "up";
  const isGood = isLowerBetter ? !isUp : isUp;
  const colorClass = isGood
    ? "text-emerald-600 bg-emerald-50 border-emerald-100"
    : "text-rose-600 bg-rose-50 border-rose-100";
  const sign = isUp ? "+" : "";
  const arrow = isUp ? "▲" : "▼";

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold border ${colorClass} ml-1.5`}
    >
      {arrow} {sign}
      {delta.value}% vs periode lalu
    </span>
  );
};

export default DeltaBadge;
