"use client";

import React from "react";
import Sidebar from "@/components/layout/Sidebar";

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-28 pt-16 md:pt-0">
        <main className="flex-1 p-3.5 sm:p-5 md:p-8 max-w-7xl w-full min-w-0 mx-auto flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
