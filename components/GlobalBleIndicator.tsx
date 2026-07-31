"use client";

import React, { useState } from "react";
import { useBluetooth } from "@/lib/bluetooth-context";
import { BluetoothConnected, Power, PowerOff, ChevronUp, ChevronDown } from "lucide-react";

export default function GlobalBleIndicator() {
  const { connectionStatus, deviceName, sensorState } = useBluetooth();
  const [isExpanded, setIsExpanded] = useState(false);

  // Only render floating pill when BLE is connected or connecting
  if (connectionStatus === "disconnected") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end">
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2 text-xs transition-all">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>

        <BluetoothConnected className="w-3.5 h-3.5 text-emerald-400 shrink-0" />

        <span className="font-medium max-w-[140px] truncate text-[11px]">
          {deviceName || "ESP32 BLE"}
        </span>

        {sensorState === "MATI" ? (
          <span className="inline-flex items-center gap-1 text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded-full font-semibold">
            <PowerOff className="w-2.5 h-2.5" /> Mesin Mati
          </span>
        ) : sensorState === "NYALA" ? (
          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-semibold">
            <Power className="w-2.5 h-2.5" /> Mesin Nyala
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
          title={isExpanded ? "Sembunyikan detail" : "Lihat detail"}
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-1.5 bg-slate-900/95 border border-slate-800 text-slate-300 p-2.5 rounded-xl shadow-xl text-[10px] max-w-xs animate-in fade-in slide-in-from-bottom-2">
          <div className="font-semibold text-slate-200 mb-1">Status Web Bluetooth Persistent</div>
          <p className="text-slate-400 leading-tight">
            Koneksi BLE ke ESP32 tetap aktif di latar belakang saat berpindah halaman aplikasi.
          </p>
        </div>
      )}
    </div>
  );
}
