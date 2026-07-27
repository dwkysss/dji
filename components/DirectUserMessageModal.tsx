"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  ShieldAlert,
  X,
  User,
  Clock,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchUnreadDirectUserMessage,
  markDirectUserMessageRead,
  DirectUserMessage,
} from "@/actions/announcement-actions";
import { createClient } from "@/lib/supabase/client";

export default function DirectUserMessageModal() {
  const { user } = useAuth();
  const [activeMessage, setActiveMessage] = useState<DirectUserMessage | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const checkUnreadMessages = async () => {
    if (!user) return;

    const userId = user.id || "";
    const userName = user.fullName || "";
    const employeeId = user.employeeId || "";

    try {
      const localDm =
        localStorage.getItem(`dji_dm_${userId}`) ||
        localStorage.getItem(`dji_dm_${userName}`) ||
        localStorage.getItem(`dji_dm_${employeeId}`);
      if (localDm) {
        const parsed: DirectUserMessage = JSON.parse(localDm);
        if (!parsed.is_read) {
          setActiveMessage(parsed);
          setIsOpen(true);
          return;
        }
      }
    } catch (e) {}

    const res = await fetchUnreadDirectUserMessage(userId, userName, employeeId);
    if (res?.success && res?.data) {
      setActiveMessage(res.data);
      setIsOpen(true);
    }
  };

  useEffect(() => {
    if (!user) return;

    checkUnreadMessages();

    const interval = setInterval(() => {
      checkUnreadMessages();
    }, 60000); // Diubah dari 5 detik menjadi 60 detik sebagai fallback (Realtime sudah aktif)

    const handleSync = () => checkUnreadMessages();
    window.addEventListener("storage", handleSync);
    window.addEventListener("dji_direct_message_sent", handleSync);

    let channel: any = null;
    try {
      const supabase = createClient();
      if (
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
      ) {
        channel = supabase
          .channel("realtime:app_direct_messages")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "app_direct_messages" },
            (payload: any) => {
              if (payload.new) {
                const dm: DirectUserMessage = payload.new;
                const matchId = user.id && dm.target_user_id === user.id;
                const matchEmpId = user.employeeId && (dm.target_user_id === user.employeeId || dm.target_user_name === user.employeeId);
                const matchName =
                  user.fullName &&
                  dm.target_user_name
                    ?.toLowerCase()
                    .includes(user.fullName.toLowerCase());
                if ((matchId || matchEmpId || matchName) && !dm.is_read) {
                  setActiveMessage(dm);
                  setIsOpen(true);
                }
              }
            }
          )
          .subscribe();
      }
    } catch (e) {}

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("dji_direct_message_sent", handleSync);
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch (e) {}
      }
    };
  }, [user]);

  const handleDismiss = async () => {
    if (!activeMessage || !user) {
      setIsOpen(false);
      return;
    }

    const msgId = activeMessage.id;

    try {
      const userId = user.id || "";
      const userName = user.fullName || "";
      const readPayload = { ...activeMessage, is_read: true };
      localStorage.setItem(`dji_dm_${userId}`, JSON.stringify(readPayload));
      localStorage.setItem(`dji_dm_${userName}`, JSON.stringify(readPayload));
    } catch (e) {}

    setIsOpen(false);
    setActiveMessage(null);

    await markDirectUserMessageRead(msgId);
  };

  if (!isOpen || !activeMessage) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn select-none">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-scaleIn">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">Pesan dari Admin</h3>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Penting
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeMessage.sender_name || "Admin / Supervisor"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Recipient & time row */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Untuk:{" "}
                <span className="font-semibold text-slate-700">
                  {activeMessage.target_user_name || "Anda"}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono text-xs">
                {activeMessage.created_at
                  ? new Date(activeMessage.created_at).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Baru saja"}
              </span>
            </div>
          </div>

          {/* Message content */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-line">
              {activeMessage.message}
            </p>
          </div>

          {/* Info notice */}
          <div className="flex items-start gap-2.5 text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>Harap baca dan tindak lanjuti pesan ini jika diperlukan.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-slate-300" />
            <span>Saya Mengerti &amp; Tutup</span>
          </button>
        </div>
      </div>
    </div>
  );
}
