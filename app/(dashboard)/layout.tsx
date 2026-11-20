"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import AutoSyncScheduler from "@/components/AutoSyncScheduler";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);

  useEffect(() => {
    try {
      setIsSidebarPinned(localStorage.getItem("dji_sidebar_pinned") === "true");
    } catch {}

    const handlePinChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setIsSidebarPinned(Boolean(customEvent.detail));
    };

    window.addEventListener("dji:sidebar-pin-change", handlePinChange);
    return () => {
      window.removeEventListener("dji:sidebar-pin-change", handlePinChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] text-slate-800 flex flex-col lg:flex-row">
      {/* Background Auto-Sync Scheduler for Real-time Execution */}
      <AutoSyncScheduler />

      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col pt-16 md:pt-0 min-w-0 overflow-hidden transition-[padding] duration-300 ease-in-out ${
          isSidebarPinned ? "md:pl-72" : "md:pl-28"
        }`}
      >
        <main className="flex-1 p-3.5 sm:p-5 md:p-8 max-w-7xl w-full mx-auto flex flex-col min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
