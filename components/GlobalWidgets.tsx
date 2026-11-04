"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";

const AnnouncementTicker = dynamic(() => import("@/components/AnnouncementTicker"), { ssr: false });
const DirectUserMessageModal = dynamic(() => import("@/components/DirectUserMessageModal"), { ssr: false });
const OfflineSyncManager = dynamic(() => import("@/components/OfflineSyncManager"), { ssr: false });
const PullToRefresh = dynamic(() => import("@/components/PullToRefresh"), { ssr: false });
const AppUpdateChecker = dynamic(() => import("@/components/AppUpdateChecker"), { ssr: false });

export default function GlobalWidgets() {
  useEffect(() => {
    // Daftarkan service worker resmi untuk caching offline darurat (mencegah layar dinosaurus saat offline)
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          if (reg) reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn("[SW] Registration deferred:", err);
        });

      // Warm-up cache untuk form offline saat online
      if ("caches" in window && navigator.onLine) {
        caches
          .open("dji-offline-v41")
          .then((cache) => {
            cache.add("/offline.html").catch(() => {});
          })
          .catch(() => {});
      }
    }
  }, []);

  return (
    <>
      <PullToRefresh />
      <AnnouncementTicker />
      <DirectUserMessageModal />
      <OfflineSyncManager />
      <AppUpdateChecker />
    </>
  );
}
