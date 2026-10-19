"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  DownloadCloud,
  Smartphone,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Copy,
  Check,
  Sparkles,
  WifiOff,
  Camera,
  Sun,
  ChevronRight,
  QrCode,
  FileCode2,
  RefreshCw,
  Info,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/lib/auth-context";

export default function DownloadPage() {
  const { isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState<"android" | "desktop">("android");
  const [copied, setCopied] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("/downloads/dji-app.apk");
  const [fullApkUrl, setFullApkUrl] = useState("https://djiprod.tech/downloads/dji-app.apk");
  const [versionInfo, setVersionInfo] = useState({
    versionName: "1.0.0",
    size: "21.6 MB",
    updated: "Oktober 2026",
    minAndroid: "Android 8.0+",
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      setFullApkUrl(`${origin}/downloads/dji-app.apk`);
    }

    // Fetch version metadata if available
    fetch("/api/app-version", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.latestVersionName) {
          setVersionInfo((prev) => ({
            ...prev,
            versionName: data.latestVersionName || prev.versionName,
            size: data.apkSize || prev.size,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fullApkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-800 flex flex-col relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-[#0070bc]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-sky-400/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Decorative Dot Grid */}
      <div
        className="absolute inset-0 opacity-[0.25] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#94a3b8 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Header */}
      <header className="relative z-10 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#0070bc]/20 shadow-sm flex items-center justify-center shrink-0">
              <img src="/assets/dji-logo.png" alt="DJI Logo" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <div className="text-sm font-black tracking-tight text-slate-900 leading-none">
                DJI Produksi
              </div>
              <div className="text-[10px] font-semibold text-[#0070bc] mt-0.5">
                Portal Unduhan Resmi
              </div>
            </div>
          </div>

          <Link
            href={isLoggedIn ? "/" : "/login"}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#0070bc] text-slate-700 hover:text-white text-xs font-bold transition-all shadow-xs"
          >
            <span>{isLoggedIn ? "Kembali ke Dashboard" : "Buka Web Portal"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-8">
        
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100/80 border border-sky-300/60 text-[#0070bc] text-xs font-bold mb-4 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Rilis Resmi Aplikasi v{versionInfo.versionName}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Unduh Aplikasi <span className="text-[#0070bc]">DJI Mobile</span> &amp; Desktop
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
            Aplikasi resmi operasional pabrik PT Dentelle Jaya Infinitex untuk input data mesin, inspeksi QC, tracking mending, dan sinkronisasi data produksi.
          </p>

          {/* Platform Switcher Tabs */}
          <div className="mt-6 p-1.5 bg-slate-200/70 backdrop-blur-xs rounded-2xl flex items-center gap-1.5 shadow-inner">
            <button
              onClick={() => setActiveTab("android")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "android"
                  ? "bg-white text-[#0070bc] shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Android APK (Tablet &amp; HP)</span>
            </button>
            <button
              onClick={() => setActiveTab("desktop")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "desktop"
                  ? "bg-white text-[#0070bc] shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>Laptop &amp; Desktop (PWA)</span>
            </button>
          </div>
        </div>

        {/* TAB 1: ANDROID APK */}
        {activeTab === "android" && (
          <div className="flex flex-col gap-8 animate-fadeIn">
            {/* Primary Download Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-sky-100/50 rounded-full blur-3xl pointer-events-none" />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
                {/* Left Column: Download CTA & Info */}
                <div className="lg:col-span-7 flex flex-col gap-5">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-[#0070bc] flex items-center justify-center text-white shadow-lg shadow-[#0070bc]/30 shrink-0">
                      <Smartphone className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                        DJI Mobile Android
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Paket Instalasi Standalone (.apk)
                      </p>
                    </div>
                  </div>

                  {/* Pills Info */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="px-3 py-1 rounded-lg bg-sky-50 text-[#0070bc] border border-sky-200">
                      Versi: <strong>v{versionInfo.versionName}</strong>
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                      Ukuran: <strong>{versionInfo.size}</strong>
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <strong>Bebas Malware / Internal DJI</strong>
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                      Min: {versionInfo.minAndroid}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Dirancang untuk tablet operator di mesin rajut/tricote dan perangkat QC mending. Mendukung mode offline darurat, pemindaian QR kamera, dan pencegahan layar mati otomatis.
                  </p>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                    <a
                      href={downloadUrl}
                      download="dji-app.apk"
                      className="inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-gradient-to-r from-[#0070bc] to-sky-600 hover:from-[#005a96] hover:to-sky-700 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-[#0070bc]/30 hover:shadow-xl hover:shadow-[#0070bc]/40 transition-all cursor-pointer transform active:scale-[0.98]"
                    >
                      <DownloadCloud className="w-5 h-5 animate-bounce" />
                      <span>Unduh File APK Langsung</span>
                    </a>

                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-all border border-slate-200/80 cursor-pointer"
                      title="Salin Tautan Download"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-700">Tautan Disalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-slate-500" />
                          <span>Salin Link</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Dapat dibagikan ke grup WhatsApp atau langsung diinstall di tablet Android.</span>
                  </div>
                </div>

                {/* Right Column: QR Code Box */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-sky-50/50 p-6 rounded-2xl border border-slate-200/90 text-center">
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-md">
                    <QRCodeSVG
                      value={fullApkUrl}
                      size={170}
                      level="M"
                      includeMargin={false}
                    />
                  </div>

                  <div className="mt-3.5 flex items-center gap-1.5 text-xs font-black text-slate-800">
                    <QrCode className="w-4 h-4 text-[#0070bc]" />
                    <span>Scan untuk Unduh di HP</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-tight">
                    Buka kamera HP atau aplikasi scanner, arahkan ke QR ini untuk langsung mengunduh ke perangkat Anda.
                  </p>
                </div>
              </div>
            </div>

            {/* Step-by-Step Installation Guide */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center text-[#0070bc]">
                  <FileCode2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Panduan Instalasi APK di Android
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ikuti 4 langkah mudah berikut jika Anda baru pertama kali memasang aplikasi:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Step 1 */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-[#0070bc] text-white font-black text-sm flex items-center justify-center mb-3 shadow-sm">
                      1
                    </div>
                    <div className="font-extrabold text-sm text-slate-900">
                      Unduh APK
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      Tekan tombol <strong>Unduh File APK</strong> di atas atau scan QR Code dari HP/Tablet Anda.
                    </p>
                  </div>
                  <div className="mt-4 text-[11px] font-semibold text-[#0070bc]">
                    File tersimpan di folder Unduhan
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-[#0070bc] text-white font-black text-sm flex items-center justify-center mb-3 shadow-sm">
                      2
                    </div>
                    <div className="font-extrabold text-sm text-slate-900">
                      Buka File
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      Tarik bilah notifikasi Android saat unduhan selesai, atau buka aplikasi <strong>Pengelola File</strong> &gt; <strong>Download</strong> &gt; ketuk <code>dji-app.apk</code>.
                    </p>
                  </div>
                  <div className="mt-4 text-[11px] font-semibold text-slate-500">
                    Notifikasi: Unduhan selesai
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-amber-50/60 rounded-2xl p-5 border border-amber-200 flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white font-black text-sm flex items-center justify-center mb-3 shadow-sm">
                      3
                    </div>
                    <div className="font-extrabold text-sm text-amber-950 flex items-center gap-1.5">
                      <span>Izinkan Sumber Luar</span>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <p className="text-xs text-amber-900 mt-1.5 leading-relaxed">
                      Jika muncul peringatan keamanan, ketuk <strong>Setelan (Settings)</strong>, lalu aktifkan <strong>&quot;Izinkan dari sumber ini&quot;</strong>.
                    </p>
                  </div>
                  <div className="mt-4 text-[11px] font-bold text-amber-800">
                    Aman • Khusus Internal Pabrik
                  </div>
                </div>

                {/* Step 4 */}
                <div className="bg-emerald-50/60 rounded-2xl p-5 border border-emerald-200 flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center mb-3 shadow-sm">
                      4
                    </div>
                    <div className="font-extrabold text-sm text-emerald-950 flex items-center gap-1.5">
                      <span>Pasang &amp; Selesai</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <p className="text-xs text-emerald-900 mt-1.5 leading-relaxed">
                      Ketuk tombol <strong>Pasang (Install)</strong>. Buka aplikasi DJI yang telah muncul di beranda dan login dengan PIN Anda.
                    </p>
                  </div>
                  <div className="mt-4 text-[11px] font-bold text-emerald-800">
                    Siap Digunakan
                  </div>
                </div>
              </div>
            </div>

            {/* Key Capabilities */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <h3 className="text-lg font-black text-slate-900 mb-4">
                Keunggulan Aplikasi Mobile DJI
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center text-[#0070bc] shrink-0">
                    <WifiOff className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">Mode Darurat Offline</div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Data input tetap tersimpan aman di tablet meskipun koneksi WiFi pabrik sedang putus atau lambat.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">Kamera &amp; Scanner QR</div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Langsung foto cacat kain dan scan QR batch tanpa perlu alat scanner barcode terpisah.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                    <Sun className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">Anti Layar Mati (WakeLock)</div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Layar tablet tetap menyala selama operator bekerja, tidak perlu bolak-balik menyalakan layar mesin.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LAPTOP & DESKTOP (PWA) */}
        {activeTab === "desktop" && (
          <div className="flex flex-col gap-8 animate-fadeIn">
            {/* Desktop Hero Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 relative overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-8 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shrink-0">
                      <Monitor className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                        Aplikasi Desktop (Windows &amp; Mac)
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Instalasi Instan Melalui Browser Chrome / Edge
                      </p>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Untuk komputer kantor, PC kepala shift, atau laptop manager, Anda <strong>tidak perlu mengunduh file APK</strong>. Portal DJI dapat langsung di-install sebagai aplikasi desktop native melalui Progressive Web App (PWA) dengan tampilan mandiri tanpa tab browser.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#0070bc] hover:bg-[#005a96] text-white font-extrabold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                    >
                      <span>Buka Portal &amp; Pasang Sekarang</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-slate-50 rounded-2xl p-5 border border-slate-200/90 text-center flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-xs mb-3">
                    <img src="/assets/dji-logo.png" alt="DJI" className="w-8 h-8 object-contain" />
                  </div>
                  <div className="text-xs font-black text-slate-900">Shortcut Langsung di Desktop</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Aplikasi muncul di Taskbar &amp; Start Menu Windows persis aplikasi desktop biasa.
                  </p>
                </div>
              </div>
            </div>

            {/* Desktop Install Steps */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <h3 className="text-lg font-black text-slate-900 mb-4">
                Cara Pasang di Laptop / PC (Google Chrome &amp; Microsoft Edge)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 text-[#0070bc] font-black text-xs flex items-center justify-center">
                    1
                  </div>
                  <div className="text-xs font-extrabold text-slate-900">Buka di Browser</div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Buka situs <code>https://djiprod.tech</code> menggunakan browser <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong> di komputer Anda.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 text-[#0070bc] font-black text-xs flex items-center justify-center">
                    2
                  </div>
                  <div className="text-xs font-extrabold text-slate-900">Klik Icon Pasang / Install</div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Di ujung kanan address bar (kolom URL), klik icon <strong>Install (komputer dengan tanda panah ke bawah)</strong> atau menu titik 3 &gt; <em>Simpan dan Bagikan</em> &gt; <em>Pasang halaman ini sebagai aplikasi</em>.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center">
                    3
                  </div>
                  <div className="text-xs font-extrabold text-slate-900">Selesai &amp; Buka Mandiri</div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Konfirmasi klik <strong>Install</strong>. Jendela aplikasi DJI akan otomatis terbuka terpisah tanpa tab browser dan icon DJI tersimpan di Desktop Anda.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-slate-200/80 bg-white/60 py-6 text-center text-xs text-slate-400 font-semibold">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-600">Server DJI Production Aktif</span>
          </div>
          <div>© 2026 PT Dentelle Jaya Infinitex. Seluruh Hak Cipta Dilindungi.</div>
        </div>
      </footer>
    </div>
  );
}
