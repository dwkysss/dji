"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Loader2,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle,
  Eye,
  Scissors,
  Clock,
  HelpCircle,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import ProductTour, { ProductTourStep } from "@/components/ProductTour";
import MendingModal from "@/components/forms/MendingModal";
import ProductionDetailModal from "@/components/ProductionDetailModal";
import HeaderSummaryCard from "@/components/forms/HeaderSummaryCard";
import CompactHeaderCard from "@/components/forms/CompactHeaderCard";
import {
  getPendingMendingDetailsByDate,
  getMendingDetailsByGroup,
} from "@/actions/mending-actions";
import { deleteProductionDetailRow } from "@/actions/qc-actions";
import { getEmployeeHistoryDetail } from "@/actions/employee-actions";
import { Package, X, Trash2 } from "lucide-react";
import MeterMendingTable from "./components/MeterMendingTable";
import PanelMendingTable from "./components/PanelMendingTable";

const PROBLEM_DETAILS: Record<string, string[]> = {
  A: ["L1/L2/L3 Benang timbul putus", "Benang lolos", "Bolong corak", "Benang narik/Kendor", "Benang Nyilang", "Perbaikan/Beset benang Dasar", "Benang Kejepit/Jebol/Kusut", "Jalur benang"],
  B: ["Jarum pattern patah/bengkok", "Ganti Jacquard", "Ganti jarum Compoun Nedle, pattern", "Ngampul", "Ganti dari scaloop ke non scaloop atau sebaliknya", "Ngegaris/Stopline", "Keluar Jarum", "Ganti String bar", "Ganti PBO", "Pressan As beam kendor", "Tensi tensioner"],
  C: ["Loading design/Ganti Design", "Perbaikan corak/revisi", "Salah ganti design", "Error design", "Proofing/PCB", "Ganti Pattern Disk", "Ganti pick"],
  D: ["Ganti benang dasar L1/L2", "Salah ganti benang dasar", "Ganti benang Pattern Linner", "Ganti benang Pattern Heavy", "Ganti benang Pattern Shadow", "Ganti benang pattern keseluruhan (L,H,S)", "salah ganti benang pattern", "Ngelancarin", "Over Cone/Rewind", "Tunggu benang dasar dari warping", "Tunggu benang (benang belum datang)"],
  E: ["Error Servo Drive", "Ganti motor servo", "Sensor Benang/Laser Stop", "Perbaikan Eletrik lainnya", "Konsleting", "Perbaikan listrik"],
  F: ["Perbaikan cilynder Angin", "Ganti Bellow", "Perbaikan gear/Take Up Roll", "Ganti rantai/pertensi", "Ganti Black grip roll", "Ganti Oli", "Pelumasan/greace pada mesin", "Ganti Vanbelt", "Perawatan Panel Listrik", "Servis Overhaul"],
  G: ["Hari Libur", "Tidak ada order", "Tunggu info", "Demo", "Bencana/gempa/banjir", "Istirahat selama buka puasa"]
};

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
  const isFinishReport = h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "";
  if ((isIstirahat || isFinishReport) && (h.meter_akhir || h.meter_awal)) {
    const clean = cleanMeterVal(h.meter_akhir || h.meter_awal);
    const parsed = parseFloat(clean);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
};

const MENDING_TOUR_STEPS: ProductTourStep[] = [
  {
    target: "mending-header",
    title: "Proses Mending",
    description:
      "Mulai dari halaman ini untuk memilih batch produksi yang perlu diperbaiki oleh tim mending.",
  },
  {
    target: "mending-filter",
    title: "Pilih Batch",
    description:
      "Pilih mesin, desain, dan potongan lalu tekan Cari Batch untuk memuat antrean panel atau roll yang bermasalah.",
  },
  {
    target: "mending-pcs",
    title: "Pilih PCS",
    description:
      "Setelah batch ditemukan, pilih nomor PCS yang ingin dikerjakan dan perhatikan jam mulai mending yang tercatat otomatis.",
  },
  {
    target: "mending-details",
    title: "Beri Hasil Mending",
    description:
      "Cek detail masalah, lalu pilih Grade A, B, atau BS untuk setiap item sebelum mengirim rangkuman.",
  },
  {
    target: "mending-submit",
    title: "Kirim Inspeksi",
    description:
      "Tombol ini aktif setelah semua item pada PCS terpilih sudah diberi hasil mending.",
  },
];

export default function MendingPage() {
  const [searchTanggal, setSearchTanggal] = useState("");
  const [searchMesin, setSearchMesin] = useState("");
  const [searchPotongan, setSearchPotongan] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const [allDetails, setAllDetails] = useState<any[]>([]);
  const [activeMendingPcs, setActiveMendingPcs] = useState<{ nomor_mc: string, design_id: string, potongan_ke: string, pcs_index: string } | null>(null);
  const [fullActiveMendingDetails, setFullActiveMendingDetails] = useState<any[]>([]);
  const [startMendingTime, setStartMendingTime] = useState<string>("");

  const [selections, setSelections] = useState<Record<string, string>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  useEffect(() => {
    handleSearch(searchTanggal);
  }, [searchTanggal]);

  const handleSearch = async (tanggal: string) => {
    setIsSearching(true);
    setErrorMsg(null);
    setAllDetails([]);
    setActiveMendingPcs(null);
    setSelections({});
    setSearchMesin("");
    setSearchPotongan("");
    setCurrentPage(1);

    const queryTanggal = tanggal === "" ? "all" : tanggal;
    const res = await getPendingMendingDetailsByDate(queryTanggal);
    if (res.success && res.data) {
      setAllDetails(res.data);
      setPendingCount(res.pendingCount || 0);
    } else {
      setErrorMsg(res.error || "Gagal mencari data.");
      setPendingCount(0);
    }
    setIsSearching(false);
  };

  const uniqueMesins = React.useMemo(() => {
    return Array.from(new Set(allDetails.map(d => d.production_headers?.nomor_mc).filter(Boolean)));
  }, [allDetails]);

  const uniquePotongans = React.useMemo(() => {
    return Array.from(new Set(allDetails
      .filter(d => !searchMesin || d.production_headers?.nomor_mc === searchMesin)
      .map(d => d.production_headers?.potongan_ke)
      .filter(Boolean)));
  }, [allDetails, searchMesin]);

  const groupedPcsList = React.useMemo(() => {
    const map = new Map<string, any>();
    allDetails.forEach((d: any) => {
      const h = d.production_headers;
      if (searchMesin && String(h?.nomor_mc) !== String(searchMesin)) return;
      if (searchPotongan && String(h?.potongan_ke) !== String(searchPotongan)) return;

      const key = `${h?.nomor_mc}_${h?.design_id}_${h?.potongan_ke}_${d.pcs_index}`;
      if (!map.has(key)) {
        map.set(key, {
          nomor_mc: h?.nomor_mc,
          design_id: h?.design_id,
          potongan_ke: h?.potongan_ke,
          pcs_index: d.pcs_index,
          meter_kain: d.meter_kain || null,
          header: h,
          detailsCount: 0,
          totalHasilProduksi: 0
        });
      }
      const group = map.get(key);
      group.detailsCount++;
      group.totalHasilProduksi += (d.jml_hasil_produksi || 0);
      if (d.meter_kain) group.meter_kain = d.meter_kain;
    });
    return Array.from(map.values());
  }, [allDetails, searchMesin, searchPotongan]);

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(groupedPcsList.length / ITEMS_PER_PAGE);
  const currentPcsList = React.useMemo(() => {
    return groupedPcsList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [groupedPcsList, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchMesin, searchPotongan, searchTanggal]);

  const refreshActiveMendingDetails = async (mc: string, des: string, pot: string, pcs: string, initSelections: boolean = false) => {
    const res = await getMendingDetailsByGroup(mc, des, pot, pcs);
    if (res.success && res.data) {
      setFullActiveMendingDetails(res.data);
      
      if (initSelections) {
        const initialSelections: Record<string, string> = {};
        res.data.forEach((item: any) => {
          const hasDefect = item.indikator_stop || (item.kategori_masalah && item.kategori_masalah.trim() !== "");
          if (item.final_inspection_id === 4) {
            initialSelections[item.id] = "BS";
          } else if (item.final_inspection_id === 3) {
            initialSelections[item.id] = "B";
          } else {
            if (!hasDefect) {
              initialSelections[item.id] = "A";
            } else {
              initialSelections[item.id] = "B";
            }
          }
        });
        setSelections(initialSelections);
      }
    }
  };

  const handleStartMending = async (nomor_mc: string, design_id: string, potongan_ke: string, pcs_index: string) => {
    setActiveMendingPcs({ nomor_mc: String(nomor_mc), design_id: String(design_id), potongan_ke: String(potongan_ke), pcs_index: String(pcs_index) });
    setSelections({});
    
    await refreshActiveMendingDetails(String(nomor_mc), String(design_id), String(potongan_ke), String(pcs_index), true);
    
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    setStartMendingTime(`${hh}:${mm}`);
  };

  const [detailToDelete, setDetailToDelete] = useState<{ id: string, name: string } | null>(null);
  const [isDeletingDetail, setIsDeletingDetail] = useState(false);

  const detailsToDisplay = React.useMemo(() => {
    if (!fullActiveMendingDetails) return [];
    
    return [...fullActiveMendingDetails].sort((a: any, b: any) => {
      const hA = a.production_headers || {};
      const hB = b.production_headers || {};
      const panelA = hA.panel_no;
      const panelB = hB.panel_no;

      if (panelA === "METERAN" || panelB === "METERAN") {
        // Urutkan berdasarkan header (sesi operator) via tanggal_jam
        const hjA = String(hA.tanggal_jam || "");
        const hjB = String(hB.tanggal_jam || "");
        if (hjA !== hjB) return hjA.localeCompare(hjB);

        // Dalam sesi operator yang sama, urutkan berdasarkan meter_kain
        // Baris ISTIRAHAT / FINISH tanpa meter_kain diletakkan di akhir grup
        const isSpecialA = ((!!a.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") || !!a.kategori_masalah?.toUpperCase().includes("ISTIRAHAT"))
              && !a.kategori_masalah && !a.detail_masalah)
          || (hA.meter_akhir !== null && hA.meter_akhir !== undefined
              && String(hA.meter_akhir).trim() !== ""
              && (a.meter_kain === null || a.meter_kain === undefined));
        const isSpecialB = ((!!b.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") || !!b.kategori_masalah?.toUpperCase().includes("ISTIRAHAT"))
              && !b.kategori_masalah && !b.detail_masalah)
          || (hB.meter_akhir !== null && hB.meter_akhir !== undefined
              && String(hB.meter_akhir).trim() !== ""
              && (b.meter_kain === null || b.meter_kain === undefined));

        if (isSpecialA && !isSpecialB) return 1;
        if (!isSpecialA && isSpecialB) return -1;
        if (isSpecialA && isSpecialB) return 0;

        const valA = getActualMeter(a, hA);
        const valB = getActualMeter(b, hB);
        const mA = valA !== null ? valA : Infinity;
        const mB = valB !== null ? valB : Infinity;
        if (mA === Infinity && mB === Infinity) return 0;
        return mA - mB;
      } else {
        const numA = parseInt(panelA, 10);
        const numB = parseInt(panelB, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          if (numA !== numB) return numA - numB;
        }
        return String(panelA || "").localeCompare(String(panelB || ""), undefined, { numeric: true });
      }
    });
  }, [fullActiveMendingDetails]);

  const isMeteranBatch = detailsToDisplay.length > 0 && detailsToDisplay[0]?.production_headers?.panel_no === "METERAN";

  const displayItems = React.useMemo(() => {
    if (!isMeteranBatch) {
      const processed = detailsToDisplay.map((item) => {
        const h = item.production_headers || {};
        const opr = h.operators?.nama_operator || h.pic || "";
        const grp = h.groups?.nama_grup || "";
        const tgl = h.tgl || "";
        const operatorStr = (grp ? `(${grp}) ` : '') + opr;

        const isIstirahat = (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT");
        const isFinish = item.keterangan_cacat === "FINISH" || item.production_headers?.panel_no === "FINISH";
        const isStart = item.keterangan_cacat === "START" || item.production_headers?.panel_no === "START";
        const isGradable = !isFinish && !isStart;

        let extractedBackupOp = h.operator_backup || "";
        if (!extractedBackupOp && item.keterangan_cacat) {
          const match = item.keterangan_cacat.match(/\(Backup:\s*([^)]+)\)/i);
          if (match && match[1]) {
            extractedBackupOp = match[1].trim();
          }
        }

        let displayDetail = item.detail_masalah || "";
        let displayKeterangan = item.keterangan_cacat || "";
        let oprStr = opr;
        
        if (displayKeterangan.includes("ISTIRAHAT")) {
          oprStr = "Istirahat";
          displayKeterangan = displayKeterangan.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
          displayKeterangan = displayKeterangan.replace(/^,\s*|\s*,\s*$/g, "");
        }

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
            for (let i = 0; i < cacatLines.length; i++) {
              cacatLines[i] = cacatLines[i] + " [TAMBAHAN QC]";
            }
          }
        }

        const cacatText = cacatLines.join("\n");

        return {
          item,
          isIstirahat,
          isFinish,
          isStart,
          isGradable,
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
      let lastTgl = "";
      let lastGrp = "";
      let lastOpr = "";

      processed.forEach((p, i) => {
        const { item, isIstirahat, isFinish, isStart, isGradable, opr, grp, tgl, operatorStr, oprStr, cacatText } = p;

        if (isGradable) {
          currentOpCount += 1;
          currentOpIds.push(item.id);
        }

        let showTgl = true;
        let showGrp = true;
        let showOpr = true;

        if (tgl === lastTgl) showTgl = false;
        if (grp === lastGrp) showGrp = false;

        if (isIstirahat) {
          showTgl = false;
          showGrp = false;
          showOpr = true;
        } else {
          let prevActualOprStr = "-";
          for (let k = items.length - 1; k >= 0; k--) {
            const pItem = items[k];
            if (!pItem.isTotalRow && !pItem.isIstirahat) {
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
        lastOpr = isIstirahat ? "Istirahat" : opr;

        items.push({
          ...item,
          isMeter: false,
          isStartRow: false,
          isIstirahat,
          isFinishReport: isFinish,
          displayNo: item.production_headers?.panel_no || "-",
          meterDisplay: "-",
          cacatDisplay: cacatText,
          backupOpName: p.backupOpName,
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
              countA: currentOpIds.filter(id => selections[id] === "A").length,
              countB: currentOpIds.filter(id => selections[id] === "B").length,
              countBS: currentOpIds.filter(id => selections[id] === "BS").length,
            });
          }
          currentOpCount = 0;
          currentOpIds = [];
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

    // cleanMeterVal is defined globally at the top

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
      const hasIstirahatRaw = (item.keterangan_cacat || "").toUpperCase().includes("ISTIRAHAT") || (item.kategori_masalah || "").toUpperCase().includes("ISTIRAHAT");
      const hasIstirahat = hasIstirahatRaw && !hasRealDefects;
      const isIstirahat = hasIstirahat && !item.kategori_masalah && !item.detail_masalah;
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
  }, [detailsToDisplay, isMeteranBatch, selections]);

  const gradableItems = React.useMemo(() => {
    return displayItems.filter((item: any) => item.isGradable);
  }, [displayItems]);

  const handleDeleteDetail = async () => {
    if (!detailToDelete) return;
    setIsDeletingDetail(true);
    const res = await deleteProductionDetailRow(detailToDelete.id);
    if (res.success) {
      setDetailToDelete(null);
      handleSearch(searchTanggal);
      if (activeMendingPcs) {
        refreshActiveMendingDetails(activeMendingPcs.nomor_mc, activeMendingPcs.design_id, activeMendingPcs.potongan_ke, activeMendingPcs.pcs_index);
      }
    } else {
      alert("Gagal menghapus data: " + res.error);
    }
    setIsDeletingDetail(false);
  };

  const handleSelectGrade = (detailId: string, grade: string) => {
    setSelections((prev) => ({ ...prev, [detailId]: grade }));
  };

  useEffect(() => {
    if (!activeMendingPcs) return;
    const autoSelections: Record<string, string> = {};
    for (const d of detailsToDisplay) {
      if (d.final_inspection_id === 1 || d.final_inspection_id === 2) {
        autoSelections[d.id] = "A"; // Ceklis → auto Grade A
      } else if (d.final_inspection_id === 3) {
        autoSelections[d.id] = "B"; // Silang → auto Grade B
      } else if (d.final_inspection_id === 4) {
        autoSelections[d.id] = "BS"; // BS → auto Grade BS
      }
    }
    setSelections((prev) => ({ ...autoSelections, ...prev }));
  }, [activeMendingPcs, detailsToDisplay]);

  const handleOpenDetail = async (headerId: string) => {
    setDetailModalOpen(true);
    setIsDetailLoading(true);
    setDetailData(null);
    try {
      const res = await getEmployeeHistoryDetail(headerId);
      if (res.success && res.data) {
        setDetailData(res.data);
      } else {
        alert("Gagal memuat detail: " + (res.error || "Unknown Error"));
        setDetailModalOpen(false);
      }
    } catch (err) {
      alert("Terjadi kesalahan jaringan.");
      setDetailModalOpen(false);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const isAllSelected = gradableItems.length > 0 && gradableItems.every((d) => selections[d.id]);
  const totalGradable = gradableItems.length;
  const totalA = gradableItems.filter((item: any) => selections[item.id] === "A").length;
  const totalB = gradableItems.filter((item: any) => selections[item.id] === "B").length;
  const totalBS = gradableItems.filter((item: any) => selections[item.id] === "BS").length;
  const firstDetail = detailsToDisplay.length > 0 ? detailsToDisplay[0] : null;
  const h = firstDetail?.production_headers || {};
  const compactProps = {
    nomorMc: h.nomor_mc || "-",
    shiftName: h.groups?.nama_grup || "-",
    operatorName: h.operators?.nama_operator || h.pic || "-",
    design: h.design_id || "-",
    pcsCount: detailsToDisplay.length,
    panelPotongan: `${h.panel_no || "-"} / ${h.potongan_ke || "-"}`,
    courseRpm: `${h.course || "-"} / ${h.rpm || "-"}`,
    noCustomer: h.no_customer || "-",
    noOrder: h.no_order_barang || "-",
    tanggalPotong: h.tanggal_potong ? (h.tanggal_potong.includes(":") ? h.tanggal_potong : (h.tanggal_jam ? `${h.tanggal_potong} ${h.tanggal_jam.includes("T") ? h.tanggal_jam.split("T")[1].split(".")[0] : (h.tanggal_jam.split(" ")[1] || "00:00:00")}` : h.tanggal_potong)) : "-",
    statusMatching: h.status_matching || "-",
    pick: String(h.pick || "-"),
    benangDasar: h.jenis_benang_dasar || "-",
    liner: h.liner || "-",
    heavy: h.heavy || "-",
    shadow: h.shadow || "-",
    pinggiran: h.pinggiran || "-",
    tanggalProduksi: h.tanggal_jam || h.created_at || h.tgl || "-",
    rollNo: firstDetail?.roll_no || "-"
  };

  if (activeMendingPcs) {
    return (
      <div className="w-full max-w-6xl mx-auto pb-10 animate-fadeIn">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveMendingPcs(null)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <Scissors className="w-6 h-6 text-rose-500" />
              Mending PCS Ke-{activeMendingPcs.pcs_index}
            </h1>
          </div>
          {startMendingTime && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mulai Mending</span>
              <div className="h-11 px-6 rounded-xl bg-sky-50 border border-sky-100 text-sm font-black text-sky-700 flex items-center gap-2 shadow-sm">
                <Clock className="w-4 h-4 text-sky-500" />
                {startMendingTime}
              </div>
            </div>
          )}
        </div>

        <div className="mb-6">
          <CompactHeaderCard {...compactProps} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {detailsToDisplay.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                <CheckCircle className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Tidak ada panel/roll untuk di-mending.</h3>
            </div>
          ) : detailsToDisplay.length === 1 && !detailsToDisplay[0].kategori_masalah ? (
            <div className="p-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 border border-emerald-100">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">PCS Normal Bebas Cacat</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-sm">
                PCS ini tidak memiliki catatan masalah dari proses QC. Anda dapat langsung menyelesaikan mending.
              </p>
              
              <button
                onClick={() => {
                  handleSelectGrade(detailsToDisplay[0].id, "A");
                  setIsModalOpen(true);
                }}
                className="h-12 px-8 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Selesaikan Mending Cepat
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                {isMeteranBatch ? (
                  <MeterMendingTable
                    displayItems={displayItems}
                    selections={selections}
                    onSelectGrade={handleSelectGrade}
                    onOpenDetail={handleOpenDetail}
                    onDeleteDetail={setDetailToDelete}
                  />
                ) : (
                  <PanelMendingTable
                    displayItems={displayItems}
                    selections={selections}
                    onSelectGrade={handleSelectGrade}
                    onOpenDetail={handleOpenDetail}
                    onDeleteDetail={setDetailToDelete}
                    totalGradable={totalGradable}
                    totalA={totalA}
                    totalB={totalB}
                    totalBS={totalBS}
                  />
                )}
              </div>
              <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end">
                <button
                  disabled={!isAllSelected}
                  onClick={() => setIsModalOpen(true)}
                  className={`h-12 px-8 rounded-xl font-bold text-sm text-white flex items-center gap-2 transition-all duration-300 ${isAllSelected ? "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 active:scale-95" : "bg-slate-300 cursor-not-allowed"}`}
                >
                  <CheckCircle className="w-5 h-5" />
                  Isi Rangkuman & Kirim Inspeksi
                </button>
              </div>
            </>
          )}
        </div>
        
        {isModalOpen && (
          <MendingModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            headerData={{ details: detailsToDisplay }}
            selections={selections}
            detailData={detailsToDisplay}
            startMendingTime={startMendingTime}
            onSuccess={() => {
              setIsModalOpen(false);
              setActiveMendingPcs(null);
              handleSearch(searchTanggal);
            }}
          />
        )}
        
        <ProductionDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          detailData={detailData}
          isLoading={isDetailLoading}
          hideEdit={true}
        />
        
        {/* Pop up modal hapus rincian */}
        {detailToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
              <div className="flex items-center gap-3 mb-4 text-rose-600">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold">Hapus Baris Data?</h3>
              </div>
              
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Anda yakin ingin menghapus baris rincian data ini secara permanen?<br/>
                <span className="font-semibold block mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100 text-slate-800">
                  {detailToDelete.name}
                </span>
              </p>
              
              <div className="flex gap-3 justify-end mt-4">
                <button
                  onClick={() => setDetailToDelete(null)}
                  disabled={isDeletingDetail}
                  className="px-4 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteDetail}
                  disabled={isDeletingDetail}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isDeletingDetail ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Ya, Hapus Data
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Table View (Main Page)
  return (
    <div className="w-full max-w-6xl mx-auto pb-10">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Scissors className="w-6 h-6 text-rose-500" />
            Proses Mending
          </h1>
          <p className="text-sm font-semibold text-slate-500">
            Total antrean baris yang belum dimending: <span className="text-rose-500 font-bold">{groupedPcsList.length} Antrean</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsTourOpen(true)}
          className="h-11 px-4 rounded-full bg-[#0070bc] hover:bg-[#004777] text-white text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2 self-start"
        >
          <HelpCircle className="w-4 h-4" /> Tutorial
        </button>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 items-end gap-4 w-full">
          <div className="flex flex-col gap-1 w-full">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
              <span>Tanggal</span>
            </label>
            <input
              type="date"
              value={searchTanggal}
              onChange={(e) => setSearchTanggal(e.target.value)}
              className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-rose-400 focus:bg-white outline-none w-full"
            />
          </div>
          <div className="flex flex-col gap-1 w-full">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Mesin
            </label>
            <select
              value={searchMesin}
              onChange={(e) => setSearchMesin(e.target.value)}
              className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-rose-400 focus:bg-white outline-none w-full"
            >
              <option value="">Semua Mesin</option>
              {uniqueMesins.map(m => (
                <option key={String(m)} value={String(m)}>{String(m)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 w-full">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Potongan
            </label>
            <select
              value={searchPotongan}
              onChange={(e) => setSearchPotongan(e.target.value)}
              className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-rose-400 focus:bg-white outline-none w-full"
            >
              <option value="">Semua Potongan</option>
              {uniquePotongans.map(p => (
                <option key={String(p)} value={String(p)}>{String(p)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => handleSearch(searchTanggal)}
            disabled={isSearching}
            className="h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm shrink-0 w-full"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Cari Data
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fadeIn">
        {groupedPcsList.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Package className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-1">
              Tidak Ada Antrean Mending
            </h3>
            <p className="text-sm text-slate-500">
              Tidak ditemukan data produksi yang perlu dimending pada tanggal ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="px-3 py-3 lg:px-6 lg:py-4">Tanggal & Waktu</th>
                  <th className="px-3 py-3 lg:px-6 lg:py-4">Nomor Mesin</th>
                  <th className="px-3 py-3 lg:px-6 lg:py-4">Desain</th>
                  <th className="px-3 py-3 lg:px-6 lg:py-4">Potongan</th>
                  <th className="px-3 py-3 lg:px-6 lg:py-4 text-center">PCS Ke</th>
                  <th className="px-3 py-3 lg:px-6 lg:py-4 text-center">Jml Baris</th>
                  <th className="px-3 py-3 lg:px-6 lg:py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                {currentPcsList.map((g: any) => (
                  <tr key={`${g.nomor_mc}_${g.design_id}_${g.potongan_ke}_${g.pcs_index}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-3 lg:px-6 lg:py-4">
                      <div className="font-bold text-slate-800">
                        {g.header?.tgl || "-"}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {g.header?.tanggal_jam 
                          ? new Date(g.header.tanggal_jam).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) 
                          : "-"}
                      </div>
                    </td>
                    <td className="px-3 py-3 lg:px-6 lg:py-4">
                      <div className="inline-flex items-center min-w-[3rem] h-8 px-3 rounded-lg bg-[#0070bc]/10 text-[#0070bc] font-bold">
                        {g.header?.nomor_mc}
                      </div>
                    </td>
                    <td className="px-3 py-3 lg:px-6 lg:py-4">
                      <div className="text-slate-800 font-bold flex items-center gap-2">
                        {g.header?.design_id}
                        {g.header?.panel_no === "METERAN" ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-black bg-purple-100 text-purple-700 uppercase tracking-wider">METERAN</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">PANEL</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 lg:px-6 lg:py-4">
                      <div className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                        {g.header?.potongan_ke || "-"}
                      </div>
                    </td>
                    <td className="px-3 py-3 lg:px-6 lg:py-4 text-center">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 font-bold text-slate-600">
                        {g.pcs_index}
                      </div>
                      {g.meter_kain && (
                        <div className="text-[10px] text-slate-500 font-bold mt-1.5 uppercase tracking-wider">
                          {g.meter_kain}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 lg:px-6 lg:py-4 text-center">
                      <span className="text-slate-500">{g.detailsCount} baris</span>
                    </td>
                    <td className="px-3 py-3 lg:px-6 lg:py-4 text-center">
                      <button
                        onClick={() => handleStartMending(g.nomor_mc, g.design_id, g.potongan_ke, g.pcs_index)}
                        className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-xs rounded-lg transition-all"
                      >
                        Mulai Mending
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                <span className="text-xs font-medium text-slate-500">
                  Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, groupedPcsList.length)} dari {groupedPcsList.length} antrean
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${currentPage === p ? "bg-rose-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ProductTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        steps={MENDING_TOUR_STEPS}
      />
    </div>
  );
}
