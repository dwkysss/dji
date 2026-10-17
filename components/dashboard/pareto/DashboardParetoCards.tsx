"use client";

import React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { ParetoItem } from "./paretoUtils";

export interface DashboardParetoCardsProps {
  list: ParetoItem[];
  showAllParetoCards: boolean;
  setShowAllParetoCards: (val: boolean) => void;
  paretoGroupBy: "KATEGORI" | "MESIN";
  paretoMode: "COUNT" | "DURATION";
}

export default function DashboardParetoCards({
  list,
  showAllParetoCards,
  setShowAllParetoCards,
  paretoGroupBy,
  paretoMode,
}: DashboardParetoCardsProps) {
  const maxInitialVisible = 4;
  const visibleCards = showAllParetoCards ? list : list.slice(0, maxInitialVisible);
  const remainingCount = list.length - maxInitialVisible;

  if (list.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6">
        {visibleCards.map((item, idx) => {
          const isRank1 = idx === 0 && item.isVital80;
          return (
            <div
              key={item.code}
              className={`p-4 rounded-2xl transition-all border ${
                isRank1
                  ? "bg-gradient-to-br from-sky-500/[0.08] via-sky-500/[0.03] to-white border-sky-300 shadow-xs ring-1 ring-[#0070bc]/20"
                  : item.isVital80
                  ? "bg-sky-50/40 border-sky-200/80 shadow-2xs hover:border-[#0070bc]/50"
                  : "bg-slate-50/40 border-slate-200/60 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                      isRank1
                        ? "bg-[#0070bc] text-white shadow-xs"
                        : item.isVital80
                        ? "bg-sky-100 text-[#0070bc]"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-xs font-black text-slate-800 truncate"
                      title={item.friendlyName}
                    >
                      {item.friendlyName}
                    </span>
                    {paretoGroupBy === "KATEGORI" &&
                      item.category &&
                      item.category !== "X" && (
                        <span className="text-[9px] font-bold text-slate-400">
                          Kategori {item.category}
                        </span>
                      )}
                  </div>
                </div>
                {isRank1 ? (
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-[#0070bc] text-white shadow-xs shrink-0">
                    #1 Dominan
                  </span>
                ) : item.isVital80 ? (
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-sky-100 text-[#0070bc] border border-sky-200 shrink-0">
                    Vital 80%
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-500 shrink-0">
                    Trivial
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 mt-2.5">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-700">
                    Kontribusi:{" "}
                    <span className="text-[#0070bc] font-black">
                      {item.individualPct}%
                    </span>
                  </span>
                  <span className="text-[9px] text-slate-400 font-semibold">
                    Kumulatif: {item.cumulativePct}%
                  </span>
                </div>
                <div className="text-right">
                  {paretoMode === "COUNT" ? (
                    <span className="text-sm font-black text-slate-800">
                      {item.count}{" "}
                      <span className="text-[10px] text-slate-400 font-bold">
                        kejadian
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm font-black text-slate-800">
                      {Math.round(item.downtime / 60)}{" "}
                      <span className="text-[10px] text-slate-400 font-bold">
                        menit
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {list.length > maxInitialVisible && (
        <div className="flex justify-center mt-4 pt-1">
          <button
            type="button"
            onClick={() => setShowAllParetoCards(!showAllParetoCards)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-extrabold border border-slate-200 shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
          >
            {showAllParetoCards ? (
              <>
                <ChevronUp className="w-4 h-4 text-slate-500" />
                Tampilkan Lebih Sedikit
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 text-slate-500" />
                Lihat Lebih Banyak (
                {remainingCount}{" "}
                {paretoGroupBy === "KATEGORI" ? "detail masalah" : "mesin"} lagi)
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
