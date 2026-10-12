"use client";

import React, { useState } from "react";
import {
  PowerOff,
  AlertTriangle,
  X,
  CheckCircle2,
  Wrench,
  Zap,
  Boxes,
  Settings,
  Loader2,
  Calendar,
  User,
  Factory,
  Scissors,
  Settings2,
  AlertOctagon,
} from "lucide-react";
import { submitStatusMesin } from "@/actions/status-actions";
import {
  PROBLEM_CATEGORIES,
  GROUPED_PROBLEM_DETAILS,
  DEFAULT_PROBLEM_DETAILS,
} from "@/lib/constants";

export interface MachineStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  nomorMc: string;
  operatorId: string;
  operatorName: string;
  groupId: string;
  shiftName: string;
  potonganKe?: string | number;
  designId?: string;
  rpm?: string;
  pick?: string;
  course?: string;
  onSuccess?: (message?: string) => void;
}

// Visual theme dinamis per kategori (A - G) agar variatif, proporsional, dan tidak dominan 1 warna saja
const CATEGORY_STYLES: Record<
  string,
  {
    icon: React.ElementType;
    badgeBg: string;
    badgeText: string;
    borderActive: string;
    bgActive: string;
    textActive: string;
    chipActive: string;
    previewBadgeBg: string;
    previewBadgeText: string;
  }
> = {
  A: {
    icon: Scissors,
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
    borderActive: "border-amber-500",
    bgActive: "bg-amber-50/70",
    textActive: "text-amber-900",
    chipActive: "bg-amber-600 text-white border-amber-700 shadow-sm shadow-amber-600/25",
    previewBadgeBg: "bg-amber-500 text-white",
    previewBadgeText: "text-amber-900 bg-amber-100/80 border-amber-200",
  },
  B: {
    icon: Wrench,
    badgeBg: "bg-rose-100",
    badgeText: "text-rose-800",
    borderActive: "border-rose-500",
    bgActive: "bg-rose-50/70",
    textActive: "text-rose-900",
    chipActive: "bg-rose-600 text-white border-rose-700 shadow-sm shadow-rose-600/25",
    previewBadgeBg: "bg-rose-600 text-white",
    previewBadgeText: "text-rose-900 bg-rose-100/80 border-rose-200",
  },
  C: {
    icon: Settings2,
    badgeBg: "bg-sky-100",
    badgeText: "text-sky-800",
    borderActive: "border-sky-500",
    bgActive: "bg-sky-50/70",
    textActive: "text-sky-900",
    chipActive: "bg-[#0070bc] text-white border-[#005a96] shadow-sm shadow-sky-600/25",
    previewBadgeBg: "bg-[#0070bc] text-white",
    previewBadgeText: "text-sky-900 bg-sky-100/80 border-sky-200",
  },
  D: {
    icon: Boxes,
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800",
    borderActive: "border-indigo-500",
    bgActive: "bg-indigo-50/70",
    textActive: "text-indigo-900",
    chipActive: "bg-indigo-600 text-white border-indigo-700 shadow-sm shadow-indigo-600/25",
    previewBadgeBg: "bg-indigo-600 text-white",
    previewBadgeText: "text-indigo-900 bg-indigo-100/80 border-indigo-200",
  },
  E: {
    icon: Zap,
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
    borderActive: "border-amber-500",
    bgActive: "bg-amber-50/70",
    textActive: "text-amber-900",
    chipActive: "bg-amber-600 text-white border-amber-700 shadow-sm shadow-amber-600/25",
    previewBadgeBg: "bg-amber-500 text-white",
    previewBadgeText: "text-amber-900 bg-amber-100/80 border-amber-200",
  },
  F: {
    icon: Settings,
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800",
    borderActive: "border-purple-500",
    bgActive: "bg-purple-50/70",
    textActive: "text-purple-900",
    chipActive: "bg-purple-600 text-white border-purple-700 shadow-sm shadow-purple-600/25",
    previewBadgeBg: "bg-purple-600 text-white",
    previewBadgeText: "text-purple-900 bg-purple-100/80 border-purple-200",
  },
  G: {
    icon: AlertOctagon,
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-800",
    borderActive: "border-emerald-500",
    bgActive: "bg-emerald-50/70",
    textActive: "text-emerald-900",
    chipActive: "bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-600/25",
    previewBadgeBg: "bg-emerald-600 text-white",
    previewBadgeText: "text-emerald-900 bg-emerald-100/80 border-emerald-200",
  },
};

export default function MachineStopModal({
  isOpen,
  onClose,
  nomorMc,
  operatorId,
  operatorName,
  groupId,
  shiftName,
  potonganKe,
  designId,
  rpm,
  pick,
  course,
  onSuccess,
}: MachineStopModalProps) {
  // Default ke Kategori G (Eksternal / Tidak ada order / Mati Listrik) karena paling sering untuk mesin berhenti shift
  const [selectedCategory, setSelectedCategory] = useState<string>("G");
  const [selectedDetail, setSelectedDetail] = useState<string>("Tidak ada order");
  const [detailCatatan, setDetailCatatan] = useState<string>("");
  const [cakupan, setCakupan] = useState<"SHIFT" | "FULL_DAY">("SHIFT");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentCategoryStyle =
    CATEGORY_STYLES[selectedCategory] || CATEGORY_STYLES.G;

  const currentCategoryInfo =
    PROBLEM_CATEGORIES.find((c) => c.id === selectedCategory) ||
    PROBLEM_CATEGORIES[6];

  const currentGroups = GROUPED_PROBLEM_DETAILS[selectedCategory] || [];
  const currentFlatDetails =
    DEFAULT_PROBLEM_DETAILS[selectedCategory] ||
    currentGroups.flatMap((g) => g.items) ||
    [];

  const handleSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    const groups = GROUPED_PROBLEM_DETAILS[catId] || [];
    const firstItem =
      groups[0]?.items[0] ||
      DEFAULT_PROBLEM_DETAILS[catId]?.[0] ||
      "";
    setSelectedDetail(firstItem);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomorMc) {
      setErrorMsg("Nomor mesin belum ditentukan.");
      return;
    }
    if (!operatorName) {
      setErrorMsg("Nama operator wajib terisi untuk pertanggungjawaban shift.");
      return;
    }
    if (!selectedDetail) {
      setErrorMsg("Pilih detail masalah yang menyebabkan mesin berhenti.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const fullStatus = detailCatatan.trim()
        ? `${selectedDetail} (${detailCatatan.trim()})`
        : selectedDetail;

      const res = await submitStatusMesin({
        nomorMc: nomorMc.trim(),
        pic: operatorName.trim(),
        operatorId: operatorId || undefined,
        grupId: groupId || undefined,
        status: fullStatus,
        kategoriMasalah: selectedCategory,
        cakupan: cakupan,
        potonganKe: potonganKe ? String(potonganKe) : undefined,
        designId: designId || undefined,
        rpm: rpm || undefined,
        pick: pick || undefined,
        course: course || undefined,
      });

      if (res.success) {
        if (onSuccess) {
          onSuccess(
            `Mesin ${nomorMc} berhasil dicatat BERHENTI (Kode ${selectedCategory} - ${selectedDetail}) untuk Shift ${shiftName} atas nama ${operatorName}.`
          );
        }
        onClose();
      } else {
        setErrorMsg("Gagal menyimpan laporan mesin berhenti.");
      }
    } catch (err: any) {
      console.error("Error submitting machine stop:", err);
      setErrorMsg(err?.message || "Terjadi kesalahan saat menyimpan laporan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal - Tema Corporate DJI Slate & Blue yang adem dan elegan */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#004777] px-5 sm:px-6 py-4 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300 shrink-0 shadow-inner">
              <PowerOff className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                  Lapor Mesin Mati
                </h3>
                <span className="text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Mesin Mati
                </span>
              </div>
              <p className="text-slate-300 text-xs font-medium">
                Pilih kendala resmi (Kode A - G) agar shift tercatat atas nama Anda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Info Card: Mesin & Penanggung Jawab */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Factory className="w-3 h-3 text-slate-400" />
                Mesin
              </span>
              <span className="text-sm font-black text-slate-800">
                {nomorMc || "-"}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                Operator
              </span>
              <span className="text-sm font-black text-[#0070bc] truncate">
                {operatorName || "-"}
              </span>
            </div>

            <div className="flex flex-col gap-0.5 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Shift Operasional
              </span>
              <span className="text-sm font-black text-slate-800">
                Shift {shiftName || "A"}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-3 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Pilih Kategori Masalah (Kode A - G) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>1. Pilih Kategori Kendala (Kode A - G)</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-500 font-semibold">
                Standar Masalah Input Pabrik
              </span>
            </div>

            {/* Grid 7 Kategori Masalah dengan warna dinamis per kategori */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PROBLEM_CATEGORIES.map((cat) => {
                const style = CATEGORY_STYLES[cat.id] || CATEGORY_STYLES.G;
                const IconComponent = style.icon;
                const isSelected = selectedCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat.id)}
                    className={`p-2.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer active:scale-95 ${
                      isSelected
                        ? `${style.borderActive} ${style.bgActive} shadow-xs ring-2 ring-slate-400/20`
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    } ${cat.id === "G" ? "col-span-2 sm:col-span-2" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-slate-900 text-white shadow-2xs"
                              : `${style.badgeBg} ${style.badgeText}`
                          }`}
                        >
                          {cat.id}
                        </span>
                        <IconComponent
                          className={`w-3.5 h-3.5 ${
                            isSelected ? style.textActive : "text-slate-400"
                          }`}
                        />
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </div>
                    <div>
                      <div
                        className={`text-xs font-bold leading-tight ${
                          isSelected ? style.textActive : "text-slate-700"
                        }`}
                      >
                        {cat.short || cat.name}
                      </div>
                      <p className="text-[9px] text-slate-500 line-clamp-1 mt-0.5">
                        {cat.name.replace(/^Kode [A-G]:\s*/i, "")}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Pilih Detail Masalah berdasarkan Kategori Terpilih */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>2. Detail Masalah (Kode {selectedCategory})</span>
                <span className="text-rose-500">*</span>
              </label>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${currentCategoryStyle.previewBadgeText}`}
              >
                {currentCategoryInfo?.name}
              </span>
            </div>

            {/* List Problem Details Berdasarkan Grup */}
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {currentGroups.length > 0 ? (
                currentGroups.map((grp, gIdx) => (
                  <div key={gIdx} className="space-y-1.5">
                    {grp.groupName && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded">
                          {grp.groupName}
                        </span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {grp.items.map((item) => {
                        const isChosen = selectedDetail === item;
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setSelectedDetail(item)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                              isChosen
                                ? `${currentCategoryStyle.chipActive} scale-[1.02]`
                                : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/70"
                            }`}
                          >
                            {isChosen && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                            <span>{item}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {currentFlatDetails.map((item) => {
                    const isChosen = selectedDetail === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setSelectedDetail(item)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                          isChosen
                            ? `${currentCategoryStyle.chipActive} scale-[1.02]`
                            : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/70"
                        }`}
                      >
                        {isChosen && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                        <span>{item}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 3. Catatan Tambahan (Opsional) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Catatan Tambahan (Opsional)</span>
              <span className="text-[10px] text-slate-400 font-normal">bisa dikosongkan</span>
            </label>
            <input
              type="text"
              value={detailCatatan}
              onChange={(e) => setDetailCatatan(e.target.value)}
              placeholder="Contoh: Menunggu teknisi datang, tidak ada benang dari gudang..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0070bc] focus:ring-2 focus:ring-[#0070bc]/10 outline-none text-xs font-semibold text-slate-800 placeholder:text-slate-400 transition-all shadow-inner"
            />
          </div>

          {/* Preview Ringkasan Laporan - Menggunakan Clean Slate Card dengan Aksen Dinamis */}
          <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 shadow-2xs ${currentCategoryStyle.previewBadgeBg}`}
              >
                {selectedCategory}
              </span>
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase text-slate-500 block">
                  Kendala Yang Akan Dicatat:
                </span>
                <span className="text-xs font-black text-slate-800 truncate block">
                  {selectedDetail}
                  {detailCatatan.trim() ? ` (${detailCatatan.trim()})` : ""}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-black bg-rose-50 text-rose-700 px-2.5 py-1 rounded-lg border border-rose-200/80 shadow-2xs shrink-0 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              0 Produksi (Berhenti)
            </span>
          </div>

          {/* 4. Pilihan Cakupan Waktu */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-100/70 border border-slate-200">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800">
                Cakupan Berhenti:
              </span>
              <span className="text-[10px] text-slate-500">
                {cakupan === "SHIFT"
                  ? `Hanya shift kerja Anda (Shift ${shiftName})`
                  : "Mencakup seluruh 3 shift (24 jam penuh)"}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs">
              <button
                type="button"
                onClick={() => setCakupan("SHIFT")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  cakupan === "SHIFT"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Shift Ini
              </button>
              <button
                type="button"
                onClick={() => setCakupan("FULL_DAY")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  cakupan === "FULL_DAY"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                1 Hari Penuh
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedDetail}
              className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Laporan...</span>
                </>
              ) : (
                <>
                  <PowerOff className="w-4 h-4" />
                  <span>Kirim Laporan Mesin Mati</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
