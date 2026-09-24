"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import LoginForm from "@/components/forms/LoginForm";
import { AlertTriangle, Info, Bug } from "lucide-react";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Peta alasan redirect yang diterima dari middleware
// Setiap alasan dicatat ke localStorage agar admin bisa melihat polanya
// ─────────────────────────────────────────────────────────────────────────────
const REDIRECT_REASONS: Record<string, { label: string; detail: string; color: string }> = {
  cookie_overflow: {
    label: "Cookie Terlalu Besar (Overflow)",
    detail:
      "Header cookie melebihi 20KB. Cookie Supabase yang menumpuk sudah dibersihkan. Silakan login kembali.",
    color: "rose",
  },
  default: {
    label: "Sesi Berakhir / Cookie Rusak",
    detail:
      "Sesi Anda telah habis atau cookie browser bermasalah. Silakan masuk kembali untuk melanjutkan.",
    color: "amber",
  },
};

function SessionExpiredNotice() {
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("session_expired") === "1";
  const rawReason = searchParams.get("reason") || "default";
  const reason = REDIRECT_REASONS[rawReason] ?? REDIRECT_REASONS["default"];

  // Catat ke localStorage untuk analisis pola di kemudian hari
  useEffect(() => {
    if (!sessionExpired) return;

    try {
      localStorage.removeItem("dji_cached_user");

      // Simpan log redirect ke localStorage (max 20 entri terakhir)
      const logKey = "dji_redirect_log";
      const existing: any[] = JSON.parse(localStorage.getItem(logKey) || "[]");
      const entry = {
        time: new Date().toLocaleString("id-ID", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
        reason: rawReason,
        url: typeof window !== "undefined" ? window.location.href : "",
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "",
      };
      const updated = [entry, ...existing].slice(0, 20); // Simpan max 20 entri
      localStorage.setItem(logKey, JSON.stringify(updated));
    } catch (e) {}
  }, [sessionExpired, rawReason]);

  if (!sessionExpired) return null;

  const colorMap: Record<string, string> = {
    rose: "bg-rose-50 border-rose-300 shadow-rose-100",
    amber: "bg-amber-50 border-amber-300 shadow-amber-100",
  };
  const textMap: Record<string, string> = {
    rose: "text-rose-900",
    amber: "text-amber-900",
  };
  const subTextMap: Record<string, string> = {
    rose: "text-rose-700",
    amber: "text-amber-700",
  };
  const iconMap: Record<string, string> = {
    rose: "text-rose-600",
    amber: "text-amber-600",
  };

  const IconComponent = rawReason === "cookie_overflow" ? Bug : AlertTriangle;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
      <div
        className={`flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-lg animate-fadeIn ${colorMap[reason.color]}`}
      >
        <IconComponent
          className={`w-5 h-5 shrink-0 mt-0.5 ${iconMap[reason.color]}`}
        />
        <div>
          <div className={`text-xs font-black ${textMap[reason.color]}`}>
            {reason.label}
          </div>
          <div
            className={`text-[11px] font-medium mt-0.5 leading-relaxed ${subTextMap[reason.color]}`}
          >
            {reason.detail}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponen kecil untuk admin: tampilkan log redirect tersimpan di localStorage
// Hanya tampil jika ada log (tidak tampil di kondisi normal)
// ─────────────────────────────────────────────────────────────────────────────
function DiagnosticLogPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dji_redirect_log");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) setLogs(parsed);
      }
    } catch (e) {}
  }, []);

  if (logs.length === 0) return null;

  return (
    <div className="fixed bottom-16 right-4 z-40">
      <button
        onClick={() => setShow((v) => !v)}
        className="flex items-center gap-1.5 bg-slate-800/80 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg border border-slate-600 hover:bg-slate-700 transition-colors cursor-pointer"
        title="Lihat log diagnostik redirect"
      >
        <Info className="w-3 h-3" />
        Log Redirect ({logs.length})
      </button>

      {show && (
        <div className="absolute bottom-9 right-0 w-80 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700">
            <span className="text-xs font-black text-white">
              Log Redirect Tablet
            </span>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem("dji_redirect_log");
                } catch (e) {}
                setLogs([]);
                setShow(false);
              }}
              className="text-[10px] text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
            >
              Hapus Log
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800">
            {logs.map((entry, i) => (
              <div key={i} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      entry.reason === "cookie_overflow"
                        ? "bg-rose-900/60 text-rose-300"
                        : "bg-amber-900/60 text-amber-300"
                    }`}
                  >
                    {entry.reason || "session_expired"}
                  </span>
                  <span className="text-[10px] text-slate-500">{entry.time}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 bg-slate-800/50 border-t border-slate-700">
            <p className="text-[10px] text-slate-500">
              Log ini hanya tersimpan di perangkat ini (localStorage).
            </p>
          </div>
        </div>
      )}
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

      {/* Diagnostic Log Panel (hanya tampil jika ada log tersimpan) */}
      <DiagnosticLogPanel />

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
