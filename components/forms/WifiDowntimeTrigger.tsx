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
} from "lucide-react";
import { useWifiContext, getEsp32ConfigForMachine } from "@/lib/wifi-context";
import WifiController from "@/components/WifiController";

// Helper format seconds to HH:MM:SS
function formatTime(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

interface WifiDowntimeTriggerProps {
  machineId?: "M1" | "M2";
  initialMachineId?: "M1" | "M2";
  selectedMachineCode?: string;
  onStartTimer?: (source?: string) => void;
  onStopTimer?: (source?: string) => void;
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
    logs,
    registerSignalListener,
    triggerM1Start,
    triggerM1Stop,
    resetTimerM1,
    triggerM2Start,
    triggerM2Stop,
    resetTimerM2,
  } = useWifiContext();

  // Sakelar Pilihan Mesin State
  const [selectedMachine, setSelectedMachine] = useState<"M1" | "M2">(machineId || initialMachineId);
  const [showControllerModal, setShowControllerModal] = useState<boolean>(false);

  // Otomatis mengganti Sakelar Mesin (Mesin R1 vs Mesin R11) sesuai Nomor Mesin di Header Form
  useEffect(() => {
    if (selectedMachineCode) {
      const code = String(selectedMachineCode).trim().toUpperCase();
      let target: "M1" | "M2" | null = null;
      if (code === "R11" || code.endsWith("11") || code.includes("M2")) {
        target = "M2";
      } else if (code === "R1" || code.includes("M1")) {
        target = "M1";
      }

      if (target && target !== selectedMachine) {
        setSelectedMachine(target);
      }
    }
  }, [selectedMachineCode]);

  const currentStatus = selectedMachine === "M1" ? statusM1 : statusM2;
  const currentElapsed = selectedMachine === "M1" ? elapsedM1 : elapsedM2;
  const currentIsRunning = selectedMachine === "M1" ? isTimerM1Running : isTimerM2Running;

  // Listen to Wi-Fi signals for the currently selected machine
  useEffect(() => {
    const unregister = registerSignalListener((machine, signal, source) => {
      if (machine === selectedMachine) {
        if (signal === "START" && onStartTimer) {
          onStartTimer(source);
        } else if (signal === "STOP" && onStopTimer) {
          onStopTimer(source);
        }
      }
    });

    return () => {
      unregister();
    };
  }, [registerSignalListener, selectedMachine, onStartTimer, onStopTimer]);

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-2.5 shadow-xs flex flex-col gap-2 overflow-hidden">
      {/* Baris 1: Connection Status & Tombol Pengaturan */}
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              connectionStatus === "terhubung"
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : connectionStatus === "menghubungkan"
                ? "bg-amber-50 text-amber-600 border border-amber-200 animate-pulse"
                : "bg-slate-100 text-slate-500 border border-slate-200"
            }`}
          >
            {connectionStatus === "terhubung" ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            ) : connectionStatus === "menghubungkan" ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>

          <span className="text-[11px] font-black text-slate-800 shrink-0">ESP32</span>

          <button
            type="button"
            onClick={() => connectionStatus === "terputus" && connect()}
            disabled={connectionStatus !== "terputus"}
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold truncate max-w-[85px] sm:max-w-[120px] transition-all ${
              connectionStatus === "terhubung"
                ? "bg-emerald-100 text-emerald-800"
                : connectionStatus === "menghubungkan"
                ? "bg-amber-100 text-amber-800 animate-pulse"
                : "bg-rose-100 hover:bg-rose-200 text-rose-800 cursor-pointer active:scale-95"
            }`}
            title={connectionStatus === "terputus" ? "Klik untuk Menghubungkan ke ESP32 Wi-Fi" : ""}
          >
            {connectionStatus === "terhubung"
              ? "Terhubung"
              : connectionStatus === "menghubungkan"
              ? "Koneksi..."
              : "Hubungkan"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowControllerModal(!showControllerModal)}
          className="w-7 h-7 p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors border border-slate-200 flex items-center justify-center shrink-0 cursor-pointer"
          title="Pengaturan Wi-Fi & Terminal Log"
        >
          <Settings className="w-3.5 h-3.5 text-slate-600" />
        </button>
      </div>

      {/* Baris 2: Badge Indikator Mesin Read-Only (Full Width Responsif 50%-50%) */}
      <div className="bg-slate-100/80 p-0.5 rounded-xl flex items-center justify-between gap-1 border border-slate-200/80 cursor-default select-none">
        <div
          className={`flex-1 py-1 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 min-w-0 ${
            selectedMachine === "M1"
              ? "bg-sky-600 text-white shadow-xs"
              : "text-slate-400 opacity-60"
          }`}
        >
          <Cpu className="w-3 h-3 shrink-0" />
          <span className="truncate">Mesin R1</span>
          {isTimerM1Running && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
          )}
        </div>

        <div
          className={`flex-1 py-1 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 min-w-0 ${
            selectedMachine === "M2"
              ? "bg-sky-600 text-white shadow-xs"
              : "text-slate-400 opacity-60"
          }`}
        >
          <Cpu className="w-3 h-3 shrink-0" />
          <span className="truncate">Mesin R11</span>
          {isTimerM2Running && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
          )}
        </div>
      </div>

      {/* 4. Modal Dialog Popup Pengaturan ESP32 (Tampil Rapi di Tablet & HP) */}
      {showControllerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-5 sm:p-6 shadow-2xl overflow-y-auto max-h-[90vh] border border-slate-200 flex flex-col gap-4">
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
    </div>
  );
}
