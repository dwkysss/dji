"use client";

import React from "react";
import { CheckCircle2, XCircle, CheckCircle, X } from "lucide-react";
import { PROBLEM_DETAILS } from "@/lib/constants";
import { formatDefectLinesWithNumbering, getDefectMeterLength } from "@/lib/defect-format-utils";

export default function MeterHistoryTable({
  detailsToDisplay,
  header
}: {
  detailsToDisplay: any[];
  header: any;
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

    const filteredDetails = detailsToDisplay.filter((item: any) => {
      const h = item.production_headers || {};
      let hasRealDefects = false;
      if (item.production_defects && Array.isArray(item.production_defects)) {
        item.production_defects.forEach((d: any) => {
          if (!((d.kategori || "").toUpperCase().includes("ISTIRAHAT") || (d.detail || "").toUpperCase().includes("ISTIRAHAT"))) {
            hasRealDefects = true;
          }
        });
      }
      if (!item.production_defects || item.production_defects.length === 0) {
        if (item.kategori_masalah && !item.kategori_masalah.toUpperCase().includes("ISTIRAHAT")) {
          hasRealDefects = true;
        }
      }
      const hasIstirahatRaw = (
        (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") || 
        (item.kategori_masalah || "").toUpperCase().includes("ISTIRAHAT") || 
        (item.detail_masalah || "").toUpperCase().includes("ISTIRAHAT") || 
        (item.detail_masalah || "").toUpperCase().includes("OPLOS SHIFT") || 
        (item.detail_masalah || "").toUpperCase().includes("GANTI OPERATOR")
      );
      const hasIstirahat = hasIstirahatRaw && !hasRealDefects;
      const isIstirahat = hasIstirahat && (!item.kategori_masalah || item.kategori_masalah === "G");
      const isFinishReport = h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "";
      const hasDefect = !!item.kategori_masalah || !!item.detail_masalah || (item.keterangan_cacat && item.keterangan_cacat !== "START" && item.keterangan_cacat !== "FINISH" && !isIstirahat);

      if (!isIstirahat && !isFinishReport && !hasDefect && (item.meter_kain === null || item.meter_kain === undefined || String(item.meter_kain).trim() === "")) {
        return false;
      }
      return true;
    });

    const getMeterNumericVal = (item: any) => {
      const h = item.production_headers || {};
      let defectMeterStr = "";
      if (item.production_defects && Array.isArray(item.production_defects)) {
        for (const defect of item.production_defects) {
          if (defect.meter) {
            defectMeterStr = defect.meter;
            break;
          }
        }
      }

      let meterDisplay = "-";
      if (item.detail_masalah) {
        const meterMatch = item.detail_masalah.match(/\(Titik:\s*([A-Za-z0-9\s.\-]+)\)/i);
        if (meterMatch && meterMatch[1] && meterMatch[1].includes("-")) {
          meterDisplay = cleanMeterVal(meterMatch[1]);
        }
      }
      if (meterDisplay === "-") {
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
      }
      
      if (meterDisplay === "-") {
        if (h.meter_akhir || h.meter_awal) {
          meterDisplay = cleanMeterVal(h.meter_akhir || h.meter_awal);
        }
      }

      const clean = cleanMeterVal(meterDisplay);
      const firstPart = clean.split("-")[0].trim();
      const num = parseFloat(firstPart);
      return isNaN(num) ? 0 : num;
    };

    // Group items by operator shift
    const shiftGroups: Array<{
      operatorStr: string;
      items: any[];
    }> = [];

    filteredDetails.forEach((item: any) => {
      const h = item.production_headers || {};
      const opr = h.operators?.nama_operator || h.pic || "";
      const grp = h.groups?.nama_grup || "";
      const operatorStr = (grp ? `(${grp}) ` : '') + opr;

      const currentShift = shiftGroups[shiftGroups.length - 1];
      if (!currentShift || currentShift.operatorStr !== operatorStr) {
        shiftGroups.push({
          operatorStr,
          items: [item],
        });
      } else {
        currentShift.items.push(item);
      }
    });

    // Sort each operator shift by meter ascending
    shiftGroups.forEach((sg) => {
      sg.items.sort((a, b) => {
        const mA = getMeterNumericVal(a);
        const mB = getMeterNumericVal(b);
        if (mA !== mB) return mA - mB;
        const rawJamA = String(a.production_headers?.tanggal_jam || a.production_headers?.created_at || a.created_at || "");
        const rawJamB = String(b.production_headers?.tanggal_jam || b.production_headers?.created_at || b.created_at || "");
        return rawJamA.localeCompare(rawJamB);
      });
    });

    const sortedDetails = shiftGroups.flatMap((sg) => sg.items);

    sortedDetails.forEach((item: any, idx: number) => {
      const h = item.production_headers || {};
      let hasRealDefects = false;
      if (item.production_defects && Array.isArray(item.production_defects)) {
        item.production_defects.forEach((d: any) => {
          if (!((d.kategori || "").toUpperCase().includes("ISTIRAHAT") || (d.detail || "").toUpperCase().includes("ISTIRAHAT"))) {
            hasRealDefects = true;
          }
        });
      }
      if (!item.production_defects || item.production_defects.length === 0) {
        if (item.kategori_masalah && !item.kategori_masalah.toUpperCase().includes("ISTIRAHAT")) {
          hasRealDefects = true;
        }
      }
      const hasIstirahatRaw = (
        (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") || 
        (item.kategori_masalah || "").toUpperCase().includes("ISTIRAHAT") || 
        (item.detail_masalah || "").toUpperCase().includes("ISTIRAHAT") || 
        (item.detail_masalah || "").toUpperCase().includes("OPLOS SHIFT") || 
        (item.detail_masalah || "").toUpperCase().includes("GANTI OPERATOR")
      );
      const hasIstirahat = hasIstirahatRaw && !hasRealDefects;
      const isIstirahat = hasIstirahat && (!item.kategori_masalah || item.kategori_masalah === "G");
      const isFinishReport = h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "";
      const hasDefect = !!item.kategori_masalah || !!item.detail_masalah || (item.keterangan_cacat && item.keterangan_cacat !== "START" && item.keterangan_cacat !== "FINISH" && !isIstirahat);

      const opr = h.operators?.nama_operator || h.pic || "";
      const grp = h.groups?.nama_grup || "";
      const operatorStr = (grp ? `(${grp}) ` : '') + opr;

      if (items.length === 0) {
        lastOprString = operatorStr;
      }

      let isSameAsPrev = false;
      if (operatorStr !== lastOprString && items.length > 0) {
        const totalMeter = currentOpStartMeter !== null && currentOpLastMeter !== null
          ? Math.abs(currentOpLastMeter - currentOpStartMeter)
          : null;
        const [prevGrp, prevOpr] = lastOprString.includes(") ") 
          ? [lastOprString.match(/\(([^)]+)\)/)?.[1] || "", lastOprString.replace(/^\([^)]+\)\s*/, "")]
          : ["", lastOprString];

        const normalMeter = totalMeter !== null ? Math.max(0, totalMeter - currentOpCacatCount) : 0;
        const cacatMeter = currentOpCacatCount;

        items.push({
          id: `total-${lastOprString}-${Math.random()}`,
          isTotalRow: true,
          totalLabel: `Total Produksi${prevGrp ? ` (${prevGrp})` : ""} ${prevOpr}:`,
          totalMeter: totalMeter !== null ? `${totalMeter} Meter` : "-",
          normalMeter: totalMeter !== null ? `${normalMeter} Meter` : "-",
          cacatMeter: totalMeter !== null ? `${cacatMeter} Meter` : "-",
        });
        prevOperatorLastMeter = currentOpLastMeter;
        currentOpStartMeter = null;
        currentOpLastMeter = null;
        currentOpCacatCount = 0;
        lastOprString = operatorStr;
        isSameAsPrev = false;
      } else if (items.length > 0) {
        isSameAsPrev = true;
      }

      let cleanD = item.detail_masalah 
        ? item.detail_masalah.replace(/\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "").replace(/\|\s*$/, "").replace(/,\s*$/, "").trim()
        : "";

      let cacatLines: string[] = [];
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
        if (cleanD.includes(" | ")) {
          const catDetails = cleanD.split(" | ");
          for (let i = 0; i < Math.max(kats.length, catDetails.length); i++) {
            const k = kats[i] || "Unknown";
            const d = catDetails[i] || "";
            pushDetailsForCat(k, d);
          }
        } else if (cleanD) {
          if (kats.length === 1) {
            pushDetailsForCat(kats[0], cleanD);
          } else {
            const dets = cleanD.split(", ");
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

      let ketCacat = item.keterangan_cacat || "";
      const hasTambahanQC = ketCacat.includes("[TAMBAHAN QC]");
      ketCacat = ketCacat.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
      ketCacat = ketCacat.replace(/\[TAMBAHAN QC\]/gi, "").trim();
      ketCacat = ketCacat.replace(/^,\s*|\s*,\s*$/g, "");

      if (ketCacat.toUpperCase() === "START" || ketCacat.toUpperCase() === "FINISH") {
        ketCacat = "";
      }

      const hasDefectsArray = item.production_defects && Array.isArray(item.production_defects) && item.production_defects.length > 0;

      if (ketCacat && !hasDefectsArray) {
        if (cacatLines.length > 0) {
          const parts = ketCacat.split(",").map((p: string) => p.trim()).filter(Boolean);
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
                return cleanB ? `${line} (Blok ${cleanB})` : line;
              }
              return line;
            });
          }
        } else {
          const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
          if (cleanB && !cleanB.toUpperCase().includes("START") && !cleanB.toUpperCase().includes("FINISH") && !cleanB.toLowerCase().includes("backup") && !cleanB.toLowerCase().includes("istirahat") && cleanB !== "()" && cleanB !== "-") {
            cacatLines.push(`(Blok ${cleanB})`);
          }
        }
      }

      if (hasTambahanQC) {
        if (cacatLines.length === 0) {
          cacatLines.push("[TAMBAHAN QC]");
        } else {
          cacatLines = cacatLines.map(line => line + " [TAMBAHAN QC]");
        }
      }

      cacatLines = formatDefectLinesWithNumbering(cacatLines);
      const combinedCacat = cacatLines.join("\n");
      const hasErrorDetail = !!item.kategori_masalah || !!item.detail_masalah;

      let meterDisplay = "-";
      if (item.detail_masalah) {
        const meterMatch = item.detail_masalah.match(/\(Titik:\s*([A-Za-z0-9\s.\-]+)\)/i);
        if (meterMatch && meterMatch[1] && meterMatch[1].includes("-")) {
          meterDisplay = cleanMeterVal(meterMatch[1]);
        }
      }
      if (meterDisplay === "-") {
        if (item.meter_kain !== null && item.meter_kain !== undefined && String(item.meter_kain).trim() !== "") {
          meterDisplay = cleanMeterVal(item.meter_kain);
        } else if (item.detail_masalah) {
          const meterMatch = item.detail_masalah.match(/\(Titik:\s*([A-Za-z0-9\s.\-]+)\)/i);
          if (meterMatch && meterMatch[1]) {
            meterDisplay = cleanMeterVal(meterMatch[1]);
          }
        }
      }
      
      if (meterDisplay === "-") {
        if ((isIstirahat || isFinishReport) && (h.meter_akhir || h.meter_awal)) {
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

      const isStartMarker = ((item.keterangan_cacat || "").toUpperCase() === "START" || (item.production_headers?.panel_no || "").toUpperCase() === "START" || (item.meter_kain === "0" && !hasRealDefects && (item.keterangan_cacat === "START" || !item.keterangan_cacat))) && !hasRealDefects;
      const isGradable = !isIstirahat && !isStartMarker && (!isFinishReport || hasErrorDetail);
      const cacatForMeter = combinedCacat
        .split("\n")
        .map((line: string) => line.replace(/\s*\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "").trim())
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
      let backupOpName = "";
      if (hasIstirahat) {
        let extractedBackupOp = h.operator_backup || "";
        if (!extractedBackupOp && item.keterangan_cacat) {
          const match = item.keterangan_cacat.match(/\(Backup:\s*([^)]+)\)/i);
          if (match && match[1]) {
            extractedBackupOp = match[1].trim();
          }
        }
        backupOpName = extractedBackupOp;
      }

      const cacatText = hasIstirahat && !hasErrorDetail ? "ISTIRAHAT" : (isFinishReport && !hasErrorDetail ? "FINISH" : (hasErrorDetail && cacatForMeter ? cacatForMeter : "-"));

      const isPlaceholder = (meterDisplay === "-" && !hasErrorDetail && !isIstirahat && !isFinishReport) || isStartMarker;
      if (!isPlaceholder) {
        items.push({
          ...item,
          isStartRow: false,
          isMeter: true,
          isIstirahat,
          hasIstirahat,
          isFinishReport,
          displayNo: (globalRowCount + 1).toString(),
          tglStr: finalTglStr,
          grpStr: finalGrpStr,
          oprStr: finalOprStr,
          meterDisplay,
          cacatDisplay: cacatText,
          backupOpName,
          isGradable,
          showTgl: hasIstirahat ? false : showTgl,
          showGrp: hasIstirahat ? false : showGrp,
          showOpr: hasIstirahat ? true : showOpr,
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

        const isDefectRow = !isIstirahat && (hasRealDefects || hasTambahanQC || !!item.kategori_masalah);
        if (isDefectRow) {
          const defectLength = getDefectMeterLength(item);
          currentOpCacatCount += defectLength;
          grandTotalCacatCount += defectLength;
        }
      }
    });

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
  }, [detailsToDisplay, header]);

  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
          <th className="px-0.5 py-2 w-6 text-center border-r border-slate-100">NO</th>
          <th className="px-1 py-2 w-14 border-r border-slate-100">TGL</th>
          <th className="px-0.5 py-2 w-8 text-center border-r border-slate-100">Group</th>
          <th className="px-1 py-2 w-16 border-r border-slate-100">Operator</th>
          <th className="px-1 py-2 text-center w-12 border-r border-slate-100">METER</th>
          <th className="px-0.5 py-2 text-center w-8 border-r border-slate-100">KET <br /> ✓/X</th>
          <th className="px-1 py-2 min-w-[150px] w-full border-r border-slate-100">KETERANGAN CACAT</th>
          <th className="px-1 py-2 text-center w-14 border-r border-slate-100">INSPEKSI</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 text-[10px] text-slate-700">
        {displayItems.map((item: any, index: number) => {
          if (item.isTotalRow) {
            return (
              <tr key={item.id || index} className="bg-slate-100 border-t-2 border-b-2 border-slate-300">
                <td colSpan={8} className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
                  {item.totalLabel} <span className="font-extrabold text-slate-800 ml-1">{item.totalMeter}</span>
                </td>
              </tr>
            );
          }

          if (item.isStartRow) {
            return (
              <tr key={item.id || index} className="hover:bg-slate-50 transition-colors">
                <td className="px-1 py-1.5 font-bold text-slate-800 text-center text-xs w-7 border-r border-slate-100 border-b border-slate-100">
                  {item.displayNo}
                </td>
                <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap text-xs w-24 border-r border-slate-100 border-b border-slate-100">
                  {item.showTgl ? item.tglStr : ""}
                </td>
                <td className="px-1 py-1.5 font-medium text-slate-700 text-center text-xs w-12 border-r border-slate-100 border-b border-slate-100">
                  {item.showGrp ? item.grpStr : ""}
                </td>
                <td className="px-2 py-1.5 font-medium text-slate-700 leading-tight text-xs w-28 border-r border-slate-100 border-b border-slate-100">
                  {item.showOpr ? item.oprStr : ""}
                </td>
                <td className="px-1 py-1.5 text-center font-bold text-slate-800 text-xs w-14 border-r border-slate-100 border-b border-slate-100">
                  {item.meterDisplay}
                </td>
                <td className="px-1 py-1.5 text-center font-bold text-sm w-14 border-r border-slate-100 border-b border-slate-100">
                  {/* Empty KET for START */}
                </td>
                <td className="px-3 py-1.5 text-[11px] font-bold text-slate-400 whitespace-pre leading-tight border-r border-slate-100 border-b border-slate-100">
                  START
                </td>
                <td className="px-1 py-1.5 text-center w-24 border-r border-slate-100 border-b border-slate-100">
                  {/* Empty INSPEKSI for START */}
                </td>
              </tr>
            );
          }

          let Icon = null;
          let iconColor = "";

          if (item.isIstirahat || item.cacatDisplay === "ISTIRAHAT" || item.cacatDisplay === "FINISH") {
            Icon = null;
          } else if (item.final_inspection_id === 1) {
            Icon = CheckCircle2;
            iconColor = "text-emerald-500";
          } else if (item.final_inspection_id === 2 || item.final_inspection_id === 3 || item.final_inspection_id === 4) {
            Icon = XCircle;
            iconColor = "text-rose-500";
          }
          const isRowQcModified = item.hasTambahanQC || !!item.keterangan_cacat?.includes("[TAMBAHAN QC]") || !!item.keterangan_cacat?.includes("[TAMBAHAN MENDING]") || (!!item.keterangan_qc && item.keterangan_qc !== "-");
          const rowBgClass = isRowQcModified
            ? "bg-sky-50/90 hover:bg-sky-100/60 border-y border-sky-200"
            : item.hasIstirahat
            ? "bg-amber-50/40 hover:bg-amber-100/50"
            : "hover:bg-slate-50";

          const cacatRawLines = (item.cacatDisplay && item.cacatDisplay !== "-")
            ? item.cacatDisplay.split("\n").map((l: string) => l.trim()).filter(Boolean)
            : [];

          const parsedCacatItems = cacatRawLines.map((line: string) => {
            const isLineQc = line.includes("[QC]") || line.includes("[TAMBAHAN QC]") || line.includes("[TAMBAHAN MENDING]") || item.hasTambahanQC;
            const cleanText = line
              .replace(/\[QC\]/gi, "")
              .replace(/\[TAMBAHAN QC\]/gi, "")
              .replace(/\[TAMBAHAN MENDING\]/gi, "")
              .replace(/^([A-Z0-9]\s*[-.]\s*|\d+\.\s*|\d+-\s*)/i, "")
              .trim();
            return { isLineQc, text: cleanText };
          }).filter((c: any) => c.text.length > 0 && c.text !== "-");

          return (
            <tr key={item.id || index} className={`${rowBgClass} transition-colors`}>
              <td className={`px-1 py-1.5 font-bold text-slate-800 text-center text-xs w-7 border-r border-slate-100 border-b border-slate-100 ${isRowQcModified ? "bg-sky-100/70" : ""}`}>
                <div className="flex flex-col items-center justify-center">
                  <span>{item.displayNo}</span>
                  {isRowQcModified && (
                    <span className="block text-[8px] font-black bg-sky-100 text-[#0070bc] px-1 py-0.5 rounded mt-0.5 leading-none border border-sky-300 shadow-2xs">+ QC</span>
                  )}
                </div>
              </td>
              <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap text-xs w-24 border-r border-slate-100 border-b border-slate-100">
                {item.showTgl ? item.tglStr : ""}
              </td>
              <td className="px-1.5 py-1.5 font-medium text-slate-700 text-center text-xs w-12 border-r border-slate-100 border-b border-slate-100">
                {item.showGrp ? item.grpStr : ""}
              </td>
              <td className={`px-2 py-1.5 font-medium leading-tight text-xs w-28 border-r border-slate-100 border-b border-slate-100 ${(item.hasIstirahat && !item.showOpr) ? "italic font-bold text-amber-600" : "text-slate-700"}`}>
                {item.showOpr ? item.oprStr : (item.hasIstirahat ? "Istirahat" : "")}
              </td>
              <td className="px-1 py-1.5 text-center font-bold text-slate-800 text-xs w-14 border-r border-slate-100 border-b border-slate-100">
                {item.meterDisplay}
              </td>
              <td className="px-1 py-1.5 text-center font-bold text-sm w-14 border-r border-slate-100 border-b border-slate-100">
                {Icon ? <Icon className={`w-4 h-4 mx-auto ${iconColor}`} /> : null}
              </td>
              <td className="px-3 py-1.5 text-[11px] font-medium whitespace-pre leading-tight border-r border-slate-100 border-b border-slate-100">
                {item.hasIstirahat && (
                  <>
                    {(item.backupOpName && item.backupOpName.trim().toLowerCase() !== (item.oprStr || "").trim().toLowerCase()) ? (
                      <div className="font-bold text-slate-700 mb-0.5">{item.backupOpName}</div>
                    ) : item.showOpr ? (
                      <div className="font-bold text-slate-700 mb-0.5">ISTIRAHAT</div>
                    ) : (
                      <div className="font-bold text-slate-700 mb-0.5">{item.backupOpName || "-"}</div>
                    )}
                  </>
                )}
                {parsedCacatItems.length > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    {parsedCacatItems.map((cItem: any, idx: number) => {
                      const numPrefix = parsedCacatItems.length > 1 ? `${idx + 1}. ` : "";
                      return (
                        <div
                          key={idx}
                          className={
                            cItem.isLineQc
                              ? "text-[#0070bc] font-semibold"
                              : (!item.isGradable || item.isGagalCacatOnly)
                              ? "text-slate-500 font-medium"
                              : "text-rose-600 font-medium"
                          }
                        >
                          {numPrefix}{cItem.text}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  !item.hasIstirahat && <span className="text-slate-400">-</span>
                )}
                {item.keterangan_qc && item.keterangan_qc !== "-" && (
                  <div className="text-[#0070bc] bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5 font-bold text-[10px] mt-0.5 shadow-2xs flex items-center gap-1 w-fit">
                    <span className="text-[#0070bc] font-black">QC:</span> {item.keterangan_qc}
                  </div>
                )}
              </td>
              <td className="px-1 py-1.5 text-center w-24 border-r border-slate-100 border-b border-slate-100">
                {item.isGradable && (
                  <div className="flex items-center justify-center gap-1">
                    <div
                      className={`w-6 h-6 flex items-center justify-center rounded-md border ${item.final_inspection_id === 1 ? "border-emerald-500 bg-emerald-100 text-emerald-700 shadow-sm" : "border-slate-200 bg-white text-slate-300"}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                    <div
                      className={`w-6 h-6 flex items-center justify-center rounded-md border ${item.final_inspection_id === 3 ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-300"}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </div>
                    <div
                      className={`w-6 h-6 flex items-center justify-center rounded-md border ${item.final_inspection_id === 4 ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-300"}`}
                    >
                      <span className={`text-[10px] font-black ${item.final_inspection_id === 4 ? "text-rose-700" : "text-slate-300"}`}>BS</span>
                    </div>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
