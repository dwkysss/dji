"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Bluetooth, BluetoothConnected, BluetoothOff, AlertCircle, RefreshCw, Activity, Power, PowerOff, Terminal } from "lucide-react";

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
  const [sensorState, setSensorState] = useState<"MATI" | "NYALA" | "UNKNOWN">("UNKNOWN");
  const [showLogs, setShowLogs] = useState<boolean>(false);

  const isManualDisconnectRef = useRef<boolean>(false);
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const MAX_RETRIES = 5;

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

  // Cleanup reconnect timer on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
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
        setSensorState("MATI");
        addLog("START", 'Sinyal BLE: "START" (Relay LOW / Mesin Mati) -> Memulai Timer Downtime');
        onStartTimer("ESP32 BLE (Relay Mesin Mati)");
      } else if (valueStr === "STOP") {
        setSensorState("NYALA");
        addLog("STOP", 'Sinyal BLE: "STOP" (Relay HIGH / Mesin Nyala) -> Menghentikan Timer & Buka Pop-up Kendala');
        onStopTimer("ESP32 BLE (Relay Mesin Nyala)");
      } else {
        addLog("INFO", `Data BLE diterima: "${valueStr}"`);
      }
    },
    [onStartTimer, onStopTimer, addLog]
  );

  // Re-connect to GATT Server
  const connectGATTServer = useCallback(
    async (targetDevice: BluetoothDevice, isAutoRetry = false) => {
      try {
        setConnectionStatus("connecting");
        if (isAutoRetry) {
          addLog("INFO", `[Percobaan ${retryCountRef.current + 1}/${MAX_RETRIES}] Menghubungkan ke ${targetDevice.name || "ESP32"}...`);
        } else {
          addLog("INFO", "Menghubungkan ke GATT Server...");
        }

        const server = await targetDevice.gatt?.connect();
        if (!server) throw new Error("GATT Server ESP32 tidak merespon");

        const service = await server.getPrimaryService(SERVICE_UUID);
        const char = await service.getCharacteristic(CHARACTERISTIC_UUID);
        await char.startNotifications();
        char.addEventListener("characteristicvaluechanged", handleCharacteristicValueChanged);

        retryCountRef.current = 0; // Reset retry counter on success
        setCharacteristic(char);
        setConnectionStatus("connected");
        addLog(
          "CONNECTED",
          isAutoRetry
            ? "Berhasil terhubung kembali ke ESP32 secara otomatis!"
            : "Berhasil Terhubung ke ESP32! Menunggu sinyal trigger dari Relay Mesin."
        );
      } catch (err: any) {
        if (!isManualDisconnectRef.current && deviceRef.current) {
          retryCountRef.current += 1;
          if (retryCountRef.current <= MAX_RETRIES) {
            setConnectionStatus("connecting");
            addLog("ERROR", `ESP32 tidak merespon (${err.message || "Error"}). Retrying (${retryCountRef.current}/${MAX_RETRIES}) dalam 3 detik...`);
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = setTimeout(() => {
              if (!isManualDisconnectRef.current && deviceRef.current) {
                connectGATTServer(deviceRef.current, true);
              }
            }, 3000);
          } else {
            retryCountRef.current = 0;
            setConnectionStatus("disconnected");
            addLog("ERROR", `ESP32 tidak ditemukan setelah ${MAX_RETRIES}x percobaan (Mungkin daya dicabut). Auto-reconnect dihentikan.`);
          }
        } else {
          retryCountRef.current = 0;
          setConnectionStatus("disconnected");
        }
      }
    },
    [handleCharacteristicValueChanged, addLog]
  );

  // Handle Disconnect Event
  const handleDisconnectedEvent = useCallback(() => {
    setCharacteristic(null);
    setSensorState("UNKNOWN");

    if (isManualDisconnectRef.current) {
      retryCountRef.current = 0;
      setConnectionStatus("disconnected");
      setDevice(null);
      deviceRef.current = null;
      setDeviceName("");
      addLog("DISCONNECTED", "Koneksi ESP32 BLE terputus secara manual.");
    } else {
      retryCountRef.current = 0;
      setConnectionStatus("connecting");
      addLog("DISCONNECTED", "Koneksi ESP32 terputus tak terduga! Memulai pencarian ulang otomatis...");

      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        if (!isManualDisconnectRef.current && deviceRef.current) {
          connectGATTServer(deviceRef.current, true);
        }
      }, 1500);
    }
  }, [addLog, connectGATTServer]);

  // Auto-connect to previously granted device on page load/mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isAutoConnectAllowed = localStorage.getItem("dji_ble_auto_connect") !== "false";
    const nav = navigator as any;

    if (isAutoConnectAllowed && nav.bluetooth && nav.bluetooth.getDevices) {
      nav.bluetooth
        .getDevices()
        .then((devices: BluetoothDevice[]) => {
          const matched = devices.find(
            (d) => d.name?.includes("ESP32") || d.name?.includes("Relay") || d.name?.includes("LDR")
          );
          if (matched && !deviceRef.current && !isManualDisconnectRef.current) {
            isManualDisconnectRef.current = false;
            setDevice(matched);
            deviceRef.current = matched;
            setDeviceName(matched.name || "ESP32 Device");
            addLog("INFO", `Mendeteksi perangkat Bluetooth tersimpan (${matched.name || "ESP32"}). Menghubungkan...`);

            try {
              matched.removeEventListener("gattserverdisconnected", handleDisconnectedEvent);
            } catch (e) {}
            matched.addEventListener("gattserverdisconnected", handleDisconnectedEvent);

            connectGATTServer(matched, true);
          }
        })
        .catch(() => {});
    }
  }, [connectGATTServer, handleDisconnectedEvent, addLog]);

  // Connect to ESP32 BLE
  const handleConnect = async () => {
    if (!navigator.bluetooth) {
      alert("Browser Anda tidak mendukung Web Bluetooth API. Harap gunakan Google Chrome atau Microsoft Edge.");
      return;
    }

    try {
      isManualDisconnectRef.current = false;
      retryCountRef.current = 0;
      localStorage.setItem("dji_ble_auto_connect", "true");

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      setConnectionStatus("connecting");
      addLog("INFO", "Membuka dialog pemindaian Bluetooth...");

      const selectedDevice = await navigator.bluetooth.requestDevice({
        filters: [
          { name: "ESP32_Relay_Timer" },
          { name: "ESP32_LDR_Timer" },
          { namePrefix: "ESP32" },
          { services: [SERVICE_UUID] },
        ],
        optionalServices: [SERVICE_UUID],
      });

      setDevice(selectedDevice);
      deviceRef.current = selectedDevice;
      setDeviceName(selectedDevice.name || "ESP32 Device");
      addLog("INFO", `Memilih perangkat: ${selectedDevice.name || selectedDevice.id}`);

      // Add GATT disconnected listener
      try {
        selectedDevice.removeEventListener("gattserverdisconnected", handleDisconnectedEvent);
      } catch (e) {}
      selectedDevice.addEventListener("gattserverdisconnected", handleDisconnectedEvent);

      await connectGATTServer(selectedDevice, false);
    } catch (err: any) {
      retryCountRef.current = 0;
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
    isManualDisconnectRef.current = true;
    retryCountRef.current = 0;
    localStorage.setItem("dji_ble_auto_connect", "false");

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const currentDev = deviceRef.current || device;

    if (currentDev && currentDev.gatt?.connected) {
      if (characteristic) {
        try {
          characteristic.removeEventListener("characteristicvaluechanged", handleCharacteristicValueChanged);
        } catch (e) {}
      }
      currentDev.gatt.disconnect();
    } else {
      setConnectionStatus("disconnected");
      setDevice(null);
      deviceRef.current = null;
      setCharacteristic(null);
      setDeviceName("");
      setSensorState("UNKNOWN");
      addLog("DISCONNECTED", "Memutuskan koneksi ESP32 BLE secara manual.");
    }
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
                  ? (deviceRef.current ? "Auto-Reconnect" : "Proses")
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
