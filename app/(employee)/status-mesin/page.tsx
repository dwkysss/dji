"use client";

import React from "react";
import StatusMesinForm from "@/components/forms/StatusMesinForm";

export default function StatusMesinPage() {
  return (
    <div className="flex-1 flex flex-col items-center animate-fadeIn py-4 sm:py-8 px-2.5 sm:px-4 w-full min-h-[calc(100vh-64px)] bg-slate-50">
      {/* Title Header Card */}
      <div className="w-full bg-white border border-[#e9ecef] rounded-2xl sm:rounded-[24px] p-4 sm:p-6 lg:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col relative z-10 mb-4 sm:mb-6 text-center">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight leading-tight mb-2">
          <span className="bg-gradient-to-r from-rose-600 to-rose-400 bg-clip-text text-transparent drop-shadow-sm">
            Status Mesin Berhenti
          </span>
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed">
          Gunakan formulir di bawah ini untuk melaporkan mesin yang sedang tidak beroperasi karena libur panjang, menunggu order, atau kerusakan total tanpa harus menggunakan timer produksi.
        </p>
      </div>

      {/* Form Component Container */}
      <div className="w-full flex justify-center">
        <StatusMesinForm />
      </div>
    </div>
  );
}
