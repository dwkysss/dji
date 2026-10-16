"use client";

import React, { useState, useEffect } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Terminal,
  Play,
  Square,
  Cpu,
  Sliders,
  Timer,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Settings,
  Info,
  Sun,
  Moon,
} from "lucide-react";
import { useWifiContext, getEsp32ConfigForMachine, MachineChannel } from "@/lib/wifi-context";
import { useScreenWakeLock } from "@/lib/wake-lock-context";
import { useInputTheme } from "@/lib/input-theme-context";
import WifiController from "@/components/WifiController";
import PinAuthModal from "@/components/PinAuthModal";

// Helper format seconds to HH:MM:SS
function formatTime(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

interface WifiDowntimeTriggerProps {
  machineId?: MachineChannel;
  initialMachineId?: MachineChannel;
  selectedMachineCode?: string;
  onStartTimer?: (source?: string | { source: string; duration?: number }) => void;
  onStopTimer?: (source?: string | { source: string; duration?: number }) => void;
  isTimerRunning?: boolean;
}

export default function WifiDowntimeTrigger({
  machineId,
  initialMachineId = "M1",
  selectedMachineCode,
  onStartTimer,
  onStopTimer,
  isTimerRunning = false,
}: WifiDowntimeTriggerProps) {
  const {
    connectionStatus,
    targetHost,
    connect,
    statusM1,
    isTimerM1Running,
    elapsedM1,
    statusM2,
    isTimerM2Running,
    elapsedM2,
    statusM3,
    isTimerM3Running,
    elapsedM3,
    machineMapping,
    logs,
    registerSignalListener,
    triggerM1Start,
    triggerM1Stop,
    resetTimerM1,
    triggerM2Start,
    triggerM2Stop,
    resetTimerM2,
    triggerM3Start,
    triggerM3Stop,
    resetTimerM3,
    isSimulationMode,
    toggleSimulationMode,
  } = useWifiContext();

  const {
    isActive: isWakeLockActive,
    toggleWakeLock,
    isSupported: isWakeLockSupported,
  } = useScreenWakeLock();

  const { isDark } = useInputTheme();

  // Ambil konfigurasi untuk nomor mesin yang sedang dibuka di form
  const currentConfig = React.useMemo(() => {
    return getEsp32ConfigForMachine(selectedMachineCode, machineMapping);
  }, [selectedMachineCode, machineMapping]);

  // Otomatis ganti koneksi host ESP jika berbeda dari targetHost saat ini
  useEffect(() => {
    if (currentConfig.host && currentConfig.host !== targetHost && connectionStatus !== "menghubungkan") {
      connect(currentConfig.host);
    }
  }, [currentConfig.host, targetHost, connect, connectionStatus]);

  // Sakelar Mesin Terkunci Otomatis Sesuai Nomor Mesin di Header
  const selectedMachine: MachineChannel = currentConfig.channel || machineId || initialMachineId || "M1";
  const [showControllerModal, setShowControllerModal] = useState<boolean>(false);

  // Pin Auth Modal State
  const [pinModalConfig, setPinModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onSuccess: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onSuccess: () => { },
  });

  const requestPinAuth = (title: string, description: string, onSuccessAction: () => void) => {
    setPinModalConfig({
      isOpen: true,
      title,
      description,
      onSuccess: onSuccessAction,
    });
  };

  const currentStatus = selectedMachine === "M1" ? statusM1 : selectedMachine === "M2" ? statusM2 : statusM3;
  const currentElapsed = selectedMachine === "M1" ? elapsedM1 : selectedMachine === "M2" ? elapsedM2 : elapsedM3;
  const currentIsRunning = selectedMachine === "M1" ? isTimerM1Running : selectedMachine === "M2" ? isTimerM2Running : isTimerM3Running;

  const getChannelRunning = (ch: MachineChannel) => {
    if (ch === "M1") return isTimerM1Running;
    if (ch === "M2") return isTimerM2Running;
    if (ch === "M3") return isTimerM3Running;
    return false;
  };

  // Listen to Wi-Fi signals for the currently selected machine
  useEffect(() => {
    const unregister = registerSignalListener((machine, signal, source, duration) => {
      if (machine === selectedMachine) {
        if (signal === "START" && onStartTimer) {
          onStartTimer({ source, duration });
        } else if (signal === "STOP" && onStopTimer) {
          onStopTimer({ source, duration });
        }
      }
    });

    return () => {
      unregister();
    };
  }, [registerSignalListener, selectedMachine, onStartTimer, onStopTimer]);

  // Sinkronisasi status fisik sensor dengan timer form:
  // Jika ESP32 sudah mendeteksi status "NYALA" (Mesin Berhenti / Downtime Aktif) tapi timer form belum running, nyalakan otomatis!
  useEffect(() => {
    if (connectionStatus === "terhubung" && currentStatus === "NYALA" && !isTimerRunning && onStartTimer) {
      onStartTimer({ source: "ESP32 Sensor Otomatis", duration: currentElapsed });
    }
  }, [connectionStatus, currentStatus, isTimerRunning, onStartTimer, currentElapsed]);

  return (
    <div className={`w-full rounded-2xl p-2.5 flex flex-col gap-2 overflow-hidden transition-all duration-300 ${
      isDark
        ? "bg-slate-900 border border-slate-800 text-white shadow-xl"
        : "bg-white border border-slate-200 text-slate-800 shadow-xs"
    }`}>
      {/* Baris 1: Connection Status & Tombol Pengaturan */}
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              connectionStatus === "terhubung"
                ? isDark
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/80"
                  : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : connectionStatus === "menghubungkan"
                ? isDark
                  ? "bg-amber-950/80 text-amber-400 border border-amber-800/80 animate-pulse"
                  : "bg-amber-50 text-amber-600 border border-amber-200 animate-pulse"
                : isDark
                ? "bg-slate-800 text-slate-400 border border-slate-700"
                : "bg-slate-100 text-slate-500 border border-slate-200"
            }`}
          >
            {connectionStatus === "terhubung" ? (
              <Wifi className={`w-3.5 h-3.5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
            ) : connectionStatus === "menghubungkan" ? (
              <RefreshCw className={`w-3.5 h-3.5 animate-spin ${isDark ? "text-amber-400" : "text-amber-600"}`} />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>

          <span className={`text-[11px] font-black shrink-0 ${isDark ? "text-white" : "text-slate-800"}`}>ESP32</span>

          <button
            type="button"
            onClick={() => {
              if (connectionStatus === "terputus") {
                connect();
              }
            }}
            disabled={connectionStatus !== "terputus"}
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold truncate max-w-[85px] sm:max-w-[120px] transition-all ${
              connectionStatus === "terhubung"
                ? isDark
                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 cursor-default"
                  : "bg-emerald-100 text-emerald-800 cursor-default"
                : connectionStatus === "menghubungkan"
                ? isDark
                  ? "bg-amber-950/80 text-amber-300 border border-amber-800/80 animate-pulse cursor-default"
                  : "bg-amber-100 text-amber-800 animate-pulse cursor-default"
                : isDark
                ? "bg-rose-950/80 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 cursor-pointer active:scale-95"
                : "bg-rose-100 hover:bg-rose-200 text-rose-800 cursor-pointer active:scale-95"
            }`}
            title={connectionStatus === "terputus" ? "Klik untuk Menghubungkan ke ESP32 Wi-Fi" : "Status ESP32"}
          >
            {connectionStatus === "terhubung"
              ? "Terhubung"
              : connectionStatus === "menghubungkan"
                ? "Koneksi..."
                : "Hubungkan"}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Badge Screen Wake Lock (Layar Selalu Menyala / Siaga 24 Jam) */}
          <button
            type="button"
            onClick={() => toggleWakeLock()}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9.5px] font-bold transition-all border shrink-0 cursor-pointer active:scale-95 ${
              isWakeLockActive
                ? isDark
                  ? "bg-amber-950/80 hover:bg-amber-900/80 text-amber-300 border-amber-800/80 shadow-2xs"
                  : "bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300 shadow-2xs"
                : isDark
                ? "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200"
            }`}
            title={
              isWakeLockActive
                ? "Screen Wake Lock Aktif: Layar tablet TIDAK AKAN MATI (klik untuk menonaktifkan)"
                : "Screen Wake Lock Nonaktif: Layar tablet akan mati mengikuti batas waktu Samsung (klik untuk mengaktifkan)"
            }
          >
            <Sun className={`w-3 h-3 ${isWakeLockActive ? (isDark ? "text-amber-400" : "text-amber-600") + " animate-pulse" : isDark ? "text-slate-500" : "text-slate-400"}`} />
            <span>{isWakeLockActive ? "Layar ON" : "Layar Standby"}</span>
          </button>

          {/* Sembunyikan Tombol Simulasi (Ubah false ke true jika ingin mengaktifkan kembali) */}
          {false && (
            <button
              type="button"
              onClick={() => toggleSimulationMode()}
              className={`px-2 py-1 rounded-lg text-[9.5px] font-black uppercase tracking-wide transition-all border shrink-0 cursor-pointer ${isSimulationMode
                  ? "bg-purple-600 text-white border-purple-700 shadow-xs active:scale-95"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                }`}
              title="Aktifkan Mode Simulasi ESP32 jika tidak sedang di pabrik"
            >
              {isSimulationMode ? "Simulasi: ON" : "Simulasi"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowControllerModal(true)}
            className={`w-7 h-7 p-1 rounded-lg font-bold text-xs transition-colors border flex items-center justify-center shrink-0 cursor-pointer ${
              isDark
                ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
            }`}
            title="Pengaturan Wi-Fi & Terminal Log"
          >
            <Settings className={`w-3.5 h-3.5 ${isDark ? "text-slate-300" : "text-slate-600"}`} />
          </button>
        </div>
      </div>

      {/* Baris 2: Badge Indikator Mesin Terkunci Sesuai Nomor Mesin di Header */}
      <div className={`p-1.5 px-2.5 rounded-xl flex items-center justify-between gap-2 border select-none transition-colors ${
        isDark
          ? "bg-slate-950/80 border-slate-800"
          : "bg-slate-100/90 border-slate-200/80"
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
            isDark
              ? "bg-slate-800 text-blue-400 border-slate-700"
              : "bg-sky-100 text-sky-700 border border-sky-200"
          }`}>
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <span className={`text-xs font-black tracking-tight ${isDark ? "text-white" : "text-slate-800"}`}>
              Mesin {selectedMachineCode ? selectedMachineCode.toUpperCase() : "-"}
            </span>
            <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold shadow-2xs ${
              isDark
                ? "bg-slate-800 border-slate-700 text-blue-400"
                : "bg-white border-slate-200 text-slate-600"
            }`}>
              {currentConfig.channel}
            </span>
          </div>
        </div>

        {/* Status Sinyal Downtime Real-Time */}
        <div className="flex items-center gap-1.5 shrink-0">
          {currentIsRunning && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
          )}
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
              currentStatus === "NYALA"
                ? isDark
                  ? "bg-rose-950/80 text-rose-300 border border-rose-800/80"
                  : "bg-rose-100 text-rose-700 border border-rose-200"
                : currentStatus === "MATI"
                ? isDark
                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/80"
                  : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                : isDark
                ? "bg-slate-800 text-slate-300 border border-slate-700"
                : "bg-slate-200 text-slate-600 border border-slate-300"
            }`}
          >
            {currentStatus === "NYALA"
              ? "Downtime Aktif"
              : currentStatus === "MATI"
              ? "Mesin Berjalan"
              : "Standby"}
          </span>
        </div>
      </div>

      {/* Baris 3: Tombol Trigger Simulasi Signal Sinyal ESP32 (Disembunyikan, dapat diaktifkan kembali jika dibutuhkan) */}
      {false && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => {
              if (!isSimulationMode && connectionStatus !== "terhubung") {
                toggleSimulationMode(true);
              }
              const src = "ESP32_WiFi";
              if (selectedMachine === "M1") triggerM1Start(src);
              else triggerM2Start(src);
            }}
            className="flex-1 py-1 px-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] rounded-lg transition-all shadow-2xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 whitespace-nowrap"
            title="Simulasikan sensor membaca MESIN STOP (Mulai hitung timer downtime ESP32)"
          >
            <Square className="w-3 h-3 fill-current shrink-0" />
            <span>Simulasi Stop Mesin</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const src = "ESP32_WiFi";
              if (selectedMachine === "M1") triggerM1Stop(src);
              else triggerM2Stop(src);
            }}
            className="flex-1 py-1 px-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-all shadow-2xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 whitespace-nowrap"
            title="Simulasikan sensor membaca MESIN NYALA/JALAN (Selesai stop, simpan event ESP32)"
          >
            <Play className="w-3 h-3 fill-current shrink-0" />
            <span>Simulasi Nyala Mesin</span>
          </button>
        </div>
      )}

      {/* 4. Modal Dialog Popup Pengaturan ESP32 (Tampil Rapi di Tablet & HP) */}
      {showControllerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl overflow-y-auto no-scrollbar max-h-[90vh] border border-slate-200 flex flex-col gap-4">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-black text-slate-800">Pengaturan ESP32 Wi-Fi</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowControllerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <WifiController />
          </div>
        </div>
      )}

      {/* 5. Modal Security PIN Authentication */}
      <PinAuthModal
        isOpen={pinModalConfig.isOpen}
        title={pinModalConfig.title}
        description={pinModalConfig.description}
        onClose={() => setPinModalConfig((prev) => ({ ...prev, isOpen: false }))}
        onSuccess={pinModalConfig.onSuccess}
      />
    </div>
  );
}
