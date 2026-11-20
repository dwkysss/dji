"use client";

import React from "react";
import Link from "next/link";
import { ClipboardList, Truck, Clock, ArrowLeft } from "lucide-react";

export default function SuratJalanPage() {
  return (
    <div className="w-full max-w-4xl mx-auto py-6 sm:py-10 px-2 sm:px-4 animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200/80 text-[#0070bc] flex items-center justify-center shrink-0 shadow-2xs">
            <ClipboardList className="w-5 h-5" />
          </div>
          <span>Surat Jalan</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1.5">
          Kelola pengiriman kain hasil produksi ke gudang atau tujuan lain.
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 sm:p-14 flex flex-col items-center justify-center text-center relative overflow-hidden">
        <div className="absolute top-0 left-8 right-8 h-[3px] bg-gradient-to-r from-sky-400 via-[#0070bc] to-indigo-500 rounded-full opacity-80" />

        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-sky-50 to-blue-100/70 border border-sky-200/80 text-[#0070bc] flex items-center justify-center shadow-sm mb-5">
          <Truck className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-[#0070bc] text-[11px] font-black uppercase tracking-wider mb-3">
          <Clock className="w-3.5 h-3.5" />
          Coming Soon
        </span>

        <h2 className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight">
          Fitur Surat Jalan Segera Hadir
        </h2>

        <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mt-2 leading-relaxed">
          Modul pembuatan, pelacakan, dan pencetakan Surat Jalan pengiriman kain sedang dalam tahap pengembangan dan penyempurnaan.
        </p>

        <div className="mt-7">
          <Link
            href="/qc"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0070bc] hover:bg-[#005a96] text-white text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Inspeksi QC</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
