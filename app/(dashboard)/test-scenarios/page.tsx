"use client";

import React, { useState } from "react";
import PanelHistoryTable from "@/app/(employee)/history/detail/components/PanelHistoryTable";
import MeterHistoryTable from "@/app/(employee)/history/detail/components/MeterHistoryTable";
import PanelQCTable from "@/app/qc/components/PanelQCTable";
import MeterQCTable from "@/app/qc/components/MeterQCTable";
import PanelMendingTable from "@/app/mending/components/PanelMendingTable";
import MeterMendingTable from "@/app/mending/components/MeterMendingTable";
import QCEditDetailModal from "@/components/forms/QCEditDetailModal";
import { calculateOverallGradeData, isBsAwalAkhir } from "@/lib/mending-grade-utils";
import {
  FlaskConical,
  CheckCircle2,
  XCircle,
  Layers,
  Sparkles,
  Info,
  ShieldCheck,
  Filter,
  Eye,
  Sliders,
  CheckCheck,
  ClipboardCheck,
  Scissors,
  History,
  FileCheck2,
  Calculator,
  HelpCircle,
  RotateCcw,
  Sparkle,
  FileSpreadsheet,
  Award,
} from "lucide-react";

// ============================================================================
// MOCK DATASETS GENERATOR FOR ALL EDGE CASES
// ============================================================================

const createHeader = (id: string, overrides: any = {}) => ({
  id,
  mc: "R1",
  potongan: "396",
  design: "TLD 7676 N",
  tgl: "2026-08-21",
  tanggal_jam: "2026-08-21T08:00:00Z",
  created_at: "2026-08-21T08:00:00Z",
  operators: { nama_operator: "Rina R" },
  groups: { nama_grup: "C" },
  pic: "Rina R",
  panel_no: "1",
  ...overrides,
});

// 1. Skenario 1: Normal 100% (Semua lancar)
const mockScenarioNormal = [
  {
    ...createHeader("h1", { panel_no: "1", tanggal_jam: "2026-08-21T08:00:00Z" }),
    production_details: [
      { id: "d1", pcs_index: 1, jml_hasil_produksi: 1, keterangan_cacat: null, kategori_masalah: null, detail_masalah: null },
    ],
  },
  {
    ...createHeader("h2", { panel_no: "2", tanggal_jam: "2026-08-21T08:08:00Z" }),
    production_details: [
      { id: "d2", pcs_index: 1, jml_hasil_produksi: 1, keterangan_cacat: null, kategori_masalah: null, detail_masalah: null },
    ],
  },
  {
    ...createHeader("h3", { panel_no: "3", tanggal_jam: "2026-08-21T08:15:00Z" }),
    production_details: [
      { id: "d3", pcs_index: 1, jml_hasil_produksi: 1, keterangan_cacat: null, kategori_masalah: null, detail_masalah: null },
    ],
  },
  {
    ...createHeader("h4", { panel_no: "4", tanggal_jam: "2026-08-21T08:22:00Z" }),
    production_details: [
      { id: "d4", pcs_index: 1, jml_hasil_produksi: 1, keterangan_cacat: null, kategori_masalah: null, detail_masalah: null },
    ],
  },
];

// 2. Skenario 2: BS AWAL & BS AKHIR
const mockScenarioBsAwalAkhir = [
  {
    ...createHeader("h-bs-awal", { panel_no: "BS AWAL", tanggal_jam: "2026-08-21T08:00:00Z" }),
    production_details: [
      { id: "d-bs-1", pcs_index: 1, jml_hasil_produksi: 0, status_inspeksi: "BS", keterangan_cacat: "Sisa Awal Potongan", kategori_masalah: "X" },
    ],
  },
  {
    ...createHeader("h-1", { panel_no: "1", tanggal_jam: "2026-08-21T08:05:00Z" }),
    production_details: [
      { id: "d-1", pcs_index: 1, jml_hasil_produksi: 1, keterangan_cacat: null },
    ],
  },
  {
    ...createHeader("h-2", { panel_no: "2", tanggal_jam: "2026-08-21T08:12:00Z" }),
    production_details: [
      { id: "d-2", pcs_index: 1, jml_hasil_produksi: 1, keterangan_cacat: null },
    ],
  },
  {
    ...createHeader("h-bs-akhir", { panel_no: "BS AKHIR", tanggal_jam: "2026-08-21T08:20:00Z" }),
    production_details: [
      { id: "d-bs-2", pcs_index: 1, jml_hasil_produksi: 0, status_inspeksi: "BS", keterangan_cacat: "Sisa Akhir Potongan", kategori_masalah: "X" },
    ],
  },
];

// 3. Skenario 3: Pergantian Operator / Shift (Multi-Operator)
const mockScenarioMultiOperator = [
  {
    ...createHeader("h-op1-1", { panel_no: "1", tanggal_jam: "2026-08-21T08:00:00Z", operators: { nama_operator: "Rina R" }, groups: { nama_grup: "C" } }),
    production_details: [{ id: "d-op1-1", pcs_index: 1, jml_hasil_produksi: 1 }],
  },
  {
    ...createHeader("h-op1-2", { panel_no: "2", tanggal_jam: "2026-08-21T08:08:00Z", operators: { nama_operator: "Rina R" }, groups: { nama_grup: "C" } }),
    production_details: [{ id: "d-op1-2", pcs_index: 1, jml_hasil_produksi: 1 }],
  },
  {
    ...createHeader("h-op2-1", { panel_no: "3", tanggal_jam: "2026-08-21T15:30:00Z", operators: { nama_operator: "Rissa A" }, groups: { nama_grup: "A" } }),
    production_details: [{ id: "d-op2-1", pcs_index: 1, jml_hasil_produksi: 1 }],
  },
  {
    ...createHeader("h-op2-2", { panel_no: "4", tanggal_jam: "2026-08-21T15:38:00Z", operators: { nama_operator: "Rissa A" }, groups: { nama_grup: "A" } }),
    production_details: [{ id: "d-op2-2", pcs_index: 1, jml_hasil_produksi: 1 }],
  },
  {
    ...createHeader("h-op3-1", { panel_no: "5", tanggal_jam: "2026-08-22T00:15:00Z", tgl: "2026-08-22", operators: { nama_operator: "Budi S" }, groups: { nama_grup: "B" } }),
    production_details: [{ id: "d-op3-1", pcs_index: 1, jml_hasil_produksi: 1 }],
  },
];

// 4. Skenario 4: Istirahat di Tengah Potongan + Operator Backup
const mockScenarioIstirahat = [
  {
    ...createHeader("h-ist-1", { panel_no: "1", tanggal_jam: "2026-08-21T08:00:00Z" }),
    production_details: [{ id: "d-ist-1", pcs_index: 1, jml_hasil_produksi: 1 }],
  },
  {
    ...createHeader("h-ist-2", { 
      panel_no: "2", 
      tanggal_jam: "2026-08-21T08:10:00Z",
      operator_backup: "Siti Nurhaliza"
    }),
    production_details: [{ 
      id: "d-ist-2", 
      pcs_index: 1, 
      jml_hasil_produksi: 1, 
      keterangan_cacat: "[LAPORAN ISTIRAHAT] (Backup: Siti Nurhaliza)" 
    }],
  },
  {
    ...createHeader("h-ist-3", { 
      panel_no: "3", 
      tanggal_jam: "2026-08-21T08:20:00Z",
      operator_backup: "Siti Nurhaliza"
    }),
    production_details: [{ 
      id: "d-ist-3", 
      pcs_index: 1, 
      jml_hasil_produksi: 1, 
      keterangan_cacat: "[LAPORAN ISTIRAHAT] (Backup: Siti Nurhaliza)",
      kategori_masalah: "K",
      detail_masalah: "L1 Putus",
      production_defects: [
        { kategori: "K", detail: "L1 Putus", blok: "15" }
      ]
    }],
  },
  {
    ...createHeader("h-ist-4", { panel_no: "4", tanggal_jam: "2026-08-21T08:30:00Z" }),
    production_details: [{ id: "d-ist-4", pcs_index: 1, jml_hasil_produksi: 1 }],
  },
];

// 5. Skenario: Istirahat di Baris Pertama (Panel 1 Langsung Berlabel Istirahat)
const mockScenarioIstirahatBarisPertama = [
  {
    ...createHeader("h-ist-first-1", { 
      panel_no: "1", 
      tanggal_jam: "2026-08-21T08:00:00Z",
      operators: { nama_operator: "Rina R" },
      groups: { nama_grup: "C" },
      operator_backup: "Dewi Lestari"
    }),
    production_details: [{ 
      id: "d-ist-first-1", 
      pcs_index: 1, 
      jml_hasil_produksi: 1, 
      keterangan_cacat: "[LAPORAN ISTIRAHAT] (Backup: Dewi Lestari)" 
    }],
  },
  {
    ...createHeader("h-ist-first-2", { 
      panel_no: "2", 
      tanggal_jam: "2026-08-21T08:10:00Z",
      operators: { nama_operator: "Rina R" },
      groups: { nama_grup: "C" },
      operator_backup: "Dewi Lestari"
    }),
    production_details: [{ 
      id: "d-ist-first-2", 
      pcs_index: 1, 
      jml_hasil_produksi: 1, 
      keterangan_cacat: "[LAPORAN ISTIRAHAT] (Backup: Dewi Lestari)" 
    }],
  },
  {
    ...createHeader("h-ist-first-3", { 
      panel_no: "3", 
      tanggal_jam: "2026-08-21T08:20:00Z",
      operators: { nama_operator: "Rina R" },
      groups: { nama_grup: "C" }
    }),
    production_details: [{ 
      id: "d-ist-first-3", 
      pcs_index: 1, 
      jml_hasil_produksi: 1 
    }],
  },
  {
    ...createHeader("h-ist-first-4", { 
      panel_no: "4", 
      tanggal_jam: "2026-08-21T08:30:00Z",
      operators: { nama_operator: "Rina R" },
      groups: { nama_grup: "C" }
    }),
    production_details: [{ 
      id: "d-ist-first-4", 
      pcs_index: 1, 
      jml_hasil_produksi: 1 
    }],
  },
];

// 6. Skenario: Gagal Cacat (False Alarm)
const mockScenarioGagalCacat = [
  {
    ...createHeader("h-gc-1", { panel_no: "1", tanggal_jam: "2026-08-21T08:00:00Z" }),
    production_details: [{ 
      id: "d-gc-1", 
      pcs_index: 1, 
      jml_hasil_produksi: 1, 
      kategori_masalah: "G", 
      detail_masalah: "Gagal Cacat",
      production_defects: [{ kategori: "G", detail: "Gagal Cacat" }]
    }],
  },
  {
    ...createHeader("h-gc-2", { panel_no: "2", tanggal_jam: "2026-08-21T08:10:00Z" }),
    production_details: [{ id: "d-gc-2", pcs_index: 1, jml_hasil_produksi: 1 }],
  },
  {
    ...createHeader("h-gc-3", { panel_no: "3", tanggal_jam: "2026-08-21T08:20:00Z" }),
    production_details: [{ 
      id: "d-gc-3", 
      pcs_index: 1, 
      jml_hasil_produksi: 1, 
      production_defects: [
        { kategori: "L", detail: "Benang Lolos", blok: "28" },
        { kategori: "G", detail: "Gagal Cacat" }
      ]
    }],
  },
];

// 7. Skenario: Multi-Defect & Multi-Blok
const mockScenarioMultiDefect = [
  {
    ...createHeader("h-md-1", { panel_no: "1", tanggal_jam: "2026-08-21T08:00:00Z" }),
    production_details: [{ 
      id: "d-md-1", 
      pcs_index: 1, 
      jml_hasil_produksi: 1, 
      production_defects: [
        { kategori: "N", detail: "Ngegaris/Stopline", blok: "40" },
        { kategori: "B", detail: "Benang Nyilang", blok: "" },
        { kategori: "K", detail: "L1 Putus", blok: "15, 22" }
      ]
    }],
  },
  {
    ...createHeader("h-md-2", { panel_no: "2", tanggal_jam: "2026-08-21T08:15:00Z" }),
    production_details: [{ 
      id: "d-md-2", 
      pcs_index: 1, 
      jml_hasil_produksi: 1, 
      keterangan_qc: "Toleransi grade B, serat halus",
      production_defects: [
        { kategori: "P", detail: "Perbaikan Bolong-bolong", blok: "12" }
      ]
    }],
  },
];

// 8. Skenario: Panel Dihapus (Soft Delete) & BS Individual
const mockScenarioDeletedAndBs = [
  {
    ...createHeader("h-del-1", { panel_no: "1", tanggal_jam: "2026-08-21T08:00:00Z" }),
    production_details: [{ id: "d-del-1", pcs_index: 1, jml_hasil_produksi: 1 }],
  },
  {
    ...createHeader("h-del-2", { panel_no: "2", tanggal_jam: "2026-08-21T08:10:00Z" }),
    production_details: [{ 
      id: "d-del-2", 
      pcs_index: 1, 
      jml_hasil_produksi: 1, 
      is_deleted: true, 
      keterangan_cacat: "[DIHAPUS] Salah input nomor panel" 
    }],
  },
  {
    ...createHeader("h-del-3", { panel_no: "3", tanggal_jam: "2026-08-21T08:20:00Z" }),
    production_details: [{ 
      id: "d-del-3", 
      pcs_index: 1, 
      jml_hasil_produksi: 0, 
      status_inspeksi: "BS", 
      kategori_masalah: "K", 
      detail_masalah: "Kain Sobek Parah" 
    }],
  },
  {
    ...createHeader("h-del-4", { panel_no: "4", tanggal_jam: "2026-08-21T08:30:00Z" }),
    production_details: [{ id: "d-del-4", pcs_index: 1, jml_hasil_produksi: 1 }],
  },
];

// 9. Skenario 9: Tambah Panel & Catatan Khusus QC (Highlight Biru Satu Baris)
const mockScenarioTambahanQc = [
  {
    ...createHeader("h-tqc-1", { panel_no: "1", tanggal_jam: "2026-08-21T08:00:00Z" }),
    production_details: [{ id: "d-tqc-1", pcs_index: 1, jml_hasil_produksi: 1 }],
  },
  {
    ...createHeader("h-tqc-2", { panel_no: "2", tanggal_jam: "2026-08-21T08:10:00Z" }),
    production_details: [{ 
      id: "d-tqc-2", 
      pcs_index: 1, 
      jml_hasil_produksi: 1, 
      production_defects: [{ kategori: "N", detail: "Ngegaris", blok: "12" }] 
    }],
  },
  {
    ...createHeader("h-tqc-3", { panel_no: "3", tanggal_jam: "2026-08-21T08:20:00Z" }),
    production_details: [{ 
      id: "d-tqc-3", 
      pcs_index: 1, 
      jml_hasil_produksi: 1, 
      keterangan_cacat: "[TAMBAHAN QC]",
      keterangan_qc: "Panel susulan setelah cek fisik ulang",
      production_defects: [{ kategori: "K", detail: "L1 Putus [TAMBAHAN QC]", blok: "30" }]
    }],
  },
  {
    ...createHeader("h-tqc-4", { panel_no: "4", tanggal_jam: "2026-08-21T08:30:00Z" }),
    production_details: [{ 
      id: "d-tqc-4", 
      pcs_index: 1, 
      jml_hasil_produksi: 1, 
      keterangan_qc: "Toleransi grade B, serat agak tipis",
    }],
  },
  {
    ...createHeader("h-tqc-5", { panel_no: "5", tanggal_jam: "2026-08-21T08:40:00Z" }),
    production_details: [{ 
      id: "d-tqc-5", 
      pcs_index: 1, 
      jml_hasil_produksi: 1, 
      keterangan_cacat: "[TAMBAHAN MENDING]",
      production_defects: [{ kategori: "M", detail: "Mending susulan", blok: "08" }]
    }],
  },
];

// Skenario Meteran (Roll Input Type)
const mockScenarioMeter = [
  {
    ...createHeader("m-start", { panel_no: "METERAN", meter_awal: "0", tanggal_jam: "2026-08-21T08:00:00Z" }),
    production_details: [{ id: "md-start", meter_kain: "0", keterangan_cacat: "START" }],
  },
  {
    ...createHeader("m-1", { panel_no: "METERAN", meter_kain: "45", tanggal_jam: "2026-08-21T08:30:00Z" }),
    production_details: [{ 
      id: "md-1", 
      meter_kain: "45", 
      production_defects: [{ kategori: "K", detail: "L1 Putus", meter: "45", blok: "10" }] 
    }],
  },
  {
    ...createHeader("m-2", { panel_no: "METERAN", meter_kain: "80", tanggal_jam: "2026-08-21T09:15:00Z" }),
    production_details: [{ 
      id: "md-2", 
      meter_kain: "80", 
      production_defects: [{ kategori: "G", detail: "Gagal Cacat", meter: "80" }] 
    }],
  },
  {
    ...createHeader("m-op2", { 
      panel_no: "METERAN", 
      meter_kain: "150", 
      tanggal_jam: "2026-08-21T15:30:00Z", 
      operators: { nama_operator: "Rissa A" }, 
      groups: { nama_grup: "A" } 
    }),
    production_details: [{ id: "md-3", meter_kain: "150" }],
  },
  {
    ...createHeader("m-finish", { 
      panel_no: "METERAN", 
      meter_akhir: "220", 
      tanggal_jam: "2026-08-21T16:00:00Z", 
      operators: { nama_operator: "Rissa A" }, 
      groups: { nama_grup: "A" } 
    }),
    production_details: [{ id: "md-finish", meter_kain: "220", keterangan_cacat: "FINISH" }],
  },
];

// Helper to flatten panels into detailsToDisplay for QC and Mending components
const formatDetailsForQc = (panels: any[]) => {
  return panels.flatMap((p: any) => {
    const dets = p.production_details || [];
    if (dets.length === 0) {
      return [{ ...p, id: p.id, production_headers: p }];
    }
    return dets.map((d: any) => ({
      ...d,
      id: d.id || `${p.id}-${d.pcs_index}`,
      production_headers: p,
    }));
  });
};

// Default Auto-Grade generator for QC Inspection
const generateDefaultQcSelections = (panels: any[]) => {
  const map: Record<string, number> = {};
  panels.forEach((p: any) => {
    const rawNo = String(p.panel_no || "").toUpperCase();
    const isBsAwalAkhir = rawNo.includes("AWAL") || rawNo.includes("AKHIR");
    const dets = p.production_details || [];
    dets.forEach((d: any) => {
      const id = d.id || `${p.id}-${d.pcs_index}`;
      if (d.is_deleted) return;
      const isBs = d.jml_hasil_produksi === 0 || d.status_inspeksi === "BS" || isBsAwalAkhir;
      if (isBs) {
        map[id] = 4; // BS
      } else {
        // Default ketika masuk inspeksi QC adalah semua ceklis (✓), termasuk jika ada cacat
        map[id] = 1;
      }
    });
  });
  return map;
};

// Formatter for Mending Table display items matching real app/mending/page.tsx
const formatDetailsForMending = (panels: any[], selections: Record<string, string>) => {
  const details = formatDetailsForQc(panels);

  const processed = details.map((item) => {
    const h = item.production_headers || {};
    const opr = h.operators?.nama_operator || h.pic || "";
    const grp = h.groups?.nama_grup || "";
    const tgl = h.tgl || "";
    const operatorStr = (grp ? `(${grp}) ` : '') + opr;

    let extractedBackupOp = h.operator_backup || "";
    if (!extractedBackupOp && item.keterangan_cacat) {
      const match = item.keterangan_cacat.match(/\(Backup:\s*([^)]+)\)/i);
      if (match && match[1]) {
        extractedBackupOp = match[1].trim();
      }
    }

    const isIstirahat = !!extractedBackupOp || (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT");
    const hasIstirahat = isIstirahat;
    const isFinish = item.keterangan_cacat === "FINISH" || item.production_headers?.panel_no === "FINISH";
    const isStart = item.keterangan_cacat === "START" || item.production_headers?.panel_no === "START";

    let displayDetail = item.detail_masalah || "";
    let displayKeterangan = item.keterangan_cacat || "";
    let oprStr = opr;
    
    if (displayKeterangan.includes("ISTIRAHAT") || !!extractedBackupOp) {
      oprStr = "Istirahat";
      displayKeterangan = displayKeterangan.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
      displayKeterangan = displayKeterangan.replace(/\(?Backup:\s*[^)]+\)?/gi, "").trim();
      displayKeterangan = displayKeterangan.replace(/^,\s*|\s*,\s*$/g, "");
    }

    const rawPanelNo = item.production_headers?.panel_no || "-";
    const isBsAwal = String(rawPanelNo).toUpperCase().includes("AWAL");
    const isBsAkhir = String(rawPanelNo).toUpperCase().includes("AKHIR");
    const isSisa = isBsAwal || isBsAkhir;

    let ketCacat = displayKeterangan;
    const hasTambahanQC = ketCacat.includes("[TAMBAHAN QC]");
    ketCacat = ketCacat.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
    ketCacat = ketCacat.replace(/\(?Backup:\s*[^)]+\)?/gi, "").trim();
    ketCacat = ketCacat.replace(/\[TAMBAHAN QC\]/gi, "").trim();
    ketCacat = ketCacat.replace(/^,\s*|\s*,\s*$/g, "").trim();

    let cacatLines: string[] = [];
    const katsRaw = item.kategori_masalah;
    const kats = katsRaw ? (Array.isArray(katsRaw) ? katsRaw : katsRaw.split(",").map((s: string) => s.trim())) : [];
    
    if (isSisa) {
      cacatLines = [isBsAwal ? "Sisa Awal Potongan" : "Sisa Akhir Potongan"];
    } else if (item.production_defects && Array.isArray(item.production_defects) && item.production_defects.length > 0) {
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
        if (ketCacat) {
          const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
          if (cleanB && !cleanB.toLowerCase().includes("backup") && !cleanB.toLowerCase().includes("istirahat") && cleanB !== "()" && cleanB !== "-") {
            if (cacatLines.length === 0) {
              cacatLines.push(`(Blok ${cleanB})`);
            } else {
              cacatLines = cacatLines.map((l) => `${l} (Blok ${cleanB})`);
            }
          }
        }
      }
    } else {
      if (kats.length > 0) {
        if (displayDetail) {
          const parts = displayDetail.split(",").map((s: string) => s.trim()).filter(Boolean);
          parts.forEach((p: string) => cacatLines.push(`${kats[0]} - ${p}`));
        } else {
          cacatLines.push(kats.join(", "));
        }
      } else if (displayDetail) {
        cacatLines.push(displayDetail);
      }

      if (ketCacat) {
        const cleanB = ketCacat.replace(/blok\s*/gi, "").trim();
        if (cleanB && !cleanB.toLowerCase().includes("backup") && !cleanB.toLowerCase().includes("istirahat") && cleanB !== "()" && cleanB !== "-") {
          cacatLines.push(`(Blok ${cleanB})`);
        }
      }
    }

    if (hasTambahanQC) {
      if (cacatLines.length === 0) cacatLines.push("[TAMBAHAN QC]");
      else cacatLines = cacatLines.map(l => `${l} [TAMBAHAN QC]`);
    }

    if (cacatLines.length > 1) {
      cacatLines = cacatLines.map((l, i) => `${i + 1}. ${l.replace(/^\d+\.\s*/, "")}`);
    } else if (cacatLines.length === 1) {
      cacatLines = [`1. ${cacatLines[0].replace(/^\d+\.\s*/, "")}`];
    }

    const isDeleted = !!item.is_deleted || item.status_inspeksi === "Dihapus" || item.status_mending === "Dihapus";
    const isGradable = !isFinish && !isStart && !isDeleted;
    const cacatText = isDeleted ? "[Panel Dihapus]" : (cacatLines.length > 0 ? cacatLines.join("\n") : "-");

    return {
      item,
      isIstirahat,
      hasIstirahat,
      isFinish,
      isStart,
      isGradable,
      isDeleted,
      opr,
      grp,
      tgl,
      operatorStr,
      oprStr,
      cacatText,
      backupOpName: extractedBackupOp,
    };
  });

  const items: any[] = [];
  let currentOpCount = 0;
  let currentOpIds: string[] = [];
  let firstRowTgl = "";
  let lastTgl = "";
  let lastGrp = "";
  let lastOpr = "";

  processed.forEach((p, i) => {
    const { item, isIstirahat, hasIstirahat, isFinish, isStart, isGradable, isDeleted, opr, grp, tgl, operatorStr, oprStr, cacatText } = p;

    const isBS = item.jml_hasil_produksi === 0 || item.status_inspeksi === "BS" || item.final_inspection_id === 4 || selections[item.id] === "BS";
    if (isGradable && !isBS && !isDeleted) {
      currentOpCount += 1;
    }
    if (isGradable && !isDeleted) {
      currentOpIds.push(item.id);
    }

    let showTgl = false;
    let showGrp = false;
    let showOpr = false;

    if (i === 0) {
      showTgl = true;
      showGrp = true;
      showOpr = true;
      firstRowTgl = tgl;
    } else {
      if (opr !== lastOpr) {
        showTgl = true;
        showGrp = true;
        showOpr = true;
      } else if (tgl !== firstRowTgl && tgl !== lastTgl) {
        showTgl = true;
      }
    }

    lastTgl = tgl;
    lastGrp = grp;
    lastOpr = opr;

    let hasRealDefects = false;
    const isBsPanel = String(item.production_headers?.panel_no || "").toUpperCase().includes("AWAL") || 
                      String(item.production_headers?.panel_no || "").toUpperCase().includes("AKHIR") || 
                      String(item.production_headers?.panel_no || "").includes("(BS)") || 
                      item.jml_hasil_produksi === 0 || 
                      item.status_inspeksi === "BS";
    if (isBsPanel) {
      hasRealDefects = true;
    } else if (item.production_defects && Array.isArray(item.production_defects) && item.production_defects.length > 0) {
      hasRealDefects = item.production_defects.some((d: any) => {
        const k = (d.kategori || "").toUpperCase().trim();
        const det = (d.detail || "").toUpperCase().trim();
        if (k.includes("ISTIRAHAT") || det.includes("ISTIRAHAT")) return false;
        if (det.includes("GAGAL CACAT") || k === "G") return false;
        return true;
      });
    } else {
      const katStr = (item.kategori_masalah || "").toUpperCase().trim();
      const detStr = (item.detail_masalah || "").toUpperCase().trim();
      if (katStr && katStr !== "G" && !katStr.includes("ISTIRAHAT") && !katStr.includes("GAGAL CACAT")) {
        hasRealDefects = true;
      }
      if (detStr && !detStr.includes("ISTIRAHAT") && !detStr.includes("START") && !detStr.includes("FINISH") && !detStr.includes("GAGAL CACAT")) {
        hasRealDefects = true;
      }
    }
    if ((item.keterangan_cacat || "").includes("[TAMBAHAN QC]")) hasRealDefects = true;

    const isGagalCacatOnly = (
      (item.detail_masalah || "").toUpperCase().includes("GAGAL CACAT") ||
      (item.keterangan_cacat || "").toUpperCase().includes("GAGAL CACAT") ||
      (item.kategori_masalah || "").toUpperCase() === "G" ||
      (item.production_defects && item.production_defects.some((d: any) => (d.detail || "").toUpperCase().includes("GAGAL CACAT") || (d.kategori || "").toUpperCase() === "G"))
    ) && !hasRealDefects;

    items.push({
      ...item,
      isMeter: false,
      isStartRow: false,
      isIstirahat,
      hasIstirahat,
      isDeleted,
      isFinishReport: isFinish,
      displayNo: item.production_headers?.panel_no || "-",
      meterDisplay: "-",
      cacatDisplay: cacatText,
      backupOpName: p.backupOpName,
      isGradable: isGradable && !isDeleted,
      hasRealDefects,
      isGagalCacatOnly,
      showTgl,
      showGrp,
      showOpr,
      oprBase: opr,
      oprStr,
      grpStr: grp,
      tglStr: tgl,
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

        const countBS = currentOpIds.filter(id => {
          const d = details.find(item => item.id === id);
          return selections[id] === "BS" || d?.jml_hasil_produksi === 0 || d?.status_inspeksi === "BS";
        }).length;

        items.push({
          id: `total-${operatorStr}-${Math.random()}`,
          isTotalRow: true,
          totalLabel: `Total Produksi${prevGrp ? ` (${prevGrp})` : ""} ${prevOpr}:`,
          totalCount: currentOpCount,
          countA: currentOpIds.filter(id => selections[id] === "A").length,
          countB: currentOpIds.filter(id => selections[id] === "B").length,
          countBS,
        });
      }
      currentOpCount = 0;
      currentOpIds = [];
    }
  });

  return items;
};

// Default Auto-Grade generator for Mending
const generateDefaultMendingSelections = (panels: any[]) => {
  const map: Record<string, string> = {};
  panels.forEach((p: any) => {
    const rawNo = String(p.panel_no || "").toUpperCase();
    const isBsAwalAkhir = rawNo.includes("AWAL") || rawNo.includes("AKHIR");
    const dets = p.production_details || [];
    dets.forEach((d: any) => {
      const id = d.id || `${p.id}-${d.pcs_index}`;
      if (d.is_deleted) return;
      const isBs = d.jml_hasil_produksi === 0 || d.status_inspeksi === "BS" || isBsAwalAkhir;
      if (isBs) {
        map[id] = "BS";
      } else {
        const katUpper = String(d.kategori_masalah || "").toUpperCase();
        const detUpper = String(d.detail_masalah || "").toUpperCase();
        
        let hasRealDefect = false;
        if (d.production_defects && Array.isArray(d.production_defects) && d.production_defects.length > 0) {
          d.production_defects.forEach((def: any) => {
            const k = (def.kategori || "").toUpperCase();
            const det = (def.detail || "").toUpperCase();
            if (!k.includes("ISTIRAHAT") && !det.includes("ISTIRAHAT") && !det.includes("GAGAL CACAT") && k !== "G") {
              hasRealDefect = true;
            }
          });
        }
        
        if (!hasRealDefect) {
          if (katUpper && katUpper !== "G" && !katUpper.includes("ISTIRAHAT") && !katUpper.includes("GAGAL CACAT")) {
            hasRealDefect = true;
          }
          if (
            detUpper &&
            !detUpper.includes("ISTIRAHAT") &&
            !detUpper.includes("START") &&
            !detUpper.includes("FINISH") &&
            !detUpper.includes("GAGAL CACAT")
          ) {
            if (
              (d.kategori_masalah && katUpper !== "G" && !katUpper.includes("GAGAL CACAT")) ||
              (d.production_defects && d.production_defects.length > 0) ||
              d.hasTambahanQC
            ) {
              hasRealDefect = true;
            }
          }
        }

        if (d.hasTambahanQC) hasRealDefect = true;

        if (hasRealDefect) {
          map[id] = "B"; // Grade B (Perlu perbaikan)
        } else {
          map[id] = "A"; // Grade A (Bebas cacat)
        }
      }
    });
  });
  return map;
};

// ============================================================================
const MOCK_QC_CATEGORIES = [
  { id: "A", name: "Kode A: Masalah Benang & Jarum" },
  { id: "B", name: "Kode B: Masalah Mekanik" },
  { id: "C", name: "Kode C: Masalah Elektrik" },
  { id: "D", name: "Kode D: Masalah Bahan Baku" },
  { id: "E", name: "Kode E: Masalah Finishing" },
  { id: "F", name: "Kode F: Masalah Setting" },
  { id: "G", name: "Kode G: Lainnya" },
];

const MOCK_QC_DETAILS_MAP: Record<string, string[]> = {
  A: ["Benang Nyilang", "L1 Putus", "Jarum Patah", "Ngegaris/Stopline"],
  B: ["Perbaikan Bolong-bolong", "Ganti Sparepart", "Setel Rol"],
  C: ["Sensor Error", "Inverter Trip"],
  D: ["Benang Kotor", "Bahan Belang"],
  E: ["Lipatan Kain", "Kain Basah"],
  F: ["Setel Lebar", "Setel Gramasi"],
  G: ["Lainnya"],
};

// Component: Mending Report Form & Side-by-Side Table matching /reports/mending-production
function MendingReportScenarioCard({ panels, selections, isMeter }: { panels: any[]; selections: Record<string, string>; isMeter?: boolean }) {
  const displayItems = formatDetailsForMending(panels, selections);
  const firstHeader = panels[0] || {};
  const unit = isMeter ? "Meter" : "Panel";

  const regularItems = displayItems.filter((d: any) => !d.isTotalRow);
  
  let prodA: number | string = 0;
  let prodB: number | string = 0;
  let prodBS: number | string = 0;
  let inspectA: number | string = 0;
  let inspectB: number | string = 0;
  let inspectBS: number | string = 0;

  if (isMeter) {
    let totalMeterSum = 0;
    displayItems.forEach((di: any) => {
      if (di.isTotalRow && di.totalMeter) {
        const m = parseFloat(di.totalMeter);
        if (!isNaN(m)) totalMeterSum += m;
      }
    });
    if (totalMeterSum === 0) totalMeterSum = 220;

    const defectCount = regularItems.filter((i: any) => i.hasRealDefects).length;
    prodA = `${totalMeterSum - defectCount} Meter`;
    prodB = defectCount;
    prodBS = 0;

    const inspB = regularItems.filter((i: any) => selections[i.id] === "B").length;
    const inspBS = regularItems.filter((i: any) => selections[i.id] === "BS").length;
    inspectA = `${totalMeterSum - inspB} Meter`;
    inspectB = inspB;
    inspectBS = inspBS;
  } else {
    const nonBsSisa = regularItems.filter((i: any) => !isBsAwalAkhir(i));
    prodA = nonBsSisa.filter((i: any) => !i.hasRealDefects).length;
    prodB = nonBsSisa.filter((i: any) => i.hasRealDefects).length;
    prodBS = 0;

    inspectA = nonBsSisa.filter((i: any) => selections[i.id] === "A" || (!selections[i.id] && !i.hasRealDefects)).length;
    inspectB = nonBsSisa.filter((i: any) => selections[i.id] === "B" || (!selections[i.id] && i.hasRealDefects)).length;
    inspectBS = nonBsSisa.filter((i: any) => selections[i.id] === "BS").length;
  }

  const itemsForGrade = regularItems.map((i: any) => ({
    ...i,
    hasil_mending: selections[i.id] || (i.hasRealDefects ? "B" : "A"),
  }));

  const gradeInfo = calculateOverallGradeData(itemsForGrade, !!isMeter);
  const { overallGrade, bucket, totalQty, totalCacat } = gradeInfo;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* 1. Header Spek Mesin & Desain */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/70">
        <div className="flex flex-col items-center justify-center text-center mb-5 pb-4 border-b border-slate-200">
          <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-wider flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            FORM KUALITAS PRODUKSI KAIN {isMeter ? "ALL OVER (METERAN)" : "PANEL"}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
          <div className="space-y-1">
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <span className="font-bold text-slate-500">Design</span>
              <span className="font-black text-slate-800">: {firstHeader.design || "TLD 7223 AN"}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <span className="font-bold text-slate-500">Nomor Mc</span>
              <span className="font-black text-[#0070bc]">: {firstHeader.mc || "R1"}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <span className="font-bold text-slate-500">Tgl Produksi</span>
              <span className="font-black text-slate-800">: {firstHeader.tgl || "2026-08-21"}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <span className="font-bold text-slate-500">Tgl Potong</span>
              <span className="font-black text-slate-800">: {firstHeader.tgl || "2026-08-21"}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <span className="font-bold text-slate-500">Pick / Course</span>
              <span className="font-black text-slate-800">: 14.5 / 3400</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <span className="font-bold text-slate-500">No. Order Barang</span>
              <span className="font-black text-slate-800">: EXR/26/39</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <span className="font-bold text-slate-500">Potongan ke</span>
              <span className="font-black text-rose-600">: Ke-{firstHeader.potongan || "346"}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <span className="font-bold text-slate-500">Roll no</span>
              <span className="font-black text-slate-800">: 1</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <span className="font-bold text-slate-500">Jenis Benang Dsr</span>
              <span className="font-black text-slate-800">: PE 20s Solid</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <span className="font-bold text-slate-500">Liner / Shadow</span>
              <span className="font-black text-slate-800">: 150D / NFDT 200D</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <span className="font-bold text-slate-500">Pinggiran</span>
              <span className="font-black text-slate-800">: DTY 70/24-2 SD</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <span className="font-bold text-slate-500">No. Customer</span>
              <span className="font-black text-slate-800">: 21102</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Side-by-side PCS Card Container */}
      <div className="p-4 bg-slate-100/60 overflow-x-auto">
        <div className="min-w-[540px] max-w-3xl mx-auto border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden flex flex-col">
          {/* PCS Header Tag */}
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <span className="font-black text-slate-800 text-sm">PCS 1</span>
            <span className="text-[10px] font-bold bg-[#0070bc]/10 text-[#0070bc] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {unit}
            </span>
          </div>

          {/* Table */}
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-extrabold">
                <th className="px-2 py-2 w-12 border-r border-slate-200">NO</th>
                <th className="px-2 py-2 w-20 border-r border-slate-200">TGL</th>
                <th className="px-1.5 py-2 text-center w-12 border-r border-slate-200">Group</th>
                <th className="px-2 py-2 w-24 border-r border-slate-200">Operator</th>
                <th className="px-2 py-2 text-center w-12 border-r border-slate-200">✓/X</th>
                {isMeter && <th className="px-2 py-2 text-center w-16 border-r border-slate-200">Meter</th>}
                <th className="px-2 py-2 border-r border-slate-200">KETERANGAN CACAT</th>
                <th className="px-1 py-2 text-center w-8 border-r border-slate-200">A</th>
                <th className="px-1 py-2 text-center w-8 border-r border-slate-200">B</th>
                <th className="px-1 py-2 text-center w-8">BS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {displayItems.map((item: any, idx: number) => {
                if (item.isTotalRow) {
                  return (
                    <tr key={idx} className="bg-slate-100/70 border-t border-b border-slate-200 font-bold text-slate-700">
                      <td colSpan={isMeter ? 5 : 4} className="px-3 py-2 text-right border-r border-slate-200">
                        {item.totalLabel}
                      </td>
                      <td className="px-2 py-2 text-center font-black border-r border-slate-200 whitespace-nowrap">
                        {isMeter ? item.totalMeter : `${item.totalCount} Panel`}
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                  );
                }

                const grade = selections[item.id] || (item.hasRealDefects ? "B" : "A");
                const isDeleted = item.isDeleted;

                const hasTambahanQC = !!item.keterangan_cacat?.includes("[TAMBAHAN QC]") || item.hasTambahanQC;
                const hasTambahanMnd = !!item.keterangan_cacat?.includes("[TAMBAHAN MENDING]") || item.hasTambahanMnd;
                const isRowQcModified = hasTambahanQC || hasTambahanMnd || (!!item.keterangan_qc && item.keterangan_qc !== "-");

                return (
                  <tr key={item.id || idx} className={`${
                    isRowQcModified
                      ? "bg-sky-50/90 hover:bg-sky-100/60 border-y border-sky-200"
                      : item.hasIstirahat
                      ? "bg-amber-50/30 hover:bg-amber-50/50"
                      : "hover:bg-slate-50/80"
                  } transition-colors`}>
                    <td className={`px-2 py-1 font-bold text-slate-800 border-r border-slate-100 ${
                      isRowQcModified
                        ? "bg-sky-100/70"
                        : item.hasIstirahat
                        ? "bg-amber-100/50"
                        : ""
                    }`}>
                      {String(item.displayNo).toUpperCase().includes("AWAL") ? (
                        <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded leading-none shadow-sm whitespace-nowrap">BS AWAL</span>
                      ) : String(item.displayNo).toUpperCase().includes("AKHIR") ? (
                        <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded leading-none shadow-sm whitespace-nowrap">BS AKHIR</span>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <span>{item.displayNo || "-"}</span>
                          {hasTambahanQC ? (
                            <span className="text-[8px] font-black bg-sky-100 text-sky-700 px-1 py-0.5 rounded mt-0.5 leading-none border border-sky-300 shadow-2xs">+ QC</span>
                          ) : hasTambahanMnd ? (
                            <span className="text-[8px] font-black bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded mt-0.5 leading-none border border-indigo-300 shadow-2xs">+ MND</span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1 text-slate-600 whitespace-nowrap border-r border-slate-100">
                      {item.showTgl ? (item.tglStr || "-") : ""}
                    </td>
                    <td className="px-1.5 py-1 font-medium text-slate-700 text-center border-r border-slate-100">
                      {item.showGrp ? (item.grpStr || "-") : ""}
                    </td>
                    <td className={`px-2 py-1 leading-tight border-r border-slate-100 ${(!item.showOpr && (item.isIstirahat || item.hasIstirahat)) ? "italic font-bold text-amber-600" : "font-medium text-slate-700"}`}>
                      {item.showOpr ? (item.oprBase || "-") : ((item.isIstirahat || item.hasIstirahat) ? "Istirahat" : "")}
                    </td>
                    <td className="px-2 py-1 text-center font-bold text-sm border-r border-slate-100">
                      {isDeleted ? (
                        <span className="text-slate-400 font-bold">-</span>
                      ) : item.hasRealDefects ? (
                        <span className="text-rose-600">X</span>
                      ) : (
                        <span className="text-emerald-600">✓</span>
                      )}
                    </td>
                    {isMeter && (
                      <td className="px-2 py-1 font-mono text-slate-700 whitespace-nowrap text-[11px] text-center border-r border-slate-100">
                        {item.meter_kain || "-"}
                      </td>
                    )}
                    <td className="px-2 py-1 text-[11px] font-medium whitespace-pre-line leading-tight border-r border-slate-100">
                      {(() => {
                        const isTambahanQc = !!item.keterangan_cacat?.includes("[TAMBAHAN QC]") || item.hasTambahanQC;
                        const defectTextColor = item.isDeleted
                          ? "text-slate-400 italic"
                          : isTambahanQc
                          ? "text-sky-600 font-semibold"
                          : (item.isIstirahatOnly || item.isGagalCacatOnly)
                          ? "text-slate-500 font-medium"
                          : "text-rose-600";

                        return (item.isIstirahat || item.hasIstirahat) ? (
                          <>
                            {item.backupOpName && <div className="font-bold text-slate-700 mb-0.5">{item.backupOpName}</div>}
                            {item.cacatDisplay && item.cacatDisplay !== "-" ? (
                              <div className={defectTextColor}>{item.cacatDisplay}</div>
                            ) : (
                              !item.backupOpName && <span className="text-slate-400">-</span>
                            )}
                            {item.keterangan_qc && item.keterangan_qc !== "-" && (
                              <div className="text-sky-800 bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5 font-bold text-[10px] mt-0.5 shadow-2xs flex items-center gap-1 w-fit">
                                <span className="text-sky-600 font-black">QC:</span> {item.keterangan_qc}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className={item.cacatDisplay && item.cacatDisplay !== "-" ? defectTextColor : "text-slate-400"}>
                              {item.cacatDisplay || "-"}
                            </div>
                            {item.keterangan_qc && item.keterangan_qc !== "-" && (
                              <div className="text-sky-800 bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5 font-bold text-[10px] mt-0.5 shadow-2xs flex items-center gap-1 w-fit">
                                <span className="text-sky-600 font-black">QC:</span> {item.keterangan_qc}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-1 py-1 text-center border-r border-slate-100">
                      {grade === "A" && <div className="mx-auto w-4 h-4 rounded bg-emerald-100 text-emerald-700 font-black flex items-center justify-center text-[10px]">A</div>}
                    </td>
                    <td className="px-1 py-1 text-center border-r border-slate-100">
                      {grade === "B" && <div className="mx-auto w-4 h-4 rounded bg-amber-100 text-amber-700 font-black flex items-center justify-center text-[10px]">B</div>}
                    </td>
                    <td className="px-1 py-1 text-center">
                      {grade === "BS" && <div className="mx-auto w-4 h-4 rounded bg-rose-100 text-rose-700 font-black flex items-center justify-center text-[10px]">BS</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Summary Table & Overall Grade Box */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-stretch w-full">
              {/* Table KET Produksi vs Inspect */}
              <div className="flex-1">
                <table className="w-full text-left text-xs border-collapse border border-slate-300 bg-white shadow-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-extrabold">
                      <th className="px-3 py-1.5 border border-slate-300">KET</th>
                      <th className="px-3 py-1.5 border border-slate-300 text-center">Produksi</th>
                      <th className="px-3 py-1.5 border border-slate-300 text-center">Setelah Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="px-3 py-1.5 border border-slate-300 font-bold text-slate-800">Total Grade A</td>
                      <td className="px-3 py-1.5 border border-slate-300 text-center font-bold text-slate-700">{prodA}</td>
                      <td className="px-3 py-1.5 border border-slate-300 text-center font-bold text-emerald-600">{inspectA}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 border border-slate-300 font-bold text-slate-800">Total Grade B</td>
                      <td className="px-3 py-1.5 border border-slate-300 text-center font-bold text-slate-700">{prodB}</td>
                      <td className="px-3 py-1.5 border border-slate-300 text-center font-bold text-amber-600">{inspectB}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 border border-slate-300 font-bold text-slate-800">Total Grade BS</td>
                      <td className="px-3 py-1.5 border border-slate-300 text-center font-bold text-slate-700">{prodBS}</td>
                      <td className="px-3 py-1.5 border border-slate-300 text-center font-bold text-rose-600">{inspectBS}</td>
                    </tr>
                    <tr className="bg-slate-50 font-black">
                      <td className="px-3 py-1.5 border border-slate-300 text-slate-900">Total {unit}</td>
                      <td className="px-3 py-1.5 border border-slate-300 text-center text-slate-900">
                        {isMeter ? prodA : `${Number(prodA) + Number(prodB)}`}
                      </td>
                      <td className="px-3 py-1.5 border border-slate-300 text-center text-slate-900">
                        {isMeter ? inspectA : `${totalQty}`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Overall Grade Card */}
              <div className="w-full sm:w-48 bg-white border border-slate-300 rounded-lg p-3 flex flex-col items-center justify-center text-center shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Overall Grade Potongan
                </span>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shadow-sm mb-1.5 ${
                  overallGrade === "A" ? "bg-emerald-500 text-white" :
                  overallGrade === "B" ? "bg-amber-500 text-white" :
                  overallGrade === "C" ? "bg-orange-500 text-white" :
                  "bg-rose-500 text-white"
                }`}>
                  {overallGrade}
                </div>
                <span className="text-[11px] font-extrabold text-slate-700">
                  Grade {overallGrade} ({totalCacat} cacat)
                </span>
                <span className="text-[9px] text-slate-400 mt-0.5">
                  Skala bucket: {bucket} {unit}
                </span>
              </div>
            </div>

            {/* Metadata Info Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-[10px] text-slate-600">
              <div><span className="font-bold text-slate-400">Berat Kain:</span> 14.5 kg</div>
              <div><span className="font-bold text-slate-400">Tgl Inspect:</span> 2026-08-21</div>
              <div><span className="font-bold text-slate-400">Petugas QC:</span> Dwi, Siti</div>
              <div><span className="font-bold text-slate-400">Waktu:</span> 08:00 - 08:35</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TestScenariosPlayground() {
  const [activeTab, setActiveTab] = useState<"panel" | "meter" | "rules" | "schemes">("panel");
  const [selectedScenario, setSelectedScenario] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"history" | "qc" | "mending" | "report">("report");
  const [autoGradeEnabled, setAutoGradeEnabled] = useState<boolean>(true);
  
  // Interactive QC & Mending selections state
  const [qcSelections, setQcSelections] = useState<Record<string, number>>({});
  const [mendingSelections, setMendingSelections] = useState<Record<string, string>>({});
  
  // Modal Edit state
  const [editingDetail, setEditingDetail] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [customOverrides, setCustomOverrides] = useState<Record<string, any>>({});

  const handleSelectQcGrade = (id: string, grade: number) => {
    setQcSelections((prev) => ({ ...prev, [id]: grade }));
  };

  const handleSelectMendingGrade = (id: string, grade: string) => {
    setMendingSelections((prev) => ({ ...prev, [id]: grade }));
  };

  const handleResetSelections = () => {
    setQcSelections({});
    setMendingSelections({});
    setCustomOverrides({});
  };

  const panelScenarios = [
    {
      id: "normal",
      title: "1. Normal Lancar (Bebas Cacat)",
      description: "1 operator memproduksi panel 1-4 tanpa hambatan. Tanggal, Group, Operator hanya di baris pertama.",
      expected: ["Semua KET bernilai Centang Hijau (✓)", "Total Produksi = 4 Panel", "Inspeksi QC: 4 Pass (✓), 0 Defect, 0 BS"],
      data: mockScenarioNormal,
    },
    {
      id: "bs-awal-akhir",
      title: "2. BS Awal & BS Akhir (Sisa Potongan)",
      description: "Potongan memiliki sisa awal dan sisa akhir kain. Panel BS tidak boleh dihitung ke total produksi.",
      expected: ["Badge merah 'BS AWAL' & 'BS AKHIR'", "Inspeksi QC: 2 Pass (✓), 0 Defect, 2 BS", "Total Produksi hanya menghitung panel nomor (2 Panel)"],
      data: mockScenarioBsAwalAkhir,
    },
    {
      id: "multi-operator",
      title: "3. Pergantian Operator / Shift (Multi-Operator)",
      description: "Terjadi pergantian operator di tengah potongan (Rina -> Rissa -> Budi).",
      expected: [
        "Baris Total Produksi per operator muncul di setiap pergantian",
        "Tanggal, Group, Operator muncul kembali di baris pertama tiap operator baru",
        "Total per operator terhitung akurat secara individual",
      ],
      data: mockScenarioMultiOperator,
    },
    {
      id: "istirahat",
      title: "4. Istirahat di Tengah Potongan + Operator Backup",
      description: "Operator utama istirahat di tengah proses (panel 2 & 3). Diisi operator backup (ada yang tanpa cacat dan ada yang ada cacat).",
      expected: [
        "Kolom Operator bertuliskan 'Istirahat' (italic)",
        "Nama operator backup tampil di kolom Keterangan Cacat",
        "Jika ada cacat (panel 3), otomatis mendapatkan nilai Inspeksi X",
        "Jika tanpa cacat (panel 2), otomatis nilai Inspeksi ✓",
      ],
      data: mockScenarioIstirahat,
    },
    {
      id: "istirahat-baris-pertama",
      title: "5. Istirahat di Baris Pertama (Prioritas Nama Operator)",
      description: "Sesuai aturan AGENTS.md: jika data dengan label istirahat di baris pertama, prioritas data yang tampil di kolom operator adalah nama operator utama, dan nama backup tampil di kolom keterangan cacat.",
      expected: [
        "Baris 1: Kolom Operator tetap terisi nama operator utama (Rina R)",
        "Baris 1: Kolom Keterangan Cacat menampilkan nama backup (Dewi Lestari)",
        "Baris 2: Kolom Operator bertuliskan 'Istirahat' & keterangan menampilkan Dewi Lestari",
        "Baris 3+: Kembali normal saat selesai istirahat",
      ],
      data: mockScenarioIstirahatBarisPertama,
    },
    {
      id: "gagal-cacat",
      title: "6. Gagal Cacat / False Alarm (Fitur Baru)",
      description: "Peristiwa mesin stop yang diklasifikasikan sebagai Gagal Cacat / alarm palsu.",
      expected: [
        "Baris murni Gagal Cacat mendapatkan KET ✓ dan otomatis Inspeksi QC Pass (✓)",
        "Teks '1. Gagal Cacat' berwarna abu-abu netral (text-slate-500), bukan merah",
        "Baris yang memiliki cacat lain tetap mendapatkan Silang Merah (X)",
      ],
      data: mockScenarioGagalCacat,
    },
    {
      id: "multi-defect",
      title: "7. Multi-Defect & Multi-Blok",
      description: "1 panel memiliki banyak cacat berbeda sekaligus dengan nomor blok gabungan.",
      expected: [
        "Cacat terformat bernomor urut (1., 2., 3.)",
        "Blok tergabung rapi: '(Blok 15, 22)'",
        "Inspeksi QC otomatis memilih tombol X (Defect)",
      ],
      data: mockScenarioMultiDefect,
    },
    {
      id: "deleted-and-bs",
      title: "8. Panel Dihapus & BS Individual",
      description: "Penanganan panel yang di-soft delete dan panel yang cacat BS murni di tengah.",
      expected: [
        "Badge merah 'DIHAPUS' & KET berupa '-' (tombol grading dinonaktifkan)",
        "Baris dihapus tidak dihitung di Total Produksi",
        "Panel BS individual ditandai badge 'BS' dan otomatis bernilai Inspeksi BS",
      ],
      data: mockScenarioDeletedAndBs,
    },
    {
      id: "tambahan-qc",
      title: "9. Tambah Panel & Catatan Khusus QC (Highlight Biru Satu Baris)",
      description: "Penambahan panel baru oleh QC (+ QC / + MND) dan penambahan keterangan/catatan khusus QC.",
      expected: [
        "Seluruh baris data yang ditambah/diubah oleh QC memiliki background biru (bg-sky-50)",
        "Panel susulan QC berlabel badge '+ QC' atau '+ MND'",
        "Catatan khusus QC ditampilkan dalam badge biru di bawah rincian cacat",
        "Teks cacat atau keterangan QC berwarna biru (bukan merah cacat produksi)",
      ],
      data: mockScenarioTambahanQc,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-2">
              <FlaskConical className="w-3.5 h-3.5" />
              Automated Scenario Playground & Visual Regression Tester
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Katalog Uji Skenario Tampilan & Skema Perhitungan
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-3xl">
              Uji langsung seluruh skenario kondisi data pada 3 jenis tampilan tabel sistem: <strong>Halaman Riwayat</strong>, <strong>Halaman Inspeksi QC</strong>, dan <strong>Halaman Mending</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setActiveTab("panel")}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "panel"
                  ? "bg-white text-slate-900 shadow-md"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Layers className="w-4 h-4" />
              Skenario Panel ({panelScenarios.length})
            </button>
            <button
              onClick={() => setActiveTab("meter")}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "meter"
                  ? "bg-white text-slate-900 shadow-md"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Sliders className="w-4 h-4" />
              Skenario Meteran (Roll)
            </button>
            <button
              onClick={() => setActiveTab("schemes")}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "schemes"
                  ? "bg-white text-slate-900 shadow-md"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Calculator className="w-4 h-4" />
              Skema & Rumus Hitung
            </button>
            <button
              onClick={() => setActiveTab("rules")}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "rules"
                  ? "bg-white text-slate-900 shadow-md"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Audit Aturan
            </button>
          </div>
        </div>
      </div>

      {/* VIEW MODE SELECTOR (Riwayat vs QC Inspection vs Mending) */}
      {(activeTab === "panel" || activeTab === "meter") && (
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mr-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              Pilih Tampilan Tabel:
            </span>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode("qc")}
                className={`px-3 py-1.5 rounded-md text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "qc"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                1. Halaman Inspeksi QC (Tombol ✓/X/BS)
              </button>
              <button
                onClick={() => setViewMode("mending")}
                className={`px-3 py-1.5 rounded-md text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "mending"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                2. Halaman Mending (Kolom A/B/BS)
              </button>
              <button
                onClick={() => setViewMode("history")}
                className={`px-3 py-1.5 rounded-md text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "history"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                3. Halaman Riwayat Detail
              </button>
              <button
                onClick={() => setViewMode("report")}
                className={`px-3 py-1.5 rounded-md text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "report"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                4. Halaman Laporan Mending (Format Form & Summary)
              </button>
            </div>
          </div>

          {/* Interactive Grade Fill Controls */}
          {(viewMode === "qc" || viewMode === "mending") && (
            <div className="flex items-center gap-2 border-t md:border-t-0 pt-2 md:pt-0">
              <button
                onClick={() => setAutoGradeEnabled(!autoGradeEnabled)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  autoGradeEnabled
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
                title="Ketika aktif, nilai ✓ / X / BS diisi otomatis sesuai data cacat/normal"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                {autoGradeEnabled ? "Nilai Grade: Otomatis Terisi" : "Nilai Grade: Kosong (Manual)"}
              </button>

              <button
                onClick={handleResetSelections}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                title="Reset pilihan klik manual"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Klik
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: PANEL SCENARIOS */}
      {activeTab === "panel" && (
        <div className="space-y-6">
          {/* Quick Scenario Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1 shrink-0 px-1">
              <Filter className="w-3.5 h-3.5" /> Filter Skenario:
            </span>
            <button
              onClick={() => setSelectedScenario("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedScenario === "all"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Tampilkan Semua ({panelScenarios.length})
            </button>
            {panelScenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedScenario(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedScenario === s.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {s.title.split(". ")[1] || s.title}
              </button>
            ))}
          </div>

          {/* Scenarios Cards Grid */}
          <div className="space-y-8">
            {panelScenarios
              .filter((s) => selectedScenario === "all" || selectedScenario === s.id)
              .map((scenario, sIdx) => {
                const activeData = scenario.data.map((h: any) => ({
                  ...h,
                  production_details: (h.production_details || []).map((d: any) => {
                    const key = d.id || `${h.id}-${d.pcs_index}`;
                    const override = customOverrides[key] || customOverrides[d.id];
                    return override ? { ...d, ...override } : d;
                  })
                }));
                const defaultQc = generateDefaultQcSelections(activeData);
                const defaultMending = generateDefaultMendingSelections(activeData);
                const currentQcSelections = autoGradeEnabled ? { ...defaultQc, ...qcSelections } : qcSelections;
                const currentMendingSelections = autoGradeEnabled ? { ...defaultMending, ...mendingSelections } : mendingSelections;
                const detailsForQc = formatDetailsForQc(activeData);

                return (
                  <div
                    key={scenario.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:shadow-md"
                  >
                    {/* Scenario Header */}
                    <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center">
                            {sIdx + 1}
                          </span>
                          <h3 className="font-extrabold text-slate-800 text-base">
                            {scenario.title}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 pl-8">
                          {scenario.description}
                        </p>
                      </div>

                      <div className="pl-8 md:pl-0 flex flex-wrap items-center gap-2">
                        {scenario.expected.map((exp, eIdx) => (
                          <span
                            key={eIdx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            {exp}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Mode Tag & Info */}
                    <div className="px-4 py-2 bg-indigo-50/50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-900 font-semibold">
                      <span>
                        Komponen yang sedang dirender:{" "}
                        <strong className="text-indigo-950">
                          {viewMode === "history"
                            ? "<PanelHistoryTable /> (Riwayat Detail)"
                            : viewMode === "qc"
                            ? "<PanelQCTable /> (Inspeksi QC — Tombol ✓ / X / BS Interaktif)"
                            : viewMode === "mending"
                            ? "<PanelMendingTable /> (Pengerjaan Mending — Kolom A / B / BS)"
                            : "<MendingReportTable /> (Laporan Kualitas Mending & Overall Grade)"}
                        </strong>
                      </span>

                      {viewMode === "qc" && (
                        <span className="text-xs text-emerald-700 font-bold bg-emerald-100/60 px-2.5 py-0.5 rounded-md">
                          💡 Klik tombol ✓, X, atau BS pada tabel di bawah untuk melihat kalkulasi subtotal berubah langsung!
                        </span>
                      )}
                    </div>

                    {/* Rendered Table Component */}
                    <div className="p-4 overflow-x-auto bg-white">
                      <div className="rounded-lg border border-slate-200 overflow-hidden">
                        {viewMode === "history" && (
                          <PanelHistoryTable panels={activeData} pcsKey="PCS 1" />
                        )}

                        {viewMode === "qc" && (
                          <PanelQCTable
                            detailsToDisplay={detailsForQc}
                            handleSelectGrade={handleSelectQcGrade}
                            handleOpenDetail={() => {}}
                            handleOpenEditQC={(d: any) => {
                              setEditingDetail(d);
                              setIsEditModalOpen(true);
                            }}
                            selections={currentQcSelections}
                            setDetailToDelete={() => {}}
                          />
                        )}

                        {viewMode === "mending" && (
                          <PanelMendingTable
                            displayItems={formatDetailsForMending(activeData, currentMendingSelections)}
                            selections={currentMendingSelections}
                            onSelectGrade={handleSelectMendingGrade}
                            onOpenDetail={() => {}}
                            onOpenEditDetail={() => {}}
                            onDeleteDetail={() => {}}
                            totalGradable={formatDetailsForMending(activeData, currentMendingSelections).filter(d => !d.isTotalRow && d.isGradable).length}
                            totalA={Object.values(currentMendingSelections).filter((v) => v === "A").length}
                            totalB={Object.values(currentMendingSelections).filter((v) => v === "B").length}
                            totalBS={Object.values(currentMendingSelections).filter((v) => v === "BS").length}
                          />
                        )}

                        {viewMode === "report" && (
                          <MendingReportScenarioCard
                            panels={activeData}
                            selections={currentMendingSelections}
                            isMeter={false}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 2: METER SCENARIOS */}
      {activeTab === "meter" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-600" />
                  Skenario Inputan Meteran (Roll Kain)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Menguji baris START (meter awal), titik cacat, titik Gagal Cacat (✓), pergantian operator, baris FINISH (meter akhir), dan kalkulasi Total Meteran.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  START baris meter 0
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  FINISH baris meter 220
                </span>
              </div>
            </div>

            <div className="px-4 py-2 bg-indigo-50/50 border-b border-slate-100 flex items-center justify-between text-xs text-indigo-900 font-semibold">
              <span>
                Komponen yang sedang dirender:{" "}
                <strong>
                  {viewMode === "history"
                    ? "<MeterHistoryTable /> (Riwayat Detail Meteran)"
                    : viewMode === "qc"
                    ? "<MeterQCTable /> (Inspeksi QC Meteran)"
                    : "<MeterMendingTable /> (Mending Meteran)"}
                </strong>
              </span>
            </div>

            <div className="p-4 overflow-x-auto">
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                {viewMode === "history" && (
                  <MeterHistoryTable panels={mockScenarioMeter} pcsKey="ROLL 1" />
                )}

                {viewMode === "qc" && (
                  <MeterQCTable
                    detailsToDisplay={formatDetailsForQc(mockScenarioMeter)}
                    handleSelectGrade={handleSelectQcGrade}
                    handleOpenEditQC={() => {}}
                    selections={autoGradeEnabled ? { ...generateDefaultQcSelections(mockScenarioMeter), ...qcSelections } : qcSelections}
                    setDetailToDelete={() => {}}
                  />
                )}

                {viewMode === "mending" && (
                  <MeterMendingTable
                    displayItems={formatDetailsForQc(mockScenarioMeter).map((d, i) => ({
                      ...d,
                      displayNo: (i + 1).toString(),
                      meterDisplay: d.meter_kain || "-",
                      isGradable: true,
                      cacatDisplay: d.detail_masalah || d.keterangan_cacat || "-",
                    }))}
                    selections={autoGradeEnabled ? { ...generateDefaultMendingSelections(mockScenarioMeter), ...mendingSelections } : mendingSelections}
                    onSelectGrade={handleSelectMendingGrade}
                    onOpenDetail={() => {}}
                    onOpenEditDetail={() => {}}
                    onDeleteDetail={() => {}}
                  />
                )}

                {viewMode === "report" && (
                  <MendingReportScenarioCard
                    panels={mockScenarioMeter}
                    selections={autoGradeEnabled ? { ...generateDefaultMendingSelections(mockScenarioMeter), ...mendingSelections } : mendingSelections}
                    isMeter={true}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CALCULATION SCHEMES EXPLANATION */}
      {activeTab === "schemes" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-extrabold mb-2 border border-indigo-200">
                <Calculator className="w-4 h-4" />
                Bedah Skema Perhitungan
              </div>
              <h2 className="text-xl font-extrabold text-slate-800">
                Bagaimana Sistem Menghitung Angka di Halaman Inspeksi QC & Mending?
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Berikut adalah penjelasan lengkap mengenai logika di balik kolom KET, tombol Inspeksi QC, baris Subtotal Operator, dan baris TOTAL akhir:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Box 1: Kolom KET vs Kolom INSPEKSI QC */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                  Kolom KET (✓/X) vs Kolom INSPEKSI QC (✓, X, BS)
                </h3>
                <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <li>
                    <strong>Kolom KET (✓/X):</strong> Dihitung otomatis dari <em>inputan awal pegawai/mesin</em>. 
                    Bernilai hijau <span className="text-emerald-600 font-bold">✓</span> jika panel normal atau <em>Gagal Cacat</em>. 
                    Bernilai merah <span className="text-rose-600 font-bold">X</span> jika terdapat cacat kain, BS Awal, atau BS Akhir.
                  </li>
                  <li>
                    <strong>Kolom INSPEKSI QC (✓, X, BS):</strong> Pilihan hasil penilaian <em>Petugas QC</em>:
                    <div className="mt-1.5 pl-2 space-y-1">
                      <div>• <strong>Tombol ✓ (Grade 1 / Pass):</strong> Panel mulus lolos QC tanpa perlu diperbaiki.</div>
                      <div>• <strong>Tombol X (Grade 3 / Defect):</strong> Panel memiliki cacat kain dan dikirim ke bagian <strong>Mending</strong> untuk diperbaiki.</div>
                      <div>• <strong>Tombol BS (Grade 4 / Reject):</strong> Panel rusak parah yang langsung dibuang (BS).</div>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Box 2: Baris Subtotal Operator */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                  Baris Subtotal Produksi Operator
                </h3>
                <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <li>
                    <strong>Total Produksi (Group) Operator: N Panel:</strong>
                    Menghitung jumlah panel nomor asli yang dihasilkan operator tersebut. 
                    <em>Panel BS Awal, BS Akhir, dan panel BS tengah TIDAK dimasukkan ke dalam angka produksi ini.</em>
                  </li>
                  <li>
                    <strong>Angka Hijau di Bawah ✓:</strong> Jumlah panel milik operator tersebut yang diberi grade <strong>Pass (✓)</strong>.
                  </li>
                  <li>
                    <strong>Angka Merah di Bawah X:</strong> Jumlah panel milik operator tersebut yang masuk kategori <strong>Cacat/Mending (X)</strong>.
                  </li>
                  <li>
                    <strong>Angka Merah di Bawah BS:</strong> Jumlah panel milik operator tersebut yang berstatus <strong>BS</strong>.
                  </li>
                </ul>
              </div>

              {/* Box 3: Baris TOTAL di Bawah */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                  Baris TOTAL (N PANEL) di Paling Bawah
                </h3>
                <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <li>
                    <strong>TOTAL (N PANEL):</strong> <code>Total Gradable + Total BS</code> (Akumulasi seluruh panel fisik yang ada dalam potongan tersebut).
                  </li>
                  <li>
                    <strong>Kolom Hijau (Pass):</strong> Total panel seluruh operator yang berstatus <strong>✓ (Pass)</strong>.
                  </li>
                  <li>
                    <strong>Kolom Merah (Defect):</strong> Total panel seluruh operator yang berstatus <strong>X (Cacat/Mending)</strong>.
                  </li>
                  <li>
                    <strong>Kolom Merah (BS):</strong> Total panel seluruh operator yang berstatus <strong>BS</strong> (termasuk BS Awal dan BS Akhir).
                  </li>
                </ul>
              </div>

              {/* Box 4: Penentuan Overall Grade Potongan */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">4</span>
                  Penentuan Overall Grade (Grade Keseluruhan)
                </h3>
                <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <li>
                    Sesuai aturan di <code>AGENTS.md</code>:
                    <em>"Penentuan Grade Keseluruhan mengambil data SETELAH INSPECT (hasil mending), dan nilai panel BS AWAL serta BS AKHIR tidak disertakan dalam perhitungan total panel maupun total cacat."</em>
                  </li>
                  <li>
                    Jika semua panel setelah mending berstatus <strong>A</strong> = Potongan Grade <strong>A</strong>.
                  </li>
                  <li>
                    Jika ada panel berstatus <strong>B</strong> yang tidak bisa diperbaiki = Potongan Grade <strong>B</strong>.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BUSINESS RULES MATRIX */}
      {activeTab === "rules" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-200">
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-emerald-600" />
              Daftar Aturan Bisnis & Status Kepatuhan Tampilan
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Aturan baku yang didefinisikan dalam panduan sistem (.agents/AGENTS.md) dan verifikasi visualnya.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {[
              {
                rule: "Rule 1: Baris Pertama Wajib Terisi Lengkap",
                desc: "Di baris pertama data, kolom Tanggal, Group, dan Operator WAJIB terisi.",
                status: "PASS",
                testedIn: "Semua Skenario Panel",
              },
              {
                rule: "Rule 2: Kolom Tanggal & Group Hanya Muncul di Baris Pertama atau Saat Berbeda",
                desc: "Kolom tanggal dan group tidak berulang di setiap baris, kecuali jika tanggal berubah atau nama operator berbeda.",
                status: "PASS",
                testedIn: "Skenario 3 (Multi-Operator)",
              },
              {
                rule: "Rule 3: Kolom Operator Berisi Nama di Baris Pertama Operator Tersebut",
                desc: "Nama operator hanya muncul di baris pertama data operator tersebut.",
                status: "PASS",
                testedIn: "Skenario 1, 3",
              },
              {
                rule: "Rule 4: Label Istirahat Menampilkan 'Istirahat' di Kolom Operator",
                desc: "Jika berlabel istirahat, kolom operator bertuliskan 'Istirahat'. Nama operator backup tampil di kolom Keterangan Cacat.",
                status: "PASS",
                testedIn: "Skenario 4, 5",
              },
              {
                rule: "Rule 5: Istirahat di Baris Pertama Prioritas Nama Operator",
                desc: "Jika data istirahat berada di baris paling awal, prioritas kolom operator adalah nama operator utama.",
                status: "PASS",
                testedIn: "Skenario 5 (Istirahat di Baris Pertama)",
              },
              {
                rule: "Rule 6: Gagal Cacat adalah Centang Hijau (✓)",
                desc: "Peristiwa false alarm (gagal cacat) tidak dihitung sebagai cacat kain dan mendapatkan KET centang hijau serta teks abu-abu netral.",
                status: "PASS",
                testedIn: "Skenario 6 (Gagal Cacat)",
              },
              {
                rule: "Rule 7: BS Awal dan BS Akhir Dihitung Masing-Masing 1 Panel BS Individual",
                desc: "BS Awal & BS Akhir tidak digabung, dan tidak disertakan dalam hitungan Total Produksi.",
                status: "PASS",
                testedIn: "Skenario 2 (BS Awal & Akhir)",
              },
              {
                rule: "Rule 8: Penomoran Defect & Pengelompokan Blok",
                desc: "Cacat multi-item diberi nomor urut 1., 2., 3. dengan nomor blok tergabung (Blok 15, 22).",
                status: "PASS",
                testedIn: "Skenario 7 (Multi-Defect)",
              },
            ].map((item, idx) => (
              <div key={idx} className="p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800 text-sm">{item.rule}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                      Uji: {item.testedIn}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 max-w-3xl">{item.desc}</p>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-extrabold shrink-0">
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Edit QC untuk Playground */}
      {isEditModalOpen && editingDetail && (
        <QCEditDetailModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingDetail(null);
          }}
          detail={editingDetail}
          problemCategories={MOCK_QC_CATEGORIES}
          problemDetailsMap={MOCK_QC_DETAILS_MAP}
          allBatchDetails={[]}
          currentGrade={qcSelections[editingDetail.id || `${editingDetail.production_headers?.id}-${editingDetail.pcs_index}`] || 1}
          onSuccess={(detailId, newGrade, updatedData) => {
            if (newGrade !== undefined) {
              setQcSelections((prev) => ({ ...prev, [detailId]: newGrade }));
            }
            if (updatedData) {
              setCustomOverrides((prev) => ({
                ...prev,
                [detailId]: updatedData,
                [`${editingDetail.production_headers?.id}-${editingDetail.pcs_index}`]: updatedData,
              }));
            }
          }}
        />
      )}
    </div>
  );
}
