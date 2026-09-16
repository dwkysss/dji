"use client";

import dynamic from "next/dynamic";

const AnnouncementTicker = dynamic(() => import("@/components/AnnouncementTicker"), { ssr: false });
const DirectUserMessageModal = dynamic(() => import("@/components/DirectUserMessageModal"), { ssr: false });
const OfflineSyncManager = dynamic(() => import("@/components/OfflineSyncManager"), { ssr: false });
const GlobalWifiIndicator = dynamic(() => import("@/components/GlobalWifiIndicator"), { ssr: false });
const PwaInstallPrompt = dynamic(() => import("@/components/PwaInstallPrompt"), { ssr: false });

export default function GlobalWidgets() {
  return (
    <>
      <AnnouncementTicker />
      <DirectUserMessageModal />
      <OfflineSyncManager />
      <PwaInstallPrompt />
    </>
  );
}
