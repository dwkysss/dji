"use client";

import React, { useState, useEffect } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Terminal,
  Trash2,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Plus,
  Save,
  RotateCcw,
  Sliders,
} from "lucide-react";
import {
  useWifiContext,
  MachineChannel,
  MachineEspMapping,
  DEFAULT_MACHINE_ESP_MAP,
} from "@/lib/wifi-context";
import PinAuthModal from "@/components/PinAuthModal";

export default function WifiController() {
  const {
    targetHost,
    setTargetHost,
    connectionStatus,
    wsUrl,
    statusM1,
    statusM2,
    statusM3,
    machineMapping,
    updateMachineMapping,
    resetMachineMapping,
    logs,
    connect,
    disconnect,
    clearLogs,
    triggerM1Start,
    triggerM1Stop,
    triggerM2Start,
    triggerM2Stop,
    triggerM3Start,
    triggerM3Stop,
  } = useWifiContext();

  const [activeTab, setActiveTab] = useState<"koneksi" | "mapping">("koneksi");
  const [inputHost, setInputHost] = useState<string>(targetHost);
  const [showLogs, setShowLogs] = useState<boolean>(true);

  // State untuk edit pemetaan mesin
  const [editableMap, setEditableMap] = useState<Record<string, MachineEspMapping>>(machineMapping);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Sync saat machineMapping berubah
  useEffect(() => {
    setEditableMap(machineMapping);
  }, [machineMapping]);

  // Sync saat targetHost berubah
  useEffect(() => {
    setInputHost(targetHost);
  }, [targetHost]);

  // Pin Auth Modal state
  const [pinModalConfig, setPinModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onSuccess: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onSuccess: () => {},
  });

  const requestPinAuth = (title: string, description: string, onSuccessAction: () => void) => {
    setPinModalConfig({
      isOpen: true,
      title,
      description,
      onSuccess: onSuccessAction,
    });
  };

  const handleConnect = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    connect(inputHost);
  };

  const handleDisconnect = () => {
    requestPinAuth(
      "Memutuskan Koneksi ESP32",
      "Masukkan PIN Supervisor / Admin untuk mematikan koneksi ESP32.",
      () => disconnect()
    );
  };

  const handleUpdateMachineEntry = (oldKey: string, newKey: string, field: "host" | "channel", value: string) => {
    const updated = { ...editableMap };
    if (newKey !== oldKey) {
      const existing = updated[oldKey];
      delete updated[oldKey];
      updated[newKey.trim().toUpperCase()] = {
        ...existing,
        [field]: value,
      };
    } else {
      updated[oldKey] = {
        ...updated[oldKey],
        [field]: value,
      };
    }
    setEditableMap(updated);
  };

  const handleAddMachine = () => {
    let nextNum = 1;
    while (editableMap[`R${nextNum}`]) {
      nextNum++;
    }
    const newCode = `R${nextNum}`;
    setEditableMap((prev) => ({
      ...prev,
      [newCode]: {
        host: targetHost || "192.168.2.171",
        channel: "M1",
      },
    }));
  };

  const handleDeleteMachine = (mCode: string) => {
    setEditableMap((prev) => {
      const next = { ...prev };
      delete next[mCode];
      return next;
    });
  };

  const handleSaveMapping = () => {
    requestPinAuth(
      "Simpan Pemetaan Mesin",
      "Masukkan PIN Supervisor untuk menyimpan pemetaan nomor mesin ke pin ESP32.",
      () => {
        updateMachineMapping(editableMap);
        setSaveSuccessMsg("Pemetaan mesin berhasil disimpan!");
        setTimeout(() => setSaveSuccessMsg(null), 3000);
      }
    );
  };

  const handleResetMapping = () => {
    requestPinAuth(
      "Reset Pemetaan Mesin",
      "Masukkan PIN Supervisor untuk mengembalikan pemetaan mesin ke pengaturan standar pabrik.",
      () => {
        resetMachineMapping();
        setEditableMap(DEFAULT_MACHINE_ESP_MAP);
        setSaveSuccessMsg("Pemetaan berhasil dikembalikan ke standar!");
        setTimeout(() => setSaveSuccessMsg(null), 3000);
      }
    );
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
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
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Kontroler ESP32 Wi-Fi
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Sensor Otomatis Pemicu Timer Downtime Mesin
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

      {/* Tab Navigasi */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("koneksi")}
          className={`pb-2 px-3 font-bold text-xs border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "koneksi"
              ? "border-sky-600 text-sky-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Wifi className="w-3.5 h-3.5" />
          <span>Koneksi & Monitor</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("mapping")}
          className={`pb-2 px-3 font-bold text-xs border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "mapping"
              ? "border-sky-600 text-sky-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Pemetaan Mesin & Pin ({Object.keys(editableMap).length})</span>
        </button>
      </div>

      {/* TAB 1: KONEKSI & MONITOR */}
      {activeTab === "koneksi" && (
        <div className="flex flex-col gap-4">
          {/* Panel Input IP Address */}
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
                placeholder="IP Address ESP32 (contoh: 192.168.2.171)"
                className="w-full pl-10 pr-24 py-2.5 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => {
                  setInputHost("192.168.2.171");
                  setTargetHost("192.168.2.171");
                }}
                className="absolute inset-y-1 right-1 px-2.5 text-[11px] font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer"
              >
                IP Default
              </button>
            </div>

            <div className="flex items-center gap-2">
              {connectionStatus === "terhubung" ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="h-10 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <WifiOff className="w-4 h-4" />
                  <span>Putuskan</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connectionStatus === "menghubungkan"}
                  className="h-10 px-5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-sky-600/20 active:scale-95"
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

          {/* Alamat Target Info Banner */}
          {wsUrl && (
            <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 flex items-center justify-between">
              <span className="truncate">
                Alamat Target: <strong className="font-mono text-slate-800">{targetHost}</strong>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Port: 81 (WS)</span>
            </div>
          )}

          {/* Status 3 Channel Fisik ESP32 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {/* Channel M1 */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Channel M1 (GPIO 4)</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    statusM1 === "NYALA" ? "bg-emerald-500 animate-ping" : "bg-slate-300"
                  }`}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-black text-slate-800">
                  {statusM1 === "NYALA" ? "AKTIF (RUNNING)" : "NORMAL / STANDBY"}
                </span>
              </div>
            </div>

            {/* Channel M2 */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Channel M2 (GPIO 5)</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    statusM2 === "NYALA" ? "bg-emerald-500 animate-ping" : "bg-slate-300"
                  }`}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-black text-slate-800">
                  {statusM2 === "NYALA" ? "AKTIF (RUNNING)" : "NORMAL / STANDBY"}
                </span>
              </div>
            </div>

            {/* Channel M3 */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Channel M3 (GPIO 18)</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    statusM3 === "NYALA" ? "bg-emerald-500 animate-ping" : "bg-slate-300"
                  }`}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-black text-slate-800">
                  {statusM3 === "NYALA" ? "AKTIF (RUNNING)" : "NORMAL / STANDBY"}
                </span>
              </div>
            </div>
          </div>

          {/* Log Aktivitas Sinyal */}
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <Terminal className="w-4 h-4 text-sky-600" />
                <span>Log Aktivitas Sinyal ({logs.length})</span>
              </button>
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={clearLogs}
                  className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Bersihkan Log</span>
                </button>
              )}
            </div>

            {showLogs && (
              <div className="bg-slate-950 text-slate-200 font-mono text-xs rounded-2xl p-4 h-44 overflow-y-auto border border-slate-800 shadow-inner flex flex-col gap-1.5 custom-scrollbar">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-600 text-center py-6">
                    Belum ada aktivitas WebSocket / Signal log.
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-slate-500 shrink-0 text-[10px] font-sans">
                        [{log.timestamp}]
                      </span>

                      {log.machine === "M1" ? (
                        <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-400 text-[10px] font-bold shrink-0 border border-purple-800">
                          M1
                        </span>
                      ) : log.machine === "M2" ? (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 text-[10px] font-bold shrink-0 border border-indigo-800">
                          M2
                        </span>
                      ) : log.machine === "M3" ? (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[10px] font-bold shrink-0 border border-cyan-800">
                          M3
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
      )}

      {/* TAB 2: PEMETAAN MESIN & PIN ESP32 */}
      {activeTab === "mapping" && (
        <div className="flex flex-col gap-4">
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 leading-relaxed">
            💡 <strong>Panduan Pemetaan:</strong> Atur nomor mesin yang terhubung ke masing-masing ESP32 serta channel pin fisiknya. Aplikasi akan otomatis menyambungkan ke IP ESP32 yang sesuai saat operator memilih mesin di form.
          </div>

          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Tabel Pemetaan Mesin */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2.5">Nomor Mesin</th>
                  <th className="px-3 py-2.5">IP / Host ESP32</th>
                  <th className="px-3 py-2.5">Channel Pin</th>
                  <th className="px-2 py-2.5 text-center w-10">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(editableMap).map(([mCode, cfg]) => (
                  <tr key={mCode} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3 py-2 font-bold text-slate-800">
                      <input
                        type="text"
                        defaultValue={mCode}
                        onBlur={(e) => {
                          const val = e.target.value.trim().toUpperCase();
                          if (val && val !== mCode) {
                            handleUpdateMachineEntry(mCode, val, "host", cfg.host);
                          }
                        }}
                        className="w-20 px-2 py-1 rounded-lg border border-slate-200 bg-white font-bold text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600">
                      <input
                        type="text"
                        value={cfg.host}
                        onChange={(e) => handleUpdateMachineEntry(mCode, mCode, "host", e.target.value)}
                        placeholder="192.168.2.171"
                        className="w-full min-w-[120px] px-2 py-1 rounded-lg border border-slate-200 bg-white font-mono text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={cfg.channel}
                        onChange={(e) =>
                          handleUpdateMachineEntry(mCode, mCode, "channel", e.target.value as MachineChannel)
                        }
                        className="px-2 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-xs text-slate-700 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none"
                      >
                        <option value="M1">M1 (GPIO 4)</option>
                        <option value="M2">M2 (GPIO 5)</option>
                        <option value="M3">M3 (GPIO 18)</option>
                        <option value="M4">M4 (GPIO 19)</option>
                      </select>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteMachine(mCode)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title={`Hapus Mesin ${mCode}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tombol Aksi Bawah */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={handleAddMachine}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-600" />
              <span>Tambah Mesin</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetMapping}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset Standar</span>
              </button>

              <button
                type="button"
                onClick={handleSaveMapping}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Pemetaan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pin Authentication Modal */}
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
