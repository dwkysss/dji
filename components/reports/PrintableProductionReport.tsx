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
      if (b) line += ` (Blok ${b.replace(/blok\s*/gi, "").trim()})`;
      if (line) lines.push(line);
    });
  } else {
    const k = item.kategori_masalah || ""; const d = item.detail_masalah || "";
    if (k && d) lines.push(`${k} - ${d}`); else if (k) lines.push(k); else if (d) lines.push(d);
  }
  return lines.length > 0 ? lines.join("; ") : "-";
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
    const hasIstirahatRaw = (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") || (item.kategori_masalah || "").toUpperCase().includes("ISTIRAHAT");
    let hasRealDefects = false;
    (item.production_defects || []).forEach((d: any) => { if (!((d.kategori || "").toUpperCase().includes("ISTIRAHAT"))) hasRealDefects = true; });
    if (!item.production_defects?.length && item.kategori_masalah && !item.kategori_masalah.toUpperCase().includes("ISTIRAHAT")) hasRealDefects = true;
    const isIstirahat = hasIstirahatRaw && !hasRealDefects;
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

    const hasIstirahatRaw = (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") || (item.kategori_masalah || "").toUpperCase().includes("ISTIRAHAT");
    let hasRealDefects = false;
    (item.production_defects || []).forEach((d: any) => { if (!((d.kategori || "").toUpperCase().includes("ISTIRAHAT"))) hasRealDefects = true; });
    if (!item.production_defects?.length && item.kategori_masalah && !item.kategori_masalah.toUpperCase().includes("ISTIRAHAT")) hasRealDefects = true;
    const hasIstirahat = hasIstirahatRaw && !hasRealDefects;
    const isIstirahat = hasIstirahat && !item.kategori_masalah && !item.detail_masalah;

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
    const showOpr = hasIstirahat ? true : opr !== prevOpr2;
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
  const tick = <span className="text-slate-900 font-black text-[9px]">✓</span>;
  return (
    <>
      <td className="py-0.5 px-0.5 border-r border-slate-200 text-center w-5">{grade === "A" ? tick : ""}</td>
      <td className="py-0.5 px-0.5 border-r border-slate-200 text-center w-5">{grade === "B" ? tick : ""}</td>
      <td className="py-0.5 px-0.5 border-r border-slate-200 text-center w-6">{grade === "BS" ? tick : ""}</td>
    </>
  );
}

function PanelPrintTable({ rows }: { rows: any[] }) {
  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden text-[8px]">
      <table className="w-full text-left border-collapse table-fixed">
        <thead className="bg-slate-900 text-white font-black uppercase tracking-wider">
          <tr>
            <th className="p-0.5 border-r border-slate-700 w-7 text-center">PNL</th>
            <th className="p-0.5 border-r border-slate-700 w-14">TGL</th>
            <th className="p-0.5 border-r border-slate-700 text-center w-5">GRP</th>
            <th className="p-0.5 border-r border-slate-700 w-16">OPERATOR</th>
            <th className="p-0.5 border-r border-slate-700 text-center w-6">KET</th>
            <th className="p-0.5 border-r border-slate-700">KETERANGAN CACAT</th>
            <th className="p-0.5 border-r border-slate-700 text-center w-8">DT</th>
            <th className="p-0.5 border-r border-slate-700 text-center w-5 bg-emerald-900">A</th>
            <th className="p-0.5 border-r border-slate-700 text-center w-5 bg-sky-900">B</th>
            <th className="p-0.5 text-center w-6 bg-rose-900">BS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row, i) => (
            <tr key={i} className={`leading-snug ${
              row.isIstirahat ? "bg-amber-50 text-amber-950"
              : row.isFinish ? "bg-slate-100 text-slate-500 italic"
              : i % 2 === 1 ? "bg-slate-50/60" : ""
            }`}>
              <td className="py-0.5 px-0.5 border-r border-slate-200 text-center font-bold">{row.panelNo}</td>
              <td className="py-0.5 px-0.5 border-r border-slate-200 text-slate-600 whitespace-nowrap">{row.showTgl ? row.tglStr : ""}</td>
              <td className="py-0.5 px-0.5 border-r border-slate-200 text-center font-bold">{row.showGrp ? row.grpStr : ""}</td>
              <td className="py-0.5 px-0.5 border-r border-slate-200 font-semibold truncate max-w-[64px]">
                {row.isIstirahat
                  ? <span className="text-amber-700 italic font-bold">Istirahat</span>
                  : (row.showOpr ? row.oprStr : "")}
              </td>
              {/* KET: empty for FINISH */}
              <td className="py-0.5 px-0.5 border-r border-slate-200 text-center font-black">
                {row.isFinish ? "" : row.isGagal || row.hasDefect
                  ? <span className="text-rose-600">✕</span>
                  : row.isIstirahat
                    ? <span className="text-amber-500">-</span>
                    : <span className="text-emerald-600">✓</span>}
              </td>
              {/* KETERANGAN CACAT: backup name for istirahat, FINISH label, or cacat text */}
              <td className="py-0.5 px-1 border-r border-slate-200 text-slate-700 max-w-[100px]">
                {row.isIstirahat && row.backupOpName
                  ? <span className="text-amber-800 font-bold not-italic">{row.backupOpName}</span>
                  : <span className="truncate block" title={row.cacatText}>{row.cacatText}</span>
                }
              </td>
              <td className="py-0.5 px-0.5 border-r border-slate-200 text-center font-bold text-amber-700 font-mono">{row.downtimeStr}</td>
              {/* Grade cols: empty for FINISH */}
              {row.isFinish
                ? <><td className="border-r border-slate-200"></td><td className="border-r border-slate-200"></td><td></td></>
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
    <div className="border border-slate-300 rounded-lg overflow-hidden text-[8px]">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-900 text-white font-black uppercase tracking-wider">
          <tr>
            <th className="p-0.5 border-r border-slate-700 w-6 text-center">NO</th>
            <th className="p-0.5 border-r border-slate-700 w-14">TGL</th>
            <th className="p-0.5 border-r border-slate-700 text-center w-5">GRP</th>
            <th className="p-0.5 border-r border-slate-700 w-16">OPERATOR</th>
            <th className="p-0.5 border-r border-slate-700 text-center w-9">METER</th>
            <th className="p-0.5 border-r border-slate-700 text-center w-6">KET</th>
            <th className="p-0.5 border-r border-slate-700">KETERANGAN CACAT</th>
            <th className="p-0.5 border-r border-slate-700 text-center w-5 bg-emerald-900">A</th>
            <th className="p-0.5 border-r border-slate-700 text-center w-5 bg-sky-900">B</th>
            <th className="p-0.5 text-center w-6 bg-rose-900">BS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row, i) => {
            if (row.isTotalRow) return (
              <tr key={i} className="bg-slate-100 border-t border-b border-slate-300">
                <td colSpan={totalCols} className="px-2 py-0.5 text-center font-semibold text-slate-600">
                  {row.totalLabel} <span className="font-extrabold text-slate-900">{row.totalMeter}</span>
                </td>
              </tr>
            );
            if (row.isStartRow) return (
              <tr key={i} className="bg-sky-50/60">
                <td className="py-0.5 px-0.5 border-r border-slate-200 text-center font-bold">{row.displayNo}</td>
                <td className="py-0.5 px-0.5 border-r border-slate-200">{row.tglStr}</td>
                <td className="py-0.5 px-0.5 border-r border-slate-200 text-center font-bold">{row.grpStr}</td>
                <td className="py-0.5 px-0.5 border-r border-slate-200 font-semibold truncate max-w-[64px]">{row.oprStr}</td>
                <td className="py-0.5 px-0.5 border-r border-slate-200 text-center font-bold text-sky-700">{row.meterDisplay}</td>
                <td className="py-0.5 px-0.5 border-r border-slate-200 text-center"></td>
                <td className="py-0.5 px-0.5 border-r border-slate-200 text-slate-400 italic">START</td>
                <td className="py-0.5 border-r border-slate-200"></td>
                <td className="py-0.5 border-r border-slate-200"></td>
                <td className="py-0.5"></td>
              </tr>
            );
            const hasMeterDefect = !row.isFinish && row.cacatDisplay && row.cacatDisplay !== "-" && row.cacatDisplay !== "START" && row.cacatDisplay !== "FINISH";
            return (
              <tr key={i} className={`leading-snug ${
                row.hasIstirahat ? "bg-amber-50 text-amber-950"
                : row.isFinish ? "bg-slate-100 text-slate-500 italic"
                : i % 2 === 1 ? "bg-slate-50/60" : ""
              }`}>
                <td className="py-0.5 px-0.5 border-r border-slate-200 text-center font-bold">{row.displayNo}</td>
                <td className="py-0.5 px-0.5 border-r border-slate-200 whitespace-nowrap">{row.showTgl ? row.tglStr : ""}</td>
                <td className="py-0.5 px-0.5 border-r border-slate-200 text-center font-medium text-slate-700">{row.grpStr}</td>
                <td className={`py-0.5 px-0.5 border-r border-slate-200 truncate max-w-[64px] ${row.hasIstirahat ? "italic font-bold text-amber-700" : "font-medium text-slate-700"}`}>
                  {row.hasIstirahat ? "Istirahat" : (row.showOpr ? row.oprStr : "")}
                </td>
                <td className="py-0.5 px-0.5 border-r border-slate-200 text-center font-bold text-sky-700">{row.meterDisplay}</td>
                {/* KET: empty for FINISH */}
                <td className="py-0.5 px-0.5 border-r border-slate-200 text-center font-black">
                  {row.isFinish ? "" : row.hasIstirahat
                    ? <span className="text-amber-500">-</span>
                    : hasMeterDefect
                      ? <span className="text-rose-600">✕</span>
                      : <span className="text-emerald-600">✓</span>
                  }
                </td>
                {/* KETERANGAN CACAT */}
                <td className="py-0.5 px-1 border-r border-slate-200 text-slate-700 max-w-[100px]">
                  {row.hasIstirahat && row.backupOpName
                    ? <span className="text-amber-800 font-bold not-italic">{row.backupOpName}</span>
                    : <span className="truncate block" title={row.cacatDisplay}>{row.cacatDisplay}</span>
                  }
                </td>
                {/* Grade cols: empty for FINISH */}
                {row.isFinish
                  ? <><td className="border-r border-slate-200"></td><td className="border-r border-slate-200"></td><td></td></>
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
  if (!isOpen || !detailData) return null;

  const currentTgl = new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const currentJam = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  const rawPanels = detailData.panels || [];
  const shiftName = rawPanels[0]?.groups?.nama_grup || "-";
  const isMeterMode = rawPanels.some((p: any) => p.panel_no === "METERAN");

  const pcsGroups = groupByPcs(rawPanels);
  const sortedPcsKeys = Object.keys(pcsGroups).sort((a, b) => parseInt(a) - parseInt(b));

  // Determine if we need landscape: >2 PCS or panel count >30 per PCS
  const totalPanelCount = Object.values(pcsGroups).reduce((sum, arr) => sum + arr.length, 0);
  const needsLandscape = sortedPcsKeys.length > 2 || totalPanelCount > 60;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-md overflow-y-auto custom-scrollbar animate-fadeIn">
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
      <div className={`bg-white rounded-2xl shadow-2xl p-4 sm:p-6 my-8 text-slate-900 border border-slate-200 printable-document relative overflow-hidden text-xs ${needsLandscape ? "w-full max-w-[297mm]" : "w-full max-w-[210mm]"}`}>

        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-3 mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-xs overflow-hidden p-1">
              <img src="/assets/dji-logo.png" alt="DJI Logo" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-950 uppercase tracking-tight leading-none">PT. DENTELLE JAYA INFINITEX</h1>
              <p className="text-[9px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">Laporan Hasil Produksi & Kendala Mesin Rajut</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">DOKUMEN PABRIK</span>
            <span className="text-[10px] font-extrabold text-slate-800 font-mono">NO: LHP/{detailData.nomor_mc || "MC"}/{detailData.potongan_ke || "0"}/{new Date().getFullYear()}</span>
            <p className="text-[8px] font-semibold text-slate-500">{currentTgl} • {currentJam} WIB</p>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-4 gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200 mb-2">
          <div><span className="text-[7px] font-black text-slate-400 uppercase block">MESIN</span><span className="font-black text-slate-900 text-[10px]">{detailData.nomor_mc || "-"}</span></div>
          <div><span className="text-[7px] font-black text-slate-400 uppercase block">SHIFT</span><span className="font-black text-slate-900 text-[10px]">SHIFT {shiftName}</span></div>
          <div><span className="text-[7px] font-black text-slate-400 uppercase block">DESAIN</span><span className="font-black text-slate-900 text-[10px] truncate block">{detailData.design_id || "-"}</span></div>
          <div><span className="text-[7px] font-black text-slate-400 uppercase block">POTONGAN</span><span className="font-black text-slate-900 text-[10px]">#{detailData.potongan_ke || "-"}</span></div>
          <div className="col-span-2"><span className="text-[7px] font-black text-slate-400 uppercase block">OPERATOR</span><span className="font-bold text-slate-800 truncate block text-[10px]">{detailData.operators_list || "-"}</span></div>
          <div><span className="text-[7px] font-black text-slate-400 uppercase block">NO CUSTOMER</span><span className="font-bold text-slate-800 truncate block text-[10px]">{detailData.no_customer || "-"}</span></div>
          <div><span className="text-[7px] font-black text-slate-400 uppercase block">NO ORDER</span><span className="font-bold text-slate-800 truncate block text-[10px]">{detailData.no_order_barang || "-"}</span></div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          <div className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg"><span className="text-[7px] font-black text-slate-400 uppercase block">SETTING MESIN</span><span className="font-bold text-slate-800 text-[9px]">{detailData.course || detailData.pick || "-"} C / {detailData.rpm || "-"} RPM</span></div>
          <div className="bg-emerald-50 border border-emerald-200 p-1.5 rounded-lg"><span className="text-[7px] font-black text-emerald-800 uppercase block">TOTAL PRODUKSI</span><span className="font-black text-emerald-950 text-[10px]">{detailData.total_panels} {isMeterMode ? "Meter" : "Panel"}</span></div>
          <div className="bg-amber-50 border border-amber-200 p-1.5 rounded-lg"><span className="text-[7px] font-black text-amber-800 uppercase block">TOTAL DOWNTIME</span><span className="font-black text-amber-950 text-[10px]">{formatDurationNice(detailData.total_downtime_detik)}</span></div>
          <div className="bg-sky-50 border border-sky-200 p-1.5 rounded-lg"><span className="text-[7px] font-black text-sky-800 uppercase block">BENANG DASAR</span><span className="font-bold text-sky-950 text-[9px] truncate block">{detailData.jenis_benang_dasar || "-"}</span></div>
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
                <div className="bg-slate-100 px-3 py-1.5 rounded-t-lg border border-b-0 border-slate-300 text-center">
                  <span className="font-black text-slate-800 text-xs tracking-wider uppercase">PCS {pcsKey}</span>
                  <span className="text-[8px] text-slate-500 ml-2">({isMeterPcs ? "Mode Meter" : `${tableRows.length} panel`})</span>
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

        {/* Signatures */}
        <div className="pt-3 border-t-2 border-slate-300 grid grid-cols-3 gap-4 text-center">
          {["OPERATOR MESIN", "INSPECTOR QC", "SUPERVISOR PRODUKSI"].map((label, i) => (
            <div key={i}>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-8">{label}</p>
              <div className="border-b border-slate-400 w-2/3 mx-auto mb-0.5"></div>
              <p className="font-bold text-slate-900 text-[9px]">
                {i === 0 ? (detailData.operators_list?.split(",")[0] || "( .................... )") : "( .................... )"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @page { size: ${needsLandscape ? "A4 landscape" : "A4 portrait"}; margin: 6mm 8mm; }
        @media print {
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden !important; }
          .printable-document, .printable-document * { visibility: visible !important; }
          .printable-document {
            position: absolute !important; left: 0 !important; top: 0 !important;
            width: 100% !important; max-width: 100% !important;
            padding: 0 !important; margin: 0 !important;
            box-shadow: none !important; border: none !important; background: #fff !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
