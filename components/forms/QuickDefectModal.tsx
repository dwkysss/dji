"use client";

import React, { useState, useEffect } from "react";
import { Timer, Box, CheckCircle2, Plus, X, Edit3, Loader2 } from "lucide-react";
import { GROUPED_PROBLEM_DETAILS, PROBLEM_DETAILS, ProblemDetailGroup } from "@/lib/constants";
import { getProblemGroupMapping, createProblemDetail } from "@/actions/problem-detail-actions";

export interface QuickDefectData {
  kategori: string;
  detail: string;
  blok?: string;
}

interface QuickDefectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (defectData: QuickDefectData) => Promise<void>;
  panelNo: string;
  pcsIndex: number;
}

const PROBLEM_CATEGORIES = [
  { id: "A", name: "Kode A: Masalah dan Perbaikan Benang" },
  { id: "B", name: "Kode B: Perbaikan Jarum dan Element Rajutan (Mechanical)" },
  { id: "C", name: "Kode C: Pengaturan dan Design stup" },
  { id: "D", name: "Kode D: Bahan Baku dan penggantian Benang" },
  { id: "E", name: "Kode E: Masalah Kelistrikan" },
  { id: "F", name: "Kode F: Perawatan Mesin,Perbaikan Mekanik (maintenance)" },
  { id: "G", name: "Kode G: Faktor Eksternal dan Non-Teknis" },
];

const REQUIRED_BLOCK_DEFECTS = [
  "L1/L2/L3 Benang timbul putus",
  "Benang lolos",
  "Bolong corak",
  "Jarum pattern patah/bengkok",
  "Ganti Jacquard",
];

export default function QuickDefectModal({
  isOpen,
  onClose,
  onSave,
  panelNo,
  pcsIndex,
}: QuickDefectModalProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<Record<string, string[]>>({});
  const [inputBloks, setInputBloks] = useState<Record<string, string>>({});
  const [manualInputDetails, setManualInputDetails] = useState<Record<string, string>>({});
  const [blockValidationError, setBlockValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [dynamicGroupMapping, setDynamicGroupMapping] = useState<Record<string, ProblemDetailGroup[]>>(GROUPED_PROBLEM_DETAILS);

  useEffect(() => {
    if (isOpen) {
      setSelectedCategories([]);
      setSelectedDetails({});
      setInputBloks({});
      setManualInputDetails({});
      setBlockValidationError(null);
      setIsSubmitting(false);

      getProblemGroupMapping()
        .then((res) => {
          if (res.success && res.mapping) {
            setDynamicGroupMapping(res.mapping);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddManualDetail = (catId: string) => {
    const text = (manualInputDetails[catId] || "").trim();
    if (!text) return;

    if (!selectedCategories.includes(catId)) {
      setSelectedCategories((prev) => [...prev, catId]);
    }

    setSelectedDetails((prev) => {
      const current = prev[catId] || [];
      if (!current.includes(text)) {
        return { ...prev, [catId]: [...current, text] };
      }
      return prev;
    });

    setManualInputDetails((prev) => ({ ...prev, [catId]: "" }));
    try {
      createProblemDetail({ kategori: catId, nama_detail: text });
    } catch (e) {}
  };

  const handleSaveNonDefect = async () => {
    setIsSubmitting(true);
    try {
      await onSave({
        kategori: "G",
        detail: "Gagal Cacat",
      });
      onClose();
    } catch (e: any) {
      alert(e.message || "Gagal menyimpan data");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDefect = async () => {
    if (selectedCategories.length === 0) return;

    // Validasi blok untuk kategori yang wajib
    for (const catId of selectedCategories) {
      const details = selectedDetails[catId] || [];
      const reqDetails = details.filter((d) => REQUIRED_BLOCK_DEFECTS.includes(d));
      if (reqDetails.length > 0) {
        const blockVal = inputBloks[catId]?.trim();
        if (!blockVal) {
          setBlockValidationError(`Nomor blok WAJIB DIISI untuk masalah: "${reqDetails.join(", ")}"`);
          return;
        }
      }
    }
    setBlockValidationError(null);

    // Kumpulkan rincian cacat
    const allCategoriesList: string[] = [];
    const allDetailsList: string[] = [];
    const allBlocksList: string[] = [];

    selectedCategories.forEach((catId) => {
      allCategoriesList.push(catId);
      const details = selectedDetails[catId] || [];
      const manualText = (manualInputDetails[catId] || "").trim();
      const combinedDetails = [...details];
      if (manualText && !combinedDetails.includes(manualText)) {
        combinedDetails.push(manualText);
      }
      if (combinedDetails.length > 0) {
        allDetailsList.push(combinedDetails.join(", "));
      }
      if (inputBloks[catId]?.trim()) {
        allBlocksList.push(inputBloks[catId].trim());
      }
    });

    const finalKategori = allCategoriesList.join(", ");
    const finalDetail = allDetailsList.join(", ");
    const finalBlok = allBlocksList.join(", ");

    if (!finalDetail) {
      alert("Silakan pilih minimal 1 detail masalah!");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        kategori: finalKategori,
        detail: finalDetail,
        blok: finalBlok || undefined,
      });
      onClose();
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan laporan cacat.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh] animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (Identik dengan modal DowntimeTracker) */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-slate-800 text-sm sm:text-base">
                  Simpan Masalah
                </h3>
                <span className="text-[10px] font-black bg-sky-100 text-sky-700 px-2 py-0.5 rounded-lg border border-sky-200 uppercase tracking-wider">
                  Panel {panelNo} {pcsIndex > 0 ? `(PCS ${pcsIndex})` : ""}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                Pilih kategori dan detail masalah untuk mengubah status menjadi ❌
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Identik dengan kategori dan accordion detail DowntimeTracker) */}
        <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4 sm:space-y-5">
          {blockValidationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-2xs">
              <span>{blockValidationError}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase mb-2 block">
              Pilih Kategori Masalah
            </label>
            <div className="grid grid-cols-1 gap-2">
              {PROBLEM_CATEGORIES.map((cat) => (
                <div key={cat.id} className="flex flex-col gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="checkbox"
                      name="kategori"
                      value={cat.id}
                      checked={selectedCategories.includes(cat.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategories((prev) => [...prev, cat.id]);
                        } else {
                          setSelectedCategories((prev) => prev.filter((c) => c !== cat.id));
                          setSelectedDetails((prev) => {
                            const next = { ...prev };
                            delete next[cat.id];
                            return next;
                          });
                          setInputBloks((prev) => {
                            const next = { ...prev };
                            delete next[cat.id];
                            return next;
                          });
                        }
                      }}
                      className="peer sr-only"
                    />
                    <div className="p-3 rounded-xl border-2 border-slate-100 bg-white text-sm font-semibold text-slate-600 peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 transition-all hover:border-slate-300">
                      {cat.name}
                    </div>
                  </label>

                  {/* Accordion Detail Masalah saat Kategori Dipilih */}
                  {selectedCategories.includes(cat.id) && (
                    <div className="pl-3.5 pr-2 py-3 border-l-2 border-sky-300 ml-2 space-y-3.5 bg-slate-50/50 rounded-r-xl mt-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                          Pilih Detail Masalah
                        </label>
                        <span className="text-[10px] text-sky-600 font-bold">
                          {(selectedDetails[cat.id] || []).length} dipilih
                        </span>
                      </div>

                      {(() => {
                        const predefinedGroups = dynamicGroupMapping[cat.id] || GROUPED_PROBLEM_DETAILS[cat.id] || [];
                        const activeGroups = predefinedGroups.filter((g) => g.items && g.items.length > 0);
                        const allKnownItems = new Set(activeGroups.flatMap((g) => g.items));
                        const customInputDetails = (selectedDetails[cat.id] || []).filter((d) => !allKnownItems.has(d));

                        return (
                          <div className="space-y-3">
                            {activeGroups.map((group, gIdx) => {
                              const selectedInThisGroup = group.items.filter((item) => selectedDetails[cat.id]?.includes(item));
                              const hasSelectedInThisGroup = selectedInThisGroup.length > 0;

                              return (
                                <div key={gIdx} className="space-y-1.5">
                                  <div className="flex items-center gap-2 pt-1 first:pt-0">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-800 bg-sky-100/90 px-2 py-0.5 rounded border border-sky-200/70 shadow-2xs">
                                      {group.groupName}
                                    </span>
                                    <div className="flex-1 h-px bg-slate-200/80" />
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {group.items.map((detail) => (
                                      <label key={detail} className="cursor-pointer">
                                        <input
                                          type="checkbox"
                                          name={`detail-${cat.id}`}
                                          value={detail}
                                          checked={selectedDetails[cat.id]?.includes(detail) || false}
                                          onChange={(e) => {
                                            const current = selectedDetails[cat.id] || [];
                                            if (e.target.checked) {
                                              setSelectedDetails((prev) => ({
                                                ...prev,
                                                [cat.id]: [...current, detail],
                                              }));
                                            } else {
                                              setSelectedDetails((prev) => ({
                                                ...prev,
                                                [cat.id]: current.filter((d) => d !== detail),
                                              }));
                                            }
                                          }}
                                          className="peer sr-only"
                                        />
                                        <div className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 peer-checked:bg-sky-500 peer-checked:border-sky-500 peer-checked:text-white transition-all hover:bg-slate-50 text-center shadow-2xs">
                                          {detail}
                                        </div>
                                      </label>
                                    ))}
                                  </div>

                                  {/* Tampilkan Input Nomor Blok Tepat di Bawah Sub-Grup Masalah yang Dipilih */}
                                  {hasSelectedInThisGroup && (() => {
                                    const reqDetails = selectedInThisGroup.filter((d) => REQUIRED_BLOCK_DEFECTS.includes(d));
                                    const isRequired = reqDetails.length > 0;

                                    const isMissing = isRequired && (!inputBloks[cat.id] || inputBloks[cat.id]?.trim() === "");
                                    const currentBlokVal = inputBloks[cat.id] || "";
                                    const blockList = currentBlokVal
                                      ? currentBlokVal.split(",").map((s) => s.trim())
                                      : [""];

                                    const updateBlockList = (newList: string[]) => {
                                      setBlockValidationError(null);
                                      const joined = newList
                                        .map((s) => s.replace(/[^0-9\-,\s]/g, ""))
                                        .join(", ");
                                      setInputBloks((prev) => ({ ...prev, [cat.id]: joined }));
                                    };

                                    return (
                                      <div className={`mt-2 p-3 rounded-xl border transition-all animate-fadeIn ${isMissing
                                        ? "bg-rose-50/80 border-rose-300 ring-2 ring-rose-200"
                                        : "bg-sky-50 border-sky-100"
                                        }`}>
                                        <label className="text-[10px] font-extrabold uppercase mb-1.5 flex items-center justify-between">
                                          <span className="flex items-center gap-1.5 text-slate-800">
                                            <Box className="w-3.5 h-3.5 text-[#0070bc]" />
                                            Lokasi / Nomor Blok {isRequired && <span className="text-rose-500 font-black">*</span>}
                                          </span>
                                          {isRequired ? (
                                            <span className="bg-rose-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                              Wajib Diisi
                                            </span>
                                          ) : (
                                            <span className="text-slate-400 font-bold text-[9px]">Opsional</span>
                                          )}
                                        </label>

                                        <div className="flex flex-wrap items-center gap-2">
                                          {blockList.map((itemVal, bIdx) => (
                                            <div key={bIdx} className="flex items-center gap-1">
                                              <input
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={2}
                                                value={itemVal}
                                                onChange={(e) => {
                                                  const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
                                                  const nextList = [...blockList];
                                                  nextList[bIdx] = val;
                                                  updateBlockList(nextList);
                                                }}
                                                placeholder={bIdx === 0 ? "Blok (15)" : `Blok ${bIdx + 1}`}
                                                className={`w-28 h-9 px-3 rounded-lg border text-center font-bold text-xs text-slate-800 placeholder:font-medium placeholder:text-slate-400 bg-white ${isMissing
                                                  ? "border-rose-400 focus:ring-2 focus:ring-rose-500"
                                                  : "border-sky-200 focus:ring-2 focus:ring-sky-500"
                                                  }`}
                                              />
                                              {blockList.length > 1 && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const nextList = blockList.filter((_, i) => i !== bIdx);
                                                    updateBlockList(nextList);
                                                  }}
                                                  className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors shrink-0"
                                                  title="Hapus blok"
                                                >
                                                  <X className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </div>
                                          ))}

                                          <button
                                            type="button"
                                            onClick={() => {
                                              updateBlockList([...blockList, ""]);
                                            }}
                                            className="w-9 h-9 rounded-lg bg-white hover:bg-sky-100/60 border border-sky-200 text-[#0070bc] flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                                            title="Tambah Blok"
                                          >
                                            <Plus className="w-4 h-4" />
                                          </button>
                                        </div>

                                        {isMissing && (
                                          <p className="text-[10px] font-bold text-rose-600 mt-1.5">
                                            Admin menginstruksikan nomor blok wajib diisi untuk masalah ini.
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })}

                            {customInputDetails.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 shadow-2xs">
                                    Input Manual
                                  </span>
                                  <div className="flex-1 h-px bg-slate-200/80" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {customInputDetails.map((customDetail) => (
                                    <div key={customDetail} className="relative flex items-center">
                                      <div className="flex-1 p-2.5 rounded-lg border border-sky-500 bg-sky-500 text-white text-xs font-semibold flex items-center justify-between shadow-xs">
                                        <span className="truncate">{customDetail}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedDetails((prev) => ({
                                              ...prev,
                                              [cat.id]: (prev[cat.id] || []).filter((d) => d !== customDetail),
                                            }));
                                          }}
                                          className="ml-1 p-0.5 hover:bg-sky-600 rounded text-white cursor-pointer"
                                          title="Hapus detail manual"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Input Detail Manual Tambahan (Hanya untuk Kode G sesuai standar) */}
                      {cat.id === "G" && (
                        <div className="mt-3 pt-3 border-t border-sky-100">
                          <label className="text-[10px] font-bold text-slate-600 uppercase mb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1 text-slate-700">
                              <Edit3 className="w-3 h-3 text-sky-600" />
                              Input Masalah Manual (Jika tidak ada di pilihan)
                            </span>
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={manualInputDetails[cat.id] || ""}
                              onChange={(e) =>
                                setManualInputDetails((prev) => ({ ...prev, [cat.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddManualDetail(cat.id);
                                }
                              }}
                              placeholder="Ketik detail masalah manual di sini..."
                              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 placeholder:text-slate-400"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddManualDetail(cat.id)}
                              disabled={!(manualInputDetails[cat.id] || "").trim()}
                              className="px-3 py-2 bg-sky-500 text-white font-bold text-xs rounded-lg hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Tambah</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer (Identik dengan DowntimeTracker) */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={handleSaveNonDefect}
            disabled={isSubmitting}
            className="flex-1 h-12 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 px-3 text-center disabled:opacity-50"
            title="Simpan sebagai Gagal Cacat"
          >
            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Gagal Cacat</span>
          </button>
          <button
            type="button"
            onClick={handleSaveDefect}
            disabled={
              isSubmitting ||
              selectedCategories.length === 0 ||
              selectedCategories.some((cat) => {
                const hasDetails = (selectedDetails[cat] || []).length > 0;
                const hasManual = !!(manualInputDetails[cat] || "").trim();
                return !hasDetails && !hasManual;
              })
            }
            className="flex-1 h-12 bg-sky-500 text-white font-bold text-xs sm:text-sm rounded-xl hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer active:scale-95"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Menyimpan...
              </span>
            ) : (
              <span>Simpan Masalah (❌)</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
