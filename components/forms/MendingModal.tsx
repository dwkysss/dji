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
  Clock,
  ClipboardList,
  Scale,
} from "lucide-react";
import { submitMending } from "@/actions/mending-actions";
import { formatHHMM } from "@/lib/shift-utils";
import { getDefectMeterLength } from "@/lib/defect-format-utils";

const mendingSchema = z.object({
  petugas_mending: z.string().min(1, "Wajib diisi"),
  start_mending: z.string().min(1, "Wajib diisi"),
  finish_mending: z.string().min(1, "Wajib diisi"),

  mending_grade_a: z.number().min(0),
  mending_grade_b: z.number().min(0),
  mending_grade_bs: z.number().min(0),

  berat_kain: z.preprocess((val) => {
    if (val === null || val === undefined || val === "") return 0;
    if (typeof val === "string") {
      const cleaned = val.replace(",", ".").trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return Number(val);
  }, z.number().min(0, "Harus >= 0")),
  notes: z.string().optional(),
});

type MendingFormData = z.infer<typeof mendingSchema>;

interface MendingModalProps {
  isOpen: boolean;
  onClose: () => void;
  headerData: any;
  selections: Record<string, string>; // DetailId -> Grade ("A", "B", "BS")
  detailData?: any[]; // To get berat_inspecting
  onSuccess: () => void;
  startMendingTime?: string;
  pauseSeconds?: number;
  elapsedSeconds?: number;
}

export default function MendingModal({
  isOpen,
  onClose,
  headerData,
  selections,
  detailData,
  onSuccess,
  startMendingTime,
  pauseSeconds = 0,
  elapsedSeconds = 0,
}: MendingModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MendingFormData>({
    resolver: zodResolver(mendingSchema) as any,
    defaultValues: {
      petugas_mending: "",
      start_mending: "",
      finish_mending: "",
      mending_grade_a: 0,
      mending_grade_b: 0,
      mending_grade_bs: 0,
      berat_kain: 0,
      notes: "",
    },
  });

  const valGradeA = watch("mending_grade_a") || 0;
  const valGradeB = watch("mending_grade_b") || 0;
  const valGradeBs = watch("mending_grade_bs") || 0;

  const isMeteranBatch = (headerData?.details?.[0]?.production_headers?.panel_no === "METERAN") || 
                         (detailData?.[0]?.production_headers?.panel_no === "METERAN");

  const totalKeseluruhanMeter = React.useMemo(() => {
    const detailsList = detailData || headerData?.details || [];
    if (detailsList.length === 0) return 0;
    if (isMeteranBatch) {
      let maxM = 0;
      detailsList.forEach((d: any) => {
        const endM = Number(d.production_headers?.meter_akhir) || 0;
        if (endM > maxM) maxM = endM;
      });
      return maxM;
    }
    return detailsList.filter((d: any) => !d.is_deleted && d.status_inspeksi !== "Dihapus" && d.status_mending !== "Dihapus" && !(d.keterangan_cacat || "").includes("[DIHAPUS]")).length;
  }, [headerData, detailData, isMeteranBatch]);

  useEffect(() => {
    if (isOpen) {
      const storedPetugas = localStorage.getItem("mending_petugas");
      if (storedPetugas) setValue("petugas_mending", storedPetugas);

      const storedStart = localStorage.getItem("mending_start");

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const currentTime = `${hh}:${mm}`;

      const rawStart = startMendingTime || storedStart;
      const initialStart = formatHHMM(rawStart) || currentTime;

      setValue("start_mending", initialStart);
      setValue("finish_mending", currentTime);

      let initialBerat = 0;
      const detailsList = detailData || headerData?.details || [];
      for (const item of detailsList) {
        const qcItems = item.qc_inspection_items;
        if (Array.isArray(qcItems) && qcItems.length > 0) {
          for (const qi of qcItems) {
            const b = qi?.qc_inspection_batches;
            const batch = Array.isArray(b) ? b[0] : b;
            if (batch && batch.berat_kain !== null && batch.berat_kain !== undefined) {
              const val = parseFloat(String(batch.berat_kain).replace(",", "."));
              if (!isNaN(val) && val > 0) {
                initialBerat = val;
                break;
              }
            }
          }
        }
        if (initialBerat > 0) break;
      }
      setValue("berat_kain", initialBerat);
    }
  }, [isOpen, setValue, startMendingTime]);

  useEffect(() => {
    if (isOpen) {
      let countA = 0;
      let countB = 0;
      let countBS = 0;

      const isMeteran = (headerData?.details?.[0]?.production_headers?.panel_no === "METERAN") || 
                        (detailData?.[0]?.production_headers?.panel_no === "METERAN");

      const detailsList = detailData || headerData?.details || [];
      detailsList.forEach((item: any) => {
        const isDeleted = !!item.is_deleted || item.status_inspeksi === "Dihapus" || item.status_mending === "Dihapus" || (item.keterangan_cacat || "").includes("[DIHAPUS]");
        if (isDeleted) return;
        const val = selections[item.id];
        const defectLen = isMeteran ? getDefectMeterLength(item) : 1;
        if (val === "A") countA += defectLen;
        else if (val === "B") countB += defectLen;
        else if (val === "BS") countBS += defectLen;
      });
      if (isMeteran) {
        let maxMeter = 0;
        
        // Ambil inspeksi_ceklis dari detailData (jumlah meter yang dikirim dari halaman inspeksi)
        if (detailData && detailData.length > 0) {
          for (const d of detailData) {
            const qcBatch = d.qc_inspection_items?.[0]?.qc_inspection_batches;
            if (qcBatch && qcBatch.inspeksi_ceklis !== null && qcBatch.inspeksi_ceklis !== undefined) {
              maxMeter = Number(qcBatch.inspeksi_ceklis) || 0;
              if (maxMeter > 0) break;
            }
          }
        }

        // Fallback ke meter_akhir jika tidak ada
        if (maxMeter === 0 && headerData?.details) {
          headerData.details.forEach((d: any) => {
            const m = Number(d.production_headers?.meter_akhir) || 0;
            if (m > maxMeter) maxMeter = m;
          });
        }
        
        const countCacat = countA + countB + countBS;
        const sisaNormal = Math.max(0, maxMeter - countCacat);
        
        countA = sisaNormal + countA;

        setValue("mending_grade_a", countA);
        setValue("mending_grade_b", countB);
        setValue("mending_grade_bs", countBS);
      } else {
        setValue("mending_grade_a", countA);
        setValue("mending_grade_b", countB);
        setValue("mending_grade_bs", countBS);
      }
    }
  }, [isOpen, selections, detailData, headerData, setValue]);

  const onSubmit = async (data: MendingFormData) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const detailsList = detailData || headerData?.details || [];
      const detailsArray = detailsList.map((d: any) => {
        const isDel = !!d.is_deleted || d.status_inspeksi === "Dihapus" || d.status_mending === "Dihapus" || (d.keterangan_cacat || "").includes("[DIHAPUS]");
        return {
          detailId: d.id,
          grade: isDel ? "Dihapus" : (selections[d.id] || "BS"),
        };
      });

      const res = await submitMending({
        details: detailsArray,
        petugas_mending: data.petugas_mending,
        tanggal_mending: new Date().toISOString().split("T")[0],
        start_mending: data.start_mending,
        finish_mending: data.finish_mending,
        mending_grade_a: data.mending_grade_a,
        mending_grade_b: data.mending_grade_b,
        mending_grade_bs: data.mending_grade_bs,
        berat_kain: data.berat_kain,
        notes: data.notes,
        pause_seconds: pauseSeconds,
        elapsed_seconds: elapsedSeconds,
      });

      if (!res.success) {
        throw new Error(res.error || "Gagal menyimpan data mending");
      }

      // Save to localStorage for next time
      localStorage.setItem("mending_petugas", data.petugas_mending || "");
      localStorage.setItem("mending_start", data.start_mending || "");
      localStorage.setItem("mending_finish", data.finish_mending || "");

      onSuccess();
      reset();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan yang tidak diketahui");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const detailsList = detailData || headerData?.details || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#0070bc]" /> Form Rangkuman Mending
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Isi seluruh data mending untuk {detailsList.length} baris yang telah Anda pilih gradenya.
            </p>
          </div>
          <button
            onClick={onClose}
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

          {/* Context Info Banner */}
          <div
            className="rounded-2xl p-4 sm:p-5 mb-6 relative overflow-hidden text-white shadow-md border border-white/10"
            style={{
              background: "linear-gradient(135deg, #091e42 0%, #0d386b 60%, #0052cc 100%)",
            }}
          >
            {/* Ambient subtle glow */}
            <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 sm:gap-5 relative z-10">
              {/* PCS KE */}
              <div className="sm:border-r border-white/10 pr-2">
                <span className="text-slate-300/80 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest block mb-1">
                  PCS KE
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tight">
                  {(() => {
                    const d = headerData?.details?.[0] || detailData?.[0];
                    const idx = d?.pcs_index;
                    const tot = d?.total_pcs || d?.production_headers?.total_pcs || idx;
                    if (!idx) return "-";
                    return `${idx}/${tot}`;
                  })()}
                </span>
              </div>

              {/* MESIN */}
              <div className="sm:border-r border-white/10 pr-2">
                <span className="text-slate-300/80 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest block mb-1">
                  MESIN
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tight">
                  {headerData?.details?.[0]?.production_headers?.nomor_mc || "-"}
                </span>
              </div>

              {/* POTONGAN */}
              <div className="sm:border-r border-white/10 pr-2">
                <span className="text-slate-300/80 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest block mb-1">
                  POTONGAN
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tight">
                  {headerData?.details?.[0]?.production_headers?.potongan_ke || "-"}
                </span>
              </div>

              {/* DESAIN */}
              <div className="sm:border-r border-white/10 pr-2">
                <span className="text-slate-300/80 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest block mb-1">
                  DESAIN
                </span>
                <span className="text-lg sm:text-xl font-black text-[#38bdf8] leading-tight tracking-tight block truncate">
                  {headerData?.details?.[0]?.production_headers?.design_id || "-"}
                </span>
              </div>

              {/* TOTAL PRODUKSI */}
              <div className="pr-2 col-span-2 sm:col-span-1">
                <span className="text-slate-300/80 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest block mb-1">
                  TOTAL PRODUKSI
                </span>
                <span className="text-lg sm:text-xl font-black text-emerald-400 leading-tight tracking-tight block">
                  {(() => {
                    const isMeteran = headerData?.details?.[0]?.production_headers?.panel_no === "METERAN";
                    if (isMeteran) {
                      let maxMeter = 0;
                      if (headerData?.details) {
                        headerData.details.forEach((d: any) => {
                          const m = Number(d.production_headers?.meter_akhir) || 0;
                          if (m > maxMeter) maxMeter = m;
                        });
                      }
                      return `${maxMeter} M`;
                    } else {
                      const validCount = detailsList.filter((d: any) => !d.is_deleted && d.status_inspeksi !== "Dihapus" && d.status_mending !== "Dihapus" && !(d.keterangan_cacat || "").includes("[DIHAPUS]")).length;
                      return `${validCount} Panel`;
                    }
                  })()}
                </span>
              </div>
            </div>
          </div>

          <form
            id="mending-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6"
          >
            {/* Bagian 1: Waktu & Petugas */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-sky-500" /> Informasi Mending
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Petugas Mending
                  </label>
                  <select
                    {...register("petugas_mending")}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-sky-500 outline-none"
                  >
                    <option value="">Pilih</option>
                    <option value="Dede Oting">Dede Oting</option>
                    <option value="Andri">Andri</option>
                    <option value="Yudi">Yudi</option>
                  </select>
                  {errors.petugas_mending && (
                    <p className="text-red-500 text-[10px] mt-1">
                      {errors.petugas_mending.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Waktu Mulai
                  </label>
                  <input
                    type="time"
                    {...register("start_mending")}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-sky-500 outline-none"
                  />
                  {errors.start_mending && (
                    <p className="text-red-500 text-[10px] mt-1">
                      {errors.start_mending.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Waktu Selesai
                  </label>
                  <input
                    type="time"
                    {...register("finish_mending")}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-sky-500 outline-none"
                  />
                  {errors.finish_mending && (
                    <p className="text-red-500 text-[10px] mt-1">
                      {errors.finish_mending.message}
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
                <p className="text-[10px] text-slate-400 mt-1">
                  *Nilai awal diambil dari total berat inspecting QC
                </p>
              </div>
            </div>

            {/* Bagian 3: Rincian Grade */}
            <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-sky-100 pb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#0070bc]" /> Total Hasil Mending
                </h4>
                <div className="text-[11px] font-extrabold text-sky-800 bg-white px-2.5 py-1 rounded-md border border-sky-200 shadow-sm">
                  Keseluruhan: <span className="text-sky-950 font-black">{totalKeseluruhanMeter} {isMeteranBatch ? "METER" : "PANEL"}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200/60 rounded-xl p-3 text-center shadow-sm">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Grade A
                  </span>
                  <span className="text-xl font-black text-emerald-600 block">
                    {isMeteranBatch ? `${valGradeA} METER` : `${valGradeA} PANEL`}
                  </span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-xl p-3 text-center shadow-sm">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Grade B
                  </span>
                  <span className="text-xl font-black text-amber-500 block">
                    {isMeteranBatch ? `${valGradeB} METER` : `${valGradeB} PANEL`}
                  </span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-xl p-3 text-center shadow-sm">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Grade BS
                  </span>
                  <span className="text-xl font-black text-rose-600 block">
                    {isMeteranBatch ? `${valGradeBs} METER` : `${valGradeBs} PANEL`}
                  </span>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            form="mending-form"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl font-bold text-xs bg-[#0070bc] text-white hover:bg-[#004777] transition-colors shadow-lg shadow-[#0070bc]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Simpan & Kirim Mending
          </button>
        </div>
      </div>
    </div>
  );
}
