"use client";

import React from "react";
import Sidebar from "@/components/layout/Sidebar";
import AutoSyncScheduler from "@/components/AutoSyncScheduler";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-slate-800 flex flex-col lg:flex-row">
      {/* Background Auto-Sync Scheduler for Real-time Execution */}
      <AutoSyncScheduler />

      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-28 pt-16 md:pt-0 min-w-0 overflow-hidden">
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto flex flex-col min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
