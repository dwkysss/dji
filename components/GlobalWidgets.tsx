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
    // Bersihkan service worker PWA lama di browser klien agar tidak menyisakan cache basi
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
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

