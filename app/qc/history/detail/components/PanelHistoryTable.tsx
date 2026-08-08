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
    const processed = detailsToDisplay.map((item: any) => {
      const h = item.production_headers || {};
      const opr = h.operators?.nama_operator || h.pic || "";
      const grp = h.groups?.nama_grup || "";
      const tgl = h.tgl || "";
      const operatorStr = (grp ? `(${grp}) ` : '') + opr;

      const isIstirahatOnly = (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") && !item.kategori_masalah && !item.detail_masalah;
      const hasIstirahat = (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT");
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
    let lastTgl = "";
    let lastGrp = "";
    let lastOpr = "";

    processed.forEach((p: any, i: number) => {
      const { item, isIstirahatOnly, hasIstirahat, isGradable, opr, grp, tgl, operatorStr } = p;

      currentOpCount += 1;

      let showTgl = true;
      let showGrp = true;
      let showOpr = true;

      if (tgl === lastTgl) showTgl = false;
      if (grp === lastGrp) showGrp = false;

      if (hasIstirahat) {
        showTgl = false;
        showGrp = true;
        showOpr = true;
      } else {
        let prevActualOprStr = "-";
        for (let k = items.length - 1; k >= 0; k--) {
          const pItem = items[k];
          if (!pItem.isTotalRow && !pItem.hasIstirahat) {
            prevActualOprStr = pItem.production_headers?.operators?.nama_operator || pItem.production_headers?.pic || "-";
            break;
          }
        }
        if (prevActualOprStr === opr) {
          showOpr = false;
        }
      }

      lastTgl = tgl;
      lastGrp = grp;
      lastOpr = hasIstirahat ? (item.production_headers?.operator_backup || opr) : opr;

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
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
            <th className="px-0.5 py-2 w-6 text-center border-r border-slate-200">PNL</th>
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
                  <td colSpan={4} className="px-3 py-2 text-right whitespace-nowrap">
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

            let masalahLines: string[] = [];
            if (isIstirahatOnly) {
              // break rows have no defects, so masalahLines remains empty (rendering as "-")
            } else {
              if (detail.production_defects && Array.isArray(detail.production_defects) && detail.production_defects.length > 0) {
                const groupedMap = new Map<string, Set<string>>();
                const orderList: string[] = [];

                detail.production_defects.forEach((d: any) => {
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

                masalahLines = orderList.map((key) => {
                  const blocks = Array.from(groupedMap.get(key) || []);
                  if (blocks.length > 0) {
                    return `${key} (Blok ${blocks.join(", ")})`;
                  }
                  return key;
                });
              } else {
                let dtEvents: any[] = [];
                try {
                  if (itemHeader.downtime_events) {
                    dtEvents = typeof itemHeader.downtime_events === 'string'
                      ? JSON.parse(itemHeader.downtime_events)
                      : itemHeader.downtime_events;
                  }
                } catch (e) { }

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

                let ketCacat = detail.keterangan_cacat || "";
                ketCacat = ketCacat.replace("[TAMBAHAN QC]", "").trim();

                if (ketCacat) {
                  if (cacatLines.length > 0) {
                    const parts = ketCacat.split(",").map((s: string) => s.trim());
                    cacatLines = cacatLines.map((line, i) => {
                      const lineKat = line.includes(" - ") ? line.split(" - ")[0].trim() : "";
                      let partIndex = i;
                      if (lineKat && kats.includes(lineKat)) {
                         partIndex = kats.indexOf(lineKat);
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
                  } else {
                     const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
                     cacatLines.push(`(Blok ${cleanB})`);
                  }
                }

                masalahLines.push(...cacatLines);

                if (detail.keterangan_cacat && detail.keterangan_cacat.includes("[TAMBAHAN QC]")) {
                  if (masalahLines.length === 0) {
                    masalahLines.push("[TAMBAHAN QC]");
                  } else {
                    for (let i = 0; i < masalahLines.length; i++) {
                      masalahLines[i] = masalahLines[i] + " [TAMBAHAN QC]";
                    }
                  }
                }
              }
            }

              if (detail.keterangan_qc && detail.keterangan_qc !== "-") {
                masalahLines.push(`QC: ${detail.keterangan_qc}`);
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

            return (
              <tr key={item.id || idx} className={`${hasIstirahat ? "bg-amber-50/30" : "hover:bg-slate-50"} transition-colors`}>
                <td className="px-1 py-1 font-bold text-slate-800 text-center border-r border-slate-100 flex flex-col items-center justify-center">
                  <span>{(item.displayNo || "-").replace(/\s*\((BS|GAGAL)\)/gi, "").trim()}</span>
                  {(String(item.displayNo).includes("(BS)") || item.jml_hasil_produksi === 0) && (
                    <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded mt-0.5 leading-none shadow-sm border border-rose-200">BS</span>
                  )}
                </td>
                <td className="px-1 py-1 text-slate-600 whitespace-nowrap border-r border-slate-100">
                  {displayTgl}
                </td>
                <td className={`px-1 py-1 font-medium text-center text-slate-700 border-r border-slate-100`}>
                  {hasIstirahat ? "" : displayGrp}
                </td>
                <td className="px-1 py-1 leading-tight border-r border-slate-100 text-slate-700 font-medium">
                  {displayOp}
                </td>
                 <td className="px-1 py-1 text-center border-r border-slate-100">
                   {isIstirahatOnly ? (
                     <CheckCircle2 className="w-4 h-4 text-emerald-500 inline-block" />
                   ) : (
                     detail.kategori_masalah || detail.detail_masalah ? (
                       <XCircle className="w-4 h-4 text-rose-500 inline-block" />
                     ) : (
                       <CheckCircle2 className="w-4 h-4 text-emerald-500 inline-block" />
                     )
                   )}
                 </td>
                 <td className={`px-2 py-1 text-[11px] font-medium whitespace-pre leading-tight border-r border-slate-100 ${hasIstirahat ? 'text-slate-500' : (masalahLines.length > 0 ? 'text-rose-600' : 'text-slate-700')}`}>
                   {extractedBackupOp && hasIstirahat && <div className="font-bold text-slate-700 mb-0.5">{extractedBackupOp}</div>}
                   {!isIstirahatOnly && (masalahLines.length > 0 ? masalahLines.join("\n") : "-")}
                 </td>

                <td className="px-1 py-1 text-center border-r border-slate-100">
                  <div className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md border ${detail.final_inspection_id === 1 ? "border-emerald-500 bg-emerald-100 text-emerald-700 shadow-sm" : "border-slate-200 bg-white text-slate-300"}`}>
                    {detail.final_inspection_id === 1 ? <CheckCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5 text-slate-200" />}
                  </div>
                </td>
                <td className="px-1 py-1 text-center border-r border-slate-100">
                  <div className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md border ${detail.final_inspection_id === 3 ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-300"}`}>
                    {detail.final_inspection_id === 3 ? <X className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-200" />}
                  </div>
                </td>
                <td className="px-1 py-1 text-center">
                  <div className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md border ${detail.final_inspection_id === 4 ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-300"}`}>
                    <span className={`text-[10px] font-black ${detail.final_inspection_id === 4 ? "text-rose-700" : "text-slate-300"}`}>BS</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
