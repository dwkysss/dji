"use client";

import React from "react";
import { Users } from "lucide-react";

export interface OperatorFilterDropdownProps {
  selectedOperators: string[];
  setSelectedOperators: React.Dispatch<React.SetStateAction<string[]>>;
  isOperatorDropdownOpen: boolean;
  setIsOperatorDropdownOpen: (open: boolean) => void;
  operatorDropdownRef: React.RefObject<HTMLDivElement | null>;
  operatorButtonLabel: string;
  operatorsByShift: Record<string, string[]>;
}

export default function OperatorFilterDropdown({
  selectedOperators,
  setSelectedOperators,
  isOperatorDropdownOpen,
  setIsOperatorDropdownOpen,
  operatorDropdownRef,
  operatorButtonLabel,
  operatorsByShift,
}: OperatorFilterDropdownProps) {
  const shifts = [
    { key: "A" as const, title: "Tim A", badgeBg: "bg-blue-50 text-blue-700 border-blue-200" },
    { key: "B" as const, title: "Tim B", badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { key: "C" as const, title: "Tim C", badgeBg: "bg-purple-50 text-purple-700 border-purple-200" },
    ...(operatorsByShift.Lainnya && operatorsByShift.Lainnya.length > 0
      ? [{ key: "Lainnya" as const, title: "Lainnya / Riwayat", badgeBg: "bg-slate-100 text-slate-700 border-slate-200" }]
      : []),
  ];

  return (
    <div className="bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-1.5 sm:px-3 sm:py-2 shadow-[0_8px_30px_rgba(0,0,0,0.015)] col-span-1 lg:w-auto shrink-0 flex items-center justify-between sm:justify-start gap-2 sm:gap-2.5">
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="p-1 rounded-lg bg-slate-50 border border-slate-200/60 text-slate-400 shrink-0">
          <Users className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] sm:text-xs font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
          Pegawai:
        </span>
      </div>
      <div className="relative flex-1 sm:flex-initial" ref={operatorDropdownRef}>
        <button
          onClick={() => setIsOperatorDropdownOpen(!isOperatorDropdownOpen)}
          className="w-full sm:w-auto bg-slate-50 border border-slate-200/60 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-1 text-[11px] sm:text-xs text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 font-bold cursor-pointer min-w-[85px] sm:min-w-[95px] flex justify-between items-center transition-colors"
        >
          <span className="truncate max-w-[110px]" title={operatorButtonLabel}>
            {operatorButtonLabel}
          </span>
          <span className="text-[9px] ml-1.5 text-slate-400">▼</span>
        </button>

        {isOperatorDropdownOpen && (
          <div className="fixed sm:absolute inset-x-4 sm:inset-x-auto top-28 sm:top-full mt-2 sm:right-0 sm:left-auto sm:w-96 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.18)] z-50 p-3 max-h-[75vh] sm:max-h-[440px] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center pb-2.5 mb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-600" />
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                  Filter Pegawai
                </span>
                <span className="text-[10px] font-bold text-slate-400 ml-1">
                  ({selectedOperators.length === 0 ? "Semua Terpilih" : `${selectedOperators.length} Dipilih`})
                </span>
              </div>
              <button
                onClick={() => setIsOperatorDropdownOpen(false)}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg transition-colors"
              >
                ✕ Tutup
              </button>
            </div>

            {/* 1-Click Quick Filter Bar */}
            <div className="mb-3">
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                Pilihan Cepat:
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={() => setSelectedOperators([])}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                    selectedOperators.length === 0
                      ? "bg-sky-600 text-white shadow-sm"
                      : "bg-slate-50 border border-slate-200/80 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Semua
                </button>
                {(["A", "B", "C"] as const).map((s) => {
                  const shiftList = operatorsByShift[s] || [];
                  const isAllShiftSelected =
                    shiftList.length > 0 &&
                    selectedOperators.length === shiftList.length &&
                    shiftList.every((n) => selectedOperators.includes(n));

                  const colorStyles =
                    s === "A"
                      ? isAllShiftSelected
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-blue-50/70 border border-blue-200/80 text-blue-700 hover:bg-blue-100/70"
                      : s === "B"
                        ? isAllShiftSelected
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-emerald-50/70 border border-emerald-200/80 text-emerald-700 hover:bg-emerald-100/70"
                        : isAllShiftSelected
                          ? "bg-purple-600 text-white shadow-sm"
                          : "bg-purple-50/70 border border-purple-200/80 text-purple-700 hover:bg-purple-100/70";

                  return (
                    <button
                      key={s}
                      onClick={() => setSelectedOperators([...shiftList])}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${colorStyles}`}
                    >
                      Tim {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Shift Groups */}
            <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar space-y-3">
              {shifts.map((group) => {
                const list = operatorsByShift[group.key] || [];
                if (list.length === 0) return null;

                const allInShiftSelected =
                  list.length > 0 && list.every((name) => selectedOperators.includes(name));

                const handleToggleShift = () => {
                  if (allInShiftSelected) {
                    setSelectedOperators((prev) => prev.filter((name) => !list.includes(name)));
                  } else {
                    setSelectedOperators((prev) => Array.from(new Set([...prev, ...list])));
                  }
                };

                return (
                  <div key={group.key} className="bg-slate-50/50 rounded-xl p-2 border border-slate-100">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200/60">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${group.badgeBg}`}>
                        {group.title} ({list.length})
                      </span>
                      <button
                        type="button"
                        onClick={handleToggleShift}
                        className="text-[10px] font-bold text-sky-600 hover:text-sky-800 hover:underline cursor-pointer"
                      >
                        {allInShiftSelected ? "Batal Pilih" : "Pilih Semua"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                      {list.map((name) => {
                        const isChecked = selectedOperators.includes(name);
                        return (
                          <label
                            key={name}
                            className="flex items-center gap-2 p-1 hover:bg-white rounded-lg cursor-pointer transition-colors group"
                            title={name}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedOperators((prev) => [...prev, name]);
                                } else {
                                  setSelectedOperators((prev) => prev.filter((o) => o !== name));
                                }
                              }}
                              className="accent-sky-500 w-3.5 h-3.5 cursor-pointer rounded shrink-0"
                            />
                            <span
                              className={`text-xs truncate transition-colors ${
                                isChecked
                                  ? "font-bold text-sky-700"
                                  : "font-medium text-slate-600 group-hover:text-slate-800"
                              }`}
                            >
                              {name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
