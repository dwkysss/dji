"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Factory,
  ClipboardCheck,
  Scissors,
  RefreshCw,
  Award,
  Package,
  AlertCircle,
  Layers,
  Scale,
  Calendar,
} from "lucide-react";
import {
  getPotonganTrackingData,
  PotonganTrackingResult,
  TrackingStage,
} from "@/actions/tracking-actions";

interface PotonganTrackingViewProps {
  initialData: PotonganTrackingResult;
  initialPcs?: number;
}

const STAGE_CONFIG: Record<
  TrackingStage,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
    stepIndex: number;
    description: string;
  }
> = {
  PLANNED: {
    label: "Terjadwal (Belum Produksi)",
    shortLabel: "Rencana",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    stepIndex: 0,
    description: "Potongan sudah dijadwalkan oleh Admin dan menunggu proses produksi di mesin.",
  },
  IN_PRODUCTION: {
    label: "Dalam / Selesai Produksi",
    shortLabel: "Produksi",
    badgeClass: "bg-sky-50 text-[#0070bc] border-sky-200",
    stepIndex: 1,
    description: "Data hasil produksi mesin sudah masuk dan menunggu tahap Inspeksi QC.",
  },
  INSPECTED: {
    label: "Sudah Inspeksi QC",
    shortLabel: "Inspeksi QC",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
    stepIndex: 2,
    description: "Kain sudah melalui pemeriksaan QC dan penimbangan, menunggu proses Mending.",
  },
  COMPLETED: {
    label: "Selesai Mending (Final)",
    shortLabel: "Selesai",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    stepIndex: 3,
    description: "Seluruh proses produksi, QC, dan mending telah selesai dengan Grade akhir.",
  },
};

const GRADE_STYLES: Record<string, string> = {
  A: "bg-emerald-600 text-white border-emerald-700",
  B: "bg-sky-600 text-white border-sky-700",
  C: "bg-amber-500 text-white border-amber-600",
  D: "bg-rose-600 text-white border-rose-700",
};

function formatDateID(dateStr: string | null): string {
  if (!dateStr) return "-";
  // Already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  // YYYY-MM-DD
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return dateStr;
}

export default function PotonganTrackingView({
  initialData,
  initialPcs = 1,
}: PotonganTrackingViewProps) {
  const [data, setData] = useState<PotonganTrackingResult>(initialData);
  const [selectedPcs, setSelectedPcs] = useState<number>(
    initialPcs >= 1 && initialPcs <= (initialData.pcs_count || 1) ? initialPcs : 1
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await getPotonganTrackingData(data.nomor_mc, data.potongan_ke);
      if (res.success && res.data) {
        setData(res.data);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!data.found) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-slate-200 p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-black text-slate-900">Data Potongan Tidak Ditemukan</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tidak ditemukan data rencana maupun produksi untuk{" "}
              <span className="font-bold text-slate-700">
                MC {data.nomor_mc} / Potongan {data.potongan_ke}
              </span>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0070bc] text-white text-xs font-bold hover:bg-[#005a96] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Coba Muat Ulang</span>
          </button>
        </div>
      </div>
    );
  }

  const activePcs =
    data.pcs_list.find((p) => p.pcs_index === selectedPcs) || data.pcs_list[0];
  const stageCfg = STAGE_CONFIG[activePcs?.stage || "PLANNED"];

  const pcsRollLabel =
    data.pcs_count > 1
      ? `PCS ${activePcs.pcs_index} dari ${data.pcs_count}`
      : `1 ${data.is_meteran ? "Roll" : "PCS"}`;

  // Determine live Tanggal & context
  let liveTanggalText = "Belum produksi";
  let liveTanggalContext = "";
  if (activePcs.tanggal_mending) {
    liveTanggalText = formatDateID(activePcs.tanggal_mending);
    liveTanggalContext = "Mending";
  } else if (activePcs.tanggal_qc) {
    liveTanggalText = formatDateID(activePcs.tanggal_qc);
    liveTanggalContext = "Inspeksi QC";
  } else if (activePcs.tanggal_produksi) {
    liveTanggalText = formatDateID(activePcs.tanggal_produksi);
    liveTanggalContext = "Produksi";
  }

  const steps = [
    { label: "Rencana", icon: Clock },
    { label: "Produksi", icon: Factory },
    { label: "Inspeksi QC", icon: ClipboardCheck },
    { label: "Mending", icon: Scissors },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-5 px-3 sm:px-6 flex flex-col items-center">
      <div className="w-full max-w-lg space-y-4">
        {/* Top Brand & Live Refresh Header */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#0070bc] text-white flex items-center justify-center font-black text-sm shadow-sm">
              DJI
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  MC {data.nomor_mc} / Pot {data.potongan_ke}
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {data.is_meteran ? "All Over" : "Panel"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Live Tracking Identitas Potongan Kain
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Segarkan Data Live"
            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#0070bc]" : ""}`} />
          </button>
        </div>

        {/* Multi-PCS Tabs (if machine has > 1 PCS) */}
        {data.pcs_count > 1 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 flex items-center gap-1.5 overflow-x-auto">
            {data.pcs_list.map((pcs) => {
              const isSelected = pcs.pcs_index === activePcs.pcs_index;
              const isDone = pcs.stage === "COMPLETED";
              return (
                <button
                  key={pcs.pcs_index}
                  type="button"
                  onClick={() => setSelectedPcs(pcs.pcs_index)}
                  className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "bg-[#0070bc] text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span>PCS {pcs.pcs_index}</span>
                  {isDone && (
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${isSelected ? "text-emerald-200" : "text-emerald-600"}`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Status & Stepper Progress Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Status Saat Ini
              </span>
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${stageCfg.badgeClass}`}
                >
                  <span className="w-2 h-2 rounded-full bg-current" />
                  {stageCfg.label}
                </span>
              </div>
            </div>

            {activePcs.overall_grade && (
              <div
                className={`px-3.5 py-1.5 rounded-2xl border text-center shadow-xs ${
                  GRADE_STYLES[activePcs.overall_grade] || "bg-slate-800 text-white border-slate-900"
                }`}
              >
                <div className="text-[9px] font-bold uppercase tracking-wider opacity-85 flex items-center justify-center gap-1">
                  <Award className="w-3 h-3" />
                  Grade Akhir
                </div>
                <div className="text-lg font-black leading-tight">
                  GRADE {activePcs.overall_grade}
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">{stageCfg.description}</p>

          {/* 4-Step Progress Bar */}
          <div className="pt-1">
            <div className="grid grid-cols-4 gap-1.5">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isCompleted = idx <= stageCfg.stepIndex;
                const isCurrent = idx === stageCfg.stepIndex;
                return (
                  <div key={step.label} className="flex flex-col items-center gap-1.5 text-center">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
                        isCurrent
                          ? "bg-[#0070bc] text-white border-[#0070bc] shadow-sm shadow-sky-500/20"
                          : isCompleted
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                          : "bg-slate-50 text-slate-300 border-slate-200"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-[10px] font-bold leading-tight ${
                        isCurrent
                          ? "text-[#0070bc]"
                          : isCompleted
                          ? "text-slate-700"
                          : "text-slate-400"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main 7-Row Live Data Card (Standar DJI) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-[#0070bc]" />
              Identitas Potongan Kain (Live)
            </h2>
            {data.target_produksi && (
              <span className="text-[11px] font-bold text-slate-500">
                Target: {data.target_produksi} {data.satuan}
              </span>
            )}
          </div>

          <div className="p-5 divide-y divide-slate-100 text-xs sm:text-sm">
            <div className="py-2.5 first:pt-0 flex items-center justify-between gap-3">
              <span className="font-bold text-slate-500">Desain</span>
              <span className="font-extrabold text-slate-900 text-right">{data.design_id}</span>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="font-bold text-slate-500">No Customer</span>
              <span className="font-extrabold text-slate-900 text-right">{data.no_customer}</span>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="font-bold text-slate-500">Mesin / Potongan</span>
              <span className="font-extrabold text-slate-900 text-right">
                MC {data.nomor_mc} / Pot {data.potongan_ke}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="font-bold text-slate-500">PCS / Roll</span>
              <span className="font-extrabold text-slate-900 text-right">{pcsRollLabel}</span>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="font-bold text-slate-500 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                Jumlah
              </span>
              {activePcs.jumlah_aktual !== null ? (
                <span className="font-extrabold text-slate-900 text-right">
                  {activePcs.jumlah_aktual} {activePcs.satuan}
                </span>
              ) : (
                <span className="text-xs font-semibold italic text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-lg">
                  Belum diproduksi
                </span>
              )}
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="font-bold text-slate-500 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-slate-400" />
                Berat Kain
              </span>
              {activePcs.berat_kain !== null && activePcs.berat_kain > 0 ? (
                <span className="font-extrabold text-slate-900 text-right">
                  {activePcs.berat_kain} Kg
                </span>
              ) : (
                <span className="text-xs font-semibold italic text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                  Belum ditimbang
                </span>
              )}
            </div>

            <div className="py-2.5 last:pb-0 flex items-center justify-between gap-3">
              <span className="font-bold text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Tanggal
              </span>
              {liveTanggalContext ? (
                <span className="font-extrabold text-slate-900 text-right flex items-center gap-1.5">
                  <span>{liveTanggalText}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-[#0070bc]">
                    {liveTanggalContext}
                  </span>
                </span>
              ) : (
                <span className="text-xs font-semibold italic text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                  {liveTanggalText}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Detail Teknis Rencana (if any technical fields exist) */}
        {(data.no_order_barang !== "-" || data.pick || data.course || data.rpm || data.jenis_benang_dasar) && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Spesifikasi Rencana Produksi
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              {data.no_order_barang && data.no_order_barang !== "-" && (
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400">No Order</div>
                  <div className="font-extrabold text-slate-800 truncate">{data.no_order_barang}</div>
                </div>
              )}
              {data.pick && (
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400">Pick</div>
                  <div className="font-extrabold text-slate-800">{data.pick}</div>
                </div>
              )}
              {data.course && (
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400">Course</div>
                  <div className="font-extrabold text-slate-800">{data.course}</div>
                </div>
              )}
              {data.rpm && (
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400">RPM</div>
                  <div className="font-extrabold text-slate-800">{data.rpm}</div>
                </div>
              )}
              {data.jenis_benang_dasar && (
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 col-span-2">
                  <div className="text-[10px] font-bold text-slate-400">Benang Dasar</div>
                  <div className="font-extrabold text-slate-800">{data.jenis_benang_dasar}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-center text-[11px] text-slate-400 font-medium pb-4">
          PT DJI • Sistem Tracking Produksi Real-Time
        </div>
      </div>
    </div>
  );
}
