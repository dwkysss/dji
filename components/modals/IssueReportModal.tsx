"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Send,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  MessageSquareWarning,
  Trash2,
} from "lucide-react";
import {
  createIssueReport,
  fetchIssueReports,
  updateIssueReportStatus,
  deleteIssueReport,
  IssueReportItem,
} from "@/actions/issue-report-actions";
import { useAuth } from "@/lib/auth-context";

interface IssueReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  nomorMc?: string;
  potonganKe?: number | string;
  groupName?: string;
  panelOrMeter?: string;
  currentOperator?: string;
  isDark?: boolean;
}

export default function IssueReportModal({
  isOpen,
  onClose,
  nomorMc = "",
  potonganKe = "",
  groupName = "",
  panelOrMeter = "",
  currentOperator = "",
  isDark = false,
}: IssueReportModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"form" | "list">("form");

  // Form states - Tulis manual saja, header otomatis
  const [keterangan, setKeterangan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // List & status states
  const [reports, setReports] = useState<IssueReportItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "RESOLVED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Resolving action states
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNoteInput, setResolutionNoteInput] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const activeSender = currentOperator || user?.fullName || "Operator";
  const activeGroup = groupName || "A";
  const activeMc = (nomorMc || "R1").toUpperCase();
  const activePotongan = potonganKe ? String(potonganKe) : "1";

  const loadReports = useCallback(async () => {
    setIsLoadingList(true);
    try {
      // 1. Ambil laporan dari server
      const res = await fetchIssueReports();
      let serverData = res.success ? res.data : [];

      // 2. Gabungkan dengan antrean offline jika ada
      try {
        const rawOffline = localStorage.getItem("dji_offline_issue_reports");
        if (rawOffline) {
          const offlineList: IssueReportItem[] = JSON.parse(rawOffline);
          const offlineIds = new Set(serverData.map((s) => s.id));
          const uniqueOffline = offlineList.filter((o) => !offlineIds.has(o.id));
          serverData = [...uniqueOffline, ...serverData];
        }
      } catch (e) {}

      setReports(serverData);
    } catch (err) {
      console.warn("[IssueReportModal] Gagal memuat daftar laporan:", err);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadReports();
    }
  }, [isOpen, loadReports]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keterangan.trim()) {
      alert("Mohon tuliskan laporan atau kendala yang dialami.");
      return;
    }

    setIsSubmitting(true);
    const payload = {
      category: "KESALAHAN_INPUT" as const,
      nomorMc: activeMc,
      potonganKe: activePotongan ? Number(activePotongan) : null,
      groupName: activeGroup,
      panelOrMeter: panelOrMeter.trim() || null,
      keterangan: keterangan.trim(),
      senderName: activeSender,
      senderUserId: user?.id || null,
    };

    // Mode Offline Fallback
    if (typeof window !== "undefined" && !navigator.onLine) {
      const offlineItem: IssueReportItem = {
        id: "offline_rep_" + Date.now(),
        ...payload,
        status: "PENDING",
        resolutionNotes: "[Antrean Offline - Akan dikirim otomatis saat online]",
        createdAt: new Date().toISOString(),
      };
      try {
        const raw = localStorage.getItem("dji_offline_issue_reports");
        const list = raw ? JSON.parse(raw) : [];
        list.unshift(offlineItem);
        localStorage.setItem("dji_offline_issue_reports", JSON.stringify(list));
      } catch (err) {}

      setReports((prev) => [offlineItem, ...prev]);
      setSubmitSuccess(true);
      setIsSubmitting(false);
      setTimeout(() => {
        setSubmitSuccess(false);
        setKeterangan("");
        setActiveTab("list");
      }, 1000);
      return;
    }

    try {
      const res = await createIssueReport(payload);
      if (res.success && res.data) {
        setReports((prev) => [res.data!, ...prev]);
        setSubmitSuccess(true);
        setTimeout(() => {
          setSubmitSuccess(false);
          setKeterangan("");
          setActiveTab("list");
        }, 1000);
      } else {
        alert("Gagal mengirim laporan: " + (res.error || "Kesalahan jaringan"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkResolved = async (reportId: string) => {
    setIsUpdatingStatus(true);
    const resolver = activeSender || user?.fullName || "Admin / QC";
    const note = resolutionNoteInput.trim() || "Telah diperiksa dan dikoreksi.";

    try {
      const res = await updateIssueReportStatus(reportId, "RESOLVED", note, resolver);
      if (res.success) {
        setReports((prev) =>
          prev.map((r) =>
            r.id === reportId
              ? {
                  ...r,
                  status: "RESOLVED",
                  resolutionNotes: note,
                  resolvedBy: resolver,
                  resolvedAt: new Date().toISOString(),
                }
              : r
          )
        );
        setResolvingId(null);
        setResolutionNoteInput("");
      } else {
        alert("Gagal update status: " + (res.error || "Error"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleReopen = async (reportId: string) => {
    setIsUpdatingStatus(true);
    try {
      const res = await updateIssueReportStatus(reportId, "PENDING", "", "");
      if (res.success) {
        setReports((prev) =>
          prev.map((r) =>
            r.id === reportId
              ? {
                  ...r,
                  status: "PENDING",
                  resolutionNotes: "",
                  resolvedBy: "",
                  resolvedAt: null,
                }
              : r
          )
        );
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm("Hapus laporan ini secara permanen?")) return;
    try {
      const res = await deleteIssueReport(reportId);
      if (res.success) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  if (!isOpen) return null;

  const pendingCount = reports.filter((r) => r.status === "PENDING").length;

  const filteredReports = reports.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.nomorMc?.toLowerCase().includes(q) ||
      String(r.potonganKe || "").toLowerCase().includes(q) ||
      r.groupName?.toLowerCase().includes(q) ||
      (r.panelOrMeter || "").toLowerCase().includes(q) ||
      r.keterangan?.toLowerCase().includes(q) ||
      r.senderName?.toLowerCase().includes(q) ||
      (r.resolutionNotes || "").toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border transition-all ${
          isDark
            ? "bg-slate-900 border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-800"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div
          className={`p-4 sm:p-5 flex items-center justify-between border-b shrink-0 ${
            isDark ? "bg-slate-850 border-slate-800" : "bg-slate-50/80 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <MessageSquareWarning className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                Lapor Kendala / Kesalahan Input
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-none mt-1">
                Tuliskan kendala secara manual — nomor mesin, potongan, operator & group terisi otomatis
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          className={`px-4 sm:px-6 pt-3 flex items-center justify-between border-b gap-3 shrink-0 ${
            isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("form")}
              className={`px-3.5 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "form"
                  ? isDark
                    ? "border-amber-400 text-amber-300 bg-amber-500/10"
                    : "border-amber-600 text-amber-800 bg-amber-50/80"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Buat Laporan Baru</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className={`px-3.5 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "list"
                  ? isDark
                    ? "border-blue-400 text-blue-300 bg-blue-500/10"
                    : "border-[#0070bc] text-[#0070bc] bg-sky-50/80"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Daftar Laporan</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>

          {activeTab === "list" && (
            <button
              type="button"
              onClick={loadReports}
              disabled={isLoadingList}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-500 transition-colors text-xs flex items-center gap-1.5"
              title="Refresh Laporan"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {/* TAB 1: FORM PENGIRIMAN LAPORAN (TULIS MANUAL, HEADER OTOMATIS) */}
          {activeTab === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitSuccess ? (
                <div className="py-12 flex flex-col items-center justify-center text-center animate-scaleIn">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-black text-emerald-800 dark:text-emerald-300">
                    Laporan Berhasil Terkirim!
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                    Pesan telah diteruskan ke tim QC / Admin. Pantau status perbaikan di tab Daftar Laporan.
                  </p>
                </div>
              ) : (
                <>
                  {/* Info Otomatis dari Header Aktif */}
                  <div
                    className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 ${
                      isDark ? "bg-slate-800/80 border-slate-700" : "bg-sky-50/70 border-sky-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        Data Header Otomatis Terhubung
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        Shift Aktif
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div
                        className={`p-2.5 rounded-xl border ${
                          isDark ? "bg-slate-900/60 border-slate-700/60" : "bg-white border-sky-100 shadow-2xs"
                        }`}
                      >
                        <span className="block text-[9px] font-black uppercase text-slate-400">Mesin</span>
                        <strong className="text-sm font-black text-slate-800 dark:text-slate-100">
                          {activeMc}
                        </strong>
                      </div>
                      <div
                        className={`p-2.5 rounded-xl border ${
                          isDark ? "bg-slate-900/60 border-slate-700/60" : "bg-white border-sky-100 shadow-2xs"
                        }`}
                      >
                        <span className="block text-[9px] font-black uppercase text-slate-400">Potongan Ke</span>
                        <strong className="text-sm font-black text-[#0070bc] dark:text-sky-400">
                          #{activePotongan}
                        </strong>
                      </div>
                      <div
                        className={`p-2.5 rounded-xl border ${
                          isDark ? "bg-slate-900/60 border-slate-700/60" : "bg-white border-sky-100 shadow-2xs"
                        }`}
                      >
                        <span className="block text-[9px] font-black uppercase text-slate-400">Group</span>
                        <strong className="text-sm font-black text-amber-600 dark:text-amber-400">
                          Group {activeGroup}
                        </strong>
                      </div>
                      <div
                        className={`p-2.5 rounded-xl border ${
                          isDark ? "bg-slate-900/60 border-slate-700/60" : "bg-white border-sky-100 shadow-2xs"
                        }`}
                      >
                        <span className="block text-[9px] font-black uppercase text-slate-400">Operator</span>
                        <strong className="text-xs font-black text-slate-800 dark:text-slate-100 truncate block">
                          {activeSender}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Textarea Tulis Manual */}
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-200 mb-1.5">
                      Tulis Laporan / Kendala <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={5}
                      value={keterangan}
                      onChange={(e) => setKeterangan(e.target.value)}
                      required
                      className={`w-full p-3.5 rounded-2xl border text-xs sm:text-sm font-medium outline-none transition-colors resize-none leading-relaxed ${
                        isDark
                          ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-amber-400"
                          : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 shadow-2xs"
                      }`}
                    />
                    <div className="flex justify-end mt-1">
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                        {keterangan.length} karakter
                      </span>
                    </div>
                  </div>

                  {/* Tombol Kirim */}
                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black tracking-wide flex items-center gap-2 shadow-md shadow-amber-500/20 active:scale-98 transition-all disabled:opacity-60 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? "Mengirim..." : "Kirim Laporan"}</span>
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* TAB 2: DAFTAR LAPORAN & MONITORING PERBAIKAN */}
          {activeTab === "list" && (
            <div className="space-y-3">
              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ALL")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      statusFilter === "ALL"
                        ? isDark
                          ? "bg-slate-700 text-white shadow-2xs"
                          : "bg-slate-900 text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    Semua ({reports.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("PENDING")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      statusFilter === "PENDING"
                        ? "bg-amber-500 text-white shadow-2xs"
                        : "text-slate-500 hover:text-amber-600"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                    <span>Belum Diperbaiki</span>
                    <span className="text-[10px] opacity-80">
                      ({reports.filter((r) => r.status === "PENDING").length})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("RESOLVED")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      statusFilter === "RESOLVED"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-slate-500 hover:text-emerald-600"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>Selesai</span>
                    <span className="text-[10px] opacity-80">
                      ({reports.filter((r) => r.status === "RESOLVED").length})
                    </span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari mesin / isi..."
                    className={`w-full sm:w-44 pl-8 pr-3 py-1.5 rounded-xl border text-xs font-medium outline-none transition-colors ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                        : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"
                    }`}
                  />
                </div>
              </div>

              {/* List Cards */}
              {isLoadingList ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mb-2 text-amber-500" />
                  <span>Memuat daftar laporan...</span>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="font-bold">Tidak ada laporan yang sesuai filter</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Gunakan tab "Buat Laporan Baru" jika ada kendala atau salah input
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredReports.map((report) => {
                    const isPending = report.status === "PENDING";
                    const isResolvingThis = resolvingId === report.id;

                    return (
                      <div
                        key={report.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isPending
                            ? isDark
                              ? "bg-amber-950/20 border-amber-900/60"
                              : "bg-amber-50/50 border-amber-200/80"
                            : isDark
                            ? "bg-slate-850/60 border-slate-800"
                            : "bg-white border-slate-200 shadow-2xs"
                        }`}
                      >
                        {/* Header Kartu: Mesin, Potongan, Group & Operator */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                              {report.nomorMc}
                            </span>
                            {report.potonganKe && (
                              <span className="text-xs font-bold text-[#0070bc] dark:text-sky-400">
                                Pot. #{report.potonganKe}
                              </span>
                            )}
                            {report.groupName && (
                              <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                Group {report.groupName}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">
                              oleh <strong className="text-slate-700 dark:text-slate-200">{report.senderName}</strong> •{" "}
                              {report.createdAt
                                ? new Date(report.createdAt).toLocaleDateString("id-ID", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "-"}
                            </span>
                          </div>

                          {/* Badge Status */}
                          <div className="shrink-0">
                            {isPending ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 inline-block mr-1"></span>Menunggu
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 inline-block mr-1"></span>Sudah Diperbaiki
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Pesan Manual Laporan */}
                        <div
                          className={`p-3 rounded-xl text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap ${
                            isDark
                              ? "bg-slate-900/80 text-slate-200 border border-slate-800"
                              : "bg-white/90 text-slate-800 border border-slate-100"
                          }`}
                        >
                          {report.keterangan}
                        </div>

                        {/* Catatan Solusi / Perbaikan jika sudah diselesaikan */}
                        {!isPending && report.resolutionNotes && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200">
                            <div className="flex items-center gap-1.5 font-bold mb-0.5 text-emerald-700 dark:text-emerald-400 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Catatan Perbaikan:</span>
                            </div>
                            <p className="font-medium">{report.resolutionNotes}</p>
                            <div className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400/80">
                              Diselesaikan oleh: <strong>{report.resolvedBy || "QC / Admin"}</strong>
                            </div>
                          </div>
                        )}

                        {/* Form Resolusi Inline saat diklik */}
                        {isResolvingThis && (
                          <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 animate-scaleIn">
                            <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                              Tuliskan tindakan / perbaikan yang dilakukan:
                            </label>
                            <input
                              type="text"
                              value={resolutionNoteInput}
                              onChange={(e) => setResolutionNoteInput(e.target.value)}
                              placeholder="Cth: Sudah diubah di sistem menjadi Gagal Cacat"
                              className="w-full px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 text-xs font-medium outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white mb-2"
                              autoFocus
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setResolvingId(null)}
                                className="px-3 py-1 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/50"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMarkResolved(report.id)}
                                disabled={isUpdatingStatus}
                                className="px-3.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
                              >
                                {isUpdatingStatus ? "Menyimpan..." : "Simpan Status Selesai"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="mt-2.5 flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(report.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors text-[11px] flex items-center gap-1"
                            title="Hapus laporan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Hapus</span>
                          </button>

                          <div className="flex items-center gap-2">
                            {isPending ? (
                              !isResolvingThis && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResolvingId(report.id);
                                    setResolutionNoteInput("Sudah diperiksa dan dikoreksi.");
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Tandai Sudah Diperbaiki</span>
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReopen(report.id)}
                                disabled={isUpdatingStatus}
                                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <span>↺ Buka Kembali</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
