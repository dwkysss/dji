"use client";

import React, { useState, useEffect } from "react";
import { getRecentShiftInputHistory } from "@/actions/continuous-actions";
import PanelHistoryTable from "@/app/(employee)/history/detail/components/PanelHistoryTable";
import MeterHistoryTable from "@/app/(employee)/history/detail/components/MeterHistoryTable";
import {
  History,
  RefreshCw,
  Cpu,
  Clock,
  Wrench,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cancelMechanicDowntime } from "@/actions/mechanic-actions";
import { parseAsWibDate } from "@/lib/shift-utils";

interface ContinuousHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentNomorMc?: string;
  currentPotonganKe?: string | number;
  panelType?: "PANEL" | "METERAN" | "ALL";
}

export default function ContinuousHistoryDrawer({
  isOpen,
  onClose,
  currentNomorMc,
  currentPotonganKe,
  panelType = "ALL",
}: ContinuousHistoryDrawerProps) {
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMcOnly, setFilterMcOnly] = useState(true);
  const [filterPotonganOnly, setFilterPotonganOnly] = useState(true);
  const [deletingHeaderId, setDeletingHeaderId] = useState<string | null>(null);

  const { user } = useAuth();
  const isKepalaShiftOrAdmin = ["kepala_shift", "admin", "superadmin", "manager"].includes(
    (user?.role || "").toLowerCase()
  );

  const cleanPenanggungJawab = (raw: string | undefined | null) => {
    if (!raw) return "Operator";
    const pkMatch = raw.match(/^Perbaikan Khusus\s*\((.*)\)$/i);
    if (pkMatch && pkMatch[1]) return pkMatch[1].trim();
    const opMatch = raw.match(/^Operator\s*\((.*)\)$/i);
    if (opMatch && opMatch[1]) return opMatch[1].trim();
    return raw.replace(/^Perbaikan Khusus\s*/i, "").replace(/^Operator\s*/i, "").trim() || raw;
  };

  const formatDurationNice = (seconds: number): string => {
    if (!seconds || seconds <= 0) return "0 Dtk";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0 && s > 0) return `${m} Mnt ${s} Dtk`;
    if (m > 0) return `${m} Mnt`;
    return `${s} Dtk`;
  };

  const formatWibTime = (dateVal?: string): string => {
    if (!dateVal || dateVal === "-" || dateVal === "—") return "-";
    try {
      let str = String(dateVal).trim();
      if (!str) return "-";
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) {
        return str.substring(0, 5);
      }
      if (str.includes(" ") && !str.includes("Z") && !str.includes("+") && !str.includes("-", 10)) {
        const timePart = str.split(" ")[1];
        if (timePart && timePart.includes(":")) {
          return timePart.substring(0, 5);
        }
      }
      const dt = parseAsWibDate(str);
      if (isNaN(dt.getTime())) return "-";
      return new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(dt).replace(".", ":");
    } catch (e) {
      return "-";
    }
  };

  const handleDeleteSpecialDowntime = async (headerId: string, timeStr: string, pic: string) => {
    if (!window.confirm(`Hapus laporan downtime khusus (${timeStr} - ${pic}) ini?\nData downtime dan riwayat terkait akan dibatalkan.`)) {
      return;
    }
    setDeletingHeaderId(headerId);
    try {
      const res = await cancelMechanicDowntime(headerId);
      if (res && res.success) {
        await fetchHistory();
      } else {
        alert("Gagal menghapus downtime: " + (res?.error || "Terjadi kesalahan"));
      }
    } catch (err: any) {
      alert("Terjadi kesalahan saat menghapus: " + (err?.message || err));
    } finally {
      setDeletingHeaderId(null);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const mcQuery = filterMcOnly ? currentNomorMc : undefined;
      const potQuery = (filterMcOnly && filterPotonganOnly) ? currentPotonganKe : undefined;
      const res = await getRecentShiftInputHistory(mcQuery, 50, panelType, potQuery);

      if (res.success && res.data) {
        setHistoryItems(res.data);
      }
    } catch (e) {
      console.error("Gagal memuat riwayat shift:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, filterMcOnly, filterPotonganOnly, currentNomorMc, currentPotonganKe]);

  // Kalkulasi Waktu Jalan Mesin (Net Running Time):
  // (Waktu Input Terakhir - Waktu Input Awal) - Total Downtime
  const drawerOperationalStats = React.useMemo(() => {
    if (!historyItems || historyItems.length === 0) return null;

    const validPanels = historyItems.filter(
      (p: any) => p.tanggal_jam || p.created_at || p.tgl
    );
    if (validPanels.length === 0) return null;

    const sorted = [...validPanels].sort((a: any, b: any) => {
      const tA = new Date(a.tanggal_jam || a.created_at || a.tgl).getTime();
      const tB = new Date(b.tanggal_jam || b.created_at || b.tgl).getTime();
      return tA - tB;
    });

    const firstPanel = sorted[0];
    const lastPanel = sorted[sorted.length - 1];

    const startTime = new Date(firstPanel.tanggal_jam || firstPanel.created_at || firstPanel.tgl);
    const endTime = new Date(lastPanel.tanggal_jam || lastPanel.created_at || lastPanel.tgl);
    const grossSeconds = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));

    let downtimeSeconds = 0;
    const seenHeaders = new Set<string>();
    sorted.forEach((p: any) => {
      const hId = String(p.id || p.header_id || "");
      if (hId && seenHeaders.has(hId)) return;
      if (hId) seenHeaders.add(hId);

      let dtEvts = [];
      try {
        dtEvts = typeof p.downtime_events === "string" ? JSON.parse(p.downtime_events) : (p.downtime_events || []);
      } catch (e) {
        dtEvts = [];
      }
      if (Array.isArray(dtEvts)) {
        dtEvts.forEach((ev: any) => {
          downtimeSeconds += (Number(ev.duration || ev.durasiDetik || ev.durasi_detik) || 0);
        });
      }
    });

    const runningSeconds = Math.max(0, grossSeconds - downtimeSeconds);

    const formatDurationClean = (sec: number) => {
      if (sec <= 0) return "0 dtk";
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      if (h > 0) return m > 0 ? `${h} Jam ${m} Mnt` : `${h} Jam`;
      if (m > 0) return s > 0 ? `${m} Mnt ${s} Dtk` : `${m} Mnt`;
      return `${s} Dtk`;
    };

    const formatTimeOnly = (d: Date) => {
      try {
        return new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(d).replace(".", ":");
      } catch (e) {
        return "-";
      }
    };

    return {
      grossFormatted: formatDurationClean(grossSeconds),
      startTimeStr: formatTimeOnly(startTime),
      downtimeFormatted: formatDurationClean(downtimeSeconds),
      runningFormatted: formatDurationClean(runningSeconds),
      hasMultiplePanels: sorted.length > 1 && grossSeconds > 0,
    };
  }, [historyItems]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex justify-end">
        <div className="w-full sm:w-[85vw] md:w-[75vw] lg:w-[65vw] max-w-4xl bg-white shadow-2xl flex flex-col h-full overflow-hidden animate-slideLeft">
          {/* Drawer Header with Integrated Actions */}
          <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-black shrink-0 shadow-xs">
                <History className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h2 className="text-base font-black tracking-tight text-white">
                  Riwayat Input
                </h2>
              </div>
            </div>

            {/* Top Filter Buttons & Refresh */}
            <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
              {currentNomorMc && (
                <button
                  type="button"
                  onClick={() => setFilterMcOnly(!filterMcOnly)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border active:scale-95 ${filterMcOnly
                      ? "bg-[#0070bc] border-sky-500 text-white shadow-xs"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
                    }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>{filterMcOnly ? `MC ${currentNomorMc}` : "Semua Mesin"}</span>
                </button>
              )}

              {filterMcOnly && currentPotonganKe && (
                <button
                  type="button"
                  onClick={() => setFilterPotonganOnly(!filterPotonganOnly)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border active:scale-95 ${filterPotonganOnly
                      ? "bg-sky-500/20 border-sky-500/50 text-sky-300 shadow-xs"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
                    }`}
                >
                  <span>{filterPotonganOnly ? `Pot. #${currentPotonganKe}` : "Semua Pot."}</span>
                </button>
              )}

              <button
                type="button"
                onClick={fetchHistory}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-sky-400" : ""}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition-all cursor-pointer ml-1"
                title="Tutup Drawer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Drawer Body - Exact History Table View per PCS */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar bg-slate-50/50">
            {loading ? (
              <div className="py-20 text-center text-slate-400 font-bold text-xs flex flex-col items-center gap-3">
                <RefreshCw className="w-7 h-7 text-[#0070bc] animate-spin" />
                <span>Memuat riwayat input...</span>
              </div>
            ) : historyItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-bold text-xs flex flex-col items-center gap-2 px-4 animate-fadeIn">
                <History className="w-9 h-9 text-slate-300 stroke-[1.5]" />
                <span className="text-slate-700 font-black text-sm">Belum Ada Data Input</span>
                <p className="text-[11px] text-slate-400 max-w-xs font-normal">
                  {filterMcOnly && currentNomorMc
                    ? `Belum ada riwayat inputan untuk Mesin ${currentNomorMc}.`
                    : "Belum ada laporan input produksi yang tersimpan."}
                </p>
              </div>
            ) : (() => {
              // Group panels by pcs (Exact matching logic from History Detail page)
              const pcsGroups: { [key: string]: any[] } = {};

              const uniqueById = new Map();
              historyItems.forEach((panel: any) => {
                if (!uniqueById.has(panel.id)) {
                  uniqueById.set(panel.id, { ...panel, production_details: [...(panel.production_details || [])] });
                }
              });

              const deduplicatedPanels = Array.from(uniqueById.values());
              const finalPanels: any[] = [];
              const seenPanelNo = new Map<string, any>();

              deduplicatedPanels.forEach((panel: any) => {
                if (panel.panel_no === "METERAN") {
                  finalPanels.push(panel);
                } else {
                  const key = panel.panel_no;
                  const existing = seenPanelNo.get(key);
                  if (existing) {
                    existing.production_details.push(...(panel.production_details || []));
                    let existingDt: any[] = [];
                    try {
                      const parsed = typeof existing.downtime_events === 'string' ? JSON.parse(existing.downtime_events) : existing.downtime_events;
                      existingDt = Array.isArray(parsed) ? parsed : [];
                    } catch (e) {
                      existingDt = [];
                    }
                    let newDt: any[] = [];
                    try {
                      const parsed = typeof panel.downtime_events === 'string' ? JSON.parse(panel.downtime_events) : panel.downtime_events;
                      newDt = Array.isArray(parsed) ? parsed : [];
                    } catch (e) {
                      newDt = [];
                    }
                    existing.downtime_events = [...existingDt, ...newDt];

                    const existingPcs = parseInt(existing.pcs || "1");
                    const newPcs = parseInt(panel.pcs || "1");
                    if (newPcs > existingPcs) existing.pcs = newPcs.toString();
                  } else {
                    seenPanelNo.set(key, panel);
                  }
                }
              });

              finalPanels.push(...Array.from(seenPanelNo.values()));

              const oldestPanelIdByOperator = new Map<string, string>();
              const sortedByTime = [...finalPanels].sort((a, b) => String(a.tanggal_jam || "").localeCompare(String(b.tanggal_jam || "")));
              sortedByTime.forEach((p: any) => {
                const opr = p.operators?.nama_operator || p.pic || p.created_by_name || "";
                const grp = p.groups?.nama_grup || "";
                const operatorStr = (grp ? `(${grp}) ` : '') + opr;
                if (!oldestPanelIdByOperator.has(operatorStr)) {
                  oldestPanelIdByOperator.set(operatorStr, p.id);
                }
              });

              // Dapatkan jumlah max PCS pada potongan ini agar counter meter mesin didistribusikan ke seluruh PCS
              let maxBatchPcs = 1;
              finalPanels.forEach((p: any) => {
                const pPcs = parseInt(p.pcs || "1");
                if (pPcs > maxBatchPcs) maxBatchPcs = pPcs;
                if (p.production_details && Array.isArray(p.production_details)) {
                  p.production_details.forEach((d: any) => {
                    const dPcs = d.pcs_index ? parseInt(d.pcs_index) : 1;
                    if (dPcs > maxBatchPcs) maxBatchPcs = dPcs;
                  });
                }
              });

              finalPanels.forEach((panel: any) => {
                if (panel.panel_no === "Downtime Mekanik (Direct)" || panel.pcs === 0 || panel.pcs === "0") {
                  return;
                }
                const isMeterInput = panel.panel_no === "METERAN";
                const totalPcs = isMeterInput ? Math.max(maxBatchPcs, parseInt(panel.pcs ?? "1")) : parseInt(panel.pcs ?? "1");
                for (let i = 1; i <= totalPcs; i++) {
                  const pcsKey = i.toString();
                  if (!pcsGroups[pcsKey]) pcsGroups[pcsKey] = [];

                  const panelClone = { ...panel };

                  let dtEvents: any[] = [];
                  try {
                    if (typeof panelClone.downtime_events === 'string') {
                      const parsed = JSON.parse(panelClone.downtime_events);
                      dtEvents = Array.isArray(parsed) ? parsed : [];
                    } else if (Array.isArray(panelClone.downtime_events)) {
                      dtEvents = panelClone.downtime_events;
                    }
                  } catch (e) {
                    dtEvents = [];
                  }

                  const matchedEvents = dtEvents.filter(
                    (e: any) =>
                      !e.pcsKe ||
                      e.pcsKe === "Semua" ||
                      e.pcsKe.split(",").map((x: any) => x.trim()).includes(pcsKey)
                  );

                  let hasDetails = false;
                  if (panelClone.production_details) {
                    const filteredDetails = panelClone.production_details.filter((d: any) => {
                      const pIndex = d.pcs_index ? parseInt(d.pcs_index) : 1;
                      return pIndex === i;
                    });
                    const hasErrors = filteredDetails.some((d: any) => d.kategori_masalah || d.keterangan_cacat || (d.production_defects && d.production_defects.length > 0));
                    if (hasErrors) {
                      hasDetails = true;
                      panelClone.production_details = filteredDetails;
                    } else {
                      panelClone.production_details = [];
                    }
                  }

                  const isIstirahat = panelClone.production_details?.some((d: any) => d.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT")) ||
                    dtEvents.some((e: any) => e.kategori?.toUpperCase().includes("ISTIRAHAT"));

                  const isMeterInput = panelClone.panel_no === "METERAN";
                  const opr = panelClone.operators?.nama_operator || panelClone.pic || panelClone.created_by_name || "";
                  const grp = panelClone.groups?.nama_grup || "";
                  const operatorStr = (grp ? `(${grp}) ` : '') + opr;
                  const isOldest = oldestPanelIdByOperator.get(operatorStr) === panelClone.id;
                  const isFinishReport = isMeterInput && panelClone.meter_akhir !== null && panelClone.meter_akhir !== undefined && String(panelClone.meter_akhir).trim() !== "";

                  if (isMeterInput) {
                    if (isOldest || isFinishReport || matchedEvents.length > 0 || hasDetails || isIstirahat) {
                      pcsGroups[pcsKey].push(panelClone);
                    }
                  } else {
                    if (panelClone.production_details.length === 0) {
                      panelClone.production_details = panel.production_details?.filter((d: any) => {
                        const pIndex = d.pcs_index ? parseInt(d.pcs_index) : 1;
                        return pIndex === i;
                      }) || [];
                    }
                    pcsGroups[pcsKey].push(panelClone);
                  }
                }
              });

              const sortedPcsKeys = Object.keys(pcsGroups).sort((a, b) => parseInt(a) - parseInt(b));
              if (sortedPcsKeys.length === 0) return null;

              const isMeterReport = panelType === "METERAN" || (panelType === "ALL" && historyItems.some((p: any) => p.panel_no === "METERAN"));

              return (
                <div className="w-full flex flex-col gap-2.5">
                  {/* Card Ringkasan Waktu Operasional Mesin (Responsif Tablet & Mobile: Stack Atas-Bawah) */}
                  {drawerOperationalStats && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* 1. Waktu Jalan Mesin */}
                      <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-xl px-3 py-2 flex flex-col justify-center gap-0.5 min-w-0 shadow-2xs">
                        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                          <span className="truncate">Waktu Jalan Mesin</span>
                        </span>
                        <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono tracking-tight truncate">
                          {drawerOperationalStats.hasMultiplePanels
                            ? drawerOperationalStats.runningFormatted
                            : "0 dtk"}
                        </span>
                      </div>

                      {/* 2. Total Downtime */}
                      <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl px-3 py-2 flex flex-col justify-center gap-0.5 min-w-0 shadow-2xs">
                        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                          <span className="truncate">Total Downtime</span>
                        </span>
                        <span className="text-xs sm:text-sm font-black text-amber-700 font-mono tracking-tight truncate">
                          {drawerOperationalStats.downtimeFormatted}
                        </span>
                      </div>

                      {/* 3. Total Rentang Waktu */}
                      <div className="bg-slate-50 border border-slate-200/90 rounded-xl px-3 py-2 flex flex-col justify-center gap-0.5 min-w-0 shadow-2xs">
                        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5 truncate">
                          <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">Total Rentang Waktu</span>
                        </span>
                        <span className="text-xs sm:text-sm font-black text-slate-800 font-mono tracking-tight truncate">
                          {drawerOperationalStats.hasMultiplePanels
                            ? drawerOperationalStats.grossFormatted
                            : `0 Mnt (Mulai ${drawerOperationalStats.startTimeStr})`}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="w-full overflow-x-auto pb-4 custom-scrollbar bg-slate-50/50 p-2 sm:p-3 rounded-xl border border-slate-200">
                  <div className="flex w-max min-w-full gap-6 items-start">
                    {sortedPcsKeys.map((pcsKey) => {
                      const pcsLabel = `PCS ${pcsKey}`;
                      const panels = pcsGroups[pcsKey].sort((a, b) => {
                        if (a.panel_no === "METERAN" && b.panel_no === "METERAN") {
                          return String(a.tanggal_jam || "").localeCompare(String(b.tanggal_jam || ""));
                        }
                        if (a.panel_no === "METERAN") return 1;
                        if (b.panel_no === "METERAN") return -1;

                        const pA = parseInt(a.panel_no || "0");
                        const pB = parseInt(b.panel_no || "0");
                        if (pA === pB) {
                          const isABs = String(a.panel_no || "").includes("(BS)") || String(a.panel_no || "").includes("(GAGAL)");
                          const isBBs = String(b.panel_no || "").includes("(BS)") || String(b.panel_no || "").includes("(GAGAL)");
                          if (isABs && !isBBs) return -1;
                          if (!isABs && isBBs) return 1;
                          return String(a.tanggal_jam || "").localeCompare(String(b.tanggal_jam || ""));
                        }
                        return pA - pB;
                      });

                      return (
                        <div key={pcsKey} className="w-min flex-none bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                          <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 text-center font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                            {isMeterReport ? "Riwayat Input Meteran" : pcsLabel}
                          </div>
                          {isMeterReport ? (
                            <MeterHistoryTable panels={panels} pcsKey={pcsKey} />
                          ) : (
                            <PanelHistoryTable panels={panels} pcsKey={pcsKey} onRefresh={fetchHistory} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Render Laporan Downtime Khusus dengan Opsi Hapus untuk Kepala Shift / Admin */}
                {(() => {
                  const specialPanels = deduplicatedPanels.filter((p: any) => {
                    return p.panel_no === "Downtime Mekanik (Direct)" || p.panel_no === "BERHENTI" || p.pcs === 0 || p.pcs === "0";
                  });
                  if (specialPanels.length === 0) return null;

                  const specialRows: any[] = [];
                  specialPanels.forEach((mp: any) => {
                    let dtEvents: any[] = [];
                    try {
                      dtEvents = typeof mp.downtime_events === 'string' ? JSON.parse(mp.downtime_events) : (mp.downtime_events || []);
                    } catch (e) {}

                    if (dtEvents && dtEvents.length > 0) {
                      dtEvents.forEach((ev: any, idx: number) => {
                        const rawTime = ev.waktu || ev.timestamp || mp.tanggal_jam || mp.created_at;
                        const timeStr = formatWibTime(rawTime);
                        if (ev.problems && ev.problems.length > 0) {
                          ev.problems.forEach((p: any, pIdx: number) => {
                            const detailText = (p.details && Array.isArray(p.details)) ? p.details.join(", ") : (p.details || ev.detail || "-");
                            const blokText = p.blok ? ` (Blok: ${p.blok})` : (ev.blok ? ` (Blok: ${ev.blok})` : "");
                            specialRows.push({
                              id: `${mp.id}-${idx}-${pIdx}`,
                              headerId: mp.id,
                              timeStr,
                              penanggungJawab: cleanPenanggungJawab(ev.dikerjakanOleh || mp.pic || mp.operators?.nama_operator),
                              shift: mp.grup || mp.groups?.nama_grup || ev.shift || "-",
                              durasiDisplay: formatDurationNice(ev.durasiDetik || mp.total_downtime_detik || 0),
                              kategori: p.kategori || ev.kategori || "-",
                              detailMasalah: `${detailText}${blokText}`,
                            });
                          });
                        } else {
                          const detailText = ev.detail || "-";
                          const blokText = ev.blok ? ` (Blok: ${ev.blok})` : "";
                          specialRows.push({
                            id: `${mp.id}-${idx}`,
                            headerId: mp.id,
                            timeStr,
                            penanggungJawab: cleanPenanggungJawab(ev.dikerjakanOleh || mp.pic || mp.operators?.nama_operator),
                            shift: mp.grup || mp.groups?.nama_grup || ev.shift || "-",
                            durasiDisplay: formatDurationNice(ev.durasiDetik || mp.total_downtime_detik || 0),
                            kategori: ev.kategori || "-",
                            detailMasalah: `${detailText}${blokText}`,
                          });
                        }
                      });
                    } else if (mp.downtime_records && mp.downtime_records.length > 0) {
                      mp.downtime_records.forEach((dr: any, dIdx: number) => {
                        const rawTime = dr.waktu || dr.created_at || dr.tanggal_jam || mp.tanggal_jam;
                        const timeStr = formatWibTime(rawTime);
                        const detailText = dr.detail || "-";
                        const blokText = dr.blok ? ` (Blok: ${dr.blok})` : "";
                        specialRows.push({
                          id: `${mp.id}-dr-${dIdx}`,
                          headerId: mp.id,
                          timeStr,
                          penanggungJawab: cleanPenanggungJawab(dr.dikerjakan_oleh || mp.pic || mp.operators?.nama_operator),
                          shift: mp.grup || mp.groups?.nama_grup || "-",
                          durasiDisplay: formatDurationNice(dr.durasi_detik || mp.total_downtime_detik || 0),
                          kategori: dr.kategori || "-",
                          detailMasalah: `${detailText}${blokText}`,
                        });
                      });
                    } else if (mp.total_downtime_detik > 0) {
                      const rawTime = mp.tanggal_jam || mp.created_at;
                      const timeStr = formatWibTime(rawTime);
                      specialRows.push({
                        id: `${mp.id}-fallback`,
                        headerId: mp.id,
                        timeStr,
                        penanggungJawab: cleanPenanggungJawab(mp.pic || mp.operators?.nama_operator),
                        shift: mp.grup || mp.groups?.nama_grup || "-",
                        durasiDisplay: formatDurationNice(mp.total_downtime_detik || 0),
                        kategori: mp.kategori_masalah || "-",
                        detailMasalah: mp.detail_masalah || "-",
                      });
                    }
                  });

                  if (specialRows.length === 0) return null;

                  return (
                    <div className="mt-3 rounded-xl overflow-hidden shadow-xs border border-slate-200">
                      <div className="px-4 py-3 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                            <Wrench className="w-3.5 h-3.5 text-sky-300" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black tracking-tight text-white">Laporan Downtime Khusus</h4>
                            <p className="text-[10px] text-sky-200">Downtime mekanik & perbaikan mesin langsung</p>
                          </div>
                        </div>
                        <span className="bg-white/20 border border-white/30 rounded-full px-2.5 py-0.5 text-[10px] font-black text-white">
                          {specialRows.length} laporan
                        </span>
                      </div>

                      <div className="bg-slate-50/70 divide-y divide-slate-100">
                        {specialRows.map((row) => (
                          <div key={row.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5 shrink-0 w-16">
                                <div className="w-2 h-2 rounded-full shrink-0 bg-[#0070bc]" />
                                <span className="text-xs font-black text-slate-800 font-mono">{row.timeStr}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                                  {row.penanggungJawab.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-800 leading-tight">{row.penanggungJawab}</span>
                                  <span className="text-[9px] text-slate-400">Shift {row.shift}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 sm:ml-auto">
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded border border-red-100 shrink-0">
                                <Clock className="w-3 h-3" />
                                <span className="text-[11px] font-black">{row.durasiDisplay}</span>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-extrabold shrink-0">
                                {row.kategori === "-" ? "Problem" : `Kategori ${row.kategori}`}
                              </span>
                              <span className="text-[11px] text-slate-600 max-w-[140px] truncate" title={row.detailMasalah}>
                                {row.detailMasalah}
                              </span>

                              {/* Tombol Hapus Khusus Kepala Shift / Admin */}
                              {isKepalaShiftOrAdmin && row.headerId && (
                                <button
                                  type="button"
                                  disabled={deletingHeaderId === row.headerId}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSpecialDowntime(row.headerId, row.timeStr, row.penanggungJawab);
                                  }}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer shrink-0 disabled:opacity-50 border border-rose-200/80 shadow-2xs ml-1"
                                  title="Hapus Laporan Downtime Khusus (Khusus Kepala Shift / Admin)"
                                >
                                  {deletingHeaderId === row.headerId ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500 hover:scale-110 transition-transform" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                </div>
              );
            })()}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-500 font-bold">
              Total Laporan Shift Ini: {historyItems.length}
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-xs hover:bg-slate-800 transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
