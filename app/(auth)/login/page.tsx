"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import LoginForm from "@/components/forms/LoginForm";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

function SessionExpiredNotice() {
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("session_expired") === "1";

  // Bersihkan cache user lama di localStorage jika sesi kedaluwarsa/rusak
  useEffect(() => {
    if (sessionExpired) {
      try {
        localStorage.removeItem("dji_cached_user");
      } catch (e) {}
    }
  }, [sessionExpired]);

  if (!sessionExpired) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-300 shadow-lg shadow-amber-100 animate-fadeIn">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <div className="text-xs font-black text-amber-900">Sesi Berakhir / Cookie Rusak</div>
          <div className="text-[11px] font-medium text-amber-700 mt-0.5 leading-relaxed">
            Sesi Anda telah habis atau cookie browser bermasalah. Silakan masuk kembali untuk melanjutkan.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setDate(
        now.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 min-h-screen w-full bg-slate-50 flex flex-col justify-between p-6 relative overflow-hidden">
      {/* Background Decorative Rings & Glow spots */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-[#0070bc]/10 rounded-full blur-[120px] pointer-events-none mix-blend-multiply" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-sky-400/15 rounded-full blur-[100px] pointer-events-none mix-blend-multiply" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-indigo-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Decorative Dot Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.25] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#94a3b8 1px, transparent 1px)",
          backgroundSize: "20px 20px"
        }}
      />

      {/* Session Expired Banner inside Suspense */}
      <Suspense fallback={null}>
        <SessionExpiredNotice />
      </Suspense>

      {/* Top Bar: Digital Clock & Date */}
      <header className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white border border-[#0070bc]/20 shadow-lg shadow-[#0070bc]/10 flex items-center justify-center shrink-0">
            <img src="/assets/dji-logo.png" alt="DJI Logo" className="w-8 h-8 object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-tight text-slate-900 leading-tight text-lg flex items-center gap-1.5">
              DJI
            </span>
          </div>
        </div>

        <div className="text-center sm:text-right">
          <div className="text-2xl font-black text-slate-800 tracking-wider tabular-nums">
            {time || "00:00:00"}
          </div>
          <div className="text-[10px] text-[#0070bc] font-extrabold uppercase mt-0.5 tracking-wider">
            {date || "Loading..."}
          </div>
        </div>
      </header>

      {/* Middle Area: Login PINPad */}
      <main className="flex-1 flex items-center justify-center py-10 z-10">
        <LoginForm />
      </main>

      {/* Bottom Bar: Status Info */}
      <footer className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider z-10">
        <div></div>
        <div>© 2026 DJI Systems. Hak Cipta Dilindungi.</div>
      </footer>
    </div>
  );
}
