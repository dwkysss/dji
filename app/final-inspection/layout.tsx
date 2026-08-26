"use client";

import React from "react";
import Sidebar from "@/components/layout/Sidebar";

export default function FinalInspectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-slate-800 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-28 pt-16 md:pt-0">
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
