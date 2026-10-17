"use client";

import React, { useEffect, useState } from "react";
import { DownloadCloud, Sparkles, X, CheckCircle2, ArrowRight } from "lucide-react";
import { AppVersionResponse } from "@/app/api/app-version/route";

declare global {
  interface Window {
    AndroidAppInfo?: {
      getVersionCode: () => number;
      getVersionName: () => string;
      isAndroidApp: () => boolean;
    };
    Capacitor?: any;
  }
}

interface ClientAppInfo {
  isNative: boolean;
  code: number;
  name: string;
}

function getNativeClientInfo(): ClientAppInfo {
  if (typeof window === "undefined") {
    return { isNative: false, code: 1, name: "1.0.0" };
  }

  const appInfo = window.AndroidAppInfo;
  const isCapacitor = Boolean(window.Capacitor?.isNativePlatform?.());

  if (!appInfo && !isCapacitor) {
    return { isNative: false, code: 1, name: "1.0.0" };
  }

  return {
    isNative: true,
    code: appInfo ? appInfo.getVersionCode() : 1,
    name: appInfo ? appInfo.getVersionName() : "1.0.0",
  };
}

function shouldPromptUpdate(data: AppVersionResponse, currentCode: number): boolean {
  if (data.latestVersionCode <= currentCode) {
    return false;
  }
  if (data.mandatory) {
    return true;
  }
  const dismissedKey = `dji_dismissed_update_${data.latestVersionCode}`;
  return sessionStorage.getItem(dismissedKey) !== "true";
}

export default function AppUpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<AppVersionResponse | null>(null);
  const [installedVersion, setInstalledVersion] = useState<{ code: number; name: string } | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const checkAppVersion = async () => {
      try {
        const client = getNativeClientInfo();
        if (!client.isNative) return;

        setInstalledVersion({ code: client.code, name: client.name });

        const res = await fetch(`/api/app-version?_t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;

        const data: AppVersionResponse = await res.json();
        if (shouldPromptUpdate(data, client.code)) {
          setUpdateInfo(data);
        }
      } catch (err) {
        console.warn("[AppUpdateChecker] Gagal memeriksa versi APK:", err);
      }
    };


    // Cek versi saat pertama kali aplikasi dibuka
    const timer = setTimeout(checkAppVersion, 2500);

    // Listener jika user mengecek versi manual dari menu profil
    const handleManualCheck = () => {
      checkAppVersion();
    };

    window.addEventListener("dji_check_app_update", handleManualCheck);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("dji_check_app_update", handleManualCheck);
    };
  }, []);

  const handleDismiss = () => {
    if (!updateInfo) return;
    sessionStorage.setItem(`dji_dismissed_update_${updateInfo.latestVersionCode}`, "true");
    setIsDismissed(true);
  };

  const handleDownload = () => {
    if (!updateInfo) return;
    setIsDownloading(true);

    try {
      // Buka URL download APK di browser download manager native Android
      const downloadUrl = updateInfo.apkUrl.startsWith("http")
        ? updateInfo.apkUrl
        : window.location.origin + updateInfo.apkUrl;

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", "dji-app.apk");
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        setIsDownloading(false);
      }, 4000);
    } catch (e) {
      setIsDownloading(false);
      window.open(updateInfo.apkUrl, "_system");
    }
  };

  if (!updateInfo || isDismissed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center animate-scaleIn overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-24 bg-sky-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Dismiss Button (jika tidak mandatory) */}
        {!updateInfo.mandatory && (
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tutup & Ingatkan Nanti"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Icon Header */}
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0070bc] to-sky-400 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 mb-4">
          <DownloadCloud className="w-8 h-8 text-white animate-bounce" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Badge Versi */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-[11px] font-extrabold uppercase tracking-wider mb-2">
          <span>Pembaruan Versi Tersedia</span>
        </div>

        {/* Title */}
        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
          Versi {updateInfo.latestVersionName} Siap Diunduh
        </h3>

        {/* Perbandingan Versi */}
        <div className="flex items-center gap-2 mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>v{installedVersion?.name || "1.0"}</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
            v{updateInfo.latestVersionName} ({updateInfo.apkSize})
          </span>
        </div>

        {/* Rincian Pembaruan */}
        <div className="w-full mt-4 mb-5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 text-left">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-400 block mb-2">
            Catatan Pembaruan:
          </span>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
            {updateInfo.releaseNotes.map((note, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full py-3.5 px-5 rounded-xl bg-[#0070bc] hover:bg-[#005a96] text-white font-bold text-sm shadow-lg shadow-[#0070bc]/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <DownloadCloud className={`w-4 h-4 ${isDownloading ? "animate-spin" : ""}`} />
            <span>{isDownloading ? "Memulai Unduhan APK..." : "Unduh & Pasang Sekarang"}</span>
          </button>

          {!updateInfo.mandatory && (
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
            >
              Nanti Saja
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
