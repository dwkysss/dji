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
      className={`bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-1.5 sm:px-3 sm:py-2 shadow-[0_8px_30px_rgba(0,0,0,0.015)] col-span-2 sm:col-span-1 lg:w-auto shrink-0 flex items-center justify-between sm:justify-start gap-2 sm:gap-2.5 ${
        dateRangeMode === "CUSTOM" ? "flex-wrap" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="p-1 rounded-lg bg-slate-50 border border-slate-200/60 text-slate-400 shrink-0">
          <Calendar className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] sm:text-xs font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
          Waktu:
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-50 p-1 rounded-xl border border-slate-150 shrink-0">
          {modes.map(({ key, label }) => {
            const isActive = dateRangeMode === key;
            return (
              <button
                key={key}
                onClick={() => setDateRangeMode(key)}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer text-center ${
                  isActive
                    ? "bg-white text-slate-800 shadow-xs border border-slate-150"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Custom Calendar Inputs (Only visible when CUSTOM is active) */}
        {dateRangeMode === "CUSTOM" && (
          <div className="flex items-center gap-1.5 sm:gap-2 animate-fadeIn">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200/60 rounded-xl px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 font-bold">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200/60 rounded-xl px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  );
}
