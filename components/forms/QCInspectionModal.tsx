"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  User,
  Scale,
  Clock,
  ClipboardList,
} from "lucide-react";
import { submitQCInspection } from "@/actions/qc-actions";
import { formatHHMM } from "@/lib/shift-utils";

const qcSchema = z.object({
  petugas_inspeksi: z.string().min(1, "Wajib diisi"),
  petugas_inspeksi_2: z.string().optional(),
  petugas_inspeksi_3: z.string().optional(),
  start_inspect: z.string().min(1, "Wajib diisi"),
  finish_inspect: z.string().min(1, "Wajib diisi"),
  berat_kain: z.preprocess((val) => {
    if (val === null || val === undefined || val === "") return 0;
    if (typeof val === "string") {
      const cleaned = val.replace(",", ".").trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return Number(val);
  }, z.number().min(0, "Harus >= 0")),
  prod_ceklis: z.number().min(0),
  prod_silang: z.number().min(0),

  qc_ceklis: z.number().min(0),
  qc_silang: z.number().min(0),

  notes: z.string().optional(),
});

type QCFormData = z.infer<typeof qcSchema>;

interface QCInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  headerData: any;
  selections: Record<string, number>;
  onSuccess?: () => void;
  startInspectTime?: string;
  pauseSeconds?: number;
  elapsedSeconds?: number;
}

export default function QCInspectionModal({
  isOpen,
  onClose,
  headerData,
  selections,
  onSuccess,
  startInspectTime,
  pauseSeconds = 0,
  elapsedSeconds = 0,
}: QCInspectionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<QCFormData>({
    resolver: zodResolver(qcSchema),
    defaultValues: {
      petugas_inspeksi: "",
      petugas_inspeksi_2: "",
      petugas_inspeksi_3: "",
      start_inspect: "",
      finish_inspect: "",
      berat_kain: 0,
      prod_ceklis: 0,
      prod_silang: 0,
      qc_ceklis: 0,
      qc_silang: 0,
      notes: "",
    },
  });

  const [prodBsCount, setProdBsCount] = useState(0);
  const [qcBsCount, setQcBsCount] = useState(0);

  const watchedProdCeklis = watch("prod_ceklis") || 0;
  const watchedProdSilang = watch("prod_silang") || 0;
  const watchedQcCeklis = watch("qc_ceklis") || 0;
  const watchedQcSilang = watch("qc_silang") || 0;

  const isMeteranBatch = headerData?.details && headerData.details.length > 0 && headerData.details[0]?.production_headers?.panel_no === "METERAN";

  const totalKeseluruhanMeter = React.useMemo(() => {
    if (!headerData?.details) return 0;
    if (isMeteranBatch) {
      let maxM = 0;
      headerData.details.forEach((d: any) => {
        const endM = Number(d.production_headers?.meter_akhir) || 0;
        if (endM > maxM) maxM = endM;
      });
      return maxM;
    }
    return headerData.details.length;
  }, [headerData, isMeteranBatch]);

  useEffect(() => {
    if (isOpen) {
      // Load from localStorage or set current date
      const storedPetugas1 = localStorage.getItem("qc_petugas1");
      const storedPetugas2 = localStorage.getItem("qc_petugas2");
      const storedPetugas3 = localStorage.getItem("qc_petugas3");

      if (storedPetugas1) setValue("petugas_inspeksi", storedPetugas1);
      if (storedPetugas2) setValue("petugas_inspeksi_2", storedPetugas2);
      if (storedPetugas3) setValue("petugas_inspeksi_3", storedPetugas3);

      const storedStart = localStorage.getItem("qc_start");

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const currentTime = `${hh}:${mm}`;

      const rawStart = startInspectTime || storedStart;
      const initialStart = formatHHMM(rawStart) || currentTime;

      setValue("start_inspect", initialStart);
      setValue("finish_inspect", currentTime);

      let countCeklis = 0;
      let countSilang = 0;
      let countBS = 0;
      let countProdCeklis = 0;
      let countProdSilang = 0;
      let countProdBS = 0;

      const checkIsDefectRow = (d: any) => {
        if (!d) return false;
        if (d.isStartRow || d.cacatDisplay === "START" || d.cacatDisplay === "FINISH" || d.cacatDisplay === "ISTIRAHAT") {
          return false;
        }
        if (d.isIstirahat || d.hasIstirahat) return false;

        let hasRealDefects = false;
        if (d.production_defects && Array.isArray(d.production_defects) && d.production_defects.length > 0) {
          d.production_defects.forEach((def: any) => {
            const k = (def.kategori || "").toUpperCase();
            const det = (def.detail || "").toUpperCase();
            if (!k.includes("ISTIRAHAT") && !det.includes("ISTIRAHAT")) {
              hasRealDefects = true;
            }
          });
        }

        const katStr = (d.kategori_masalah || "").toUpperCase();
        const detStr = (d.detail_masalah || "").toUpperCase();
        const ketStr = (d.keterangan_cacat || "").toUpperCase();

        if (ketStr.includes("START") || ketStr.includes("FINISH")) return false;
        if (katStr === "G" && !d.hasTambahanQC && (!d.production_defects || d.production_defects.length === 0)) return false;

        if (!hasRealDefects) {
          if (katStr && katStr !== "G" && !katStr.includes("ISTIRAHAT")) {
            hasRealDefects = true;
          }
          if (detStr && !detStr.includes("ISTIRAHAT") && !detStr.includes("START") && !detStr.includes("FINISH")) {
            if (d.kategori_masalah || (d.production_defects && d.production_defects.length > 0) || d.hasTambahanQC) {
              hasRealDefects = true;
            }
          }
        }

        if (d.hasTambahanQC) hasRealDefects = true;

        return hasRealDefects;
      };

      if (isMeteranBatch && headerData?.details) {
        let maxMeter = 0;
        
        headerData.details.forEach((d: any) => {
          const isRealDefect = checkIsDefectRow(d);
          const isTambahanQC = !!d.hasTambahanQC || (d.keterangan_cacat || "").includes("[TAMBAHAN QC]");
          const meterAkhir = Number(d.production_headers?.meter_akhir) || 0;
          if (meterAkhir > maxMeter) {
            maxMeter = meterAkhir;
          }

          // Produksi (Hanya cacat asli laporan Operator Produksi)
          if (isRealDefect && !isTambahanQC) {
            countProdSilang += 1;
          }

          // Inspeksi QC (Seluruh cacat hasil pemeriksaan QC termasuk Tambahan QC)
          const grade = selections[d.id];
          if (grade === 2 || grade === 3) {
            countSilang += 1;
          } else if (grade === 4) {
            countBS += 1;
          }
        });
        
        countProdCeklis = Math.max(0, maxMeter - countProdSilang);
        countCeklis = Math.max(0, maxMeter - countSilang - countBS);
      } else {
        // Mode Panel (Default)
        Object.entries(selections).forEach(([detailId, val]) => {
          if (val === 1) countCeklis++;
          else if (val === 2 || val === 3) countSilang++;
          else if (val === 4) {
            countBS++;
          }
        });

        if (headerData?.details) {
          headerData.details.forEach((d: any) => {
            const isTambahanQC = !!d.hasTambahanQC || (d.keterangan_cacat || "").includes("[TAMBAHAN QC]");
            if (!isTambahanQC) {
              const isBS = d.jml_hasil_produksi === 0 || d.status_inspeksi === "BS";
              const isDefect = checkIsDefectRow(d);

              if (isBS) {
                countProdBS++;
              } else if (isDefect) {
                countProdSilang++;
              } else {
                countProdCeklis++;
              }
            }
          });
        }
      }

      setProdBsCount(countProdBS);
      setQcBsCount(countBS);
      setValue("prod_ceklis", countProdCeklis);
      setValue("prod_silang", countProdSilang);
      setValue("qc_ceklis", countCeklis);
      setValue("qc_silang", countSilang);
    }
  }, [isOpen, headerData, selections, setValue, startInspectTime, isMeteranBatch]);

  if (!isOpen || !headerData) return null;

  const handleClose = () => {
    reset();
    setErrorMsg(null);
    onClose();
  };

  const onSubmit = async (data: QCFormData) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const detailsArray = isMeteranBatch 
        ? headerData.details.map((d: any) => {
            const isIstirahat = !!d.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT") || 
                                !!d.kategori_masalah?.toUpperCase().includes("ISTIRAHAT");
            const isFinishReport = d.production_headers?.meter_akhir !== null && 
                                   d.production_headers?.meter_akhir !== undefined && 
                                   String(d.production_headers.meter_akhir).trim() !== "";
            const isGradable = !isIstirahat && !isFinishReport;

            let grade = selections[d.id];
            if (!isGradable && grade === undefined) {
              grade = 1;
            }
            return {
              detailId: d.id,
              finalInspectionId: grade !== undefined ? grade : 1,
            };
          })
        : headerData.details
            .filter((d: any) => selections[d.id] !== undefined)
            .map((d: any) => ({
              detailId: d.id,
              finalInspectionId: selections[d.id],
            }));

      const payload = {
        details: detailsArray,
        petugas_inspeksi: data.petugas_inspeksi,
        petugas_inspeksi_2: data.petugas_inspeksi_2 || undefined,
        petugas_inspeksi_3: data.petugas_inspeksi_3 || undefined,
        tanggal_inspeksi: new Date().toISOString().split("T")[0],
        start_inspect: data.start_inspect,
        finish_inspect: data.finish_inspect,
        berat_kain: data.berat_kain,
        prod_ceklis: data.prod_ceklis,
        prod_silang: data.prod_silang,
        qc_ceklis: data.qc_ceklis,
        qc_silang: data.qc_silang,
        notes: data.notes,
        pause_seconds: pauseSeconds,
        elapsed_seconds: elapsedSeconds,
      };

      if (!navigator.onLine) {
        const { addPendingPayload } = await import("@/lib/offline-store");
        await addPendingPayload("qc", payload);

        // Save to localStorage for next time
        localStorage.setItem("qc_petugas1", data.petugas_inspeksi || "");
        localStorage.setItem("qc_petugas2", data.petugas_inspeksi_2 || "");
        localStorage.setItem("qc_petugas3", data.petugas_inspeksi_3 || "");
        localStorage.setItem("qc_start", data.start_inspect || "");
        localStorage.setItem("qc_finish", data.finish_inspect || "");

        if (onSuccess) onSuccess();
        handleClose();
        return;
      }

      const result = await submitQCInspection(payload);

      if (result.success) {
        // Save to localStorage for next time
        localStorage.setItem("qc_petugas1", data.petugas_inspeksi || "");
        localStorage.setItem("qc_petugas2", data.petugas_inspeksi_2 || "");
        localStorage.setItem("qc_petugas3", data.petugas_inspeksi_3 || "");
        localStorage.setItem("qc_start", data.start_inspect || "");
        localStorage.setItem("qc_finish", data.finish_inspect || "");
        if (onSuccess) onSuccess();
        handleClose();
      } else {
        setErrorMsg(result.error || "Gagal menyimpan hasil inspeksi.");
      }
    } catch (err: any) {
      if (
        err.message?.includes("fetch") ||
        err.message?.includes("Network") ||
        !navigator.onLine
      ) {
        const { addPendingPayload } = await import("@/lib/offline-store");
        await addPendingPayload("qc", {
          details: Object.keys(selections).map((detailId) => ({
            detailId,
            finalInspectionId: selections[detailId],
          })),
          ...data,
        });
        if (onSuccess) onSuccess();
        handleClose();
      } else {
        setErrorMsg(
          "Terjadi kesalahan jaringan atau server saat memproses laporan.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-sky-600" /> Form Inspeksi
              QC
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Isi seluruh data inspeksi untuk {Object.keys(selections).length}{" "}
              {isMeteranBatch ? "meter" : "panel"} yang telah Anda pilih gradenya.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold border border-red-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Context Info */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-semibold uppercase tracking-wider block mb-1 text-[9px]">
                  PCS Ke
                </span>
                <span className="font-bold text-slate-800">
                  {headerData?.details?.[0]?.pcs_index || "-"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase tracking-wider block mb-1 text-[9px]">
                  Mesin
                </span>
                <span className="font-bold text-slate-800">
                  {headerData?.details?.[0]?.production_headers?.nomor_mc || "-"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase tracking-wider block mb-1 text-[9px]">
                  Desain
                </span>
                <span className="font-bold text-slate-800">
                  {headerData?.details?.[0]?.production_headers?.design_id || "-"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase tracking-wider block mb-1 text-[9px]">
                  Potongan
                </span>
                <span className="font-bold text-slate-800">
                  {headerData?.details?.[0]?.production_headers?.potongan_ke || "-"}
                </span>
              </div>
            </div>
          </div>

          <form
            id="qc-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6"
          >
            {/* Bagian 1: Waktu & Petugas */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-sky-500" /> Informasi Inspeksi
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Petugas 1
                  </label>
                  <select
                    {...register("petugas_inspeksi")}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-sky-500 outline-none"
                  >
                    <option value="">Pilih</option>
                    <option value="Nurdin">Nurdin</option>
                    <option value="Hendra">Hendra</option>
                    <option value="Taufik">Taufik</option>
                    <option value="Dede Oting">Dede Oting</option>
                    <option value="Andri">Andri</option>
                    <option value="Yudi">Yudi</option>
                  </select>
                  {errors.petugas_inspeksi && (
                    <p className="text-red-500 text-[10px] mt-1">
                      {errors.petugas_inspeksi.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Petugas 2
                  </label>
                  <select
                    {...register("petugas_inspeksi_2")}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-sky-500 outline-none"
                  >
                    <option value="">Pilih</option>
                    <option value="Nurdin">Nurdin</option>
                    <option value="Hendra">Hendra</option>
                    <option value="Taufik">Taufik</option>
                    <option value="Dede Oting">Dede Oting</option>
                    <option value="Andri">Andri</option>
                    <option value="Yudi">Yudi</option>
                  </select>
                  {errors.petugas_inspeksi_2 && (
                    <p className="text-red-500 text-[10px] mt-1">
                      {errors.petugas_inspeksi_2.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Petugas 3
                  </label>
                  <select
                    {...register("petugas_inspeksi_3")}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-sky-500 outline-none"
                  >
                    <option value="">Pilih</option>
                    <option value="Nurdin">Nurdin</option>
                    <option value="Hendra">Hendra</option>
                    <option value="Taufik">Taufik</option>
                    <option value="Dede Oting">Dede Oting</option>
                    <option value="Andri">Andri</option>
                    <option value="Yudi">Yudi</option>
                  </select>
                  {errors.petugas_inspeksi_3 && (
                    <p className="text-red-500 text-[10px] mt-1">
                      {errors.petugas_inspeksi_3.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Start Inspect
                  </label>
                  <input
                    type="time"
                    {...register("start_inspect")}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-sky-500 outline-none"
                  />
                  {errors.start_inspect && (
                     <p className="text-red-500 text-[10px] mt-1">
                      {errors.start_inspect.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Finish Inspect
                  </label>
                  <input
                    type="time"
                    {...register("finish_inspect")}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-sky-500 outline-none"
                  />
                  {errors.finish_inspect && (
                    <p className="text-red-500 text-[10px] mt-1">
                      {errors.finish_inspect.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bagian 2: Hasil Fisik */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-500" /> Data Fisik
              </h4>
              <div className="w-full">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Berat Kain (kg)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    {...register("berat_kain")}
                    className="w-full h-10 px-3 pr-10 rounded-xl border border-slate-200 text-sm font-semibold focus:border-sky-500 outline-none"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    KG
                  </span>
                </div>
                {errors.berat_kain && (
                  <p className="text-red-500 text-[10px] mt-1">
                    {errors.berat_kain.message}
                  </p>
                )}
              </div>
            </div>

            {/* Bagian 3: Rincian Grade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Grade Produksi */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Total (Produksi)
                  </h4>
                  <div className="text-[11px] font-extrabold text-slate-700 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">
                    Keseluruhan: <span className="text-slate-900 font-black">
                      {isMeteranBatch 
                        ? `${(watchedProdCeklis || 0) + (watchedProdSilang || 0)} Meter` 
                        : `${(watchedProdCeklis || 0) + (watchedProdSilang || 0)} Panel${prodBsCount > 0 ? ` (+ ${prodBsCount} BS)` : ""}`}
                    </span>
                  </div>
                </div>
                <div className={`grid ${isMeteranBatch ? "grid-cols-2" : "grid-cols-3"} gap-2.5`}>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-500" /> Normal
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        {...register("prod_ceklis", { valueAsNumber: true })}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        className="w-full h-9 pl-3 pr-10 rounded-lg border border-slate-200 text-sm font-bold text-emerald-700 focus:border-emerald-500 outline-none"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                        {isMeteranBatch ? "meter" : "panel"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1">
                      <X className="w-3 h-3 text-red-500" /> Cacat
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        {...register("prod_silang", { valueAsNumber: true })}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        className="w-full h-9 pl-3 pr-10 rounded-lg border border-slate-200 text-sm font-bold text-rose-700 focus:border-red-500 outline-none"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                        {isMeteranBatch ? "titik" : "panel"}
                      </span>
                    </div>
                  </div>
                  {!isMeteranBatch && (
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> BS
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          readOnly
                          value={prodBsCount}
                          className="w-full h-9 pl-3 pr-10 rounded-lg border border-rose-200 bg-rose-50/50 text-sm font-bold text-rose-700 outline-none cursor-default"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                          panel
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Grade QC */}
              <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Total (Inspeksi QC)
                  </h4>
                  <div className="text-[11px] font-extrabold text-sky-800 bg-white px-2.5 py-1 rounded-md border border-sky-200 shadow-sm">
                    Keseluruhan: <span className="text-sky-950 font-black">
                      {isMeteranBatch 
                        ? `${(watchedQcCeklis || 0) + (watchedQcSilang || 0)} Meter` 
                        : `${(watchedQcCeklis || 0) + (watchedQcSilang || 0)} Panel${qcBsCount > 0 ? ` (+ ${qcBsCount} BS)` : ""}`}
                    </span>
                  </div>
                </div>
                <div className={`grid ${isMeteranBatch ? "grid-cols-2" : "grid-cols-3"} gap-2.5`}>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-500" /> Normal
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        {...register("qc_ceklis", { valueAsNumber: true })}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        className="w-full h-9 pl-3 pr-10 rounded-lg border border-sky-200 text-sm font-bold text-emerald-700 focus:border-emerald-500 outline-none"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                        {isMeteranBatch ? "meter" : "panel"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1">
                      <X className="w-3 h-3 text-red-500" /> Cacat
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        {...register("qc_silang", { valueAsNumber: true })}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        className="w-full h-9 pl-3 pr-10 rounded-lg border border-sky-200 text-sm font-bold text-rose-700 focus:border-red-500 outline-none"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                        {isMeteranBatch ? "titik" : "panel"}
                      </span>
                    </div>
                  </div>
                  {!isMeteranBatch && (
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> BS
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          readOnly
                          value={qcBsCount}
                          className="w-full h-9 pl-3 pr-10 rounded-lg border border-rose-200 bg-rose-50/50 text-sm font-bold text-rose-700 outline-none cursor-default"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                          panel
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bagian 4: Data Mending dihapus */}

            {/* Catatan Tambahan */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Catatan Tambahan QC (Opsional)
              </label>
              <textarea
                {...register("notes")}
                className="w-full h-16 p-3 rounded-xl bg-white border border-slate-200 text-sm focus:ring-2 focus:ring-[#0070bc]/20 focus:border-[#0070bc] outline-none transition-all resize-none"
                placeholder="Keterangan perbaikan, jenis cacat, dll..."
              />
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            form="qc-form"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl font-bold text-xs bg-[#0070bc] text-white hover:bg-[#004777] transition-colors shadow-lg shadow-[#0070bc]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Simpan Keputusan QC
          </button>
        </div>
      </div>
    </div>
  );
}
