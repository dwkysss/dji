"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

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
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  }
  interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: string | number): Promise<BluetoothRemoteGATTCharacteristic>;
  }
  interface Navigator {
    bluetooth?: {
      requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
      getDevices?: () => Promise<BluetoothDevice[]>;
    };
  }
}

export interface BleLogEntry {
  id: string;
  timestamp: string;
  type: "START" | "STOP" | "CONNECTED" | "DISCONNECTED" | "ERROR" | "INFO";
  message: string;
}

export type SignalListener = (signal: "START" | "STOP", source: string) => void;

interface BluetoothContextType {
  isSupported: boolean;
  device: BluetoothDevice | null;
  characteristic: BluetoothRemoteGATTCharacteristic | null;
  connectionStatus: "disconnected" | "connecting" | "connected";
  deviceName: string;
  sensorState: "MATI" | "NYALA" | "UNKNOWN";
  logs: BleLogEntry[];
  connect: () => Promise<void>;
  disconnect: () => void;
  clearLogs: () => void;
  addLog: (type: BleLogEntry["type"], message: string) => void;
  registerSignalListener: (listener: SignalListener) => () => void;
}

const SERVICE_UUID = "4fa86700-4653-43f6-0180-72b018503b07";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

const BluetoothContext = createContext<BluetoothContextType | undefined>(undefined);

export function BluetoothProvider({ children }: { children: React.ReactNode }) {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [characteristic, setCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [deviceName, setDeviceName] = useState<string>("");
  const [logs, setLogs] = useState<BleLogEntry[]>([]);
  const [sensorState, setSensorState] = useState<"MATI" | "NYALA" | "UNKNOWN">("UNKNOWN");

  const isManualDisconnectRef = useRef<boolean>(false);
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const signalListenersRef = useRef<Set<SignalListener>>(new Set());
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
      ...prev.slice(0, 49),
    ]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const registerSignalListener = useCallback((listener: SignalListener) => {
    signalListenersRef.current.add(listener);
    return () => {
      signalListenersRef.current.delete(listener);
    };
  }, []);

  const dispatchSignal = useCallback((signal: "START" | "STOP", source: string) => {
    signalListenersRef.current.forEach((listener) => {
      try {
        listener(signal, source);
      } catch (err) {
        console.error("Error in BLE signal listener:", err);
      }
    });
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
        addLog("START", 'Sinyal BLE: "START" (Relay LOW / Mesin Mati) -> Memulai / Melanjutkan Akumulasi Timer Downtime');
        dispatchSignal("START", "ESP32 BLE (Relay Mesin Mati)");
      } else if (valueStr === "STOP") {
        setSensorState("NYALA");
        addLog("STOP", 'Sinyal BLE: "STOP" (Relay HIGH / Mesin Nyala) -> Evaluasi Nyala (Threshold 10s) & Buka Pop-up Kendala');
        dispatchSignal("STOP", "ESP32 BLE (Relay Mesin Nyala)");
      } else {
        addLog("INFO", `Data BLE diterima: "${valueStr}"`);
      }
    },
    [addLog, dispatchSignal]
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

        retryCountRef.current = 0;
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

  // Auto-connect on mount if previously saved/granted
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

  // Connect user action
  const connect = async () => {
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

  // Disconnect user action
  const disconnect = () => {
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

  return (
    <BluetoothContext.Provider
      value={{
        isSupported,
        device,
        characteristic,
        connectionStatus,
        deviceName,
        sensorState,
        logs,
        connect,
        disconnect,
        clearLogs,
        addLog,
        registerSignalListener,
      }}
    >
      {children}
    </BluetoothContext.Provider>
  );
}

export function useBluetooth() {
  const context = useContext(BluetoothContext);
  if (!context) {
    throw new Error("useBluetooth must be used within a BluetoothProvider");
  }
  return context;
}
