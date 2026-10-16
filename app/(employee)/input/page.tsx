"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HelpCircle, Info, Moon, Sun } from "lucide-react";
import EmployeeForm from "@/components/forms/EmployeeForm";
import { useAuth } from "@/lib/auth-context";
import { InputThemeProvider, useInputTheme } from "@/lib/input-theme-context";
import { cn } from "@/lib/utils";

function InputContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDark, toggleTheme } = useInputTheme();

  const [isDbConnected, setIsDbConnected] = useState(
    Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
    )
  );
  const [showHeaderInfo, setShowHeaderInfo] = useState(false);

  useEffect(() => {
    const isExplicitPanel = searchParams.get("mode") === "panel";
    if (!isExplicitPanel) {
      const lastRoute = localStorage.getItem("last_input_route");
      if (lastRoute === "/input-meter") {
        router.replace("/input-meter");
        return;
      }
    }
    localStorage.setItem("last_input_route", "/input");
  }, [searchParams, router]);

  return (
    <div
      className={cn(
        "-m-3.5 sm:-m-5 md:-m-8 p-3.5 sm:p-5 md:p-8 min-h-screen transition-colors duration-300 flex flex-col items-center",
        isDark ? "dji-dark-input dark bg-slate-950 text-slate-100" : "text-slate-800"
      )}
    >
      {/* Title Header Card */}
      <div
        className={cn(
          "w-full border rounded-2xl sm:rounded-[24px] p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-5 relative z-10 mb-4 sm:mb-6 transition-colors duration-300",
          isDark
            ? "bg-slate-900/95 border-slate-800 text-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
            : "bg-white border-[#e9ecef] shadow-[0_8px_30px_rgba(0,0,0,0.015)]"
        )}
      >
        <div className="flex flex-col gap-2 relative z-10 min-w-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowHeaderInfo((prev) => !prev)}
              className={cn(
                "p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer shrink-0",
                showHeaderInfo
                  ? "bg-sky-600 text-white shadow-xs"
                  : isDark
                  ? "bg-slate-800 text-sky-400 hover:bg-slate-700"
                  : "bg-sky-50 text-sky-600 hover:bg-sky-100"
              )}
              title="Info Parameter"
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight leading-tight truncate">
              <span
                className={cn(
                  "bg-clip-text text-transparent drop-shadow-sm",
                  isDark
                    ? "bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-200"
                    : "bg-gradient-to-r from-slate-900 via-[#004777] to-[#0070bc]"
                )}
              >
                Portal Operator Produksi
              </span>
            </h1>
          </div>

          {showHeaderInfo && (
            <div
              className={cn(
                "mt-2 p-3 border rounded-2xl text-xs sm:text-sm font-medium flex items-center gap-2.5 animate-fadeIn shadow-xs max-w-xl",
                isDark
                  ? "bg-sky-950/60 border-sky-800 text-sky-200"
                  : "bg-sky-50 border-sky-200/80 text-sky-900"
              )}
            >
              <Info className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                Pastikan data parameter mesin rajut sudah benar sebelum mengirimkan formulir.
              </span>
            </div>
          )}
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          {/* Theme Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className={cn(
              "h-9 sm:h-11 px-3 sm:px-4 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 border active:scale-95",
              isDark
                ? "bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700 shadow-sm shadow-slate-950/40"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 shadow-xs"
            )}
            title={isDark ? "Beralih ke Mode Terang (Siang)" : "Beralih ke Mode Gelap (Malam)"}
          >
            {isDark ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Mode Siang</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">Mode Malam</span>
              </>
            )}
          </button>

          {/* Tutorial Button */}
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("dji:start-panel-tour"))
            }
            className={cn(
              "h-9 sm:h-11 px-3.5 sm:px-4 rounded-full text-white text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0",
              isDark
                ? "bg-blue-600 hover:bg-blue-500 shadow-blue-900/30"
                : "bg-[#0070bc] hover:bg-[#004777]"
            )}
          >
            <HelpCircle className="w-4 h-4" />
            Tutorial
          </button>

          {/* Active Session Pill */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 border rounded-full text-xs font-medium shrink-0 transition-colors",
              isDark
                ? "bg-slate-800/90 border-slate-700 text-slate-300"
                : "bg-white border-slate-200 text-slate-600 shadow-sm"
            )}
          >
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                isDbConnected
                  ? "bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.6)] animate-pulse"
                  : "bg-slate-400"
              )}
              title={isDbConnected ? "Live Database Terhubung" : "Database Terputus / Mock Data"}
            />
            <span className={cn("font-bold", isDark ? "text-sky-400" : "text-[#0070bc]")}>
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

export default function EmployeeInputPage() {
  return (
    <InputThemeProvider>
      <Suspense fallback={null}>
        <InputContent />
      </Suspense>
    </InputThemeProvider>
  );
}
