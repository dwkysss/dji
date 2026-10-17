"use client";

import React from "react";
import { Layers } from "lucide-react";

export interface MachineFilterDropdownProps {
  selectedMachines: string[];
  setSelectedMachines: React.Dispatch<React.SetStateAction<string[]>>;
  isMachineDropdownOpen: boolean;
  setIsMachineDropdownOpen: (open: boolean) => void;
  machineDropdownRef: React.RefObject<HTMLDivElement | null>;
  machineButtonLabel: string;
  machinesByType: { R: string[]; T: string[]; Lainnya: string[] };
}

export default function MachineFilterDropdown({
  selectedMachines,
  setSelectedMachines,
  isMachineDropdownOpen,
  setIsMachineDropdownOpen,
  machineDropdownRef,
  machineButtonLabel,
  machinesByType,
}: MachineFilterDropdownProps) {
  const isAllRSelected =
    machinesByType.R.length > 0 &&
    selectedMachines.length === machinesByType.R.length &&
    machinesByType.R.every((m) => selectedMachines.includes(m));

  const isAllTSelected =
    machinesByType.T.length > 0 &&
    selectedMachines.length === machinesByType.T.length &&
    machinesByType.T.every((m) => selectedMachines.includes(m));

  const groups = [
    { key: "R" as const, title: "Mesin R", badgeBg: "bg-blue-50 text-blue-700 border-blue-200" },
    { key: "T" as const, title: "Mesin T", badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    ...(machinesByType.Lainnya && machinesByType.Lainnya.length > 0
      ? [{ key: "Lainnya" as const, title: "Lainnya", badgeBg: "bg-slate-100 text-slate-700 border-slate-200" }]
      : []),
  ];

  return (
    <div className="bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-1.5 sm:px-3 sm:py-2 shadow-[0_8px_30px_rgba(0,0,0,0.015)] col-span-1 lg:w-auto shrink-0 flex items-center justify-between sm:justify-start gap-2 sm:gap-2.5">
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="p-1 rounded-lg bg-slate-50 border border-slate-200/60 text-slate-400 shrink-0">
          <Layers className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] sm:text-xs font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
          Mesin:
        </span>
      </div>
      <div className="relative flex-1 sm:flex-initial" ref={machineDropdownRef}>
        <button
          onClick={() => setIsMachineDropdownOpen(!isMachineDropdownOpen)}
          className="w-full sm:w-auto bg-slate-50 border border-slate-200/60 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-1 text-[11px] sm:text-xs text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 font-bold cursor-pointer min-w-[85px] sm:min-w-[95px] flex justify-between items-center transition-colors"
        >
          <span className="truncate max-w-[110px]" title={machineButtonLabel}>
            {machineButtonLabel}
          </span>
          <span className="text-[9px] ml-1.5 text-slate-400">▼</span>
        </button>

        {isMachineDropdownOpen && (
          <div className="fixed sm:absolute inset-x-4 sm:inset-x-auto top-28 sm:top-full mt-2 sm:left-0 sm:right-auto sm:w-80 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.18)] z-50 p-3 max-h-[75vh] sm:max-h-[440px] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center pb-2.5 mb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-600" />
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                  Filter Mesin
                </span>
                <span className="text-[10px] font-bold text-slate-400 ml-1">
                  ({selectedMachines.length === 0 ? "Semua Terpilih" : `${selectedMachines.length} Dipilih`})
                </span>
              </div>
              <button
                onClick={() => setIsMachineDropdownOpen(false)}
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
              <div className={`grid ${machinesByType.T.length > 0 ? "grid-cols-3" : "grid-cols-2"} gap-1.5`}>
                <button
                  onClick={() => setSelectedMachines([])}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                    selectedMachines.length === 0
                      ? "bg-sky-600 text-white shadow-sm"
                      : "bg-slate-50 border border-slate-200/80 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Semua
                </button>
                {machinesByType.R.length > 0 && (
                  <button
                    onClick={() => setSelectedMachines([...machinesByType.R])}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                      isAllRSelected
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-blue-50/70 border border-blue-200/80 text-blue-700 hover:bg-blue-100/70"
                    }`}
                  >
                    Mesin R
                  </button>
                )}
                {machinesByType.T.length > 0 && (
                  <button
                    onClick={() => setSelectedMachines([...machinesByType.T])}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                      isAllTSelected
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-emerald-50/70 border border-emerald-200/80 text-emerald-700 hover:bg-emerald-100/70"
                    }`}
                  >
                    Mesin T
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Machine Groups */}
            <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar space-y-3">
              {groups.map((group) => {
                const list = machinesByType[group.key] || [];
                if (list.length === 0) return null;

                const allInGroupSelected =
                  list.length > 0 && list.every((m) => selectedMachines.includes(m));

                const handleToggleGroup = () => {
                  if (allInGroupSelected) {
                    setSelectedMachines((prev) => prev.filter((m) => !list.includes(m)));
                  } else {
                    setSelectedMachines((prev) => Array.from(new Set([...prev, ...list])));
                  }
                };

                return (
                  <div key={group.key} className="bg-slate-50/50 rounded-xl p-2 border border-slate-100">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200/60">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${group.badgeBg}`}>
                        {group.title}
                      </span>
                      <button
                        type="button"
                        onClick={handleToggleGroup}
                        className="text-[10px] font-bold text-sky-600 hover:text-sky-800 hover:underline cursor-pointer"
                      >
                        {allInGroupSelected ? "Batal Pilih" : "Pilih Semua"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                      {list.map((mac) => {
                        const isChecked = selectedMachines.includes(mac);
                        return (
                          <label
                            key={mac}
                            className="flex items-center gap-2 p-1 hover:bg-white rounded-lg cursor-pointer transition-colors group"
                            title={mac}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMachines((prev) => [...prev, mac]);
                                } else {
                                  setSelectedMachines((prev) => prev.filter((m) => m !== mac));
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
                              {mac}
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
