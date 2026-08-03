"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

export interface WifiLogEntry {
  id: string;
  timestamp: string;
  type: "START" | "STOP" | "CONNECTED" | "DISCONNECTED" | "ERROR" | "INFO";
  machine?: "M1" | "M2" | "SYSTEM";
  message: string;
}

export type WifiSignalListener = (machine: "M1" | "M2", signal: "START" | "STOP", source: string) => void;

export type ConnectionStatus = "terputus" | "menghubungkan" | "terhubung";

// Pemetaan Mesin ke Target Host ESP32 & Channel (M1/M2)
export const MACHINE_ESP32_MAP: Record<string, { host: string; channel: "M1" | "M2" }> = {
  "R1": { host: "esp32-r1.local", channel: "M1" },
  "R11": { host: "esp32-r1.local", channel: "M2" },
  "R2": { host: "esp32-r2.local", channel: "M1" },
  "R12": { host: "esp32-r2.local", channel: "M2" },
  "R3": { host: "esp32-r3.local", channel: "M1" },
  "R13": { host: "esp32-r3.local", channel: "M2" },
  "R6": { host: "esp32-r6.local", channel: "M1" },
  "R16": { host: "esp32-r6.local", channel: "M2" },
  "T1C": { host: "esp32-t1c.local", channel: "M1" },
  "T2A": { host: "esp32-t2a.local", channel: "M1" },
};

export function getEsp32ConfigForMachine(machineCode?: string) {
  if (!machineCode) return { host: "esp32-timer.local", channel: "M1" as const };
  const normalized = machineCode.trim().toUpperCase();
  return MACHINE_ESP32_MAP[normalized] || { host: `esp32-${normalized.toLowerCase().replace(/\s+/g, "-")}.local`, channel: "M1" as const };
}

interface WifiContextType {
  // Connection info
  targetHost: string;
  connectionStatus: ConnectionStatus;
  wsUrl: string;

  // Machine 1 state & timers
  statusM1: "MATI" | "NYALA" | "UNKNOWN";
  isTimerM1Running: boolean;
  elapsedM1: number;

  // Machine 2 state & timers
  statusM2: "MATI" | "NYALA" | "UNKNOWN";
  isTimerM2Running: boolean;
  elapsedM2: number;

  // Logs & Actions
  logs: WifiLogEntry[];
  setTargetHost: (host: string) => void;
  connect: (customHost?: string) => void;
  disconnect: () => void;
  clearLogs: () => void;
  addLog: (type: WifiLogEntry["type"], message: string, machine?: "M1" | "M2" | "SYSTEM") => void;

  // Web Simulator & Manual Triggers
  triggerM1Start: (source?: string) => void;
  triggerM1Stop: (source?: string) => void;
  triggerM2Start: (source?: string) => void;
  triggerM2Stop: (source?: string) => void;
  resetTimerM1: () => void;
  resetTimerM2: () => void;

  // Signal listeners
  registerSignalListener: (listener: WifiSignalListener) => () => void;
}

const WifiContext = createContext<WifiContextType | undefined>(undefined);

const DEFAULT_HOSTNAME = "esp32-timer.local";
const STORAGE_KEY = "wifi_esp32_target";

export function WifiProvider({ children }: { children: React.ReactNode }) {
  const [targetHost, setTargetHostState] = useState<string>(DEFAULT_HOSTNAME);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("terputus");
  const [wsUrl, setWsUrl] = useState<string>("");

  // Machine 1 State
  const [statusM1, setStatusM1] = useState<"MATI" | "NYALA" | "UNKNOWN">("UNKNOWN");
  const [isTimerM1Running, setIsTimerM1Running] = useState<boolean>(false);
  const [elapsedM1, setElapsedM1] = useState<number>(0);

  // Machine 2 State
  const [statusM2, setStatusM2] = useState<"MATI" | "NYALA" | "UNKNOWN">("UNKNOWN");
  const [isTimerM2Running, setIsTimerM2Running] = useState<boolean>(false);
  const [elapsedM2, setElapsedM2] = useState<number>(0);

  const [logs, setLogs] = useState<WifiLogEntry[]>([]);

  // Refs for persistent connection management
  const socketRef = useRef<WebSocket | null>(null);
  const autoReconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnectRef = useRef<boolean>(false);
  const signalListenersRef = useRef<Set<WifiSignalListener>>(new Set());

  // Log Helper
  const addLog = useCallback(
    (type: WifiLogEntry["type"], message: string, machine: "M1" | "M2" | "SYSTEM" = "SYSTEM") => {
      const timeStr = new Date().toLocaleTimeString("id-ID", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const newEntry: WifiLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: timeStr,
        type,
        machine,
        message,
      };

      setLogs((prev) => [newEntry, ...prev.slice(0, 99)]); // Keep last 100 entries
    },
    []
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Save hostname to localStorage
  const setTargetHost = useCallback((host: string) => {
    const cleaned = host.trim() || DEFAULT_HOSTNAME;
    setTargetHostState(cleaned);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, cleaned);
    }
  }, []);

  // Notify registered signal listeners
  const notifyListeners = useCallback((machine: "M1" | "M2", signal: "START" | "STOP", source: string) => {
    signalListenersRef.current.forEach((listener) => {
      try {
        listener(machine, signal, source);
      } catch (err) {
        console.error("Error in Wifi signal listener:", err);
      }
    });
  }, []);

  // Timer Tick Interval for M1
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerM1Running) {
      interval = setInterval(() => {
        setElapsedM1((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerM1Running]);

  // Timer Tick Interval for M2
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerM2Running) {
      interval = setInterval(() => {
        setElapsedM2((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerM2Running]);

  // Handle Event Triggers for M1
  const triggerM1Start = useCallback(
    (source: string = "Manual/Simulasi") => {
      setStatusM1("NYALA");
      setIsTimerM1Running(true);
      addLog("START", `Mesin 1 START (Downtime/Operation Aktif) - via ${source}`, "M1");
      notifyListeners("M1", "START", source);
    },
    [addLog, notifyListeners]
  );

  const triggerM1Stop = useCallback(
    (source: string = "Manual/Simulasi") => {
      setStatusM1("MATI");
      setIsTimerM1Running(false);
      addLog("STOP", `Mesin 1 STOP - via ${source}`, "M1");
      notifyListeners("M1", "STOP", source);
    },
    [addLog, notifyListeners]
  );

  const resetTimerM1 = useCallback(() => {
    setElapsedM1(0);
    setIsTimerM1Running(false);
    setStatusM1("UNKNOWN");
    addLog("INFO", "Timer Mesin 1 di-reset ke 0", "M1");
  }, [addLog]);

  // Handle Event Triggers for M2
  const triggerM2Start = useCallback(
    (source: string = "Manual/Simulasi") => {
      setStatusM2("NYALA");
      setIsTimerM2Running(true);
      addLog("START", `Mesin 2 START (Downtime/Operation Aktif) - via ${source}`, "M2");
      notifyListeners("M2", "START", source);
    },
    [addLog, notifyListeners]
  );

  const triggerM2Stop = useCallback(
    (source: string = "Manual/Simulasi") => {
      setStatusM2("MATI");
      setIsTimerM2Running(false);
      addLog("STOP", `Mesin 2 STOP - via ${source}`, "M2");
      notifyListeners("M2", "STOP", source);
    },
    [addLog, notifyListeners]
  );

  const resetTimerM2 = useCallback(() => {
    setElapsedM2(0);
    setIsTimerM2Running(false);
    setStatusM2("UNKNOWN");
    addLog("INFO", "Timer Mesin 2 di-reset ke 0", "M2");
  }, [addLog]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    if (autoReconnectTimerRef.current) {
      clearTimeout(autoReconnectTimerRef.current);
      autoReconnectTimerRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setConnectionStatus("terputus");
    addLog("DISCONNECTED", "Koneksi WebSocket diputuskan oleh pengguna", "SYSTEM");
  }, [addLog]);

  // Connect WebSocket function
  const connect = useCallback(
    (customHost?: string) => {
      const host = (customHost || targetHost).trim() || DEFAULT_HOSTNAME;
      if (customHost && customHost !== targetHost) {
        setTargetHost(host);
      }

      // Close existing socket if any
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      if (autoReconnectTimerRef.current) {
        clearTimeout(autoReconnectTimerRef.current);
        autoReconnectTimerRef.current = null;
      }

      isManualDisconnectRef.current = false;
      setConnectionStatus("menghubungkan");

      const url = `ws://${host}:81`;
      setWsUrl(url);
      addLog("INFO", `Mencoba terhubung ke WebSocket ESP32: ${url}...`, "SYSTEM");

      try {
        const ws = new WebSocket(url);
        socketRef.current = ws;

        ws.onopen = () => {
          setConnectionStatus("terhubung");
          addLog("CONNECTED", `Terhubung ke ESP32 Wi-Fi WebSocket (${host}:81)`, "SYSTEM");
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // Payload format: {"machine":"M1","status":"START"}
            if (data.machine && data.status) {
              const machine = data.machine as "M1" | "M2";
              const status = data.status as "START" | "STOP";

              if (machine === "M1") {
                if (status === "START") {
                  triggerM1Start("ESP32 GPIO 4");
                } else if (status === "STOP") {
                  triggerM1Stop("ESP32 GPIO 4");
                }
              } else if (machine === "M2") {
                if (status === "START") {
                  triggerM2Start("ESP32 GPIO 5");
                } else if (status === "STOP") {
                  triggerM2Stop("ESP32 GPIO 5");
                }
              }
            }
          } catch (e) {
            console.error("Gagal parse message WebSocket:", event.data, e);
          }
        };

        ws.onerror = (err) => {
          console.warn("WebSocket error:", err);
          addLog("ERROR", `Kesalahan koneksi WebSocket ke ${url}`, "SYSTEM");
        };

        ws.onclose = () => {
          setConnectionStatus("terputus");
          socketRef.current = null;

          if (!isManualDisconnectRef.current) {
            addLog("DISCONNECTED", "Koneksi terputus. Menjadwalkan reconnect otomatis dalam 4 detik...", "SYSTEM");
            // Auto Reconnect every 4 seconds as per requirement
            autoReconnectTimerRef.current = setTimeout(() => {
              if (!isManualDisconnectRef.current) {
                addLog("INFO", "Mencoba terhubung kembali (Auto-Reconnect 4s)...", "SYSTEM");
                connect(host);
              }
            }, 4000);
          }
        };
      } catch (err: any) {
        setConnectionStatus("terputus");
        addLog("ERROR", `Gagal menginisialisasi WebSocket: ${err?.message || err}`, "SYSTEM");
      }
    },
    [targetHost, setTargetHost, addLog, triggerM1Start, triggerM1Stop, triggerM2Start, triggerM2Stop]
  );

  // Load Hostname from LocalStorage on mount (Standby mode, connect on demand)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setTargetHostState(stored);
      }
    }

    return () => {
      if (autoReconnectTimerRef.current) {
        clearTimeout(autoReconnectTimerRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []); // Run once on mount

  const registerSignalListener = useCallback((listener: WifiSignalListener) => {
    signalListenersRef.current.add(listener);
    return () => {
      signalListenersRef.current.delete(listener);
    };
  }, []);

  return (
    <WifiContext.Provider
      value={{
        targetHost,
        connectionStatus,
        wsUrl,
        statusM1,
        isTimerM1Running,
        elapsedM1,
        statusM2,
        isTimerM2Running,
        elapsedM2,
        logs,
        setTargetHost,
        connect,
        disconnect,
        clearLogs,
        addLog,
        triggerM1Start,
        triggerM1Stop,
        triggerM2Start,
        triggerM2Stop,
        resetTimerM1,
        resetTimerM2,
        registerSignalListener,
      }}
    >
      {children}
    </WifiContext.Provider>
  );
}

export function useWifiContext() {
  const context = useContext(WifiContext);
  if (!context) {
    throw new Error("useWifiContext harus digunakan di dalam WifiProvider");
  }
  return context;
}
