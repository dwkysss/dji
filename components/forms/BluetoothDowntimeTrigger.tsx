"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bluetooth, BluetoothConnected, BluetoothOff, AlertCircle, RefreshCw, Activity, Sun, Moon, Terminal } from "lucide-react";

// Web Bluetooth API Types Declaration for TypeScript
declare global {
  interface BluetoothRequestDeviceFilter {
    name?: string;
    namePrefix?: string;
    services?: (string | number)[];
  }
  interface RequestDeviceOptions {
    filters?: BluetoothRequestDeviceFilter[];
    optionalServices?: (string | number)[];
    acceptAllDevices?: boolean;
  }
  interface BluetoothRemoteGATTServer {
    connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: string | number): Promise<BluetoothRemoteGATTService>;
  }
  interface BluetoothDevice extends EventTarget {
    id: string;
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  }
  interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    value?: DataView;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  }
  interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: string | number): Promise<BluetoothRemoteGATTCharacteristic>;
  }
  interface Navigator {
    bluetooth?: {
      requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
    };
  }
}

interface BluetoothDowntimeTriggerProps {
  onStartTimer: (source?: string) => void;
  onStopTimer: (source?: string) => void;
  isTimerRunning?: boolean;
}

export interface BleLogEntry {
  id: string;
  timestamp: string;
  type: "START" | "STOP" | "CONNECTED" | "DISCONNECTED" | "ERROR" | "INFO";
  message: string;
}

// UUID ESP32 BLE (Must match esp32_ldr_timer.ino)
const SERVICE_UUID = "4fa86700-4653-43f6-0180-72b018503b07";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

export default function BluetoothDowntimeTrigger({
  onStartTimer,
  onStopTimer,
  isTimerRunning = false,
}: BluetoothDowntimeTriggerProps) {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [characteristic, setCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [deviceName, setDeviceName] = useState<string>("");
  const [logs, setLogs] = useState<BleLogEntry[]>([]);
  const [sensorState, setSensorState] = useState<"GELAP" | "TERANG" | "UNKNOWN">("UNKNOWN");
  const [showLogs, setShowLogs] = useState<boolean>(false);

  const addLog = useCallback((type: BleLogEntry["type"], message: string) => {
    const timeStr = new Date().toLocaleTimeString("id-ID", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    setLogs((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: timeStr,
        type,
        message,
      },
      ...prev.slice(0, 29),
    ]);
  }, []);

  // Check Web Bluetooth API Support
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!navigator.bluetooth) {
        setIsSupported(false);
        addLog("ERROR", "Web Bluetooth API tidak didukung browser ini. Gunakan Chrome, MS Edge, atau Opera.");
      } else {
        addLog("INFO", "Web Bluetooth siap. Hubungkan ESP32 BLE untuk pemicu otomatis.");
      }
    }
  }, [addLog]);

  // Handle Notifications from ESP32 BLE
  const handleCharacteristicValueChanged = useCallback(
    (event: Event) => {
      const char = event.target as BluetoothRemoteGATTCharacteristic;
      if (!char.value) return;

      const decoder = new TextDecoder("utf-8");
      const valueStr = decoder.decode(char.value).trim().toUpperCase();

      if (valueStr === "START") {
        setSensorState("GELAP");
        addLog("START", 'Sinyal BLE: "START" (Sensor Gelap / Mesin Mati) -> Memulai Timer Downtime');
        onStartTimer("ESP32 BLE (Sensor Gelap)");
      } else if (valueStr === "STOP") {
        setSensorState("TERANG");
        addLog("STOP", 'Sinyal BLE: "STOP" (Sensor Terang / Mesin Jalan) -> Menghentikan Timer & Buka Pop-up Kendala');
        onStopTimer("ESP32 BLE (Sensor Terang)");
      } else {
        addLog("INFO", `Data BLE diterima: "${valueStr}"`);
      }
    },
    [onStartTimer, onStopTimer, addLog]
  );

  // Connect to ESP32 BLE
  const handleConnect = async () => {
    if (!navigator.bluetooth) {
      alert("Browser Anda tidak mendukung Web Bluetooth API. Harap gunakan Google Chrome atau Microsoft Edge.");
      return;
    }

    try {
      setConnectionStatus("connecting");
      addLog("INFO", "Membuka dialog pemindaian Bluetooth...");

      const selectedDevice = await navigator.bluetooth.requestDevice({
        filters: [
          { name: "ESP32_LDR_Timer" },
          { namePrefix: "ESP32" },
          { services: [SERVICE_UUID] },
        ],
        optionalServices: [SERVICE_UUID],
      });

      setDevice(selectedDevice);
      setDeviceName(selectedDevice.name || "ESP32 Device");
      addLog("INFO", `Memilih perangkat: ${selectedDevice.name || selectedDevice.id}`);

      // Handle Disconnect Event
      selectedDevice.addEventListener("gattserverdisconnected", () => {
        setConnectionStatus("disconnected");
        setCharacteristic(null);
        setDevice(null);
        setDeviceName("");
        setSensorState("UNKNOWN");
        addLog("DISCONNECTED", "Koneksi ESP32 BLE terputus!");
      });

      // Connect GATT Server
      addLog("INFO", "Menghubungkan ke GATT Server...");
      const server = await selectedDevice.gatt?.connect();
      if (!server) throw new Error("GATT Server ESP32 tidak merespon");

      // Get Service
      const service = await server.getPrimaryService(SERVICE_UUID);

      // Get Characteristic & Start Notifications
      const char = await service.getCharacteristic(CHARACTERISTIC_UUID);
      await char.startNotifications();
      char.addEventListener("characteristicvaluechanged", handleCharacteristicValueChanged);

      setCharacteristic(char);
      setConnectionStatus("connected");
      addLog("CONNECTED", "Berhasil Terhubung ke ESP32! Menunggu sinyal trigger dari Sensor.");
    } catch (err: any) {
      setConnectionStatus("disconnected");
      const isCancel = err.name === "NotFoundError" || err.message?.toLowerCase().includes("cancel");
      if (isCancel) {
        addLog("INFO", "Pemindaian Bluetooth dibatalkan oleh pengguna.");
      } else {
        addLog("ERROR", `Gagal terhubung: ${err.message || "Error tidak diketahui"}`);
      }
    }
  };

  // Disconnect Bluetooth
  const handleDisconnect = () => {
    if (device && device.gatt?.connected) {
      if (characteristic) {
        try {
          characteristic.removeEventListener("characteristicvaluechanged", handleCharacteristicValueChanged);
        } catch (e) {}
      }
      device.gatt.disconnect();
      addLog("DISCONNECTED", "Memutuskan koneksi ESP32 BLE secara manual.");
    }
    setConnectionStatus("disconnected");
    setDevice(null);
    setCharacteristic(null);
    setDeviceName("");
    setSensorState("UNKNOWN");
  };

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
                  ? "Menghubungkan ESP32..."
                  : "ESP32 BLE Trigger"}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  connectionStatus === "connected"
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                    : connectionStatus === "connecting"
                    ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                {connectionStatus === "connected"
                  ? "Terhubung"
                  : connectionStatus === "connecting"
                  ? "Proses"
                  : "Terputus"}
              </span>
            </div>

            {/* Sensor Status Indicator */}
            {connectionStatus === "connected" && (
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Status Sensor:</span>
                {sensorState === "GELAP" ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                    <Moon className="w-3 h-3" /> Gelap (Mesin Stop - Timer On)
                  </span>
                ) : sensorState === "TERANG" ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <Sun className="w-3 h-3" /> Terang (Mesin Jalan)
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
              onClick={handleConnect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors shadow-xs"
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
              onClick={handleDisconnect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-medium rounded-lg border border-rose-200 dark:border-rose-800 transition-colors"
            >
              <BluetoothOff className="w-3.5 h-3.5" />
              Putuskan
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className="p-1.5 bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
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
              onClick={() => setLogs([])}
              className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
