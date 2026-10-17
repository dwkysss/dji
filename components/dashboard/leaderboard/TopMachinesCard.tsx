"use client";

import React from "react";
import { SlidersHorizontal } from "lucide-react";
import { TopMachineItem } from "./leaderboardUtils";

export interface TopMachinesCardProps {
  topMachines: TopMachineItem[];
  metricMode: "PCS" | "METER";
}

export default function TopMachinesCard({
  topMachines,
  metricMode,
}: TopMachinesCardProps) {
  return (
    <div className="bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col justify-between transition-all duration-300 hover:shadow-md">
      <div>
        <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-sky-50 rounded-lg text-sky-600">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-800">
              Mesin Terproduktif (Top 5)
            </h3>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 uppercase">
            {metricMode === "METER" ? "Hasil Meter" : "Hasil Panel"}
          </span>
        </div>
        <div className="space-y-2">
          {topMachines.length > 0 ? (
            topMachines.map((m, idx) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      idx === 0
                        ? "bg-sky-100 text-sky-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {m.id}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-slate-800">
                    {metricMode === "METER"
                      ? `${m.meter.toLocaleString()} meter`
                      : `${m.pcs.toLocaleString()} panel`}
                  </span>
                </div>
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
