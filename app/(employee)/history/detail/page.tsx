"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { searchEmployeeHistory } from "@/actions/employee-actions";
import CompactHeaderCard from "@/components/forms/CompactHeaderCard";
import { Loader2, ArrowLeft, Clock, AlertCircle, Timer, Wrench, ChevronRight, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import PanelHistoryTable from "./components/PanelHistoryTable";
import MeterHistoryTable from "./components/MeterHistoryTable";
import PrintableProductionReport from "@/components/reports/PrintableProductionReport";

function HistoryDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const nomor_mc = searchParams.get("mc");
  const design_id = searchParams.get("design");
  const potongan_ke = searchParams.get("potongan");
  const tgl = searchParams.get("tgl");

  const [detailData, setDetailData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  useEffect(() => {
    if (!nomor_mc || !potongan_ke) {
      setErrorMsg("Parameter tidak lengkap.");
      setIsLoading(false);
      return;
    }

    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await searchEmployeeHistory({
          nomor_mc: nomor_mc,
          design_id: design_id || undefined,
          potongan_ke: potongan_ke,
        });

        if (res.success && res.data && res.data.length > 0) {
          const batch = res.data.find(
            (b: any) =>
              String(b.nomor_mc || "").trim().toUpperCase() === String(nomor_mc || "").trim().toUpperCase() &&
              b.potongan_ke == potongan_ke
          );

          if (batch) {
            setDetailData(batch);
          } else {
            setDetailData(res.data[0]);
          }
        } else {
          setErrorMsg("Data tidak ditemukan.");
        }
      } catch (err: any) {
        setErrorMsg("Terjadi kesalahan jaringan.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [nomor_mc, design_id, potongan_ke, tgl]);

  const formatDurationNice = (totalSec: number | string) => {
    const sec = typeof totalSec === "string" ? parseInt(totalSec) || 0 : totalSec || 0;
    if (sec <= 0) return "0 dtk";
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    if (hours > 0) {
      if (minutes > 0) return `${hours} Jam ${minutes} Mnt`;
      return `${hours} Jam`;
    }
    if (minutes > 0) {
      if (seconds > 0) return `${minutes} Mnt ${seconds} Dtk`;
      return `${minutes} Mnt`;
    }
    return `${seconds} Dtk`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-[#0070bc] mb-4" />
        <span className="text-slate-500 font-medium">Memuat Detail...</span>
      </div>
    );
  }

  if (errorMsg || !detailData) {
    return (
      <div className="flex-1 p-6 sm:p-10 flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h3 className="text-lg font-bold text-slate-800">{errorMsg || "Data tidak ditemukan."}</h3>
        <button
          onClick={() => router.back()}
          className="mt-6 flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold text-slate-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full min-w-0 animate-fadeIn">
      {/* Header Nav */}
      <div className="flex items-center justify-between gap-2 mb-6 no-print">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/history")}
            className="h-9 w-9 shrink-0 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 flex items-center justify-center transition-colors shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
            <span
              className="hover:text-[#0070bc] cursor-pointer transition-colors"
              onClick={() => router.push("/history")}
            >Riwayat</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-700 font-black">Detail Laporan</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsPrintModalOpen(true)}
          className="h-9 px-3.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-black text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
          title="Cetak Laporan / Simpan PDF"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Laporan</span>
        </button>
      </div>


      <CompactHeaderCard
            nomorMc={detailData.nomor_mc}
            shiftName={detailData.panels?.[0]?.groups?.nama_grup || "-"}
            operatorName={detailData.operators_list}
            design={detailData.design_id}
            pcsCount={detailData.total_panels}
            panelPotongan={`- / ${detailData.potongan_ke}`}
            courseRpm={`${detailData.course || "-"} / ${detailData.rpm || "-"}`}
            noCustomer={detailData.no_customer || "-"}
            noOrder={detailData.no_order_barang || "-"}
            tanggalPotong={detailData.tanggal_potong ? (detailData.tanggal_potong.includes(":") ? detailData.tanggal_potong : ((detailData.tanggal_jam || detailData.panels?.[0]?.tanggal_jam) ? `${detailData.tanggal_potong} ${(detailData.tanggal_jam || detailData.panels?.[0]?.tanggal_jam).includes("T") ? (detailData.tanggal_jam || detailData.panels?.[0]?.tanggal_jam).split("T")[1].split(".")[0] : ((detailData.tanggal_jam || detailData.panels?.[0]?.tanggal_jam).split(" ")[1] || "00:00:00")}` : detailData.tanggal_potong)) : "-"}
            statusMatching={detailData.status_matching || "-"}
            pick={detailData.pick || "-"}
            benangDasar={detailData.jenis_benang_dasar || "-"}
            liner={detailData.liner || "-"}
            heavy={detailData.heavy || "-"}
            shadow={detailData.shadow || "-"}
            pinggiran={detailData.pinggiran || "-"}
            tanggalProduksi={detailData.tanggal_jam || detailData.panels?.[0]?.tanggal_jam || detailData.created_at || detailData.tgl}
            course={detailData.course}
            rpm={detailData.rpm}
            potonganKe={detailData.potongan_ke}
      />


      {/* Downtime Info */}
      {detailData.total_downtime_detik > 0 && (
        <div className="mb-6 rounded-xl overflow-hidden border border-amber-200 shadow-sm">
          <div className="bg-amber-500 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Timer className="w-4 h-4 text-white shrink-0" />
              <span className="text-white text-xs font-black uppercase tracking-wide">Downtime Terdeteksi</span>
            </div>
            <span className="text-white font-black text-sm sm:text-base whitespace-nowrap">
              {formatDurationNice(detailData.total_downtime_detik)}
            </span>
          </div>
        </div>
      )}

      {/* Laporan Produksi Table */}
      <div className="pb-4">
          {(() => {
            // Group panels by pcs
            const pcsGroups: { [key: string]: any[] } = {};

            // Deduplicate by panel.id
            const uniqueById = new Map();
            (detailData.panels || []).forEach((panel: any) => {
              if (!uniqueById.has(panel.id)) {
                uniqueById.set(panel.id, { ...panel, production_details: [...(panel.production_details || [])] });
              }
            });

            // Deduplicate by panel_no for non-METERAN
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
                  // Merge production details
                  existing.production_details.push(...(panel.production_details || []));

                  // Merge downtime events
                  let existingDt: any[] = [];
                  try { existingDt = typeof existing.downtime_events === 'string' ? JSON.parse(existing.downtime_events) : (existing.downtime_events || []); } catch (e) { }
                  let newDt: any[] = [];
                  try { newDt = typeof panel.downtime_events === 'string' ? JSON.parse(panel.downtime_events) : (panel.downtime_events || []); } catch (e) { }
                  existing.downtime_events = [...existingDt, ...newDt];

                  // Update total PCS if the new one has more PCS
                  const existingPcs = parseInt(existing.pcs || "1");
                  const newPcs = parseInt(panel.pcs || "1");
                  if (newPcs > existingPcs) existing.pcs = newPcs.toString();
                } else {
                  seenPanelNo.set(key, panel);
                }
              }
            });

            finalPanels.push(...Array.from(seenPanelNo.values()));

             // Group finalPanels by operator to find the oldest panel ID for each operator
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

            // Sort keys numerically
            const sortedPcsKeys = Object.keys(pcsGroups).sort((a, b) => parseInt(a) - parseInt(b));
            if (sortedPcsKeys.length === 0) return null;

            const isMeterReport = detailData.panels?.some((p: any) => p.panel_no === "METERAN");

            return (
              <div className="mb-6">
                {!isMeterReport && (
                  <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    Rincian per Panel
                  </h4>
                )}
                <div className="w-full overflow-x-auto pb-4 custom-scrollbar bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex w-max min-w-full gap-8">
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

                      const isMeter = detailData.is_meter || panels.some((p: any) => p.panel_no === "METERAN");

                      return (
                        <div key={pcsKey} className="w-min flex-none bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 text-center">
                            <span className="font-black text-slate-800 text-sm tracking-wider uppercase">{pcsLabel}</span>
                          </div>
                          {isMeter ? (
                            <MeterHistoryTable panels={panels} pcsKey={pcsKey} />
                          ) : (
                            <PanelHistoryTable panels={panels} pcsKey={pcsKey} />
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Render Mechanic / Special Downtimes explicitly in Table format */}
        {(() => {
           const mechanicPanels = detailData.panels?.filter((p: any) => {
             return p.panel_no === "Downtime Mekanik (Direct)" || p.panel_no === "BERHENTI";
           });

           const generalPanels = detailData.panels?.filter((p: any) => {
             if (p.panel_no === "Downtime Mekanik (Direct)" || p.panel_no === "BERHENTI") return false;
             if (!p.pcs || parseInt(p.pcs) === 0) {
               let dtEvents: any[] = [];
               try { dtEvents = typeof p.downtime_events === 'string' ? JSON.parse(p.downtime_events) : (p.downtime_events || []); } catch(e){}
               if (dtEvents && dtEvents.length > 0) return true;
               if (p.downtime_records && p.downtime_records.length > 0) return true;
               if (p.total_downtime_detik && p.total_downtime_detik > 0) return true;
             }
             return false;
           });

            const cleanPenanggungJawab = (raw: string | undefined | null) => {
              if (!raw) return "Operator";
              const pkMatch = raw.match(/^Perbaikan Khusus\s*\((.*)\)$/i);
              if (pkMatch && pkMatch[1]) return pkMatch[1].trim();
              const opMatch = raw.match(/^Operator\s*\((.*)\)$/i);
              if (opMatch && opMatch[1]) return opMatch[1].trim();
              return raw.replace(/^Perbaikan Khusus\s*/i, "").replace(/^Operator\s*/i, "").trim() || raw;
            };

            const formatWibTime = (dateVal?: string): string => {
              if (!dateVal || dateVal === "-" || dateVal === "—") return "-";
              try {
                let str = String(dateVal).trim();
                if (!str) return "-";
                if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) {
                  return str.substring(0, 5);
                }

                if (str.includes(" ")) {
                  const timePart = str.split(" ")[1];
                  if (timePart && timePart.includes(":")) {
                    return timePart.substring(0, 5);
                  }
                }

                if (str.includes("T")) {
                  const timePart = str.split("T")[1];
                  if (timePart && timePart.includes(":")) {
                    return timePart.substring(0, 5);
                  }
                }

                const dt = new Date(str);
                if (isNaN(dt.getTime())) return "-";

                const hours = String(dt.getHours()).padStart(2, "0");
                const minutes = String(dt.getMinutes()).padStart(2, "0");
                return `${hours}:${minutes}`;
              } catch (e) {
                return "-";
              }
            };

            const renderSection = (sourcePanels: any[], title: string, subtitle: string, variant: "blue" | "amber") => {
              if (!sourcePanels || sourcePanels.length === 0) return null;
              const rows: any[] = [];
              sourcePanels.forEach((mp: any) => {
                let dtEvents: any[] = [];
                try { dtEvents = typeof mp.downtime_events === 'string' ? JSON.parse(mp.downtime_events) : (mp.downtime_events || []); } catch(e){}
                if (dtEvents && dtEvents.length > 0) {
                  dtEvents.forEach((ev: any, idx: number) => {
                    const rawTime = ev.waktu || ev.timestamp || mp.tanggal_jam || mp.created_at;
                    const timeStr = formatWibTime(rawTime);
                    if (ev.problems && ev.problems.length > 0) {
                      ev.problems.forEach((p: any, pIdx: number) => {
                        rows.push({
                          id: `${mp.id}-${idx}-${pIdx}`,
                          timeStr,
                          penanggungJawab: cleanPenanggungJawab(ev.dikerjakanOleh || mp.pic || mp.operators?.nama_operator),
                          shift: mp.grup || mp.groups?.nama_grup || ev.shift || "-",
                          durasiDisplay: formatDurationNice(ev.durasiDetik || mp.total_downtime_detik || 0),
                          kategori: p.kategori || ev.kategori || "-",
                          detailMasalah: (p.details && Array.isArray(p.details)) ? p.details.join(", ") : (p.details || ev.detail || "-"),
                        });
                      });
                    } else {
                      rows.push({
                        id: `${mp.id}-${idx}`,
                        timeStr,
                        penanggungJawab: cleanPenanggungJawab(ev.dikerjakanOleh || mp.pic || mp.operators?.nama_operator),
                        shift: mp.grup || mp.groups?.nama_grup || ev.shift || "-",
                        durasiDisplay: formatDurationNice(ev.durasiDetik || mp.total_downtime_detik || 0),
                        kategori: ev.kategori || "-",
                        detailMasalah: ev.detail || "-",
                      });
                    }
                  });
                } else if (mp.downtime_records && mp.downtime_records.length > 0) {
                  mp.downtime_records.forEach((dr: any, dIdx: number) => {
                    const rawTime = dr.waktu || dr.created_at || dr.tanggal_jam || mp.tanggal_jam;
                    const timeStr = formatWibTime(rawTime);
                    rows.push({
                      id: `${mp.id}-dr-${dIdx}`,
                      timeStr,
                      penanggungJawab: cleanPenanggungJawab(dr.dikerjakan_oleh || mp.pic || mp.operators?.nama_operator),
                      shift: mp.grup || mp.groups?.nama_grup || "-",
                      durasiDisplay: formatDurationNice(dr.durasi_detik || mp.total_downtime_detik || 0),
                      kategori: dr.kategori || "-",
                      detailMasalah: dr.detail || "-",
                    });
                  });
                } else if (mp.total_downtime_detik > 0) {
                  const rawTime = mp.tanggal_jam || mp.created_at;
                  const timeStr = formatWibTime(rawTime);
                  rows.push({
                    id: `${mp.id}-fallback`,
                    timeStr,
                    penanggungJawab: cleanPenanggungJawab(mp.pic || mp.operators?.nama_operator),
                    shift: mp.grup || mp.groups?.nama_grup || "-",
                    durasiDisplay: formatDurationNice(mp.total_downtime_detik || 0),
                    kategori: mp.kategori_masalah || "-",
                    detailMasalah: mp.detail_masalah || "-",
                  });
                }
              });

             if (rows.length === 0) return null;

             const bgHeader = variant === "blue" 
                ? "linear-gradient(135deg, #0a1628 0%, #0b3068 60%, #0070bc 100%)"
                : "linear-gradient(135deg, #451a03 0%, #9a3412 60%, #f59e0b 100%)";
             const iconBg = variant === "blue" ? "bg-white/15 border-white/20" : "bg-white/15 border-white/20";
             const titleColor = "text-white";
             const subtitleColor = variant === "blue" ? "text-sky-200" : "text-amber-100";
             const dotColor = variant === "blue" ? "bg-[#0070bc]" : "bg-amber-500";

             return (
               <div className="mt-8 rounded-2xl overflow-hidden shadow-md border border-slate-200">
                 {/* Section Header */}
                 <div className="px-6 py-4 flex items-center gap-3" style={{ background: bgHeader }}>
                   <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${iconBg}`}>
                     <Wrench className="w-4.5 h-4.5 text-white" />
                   </div>
                   <div>
                     <h3 className={`text-sm font-black tracking-tight ${titleColor}`}>
                       {title}
                     </h3>
                     <p className={`text-[10px] font-semibold ${subtitleColor}`}>
                       {subtitle}
                     </p>
                   </div>
                   <div className="ml-auto bg-white/20 border border-white/30 rounded-full px-3 py-1 text-[10px] font-black text-white">
                     {rows.length} laporan
                   </div>
                 </div>

                 {/* Cards */}
                 <div className="bg-slate-50/60 divide-y divide-slate-100">
                   {rows.map((row) => (
                     <div key={row.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-slate-50 transition-colors">
                       {/* Time */}
                       <div className="flex items-center gap-2 shrink-0 w-20">
                         <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                         <span className="text-sm font-black text-slate-800">{row.timeStr}</span>
                       </div>

                       {/* Penanggung Jawab */}
                       <div className="flex items-center gap-2 sm:w-48 shrink-0">
                         <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                           {row.penanggungJawab.charAt(0).toUpperCase()}
                         </div>
                         <div className="flex flex-col">
                           <span className="text-xs font-bold text-slate-700 leading-tight">{row.penanggungJawab}</span>
                           <span className="text-[10px] text-slate-400">Penanggung Jawab</span>
                         </div>
                       </div>

                       {/* Shift */}
                       <div className="shrink-0">
                         <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-[#0070bc] text-white tracking-wide">
                           {row.shift}
                         </span>
                       </div>

                       {/* Durasi & Kategori - Pushed to Right on Desktop */}
                       <div className="flex flex-col sm:flex-row sm:items-center sm:ml-auto gap-3 sm:gap-6 mt-2 sm:mt-0">
                         <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-md border border-red-100 shrink-0 self-start sm:self-auto">
                           <Clock className="w-3.5 h-3.5" />
                           <span className="text-xs font-black">{row.durasiDisplay}</span>
                         </div>
                          <div className="flex flex-col sm:items-end">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-700 text-xs font-extrabold">
                                {row.kategori === "-" ? "Problem" : `Kategori ${row.kategori}`}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-700 font-medium mt-1 max-w-[200px] sm:text-right truncate">
                              {row.detailMasalah}
                            </span>
                          </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             );
           };

           return (
             <>
               {renderSection(generalPanels, "Laporan Downtime Umum", "Downtime singkat tanpa spesifik PCS", "amber")}
               {renderSection(mechanicPanels, "Laporan Downtime Khusus", "Mesin berhenti total — tanpa produksi", "blue")}
             </>
           );
         })()}

       </div>

      <PrintableProductionReport
        detailData={detailData}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
      />
    </div>
  );
}

export default function HistoryDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-[#0070bc] mb-4" />
        <span className="text-slate-500 font-medium">Memuat Halaman...</span>
      </div>
    }>
      <HistoryDetailContent />
    </Suspense>
  );
}

