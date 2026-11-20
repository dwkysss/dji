"use client";

import React, { useState, useEffect } from "react";
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
  Clock,
} from "lucide-react";
import {
  submitStatusMesin,
  getShiftProductionStatusForStop,
  type ShiftProductionStopStatus,
} from "@/actions/status-actions";
import {
  PROBLEM_CATEGORIES,
  GROUPED_PROBLEM_DETAILS,
  DEFAULT_PROBLEM_DETAILS,
} from "@/lib/constants";
import { getRemainingShiftSeconds, formatDurationSmart } from "@/lib/shift-utils";

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
  jenisBenangDasar?: string;
  liner?: string;
  heavy?: string;
  shadow?: string;
  pinggiran?: string;
  noOrderBarang?: string;
  noCustomer?: string;
  allOperators?: { id: string | number; name: string; shift?: string }[];
  groups?: { id: string | number; name: string }[];
  onGroupOperatorChange?: (
    nextGroupId: string,
    nextOperatorId: string,
    nextOperatorName: string
  ) => void;
  onSuccess?: (message?: string) => void;
}

// Tema warna seragam (Corporate DJI Blue) untuk seluruh kategori A - G agar bersih dan konsisten
const UNIFIED_CATEGORY_THEME = {
  badgeBg: "bg-sky-100",
  badgeText: "text-[#0070bc]",
  borderActive: "border-[#0070bc]",
  bgActive: "bg-sky-50/70",
  textActive: "text-[#004777]",
  chipActive: "bg-[#0070bc] text-white border-[#005a96] shadow-sm shadow-sky-600/25",
  previewBadgeBg: "bg-[#0070bc] text-white",
  previewBadgeText: "text-[#004777] bg-sky-50 border-sky-200",
};

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
  A: { icon: Scissors, ...UNIFIED_CATEGORY_THEME },
  B: { icon: Wrench, ...UNIFIED_CATEGORY_THEME },
  C: { icon: Settings2, ...UNIFIED_CATEGORY_THEME },
  D: { icon: Boxes, ...UNIFIED_CATEGORY_THEME },
  E: { icon: Zap, ...UNIFIED_CATEGORY_THEME },
  F: { icon: Settings, ...UNIFIED_CATEGORY_THEME },
  G: { icon: AlertOctagon, ...UNIFIED_CATEGORY_THEME },
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
  jenisBenangDasar,
  liner,
  heavy,
  shadow,
  pinggiran,
  noOrderBarang,
  noCustomer,
  allOperators = [],
  groups = [],
  onGroupOperatorChange,
  onSuccess,
}: MachineStopModalProps) {
  // Default ke Kategori G (Eksternal / Tidak ada order / Mati Listrik) karena paling sering untuk mesin berhenti shift
  const [selectedCategory, setSelectedCategory] = useState<string>("G");
  const [selectedDetail, setSelectedDetail] = useState<string>("Tidak ada order");
  const [detailCatatan, setDetailCatatan] = useState<string>("");
  const [cakupan, setCakupan] = useState<"SHIFT" | "FULL_DAY">("SHIFT");
  const [durasiPreset, setDurasiPreset] = useState<"FULL_SHIFT" | "REMAINING_SHIFT" | "CUSTOM">("FULL_SHIFT");
  const [customHours, setCustomHours] = useState<number>(1);
  const [customMinutes, setCustomMinutes] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shiftStopStatus, setShiftStopStatus] = useState<ShiftProductionStopStatus | null>(null);
  const [isCheckingShiftInput, setIsCheckingShiftInput] = useState<boolean>(false);
  const [liveRemainingShiftSec, setLiveRemainingShiftSec] = useState<number>(() =>
    getRemainingShiftSeconds(new Date())
  );

  // State sinkronisasi 3-arah (Lapor Mesin Mati <-> Header <-> Serah Terima)
  const [localGroupId, setLocalGroupId] = useState<string>(groupId || "1");
  const [localOperatorId, setLocalOperatorId] = useState<string>(operatorId || "");
  const [localOperatorName, setLocalOperatorName] = useState<string>(operatorName || "");

  const resolvedGroups = React.useMemo(() => {
    if (groups && groups.length > 0) return groups;
    return [
      { id: "1", name: "A" },
      { id: "2", name: "B" },
      { id: "3", name: "C" },
    ];
  }, [groups]);

  const selectedGroupObj = React.useMemo(() => {
    return (
      resolvedGroups.find(
        (g) => String(g.id) === String(localGroupId) || g.name === String(localGroupId)
      ) || resolvedGroups[0]
    );
  }, [resolvedGroups, localGroupId]);

  const effectiveShiftName = selectedGroupObj?.name || shiftName || "A";

  const filteredOperators = React.useMemo(() => {
    if (!allOperators || allOperators.length === 0) return [];
    const matched = allOperators.filter(
      (op) => !op.shift || String(op.shift).toUpperCase() === String(effectiveShiftName).toUpperCase()
    );
    return matched.length > 0 ? matched : allOperators;
  }, [allOperators, effectiveShiftName]);

  // Sinkronkan state lokal saat modal dibuka atau saat Header/Serah Terima mengubah group/operator
  useEffect(() => {
    if (!isOpen) return;
    setLocalGroupId(groupId || "1");
    setLocalOperatorId(operatorId || "");
    setLocalOperatorName(operatorName || "");
  }, [isOpen, groupId, operatorId, operatorName]);

  const syncGroupAndOperator = (nextGrpId: string, nextOpId: string, nextOpName: string) => {
    setLocalGroupId(nextGrpId);
    setLocalOperatorId(nextOpId);
    setLocalOperatorName(nextOpName);

    try {
      if (nextOpName) localStorage.setItem("dji_active_operator_name", nextOpName);
      if (nextOpId) localStorage.setItem("dji_active_operator_id", nextOpId);
      const savedHeaderRaw = localStorage.getItem("dji_form_header");
      if (savedHeaderRaw) {
        const parsed = JSON.parse(savedHeaderRaw);
        parsed.groupId = nextGrpId;
        if (nextOpId) parsed.operatorId = nextOpId;
        localStorage.setItem("dji_form_header", JSON.stringify(parsed));
      }
    } catch {
      // ignore localStorage errors
    }

    onGroupOperatorChange?.(nextGrpId, nextOpId, nextOpName);
  };

  const handleGroupChange = (newGrpId: string) => {
    const grpObj = resolvedGroups.find((g) => String(g.id) === String(newGrpId));
    const grpLetter = grpObj?.name || "A";
    const groupOps = allOperators.filter(
      (op) => !op.shift || String(op.shift).toUpperCase() === String(grpLetter).toUpperCase()
    );
    const pool = groupOps.length > 0 ? groupOps : allOperators;
    const stillValid = pool.find((op) => String(op.id) === String(localOperatorId));
    const targetOp = stillValid || pool[0];
    syncGroupAndOperator(
      String(newGrpId),
      targetOp ? String(targetOp.id) : localOperatorId,
      targetOp ? targetOp.name : localOperatorName
    );
  };

  const handleOperatorChange = (newOpId: string) => {
    const opObj =
      filteredOperators.find((op) => String(op.id) === String(newOpId)) ||
      allOperators.find((op) => String(op.id) === String(newOpId));
    const nextName = opObj?.name || localOperatorName;
    syncGroupAndOperator(String(localGroupId), String(newOpId), nextName);
  };

  // Cek otomatis apakah di shift berjalan sudah ada input produksi pada mesin ini:
  // - Sudah ada inputan -> default otomatis ke "Sisa Shift" (dari jam input terakhir s.d. jam pulang shift)
  // - Belum ada inputan dari awal shift -> default otomatis ke "1 Shift Penuh" (8 Jam: awal shift s.d. pulang shift)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const freshRem = getRemainingShiftSeconds(new Date());
    setLiveRemainingShiftSec(freshRem);
    setErrorMsg(null);
    setIsCheckingShiftInput(true);

    getShiftProductionStatusForStop(nomorMc)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setShiftStopStatus(res.data);
          setLiveRemainingShiftSec(res.data.remainingFromNowSec);
          setDurasiPreset(res.data.hasProductionInShift ? "REMAINING_SHIFT" : "FULL_SHIFT");
        } else {
          setShiftStopStatus(null);
          setDurasiPreset("FULL_SHIFT");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setShiftStopStatus(null);
        setDurasiPreset("FULL_SHIFT");
      })
      .finally(() => {
        if (!cancelled) setIsCheckingShiftInput(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, nomorMc]);

  const effectiveRemainingShiftSec = React.useMemo(() => {
    if (shiftStopStatus?.hasProductionInShift && shiftStopStatus.remainingFromLastInputSec) {
      return shiftStopStatus.remainingFromLastInputSec;
    }
    return shiftStopStatus?.remainingFromNowSec || liveRemainingShiftSec;
  }, [shiftStopStatus, liveRemainingShiftSec]);

  const formatDurationNice = (totalSec: number) =>
    formatDurationSmart(totalSec, { zeroText: "0 Dtk" });

  const calculatedDurationSeconds = React.useMemo(() => {
    if (cakupan === "FULL_DAY") return 86400; // 24 jam penuh
    if (durasiPreset === "FULL_SHIFT") return 28800; // 8 jam
    if (durasiPreset === "REMAINING_SHIFT") return Math.max(60, effectiveRemainingShiftSec);
    return Math.max(60, (Math.max(0, customHours) * 3600) + (Math.max(0, customMinutes) * 60));
  }, [cakupan, durasiPreset, effectiveRemainingShiftSec, customHours, customMinutes]);

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
    if (!localOperatorName) {
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
        pic: localOperatorName.trim(),
        operatorId: localOperatorId || undefined,
        grupId: localGroupId || undefined,
        status: fullStatus,
        kategoriMasalah: selectedCategory,
        cakupan: cakupan,
        durasiDetik: calculatedDurationSeconds,
        submittedAt: new Date().toISOString(),
        potonganKe: potonganKe ? String(potonganKe) : undefined,
        designId: designId || undefined,
        rpm: rpm || undefined,
        pick: pick || undefined,
        course: course || undefined,
        jenisBenangDasar: jenisBenangDasar || undefined,
        liner: liner || undefined,
        heavy: heavy || undefined,
        shadow: shadow || undefined,
        pinggiran: pinggiran || undefined,
        noOrderBarang: noOrderBarang || undefined,
        noCustomer: noCustomer || undefined,
      });

      if (res.success) {
        if (onSuccess) {
          onSuccess(
            `Mesin ${nomorMc} berhasil dicatat BERHENTI (Kode ${selectedCategory} - ${selectedDetail}) untuk Shift ${effectiveShiftName} atas nama ${localOperatorName}.`
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-fadeIn">
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal - Tema Corporate DJI Slate & Blue yang adem dan elegan */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#004777] px-4 sm:px-6 py-3.5 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300 shrink-0 shadow-inner">
              <PowerOff className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-lg font-black tracking-tight leading-tight">
                  Lapor Mesin Mati
                </h3>
                <span className="text-[9.5px] sm:text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                  Mesin Mati
                </span>
              </div>
              <p className="text-slate-300 text-[11px] sm:text-xs font-medium truncate">
                Pilih kendala resmi (Kode A - G) agar shift tercatat atas nama Anda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer disabled:opacity-50 shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Wrapper: Scrollable Body + Sticky Bottom Footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 min-h-0">
          {/* Info Card: Mesin & Penanggung Jawab (Sinkron 3-Arah dengan Header & Serah Terima) */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="flex flex-col justify-center gap-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Factory className="w-3 h-3 text-slate-400" />
                Mesin
              </span>
              <span className="text-sm font-black text-slate-800">
                {nomorMc || "-"}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#0070bc]" />
                Grup / Shift
              </label>
              <select
                value={String(selectedGroupObj?.id || localGroupId)}
                onChange={(e) => handleGroupChange(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 focus:border-[#0070bc] focus:ring-2 focus:ring-[#0070bc]/15 outline-none text-xs font-black text-slate-800 cursor-pointer transition-all"
              >
                {resolvedGroups.map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    Shift {g.name} (Grup {g.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3 text-[#0070bc]" />
                Operator
              </label>
              {filteredOperators.length > 0 ? (
                <select
                  value={String(localOperatorId)}
                  onChange={(e) => handleOperatorChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 focus:border-[#0070bc] focus:ring-2 focus:ring-[#0070bc]/15 outline-none text-xs font-black text-[#0070bc] cursor-pointer transition-all"
                >
                  {filteredOperators.map((op) => (
                    <option key={op.id} value={String(op.id)}>
                      {op.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm font-black text-[#0070bc] truncate py-1">
                  {localOperatorName || "-"}
                </span>
              )}
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
              <span>3. Catatan Tambahan (Opsional)</span>
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

          {/* 4. Durasi Berhenti / Mati (Selalu Cakupan Shift Ini) */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#0070bc]" />
                <span>4. Durasi Mesin Mati Shift Ini</span>
              </label>
                <span className="text-[10px] font-extrabold text-[#004777] bg-sky-100/80 px-2 py-0.5 rounded-md border border-sky-200 whitespace-nowrap">
                  {formatDurationNice(calculatedDurationSeconds)}
                </span>
              </div>

              {/* Info deteksi otomatis produksi shift berjalan */}
              {isCheckingShiftInput ? (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[10.5px] font-semibold text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0070bc] shrink-0" />
                  <span>Mengecek riwayat input shift ini untuk menyesuaikan durasi...</span>
                </div>
              ) : shiftStopStatus?.hasProductionInShift ? (
                <div className="px-2.5 py-1.5 rounded-xl bg-sky-50 border border-sky-200/80 text-[10.5px] font-semibold text-[#004777] leading-snug">
                  Terdeteksi sudah ada input di shift ini (terakhir{" "}
                  <span className="font-black">{shiftStopStatus.lastInputTimeLabel} WIB</span> •{" "}
                  <span className="font-bold">{shiftStopStatus.lastPanelNo}</span>). Durasi otomatis
                  disesuaikan ke <span className="font-black">Sisa Shift</span> (
                  {shiftStopStatus.lastInputTimeLabel} – {shiftStopStatus.shiftEndLabel} WIB).
                </div>
              ) : shiftStopStatus ? (
                <div className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[10.5px] font-semibold text-slate-600 leading-snug">
                  Belum ada input produksi sejak awal shift ({shiftStopStatus.shiftStartLabel} WIB).
                  Durasi otomatis diset <span className="font-black text-slate-800">1 Shift Penuh</span>{" "}
                  ({shiftStopStatus.shiftStartLabel} – {shiftStopStatus.shiftEndLabel} WIB).
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDurasiPreset("FULL_SHIFT")}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer text-xs font-bold ${
                    durasiPreset === "FULL_SHIFT"
                      ? "bg-[#0070bc] text-white border-[#005a96] shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div>1 Shift Penuh</div>
                  <div className={`text-[10px] font-semibold mt-0.5 ${durasiPreset === "FULL_SHIFT" ? "text-sky-100" : "text-slate-400"}`}>
                    8 Jam
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDurasiPreset("REMAINING_SHIFT")}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer text-xs font-bold ${
                    durasiPreset === "REMAINING_SHIFT"
                      ? "bg-[#0070bc] text-white border-[#005a96] shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div>Sisa Shift</div>
                  <div className={`text-[10px] font-semibold mt-0.5 ${durasiPreset === "REMAINING_SHIFT" ? "text-sky-100" : "text-slate-400"}`}>
                    ~{formatDurationNice(effectiveRemainingShiftSec)}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDurasiPreset("CUSTOM")}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer text-xs font-bold ${
                    durasiPreset === "CUSTOM"
                      ? "bg-[#0070bc] text-white border-[#005a96] shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div>Kustom</div>
                  <div className={`text-[10px] font-semibold mt-0.5 ${durasiPreset === "CUSTOM" ? "text-sky-100" : "text-slate-400"}`}>
                    Jam & Mnt
                  </div>
                </button>
              </div>

              {durasiPreset === "CUSTOM" && (
                <div className="flex items-center gap-2 pt-1 animate-fadeIn">
                  <div className="flex-1 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500">Jam:</span>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={customHours}
                      onChange={(e) => setCustomHours(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full text-xs font-bold text-slate-800 outline-none text-right"
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500">Menit:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      className="w-full text-xs font-bold text-slate-800 outline-none text-right"
                    />
                  </div>
                </div>
              )}
          </div>

          </div>

          {/* Sticky Bottom: Preview Ringkasan & Footer Actions (Selalu terlihat di Tablet/Mobile/Desktop) */}
          <div className="px-4 sm:px-5 py-3 border-t border-slate-200/80 bg-white shrink-0 space-y-2.5 shadow-[0_-4px_16px_rgba(15,23,42,0.04)]">
            {/* Preview Ringkasan Laporan */}
            <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center justify-between gap-2.5 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 shadow-2xs ${currentCategoryStyle.previewBadgeBg}`}
                >
                  {selectedCategory}
                </span>
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 block">
                    Kendala ({formatDurationNice(calculatedDurationSeconds)}):
                  </span>
                  <span className="text-xs font-black text-slate-800 truncate block">
                    {selectedDetail}
                    {detailCatatan.trim() ? ` (${detailCatatan.trim()})` : ""}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {cakupan === "SHIFT" && shiftStopStatus?.hasProductionInShift ? (
                  <span className="text-[10px] font-black bg-sky-50 text-[#0070bc] px-2.5 py-1 rounded-lg border border-sky-200/80 shadow-2xs flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0070bc]" />
                    Stop Sisa Shift
                  </span>
                ) : (
                  <span className="text-[10px] font-black bg-rose-50 text-rose-700 px-2.5 py-1 rounded-lg border border-rose-200/80 shadow-2xs flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    0 Produksi
                  </span>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs text-slate-600 bg-slate-100/80 hover:bg-slate-200/70 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedDetail}
                className="flex-1 sm:flex-initial px-5 sm:px-6 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Menyimpan Laporan...</span>
                  </>
                ) : (
                  <>
                    <PowerOff className="w-4 h-4 shrink-0" />
                    <span>Kirim Laporan Mesin Mati</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
