"use client";

import React, { useState, useEffect } from "react";
import { getRecentShiftInputHistory } from "@/actions/continuous-actions";
import PanelHistoryTable from "@/app/(employee)/history/detail/components/PanelHistoryTable";
import MeterHistoryTable from "@/app/(employee)/history/detail/components/MeterHistoryTable";
import {
  History,
  RefreshCw,
  Cpu,
} from "lucide-react";

interface ContinuousHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentNomorMc?: string;
  currentPotonganKe?: string | number;
}

export default function ContinuousHistoryDrawer({
  isOpen,
  onClose,
  currentNomorMc,
  currentPotonganKe,
}: ContinuousHistoryDrawerProps) {
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMcOnly, setFilterMcOnly] = useState(true);
  const [filterPotonganOnly, setFilterPotonganOnly] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const mcQuery = filterMcOnly ? currentNomorMc : undefined;
      const potQuery = (filterMcOnly && filterPotonganOnly) ? currentPotonganKe : undefined;
      const res = await getRecentShiftInputHistory(mcQuery, 50, "ALL", potQuery);

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
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-md">
                <History className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                  Riwayat Input
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {currentNomorMc
                    ? `Mesin ${currentNomorMc}${currentPotonganKe ? ` • Potongan #${currentPotonganKe}` : ""}`
                    : "Laporan Shift Berjalan"}
                </p>
              </div>
            </div>
          </div>

          {/* Drawer Controls & Filter */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200/80 space-y-2.5 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {currentNomorMc && (
                  <button
                    type="button"
                    onClick={() => setFilterMcOnly(!filterMcOnly)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border ${
                      filterMcOnly
                        ? "bg-amber-400 border-amber-500 text-slate-950 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border ${
                      filterPotonganOnly
                        ? "bg-indigo-600 border-indigo-700 text-white shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>{filterPotonganOnly ? `Pot. #${currentPotonganKe}` : "Semua Pot."}</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={fetchHistory}
                disabled={loading}
                className="ml-auto px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Drawer Body - Exact History Table View per PCS */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar bg-slate-50/50">
            {loading ? (
              <div className="py-20 text-center text-slate-400 font-bold text-xs flex flex-col items-center gap-3">
                <RefreshCw className="w-7 h-7 text-amber-500 animate-spin" />
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
                    try { existingDt = typeof existing.downtime_events === 'string' ? JSON.parse(existing.downtime_events) : (existing.downtime_events || []); } catch (e) { }
                    let newDt: any[] = [];
                    try { newDt = typeof panel.downtime_events === 'string' ? JSON.parse(panel.downtime_events) : (panel.downtime_events || []); } catch (e) { }
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

              finalPanels.forEach((panel: any) => {
                if (panel.panel_no === "Downtime Mekanik (Direct)" || panel.pcs === 0 || panel.pcs === "0") {
                  return;
                }
                const totalPcs = parseInt(panel.pcs ?? "1");
                for (let i = 1; i <= totalPcs; i++) {
                  const pcsKey = i.toString();
                  if (!pcsGroups[pcsKey]) pcsGroups[pcsKey] = [];

                  const panelClone = { ...panel };

                  let dtEvents: any[] = [];
                  try {
                    if (typeof panelClone.downtime_events === 'string') {
                      dtEvents = JSON.parse(panelClone.downtime_events);
                    } else if (Array.isArray(panelClone.downtime_events)) {
                      dtEvents = panelClone.downtime_events;
                    }
                  } catch (e) { }

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
                    const hasErrors = filteredDetails.some((d: any) => d.kategori_masalah || d.keterangan_cacat);
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

              const isMeterReport = historyItems.some((p: any) => p.panel_no === "METERAN");

              return (
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
                            <PanelHistoryTable panels={panels} pcsKey={pcsKey} />
                          )}
                        </div>
                      );
                    })}
                  </div>
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
              Tutup Drawer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
