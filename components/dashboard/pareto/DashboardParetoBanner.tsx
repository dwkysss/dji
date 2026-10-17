"use client";

import React from "react";
import { ParetoItem } from "./paretoUtils";

export interface DashboardParetoBannerProps {
  vitalFewItems: ParetoItem[];
  paretoGroupBy: "KATEGORI" | "MESIN";
}

export default function DashboardParetoBanner({
  vitalFewItems,
  paretoGroupBy,
}: DashboardParetoBannerProps) {
  if (vitalFewItems.length === 0) return null;

  return (
    <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-sky-500/[0.08] via-blue-500/[0.04] to-[#0070bc]/[0.08] border border-sky-200/90 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-sky-200/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0070bc] to-sky-600 text-white font-black text-xs flex items-center justify-center shadow-xs shadow-[#0070bc]/25">
            80%
          </div>
          <div>
            <span className="font-extrabold text-slate-900 text-sm block">
              Vital Few (Penyebab Dominan Utama)
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              Faktor prioritas yang menyumbang 80% total masalah pabrik
            </span>
          </div>
        </div>
        <span className="text-[11px] font-extrabold text-[#0070bc] bg-sky-100/90 px-2.5 py-1 rounded-lg border border-sky-200/80 self-start sm:self-auto">
          {vitalFewItems.length}{" "}
          {paretoGroupBy === "KATEGORI" ? "Masalah" : "Mesin"} Teratas
        </span>
      </div>

      {/* Ranked Chips */}
      <div className="flex flex-wrap gap-2 my-3">
        {vitalFewItems.map((item, i) => (
          <div
            key={item.code}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
              i === 0
                ? "bg-[#0070bc] text-white border-[#005a96] shadow-xs"
                : "bg-white text-slate-800 border-sky-200 shadow-2xs hover:border-[#0070bc]"
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                i === 0
                  ? "bg-white text-[#0070bc]"
                  : "bg-sky-100 text-[#0070bc]"
              }`}
            >
              {i + 1}
            </span>
            <span>{item.friendlyName}</span>
            <span
              className={`text-[10.5px] font-extrabold ${
                i === 0 ? "text-sky-100" : "text-[#0070bc]"
              }`}
            >
              {item.individualPct}%
            </span>
          </div>
        ))}
      </div>

      <p className="text-[11.5px] text-slate-600 font-medium">
        Fokus penanganan pada{" "}
        <strong className="text-[#0070bc]">
          {vitalFewItems.length}{" "}
          {paretoGroupBy === "KATEGORI" ? "kategori masalah" : "mesin"} di atas
        </strong>{" "}
        akan memberikan dampak penurunan masalah hingga{" "}
        <strong className="text-[#0070bc]">80%</strong>.
      </p>
    </div>
  );
}
