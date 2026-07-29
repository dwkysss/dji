"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Loader2,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle,
  Package,
  X,
  Plus,
  Clock,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Box,
} from "lucide-react";
import QCInspectionModal from "@/components/forms/QCInspectionModal";
import ProductionDetailModal from "@/components/ProductionDetailModal";
import ProductTour, { ProductTourStep } from "@/components/ProductTour";
import {
  getAvailableQCFilters,
  addQCDefectDetail,
  getAllPendingQCDetails,
  getPendingQCDetailsByBatch,
  insertMissingPanel,
  deleteProductionDetailRow,
} from "@/actions/qc-actions";
import { getEmployeeHistoryDetail } from "@/actions/employee-actions";
import PanelQCTable from "./components/PanelQCTable";
import MeterQCTable from "./components/MeterQCTable";
import CompactHeaderCard from "@/components/forms/CompactHeaderCard";

// Problem categories matching ContinuousForm
const QC_INSPECTION_TOUR_STEPS: ProductTourStep[] = [
  {
    target: "qc-inspection-header",
    title: "Inspeksi QC Batch",
    description:
      "Halaman ini dipakai untuk mencari batch produksi yang menunggu inspeksi QC.",
  },
  {
    target: "qc-inspection-filter",
    title: "Filter Data",
    description:
      "Gunakan filter Tanggal dan Mesin untuk mencari antrean QC.",
  },
  {
    target: "qc-inspection-results",
    title: "Panel untuk Dinilai",
    description:
      "Nilai setiap panel dengan ceklis atau silang. Data normal otomatis cenderung dipilih ceklis, data bermasalah dipilih silang.",
  },
  {
    target: "qc-inspection-submit",
    title: "Kirim Inspeksi",
    description:
      "Setelah semua panel punya hasil, lanjut isi rangkuman dan kirim inspeksi.",
  },
];

const PROBLEM_CATEGORIES = [
  { id: "A", name: "Kode A: Masalah dan Perbaikan Benang" },
  { id: "B", name: "Kode B: Perbaikan Jarum dan Element Rajutan (Mechanical)" },
  { id: "C", name: "Kode C: Pengaturan dan Design stup" },
  { id: "D", name: "Kode D: Bahan Baku dan penggantian Benang" },
  { id: "E", name: "Kode E: Masalah Kelistrikan" },
  { id: "F", name: "Kode F: Perawatan Mesin,Perbaikan Mekanik (maintenance)" },
  { id: "G", name: "Kode G: Faktor Eksternal dan Non-Teknis" },
];

export const PROBLEM_DETAILS: Record<string, string[]> = {
  A: ["L1/L2/L3 Benang timbul putus", "Benang lolos", "Bolong corak", "Benang narik/Kendor", "Benang Nyilang", "Perbaikan/Beset benang Dasar", "Benang Kejepit/Jebol/Kusut", "Jalur benang"],
  B: ["Jarum pattern patah/bengkok", "Ganti Jacquard", "Ganti jarum Compoun Nedle, pattern", "Ngampul", "Ganti dari scaloop ke non scaloop atau sebaliknya", "Ngegaris/Stopline", "Keluar Jarum", "Ganti String bar", "Ganti PBO", "Pressan As beam kendor", "Tensi tensioner"],
  C: ["Loading design/Ganti Design", "Perbaikan corak/revisi", "Salah ganti design", "Error design", "Proofing/PCB", "Ganti Pattern Disk", "Ganti pick"],
  D: ["Ganti benang dasar L1/L2", "Salah ganti benang dasar", "Ganti benang Pattern Linner", "Ganti benang Pattern Heavy", "Ganti benang Pattern Shadow", "Ganti benang pattern keseluruhan (L,H,S)", "salah ganti benang pattern", "Ngelancarin", "Over Cone/Rewind", "Tunggu benang dasar dari warping", "Tunggu benang (benang belum datang)"],
  E: ["Error Servo Drive", "Ganti motor servo", "Sensor Benang/Laser Stop", "Perbaikan Eletrik lainnya", "Konsleting", "Perbaikan listrik"],
  F: ["Perbaikan cilynder Angin", "Ganti Bellow", "Perbaikan gear/Take Up Roll", "Ganti rantai/pertensi", "Ganti Black grip roll", "Ganti Oli", "Pelumasan/greace pada mesin", "Ganti Vanbelt", "Perawatan Panel Listrik", "Servis Overhaul"],
  G: ["Hari Libur", "Tidak ada order", "Tunggu info", "Demo", "Bencana/gempa/banjir", "Istirahat selama buka puasa", "Tunggu Sparepart", "Mati Listrik"],
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

  // Scan other details in the same header (from pre-fetched data)
  if (h && h.production_details && h.production_details.length > 0) {
    for (const d of h.production_details) {
      if (d.meter_kain !== null && d.meter_kain !== undefined && String(d.meter_kain).trim() !== "") {
        const clean = cleanMeterVal(d.meter_kain);
        const parsed = parseFloat(clean);
        if (!isNaN(parsed)) return parsed;
      }
      if (d.detail_masalah) {
        const meterMatch = d.detail_masalah.match(/\(Titik:\s*([A-Za-z0-9\s.\-]+)\)/i);
        if (meterMatch && meterMatch[1]) {
          const clean = cleanMeterVal(meterMatch[1]);
          const parsed = parseFloat(clean);
          if (!isNaN(parsed)) return parsed;
        }
      }
    }
  }

  const isIstirahat = (!!item.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") || 
                       !!item.kategori_masalah?.toUpperCase().includes("ISTIRAHAT")) && 
                      !item.kategori_masalah && !item.detail_masalah &&
                      h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "";
  const isFinishReport = h.meter_akhir !== null && h.meter_akhir !== undefined && String(h.meter_akhir).trim() !== "";
  if ((isIstirahat || isFinishReport) && (h.meter_akhir || h.meter_awal)) {
    const clean = cleanMeterVal(h.meter_akhir || h.meter_awal);
    const parsed = parseFloat(clean);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
};

const formatLastInputDate = (isoString: string | null) => {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch (e) {
    return "-";
  }
};

const formatLastInputTime = (isoString: string | null) => {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "-";
  }
};

export default function QCPage() {
  const [searchTanggal, setSearchTanggal] = useState("");
  const [searchMesin, setSearchMesin] = useState("");
  const [searchPotongan, setSearchPotongan] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTourOpen, setIsTourOpen] = useState(false);
  
  const [allDetails, setAllDetails] = useState<any[]>([]);
  const [activeQcPcs, setActiveQcPcs] = useState<{ nomor_mc: string, design_id: string, potongan_ke: string, pcs_index: string } | null>(null);
  const [fullActiveQcDetails, setFullActiveQcDetails] = useState<any[]>([]);
  const [startInspectTime, setStartInspectTime] = useState<string>("");

  const [availableFilters, setAvailableFilters] = useState<any[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);

  // Map of detailId -> finalInspectionId (1, 2, or 3)
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailToDelete, setDetailToDelete] = useState<any>(null);
  const [insertPanelMode, setInsertPanelMode] = useState<"insert" | "append" | null>(null);
  const [insertPanelAt, setInsertPanelAt] = useState<string>("");
  const [isInsertingPanel, setIsInsertingPanel] = useState(false);
  const [insertPanelError, setInsertPanelError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [insertPanelHasDefect, setInsertPanelHasDefect] = useState(false);
  const [insertPanelIsBs, setInsertPanelIsBs] = useState(false);

  // States for defect selection within Insert Panel Modal
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<Record<string, string[]>>({});
  const [inputBloks, setInputBloks] = useState<Record<string, string>>({});
  const [insertPanelKeterangan, setInsertPanelKeterangan] = useState<string>("");

  // Add Defect Modal State (METERAN only)
  const [isDefectModalOpen, setIsDefectModalOpen] = useState(false);
  const [defectMeterKain, setDefectMeterKain] = useState("");
  const [defectKategori, setDefectKategori] = useState<string[]>([]);
  const [defectDetailMap, setDefectDetailMap] = useState<Record<string, string[]>>({});
  const [defectKeterangan, setDefectKeterangan] = useState("");
  const [isSubmittingDefect, setIsSubmittingDefect] = useState(false);
  const [defectError, setDefectError] = useState<string | null>(null);

  useEffect(() => {
    const loadFilters = async () => {
      const res = await getAvailableQCFilters();
      if (res.success && res.data) {
        setAvailableFilters(res.data);
      }
      setIsLoadingFilters(false);
    };
    loadFilters();
  }, []);

  // Auto-select BS (value 4) for panels with jml_hasil_produksi === 0
  useEffect(() => {
    if (fullActiveQcDetails.length > 0) {
      setSelections((prev) => {
        let changed = false;
        const next = { ...prev };
        fullActiveQcDetails.forEach((d) => {
          if (d.jml_hasil_produksi === 0 && next[d.id] !== 4) {
            next[d.id] = 4;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [fullActiveQcDetails]);

  const availableTanggals = Array.from(new Set(availableFilters.map((f) => f.tgl))).sort().reverse();
  const availableMesins = Array.from(new Set(availableFilters.map((f) => f.nomor_mc))).sort();

  useEffect(() => {
    handleSearch(searchTanggal);
  }, [searchTanggal]);

  const handleSearch = async (tanggal: string) => {
    setIsSearching(true);
    setErrorMsg(null);
    setAllDetails([]);
    setActiveQcPcs(null);
    setSelections({});
    setCurrentPage(1);

    const res = await getAllPendingQCDetails(tanggal || undefined);
    
    if (res.success && res.data) {
      setAllDetails(res.data);
    } else {
      setErrorMsg(res.error || "Gagal mencari data.");
    }
    setIsSearching(false);
  };

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
          totalHasilProduksi: 0,
          lastInputTime: h?.tanggal_jam || null
        });
      }
      const group = map.get(key);
      group.detailsCount++;
      group.totalHasilProduksi += (d.jml_hasil_produksi || 0);
      if (d.meter_kain) group.meter_kain = d.meter_kain;
      if (h?.tanggal_jam) {
        if (!group.lastInputTime || new Date(h.tanggal_jam) > new Date(group.lastInputTime)) {
          group.lastInputTime = h.tanggal_jam;
        }
      }
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
  }, [searchMesin, searchTanggal, searchPotongan]);

  const handleStartQC = async (nomor_mc: string, design_id: string, potongan_ke: string, pcs_index: string) => {
    setActiveQcPcs({ nomor_mc: String(nomor_mc), design_id: String(design_id), potongan_ke: String(potongan_ke), pcs_index: String(pcs_index) });
    setSelections({});
    
    // Fetch details for specific PCS directly to ensure we have fresh data
    const res = await getPendingQCDetailsByBatch(nomor_mc, design_id, potongan_ke);
    if (res.success && res.data) {
       const filteredByPcs = res.data.filter((d: any) => String(d.pcs_index) === String(pcs_index));
       setFullActiveQcDetails(filteredByPcs);
    }
    
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    setStartInspectTime(`${hh}:${mm}`);
  };

  const detailsToDisplay = React.useMemo(() => {
    if (!fullActiveQcDetails) return [];
    
    return [...fullActiveQcDetails].sort((a: any, b: any) => {
      const hA = a.production_headers || {};
      const hB = b.production_headers || {};
      const panelA = hA.panel_no;
      const panelB = hB.panel_no;

      if (panelA === "METERAN" || panelB === "METERAN") {
        const valA = getActualMeter(a, hA);
        const valB = getActualMeter(b, hB);
        const mA = valA !== null ? valA : Infinity;
        const mB = valB !== null ? valB : Infinity;

        if (mA !== mB) {
          return mA - mB;
        }

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

        const hjA = String(hA.tanggal_jam || "");
        const hjB = String(hB.tanggal_jam || "");
        return hjA.localeCompare(hjB);
      } else {
        const numA = parseInt(panelA, 10);
        const numB = parseInt(panelB, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          if (numA !== numB) return numA - numB;
        }
        return String(panelA || "").localeCompare(String(panelB || ""), undefined, { numeric: true });
      }
    });
  }, [fullActiveQcDetails]);

  const isMeteranBatch = detailsToDisplay.length > 0 && detailsToDisplay[0]?.production_headers?.panel_no === "METERAN";
  const meteranHeaderId = detailsToDisplay.length > 0 ? detailsToDisplay[0]?.header_id : null;

  useEffect(() => {
    if (detailsToDisplay.length > 0) {
      setSelections((prev) => {
        const newSelections = { ...prev };
        let hasChanges = false;

        detailsToDisplay.forEach((d) => {
          let cleanKet = d.keterangan_cacat || "";
          cleanKet = cleanKet.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").replace(/\[TAMBAHAN QC\]/gi, "").replace(/^,\s*|\s*,\s*$/g, "").trim();
          const hasProblem = !!d.kategori_masalah || !!d.detail_masalah || cleanKet.length > 0;
          
          if (!hasProblem && !newSelections[d.id]) {
            newSelections[d.id] = 1;
            hasChanges = true;
          }
          if (hasProblem && !newSelections[d.id]) {
            newSelections[d.id] = 3;
            hasChanges = true;
          }
        });

        return hasChanges ? newSelections : prev;
      });
    }
  }, [detailsToDisplay]);

  const handleSelectGrade = (detailId: string, grade: number) => {
    setSelections((prev) => ({ ...prev, [detailId]: grade }));
  };

  const isAllSelected = detailsToDisplay.length > 0 && detailsToDisplay.every((d) => selections[d.id]);
  
  const handleDefectToggleKategori = (catId: string) => {
    setDefectKategori((prev) => {
      const isChecking = !prev.includes(catId);
      if (isChecking) {
        return [...prev, catId];
      } else {
        setDefectDetailMap((old) => {
          const next = { ...old };
          delete next[catId];
          return next;
        });
        return prev.filter((c) => c !== catId);
      }
    });
  };

  const handleSubmitDefect = async () => {
    if (!defectMeterKain) { setDefectError("Posisi Meter Kain wajib diisi."); return; }
    if (parseFloat(defectMeterKain) < 0) { setDefectError("Posisi Meter Kain tidak boleh bernilai negatif."); return; }
    if (defectKategori.length === 0) { setDefectError("Pilih minimal 1 Kategori Masalah."); return; }
    const missingDetails = defectKategori.some((cat) => !defectDetailMap[cat] || defectDetailMap[cat].length === 0);
    if (missingDetails) { setDefectError("Wajib memilih Detail Masalah untuk setiap Kategori yang dicentang."); return; }
    if (!meteranHeaderId) { setDefectError("Tidak ditemukan header ID untuk batch ini."); return; }

    const m = parseFloat(defectMeterKain);
    let targetHeaderId = meteranHeaderId;
    if (!isNaN(m) && fullActiveQcDetails.length > 0) {
      const uniqueHeadersMap = new Map<string, any>();
      fullActiveQcDetails.forEach((d) => {
        if (d.production_headers?.id) {
          uniqueHeadersMap.set(d.production_headers.id, d.production_headers);
        }
      });
      const uniqueHeaders = Array.from(uniqueHeadersMap.values());
      const sessionHeaders = uniqueHeaders.filter(
        (h) => h.meter_awal !== null && h.meter_awal !== undefined && h.meter_akhir !== null && h.meter_akhir !== undefined
      );
      sessionHeaders.sort((a, b) => (a.meter_awal || 0) - (b.meter_awal || 0));

      const matchedHeader = sessionHeaders.find(
        (h) => m >= (h.meter_awal || 0) && m <= (h.meter_akhir || 0)
      );

      if (matchedHeader) {
        targetHeaderId = matchedHeader.id;
      } else if (sessionHeaders.length > 0) {
        const lastSession = sessionHeaders[sessionHeaders.length - 1];
        if (m >= (lastSession.meter_akhir || 0)) {
          targetHeaderId = lastSession.id;
        } else {
          const firstGreater = sessionHeaders.find((h) => m < (h.meter_akhir || 0));
          if (firstGreater) targetHeaderId = firstGreater.id;
        }
      }
    }

    if (!targetHeaderId) { setDefectError("Tidak ditemukan header ID untuk batch ini."); return; }
    
    setIsSubmittingDefect(true);
    setDefectError(null);
    try {
      const combinedDetails = defectKategori.flatMap((cat) => defectDetailMap[cat] || []).join(", ");
      const res = await addQCDefectDetail({
        headerId: targetHeaderId,
        meterKain: defectMeterKain,
        kategoriMasalah: defectKategori,
        detailMasalah: combinedDetails || undefined,
        keteranganCacat: defectKeterangan || undefined,
        pcsIndex: activeQcPcs ? parseInt(activeQcPcs.pcs_index) : undefined,
      });
      if (res.success && activeQcPcs) {
        setIsDefectModalOpen(false);
        setDefectMeterKain(""); setDefectKategori([]); setDefectDetailMap({}); setDefectKeterangan("");
        
        // Refresh active table data
        const refreshRes = await getPendingQCDetailsByBatch(activeQcPcs.nomor_mc, activeQcPcs.design_id, activeQcPcs.potongan_ke);
        if (refreshRes.success && refreshRes.data) {
          const filteredByPcs = refreshRes.data.filter((d: any) => String(d.pcs_index) === activeQcPcs.pcs_index);
          setFullActiveQcDetails(filteredByPcs);
        }
      } else {
        setDefectError(res.error || "Gagal menyimpan temuan cacat.");
      }
    } catch (err: any) {
      setDefectError(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmittingDefect(false);
    }
  };

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

  const handleInsertPanel = async () => {
    if (!activeQcPcs) return;
    setIsInsertingPanel(true);
    setInsertPanelError(null);
    try {
      const batchDetails = fullActiveQcDetails;

      if (batchDetails.length === 0) {
        setInsertPanelError("Tidak ditemukan data header untuk batch ini.");
        return;
      }

      const sortedBatchDetails = [...batchDetails].sort((a, b) => {
        const pA = parseInt(a.production_headers?.panel_no || "0");
        const pB = parseInt(b.production_headers?.panel_no || "0");
        return pA - pB;
      });

      let refDetail = sortedBatchDetails[sortedBatchDetails.length - 1];

      if (insertPanelMode === "insert" && insertPanelAt) {
        const targetPanelNo = parseInt(insertPanelAt);
        const targetDetail = sortedBatchDetails.find(d => parseInt(d.production_headers?.panel_no || "0") === targetPanelNo);
        if (targetDetail) {
          refDetail = targetDetail;
        } else {
          const precedingDetails = sortedBatchDetails.filter(d => parseInt(d.production_headers?.panel_no || "0") < targetPanelNo);
          if (precedingDetails.length > 0) refDetail = precedingDetails[precedingDetails.length - 1];
        }
      }

      // Format detail_masalah as "detail1, detail2 | detail3"
      const detailMasalahStr = selectedCategories
        .map((catId) => (selectedDetails[catId] || []).join(", "))
        .join(" | ");

      // Format keterangan_cacat to include block numbers
      const keteranganParts = selectedCategories
        .map(catId => {
          const block = inputBloks[catId]?.trim();
          return block ? `blok ${block}` : "";
        })
        .filter(Boolean);

      if (insertPanelKeterangan?.trim()) {
        keteranganParts.push(insertPanelKeterangan.trim());
      }
      const keteranganCacatStr = keteranganParts.join(", ");

      const res = await insertMissingPanel({
        refHeaderId: refDetail.header_id,
        insertAt: insertPanelMode === "insert" ? parseInt(insertPanelAt) : undefined,
        appendToEnd: insertPanelMode === "append",
        pcsIndex: parseInt(activeQcPcs.pcs_index) || 1,
        kategoriMasalah: selectedCategories.length > 0 ? selectedCategories : undefined,
        detailMasalah: detailMasalahStr || undefined,
        keteranganCacat: keteranganCacatStr || undefined,
        isBs: insertPanelMode === "insert" && insertPanelIsBs,
      });

      if (res.success) {
        setInsertPanelMode(null);
        setInsertPanelAt("");
        // refresh active QC details
        const refreshRes = await getPendingQCDetailsByBatch(activeQcPcs.nomor_mc, activeQcPcs.design_id, activeQcPcs.potongan_ke);
        if (refreshRes.success && refreshRes.data) {
          const filteredByPcs = refreshRes.data.filter((d: any) => String(d.pcs_index) === activeQcPcs.pcs_index);
          setFullActiveQcDetails(filteredByPcs);
        }
      } else {
        setInsertPanelError(res.error || "Gagal menyisipkan panel.");
      }
    } catch (err: any) {
      setInsertPanelError(err.message);
    } finally {
      setIsInsertingPanel(false);
    }
  };

  const handleDeletePanel = async () => {
    if (!detailToDelete || !activeQcPcs) return;
    setIsDeleting(true);
    try {
      const res = await deleteProductionDetailRow(detailToDelete.id);
      if (res.success) {
        setDetailToDelete(null);
        // refresh active QC details
        const refreshRes = await getPendingQCDetailsByBatch(activeQcPcs.nomor_mc, activeQcPcs.design_id, activeQcPcs.potongan_ke);
        if (refreshRes.success && refreshRes.data) {
          const filteredByPcs = refreshRes.data.filter((d: any) => String(d.pcs_index) === activeQcPcs.pcs_index);
          setFullActiveQcDetails(filteredByPcs);
        }
      } else {
        alert("Gagal menghapus: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const firstDetail = detailsToDisplay.length > 0 ? detailsToDisplay[0] : null;
  const dummyHeaderData = {
    design_id: activeQcPcs?.design_id || "",
    potongan_ke: activeQcPcs?.potongan_ke || "",
    operator: firstDetail?.production_headers?.pic || firstDetail?.production_headers?.operators?.nama_operator || "-",
    nomor_mc: activeQcPcs?.nomor_mc || "-",
    details: detailsToDisplay,
  };

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

  if (activeQcPcs) {
    return (
      <div className="w-full max-w-6xl mx-auto pb-10">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => { setActiveQcPcs(null); setFullActiveQcDetails([]); handleSearch(searchTanggal); }}
              className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-sky-600 transition-colors w-fit mb-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Antrean
            </button>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-sky-500" />
              Inspeksi PCS {activeQcPcs.pcs_index}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {startInspectTime && (
              <div className="h-11 px-4 rounded-xl bg-sky-50 border border-sky-100 text-sm font-black text-sky-700 flex items-center gap-2 shadow-sm">
                <Clock className="w-4 h-4 text-sky-500" />
                {startInspectTime}
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsTourOpen(true)}
              className="h-11 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all flex items-center gap-2"
            >
              <HelpCircle className="w-4 h-4" /> Bantuan
            </button>
          </div>
        </div>

        <div className="mb-6">
          <CompactHeaderCard {...compactProps} />
        </div>

        {!isMeteranBatch && detailsToDisplay.length > 0 && (
          <div className="mb-4 flex justify-end animate-fadeIn">
            <button
              onClick={() => {
                setInsertPanelMode("append");
                setInsertPanelAt("");
                setInsertPanelHasDefect(false);
                setSelectedCategories([]);
                setSelectedDetails({});
                setInputBloks({});
                setInsertPanelKeterangan("");
              }}
              className="h-11 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-purple-600/20"
            >
              <Plus className="w-4 h-4" />
              Tambah Panel
            </button>
          </div>
        )}

        {isMeteranBatch && detailsToDisplay.length > 0 && (
          <div className="mb-4 flex justify-end animate-fadeIn">
            <button
              onClick={() => setIsDefectModalOpen(true)}
              className="h-11 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-rose-600/20"
            >
              <Plus className="w-4 h-4" />
              Tambah Temuan Cacat Baru
            </button>
          </div>
        )}

        <div data-tour="qc-inspection-results" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fadeIn">
          {detailsToDisplay.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                <CheckCircle className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Semua Panel di PCS ini sudah diinspeksi.</h3>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-center">
                <h5 className="font-black text-slate-700 tracking-wide text-sm">
                  PCS {activeQcPcs.pcs_index}
                </h5>
              </div>
              {isMeteranBatch ? (
                <MeterQCTable detailsToDisplay={detailsToDisplay} handleSelectGrade={handleSelectGrade} selections={selections} setDetailToDelete={setDetailToDelete} />
              ) : (
                <PanelQCTable detailsToDisplay={detailsToDisplay} handleSelectGrade={handleSelectGrade} handleOpenDetail={handleOpenDetail} selections={selections} setDetailToDelete={setDetailToDelete} />
              )}
              
              <div data-tour="qc-inspection-submit" className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end">
                <button
                  disabled={!isAllSelected}
                  onClick={() => setIsModalOpen(true)}
                  className={`h-12 px-8 rounded-xl font-bold text-sm text-white flex items-center gap-2 transition-all duration-300 ${
                    isAllSelected ? "bg-[#0070bc] hover:bg-[#004777] shadow-lg shadow-[#0070bc]/30 active:scale-95" : "bg-slate-300 cursor-not-allowed"
                  }`}
                >
                  <CheckCircle className="w-5 h-5" />
                  Isi Rangkuman & Kirim Inspeksi
                </button>
              </div>
            </>
          )}
        </div>

        {isModalOpen && (
          <QCInspectionModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            headerData={dummyHeaderData}
            selections={selections}
            startInspectTime={startInspectTime}
            onSuccess={() => {
              setIsModalOpen(false);
              setActiveQcPcs(null);
              setFullActiveQcDetails([]);
              setSelections({});
              handleSearch(searchTanggal);
            }}
          />
        )}
        
        {/* Same Modals for Defect & Detail as before */}
        <ProductionDetailModal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} detailData={detailData} isLoading={isDetailLoading} hideEdit={true} />
        {isDefectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            {/* Same Defect Modal UI */}
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-rose-500" /> Tambah Temuan Cacat Baru
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Catat temuan cacat baru yang ditemukan saat inspeksi kain meteran.</p>
                </div>
                <button onClick={() => { setIsDefectModalOpen(false); setDefectError(null); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 flex flex-col gap-5">
                {defectError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {defectError}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Posisi Meter Kain <span className="text-rose-500">*</span></label>
                  <input type="number" step="any" min="0" value={defectMeterKain} onChange={(e) => setDefectMeterKain(e.target.value)} className="h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-base font-semibold focus:bg-white focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all" placeholder="Contoh: 75" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-rose-600 uppercase">Kategori Masalah <span className="text-rose-500">*</span> (Pilih 1 atau lebih)</label>
                  <div className="flex flex-col gap-2 mt-1">
                    {PROBLEM_CATEGORIES.map((c) => {
                      const isChecked = defectKategori.includes(c.id);
                      return (
                        <div key={c.id} className="flex flex-col gap-1">
                          <label className="cursor-pointer block">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleDefectToggleKategori(c.id)}
                              className="peer sr-only"
                            />
                            <div className="p-3.5 rounded-xl border-2 border-slate-100 bg-white text-xs font-bold text-slate-700 peer-checked:border-rose-500 peer-checked:bg-rose-50/50 peer-checked:text-rose-700 transition-all hover:border-slate-200 shadow-sm flex items-center justify-between">
                              <span>{c.name}</span>
                              {isChecked && <CheckCircle className="w-4 h-4 text-rose-500 shrink-0 ml-2" />}
                            </div>
                          </label>
                          {isChecked && (
                            <div className="pl-4 pr-2 py-2 border-l-2 border-rose-200 ml-2 animate-fadeIn mt-1 flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Pilih Detail Masalah</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                                {(PROBLEM_DETAILS[c.id] || []).map((p) => {
                                  const currentList = defectDetailMap[c.id] || [];
                                  const isDetailChecked = currentList.includes(p);
                                  return (
                                    <label key={`${c.id}-${p}`} className="cursor-pointer block">
                                      <input
                                        type="checkbox"
                                        checked={isDetailChecked}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setDefectDetailMap((prev) => ({
                                              ...prev,
                                              [c.id]: [...(prev[c.id] || []), p]
                                            }));
                                          } else {
                                            setDefectDetailMap((prev) => ({
                                              ...prev,
                                              [c.id]: (prev[c.id] || []).filter((item) => item !== p)
                                            }));
                                          }
                                        }}
                                        className="peer sr-only"
                                      />
                                      <div className="p-2.5 rounded-xl border border-slate-150 bg-white text-[11px] font-semibold text-slate-650 peer-checked:border-rose-450 peer-checked:bg-rose-50/30 peer-checked:text-rose-700 transition-all hover:border-slate-200 flex items-center justify-between shadow-sm">
                                        <span>{p}</span>
                                        {isDetailChecked && <CheckCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 ml-1" />}
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Keterangan Tambahan</label>
                  <textarea value={defectKeterangan} onChange={(e) => setDefectKeterangan(e.target.value)} rows={3} className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:bg-white focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all resize-none" placeholder="Tuliskan keterangan tambahan jika ada..." />
                </div>
              </div>
              <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => { setIsDefectModalOpen(false); setDefectError(null); }} className="h-11 px-5 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all">Batal</button>
                <button disabled={isSubmittingDefect} onClick={handleSubmitDefect} className="h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-rose-600/20">
                  {isSubmittingDefect ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Simpan Temuan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Insert Panel Modal */}
        {insertPanelMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-5 border-b border-slate-150">
                <h2 className="text-lg font-extrabold text-slate-800">
                  Tambah Panel
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Pilih apakah ingin menyisipkan panel baru di urutan tertentu atau menambahkannya di bagian paling akhir.
                </p>
              </div>

              <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
                {insertPanelError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {insertPanelError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-2">
                    Pilih Tipe Penambahan
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setInsertPanelMode("append");
                        setInsertPanelAt("");
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition-all ${
                        insertPanelMode === "append"
                          ? "border-[#0070bc] bg-sky-50 text-[#0070bc] font-bold"
                          : "border-slate-200 text-slate-500 hover:border-slate-350 bg-white"
                      }`}
                    >
                      <span className="text-xs font-extrabold">Tambah di Akhir</span>
                      <span className="text-[10px] opacity-75 mt-1 font-medium leading-tight">Urutan terakhir</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInsertPanelMode("insert");
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition-all ${
                        insertPanelMode === "insert"
                          ? "border-[#0070bc] bg-sky-50 text-[#0070bc] font-bold"
                          : "border-slate-200 text-slate-500 hover:border-slate-350 bg-white"
                      }`}
                    >
                      <span className="text-xs font-extrabold">Sisipkan Tengah</span>
                      <span className="text-[10px] opacity-75 mt-1 font-medium leading-tight">Posisi tertentu</span>
                    </button>
                  </div>
                </div>

                {insertPanelMode === "insert" && (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-2">
                      Sisipkan ke Nomor Panel <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={insertPanelAt}
                      onChange={(e) => setInsertPanelAt(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 focus:border-[#0070bc] focus:ring-4 focus:ring-[#0070bc]/10 outline-none font-medium text-slate-700 transition-all mb-3"
                      placeholder="Contoh: 3"
                    />
                    
                    <div className="flex items-center gap-3 py-2 px-3 rounded-lg border border-rose-100 bg-rose-50/50">
                      <input
                        type="checkbox"
                        id="insertPanelIsBs"
                        checked={insertPanelIsBs}
                        onChange={(e) => {
                          setInsertPanelIsBs(e.target.checked);
                          if (e.target.checked) {
                            setInsertPanelHasDefect(true);
                          }
                        }}
                        className="w-4 h-4 text-rose-600 rounded border-rose-300 focus:ring-rose-500 cursor-pointer"
                      />
                      <label
                        htmlFor="insertPanelIsBs"
                        className="text-xs font-bold text-rose-700 cursor-pointer select-none"
                      >
                        Tandai sebagai Barang Sisa (BS)
                      </label>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 pl-1 font-medium leading-tight">
                      * Jika dicentang, panel lain tidak akan bergeser, dan panel {insertPanelAt || "?"} akan memiliki 1 hasil Gagal.
                    </p>
                  </div>
                )}

                {/* Defect toggle switch */}
                <div className="flex items-center gap-3 py-3 border-t border-slate-100 mt-2">
                  <input
                    type="checkbox"
                    id="insertPanelHasDefect"
                    checked={insertPanelHasDefect}
                    onChange={(e) => {
                      setInsertPanelHasDefect(e.target.checked);
                      if (!e.target.checked) {
                        setSelectedCategories([]);
                        setSelectedDetails({});
                        setInputBloks({});
                        setInsertPanelKeterangan("");
                      }
                    }}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                  />
                  <label
                    htmlFor="insertPanelHasDefect"
                    className="text-xs font-bold text-slate-700 cursor-pointer select-none"
                  >
                    Laporkan temuan masalah / cacat pada panel ini?
                  </label>
                </div>

                {insertPanelHasDefect && (
                  <div className="space-y-4 pt-2 border-t border-slate-100 animate-fadeIn">
                    <label className="text-xs font-bold text-slate-700 uppercase block">
                      Pilih Temuan Cacat / Masalah
                    </label>
                    <div className="space-y-2">
                      {PROBLEM_CATEGORIES.map((cat) => (
                        <div key={cat.id} className="flex flex-col gap-2">
                          <label className="cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedCategories.includes(cat.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCategories((prev) => [...prev, cat.id]);
                                } else {
                                  setSelectedCategories((prev) => prev.filter((c) => c !== cat.id));
                                  setSelectedDetails((prev) => {
                                    const next = { ...prev };
                                    delete next[cat.id];
                                    return next;
                                  });
                                  setInputBloks((prev) => {
                                    const next = { ...prev };
                                    delete next[cat.id];
                                    return next;
                                  });
                                }
                              }}
                              className="peer sr-only"
                            />
                            <div className="p-3 rounded-xl border-2 border-slate-100 bg-white text-xs font-bold text-slate-650 peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 transition-all hover:border-slate-350">
                              {cat.name}
                            </div>
                          </label>

                          {selectedCategories.includes(cat.id) && PROBLEM_DETAILS[cat.id] && (
                            <div className="pl-4 pr-2 py-2 border-l-2 border-sky-200 ml-2 animate-in slide-in-from-top-2">
                              <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">
                                Pilih Detail Masalah
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                {PROBLEM_DETAILS[cat.id].map((detail) => (
                                  <label key={detail} className="cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={selectedDetails[cat.id]?.includes(detail) || false}
                                      onChange={(e) => {
                                        const current = selectedDetails[cat.id] || [];
                                        if (e.target.checked) {
                                          setSelectedDetails((prev) => ({
                                            ...prev,
                                            [cat.id]: [...current, detail],
                                          }));
                                        } else {
                                          setSelectedDetails((prev) => ({
                                            ...prev,
                                            [cat.id]: current.filter((d) => d !== detail),
                                          }));
                                        }
                                      }}
                                      className="peer sr-only"
                                    />
                                    <div className="p-2 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-600 peer-checked:bg-sky-500 peer-checked:border-sky-500 peer-checked:text-white transition-all hover:bg-slate-50 text-center">
                                      {detail}
                                    </div>
                                  </label>
                                ))}
                              </div>

                              {(cat.id === "A" || cat.id === "B") && selectedDetails[cat.id]?.length > 0 && (
                                <div className="mt-3 p-3 bg-sky-50 border border-sky-100 rounded-xl">
                                  <label className="text-[10px] font-bold text-sky-800 uppercase mb-1.5 block flex items-center gap-1.5">
                                    <Box className="w-3 h-3" />
                                    Lokasi / Nomor Blok (Khusus A & B)
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="text"
                                    value={inputBloks[cat.id] || ""}
                                    onChange={(e) => {
                                      const filtered = e.target.value.replace(/[^0-9\-,\s]/g, "");
                                      setInputBloks((prev) => ({ ...prev, [cat.id]: filtered }));
                                    }}
                                    placeholder="Contoh: 15, 18 atau 1-61"
                                    className="w-full h-10 px-3 rounded-lg border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs font-bold text-slate-700 placeholder:font-medium placeholder:text-slate-400 bg-white"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-650 uppercase">Keterangan Tambahan (Opsional)</label>
                      <textarea
                        value={insertPanelKeterangan}
                        onChange={(e) => setInsertPanelKeterangan(e.target.value)}
                        rows={2}
                        className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:bg-white focus:border-[#0070bc] focus:ring-2 focus:ring-[#0070bc]/10 outline-none transition-all resize-none"
                        placeholder="Tuliskan keterangan tambahan jika ada..."
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-slate-150 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={() => setInsertPanelMode(null)}
                  className="h-11 px-5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  disabled={
                    isInsertingPanel || 
                    (insertPanelMode === "insert" && !insertPanelAt) ||
                    (insertPanelHasDefect && selectedCategories.some(cat => !selectedDetails[cat] || selectedDetails[cat].length === 0))
                  }
                  onClick={handleInsertPanel}
                  className="h-11 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:opacity-50 text-white font-bold transition-all shadow-lg flex items-center gap-2"
                >
                  {isInsertingPanel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Simpan Panel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Detail Modal */}
        {detailToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4 mx-auto">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-center text-slate-800 mb-2">Hapus Rincian Panel?</h3>
              <p className="text-sm text-center text-slate-500 mb-6">
                Anda yakin ingin menghapus data rincian panel <span className="font-semibold text-slate-700">{detailToDelete.name}</span>? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDetailToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 h-11 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeletePanel}
                  disabled={isDeleting}
                  className="flex-1 h-11 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Render Table View (Main Page) ---
  return (
    <div className="w-full max-w-6xl mx-auto pb-10">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-[#0070bc]" />
            Inspeksi QC
          </h1>
          <p className="text-sm font-semibold text-slate-500">
            Total antrean: <span className="text-[#0070bc] font-bold">{groupedPcsList.length} PCS Pending</span>
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

      {/* Filter Card */}
      <div data-tour="qc-inspection-filter" className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 items-end gap-4 w-full">
          <div className="flex flex-col gap-1 w-full">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
              <span>Tanggal</span>
              {searchTanggal && (
                <button
                  onClick={() => setSearchTanggal("")}
                  className="text-[10px] text-rose-500 hover:text-rose-600 font-extrabold transition-all lowercase"
                >
                  [reset filter]
                </button>
              )}
            </label>
            <input
              type="date"
              value={searchTanggal}
              onChange={(e) => setSearchTanggal(e.target.value)}
              className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:bg-white outline-none w-full cursor-pointer"
            />
          </div>
          <div className="flex flex-col gap-1 w-full">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Mesin
            </label>
            <select
              value={searchMesin}
              onChange={(e) => setSearchMesin(e.target.value)}
              className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:bg-white outline-none w-full"
            >
              <option value="">Semua Mesin</option>
              {availableMesins.map(m => (
                <option key={String(m)} value={String(m)}>{String(m)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 w-full">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Potongan
            </label>
            <input
              type="number"
              value={searchPotongan}
              onChange={(e) => setSearchPotongan(e.target.value)}
              className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:bg-white outline-none w-full"
              placeholder="Cari Potongan..."
            />
          </div>
          <button
            onClick={() => handleSearch(searchTanggal)}
            disabled={isSearching}
            className="h-11 px-6 rounded-xl bg-[#0070bc] hover:bg-[#004777] active:scale-95 disabled:opacity-50 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm w-full"
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
              Tidak Ada Antrean QC
            </h3>
            <p className="text-sm text-slate-500">
              Tidak ditemukan data produksi yang perlu diinspeksi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="px-2 py-2">Mesin</th>
                  <th className="px-2 py-2">Tanggal</th>
                  <th className="px-2 py-2">Jam</th>
                  <th className="px-2 py-2">Desain</th>
                  <th className="px-2 py-2">Potongan</th>
                  <th className="px-2 py-2 text-center">PCS</th>
                  <th className="px-2 py-2 text-center">Baris</th>
                  <th className="px-2 py-2 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-700">
                {currentPcsList.map((g: any) => (
                  <tr key={`${g.nomor_mc}_${g.design_id}_${g.potongan_ke}_${g.pcs_index}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-2 py-2">
                      <div className="inline-flex items-center min-w-[3rem] h-8 px-3 rounded-lg bg-[#0070bc]/10 text-[#0070bc] font-bold">
                        {g.header?.nomor_mc}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <span className="text-[10px] text-slate-500 font-semibold">{formatLastInputDate(g.lastInputTime)}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className="text-[10px] text-slate-500 font-semibold">{formatLastInputTime(g.lastInputTime)}</span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="text-slate-800 font-bold flex items-center gap-1">
                        {g.header?.design_id}
                        {g.header?.panel_no === "METERAN" ? (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-purple-100 text-purple-700 uppercase tracking-wider">METERAN</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">PANEL</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="text-[11px] text-slate-800 font-bold uppercase tracking-wider">
                        {g.header?.potongan_ke}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 font-bold text-slate-600">
                        {g.pcs_index}
                      </div>
                      {g.meter_kain && (
                        <div className="text-[10px] text-slate-500 font-bold mt-1.5 uppercase tracking-wider">
                          {g.meter_kain}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="text-slate-500">{g.detailsCount} baris</span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => handleStartQC(g.nomor_mc, g.design_id, g.potongan_ke, g.pcs_index)}
                        className="px-2 py-1.5 bg-sky-50 text-[#0070bc] hover:bg-sky-100 font-bold text-[10px] rounded-lg transition-all"
                      >
                        Mulai Inspeksi
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-700 px-3">
                    Hal {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ProductTour steps={QC_INSPECTION_TOUR_STEPS} isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} />
    </div>
  );
}
