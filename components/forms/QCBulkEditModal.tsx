"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  FileText,
  Tag,
  Save,
  Loader2,
  Layers,
  Sparkles,
  CheckSquare,
} from "lucide-react";
import { PROBLEM_DETAILS } from "@/app/qc/page";
import { bulkUpdateQCDetails } from "@/actions/qc-actions";

export const QC_PROBLEM_CATEGORIES = [
  { id: "A", name: "Kode A: Masalah Benang & Jarum" },
  { id: "B", name: "Kode B: Masalah Mekanik" },
  { id: "C", name: "Kode C: Masalah Elektrik" },
  { id: "D", name: "Kode D: Masalah Bahan Baku" },
  { id: "E", name: "Kode E: Masalah Finishing" },
  { id: "F", name: "Kode F: Masalah Setting" },
  { id: "G", name: "Kode G: Lainnya" },
];

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
  const [selectedGrade, setSelectedGrade] = useState<number>(3); // Default Silang (3) when adding bulk defects, or user can choose
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDetailsMap, setSelectedDetailsMap] = useState<Record<string, string[]>>({});
  const [inputBloks, setInputBloks] = useState<Record<string, string>>({});
  const [manualInputDetails, setManualInputDetails] = useState<Record<string, string>>({});
  const [keteranganQc, setKeteranganQc] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSelectedGrade(3);
      setSelectedCategories([]);
      setSelectedDetailsMap({});
      setInputBloks({});
      setManualInputDetails({});
      setKeteranganQc("");
    }
  }, [isOpen]);

  if (!isOpen || selectedDetails.length === 0) return null;

  const handleToggleCategory = (catId: string) => {
    setSelectedCategories((prev) => {
      const isChecking = !prev.includes(catId);
      if (isChecking) {
        if (selectedGrade === 1) setSelectedGrade(3);
        return [...prev, catId];
      } else {
        setSelectedDetailsMap((old) => {
          const next = { ...old };
          delete next[catId];
          return next;
        });
        setInputBloks((old) => {
          const next = { ...old };
          delete next[catId];
          return next;
        });
        setManualInputDetails((old) => {
          const next = { ...old };
          delete next[catId];
          return next;
        });
        return prev.filter((id) => id !== catId);
      }
    });
  };

  const handleToggleDetail = (catId: string, detailName: string) => {
    setSelectedDetailsMap((prev) => {
      const currentList = prev[catId] || [];
      const isChecking = !currentList.includes(detailName);
      let updatedList: string[];
      if (isChecking) {
        updatedList = [...currentList, detailName];
      } else {
        updatedList = currentList.filter((d) => d !== detailName);
      }
      return { ...prev, [catId]: updatedList };
    });
  };

  const handleAddManualDetail = (catId: string) => {
    const text = (manualInputDetails[catId] || "").trim();
    if (!text) return;
    setSelectedDetailsMap((prev) => {
      const currentList = prev[catId] || [];
      if (!currentList.includes(text)) {
        return { ...prev, [catId]: [...currentList, text] };
      }
      return prev;
    });
    setManualInputDetails((prev) => ({ ...prev, [catId]: "" }));
  };

  const handleSaveBulk = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const detailIds = selectedDetails.map((d) => d.id);
      const isBs = selectedGrade === 4;

      const defectsPayload: { kategori: string; detail?: string; blok?: string }[] = [];
      const combinedDetailStrings: string[] = [];

      selectedCategories.forEach((catId) => {
        const detailsForCat = selectedDetailsMap[catId] || [];
        const blokStr = inputBloks[catId] || "";

        if (detailsForCat.length > 0) {
          detailsForCat.forEach((det) => {
            defectsPayload.push({
              kategori: catId,
              detail: det,
              blok: blokStr || undefined,
            });
            combinedDetailStrings.push(det);
          });
        } else {
          defectsPayload.push({
            kategori: catId,
            detail: undefined,
            blok: blokStr || undefined,
          });
        }
      });

      const detailMasalahStr = combinedDetailStrings.length > 0 ? combinedDetailStrings.join(", ") : undefined;
      const blokStrings = Object.entries(inputBloks)
        .map(([_, b]) => (b ? `Blok ${b}` : ""))
        .filter(Boolean)
        .join(", ");

      const res = await bulkUpdateQCDetails({
        detailIds,
        kategoriMasalah: selectedCategories.length > 0 ? selectedCategories : undefined,
        detailMasalah: detailMasalahStr,
        keteranganCacat: blokStrings || (selectedCategories.length > 0 ? "[TAMBAHAN QC]" : undefined),
        keteranganQc: keteranganQc.trim() || undefined,
        finalInspectionId: selectedGrade,
        defects: defectsPayload.length > 0 ? defectsPayload : undefined,
        isBs,
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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-sky-600 to-indigo-700 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-xs shadow-xs">
              <CheckSquare className="w-5 h-5" />
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

          {/* 1. Grade Selector */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
              1. Tetapkan Status Grade untuk Semua Panel Terpilih:
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSelectedGrade(1)}
                className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedGrade === 1
                    ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                ✓ Pass (Ceklis)
              </button>
              <button
                type="button"
                onClick={() => setSelectedGrade(3)}
                className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedGrade === 3
                    ? "bg-rose-500 text-white border-rose-600 shadow-sm"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <XCircle className="w-4 h-4" />
                ✗ Defect (Silang)
              </button>
              <button
                type="button"
                onClick={() => setSelectedGrade(4)}
                className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedGrade === 4
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                BS (Kain Rusak)
              </button>
            </div>
          </div>

          {/* 2. Catatan Khusus QC */}
          <div className="bg-sky-50/60 p-4 rounded-xl border border-sky-200">
            <label className="block text-xs font-extrabold text-sky-950 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-600" />
              2. Catatan / Keterangan Khusus QC (Opsional):
            </label>
            <input
              type="text"
              value={keteranganQc}
              onChange={(e) => setKeteranganQc(e.target.value)}
              placeholder="Contoh: Toleransi grade B, serat halus, kain lipat..."
              className="w-full px-3.5 py-2.5 text-xs bg-white border border-sky-300 rounded-lg text-slate-800 placeholder-slate-400 font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
            <p className="text-[11px] text-sky-700 mt-1">
              Catatan ini akan tampil dengan warna <strong>Biru</strong> di tabel inspeksi dan laporan.
            </p>
          </div>

          {/* 3. Kategori Masalah Cacat */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
              3. Pilih Kategori Masalah (Jika Ada Cacat):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QC_PROBLEM_CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleToggleCategory(cat.id)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? "bg-sky-50 border-sky-500 text-sky-900 shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                        isSelected
                          ? "bg-sky-600 border-sky-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Rincian Detail Cacat & Blok untuk Kategori Terpilih */}
          {selectedCategories.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                4. Rincian Detail Masalah & Posisi Blok:
              </label>

              {selectedCategories.map((catId) => {
                const catObj = QC_PROBLEM_CATEGORIES.find((c) => c.id === catId);
                const knownDetails = PROBLEM_DETAILS[catId] || [];
                const currentSelectedDetails = selectedDetailsMap[catId] || [];

                return (
                  <div
                    key={catId}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-extrabold text-xs text-sky-900">
                        {catObj?.name || `Kode ${catId}`}
                      </span>
                    </div>

                    {/* Problem detail chips */}
                    {knownDetails.length > 0 && (
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 mb-1.5 block">
                          Pilih Detail Masalah:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {knownDetails.map((detName: string) => {
                            const isDetSelected = currentSelectedDetails.includes(detName);
                            return (
                              <button
                                key={detName}
                                type="button"
                                onClick={() => handleToggleDetail(catId, detName)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                                  isDetSelected
                                    ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                                }`}
                              >
                                {detName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Manual detail input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualInputDetails[catId] || ""}
                        onChange={(e) =>
                          setManualInputDetails((prev) => ({ ...prev, [catId]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddManualDetail(catId);
                          }
                        }}
                        placeholder={`Ketik detail manual untuk Kode ${catId}...`}
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddManualDetail(catId)}
                        className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-300 transition-all cursor-pointer"
                      >
                        + Tambah
                      </button>
                    </div>

                    {/* Block input */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 mb-1 block">
                        Nomor Blok (Opsional, pisahkan koma jika banyak):
                      </span>
                      <input
                        type="text"
                        value={inputBloks[catId] || ""}
                        onChange={(e) =>
                          setInputBloks((prev) => ({ ...prev, [catId]: e.target.value }))
                        }
                        placeholder="Contoh: 12, 14, 25"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-sky-500 font-mono"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 border border-slate-200 transition-all cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSaveBulk}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-extrabold text-xs shadow-md hover:from-sky-700 hover:to-indigo-700 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menerapkan ke {selectedDetails.length} Panel...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Terapkan ke {selectedDetails.length} Panel Terpilih
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
