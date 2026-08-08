"use client";

import React from "react";
import { Eye, Trash2, CheckCircle, X } from "lucide-react";
import { PROBLEM_DETAILS } from "../page";

export default function PanelQCTable({
  detailsToDisplay,
  handleSelectGrade,
  handleOpenDetail,
  selections,
  setDetailToDelete
}: {
  detailsToDisplay: any[];
  handleSelectGrade: (id: string, grade: number) => void;
  handleOpenDetail: (headerId: string) => void;
  selections: Record<string, number>;
  setDetailToDelete: (val: any) => void;
}) {
  const displayItems = React.useMemo(() => {
    const items: any[] = [];
    
    // Step 1: Pre-process items to identify operators and Istirahat
    const sorted = [...detailsToDisplay].sort((a, b) => {
      const pA = parseInt(a.production_headers?.panel_no || "0");
      const pB = parseInt(b.production_headers?.panel_no || "0");
      if (pA !== pB) return pA - pB;
      return (b.jml_hasil_produksi || 0) - (a.jml_hasil_produksi || 0);
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
                           !!item.kategori_masalah?.toUpperCase().includes("ISTIRAHAT");

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
    let lastTgl = "";
    let lastGrp = "";
    let lastOpr = "";

    processed.forEach((p, i) => {
      const { item, isIstirahatOnly, hasIstirahat, oprBase, opr, grp, tgl, operatorStr } = p;

      currentOpCount += 1;

      let showTgl = true;
      let showGrp = true;
      let showOpr = true;

      if (tgl === lastTgl) showTgl = false;
      if (grp === lastGrp) showGrp = false;
      if (oprBase === lastOpr) showOpr = false;

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
        isGradable: true,
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
            const sel = selections[itemP.item.id];
            if (sel === 1) countPass += 1;
            else if (sel === 3) countDefect += 1;
            else if (sel === 4) countBS += 1;
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

  const { totalGradable, totalPass, totalDefect, totalBS } = React.useMemo(() => {
    let g = 0, p = 0, d = 0, bs = 0;
    detailsToDisplay.forEach((item) => {
      g += 1;
      const sel = selections[item.id];
      if (sel === 1) p += 1;
      else if (sel === 3) d += 1;
      else if (sel === 4) bs += 1;
    });
    return { totalGradable: g, totalPass: p, totalDefect: d, totalBS: bs };
  }, [detailsToDisplay, selections]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
            <th className="px-0.5 py-2 w-6 text-center border-r border-slate-200" rowSpan={2}>PNL</th>
            <th className="px-1 py-2 w-14 border-r border-slate-200" rowSpan={2}>Tgl</th>
            <th className="px-0.5 py-2 w-8 text-center border-r border-slate-200" rowSpan={2}>Group</th>
            <th className="px-1 py-2 w-16 border-r border-slate-200" rowSpan={2}>Operator</th>
            <th className="px-0.5 py-2 text-center w-8 border-r border-slate-200" rowSpan={2}>KET <br /> ✓/X</th>
            <th className="px-1 py-2 min-w-[150px] w-full border-r border-slate-200" rowSpan={2}>KETERANGAN CACAT</th>
            <th className="px-1 py-2 text-center w-14 border-r border-slate-200" rowSpan={2}>AKSI</th>
            <th className="px-2 py-1 text-center font-extrabold text-slate-600 border-r border-slate-200" colSpan={3}>INSPEKSI QC</th>
          </tr>
          <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
            <th className="px-0.5 py-1 text-center text-emerald-600 font-black w-5 border-r border-slate-200">✓</th>
            <th className="px-0.5 py-1 text-center text-rose-600 font-black w-5 border-r border-slate-200">X</th>
            <th className="px-0.5 py-1 text-center text-rose-600 font-black w-5">BS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-[10px] text-slate-700">
          {displayItems.map((item, index) => {
            if (item.isTotalRow) {
              return (
                <tr key={item.id} className="bg-slate-100 border-t border-b border-slate-200 font-semibold text-slate-700">
                  <td colSpan={4} className="px-3 py-2 text-right whitespace-nowrap animate-fadeIn border-r border-slate-100">
                    {item.totalLabel}
                  </td>
                  <td className="px-1 py-2 text-center text-slate-800 font-extrabold whitespace-nowrap animate-fadeIn border-r border-slate-100">
                    {item.totalCount} Panel
                  </td>
                  <td colSpan={2} className="bg-slate-100 border-r border-slate-100"></td>
                  <td className="px-1 py-2 text-center text-emerald-600 bg-emerald-50/20 font-black border-r border-slate-100">
                    {item.countPass}
                  </td>
                  <td className="px-1 py-2 text-center text-rose-600 bg-rose-50/20 font-black border-r border-slate-100">
                    {item.countDefect}
                  </td>
                  <td className="px-1 py-2 text-center text-rose-600 bg-rose-50/20 font-black">
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
              displayKeterangan = displayKeterangan.replace(/^,\s*|\s*,\s*$/g, "");
            }

            let cacatLines: string[] = [];
            
            if (item.production_defects && Array.isArray(item.production_defects) && item.production_defects.length > 0) {
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
                ketCacat = ketCacat.replace(/\[TAMBAHAN QC\]/gi, "").trim();
                ketCacat = ketCacat.replace(/^,\s*|\s*,\s*$/g, "");
                if (ketCacat) {
                  const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
                  if (cleanB) {
                    if (cacatLines.length === 0) {
                      cacatLines.push(`(Blok ${cleanB})`);
                    } else {
                      cacatLines = cacatLines.map((l) => `${l} (Blok ${cleanB})`);
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
                if (displayDetail.includes(" | ")) {
                  const catDetails = displayDetail.split(" | ");
                  for (let i = 0; i < Math.max(kats.length, catDetails.length); i++) {
                    const k = kats[i] || "Unknown";
                    const d = catDetails[i] || "";
                    pushDetailsForCat(k, d);
                  }
                } else if (displayDetail) {
                  if (kats.length === 1) {
                    pushDetailsForCat(kats[0], displayDetail);
                  } else {
                    const dets = displayDetail.split(", ");
                    if (kats.length === dets.length) {
                      for (let i = 0; i < kats.length; i++) {
                        pushDetailsForCat(kats[i], dets[i]);
                      }
                    } else {
                      dets.forEach((det: string) => {
                        let foundKat = "Unknown";
                        for (const [kat, detList] of Object.entries(PROBLEM_DETAILS || {})) {
                          if ((detList as string[]).some((d: string) => det.toLowerCase().includes(d.toLowerCase()))) {
                            foundKat = kat;
                            break;
                          }
                        }
                        cacatLines.push(`${foundKat !== "Unknown" ? foundKat + " - " : ""}${det}`);
                      });
                    }
                  }
                } else {
                  cacatLines.push(kats.join(", "));
                }
              } else if (displayDetail) {
                cacatLines.push(displayDetail);
              }

              let ketCacat = item.keterangan_cacat || "";
              ketCacat = ketCacat.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
              ketCacat = ketCacat.replace(/\[TAMBAHAN QC\]/gi, "").trim();
              ketCacat = ketCacat.replace(/^,\s*|\s*,\s*$/g, "");
              if (ketCacat) {
                if (cacatLines.length > 0) {
                  const parts = ketCacat.split(",").map((s: string) => s.trim()).filter(Boolean);
                  if (cacatLines.length === 1 && parts.length > 1) {
                    const cleanAllBlocks = parts
                      .map((p: string) => p.replace(/blok\s*/gi, "").trim())
                      .filter(Boolean)
                      .join(", ");
                    cacatLines = cacatLines.map((line) =>
                      line.match(/\(Blok/i) ? line : `${line} (Blok ${cleanAllBlocks})`
                    );
                  } else {
                    cacatLines = cacatLines.map((line, i) => {
                      if (line.match(/\(Blok/i)) return line;
                      const lineKat = line.includes(" - ") ? line.split(" - ")[0].trim() : "";
                      let partIndex = i;

                      const katsRaw2 = item.kategori_masalah;
                      const kats2 = katsRaw2 ? (Array.isArray(katsRaw2) ? katsRaw2 : katsRaw2.split(",").map((s: any) => s.trim())) : [];
                      if (lineKat && kats2.includes(lineKat)) {
                        partIndex = kats2.indexOf(lineKat);
                      }

                      if (parts[partIndex] && parts[partIndex] !== "") {
                        const cleanB = parts[partIndex].replace(/blok\s*/gi, "").trim();
                        return line.match(/\(Blok/i) ? line : `${line} (Blok ${cleanB})`;
                      } else if (parts[parts.length - 1] && parts[parts.length - 1] !== "") {
                        const cleanB = parts[parts.length - 1].replace(/blok\s*/gi, "").trim();
                        return line.match(/\(Blok/i) ? line : `${line} (Blok ${cleanB})`;
                      }
                      return line;
                    });
                  }
                } else {
                  const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
                  cacatLines.push(`(Blok ${cleanB})`);
                }
              }
            }

            const hasTambahanQC = (item.keterangan_cacat || "").includes("[TAMBAHAN QC]");
            if (hasTambahanQC) {
              if (cacatLines.length === 0) {
                cacatLines.push("[TAMBAHAN QC]");
              } else {
                for (let i = 0; i < cacatLines.length; i++) {
                  cacatLines[i] = cacatLines[i] + " [TAMBAHAN QC]";
                }
              }
            }
            let cacat = cacatLines.join("\n");

            let extractedBackupOp = item.production_headers?.operator_backup || "";
            if (!extractedBackupOp && item.keterangan_cacat) {
              const match = item.keterangan_cacat.match(/\(Backup:\s*([^)]+)\)/i);
              if (match && match[1]) {
                extractedBackupOp = match[1].trim();
              }
            }

            const rawPanelNo = item.production_headers?.panel_no || "-";
            const cleanPanelNo = rawPanelNo.replace(/\s*\((BS|GAGAL)\)/gi, "").trim();

            return (
            <tr key={item.id} className={`${hasIstirahat ? "bg-amber-50/30" : (item.jml_hasil_produksi === 0 ? "bg-rose-50/30" : "hover:bg-slate-50")} transition-colors`}>
              <td className="px-1 py-1 font-bold text-slate-800 text-center flex flex-col items-center justify-center border-r border-slate-100">
                <span>{cleanPanelNo}</span>
                {item.jml_hasil_produksi === 0 && (
                  <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded mt-0.5 leading-none shadow-sm border border-rose-200">BS</span>
                )}
              </td>
              <td className="px-1 py-1 text-slate-600 whitespace-nowrap border-r border-slate-100">
                {hasIstirahat ? "" : (showTgl ? tglStr : "")}
              </td>
              <td className="px-1 py-1 font-medium text-slate-700 text-center border-r border-slate-100">
                {hasIstirahat ? "" : (showGrp ? grpStr : "")}
              </td>
              <td className="px-1 py-1 leading-tight border-r border-slate-100 text-slate-700 font-medium">
                {showOpr ? item.oprBase : ""}
              </td>
              <td className="px-1 py-1 text-center font-bold text-sm border-r border-slate-100">
                {item.indikator_stop || item.kategori_masalah ? <span className="text-rose-600">X</span> : <span className="text-emerald-600">✓</span>}
              </td>
              
              <td className={`px-2 py-1 text-[11px] font-medium whitespace-pre leading-tight border-r border-slate-100 ${isIstirahatOnly ? 'text-slate-500' : 'text-rose-600'}`}>
                {extractedBackupOp && hasIstirahat && <div className="font-bold text-slate-700 mb-0.5">{extractedBackupOp}</div>}
                {!isIstirahatOnly && (cacat || "-")}
              </td>
              
              <td className="px-1 py-1 border-r border-slate-100">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => handleOpenDetail(item.production_headers?.id || item.header_id)}
                    className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-[#0070bc] hover:border-[#0070bc]/30 transition-all shadow-sm"
                    title="Lihat Detail Sesi"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDetailToDelete({ id: item.id, name: `${item.kategori_masalah || 'Masalah'} - ${item.detail_masalah || 'Tidak ada detail'}` })}
                    className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 transition-all shadow-sm"
                    title="Hapus Rincian"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>

              <td className="px-1 py-1 text-center border-r border-slate-100">
                <button
                  onClick={() => handleSelectGrade(item.id, 1)}
                  className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md transition-all border ${selections[item.id] === 1 ? "border-emerald-500 bg-emerald-100 text-emerald-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-emerald-300 hover:text-emerald-500"}`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                </button>
              </td>
              <td className="px-1 py-1 text-center border-r border-slate-100">
                <button
                  onClick={() => handleSelectGrade(item.id, 3)}
                  className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md transition-all border ${selections[item.id] === 3 ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-rose-300 hover:text-rose-500"}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </td>
              <td className="px-1 py-1 text-center">
                <button
                  onClick={() => handleSelectGrade(item.id, 4)}
                  className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md transition-all border ${selections[item.id] === 4 ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-rose-300 hover:text-rose-500"}`}
                >
                  <span className="text-[10px] font-black">BS</span>
                </button>
              </td>
            </tr>
            );
          })}

          {totalGradable > 0 && (
            <tr className="bg-slate-50 font-bold border-t border-slate-200 text-[11px] text-slate-700 uppercase tracking-wider">
              <td className="px-2 py-3 text-right font-extrabold border-r border-slate-100" colSpan={7}>
                TOTAL ({totalGradable} PANEL):
              </td>
              <td className="px-1 py-3 text-center text-emerald-600 bg-emerald-50/40 font-black border-r border-slate-100">
                {totalPass}
              </td>
              <td className="px-1 py-3 text-center text-rose-600 bg-rose-50/40 font-black border-r border-slate-100">
                {totalDefect}
              </td>
              <td className="px-1 py-3 text-center text-rose-600 bg-rose-50/40 font-black">
                {totalBS}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
