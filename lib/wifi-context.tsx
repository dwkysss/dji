"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

// Multi-machine Wi-Fi Context (M1, M2, M3, M4)

export interface WifiLogEntry {
  id: string;
  timestamp: string;
  type: "START" | "STOP" | "CONNECTED" | "DISCONNECTED" | "ERROR" | "INFO";
  machine?: "M1" | "M2" | "M3" | "M4" | "SYSTEM";
  message: string;
}

export type MachineChannel = "M1" | "M2" | "M3" | "M4";

export type WifiSignalListener = (machine: MachineChannel, signal: "START" | "STOP", source: string) => void;

export type ConnectionStatus = "terputus" | "menghubungkan" | "terhubung";

export interface MachineEspMapping {
  host: string;
  channel: MachineChannel;
}

// Pemetaan Standar Mesin ke Target Host ESP32 & Channel Pin
export const DEFAULT_MACHINE_ESP_MAP: Record<string, MachineEspMapping> = {
  "R1": { host: "192.168.2.171", channel: "M1" },
  "R11": { host: "192.168.2.171", channel: "M2" },
  "R2": { host: "192.168.2.171", channel: "M3" },
  "R12": { host: "192.168.2.172", channel: "M1" },
  "R1C": { host: "192.168.2.172", channel: "M2" },
  "R2C": { host: "192.168.2.172", channel: "M3" },
  "R3B": { host: "192.168.2.172", channel: "M4" },
  "T1C": { host: "192.168.2.173", channel: "M1" },
  "T2A": { host: "192.168.2.173", channel: "M2" },
  "R16": { host: "192.168.2.173", channel: "M3" },
};

export const MACHINE_ESP32_MAP = DEFAULT_MACHINE_ESP_MAP;

export function getEsp32ConfigForMachine(machineCode?: string, customMap?: Record<string, MachineEspMapping>) {
  const map = customMap || DEFAULT_MACHINE_ESP_MAP;
  if (!machineCode) {
    const peers = Object.entries(map)
      .filter(([_, cfg]) => cfg.host === "192.168.2.171")
      .map(([mCode, cfg]) => ({ machineCode: mCode, channel: cfg.channel }));
    return { host: "192.168.2.171", channel: "M1" as MachineChannel, peers };
  }
  const normalized = machineCode.trim().toUpperCase();
  const config = map[normalized] || { host: "192.168.2.171", channel: "M1" as MachineChannel };
  
  const peers = Object.entries(map)
    .filter(([_, cfg]) => cfg.host === config.host)
    .map(([mCode, cfg]) => ({ machineCode: mCode, channel: cfg.channel }));

  return {
    ...config,
    peers,
  };
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

  // Machine 3 state & timers
  statusM3: "MATI" | "NYALA" | "UNKNOWN";
  isTimerM3Running: boolean;
  elapsedM3: number;

  // Machine Mapping Management
  machineMapping: Record<string, MachineEspMapping>;
  updateMachineMapping: (newMap: Record<string, MachineEspMapping>) => void;
  resetMachineMapping: () => void;

  // Logs & Actions
  logs: WifiLogEntry[];
  setTargetHost: (host: string) => void;
  connect: (customHost?: string) => void;
  disconnect: () => void;
  clearLogs: () => void;
  addLog: (type: WifiLogEntry["type"], message: string, machine?: MachineChannel | "SYSTEM") => void;

  // Web Simulator & Manual Triggers
  isSimulationMode: boolean;
  toggleSimulationMode: (enable?: boolean) => void;
  triggerM1Start: (source?: string) => void;
  triggerM1Stop: (source?: string) => void;
  triggerM2Start: (source?: string) => void;
  triggerM2Stop: (source?: string) => void;
  triggerM3Start: (source?: string) => void;
  triggerM3Stop: (source?: string) => void;
  resetTimerM1: () => void;
  resetTimerM2: () => void;
  resetTimerM3: () => void;

  // Signal listeners
  registerSignalListener: (listener: WifiSignalListener) => () => void;
}

const WifiContext = createContext<WifiContextType | undefined>(undefined);

const DEFAULT_HOSTNAME = "192.168.2.171";
const STORAGE_KEY = "wifi_esp32_target";
const MAP_STORAGE_KEY = "wifi_machine_esp32_map";

export function WifiProvider({ children }: { children: React.ReactNode }) {
  const [targetHost, setTargetHostState] = useState<string>(DEFAULT_HOSTNAME);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("terputus");
  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(false);
  const [wsUrl, setWsUrl] = useState<string>("");

  // Dynamic Machine Mapping State
  const [machineMapping, setMachineMapping] = useState<Record<string, MachineEspMapping>>(DEFAULT_MACHINE_ESP_MAP);

  // Machine 1 State
  const [statusM1, setStatusM1] = useState<"MATI" | "NYALA" | "UNKNOWN">("UNKNOWN");
  const [isTimerM1Running, setIsTimerM1Running] = useState<boolean>(false);
  const [elapsedM1, setElapsedM1] = useState<number>(0);

  // Machine 2 State
  const [statusM2, setStatusM2] = useState<"MATI" | "NYALA" | "UNKNOWN">("UNKNOWN");
  const [isTimerM2Running, setIsTimerM2Running] = useState<boolean>(false);
  const [elapsedM2, setElapsedM2] = useState<number>(0);

  // Machine 3 State
  const [statusM3, setStatusM3] = useState<"MATI" | "NYALA" | "UNKNOWN">("UNKNOWN");
  const [isTimerM3Running, setIsTimerM3Running] = useState<boolean>(false);
  const [elapsedM3, setElapsedM3] = useState<number>(0);

  const [logs, setLogs] = useState<WifiLogEntry[]>([]);

  // Refs for persistent connection management
  const socketRef = useRef<WebSocket | null>(null);
  const autoReconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnectRef = useRef<boolean>(false);
  const signalListenersRef = useRef<Set<WifiSignalListener>>(new Set());

  // Log Helper
  const addLog = useCallback(
    (type: WifiLogEntry["type"], message: string, machine: MachineChannel | "SYSTEM" = "SYSTEM") => {
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

  const toggleSimulationMode = useCallback((enable?: boolean) => {
    setIsSimulationMode((prev) => {
      const nextVal = typeof enable === "boolean" ? enable : !prev;
      addLog("INFO", nextVal ? "Mode Simulasi ESP32 diaktifkan (Demo Offline)" : "Mode Simulasi ESP32 dinonaktifkan", "SYSTEM");
      return nextVal;
    });
  }, [addLog]);

  // Save hostname to localStorage
  const setTargetHost = useCallback((host: string) => {
    const cleaned = host.trim() || DEFAULT_HOSTNAME;
    setTargetHostState(cleaned);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, cleaned);
    }
  }, []);

  // Update Machine Mapping
  const updateMachineMapping = useCallback((newMap: Record<string, MachineEspMapping>) => {
    setMachineMapping(newMap);
    if (typeof window !== "undefined") {
      localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(newMap));
    }
    addLog("INFO", "Pemetaan mesin ESP32 berhasil diperbarui", "SYSTEM");
  }, [addLog]);

  const resetMachineMapping = useCallback(() => {
    setMachineMapping(DEFAULT_MACHINE_ESP_MAP);
    if (typeof window !== "undefined") {
      localStorage.removeItem(MAP_STORAGE_KEY);
    }
    addLog("INFO", "Pemetaan mesin ESP32 di-reset ke standar pabrik", "SYSTEM");
  }, [addLog]);

  // Notify registered signal listeners
  const notifyListeners = useCallback((machine: MachineChannel, signal: "START" | "STOP", source: string) => {
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

  // Timer Tick Interval for M3
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerM3Running) {
      interval = setInterval(() => {
        setElapsedM3((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerM3Running]);

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

  // Handle Event Triggers for M3
  const triggerM3Start = useCallback(
    (source: string = "Manual/Simulasi") => {
      setStatusM3("NYALA");
      setIsTimerM3Running(true);
      addLog("START", `Mesin 3 START (Downtime/Operation Aktif) - via ${source}`, "M3");
      notifyListeners("M3", "START", source);
    },
    [addLog, notifyListeners]
  );

  const triggerM3Stop = useCallback(
    (source: string = "Manual/Simulasi") => {
      setStatusM3("MATI");
      setIsTimerM3Running(false);
      addLog("STOP", `Mesin 3 STOP - via ${source}`, "M3");
      notifyListeners("M3", "STOP", source);
    },
    [addLog, notifyListeners]
  );

  const resetTimerM3 = useCallback(() => {
    setElapsedM3(0);
    setIsTimerM3Running(false);
    setStatusM3("UNKNOWN");
    addLog("INFO", "Timer Mesin 3 di-reset ke 0", "M3");
  }, [addLog]);

  const reconnectAttemptsRef = useRef<number>(0);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    reconnectAttemptsRef.current = 0;
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
      let host = customHost;
      if (!host && typeof window !== "undefined") {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) host = stored;
      }
      host = (host || targetHost).trim() || DEFAULT_HOSTNAME;
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

      try {
        const ws = new WebSocket(url);
        socketRef.current = ws;

        ws.onopen = () => {
          reconnectAttemptsRef.current = 0;
          setConnectionStatus("terhubung");
          addLog("CONNECTED", `Terhubung ke ESP32 Wi-Fi WebSocket (${host}:81)`, "SYSTEM");
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // Payload format: {"machine":"M1","status":"START"}
            if (data.machine && data.status) {
              const machine = data.machine as MachineChannel;
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
              } else if (machine === "M3") {
                if (status === "START") {
                  triggerM3Start("ESP32 GPIO 18");
                } else if (status === "STOP") {
                  triggerM3Stop("ESP32 GPIO 18");
                }
              }
            }
          } catch (e) {
            console.error("Gagal parse message WebSocket:", event.data, e);
          }
        };

        ws.onerror = () => {
          // Silent error in background to avoid spamming React state
        };

        ws.onclose = () => {
          setConnectionStatus("terputus");
          socketRef.current = null;

          if (!isManualDisconnectRef.current) {
            reconnectAttemptsRef.current += 1;
            // Exponential backoff: 5s, 10s, 15s... max 30s to save tablet CPU/Battery
            const delay = Math.min(30000, 5000 + Math.min(reconnectAttemptsRef.current * 3000, 25000));
            autoReconnectTimerRef.current = setTimeout(() => {
              if (!isManualDisconnectRef.current) {
                connect(host);
              }
            }, delay);
          }
        };
      } catch (err: any) {
        setConnectionStatus("terputus");
      }
    },
    [targetHost, setTargetHost, addLog, triggerM1Start, triggerM1Stop, triggerM2Start, triggerM2Stop, triggerM3Start, triggerM3Stop]
  );

  // Load Hostname, Machine Map & Auto-connect on mount
  useEffect(() => {
    let savedHost = DEFAULT_HOSTNAME;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        savedHost = stored;
        setTargetHostState(stored);
      }
      const storedMap = localStorage.getItem(MAP_STORAGE_KEY);
      if (storedMap) {
        try {
          setMachineMapping(JSON.parse(storedMap));
        } catch (e) {
          console.error("Gagal parse stored machine map:", e);
        }
      }
    }

    connect(savedHost);

    return () => {
      if (autoReconnectTimerRef.current) {
        clearTimeout(autoReconnectTimerRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const registerSignalListener = useCallback((listener: WifiSignalListener) => {
    signalListenersRef.current.add(listener);
    return () => {
      signalListenersRef.current.delete(listener);
    };
  }, []);

  const effectiveConnectionStatus = isSimulationMode ? "terhubung" : connectionStatus;

  const contextValue = React.useMemo(() => ({
    targetHost,
    connectionStatus: effectiveConnectionStatus,
    wsUrl,
    isSimulationMode,
    toggleSimulationMode,
    statusM1,
    isTimerM1Running,
    elapsedM1,
    statusM2,
    isTimerM2Running,
    elapsedM2,
    statusM3,
    isTimerM3Running,
    elapsedM3,
    machineMapping,
    updateMachineMapping,
    resetMachineMapping,
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
    triggerM3Start,
    triggerM3Stop,
    resetTimerM1,
    resetTimerM2,
    resetTimerM3,
    registerSignalListener,
  }), [
    targetHost,
    effectiveConnectionStatus,
    wsUrl,
    isSimulationMode,
    toggleSimulationMode,
    statusM1,
    isTimerM1Running,
    elapsedM1,
    statusM2,
    isTimerM2Running,
    elapsedM2,
    statusM3,
    isTimerM3Running,
    elapsedM3,
    machineMapping,
    updateMachineMapping,
    resetMachineMapping,
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
    triggerM3Start,
    triggerM3Stop,
    resetTimerM1,
    resetTimerM2,
    resetTimerM3,
    registerSignalListener,
  ]);

  return (
    <WifiContext.Provider value={contextValue}>
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
