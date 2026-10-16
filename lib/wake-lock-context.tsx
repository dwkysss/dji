"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

interface WakeLockSentinelLike extends EventTarget {
  readonly released: boolean;
  readonly type: "screen";
  release(): Promise<void>;
  onrelease: ((this: WakeLockSentinelLike, ev: Event) => any) | null;
}

interface WakeLockContextType {
  isSupported: boolean;
  isActive: boolean;
  isEnabled: boolean;
  toggleWakeLock: (forced?: boolean) => Promise<boolean>;
  requestWakeLock: () => Promise<boolean>;
  releaseWakeLock: () => Promise<void>;
}

const WakeLockContext = createContext<WakeLockContextType | undefined>(undefined);

const STORAGE_KEY = "dji_screen_wake_lock_enabled";

export function WakeLockProvider({ children }: { children: React.ReactNode }) {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const isAcquiringRef = useRef<boolean>(false);

  // 1. Cek dukungan browser dan ambil preferensi user dari localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const supported = "wakeLock" in navigator && typeof (navigator as any).wakeLock?.request === "function";
      setIsSupported(supported);

      try {
        const savedPref = localStorage.getItem(STORAGE_KEY);
        if (savedPref !== null) {
          setIsEnabled(savedPref === "true");
        }
      } catch (e) {
        // Ignore localStorage error
      }
    }
  }, []);

  // 2. Fungsi Melepas Kunci Layar
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (err) {
        console.warn("[ScreenWakeLock] Gagal melepas wake lock:", err);
      } finally {
        wakeLockRef.current = null;
        setIsActive(false);
      }
    }
  }, []);

  // 3. Fungsi Mengaktifkan Kunci Layar (Agar Tidak Sleep / Mati)
  const requestWakeLock = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("wakeLock" in navigator)) {
      return false;
    }
    // Jika dokumen sedang tidak terlihat (tab diminimalkan / layar mati), tunda request
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return false;
    }
    // Jika wake lock yang ada masih aktif dan valid
    if (wakeLockRef.current && !wakeLockRef.current.released) {
      setIsActive(true);
      return true;
    }
    if (isAcquiringRef.current) return false;

    isAcquiringRef.current = true;
    try {
      const sentinel = (await (navigator as any).wakeLock.request("screen")) as WakeLockSentinelLike;
      wakeLockRef.current = sentinel;
      setIsActive(true);

      sentinel.addEventListener("release", () => {
        setIsActive(false);
        wakeLockRef.current = null;
      });

      return true;
    } catch (err: any) {
      // NotAllowedError biasanya muncul jika browser butuh interaksi user pertama atau baterai kritis
      setIsActive(false);
      return false;
    } finally {
      isAcquiringRef.current = false;
    }
  }, []);

  // 4. Toggle On/Off Manual
  const toggleWakeLock = useCallback(
    async (forced?: boolean): Promise<boolean> => {
      const nextState = typeof forced === "boolean" ? forced : !isEnabled;
      setIsEnabled(nextState);
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, nextState.toString());
        }
      } catch (e) {}

      if (nextState) {
        return await requestWakeLock();
      } else {
        await releaseWakeLock();
        return false;
      }
    },
    [isEnabled, requestWakeLock, releaseWakeLock]
  );

  // 5. Otomatis Re-request saat Tab/Layar Bangun Kembali (visibilitychange)
  useEffect(() => {
    if (!isEnabled) return;

    const handleVisibilityChange = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible" && isEnabled) {
        await requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [isEnabled, requestWakeLock]);

  // 6. User Gesture Fallback Listener:
  // Beberapa browser Android memerlukan setidaknya satu ketukan/interaksi sebelum mengizinkan Screen Wake Lock
  useEffect(() => {
    if (!isEnabled || !isSupported) return;

    // Coba request langsung di awal
    requestWakeLock();

    const handleUserInteraction = async () => {
      if (isEnabled && (!wakeLockRef.current || wakeLockRef.current.released)) {
        await requestWakeLock();
      }
    };

    window.addEventListener("touchstart", handleUserInteraction, { passive: true });
    window.addEventListener("pointerdown", handleUserInteraction, { passive: true });
    window.addEventListener("click", handleUserInteraction, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleUserInteraction);
      window.removeEventListener("pointerdown", handleUserInteraction);
      window.removeEventListener("click", handleUserInteraction);
    };
  }, [isEnabled, isSupported, requestWakeLock]);

  // 7. Watchdog Heartbeat (Cek berkala setiap 30 detik untuk memastikan layar tetap terkunci menyala)
  useEffect(() => {
    if (!isEnabled || !isSupported) return;

    const interval = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible" &&
        (!wakeLockRef.current || wakeLockRef.current.released)
      ) {
        requestWakeLock();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isEnabled, isSupported, requestWakeLock]);

  // 8. Cleanup saat unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  return (
    <WakeLockContext.Provider
      value={{
        isSupported,
        isActive,
        isEnabled,
        toggleWakeLock,
        requestWakeLock,
        releaseWakeLock,
      }}
    >
      {children}
    </WakeLockContext.Provider>
  );
}

export function useScreenWakeLock() {
  const context = useContext(WakeLockContext);
  if (!context) {
    throw new Error("useScreenWakeLock must be used within a WakeLockProvider");
  }
  return context;
}
