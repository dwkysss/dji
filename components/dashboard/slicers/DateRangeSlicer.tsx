"use client";

import React from "react";
import { Calendar } from "lucide-react";

export interface DateRangeSlicerProps {
  dateRangeMode: "TODAY" | "7DAYS" | "30DAYS" | "CUSTOM";
  setDateRangeMode: (mode: "TODAY" | "7DAYS" | "30DAYS" | "CUSTOM") => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
}

export default function DateRangeSlicer({
  dateRangeMode,
  setDateRangeMode,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: DateRangeSlicerProps) {
  const modes = [
    { key: "TODAY" as const, label: "Hari Ini" },
    { key: "7DAYS" as const, label: "Minggu" },
    { key: "30DAYS" as const, label: "Bulan" },
    { key: "CUSTOM" as const, label: "Kustom" },
  ];

  return (
    <div
      className={`bg-slate-50/75 border border-slate-200/75 rounded-xl px-2.5 py-2 col-span-2 lg:w-auto shrink-0 flex items-center justify-between lg:justify-start gap-2.5 ${
        dateRangeMode === "CUSTOM" ? "flex-wrap lg:flex-nowrap" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-6 h-6 rounded-lg bg-white border border-slate-200/80 text-[#0070bc] flex items-center justify-center shrink-0 shadow-2xs">
          <Calendar className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
          Waktu
        </span>
      </div>
      <div className="flex flex-wrap lg:flex-nowrap items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-0.5 bg-slate-200/60 p-0.5 rounded-lg shrink-0">
          {modes.map(({ key, label }) => {
            const isActive = dateRangeMode === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDateRangeMode(key)}
                className={`px-2.5 sm:px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer text-center whitespace-nowrap ${
                  isActive
                    ? "bg-[#0070bc] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Custom Calendar Inputs (Only visible when CUSTOM is active) */}
        {dateRangeMode === "CUSTOM" && (
          <div className="flex items-center gap-1.5 sm:gap-2 animate-fadeIn shrink-0">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200/60 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 font-bold">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200/60 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  );
}
