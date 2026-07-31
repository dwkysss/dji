"use client";

import React, { useState, useEffect } from "react";
import { Bluetooth, BluetoothConnected, BluetoothOff, AlertCircle, RefreshCw, Activity, Power, PowerOff, Terminal } from "lucide-react";
import { useBluetooth, BleLogEntry as BleLogEntryContext } from "@/lib/bluetooth-context";

export type BleLogEntry = BleLogEntryContext;

interface BluetoothDowntimeTriggerProps {
  onStartTimer: (source?: string) => void;
  onStopTimer: (source?: string) => void;
  isTimerRunning?: boolean;
}

export default function BluetoothDowntimeTrigger({
  onStartTimer,
  onStopTimer,
  isTimerRunning = false,
}: BluetoothDowntimeTriggerProps) {
  const {
    isSupported,
    device,
    connectionStatus,
    deviceName,
    sensorState,
    logs,
    connect,
    disconnect,
    clearLogs,
    registerSignalListener,
  } = useBluetooth();

  const [showLogs, setShowLogs] = useState<boolean>(false);

  // Subscribe to BLE signals (START/STOP) when mounted
  useEffect(() => {
    const unregister = registerSignalListener((signal, source) => {
      if (signal === "START") {
        onStartTimer(source);
      } else if (signal === "STOP") {
        onStopTimer(source);
      }
    });

    return () => {
      unregister();
    };
  }, [registerSignalListener, onStartTimer, onStopTimer]);

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
        <span>Web Bluetooth API tidak didukung di browser ini. Gunakan Chrome/Edge.</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Connection Status & Device Info */}
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              connectionStatus === "connected"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : connectionStatus === "connecting"
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 animate-pulse"
                : "bg-slate-200 dark:bg-slate-800 text-slate-500"
            }`}
          >
            {connectionStatus === "connected" ? (
              <BluetoothConnected className="w-5 h-5" />
            ) : connectionStatus === "connecting" ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <BluetoothOff className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {connectionStatus === "connected"
                  ? deviceName || "ESP32 BLE Connected"
                  : connectionStatus === "connecting"
                  ? (deviceName ? `Mencari ${deviceName}...` : "Menghubungkan ESP32...")
                  : "ESP32 Relay Trigger"}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  connectionStatus === "connected"
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                    : connectionStatus === "connecting"
                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 animate-pulse"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                {connectionStatus === "connected"
                  ? "Terhubung"
                  : connectionStatus === "connecting"
                  ? (device ? "Auto-Reconnect" : "Proses")
                  : "Terputus"}
              </span>
            </div>

            {/* Relay / Machine Status Indicator */}
            {connectionStatus === "connected" && (
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Status Mesin:</span>
                {sensorState === "MATI" ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                    <PowerOff className="w-3 h-3" /> Mati (Timer Jalan)
                  </span>
                ) : sensorState === "NYALA" ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <Power className="w-3 h-3" /> Nyala (Mesin Jalan)
                  </span>
                ) : (
                  <span className="italic text-slate-400">Menunggu Sinyal...</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {connectionStatus === "disconnected" ? (
            <button
              type="button"
              onClick={connect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Bluetooth className="w-3.5 h-3.5" />
              Sambungkan ESP32
            </button>
          ) : connectionStatus === "connecting" ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-300 dark:bg-slate-700 text-slate-500 text-xs font-medium rounded-lg cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Menghubungkan...
            </button>
          ) : (
            <button
              type="button"
              onClick={disconnect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-medium rounded-lg border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
            >
              <BluetoothOff className="w-3.5 h-3.5" />
              Putuskan
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className="p-1.5 bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Lihat Log Bluetooth"
          >
            <Terminal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Log Console Drawer */}
      {showLogs && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" /> Log Aktivitas BLE ESP32
            </span>
            <button
              type="button"
              onClick={clearLogs}
              className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              Bersihkan
            </button>
          </div>
          <div className="bg-slate-900 text-slate-200 p-2.5 rounded-lg font-mono text-[10px] max-h-36 overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <div className="text-slate-500 italic text-center py-1">Belum ada log sinyal Bluetooth</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex gap-2 items-start">
                  <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                  <span
                    className={
                      log.type === "START"
                        ? "text-rose-400 font-bold"
                        : log.type === "STOP"
                        ? "text-emerald-400 font-bold"
                        : log.type === "CONNECTED"
                        ? "text-blue-400"
                        : log.type === "ERROR"
                        ? "text-red-400"
                        : "text-slate-300"
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
