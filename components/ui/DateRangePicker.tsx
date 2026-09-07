"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
} from "lucide-react";
import { getShiftDate } from "@/lib/shift-utils";

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
  disabled?: boolean;
}

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function formatDateDisplay(isoStr: string): string {
  if (!isoStr) return "";
  const parts = isoStr.split("-");
  if (parts.length !== 3) return isoStr;
  const day = parseInt(parts[2], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const year = parts[0];
  const shortMonth = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ][monthIdx];
  return `${day} ${shortMonth || ""} ${year}`;
}

function toIsoString(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder = "Pilih tanggal atau rentang...",
  className = "",
  align = "left",
  disabled = false,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial view month from startDate or today
  const getInitialYearMonth = () => {
    if (startDate) {
      const parts = startDate.split("-").map(Number);
      if (parts.length === 3) return { year: parts[0], month: parts[1] - 1 };
    }
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  };

  const [viewDate, setViewDate] = useState(getInitialYearMonth());
  const [tempStart, setTempStart] = useState<string>(startDate || "");
  const [tempEnd, setTempEnd] = useState<string>(endDate || "");
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Sync internal temp when props change
  useEffect(() => {
    setTempStart(startDate || "");
    setTempEnd(endDate || "");
  }, [startDate, endDate]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (isOpen) {
          // If user picked a start but not an end, set end = start
          if (tempStart && !tempEnd) {
            setTempEnd(tempStart);
            onChange(tempStart, tempStart);
          }
          setIsOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, tempStart, tempEnd, onChange]);

  const handlePrevMonth = () => {
    setViewDate((prev) => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setViewDate((prev) => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const handleDayClick = (iso: string) => {
    if (!tempStart || (tempStart && tempEnd)) {
      // Start a new selection
      setTempStart(iso);
      setTempEnd("");
    } else if (tempStart && !tempEnd) {
      // Pick end date
      let finalStart = tempStart;
      let finalEnd = iso;

      if (iso < tempStart) {
        finalStart = iso;
        finalEnd = tempStart;
      }

      setTempStart(finalStart);
      setTempEnd(finalEnd);
      onChange(finalStart, finalEnd);
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTempStart("");
    setTempEnd("");
    onChange("", "");
  };

  // Presets
  const applyPreset = (preset: "today" | "yesterday" | "last7" | "thisMonth") => {
    const today = new Date();
    const todayStr = getShiftDate(today);

    if (preset === "today") {
      setTempStart(todayStr);
      setTempEnd(todayStr);
      onChange(todayStr, todayStr);
    } else if (preset === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yStr = getShiftDate(y);
      setTempStart(yStr);
      setTempEnd(yStr);
      onChange(yStr, yStr);
    } else if (preset === "last7") {
      const past = new Date(today);
      past.setDate(past.getDate() - 6);
      const pastStr = getShiftDate(past);
      setTempStart(pastStr);
      setTempEnd(todayStr);
      onChange(pastStr, todayStr);
    } else if (preset === "thisMonth") {
      const year = today.getFullYear();
      const month = today.getMonth();
      const firstDay = toIsoString(year, month, 1);
      setTempStart(firstDay);
      setTempEnd(todayStr);
      onChange(firstDay, todayStr);
    }
    setIsOpen(false);
  };

  // Generate calendar days
  const year = viewDate.year;
  const month = viewDate.month;
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarCells: {
    day: number;
    monthOffset: -1 | 0 | 1;
    iso: string;
  }[] = [];

  // Prev month filler
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = totalDaysInPrevMonth - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    calendarCells.push({
      day: d,
      monthOffset: -1,
      iso: toIsoString(prevYear, prevMonth, d),
    });
  }

  // Current month days
  for (let d = 1; d <= totalDaysInMonth; d++) {
    calendarCells.push({
      day: d,
      monthOffset: 0,
      iso: toIsoString(year, month, d),
    });
  }

  // Next month filler (fill up to 35 or 42 grid cells)
  const remaining = (7 - (calendarCells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    calendarCells.push({
      day: d,
      monthOffset: 1,
      iso: toIsoString(nextYear, nextMonth, d),
    });
  }

  // Range helper calculations
  const isSelectedStart = (iso: string) => tempStart === iso;
  const isSelectedEnd = (iso: string) => tempEnd === iso;
  const isInRange = (iso: string) => {
    if (tempStart && tempEnd) {
      return iso > tempStart && iso < tempEnd;
    }
    if (tempStart && !tempEnd && hoverDate) {
      const min = tempStart < hoverDate ? tempStart : hoverDate;
      const max = tempStart < hoverDate ? hoverDate : tempStart;
      return iso > min && iso < max;
    }
    return false;
  };

  const isRangeEndpoint = (iso: string) => {
    if (isSelectedStart(iso) || isSelectedEnd(iso)) return true;
    if (tempStart && !tempEnd && hoverDate === iso) return true;
    return false;
  };

  // Calculate day count
  let dayCount = 0;
  if (tempStart && tempEnd) {
    const d1 = new Date(tempStart).getTime();
    const d2 = new Date(tempEnd).getTime();
    dayCount = Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
  } else if (tempStart) {
    dayCount = 1;
  }

  // Display text in the trigger
  let displayText = "";
  if (tempStart && tempEnd && tempStart !== tempEnd) {
    displayText = `${formatDateDisplay(tempStart)} - ${formatDateDisplay(tempEnd)}`;
  } else if (tempStart) {
    displayText = formatDateDisplay(tempStart);
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`h-11 px-3.5 rounded-xl bg-slate-50 border transition-all duration-200 flex items-center justify-between gap-2 shadow-xs select-none cursor-pointer ${
          isOpen
            ? "border-[#0070bc] ring-2 ring-sky-100 bg-white"
            : "border-slate-200 hover:border-slate-300 hover:bg-white"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <CalendarIcon className="w-4 h-4 text-[#0070bc] shrink-0" />
          {displayText ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                {displayText}
              </span>
              {dayCount > 1 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-[#0070bc] shrink-0">
                  {dayCount} hari
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs sm:text-sm font-medium text-slate-400 truncate">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {displayText && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              title="Hapus filter tanggal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Popover Calendar */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 w-[320px] sm:w-[350px] animate-fadeIn ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Quick Presets */}
          <div className="grid grid-cols-4 gap-1.5 pb-3 mb-3 border-b border-slate-100">
            <button
              type="button"
              onClick={() => applyPreset("today")}
              className="py-1 px-1.5 text-[11px] font-bold rounded-lg bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-[#0070bc] border border-slate-200/70 transition-colors cursor-pointer text-center"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => applyPreset("yesterday")}
              className="py-1 px-1.5 text-[11px] font-bold rounded-lg bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-[#0070bc] border border-slate-200/70 transition-colors cursor-pointer text-center"
            >
              Kemarin
            </button>
            <button
              type="button"
              onClick={() => applyPreset("last7")}
              className="py-1 px-1.5 text-[11px] font-bold rounded-lg bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-[#0070bc] border border-slate-200/70 transition-colors cursor-pointer text-center"
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => applyPreset("thisMonth")}
              className="py-1 px-1.5 text-[11px] font-bold rounded-lg bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-[#0070bc] border border-slate-200/70 transition-colors cursor-pointer text-center"
            >
              Bulan Ini
            </button>
          </div>

          {/* Month Header Navigation */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-xs font-black text-slate-800 tracking-wide">
              {MONTH_NAMES[month]} {year}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAY_NAMES.map((d, i) => (
              <span
                key={d}
                className={`text-[10px] font-extrabold py-1 ${
                  i === 0 ? "text-rose-500" : "text-slate-400"
                }`}
              >
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div
            className="grid grid-cols-7 gap-y-1 gap-x-0.5"
            onMouseLeave={() => setHoverDate(null)}
          >
            {calendarCells.map((cell, idx) => {
              const isOtherMonth = cell.monthOffset !== 0;
              const isStart = isSelectedStart(cell.iso);
              const isEnd = isSelectedEnd(cell.iso);
              const inRange = isInRange(cell.iso);
              const isHoverEndpoint =
                tempStart && !tempEnd && hoverDate === cell.iso;

              // Today marker
              const todayStr = getShiftDate(new Date());
              const isToday = cell.iso === todayStr;

              return (
                <button
                  key={`${cell.iso}_${idx}`}
                  type="button"
                  disabled={isOtherMonth}
                  onClick={() => handleDayClick(cell.iso)}
                  onMouseEnter={() => {
                    if (tempStart && !tempEnd && !isOtherMonth) {
                      setHoverDate(cell.iso);
                    }
                  }}
                  className={`h-9 w-full flex flex-col items-center justify-center text-xs font-bold transition-all relative cursor-pointer ${
                    isOtherMonth
                      ? "text-slate-200 opacity-40 cursor-default"
                      : isStart && isEnd
                      ? "bg-[#0070bc] text-white rounded-xl shadow-sm z-10"
                      : isStart
                      ? "bg-[#0070bc] text-white rounded-l-xl z-10 shadow-sm"
                      : isEnd || isHoverEndpoint
                      ? "bg-[#0070bc] text-white rounded-r-xl z-10 shadow-sm"
                      : inRange
                      ? "bg-sky-100/70 text-[#0070bc] rounded-none font-extrabold"
                      : "text-slate-700 hover:bg-slate-100 rounded-xl"
                  }`}
                >
                  <span>{cell.day}</span>
                  {isToday && !isStart && !isEnd && !inRange && (
                    <span className="w-1 h-1 rounded-full bg-[#0070bc] absolute bottom-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Guide & Apply Button */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="text-[11px] text-slate-500 font-medium">
              {tempStart && !tempEnd ? (
                <span className="text-[#0070bc] font-bold">
                  Klik tanggal akhir untuk rentang
                </span>
              ) : tempStart && tempEnd ? (
                <span className="text-slate-700 font-bold">
                  {dayCount} Hari terpilih
                </span>
              ) : (
                <span className="text-slate-400">Pilih 1 atau 2 tanggal</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {tempStart && (
                <button
                  type="button"
                  onClick={() => {
                    const finalEnd = tempEnd || tempStart;
                    setTempEnd(finalEnd);
                    onChange(tempStart, finalEnd);
                    setIsOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#0070bc] hover:bg-[#004777] text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Pilih</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
