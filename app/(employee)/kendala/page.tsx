"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  MessageSquareWarning,
  RefreshCw,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Trash2,
  RotateCcw,
  User,
  Factory,
  Layers,
  ChevronDown,
  X,
  FileText,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  fetchIssueReports,
  updateIssueReportStatus,
  deleteIssueReport,
  IssueReportItem,
} from "@/actions/issue-report-actions";
import { useAuth } from "@/lib/auth-context";
import IssueReportModal from "@/components/modals/IssueReportModal";

export default function RiwayatKendalaPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<IssueReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter States
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "RESOLVED">("ALL");
  const [selectedMc, setSelectedMc] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal Create State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Inline Resolving State
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionInput, setResolutionInput] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Load Data
  const loadData = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetchIssueReports();
      let serverData = res.success ? res.data : [];

      // Gabungkan antrean offline dari localStorage jika ada
      try {
        const raw = localStorage.getItem("dji_offline_issue_reports");
        if (raw) {
          const offlineList: IssueReportItem[] = JSON.parse(raw);
          const serverIds = new Set(serverData.map((s) => s.id));
          const uniqueOffline = offlineList.filter((o) => !serverIds.has(o.id));
          serverData = [...uniqueOffline, ...serverData];
        }
      } catch (err) { }

      setReports(serverData);
    } catch (err) {
      console.error("[RiwayatKendalaPage] Gagal memuat data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Mark Resolved
  const handleMarkResolved = async (reportId: string) => {
    setIsActionLoading(true);
    const resolver = user?.fullName || "Admin / QC";
    const note = resolutionInput.trim() || "Sudah diperiksa dan dikoreksi di sistem.";

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
        setResolutionInput("");
      } else {
        alert("Gagal memperbarui status: " + (res.error || "Terjadi kesalahan"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Reopen
  const handleReopen = async (reportId: string) => {
    if (!confirm("Buka kembali laporan ini ke status 'Menunggu Perbaikan'?")) return;
    setIsActionLoading(true);

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
      setIsActionLoading(false);
    }
  };

  // Handle Delete
  const handleDelete = async (reportId: string) => {
    if (!confirm("Hapus laporan kendala ini secara permanen?")) return;

    try {
      const res = await deleteIssueReport(reportId);
      if (res.success) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
      } else {
        alert("Gagal menghapus: " + (res.error || "Gagal"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Unique machines for filter
  const availableMachines = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      if (r.nomorMc) set.add(r.nomorMc.toUpperCase());
    });
    return Array.from(set).sort();
  }, [reports]);

  // Filtered Reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (selectedMc !== "ALL" && r.nomorMc.toUpperCase() !== selectedMc) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        r.nomorMc?.toLowerCase().includes(q) ||
        String(r.potonganKe || "").toLowerCase().includes(q) ||
        r.groupName?.toLowerCase().includes(q) ||
        r.senderName?.toLowerCase().includes(q) ||
        r.keterangan?.toLowerCase().includes(q) ||
        (r.resolutionNotes || "").toLowerCase().includes(q)
      );
    });
  }, [reports, statusFilter, selectedMc, searchQuery]);

  // KPI Calculations
  const totalCount = reports.length;
  const pendingCount = reports.filter((r) => r.status === "PENDING").length;
  const resolvedCount = reports.filter((r) => r.status === "RESOLVED").length;
  const resolutionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 100;

  return (
    <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto space-y-5 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-600 shrink-0">
            <MessageSquareWarning className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Riwayat Kendala
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                Laporan Operator
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Pantau laporan kesalahan input data atau kendala mesin untuk ditindaklanjuti Admin
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 text-xs font-bold transition-all flex items-center gap-1.5 bg-white shadow-2xs cursor-pointer active:scale-95 disabled:opacity-60"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#0070bc] hover:bg-[#005a96] text-white text-xs font-black tracking-wide transition-all flex items-center gap-2 shadow-sm shadow-[#0070bc]/20 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Buat Laporan Baru</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Laporan</span>
            <div className="text-2xl font-black text-slate-800 mt-1">{totalCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">Menunggu Perbaikan</span>
            <div className="text-2xl font-black text-amber-900 mt-1">{pendingCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Sudah Diperbaiki</span>
            <div className="text-2xl font-black text-emerald-900 mt-1">{resolvedCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#0070bc]">Tingkat Selesai</span>
            <div className="text-2xl font-black text-[#0c4a6e] mt-1">{resolutionRate}%</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-[#0070bc] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${statusFilter === "ALL"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
          >
            Semua ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("PENDING")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${statusFilter === "PENDING"
                ? "bg-amber-500 text-white shadow-2xs"
                : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
              }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
            <span>Menunggu Perbaikan</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white/30 text-current">
              {pendingCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("RESOLVED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${statusFilter === "RESOLVED"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
              }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span>Sudah Diperbaiki</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white/30 text-current">
              {resolvedCount}
            </span>
          </button>
        </div>

        {/* Right Filter: Machine Selector & Search */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Mesin Dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedMc}
              onChange={(e) => setSelectedMc(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:border-[#0070bc] transition-colors cursor-pointer"
            >
              <option value="ALL">Semua Mesin</option>
              {availableMachines.map((mc) => (
                <option key={mc} value={mc}>
                  Mesin {mc}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari mesin, operator, isi..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-[#0070bc] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main List Section */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center text-slate-400 text-xs">
            <RefreshCw className="w-7 h-7 animate-spin text-[#0070bc] mb-2" />
            <span className="font-bold">Memuat riwayat kendala...</span>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center text-slate-400 text-xs shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className="text-sm font-black text-slate-700">Tidak ada kendala ditemukan</h3>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
              {searchQuery || selectedMc !== "ALL" || statusFilter !== "ALL"
                ? "Coba ubah kata kunci pencarian atau reset filter untuk melihat data lainnya."
                : "Semua data aman! Gunakan tombol 'Buat Laporan Baru' jika ada kendala di mesin."}
            </p>
          </div>
        ) : (
          filteredReports.map((report) => {
            const isPending = report.status === "PENDING";
            const isResolvingThis = resolvingId === report.id;

            return (
              <div
                key={report.id}
                className={`rounded-2xl border transition-all p-4 sm:p-5 ${isPending
                    ? "bg-amber-50/40 border-amber-200/90 shadow-2xs"
                    : "bg-white border-slate-200/80 shadow-2xs hover:border-slate-300"
                  }`}
              >
                {/* Top Row: Badges & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-800 text-white">
                      {report.nomorMc}
                    </span>
                    {report.potonganKe && (
                      <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-sky-100 text-[#0070bc]">
                        Potongan #{report.potonganKe}
                      </span>
                    )}
                    {report.groupName && (
                      <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-800">
                        Group {report.groupName}
                      </span>
                    )}
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Pelapor: <strong className="text-slate-800">{report.senderName}</strong>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      •{" "}
                      {report.createdAt
                        ? new Date(report.createdAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }) + " WIB"
                        : "-"}
                    </span>
                  </div>

                  <div className="shrink-0">
                    {isPending ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        Menunggu Perbaikan
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Sudah Diperbaiki
                      </span>
                    )}
                  </div>
                </div>

                {/* Pesan Manual Laporan */}
                <div className="pt-3">
                  <div className="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed bg-white p-3.5 rounded-xl border border-slate-100 whitespace-pre-wrap">
                    {report.keterangan}
                  </div>
                </div>

                {/* Catatan Solusi jika sudah diselesaikan */}
                {!isPending && report.resolutionNotes && (
                  <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Catatan Tindakan / Perbaikan:</span>
                    </div>
                    <p className="font-medium pl-5">{report.resolutionNotes}</p>
                    <div className="pl-5 text-[10px] text-emerald-600">
                      Diselesaikan oleh: <strong>{report.resolvedBy || "QC / Admin"}</strong>
                      {report.resolvedAt && (
                        <span>
                          {" "}
                          •{" "}
                          {new Date(report.resolvedAt).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Form Resolusi Inline */}
                {isResolvingThis && (
                  <div className="mt-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 animate-scaleIn">
                    <label className="block text-xs font-black uppercase text-emerald-900 mb-1.5">
                      Catatan Perbaikan / Tindakan yang Dilakukan:
                    </label>
                    <input
                      type="text"
                      value={resolutionInput}
                      onChange={(e) => setResolutionInput(e.target.value)}
                      placeholder="Contoh: Sudah dikoreksi menjadi Gagal Cacat pada panel 12"
                      className="w-full px-3.5 py-2 rounded-xl border border-emerald-300 text-xs font-medium outline-none bg-white text-slate-900 focus:border-emerald-600 mb-2.5"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setResolvingId(null)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/50"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkResolved(report.id)}
                        disabled={isActionLoading}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-xs"
                      >
                        {isActionLoading ? "Menyimpan..." : "Simpan Status Selesai"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Bottom Actions */}
                <div className="mt-3.5 flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(report.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors text-xs flex items-center gap-1.5 font-bold"
                    title="Hapus Laporan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {isPending ? (
                      !isResolvingThis && (
                        <button
                          type="button"
                          onClick={() => {
                            setResolvingId(report.id);
                            setResolutionInput("Sudah diperiksa dan dikoreksi.");
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Tandai Sudah Diperbaiki</span>
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleReopen(report.id)}
                        disabled={isActionLoading}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Buka Kembali</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Dialog Buat Laporan Baru jika operator/admin klik dari halaman ini */}
      <IssueReportModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          loadData(true);
        }}
        nomorMc="R1"
        potonganKe="1"
        groupName="A"
        currentOperator={user?.fullName || "Admin"}
      />
    </div>
  );
}

