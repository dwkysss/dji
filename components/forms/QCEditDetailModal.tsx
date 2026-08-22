"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Edit3,
  Plus,
  ArrowRightLeft,
  ArrowRight,
} from "lucide-react";
import { updateQCDetailDefectsAndNotes, swapOrMoveQCDefects, bulkUpdateQCDetails } from "@/actions/qc-actions";
import { getQCDefects, QCDefectItem } from "@/actions/qc-defect-actions";

interface QCEditDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  detail: any;
  problemCategories?: { id: string; name: string }[];
  problemDetailsMap?: Record<string, string[]>;
  allBatchDetails?: any[];
  currentGrade?: number;
  mode?: "add_qc" | "edit";
  onSuccess: (detailId: string, newGrade: number, updatedData?: any) => void;
}

export default function QCEditDetailModal({
  isOpen,
  onClose,
  detail,
  allBatchDetails = [],
  currentGrade,
  mode = "edit",
  onSuccess,
}: QCEditDetailModalProps) {
  const [selectedQCDefects, setSelectedQCDefects] = useState<string[]>([]);
  const [masterQCDefects, setMasterQCDefects] = useState<QCDefectItem[]>([]);
  const [manualQCDefectText, setManualQCDefectText] = useState("");
  const [keteranganQc, setKeteranganQc] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Move / Swap State
  const [targetMoveDetailId, setTargetMoveDetailId] = useState<string>("");
  const [isMoving, setIsMoving] = useState(false);
  const [isMoveSectionOpen, setIsMoveSectionOpen] = useState(false);

  const header = detail?.production_headers || {};
  const rawPanelNo = String(header.panel_no || detail?.displayNo || "-");
  const isMeteran = rawPanelNo === "METERAN";
  const displayTitle = isMeteran
    ? `Meteran / Roll (${detail?.meter_kain || "-"}m)`
    : `Panel ${rawPanelNo.replace(/\s*\((BS|GAGAL)\)/gi, "").trim()}`;

  // Filter other panels for move/swap
  const otherPanels = React.useMemo(() => {
    return allBatchDetails.filter((d: any) => d.id !== detail?.id && !d.is_deleted && d.status_inspeksi !== "Dihapus");
  }, [allBatchDetails, detail]);

  useEffect(() => {
    if (isOpen) {
      getQCDefects().then((res) => {
        if (res.success && res.data) {
          setMasterQCDefects(res.data);
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && detail) {
      setErrorMsg(null);
      setIsMoveSectionOpen(false);
      
      // Select first available target panel if any
      if (otherPanels.length > 0) {
        setTargetMoveDetailId(otherPanels[0].id);
      } else {
        setTargetMoveDetailId("");
      }

      if (mode === "add_qc") {
        // Mode Tambah QC: Mulai dalam keadaan bersih/kosong
        setSelectedQCDefects([]);
        setManualQCDefectText("");
        setKeteranganQc(detail.keterangan_qc || "");
        return;
      }
      
      // Mode Edit / Koreksi: Isi dengan data cacat bawaan yang sudah ada
      const existingDefects: string[] = [];
      if (detail.production_defects && Array.isArray(detail.production_defects) && detail.production_defects.length > 0) {
        detail.production_defects.forEach((d: any) => {
          if (d.detail) {
            const cleanD = String(d.detail).replace(/^\[QC\]\s*/i, "").trim();
            if (cleanD && !existingDefects.includes(cleanD) && !cleanD.toUpperCase().includes("GAGAL CACAT")) {
              existingDefects.push(cleanD);
            }
          }
        });
      }
      if (existingDefects.length === 0 && detail.detail_masalah) {
        const parts = String(detail.detail_masalah).split(/[,|]/);
        parts.forEach((p) => {
          const cleanP = p.replace(/^\[QC\]\s*/i, "").trim();
          if (cleanP && !existingDefects.includes(cleanP) && !cleanP.toUpperCase().includes("GAGAL CACAT")) {
            existingDefects.push(cleanP);
          }
        });
      }

      setSelectedQCDefects(existingDefects);
      setManualQCDefectText("");
      setKeteranganQc(detail.keterangan_qc || "");
    }
  }, [isOpen, detail, currentGrade, mode]);

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

  const handleSave = async () => {
    if (!detail?.id) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const defectObjects = selectedQCDefects.map((name) => ({
        kategori: "A",
        detail: name,
        blok: undefined,
        meter: undefined,
      }));

      const finalGrade = selectedQCDefects.length > 0 ? 3 : 1;

      if (mode === "add_qc") {
        const res = await bulkUpdateQCDetails({
          detailIds: [detail.id],
          kategoriMasalah: selectedQCDefects.length > 0 ? ["A"] : undefined,
          detailMasalah: selectedQCDefects.join(", ") || undefined,
          keteranganCacat: undefined,
          keteranganQc: keteranganQc.trim() || undefined,
          isBs: false,
          finalInspectionId: 3,
          defects: defectObjects,
        });

        if (res.success) {
          onSuccess(detail.id, 3, res.updatedData);
          onClose();
        } else {
          setErrorMsg(res.error || "Gagal menambahkan temuan QC.");
        }
        return;
      }

      // Mode Edit / Koreksi
      const res = await updateQCDetailDefectsAndNotes({
        detailId: detail.id,
        kategoriMasalah: selectedQCDefects.length > 0 ? ["A"] : undefined,
        detailMasalah: selectedQCDefects.join(", ") || undefined,
        keteranganCacat: undefined,
        keteranganQc: keteranganQc.trim() || undefined,
        isBs: false,
        finalInspectionId: finalGrade,
        defects: defectObjects,
      });

      if (res.success) {
        onSuccess(detail.id, finalGrade, {
          keterangan_qc: keteranganQc.trim(),
          detail_masalah: selectedQCDefects.join(", "),
          kategori_masalah: selectedQCDefects.length > 0 ? "A" : "",
          production_defects: defectObjects,
        });
        onClose();
      } else {
        setErrorMsg(res.error || "Gagal menyimpan perubahan.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveOrSwap = async (mode: "move" | "swap") => {
    if (!detail?.id || !targetMoveDetailId) {
      setErrorMsg("Pilih panel tujuan terlebih dahulu.");
      return;
    }

    setIsMoving(true);
    setErrorMsg(null);

    try {
      const res = await swapOrMoveQCDefects({
        sourceDetailId: detail.id,
        targetDetailId: targetMoveDetailId,
        mode,
      });

      if (res.success) {
        onSuccess(detail.id, 1);
        onClose();
      } else {
        setErrorMsg(res.error || "Gagal memproses pemindahan/tukar cacat.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsMoving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-scaleUp">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-sky-100 text-[#0070bc] flex items-center justify-center shrink-0 shadow-2xs">
              {mode === "add_qc" ? <Plus className="w-5 h-5 stroke-[2.5]" /> : <Edit3 className="w-5 h-5 stroke-[2.5]" />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                {mode === "add_qc" ? "Tambah Temuan QC" : "Koreksi Temuan Cacat Panel"}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                <span className="px-2.5 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-[#0070bc] font-extrabold text-[11px] shadow-2xs">
                  {displayTitle}
                </span>
                {header.nomor_mc && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-slate-700 font-bold text-[11px]">
                    Mesin {header.nomor_mc}
                  </span>
                )}
                {header.potongan_ke && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-slate-700 font-bold text-[11px]">
                    Potongan {header.potongan_ke}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-5 custom-scrollbar">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section: Pindahkan / Tukar Cacat (Swapping / Moving) - Khusus Mode Koreksi */}
          {mode === "edit" && otherPanels.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-black text-amber-900 uppercase tracking-wide">
                    Pindahkan / Tukar Cacat ke Panel Lain
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMoveSectionOpen(!isMoveSectionOpen)}
                  className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                >
                  {isMoveSectionOpen ? "Tutup Fitur Pindah" : "Buka Fitur Pindah"}
                </button>
              </div>

              {isMoveSectionOpen && (
                <div className="flex flex-col gap-3 pt-2 border-t border-amber-200/60 animate-fadeIn">
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    Gunakan opsi ini jika data cacat pada <strong>{displayTitle}</strong> salah input oleh operator dan sebenarnya berada di panel lain.
                  </p>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-amber-900 uppercase">
                      Pilih Panel Tujuan:
                    </label>
                    <select
                      value={targetMoveDetailId}
                      onChange={(e) => setTargetMoveDetailId(e.target.value)}
                      className="h-10 px-3 rounded-xl bg-white border border-amber-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      {otherPanels.map((p: any) => {
                        const pHdr = p.production_headers || {};
                        const pNo = String(pHdr.panel_no || p.displayNo || "").replace(/\s*\((BS|GAGAL)\)/gi, "").trim();
                        const pName = pNo === "METERAN" ? `Meteran (${p.meter_kain || "-"}m)` : `Panel ${pNo}`;
                        const currentKet = p.detail_masalah || p.keterangan_cacat ? `[Cacat: ${p.detail_masalah || p.keterangan_cacat}]` : "[Bersih / ✓]";
                        return (
                          <option key={p.id} value={p.id}>
                            {pName} — {currentKet}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      disabled={isMoving || isSaving || !targetMoveDetailId}
                      onClick={() => handleMoveOrSwap("move")}
                      className="h-10 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      title="Pindahkan semua cacat ke panel target dan buat panel ini bersih"
                    >
                      {isMoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                      <span>Pindahkan Cacat Saja</span>
                    </button>

                    <button
                      type="button"
                      disabled={isMoving || isSaving || !targetMoveDetailId}
                      onClick={() => handleMoveOrSwap("swap")}
                      className="h-10 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      title="Tukar seluruh data cacat antara panel ini dan panel target"
                    >
                      {isMoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                      <span>Tukar Data (Swap)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section: PILIH DETAIL MASALAH (Grid 2 Kolom) */}
          <div className="flex flex-col gap-3">
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

            {/* Catatan / Keterangan Khusus QC */}
            <div className="space-y-1.5 pt-3 border-t border-slate-100">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-sky-600" />
                Catatan / Keterangan Khusus QC (Opsional):
              </label>
              <textarea
                rows={2}
                value={keteranganQc}
                onChange={(e) => setKeteranganQc(e.target.value)}
                placeholder="Contoh: Toleransi grade B, serat halus / Perlu obras ulang di mending..."
                className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all placeholder:text-slate-400 font-medium resize-none shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isMoving}
            className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isMoving}
            className="px-6 py-2.5 rounded-xl bg-[#0070bc] hover:bg-[#005a96] active:scale-95 text-white font-bold text-xs transition-all shadow-md shadow-[#0070bc]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>
                  {selectedQCDefects.length > 0
                    ? `Simpan (${selectedQCDefects.length} Cacat Terpilih)`
                    : "Simpan Temuan QC"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
