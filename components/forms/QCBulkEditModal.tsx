"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Tag,
  CheckSquare,
} from "lucide-react";
import { bulkUpdateQCDetails } from "@/actions/qc-actions";
import { getQCDefects, QCDefectItem } from "@/actions/qc-defect-actions";

interface QCBulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDetails: any[];
  onSuccess: (updatedData: any, targetIds: string[]) => void;
}

export default function QCBulkEditModal({
  isOpen,
  onClose,
  selectedDetails,
  onSuccess,
}: QCBulkEditModalProps) {
  const [masterQCDefects, setMasterQCDefects] = useState<QCDefectItem[]>([]);
  const [selectedQCDefects, setSelectedQCDefects] = useState<string[]>([]);
  const [manualQCDefectText, setManualQCDefectText] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("SEMUA");
  const [keteranganQc, setKeteranganQc] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSelectedQCDefects([]);
      setManualQCDefectText("");
      setKeteranganQc("");
      setSelectedCategoryFilter("SEMUA");
      getQCDefects().then((res) => {
        if (res.success && res.data) {
          setMasterQCDefects(res.data);
        }
      });
    }
  }, [isOpen]);

  // Unique categories for filtering
  const defectCategories = React.useMemo(() => {
    const cats = new Set<string>();
    masterQCDefects.forEach((d) => {
      if (d.kategori) cats.add(d.kategori);
    });
    return ["SEMUA", ...Array.from(cats)];
  }, [masterQCDefects]);

  const filteredMasterQCDefects = React.useMemo(() => {
    if (selectedCategoryFilter === "SEMUA") return masterQCDefects;
    return masterQCDefects.filter((d) => d.kategori === selectedCategoryFilter);
  }, [masterQCDefects, selectedCategoryFilter]);

  if (!isOpen || selectedDetails.length === 0) return null;

  const handleToggleQCDefect = (defectName: string) => {
    setSelectedQCDefects((prev) => {
      if (prev.includes(defectName)) {
        return prev.filter((d) => d !== defectName);
      } else {
        return [...prev, defectName];
      }
    });
  };

  const handleAddManualQCDefect = () => {
    const text = manualQCDefectText.trim();
    if (!text) return;
    setSelectedQCDefects((prev) => {
      if (!prev.includes(text)) {
        return [...prev, text];
      }
      return prev;
    });
    setManualQCDefectText("");
  };

  const handleSaveBulk = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const detailIds = selectedDetails.map((d) => d.id);

      const defectObjects = selectedQCDefects.map((name) => ({
        kategori: "A",
        detail: name,
        blok: undefined,
        meter: undefined,
      }));

      const res = await bulkUpdateQCDetails({
        detailIds,
        kategoriMasalah: selectedQCDefects.length > 0 ? ["A"] : undefined,
        detailMasalah: selectedQCDefects.join(", ") || undefined,
        keteranganCacat: undefined,
        keteranganQc: keteranganQc.trim() || undefined,
        finalInspectionId: 3,
        defects: defectObjects.length > 0 ? defectObjects : undefined,
        isBs: false,
      });

      if (res.success) {
        onSuccess((res as any).updatedData || {}, detailIds);
        onClose();
      } else {
        setErrorMsg(res.error || "Gagal memperbarui rincian secara massal.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan sistem saat menyimpan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-[#0070bc] to-sky-700 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-xs shadow-xs">
              <CheckSquare className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-wide">
                Beri Keterangan & Cacat Bersama
              </h3>
              <p className="text-xs text-sky-100 font-medium">
                Menerapkan keterangan & cacat ke {selectedDetails.length} panel sekaligus
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Panels Pill List */}
        <div className="px-6 py-3 bg-sky-50/80 border-b border-sky-100 flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto">
          <span className="text-xs font-black text-sky-900 mr-1 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-sky-600" /> Panel Terpilih ({selectedDetails.length}):
          </span>
          {selectedDetails.map((d, i) => {
            const pNo = String(d.production_headers?.panel_no || d.displayNo || `Pcs ${i + 1}`).replace(/\s*\((BS|GAGAL)\)/gi, "");
            return (
              <span
                key={d.id || i}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white border border-sky-200 text-sky-800 text-[11px] font-extrabold shadow-2xs"
              >
                Panel {pNo}
              </span>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              {errorMsg}
            </div>
          )}

          {/* 1. Temuan Cacat QC Master */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                PILIH DETAIL MASALAH
              </label>
              {selectedQCDefects.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-rose-100 text-rose-700 rounded-full">
                    {selectedQCDefects.length} Terpilih
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedQCDefects([])}
                    className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            {/* 2-Column Grid Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {masterQCDefects.map((d) => {
                const isSelected = selectedQCDefects.includes(d.nama_cacat);
                return (
                  <button
                    key={d.id || d.nama_cacat}
                    type="button"
                    onClick={() => handleToggleQCDefect(d.nama_cacat)}
                    className={`min-h-[48px] px-4 py-3 rounded-2xl border text-center font-bold text-xs sm:text-[13px] leading-snug transition-all flex items-center justify-center cursor-pointer active:scale-98 ${
                      isSelected
                        ? "border-rose-500 bg-rose-50/80 text-rose-900 shadow-xs ring-2 ring-rose-500/20"
                        : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span>{d.nama_cacat}</span>
                  </button>
                );
              })}

              {/* Any custom added defects */}
              {selectedQCDefects
                .filter((name) => !masterQCDefects.some((d) => d.nama_cacat.toLowerCase() === name.toLowerCase()))
                .map((customName) => (
                  <button
                    key={customName}
                    type="button"
                    onClick={() => handleToggleQCDefect(customName)}
                    className="min-h-[48px] px-4 py-3 rounded-2xl border border-rose-500 bg-rose-50/80 text-rose-900 shadow-xs ring-2 ring-rose-500/20 text-center font-bold text-xs sm:text-[13px] leading-snug transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                    title="Klik untuk menghapus"
                  >
                    <span>{customName}</span>
                    <X className="w-3.5 h-3.5 text-rose-600 ml-1 shrink-0" />
                  </button>
                ))}
            </div>

            {/* Input Manual Cacat */}
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                placeholder="Cacat kain lainnya (manual)..."
                value={manualQCDefectText}
                onChange={(e) => setManualQCDefectText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddManualQCDefect();
                  }
                }}
                className="flex-1 h-10 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
              <button
                type="button"
                onClick={handleAddManualQCDefect}
                className="h-10 px-4 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all cursor-pointer shrink-0"
              >
                + Tambah
              </button>
            </div>
          </div>

          {/* 2. Catatan Khusus QC */}
          <div className="space-y-1.5 pt-3 border-t border-slate-100">
            <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-600" />
              2. Catatan / Keterangan Khusus QC (Opsional):
            </label>
            <textarea
              rows={2}
              value={keteranganQc}
              onChange={(e) => setKeteranganQc(e.target.value)}
              placeholder="Contoh: Toleransi grade B, serat halus / Perlu obras ulang di mending..."
              className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all placeholder:text-slate-400 font-medium resize-none shadow-2xs"
            />
            <p className="text-[11px] text-slate-500">
              Catatan ini akan tampil dengan warna <strong>Biru</strong> di tabel inspeksi dan laporan.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/80 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSaveBulk}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#0070bc] hover:bg-sky-700 active:scale-95 text-white shadow-md shadow-[#0070bc]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting
              ? "Menerapkan..."
              : selectedQCDefects.length > 0
              ? `Terapkan (${selectedQCDefects.length} Cacat) ke ${selectedDetails.length} Panel`
              : `Terapkan ke ${selectedDetails.length} Panel Terpilih`}
          </button>
        </div>
      </div>
    </div>
  );
}
