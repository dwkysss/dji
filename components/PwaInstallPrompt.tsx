"use client";

import React, { useState, useEffect } from "react";
import { Download, X, Share2, PlusSquare, Smartphone } from "lucide-react";

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // 1. Explicit Service Worker Registration
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      (window.location.protocol === "https:" || window.location.hostname === "localhost")
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("PWA Service Worker registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("PWA Service Worker registration skipped or failed:", err);
        });
    }

    // 2. Check if already running in standalone mode (installed PWA)
    const checkStandalone = () => {
      const isWindowStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");
      setIsStandalone(isWindowStandalone);
    };

    checkStandalone();

    // Check if dismissed recently (within 3 days)
    const dismissedAt = localStorage.getItem("dji_pwa_prompt_dismissed");
    if (dismissedAt) {
      const elapsedDays = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (elapsedDays < 3) {
        setIsDismissed(true);
      }
    }

    // 3. Android / Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 4. iOS Detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSPrompt(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("dji_pwa_prompt_dismissed", Date.now().toString());
  };

  // Don't render if already in standalone app or dismissed or no prompt available
  if (isStandalone || isDismissed || (!deferredPrompt && !isIOS)) {
    return null;
  }

  return (
    <>
      {/* Floating Bottom Banner for Android / Desktop */}
      {deferredPrompt && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[999] animate-in slide-in-from-bottom duration-300">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0070bc] to-sky-400 flex items-center justify-center shrink-0 shadow-md">
                <img
                  src="/assets/dji-logo.png"
                  alt="DJI"
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              </div>
              <div className="min-w-0">
                <h4 className="font-extrabold text-sm text-white tracking-tight leading-tight truncate">
                  Instal Aplikasi DJI
                </h4>
                <p className="text-[11px] text-slate-300 truncate">
                  Akses lebih cepat, ringan & tanpa repot ketik URL.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-3.5 py-2 rounded-xl bg-[#0070bc] hover:bg-sky-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Instal</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Safari Guide Modal */}
      {showIOSPrompt && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-slate-800 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-[#0070bc] flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Cara Instal di iPhone</h3>
                  <p className="text-xs text-slate-500">Gunakan browser Safari</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSPrompt(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 mb-5">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-[#0070bc] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <p>
                  Ketuk tombol <strong>Share</strong> (ikon kotak dengan panah ke atas{" "}
                  <Share2 className="w-3.5 h-3.5 inline text-[#0070bc]" />) di bilah bawah browser Safari.
                </p>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-[#0070bc] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <p>
                  Gulir ke bawah dan pilih{" "}
                  <strong className="text-slate-800">
                    "Tambahkan ke Layar Utama" (Add to Home Screen){" "}
                    <PlusSquare className="w-3.5 h-3.5 inline text-[#0070bc]" />
                  </strong>
                  .
                </p>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-[#0070bc] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <p>
                  Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas. Ikon aplikasi DJI akan muncul di layar utama iPhone Anda!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowIOSPrompt(false);
                handleDismiss();
              }}
              className="w-full h-11 rounded-xl bg-[#0070bc] hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
