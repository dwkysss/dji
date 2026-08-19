"use client";

import React, { useState, useEffect } from "react";
import {
  Megaphone,
  Save,
  Sparkles,
  CheckCircle2,
  Power,
  Eye,
  Users,
  Radio,
  FileText,
  Clock,
  Globe,
  Factory,
  ClipboardCheck,
  Scissors,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Info,
  Send,
  User,
  MessageSquare,
  Search,
} from "lucide-react";
import { getAnnouncement, updateAnnouncement, sendDirectUserMessage } from "@/actions/announcement-actions";
import { listAdminUsers } from "@/actions/user-actions";

const PRESET_TEMPLATES = [
  {
    type: "PERHATIAN",
    icon: AlertTriangle,
    color: "text-amber-600",
    text: "PERHATIAN: Diberitahukan kepada seluruh Operator & Staff, Mesin R2 sedang menjalani pemeliharaan rutin.",
  },
  {
    type: "INFO PRODUKSI",
    icon: Info,
    color: "text-blue-600",
    text: "INFO PRODUKSI: Mohon perhatikan kerapian penulisan potongan ke dan nomor order sebelum submit laporan.",
  },
  {
    type: "SHIFT UPDATE",
    icon: Zap,
    color: "text-purple-600",
    text: "SHIFT UPDATE: Pastikan serah terima laporan antar-shift berjalan lancar dan data terisi lengkap.",
  },
  {
    type: "PERHATIAN QC",
    icon: ClipboardCheck,
    color: "text-emerald-600",
    text: "PERHATIAN QC: Harap tingkatkan pengawasan kualitas pada bagian pinggiran dan corak kain.",
  },
  {
    type: "DOWNTIME NOTICE",
    icon: Power,
    color: "text-rose-600",
    text: "DOWNTIME NOTICE: Mesin dalam status perbaikan khusus. Mohon koordinasi dengan tim mekanik.",
  },
];

const PRESET_USER_MESSAGES = [
  "Mohon koordinasi ke meja Admin / Supervisor sekarang.",
  "Harap periksa kembali penulisan nomor order dan potongan ke pada laporan Anda.",
  "Tim QC membutuhkan konfirmasi terkait hasil inspeksi kain terbaru.",
  "Silakan selesaikan laporan downtime sebelum melakukan pergantian shift.",
  "Terima kasih atas laporan presisi yang telah Anda input hari ini!",
];

const FALLBACK_USERS = [
  { id: "op_1", full_name: "Rohmat", role: "operator", employee_id: "OP-001" },
  { id: "op_2", full_name: "Irfan", role: "operator", employee_id: "OP-002" },
  { id: "op_3", full_name: "Tubagus", role: "operator", employee_id: "OP-003" },
  { id: "op_4", full_name: "Komara", role: "operator", employee_id: "OP-004" },
  { id: "qc_1", full_name: "Padlan", role: "qc", employee_id: "QC-001" },
  { id: "qc_2", full_name: "M.Alwi", role: "qc", employee_id: "QC-002" },
  { id: "mending_1", full_name: "Andri Y", role: "mending", employee_id: "MND-001" },
  { id: "admin_1", full_name: "Supervisor Produksi", role: "admin", employee_id: "ADM-001" },
];

export default function AnnouncementsPage() {
  const [activeTab, setActiveTab] = useState<"broadcast" | "direct">("broadcast");

  // Broadcast State
  const [message, setMessage] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(false);
  const [targetRoles, setTargetRoles] = useState<string[]>(["all"]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Direct User Message State
  const [usersList, setUsersList] = useState<any[]>(FALLBACK_USERS);
  const [userSearch, setUserSearch] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [directMessageText, setDirectMessageText] = useState<string>("");
  const [isSendingDm, setIsSendingDm] = useState<boolean>(false);
  const [dmSuccessNotice, setDmSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentAnnouncement();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const res = await listAdminUsers();
    if (res?.success && res?.data && res.data.length > 0) {
      setUsersList(res.data);
    }
  };

  const loadCurrentAnnouncement = async () => {
    let localMsg =
      "PENGUMUMAN PRODUKSI: Pastikan seluruh parameter mesin dan data potongan terisi dengan benar.";
    let localActive = false;
    let localRoles = ["all"];
    let localTime: string | null = null;

    try {
      const saved = localStorage.getItem("dji_app_announcement");
      if (saved) {
        const parsed = JSON.parse(saved);
        localMsg = parsed.message !== undefined ? parsed.message : localMsg;
        localActive = parsed.is_active !== undefined ? !!parsed.is_active : false;
        localRoles = Array.isArray(parsed.target_roles) ? parsed.target_roles : localRoles;
        localTime = parsed.updated_at || null;
      }
    } catch (e) {}

    try {
      const res = await getAnnouncement();
      if (res?.success && res?.data && res.data.message !== undefined) {
        setMessage(res.data.message || localMsg);
        setIsActive(!!res.data.is_active);
        setTargetRoles(Array.isArray(res.data.target_roles) ? res.data.target_roles : localRoles);
        if (res.data.updated_at) setLastUpdated(res.data.updated_at);
      } else {
        setMessage(localMsg);
        setIsActive(localActive);
        setTargetRoles(localRoles);
        if (localTime) setLastUpdated(localTime);
      }
    } catch (err) {
      setMessage(localMsg);
      setIsActive(localActive);
      setTargetRoles(localRoles);
      if (localTime) setLastUpdated(localTime);
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

  const handleToggleActive = async (newActive: boolean) => {
    setIsActive(newActive);
    const nowIso = new Date().toISOString();
    const payload = {
      message: message.trim(),
      is_active: newActive,
      target_roles: targetRoles,
      updated_at: nowIso,
    };

    try {
      localStorage.setItem("dji_app_announcement", JSON.stringify(payload));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("dji_announcement_updated"));
    } catch (e) {}

    try {
      await updateAnnouncement(message, newActive, targetRoles);
    } catch (err) {
      console.warn("Server action error fallback:", err);
    }

    setLastUpdated(nowIso);
    setSuccessNotice(
      newActive
        ? "Running text berhasil DIAKTIFKAN secara langsung!"
        : "Running text berhasil DIMATIKAN secara langsung!"
    );

    setTimeout(() => {
      setSuccessNotice(null);
    }, 3000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessNotice(null);

    const nowIso = new Date().toISOString();
    const payload = {
      message: message.trim(),
      is_active: isActive,
      target_roles: targetRoles,
      updated_at: nowIso,
    };

    try {
      localStorage.setItem("dji_app_announcement", JSON.stringify(payload));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("dji_announcement_updated"));
    } catch (e) {}

    try {
      await updateAnnouncement(message, isActive, targetRoles);
    } catch (err) {
      console.warn("Server action error fallback:", err);
    }

    setIsSaving(false);
    setLastUpdated(nowIso);
    setSuccessNotice("Pengumuman berhasil disiarkan ke pengguna website!");

    setTimeout(() => {
      setSuccessNotice(null);
    }, 4000);
  };

  const handleSendDirectMessage = async () => {
    if (!selectedUser || !directMessageText.trim()) return;

    setIsSendingDm(true);
    setDmSuccessNotice(null);

    const targetId = selectedUser.id || "";
    const targetName = selectedUser.full_name || selectedUser.name || "User";

    const payload = {
      id: "dm_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      target_user_id: targetId,
      target_user_name: targetName,
      sender_name: "Admin",
      message: directMessageText.trim(),
      created_at: new Date().toISOString(),
      is_read: false,
    };

    try {
      localStorage.setItem(`dji_dm_${targetId}`, JSON.stringify(payload));
      localStorage.setItem(`dji_dm_${targetName}`, JSON.stringify(payload));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("dji_direct_message_sent"));
    } catch (e) {}

    try {
      await sendDirectUserMessage(targetId, targetName, directMessageText.trim());
    } catch (e) {}

    setIsSendingDm(false);
    setDmSuccessNotice(`Pesan Pop-up berhasil dikirimkan ke akun ${targetName}!`);
    setDirectMessageText("");

    setTimeout(() => {
      setDmSuccessNotice(null);
    }, 4000);
  };

  const filteredUsers = usersList.filter((u) => {
    const query = userSearch.toLowerCase();
    return (
      (u.full_name || u.name || "").toLowerCase().includes(query) ||
      (u.employee_id || "").toLowerCase().includes(query) ||
      (u.role || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto animate-fadeIn">
      {/* Header Page Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-32 -top-12 w-32 h-32 rounded-full bg-indigo-500/10 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <Megaphone className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight">
                  Pusat Pengumuman & Pesan Akun
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    isActive
                      ? "bg-emerald-500/20 border border-emerald-400/30 text-emerald-300"
                      : "bg-slate-700/50 border border-slate-600 text-slate-400"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isActive ? "bg-emerald-400 animate-ping" : "bg-slate-400"
                    }`}
                  />
                  {isActive ? "LIVE BROADCASTING" : "NONAKTIF"}
                </span>
              </div>
              <p className="text-slate-300 text-xs sm:text-sm font-medium max-w-2xl leading-relaxed">
                Siarkan running text umum ke seluruh website atau kirim pesan notifikasi pop-up khusus ke salah satu akun terdaftar.
              </p>
            </div>
          </div>

          {lastUpdated && (
            <div className="bg-white/10 backdrop-blur-md border border-white/15 px-4 py-2.5 rounded-2xl text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider block flex items-center gap-1 justify-end">
                <Clock className="w-3 h-3 text-amber-400" /> Terakhir Update
              </span>
              <span className="text-xs font-extrabold text-white font-mono">
                {new Date(lastUpdated).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                • {new Date(lastUpdated).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
        </div>

        {/* Tab Mode Switcher */}
        <div className="mt-6 pt-6 border-t border-white/10 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("broadcast")}
            className={`px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "broadcast"
                ? "bg-white text-slate-900 shadow-md"
                : "bg-white/10 hover:bg-white/20 text-slate-300"
            }`}
          >
            <Radio className="w-4 h-4 text-amber-500" />
            <span>Broadcast Running Text</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("direct")}
            className={`px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "direct"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25"
                : "bg-white/10 hover:bg-white/20 text-slate-300"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Pesan Pop-Up Khusus Akun (Direct Message)</span>
          </button>
        </div>
      </div>

      {/* TAB 1: BROADCAST RUNNING TEXT */}
      {activeTab === "broadcast" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Live Preview Ticker Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-700 tracking-wider">
                <Eye className="w-4 h-4 text-sky-600" />
                <span>Simulasi Live Ticker (Tampilan Pengguna)</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                Live Preview
              </span>
            </div>

            {isActive && message ? (
              <div className="w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white rounded-xl py-2.5 px-4 shadow-sm overflow-hidden flex items-center gap-3">
                <div className="flex items-center gap-2 shrink-0 bg-amber-700/80 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-white/20">
                  <Radio className="w-3.5 h-3.5 animate-pulse text-amber-200" />
                  <span>Broadcast</span>
                </div>
                <div className="overflow-hidden whitespace-nowrap flex-1 text-xs font-bold">
                  <div className="inline-block animate-marquee">{message}</div>
                </div>
              </div>
            ) : (
              <div className="w-full bg-slate-100 border border-slate-200 rounded-xl py-3 px-4 text-center text-xs font-semibold text-slate-400 italic">
                (Pengumuman sedang dinonaktifkan atau pesan kosong — tidak akan tampil di aplikasi)
              </div>
            )}
          </div>

          {/* Main Form Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Status & Target Roles */}
            <div className="space-y-6">
              {/* Card 1: Toggle Status */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isActive ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                    <Power className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                      Status Pengumuman
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Aktifkan/Matikan Running Text
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {isActive ? "Running Text Aktif" : "Running Text Mati"}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      {isActive ? "Pengumuman disiarkan" : "Sembunyikan ticker"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(!isActive)}
                    className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isActive ? "bg-emerald-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isActive ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Card 2: Target Audience / Roles */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                      Target Penerima
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Pilih role yang melihat pengumuman
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {[
                    { key: "all", label: "Semua Akun (Public Broadcast)", desc: "Tampil untuk semua pengguna", icon: Globe },
                    { key: "operator", label: "Operator Knitting", desc: "Form Input & Status Mesin", icon: Factory },
                    { key: "qc", label: "QC & Inspeksi", desc: "Halaman QC Inspection", icon: ClipboardCheck },
                    { key: "mending", label: "Mending", desc: "Halaman Hasil Akhir Pengerjaan Mending", icon: Scissors },
                    { key: "admin", label: "Admin / Manager", desc: "Dashboard & Laporan", icon: ShieldCheck },
                  ].map((role) => {
                    const isSelected = targetRoles.includes(role.key);
                    const IconComponent = role.icon;
                    return (
                      <button
                        key={role.key}
                        type="button"
                        onClick={() => toggleTargetRole(role.key)}
                        className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <IconComponent className={`w-4 h-4 shrink-0 ${isSelected ? "text-indigo-600" : "text-slate-400"}`} />
                          <div>
                            <span className="text-xs font-extrabold block">{role.label}</span>
                            <span className="text-[10px] text-slate-500 block">{role.desc}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Message Content & Preset Templates */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card 3: Pesan Input */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                        Isi Pesan Broadcast
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Tuliskan pesan yang akan disiarkan
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                    {message.length} Karakter
                  </span>
                </div>

                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ketik teks pengumuman penting di sini..."
                  className="w-full p-4 rounded-2xl border border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-sm font-medium outline-none transition-all shadow-xs resize-none bg-slate-50/50 focus:bg-white leading-relaxed"
                />

                {/* Template Pesan Cepat */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Pilih Template Pesan Cepat:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PRESET_TEMPLATES.map((tmpl, idx) => {
                      const IconComp = tmpl.icon;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setMessage(tmpl.text);
                            setIsActive(true);
                          }}
                          className="text-left p-3 bg-slate-50 hover:bg-amber-50/80 border border-slate-200 hover:border-amber-300 rounded-2xl text-xs text-slate-700 font-medium transition-all duration-150 cursor-pointer active:scale-[0.98] flex items-start gap-2.5 leading-relaxed"
                        >
                          <IconComp className={`w-4 h-4 shrink-0 mt-0.5 ${tmpl.color}`} />
                          <span className="line-clamp-2">{tmpl.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Footer Button & Feedback Notice */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {successNotice ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>{successNotice}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 font-medium">
                      Pastikan isi pesan sudah benar sebelum menekan tombol simpan & siarkan.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isSaving || !message.trim()}
                  onClick={handleSave}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-black tracking-wide transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-600/25 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Save className="w-5 h-5" />
                  <span>{isSaving ? "Menyimpan & Menyiarkan..." : "Simpan & Siarkan Pengumuman"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DIRECT USER MESSAGE (PESAN KHUSUS SALAH SATU AKUN) */}
      {activeTab === "direct" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Left Column: User Selector */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                    Pilih Akun Tujuan
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Pilih satu akun terdaftar
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-slate-100 px-2.5 py-1 rounded-full text-slate-500">
                {filteredUsers.length} Akun
              </span>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Cari nama atau NIK/Employee ID..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all bg-slate-50/50"
              />
            </div>

            {/* User List Scrollable */}
            <div className="flex-1 max-h-[380px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredUsers.map((u) => {
                const name = u.full_name || u.name || "Tanpa Nama";
                const isSelected = selectedUser?.id === u.id;
                const roleUpper = (u.role || "OPERATOR").toUpperCase();

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUser(u)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-amber-500 border-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20 scale-[1.01]"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected
                            ? "bg-slate-950 text-white"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-black leading-tight">{name}</p>
                        <p className={`text-[10px] font-medium mt-0.5 ${isSelected ? "text-slate-900" : "text-slate-400"}`}>
                          {u.employee_id || "-"} • {roleUpper}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-slate-950 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Direct Message Composer */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                      Kirim Pesan Pop-Up Khusus
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Pesan akan langsung muncul di tengah layar akun tujuan
                    </p>
                  </div>
                </div>

                {selectedUser ? (
                  <div className="bg-amber-100 border border-amber-300 text-amber-900 px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-700" />
                    <span>Target: {selectedUser.full_name || selectedUser.name}</span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 animate-pulse">
                    ⚠️ Silakan Pilih Akun Tujuan di Kiri
                  </span>
                )}
              </div>

              {/* Textarea */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Isi Pesan Notifikasi Pop-up
                </label>
                <textarea
                  rows={4}
                  disabled={!selectedUser}
                  value={directMessageText}
                  onChange={(e) => setDirectMessageText(e.target.value)}
                  placeholder={
                    selectedUser
                      ? `Tulis pesan khusus yang akan langsung muncul di layar ${selectedUser.full_name || selectedUser.name}...`
                      : "Pilih salah satu akun terdaftar di kolom kiri terlebih dahulu..."
                  }
                  className="w-full p-4 rounded-2xl border border-slate-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 text-sm font-medium outline-none transition-all shadow-xs resize-none bg-slate-50/50 focus:bg-white leading-relaxed disabled:opacity-50"
                />
              </div>

              {/* Quick User Message Templates */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Template Pesan Cepat untuk Akun:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRESET_USER_MESSAGES.map((msgText, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={!selectedUser}
                      onClick={() => setDirectMessageText(msgText)}
                      className="text-left p-3 bg-slate-50 hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-300 rounded-2xl text-xs text-slate-700 font-medium transition-all duration-150 cursor-pointer active:scale-[0.98] flex items-start gap-2 leading-relaxed disabled:opacity-50"
                    >
                      <span className="shrink-0 text-indigo-600 font-bold">•</span>
                      <span className="line-clamp-2">{msgText}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button & Notice */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                {dmSuccessNotice ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{dmSuccessNotice}</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-medium">
                    Pop-up notifikasi akan langsung aktif di layar HP/Tablet akun yang dipilih.
                  </p>
                )}

                <button
                  type="button"
                  disabled={isSendingDm || !selectedUser || !directMessageText.trim()}
                  onClick={handleSendDirectMessage}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-sm font-black tracking-wide transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/25 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Send className="w-5 h-5" />
                  <span>
                    {isSendingDm
                      ? "Mengirimkan Pesan..."
                      : `Kirim Pop-Up ke ${selectedUser ? selectedUser.full_name || selectedUser.name : "Akun"}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
