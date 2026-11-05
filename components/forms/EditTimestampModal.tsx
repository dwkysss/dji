"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Loader2, AlertCircle, Clock, Calendar } from "lucide-react";
import { updateRecordTimestamp } from "@/actions/continuous-actions";
import { getShiftDate, getShiftName } from "@/lib/shift-utils";

export interface EditTimestampModalProps {
  isOpen: boolean;
  onClose: () => void;
  headerId: string;
  title?: string;
  subtitle?: string;
  initialTanggal?: string;
  initialJam?: string;
  onSuccess?: () => void;
}

export default function EditTimestampModal({
  isOpen,
  onClose,
  headerId,
  title = "Koreksi Waktu Inputan",
  subtitle,
  initialTanggal = "",
  initialJam = "",
  onSuccess,
}: EditTimestampModalProps) {
  const [tanggal, setTanggal] = useState(initialTanggal);
  const [jam, setJam] = useState(initialJam);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTanggal(initialTanggal || new Date().toISOString().slice(0, 10));
      let cleanJam = initialJam || "12:00";
      if (cleanJam.includes(":")) cleanJam = cleanJam.slice(0, 5);
      setJam(cleanJam);
      setErrorMsg(null);
    }
  }, [isOpen, initialTanggal, initialJam]);

  const shiftPreview = React.useMemo(() => {
    if (!tanggal || !jam) return null;
    try {
      const ts = `${tanggal} ${jam.length === 5 ? `${jam}:00` : jam}`;
      const shift = getShiftName(ts);
      const opDate = getShiftDate(ts);
      return { shift, opDate };
    } catch {
      return null;
    }
  }, [tanggal, jam]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerId) {
      setErrorMsg("Header ID tidak valid.");
      return;
    }
    if (!tanggal) {
      setErrorMsg("Tanggal tidak boleh kosong.");
      return;
    }
    if (!jam) {
      setErrorMsg("Jam tidak boleh kosong.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const res = await updateRecordTimestamp({
        headerId,
        newTanggal: tanggal,
        newJam: jam,
      });

      if (res.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || "Gagal memperbarui waktu input.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat menyimpan waktu.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">{title}</h3>
              {subtitle && <p className="text-[11px] text-slate-500 font-medium">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3 bg-gradient-to-br from-sky-50/60 to-slate-50 rounded-xl border border-sky-200/70 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-sky-900 tracking-wider">
                Tanggal & Jam Input
              </span>
              <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md">
                Cut-off 07:10 WIB
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-sky-600" />
                  Tanggal
                </label>
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full text-xs font-bold px-2.5 py-2 rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 bg-white text-slate-800 shadow-2xs outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-sky-600" />
                  Jam
                </label>
                <input
                  type="time"
                  required
                  value={jam}
                  onChange={(e) => setJam(e.target.value)}
                  className="w-full text-xs font-bold px-2.5 py-2 rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 bg-white text-slate-800 shadow-2xs outline-hidden"
                />
              </div>
            </div>

            {shiftPreview && (
              <div className="mt-1 flex items-center justify-between text-[11px] bg-white/90 border border-sky-100 rounded-lg px-2.5 py-1.5 text-slate-700">
                <span className="text-slate-500">Masuk Laporan:</span>
                <span className="font-bold text-sky-900">
                  {shiftPreview.shift} • Tgl {shiftPreview.opDate}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-gradient-to-r from-sky-600 to-[#0070bc] hover:from-sky-700 hover:to-[#005a96] text-white text-xs font-black rounded-xl shadow-md shadow-sky-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

