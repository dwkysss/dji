"use client";

import React, { useState, useEffect } from "react";
import { X, Flag, Save, Loader2, AlertCircle, Gauge, Calendar, Clock, User, Layers, ArrowRight } from "lucide-react";
import { addMissingFinishReport } from "@/actions/continuous-actions";
import { getShiftName, getShiftDate, getCalendarDateTimeFromShift } from "@/lib/shift-utils";

export interface AddMissingFinishModalProps {
  isOpen: boolean;
  onClose: () => void;
  nomorMc: string;
  potonganKe: string | number;
  operatorName: string;
  groupName?: string;
  lastRecordedMeter: number;
  suggestedFinishMeter?: number;
  defaultDate?: string;
  onSuccess?: () => void;
}

export default function AddMissingFinishModal({
  isOpen,
  onClose,
  nomorMc,
  potonganKe,
  operatorName,
  groupName,
  lastRecordedMeter,
  suggestedFinishMeter,
  defaultDate,
  onSuccess,
}: AddMissingFinishModalProps) {
  const [meterVal, setMeterVal] = useState<string>("");
  const [tanggalVal, setTanggalVal] = useState<string>("");
  const [jamVal, setJamVal] = useState<string>("07:10");
  const [keterangan, setKeterangan] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setMeterVal(suggestedFinishMeter ? String(suggestedFinishMeter) : String(lastRecordedMeter || ""));
      setTanggalVal(defaultDate || new Date().toISOString().slice(0, 10));
      setJamVal("07:10");
      setKeterangan("");
    }
  }, [isOpen, suggestedFinishMeter, lastRecordedMeter, defaultDate]);

  if (!isOpen) return null;

  const parsedMeter = parseFloat(meterVal);
  const isValidMeter = !isNaN(parsedMeter) && parsedMeter > 0;
  const isGreater = isValidMeter && parsedMeter >= lastRecordedMeter;
  const productionDiff = isValidMeter ? Math.max(0, parsedMeter - lastRecordedMeter) : 0;

  const shiftPreview = React.useMemo(() => {
    if (!tanggalVal || !jamVal) return null;
    try {
      const res = getCalendarDateTimeFromShift(tanggalVal, jamVal);
      return { shift: res.shift, opDate: res.tgl };
    } catch {
      return null;
    }
  }, [tanggalVal, jamVal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidMeter) {
      setErrorMsg("Nilai counter meter finish wajib diisi angka yang valid!");
      return;
    }
    if (!tanggalVal) {
      setErrorMsg("Tanggal finish wajib diisi!");
      return;
    }
    if (!jamVal) {
      setErrorMsg("Jam finish wajib diisi!");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);

      const res = await addMissingFinishReport({
        nomorMc,
        potonganKe,
        operatorName,
        finishMeter: parsedMeter,
        tanggal: tanggalVal,
        jam: jamVal,
        keterangan: keterangan.trim() || undefined,
      });

      if (res.success) {
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.error || "Gagal menyimpan laporan finish susulan.");
      }
    } catch (err: any) {
      console.error("Gagal simpan finish susulan:", err);
      setErrorMsg(err?.message || "Terjadi kesalahan sistem saat menyimpan laporan finish.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-5 py-4 bg-gradient-to-r from-sky-600 via-[#0070bc] to-indigo-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-xs">
              <Flag className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white">
                  Tambah Finish Susulan
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-[9px] font-black uppercase tracking-wider text-sky-100">
                  Kepala Shift
                </span>
              </div>
              <p className="text-[11px] text-sky-100/90 font-medium">
                Tutup shift operator yang lupa melaporkan finish
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-700 text-xs font-semibold animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Info Card: Mesin, Potongan, Operator */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="flex flex-col">
              <span className="text-[10px] font-extrabold uppercase text-slate-600">Mesin & Potongan</span>
              <span className="font-black text-slate-800 text-sm font-mono">{nomorMc} - Pot. {potonganKe}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-extrabold uppercase text-slate-600">Operator PIC</span>
              <span className="font-extrabold text-[#0070bc] truncate">
                {operatorName} {groupName ? `(${groupName})` : ""}
              </span>
            </div>
            <div className="flex flex-col col-span-2 sm:col-span-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-600">Meter Terakhir Tercatat</span>
              <span className="font-black text-amber-700 font-mono text-sm">{lastRecordedMeter} m</span>
            </div>
          </div>

          {/* Input Meter Finish */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-sky-600" />
                <span>Meter Counter Finish *</span>
              </label>
              {suggestedFinishMeter && suggestedFinishMeter !== lastRecordedMeter && (
                <button
                  type="button"
                  onClick={() => setMeterVal(String(suggestedFinishMeter))}
                  className="text-[10px] font-extrabold text-sky-600 hover:text-sky-700 underline cursor-pointer"
                >
                  Gunakan Start Berikutnya ({suggestedFinishMeter}m)
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                required
                value={meterVal}
                onChange={(e) => setMeterVal(e.target.value)}
                placeholder={`Misal: ${suggestedFinishMeter || lastRecordedMeter || 100}`}
                className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none font-mono font-black text-xl text-slate-800 transition-all pr-12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-600 text-sm pointer-events-none">
                meter
              </span>
            </div>
            <p className="text-[10px] text-slate-600 font-medium">
              Masukkan counter meter saat operator ini selesai atau saat serah terima ke operator berikutnya.
            </p>
          </div>

          {/* Grid Tanggal & Jam */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                <span>Tanggal Finish *</span>
              </label>
              <input
                type="date"
                required
                value={tanggalVal}
                onChange={(e) => setTanggalVal(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 outline-none font-semibold text-xs text-slate-800 transition-all cursor-pointer"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                <span>Jam Finish *</span>
              </label>
              <input
                type="time"
                step="60"
                required
                value={jamVal}
                onChange={(e) => setJamVal(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 outline-none font-semibold text-xs text-slate-800 transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Info Preview Shift */}
          {shiftPreview && (
            <div className="flex items-center justify-between text-[11px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700">
              <span className="text-slate-500 font-semibold">Atribusi Laporan:</span>
              <span className="font-extrabold text-[#0070bc]">
                {shiftPreview.shift} • Tanggal Operasional {shiftPreview.opDate}
              </span>
            </div>
          )}

          {/* Catatan Tambahan (Opsional) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
              Catatan Koreksi (Opsional)
            </label>
            <input
              type="text"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Misal: Operator lupa input finish saat oplos shift malam"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 outline-none text-xs text-slate-800 transition-all placeholder:text-slate-600"
            />
          </div>

          {/* Preview Hasil Produksi */}
          {isValidMeter && (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl flex items-center justify-between text-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-600">Perhitungan:</span>
                <span className="font-mono text-slate-600">{lastRecordedMeter}m</span>
                <ArrowRight className="w-3.5 h-3.5 text-sky-600" />
                <span className="font-mono font-black text-sky-800">{parsedMeter}m</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-extrabold uppercase text-slate-600 block">Sisa Tercatat</span>
                <span className="font-black text-emerald-600 font-mono text-sm">+{productionDiff} Meter</span>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving || !isValidMeter}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-[#0070bc] hover:from-sky-700 hover:to-blue-700 text-white text-xs font-black shadow-md shadow-sky-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Laporan Finish</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
