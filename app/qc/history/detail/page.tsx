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
  Clock
} from "lucide-react";
import CompactHeaderCard from "@/components/forms/CompactHeaderCard";
import { getQCHistoryDetailById } from "@/actions/qc-actions";
import { getAllDetailsForPcs } from "@/actions/mending-actions";
import MeterHistoryTable from "./components/MeterHistoryTable";
import PanelHistoryTable from "./components/PanelHistoryTable";

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
  if (!start && !finish && (elapsedSec === undefined || elapsedSec === null)) {
    return "-";
  }

  let totalSec = 0;

  if (elapsedSec !== undefined && elapsedSec !== null && elapsedSec >= 0) {
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
    } else {
      return "-";
    }
  } else {
    return "-";
  }

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

function QCDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [qcData, setQcData] = useState<any>(null);
  const [allPcsDetails, setAllPcsDetails] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const group = qcData || {};
  const header = group.header || {};
  const isMeteran = header.panel_no === "METERAN";
  const itemLabel = isMeteran ? "Titik Meter" : "Panel";

  useEffect(() => {
    if (!qcData) return;
    const h = qcData.header || {};
    const nomor_mc = h.nomor_mc;
    const design_id = h.design_id;
    const potongan_ke = h.potongan_ke;
    const pcs_index = qcData.pcs_index || qcData.detail?.pcs_index;

    if (!nomor_mc || !design_id || !potongan_ke || !pcs_index) return;

    getAllDetailsForPcs(nomor_mc, design_id, parseInt(potongan_ke), parseInt(pcs_index)).then((res) => {
      if (res.success && res.data) {
        setAllPcsDetails(res.data);
      }
    });
  }, [qcData]);

  const detailsToDisplay = React.useMemo(() => {
    if (!qcData) return [];

    if (allPcsDetails.length > 0) {
      return allPcsDetails.map((detail: any) => {
        const qcItem = (group.items || []).find((item: any) => item.detail?.id === detail.id || item.production_detail_id === detail.id);
        return {
          ...detail,
          final_inspection_id: qcItem?.final_inspection_id ?? detail.final_inspection_id,
          production_headers: detail.production_headers || detail.header || header,
        };
      }).sort((a: any, b: any) => {
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
        const panelA = parseInt(a.production_headers?.panel_no || "0", 10);
        const panelB = parseInt(b.production_headers?.panel_no || "0", 10);
        return panelA - panelB;
      });
    }

    return (group.items || []).map((item: any) => ({
      ...item.detail,
      final_inspection_id: item.final_inspection_id ?? item.detail?.final_inspection_id,
      production_headers: item.detail?.header || item.header || header,
    })).sort((a: any, b: any) => {
      if (
        a.production_headers?.panel_no === "METERAN" ||
        b.production_headers?.panel_no === "METERAN"
      ) {
        // Urutkan berdasarkan header (sesi operator) via tanggal_jam
        const hjA = String(a.production_headers?.tanggal_jam || "");
        const hjB = String(b.production_headers?.tanggal_jam || "");
        if (hjA !== hjB) return hjA.localeCompare(hjB);

        // Dalam sesi operator yang sama, urutkan berdasarkan meter_kain
        // Baris ISTIRAHAT / FINISH tanpa meter_kain diletakkan di akhir grup
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
      const panelA = parseInt(a.production_headers?.panel_no || "0", 10);
      const panelB = parseInt(b.production_headers?.panel_no || "0", 10);
      return panelA - panelB;
    });
  }, [qcData, group.items, header, allPcsDetails]);



  useEffect(() => {
    if (!id) {
      setErrorMsg("ID Inspeksi tidak ditemukan.");
      setIsLoading(false);
      return;
    }

    const cachedData = sessionStorage.getItem("dji_qc_history_data");
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        const batch = parsed.find((b: any) => b.id.toString() === id);

        if (batch && batch.items && batch.items.length > 0 && batch.items[0]?.detail?.header) {
          setQcData(batch);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.error("Failed to parse cached history data:", e);
      }
    }

    // Fallback: fetch directly from Supabase via server action
    getQCHistoryDetailById(id)
      .then((res) => {
        if (res.success && res.data) {
          setQcData(res.data);
        } else {
          setErrorMsg(res.error || "Data inspeksi tidak ditemukan.");
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching detail:", err);
        setErrorMsg("Gagal memuat data dari server.");
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-[#0070bc] mb-4" />
        <span className="text-slate-500 font-medium">Memuat Detail...</span>
      </div>
    );
  }

  if (errorMsg || !qcData) {
    return (
      <div className="flex-1 w-full max-w-4xl mx-auto py-10 px-4 animate-fadeIn">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm flex flex-col items-center text-center">
          <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
          <h2 className="text-lg font-bold text-slate-800 mb-2">Oops! Ada Masalah</h2>
          <p className="text-slate-600 mb-6">{errorMsg || "Data tidak ditemukan."}</p>
          <button
            onClick={() => router.push("/qc/history")}
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
            onClick={() => router.push("/qc/history")}
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
                Detail Hasil QC Inspeksi
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

      {/* QC Summary Info */}
      <div className="mt-6 mb-6 bg-sky-50 border border-sky-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <h4 className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">Petugas Inspeksi</h4>
            <p className="text-sm font-black text-sky-900">
              {group.petugas_inspeksi}
              {group.petugas_inspeksi_2 ? ` & ${group.petugas_inspeksi_2}` : ""}
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">Start Inspeksi</h4>
            <p className="text-sm font-bold text-sky-900 font-mono">
              {group.tanggal_inspeksi} {group.start_inspect || "-"}
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">Finish Inspeksi</h4>
            <p className="text-sm font-bold text-sky-900 font-mono">
              {group.tanggal_inspeksi} {group.finish_inspect || "-"}
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">Durasi Inspeksi</h4>
            <p className="text-sm font-black text-amber-700 font-mono">
              {calculateDurationStr(group.start_inspect, group.finish_inspect, group.pause_seconds || 0, group.elapsed_seconds)}
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">
              {isMeteran ? "Berat Kain" : "Total Panel"}
            </h4>
            <p className="text-sm font-black text-sky-900">
              {isMeteran ? `${group.berat_kain !== null && group.berat_kain !== undefined ? group.berat_kain : "-"} Kg` : `${group.items?.length || 0} Panel`}
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">Rekap Hasil</h4>
            <p className="text-sm font-black flex items-center gap-2">
              <span className="text-emerald-600">{group.inspeksi_ceklis} Bagus</span>
              <span className="text-slate-300">|</span>
              <span className="text-rose-600">{group.inspeksi_silang} Cacat</span>
            </p>
          </div>
        </div>
      </div>

      {/* Panel List Layout */}
      <div className="pb-4">
        <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          Rincian per Panel
        </h4>
        <div className="flex w-full pb-4 gap-6">
          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
            {/* PCS Header */}
            <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-center">
              <h5 className="font-black text-slate-700 tracking-wide text-sm flex items-center gap-2">
                PCS {group.pcs_index}
              </h5>
            </div>

            {/* PCS Table */}
            <div className="flex-1 overflow-auto bg-white p-2">
              {isMeteran ? (
                <MeterHistoryTable detailsToDisplay={detailsToDisplay} header={header} />
              ) : (
                <PanelHistoryTable detailsToDisplay={detailsToDisplay} header={header} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QCDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-[#0070bc] mb-4" />
        <span className="text-slate-500 font-medium">Memuat Halaman...</span>
      </div>
    }>
      <QCDetailContent />
    </Suspense>
  );
}
