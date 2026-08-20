"use client";

import React from "react";
import { CheckCircle, X, CheckCircle2, XCircle } from "lucide-react";
import { PROBLEM_DETAILS } from "../../../page";

export default function PanelHistoryTable({
  detailsToDisplay,
  header
}: {
  detailsToDisplay: any[];
  header: any;
}) {
  const displayItems = React.useMemo(() => {
    const sorted = [...detailsToDisplay].sort((a: any, b: any) => {
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
      return (b.jml_hasil_produksi || 0) - (a.jml_hasil_produksi || 0);
    });

    const processed = sorted.map((item: any) => {
      const h = item.production_headers || {};
      const opr = h.operators?.nama_operator || h.pic || "";
      const grp = h.groups?.nama_grup || "";
      const tgl = h.tgl || "";
      const operatorStr = (grp ? `(${grp}) ` : '') + opr;

      const isGagalCacat = (item.detail_masalah || "").toUpperCase().includes("GAGAL CACAT") || (item.keterangan_cacat || "").toUpperCase().includes("GAGAL CACAT");
      const hasIstirahat = !isGagalCacat && (
        (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") || 
        (item.kategori_masalah || "").toUpperCase().includes("ISTIRAHAT") || 
        (item.detail_masalah || "").toUpperCase().includes("ISTIRAHAT") || 
        (item.detail_masalah || "").toUpperCase().includes("OPLOS SHIFT") || 
        (item.detail_masalah || "").toUpperCase().includes("GANTI OPERATOR")
      );
      const isIstirahatOnly = hasIstirahat && (!item.kategori_masalah || item.kategori_masalah === "G");
      const isFinish = item.keterangan_cacat === "FINISH" || item.production_headers?.panel_no === "FINISH";
      const isStart = item.keterangan_cacat === "START" || item.production_headers?.panel_no === "START";
      const isGradable = !isIstirahatOnly && !isFinish && !isStart;

      return {
        item,
        isIstirahatOnly,
        hasIstirahat,
        isGradable,
        opr,
        grp,
        tgl,
        operatorStr,
      };
    });

    const items: any[] = [];
    let currentOpCount = 0;
    let firstRowTgl = "";
    let lastTgl = "";
    let lastGrp = "";
    let lastOpr = "";

    processed.forEach((p: any, i: number) => {
      const { item, isIstirahatOnly, hasIstirahat, isGradable, opr, grp, tgl, operatorStr } = p;

      const isDeleted = !!item.is_deleted || item.status_inspeksi === "Dihapus" || (item.keterangan_cacat || "").includes("[DIHAPUS]");
      const isBS = item.jml_hasil_produksi === 0 || item.status_inspeksi === "BS" || item.final_inspection_id === 4;
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
        if (opr !== lastOpr) {
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
      lastOpr = opr;

      items.push({
        ...item,
        isMeter: false,
        isStartRow: false,
        isIstirahatOnly,
        hasIstirahat,
        isFinishReport: false,
        displayNo: item.production_headers?.panel_no || "-",
        meterDisplay: "-",
        cacatDisplay: item.detail_masalah || item.keterangan_cacat || "-",
        isGradable,
        showTgl,
        showGrp,
        showOpr,
        oprBase: opr,
        oprStr: opr,
        grpStr: grp,
        tglStr: tgl,
        hasErrorDetail: !!item.kategori_masalah || !!item.detail_masalah
      });

      let nextOprStr = null;
      if (i + 1 < processed.length) {
        nextOprStr = processed[i + 1].operatorStr;
      }

      if (nextOprStr === null || nextOprStr !== operatorStr) {
        if (currentOpCount > 0) {
          const [prevGrp, prevOpr] = operatorStr.includes(") ") 
            ? [operatorStr.match(/\(([^)]+)\)/)?.[1] || "", operatorStr.replace(/^\([^)]+\)\s*/, "")]
            : ["", operatorStr];

          items.push({
            id: `total-${operatorStr}-${Math.random()}`,
            isTotalRow: true,
            totalLabel: `Total Produksi${prevGrp ? ` (${prevGrp})` : ""} ${prevOpr}:`,
            totalCount: currentOpCount,
          });
        }
        currentOpCount = 0;
      }
    });

    return items;
  }, [detailsToDisplay, header]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
            <th className="sticky left-0 z-20 bg-slate-100 px-0.5 py-2 w-6 text-center border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]">PNL</th>
            <th className="px-1 py-2 w-14 border-r border-slate-200">Tgl</th>
            <th className="px-0.5 py-2 w-8 text-center border-r border-slate-200">Group</th>
            <th className="px-1 py-2 w-16 border-r border-slate-200">Operator</th>
            <th className="px-0.5 py-2 text-center w-8 border-r border-slate-200">KET <br /> ✓/X</th>
            <th className="px-1 py-2 min-w-[150px] w-full border-r border-slate-200">KETERANGAN CACAT</th>
            <th className="px-0.5 py-2 text-center text-emerald-600 font-black w-5 border-r border-slate-200">✓</th>
            <th className="px-0.5 py-2 text-center text-rose-600 font-black w-5 border-r border-slate-200">X</th>
            <th className="px-0.5 py-2 text-center text-rose-600 font-black w-5">BS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-[10px] text-slate-700">
          {displayItems.map((item: any, idx: number) => {
            if (item.isTotalRow) {
              return (
                <tr key={item.id || idx} className="bg-slate-100 border-t border-b border-slate-200 font-semibold text-slate-700">
                  <td colSpan={4} className="sticky left-0 z-10 bg-slate-100 px-3 py-2 text-right whitespace-nowrap border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]">
                    {item.totalLabel}
                  </td>
                  <td className="px-1 py-2 text-center text-slate-800 font-extrabold whitespace-nowrap">
                    {item.totalCount}
                  </td>
                  <td colSpan={4} className="bg-slate-100"></td>
                </tr>
              );
            }

            const detail = item;
            const itemHeader = item.production_headers || header;

            const isIstirahatOnly = item.isIstirahatOnly;
            const hasIstirahat = item.hasIstirahat;
            const displayOp = item.showOpr ? (item.oprStr || "-") : "";
            const displayTgl = item.showTgl ? (item.tglStr || "-") : "";
            const displayGrp = item.showGrp ? (item.grpStr || "-") : "";

            const rawPanelNo = itemHeader.panel_no || item.displayNo || "-";
            const isBsAwal = String(rawPanelNo).toUpperCase().includes("AWAL");
            const isBsAkhir = String(rawPanelNo).toUpperCase().includes("AKHIR");
            const isSisa = isBsAwal || isBsAkhir;

            let masalahLines: string[] = [];
            if (isSisa) {
              masalahLines = [isBsAwal ? "Sisa Awal Potongan" : "Sisa Akhir Potongan"];
            } else if (isIstirahatOnly) {
            } else {
              if (detail.production_defects && Array.isArray(detail.production_defects) && detail.production_defects.length > 0) {
                const groupedMap = new Map<string, Set<string>>();
                const orderList: string[] = [];

                detail.production_defects.forEach((d: any) => {
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

                masalahLines = orderList.map((key) => {
                  const blocks = Array.from(groupedMap.get(key) || []);
                  if (blocks.length > 0) {
                    return `${key} (Blok ${blocks.join(", ")})`;
                  }
                  return key;
                });
              } else {
                const isTambahanQc = !!detail.keterangan_cacat?.includes("[TAMBAHAN QC]") || detail.jml_hasil_produksi === 0 || detail.status_inspeksi === "BS";
                let dtEvents: any[] = [];
                if (!isTambahanQc) {
                  try {
                    if (itemHeader.downtime_events) {
                      dtEvents = typeof itemHeader.downtime_events === 'string'
                        ? JSON.parse(itemHeader.downtime_events)
                        : itemHeader.downtime_events;
                    }
                  } catch (e) { }
                }

              const matchedEvents = dtEvents.filter((e: any) =>
                !e.pcsKe || e.pcsKe === "Semua" || e.pcsKe == detail.pcs_index
              );

              if (matchedEvents.length > 0) {
                matchedEvents.forEach((e: any) => {
                  if (e.problems && Array.isArray(e.problems)) {
                    e.problems.forEach((p: any) => {
                      const c = p.kategori || "";
                      let rawDetails: string[] = [];
                      if (p.details && Array.isArray(p.details)) {
                        rawDetails = [...p.details];
                      } else if (typeof p.details === "string") {
                        rawDetails = [p.details];
                      }
                      const b = p.blok || "";

                      rawDetails.forEach((det: string) => {
                        const d = typeof det === 'string' ? det.trim() : det;
                        let line = "";
                        if (c && d) line = `${c} - ${d}`;
                        else if (c) line = c;
                        else if (d) line = d;

                        if (b && b !== "-") {
                          if (line) line += ` (Blok ${b})`;
                          else line = `(Blok ${b})`;
                        }
                        if (line) masalahLines.push(line);
                      });
                    });
                  } else if (e.kategori) {
                    const c = e.kategori;
                    const rawDetails = e.detail ? (Array.isArray(e.detail) ? e.detail : [e.detail]) : [];
                    const b = e.blok || "";

                    rawDetails.forEach((det: string) => {
                      const d = typeof det === 'string' ? det.trim() : det;
                      let line = "";
                      if (c && d) line = `${c} - ${d}`;
                      else if (c) line = c;
                      else if (d) line = d;

                      if (b && b !== "-") {
                        if (line) line += ` (Blok ${b})`;
                        else line = `(Blok ${b})`;
                      }
                      if (line) masalahLines.push(line);
                    });
                  }
                });
              } else {
                let cacatLines: string[] = [];
                const katsRaw = detail.kategori_masalah;
                const kats = katsRaw ? (Array.isArray(katsRaw) ? katsRaw : katsRaw.split(",").map((s: string) => s.trim())) : [];
                const displayDetail = detail.detail_masalah || "";

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

                masalahLines.push(...cacatLines);
              }

              let ketCacat = detail.keterangan_cacat || "";
              ketCacat = ketCacat.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
              ketCacat = ketCacat.replace(/\[TAMBAHAN QC\]/gi, "").trim();
              ketCacat = ketCacat.replace(/^,\s*|\s*,\s*$/g, "");
              if (ketCacat) {
                if (masalahLines.length > 0) {
                  const parts = ketCacat.split(",").map((s: string) => s.trim()).filter(Boolean);
                  if (masalahLines.length === 1 && parts.length > 1) {
                    const cleanAllBlocks = parts
                      .map((p: string) => p.replace(/blok\s*/gi, "").trim())
                      .filter(Boolean)
                      .join(", ");
                    masalahLines = masalahLines.map((line) =>
                      line.match(/\(Blok/i) ? line : `${line} (Blok ${cleanAllBlocks})`
                    );
                  } else {
                    masalahLines = masalahLines.map((line, i) => {
                      if (line.match(/\(Blok/i)) return line;
                      const lineKat = line.includes(" - ") ? line.split(" - ")[0].trim() : "";
                      const matchingPart = parts.find((p: string) => lineKat && p.toLowerCase().includes(lineKat.toLowerCase()));
                      const blockPart = matchingPart || parts[i] || parts[0];
                      if (blockPart) {
                        const cleanB = blockPart.replace(/blok\s*/gi, "").trim();
                        return cleanB ? `${line} (Blok ${cleanB})` : line;
                      }
                      return line;
                    });
                  }
                }
              }

              if (detail.keterangan_qc && detail.keterangan_qc !== "-") {
                masalahLines.push(`QC: ${detail.keterangan_qc}`);
              }
            }
            }
            const hasDefect = masalahLines.length > 0;
            if (masalahLines.length === 0) masalahLines.push("-");

            let extractedBackupOp = itemHeader?.operator_backup || "";
            if (!extractedBackupOp && detail.keterangan_cacat) {
              const match = detail.keterangan_cacat.match(/\(Backup:\s*([^)]+)\)/i);
              if (match && match[1]) {
                extractedBackupOp = match[1].trim();
              }
            }

            const isDeleted = !!detail.is_deleted || detail.status_inspeksi === "Dihapus" || (detail.keterangan_cacat || "").includes("[DIHAPUS]");
            const isBsRow = isBsAwal || isBsAkhir || String(rawPanelNo).includes("(BS)") || String(item.displayNo).includes("(BS)") || detail.jml_hasil_produksi === 0 || detail.status_inspeksi === "BS" || detail.final_inspection_id === 4 || item.final_inspection_id === 4 || item.jml_hasil_produksi === 0 || item.status_inspeksi === "BS";

            return (
              <tr key={item.id || idx} className={`${isDeleted ? "bg-slate-100/60 opacity-80" : hasIstirahat ? "bg-amber-50/30" : (isBsRow ? "bg-rose-50/30" : "hover:bg-slate-50")} transition-colors`}>
                <td className={`sticky left-0 z-10 px-1 py-1 font-bold text-slate-800 text-center flex flex-col items-center justify-center border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)] ${isDeleted ? "bg-slate-100" : hasIstirahat ? "bg-amber-100" : (isBsRow ? "bg-rose-50/50" : "bg-white")}`}>
                  {isBsAwal ? (
                    <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded leading-none shadow-sm whitespace-nowrap">BS AWAL</span>
                  ) : isBsAkhir ? (
                    <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded leading-none shadow-sm whitespace-nowrap">BS AKHIR</span>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <span>{(item.displayNo || "-").replace(/\s*\((BS|GAGAL)\)/gi, "").trim()}</span>
                      {isDeleted ? (
                        <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded mt-0.5 leading-none shadow-sm border border-rose-200">
                          DIHAPUS
                        </span>
                      ) : isBsRow ? (
                        <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded mt-0.5 leading-none shadow-sm border border-rose-200">BS</span>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="px-1 py-1 text-slate-600 whitespace-nowrap border-r border-slate-100">
                  {displayTgl}
                </td>
                <td className="px-1 py-1 font-medium text-center text-slate-700 border-r border-slate-100">
                  {item.showGrp ? displayGrp : ""}
                </td>
                <td className={`px-1 py-1 leading-tight border-r border-slate-100 ${(!item.showOpr && hasIstirahat) ? "italic font-bold text-amber-600" : "font-medium text-slate-700"}`}>
                  {item.showOpr ? (item.oprBase || displayGrp || "-") : (hasIstirahat ? "Istirahat" : "")}
                </td>
                 <td className="px-1 py-1 text-center border-r border-slate-100">
                   {isDeleted ? (
                     <span className="text-slate-400 font-bold">-</span>
                   ) : isIstirahatOnly ? (
                     <CheckCircle2 className="w-4 h-4 text-emerald-500 inline-block" />
                   ) : (
                     detail.kategori_masalah || detail.detail_masalah || isBsRow || detail.indikator_stop ? (
                       <XCircle className="w-4 h-4 text-rose-500 inline-block" />
                     ) : (
                       <CheckCircle2 className="w-4 h-4 text-emerald-500 inline-block" />
                     )
                   )}
                 </td>
                 <td className={`px-2 py-1 text-[11px] font-medium whitespace-pre-line leading-tight border-r border-slate-100 ${isDeleted ? 'text-slate-400 italic' : hasIstirahat ? 'text-slate-500' : (masalahLines.length > 0 && masalahLines[0] !== '-' ? 'text-rose-600' : 'text-slate-700')}`}>
                   {isDeleted ? (
                     <div className="italic text-slate-400 font-medium">[Panel Dihapus]</div>
                   ) : hasIstirahat ? (
                     <>
                       {extractedBackupOp ? (
                         <div className="font-bold text-slate-700 mb-0.5">{extractedBackupOp}</div>
                       ) : null}
                       {!isIstirahatOnly && masalahLines.length > 0 && masalahLines[0] !== '-' ? (
                         <div className="text-rose-600">{masalahLines.join("\n")}</div>
                       ) : (
                         !extractedBackupOp && <span className="text-slate-400">-</span>
                       )}
                     </>
                   ) : (
                     masalahLines.length > 0 ? masalahLines.join("\n") : "-"
                   )}
                 </td>

                <td className="px-1 py-1 text-center border-r border-slate-100">
                  {isDeleted ? (
                    <span className="text-slate-300 font-bold block text-center">-</span>
                  ) : (
                    <div className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md border ${detail.final_inspection_id === 1 ? "border-emerald-500 bg-emerald-100 text-emerald-700 shadow-sm" : "border-slate-200 bg-white text-slate-300"}`}>
                      {detail.final_inspection_id === 1 ? <CheckCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5 text-slate-200" />}
                    </div>
                  )}
                </td>
                <td className="px-1 py-1 text-center border-r border-slate-100">
                  {isDeleted ? (
                    <span className="text-slate-300 font-bold block text-center">-</span>
                  ) : (
                    <div className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md border ${detail.final_inspection_id === 3 ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-300"}`}>
                      {detail.final_inspection_id === 3 ? <X className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-200" />}
                    </div>
                  )}
                </td>
                <td className="px-1 py-1 text-center">
                  {isDeleted ? (
                    <span className="text-slate-300 font-bold block text-center">-</span>
                  ) : (
                    <div className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md border ${detail.final_inspection_id === 4 ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-300"}`}>
                      <span className={`text-[10px] font-black ${detail.final_inspection_id === 4 ? "text-rose-700" : "text-slate-300"}`}>BS</span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
