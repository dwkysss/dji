"use client";

import React, { useEffect, useState } from "react";
import { Megaphone, X, Pause, Play } from "lucide-react";
import { getAnnouncement } from "@/actions/announcement-actions";
import { createClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";

export default function AnnouncementTicker() {
  const [message, setMessage] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(false);
  const [targetRoles, setTargetRoles] = useState<string[]>(["all"]);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const pathname = usePathname();

  const fetchAnnouncement = async () => {
    let localMsg = "";
    let localActive = false;
    let localRoles = ["all"];
    try {
      const saved = localStorage.getItem("dji_app_announcement");
      if (saved) {
        const parsed = JSON.parse(saved);
        localMsg = parsed.message !== undefined ? parsed.message : localMsg;
        localActive = parsed.is_active !== undefined ? !!parsed.is_active : false;
        localRoles = Array.isArray(parsed.target_roles) ? parsed.target_roles : localRoles;
      }
    } catch (e) {}

    if (typeof window !== "undefined" && !navigator.onLine) {
      setMessage(localMsg);
      setIsActive(localActive);
      setTargetRoles(localRoles);
      return;
    }

    try {
      const res = await getAnnouncement();
      if (res?.success && res?.data && res.data.message !== undefined) {
        setMessage(res.data.message || "");
        setIsActive(!!res.data.is_active);
        setTargetRoles(Array.isArray(res.data.target_roles) ? res.data.target_roles : localRoles);
      } else {
        setMessage(localMsg);
        setIsActive(localActive);
        setTargetRoles(localRoles);
      }
    } catch (err) {
      setMessage(localMsg);
      setIsActive(localActive);
      setTargetRoles(localRoles);
    }
  };

  useEffect(() => {
    fetchAnnouncement();

    // 1. Supabase Realtime Subscription for Instant Multi-Tablet Live Update
    let channel: any = null;
    try {
      const supabase = createClient();
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
        channel = supabase
          .channel("realtime:app_announcements")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "app_announcements" },
            (payload: any) => {
              if (payload.new) {
                setMessage(payload.new.message || "");
                setIsActive(!!payload.new.is_active);
                setTargetRoles(Array.isArray(payload.new.target_roles) ? payload.new.target_roles : ["all"]);
              }
            }
          )
          .subscribe();
      }
    } catch (e) {}

    // 2. Tab Focus Listener
    const handleFocus = () => {
      fetchAnnouncement();
    };

    const interval = setInterval(() => {
      fetchAnnouncement();
    }, 60000); // 60s fallback check

    // 3. Local Event Listeners
    const handleSync = () => {
      fetchAnnouncement();
    };

    window.addEventListener("storage", handleSync);
    window.addEventListener("dji_announcement_updated", handleSync);
    window.addEventListener("focus", handleFocus);

    return () => {
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch (e) {}
      }
      clearInterval(interval);
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("dji_announcement_updated", handleSync);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Determine if current page/role matches target_roles
  const isTargeted = () => {
    if (!targetRoles || targetRoles.includes("all")) return true;

    const currentPath = pathname || "";
    if (targetRoles.includes("qc") || targetRoles.includes("inspeksi")) {
      if (currentPath.startsWith("/qc")) return true;
    }
    if (targetRoles.includes("operator") || targetRoles.includes("employee")) {
      if (currentPath.startsWith("/employee") || currentPath === "/") return true;
    }
    if (targetRoles.includes("mending")) {
      if (currentPath.includes("mending") || currentPath.startsWith("/mending")) return true;
    }
    if (targetRoles.includes("admin") || targetRoles.includes("manager")) {
      if (!currentPath.startsWith("/qc") && !currentPath.startsWith("/employee")) return true;
    }

    return false;
  };

  if (!isActive || !message || isDismissed || !isTargeted()) {
    return null;
  }

  return (
    <div className="w-full bg-gradient-to-r from-[#002b4d] via-[#004777] to-[#003359] text-white border-b border-sky-400/30 shrink-0 relative z-[9999] shadow-md select-none">
      <div className="max-w-7xl mx-auto flex items-center h-11 px-3 sm:px-4 text-xs">
        {/* Badge Indicator */}
        <div className="flex items-center gap-1.5 bg-gradient-to-r from-sky-400 to-blue-500 text-slate-950 font-black px-2.5 py-1 rounded-md shrink-0 shadow-sm mr-3 tracking-wide uppercase text-[10px]">
          <Megaphone className="w-3.5 h-3.5 animate-bounce text-slate-950" />
          <span className="hidden sm:inline">PENGUMUMAN</span>
        </div>

        {/* Marquee Running Text Container (Tap/Click to Pause for Tablet Touchscreens) */}
        <div
          onClick={() => setIsPaused(!isPaused)}
          className="flex-1 overflow-hidden relative flex items-center h-full cursor-pointer group"
          title="Ketuk untuk menjeda/melanjutkan teks"
        >
          <div
            className={`font-semibold tracking-wide text-white drop-shadow-xs text-xs sm:text-sm whitespace-nowrap ${
              isPaused ? "" : "animate-marquee"
            }`}
            style={{ animationPlayState: isPaused ? "paused" : "running" }}
          >
            {message} &nbsp;&nbsp;&nbsp;&nbsp;•••&nbsp;&nbsp;&nbsp;&nbsp; {message}
          </div>
        </div>

        {/* Action Buttons for Tablet (Pause/Play + Dismiss) */}
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className="p-2 sm:p-1.5 hover:bg-white/15 active:bg-white/25 rounded-md text-sky-200 hover:text-white transition-colors cursor-pointer"
            title={isPaused ? "Lanjutkan Teks" : "Jeda Teks"}
          >
            {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-2 sm:p-1.5 hover:bg-white/15 active:bg-white/25 rounded-md text-sky-200 hover:text-white transition-colors cursor-pointer"
            title="Sembunyikan Pengumuman"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
