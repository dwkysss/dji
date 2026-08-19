"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  getMendingReportOptions, 
  getMendingReportData,
  getAllDetailsForPcs,
  getMechanicDowntimesForReport
} from "@/actions/mending-actions";
import { 
  FileSpreadsheet, 
  Search, 
  Loader2, 
  AlertTriangle, 
  Download, 
  Filter, 
  Package,
  ArrowLeft,
  Wrench
} from "lucide-react";
import * as xlsx from "xlsx";
import { PROBLEM_DETAILS } from "../../../qc/page";

const cleanMeterVal = (val: any) => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  const clean = str.replace(/PCS\s*\d+\s*:\s*/gi, "");
  return clean.replace(/[a-zA-Z\s]+$/g, "").trim();
};

const getActualMeter = (item: any, h: any) => {
  if (item.meter_kain !== null && item.meter_kain !== undefined && String(item.meter_kain).trim() !== "") {
    const clean = cleanMeterVal(item.meter_kain);
    const parsed = parseFloat(clean);
    if (!isNaN(parsed)) return parsed;
  }
  if (item.detail_masalah) {
    const meterMatch = item.detail_masalah.match(/\(Titik:\s*([A-Za-z0-9\s.\-]+)\)/i);
    if (meterMatch && meterMatch[1]) {
      const clean = cleanMeterVal(meterMatch[1]);
      const parsed = parseFloat(clean);
      if (!isNaN(parsed)) return parsed;
    }
  }
  const isIstirahat = (!!item.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") || 
                       !!item.kategori_masalah?.toUpperCase().includes("ISTIRAHAT")) && 
                      !item.kategori_masalah && !item.detail_masalah;
  const isFinishReport = h?.meter_akhir !== null && h?.meter_akhir !== undefined && String(h?.meter_akhir).trim() !== "";
  if ((isIstirahat || isFinishReport) && (h?.meter_akhir || h?.meter_awal)) {
    const clean = cleanMeterVal(h?.meter_akhir || h?.meter_awal);
    const parsed = parseFloat(clean);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
};

export const isBsAwalAkhir = (item: any) => {
  const pNo = String(
    item.detail?.header?.panel_no ||
    item.header?.panel_no ||
    item.detail?.panel_no ||
    item.panel_no ||
    ""
  ).trim().toUpperCase();
  return pNo.includes("AWAL") || pNo.includes("AKHIR");
};

export const calculateOverallGradeData = (
  items: any[],
  isMeter: boolean,
  totalMeterSum?: number
) => {
  let totalQty = 0;
  let totalCacat = 0;
  const unit = isMeter ? "Meter" : "Panel";

  if (isMeter) {
    if (totalMeterSum !== undefined && totalMeterSum > 0) {
      totalQty = totalMeterSum;
    } else {
      (items || []).forEach((i: any) => {
        totalQty = Math.max(totalQty, Number(i.detail?.jml_hasil_produksi || 0));
      });
      if (totalQty === 0) totalQty = 300;
    }

    (items || []).forEach((i: any) => {
      if (isBsAwalAkhir(i)) return;
      const isSpecial =
        ((!!i.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") ||
          !!i.kategori_masalah?.toUpperCase().includes("ISTIRAHAT")) &&
          !i.kategori_masalah &&
          !i.detail_masalah) ||
        i.cacatDisplay === "START" ||
        i.cacatDisplay === "FINISH" ||
        i.cacatDisplay === "ISTIRAHAT";
      if (isSpecial) return;

      // Diambil dari SETELAH INSPECT (hasil_mending), bukan data produksi
      if (i.hasil_mending === "B" || i.hasil_mending === "BS") {
        totalCacat += 1;
      }
    });
  } else {
    // Panel: Panel BS Awal dan BS Akhir tidak disertakan
    const regularItems = (items || []).filter((i: any) => !isBsAwalAkhir(i));
    totalQty = regularItems.length;

    // Total Cacat diambil dari SETELAH INSPECT (hasil_mending)
    regularItems.forEach((i: any) => {
      if (i.hasil_mending === "B" || i.hasil_mending === "BS") {
        totalCacat += 1;
      }
    });
  }

  let overallGrade = "-";
  let bucket = 0;

  if (totalQty > 0) {
    if (isMeter) {
      bucket = 300;
      if (totalQty > 450) bucket = 500;
      else if (totalQty > 400) bucket = 450;
      else if (totalQty > 350) bucket = 400;
      else if (totalQty > 300) bucket = 350;
      else bucket = 300;

      let limitA = 9, limitB = 15, limitC = 21;
      if (bucket === 350) { limitA = 11; limitB = 18; limitC = 25; }
      if (bucket === 400) { limitA = 12; limitB = 20; limitC = 28; }
      if (bucket === 450) { limitA = 14; limitB = 23; limitC = 32; }
      if (bucket === 500) { limitA = 15; limitB = 25; limitC = 35; }

      if (totalCacat <= limitA) overallGrade = "A";
      else if (totalCacat <= limitB) overallGrade = "B";
      else if (totalCacat <= limitC) overallGrade = "C";
      else overallGrade = "D";
    } else {
      bucket = 50;
      if (totalQty > 125) bucket = 150;
      else if (totalQty > 120) bucket = 125;
      else if (totalQty > 100) bucket = 120;
      else if (totalQty > 75) bucket = 100;
      else if (totalQty > 65) bucket = 75;
      else if (totalQty > 50) bucket = 65;
      else bucket = 50;

      let limitA = 5, limitB = 8, limitC = 9;
      if (bucket === 65) { limitA = 7; limitB = 10; limitC = 13; }
      if (bucket === 75) { limitA = 8; limitB = 12; limitC = 15; }
      if (bucket === 100) { limitA = 10; limitB = 15; limitC = 19; }
      if (bucket === 120) { limitA = 12; limitB = 18; limitC = 23; }
      if (bucket === 125) { limitA = 13; limitB = 19; limitC = 25; }
      if (bucket === 150) { limitA = 15; limitB = 23; limitC = 29; }

      if (totalCacat <= limitA) overallGrade = "A";
      else if (totalCacat <= limitB) overallGrade = "B";
      else if (totalCacat <= limitC) overallGrade = "C";
      else overallGrade = "D";
    }
  }

  return {
    overallGrade,
    bucket,
    totalQty,
    totalCacat,
    unit
  };
};

export default function MendingProductionReportPage() {
  const [options, setOptions] = useState<{ mesins: string[], potongans: number[] }>({
    mesins: [],
    potongans: []
  });

  const [filters, setFilters] = useState({
    nomor_mc: "",
    potongan_ke: "",
    tanggal: "",
    jenis_kain: "all"
  });

  const [selectedPotonganKey, setSelectedPotonganKey] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [data, setData] = useState<any[]>([]);
  const [mechanicDowntimes, setMechanicDowntimes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const checkIsMeter = (pcs: any) => {
    if (!pcs) return false;
    const items = pcs.items || [];
    if (items[0]?.detail?.header?.panel_no === "METERAN") return true;
    if (pcs.allPcsDetails?.[0]?.production_headers?.panel_no === "METERAN") return true;
    if (pcs.header?.panel_no === "METERAN") return true;
    return false;
  };

  const filteredData = useMemo(() => {
    return data.filter((pcs) => {
      if (filters.tanggal) {
        if (pcs.tanggal_mending !== filters.tanggal) {
          return false;
        }
      }
      if (filters.jenis_kain && filters.jenis_kain !== "all") {
        const isMeter = checkIsMeter(pcs);
        const type = isMeter ? "meteran" : "panel";
        if (type !== filters.jenis_kain) {
          return false;
        }
      }
      return true;
    });
  }, [data, filters.tanggal, filters.jenis_kain]);

  const displayData = useMemo(() => {
    return filteredData.map((pcs) => {
      const items = pcs.items || [];
      const isMeter = checkIsMeter(pcs);

      if (isMeter && pcs.allPcsDetails && pcs.allPcsDetails.length > 0) {
        const detailsToDisplay = pcs.allPcsDetails.map((detail: any) => {
          const mendingItem = items.find((item: any) => item.detail?.id === detail.id);
          return {
            ...detail,
            hasil_mending_original: mendingItem?.hasil_mending || null,
            final_inspection_id: detail.final_inspection_id,
            production_headers: detail.production_headers || detail.header || pcs.header,
          };
        }).sort((a: any, b: any) => {
          const hjA = String(a.production_headers?.tanggal_jam || "");
          const hjB = String(b.production_headers?.tanggal_jam || "");
          if (hjA !== hjB) return hjA.localeCompare(hjB);

          const isSpecialA = ((!!a.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") || !!a.kategori_masalah?.toUpperCase().includes("ISTIRAHAT"))
                && !a.kategori_masalah && !a.detail_masalah)
            || (a.production_headers?.meter_akhir !== null && a.production_headers?.meter_akhir !== undefined
                && String(a.production_headers?.meter_akhir).trim() !== ""
                && (a.meter_kain === null || a.meter_kain === undefined));
          const isSpecialB = ((!!b.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") || !!b.kategori_masalah?.toUpperCase().includes("ISTIRAHAT"))
                && !b.kategori_masalah && !b.detail_masalah)
            || (b.production_headers?.meter_akhir !== null && b.production_headers?.meter_akhir !== undefined
                && String(b.production_headers?.meter_akhir).trim() !== ""
                && (b.meter_kain === null || b.meter_kain === undefined));

          if (isSpecialA && !isSpecialB) return 1;
          if (!isSpecialA && isSpecialB) return -1;
          if (isSpecialA && isSpecialB) return 0;

          const valA = getActualMeter(a, a.production_headers);
          const valB = getActualMeter(b, b.production_headers);
          const mA = valA !== null ? valA : Infinity;
          const mB = valB !== null ? valB : Infinity;
          if (mA === Infinity && mB === Infinity) return 0;
          return mA - mB;
        });

        const displayItems: any[] = [];
        let globalRowCount = 0;
        let prevOperatorLastMeter: number | null = null;
        let currentOpStartMeter: number | null = null;
        let currentOpLastMeter: number | null = null;
        let lastOprString = "";

        detailsToDisplay.forEach((item: any, idx: number) => {
          const h = item.production_headers || {};
          const opr = h.operators?.nama_operator || h.pic || "";
          const grp = h.groups?.nama_grup || "";
          const operatorStr = (grp ? `(${grp}) ` : '') + opr;

          if (displayItems.length === 0) {
            lastOprString = operatorStr;
          }

          let isSameAsPrev = false;
          if (operatorStr !== lastOprString && displayItems.length > 0) {
            const totalMeter = currentOpStartMeter !== null && currentOpLastMeter !== null
              ? Math.abs(currentOpLastMeter - currentOpStartMeter)
              : null;
            const [prevGrp, prevOpr] = lastOprString.includes(") ") 
              ? [lastOprString.match(/\(([^)]+)\)/)?.[1] || "", lastOprString.replace(/^\([^)]+\)\s*/, "")]
              : ["", lastOprString];
            displayItems.push({
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
          } else if (displayItems.length > 0) {
            isSameAsPrev = true;
          }

          let hasRealDefects = false;
          if (item.kategori_masalah && !item.kategori_masalah.toUpperCase().includes("ISTIRAHAT")) {
            hasRealDefects = true;
          }
          const hasIstirahatRaw = (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") || (item.kategori_masalah || "").toUpperCase().includes("ISTIRAHAT") || opr.toUpperCase().includes("ISTIRAHAT");
          const hasIstirahat = hasIstirahatRaw;
          const isIstirahat = hasIstirahat && !hasRealDefects && !item.kategori_masalah && !item.detail_masalah;

          let backupOpName = "";
          if (hasIstirahat) {
            let extractedBackupOp = h.operator_backup || "";
            if (!extractedBackupOp && item.keterangan_cacat) {
              const match = item.keterangan_cacat.match(/\(Backup:\s*([^)]+)\)/i);
              if (match && match[1]) {
                extractedBackupOp = match[1].trim();
              }
            }
            if (!extractedBackupOp && opr.toUpperCase().includes("ISTIRAHAT")) {
              const match = opr.match(/Istirahat\s*\(([^)]+)\)/i);
              if (match && match[1]) {
                extractedBackupOp = match[1].trim();
              } else {
                const parts = opr.split(/Istirahat/i);
                if (parts.length > 1 && parts[1].trim() !== "") {
                  extractedBackupOp = parts[1].trim();
                }
              }
            }
            if (extractedBackupOp) backupOpName = extractedBackupOp;
          }
          const isFinishReport = h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "";

          let meterDisplay = "-";
          if (item.meter_kain !== null && item.meter_kain !== undefined && String(item.meter_kain).trim() !== "") {
            meterDisplay = cleanMeterVal(item.meter_kain);
          } else if (item.detail_masalah) {
            const meterMatch = item.detail_masalah.match(/\(Titik:\s*([A-Za-z0-9\s.\-]+)\)/i);
            if (meterMatch && meterMatch[1]) {
              meterDisplay = cleanMeterVal(meterMatch[1]);
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

            displayItems.push({
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
            }
            isSameAsPrev = true;
          }

          const finalOprStr = isSameAsPrev ? "" : opr;
          const finalGrpStr = isSameAsPrev ? "" : grp;
          const finalTglStr = isSameAsPrev ? "" : h.tgl || "-";

          const showTgl = !isSameAsPrev;
          const showGrp = !isSameAsPrev;
          const showOpr = !isSameAsPrev;

          const isGradable = !isIstirahat && (!isFinishReport || item.kategori_masalah || item.detail_masalah);
          const cacatForMeter = (item.detail_masalah || item.keterangan_cacat || "")
            .split("\n")
            .map((line: string) => line.replace(/\s*\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "").trim())
            .filter(Boolean)
            .join("\n");
          const cacatText = isIstirahat ? "ISTIRAHAT" : (isFinishReport && !item.kategori_masalah && !item.detail_masalah ? "FINISH" : (cacatForMeter ? cacatForMeter : "-"));

          const isPlaceholder = meterDisplay === "-" && !item.kategori_masalah && !item.detail_masalah && !isIstirahat && !isFinishReport;
          if (!isPlaceholder) {
            displayItems.push({
              detail: item,
              id: item.id || `detail-${idx}-${Math.random()}`,
              hasil_mending: item.hasil_mending_original,
              hasil_mending_original: item.hasil_mending_original,
              isStartRow: false,
              isMeter: true,
              isIstirahat,
              isFinishReport,
              displayNo: (globalRowCount + 1).toString(),
              tglStr: finalTglStr,
              grpStr: finalGrpStr,
              oprStr: finalOprStr,
              meterDisplay,
              cacatDisplay: cacatText,
              isGradable,
              showTgl,
              showGrp,
              showOpr,
              hasIstirahat,
              backupOpName,
              hasErrorDetail: !!item.kategori_masalah || !!item.detail_masalah
            });
            globalRowCount += 1;

            const meterVal = parseFloat(cleanMeterVal(meterDisplay));
            if (!isNaN(meterVal)) {
              if (currentOpStartMeter === null) currentOpStartMeter = meterVal;
              currentOpLastMeter = meterVal;
            }
          }
        });

        if (displayItems.length > 0 && currentOpStartMeter !== null && currentOpLastMeter !== null) {
          const totalMeter = Math.abs(currentOpLastMeter - currentOpStartMeter);
          const [lastGrp, lastOprOnly] = lastOprString.includes(") ") 
            ? [lastOprString.match(/\(([^)]+)\)/)?.[1] || "", lastOprString.replace(/^\([^)]+\)\s*/, "")]
            : ["", lastOprString];
          displayItems.push({
            id: `total-last-${lastOprString}-${Math.random()}`,
            isTotalRow: true,
            totalLabel: `Total Produksi${lastGrp ? ` (${lastGrp})` : ""} ${lastOprOnly}:`,
            totalMeter: `${totalMeter} Meter`,
          });
        }

        return { ...pcs, displayItems };
      }

      const sortedItems = [...items].sort((a, b) => {
        const pA = String(a.detail?.header?.panel_no || "").trim().toUpperCase();
        const pB = String(b.detail?.header?.panel_no || "").trim().toUpperCase();
        if (pA === "METERAN" && pB === "METERAN") {
          return parseFloat(a.detail?.meter_kain || 0) - parseFloat(b.detail?.meter_kain || 0);
        }
        if (pA === "METERAN") return 1;
        if (pB === "METERAN") return -1;
        if (pA.includes("AWAL") && !pB.includes("AWAL")) return -1;
        if (!pA.includes("AWAL") && pB.includes("AWAL")) return 1;
        if (pA.includes("AKHIR") && !pB.includes("AKHIR")) return 1;
        if (!pA.includes("AKHIR") && pB.includes("AKHIR")) return -1;
        return parseInt(pA || "0", 10) - parseInt(pB || "0", 10);
      });

      const displayItems: any[] = [];
      let currentOpCount = 0;
      let lastOprString = "";
      let prevTgl = "";

      sortedItems.forEach((item, idx) => {
        const det = item.detail || {};
        let opr = det.header?.operators?.nama_operator || det.header?.pic || "";
        const grp = det.header?.groups?.nama_grup || "";
        const currentTgl = det.header?.tgl || "";
        const operatorStr = (grp ? `(${grp}) ` : '') + opr;
        
        if (idx === 0) {
          lastOprString = operatorStr;
          prevTgl = currentTgl;
        }

        let isOperatorChanged = false;
        if (operatorStr !== lastOprString && idx > 0) {
          displayItems.push({
            isSummaryRow: true,
            operatorName: lastOprString,
            totalCount: currentOpCount,
            id: `summary-${idx}`
          });
          currentOpCount = 0;
          lastOprString = operatorStr;
          isOperatorChanged = true;
        }

        const isFirstDataRow = idx === 0;
        const isFirstRowForOperator = isFirstDataRow || isOperatorChanged;

        // Tanggal rule (Rule 6 & 7): show on row 0 or when date changes from previous row
        let showTgl = false;
        if (isFirstDataRow || (currentTgl && currentTgl !== prevTgl)) {
          showTgl = true;
          prevTgl = currentTgl;
        }

        // Group rule (Rule 6 & 8): show on row 0 or when operator changes
        let showGrp = isFirstRowForOperator;

        const hasRealDefects = !!det.kategori_masalah && !det.kategori_masalah.toUpperCase().includes("ISTIRAHAT");
        const hasIstirahatRaw = (det.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") || 
                                (det.kategori_masalah || "").toUpperCase().includes("ISTIRAHAT") || 
                                opr.toUpperCase().includes("ISTIRAHAT");
        const hasIstirahat = hasIstirahatRaw && !hasRealDefects;

        let backupOpName = "";
        if (hasIstirahatRaw) {
          let extractedBackupOp = det.header?.operator_backup || "";
          if (!extractedBackupOp && det.keterangan_cacat) {
            const match = det.keterangan_cacat.match(/\(Backup:\s*([^)]+)\)/i);
            if (match && match[1]) extractedBackupOp = match[1].trim();
          }
          if (!extractedBackupOp && opr.toUpperCase().includes("ISTIRAHAT")) {
            const match = opr.match(/Istirahat\s*\(([^)]+)\)/i);
            if (match && match[1]) {
              extractedBackupOp = match[1].trim();
            } else {
              const parts = opr.split(/Istirahat/i);
              if (parts.length > 1 && parts[1].trim() !== "") extractedBackupOp = parts[1].trim();
            }
          }
          if (extractedBackupOp) backupOpName = extractedBackupOp;
        }

        // Operator column rule (Rule 6, 9, 10, 12):
        // Rule 12: If data with rest label is on the FIRST ROW of data (or first row of operator), priority is OPERATOR NAME
        // Rule 10: Exception for operator column, can contain "Istirahat" on subsequent rows if labeled rest
        let displayOperator = "";
        if (isFirstRowForOperator) {
          displayOperator = opr || "-";
        } else if (hasIstirahat) {
          displayOperator = "Istirahat";
        } else {
          displayOperator = "";
        }

        const isIstirahat = hasIstirahat;

        displayItems.push({
          ...item,
          hasIstirahat,
          isIstirahat,
          backupOpName,
          showTgl,
          showGrp,
          displayTgl: showTgl ? currentTgl : "",
          displayGrp: showGrp ? grp : "",
          displayOpr: displayOperator,
          isFirstRowForOperator
        });

        currentOpCount += Number(det.jml_hasil_produksi || 1);
        
        if (idx === sortedItems.length - 1) {
          displayItems.push({
            isSummaryRow: true,
            operatorName: operatorStr,
            totalCount: currentOpCount,
            id: `summary-end`
          });
        }
      });

      return { ...pcs, displayItems };
    });
  }, [filteredData]);

  const groupedPotongans = useMemo(() => {
    const map = new Map<string, any>();
    displayData.forEach((pcs: any) => {
      const key = `${pcs.nomor_mc}_${pcs.design_id}_${pcs.potongan_ke}`;
      const isMeter = checkIsMeter(pcs);
      if (!map.has(key)) {
        map.set(key, {
          key,
          nomor_mc: pcs.nomor_mc,
          design_id: pcs.design_id,
          potongan_ke: pcs.potongan_ke,
          tanggal_mending: pcs.tanggal_mending,
          petugas_mending: new Set([pcs.petugas_mending]),
          pcsList: [pcs],
          isMeter,
          totalA: 0,
          totalB: 0,
          totalBS: 0
        });
      } else {
        const pot = map.get(key);
        pot.petugas_mending.add(pcs.petugas_mending);
        pot.pcsList.push(pcs);
      }
      
      const pot = map.get(key);
      if (isMeter) {
        // Meter: totalB = defect titik setelah inspect, totalBS = BS titik, totalA = total meter - totalB
        let totalMeterSum = 0;
        pcs.displayItems?.forEach((di: any) => {
          if (di.isTotalRow && di.totalMeter) {
            const m = parseFloat(di.totalMeter);
            if (!isNaN(m)) totalMeterSum += m;
          }
        });
        
        const inspectBCount = pcs.items?.filter((i: any) => i.hasil_mending === "B").length || 0;
        const inspectBSCount = pcs.items?.filter((i: any) => i.hasil_mending === "BS").length || 0;
        
        pot.totalB += inspectBCount;
        pot.totalBS += inspectBSCount;
        pot.totalA += Math.max(0, totalMeterSum - inspectBCount);
      } else {
        // Panel: count per hasil_mending grade
        (pcs.items || []).forEach((item: any) => {
          if (item.hasil_mending === "A") pot.totalA++;
          if (item.hasil_mending === "B") pot.totalB++;
          if (item.hasil_mending === "BS") pot.totalBS++;
        });
      }
    });

    return Array.from(map.values()).map(p => ({
      ...p,
      petugas_mending: Array.from(p.petugas_mending).filter(Boolean).join(", ")
    }));
  }, [displayData]);

  const selectedPcsData = useMemo(() => {
    if (!selectedPotonganKey) return [];
    return displayData.filter((pcs: any) => {
      const key = `${pcs.nomor_mc}_${pcs.design_id}_${pcs.potongan_ke}`;
      return key === selectedPotonganKey;
    });
  }, [displayData, selectedPotonganKey]);

  useEffect(() => {
    getMendingReportOptions().then(res => {
      if (res.success && res.data) {
        setOptions({
          mesins: (res.data.mesins as any[]).sort(),
          potongans: (res.data.potongans as any[]).sort((a,b) => Number(a) - Number(b))
        });
      }
    });
  }, []);

  useEffect(() => {
    handleSearch();
    setCurrentPage(1);
  }, [filters.nomor_mc, filters.potongan_ke]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.tanggal, filters.jenis_kain]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    setIsLoading(true);
    setErrorMsg(null);
    setHasSearched(true);
    setSelectedPotonganKey(null);
    
    try {
      const [res, mechRes] = await Promise.all([
        getMendingReportData(
          filters.nomor_mc || undefined, 
          filters.potongan_ke || undefined
        ),
        getMechanicDowntimesForReport(
          filters.tanggal || undefined,
          filters.nomor_mc || undefined
        )
      ]);

      if (mechRes.success && mechRes.data) {
        setMechanicDowntimes(mechRes.data);
      } else {
        setMechanicDowntimes([]);
      }

      if (res.success && res.data) {
        const sortedData = [...res.data].sort((a, b) => {
          return Number(a.detail.pcs_index) - Number(b.detail.pcs_index);
        });

        const updatedData = await Promise.all(
          sortedData.map(async (pcs: any) => {
            const isMeter = checkIsMeter(pcs);
            if (!isMeter) {
              return { ...pcs, allPcsDetails: pcs.items?.map((i: any) => i.detail) || [] };
            }
            const headerInfo = pcs.header || {};
            const nomor_mc = pcs.nomor_mc;
            const design_id = headerInfo.design_id;
            const potongan_ke = pcs.potongan_ke;
            const pcs_index = pcs.detail?.pcs_index || pcs.pcs_index;

            const detailsRes = await getAllDetailsForPcs(
              nomor_mc,
              design_id,
              parseInt(potongan_ke),
              parseInt(pcs_index)
            );

            if (detailsRes.success && detailsRes.data) {
              return { ...pcs, allPcsDetails: detailsRes.data };
            }
            return { ...pcs, allPcsDetails: [] };
          })
        );

        setData(updatedData);
      } else {
        setErrorMsg(res.error || "Gagal mengambil data laporan.");
        setData([]);
      }
    } catch (err: any) {
      setErrorMsg("Terjadi kesalahan jaringan.");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = () => {
    const exportSource = selectedPotonganKey ? selectedPcsData : data;
    const exportDisplaySource = selectedPotonganKey ? selectedPcsData : displayData;

    if (exportSource.length === 0) return;
    const headerRow = exportSource[0]?.header || {};
    const firstPcs = exportSource[0];

    const isReportMeter = checkIsMeter(firstPcs);
    const reportType = isReportMeter ? "ALL OVER" : "PANEL";

    const wb = xlsx.utils.book_new();
    const wsData: any[][] = [];

    // Header Title
    wsData.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", `FORM KUALITAS PRODUKSI KAIN ${reportType}`]);
    wsData.push([]);
    wsData.push([]);
    
    // Header Info
    wsData.push(["", "Design                    ", "", ":", headerRow.design_id || "", "", "", "", "", "", "", "Potongan ke", "", ":", headerRow.potongan_ke || ""]);
    wsData.push(["", "Nomor Mc           ", "", ":", headerRow.nomor_mc || "", "", "", "", "", "", "", "Roll no", "", ":", firstPcs.roll_no || ""]);
    wsData.push(["", "Tanggal produksi", "", ":", headerRow.tgl || "", "", "", "", "", "", "", "Jenis Benang Dsr", "", ":", headerRow.jenis_benang_dasar || ""]);
    wsData.push(["", "Tanggal potong", "", ":", headerRow.tanggal_potong || headerRow.tgl || "", "", "", "", "", "", "", "Liner", "", ":", headerRow.liner || ""]);
    wsData.push(["", "Pick", "", ":", headerRow.pick || "", "", "", "", "", "", "", "Heavy", "", ":", headerRow.heavy || ""]);
    wsData.push(["", "Course", "", ":", headerRow.course || "", "", "", "", "", "", "", "Shadow", "", ":", headerRow.shadow || ""]);
    wsData.push(["", "Rpm", "", ":", headerRow.rpm || "", "", "", "", "", "", "", "Pinggiran", "", ":", headerRow.pinggiran || ""]);
    wsData.push(["", "No. Order Barang", "", ":", headerRow.no_order_barang || "", "", "", "", "", "", "", "No. costumer", "", ":", headerRow.no_customer || ""]);
    wsData.push([]);

    // Table Headers
    const pcsRow: any[] = [""];
    const titleRow: any[] = [""];
    const gradeRow: any[] = [""];
    
    exportSource.forEach((pcs, idx) => {
      const isFirst = idx === 0;
      const spacing = isFirst ? 0 : 3;
      for (let i = 0; i < spacing; i++) {
        pcsRow.push("");
        titleRow.push("");
        gradeRow.push("");
      }

      const pcsLabel = `PCS ${pcs.detail.pcs_index}`;
      pcsRow.push(pcsLabel, "", "", "", "", "", "", "", "");
      titleRow.push("PNL NO", "TGL", "Group", "Operator", "KET ✓/X", "KETERANGAN CACAT", "INSPECTING", "", "");
      gradeRow.push("", "", "", "", "", "", "A", "B", "BS");
    });
    
    wsData.push(pcsRow);
    wsData.push(titleRow);
    wsData.push(gradeRow);

    // Find max items across all PCS
    let maxItems = 0;
    exportDisplaySource.forEach(pcs => {
      if (pcs.displayItems && pcs.displayItems.length > maxItems) {
        maxItems = pcs.displayItems.length;
      }
    });

    // Populate Items Data
    for (let i = 0; i < maxItems; i++) {
      const row: any[] = [""];
      exportDisplaySource.forEach((pcs, idx) => {
        const isFirst = idx === 0;
        const spacing = isFirst ? 0 : 3;
        for (let s = 0; s < spacing; s++) {
          row.push("");
        }

        const item = pcs.displayItems && pcs.displayItems.length > i ? pcs.displayItems[i] : null;
        if (item) {
          if (item.isSummaryRow) {
            row.push("", "", `Total Produksi ${item.operatorName}:`, item.totalCount, "", "", "", "", "");
          } else if (item.isTotalRow) {
            row.push("", "", item.totalLabel, item.totalMeter, "", "", "", "", "");
          } else if (item.isMeter) {
            const pnlNo = item.meterDisplay;
            const tgl = item.tglStr;
            const grpStr = item.grpStr;
            let oprStr = item.oprStr;
            if (item.hasIstirahat) oprStr = "Istirahat";
            
            const ket = !item.isGradable ? "" : (item.hasErrorDetail ? "X" : "✓");
            
            let cacat = item.cacatDisplay;
            if (item.backupOpName && item.hasIstirahat) {
              cacat = item.backupOpName + "\n" + cacat;
            }
            
            const grade = item.hasil_mending_original || item.hasil_mending;
            const gradeA = (item.isGradable && grade === "A") ? "A" : "";
            const gradeB = (item.isGradable && grade === "B") ? "B" : "";
            const gradeBS = (item.isGradable && grade === "BS") ? "BS" : "";
            row.push(pnlNo, tgl, grpStr, oprStr, ket, cacat, gradeA, gradeB, gradeBS);
          } else {
            const det = item.detail || {};
            const pnlNo = det.header?.panel_no === "METERAN" ? det.meter_kain : det.header?.panel_no;
            const tgl = item.hideOperatorAndDate ? "" : (det.header?.tgl || "");
            let opr = det.header?.operators?.nama_operator || det.header?.pic || "";
            const grp = det.header?.groups?.nama_grup || "";
            const grpStr = item.hideOperatorAndDate ? "" : grp;
            let oprStr = item.hasIstirahat ? "Istirahat" : (item.hideOperatorAndDate ? "" : opr);
            let displayKeterangan = det.keterangan_cacat || "";
            if (item.hasIstirahat) {
              displayKeterangan = displayKeterangan.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
              displayKeterangan = displayKeterangan.replace(/^,\s*|\s*,\s*$/g, "");
            }
            
            let cacatLines: string[] = [];
            const katsRaw = det.kategori_masalah;
            const kats = katsRaw ? (Array.isArray(katsRaw) ? katsRaw : katsRaw.split(",").map((s: string) => s.trim())) : [];
            const displayDetail = det.detail_masalah || "";
            
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
            
            let ketCacat = displayKeterangan;
            const hasTambahanQC = ketCacat.includes("[TAMBAHAN QC]");
            ketCacat = ketCacat.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
            ketCacat = ketCacat.replace(/\[TAMBAHAN QC\]/gi, "").trim();
            ketCacat = ketCacat.replace(/^,\s*|\s*,\s*$/g, "");

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
                    return `${line} (Blok ${cleanB})`;
                  } else if (parts[parts.length - 1] && parts[parts.length - 1] !== "") {
                     const cleanB = parts[parts.length - 1].replace(/blok\s*/gi, "").trim();
                     return `${line} (Blok ${cleanB})`;
                  }
                  return line;
                });
              } else {
                const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
                cacatLines.push(`(Blok ${cleanB})`);
              }
            }

            if (hasTambahanQC) {
              if (cacatLines.length === 0) {
                cacatLines.push("[TAMBAHAN QC]");
              } else {
                for (let i = 0; i < cacatLines.length; i++) {
                  cacatLines[i] = cacatLines[i] + " [TAMBAHAN QC]";
                }
              }
            }
            if (item.backupOpName && item.hasIstirahat) {
              cacatLines.unshift(item.backupOpName);
            }
            
            let cacat = cacatLines.join("\n");
            
            const gradeA = item.hasil_mending === "A" ? "A" : "";
            const gradeB = item.hasil_mending === "B" ? "B" : "";
            const gradeBS = item.hasil_mending === "BS" ? "BS" : "";
            const ket = det.kategori_masalah ? "X" : "✓";

            row.push(pnlNo, tgl, grpStr, oprStr, ket, cacat, gradeA, gradeB, gradeBS);
          }
        } else {
          row.push("", "", "", "", "", "", "", "", "");
        }
      });
      wsData.push(row);
    }

    // Summary Tables at the bottom
    wsData.push([]); // empty row
    
    const sumTitleRow: any[] = [""];
    const sumRowA: any[] = [""];
    const sumRowB: any[] = [""];
    const sumRowBS: any[] = [""];
    const infoBlank: any[] = [""];
    const infoRow1: any[] = [""];
    const infoRow2: any[] = [""];
    const infoRow3: any[] = [""];
    const infoRow4: any[] = [""];
    const infoRow5: any[] = [""];
    const infoRow6: any[] = [""];

    exportSource.forEach((pcs, idx) => {
      const isFirst = idx === 0;
      const spacing = isFirst ? 0 : 3;
      for (let i = 0; i < spacing; i++) {
        sumTitleRow.push("");
        sumRowA.push("");
        sumRowB.push("");
        sumRowBS.push("");
        infoBlank.push("");
        infoRow1.push("");
        infoRow2.push("");
        infoRow3.push("");
        infoRow4.push("");
        infoRow5.push("");
        infoRow6.push("");
      }
      
      const items = pcs.items || [];
      const isMeter = checkIsMeter(pcs);
      let totalMeterSum = 0;
      if (isMeter) {
        pcs.displayItems?.forEach((di: any) => {
          if (di.isTotalRow && di.totalMeter) {
            const m = parseFloat(di.totalMeter);
            if (!isNaN(m)) totalMeterSum += m;
          }
        });
      }

      let prodA: number | string = 0;
      let prodB: number | string = 0;
      let prodBS: number | string = 0;
      let inspectA: number | string = 0;
      let inspectB: number | string = 0;
      let inspectBS: number | string = 0;

      if (isMeter) {
        const defectItemsProd = items.filter((i: any) => i.detail?.kategori_masalah) || [];
        const prodBCount = defectItemsProd.length;
        const prodBSCount = items.filter((i: any) => i.detail?.kategori_masalah && i.hasil_mending === "BS").length || 0;
        prodA = `${totalMeterSum - prodBCount} Meter`;
        prodB = prodBCount;
        prodBS = prodBSCount;

        const inspectBCount = items.filter((i: any) => i.hasil_mending === "B").length || 0;
        const inspectBSCount = items.filter((i: any) => i.hasil_mending === "BS").length || 0;
        inspectA = `${totalMeterSum - inspectBCount} Meter`;
        inspectB = inspectBCount;
        inspectBS = inspectBSCount;
      } else {
        prodA = items.filter((i: any) => !i.detail?.kategori_masalah).length;
        prodB = items.filter((i: any) => i.detail?.kategori_masalah).length;
        prodBS = 0;
        inspectA = items.filter((i: any) => i.hasil_mending === "A").length;
        inspectB = items.filter((i: any) => i.hasil_mending === "B").length;
        inspectBS = items.filter((i: any) => i.hasil_mending === "BS").length;
      }

      const gradeInfo = calculateOverallGradeData(items, isMeter, totalMeterSum);
      const { overallGrade, bucket, totalQty, totalCacat } = gradeInfo;

      const sortedItems = items;
      const totalSetelahInspect = isMeter ? `${totalMeterSum} Meter` : sortedItems.length;
      const beratInspect = pcs.qc_batch?.berat_kain || "";
      const tanggalInspect = pcs.qc_batch?.tanggal_inspeksi || "";
      const petugasInspect = [pcs.qc_batch?.petugas_inspeksi, pcs.qc_batch?.petugas_inspeksi_2, pcs.qc_batch?.petugas_inspeksi_3].filter(Boolean).join(", ") || "";
      const startInspect = pcs.qc_batch?.start_inspect || "";
      const finishInspect = pcs.qc_batch?.finish_inspect || "";

      const unit = isMeter ? 'Meter' : 'Panel';

      sumTitleRow.push("KET", "Produksi", "Setelah Inspect", "", "GRADE KESELURUHAN", "", "", "", "");
      sumRowA.push("Total Grade A", prodA, inspectA, "", overallGrade, "", "", "", "");
      sumRowB.push("Total Grade B", prodB, inspectB, "", bucket > 0 ? `Kategori: Max ${bucket} ${unit}` : "", "", "", "", "");
      sumRowBS.push("BS", prodBS, inspectBS, "", `Total: ${totalQty} ${unit} • Cacat: ${totalCacat}`, "", "", "", "");

      infoBlank.push("", "", "", "", "", "", "", "", "");
      infoRow1.push(`Total ${unit} Setelah di Inspecting`, ":", totalSetelahInspect, "", "", "", "", "", "");
      infoRow2.push(`Berat Inspecting`, ":", beratInspect, "", "", "", "", "", "");
      infoRow3.push(`Tanggal Inspecting`, ":", tanggalInspect, "", `Tanggal Mending`, ":", pcs.tanggal_mending || "", "", "");
      infoRow4.push(`Petugas Inspecting`, ":", petugasInspect, "", `Petugas Mending`, ":", pcs.petugas_mending || "", "", "");
      infoRow5.push(`Start Inspect`, ":", startInspect, "", `Start Mending`, ":", pcs.start_mending || "", "", "");
      infoRow6.push(`Finish Inspect`, ":", finishInspect, "", `Finish Mending`, ":", pcs.finish_mending || "", "", "");
    });

    wsData.push(sumTitleRow);
    wsData.push(sumRowA);
    wsData.push(sumRowB);
    wsData.push(sumRowBS);
    wsData.push(infoBlank);
    wsData.push(infoRow1);
    wsData.push(infoRow2);
    wsData.push(infoRow3);
    wsData.push(infoRow4);
    wsData.push(infoRow5);
    wsData.push(infoRow6);

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    xlsx.utils.book_append_sheet(wb, ws, "Hasil Produksi");
    
    // Download
    const fileName = `Hasil_Produksi_Mending_${filters.nomor_mc}_Potongan${filters.potongan_ke}.xlsx`;
    xlsx.writeFile(wb, fileName);
  };

  const headerInfo = data.length > 0 ? data[0].header : null;

  const getOverallGradeInfo = (totalQty: number, totalCacat: number, isMeter: boolean) => {
    let grade = "-";
    let bucket = 0;
    
    if (totalQty === 0) return { grade, bucket };
    
    if (isMeter) {
      bucket = 300;
      if (totalQty > 450) bucket = 500;
      else if (totalQty > 400) bucket = 450;
      else if (totalQty > 350) bucket = 400;
      else if (totalQty > 300) bucket = 350;
      else bucket = 300;
      
      let limitA = 9, limitB = 15, limitC = 21;
      if (bucket === 350) { limitA = 11; limitB = 18; limitC = 25; }
      if (bucket === 400) { limitA = 12; limitB = 20; limitC = 28; }
      if (bucket === 450) { limitA = 14; limitB = 23; limitC = 32; }
      if (bucket === 500) { limitA = 15; limitB = 25; limitC = 35; }
      
      if (totalCacat <= limitA) grade = "A";
      else if (totalCacat <= limitB) grade = "B";
      else if (totalCacat <= limitC) grade = "C";
      else grade = "D";
    } else {
      bucket = 50;
      if (totalQty > 125) bucket = 150;
      else if (totalQty > 120) bucket = 125;
      else if (totalQty > 100) bucket = 120;
      else if (totalQty > 75) bucket = 100;
      else if (totalQty > 65) bucket = 75;
      else if (totalQty > 50) bucket = 65;
      else bucket = 50;

      let limitA = 5, limitB = 8, limitC = 9; 
      if (bucket === 65) { limitA = 7; limitB = 10; limitC = 13; }
      if (bucket === 75) { limitA = 8; limitB = 12; limitC = 15; }
      if (bucket === 100) { limitA = 10; limitB = 15; limitC = 19; }
      if (bucket === 120) { limitA = 12; limitB = 18; limitC = 23; }
      if (bucket === 125) { limitA = 13; limitB = 19; limitC = 25; }
      if (bucket === 150) { limitA = 15; limitB = 23; limitC = 29; }

      if (totalCacat <= limitA) grade = "A";
      else if (totalCacat <= limitB) grade = "B";
      else if (totalCacat <= limitC) grade = "C";
      else grade = "D";
    }
    
    return { grade, bucket };
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto pb-20 animate-fadeIn">
      <div className="mb-6 flex flex-row items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            Laporan Kualitas Produksi Kain {data.length > 0 && data[0]?.items?.[0]?.detail?.header?.panel_no === "METERAN" ? "All Over" : "Panel"}
          </h1>
          <p className="text-sm font-semibold text-slate-500">
            Lihat hasil produksi mending per potongan dengan format bersampingan.
          </p>
        </div>
        {data.length > 0 && (
          <button
            onClick={handleExportExcel}
            className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export ke Excel
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Filter Card */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6 max-w-5xl min-w-[800px]">
          <form onSubmit={handleSearch} className="grid grid-cols-4 gap-4 items-end">
          <div className="flex flex-col gap-1 w-full">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Pilih Tanggal
            </label>
            <input
              type="date"
              value={filters.tanggal}
              onChange={(e) => setFilters({ ...filters, tanggal: e.target.value })}
              className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:bg-white outline-none w-full transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1 w-full">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Pilih Mesin
            </label>
            <select
              value={filters.nomor_mc}
              onChange={(e) => setFilters({ ...filters, nomor_mc: e.target.value })}
              className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:bg-white outline-none w-full transition-colors"
            >
              <option value="">-- Semua Mesin --</option>
              {options.mesins.map((m) => (
                <option key={m} value={m}>Mesin {m}</option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-col gap-1 w-full">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Pilih Potongan Ke
            </label>
            <select
              value={filters.potongan_ke}
              onChange={(e) => setFilters({ ...filters, potongan_ke: e.target.value })}
              className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:bg-white outline-none w-full transition-colors"
            >
              <option value="">-- Semua Potongan --</option>
              {options.potongans.map((p) => (
                <option key={p} value={String(p)}>Potongan Ke-{p}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 w-full">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Jenis Kain
            </label>
            <select
              value={filters.jenis_kain}
              onChange={(e) => setFilters({ ...filters, jenis_kain: e.target.value })}
              className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:bg-white outline-none w-full transition-colors"
            >
              <option value="all">-- Semua Jenis --</option>
              <option value="panel">Panel</option>
              <option value="meteran">All Over (Meteran)</option>
            </select>
          </div>
        </form>
      </div>
      </div>

      {isLoading && (
        <div className="bg-white rounded-2xl p-16 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center animate-fadeIn">
          <Loader2 className="w-10 h-10 text-[#0070bc] animate-spin mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-1">Memuat Data Laporan...</h3>
          <p className="text-slate-500 text-xs">Sedang mengambil dan menyusun data produksi mending</p>
        </div>
      )}

      {hasSearched && data.length === 0 && !isLoading && (
        <div className="bg-white rounded-2xl p-16 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
            <Package className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">Data Tidak Ditemukan</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Tidak ada data hasil produksi (mending) untuk mesin dan potongan yang dipilih. Pastikan mesin dan potongan sudah melalui proses mending.
          </p>
        </div>
      )}

      {/* List View: Grouped by Potongan */}
      {hasSearched && data.length > 0 && selectedPotonganKey === null && (() => {
        const itemsPerPage = 10;
        const totalPages = Math.ceil(groupedPotongans.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedPotongans = groupedPotongans.slice(startIndex, endIndex);

        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Daftar Potongan Produksi
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Pilih salah satu potongan untuk melihat rincian detail per PCS.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 font-extrabold text-slate-600">Mesin</th>
                    <th className="px-4 py-3 font-extrabold text-slate-600">Desain</th>
                    <th className="px-4 py-3 font-extrabold text-slate-600">Potongan</th>
                    <th className="px-4 py-3 font-extrabold text-slate-600">Jenis</th>
                    <th className="px-4 py-3 font-extrabold text-slate-600">Petugas Mending</th>
                    <th className="px-4 py-3 font-extrabold text-slate-600 text-center">Jumlah PCS</th>
                    <th className="px-4 py-3 font-extrabold text-slate-600 text-center">Hasil Mending</th>
                    <th className="px-4 py-3 font-extrabold text-slate-600 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {paginatedPotongans.map((pot) => (
                    <tr 
                      key={pot.key} 
                      onClick={() => setSelectedPotonganKey(pot.key)}
                      className="hover:bg-sky-50/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3 font-black text-[#0070bc]">{pot.nomor_mc}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{pot.design_id}</td>
                      <td className="px-4 py-3 text-rose-600 font-bold">Ke-{pot.potongan_ke}</td>
                      <td className="px-4 py-3">
                        {pot.isMeter ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 uppercase tracking-wider whitespace-nowrap">
                            Meteran (All Over)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 uppercase tracking-wider whitespace-nowrap">
                            Panel
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{pot.petugas_mending || "-"}</td>
                      <td className="px-4 py-3 text-center text-slate-800 font-bold">{pot.pcsList.length} PCS</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-emerald-600 font-black">A: {pot.totalA}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-amber-500 font-black">B: {pot.totalB}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-rose-600 font-black">BS: {pot.totalBS}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPotonganKey(pot.key);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-[#0070bc] text-[#0070bc] hover:text-white font-extrabold text-[11px] transition-all shadow-sm flex items-center gap-1 mx-auto"
                        >
                          <Search className="w-3 h-3" />
                          Lihat Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-slate-50/50 gap-3">
                <span className="text-xs font-semibold text-slate-500">
                  Menampilkan {startIndex + 1} - {Math.min(endIndex, groupedPotongans.length)} dari {groupedPotongans.length} potongan
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 disabled:opacity-50 text-xs font-bold text-slate-600 transition-all flex items-center gap-1 shadow-sm"
                  >
                    Sebelumnya
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all shadow-sm ${
                        currentPage === page
                          ? "bg-[#0070bc] text-white animate-pulse"
                          : "border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 disabled:opacity-50 text-xs font-bold text-slate-600 transition-all flex items-center gap-1 shadow-sm"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Detail View: Show side-by-side tables for the selected Potongan */}
      {selectedPotonganKey !== null && selectedPcsData.length > 0 && headerInfo && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => setSelectedPotonganKey(null)}
              className="h-10 px-5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Daftar Laporan
            </button>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            {/* Document Header Section */}
            <div className="p-8 border-b border-slate-200 bg-slate-50/50">
              <div className="flex flex-col items-center justify-center text-center mb-8 border-b border-slate-200 pb-6">
                <h2 className="text-xl font-black text-slate-800 tracking-wider">
                  FORM KUALITAS PRODUKSI KAIN {selectedPcsData[0]?.items?.[0]?.detail?.header?.panel_no === "METERAN" ? "ALL OVER" : "PANEL"}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-x-2 lg:gap-x-12 gap-y-1 max-w-5xl mx-auto text-[10px] sm:text-xs lg:text-sm">
                <div className="space-y-1">
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">Design</span>
                    <span className="font-black text-slate-800 col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.header?.design_id || "-"}</span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">Nomor Mc</span>
                    <span className="font-black text-[#0070bc] col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.header?.nomor_mc || "-"}</span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">Tanggal produksi</span>
                    <span className="font-black text-slate-800 col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.header?.tgl || "-"}</span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">Tanggal potong</span>
                    <span className="font-black text-slate-800 col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.header?.tanggal_potong || "-"}</span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">Pick</span>
                    <span className="font-black text-slate-800 col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.header?.pick || "-"}</span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">Course</span>
                    <span className="font-black text-slate-800 col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.header?.course || "-"}</span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">Rpm</span>
                    <span className="font-black text-slate-800 col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.header?.rpm || "-"}</span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">No. Order Barang</span>
                    <span className="font-black text-slate-800 col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.header?.no_order_barang || "-"}</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">Potongan ke</span>
                    <span className="font-black text-rose-600 col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.header?.potongan_ke || "-"}</span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">Roll no</span>
                    <span className="font-black text-slate-800 col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.detail?.roll_no || "-"}</span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">Jenis Benang Dsr</span>
                    <span className="font-black text-slate-800 col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.header?.jenis_benang_dasar || "-"}</span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">Liner</span>
                    <span className="font-black text-slate-800 col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.header?.liner || "-"}</span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">Heavy</span>
                    <span className="font-black text-slate-800 col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.header?.heavy || "-"}</span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">Shadow</span>
                    <span className="font-black text-slate-800 col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.header?.shadow || "-"}</span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">Pinggiran</span>
                    <span className="font-black text-slate-800 col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.header?.pinggiran || "-"}</span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-3 gap-1 sm:gap-4">
                    <span className="font-bold text-slate-500 whitespace-nowrap">No. costumer</span>
                    <span className="font-black text-slate-800 col-span-2 flex gap-2"><span>:</span> {selectedPcsData[0]?.header?.no_customer || "-"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PCS Tables Grid - Side by Side Scrollable */}
            <div className="w-full overflow-x-auto pb-4 custom-scrollbar bg-slate-50/50 p-6 rounded-b-2xl">
              <div className="flex gap-6 min-w-max">
                {selectedPcsData.map((pcs: any) => {
                  const sortedItems = [...(pcs.items || [])].sort((a: any, b: any) => {
                    const pA = a.detail?.header?.panel_no;
                    const pB = b.detail?.header?.panel_no;
                    if (pA === "METERAN" && pB === "METERAN") {
                      return parseFloat(a.detail?.meter_kain || 0) - parseFloat(b.detail?.meter_kain || 0);
                    }
                    if (pA === "METERAN") return 1;
                    if (pB === "METERAN") return -1;
                    return parseInt(pA || 0) - parseInt(pB || 0);
                  });

                  const isMeter = checkIsMeter(pcs);
                  const unit = isMeter ? 'Meter' : 'Panel';

                  let prodA: number | string = 0;
                  let prodB: number | string = 0;
                  let prodBS: number | string = 0;
                  let inspectA: number | string = 0;
                  let inspectB: number | string = 0;
                  let inspectBS: number | string = 0;

                  let totalMeterSum = 0;

                  if (isMeter) {
                    // Sum total meters from all isTotalRow entries in displayItems
                    pcs.displayItems?.forEach((di: any) => {
                      if (di.isTotalRow && di.totalMeter) {
                        const m = parseFloat(di.totalMeter);
                        if (!isNaN(m)) totalMeterSum += m;
                      }
                    });

                    // Produksi: total meter produced, and count of defect titik during production QC
                    const defectItemsProd = pcs.items?.filter((i: any) => i.detail?.kategori_masalah) || [];
                    const prodBCount = defectItemsProd.length;
                    const prodBSCount = pcs.items?.filter((i: any) => i.detail?.kategori_masalah && i.hasil_mending === "BS").length || 0;
                    prodA = `${totalMeterSum - prodBCount} Meter`; // total meter - titik cacat B
                    prodB = prodBCount;
                    prodBS = prodBSCount;

                    // Setelah Inspect: grade A = totalMeter - inspectB, B and BS from mending result
                    const inspectBCount = pcs.items?.filter((i: any) => i.hasil_mending === "B").length || 0;
                    const inspectBSCount = pcs.items?.filter((i: any) => i.hasil_mending === "BS").length || 0;
                    inspectA = `${totalMeterSum - inspectBCount} Meter`; // total meter - titik cacat B hasil mending
                    inspectB = inspectBCount;
                    inspectBS = inspectBSCount;
                  } else {
                    prodA = pcs.items?.filter((i: any) => !i.detail?.kategori_masalah).length || 0;
                    prodB = pcs.items?.filter((i: any) => i.detail?.kategori_masalah).length || 0;
                    prodBS = 0;
                    inspectA = pcs.items?.filter((i: any) => i.hasil_mending === "A").length || 0;
                    inspectB = pcs.items?.filter((i: any) => i.hasil_mending === "B").length || 0;
                    inspectBS = pcs.items?.filter((i: any) => i.hasil_mending === "BS").length || 0;
                  }

                  const gradeInfo = calculateOverallGradeData(pcs.items || [], isMeter, totalMeterSum);
                  const { overallGrade, bucket, totalQty, totalCacat } = gradeInfo;

                  const totalSetelahInspect = isMeter ? `${totalMeterSum} Meter` : sortedItems.length;
                  const beratInspect = (pcs.qc_batch?.berat_kain !== null && pcs.qc_batch?.berat_kain !== undefined && pcs.qc_batch?.berat_kain !== "") 
                    ? `${pcs.qc_batch.berat_kain} kg` 
                    : "-";
                  const tanggalInspect = pcs.qc_batch?.tanggal_inspeksi || "-";
                  const petugasInspect = [pcs.qc_batch?.petugas_inspeksi, pcs.qc_batch?.petugas_inspeksi_2, pcs.qc_batch?.petugas_inspeksi_3].filter(Boolean).join(", ") || "-";
                  const startInspect = pcs.qc_batch?.start_inspect || "-";
                  const finishInspect = pcs.qc_batch?.finish_inspect || "-";

                  return (
                    <div 
                      key={pcs.id} 
                      className="min-w-[500px] border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden flex flex-col"
                    >
                      {/* PCS Title Header */}
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <span className="font-black text-slate-800 text-sm">
                          PCS {pcs.detail?.pcs_index || pcs.pcs_index}
                        </span>
                        <span className="text-[10px] font-bold bg-[#0070bc]/10 text-[#0070bc] px-2.5 py-1 rounded-full uppercase tracking-wider">
                          {unit}
                        </span>
                      </div>

                      {/* Items Table */}
                      <table className="w-full text-left text-[11px] border-collapse flex-1">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200">
                            <th className="px-2 py-2 font-extrabold text-slate-600 w-10 border-r border-slate-200">NO</th>
                            <th className="px-2 py-2 font-extrabold text-slate-600 w-20 border-r border-slate-200">TGL</th>
                            <th className="px-1.5 py-2 font-extrabold text-slate-600 text-center w-12 border-r border-slate-200">Group</th>
                            <th className="px-2 py-2 font-extrabold text-slate-600 w-24 border-r border-slate-200">Operator</th>
                            <th className="px-2 py-2 font-extrabold text-slate-600 text-center w-16 border-r border-slate-200">✓/X</th>
                            {isMeter && <th className="px-2 py-2 font-extrabold text-slate-600 w-16 border-r border-slate-200 text-center">Meter</th>}
                            <th className="px-2 py-2 font-extrabold text-slate-600 border-r border-slate-200">KETERANGAN CACAT</th>
                            <th className="px-1 py-2 font-extrabold text-slate-600 text-center w-8 border-r border-slate-200">A</th>
                            <th className="px-1 py-2 font-extrabold text-slate-600 text-center w-8 border-r border-slate-200">B</th>
                            <th className="px-1 py-2 font-extrabold text-slate-600 text-center w-8">BS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {pcs.displayItems && pcs.displayItems.length > 0 ? (
                            pcs.displayItems.map((item: any, itemIndex: number) => {
                              if (item.isSummaryRow) {
                                return (
                                  <tr key={item.id || itemIndex} className="bg-slate-100/70 border-t border-b border-slate-200 font-bold text-slate-700">
                                    <td colSpan={4} className="px-3 py-2 text-right border-r border-slate-200">
                                      Total Produksi {item.operatorName}:
                                    </td>
                                    <td className="px-2 py-2 text-center font-black border-r border-slate-200 whitespace-nowrap">
                                      {item.totalCount} {unit}
                                    </td>
                                    <td colSpan={4}></td>
                                  </tr>
                                );
                              }
                              if (item.isTotalRow) {
                                return (
                                  <tr key={item.id || itemIndex} className="bg-slate-100/70 border-t border-b border-slate-200 font-bold text-slate-700">
                                    <td colSpan={isMeter ? 5 : 4} className="px-3 py-2 text-right border-r border-slate-200">
                                      {item.totalLabel}
                                    </td>
                                    <td className="px-2 py-2 text-center font-black border-r border-slate-200 whitespace-nowrap">
                                      {item.totalMeter}
                                    </td>
                                    <td colSpan={4}></td>
                                  </tr>
                                );
                              }

                              const isMeterRow = item.isMeter;
                              const det = item.detail || {};
                              const rowNo = isMeterRow ? item.displayNo : (det.header?.panel_no === "METERAN" ? det.meter_kain : det.header?.panel_no);
                              const meterVal = isMeterRow ? item.meterDisplay : null;
                              const tgl = isMeterRow ? item.tglStr : item.displayTgl;
                              const grpStr = isMeterRow ? item.grpStr : item.displayGrp;
                              let oprStr = isMeterRow ? item.oprStr : item.displayOpr;
                              if (isMeterRow && item.hasIstirahat) oprStr = "Istirahat";
                              const grade = item.hasil_mending_original || item.hasil_mending;

                              let cacatLines: string[] = [];

                              // Shared cacat-building logic for both panel and meter rows
                              const buildCacatLines = (srcDet: any, stripTitik = false): string[] => {
                                const pNoStr = String(srcDet?.header?.panel_no || srcDet?.panel_no || "").trim().toUpperCase();
                                if (pNoStr.includes("AWAL")) return ["Sisa Awal Potongan"];
                                if (pNoStr.includes("AKHIR")) return ["Sisa Akhir Potongan"];

                                const lines: string[] = [];
                                const katsRaw = srcDet?.kategori_masalah;
                                const kats = katsRaw ? (Array.isArray(katsRaw) ? katsRaw : katsRaw.split(",").map((s: string) => s.trim())) : [];
                                let rawDetail = srcDet?.detail_masalah || "";

                                if (stripTitik) {
                                  rawDetail = rawDetail.replace(/\s*\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "").trim();
                                }

                                // Strip ISTIRAHAT from raw detail text
                                rawDetail = rawDetail.replace(/ISTIRAHAT/gi, "").replace(/\|\s*$/, "").replace(/,\s*$/, "").trim();

                                const displayDetail = rawDetail;

                                const pushDetailsForCat = (k: string, d: string) => {
                                  if (!d) {
                                    if (k.toUpperCase() !== "G" && k.toUpperCase() !== "ISTIRAHAT") {
                                      lines.push(k);
                                    }
                                    return;
                                  }
                                  const knownDetailsForCat = PROBLEM_DETAILS[k] || [];
                                  const matchedDetails: string[] = [];
                                  let remainingD = d;
                                  const sortedKnown = [...knownDetailsForCat].sort((a, b) => b.length - a.length);
                                  sortedKnown.forEach(known => {
                                    if (remainingD.includes(known)) { matchedDetails.push(known); remainingD = remainingD.replace(known, ""); }
                                  });
                                  if (matchedDetails.length > 0) {
                                    const customParts = remainingD.split(",").map((s: string) => s.trim()).filter(Boolean);
                                    matchedDetails.forEach(match => {
                                      if (!match.toUpperCase().includes("ISTIRAHAT")) lines.push(`${k} - ${match}`);
                                    });
                                    customParts.forEach(custom => {
                                      if (!custom.toUpperCase().includes("ISTIRAHAT")) lines.push(`${k} - ${custom}`);
                                    });
                                  } else {
                                    const parts = d.split(",").map((s: string) => s.trim()).filter(Boolean);
                                    parts.forEach(p => {
                                      if (!p.toUpperCase().includes("ISTIRAHAT")) lines.push(`${k} - ${p}`);
                                    });
                                  }
                                };

                                if (kats.length > 0) {
                                  if (displayDetail.includes(" | ")) {
                                    const catDetails = displayDetail.split(" | ");
                                    for (let i = 0; i < Math.max(kats.length, catDetails.length); i++) {
                                      pushDetailsForCat(kats[i] || "Unknown", catDetails[i] || "");
                                    }
                                  } else if (displayDetail) {
                                    if (kats.length === 1) {
                                      pushDetailsForCat(kats[0], displayDetail);
                                    } else {
                                      const dets = displayDetail.split(", ");
                                      if (kats.length === dets.length) {
                                        for (let i = 0; i < kats.length; i++) pushDetailsForCat(kats[i], dets[i]);
                                      } else {
                                        dets.forEach((d: string) => {
                                          if (!d.toUpperCase().includes("ISTIRAHAT")) {
                                            let foundKat = "Unknown";
                                            for (const [kat, detList] of Object.entries(PROBLEM_DETAILS || {})) {
                                              if ((detList as string[]).some((dd: string) => d.toLowerCase().includes(dd.toLowerCase()))) { foundKat = kat; break; }
                                            }
                                            lines.push(`${foundKat !== "Unknown" ? foundKat + " - " : ""}${d}`);
                                          }
                                        });
                                      }
                                    }
                                  } else {
                                    const validKats = kats.filter((k: string) => k.toUpperCase() !== "G" && k.toUpperCase() !== "ISTIRAHAT");
                                    if (validKats.length > 0) lines.push(validKats.join(", "));
                                  }
                                } else if (displayDetail && !displayDetail.toUpperCase().includes("ISTIRAHAT")) {
                                  lines.push(displayDetail);
                                }

                                let ketCacat = srcDet?.keterangan_cacat || "";
                                const hasTambahanQC = ketCacat.includes("[TAMBAHAN QC]");
                                ketCacat = ketCacat.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
                                ketCacat = ketCacat.replace(/\[TAMBAHAN QC\]/gi, "").trim();
                                ketCacat = ketCacat.replace(/\(Backup:\s*[^)]+\)/gi, "").trim();
                                ketCacat = ketCacat.replace(/^,\s*|\s*,\s*$/g, "");

                                if (ketCacat) {
                                  if (lines.length > 0) {
                                    const parts = ketCacat.split(",").map((s: string) => s.trim());
                                    for (let i = 0; i < lines.length; i++) {
                                      const lineKat = lines[i].includes(" - ") ? lines[i].split(" - ")[0].trim() : "";
                                      let partIndex = i;
                                      if (lineKat && kats.includes(lineKat)) partIndex = kats.indexOf(lineKat);
                                      if (parts[partIndex] && parts[partIndex] !== "") {
                                        const cleanB = parts[partIndex].replace(/blok\s*/gi, "").trim();
                                        if (cleanB) lines[i] = `${lines[i]} (Blok ${cleanB})`;
                                      } else if (parts[parts.length - 1] && parts[parts.length - 1] !== "") {
                                        const cleanB = parts[parts.length - 1].replace(/blok\s*/gi, "").trim();
                                        if (cleanB) lines[i] = `${lines[i]} (Blok ${cleanB})`;
                                      }
                                    }
                                  } else {
                                    const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
                                    if (cleanB) lines.push(`(Blok ${cleanB})`);
                                  }
                                }

                                if (hasTambahanQC) {
                                  if (lines.length === 0) lines.push("[TAMBAHAN QC]");
                                  else for (let i = 0; i < lines.length; i++) lines[i] += " [TAMBAHAN QC]";
                                }

                                return lines.filter(l => l && !l.toUpperCase().includes("ISTIRAHAT"));
                              };

                              if (isMeterRow) {
                                if (item.isFinishReport && !item.detail?.kategori_masalah && !item.detail?.detail_masalah && !item.hasIstirahat) {
                                  cacatLines = ["FINISH"];
                                } else if (item.isStartRow) {
                                  cacatLines = ["START"];
                                } else {
                                  cacatLines = buildCacatLines(item.detail, true);
                                }
                              } else {
                                cacatLines = buildCacatLines(det);
                              }

                              let cacat = cacatLines.join("\n") || "-";
                              const isGradable = isMeterRow ? item.isGradable : true;
                              const hasError = isMeterRow ? item.hasErrorDetail : !!det.kategori_masalah;
                              
                              return (
                                <tr key={item.id || itemIndex} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-2 py-1 font-bold text-slate-800">
                                    {isMeterRow ? (
                                      item.displayNo || "-"
                                    ) : String(rowNo).toUpperCase().includes("AWAL") ? (
                                      <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded leading-none shadow-sm whitespace-nowrap">BS AWAL</span>
                                    ) : String(rowNo).toUpperCase().includes("AKHIR") ? (
                                      <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded leading-none shadow-sm whitespace-nowrap">BS AKHIR</span>
                                    ) : (
                                      rowNo || "-"
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-slate-600 whitespace-nowrap">{tgl}</td>
                                  <td className="px-1 py-1 font-medium text-slate-700 text-center">{grpStr}</td>
                                  <td className="px-1 py-1 font-medium text-slate-700 leading-tight">{oprStr}</td>
                                  
                                  <td className="px-2 py-1 text-center font-bold text-sm">
                                    {!isGradable ? "" : (hasError ? <span className="text-rose-600">X</span> : <span className="text-emerald-600">✓</span>)}
                                  </td>

                                  {isMeter && (
                                    <td className="px-2 py-1 font-mono text-slate-700 whitespace-nowrap text-[11px] text-center border-r border-slate-100">
                                      {isMeterRow ? (item.meterDisplay !== "-" ? item.meterDisplay : "") : ""}
                                    </td>
                                  )}
                                  
                                  <td className="px-2 py-1 text-[11px] font-medium whitespace-pre-wrap leading-tight min-w-[160px]">
                                    {isMeterRow ? (
                                      <>
                                        {item.backupOpName && item.hasIstirahat && <div className="text-slate-700 font-bold mb-0.5">{item.backupOpName}</div>}
                                        <span className={
                                          cacat === "START" || cacat === "FINISH" || cacat === "ISTIRAHAT"
                                            ? "text-slate-400 font-semibold italic"
                                            : "text-rose-600"
                                        }>{cacat || "-"}</span>
                                      </>
                                    ) : (
                                      <>
                                        {item.backupOpName && item.hasIstirahat && <div className="text-slate-700 font-bold mb-0.5">{item.backupOpName}</div>}
                                        <span className={cacat === "-" ? "text-slate-400" : "text-rose-600"}>{cacat || "-"}</span>
                                      </>
                                    )}
                                  </td>

                                  <td className="px-1 py-1 text-center">
                                    {isGradable && grade === "A" && <div className="mx-auto w-4 h-4 rounded bg-emerald-100 text-emerald-700 font-black flex items-center justify-center text-[10px]">A</div>}
                                  </td>
                                  <td className="px-1 py-1 text-center">
                                    {isGradable && grade === "B" && <div className="mx-auto w-4 h-4 rounded bg-amber-100 text-amber-700 font-black flex items-center justify-center text-[10px]">B</div>}
                                  </td>
                                  <td className="px-1 py-1 text-center">
                                    {isGradable && grade === "BS" && <div className="mx-auto w-4 h-4 rounded bg-rose-100 text-rose-700 font-black flex items-center justify-center text-[10px]">BS</div>}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={9} className="px-3 py-8 text-center text-slate-400 font-medium">Belum ada baris mending</td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      {/* Summary Table & Overall Grade */}
                      <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col gap-6">
                        <div className="flex flex-col sm:flex-row gap-4 items-stretch w-full">
                          <div className="flex-1">
                            <table className="w-full text-left text-xs border-collapse border border-slate-300 bg-white shadow-sm h-full">
                              <thead>
                                <tr className="bg-slate-100">
                                  <th className="px-3 py-2 border border-slate-300 font-extrabold text-slate-700">KET</th>
                                  <th className="px-3 py-2 border border-slate-300 font-extrabold text-slate-700 text-center">Produksi</th>
                                  <th className="px-3 py-2 border border-slate-300 font-extrabold text-slate-700 text-center">Setelah Inspect</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                <tr className="hover:bg-slate-50 transition-colors">
                                  <td className="px-3 py-2 border border-slate-300 font-bold text-slate-800">Total Grade A</td>
                                  <td className="px-3 py-2 border border-slate-300 text-center font-bold text-slate-700">{prodA}</td>
                                  <td className="px-3 py-2 border border-slate-300 text-center font-bold text-emerald-600">{inspectA}</td>
                                </tr>
                                <tr className="hover:bg-slate-50 transition-colors">
                                  <td className="px-3 py-2 border border-slate-300 font-bold text-slate-800">Total Grade B</td>
                                  <td className="px-3 py-2 border border-slate-300 text-center font-bold text-slate-700">{prodB}</td>
                                  <td className="px-3 py-2 border border-slate-300 text-center font-bold text-amber-600">{inspectB}</td>
                                </tr>
                                <tr className="hover:bg-slate-50 transition-colors">
                                  <td className="px-3 py-2 border border-slate-300 font-bold text-slate-800">BS</td>
                                  <td className="px-3 py-2 border border-slate-300 text-center font-bold text-slate-700">{prodBS}</td>
                                  <td className="px-3 py-2 border border-slate-300 text-center font-bold text-rose-600">{inspectBS}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          
                          <div className="flex-1 h-full bg-white border border-slate-300 rounded-xl shadow-sm flex flex-col items-center justify-center py-6 px-4">
                            <span className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-2">Grade Keseluruhan</span>
                            <span className={`text-6xl font-black ${overallGrade === 'A' ? 'text-emerald-500' : overallGrade === 'B' ? 'text-amber-500' : overallGrade === 'C' ? 'text-orange-500' : 'text-rose-600'}`}>
                              {overallGrade}
                            </span>
                            <span className="text-slate-500 text-xs font-semibold mt-3 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                              Kategori: Max {bucket} {unit}
                            </span>
                            <span className="text-slate-400 text-[10px] font-medium mt-1">
                              Total: {totalQty} {unit} &bull; Cacat: {totalCacat}
                            </span>
                          </div>
                        </div>

                        {/* Additional Info Forms */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 w-full">
                          
                          {/* Column 1: Info */}
                          <div className="flex flex-col gap-4">
                            <table className="w-full text-left text-xs border-collapse border border-black bg-white">
                              <tbody>
                                <tr>
                                  <td className="px-2 py-1.5 border border-black font-bold w-1/2">Total {unit} Setelah di Inspecting</td>
                                  <td className="px-2 py-1.5 border border-black w-1/2">: {totalSetelahInspect}</td>
                                </tr>
                                <tr>
                                  <td className="px-2 py-1.5 border border-black font-bold">Berat Inspecting</td>
                                  <td className="px-2 py-1.5 border border-black">: {beratInspect}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Column 2: Inspect Info */}
                          <div className="flex flex-col gap-4">
                            <table className="w-full text-left text-xs border-collapse border border-black bg-white h-full">
                              <tbody>
                                <tr>
                                  <td className="px-2 py-1.5 border border-black font-bold w-1/2">Tanggal Inspecting</td>
                                  <td className="px-2 py-1.5 border border-black w-1/2">: {tanggalInspect}</td>
                                </tr>
                                <tr>
                                  <td className="px-2 py-1.5 border border-black font-bold w-1/2">Petugas Inspecting</td>
                                  <td className="px-2 py-1.5 border border-black w-1/2">: {petugasInspect}</td>
                                </tr>
                                <tr>
                                  <td className="px-2 py-1.5 border border-black font-bold">Start Inspect</td>
                                  <td className="px-2 py-1.5 border border-black">: {startInspect}</td>
                                </tr>
                                <tr>
                                  <td className="px-2 py-1.5 border border-black font-bold">Finish Inspect</td>
                                  <td className="px-2 py-1.5 border border-black">: {finishInspect}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Column 3: Mending Info */}
                          <div className="flex flex-col gap-4">
                            <table className="w-full text-left text-xs border-collapse border border-black bg-white h-full">
                              <tbody>
                                <tr>
                                  <td className="px-2 py-1.5 border border-black font-bold w-1/2">Tanggal Mending</td>
                                  <td className="px-2 py-1.5 border border-black w-1/2">: {pcs.tanggal_mending || ""}</td>
                                </tr>
                                <tr>
                                  <td className="px-2 py-1.5 border border-black font-bold w-1/2">Petugas Mending</td>
                                  <td className="px-2 py-1.5 border border-black w-1/2">: {pcs.petugas_mending || ""}</td>
                                </tr>
                                <tr>
                                  <td className="px-2 py-1.5 border border-black font-bold">Start Mending</td>
                                  <td className="px-2 py-1.5 border border-black">: {pcs.start_mending || ""}</td>
                                </tr>
                                <tr>
                                  <td className="px-2 py-1.5 border border-black font-bold">Finish Mending</td>
                                  <td className="px-2 py-1.5 border border-black">: {pcs.finish_mending || ""}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mechanic Downtimes Section for this Machine and Potongan */}
              {(() => {
                const headerInfoTarget = selectedPcsData[0]?.header || {};
                const mechForThisBatch = mechanicDowntimes.filter(
                  (m) => String(m.production_headers?.nomor_mc) === String(headerInfoTarget.nomor_mc) &&
                         (!m.production_headers?.potongan_ke || String(m.production_headers?.potongan_ke) === String(headerInfoTarget.potongan_ke))
                );
                
                if (mechForThisBatch.length > 0) {
                  const cleanPenanggungJawab = (raw: string) => {
                    if (!raw) return "-";
                    const match = raw.match(/^Perbaikan Khusus\s*\((.*)\)$/i);
                    if (match && match[1]) return match[1].trim();
                    return raw.replace(/^Perbaikan Khusus\s*/i, "").trim() || raw;
                  };

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

                  return (
                    <div className="mt-8 bg-purple-50/50 border border-purple-200 rounded-2xl overflow-hidden">
                      <div className="bg-purple-100/50 px-6 py-4 border-b border-purple-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                            <Wrench className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-purple-900">
                              Laporan Downtime Khusus (Tanpa Produksi)
                            </h3>
                            <p className="text-xs font-medium text-purple-600/80">
                              Data downtime (Mesin berhenti total)
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-0 overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-purple-50 text-purple-900/70 text-xs uppercase tracking-wider font-bold">
                            <tr>
                              <th className="px-6 py-4">Waktu Laporan</th>
                              <th className="px-6 py-4">Penanggung Jawab</th>
                              <th className="px-6 py-4">Shift</th>
                              <th className="px-6 py-4">Durasi</th>
                              <th className="px-6 py-4">Kategori</th>
                              <th className="px-6 py-4">Detail Masalah</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-100">
                            {mechForThisBatch.map((mech, idx) => {
                              const dt = new Date(mech.production_headers?.tanggal_jam);
                              const timeStr = isNaN(dt.getTime()) ? "-" : dt.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
                              return (
                                <tr key={mech.id || idx} className="hover:bg-purple-50/30 transition-colors">
                                  <td className="px-6 py-4 font-semibold text-purple-900">{timeStr}</td>
                                  <td className="px-6 py-4 text-purple-800 font-medium">{cleanPenanggungJawab(mech.dikerjakan_oleh)}</td>
                                   <td className="px-6 py-4 text-purple-800">
                                     {(() => {
                                       if (mech.production_headers?.groups?.nama_grup) return mech.production_headers.groups.nama_grup;
                                       try {
                                         const evs = typeof mech.production_headers?.downtime_events === "string" ? JSON.parse(mech.production_headers.downtime_events) : mech.production_headers?.downtime_events;
                                         if (evs && evs[0]?.shift) return evs[0].shift;
                                       } catch(e){}
                                       return "-";
                                     })()}
                                   </td>
                                  <td className="px-6 py-4 font-bold text-purple-900">{formatDurationNice(mech.durasi_detik || 0)}</td>
                                  <td className="px-6 py-4">
                                    <span className="bg-white border border-purple-200 text-purple-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                      {mech.kategori || "-"}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-purple-800">{mech.detail || "-"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
