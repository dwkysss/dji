"use client";

import React from "react";
import { Users } from "lucide-react";
import { TopOperatorItem } from "./leaderboardUtils";

export interface TopOperatorsCardProps {
  topOperators: TopOperatorItem[];
  metricMode: "PCS" | "METER";
}

export default function TopOperatorsCard({
  topOperators,
  metricMode,
}: TopOperatorsCardProps) {
  return (
    <div className="bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col justify-between transition-all duration-300 hover:shadow-md">
      <div>
        <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-800">
              Operator Terbaik (Top 5)
            </h3>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 uppercase">
            {metricMode === "METER" ? "Hasil Meter" : "Hasil Panel"}
          </span>
        </div>
        <div className="space-y-2">
          {topOperators.length > 0 ? (
            topOperators.map((op, idx) => (
              <div
                key={op.name}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      idx === 0
                        ? "bg-amber-100 text-amber-700"
                        : idx === 1
                          ? "bg-slate-200 text-slate-700"
                          : idx === 2
                            ? "bg-orange-100 text-orange-700"
                            : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">
                      {op.name}
                    </span>
                    <span className="text-[9px] font-medium text-slate-400">
                      {op.group}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-black text-slate-800">
                  {metricMode === "METER"
                    ? `${op.meter.toLocaleString()} meter`
                    : `${op.pcs.toLocaleString()} panel`}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-xs text-slate-400 font-bold">
              Tidak ada data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
