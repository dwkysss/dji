"use client";

import React from "react";
import { Printer, X } from "lucide-react";

interface PrintableProductionReportProps {
  detailData: any;
  isOpen: boolean;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatWibTime = (dateVal?: string): string => {
  if (!dateVal || dateVal === "-") return "-";
  const str = String(dateVal).trim();
  if (/^\d{2}:\d{2}/.test(str)) return str.substring(0, 5);
  if (str.includes(" ")) { const t = str.split(" ")[1]; if (t?.includes(":")) return t.substring(0, 5); }
  if (str.includes("T")) { const t = str.split("T")[1]; if (t?.includes(":")) return t.substring(0, 5); }
  try { const dt = new Date(str); if (!isNaN(dt.getTime())) return `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`; } catch {}
  return "-";
};

const extractDate = (ts: string) => {
  if (!ts) return "-";
  if (ts.includes("T")) return ts.split("T")[0];
  if (ts.includes(" ")) return ts.split(" ")[0];
  return ts;
};

function formatFullDateTime(dateVal?: string): string {
  if (!dateVal || dateVal === "-" || dateVal === "—") return "-";
  try {
    let str = String(dateVal).trim();
    if (!str) return "-";
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    let dt: Date;
    if (str.includes("T")) {
      dt = new Date(str);
    } else if (str.includes(" ")) {
      const parts = str.split(" ");
      const dPart = parts[0];
      const tPart = parts[1] || "00:00:00";
      if (str.includes("Z") || str.includes("+") || str.includes("-", 10)) dt = new Date(str);
      else dt = new Date(`${dPart}T${tPart}`);
    } else {
      dt = new Date(str);
    }
    if (isNaN(dt.getTime())) return dateVal;
    const year = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" });
    const month = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta", month: "2-digit" });
    const day = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta", day: "2-digit" });
    const timeStr = dt.toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).replace(".", ":");
    return `${year}-${month}-${day} ${timeStr}`;
  } catch (e) {
    return dateVal;
  }
}

const cleanMeterVal = (val: any) =>
  val === null || val === undefined ? "" :
  String(val).replace(/PCS\s*\d+\s*:\s*/gi, "").replace(/[a-zA-Z\s]+$/g, "").trim();

const buildCacatText = (item: any): string => {
  const lines: string[] = [];
  if (item.production_defects && Array.isArray(item.production_defects) && item.production_defects.length > 0) {
    item.production_defects.forEach((d: any) => {
      if ((d.kategori || "").toUpperCase().includes("ISTIRAHAT") || (d.detail || "").toUpperCase().includes("ISTIRAHAT")) return;
      const k = d.kategori || ""; const det = d.detail || ""; const b = d.blok || "";
      let line = k && det ? `${k} - ${det}` : (k || det);
      if (b) line += ` (b. ${b.replace(/blok\s*/gi, "").trim()})`;
      if (line && !lines.includes(line)) lines.push(line);
    });
  }

  if (lines.length === 0) {
    const k = item.kategori_masalah || ""; const d = item.detail_masalah || "";
    let ketCacat = (item.keterangan_cacat || "").replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();

    const kList = k.split(",").map((s: string) => s.trim()).filter(Boolean);
    const dList = d.split(",").map((s: string) => s.trim()).filter(Boolean);

    if (kList.length > 1 || dList.length > 1) {
      const maxLen = Math.max(kList.length, dList.length);
      for (let i = 0; i < maxLen; i++) {
        const cat = kList[i] || kList[0] || "";
        const det = dList[i] || dList[0] || "";
        let line = cat && det ? `${cat} - ${det}` : (cat || det);
        if (ketCacat) {
          const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
          if (cleanB) line += ` (b. ${cleanB})`;
        }
        if (line && !lines.includes(line)) lines.push(line);
      }
    } else {
      let line = k && d ? `${k} - ${d}` : (k || d);
      if (ketCacat) {
        const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
        if (cleanB) {
          if (line) line += ` (b. ${cleanB})`;
          else line = `(b. ${cleanB})`;
        }
      }
      if (line && !lines.includes(line)) lines.push(line);
    }
  }

  return lines.length > 0 ? lines.join("\n").replace(/\bbenang\b/gi, "B.") : "-";
};

const formatDurationNice = (totalSec: number | string) => {
  const sec = typeof totalSec === "string" ? parseInt(totalSec) || 0 : totalSec || 0;
  if (sec <= 0) return "-";
  const hours = Math.floor(sec / 3600); const minutes = Math.floor((sec % 3600) / 60); const seconds = sec % 60;
  if (hours > 0) return minutes > 0 ? `${hours}j ${minutes}m` : `${hours}j`;
  if (minutes > 0) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  return `${seconds}s`;
};

// final_inspection_id: 1 = A, 2 = B, 3 = BS. Also check keterangan/kategori for BS/GAGAL.
const getGrade = (panel: any, detail: any): "A" | "B" | "BS" | "" => {
  const ketCacat = (detail?.keterangan_cacat || panel?.keterangan_cacat || "").toUpperCase();
  const katMasalah = (detail?.kategori_masalah || panel?.kategori_masalah || "").toUpperCase();
  const panelNo = String(panel?.panel_no || "").toUpperCase();
  if (ketCacat.includes("ISTIRAHAT") || ketCacat === "START" || ketCacat === "FINISH") return "";
  if (ketCacat.includes("BS") || ketCacat.includes("GAGAL") || katMasalah.includes("BS") || panelNo.includes("BS") || panelNo.includes("GAGAL")) return "BS";
  const inspId = detail?.final_inspection_id ?? panel?.final_inspection_id ?? 1;
  if (inspId === 3 || String(inspId) === "3") return "BS";
  if (inspId === 2 || String(inspId) === "2") return "B";
  if (detail?.kategori_masalah || detail?.detail_masalah) return "B";
  return "A";
};

// ─── Group panels by PCS (exact same logic as page.tsx) ─────────────────────

function groupByPcs(rawPanels: any[]) {
  const pcsGroups: { [key: string]: any[] } = {};

  // Deduplicate by id
  const uniqueById = new Map<string, any>();
  rawPanels.forEach((panel: any) => {
    if (!uniqueById.has(panel.id)) {
      uniqueById.set(panel.id, { ...panel, production_details: [...(panel.production_details || [])] });
    }
  });

  // Merge duplicate panel_no (non-METERAN)
  const deduplicatedPanels = Array.from(uniqueById.values());
  const finalPanels: any[] = [];
  const seenPanelNo = new Map<string, any>();

  deduplicatedPanels.forEach((panel: any) => {
    if (panel.panel_no === "METERAN") {
      finalPanels.push(panel);
    } else {
      const key = panel.panel_no;
      const existing = seenPanelNo.get(key);
      if (existing) {
        existing.production_details.push(...(panel.production_details || []));
        let existingDt: any[] = [];
        try { existingDt = typeof existing.downtime_events === 'string' ? JSON.parse(existing.downtime_events) : (existing.downtime_events || []); } catch {}
        let newDt: any[] = [];
        try { newDt = typeof panel.downtime_events === 'string' ? JSON.parse(panel.downtime_events) : (panel.downtime_events || []); } catch {}
        existing.downtime_events = [...existingDt, ...newDt];
        const existingPcs = parseInt(existing.pcs || "1"); const newPcs = parseInt(panel.pcs || "1");
        if (newPcs > existingPcs) existing.pcs = newPcs.toString();
      } else {
        seenPanelNo.set(key, panel);
      }
    }
  });
  finalPanels.push(...Array.from(seenPanelNo.values()));

  // Find oldest panel per operator
  const oldestPanelIdByOperator = new Map<string, string>();
  const sortedByTime = [...finalPanels].sort((a, b) => String(a.tanggal_jam || "").localeCompare(String(b.tanggal_jam || "")));
  sortedByTime.forEach((p: any) => {
    const opr = p.operators?.nama_operator || p.pic || "";
    const grp = p.groups?.nama_grup || "";
    const operatorStr = (grp ? `(${grp}) ` : "") + opr;
    if (!oldestPanelIdByOperator.has(operatorStr)) oldestPanelIdByOperator.set(operatorStr, p.id);
  });

  // Build pcsGroups
  finalPanels.forEach((panel: any) => {
    if (panel.panel_no === "Downtime Mekanik (Direct)" || panel.pcs === 0 || panel.pcs === "0") return;
    const totalPcs = parseInt(panel.pcs ?? "1");
    for (let i = 1; i <= totalPcs; i++) {
      const pcsKey = i.toString();
      if (!pcsGroups[pcsKey]) pcsGroups[pcsKey] = [];

      const panelClone = { ...panel };
      let dtEvents: any[] = [];
      try {
        if (typeof panelClone.downtime_events === 'string') dtEvents = JSON.parse(panelClone.downtime_events);
        else if (Array.isArray(panelClone.downtime_events)) dtEvents = panelClone.downtime_events;
      } catch {}

      const matchedEvents = dtEvents.filter((e: any) =>
        !e.pcsKe || e.pcsKe === "Semua" || e.pcsKe.split(",").map((x: any) => x.trim()).includes(pcsKey)
      );

      let hasDetails = false;
      if (panelClone.production_details) {
        const filteredDetails = panelClone.production_details.filter((d: any) => {
          const pIndex = d.pcs_index ? parseInt(d.pcs_index) : 1;
          return pIndex === i;
        });
        const hasErrors = filteredDetails.some((d: any) => d.kategori_masalah || d.keterangan_cacat);
        if (hasErrors) { hasDetails = true; panelClone.production_details = filteredDetails; }
        else panelClone.production_details = [];
      }

      const isIstirahat = panelClone.production_details?.some((d: any) => d.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT"));
      const isMeterInput = panelClone.panel_no === "METERAN";
      const opr = panelClone.operators?.nama_operator || panelClone.pic || "";
      const grp = panelClone.groups?.nama_grup || "";
      const operatorStr = (grp ? `(${grp}) ` : "") + opr;
      const isOldest = oldestPanelIdByOperator.get(operatorStr) === panelClone.id;
      const isFinishReport = isMeterInput && panelClone.meter_akhir !== null && panelClone.meter_akhir !== undefined && String(panelClone.meter_akhir).trim() !== "";

      if (isMeterInput) {
        if (isOldest || isFinishReport || matchedEvents.length > 0 || hasDetails || isIstirahat) {
          pcsGroups[pcsKey].push(panelClone);
        }
      } else {
        if (panelClone.production_details.length === 0) {
          panelClone.production_details = panel.production_details?.filter((d: any) => {
            const pIndex = d.pcs_index ? parseInt(d.pcs_index) : 1;
            return pIndex === i;
          }) || [];
        }
        pcsGroups[pcsKey].push(panelClone);
      }
    }
  });

  return pcsGroups;
}

// ─── Build panel rows for a PCS group ────────────────────────────────────────

function buildPanelRows(panels: any[], shiftName: string) {
  const sorted = [...panels]
    .filter((p: any) => p.panel_no !== "METERAN")
    .sort((a, b) => {
      const pA = parseInt(a.panel_no || "0"); const pB = parseInt(b.panel_no || "0");
      if (pA === pB) return String(a.tanggal_jam || "").localeCompare(String(b.tanggal_jam || ""));
      return pA - pB;
    });

  let lastTgl = ""; let lastGrp = ""; let lastOpr = "";
  const rows: any[] = [];

  sorted.forEach((panel: any) => {
    const details = panel.production_details || [];
    const detailList = details.length > 0 ? details : [{}];

    detailList.forEach((detail: any, di: number) => {
      const ts = panel.tanggal_jam || panel.created_at || "";
      const tglStr = extractDate(ts);
      const grpStr = panel.groups?.nama_grup || shiftName || "-";
      const oprStr = panel.operators?.nama_operator || panel.pic || "-";

      const isIstirahat = (detail.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") || (detail.kategori_masalah || "").toUpperCase().includes("ISTIRAHAT");
      const hasDefect = !isIstirahat && (!!detail.kategori_masalah || !!detail.detail_masalah || (detail.production_defects && detail.production_defects.length > 0));
      const isGagal = String(panel.panel_no || "").toUpperCase().includes("GAGAL") || String(panel.panel_no || "").toUpperCase().includes("BS");

      const showTgl = di === 0 ? tglStr !== lastTgl : false;
      const showGrp = di === 0 ? (grpStr !== lastGrp || showTgl) : false;
      const showOpr = di === 0 ? (oprStr !== lastOpr || showGrp) : false;

      if (di === 0) { if (showTgl) lastTgl = tglStr; if (showGrp) lastGrp = grpStr; if (showOpr) lastOpr = oprStr; }

      const mergedDetail = { ...detail, production_defects: detail.production_defects || panel.production_defects };
      const cacatText = isIstirahat ? "-" : buildCacatText(mergedDetail);
      const downtimeSec = panel.total_downtime_detik || 0;
      const downtimeStr = di === 0 && downtimeSec > 0 ? formatDurationNice(downtimeSec) : "-";

      // Grade (no grade for istirahat)
      const isFinish = (detail.keterangan_cacat || "").toUpperCase() === "FINISH"
        || (panel.meter_akhir !== null && panel.meter_akhir !== undefined && String(panel.meter_akhir || "").trim() !== "" && !detail.kategori_masalah && !detail.detail_masalah);
      const grade = (isIstirahat || isFinish) ? "" : getGrade(panel, detail);

      // Backup operator name for istirahat rows
      let backupOpName = "";
      if (isIstirahat) {
        backupOpName = panel.operator_backup || "";
        if (!backupOpName) {
          const searchStr = `${panel.pic || ""} ${panel.jenis_laporan || ""} ${detail.keterangan_cacat || ""} ${detail.detail_masalah || ""}`;
          const m = searchStr.match(/Backup:\s*([^)\],]+)/i);
          if (m && m[1]) backupOpName = m[1].trim();
        }
      }

      // cacat display: for finish show "FINISH", for istirahat show backup name or "-"
      const displayCacat = isFinish ? "FINISH" : isIstirahat ? (backupOpName || "-") : cacatText;

      rows.push({ panelNo: panel.panel_no, tglStr, grpStr, oprStr, showTgl, showGrp, showOpr, isIstirahat, isFinish, hasDefect, isGagal, cacatText: displayCacat, downtimeStr, grade, backupOpName });
    });
  });

  return rows;
}

// ─── Build meter rows for a PCS group ────────────────────────────────────────

function buildMeterRows(panels: any[], shiftName: string) {
  const details: any[] = [];
  panels.forEach((p: any) => {
    const dets = p.production_details || [];
    if (dets.length === 0) details.push({ production_headers: p, final_inspection_id: p.final_inspection_id });
    else dets.forEach((d: any) => details.push({ ...d, production_headers: p, final_inspection_id: d.final_inspection_id ?? p.final_inspection_id ?? 1 }));
  });

  const filtered = details.filter((item: any) => {
    const isGagalCacat = (item.detail_masalah || "").toUpperCase().includes("GAGAL CACAT") || (item.keterangan_cacat || "").toUpperCase().includes("GAGAL CACAT");
    const hasIstirahatRaw = !isGagalCacat && (
      (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") || 
      (item.kategori_masalah || "").toUpperCase().includes("ISTIRAHAT") || 
      (item.detail_masalah || "").toUpperCase().includes("ISTIRAHAT") || 
      (item.detail_masalah || "").toUpperCase().includes("OPLOS SHIFT") || 
      (item.detail_masalah || "").toUpperCase().includes("GANTI OPERATOR")
    );
    let hasRealDefects = false;
    (item.production_defects || []).forEach((d: any) => { if (!((d.kategori || "").toUpperCase().includes("ISTIRAHAT"))) hasRealDefects = true; });
    if (!item.production_defects?.length && item.kategori_masalah && !item.kategori_masalah.toUpperCase().includes("ISTIRAHAT")) hasRealDefects = true;
    const hasIstirahat = hasIstirahatRaw && !hasRealDefects;
    const isIstirahat = hasIstirahat && (!item.kategori_masalah || item.kategori_masalah === "G");
    if (isIstirahat) { const h = item.production_headers || {}; return h.meter_kain || h.meter_akhir || h.meter_awal; }
    return true;
  });

  filtered.sort((a, b) => {
    const tA = a.production_headers?.tanggal_jam || a.tanggal_jam || "";
    const tB = b.production_headers?.tanggal_jam || b.tanggal_jam || "";
    return tA.localeCompare(tB);
  });

  const rows: any[] = [];
  let lastOprStr = ""; let currentStartMeter: number | null = null; let currentLastMeter: number | null = null;
  let prevLastMeter: number | null = null; let isSameOpr = false; let globalNo = 0;

  filtered.forEach((item: any, idx: number) => {
    const h = item.production_headers || {};
    const opr = h.operators?.nama_operator || h.pic || "-";
    const grp = h.groups?.nama_grup || shiftName || "-";
    const tgl = h.tgl || extractDate(h.tanggal_jam || h.created_at || "");
    const jamStr = formatWibTime(h.tanggal_jam || h.created_at || "");
    const oprStr = `${grp ? `(${grp}) ` : ""}${opr}`;

    const isGagalCacat = (item.detail_masalah || "").toUpperCase().includes("GAGAL CACAT") || (item.keterangan_cacat || "").toUpperCase().includes("GAGAL CACAT");
    const hasIstirahatRaw = !isGagalCacat && (
      (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") || 
      (item.kategori_masalah || "").toUpperCase().includes("ISTIRAHAT") || 
      (item.detail_masalah || "").toUpperCase().includes("ISTIRAHAT") || 
      (item.detail_masalah || "").toUpperCase().includes("OPLOS SHIFT") || 
      (item.detail_masalah || "").toUpperCase().includes("GANTI OPERATOR")
    );
    let hasRealDefects = false;
    (item.production_defects || []).forEach((d: any) => { if (!((d.kategori || "").toUpperCase().includes("ISTIRAHAT"))) hasRealDefects = true; });
    if (!item.production_defects?.length && item.kategori_masalah && !item.kategori_masalah.toUpperCase().includes("ISTIRAHAT")) hasRealDefects = true;
    const hasIstirahat = hasIstirahatRaw && !hasRealDefects;
    const isIstirahat = hasIstirahat && (!item.kategori_masalah || item.kategori_masalah === "G");

    const isFinishReport = h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "";
    const cacatText = buildCacatText({ ...item, production_defects: item.production_defects || [] });

    let defectMeterStr = "";
    (item.production_defects || []).forEach((d: any) => { if (d.meter) defectMeterStr = d.meter; });
    let meterDisplay = "-";
    if (item.meter_kain !== null && item.meter_kain !== undefined && String(item.meter_kain).trim() !== "") meterDisplay = cleanMeterVal(item.meter_kain);
    else if (defectMeterStr) meterDisplay = cleanMeterVal(defectMeterStr);
    else if (isIstirahat || isFinishReport) meterDisplay = cleanMeterVal(h.meter_akhir || h.meter_awal || "");

    const isFinish = isFinishReport && !item.kategori_masalah && !item.detail_masalah && !isIstirahat;
    const grade = (isIstirahat || isFinish) ? "" : getGrade(h, item);

    // Backup operator for istirahat rows
    let backupOpName = "";
    if (hasIstirahat) {
      backupOpName = h.operator_backup || "";
      if (!backupOpName) {
        const searchStr = `${h.pic || ""} ${h.jenis_laporan || ""} ${item.keterangan_cacat || ""} ${item.detail_masalah || ""}`;
        const m = searchStr.match(/Backup:\s*([^)\],]+)/i);
        if (m && m[1]) backupOpName = m[1].trim();
      }
    }

    // cacat display
    const displayCacat = isFinish ? "FINISH" : isIstirahat ? (backupOpName || "-") : cacatText;

    // Operator change → total row
    if (oprStr !== lastOprStr && rows.length > 0) {
      const totalMeter = currentStartMeter !== null && currentLastMeter !== null ? Math.abs(currentLastMeter - currentStartMeter) : null;
      const [prevGrpL, prevOprL] = lastOprStr.includes(") ") ? [lastOprStr.match(/\(([^)]+)\)/)?.[1] || "", lastOprStr.replace(/^\([^)]+\)\s*/, "")] : ["", lastOprStr];
      rows.push({ isTotalRow: true, totalLabel: `Total Produksi${prevGrpL ? ` (${prevGrpL})` : ""} ${prevOprL}:`, totalMeter: totalMeter !== null ? `${totalMeter} Meter` : "-" });
      prevLastMeter = currentLastMeter; currentStartMeter = null; currentLastMeter = null; isSameOpr = false;
    }

    // START row
    if (!isSameOpr) {
      const startMeter = prevLastMeter !== null ? String(prevLastMeter) : cleanMeterVal(h.meter_awal ?? "0");
      globalNo += 1;
      rows.push({ isStartRow: true, displayNo: globalNo, tglStr: tgl, jamStr, grpStr: grp, oprStr: opr, meterDisplay: startMeter });
      const v = parseFloat(startMeter);
      if (!isNaN(v)) { if (currentStartMeter === null) currentStartMeter = v; currentLastMeter = v; }
      isSameOpr = true;
    }

    lastOprStr = oprStr;
    const meterVal = parseFloat(meterDisplay);
    if (!isNaN(meterVal)) { if (currentStartMeter === null) currentStartMeter = meterVal; currentLastMeter = meterVal; }

    // showTgl/showGrp/showOpr look-back
    let prevTgl = ""; let prevGrp2 = ""; let prevOpr2 = "-";
    for (let k = rows.length - 1; k >= 0; k--) {
      const r = rows[k]; if (r.isTotalRow) continue;
      if (!prevTgl) prevTgl = r.tglStr; if (!prevGrp2) prevGrp2 = r.grpStr; if (prevOpr2 === "-") prevOpr2 = r.oprStr || "-";
      if (prevTgl && prevGrp2 && prevOpr2 !== "-") break;
    }
    const showOpr = opr !== prevOpr2;
    const showTgl = tgl !== prevTgl;
    const showGrp = grp !== prevGrp2 || !showOpr;

    const isPlaceholder = meterDisplay === "-" && !item.kategori_masalah && !item.detail_masalah && !isIstirahat && !isFinishReport;
    if (!isPlaceholder) {
      globalNo += 1;
      rows.push({ isStartRow: false, displayNo: globalNo, tglStr: tgl, grpStr: grp, oprStr: opr, meterDisplay, cacatDisplay: displayCacat, showTgl, showGrp, showOpr, isIstirahat, isFinish, hasIstirahat, hasDefect: !isIstirahat && !isFinish && cacatText !== "-", grade, backupOpName });
    }
  });

  // Final total row
  if (rows.length > 0 && currentStartMeter !== null && currentLastMeter !== null) {
    const total = Math.abs(currentLastMeter - currentStartMeter);
    const [lastGrpL, lastOprL] = lastOprStr.includes(") ") ? [lastOprStr.match(/\(([^)]+)\)/)?.[1] || "", lastOprStr.replace(/^\([^)]+\)\s*/, "")] : ["", lastOprStr];
    rows.push({ isTotalRow: true, totalLabel: `Total Produksi${lastGrpL ? ` (${lastGrpL})` : ""} ${lastOprL}:`, totalMeter: `${total} Meter` });
  }

  return rows;
}

// ─── Panel Table Render ───────────────────────────────────────────────────────

// 3 separate grade columns at far right
function GradeCols({ grade }: { grade: "A" | "B" | "BS" | "" }) {
  const tick = <span className="text-slate-950 font-bold text-[9px]">✓</span>;
  return (
    <>
      <td className="py-0.5 px-0.5 border-r border-slate-300 text-center w-5">{grade === "A" ? tick : ""}</td>
      <td className="py-0.5 px-0.5 border-r border-slate-300 text-center w-5">{grade === "B" ? tick : ""}</td>
      <td className="py-0.5 px-0.5 border-r border-slate-300 text-center w-6">{grade === "BS" ? tick : ""}</td>
    </>
  );
}

function PanelPrintTable({ rows }: { rows: any[] }) {
  return (
    <div className="border border-slate-400 text-[7px]">
      <table className="w-full text-left border-collapse table-fixed">
        <thead className="bg-white text-slate-950 font-bold uppercase tracking-wider border-b border-slate-400 text-[7.5px]">
          <tr>
            <th className="p-0.5 border-r border-slate-400 w-7 text-center">PNL</th>
            <th className="p-0.5 border-r border-slate-400 w-14">TGL</th>
            <th className="p-0.5 border-r border-slate-400 text-center w-5">GRP</th>
            <th className="p-0.5 border-r border-slate-400 w-16">OPERATOR</th>
            <th className="p-0.5 border-r border-slate-400 text-center w-6">KET</th>
            <th className="p-0.5 border-r border-slate-400 whitespace-nowrap">KETERANGAN CACAT</th>
            <th className="p-0.5 border-r border-slate-400 text-center w-8">DT</th>
            <th className="p-0.5 border-r border-slate-400 text-center w-5">A</th>
            <th className="p-0.5 border-r border-slate-400 text-center w-5">B</th>
            <th className="p-0.5 text-center w-6">BS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-300">
          {rows.map((row, i) => (
            <tr key={i} className="leading-snug bg-white text-slate-950">
              <td className="py-0.5 px-0.5 border-r border-slate-300 text-center font-bold">{row.panelNo}</td>
              <td className="py-0.5 px-0.5 border-r border-slate-300 whitespace-nowrap">{row.showTgl ? row.tglStr : ""}</td>
              <td className="py-0.5 px-0.5 border-r border-slate-300 text-center font-bold">{row.showGrp ? row.grpStr : ""}</td>
              <td className="py-0.5 px-0.5 border-r border-slate-300 font-semibold truncate max-w-[64px]">
                {row.isIstirahat
                  ? <span className="italic font-bold">Istirahat</span>
                  : (row.showOpr ? row.oprStr : "")}
              </td>
              {/* KET: empty for FINISH */}
              <td className="py-0.5 px-0.5 border-r border-slate-300 text-center font-bold">
                {row.isFinish ? "" : row.isGagal || row.hasDefect
                  ? <span>✕</span>
                  : row.isIstirahat
                    ? <span>-</span>
                    : <span>✓</span>}
              </td>
              {/* KETERANGAN CACAT: backup name for istirahat, FINISH label, or cacat text */}
              <td className="py-0.5 px-1 border-r border-slate-300 text-[6px] leading-tight break-words whitespace-pre-line">
                {row.isIstirahat && row.backupOpName
                  ? <span className="font-bold not-italic">{row.backupOpName}</span>
                  : row.cacatText
                }
              </td>
              <td className="py-0.5 px-0.5 border-r border-slate-300 text-center font-bold font-mono">{row.downtimeStr}</td>
              {/* Grade cols: empty for FINISH */}
              {row.isFinish
                ? <><td className="border-r border-slate-300"></td><td className="border-r border-slate-300"></td><td></td></>
                : <GradeCols grade={row.grade} />
              }
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Meter Table Render ───────────────────────────────────────────────────────

function MeterPrintTable({ rows }: { rows: any[] }) {
  const totalCols = 10;
  return (
    <div className="border border-slate-400 text-[7px]">
      <table className="w-full text-left border-collapse">
        <thead className="bg-white text-slate-950 font-bold uppercase tracking-wider border-b border-slate-400 text-[7.5px]">
          <tr>
            <th className="p-0.5 border-r border-slate-400 w-6 text-center">NO</th>
            <th className="p-0.5 border-r border-slate-400 w-14">TGL</th>
            <th className="p-0.5 border-r border-slate-400 text-center w-5">GRP</th>
            <th className="p-0.5 border-r border-slate-400 w-16">OPERATOR</th>
            <th className="p-0.5 border-r border-slate-400 text-center w-9">METER</th>
            <th className="p-0.5 border-r border-slate-400 text-center w-6">KET</th>
            <th className="p-0.5 border-r border-slate-400 whitespace-nowrap">KETERANGAN CACAT</th>
            <th className="p-0.5 border-r border-slate-400 text-center w-5">A</th>
            <th className="p-0.5 border-r border-slate-400 text-center w-5">B</th>
            <th className="p-0.5 text-center w-6">BS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-300">
          {rows.map((row, i) => {
            if (row.isTotalRow) return (
              <tr key={i} className="bg-white border-t border-b border-slate-400">
                <td colSpan={totalCols} className="px-2 py-0.5 text-center font-semibold text-slate-950">
                  {row.totalLabel} <span className="font-extrabold">{row.totalMeter}</span>
                </td>
              </tr>
            );
            if (row.isStartRow) return (
              <tr key={i} className="bg-white text-slate-950">
                <td className="py-0.5 px-0.5 border-r border-slate-300 text-center font-bold">{row.displayNo}</td>
                <td className="py-0.5 px-0.5 border-r border-slate-300">{row.tglStr}</td>
                <td className="py-0.5 px-0.5 border-r border-slate-300 text-center font-bold">{row.grpStr}</td>
                <td className="py-0.5 px-0.5 border-r border-slate-300 font-semibold truncate max-w-[64px]">{row.oprStr}</td>
                <td className="py-0.5 px-0.5 border-r border-slate-300 text-center font-bold">{row.meterDisplay}</td>
                <td className="py-0.5 px-0.5 border-r border-slate-300 text-center"></td>
                <td className="py-0.5 px-0.5 border-r border-slate-300 italic text-[6px]">START</td>
                <td className="py-0.5 border-r border-slate-300"></td>
                <td className="py-0.5 border-r border-slate-300"></td>
                <td className="py-0.5"></td>
              </tr>
            );
            const hasMeterDefect = !row.isFinish && row.cacatDisplay && row.cacatDisplay !== "-" && row.cacatDisplay !== "START" && row.cacatDisplay !== "FINISH";
            return (
              <tr key={i} className="leading-snug bg-white text-slate-950">
                <td className="py-0.5 px-0.5 border-r border-slate-300 text-center font-bold">{row.displayNo}</td>
                <td className="py-0.5 px-0.5 border-r border-slate-300 whitespace-nowrap">{row.showTgl ? row.tglStr : ""}</td>
                <td className="py-0.5 px-0.5 border-r border-slate-300 text-center font-medium">{row.grpStr}</td>
                <td className={`py-0.5 px-0.5 border-r border-slate-300 truncate max-w-[64px] ${row.hasIstirahat || row.isIstirahat ? "italic font-bold text-slate-600" : "font-medium text-slate-950"}`}>
                  {row.hasIstirahat || row.isIstirahat ? (
                    <span className="italic font-bold">Istirahat</span>
                  ) : (
                    row.showOpr ? row.oprStr : ""
                  )}
                </td>
                <td className="py-0.5 px-0.5 border-r border-slate-300 text-center font-bold">{row.meterDisplay}</td>
                {/* KET: empty for FINISH */}
                <td className="py-0.5 px-0.5 border-r border-slate-300 text-center font-bold">
                  {row.isFinish ? "" : (row.hasIstirahat || row.isIstirahat)
                    ? <span>-</span>
                    : hasMeterDefect
                      ? <span>✕</span>
                      : <span>✓</span>
                  }
                </td>
                {/* KETERANGAN CACAT */}
                <td className="py-0.5 px-1 border-r border-slate-300 text-[6px] leading-tight break-words whitespace-pre-line">
                  {row.hasIstirahat || row.isIstirahat ? (
                    (row.backupOpName && row.backupOpName.trim().toLowerCase() !== (row.oprStr || "").trim().toLowerCase())
                      ? <span className="font-bold not-italic">{row.backupOpName}</span>
                      : <span className="font-bold not-italic">{row.backupOpName || "ISTIRAHAT"}</span>
                  ) : (
                    row.cacatDisplay
                  )}
                </td>
                {/* Grade cols: empty for FINISH */}
                {row.isFinish
                  ? <><td className="border-r border-slate-300"></td><td className="border-r border-slate-300"></td><td></td></>
                  : <GradeCols grade={row.grade} />
                }
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PrintableProductionReport({ detailData, isOpen, onClose }: PrintableProductionReportProps) {
  const printDocRef = React.useRef<HTMLDivElement>(null);

  // Teleport the printable div directly into body before print,
  // and restore it afterward — this prevents modal wrapper from creating blank pages.
  React.useEffect(() => {
    if (!isOpen) return;
    const handleBefore = () => {
      const el = printDocRef.current;
      if (!el) return;
      const placeholder = document.createElement('div');
      placeholder.id = '__print-placeholder__';
      el.parentNode?.insertBefore(placeholder, el);
      document.body.appendChild(el);
    };
    const handleAfter = () => {
      const el = printDocRef.current;
      const placeholder = document.getElementById('__print-placeholder__');
      if (!el || !placeholder) return;
      placeholder.parentNode?.insertBefore(el, placeholder);
      placeholder.remove();
    };
    window.addEventListener('beforeprint', handleBefore);
    window.addEventListener('afterprint', handleAfter);
    return () => {
      window.removeEventListener('beforeprint', handleBefore);
      window.removeEventListener('afterprint', handleAfter);
    };
  }, [isOpen]);

  if (!isOpen || !detailData) return null;

  const currentTgl = new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const currentJam = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  const rawPanels = detailData.panels || [];
  const shiftName = rawPanels[0]?.groups?.nama_grup || "-";
  const isMeterMode = rawPanels.some((p: any) => p.panel_no === "METERAN");

  const calcTotalProduksi = () => {
    if (isMeterMode) {
      if (detailData.total_meter && detailData.total_meter > 0) {
        return `${detailData.total_meter} Meter`;
      }
      let maxMeter = 0;
      (rawPanels || []).forEach((p: any) => {
        const mA = parseFloat(cleanMeterVal(p.meter_akhir));
        const mW = parseFloat(cleanMeterVal(p.meter_awal));
        const mK = parseFloat(cleanMeterVal(p.meter_kain));
        if (!isNaN(mA)) maxMeter = Math.max(maxMeter, mA);
        if (!isNaN(mW)) maxMeter = Math.max(maxMeter, mW);
        if (!isNaN(mK)) maxMeter = Math.max(maxMeter, mK);
      });
      if (maxMeter > 0) return `${maxMeter} Meter`;
      return `${detailData.total_panels || 0} Meter`;
    }
    return `${detailData.total_panels || 0} Panel`;
  };
  const totalProduksiStr = calcTotalProduksi();

  const pcsGroups = groupByPcs(rawPanels);
  const sortedPcsKeys = Object.keys(pcsGroups).sort((a, b) => parseInt(a) - parseInt(b));

  // Determine if we need landscape: >2 PCS or panel count >30 per PCS
  const totalPanelCount = Object.values(pcsGroups).reduce((sum, arr) => sum + arr.length, 0);
  const needsLandscape = sortedPcsKeys.length > 2 || totalPanelCount > 60;

  return (
    <div className="print-root fixed inset-0 z-[200] flex justify-center items-start p-2 sm:p-4 bg-slate-900/80 backdrop-blur-md overflow-y-auto custom-scrollbar animate-fadeIn">
      {/* ── Floating Actions ── */}
      <div className="fixed top-4 right-4 z-[210] flex items-center gap-3 no-print">
        <div className="flex items-center gap-1.5 bg-white rounded-xl px-2.5 py-1.5 border border-slate-200 shadow text-[10px] font-bold text-slate-600">
          <span>Orientasi:</span>
          <span className="text-sky-600">{needsLandscape ? "LANDSCAPE" : "PORTRAIT"}</span>
          <span className="text-slate-400">({sortedPcsKeys.length} PCS)</span>
        </div>
        <button type="button" onClick={() => window.print()}
          className="h-10 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-extrabold text-xs tracking-wide shadow-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer">
          <Printer className="w-4 h-4" />
          <span>Cetak Dokumen A4 (PDF)</span>
        </button>
        <button type="button" onClick={onClose}
          className="h-10 w-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 shadow-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── A4 Document ── */}
      <div ref={printDocRef} className={`bg-white rounded-2xl shadow-2xl p-4 sm:p-6 my-4 sm:my-8 text-slate-950 border border-slate-200 printable-document relative text-[7.5px] ${needsLandscape ? "w-full max-w-[297mm]" : "w-full max-w-[210mm]"}`}>

        {/* Document Header */}
        <table className="w-full text-left border-collapse border-b-2 border-slate-950 mb-3">
          <tbody>
            <tr>
              <td className="py-0.5 pr-2.5 w-9 align-middle">
                <img src="/assets/dji-logo.png" alt="DJI Logo" className="w-7 h-7 object-contain shrink-0" />
              </td>
              <td className="py-0.5 align-middle">
                <div className="text-[11px] font-black text-slate-950 uppercase tracking-tight leading-none whitespace-nowrap">
                  PT. DENTELLE JAYA INFINITEX
                </div>
                <div className="text-[7.5px] font-bold text-slate-600 mt-0.5 uppercase tracking-wider whitespace-nowrap">
                  Laporan Hasil Produksi & Kendala Mesin Rajut
                </div>
              </td>
              <td className="py-0.5 align-middle text-right whitespace-nowrap">
                <div className="text-[7.5px] font-black text-slate-950 uppercase tracking-mono">
                  NO: LHP/{detailData.nomor_mc || "MC"}/{detailData.potongan_ke || "0"}/{new Date().getFullYear()}
                </div>
                <div className="text-[6.5px] font-semibold text-slate-600 mt-0.5">
                  {currentTgl} • {currentJam} WIB
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Metadata Header Table (Spesifikasi Produksi & Material Benang) ── */}
        <div className="border border-slate-400 text-[7.5px] mb-3 bg-white">
          <div className="grid grid-cols-2 divide-x divide-slate-400">
            {/* Left Column: SPESIFIKASI PRODUKSI */}
            <div className="p-1.5">
              <div className="font-bold text-slate-950 uppercase tracking-wider border-b border-slate-300 pb-0.5 mb-1 text-[8px]">
                SPESIFIKASI PRODUKSI
              </div>
              <div className="grid grid-cols-2 gap-x-2">
                <table className="w-full text-left border-collapse table-fixed">
                  <tbody>
                    <tr>
                      <td className="py-0.5 font-bold text-slate-600 w-22">NOMOR MESIN</td>
                      <td className="py-0.5 font-bold text-slate-950">: {detailData.nomor_mc || "-"}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold text-slate-600">DESIGN</td>
                      <td className="py-0.5 font-bold text-slate-950">: {detailData.design_id || "-"}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold text-slate-600">TGL PRODUKSI</td>
                      <td className="py-0.5 font-bold text-slate-950">: {formatFullDateTime((() => {
                        let oldest = detailData.tanggal_jam || detailData.created_at || detailData.tgl;
                        if (detailData.panels && Array.isArray(detailData.panels)) {
                          detailData.panels.forEach((p: any) => {
                            const ts = p.tanggal_jam || p.created_at || p.tgl;
                            if (ts && (!oldest || String(ts).localeCompare(String(oldest)) < 0)) {
                              oldest = ts;
                            }
                          });
                        }
                        return oldest || "-";
                      })())}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold text-slate-600">TGL POTONG</td>
                      <td className="py-0.5 font-bold text-slate-950">: {formatFullDateTime((() => {
                        let latest = detailData.waktu_input_terakhir || detailData.tanggal_jam || detailData.created_at || detailData.tgl || "";
                        if (detailData.panels && Array.isArray(detailData.panels)) {
                          detailData.panels.forEach((p: any) => {
                            const ts = p.tanggal_jam || p.created_at;
                            if (ts && (!latest || String(ts).localeCompare(String(latest)) > 0)) {
                              latest = ts;
                            }
                          });
                        }
                        return latest || detailData.tanggal_potong || "-";
                      })())}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold text-slate-600">NO. ORDER</td>
                      <td className="py-0.5 font-bold text-slate-950">: {detailData.no_order_barang || "-"}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold text-slate-600">NO. CUSTOMER</td>
                      <td className="py-0.5 font-bold text-slate-950">: {detailData.no_customer || "-"}</td>
                    </tr>
                  </tbody>
                </table>
                <table className="w-full text-left border-collapse table-fixed">
                  <tbody>
                    <tr>
                      <td className="py-0.5 font-bold text-slate-600 w-22">POTONGAN KE</td>
                      <td className="py-0.5 font-bold text-slate-950">: {detailData.potongan_ke || "-"}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold text-slate-600">PICK</td>
                      <td className="py-0.5 font-bold text-slate-950">: {detailData.pick || "-"}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold text-slate-600">COURSE</td>
                      <td className="py-0.5 font-bold text-slate-950">: {detailData.course || "-"}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold text-slate-600">RPM</td>
                      <td className="py-0.5 font-bold text-slate-950">: {detailData.rpm || "-"}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold text-slate-600">TOT. PRODUKSI</td>
                      <td className="py-0.5 font-bold text-slate-950">: {totalProduksiStr}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold text-slate-600">TOT. DOWNTIME</td>
                      <td className="py-0.5 font-bold text-slate-950">: {formatDurationNice(detailData.total_downtime_detik)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: MATERIAL BENANG */}
            <div className="p-1.5">
              <div className="font-bold text-slate-950 uppercase tracking-wider border-b border-slate-300 pb-0.5 mb-1 text-[8px]">
                MATERIAL BENANG
              </div>
              <table className="w-full text-left border-collapse table-fixed">
                <tbody>
                  <tr>
                    <td className="py-0.5 font-bold text-slate-600 w-28">JENIS BENANG DASAR</td>
                    <td className="py-0.5 font-bold text-slate-950">: {detailData.jenis_benang_dasar || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 font-bold text-slate-600">LINER</td>
                    <td className="py-0.5 font-bold text-slate-950 break-words">: {detailData.liner || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 font-bold text-slate-600">HEAVY</td>
                    <td className="py-0.5 font-bold text-slate-950 break-words">: {detailData.heavy || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 font-bold text-slate-600">SHADOW</td>
                    <td className="py-0.5 font-bold text-slate-950 break-words">: {detailData.shadow || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 font-bold text-slate-600">PINGGIRAN</td>
                    <td className="py-0.5 font-bold text-slate-950 break-words">: {detailData.pinggiran || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Per-PCS Tables — side by side for landscape */}
        <div className={`mb-4 ${needsLandscape ? "grid gap-3 items-start" : "flex flex-col gap-4"}`}
          style={needsLandscape ? { gridTemplateColumns: `repeat(${Math.min(sortedPcsKeys.length, 3)}, 1fr)` } : {}}>
          {sortedPcsKeys.map((pcsKey) => {
            const pcsPanels = pcsGroups[pcsKey].sort((a: any, b: any) => {
              if (a.panel_no === "METERAN" && b.panel_no === "METERAN") return String(a.tanggal_jam || "").localeCompare(String(b.tanggal_jam || ""));
              if (a.panel_no === "METERAN") return 1; if (b.panel_no === "METERAN") return -1;
              const pA = parseInt(a.panel_no || "0"); const pB = parseInt(b.panel_no || "0");
              if (pA === pB) return String(a.tanggal_jam || "").localeCompare(String(b.tanggal_jam || ""));
              return pA - pB;
            });
            const isMeterPcs = pcsPanels.some((p: any) => p.panel_no === "METERAN");
            const tableRows = isMeterPcs ? buildMeterRows(pcsPanels, shiftName) : buildPanelRows(pcsPanels, shiftName);

            // For portrait mode with panel, use 2-column split if >15 rows
            const useTwoCols = !isMeterPcs && !needsLandscape && tableRows.length > 15;
            const mid = useTwoCols ? Math.ceil(tableRows.length / 2) : tableRows.length;

            return (
              <div key={pcsKey}>
                <div className="bg-white px-3 py-1 border border-b-0 border-slate-400 text-center">
                  <span className="font-bold text-slate-950 text-[10px] tracking-wider uppercase">PCS {pcsKey}</span>
                  <span className="text-[7.5px] text-slate-500 ml-2">({isMeterPcs ? "Mode Meter" : `${tableRows.length} panel`})</span>
                </div>
                {useTwoCols ? (
                  <div className="grid grid-cols-2 gap-2">
                    <PanelPrintTable rows={tableRows.slice(0, mid)} />
                    <PanelPrintTable rows={tableRows.slice(mid)} />
                  </div>
                ) : isMeterPcs ? (
                  <MeterPrintTable rows={tableRows} />
                ) : (
                  <PanelPrintTable rows={tableRows} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Footer: Inspection & Mending Section ── */}
        <div className="mt-3 text-[7px]">

          {/* Row 1: Berat/Panel info | Grade table | Tanggal/Signature — outer table for stable widths */}
          <table className="w-full border-collapse" style={{tableLayout: "fixed"}}>
            <colgroup>
              <col style={{width: "42%"}} />
              <col style={{width: "38%"}} />
              <col style={{width: "20%"}} />
            </colgroup>
            <tbody>
              <tr>
                {/* Col 1: Berat Produksi fields */}
                <td className="align-top border border-slate-400 pr-0" style={{verticalAlign: "top", padding: 0}}>
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr className="border-b border-slate-300">
                        <td className="px-1.5 py-0.5 font-bold text-slate-700 whitespace-nowrap w-40">Berat Produksi</td>
                        <td className="px-1 py-0.5 text-slate-500 w-3">:</td>
                        <td className="px-1 py-0.5"></td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="px-1.5 py-0.5 font-bold text-slate-700 whitespace-nowrap">Total Panel Setelah di Inspecting</td>
                        <td className="px-1 py-0.5 text-slate-500">:</td>
                        <td className="px-1 py-0.5"></td>
                      </tr>
                      <tr>
                        <td className="px-1.5 py-0.5 font-bold text-slate-700 whitespace-nowrap">Berat Inspecting</td>
                        <td className="px-1 py-0.5 text-slate-500">:</td>
                        <td className="px-1 py-0.5"></td>
                      </tr>
                    </tbody>
                  </table>
                </td>

                {/* Col 2: Grade summary */}
                <td className="align-top" style={{verticalAlign: "top", padding: 0}}>
                  <table className="w-full border-collapse border border-slate-400" style={{tableLayout: "fixed"}}>
                    <colgroup>
                      <col style={{width: "50%"}} />
                      <col style={{width: "25%"}} />
                      <col style={{width: "25%"}} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-slate-400">
                        <th className="px-2 py-0.5 border-r border-slate-400 font-bold text-slate-700 text-left">KET</th>
                        <th className="px-2 py-0.5 border-r border-slate-400 font-bold text-slate-700 text-center">Produksi</th>
                        <th className="px-2 py-0.5 font-bold text-slate-700 text-center">Setelah Inspect</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-300">
                        <td className="px-2 py-1 border-r border-slate-400 font-semibold text-slate-700">Total Grade A</td>
                        <td className="px-2 py-1 border-r border-slate-400"></td>
                        <td className="px-2 py-1"></td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="px-2 py-1 border-r border-slate-400 font-semibold text-slate-700">Total Grade B</td>
                        <td className="px-2 py-1 border-r border-slate-400"></td>
                        <td className="px-2 py-1"></td>
                      </tr>
                      <tr>
                        <td className="px-2 py-1 border-r border-slate-400 font-semibold text-slate-700">BS</td>
                        <td className="px-2 py-1 border-r border-slate-400"></td>
                        <td className="px-2 py-1"></td>
                      </tr>
                    </tbody>
                  </table>
                </td>

                {/* Col 3: Tanggal + Petugas Inspect */}
                <td className="align-top border border-slate-400 text-center" style={{verticalAlign: "top", padding: "4px 8px"}}>
                  <div className="font-bold text-slate-700 whitespace-nowrap">Tanggal, .................. 202</div>
                  <div style={{height: "36px"}}></div>
                  <div className="font-bold text-slate-700">(Petugas Inspect)</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Row 2: Hasil Matching | Inspect & Mending fields — outer table for stable widths */}
          <table className="w-full border-collapse mt-3" style={{tableLayout: "fixed"}}>
            <colgroup>
              <col style={{width: "30%"}} />
              <col style={{width: "70%"}} />
            </colgroup>
            <tbody>
              <tr>
                {/* Col 1: Hasil Matching + TTD KA-Shift */}
                <td className="align-top border border-slate-400" style={{verticalAlign: "top", padding: 0}}>
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr className="border-b border-slate-400">
                        <td className="px-1.5 py-1 font-bold text-slate-700 whitespace-nowrap">Hasil Matching</td>
                        <td className="px-2 py-1 border-l border-slate-400"></td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="text-center py-3 px-2">
                    <div className="font-bold text-slate-700">TTD KA-Shift</div>
                    <div style={{height: "40px"}}></div>
                    <div className="text-slate-500">(........................)</div>
                  </div>
                </td>

                {/* Col 2: Inspect & Mending fields */}
                <td className="align-top border border-slate-400" style={{verticalAlign: "top", padding: 0}}>
                  <table className="w-full border-collapse" style={{tableLayout: "fixed"}}>
                    <colgroup>
                      <col style={{width: "30%"}} />
                      <col style={{width: "3%"}} />
                      <col style={{width: "67%"}} />
                    </colgroup>
                    <tbody>
                      <tr className="border-b border-slate-300">
                        <td className="px-1.5 py-0.5 font-bold text-slate-700 whitespace-nowrap">Start Inspect</td>
                        <td className="px-1 py-0.5 text-slate-500">:</td>
                        <td className="px-1 py-0.5"></td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="px-1.5 py-0.5 font-bold text-slate-700 whitespace-nowrap">Finish Inspect</td>
                        <td className="px-1 py-0.5 text-slate-500">:</td>
                        <td className="px-1 py-0.5"></td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="px-1.5 py-2" colSpan={3}></td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="px-1.5 py-0.5 font-bold text-slate-700 whitespace-nowrap">Tanggal Mending</td>
                        <td className="px-1 py-0.5 text-slate-500">:</td>
                        <td className="px-1 py-0.5"></td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="px-1.5 py-0.5 font-bold text-slate-700 whitespace-nowrap">Petugas Mending</td>
                        <td className="px-1 py-0.5 text-slate-500">:</td>
                        <td className="px-1 py-0.5"></td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="px-1.5 py-2" colSpan={3}></td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="px-1.5 py-0.5 font-bold text-slate-700 whitespace-nowrap">Start Mending</td>
                        <td className="px-1 py-0.5 text-slate-500">:</td>
                        <td className="px-1 py-0.5"></td>
                      </tr>
                      <tr>
                        <td className="px-1.5 py-0.5 font-bold text-slate-700 whitespace-nowrap">Finish Mending</td>
                        <td className="px-1 py-0.5 text-slate-500">:</td>
                        <td className="px-1 py-0.5"></td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

        </div>

      </div>

      <style jsx global>{`
        @page {
          size: ${needsLandscape ? "A4 landscape" : "A4 portrait"};
          margin: 6mm 8mm;
        }
        @media print {
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide everything. Before print, .printable-document is teleported
             to be a direct child of body, so it stays visible. */
          body > * {
            display: none !important;
          }
          body > .printable-document {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #fff !important;
            overflow: visible !important;
          }
          body > .printable-document * {
            visibility: visible !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}

