"use client";

import React from "react";
import { Trash2, CheckCircle, X } from "lucide-react";
import { PROBLEM_DETAILS } from "../page";

export default function MeterQCTable({
  detailsToDisplay,
  handleSelectGrade,
  selections,
  setDetailToDelete
}: {
  detailsToDisplay: any[];
  handleSelectGrade: (id: string, grade: number) => void;
  selections: Record<string, number>;
  setDetailToDelete: (val: any) => void;
}) {
  const displayItems = React.useMemo(() => {
    const items: any[] = [];
    let globalRowCount = 0;
    let prevOperatorLastMeter: number | null = null;
    let currentOpStartMeter: number | null = null;
    let currentOpLastMeter: number | null = null;
    let currentOpCacatCount = 0;
    let lastOprString = "";

    let grandTotalStartMeter: number | null = null;
    let grandTotalLastMeter: number | null = null;
    let grandTotalCacatCount = 0;

    const cleanMeterVal = (val: any) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      const clean = str.replace(/PCS\s*\d+\s*:\s*/gi, "");
      return clean.replace(/[a-zA-Z\s]+$/g, "").trim();
    };

    detailsToDisplay.forEach((item, idx) => {
      const h = item.production_headers || {};
      const opr = h.operators?.nama_operator || h.pic || "";
      const grp = h.groups?.nama_grup || "";
      const operatorStr = (grp ? `(${grp}) ` : '') + opr;

      if (items.length === 0) {
        lastOprString = operatorStr;
      }

      let isSameAsPrev = false;
      if (operatorStr !== lastOprString && items.length > 0) {
        // Push total row untuk operator sebelumnya
        const totalMeter = currentOpStartMeter !== null && currentOpLastMeter !== null
          ? Math.abs(currentOpLastMeter - currentOpStartMeter)
          : null;
        const [prevGrp, prevOpr] = lastOprString.includes(") ") 
          ? [lastOprString.match(/\(([^)]+)\)/)?.[1] || "", lastOprString.replace(/^\([^)]+\)\s*/, "")]
          : ["", lastOprString];
        items.push({
          id: `total-${lastOprString}-${Math.random()}`,
          isTotalRow: true,
          totalLabel: `Total Produksi${prevGrp ? ` (${prevGrp})` : ""} ${prevOpr}:`,
          totalMeter: totalMeter !== null ? `${totalMeter} Meter` : "-",
        });
        prevOperatorLastMeter = currentOpLastMeter;
        currentOpStartMeter = null;
        currentOpLastMeter = null;
        lastOprString = operatorStr;
        isSameAsPrev = false;
      } else if (items.length > 0) {
        isSameAsPrev = true;
      }

      let hasIstirahatFromDefects = false;
      let hasRealDefects = false;

      const detailStr = (item.detail_masalah || "").toUpperCase();
      const katStr = (item.kategori_masalah || "").toUpperCase();
      const ketStr = (item.keterangan_cacat || "").toUpperCase();
      const oprName = (opr || "").toUpperCase();

      const hasIstirahatText = detailStr.includes("ISTIRAHAT") || katStr.includes("ISTIRAHAT") || ketStr.includes("ISTIRAHAT") || oprName.includes("ISTIRAHAT");

      if (item.production_defects && Array.isArray(item.production_defects)) {
        item.production_defects.forEach((d: any) => {
          if ((d.kategori || "").toUpperCase().includes("ISTIRAHAT") || (d.detail || "").toUpperCase().includes("ISTIRAHAT")) {
            hasIstirahatFromDefects = true;
          } else {
            hasRealDefects = true;
          }
        });
      }

      if (!item.production_defects || item.production_defects.length === 0) {
        const cleanDetailNoIstirahat = (item.detail_masalah || "").replace(/istirahat/gi, "").replace(/G\s*-\s*/gi, "").trim();
        if (cleanDetailNoIstirahat.length > 0) {
          hasRealDefects = true;
        } else if (item.kategori_masalah && katStr !== "G" && !katStr.includes("ISTIRAHAT")) {
          hasRealDefects = true;
        }
      }

      const hasIstirahatRaw = hasIstirahatText || hasIstirahatFromDefects;
      const hasIstirahat = hasIstirahatRaw && !hasRealDefects;
      const isIstirahatOnly = hasIstirahat;
      const isFinishReport = h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "";

      let cacatLines: string[] = [];
      let defectMeterStr = "";
      
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

          if (d.meter) defectMeterStr = d.meter;
        });

        cacatLines = orderList.map((key) => {
          const blocks = Array.from(groupedMap.get(key) || []);
          if (blocks.length > 0) {
            return `${key} (Blok ${blocks.join(", ")})`;
          }
          return key;
        });
      } else {
        // Fallback to legacy string parsing
        const katsRaw = item.kategori_masalah;
        const kats = katsRaw ? (Array.isArray(katsRaw) ? katsRaw : katsRaw.split(",").map((s: string) => s.trim())) : [];
        
        const pushDetailsForCat = (k: string, d: string) => {
          const cleanD = d.replace(/\s*\(Titik:\s*[^)]+\)/gi, "").trim();
          if (!cleanD) {
            return;
          }
          const knownDetailsForCat = PROBLEM_DETAILS[k] || [];
          const matchedDetails: string[] = [];
          let remainingD = cleanD;
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
            customParts.forEach(custom => {
              const cleanCustom = custom.replace(/^,\s*|\s*,\s*$/g, "").trim();
              if (cleanCustom) cacatLines.push(`${k} - ${cleanCustom}`);
            });
          } else {
            const parts = cleanD.split(",").map((s: string) => s.trim()).filter(Boolean);
            parts.forEach(p => cacatLines.push(`${k} - ${p}`));
          }
        };

        if (kats.length > 0) {
          if (item.detail_masalah?.includes(" | ")) {
            const catDetails = item.detail_masalah.split(" | ");
            for (let i = 0; i < Math.max(kats.length, catDetails.length); i++) {
              const k = kats[i] || "Unknown";
              const d = catDetails[i] || "";
              pushDetailsForCat(k, d);
            }
          } else if (item.detail_masalah) {
            if (kats.length === 1) {
              pushDetailsForCat(kats[0], item.detail_masalah);
            } else {
              const dets = item.detail_masalah.split(", ");
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
        } else if (item.detail_masalah) {
          cacatLines.push(item.detail_masalah);
        }
      }

      let ketCacat = item.keterangan_cacat || "";
      const hasTambahanQC = ketCacat.includes("[TAMBAHAN QC]");
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

      if (hasTambahanQC) {
        if (cacatLines.length === 0) {
          cacatLines.push("[TAMBAHAN QC]");
        } else {
          cacatLines = cacatLines.map(line => line + " [TAMBAHAN QC]");
        }
      }

      const combinedCacat = cacatLines.join("\n");
      const hasErrorDetail = cacatLines.length > 0 || !!item.kategori_masalah || !!item.detail_masalah;

      let meterDisplay = "-";
      if (item.meter_kain !== null && item.meter_kain !== undefined && String(item.meter_kain).trim() !== "") {
        meterDisplay = cleanMeterVal(item.meter_kain);
      } else if (defectMeterStr) {
        meterDisplay = cleanMeterVal(defectMeterStr);
      } else if (item.detail_masalah) {
        const meterMatch = item.detail_masalah.match(/\(Titik:\s*([A-Za-z0-9\s.\-]+)\)/i);
        if (meterMatch && meterMatch[1]) {
          meterDisplay = cleanMeterVal(meterMatch[1]);
        }
      }

      if (meterDisplay === "-") {
        if ((isIstirahatOnly || isFinishReport) && (h.meter_akhir || h.meter_awal)) {
          meterDisplay = cleanMeterVal(h.meter_akhir || h.meter_awal);
        }
      }

      if (!isSameAsPrev) {
        const startTglStr = h.tgl || "-";
        const startMeter = prevOperatorLastMeter !== null
          ? String(prevOperatorLastMeter)
          : (h.meter_awal !== undefined && h.meter_awal !== null ? cleanMeterVal(h.meter_awal) : "0");

        items.push({
          id: `start-${idx}-${Math.random()}`,
          isStartRow: true,
          isMeter: true,
          displayNo: (globalRowCount + 1).toString(),
          tglStr: startTglStr,
          grpStr: grp,
          oprStr: opr,
          meterDisplay: startMeter,
          cacatDisplay: "START",
          isGradable: false,
          showTgl: true,
          showGrp: true,
          showOpr: true,
          hasErrorDetail: false
        });
        globalRowCount += 1;
        const startMeterVal = parseFloat(cleanMeterVal(startMeter));
        if (!isNaN(startMeterVal)) {
          if (currentOpStartMeter === null) currentOpStartMeter = startMeterVal;
          currentOpLastMeter = startMeterVal;
          if (grandTotalStartMeter === null) grandTotalStartMeter = startMeterVal;
          grandTotalLastMeter = startMeterVal;
        }
        isSameAsPrev = true;
      }

      const finalOprStr = isSameAsPrev ? "" : opr;
      const finalGrpStr = isSameAsPrev ? "" : grp;
      const finalTglStr = isSameAsPrev ? "" : h.tgl || "-";

      const showTgl = !isSameAsPrev;
      const showGrp = !isSameAsPrev;
      const showOpr = !isSameAsPrev;

      const isGradable = !isIstirahatOnly && (!isFinishReport || hasErrorDetail || hasTambahanQC);
      const cacatForMeter = combinedCacat
        .split("\n")
        .map((line: string) => line.replace(/\s*\(Titik:\s*[^)]+\)/gi, "").trim())
        .filter((line: string) => {
          if (!line) return false;
          if (line.includes(" - ")) {
            const detailPart = line.split(" - ").slice(1).join(" - ").trim();
            const withoutBlok = detailPart.replace(/\s*\(Blok[^)]*\)/gi, "").trim();
            return withoutBlok.length > 0;
          }
          return true;
        })
        .join("\n");
      const cacatText = isIstirahatOnly ? "-" : (isFinishReport && !hasErrorDetail ? "FINISH" : (hasErrorDetail && cacatForMeter ? cacatForMeter : "-"));

      const isPlaceholder = meterDisplay === "-" && !hasErrorDetail && !isIstirahatOnly && !isFinishReport;
      let extractedBackupOp = h.operator_backup || "";
      if (!extractedBackupOp && item.keterangan_cacat) {
        const match = item.keterangan_cacat.match(/\(Backup:\s*([^)]+)\)/i);
        if (match && match[1]) {
          extractedBackupOp = match[1].trim();
        }
      }

      if (!isPlaceholder) {
        items.push({
          ...item,
          isMeter: true,
          isStartRow: false,
          isIstirahatOnly: isIstirahatOnly,
          hasIstirahat: hasIstirahat,
          isFinishReport: isFinishReport,
          displayNo: (globalRowCount + 1).toString(),
          tglStr: finalTglStr,
          grpStr: finalGrpStr,
          oprStr: finalOprStr,
          meterDisplay,
          cacatDisplay: cacatText,
          backupOpName: extractedBackupOp,
          isGradable: isGradable,
          hasTambahanQC: hasTambahanQC,
          showTgl,
          showGrp,
          showOpr,
          hasErrorDetail
        });
        globalRowCount += 1;

        const meterVal = parseFloat(cleanMeterVal(meterDisplay));
        if (!isNaN(meterVal)) {
          if (currentOpStartMeter === null) currentOpStartMeter = meterVal;
          currentOpLastMeter = meterVal;
          if (grandTotalStartMeter === null) grandTotalStartMeter = meterVal;
          grandTotalLastMeter = meterVal;
        }

        const isDefectRow = !isIstirahatOnly && (hasRealDefects || hasTambahanQC || !!item.kategori_masalah || !!item.indikator_stop);
        if (isDefectRow) {
          currentOpCacatCount += 1;
          grandTotalCacatCount += 1;
        }
      }
    });

    // Push total row untuk operator terakhir
    if (items.length > 0 && currentOpStartMeter !== null && currentOpLastMeter !== null) {
      const totalMeter = Math.abs(currentOpLastMeter - currentOpStartMeter);
      const [lastGrp, lastOprOnly] = lastOprString.includes(") ") 
        ? [lastOprString.match(/\(([^)]+)\)/)?.[1] || "", lastOprString.replace(/^\([^)]+\)\s*/, "")]
        : ["", lastOprString];
      const normalMeter = Math.max(0, totalMeter - currentOpCacatCount);
      const cacatMeter = currentOpCacatCount;

      items.push({
        id: `total-last-${lastOprString}-${Math.random()}`,
        isTotalRow: true,
        totalLabel: `Total Produksi${lastGrp ? ` (${lastGrp})` : ""} ${lastOprOnly}:`,
        totalMeter: `${totalMeter} Meter`,
        normalMeter: `${normalMeter} Meter`,
        cacatMeter: `${cacatMeter} Meter`,
      });
    }

    // Push Grand Total Row untuk Total (Inspeksi)
    if (items.length > 0 && grandTotalStartMeter !== null && grandTotalLastMeter !== null) {
      const grandTotalMeter = Math.abs(grandTotalLastMeter - grandTotalStartMeter);
      const grandTotalNormal = Math.max(0, grandTotalMeter - grandTotalCacatCount);

      items.push({
        id: `grand-total-${Math.random()}`,
        isGrandTotalRow: true,
        totalLabel: "Total (Inspeksi):",
        totalMeter: `${grandTotalMeter} Meter`,
        normalMeter: `${grandTotalNormal} Meter`,
        cacatMeter: `${grandTotalCacatCount} Meter`,
      });
    }

    return items;
  }, [detailsToDisplay]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
            <th className="sticky left-0 z-20 bg-slate-100 px-0.5 py-2 w-6 text-center border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]">No</th>
            <th className="px-1 py-2 w-14 border-r border-slate-200">Tgl</th>
            <th className="px-0.5 py-2 w-8 text-center border-r border-slate-200">Group</th>
            <th className="px-1 py-2 w-16 border-r border-slate-200">Operator</th>
            <th className="px-1 py-2 text-center w-12 border-r border-slate-200">Meter</th>
            <th className="px-0.5 py-2 text-center w-8 border-r border-slate-200">KET <br /> ✓/X</th>
            <th className="px-1 py-2 min-w-[150px] w-full border-r border-slate-200">Keterangan Cacat</th>
            <th className="px-1 py-2 text-center w-20 border-r border-slate-200">Inspeksi</th>
            <th className="px-1 py-2 text-center w-10">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-[10px] text-slate-700">
          {displayItems.map((item, index) => {
            if (item.isTotalRow) {
              return (
                <tr key={item.id} className="bg-slate-100 border-t-2 border-b-2 border-slate-300">
                  <td colSpan={10} className="sticky left-0 z-10 bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]">
                    {item.totalLabel} <span className="font-extrabold text-slate-800 ml-1">{item.totalMeter}</span>
                  </td>
                </tr>
              );
            }
            return (
              <tr key={item.id} className={`${item.hasIstirahat ? "bg-amber-50/30" : "hover:bg-slate-50"} transition-colors`}>
                <td className={`sticky left-0 z-10 px-1 py-1.5 font-bold text-slate-800 text-center text-xs w-7 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)] ${item.hasIstirahat ? "bg-amber-100" : "bg-white"}`}>
                  {item.displayNo}
                </td>
                <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap text-xs w-24 border-r border-slate-100">
                  {item.showTgl ? item.tglStr : ""}
                </td>
                <td className="px-1 py-1.5 font-medium text-slate-700 text-center text-xs w-12 border-r border-slate-100">
                  {item.showGrp ? item.grpStr : ""}
                </td>
                <td className={`px-2 py-1.5 leading-tight text-xs w-28 border-r border-slate-100 ${(item.hasIstirahat && (!item.showOpr || !item.oprStr)) ? "italic font-bold text-amber-600" : "font-medium text-slate-700"}`}>
                  {item.showOpr ? (item.oprStr || (item.hasIstirahat ? "Istirahat" : "")) : (item.hasIstirahat ? "Istirahat" : "")}
                </td>
                <td className="px-1 py-1.5 text-center font-bold text-slate-800 text-xs w-14 border-r border-slate-100">
                  {item.meterDisplay}
                </td>
                <td className="px-1 py-1.5 text-center font-bold text-sm w-14 border-r border-slate-100">
                  {!item.isGradable ? "" : (item.indikator_stop || item.kategori_masalah || item.hasTambahanQC ? <span className="text-rose-600">X</span> : <span className="text-emerald-600">✓</span>)}
                </td>
                <td className={`px-3 py-1.5 text-[11px] font-medium whitespace-pre leading-tight border-r border-slate-100 ${item.hasIstirahat ? 'text-slate-500' : ((!item.isGradable || (!item.hasErrorDetail && !item.hasTambahanQC)) ? 'text-slate-700' : 'text-rose-600')}`}>
                  {item.backupOpName && item.hasIstirahat && <div className="font-bold text-slate-700">{item.backupOpName}</div>}
                  {!item.hasIstirahat && (item.cacatDisplay || "-")}
                  {item.hasIstirahat && !item.backupOpName && "-"}
                </td>
                <td className="px-1 py-1.5 text-center w-24 border-r border-slate-100">
                  {item.isGradable && (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleSelectGrade(item.id, 1)}
                        className={`w-6 h-6 flex items-center justify-center rounded-md transition-all border ${selections[item.id] === 1 ? "border-emerald-500 bg-emerald-100 text-emerald-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-emerald-300 hover:text-emerald-500"}`}
                        title="Ceklis (Normal)"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleSelectGrade(item.id, 3)}
                        className={`w-6 h-6 flex items-center justify-center rounded-md transition-all border ${selections[item.id] === 3 ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-rose-300 hover:text-rose-500"}`}
                        title="Silang (Cacat)"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleSelectGrade(item.id, 4)}
                        className={`w-6 h-6 flex items-center justify-center rounded-md transition-all border ${selections[item.id] === 4 ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-rose-300 hover:text-rose-500"}`}
                        title="BS"
                      >
                        <span className="text-[10px] font-black">BS</span>
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-1 py-1.5 text-center w-10">
                  {item.isGradable && item.id && (
                    <button
                      onClick={() => setDetailToDelete({ id: item.id, name: `${item.hasTambahanQC ? 'Tambahan QC' : (item.kategori_masalah || 'Masalah')} - ${item.detail_masalah || 'Tidak ada detail'}` })}
                      className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 transition-all shadow-sm mx-auto flex items-center justify-center"
                      title="Hapus Rincian"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
