"use client";

import React, { useState } from "react";
import { AlertTriangle, Plus, X, Edit3, Loader2 } from "lucide-react";
import { GROUPED_PROBLEM_DETAILS } from "@/lib/constants";

export interface InsertPanelPayload {
  mode: "insert" | "append";
  insertAt?: number;
  appendToEnd: boolean;
  isBs?: boolean;
  kategoriMasalah?: string[];
  detailMasalah?: string;
  keteranganCacat?: string;
}

export interface ProblemCategoryItem {
  id: string;
  name: string;
}

interface InsertPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: InsertPanelPayload) => Promise<boolean | void>;
  problemCategories: ProblemCategoryItem[];
  problemDetailsMap: Record<string, string[]>;
  dynamicGroupMapping?: Record<string, { groupName: string; items: string[] }[]>;
  defaultMode?: "insert" | "append";
}

export default function InsertPanelModal({
  isOpen,
  onClose,
  onSubmit,
  problemCategories,
  problemDetailsMap,
  dynamicGroupMapping = {},
  defaultMode = "append",
}: InsertPanelModalProps) {
  const [mode, setMode] = useState<"insert" | "append">(defaultMode);
  const [insertPanelAt, setInsertPanelAt] = useState<string>("");
  const [isBs, setIsBs] = useState<boolean>(false);
  const [hasDefect, setHasDefect] = useState<boolean>(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<Record<string, string[]>>({});
  const [manualInputDetails, setManualInputDetails] = useState<Record<string, string>>({});
  const [keterangan, setKeterangan] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setErrorMsg(null);
    onClose();
  };

  const handleAddManualDetail = (catId: string) => {
    const val = (manualInputDetails[catId] || "").trim();
    if (!val) return;
    setSelectedDetails((prev) => ({
      ...prev,
      [catId]: [...(prev[catId] || []), val],
    }));
    setManualInputDetails((prev) => ({ ...prev, [catId]: "" }));
  };

  const handleSubmit = async () => {
    setErrorMsg(null);

    if (mode === "insert" && (!insertPanelAt || parseInt(insertPanelAt) <= 0)) {
      setErrorMsg("Nomor panel wajib diisi angka positif.");
      return;
    }

    if (hasDefect && selectedCategories.length > 0) {
      const anyEmpty = selectedCategories.some((cat) => {
        const details = selectedDetails[cat] || [];
        const manual = (manualInputDetails[cat] || "").trim();
        return details.length === 0 && !manual;
      });
      if (anyEmpty) {
        setErrorMsg("Pilih minimal satu detail masalah untuk setiap kategori yang dicentang.");
        return;
      }
    }

    // Build detail masalah string cleanly without category letter prefix or block suffix
    const detailParts: string[] = [];
    selectedCategories.forEach((cat) => {
      const details = selectedDetails[cat] || [];
      const manual = (manualInputDetails[cat] || "").trim();
      const allD = [...details];
      if (manual && !allD.includes(manual)) allD.push(manual);
      if (allD.length > 0) {
        detailParts.push(...allD);
      }
    });

    const keteranganParts: string[] = [];
    if (keterangan.trim()) {
      keteranganParts.push(keterangan.trim());
    }

    setIsSubmitting(true);
    try {
      const payload: InsertPanelPayload = {
        mode,
        insertAt: mode === "insert" ? parseInt(insertPanelAt) : undefined,
        appendToEnd: mode === "append",
        isBs: mode === "insert" && isBs,
        kategoriMasalah: hasDefect && selectedCategories.length > 0 ? selectedCategories : undefined,
        detailMasalah: detailParts.join(", ") || undefined,
        keteranganCacat: keteranganParts.join(", ") || undefined,
      };

      const result = await onSubmit(payload);
      if (result !== false) {
        handleClose();
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Gagal menyimpan panel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-150">
          <h2 className="text-lg font-extrabold text-slate-800">Tambah Panel</h2>
          <p className="text-xs text-slate-500 mt-1">
            Pilih apakah ingin menyisipkan panel di nomor tertentu (label DOUBLE) atau menambahkannya di bagian paling akhir.
          </p>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-2">
              Pilih Tipe Penambahan
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode("append");
                  setInsertPanelAt("");
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  mode === "append"
                    ? "border-[#0070bc] bg-sky-50 text-[#0070bc] font-bold"
                    : "border-slate-200 text-slate-500 hover:border-slate-350 bg-white"
                }`}
              >
                <span className="text-xs font-extrabold">Tambah di Akhir</span>
                <span className="text-[10px] opacity-75 mt-1 font-medium leading-tight">Urutan terakhir</span>
              </button>

              <button
                type="button"
                onClick={() => setMode("insert")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  mode === "insert"
                    ? "border-[#0070bc] bg-sky-50 text-[#0070bc] font-bold"
                    : "border-slate-200 text-slate-500 hover:border-slate-350 bg-white"
                }`}
              >
                <span className="text-xs font-extrabold">Sisipkan Tengah</span>
                <span className="text-[10px] opacity-75 mt-1 font-medium leading-tight">Duplikat (DOUBLE)</span>
              </button>
            </div>
          </div>

          {mode === "insert" && (
            <div className="animate-fadeIn">
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-2">
                Sisipkan ke Nomor Panel <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={insertPanelAt}
                onChange={(e) => setInsertPanelAt(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 focus:border-[#0070bc] focus:ring-4 focus:ring-[#0070bc]/10 outline-none font-medium text-slate-700 transition-all"
                placeholder="Contoh: 3"
              />
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2 leading-tight">
                ℹ️ Panel berikutnya <strong>tidak bergeser</strong>. Panel {insertPanelAt || "target"} akan memiliki 2 baris dengan badge <strong>DOUBLE</strong>.
              </p>
            </div>
          )}

          {/* Head-to-Head Checkboxes (BS & Defect Report) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Card 1: Tandai sebagai Barang Sisa (BS) */}
            {mode === "insert" ? (
              <label
                htmlFor="modalInsertIsBs"
                className={`p-3 rounded-xl border transition-all flex flex-col justify-between cursor-pointer select-none ${
                  isBs ? "border-rose-300 bg-rose-50/70 shadow-xs" : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/80"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="modalInsertIsBs"
                    checked={isBs}
                    onChange={(e) => setIsBs(e.target.checked)}
                    className="w-4 h-4 text-rose-600 rounded border-rose-300 focus:ring-rose-500 cursor-pointer shrink-0"
                  />
                  <span className="text-xs font-bold text-rose-700">Barang Sisa (BS)</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 pl-6 leading-tight">
                  Tandai baris ini sebagai panel sisa/BS.
                </p>
              </label>
            ) : null}

            {/* Card 2: Laporkan Cacat / Masalah */}
            <label
              htmlFor="modalInsertHasDefect"
              className={`p-3 rounded-xl border transition-all flex flex-col justify-between cursor-pointer select-none ${
                mode !== "insert" ? "sm:col-span-2" : ""
              } ${
                hasDefect ? "border-purple-300 bg-purple-50/70 shadow-xs" : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/80"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="modalInsertHasDefect"
                  checked={hasDefect}
                  onChange={(e) => {
                    setHasDefect(e.target.checked);
                    if (!e.target.checked) {
                      setSelectedCategories([]);
                      setSelectedDetails({});
                    }
                  }}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer shrink-0"
                />
                <span className="text-xs font-bold text-slate-800">Laporkan Temuan Cacat?</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 pl-6 leading-tight">
                Pilih kategori masalah (Kode A/B/C/D...).
              </p>
            </label>
          </div>

          {hasDefect && (
            <div className="space-y-4 pt-2 border-t border-slate-100 animate-fadeIn">
              <label className="text-xs font-bold text-slate-700 uppercase block">
                Pilih Temuan Cacat / Masalah
              </label>
              <div className="space-y-2">
                {problemCategories.map((cat) => (
                  <div key={cat.id} className="flex flex-col gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="checkbox"
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
                          }
                        }}
                        className="peer sr-only"
                      />
                      <div className="p-3 rounded-xl border-2 border-slate-100 bg-white text-xs font-bold text-slate-650 peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 transition-all hover:border-slate-350">
                        {cat.name}
                      </div>
                    </label>

                    {selectedCategories.includes(cat.id) && problemDetailsMap[cat.id] && (
                      <div className="pl-3.5 pr-2 py-3 border-l-2 border-sky-300 ml-2 space-y-3 bg-slate-50/50 rounded-r-xl mt-1.5 animate-in slide-in-from-top-2">
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
                            <div className="space-y-2.5">
                              {activeGroups.map((group, gIdx) => (
                                <div key={gIdx} className="space-y-1">
                                  <div className="flex items-center gap-1.5 pt-1 first:pt-0">
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-sky-800 bg-sky-100/90 px-1.5 py-0.5 rounded border border-sky-200/70 shadow-2xs">
                                      {group.groupName}
                                    </span>
                                    <div className="flex-1 h-px bg-slate-200/80" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {group.items.map((detail) => (
                                      <label key={detail} className="cursor-pointer">
                                        <input
                                          type="checkbox"
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
                                        <div className="p-2 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 peer-checked:bg-sky-500 peer-checked:border-sky-500 peer-checked:text-white transition-all hover:bg-slate-50 text-center shadow-2xs">
                                          {detail}
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ))}

                              {customInputDetails.length > 0 && (
                                <div className="space-y-1 pt-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 shadow-2xs">
                                      Input Manual
                                    </span>
                                    <div className="flex-1 h-px bg-slate-200/80" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {customInputDetails.map((customDetail) => (
                                      <div key={customDetail} className="relative flex items-center">
                                        <div className="flex-1 p-2 rounded-lg border border-sky-500 bg-sky-500 text-white text-[10px] font-semibold flex items-center justify-between shadow-xs">
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
                                            <X className="w-3 h-3" />
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

                        {cat.id === "G" && (
                          <div className="mt-3 pt-3 border-t border-sky-100">
                            <label className="text-[10px] font-bold text-slate-600 uppercase mb-1.5 flex items-center justify-between">
                              <span className="flex items-center gap-1 text-slate-700">
                                <Edit3 className="w-3 h-3 text-sky-600" />
                                Input Masalah Manual
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
                                placeholder="Ketik detail masalah manual..."
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
          )}

          {/* Keterangan Tambahan */}
          <div>
            <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1">
              Catatan Khusus (Opsional)
            </label>
            <input
              type="text"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Contoh: Titik cacat di meter 45..."
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-[#0070bc] focus:ring-2 focus:ring-[#0070bc]/10"
            />
          </div>
        </div>

        <div className="p-5 border-t border-slate-150 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="h-11 px-5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isSubmitting || (mode === "insert" && !insertPanelAt)}
            onClick={handleSubmit}
            className="h-11 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:opacity-50 text-white font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Simpan Panel
          </button>
        </div>
      </div>
    </div>
  );
}
