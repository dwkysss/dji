"use client";

import React from "react";
import { Eye, Trash2, CheckCircle, X, Edit3, Plus } from "lucide-react";
import { PROBLEM_DETAILS } from "@/lib/constants";

import { formatDefectLinesWithNumbering } from "@/lib/defect-format-utils";

export default function PanelQCTable({
  detailsToDisplay,
  handleSelectGrade,
  handleOpenDetail,
  handleOpenEditQC,
  handleOpenAddQC,
  selections,
  setDetailToDelete,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
}: {
  detailsToDisplay: any[];
  handleSelectGrade: (id: string, grade: number) => void;
  handleOpenDetail: (headerId: string) => void;
  handleOpenEditQC?: (detail: any) => void;
  handleOpenAddQC?: (detail: any) => void;
  selections: Record<string, number>;
  setDetailToDelete: (val: any) => void;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (selectAll: boolean) => void;
}) {
  const displayItems = React.useMemo(() => {
    const items: any[] = [];
    
    // Step 1: Pre-process items to identify operators and Istirahat
    const sorted = [...detailsToDisplay].sort((a, b) => {
      const pAStr = String(a.production_headers?.panel_no || "").trim().toUpperCase();
      const pBStr = String(b.production_headers?.panel_no || "").trim().toUpperCase();

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

      const isQcA = !!a.isPanelInsertedByQc || !!a.keterangan_cacat?.includes("[TAMBAHAN QC]") || !!a.keterangan_cacat?.includes("[TAMBAHAN MENDING]") || !!a.hasTambahanQC || !!a.hasTambahanMnd || (!!a.keterangan_qc && a.keterangan_qc !== "-");
      const isQcB = !!b.isPanelInsertedByQc || !!b.keterangan_cacat?.includes("[TAMBAHAN QC]") || !!b.keterangan_cacat?.includes("[TAMBAHAN MENDING]") || !!b.hasTambahanQC || !!b.hasTambahanMnd || (!!b.keterangan_qc && b.keterangan_qc !== "-");
      if (!isQcA && isQcB) return -1;
      if (isQcA && !isQcB) return 1;

      const diffJml = (b.jml_hasil_produksi || 0) - (a.jml_hasil_produksi || 0);
      if (diffJml !== 0) return diffJml;

      const timeA = new Date(a.created_at || a.created_date || 0).getTime();
      const timeB = new Date(b.created_at || b.created_date || 0).getTime();
      if (timeA !== timeB && !isNaN(timeA) && !isNaN(timeB)) return timeA - timeB;

      return String(a.id || "").localeCompare(String(b.id || ""));
    });

    const processed = sorted.map((item) => {
      const h = item.production_headers || {};
      const oprBase = h.operators?.nama_operator || h.pic || h.created_by_name || "";
      const opr = h.operator_backup ? `${oprBase} (Backup: ${h.operator_backup})` : oprBase;
      const grp = h.groups?.nama_grup || "";
      const tgl = h.tgl || "";
      const operatorStr = (grp ? `(${grp}) ` : '') + oprBase;

      const isIstirahatOnly = (!!item.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") || 
                           !!item.kategori_masalah?.toUpperCase().includes("ISTIRAHAT")) && 
                          !item.kategori_masalah && !item.detail_masalah;
      const hasIstirahat = !!item.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") || 
                           !!item.kategori_masalah?.toUpperCase().includes("ISTIRAHAT") ||
                           !!h.operator_backup ||
                           !!h.operators?.nama_operator?.toUpperCase().includes("ISTIRAHAT") ||
                           !!h.pic?.toUpperCase().includes("ISTIRAHAT");

      return {
        item,
        isIstirahatOnly,
        hasIstirahat,
        oprBase,
        opr,
        grp,
        tgl,
        operatorStr,
      };
    });

    // Step 2: Build the final list with total rows
    let currentOpCount = 0;
    let firstRowTgl = "";
    let lastTgl = "";
    let lastGrp = "";
    let lastOpr = "";

    processed.forEach((p, i) => {
      const { item, isIstirahatOnly, hasIstirahat, oprBase, opr, grp, tgl, operatorStr } = p;

      const isDeleted = !!item.is_deleted || item.status_inspeksi === "Dihapus" || (item.keterangan_cacat || "").includes("[DIHAPUS]");
      const isBS = item.jml_hasil_produksi === 0 || item.status_inspeksi === "BS";
      if (!isBS && !isDeleted) {
        currentOpCount += 1;
      }

      let showTgl = false;
      let showGrp = false;
      let showOpr = false;

      if (i === 0) {
        // Baris pertama data: Tanggal, Group, dan Operator WAJIB terisi (Rule 1)
        showTgl = true;
        showGrp = true;
        showOpr = true;
        firstRowTgl = tgl;
      } else {
        // Jika beda operator (Rule 2, 3, 4): Tanggal, Group, dan Operator ditampilkan di baris pertama data operator tersebut
        if (oprBase !== lastOpr) {
          showTgl = true;
          showGrp = true;
          showOpr = true;
        } else if (tgl !== firstRowTgl && tgl !== lastTgl) {
          // Kolom tanggal juga ditampilkan jika tanggalnya berbeda
          showTgl = true;
        }
      }

      lastTgl = tgl;
      lastGrp = grp;
      lastOpr = oprBase;

      items.push({
        ...item,
        isMeter: false,
        isStartRow: false,
        isIstirahatOnly: isIstirahatOnly,
        hasIstirahat: hasIstirahat,
        isFinishReport: false,
        displayNo: item.production_headers?.panel_no || "-",
        meterDisplay: "-",
        cacatDisplay: item.detail_masalah || item.keterangan_cacat || "-",
        isGradable: !isDeleted,
        showTgl,
        showGrp,
        showOpr,
        oprBase,
        hasErrorDetail: !!item.kategori_masalah || !!item.detail_masalah
      });

      // Check if it's the last row in this operator's contiguous session
      let nextOprStr = null;
      if (i + 1 < processed.length) {
        nextOprStr = processed[i + 1].operatorStr;
      }

      if (nextOprStr === null || nextOprStr !== operatorStr) {
        // Push total row
        const [prevGrp, prevOpr] = operatorStr.includes(") ") 
          ? [operatorStr.match(/\(([^)]+)\)/)?.[1] || "", operatorStr.replace(/^\([^)]+\)\s*/, "")]
          : ["", operatorStr];

        let countPass = 0;
        let countDefect = 0;
        let countBS = 0;

        processed.forEach((itemP) => {
          if (itemP.operatorStr === operatorStr) {
            const isPDeleted = !!itemP.item.is_deleted || itemP.item.status_inspeksi === "Dihapus" || (itemP.item.keterangan_cacat || "").includes("[DIHAPUS]");
            if (isPDeleted) return;
            const sel = selections[itemP.item.id];
            if (sel === 1) countPass += 1;
            else if (sel === 3) countDefect += 1;
            else if (sel === 4 || itemP.item.jml_hasil_produksi === 0 || itemP.item.status_inspeksi === "BS") {
              countBS += 1;
            }
          }
        });

        items.push({
          id: `total-${operatorStr}-${Math.random()}`,
          isTotalRow: true,
          totalLabel: `Total Produksi (${prevGrp}) ${prevOpr}:`,
          totalCount: currentOpCount,
          countPass,
          countDefect,
          countBS,
        });
        currentOpCount = 0;
      }
    });

    return items;
  }, [detailsToDisplay, selections]);

  const panelCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    displayItems.forEach((it) => {
      if (it.isTotalRow) return;
      const isDeleted = !!it.is_deleted || it.status_inspeksi === "Dihapus" || (it.keterangan_cacat || "").includes("[DIHAPUS]");
      if (isDeleted) return;
      const clean = (it.displayNo || "-").replace(/\s*\((BS|GAGAL)\)/gi, "").trim();
      if (clean && clean !== "-" && !clean.toUpperCase().includes("AWAL") && !clean.toUpperCase().includes("AKHIR")) {
        counts[clean] = (counts[clean] || 0) + 1;
      }
    });
    return counts;
  }, [displayItems]);

  const { totalGradable, totalPass, totalDefect, totalBS } = React.useMemo(() => {
    let g = 0, p = 0, d = 0, bs = 0;
    detailsToDisplay.forEach((item) => {
      const isDeleted = !!item.is_deleted || item.status_inspeksi === "Dihapus" || (item.keterangan_cacat || "").includes("[DIHAPUS]");
      if (isDeleted) return;
      const isBS = item.jml_hasil_produksi === 0 || item.status_inspeksi === "BS";
      if (!isBS) {
        g += 1;
      }
      const sel = selections[item.id];
      if (sel === 1) p += 1;
      else if (sel === 3) d += 1;
      else if (sel === 4 || isBS) {
        bs += 1;
      }
    });
    return { totalGradable: g, totalPass: p, totalDefect: d, totalBS: bs };
  }, [detailsToDisplay, selections]);

  const allSelectableIds = React.useMemo(() => {
    return displayItems
      .filter((it) => !it.isTotalRow && !it.is_deleted && it.status_inspeksi !== "Dihapus")
      .map((it) => it.id);
  }, [displayItems]);

  const isAllSelected = allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedIds.includes(id));
  const isSomeSelected = allSelectableIds.some((id) => selectedIds.includes(id)) && !isAllSelected;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50">
            {onToggleSelect && (
              <th className="px-1.5 py-1.5 border-b border-slate-200 w-8 text-center border-r border-slate-100" rowSpan={2}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isSomeSelected;
                  }}
                  onChange={(e) => onSelectAll && onSelectAll(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                  title="Pilih Semua Panel"
                />
              </th>
            )}
            <th className="sticky left-0 z-20 bg-slate-50 px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-12 text-center border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" rowSpan={2}>PNL NO</th>
            <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-20 text-center whitespace-nowrap border-r border-slate-100" rowSpan={2}>TGL</th>
            <th className="px-1.5 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-12 text-center border-r border-slate-100" rowSpan={2}>Group</th>
            <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-24 text-center border-r border-slate-100" rowSpan={2}>Operator</th>
            <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-14 text-center border-r border-slate-100" rowSpan={2}>KET ✓/X</th>
            <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 min-w-[160px] w-full text-center border-r border-slate-100" rowSpan={2}>KETERANGAN CACAT</th>
            <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-16 text-center border-r border-slate-100" rowSpan={2}>AKSI</th>
            <th className="px-1 py-1 border-b border-slate-200 font-extrabold text-slate-600 text-center border-r border-slate-100" colSpan={3}>INSPEKSI QC</th>
          </tr>
          <tr className="bg-slate-50">
            <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-emerald-600 border-r border-slate-100 w-16">✓</th>
            <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-rose-600 border-r border-slate-100 w-16">X</th>
            <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-rose-600 border-r border-slate-100 w-16">BS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
          {displayItems.map((item, index) => {
            if (item.isTotalRow) {
              return (
                <tr key={item.id} className="bg-slate-100 border-t border-b border-slate-200 font-semibold text-slate-700">
                  <td colSpan={onToggleSelect ? 5 : 4} className="sticky left-0 z-10 bg-slate-100 px-3 py-2 text-right whitespace-nowrap border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    {item.totalLabel}
                  </td>
                  <td className="px-1 py-2 text-center text-slate-800 font-extrabold whitespace-nowrap border-r border-slate-100">
                    {item.totalCount} Panel
                  </td>
                  <td colSpan={2} className="bg-slate-100 border-r border-slate-100"></td>
                  <td className="px-1 py-2 text-center text-emerald-600 bg-emerald-50/20 font-black border-r border-slate-100 w-16">
                    {item.countPass}
                  </td>
                  <td className="px-1 py-2 text-center text-rose-600 bg-rose-50/20 font-black border-r border-slate-100 w-16">
                    {item.countDefect}
                  </td>
                  <td className="px-1 py-2 text-center text-rose-600 bg-rose-50/20 font-black w-16">
                    {item.countBS}
                  </td>
                </tr>
              );
            }

            let showTgl = item.showTgl;
            let showGrp = item.showGrp;
            let showOpr = item.showOpr;
            const tglStr = item.production_headers?.tgl || "-";
            const grpStr = item.production_headers?.groups?.nama_grup || "-";
            
            let displayKeterangan = item.keterangan_cacat || "";
            let displayDetail = item.detail_masalah || "";
            
            let isIstirahatOnly = item.isIstirahatOnly;
            let hasIstirahat = item.hasIstirahat;
            
            if (hasIstirahat) {
              displayKeterangan = displayKeterangan.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
              displayKeterangan = displayKeterangan.replace(/\(?Backup:\s*[^)]+\)?/gi, "").trim();
              displayKeterangan = displayKeterangan.replace(/^,\s*|\s*,\s*$/g, "");
            }
            const rawPanelNo = item.production_headers?.panel_no || item.displayNo || "-";
            const isBsAwal = String(rawPanelNo).toUpperCase().includes("AWAL");
            const isBsAkhir = String(rawPanelNo).toUpperCase().includes("AKHIR");
            const isSisa = isBsAwal || isBsAkhir;

            let cacatLines: string[] = [];
            
            if (isSisa) {
              cacatLines = [isBsAwal ? "Sisa Awal Potongan" : "Sisa Akhir Potongan"];
            } else if (item.production_defects && Array.isArray(item.production_defects) && item.production_defects.length > 0) {
              const groupedMap = new Map<string, Set<string>>();
              const orderList: string[] = [];

              item.production_defects.forEach((d: any) => {
                if ((d.kategori || "").toUpperCase().includes("ISTIRAHAT") || (d.detail || "").toUpperCase().includes("ISTIRAHAT")) return;
                const k = d.kategori || "";
                const det = d.detail || "";
                const key = k && det ? `${k} - ${det}` : (k || det);
                if (!key) return;

                if (!groupedMap.has(key)) {
                  groupedMap.set(key, new Set<string>());
                  orderList.push(key);
                }

                if (d.blok) {
                  const cleanB = String(d.blok).replace(/blok\s*/gi, "").trim();
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

              if (cacatLines.length === 0 || cacatLines.every((l) => !l.includes("(Blok"))) {
                let ketCacat = displayKeterangan.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
                ketCacat = ketCacat.replace(/\(?Backup:\s*[^)]+\)?/gi, "").trim();
                ketCacat = ketCacat.replace(/\[TAMBAHAN QC\]/gi, "").trim();
                ketCacat = ketCacat.replace(/^,\s*|\s*,\s*$/g, "").trim();
                if (ketCacat) {
                  const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
                  if (cleanB && !cleanB.toLowerCase().includes("backup") && !cleanB.toLowerCase().includes("istirahat") && cleanB !== "()" && cleanB !== "-") {
                    if (cacatLines.length === 0) {
                      cacatLines.push(`(Blok ${cleanB})`);
                    } else {
                      cacatLines = cacatLines.map((l) => (l.includes("[QC]") || l.includes("[TAMBAHAN QC]") || l.includes("[TAMBAHAN MENDING]")) ? l : `${l} (Blok ${cleanB})`);
                    }
                  }
                }
              }
            } else {
              const katsRaw = item.kategori_masalah;
              const kats = katsRaw ? (Array.isArray(katsRaw) ? katsRaw : katsRaw.split(",").map((s: string) => s.trim())) : [];
              
              const pushDetailsForCat = (k: string, d: string) => {
                if (!d) {
                  cacatLines.push(k);
                  return;
                }
                const knownDetailsForCat = PROBLEM_DETAILS[k] || [];
                const matchedDetails: string[] = [];
                let remainingD = d;
                
                const sortedKnown = [...knownDetailsForCat].sort((a, b) => b.length - a.length);
                sortedKnown.forEach(known => {
                  if (remainingD.includes(known)) {
                    matchedDetails.push(known);
                    remainingD = remainingD.replace(known, "");
                  }
                });
                
                if (matchedDetails.length > 0) {
                  const customParts = remainingD.split(",").map((s: string) => s.trim()).filter(Boolean);
                  matchedDetails.forEach(match => cacatLines.push(`${k} - ${match}`));
                  customParts.forEach(custom => cacatLines.push(`${k} - ${custom}`));
                } else {
                  const parts = d.split(",").map((s: string) => s.trim()).filter(Boolean);
                  parts.forEach(p => cacatLines.push(`${k} - ${p}`));
                }
              };
              
              if (kats.length > 0) {
                if (displayDetail) {
                  if (kats.length === 1) {
                    pushDetailsForCat(kats[0], displayDetail);
                  } else {
                    const parts = displayDetail.split(",").map((s: string) => s.trim()).filter(Boolean);
                    if (parts.length === kats.length) {
                      kats.forEach((k: string, idx: number) => {
                        pushDetailsForCat(k, parts[idx]);
                      });
                    } else {
                      kats.forEach((k: string) => {
                        pushDetailsForCat(k, displayDetail);
                      });
                    }
                  }
                } else {
                  cacatLines.push(kats.join(", "));
                }
              } else if (displayDetail) {
                cacatLines.push(displayDetail);
              }

              const hasDefectsArray = item.production_defects && Array.isArray(item.production_defects) && item.production_defects.length > 0;
              let ketCacat = item.keterangan_cacat || "";
              ketCacat = ketCacat.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
              ketCacat = ketCacat.replace(/\(?Backup:\s*[^)]+\)?/gi, "").trim();
              ketCacat = ketCacat.replace(/\[TAMBAHAN QC\]/gi, "").trim();
              ketCacat = ketCacat.replace(/^,\s*|\s*,\s*$/g, "").trim();
              if (ketCacat && !hasDefectsArray) {
                if (cacatLines.length > 0) {
                  const parts = ketCacat.split(",").map((s: string) => s.trim()).filter(Boolean);
                  if (cacatLines.length === 1 && parts.length > 1) {
                    const cleanAllBlocks = parts
                      .map((p: string) => p.replace(/blok\s*/gi, "").trim())
                      .filter((b: string) => b && !b.toLowerCase().includes("backup") && !b.toLowerCase().includes("istirahat"))
                      .join(", ");
                    if (cleanAllBlocks) {
                      cacatLines = cacatLines.map((line) =>
                        line.match(/\(Blok/i) ? line : `${line} (Blok ${cleanAllBlocks})`
                      );
                    }
                  } else {
                    cacatLines = cacatLines.map((line, i) => {
                      if (line.match(/\(Blok/i)) return line;
                      if (line.includes("[QC]") || line.includes("[TAMBAHAN QC]") || line.includes("[TAMBAHAN MENDING]")) return line;
                      const lineKat = line.includes(" - ") ? line.split(" - ")[0].trim() : "";
                      let partIndex = i;

                      const katsRaw2 = item.kategori_masalah;
                      const kats2 = katsRaw2 ? (Array.isArray(katsRaw2) ? katsRaw2 : katsRaw2.split(",").map((s: any) => s.trim())) : [];
                      if (lineKat && kats2.includes(lineKat)) {
                        partIndex = kats2.indexOf(lineKat);
                      }

                      if (partIndex < parts.length && parts[partIndex] && parts[partIndex] !== "") {
                        const cleanB = parts[partIndex].replace(/blok\s*/gi, "").trim();
                        if (cleanB && !cleanB.toLowerCase().includes("backup") && !cleanB.toLowerCase().includes("istirahat")) {
                          return line.match(/\(Blok/i) ? line : `${line} (Blok ${cleanB})`;
                        }
                      }
                      return line;
                    });
                  }
                } else {
                  const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
                  if (cleanB && !cleanB.toLowerCase().includes("backup") && !cleanB.toLowerCase().includes("istirahat") && cleanB !== "()" && cleanB !== "-") {
                    cacatLines.push(`(Blok ${cleanB})`);
                  }
                }
              }
            }

            cacatLines = formatDefectLinesWithNumbering(cacatLines);
            let cacat = cacatLines.join("\n");

            let extractedBackupOp = item.production_headers?.operator_backup || "";
            if (!extractedBackupOp && item.keterangan_cacat) {
              const match = item.keterangan_cacat.match(/\(Backup:\s*([^)]+)\)/i);
              if (match && match[1]) {
                extractedBackupOp = match[1].trim();
              }
            }
            const cleanPanelNo = String(rawPanelNo).replace(/\s*\((BS|GAGAL)\)/gi, "").trim();
            const isDeleted = !!item.is_deleted || item.status_inspeksi === "Dihapus" || (item.keterangan_cacat || "").includes("[DIHAPUS]");
            const isBsPanel = isBsAwal || isBsAkhir || (String(rawPanelNo).includes("(BS)")) || item.jml_hasil_produksi === 0 || item.status_inspeksi === "BS";
            const isPanelInsertedByQc = !!item.is_inserted_qc || !!item.keterangan_cacat?.includes("[TAMBAHAN QC]") || !!item.production_headers?.keterangan_cacat?.includes("[TAMBAHAN QC]") || (String(item.production_headers?.panel_no || "").includes("QC"));
            const hasTambahanQC = !!item.detail_masalah?.includes("[QC]") || (item.production_defects && item.production_defects.some((d: any) => d.detail?.includes("[QC]")));
            const hasTambahanMnd = !!item.keterangan_cacat?.includes("[TAMBAHAN MENDING]") || !!item.production_headers?.keterangan_cacat?.includes("[TAMBAHAN MENDING]");

            let hasRealError = false;
            if (isBsPanel) {
              hasRealError = true;
            } else if (item.production_defects && Array.isArray(item.production_defects) && item.production_defects.length > 0) {
              hasRealError = item.production_defects.some((d: any) => {
                const k = (d.kategori || "").toUpperCase().trim();
                const det = (d.detail || "").toUpperCase().trim();
                if (k.includes("ISTIRAHAT") || det.includes("ISTIRAHAT")) return false;
                if (det.includes("GAGAL CACAT") || k === "G") return false;
                return true;
              });
            } else {
              const katStr = (item.kategori_masalah || "").toUpperCase().trim();
              const detStr = (item.detail_masalah || "").toUpperCase().trim();
              if (katStr && katStr !== "G" && !katStr.includes("ISTIRAHAT") && !katStr.includes("GAGAL CACAT")) {
                hasRealError = true;
              }
              if (detStr && !detStr.includes("ISTIRAHAT") && !detStr.includes("START") && !detStr.includes("FINISH") && !detStr.includes("GAGAL CACAT")) {
                hasRealError = true;
              }
            }
            if (hasTambahanQC) hasRealError = true;

            const hasError = hasRealError;
            const isGagalCacatOnly = (
              (item.detail_masalah || "").toUpperCase().includes("GAGAL CACAT") ||
              (item.keterangan_cacat || "").toUpperCase().includes("GAGAL CACAT") ||
              (item.kategori_masalah || "").toUpperCase() === "G"
            ) && !hasRealError;

            const isSelected = selectedIds.includes(item.id);
            const isRowQcModified = isPanelInsertedByQc || hasTambahanQC || hasTambahanMnd || (!!item.keterangan_qc && item.keterangan_qc !== "-");

            const rowBgClass = isSelected
              ? "bg-sky-100/90"
              : isDeleted
              ? "bg-slate-100/60 opacity-80"
              : isRowQcModified
              ? "bg-sky-50/90 hover:bg-sky-100/60 border-y border-sky-200"
              : hasIstirahat
              ? "bg-amber-50/30 hover:bg-amber-50/50"
              : item.jml_hasil_produksi === 0
              ? "bg-rose-50/30 hover:bg-rose-50/50"
              : "hover:bg-slate-50";

            const stickyCellBgClass = isSelected
              ? "bg-sky-100"
              : isDeleted
              ? "bg-slate-100"
              : isRowQcModified
              ? "bg-sky-100/70"
              : hasIstirahat
              ? "bg-amber-50/30"
              : item.jml_hasil_produksi === 0
              ? "bg-rose-50/30"
              : "bg-white";

            const isDouble = !isDeleted && !isBsAwal && !isBsAkhir && (panelCounts[cleanPanelNo] || 0) > 1;

            return (
              <tr
                key={item.id}
                className={`${rowBgClass} transition-colors`}
              >
                {onToggleSelect && (
                  <td className={`px-1.5 py-1.5 text-center border-r border-slate-100 ${stickyCellBgClass}`}>
                    {!isDeleted && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect && onToggleSelect(item.id)}
                        className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                      />
                    )}
                  </td>
                )}
                <td className={`sticky left-0 z-10 px-2 py-1.5 font-bold text-slate-800 text-center border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${stickyCellBgClass}`}>
                  {isBsAwal ? (
                    <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded leading-none shadow-sm whitespace-nowrap">BS AWAL</span>
                  ) : isBsAkhir ? (
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
                          {(String(rawPanelNo).includes("(BS)") || item.jml_hasil_produksi === 0 || item.status_inspeksi === "BS") ? (
                            <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded leading-none shadow-sm border border-rose-200">BS</span>
                          ) : isPanelInsertedByQc || hasTambahanQC || hasTambahanMnd ? (
                            <span className="text-[8px] font-black bg-sky-100 text-[#0070bc] px-1.5 py-0.5 rounded leading-none border border-sky-300 shadow-2xs">+ QC</span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-2 py-1 text-slate-600 text-center whitespace-nowrap border-r border-slate-100">
                  {showTgl ? tglStr : ""}
                </td>
                <td className="px-1.5 py-1 font-medium text-slate-700 text-center border-r border-slate-100">
                  {showGrp ? grpStr : ""}
                </td>
                <td className={`px-2 py-1 leading-tight text-center border-r border-slate-100 ${(!showOpr && hasIstirahat) ? "italic font-bold text-amber-600" : "font-medium text-slate-700"}`}>
                  {showOpr ? (item.oprBase || grpStr || "-") : (hasIstirahat ? "Istirahat" : "")}
                </td>
                <td className="px-2 py-1 text-center font-bold text-sm border-r border-slate-100">
                  {isDeleted ? <span className="text-slate-400 font-bold">-</span> : hasError ? <span className="text-rose-600">X</span> : <span className="text-emerald-600">✓</span>}
                </td>
                <td className="px-2 py-1 text-[11px] font-medium whitespace-pre-line leading-tight border-r border-slate-100">
                  {(() => {
                    const parsedCacatItems = cacatLines
                      .map((line) => {
                        const isLineQc = line.includes("[QC]") || line.includes("[TAMBAHAN QC]") || line.includes("[TAMBAHAN MENDING]");
                        const cleanText = line
                          .replace(/\[QC\]/gi, "")
                          .replace(/\[TAMBAHAN QC\]/gi, "")
                          .replace(/\[TAMBAHAN MENDING\]/gi, "")
                          .replace(/^([A-Z0-9]\s*[-.]\s*|\d+\.\s*|\d+-\s*)/i, "")
                          .trim();
                        return {
                          isLineQc,
                          text: cleanText,
                        };
                      })
                      .filter((cItem) => cItem.text.length > 0 && cItem.text !== "-");

                    const renderItems = () => {
                      if (parsedCacatItems.length === 0) {
                        return <span className="text-slate-400">-</span>;
                      }
                      return (
                        <div className="flex flex-col gap-0.5">
                          {parsedCacatItems.map((cItem, idx) => {
                            const numPrefix = parsedCacatItems.length > 1 ? `${idx + 1}. ` : "";
                            return (
                              <div
                                key={idx}
                                className={
                                  cItem.isLineQc
                                    ? "text-sky-600 font-semibold"
                                    : (isIstirahatOnly || isGagalCacatOnly)
                                    ? "text-slate-500 font-medium"
                                    : "text-rose-600 font-medium"
                                }
                              >
                                {numPrefix}{cItem.text}
                              </div>
                            );
                          })}
                        </div>
                      );
                    };

                    return isDeleted ? (
                      <div className="italic text-slate-400 font-medium">[Panel Dihapus]</div>
                    ) : hasIstirahat ? (
                      <>
                        {extractedBackupOp && <div className="font-bold text-slate-700 mb-0.5">{extractedBackupOp}</div>}
                        {renderItems()}
                        {item.keterangan_qc && item.keterangan_qc !== "-" && (
                          <div className="text-sky-800 bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5 font-bold text-[10px] mt-0.5 shadow-2xs flex items-center gap-1 w-fit">
                            <span className="text-sky-600 font-black">QC:</span> {item.keterangan_qc}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {renderItems()}
                        {item.keterangan_qc && item.keterangan_qc !== "-" && (
                          <div className="text-sky-800 bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5 font-bold text-[10px] mt-0.5 shadow-2xs flex items-center gap-1 w-fit">
                            <span className="text-sky-600 font-black">QC:</span> {item.keterangan_qc}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </td>
                <td className="px-2 py-1 border-r border-slate-100 text-center w-16">
                  <div className="flex items-center justify-center gap-1">
                    {isDeleted ? (
                      <span className="text-[10px] text-slate-400 font-semibold italic">Dihapus</span>
                    ) : (
                      <>
                        {handleOpenAddQC && (
                          <button
                            onClick={() => handleOpenAddQC(item)}
                            className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
                            title="Tambah Temuan / Catatan QC"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {handleOpenEditQC && (
                          <button
                            onClick={() => handleOpenEditQC(item)}
                            className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
                            title="Koreksi Data Bawaan"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setDetailToDelete({ id: item.id, panelNo: cleanPanelNo, name: `${item.kategori_masalah || 'Masalah'} - ${item.detail_masalah || 'Tidak ada detail'}` })}
                          className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-all shadow-xs cursor-pointer"
                          title="Hapus Rincian"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-1 py-1 text-center border-r border-slate-100 w-16">
                  {isDeleted ? (
                    <span className="text-slate-300 font-bold block text-center">-</span>
                  ) : (
                    <button
                      onClick={() => handleSelectGrade(item.id, 1)}
                      className={`w-7 h-7 mx-auto flex items-center justify-center rounded-md transition-all border ${selections[item.id] === 1 ? "border-emerald-500 bg-emerald-100 text-emerald-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-emerald-300 hover:text-emerald-500"}`}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                </td>
                <td className="px-1 py-1 text-center border-r border-slate-100 w-16">
                  {isDeleted ? (
                    <span className="text-slate-300 font-bold block text-center">-</span>
                  ) : (
                    <button
                      onClick={() => handleSelectGrade(item.id, 3)}
                      className={`w-7 h-7 mx-auto flex items-center justify-center rounded-md transition-all border ${selections[item.id] === 3 ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-rose-300 hover:text-rose-500"}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </td>
                <td className="px-1 py-1 text-center w-16">
                  {isDeleted ? (
                    <span className="text-slate-300 font-bold block text-center">-</span>
                  ) : (
                    <button
                      onClick={() => handleSelectGrade(item.id, 4)}
                      className={`w-7 h-7 mx-auto flex items-center justify-center rounded-md transition-all border ${selections[item.id] === 4 ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-rose-300 hover:text-rose-500"}`}
                    >
                      <span className="text-xs font-black">BS</span>
                    </button>
                  )}
                </td>
              </tr>
            );
          })}

          {(totalGradable > 0 || totalBS > 0) && (
            <tr className="bg-slate-50 font-bold border-t border-slate-200 text-xs text-slate-700 uppercase tracking-wider">
              <td className="px-2 py-3 text-right font-extrabold border-r border-slate-100" colSpan={onToggleSelect ? 8 : 7}>
                TOTAL ({totalGradable + totalBS} PANEL):
              </td>
              <td className="px-1 py-3 text-center text-emerald-600 bg-emerald-50/40 font-black border-r border-slate-100 w-16">
                {totalPass}
              </td>
              <td className="px-1 py-3 text-center text-rose-600 bg-rose-50/40 font-black border-r border-slate-100 w-16">
                {totalDefect}
              </td>
              <td className="px-1 py-3 text-center text-rose-600 bg-rose-50/40 font-black w-16">
                {totalBS}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
