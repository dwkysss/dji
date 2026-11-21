"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, QrCode, Camera, AlertCircle, Keyboard, CheckCircle2, RefreshCw, ImagePlus, Settings } from "lucide-react";

export interface ParsedDjiQr {
  raw: string;
  nomor_mc?: string;
  potongan_ke?: string;
  design_id?: string;
  pcs_index?: number;
}

/**
 * Parser universal untuk berbagai format QR Code PT DJI:
 * 1. URL Tracking Dinamis: https://.../track/R14/2?pcs=1
 * 2. JSON Mending Barcode: {"nomor_mesin":"R14","potongan_ke":2,"kode_design":"ABC"}
 * 3. Teks singkat: "R14/2", "R14-2", "MC R14 POT 2"
 */
export function parseDjiQrPayload(rawText: string): ParsedDjiQr {
  const trimmed = rawText.trim();
  const result: ParsedDjiQr = { raw: trimmed };
  if (!trimmed) return result;

  // 1. Cek format URL /track/{mc}/{potongan}
  try {
    const urlCandidate = trimmed.startsWith("http")
      ? trimmed
      : trimmed.startsWith("/track/")
      ? `https://local.dji${trimmed}`
      : null;

    if (urlCandidate) {
      const parsedUrl = new URL(urlCandidate);
      const trackMatch = parsedUrl.pathname.match(/\/track\/([^/]+)\/(\d+)/i);
      if (trackMatch) {
        result.nomor_mc = decodeURIComponent(trackMatch[1]).trim().toUpperCase();
        result.potongan_ke = String(parseInt(trackMatch[2], 10));
        const pcsParam = parsedUrl.searchParams.get("pcs");
        if (pcsParam && !isNaN(Number(pcsParam))) {
          result.pcs_index = Number(pcsParam);
        }
        return result;
      }
    }
  } catch {
    // lanjut cek format lain
  }

  // 2. Cek format JSON (dari /mending/barcode atau format lama)
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      const mc = obj.nomor_mc || obj.nomor_mesin || obj.mc;
      const pot = obj.potongan_ke ?? obj.potongan;
      const design = obj.design_id || obj.kode_design || obj.desain;
      const pcs = obj.pcs_index || obj.pcs_ke;

      if (mc && mc !== "-") result.nomor_mc = String(mc).trim().toUpperCase();
      if (pot !== undefined && pot !== null && pot !== "-" && String(pot).trim() !== "") {
        result.potongan_ke = String(pot).trim();
      }
      if (design && design !== "-") result.design_id = String(design).trim();
      if (pcs && !isNaN(Number(pcs))) result.pcs_index = Number(pcs);

      if (result.nomor_mc || result.potongan_ke || result.design_id) {
        return result;
      }
    } catch {
      // lanjut cek format teks
    }
  }

  // 3. Fallback teks ringkas: "MC R14 / POT 2", "R14/2", "R14-2"
  const shortMatch = trimmed.match(/(?:MC\s*)?([RT][0-9A-Z]+)\s*(?:\/|-|\s+POT(?:ONGAN)?\s*|\s+)\s*(\d+)/i);
  if (shortMatch) {
    result.nomor_mc = shortMatch[1].toUpperCase();
    result.potongan_ke = String(parseInt(shortMatch[2], 10));
    return result;
  }

  return result;
}

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (parsed: ParsedDjiQr) => void;
  title?: string;
}

export default function QrScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = "Scan QR Potongan Kain",
}: QrScannerModalProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPermissionPermanentlyDenied, setIsPermissionPermanentlyDenied] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isScanningFile, setIsScanningFile] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>("");
  const [scanSuccessMsg, setScanSuccessMsg] = useState<string | null>(null);

  const scannerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasScannedRef = useRef<boolean>(false);
  const readerId = "dji-qr-camera-reader";
  const fileReaderId = "dji-qr-file-reader";

  const stopScanner = async () => {
    const inst = scannerRef.current;
    scannerRef.current = null;
    if (inst) {
      try {
        if (inst.isScanning) {
          await inst.stop();
        }
      } catch {
        // ignore stop errors
      }
      try {
        await inst.clear();
      } catch {
        // ignore clear errors
      }
    }
  };

  const handleDecodedText = async (decodedText: string) => {
    if (hasScannedRef.current) return;
    const parsed = parseDjiQrPayload(decodedText);
    if (!parsed.nomor_mc && !parsed.potongan_ke && !parsed.design_id) {
      setCameraError("QR terbaca, namun bukan format label potongan PT DJI.");
      return;
    }

    hasScannedRef.current = true;
    const summary = [
      parsed.nomor_mc ? `MC ${parsed.nomor_mc}` : null,
      parsed.potongan_ke ? `Potongan ${parsed.potongan_ke}` : null,
    ]
      .filter(Boolean)
      .join(" • ");

    setScanSuccessMsg(summary || "QR Berhasil Terbaca");
    await stopScanner();

    setTimeout(() => {
      onScanSuccess(parsed);
      onClose();
    }, 350);
  };

  const startCamera = async () => {
    setCameraError(null);
    setIsPermissionPermanentlyDenied(false);
    setScanSuccessMsg(null);
    setIsStarting(true);
    hasScannedRef.current = false;

    await stopScanner();

    // Jika berjalan di dalam APK Android DJI dan izin kamera belum diberikan, minta popup izin native OS dulu
    try {
      const androidBridge = typeof window !== "undefined" ? (window as any).AndroidAppInfo : null;
      if (androidBridge && typeof androidBridge.hasCameraPermission === "function" && typeof androidBridge.requestCameraPermission === "function") {
        if (!androidBridge.hasCameraPermission()) {
          const permResult = await new Promise<{ granted: boolean; permanentlyDenied: boolean }>((resolve) => {
            let settled = false;
            const timer = setTimeout(() => {
              if (!settled) {
                settled = true;
                window.removeEventListener("dji-camera-permission-result", handler as EventListener);
                resolve({ granted: false, permanentlyDenied: false });
              }
            }, 30000);
            const handler = (ev: CustomEvent<{ granted?: boolean; permanentlyDenied?: boolean }>) => {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                window.removeEventListener("dji-camera-permission-result", handler as EventListener);
                resolve({
                  granted: Boolean(ev.detail?.granted),
                  permanentlyDenied: Boolean(ev.detail?.permanentlyDenied),
                });
              }
            };
            window.addEventListener("dji-camera-permission-result", handler as EventListener);
            androidBridge.requestCameraPermission();
          });

          if (!permResult.granted) {
            if (permResult.permanentlyDenied) {
              setIsPermissionPermanentlyDenied(true);
              setCameraError(
                "Izin kamera diblokir di perangkat ini. Ketuk 'Buka Izin Aplikasi' lalu aktifkan izin Kamera."
              );
            } else {
              setCameraError("Izin kamera ditolak. Ketuk 'Coba Lagi' lalu pilih 'Izinkan' saat popup muncul.");
            }
            setIsStarting(false);
            return;
          }
        }
      }
    } catch {
      // Lanjutkan ke alur standar browser jika bridge tidak tersedia
    }

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const containerEl = document.getElementById(readerId);
      if (!containerEl) {
        setIsStarting(false);
        return;
      }

      const html5QrCode = new Html5Qrcode(readerId);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0,
      };

      try {
        // Prioritas kamera belakang untuk HP/Tablet
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText: string) => {
            handleDecodedText(decodedText);
          },
          () => {
            // ignore per-frame scan misses
          }
        );
      } catch {
        // Fallback ke kamera pertama yang tersedia (misal webcam laptop)
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          throw new Error("Kamera tidak ditemukan pada perangkat ini.");
        }
        await html5QrCode.start(
          devices[0].id,
          config,
          (decodedText: string) => {
            handleDecodedText(decodedText);
          },
          () => {}
        );
      }
    } catch (err: any) {
      const msg = String(err?.message || err || "");
      if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("notallowed")) {
        setCameraError("Izin kamera ditolak. Izinkan akses kamera di browser atau gunakan input scanner di bawah.");
      } else {
        setCameraError(
          "Kamera tidak dapat diakses (pastikan koneksi HTTPS/localhost dan kamera tersedia). Anda tetap bisa scan dengan scanner USB di kolom bawah."
        );
      }
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setManualInput("");
      setFileError(null);
      setIsScanningFile(false);
      const timer = setTimeout(() => {
        startCamera();
      }, 120);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !cameraError) return;
    const handleReturnFromSettings = () => {
      try {
        const androidBridge = typeof window !== "undefined" ? (window as any).AndroidAppInfo : null;
        if (androidBridge && typeof androidBridge.hasCameraPermission === "function" && androidBridge.hasCameraPermission()) {
          startCamera();
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("dji-app-resumed", handleReturnFromSettings);
    window.addEventListener("focus", handleReturnFromSettings);
    return () => {
      window.removeEventListener("dji-app-resumed", handleReturnFromSettings);
      window.removeEventListener("focus", handleReturnFromSettings);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cameraError]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleDecodedText(manualInput);
  };

  const handleGalleryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset value segera agar user bisa memilih ulang gambar yang sama jika perlu
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (!file) return;

    setFileError(null);
    setIsScanningFile(true);

    let fileScanner: any = null;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      fileScanner = new Html5Qrcode(fileReaderId);
      const decodedText = await fileScanner.scanFile(file, false);
      if (decodedText) {
        const parsed = parseDjiQrPayload(decodedText);
        if (!parsed.nomor_mc && !parsed.potongan_ke && !parsed.design_id) {
          setFileError("QR terbaca dari gambar, namun bukan format label potongan PT DJI.");
          return;
        }
        await handleDecodedText(decodedText);
      } else {
        setFileError("QR Code tidak terdeteksi pada gambar tersebut.");
      }
    } catch {
      setFileError(
        "QR Code tidak terdeteksi pada gambar tersebut. Pastikan foto QR jelas, terang, dan tidak terpotong."
      );
    } finally {
      if (fileScanner) {
        try {
          await fileScanner.clear();
        } catch {
          // ignore clear errors
        }
      }
      setIsScanningFile(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0070bc] text-white flex items-center justify-center shadow-xs shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Arahkan kamera atau pilih foto QR dari galeri
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Hidden DOM node & file input untuk scan QR dari galeri tanpa mengganggu live camera */}
          <div id={fileReaderId} className="hidden" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleGalleryFileChange}
            className="hidden"
          />

          {/* Camera Viewport */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 min-h-[260px] flex items-center justify-center">
            <div id={readerId} className="w-full" />

            {(isStarting || isScanningFile) && (
              <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center text-white gap-2 z-10">
                <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
                <span className="text-xs font-bold">
                  {isScanningFile ? "Membaca QR dari gambar..." : "Menyalakan kamera..."}
                </span>
              </div>
            )}

            {scanSuccessMsg && (
              <div className="absolute inset-0 bg-emerald-600/95 flex flex-col items-center justify-center text-white gap-2 p-4 text-center z-20">
                <CheckCircle2 className="w-10 h-10" />
                <div className="text-sm font-black">{scanSuccessMsg}</div>
                <div className="text-[11px] opacity-90">Memuat data riwayat...</div>
              </div>
            )}

            {cameraError && !isStarting && !isScanningFile && !scanSuccessMsg && (
              <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-center p-5 gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {cameraError}
                </p>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {isPermissionPermanentlyDenied &&
                  typeof window !== "undefined" &&
                  typeof (window as any).AndroidAppInfo?.openAppPermissionSettings === "function" ? (
                    <button
                      type="button"
                      onClick={() => (window as any).AndroidAppInfo.openAppPermissionSettings()}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Buka Izin Aplikasi</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Coba Lagi</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0070bc] hover:bg-[#005a96] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>Pilih dari Galeri</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Scan dari Galeri Foto */}
          <div className="space-y-2">
            <button
              type="button"
              disabled={isScanningFile || Boolean(scanSuccessMsg)}
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-10 px-4 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-[#0070bc] text-xs font-extrabold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              <ImagePlus className="w-4 h-4 shrink-0" />
              <span>{isScanningFile ? "Memindai Gambar..." : "Pilih Foto QR dari Galeri"}</span>
            </button>

            {fileError && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{fileError}</span>
              </div>
            )}
          </div>

          {/* USB / Bluetooth Barcode Scanner or Manual Paste */}
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-slate-400" />
              Atau Scan dengan Scanner USB / Ketik Kode
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Tempel link QR atau ketik R14/2 lalu Enter..."
                className="flex-1 h-9 px-3 rounded-xl border border-slate-200 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 outline-none text-xs font-semibold text-slate-800 placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="h-9 px-3.5 rounded-xl bg-[#0070bc] hover:bg-[#005a96] text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                Cari
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
