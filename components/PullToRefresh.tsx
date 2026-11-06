"use client";

import React, { useState, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";

const PULL_THRESHOLD = 65; // Jarak tarikan (px) untuk memicu refresh
const MAX_PULL = 95; // Batas maksimal tarikan visual

export default function PullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  // FIX: Gunakan ref untuk state reaktif agar effect tidak re-run & pasang ulang listeners setiap render
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    // Hanya aktif di environment browser
    if (typeof window === "undefined") return;

    const handleTouchStart = (e: TouchEvent) => {
      // Hanya aktif jika layar benar-benar di posisi paling atas
      if (window.scrollY > 5 || isRefreshingRef.current) return;

      // Jangan aktif jika pengguna sedang fokus mengetik di input/textarea
      const activeEl = document.activeElement?.tagName;
      if (activeEl === "INPUT" || activeEl === "TEXTAREA" || activeEl === "SELECT") {
        return;
      }

      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      isDraggingRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || startXRef.current === null || isRefreshingRef.current) return;

      // Jika pengguna sudah scroll ke bawah saat drag, batalkan
      if (window.scrollY > 0) {
        startYRef.current = null;
        startXRef.current = null;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const diffY = currentY - startYRef.current;
      const diffX = currentX - startXRef.current;

      // Abaikan jika gerakan lebih dominan horizontal (misal geser chart/tab)
      if (Math.abs(diffX) > Math.abs(diffY)) {
        return;
      }

      if (diffY > 0) {
        // Redam tarikan menggunakan efek kurva karet (rubber-band)
        const damped = Math.min(Math.pow(diffY, 0.85) * 1.5, MAX_PULL);
        pullDistanceRef.current = damped;
        setPullDistance(damped);
        isDraggingRef.current = true;

        // Cegah scroll bawaan browser saat user sengaja menarik untuk refresh
        if (damped > 15 && e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = () => {
      if (startYRef.current === null) return;

      if (pullDistanceRef.current >= PULL_THRESHOLD && !isRefreshingRef.current) {
        // Kunci posisi spinner saat proses reload
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        pullDistanceRef.current = 55;
        setPullDistance(55);

        // Beri getaran haptic halus di HP jika didukung
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(20);
          } catch (_) {}
        }

        // Jalankan reload halaman
        setTimeout(() => {
          window.location.reload();
        }, 350);
      } else {
        // Kembalikan ke posisi tersembunyi dengan animasi
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }

      startYRef.current = null;
      startXRef.current = null;
      isDraggingRef.current = false;
    };

    // FIX: dependency array [] — listeners hanya dipasang SEKALI, tidak re-run setiap render
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []); // ← FIX KRITIS: Hanya mount sekali, tidak re-run

  // Sync state ke ref agar closure di dalam effect selalu pakai nilai terbaru
  useEffect(() => { pullDistanceRef.current = pullDistance; }, [pullDistance]);
  useEffect(() => { isRefreshingRef.current = isRefreshing; }, [isRefreshing]);

  if (pullDistance === 0 && !isRefreshing) return null;

  const isReady = pullDistance >= PULL_THRESHOLD;
  const rotationAngle = isRefreshing ? 0 : (pullDistance / PULL_THRESHOLD) * 360;

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[9999] flex justify-center pointer-events-none transition-transform duration-150 ease-out"
      style={{
        transform: `translateY(${Math.max(pullDistance - 50, 10)}px)`,
      }}
    >
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-xl backdrop-blur-md transition-all duration-200 ${
          isReady || isRefreshing
            ? "bg-[#0070bc] text-white border-sky-400 shadow-sky-500/20 scale-105"
            : "bg-white/95 text-slate-700 border-slate-200/90 shadow-slate-900/10"
        }`}
      >
        <RefreshCw
          className={`w-4 h-4 transition-transform duration-100 ${
            isRefreshing ? "animate-spin" : ""
          }`}
          style={{
            transform: isRefreshing ? undefined : `rotate(${rotationAngle}deg)`,
          }}
        />
        <span className="text-xs font-bold tracking-tight">
          {isRefreshing
            ? "Memuat ulang..."
            : isReady
              ? "Lepaskan untuk refresh"
              : "Tarik untuk refresh"}
        </span>
      </div>
    </div>
  );
}
