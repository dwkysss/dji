"use client";

import React, { useState } from "react";
import { useWifiContext } from "@/lib/wifi-context";
import { Wifi, WifiOff, Power, PowerOff, ChevronUp, ChevronDown, Radio } from "lucide-react";

export default function GlobalWifiIndicator() {
  const { connectionStatus, targetHost, statusM1, statusM2, statusM3, connect } = useWifiContext();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end">
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-white rounded-full px-3.5 py-2 shadow-xl flex items-center gap-2 text-xs transition-all animate-fadeIn">
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              connectionStatus === "terhubung"
                ? "bg-emerald-400"
                : connectionStatus === "menghubungkan"
                ? "bg-amber-400"
                : "bg-rose-400 opacity-25"
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              connectionStatus === "terhubung"
                ? "bg-emerald-500"
                : connectionStatus === "menghubungkan"
                ? "bg-amber-500"
                : "bg-rose-500"
            }`}
          />
        </span>

        {connectionStatus === "terhubung" ? (
          <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : (
          <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
        )}

        <span className="font-semibold max-w-[120px] truncate text-[11px]">
          {connectionStatus === "terputus" ? "ESP32 Terputus" : (targetHost || "esp32-timer.local")}
        </span>

        {connectionStatus === "terputus" && (
          <button
            type="button"
            onClick={() => connect()}
            className="px-2 py-0.5 bg-rose-500/30 hover:bg-rose-500/50 text-rose-200 border border-rose-500/40 rounded-full text-[10px] font-bold transition-all cursor-pointer"
            title="Klik untuk mencoba menghubungkan kembali ke ESP32"
          >
            Hubungkan
          </button>
        )}

        {/* Machine 1 Status Pill (R1) */}
        <span
          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
            connectionStatus !== "terhubung"
              ? "bg-slate-800 text-slate-500 border-slate-700"
              : statusM1 === "NYALA"
              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
              : statusM1 === "MATI"
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              : "bg-slate-800 text-slate-400 border-slate-700"
          }`}
          title="Mesin 1 (GPIO 4) - R1"
        >
          <span className="text-[9px] opacity-70">R1:</span>
          {connectionStatus !== "terhubung"
            ? "N/A"
            : statusM1 === "NYALA"
            ? "STOP"
            : statusM1 === "MATI"
            ? "JALAN"
            : "N/A"}
        </span>

        {/* Machine 2 Status Pill (R11) */}
        <span
          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
            connectionStatus !== "terhubung"
              ? "bg-slate-800 text-slate-500 border-slate-700"
              : statusM2 === "NYALA"
              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
              : statusM2 === "MATI"
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              : "bg-slate-800 text-slate-400 border-slate-700"
          }`}
          title="Mesin 2 (GPIO 22) - R11"
        >
          <span className="text-[9px] opacity-70">R11:</span>
          {connectionStatus !== "terhubung"
            ? "N/A"
            : statusM2 === "NYALA"
            ? "STOP"
            : statusM2 === "MATI"
            ? "JALAN"
            : "N/A"}
        </span>

        {/* Machine 3 Status Pill (R12) */}
        <span
          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
            connectionStatus !== "terhubung"
              ? "bg-slate-800 text-slate-500 border-slate-700"
              : statusM3 === "NYALA"
              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
              : statusM3 === "MATI"
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              : "bg-slate-800 text-slate-400 border-slate-700"
          }`}
          title="Mesin 3 (GPIO 21) - R12"
        >
          <span className="text-[9px] opacity-70">R12:</span>
          {connectionStatus !== "terhubung"
            ? "N/A"
            : statusM3 === "NYALA"
            ? "STOP"
            : statusM3 === "MATI"
            ? "JALAN"
            : "N/A"}
        </span>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-white p-0.5 rounded transition-colors ml-0.5"
          title={isExpanded ? "Sembunyikan detail" : "Lihat detail"}
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-2 bg-slate-900/95 border border-slate-800 text-slate-300 p-3 rounded-2xl shadow-2xl text-[11px] max-w-xs animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-1.5">
          <div className="font-bold text-white flex items-center justify-between">
            <span>Status Wi-Fi WebSocket</span>
            <span className="text-[10px] text-emerald-400 font-mono">Port 81</span>
          </div>
          <p className="text-slate-400 text-[10px] leading-relaxed">
            Koneksi WebSocket ke ESP32 tetap aktif di latar belakang saat Anda bertukar antar mesin atau berpindah halaman.
          </p>
          <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono gap-1">
            <span>R1 (P4): {statusM1}</span>
            <span>R11 (P22): {statusM2}</span>
            <span>R12 (P21): {statusM3}</span>
          </div>
        </div>
      )}
    </div>
  );
}
