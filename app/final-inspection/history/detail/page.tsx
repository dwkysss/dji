"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardCheck,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import CompactHeaderCard from "@/components/forms/CompactHeaderCard";
import { getFinalInspectionBatchById } from "@/actions/final-inspection-actions";
import { calculateOverallGradeData } from "@/lib/mending-grade-utils";
import { formatDefectLinesWithNumbering } from "@/lib/defect-format-utils";

function FinalInspectionDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [batch, setBatch] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setErrorMsg("ID Batch tidak ditemukan.");
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      const res = await getFinalInspectionBatchById(id);
      if (res.success) {
        setBatch(res.batch);
        setItems(res.items || []);
      } else {
        setErrorMsg(res.error || "Gagal memuat rincian batch final inspek.");
      }
      setIsLoading(false);
    };

    loadData();
  }, [id]);

  const firstHeader = items[0]?.production_details?.production_headers || {};
  const isMeteran = firstHeader.panel_no === "METERAN";

  const overallGradeData = React.useMemo(() => {
    return calculateOverallGradeData(
      items.map((i: any) => ({
        ...i.production_details,
        hasil_final: i.hasil_final || "A",
      })),
      isMeteran
    );
  }, [items, isMeteran]);

  const displayItems = React.useMemo(() => {
    if (!items || items.length === 0) return [];
    
    const sorted = [...items].sort((a, b) => {
      const pAStr = String(a.production_details?.production_headers?.panel_no || "").trim().toUpperCase();
      const pBStr = String(b.production_details?.production_headers?.panel_no || "").trim().toUpperCase();

      const isAwalA = pAStr.includes("AWAL");
      const isAwalB = pBStr.includes("AWAL");
      if (isAwalA && !isAwalB) return -1;
      if (!isAwalA && isAwalB) return 1;

      const isAkhirA = pAStr.includes("AKHIR");
      const isAkhirB = pBStr.includes("AKHIR");
      if (isAkhirA && !isAkhirB) return 1;
      if (!isAkhirA && isAkhirB) return -1;

      const pA = parseInt(pAStr || "0");
      const pB = parseInt(pBStr || "0");
      if (pA !== pB) return pA - pB;

      const isQcA = !!a.production_details?.isPanelInsertedByQc || !!a.production_details?.keterangan_cacat?.includes("[TAMBAHAN QC]") || (!!a.production_details?.keterangan_qc && a.production_details?.keterangan_qc !== "-");
      const isQcB = !!b.production_details?.isPanelInsertedByQc || !!b.production_details?.keterangan_cacat?.includes("[TAMBAHAN QC]") || (!!b.production_details?.keterangan_qc && b.production_details?.keterangan_qc !== "-");
      if (!isQcA && isQcB) return -1;
      if (isQcA && !isQcB) return 1;

      return String(a.id || "").localeCompare(String(b.id || ""));
    });

    const processed = sorted.map((it) => {
      const d = it.production_details || {};
      const h = d.production_headers || {};
      const oprBase = h.operators?.nama_operator || h.pic || "";
      const grp = h.groups?.nama_grup || "";
      const tgl = h.tgl || "";
      const operatorStr = (grp ? `(${grp}) ` : '') + oprBase;

      let extractedBackupOp = h.operator_backup || "";
      if (!extractedBackupOp && d.keterangan_cacat) {
        const match = d.keterangan_cacat.match(/\(Backup:\s*([^)]+)\)/i);
        if (match && match[1]) extractedBackupOp = match[1].trim();
      }

      const isIstirahat = !!extractedBackupOp || (d.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT");
      const hasIstirahat = isIstirahat;

      let displayKeterangan = d.keterangan_cacat || "";
      if (displayKeterangan.includes("ISTIRAHAT") || !!extractedBackupOp) {
        displayKeterangan = displayKeterangan.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
        displayKeterangan = displayKeterangan.replace(/\(?Backup:\s*[^)]+\)?/gi, "").trim();
        displayKeterangan = displayKeterangan.replace(/^,\s*|\s*,\s*$/g, "");
      }

      const rawPanelNo = h.panel_no || "-";
      const isBsAwal = String(rawPanelNo).toUpperCase().includes("AWAL");
      const isBsAkhir = String(rawPanelNo).toUpperCase().includes("AKHIR");
      const isSisa = isBsAwal || isBsAkhir;

      let ketCacat = displayKeterangan;
      ketCacat = ketCacat.replace(/\[TAMBAHAN QC\]/gi, "").trim();
      ketCacat = ketCacat.replace(/\[TAMBAHAN MENDING\]/gi, "").trim();
      ketCacat = ketCacat.replace(/^,\s*|\s*,\s*$/g, "").trim();

      let cacatLines: string[] = [];
      if (isSisa) {
        cacatLines = [isBsAwal ? "Sisa Awal Potongan" : "Sisa Akhir Potongan"];
      } else if (d.production_defects && Array.isArray(d.production_defects) && d.production_defects.length > 0) {
        const groupedMap = new Map<string, Set<string>>();
        const orderList: string[] = [];

        d.production_defects.forEach((def: any) => {
          if ((def.kategori || "").toUpperCase().includes("ISTIRAHAT") || (def.detail || "").toUpperCase().includes("ISTIRAHAT")) return;
          const k = def.kategori || "";
          const det = def.detail || "";
          const key = k && det ? `${k} - ${det}` : (k || det);
          if (!key) return;

          if (!groupedMap.has(key)) {
            groupedMap.set(key, new Set<string>());
            orderList.push(key);
          }

          if (def.blok) {
            const cleanB = String(def.blok).replace(/blok\s*/gi, "").trim();
            if (cleanB) {
              cleanB.split(",").forEach((bStr) => {
                const trimmed = bStr.trim();
                if (trimmed) groupedMap.get(key)!.add(trimmed);
              });
            }
          }
        });

        cacatLines = orderList.map((key) => {
          const blocks = Array.from(groupedMap.get(key) || []);
          if (blocks.length > 0) {
            return `${key} (Blok ${blocks.join(", ")})`;
          }
          return key;
        });

        if (cacatLines.length === 0 && ketCacat) {
          cacatLines.push(ketCacat);
        }
      } else if (d.detail_masalah || d.kategori_masalah) {
        const k = d.kategori_masalah || "";
        const det = d.detail_masalah || "";
        if (k && det) cacatLines.push(`${k} - ${det}`);
        else if (det) cacatLines.push(det);
        else if (k) cacatLines.push(k);
      } else if (ketCacat) {
        cacatLines.push(ketCacat);
      }

      cacatLines = formatDefectLinesWithNumbering(cacatLines);

      return {
        ...it,
        detail: d,
        header: h,
        oprBase,
        opr: oprBase,
        grp,
        tgl,
        operatorStr,
        extractedBackupOp,
        isIstirahat,
        hasIstirahat,
        isBsAwal,
        isBsAkhir,
        isSisa,
        rawPanelNo,
        cacatLines,
        hasilFinal: it.hasil_final || "A",
      };
    });

    const result: any[] = [];
    let currentOpCount = 0;
    let currentOpA = 0;
    let currentOpB = 0;
    let currentOpBS = 0;
    let firstRowTgl = "";
    let lastTgl = "";
    let lastGrp = "";
    let lastOpr = "";

    processed.forEach((p, idx) => {
      const isDeleted = !!p.detail.is_deleted || p.detail.status_inspeksi === "Dihapus" || (p.detail.keterangan_cacat || "").includes("[DIHAPUS]");
      const isBS = p.detail.jml_hasil_produksi === 0 || p.detail.status_inspeksi === "BS";
      if (!isBS && !isDeleted) {
        currentOpCount += 1;
      }
      if (p.hasilFinal === "A") currentOpA += 1;
      else if (p.hasilFinal === "B") currentOpB += 1;
      else if (p.hasilFinal === "BS" || isBS) currentOpBS += 1;

      let showTgl = false;
      let showGrp = false;
      let showOpr = false;

      if (idx === 0) {
        showTgl = true;
        showGrp = true;
        showOpr = true;
        firstRowTgl = p.tgl;
      } else {
        if (p.oprBase !== lastOpr) {
          showTgl = true;
          showGrp = true;
          showOpr = true;
        } else if (p.tgl !== firstRowTgl && p.tgl !== lastTgl) {
          showTgl = true;
        }
      }

      lastTgl = p.tgl;
      lastGrp = p.grp;
      lastOpr = p.oprBase;

      result.push({
        ...p,
        showTgl,
        showGrp,
        showOpr,
      });

      let nextOprStr = null;
      if (idx + 1 < processed.length) {
        nextOprStr = processed[idx + 1].operatorStr;
      }

      if (nextOprStr === null || nextOprStr !== p.operatorStr) {
        if (currentOpCount > 0) {
          const [prevGrp, prevOpr] = p.operatorStr.includes(") ") 
            ? [p.operatorStr.match(/\(([^)]+)\)/)?.[1] || "", p.operatorStr.replace(/^\([^)]+\)\s*/, "")]
            : ["", p.operatorStr];

          result.push({
            id: `total-${p.operatorStr}-${Math.random()}`,
            isTotalRow: true,
            totalLabel: `Total Produksi (${prevGrp}) ${prevOpr}:`,
            totalCount: currentOpCount,
            countA: currentOpA,
            countB: currentOpB,
            countBS: currentOpBS,
          });
        }
        currentOpCount = 0;
        currentOpA = 0;
        currentOpB = 0;
        currentOpBS = 0;
      }
    });

    return result;
  }, [items]);

  const panelCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    displayItems.forEach((it) => {
      if (it.isTotalRow) return;
      const isDeleted = !!it.detail?.is_deleted || it.detail?.status_inspeksi === "Dihapus" || (it.detail?.keterangan_cacat || "").includes("[DIHAPUS]");
      if (isDeleted) return;
      const clean = String(it.rawPanelNo || "-").replace(/\s*\((BS|GAGAL)\)/gi, "").trim();
      if (clean && clean !== "-" && !clean.toUpperCase().includes("AWAL") && !clean.toUpperCase().includes("AKHIR")) {
        counts[clean] = (counts[clean] || 0) + 1;
      }
    });
    return counts;
  }, [displayItems]);

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400 flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <span className="text-sm font-medium">Memuat detail riwayat final inspek...</span>
      </div>
    );
  }

  if (errorMsg || !batch) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-6 bg-red-50 border border-red-200 rounded-3xl text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-red-800">Gagal Memuat Data</h2>
        <p className="text-sm text-red-600">{errorMsg || "Data batch tidak ditemukan."}</p>
        <button
          onClick={() => router.push("/final-inspection/history")}
          className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all shadow-sm cursor-pointer"
        >
          Kembali ke Riwayat
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto pb-20 animate-fadeIn space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/final-inspection/history")}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Riwayat</span>
        </button>
        <span className="text-xs text-slate-400 font-bold">ID Batch: #{batch.id}</span>
      </div>

      {/* Header Info & Overall Grade Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CompactHeaderCard
            nomorMc={batch.nomor_mc || "-"}
            shiftName="-"
            operatorName="-"
            design={batch.design_id || "-"}
            pcsCount={items.length || 0}
            panelPotongan={`- / ${batch.potongan_ke || "-"}`}
            courseRpm={`${firstHeader.course || "-"} / ${firstHeader.rpm || "-"}`}
            noCustomer={firstHeader.no_customer || firstHeader.no_order_barang || "-"}
            noOrder={firstHeader.no_order_barang || "-"}
            tanggalPotong={batch.tanggal_final || "-"}
            statusMatching={firstHeader.status_matching || "OK"}
            pick={firstHeader.pick || "-"}
            benangDasar={firstHeader.jenis_benang_dasar || "-"}
            liner={firstHeader.liner || "-"}
            heavy={firstHeader.heavy || "-"}
            shadow={firstHeader.shadow || "-"}
            pinggiran={firstHeader.pinggiran || "-"}
          />
        </div>

        <div className="bg-linear-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-emerald-200">
              Grade Keseluruhan Final
            </span>
            <span className="text-[11px] bg-white/20 px-2.5 py-0.5 rounded-full font-bold">
              {overallGradeData.totalQty} {isMeteran ? "Meter" : "Panel"}
            </span>
          </div>
          <div className="my-2 flex items-baseline gap-3">
            <span className="text-5xl font-black tracking-tight">{overallGradeData.overallGrade}</span>
            <span className="text-xs text-emerald-100">
              Total Cacat: <strong>{overallGradeData.totalCacat}</strong> {isMeteran ? "titik" : "panel"}
            </span>
          </div>
          <div className="text-[11px] text-emerald-100/80 border-t border-white/10 pt-2 flex items-center justify-between">
            <span>Petugas Final: <strong>{batch.petugas_final || "-"}</strong></span>
            <span>Waktu: <strong>{batch.start_final || "-"} - {batch.finish_final || "-"}</strong></span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-[#0070bc]" />
            Daftar Panel / Titik ({items.length} Baris)
          </h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-emerald-600 font-black">Grade A: {batch.final_grade_a || 0}</span>
            <span className="text-amber-600 font-black">Grade B: {batch.final_grade_b || 0}</span>
            <span className="text-rose-600 font-black">BS: {batch.final_grade_bs || 0}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-20 bg-slate-50 px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-12 text-center border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" rowSpan={2}>PNL NO</th>
                <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-20 text-center whitespace-nowrap border-r border-slate-100" rowSpan={2}>TGL</th>
                <th className="px-1.5 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-12 text-center border-r border-slate-100" rowSpan={2}>Group</th>
                <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-24 text-center border-r border-slate-100" rowSpan={2}>Operator</th>
                <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-14 text-center border-r border-slate-100" rowSpan={2}>KET ✓/X</th>
                <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 min-w-[160px] w-full text-center border-r border-slate-100" rowSpan={2}>KETERANGAN CACAT & MENDING</th>
                <th className="px-1 py-1 border-b border-slate-200 font-extrabold text-slate-600 text-center border-r border-slate-100" colSpan={3}>FINAL INSPEK</th>
              </tr>
              <tr className="bg-slate-50">
                <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-emerald-600 border-r border-slate-100 w-16">A</th>
                <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-amber-600 border-r border-slate-100 w-16">B</th>
                <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-rose-600 border-r border-slate-100 w-16">BS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {displayItems.map((item, index) => {
                if (item.isTotalRow) {
                  return (
                    <tr key={item.id || index} className="bg-slate-100 border-t border-b border-slate-200 font-semibold text-slate-700">
                      <td colSpan={4} className="sticky left-0 z-10 bg-slate-100 px-3 py-2 text-right whitespace-nowrap border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        {item.totalLabel}
                      </td>
                      <td className="px-1 py-2 text-center text-slate-800 font-extrabold whitespace-nowrap border-r border-slate-100">
                        {item.totalCount} Panel
                      </td>
                      <td colSpan={1} className="bg-slate-100 border-r border-slate-100"></td>
                      <td className="px-1 py-2 text-center text-emerald-600 bg-emerald-50/20 font-black border-r border-slate-100 w-16">
                        {item.countA}
                      </td>
                      <td className="px-1 py-2 text-center text-amber-600 bg-amber-50/20 font-black border-r border-slate-100 w-16">
                        {item.countB}
                      </td>
                      <td className="px-1 py-2 text-center text-rose-600 bg-rose-50/20 font-black w-16">
                        {item.countBS}
                      </td>
                    </tr>
                  );
                }

                const d = item.detail || {};
                const isDeleted = !!d.is_deleted || d.status_inspeksi === "Dihapus" || (d.keterangan_cacat || "").includes("[DIHAPUS]");
                const cleanPanelNo = (item.rawPanelNo || "-").replace(/\s*\((BS|GAGAL)\)/gi, "").trim();

                const isPanelInsertedByQc = !!d.isPanelInsertedByQc || !!d.keterangan_cacat?.includes("[TAMBAHAN QC]") || (String(item.rawPanelNo || "").includes("QC"));
                const hasTambahanQC = !!d.detail_masalah?.includes("[QC]") || (d.production_defects && d.production_defects.some((def: any) => def.detail?.includes("[QC]")));
                const hasTambahanMnd = !!d.keterangan_cacat?.includes("[TAMBAHAN MENDING]");
                const isRowQcModified = isPanelInsertedByQc || hasTambahanQC || hasTambahanMnd || (!!d.keterangan_qc && d.keterangan_qc !== "-");

                const rowBgClass = isDeleted
                  ? "bg-slate-100/60 opacity-80"
                  : isRowQcModified
                  ? "bg-sky-50/90 hover:bg-sky-100/60 border-y border-sky-200"
                  : (item.isIstirahat || item.hasIstirahat)
                  ? "bg-amber-50/30 hover:bg-amber-50/50"
                  : "bg-white hover:bg-slate-50";

                const stickyCellBgClass = isDeleted
                  ? "bg-slate-100"
                  : isRowQcModified
                  ? "bg-sky-100/70"
                  : (item.isIstirahat || item.hasIstirahat)
                  ? "bg-[#fffbeb]"
                  : "bg-white";

                const isDouble = !isDeleted && !item.isBsAwal && !item.isBsAkhir && (panelCounts[cleanPanelNo] || 0) > 1;

                let hasError = false;
                if (item.isBsAwal || item.isBsAkhir || d.jml_hasil_produksi === 0 || d.status_inspeksi === "BS") {
                  hasError = true;
                } else if (d.production_defects && d.production_defects.length > 0) {
                  hasError = d.production_defects.some((def: any) => {
                    const k = (def.kategori || "").toUpperCase().trim();
                    const det = (def.detail || "").toUpperCase().trim();
                    if (k.includes("ISTIRAHAT") || det.includes("ISTIRAHAT")) return false;
                    return true;
                  });
                } else if (d.kategori_masalah || d.detail_masalah || isRowQcModified) {
                  hasError = true;
                }

                return (
                  <tr key={item.id || index} className={`${rowBgClass} transition-colors`}>
                    <td className={`sticky left-0 z-10 px-2 py-1.5 font-bold text-slate-800 text-center border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${stickyCellBgClass}`}>
                      {item.isBsAwal ? (
                        <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded leading-none shadow-sm whitespace-nowrap">BS AWAL</span>
                      ) : item.isBsAkhir ? (
                        <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded leading-none shadow-sm whitespace-nowrap">BS AKHIR</span>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <span>{cleanPanelNo}</span>
                          {isDeleted ? (
                            <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded mt-0.5 leading-none shadow-sm border border-rose-200">
                              DIHAPUS
                            </span>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5 mt-0.5">
                              {isDouble && (
                                <span className="text-[8px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded leading-none border border-amber-300 shadow-2xs">
                                  DOUBLE
                                </span>
                              )}
                              {(String(item.rawPanelNo).includes("(BS)") || d.jml_hasil_produksi === 0 || d.status_inspeksi === "BS") ? (
                                <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded leading-none shadow-sm border border-rose-200">BS</span>
                              ) : isRowQcModified ? (
                                <span className="text-[8px] font-black bg-sky-100 text-[#0070bc] px-1.5 py-0.5 rounded leading-none border border-sky-300 shadow-2xs">+ QC</span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1 text-slate-600 text-center whitespace-nowrap border-r border-slate-100">
                      {item.showTgl ? item.tgl : ""}
                    </td>
                    <td className="px-1.5 py-1 font-medium text-slate-700 text-center border-r border-slate-100">
                      {item.showGrp ? item.grp : ""}
                    </td>
                    <td className={`px-2 py-1 leading-tight text-center border-r border-slate-100 ${(!item.showOpr && item.hasIstirahat) ? "italic font-bold text-amber-600" : "font-medium text-slate-700"}`}>
                      {item.showOpr ? (item.oprBase || item.grp || "-") : (item.hasIstirahat ? "Istirahat" : "")}
                    </td>
                    <td className="px-2 py-1 text-center font-bold text-sm border-r border-slate-100">
                      {isDeleted ? <span className="text-slate-400 font-bold">-</span> : hasError ? <span className="text-rose-600">X</span> : <span className="text-emerald-600">✓</span>}
                    </td>
                    <td className="px-2 py-1 text-[11px] font-medium whitespace-pre-line leading-tight border-r border-slate-100">
                      {item.extractedBackupOp && item.hasIstirahat && (
                        <div className="text-slate-700 font-bold mb-0.5">{item.extractedBackupOp}</div>
                      )}
                      {item.cacatLines && item.cacatLines.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {item.cacatLines.map((line: string, lIdx: number) => {
                            const isQcLine = line.includes("[QC]") || line.includes("[TAMBAHAN QC]") || line.includes("[TAMBAHAN MENDING]");
                            return (
                              <div
                                key={lIdx}
                                className={
                                  isQcLine
                                    ? "text-[#0070bc] font-semibold"
                                    : "text-rose-600 font-medium"
                                }
                              >
                                {line}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                      {d.keterangan_qc && d.keterangan_qc !== "-" && (
                        <div className="text-[#0070bc] bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5 font-bold text-[10px] mt-0.5 shadow-2xs flex items-center gap-1 w-fit">
                          <span className="text-[#0070bc] font-black">QC:</span> {d.keterangan_qc}
                        </div>
                      )}
                    </td>
                    <td className="px-1 py-1 text-center border-r border-slate-100 w-16">
                      {item.hasilFinal === "A" && (
                        <div className="w-7 h-7 mx-auto flex items-center justify-center rounded-md border border-emerald-500 bg-emerald-100 text-emerald-700 shadow-xs font-bold text-xs">
                          A
                        </div>
                      )}
                    </td>
                    <td className="px-1 py-1 text-center border-r border-slate-100 w-16">
                      {item.hasilFinal === "B" && (
                        <div className="w-7 h-7 mx-auto flex items-center justify-center rounded-md border border-amber-500 bg-amber-100 text-amber-700 shadow-xs font-bold text-xs">
                          B
                        </div>
                      )}
                    </td>
                    <td className="px-1 py-1 text-center w-16">
                      {item.hasilFinal === "BS" && (
                        <div className="w-7 h-7 mx-auto flex items-center justify-center rounded-md border border-rose-500 bg-rose-100 text-rose-700 shadow-xs font-black text-xs">
                          BS
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              <tr className="bg-slate-50 font-bold border-t border-slate-200 text-xs text-slate-700 uppercase tracking-wider">
                <td className="px-2 py-3 text-right font-extrabold border-r border-slate-100" colSpan={6}>
                  TOTAL ({batch.total_panel || items.length} PANEL):
                </td>
                <td className="px-1 py-3 text-center text-emerald-600 bg-emerald-50/40 font-black border-r border-slate-100 w-16">
                  {batch.final_grade_a || 0}
                </td>
                <td className="px-1 py-3 text-center text-amber-600 bg-amber-50/40 font-black border-r border-slate-100 w-16">
                  {batch.final_grade_b || 0}
                </td>
                <td className="px-1 py-3 text-center text-rose-600 bg-rose-50/40 font-black w-16">
                  {batch.final_grade_bs || 0}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function FinalInspectionDetailPage() {
  return (
    <Suspense fallback={
      <div className="py-24 text-center text-slate-400 flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <span className="text-sm font-medium">Memuat halaman...</span>
      </div>
    }>
      <FinalInspectionDetailContent />
    </Suspense>
  );
}
