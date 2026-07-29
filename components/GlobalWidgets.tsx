"use client";

import dynamic from "next/dynamic";

const AnnouncementTicker = dynamic(() => import("@/components/AnnouncementTicker"), { ssr: false });
const DirectUserMessageModal = dynamic(() => import("@/components/DirectUserMessageModal"), { ssr: false });
const OfflineSyncManager = dynamic(() => import("@/components/OfflineSyncManager"), { ssr: false });

export default function GlobalWidgets() {
  return (
    <>
      <AnnouncementTicker />
      <DirectUserMessageModal />
      <OfflineSyncManager />
    </>
  );
}
