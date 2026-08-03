"use client";

import React, { useState } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Play,
  Square,
  Terminal,
  Trash2,
  Globe,
  Radio,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Cpu,
} from "lucide-react";
import { useWifiContext } from "@/lib/wifi-context";

export default function WifiController() {
  const {
    targetHost,
    setTargetHost,
    connectionStatus,
    wsUrl,
    statusM1,
    statusM2,
    logs,
    connect,
    disconnect,
    clearLogs,
    triggerM1Start,
    triggerM1Stop,
    triggerM2Start,
    triggerM2Stop,
  } = useWifiContext();

  const [inputHost, setInputHost] = useState<string>(targetHost);
  const [showLogs, setShowLogs] = useState<boolean>(true);

  const handleConnect = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    connect(inputHost);
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
              connectionStatus === "terhubung"
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-xs"
                : connectionStatus === "menghubungkan"
                ? "bg-amber-50 text-amber-600 border border-amber-200 animate-pulse"
                : "bg-slate-100 text-slate-500 border border-slate-200"
            }`}
          >
            {connectionStatus === "terhubung" ? (
              <Wifi className="w-6 h-6 text-emerald-600" />
            ) : connectionStatus === "menghubungkan" ? (
              <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
            ) : (
              <WifiOff className="w-6 h-6 text-slate-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Kontrol Koneksi ESP32 Wi-Fi
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200">
                mDNS / WebSocket
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Kelola alamat mDNS lokal & pantau sinyal WebSocket real-time Port 81
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              connectionStatus === "terhubung"
                ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30"
                : connectionStatus === "menghubungkan"
                ? "bg-amber-500/10 text-amber-700 border border-amber-500/30 animate-pulse"
                : "bg-rose-500/10 text-rose-700 border border-rose-500/30"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === "terhubung"
                  ? "bg-emerald-500 animate-ping"
                  : connectionStatus === "menghubungkan"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-rose-500"
              }`}
            />
            {connectionStatus === "terhubung"
              ? "TERHUBUNG"
              : connectionStatus === "menghubungkan"
              ? "MENGHUBUNGKAN..."
              : "TERPUTUS"}
          </span>
        </div>
      </div>

      {/* 1. Panel Input IP / Hostname & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Globe className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={inputHost}
            onChange={(e) => setInputHost(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConnect(e);
              }
            }}
            placeholder="esp32-timer.local atau IP address (192.168.1.X)"
            className="w-full pl-10 pr-24 py-2.5 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all"
          />
          <button
            type="button"
            onClick={() => {
              setInputHost("esp32-timer.local");
              setTargetHost("esp32-timer.local");
            }}
            className="absolute inset-y-1 right-1 px-2.5 text-[11px] font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
          >
            Default
          </button>
        </div>

        <div className="flex items-center gap-2">
          {connectionStatus === "terhubung" ? (
            <button
              type="button"
              onClick={disconnect}
              className="h-11 px-5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <WifiOff className="w-4 h-4" />
              <span>Putuskan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connectionStatus === "menghubungkan"}
              className="h-11 px-6 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-sky-600/20 active:scale-95"
            >
              {connectionStatus === "menghubungkan" ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menghubungkan...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4" />
                  <span>Hubungkan Wi-Fi</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Target URL Info Banner */}
      {wsUrl && (
        <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 flex items-center justify-between">
          <span className="truncate">Target WebSocket Endpoint: <strong>{wsUrl}</strong></span>
          <span className="text-slate-400 font-sans text-[10px] shrink-0 ml-2">REST API: Port 80 (/api/status)</span>
        </div>
      )}



      {/* 3. Terminal Live Activity Log */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors"
          >
            <Terminal className="w-4 h-4 text-sky-600" />
            <span>Terminal Live Activity Log ({logs.length})</span>
          </button>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={clearLogs}
              className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Bersihkan Log</span>
            </button>
          )}
        </div>

        {showLogs && (
          <div className="bg-slate-950 text-slate-200 font-mono text-xs rounded-2xl p-4 h-48 overflow-y-auto border border-slate-800 shadow-inner flex flex-col gap-1.5">
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600 text-center py-6">
                Belum ada aktivitas WebSocket / Signal log.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-500 shrink-0 text-[10px] font-sans">[{log.timestamp}]</span>

                  {log.machine === "M1" ? (
                    <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-400 text-[10px] font-bold shrink-0 border border-purple-800">
                      M1
                    </span>
                  ) : log.machine === "M2" ? (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 text-[10px] font-bold shrink-0 border border-indigo-800">
                      M2
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold shrink-0">
                      SYS
                    </span>
                  )}

                  <span
                    className={`font-semibold shrink-0 text-[11px] ${
                      log.type === "START"
                        ? "text-emerald-400"
                        : log.type === "STOP"
                        ? "text-rose-400"
                        : log.type === "CONNECTED"
                        ? "text-sky-400"
                        : log.type === "DISCONNECTED"
                        ? "text-amber-400"
                        : log.type === "ERROR"
                        ? "text-red-500 font-bold"
                        : "text-slate-300"
                    }`}
                  >
                    [{log.type}]
                  </span>
                  <span className="text-slate-300 break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
