"use client";

import React, { useEffect, useState } from "react";
import { HelpCircle, Info } from "lucide-react";
import EmployeeForm from "@/components/forms/EmployeeForm";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

export default function EmployeeInputPage() {
  const { user } = useAuth();
  const [isDbConnected, setIsDbConnected] = useState(
    Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
    )
  );
  const [showHeaderInfo, setShowHeaderInfo] = useState(false);

  useEffect(() => {
    localStorage.setItem("last_input_route", "/input");
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center py-8 px-4 w-full">
      {/* Title Header Card */}
      <div className="w-full bg-white border border-[#e9ecef] rounded-[24px] p-6 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 relative z-10 mb-6">
        <div className="flex flex-col gap-2 relative z-10">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowHeaderInfo((prev) => !prev)}
              className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer ${
                showHeaderInfo
                  ? "bg-sky-600 text-white shadow-xs"
                  : "bg-sky-50 text-sky-600 hover:bg-sky-100"
              }`}
              title="Info Parameter"
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-slate-900 via-[#004777] to-[#0070bc] bg-clip-text text-transparent drop-shadow-sm">
                Portal Operator Produksi
              </span>
            </h1>
          </div>

          {showHeaderInfo && (
            <div className="mt-2 p-3 bg-sky-50 border border-sky-200/80 rounded-2xl text-sky-900 text-xs sm:text-sm font-medium flex items-center gap-2.5 animate-fadeIn shadow-xs max-w-xl">
              <Info className="w-4 h-4 text-sky-600 shrink-0" />
              <span>
                Pastikan data parameter mesin rajut sudah benar sebelum mengirimkan formulir.
              </span>
            </div>
          )}
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("dji:start-panel-tour"))
            }
            className="h-11 px-4 rounded-full bg-[#0070bc] hover:bg-[#004777] text-white text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          >
            <HelpCircle className="w-4 h-4" />
            Tutorial
          </button>

          {/* Active Session Pill */}
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm text-xs text-slate-600 font-medium">
            <span
              className={`w-2 h-2 rounded-full ${isDbConnected ? "bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.6)] animate-pulse" : "bg-slate-400"}`}
              title={isDbConnected ? "Live Database Terhubung" : "Database Terputus / Mock Data"}
            />
            <span className="font-bold text-[#0070bc]">
              {user?.fullName.replace(" (Demo)", "")}
            </span>
          </div>
        </div>
      </div>

      {/* Form Component Container */}
      <div className="w-full flex justify-center">
        <EmployeeForm />
      </div>
    </div>
  );
}
