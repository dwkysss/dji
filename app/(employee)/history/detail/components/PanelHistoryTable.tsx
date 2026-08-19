"use client";

import React from "react";
import Link from "next/link";
import { Edit, CheckCircle2, XCircle } from "lucide-react";
import { PROBLEM_DETAILS } from "@/app/qc/page";

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

export default function PanelHistoryTable({
  panels,
  pcsKey,
  downtimeRecords
}: {
  panels: any[];
  pcsKey: string;
  downtimeRecords?: any[];
}) {
  const header = panels[0] || {};
  const actualDowntimeRecords = downtimeRecords || panels.flatMap(p => p.downtime_records || []);

  const detailsToDisplay = React.useMemo(() => {
    const list: any[] = [];
    panels.forEach((p: any) => {
      const details = p.production_details || [];
      if (details.length === 0) {
        list.push({
          production_headers: p,
          final_inspection_id: p.final_inspection_id || 1,
        });
      } else {
        details.forEach((d: any) => {
          list.push({
            ...d,
            production_headers: p,
            final_inspection_id: d.final_inspection_id ?? p.final_inspection_id ?? 1,
          });
        });
      }
    });
    return list;
  }, [panels]);

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
      const rawJam = h.tanggal_jam || h.created_at || item.tanggal_jam || item.created_at || "";
      const jamStr = rawJam ? formatWibTime(rawJam) : "-";
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
        jamStr,
        operatorStr,
      };
    });

    const items: any[] = [];
    let currentOpCount = 0;
    let lastTgl = "";
    let lastGrp = "";
    let lastOpr = "";

    processed.forEach((p: any, i: number) => {
      const { item, isIstirahatOnly, hasIstirahat, isGradable, opr, grp, tgl, jamStr, operatorStr } = p;

      const isBS = item.jml_hasil_produksi === 0 || item.status_inspeksi === "BS" || item.final_inspection_id === 4 || item.kategori_masalah === "X";
      if (!isBS) {
        currentOpCount += 1;
      }

      let showTgl = false;
      let showGrp = false;
      let showOpr = false;

      if (i === 0) {
        showTgl = true;
        showGrp = true;
        showOpr = true;
      } else {
        if (opr !== lastOpr) {
          showTgl = true;
          showGrp = true;
          showOpr = true;
        } else if (tgl !== lastTgl) {
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
        oprStr: opr,
        grpStr: grp,
        tglStr: tgl,
        jamStr,
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
  }, [detailsToDisplay, panels]);

  return (
    <table className="w-full text-left border-collapse text-xs">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
          <th className="px-1 py-2 w-8 text-center border-r border-slate-100">PNL</th>
          <th className="px-1 py-2 w-20 border-r border-slate-100">TGL</th>
          <th className="px-1 py-2 w-14 text-center border-r border-slate-100">JAM</th>
          <th className="px-1 py-2 w-10 text-center border-r border-slate-100">Group</th>
          <th className="px-1 py-2 w-24 border-r border-slate-100">Operator</th>
          <th className="px-1 py-2 text-center w-12 border-r border-slate-100">KET ✓/X</th>
          <th className="px-2 py-2 min-w-[250px] w-full border-r border-slate-100">KETERANGAN CACAT</th>
          <th className="px-1 py-2 text-center w-16 border-r border-slate-100">DOWNTIME</th>
          <th className="px-1 py-2 text-center w-12">AKSI</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
        {displayItems.map((item: any, idx: number) => {
          if (item.isTotalRow) {
            return (
              <tr key={item.id || idx} className="bg-slate-100 border-t border-b border-slate-200 font-semibold text-slate-700">
                <td colSpan={5} className="px-3 py-2 text-right whitespace-nowrap">
                  {item.totalLabel}
                </td>
                <td className="px-1 py-2 text-center text-slate-800 font-extrabold whitespace-nowrap">
                  {item.totalCount}
                </td>
                <td colSpan={3} className="bg-slate-100"></td>
              </tr>
            );
          }

          const detail = item;
          const itemHeader = item.production_headers || header;

          const isIstirahatOnly = item.isIstirahatOnly;
          const hasIstirahat = item.hasIstirahat;
          const displayOp = item.showOpr ? (item.oprStr || "-") : "";
          const displayTgl = item.showTgl ? (item.tglStr || "-") : "";
          const displayJam = item.jamStr || "-";
          const displayGrp = item.showGrp ? (item.grpStr || "-") : "";

          let downtimeDisplay = "-";
          let masalahLines: string[] = [];
          let backupOpName = "";
          if (isIstirahatOnly) {
            if (itemHeader?.operator_backup) {
              backupOpName = itemHeader.operator_backup;
            }
          } else {
            const isTambahanQc = !!detail.keterangan_cacat?.includes("[TAMBAHAN QC]") || detail.jml_hasil_produksi === 0 || detail.status_inspeksi === "BS";
            let matchedEvents: any[] = [];
            
            if (!isTambahanQc && actualDowntimeRecords && actualDowntimeRecords.length > 0) {
              // Since downtime records are now native rows, we filter by header_id.
              // Note: For panels, downtime_records doesn't store pcs_index natively, 
              // but we can just map all downtimes of the header to the first PCS, 
              // or display it globally. The old logic filtered by `e.pcsKe`. 
              // If we didn't migrate pcs_index to downtime_records, we might just show it on the first PCS of the batch.
              // For safety, let's also read the legacy dtEvents if downtimeRecords is empty.
              matchedEvents = actualDowntimeRecords.filter(r => r.header_id === itemHeader.id);
              
              // Only display downtime on the very first PCS of the header to avoid repeating it for every PCS,
              // unless it's specifically for this PCS (which we don't have in the new table).
              if (detail.pcs_index !== 1 && detail.pcs_index !== "1") {
                matchedEvents = []; // Don't show downtime again on subsequent PCS
              }
            } else if (!isTambahanQc) {
              // Fallback to legacy
              let dtEvents: any[] = [];
              try {
                if (itemHeader.downtime_events) {
                  dtEvents = typeof itemHeader.downtime_events === 'string'
                    ? JSON.parse(itemHeader.downtime_events)
                    : itemHeader.downtime_events;
                }
              } catch (e) { }

              matchedEvents = dtEvents.filter((e: any) =>
                !e.pcsKe || e.pcsKe === "Semua" || e.pcsKe == detail.pcs_index
              );
            }

            if (matchedEvents.length > 0) {
              const totalSeconds = matchedEvents.reduce((acc: number, e: any) => acc + (parseInt(e.durasiDetik || e.durasi_detik, 10) || 0), 0);
              if (totalSeconds > 0) {
                const mins = Math.floor(totalSeconds / 60);
                const secs = totalSeconds % 60;
                if (mins > 0) {
                  downtimeDisplay = `${mins}m ${secs}s`;
                } else {
                  downtimeDisplay = `${secs}s`;
                }
              }
            }

            const rawPanelNo = itemHeader.panel_no || item.displayNo || "-";
            const isBsAwal = String(rawPanelNo).toUpperCase().includes("AWAL");
            const isBsAkhir = String(rawPanelNo).toUpperCase().includes("AKHIR");
            const isSisa = isBsAwal || isBsAkhir;

            let cacatLines: string[] = [];
            
            const katsRaw = detail.kategori_masalah;
            const kats = katsRaw ? (Array.isArray(katsRaw) ? katsRaw : katsRaw.split(",").map((s: string) => s.trim())) : [];
            
            if (isSisa) {
              cacatLines = [isBsAwal ? "Sisa Awal Potongan" : "Sisa Akhir Potongan"];
            } else if (detail.production_defects && Array.isArray(detail.production_defects) && detail.production_defects.length > 0) {
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

              cacatLines = orderList.map((key) => {
                const blocks = Array.from(groupedMap.get(key) || []);
                if (blocks.length > 0) {
                  return `${key} (Blok ${blocks.join(", ")})`;
                }
                return key;
              });

              let ketCacat = detail.keterangan_cacat || "";
              const hasTambahanQC = ketCacat.includes("[TAMBAHAN QC]");
              if (hasTambahanQC) {
                if (cacatLines.length === 0) cacatLines.push("[TAMBAHAN QC]");
                else cacatLines = cacatLines.map(line => line + " [TAMBAHAN QC]");
              }
            } else {
              // Fallback to legacy string parsing if defects table is empty (for backward compatibility)
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
                      if (lineKat && kats.includes(lineKat)) {
                        partIndex = kats.indexOf(lineKat);
                      }

                      if (parts[partIndex] && parts[partIndex] !== "") {
                        const cleanB = parts[partIndex].replace(/blok\s*/gi, "").trim();
                        return `${line} (Blok ${cleanB})`;
                      } else if (parts[parts.length - 1] && parts[parts.length - 1] !== "") {
                        const cleanB = parts[parts.length - 1].replace(/blok\s*/gi, "").trim();
                        return `${line} (Blok ${cleanB})`;
                      }
                      return line;
                    });
                  }
                } else {
                  const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
                  cacatLines.push(`(Blok ${cleanB})`);
                }
              }
              
              const hasTambahanQC = (detail.keterangan_cacat || "").includes("[TAMBAHAN QC]");
              if (hasTambahanQC) {
                if (cacatLines.length === 0) cacatLines.push("[TAMBAHAN QC]");
                else cacatLines = cacatLines.map(line => line + " [TAMBAHAN QC]");
              }
            }

            masalahLines.push(...cacatLines);

            if (detail.keterangan_qc && detail.keterangan_qc !== "-") {
              masalahLines.push(`QC: ${detail.keterangan_qc}`);
            }

            if (hasIstirahat) {
              if (itemHeader?.operator_backup) {
                backupOpName = itemHeader.operator_backup;
              } else {
                const searchStr = `${itemHeader?.pic || ""} ${itemHeader?.jenis_laporan || ""} ${detail?.keterangan_cacat || ""} ${detail?.detail_masalah || ""}`;
                const match = searchStr.match(/Backup:\s*([^)\],]+)/i);
                if (match && match[1]) {
                  backupOpName = match[1].trim();
                }
              }
            }
          }
          
          const hasDefect = masalahLines.length > 0 && masalahLines[0] !== "-";
          if (masalahLines.length === 0) masalahLines.push("-");

          const isBsRow = String(item.displayNo).toUpperCase().includes("AWAL") || String(item.displayNo).toUpperCase().includes("AKHIR") || String(item.displayNo).includes("(BS)") || detail.jml_hasil_produksi === 0 || detail.status_inspeksi === "BS";

          return (
            <tr key={item.id || idx} className={`${hasIstirahat ? "bg-amber-50/30" : "hover:bg-slate-50"} transition-colors`}>
              <td className="px-1 py-1 font-bold text-slate-800 text-center border-r border-slate-100 flex flex-col items-center justify-center">
                {String(item.displayNo).toUpperCase().includes("AWAL") ? (
                  <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded leading-none shadow-sm whitespace-nowrap">BS AWAL</span>
                ) : String(item.displayNo).toUpperCase().includes("AKHIR") ? (
                  <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded leading-none shadow-sm whitespace-nowrap">BS AKHIR</span>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <span>{(item.displayNo || "-").replace(/\s*\((BS|GAGAL)\)/gi, "").trim()}</span>
                    {(String(item.displayNo).includes("(BS)") || item.jml_hasil_produksi === 0) && (
                      <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded mt-0.5 leading-none shadow-sm border border-rose-200">BS</span>
                    )}
                  </div>
                )}
              </td>
              <td className="px-1 py-1 text-slate-600 whitespace-nowrap border-r border-slate-100">
                {displayTgl}
              </td>
              <td className="px-1 py-1 text-slate-600 text-center font-mono text-[11px] whitespace-nowrap border-r border-slate-100">
                {displayJam}
              </td>
              <td className={`px-1 py-1 font-medium text-center text-slate-700 border-r border-slate-100`}>
                {displayGrp}
              </td>
              <td className={`px-1 py-1 leading-tight border-r border-slate-100 ${(hasIstirahat && !item.showOpr) ? "italic font-bold text-slate-500 text-center" : "font-medium text-slate-700"}`}>
                {item.showOpr ? (item.oprStr || "-") : (hasIstirahat ? "Istirahat" : "")}
              </td>
              <td className="px-1 py-1 text-center border-r border-slate-100">
                {isIstirahatOnly ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 inline-block" />
                ) : (
                  detail.kategori_masalah || detail.detail_masalah || isBsRow || detail.indikator_stop ? (
                    <XCircle className="w-4 h-4 text-rose-500 inline-block" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 inline-block" />
                  )
                )}
              </td>
              <td className={`px-2 py-1 text-[11px] font-medium whitespace-pre leading-tight border-r border-slate-100 ${hasIstirahat ? 'text-slate-500' : (hasDefect ? 'text-rose-600' : 'text-slate-400')}`}>
                {hasIstirahat && (
                  <>
                    {(backupOpName && backupOpName.trim().toLowerCase() !== (item.oprStr || "").trim().toLowerCase()) ? (
                      <div className="font-bold text-slate-700 mb-0.5">{backupOpName}</div>
                    ) : item.showOpr ? (
                      <div className="font-bold text-slate-700 mb-0.5">ISTIRAHAT</div>
                    ) : (
                      <div className="font-bold text-slate-700 mb-0.5">{backupOpName || "-"}</div>
                    )}
                    {!isIstirahatOnly && masalahLines.length > 0 && masalahLines[0] !== "-" && (
                      <div className="text-rose-600">{masalahLines.join("\n")}</div>
                    )}
                  </>
                )}
                {!hasIstirahat && (masalahLines.length > 0 ? masalahLines.join("\n") : "-")}
              </td>
              <td className={`px-1 py-1 text-center text-[11px] font-bold border-r border-slate-100 ${downtimeDisplay && downtimeDisplay !== "-" ? "text-rose-600" : "text-slate-400"}`}>
                {downtimeDisplay}
              </td>
              <td className="px-1 py-1 text-center">
                {itemHeader?.id && detail.keterangan_cacat !== "FINISH" && (
                  <Link
                    href={`/edit/${itemHeader.id}`}
                    className="inline-flex items-center justify-center p-1.5 rounded hover:bg-sky-100 text-[#0070bc] transition-colors"
                    title="Edit Data"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Link>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
