"use client";

import React, { useState, useEffect } from "react";
import { Megaphone, Save, X, Sparkles, AlertTriangle, CheckCircle2, Power } from "lucide-react";
import { getAnnouncement, updateAnnouncement } from "@/actions/announcement-actions";

interface AnnouncementAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_TEMPLATES = [
  "⚠️ PERHATIAN: Diberitahukan kepada seluruh Operator & Staff, Mesin R2 sedang menjalani pemeliharaan rutin.",
  "📢 INFO PRODUKSI: Mohon perhatikan kerapian penulisan potongan ke dan nomor order sebelum submit laporan.",
  "⚡ SHIFT UPDATE: Pastikan serah terima laporan antar-shift berjalan lancar dan data terisi lengkap.",
  "🔍 PERHATIAN QC: Harap tingkatkan pengawasan kualitas pada bagian pinggiran dan corak kain.",
];

export default function AnnouncementAdminModal({ isOpen, onClose }: AnnouncementAdminModalProps) {
  const [message, setMessage] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(false);
  const [targetRoles, setTargetRoles] = useState<string[]>(["all"]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCurrentAnnouncement();
    }
  }, [isOpen]);

  const loadCurrentAnnouncement = async () => {
    let localMsg = "📢 PENGUMUMAN PRODUKSI: Pastikan seluruh parameter mesin dan data potongan terisi dengan benar.";
    let localActive = true;
    let localRoles = ["all"];
    try {
      const saved = localStorage.getItem("dji_app_announcement");
      if (saved) {
        const parsed = JSON.parse(saved);
        localMsg = parsed.message !== undefined ? parsed.message : localMsg;
        localActive = parsed.is_active !== undefined ? !!parsed.is_active : true;
        localRoles = Array.isArray(parsed.target_roles) ? parsed.target_roles : localRoles;
      }
    } catch (e) { }

    const res = await getAnnouncement();
    if (res?.success && res?.data && res.data.updated_at) {
      setMessage(res.data.message || localMsg);
      setIsActive(res.data.is_active !== undefined ? res.data.is_active : localActive);
      setTargetRoles(Array.isArray(res.data.target_roles) ? res.data.target_roles : localRoles);
    } else {
      setMessage(localMsg);
      setIsActive(localActive);
      setTargetRoles(localRoles);
    }
  };


  const toggleTargetRole = (roleKey: string) => {
    if (roleKey === "all") {
      setTargetRoles(["all"]);
      return;
    }

    let newRoles = targetRoles.filter((r) => r !== "all");
    if (newRoles.includes(roleKey)) {
      newRoles = newRoles.filter((r) => r !== roleKey);
    } else {
      newRoles.push(roleKey);
    }

    if (newRoles.length === 0) {
      newRoles = ["all"];
    }
    setTargetRoles(newRoles);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessNotice(null);

    const payload = {
      message: message.trim(),
      is_active: isActive,
      target_roles: targetRoles,
      updated_at: new Date().toISOString(),
    };

    try {
      localStorage.setItem("dji_app_announcement", JSON.stringify(payload));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("dji_announcement_updated"));
    } catch (e) { }

    await updateAnnouncement(message, isActive, targetRoles);

    setIsSaving(false);
    setSuccessNotice("Pengumuman berhasil diperbarui dan disiarkan!");
    setTimeout(() => {
      setSuccessNotice(null);
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Atur Pengumuman / Running Text</h3>
              <p className="text-xs text-slate-300">Siarkan pesan berjalan ke seluruh pengguna website</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 flex-1">
          {/* Status Active Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isActive ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"}`}>
                <Power className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">Status Pengumuman</p>
                <p className="text-xs text-slate-500">
                  {isActive ? "Tampilkan running text di atas web" : "Sembunyikan running text"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isActive ? "bg-emerald-600" : "bg-slate-300"
                }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isActive ? "translate-x-5" : "translate-x-0"
                  }`}
              />
            </button>
          </div>

          {/* Target Audience / Role Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Target Penerima Pengumuman
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "all", label: "🌐 Semua Akun" },
                { key: "operator", label: "🧶 Operator Knitting" },
                { key: "qc", label: "🔍 QC & Inspeksi" },
                { key: "mending", label: "🧵 Mending" },
                { key: "admin", label: "👑 Admin / Manager" },
              ].map((role) => {
                const isSelected = targetRoles.includes(role.key);
                return (
                  <button
                    key={role.key}
                    type="button"
                    onClick={() => toggleTargetRole(role.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                  >
                    {role.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              {targetRoles.includes("all")
                ? "Pesan akan tampil untuk seluruh pengguna di semua halaman."
                : `Pesan hanya akan tampil untuk role: ${targetRoles.join(", ").toUpperCase()}`}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Isi Pesan Pengumuman</span>
              <span className="text-[10px] text-slate-400 font-normal">{message.length} karakter</span>
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Masukkan teks pengumuman yang akan berjalan di bagian atas website..."
              className="w-full p-3.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-xs sm:text-sm font-medium outline-none transition-all shadow-xs resize-none bg-slate-50/50 focus:bg-white"
            />
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Template Pesan Cepat:</span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {PRESET_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setMessage(tmpl);
                    setIsActive(true);
                  }}
                  className="w-full text-left p-2.5 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-lg text-xs text-slate-700 font-medium transition-all duration-150 line-clamp-2 cursor-pointer active:scale-[0.99]"
                >
                  {tmpl}
                </button>
              ))}
            </div>
          </div>

          {/* Alert feedback */}
          {successNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Menyimpan..." : "Simpan & Siarkan"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
