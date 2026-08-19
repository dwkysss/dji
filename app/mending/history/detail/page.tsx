"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ClipboardCheck,
  User,
  Package,
  Box,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle
} from "lucide-react";
import CompactHeaderCard from "@/components/forms/CompactHeaderCard";
import { PROBLEM_DETAILS } from "../../../qc/page";
import { getAllDetailsForPcs, getMendingBatchById } from "@/actions/mending-actions";

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

const calculateDurationStr = (start?: string | null, finish?: string | null, pauseSec: number = 0, elapsedSec?: number | null) => {
  let totalSec = 0;

  if (elapsedSec !== undefined && elapsedSec !== null && elapsedSec > 0) {
    totalSec = elapsedSec;
  } else if (start && finish) {
    const parseSecs = (str: string) => {
      const match = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (!match) return null;
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const s = match[3] ? parseInt(match[3], 10) : 0;
      return h * 3600 + m * 60 + s;
    };

    const sSecs = parseSecs(start);
    const fSecs = parseSecs(finish);
    if (sSecs !== null && fSecs !== null) {
      let diff = fSecs - sSecs;
      if (diff < 0) diff += 24 * 3600;
      totalSec = Math.max(0, diff - pauseSec);
    }
  }

  if (totalSec <= 0) return "-";

  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hours > 0) {
    return mins > 0 ? `${hours}j ${mins}m` : `${hours}j`;
  }
  if (mins > 0) {
    return secs > 0 ? `${mins}m ${secs}d` : `${mins} mnt`;
  }
  return `${secs} dtk`;
};

function MendingDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [mendingData, setMendingData] = useState<any>(null);
  const [allPcsDetails, setAllPcsDetails] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!mendingData) return;
    const header = mendingData.header || {};
    const nomor_mc = header.nomor_mc;
    const design_id = header.design_id;
    const potongan_ke = header.potongan_ke;
    const pcs_index = mendingData.pcs_index || mendingData.detail?.pcs_index;

    if (!nomor_mc || !design_id || !potongan_ke || !pcs_index) return;

    getAllDetailsForPcs(nomor_mc, design_id, parseInt(potongan_ke), parseInt(pcs_index)).then((res) => {
      if (res.success && res.data) {
        setAllPcsDetails(res.data);
      }
    });
  }, [mendingData]);

  useEffect(() => {
    if (!id) {
      setErrorMsg("ID Mending tidak ditemukan.");
      setIsLoading(false);
      return;
    }

    const cachedData = sessionStorage.getItem("dji_mending_history_data_v2");
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        const batch = parsed.find((b: any) => b.id.toString() === id);

        if (batch) {
          setMendingData(batch);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.error("Failed to parse cached data:", e);
      }
    }

    // Fallback: fetch directly from Supabase via server action
    getMendingBatchById(id)
      .then((res) => {
        if (res.success && res.data) {
          setMendingData(res.data);
        } else {
          setErrorMsg(res.error || "Data mending tidak ditemukan.");
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching mending detail:", err);
        setErrorMsg("Terjadi kesalahan saat memuat data detail.");
        setIsLoading(false);
      });
  }, [id]);

  const group = mendingData || {};
  const header = group.header || {};
  const isMeteran = header.panel_no === "METERAN";
  const itemLabel = isMeteran ? "Titik Meter" : "Panel";

  let gradeA = 0, gradeB = 0, gradeBS = 0;
  (group.items || []).forEach((item: any) => {
    if (item.hasil_mending === "A") gradeA++;
    if (item.hasil_mending === "B") gradeB++;
    if (item.hasil_mending === "BS") gradeBS++;
  });
  const totalGradable = gradeA + gradeB + gradeBS;

  const displayGradeA = isMeteran ? (Number(group.mending_grade_a) || Number(header.meter_akhir) || 0) : gradeA;
  const displayGradeB = isMeteran ? (Number(group.mending_grade_b) || gradeB) : gradeB;
  const displayGradeBS = isMeteran ? (Number(group.mending_grade_bs) || gradeBS) : gradeBS;

  const detailsToDisplay = React.useMemo(() => {
    if (!mendingData) return [];

    if (isMeteran && allPcsDetails.length > 0) {
      return allPcsDetails.map((detail: any) => {
        const mendingItem = (group.items || []).find((item: any) => item.detail?.id === detail.id);
        return {
          ...detail,
          hasil_mending_original: mendingItem?.hasil_mending || null,
          final_inspection_id: detail.final_inspection_id,
          production_headers: detail.production_headers || detail.header || header,
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
    }

    return (group.items || []).map((item: any) => ({
      ...item.detail,
      hasil_mending_original: item.hasil_mending,
      final_inspection_id: item.detail?.final_inspection_id ?? item.final_inspection_id,
      production_headers: item.detail?.header || item.header || header,
    })).sort((a: any, b: any) => {
      if (
        a.production_headers?.panel_no === "METERAN" ||
        b.production_headers?.panel_no === "METERAN"
      ) {
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
      }
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

      const panelA = parseInt(pAStr, 10);
      const panelB = parseInt(pBStr, 10);
      if (!isNaN(panelA) && !isNaN(panelB)) {
        if (panelA !== panelB) return panelA - panelB;
      }
      return pAStr.localeCompare(pBStr, undefined, { numeric: true });
    });
  }, [mendingData, group.items, header, isMeteran, allPcsDetails]);

  const displayItems = React.useMemo(() => {
    if (!mendingData) return [];
    const isMeteranBatch = isMeteran;
    if (!isMeteranBatch) {
      const items: any[] = [];
      let currentOpCount = 0;
      let currentOpA = 0;
      let currentOpB = 0;
      let currentOpBS = 0;
      let lastTgl = "";
      let lastGrp = "";
      let lastOpr = "";

      const processed = detailsToDisplay.map((item: any) => {
        const h = item.production_headers || {};
        const opr = h.operators?.nama_operator || h.pic || "";
        const grp = h.groups?.nama_grup || "";
        const operatorStr = (grp ? `(${grp}) ` : '') + opr;
        
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
            const cleanName = opr.replace(/istirahat/i, "").trim().replace(/^\(|\)$/g, "").trim();
            if (cleanName) {
              extractedBackupOp = cleanName;
            }
          }
          backupOpName = extractedBackupOp;
        }
        
        const isStartOrFinish = h.panel_no === "START" || h.panel_no === "FINISH" || item.meter_kain === "START" || item.meter_kain === "FINISH";
        const isGradable = !isStartOrFinish;

        return {
          item,
          isIstirahat,
          hasIstirahat,
          backupOpName,
          isGradable,
          opr,
          grp,
          tgl: h.tgl || "-",
          operatorStr,
          oprStr: hasIstirahat ? "Istirahat" : opr
        };
      });

      processed.forEach((p: any, idx: number) => {
        const { item, isIstirahat, hasIstirahat, backupOpName, isGradable, opr, grp, tgl, operatorStr, oprStr } = p;

        if (isGradable) {
          currentOpCount += 1;
          if (item.hasil_mending_original === "A") currentOpA++;
          if (item.hasil_mending_original === "B") currentOpB++;
          if (item.hasil_mending_original === "BS") currentOpBS++;
        }

        let showTgl = false;
        let showGrp = false;
        let showOpr = false;

        if (idx === 0) {
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
        lastOpr = hasIstirahat ? "Istirahat" : opr;

        const rawPanelNo = item.production_headers?.panel_no || item.displayNo || "-";
        const isBsAwal = String(rawPanelNo).toUpperCase().includes("AWAL");
        const isBsAkhir = String(rawPanelNo).toUpperCase().includes("AKHIR");
        const isSisa = isBsAwal || isBsAkhir;

        items.push({
          ...item,
          isMeter: false,
          isStartRow: false,
          isIstirahat,
          hasIstirahat,
          backupOpName,
          isFinishReport: false,
          displayNo: item.production_headers?.panel_no || "-",
          meterDisplay: "-",
          cacatDisplay: isSisa ? (isBsAwal ? "Sisa Awal Potongan" : "Sisa Akhir Potongan") : (item.detail_masalah || item.keterangan_cacat || "-"),
          isGradable,
          showTgl,
          showGrp,
          showOpr,
          oprStr,
          grpStr: grp,
          tglStr: tgl,
          hasErrorDetail: !!item.kategori_masalah || !!item.detail_masalah
        });

        let nextOprStr = null;
        if (idx + 1 < processed.length) {
          nextOprStr = processed[idx + 1].operatorStr;
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

      return items;
    }

    const items: any[] = [];
    let globalRowCount = 0;
    let prevOperatorLastMeter: number | null = null;
    let currentOpStartMeter: number | null = null;
    let currentOpLastMeter: number | null = null;
    let lastOprString = "";

    const cleanMeterVal = (val: any) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      const clean = str.replace(/PCS\s*\d+\s*:\s*/gi, "");
      return clean.replace(/[a-zA-Z\s]+$/g, "").trim();
    };

    detailsToDisplay.forEach((item: any, idx: number) => {
      const h = item.production_headers || {};
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

      const detailStr = (item.detail_masalah || "").toUpperCase();
      const katStr = (item.kategori_masalah || "").toUpperCase();
      const ketStr = (item.keterangan_cacat || "").toUpperCase();
      const oprName = (opr || "").toUpperCase();

      const hasIstirahatText = detailStr.includes("ISTIRAHAT") || katStr.includes("ISTIRAHAT") || ketStr.includes("ISTIRAHAT") || oprName.includes("ISTIRAHAT");

      let hasRealDefects = false;
      if (item.production_defects && Array.isArray(item.production_defects)) {
        item.production_defects.forEach((d: any) => {
          if (!((d.kategori || "").toUpperCase().includes("ISTIRAHAT") || (d.detail || "").toUpperCase().includes("ISTIRAHAT"))) {
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
      const hasIstirahatRaw = hasIstirahatText;
      const hasIstirahat = hasIstirahatRaw && !hasRealDefects;
      const isIstirahat = hasIstirahat;
      const isFinishReport = h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "";

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

      const cleanDetail = item.detail_masalah 
        ? item.detail_masalah.replace(/\(Titik:\s*[A-Za-z0-9\s.\-]+\)/gi, "").replace(/\|\s*$/, "").replace(/,\s*$/, "").trim()
        : "";

      if (kats.length > 0) {
        if (cleanDetail.includes(" | ")) {
          const catDetails = cleanDetail.split(" | ");
          for (let i = 0; i < Math.max(kats.length, catDetails.length); i++) {
            const k = kats[i] || "Unknown";
            const d = catDetails[i] || "";
            pushDetailsForCat(k, d);
          }
        } else if (cleanDetail) {
          if (kats.length === 1) {
            pushDetailsForCat(kats[0], cleanDetail);
          } else {
            const dets = cleanDetail.split(", ");
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
          cacatLines = cacatLines.map(line => line + " [TAMBAHAN QC]");
        }
      }

      const combinedCacat = cacatLines.join("\n");
      const hasErrorDetail = !!item.kategori_masalah || !!item.detail_masalah;

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
        }
        isSameAsPrev = true;
      }

      const finalOprStr = isSameAsPrev ? "" : opr;
      const finalGrpStr = isSameAsPrev ? "" : grp;
      const finalTglStr = isSameAsPrev ? "" : h.tgl || "-";

      const showTgl = !isSameAsPrev;
      const showGrp = !isSameAsPrev;
      const showOpr = !isSameAsPrev;

      const isGradable = !isIstirahat && (!isFinishReport || hasErrorDetail);
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
        if (!extractedBackupOp && opr.toUpperCase().includes("ISTIRAHAT")) {
          const cleanName = opr.replace(/istirahat/i, "").trim().replace(/^\(|\)$/g, "").trim();
          if (cleanName) {
            extractedBackupOp = cleanName;
          }
        }
        backupOpName = extractedBackupOp;
      }

      const cacatText = hasIstirahat && !hasErrorDetail ? "ISTIRAHAT" : (isFinishReport && !hasErrorDetail ? "FINISH" : (hasErrorDetail && cacatForMeter ? cacatForMeter : "-"));

      const isPlaceholder = meterDisplay === "-" && !hasErrorDetail && !isIstirahat && !isFinishReport;
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
        }
      }
    });

    if (items.length > 0 && currentOpStartMeter !== null && currentOpLastMeter !== null) {
      const totalMeter = Math.abs(currentOpLastMeter - currentOpStartMeter);
      const [lastGrp, lastOprOnly] = lastOprString.includes(") ") 
        ? [lastOprString.match(/\(([^)]+)\)/)?.[1] || "", lastOprString.replace(/^\([^)]+\)\s*/, "")]
        : ["", lastOprString];
      items.push({
        id: `total-last-${lastOprString}-${Math.random()}`,
        isTotalRow: true,
        totalLabel: `Total Produksi${lastGrp ? ` (${lastGrp})` : ""} ${lastOprOnly}:`,
        totalMeter: `${totalMeter} Meter`,
      });
    }

    return items;
  }, [mendingData, detailsToDisplay, isMeteran]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-[#0070bc] mb-4" />
        <span className="text-slate-500 font-medium">Memuat Detail...</span>
      </div>
    );
  }

  if (errorMsg || !mendingData) {
    return (
      <div className="flex-1 w-full max-w-4xl mx-auto py-10 px-4 animate-fadeIn">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm flex flex-col items-center text-center">
          <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
          <h2 className="text-lg font-bold text-slate-800 mb-2">Oops! Ada Masalah</h2>
          <p className="text-slate-600 mb-6">{errorMsg || "Data tidak ditemukan."}</p>
          <button
            onClick={() => router.push("/mending/history")}
            className="px-6 py-2 bg-[#0070bc] text-white rounded-xl font-bold hover:bg-[#005a96] transition-colors"
          >
            Kembali ke Riwayat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto pb-20 animate-fadeIn">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/mending/history")}
            className="w-10 h-10 shrink-0 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0070bc]/10 flex items-center justify-center text-[#0070bc] shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Detail Hasil Mending Batch
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-500">
                Desain: {header.design_id || "-"} / Potongan: {header.potongan_ke || "-"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Header Info like Production Detail */}
      <CompactHeaderCard
        nomorMc={header.nomor_mc || "-"}
        shiftName="-"
        operatorName="-"
        design={header.design_id || "-"}
        pcsCount={group.items?.length || 0}
        panelPotongan={`- / ${header.potongan_ke || "-"}`}
        courseRpm={`${header.course || "-"} / ${header.rpm || "-"}`}
        noCustomer={header.no_customer || header.no_order_barang || "-"}
        tanggalPotong={(() => {
          let latest = header.tanggal_potong || "";
          let latestTs = "";
          if (group.items && Array.isArray(group.items)) {
            group.items.forEach((it: any) => {
              const ts = it.detail?.tanggal_jam || it.detail?.created_at || it.header?.tanggal_jam;
              if (ts && (!latestTs || String(ts).localeCompare(String(latestTs)) > 0)) {
                latestTs = ts;
              }
              const pot = it.header?.tanggal_potong || it.detail?.header?.tanggal_potong;
              if (pot && (!latest || String(pot).localeCompare(String(latest)) > 0)) {
                latest = pot;
              }
            });
          }
          if (latest) {
            const latestDate = latestTs ? latestTs.split("T")[0].split(" ")[0] : "";
            if (latestDate && latestDate.localeCompare(latest) > 0) {
              return latestTs || latestDate;
            }
            return latest;
          }
          return latestTs || "-";
        })()}
        noOrder={header.no_order_barang || "-"}
        statusMatching={header.status_matching || "-"}
        pick={header.pick || "-"}
        benangDasar={header.jenis_benang_dasar || "-"}
        liner={header.liner || "-"}
        heavy={header.heavy || "-"}
        shadow={header.shadow || "-"}
        pinggiran={header.pinggiran || "-"}
        tanggalProduksi={(() => {
          let oldest = header.tanggal_jam || header.created_at || header.tgl;
          if (group.items && Array.isArray(group.items)) {
            group.items.forEach((it: any) => {
              const ts = it.detail?.tanggal_jam || it.detail?.created_at || it.header?.tanggal_jam;
              if (ts && (!oldest || String(ts).localeCompare(String(oldest)) < 0)) {
                oldest = ts;
              }
            });
          }
          return oldest || "-";
        })()}
        potonganKe={header.potongan_ke?.toString() || "-"}
        rollNo={group.items?.[0]?.detail?.roll_no || "-"}
        course={header.course || "-"}
        rpm={header.rpm || "-"}
      />

      {/* Mending Summary Info */}
      <div className="mt-6 mb-6 bg-sky-50 border border-sky-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <h4 className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">Petugas Mending</h4>
            <p className="text-sm font-black text-sky-900">
              {group.petugas_mending}
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">Start Mending</h4>
            <p className="text-sm font-bold text-sky-900 font-mono">
              {group.tanggal_mending} {group.start_mending || "-"}
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">Finish Mending</h4>
            <p className="text-sm font-bold text-sky-900 font-mono">
              {group.tanggal_mending} {group.finish_mending || "-"}
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">Durasi Mending</h4>
            <p className="text-sm font-black text-amber-700 font-mono">
              {(() => {
                let elapsed = group.elapsed_seconds;
                if (elapsed === undefined || elapsed === null) {
                  const m = (group.keterangan_mending || "").match(/\[ELAPSED:(\d+)\]/);
                  if (m && m[1]) elapsed = parseInt(m[1], 10);
                }
                let pause = group.pause_seconds || 0;
                if (!pause) {
                  const mp = (group.keterangan_mending || "").match(/\[PAUSE:(\d+)\]/);
                  if (mp && mp[1]) pause = parseInt(mp[1], 10);
                }
                return calculateDurationStr(group.start_mending, group.finish_mending, pause, elapsed);
              })()}
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">
              {isMeteran ? "Total Panjang" : "Total Panel"}
            </h4>
            <p className="text-sm font-black text-sky-900">
              {isMeteran ? `${displayGradeA} METER` : `${group.items?.length || 0} Panel`}
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">Rekap Hasil</h4>
            <p className="text-sm font-black flex flex-wrap items-center gap-2">
              <span className="text-emerald-600">
                {isMeteran ? `${displayGradeA} M` : `${gradeA} A`}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-amber-500">
                {isMeteran ? `${displayGradeB} T` : `${gradeB} B`}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-rose-600">
                {isMeteran ? `${displayGradeBS} T` : `${gradeBS} BS`}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Panel List Layout */}
      <div className="pb-4">
        <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          Rincian per {itemLabel}
        </h4>
        <div className="flex w-full pb-4 gap-6">
          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
            {/* PCS Header */}
            <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-center">
              <h5 className="font-black text-slate-700 tracking-wide text-sm flex items-center gap-2">
                PCS {group.pcs_index || group.detail?.pcs_index}
              </h5>
            </div>

            {/* PCS Table */}
            <div className="flex-1 overflow-auto bg-white p-2">
              {isMeteran ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                      <th className="px-2 py-2 w-8 text-center border-r border-slate-100" rowSpan={2}>NO</th>
                      <th className="px-2 py-2 w-20 border-r border-slate-100 whitespace-nowrap" rowSpan={2}>TGL</th>
                      <th className="px-1.5 py-2 w-10 text-center border-r border-slate-100" rowSpan={2}>Group</th>
                      <th className="px-2 py-2 w-24 border-r border-slate-100" rowSpan={2}>Operator</th>
                      <th className="px-1.5 py-2 text-center w-12 border-r border-slate-100" rowSpan={2}>METER</th>
                      <th className="px-1.5 py-2 text-center w-12 border-r border-slate-100" rowSpan={2}>KET ✓/X</th>
                      <th className="px-2 py-2 min-w-[200px] w-full border-r border-slate-100" rowSpan={2}>KETERANGAN CACAT</th>
                      <th className="px-2 py-1 border-b border-slate-200 font-extrabold text-slate-600 text-center border-r border-slate-100" colSpan={3}>MENDING</th>
                    </tr>
                    <tr className="bg-slate-50">
                      <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-emerald-600 border-r border-slate-100">A</th>
                      <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-amber-600 border-r border-slate-100">B</th>
                      <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-rose-600 border-r border-slate-100">BS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {displayItems.map((item: any, index: number) => {
                      if (item.isTotalRow) {
                        return (
                          <tr key={item.id || index} className="bg-slate-100 border-t-2 border-b-2 border-slate-300">
                            <td colSpan={10} className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
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
                            <td className="px-1.5 py-1.5 font-medium text-slate-700 text-center text-xs w-12 border-r border-slate-100 border-b border-slate-100">
                              {item.showGrp ? item.grpStr : ""}
                            </td>
                            <td className="px-2 py-1.5 font-medium text-slate-700 leading-tight text-xs w-28 border-r border-slate-100 border-b border-slate-100">
                              {item.showOpr ? item.oprStr : ""}
                            </td>
                            <td className="px-1.5 py-1.5 text-center font-bold text-slate-800 text-xs w-14 border-r border-slate-100 border-b border-slate-100">
                              {item.meterDisplay}
                            </td>
                            <td className="px-1.5 py-1.5 text-center font-bold text-sm w-14 border-r border-slate-100 border-b border-slate-100">
                              {/* Empty KET for START */}
                            </td>
                            <td className="px-3 py-1.5 text-[11px] font-bold text-slate-400 whitespace-pre leading-tight border-r border-slate-100 border-b border-slate-100">
                              START
                            </td>
                            <td className="px-1 py-1.5 border-b border-slate-100 border-r border-slate-100"></td>
                            <td className="px-1 py-1.5 border-b border-slate-100 border-r border-slate-100"></td>
                            <td className="px-1 py-1.5 border-b border-slate-100"></td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={item.id || index} className="hover:bg-slate-50 transition-colors">
                          <td className="px-1 py-1.5 font-bold text-slate-800 text-center text-xs w-7 border-r border-slate-100 border-b border-slate-100">
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
                          <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap text-xs w-24 border-r border-slate-100 border-b border-slate-100">
                            {item.showTgl ? item.tglStr : ""}
                          </td>
                          <td className="px-1.5 py-1.5 font-medium text-slate-700 text-center text-xs w-12 border-r border-slate-100 border-b border-slate-100">
                            {item.showGrp ? item.grpStr : ""}
                          </td>
                          <td className={`px-2 py-1.5 font-medium text-slate-700 leading-tight text-xs w-28 border-r border-slate-100 border-b border-slate-100 ${item.hasIstirahat ? "italic font-bold text-slate-500" : ""}`}>
                            {item.hasIstirahat ? "Istirahat" : (item.showOpr ? item.oprStr : "")}
                          </td>
                          <td className="px-1.5 py-1.5 text-center font-bold text-slate-800 text-xs w-14 border-r border-slate-100 border-b border-slate-100">
                            {item.meterDisplay}
                          </td>
                          <td className="px-1.5 py-1.5 text-center font-bold text-sm w-14 border-r border-slate-100 border-b border-slate-100">
                            {!item.isGradable ? "" : (item.indikator_stop || item.kategori_masalah ? <span className="text-rose-600">X</span> : <span className="text-emerald-600">✓</span>)}
                          </td>
                          <td className={`px-3 py-1.5 text-[11px] font-medium whitespace-pre leading-tight border-r border-slate-100 border-b border-slate-100 ${
                            item.hasIstirahat || item.cacatDisplay === "ISTIRAHAT" || item.cacatDisplay === "FINISH"
                              ? "text-slate-500"
                              : (item.cacatDisplay && item.cacatDisplay !== "-" && item.cacatDisplay !== "START" ? "text-rose-600" : "text-slate-700")
                          }`}>
                            {item.backupOpName && item.hasIstirahat && <div className="text-slate-700 font-bold mb-0.5">{item.backupOpName}</div>}
                            {!item.hasIstirahat && (item.cacatDisplay || "-")}
                            {item.hasIstirahat && item.cacatDisplay && item.cacatDisplay !== "-" && item.cacatDisplay !== "ISTIRAHAT" && (
                              <div className="text-rose-600">{item.cacatDisplay}</div>
                            )}
                            {item.hasIstirahat && (!item.cacatDisplay || item.cacatDisplay === "-" || item.cacatDisplay === "ISTIRAHAT") && !item.backupOpName && "-"}
                          </td>
                          <td className="px-1 py-1.5 text-center border-r border-slate-100 border-b border-slate-100">
                            {item.isGradable ? (
                              <div className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md border ${item.hasil_mending_original === "A" ? "border-emerald-500 bg-emerald-100 text-emerald-700 shadow-sm" : "border-slate-200 bg-slate-50 text-slate-300"}`}>
                                <CheckCircle className="w-3.5 h-3.5" />
                              </div>
                            ) : null}
                          </td>
                          <td className="px-1 py-1.5 text-center border-r border-slate-100 border-b border-slate-100">
                            {item.isGradable ? (
                              <div className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md border ${item.hasil_mending_original === "B" ? "border-amber-500 bg-amber-100 text-amber-700 shadow-sm" : "border-slate-200 bg-slate-50 text-slate-300"}`}>
                                <span className="text-[10px] font-black">B</span>
                              </div>
                            ) : null}
                          </td>
                          <td className="px-1 py-1.5 text-center border-b border-slate-100">
                            {item.isGradable ? (
                              <div className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md border ${item.hasil_mending_original === "BS" ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-slate-50 text-slate-300"}`}>
                                <span className="text-[10px] font-black">BS</span>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-12 border-r border-slate-100" rowSpan={2}>PNL NO</th>
                      <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-20 whitespace-nowrap border-r border-slate-100" rowSpan={2}>TGL</th>
                      <th className="px-1.5 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-12 text-center border-r border-slate-100" rowSpan={2}>Group</th>
                      <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-24 border-r border-slate-100" rowSpan={2}>Operator</th>
                      <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-16 text-center border-r border-slate-100" rowSpan={2}>KET ✓/X</th>
                      <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-64 whitespace-nowrap border-r border-slate-100" rowSpan={2}>KETERANGAN CACAT</th>
                      <th className="px-2 py-1 border-b border-slate-200 font-extrabold text-slate-600 text-center border-r border-slate-100" colSpan={3}>MENDING</th>
                    </tr>
                    <tr className="bg-slate-50">
                      <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-emerald-600 border-r border-slate-100">A</th>
                      <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-amber-600 border-r border-slate-100">B</th>
                      <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-rose-600 border-r border-slate-100">BS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {displayItems.map((item: any, idx: number) => {
                      if (item.isTotalRow) {
                        return (
                          <tr key={item.id || idx} className="bg-slate-100 border-t border-b border-slate-200 font-semibold text-slate-700">
                            <td colSpan={4} className="px-3 py-2 text-right whitespace-nowrap border-r border-slate-100 border-b border-slate-100">
                              {item.totalLabel}
                            </td>
                            <td className="px-1 py-2 text-center text-slate-800 font-extrabold whitespace-nowrap border-r border-slate-100 border-b border-slate-100">
                              {item.totalCount} Panel
                            </td>
                            <td colSpan={1} className="bg-slate-100 border-r border-slate-100 border-b border-slate-100"></td>
                            <td className="px-1 py-2 text-center text-emerald-600 bg-emerald-50/20 font-black border-r border-slate-100 border-b border-slate-100">
                              {item.countA}
                            </td>
                            <td className="px-1 py-2 text-center text-amber-600 bg-amber-50/20 font-black border-r border-slate-100 border-b border-slate-100">
                              {item.countB}
                            </td>
                            <td className="px-1 py-2 text-center text-rose-600 bg-rose-50/20 font-black border-b border-slate-100">
                              {item.countBS}
                            </td>
                          </tr>
                        );
                      }

                      const detail = item;
                      const itemHeader = item.production_headers || header;

                      const isIstirahat = item.isIstirahat;
                      const isGradable = item.isGradable;

                      const displayTgl = item.showTgl ? item.tglStr : "";
                      const displayGrp = item.showGrp ? item.grpStr : "";
                      const displayOp = item.showOpr ? item.oprStr : "";

                      let Icon = null;
                      let iconColor = "";

                      if (detail.final_inspection_id === 1) {
                        Icon = CheckCircle2;
                        iconColor = "text-emerald-500";
                      } else if (detail.final_inspection_id === 2 || detail.final_inspection_id === 3 || detail.final_inspection_id === 4) {
                        Icon = XCircle;
                        iconColor = "text-rose-500";
                      }

                      const rawPanelNo = itemHeader.panel_no || detail.displayNo || "";
                      const isBsAwal = String(rawPanelNo).toUpperCase().includes("AWAL");
                      const isBsAkhir = String(rawPanelNo).toUpperCase().includes("AKHIR");
                      const isSisa = isBsAwal || isBsAkhir;

                      let masalahLines: string[] = [];
                      if (isSisa) {
                        masalahLines = [isBsAwal ? "Sisa Awal Potongan" : "Sisa Akhir Potongan"];
                      } else if (!isIstirahat) {
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

                                rawDetails.forEach((dItem: any) => {
                                  const d = typeof dItem === 'string' ? dItem.trim() : String(dItem);
                                  if (!d) return;
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

                              rawDetails.forEach((dItem: any) => {
                                const d = typeof dItem === 'string' ? dItem.trim() : String(dItem);
                                if (!d) return;
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
                          
                          masalahLines.push(...cacatLines);
                        }

                        if (detail.keterangan_qc && detail.keterangan_qc !== "-") {
                          masalahLines.push(`QC: ${detail.keterangan_qc}`);
                        }
                      }
                      if (masalahLines.length === 0) masalahLines.push("-");

                      return (
                        <tr key={item.id || idx} className="hover:bg-sky-50/30 transition-colors group">
                          <td className="px-2 py-1 font-bold text-slate-800 text-center border-r border-slate-100 border-b border-slate-100">
                            {isBsAwal ? (
                              <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded leading-none shadow-sm whitespace-nowrap">BS AWAL</span>
                            ) : isBsAkhir ? (
                              <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded leading-none shadow-sm whitespace-nowrap">BS AKHIR</span>
                            ) : (
                              <div className="flex flex-col items-center justify-center">
                                <span>{(itemHeader.panel_no === "METERAN" ? (detail.meter_kain ?? "-") : String(itemHeader.panel_no || "-")).replace(/\s*\((BS|GAGAL)\)/gi, "").trim()}</span>
                                {(String(itemHeader.panel_no).includes("(BS)") || detail.jml_hasil_produksi === 0 || detail.status_inspeksi === "BS") && (
                                  <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded mt-0.5 leading-none shadow-sm border border-rose-200">BS</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1 text-slate-600 whitespace-nowrap border-r border-slate-100 border-b border-slate-100">
                            {displayTgl}
                          </td>
                          <td className="px-1.5 py-1 font-medium text-slate-700 text-center border-r border-slate-100 border-b border-slate-100">
                            {displayGrp}
                          </td>
                          <td className={`px-2 py-1 font-medium text-slate-700 leading-tight border-r border-slate-100 border-b border-slate-100 ${item.hasIstirahat ? "italic font-bold text-slate-500" : ""}`}>
                            {item.hasIstirahat ? "Istirahat" : displayOp}
                          </td>
                          <td className="px-2 py-1 text-center font-bold text-sm border-r border-slate-100 border-b border-slate-100">
                            {Icon ? <Icon className={`w-3.5 h-3.5 mx-auto ${iconColor}`} /> : <span className="text-slate-300">-</span>}
                          </td>
                          <td className={`px-2 py-1 text-[11px] font-medium whitespace-pre leading-tight border-r border-slate-100 border-b border-slate-100 ${
                            item.hasIstirahat || (masalahLines.length === 1 && (masalahLines[0] === "ISTIRAHAT" || masalahLines[0] === "FINISH" || masalahLines[0] === "-"))
                              ? "text-slate-500"
                              : "text-rose-600"
                          }`}>
                            <div className="flex flex-col gap-0.5">
                              {item.backupOpName && item.hasIstirahat && <div className="text-slate-700 font-bold mb-0.5">{item.backupOpName}</div>}
                              {masalahLines.map((line: string, i: number) => {
                                if (item.hasIstirahat && line === "ISTIRAHAT") return null;
                                if (item.hasIstirahat && item.backupOpName && line === "-") return null;
                                if (item.hasIstirahat && !item.backupOpName && masalahLines.length === 1 && line === "-") {
                                    return <span key={i} title={line}>-</span>;
                                }
                                return (
                                  <span key={i} title={line} className={item.hasIstirahat && line !== "-" ? "text-rose-600" : ""}>
                                    {line}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-1 py-1.5 text-center border-r border-slate-100 border-b border-slate-100">
                            {isGradable ? (
                              <div className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md border ${item.hasil_mending_original === "A" ? "border-emerald-500 bg-emerald-100 text-emerald-700 shadow-sm" : "border-slate-200 bg-slate-50 text-slate-300"}`}>
                                <CheckCircle className="w-3.5 h-3.5" />
                              </div>
                            ) : null}
                          </td>
                          <td className="px-1 py-1.5 text-center border-r border-slate-100 border-b border-slate-100">
                            {isGradable ? (
                              <div className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md border ${item.hasil_mending_original === "B" ? "border-amber-500 bg-amber-100 text-amber-700 shadow-sm" : "border-slate-200 bg-slate-50 text-slate-300"}`}>
                                <span className="text-[10px] font-black">B</span>
                              </div>
                            ) : null}
                          </td>
                          <td className="px-1 py-1.5 text-center border-b border-slate-100">
                            {isGradable ? (
                              <div className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md border ${item.hasil_mending_original === "BS" ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-slate-50 text-slate-300"}`}>
                                <span className="text-[10px] font-black">BS</span>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                    {totalGradable > 0 && (
                      <tr className="bg-slate-50 font-bold border-t border-slate-200 text-[11px] text-slate-700 uppercase tracking-wider">
                        <td className="px-2 py-3 text-right font-extrabold border-r border-slate-100 border-b border-slate-100" colSpan={6}>
                          Total ({totalGradable} Panel):
                        </td>
                        <td className="px-1 py-3 text-center text-emerald-600 bg-emerald-50/40 font-black border-r border-slate-100 border-b border-slate-100">
                          {gradeA}
                        </td>
                        <td className="px-1 py-3 text-center text-amber-600 bg-amber-50/40 font-black border-r border-slate-100 border-b border-slate-100">
                          {gradeB}
                        </td>
                        <td className="px-1 py-3 text-center text-rose-600 bg-rose-50/40 font-black border-b border-slate-100">
                          {gradeBS}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MendingDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-[#0070bc] mb-4" />
        <span className="text-slate-500 font-medium">Memuat Halaman...</span>
      </div>
    }>
      <MendingDetailContent />
    </Suspense>
  );
}
