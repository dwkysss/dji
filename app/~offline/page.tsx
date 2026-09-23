"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Radio,
  RotateCcw,
  Smartphone,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function OfflineFallbackPage() {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>("");
  const [autoReloading, setAutoReloading] = useState<boolean>(false);
  const [showTips, setShowTips] = useState<boolean>(true);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    setLastCheckTime(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

    try {
      // Ping endpoint /api/health dengan cache-busting
      const response = await fetch(`/api/health?_t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (response.ok) {
        setIsOnline(true);
        setAutoReloading(true);
        // Beri jeda 1 detik agar operator melihat indikator hijau lalu reload halaman
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setIsOnline(false);
      }
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : false);
    setLastCheckTime(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

    const handleOnline = () => {
      setIsOnline(true);
      checkConnection();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Polling berkala setiap 5 detik untuk memeriksa ketersediaan jaringan secara proaktif
    const interval = setInterval(() => {
      checkConnection();
    }, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [checkConnection]);

  const handleManualReload = () => {
    setIsChecking(true);
    // Jika navigator online, langsung coba reload
    if (navigator.onLine) {
      window.location.reload();
    } else {
      checkConnection();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-10 font-sans selection:bg-[#0070bc] selection:text-white">
      {/* Top Header */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0070bc] to-sky-500 flex items-center justify-center shadow-lg shadow-sky-500/20 font-black text-white text-base tracking-wider">
            DJI
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              DJI Portal Produksi
            </h1>
            <p className="text-[11px] text-slate-400">Mode Cadangan Offline PWA</p>
          </div>
        </div>

        {/* Live Network Pill */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
            isOnline
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isOnline ? "bg-emerald-400" : "bg-rose-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isOnline ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
          </span>
          <span>{isOnline ? "Terhubung" : "Offline"}</span>
        </div>
      </div>

      {/* Center Main Card */}
      <div className="w-full max-w-lg mx-auto my-auto py-8">
        <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
          {/* Animated Icon Container */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-3xl bg-slate-900/90 border border-slate-700 flex items-center justify-center shadow-inner relative z-10">
              {isOnline || autoReloading ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
              ) : (
                <WifiOff className="w-10 h-10 text-amber-400 animate-pulse" />
              )}
            </div>
            {/* Ambient Glow */}
            <div
              className={`absolute inset-0 rounded-3xl blur-xl opacity-40 -z-0 transition-colors ${
                isOnline ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </div>

          {/* Heading */}
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
            {autoReloading
              ? "Koneksi Pulih! Memuat Halaman..."
              : "Koneksi Jaringan Terputus"}
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 max-w-md leading-relaxed mb-6">
            {autoReloading ? (
              <span className="text-emerald-300 font-medium">
                Sistem mendeteksi akses internet telah kembali. Halaman produksi sedang dimuat ulang...
              </span>
            ) : (
              "Tablet saat ini tidak dapat terhubung ke server DJI Produksi. Sistem sedang mencoba menghubungkan kembali secara otomatis."
            )}
          </p>

          {/* Reconnecting Status Banner */}
          {!autoReloading && (
            <div className="w-full mb-6 py-2.5 px-4 rounded-xl bg-slate-900/70 border border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-2">
                <RefreshCw
                  className={`w-3.5 h-3.5 text-sky-400 ${
                    isChecking ? "animate-spin" : ""
                  }`}
                />
                <span>Mencoba menghubungkan otomatis...</span>
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {lastCheckTime || "--:--:--"}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleManualReload}
              disabled={isChecking || autoReloading}
              className="flex-1 py-3 px-5 rounded-xl bg-[#0070bc] hover:bg-[#005a96] active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-[#0070bc]/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw
                className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`}
              />
              <span>{isChecking ? "Memeriksa..." : "Muat Ulang Halaman"}</span>
            </button>

            <button
              type="button"
              onClick={() => checkConnection()}
              disabled={isChecking}
              className="py-3 px-5 rounded-xl bg-slate-700/60 hover:bg-slate-700 active:scale-[0.98] text-slate-200 font-medium text-sm border border-slate-600/70 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Radio className="w-4 h-4 text-sky-400" />
              <span>Cek Sinyal</span>
            </button>
          </div>

          {/* Toggle Tips Section */}
          <div className="w-full mt-6 pt-5 border-t border-slate-700/80 text-left">
            <button
              type="button"
              onClick={() => setShowTips(!showTips)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                Panduan Lapangan untuk Operator
              </span>
              {showTips ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showTips && (
              <div className="mt-3.5 space-y-2.5 text-[11px] sm:text-xs text-slate-400">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800">
                  <Smartphone className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-200 block">1. Cek Wi-Fi Tablet:</strong>
                    Pastikan tablet tersambung ke Wi-Fi pabrik (bukan hotspot darurat{" "}
                    <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300 font-mono">
                      SETUP-ESP32-TIMER
                    </code>
                    ).
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-200 block">2. Reset Cepat Wi-Fi:</strong>
                    Tarik menu atas Android tablet, matikan ikon Wi-Fi selama 5 detik, lalu nyalakan kembali.
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800">
                  <RotateCcw className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-200 block">3. Deteksi Otomatis:</strong>
                    Begitu sinyal Wi-Fi terhubung kembali, aplikasi akan otomatis memuat ulang tanpa perlu menekan tombol apapun.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 pt-4 border-t border-slate-800 gap-2">
        <span>PT. Daese Garmin &bull; Divisi Produksi & QC</span>
        <span className="font-mono text-slate-400">
          Target Server: <span className="text-slate-300">djiprod.tech</span>
        </span>
      </div>
    </div>
  );
}
