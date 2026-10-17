"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { CriticalMachineItem, formatDuration } from "./leaderboardUtils";

export interface CriticalMachinesCardProps {
  criticalMachines: CriticalMachineItem[];
}

export default function CriticalMachinesCard({
  criticalMachines,
}: CriticalMachinesCardProps) {
  return (
    <div className="bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col justify-between transition-all duration-300 hover:shadow-md relative overflow-hidden">
      {criticalMachines.length > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />
      )}
      <div>
        <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-50 rounded-lg text-red-500">
              <AlertTriangle className="w-4 h-4 animate-pulse" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-800">
              Perlu Inspeksi (Bottom 5)
            </h3>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-700 uppercase">
            Cacat / Downtime
          </span>
        </div>
        <div className="space-y-2">
          {criticalMachines.length > 0 ? (
            criticalMachines.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-red-55/20 border border-transparent hover:border-red-100/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black bg-red-100 text-red-700 animate-pulse">
                    ⚠️
                  </span>
                  <span className="text-xs font-bold text-red-700">
                    {m.id}
                  </span>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="text-xs font-black text-rose-600">
                    {m.defects} cacat
                  </span>
                  {m.downtime > 0 && (
                    <span className="text-[10px] font-bold text-amber-600 mt-0.5">
                      ⏳ {formatDuration(m.downtime)}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-xs text-emerald-600 font-extrabold flex flex-col items-center gap-1">
              <span>✅ Semua Mesin Optimal</span>
              <span className="text-[9px] text-slate-400 font-medium">
                0 record cacat/downtime
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
