"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Edit3,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { updateQCDetailDefectsAndNotes, swapOrMoveQCDefects } from "@/actions/qc-actions";
import { createProblemDetail } from "@/actions/problem-detail-actions";

interface QCEditDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  detail: any;
  problemCategories: { id: string; name: string }[];
  problemDetailsMap: Record<string, string[]>;
  allBatchDetails?: any[];
  currentGrade?: number;
  onSuccess: (detailId: string, newGrade: number) => void;
}

export default function QCEditDetailModal({
  isOpen,
  onClose,
  detail,
  problemCategories,
  problemDetailsMap,
  allBatchDetails = [],
  currentGrade,
  onSuccess,
}: QCEditDetailModalProps) {
  const [selectedGrade, setSelectedGrade] = useState<number>(currentGrade || 1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<Record<string, string[]>>({});
  const [inputBloks, setInputBloks] = useState<Record<string, string>>({});
  const [manualInputDetails, setManualInputDetails] = useState<Record<string, string>>({});
  const [keteranganCacat, setKeteranganCacat] = useState("");
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
    if (isOpen && detail) {
      setErrorMsg(null);
      setIsMoveSectionOpen(false);
      
      // Select first available target panel if any
      if (otherPanels.length > 0) {
        setTargetMoveDetailId(otherPanels[0].id);
      } else {
        setTargetMoveDetailId("");
      }
      
      // Determine initial grade
      const hasRealCacat = (detail.kategori_masalah && detail.kategori_masalah !== "G" && !String(detail.kategori_masalah).includes("GAGAL CACAT")) || 
                           (detail.detail_masalah && !String(detail.detail_masalah).includes("GAGAL CACAT") && !String(detail.detail_masalah).includes("ISTIRAHAT")) || 
                           (detail.production_defects && detail.production_defects.some((pd: any) => !pd.detail?.toUpperCase().includes("GAGAL CACAT") && pd.kategori !== "G" && !pd.kategori?.toUpperCase().includes("ISTIRAHAT")));
      
      const initialGrade = currentGrade || detail.final_inspection_id || (detail.jml_hasil_produksi === 0 || detail.status_inspeksi === "BS" ? 4 : (hasRealCacat ? 3 : 1));
      setSelectedGrade(initialGrade);

      // Parse existing categories
      let initialCats: string[] = [];
      if (detail.kategori_masalah) {
        if (Array.isArray(detail.kategori_masalah)) {
          initialCats = detail.kategori_masalah;
        } else {
          initialCats = String(detail.kategori_masalah).split(",").map((s) => s.trim()).filter(Boolean);
        }
      }

      // Parse existing details
      const initialDetailsMap: Record<string, string[]> = {};
      const initialBlokMap: Record<string, string> = {};

      if (detail.production_defects && Array.isArray(detail.production_defects) && detail.production_defects.length > 0) {
        detail.production_defects.forEach((d: any) => {
          if (!d.kategori) return;
          if (!initialCats.includes(d.kategori)) initialCats.push(d.kategori);
          
          if (d.detail) {
            if (!initialDetailsMap[d.kategori]) initialDetailsMap[d.kategori] = [];
            if (!initialDetailsMap[d.kategori].includes(d.detail)) {
              initialDetailsMap[d.kategori].push(d.detail);
            }
          }
          if (d.blok) {
            const cleanB = String(d.blok).replace(/blok\s*/gi, "").trim();
            if (cleanB) {
              if (initialBlokMap[d.kategori]) {
                const existing = initialBlokMap[d.kategori].split(",").map((s) => s.trim());
                if (!existing.includes(cleanB)) {
                  initialBlokMap[d.kategori] = `${initialBlokMap[d.kategori]}, ${cleanB}`;
                }
              } else {
                initialBlokMap[d.kategori] = cleanB;
              }
            }
          }
        });
      } else if (detail.detail_masalah) {
        // Fallback parse legacy detail_masalah
        const parts = String(detail.detail_masalah).split(" | ");
        initialCats.forEach((cat, idx) => {
          const detStr = parts[idx] || (initialCats.length === 1 ? detail.detail_masalah : "");
          if (detStr) {
            initialDetailsMap[cat] = detStr.split(", ").map((s: string) => s.trim()).filter(Boolean);
          }
        });
      }

      // Parse existing block notes from keterangan_cacat
      let cleanKet = String(detail.keterangan_cacat || "");
      cleanKet = cleanKet.replace(/\[?(SEBELUM|LAPORAN)?\s*ISTIRAHAT\]?/gi, "").trim();
      cleanKet = cleanKet.replace(/\[TAMBAHAN QC\]/gi, "").trim();
      cleanKet = cleanKet.replace(/^,\s*|\s*,\s*$/g, "");

      if (cleanKet && Object.keys(initialBlokMap).length === 0 && initialCats.length > 0) {
        const blokMatch = cleanKet.match(/blok\s*([^,\)]+)/i);
        if (blokMatch && blokMatch[1]) {
          initialBlokMap[initialCats[0]] = blokMatch[1].trim();
        }
      }

      setSelectedCategories(initialCats);
      setSelectedDetails(initialDetailsMap);
      setInputBloks(initialBlokMap);
      setKeteranganCacat(cleanKet);
      setManualInputDetails({});
    }
  }, [isOpen, detail, currentGrade]);

  const handleToggleCategory = (catId: string) => {
    setSelectedCategories((prev) => {
      const isChecking = !prev.includes(catId);
      if (isChecking) {
        // When defect category is added, auto-change grade to Silang (3) if it's currently Ceklis (1)
        if (selectedGrade === 1) {
          setSelectedGrade(3);
        }
        return [...prev, catId];
      } else {
        setSelectedDetails((old) => {
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
        const remaining = prev.filter((id) => id !== catId);
        // When all defect categories are unchecked and grade is Silang, auto-reset back to Ceklis (1)
        if (remaining.length === 0 && selectedGrade === 3) {
          setSelectedGrade(1);
        }
        return remaining;
      }
    });
  };

  const handleToggleDetail = (catId: string, detailName: string) => {
    setSelectedDetails((prev) => {
      const currentList = prev[catId] || [];
      if (currentList.includes(detailName)) {
        return {
          ...prev,
          [catId]: currentList.filter((d) => d !== detailName),
        };
      } else {
        return {
          ...prev,
          [catId]: [...currentList, detailName],
        };
      }
    });
  };

  const handleSave = async () => {
    if (!detail?.id) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      // 1. Build combined detail_masalah
      const defectObjects: { kategori: string; detail?: string; blok?: string; meter?: number }[] = [];
      const detailMasalahList: string[] = [];

      selectedCategories.forEach((catId) => {
        let details = [...(selectedDetails[catId] || [])];
        const manual = (manualInputDetails[catId] || "").trim();
        if (manual && !details.includes(manual)) {
          details.push(manual);
          try {
            createProblemDetail({ kategori: catId, nama_detail: manual });
          } catch (e) {}
        }

        const block = (inputBloks[catId] || "").trim();

        if (details.length > 0) {
          detailMasalahList.push(details.join(", "));
          details.forEach((d) => {
            defectObjects.push({
              kategori: catId,
              detail: d,
              blok: block || undefined,
            });
          });
        } else {
          defectObjects.push({
            kategori: catId,
            detail: undefined,
            blok: block || undefined,
          });
        }
      });

      const combinedDetailMasalah = detailMasalahList.join(" | ");

      // 2. Build block and custom notes for keterangan_cacat
      const blockParts = selectedCategories
        .map((catId) => {
          const b = inputBloks[catId]?.trim();
          return b ? `Blok ${b}` : "";
        })
        .filter(Boolean);

      let finalKeteranganCacat = blockParts.join(", ");
      if (keteranganCacat.trim() && !finalKeteranganCacat.includes(keteranganCacat.trim())) {
        finalKeteranganCacat = finalKeteranganCacat
          ? `${finalKeteranganCacat}, ${keteranganCacat.trim()}`
          : keteranganCacat.trim();
      }

      const isBs = selectedGrade === 4;

      const res = await updateQCDetailDefectsAndNotes({
        detailId: detail.id,
        kategoriMasalah: selectedCategories.length > 0 ? selectedCategories : undefined,
        detailMasalah: combinedDetailMasalah || undefined,
        keteranganCacat: finalKeteranganCacat || undefined,
        keteranganQc: detail.keterangan_qc || undefined,
        isBs,
        finalInspectionId: selectedGrade,
        defects: defectObjects,
      });

      if (res.success) {
        onSuccess(detail.id, selectedGrade);
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
        // Source is now clean (Grade 1), target is updated
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
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 text-[#0070bc] flex items-center justify-center shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Tambah / Ubah Keterangan QC
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-bold text-slate-700">{displayTitle}</span> • Mesin {header.nomor_mc || "-"} • Potongan {header.potongan_ke || "-"}
              </p>
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

          {/* Section: Pindahkan / Tukar Cacat (Swapping / Moving) */}
          {otherPanels.length > 0 && (
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

          {/* Section 1: Pilihan Grade / Status Inspeksi */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wide">
              Status Inspeksi QC:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* Ceklis (✓) */}
              <button
                type="button"
                onClick={() => setSelectedGrade(1)}
                className={`py-3 px-3 rounded-2xl border-2 font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  selectedGrade === 1
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm ring-2 ring-emerald-200"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Ceklis (✓)</span>
              </button>

              {/* Silang (X) */}
              <button
                type="button"
                onClick={() => setSelectedGrade(3)}
                className={`py-3 px-3 rounded-2xl border-2 font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  selectedGrade === 3
                    ? "border-rose-500 bg-rose-50 text-rose-700 shadow-sm ring-2 ring-rose-200"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Silang (X)</span>
              </button>

              {/* BS (Reject) */}
              <button
                type="button"
                onClick={() => setSelectedGrade(4)}
                className={`py-3 px-3 rounded-2xl border-2 font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  selectedGrade === 4
                    ? "border-red-600 bg-red-600 text-white shadow-sm ring-2 ring-red-300"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="font-black text-sm">BS (Reject)</span>
              </button>
            </div>
          </div>

          {/* Section 2: Kategori & Detail Masalah */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wide">
                Temuan Cacat / Masalah:
              </label>
              {selectedCategories.length > 0 && (
                <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                  {selectedCategories.length} Kategori Terpilih
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 border border-slate-200 rounded-2xl p-3 bg-slate-50/50">
              <p className="text-[11px] text-slate-500 mb-1">
                Pilih kategori cacat yang ditemukan pada panel ini:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {problemCategories.map((c) => {
                  const isChecked = selectedCategories.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleToggleCategory(c.id)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between text-left cursor-pointer ${
                        isChecked
                          ? "border-rose-500 bg-rose-50 text-rose-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      {isChecked && <CheckCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>

              {/* Rincian Detail & Blok untuk Kategori Terpilih */}
              {selectedCategories.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col gap-3">
                  {selectedCategories.map((catId) => {
                    const catObj = problemCategories.find((c) => c.id === catId);
                    const detailsList = problemDetailsMap[catId] || [];
                    const currentSelectedDetails = selectedDetails[catId] || [];

                    return (
                      <div key={catId} className="p-3 bg-white rounded-xl border border-rose-200 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-rose-800">
                            {catObj?.name || `Kategori ${catId}`}
                          </span>
                        </div>

                        {/* List Detail Masalah */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1">
                          {detailsList.map((det) => {
                            const isDetChecked = currentSelectedDetails.includes(det);
                            return (
                              <label
                                key={det}
                                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium flex items-center gap-2 cursor-pointer transition-all ${
                                  isDetChecked
                                    ? "border-rose-400 bg-rose-50 text-rose-900 font-bold"
                                    : "border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isDetChecked}
                                  onChange={() => handleToggleDetail(catId, det)}
                                  className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500"
                                />
                                <span className="truncate">{det}</span>
                              </label>
                            );
                          })}
                        </div>

                        {/* Input Manual Tambahan Detail */}
                        <div className="flex gap-2 items-center mt-1">
                          <input
                            type="text"
                            placeholder="Detail masalah lain (manual)..."
                            value={manualInputDetails[catId] || ""}
                            onChange={(e) =>
                              setManualInputDetails((prev) => ({
                                ...prev,
                                [catId]: e.target.value,
                              }))
                            }
                            className="flex-1 h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:border-rose-400 focus:ring-1 focus:ring-rose-200 outline-none"
                          />
                        </div>

                        {/* Input Blok Cacat */}
                        <div className="flex items-center gap-2 mt-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">
                            Nomor Blok:
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: 2 atau 15, 25"
                            value={inputBloks[catId] || ""}
                            onChange={(e) =>
                              setInputBloks((prev) => ({
                                ...prev,
                                [catId]: e.target.value,
                              }))
                            }
                            className="flex-1 h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:border-rose-400 focus:ring-1 focus:ring-rose-200 outline-none font-medium"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
