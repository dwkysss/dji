"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Loader2, AlertCircle, ArrowUpRight, Gauge, Layers, Wrench, Clock } from "lucide-react";
import { updateQuickMeterValue } from "@/actions/continuous-actions";

export interface QuickEditMeterModalProps {
  isOpen: boolean;
  onClose: () => void;
  rowItem: {
    displayNo?: string;
    tglStr?: string;
    jamStr?: string;
    grpStr?: string;
    oprStr?: string;
    meterDisplay?: string;
    cacatDisplay?: string;
    downtimeDisplay?: string;
    header_id?: string;
    db_id?: string;
    pcs_index?: string | number;
    isStartRow?: boolean;
    hasIstirahat?: boolean;
    // Detail info jika ada
    kategori_masalah?: string;
    detail_masalah?: string;
    keterangan_cacat?: string;
  } | null;
  onSuccess?: () => void;
}

const CATEGORIES = [
  { id: "A", name: "Kode A: Masalah Benang & Kain" },
  { id: "B", name: "Kode B: Masalah Mekanik Mesin & Jarum" },
  { id: "C", name: "Kode C: Masalah Elektrik / Kelistrikan" },
  { id: "D", name: "Kode D: Masalah Setting & Kualitas" },
  { id: "E", name: "Kode E: Masalah Bahan Baku / Benang Baru" },
  { id: "F", name: "Kode F: Perawatan / Maintenance" },
  { id: "G", name: "Kode G: Faktor Lain / Non-Teknis (Gagal Cacat)" },
];

export default function QuickEditMeterModal({
  isOpen,
  onClose,
  rowItem,
  onSuccess,
}: QuickEditMeterModalProps) {
  const [meterVal, setMeterVal] = useState<string>("");
  const [kategori, setKategori] = useState<string>("A");
  const [detailMasalah, setDetailMasalah] = useState<string>("");
  const [blok, setBlok] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isStart = Boolean(rowItem?.isStartRow || rowItem?.cacatDisplay === "START");
  const isFinish = Boolean(rowItem?.cacatDisplay === "FINISH");
  const rowType: "START" | "FINISH" | "DEFECT" = isStart
    ? "START"
    : isFinish
    ? "FINISH"
    : "DEFECT";

  const [initialData, setInitialData] = useState<{
    kategori: string;
    detail: string;
    blok: string;
  }>({ kategori: "A", detail: "", blok: "" });

  useEffect(() => {
    if (!rowItem) return;
    setErrorMsg(null);

    // Parse meter awal
    const rawMeter = rowItem.meterDisplay && rowItem.meterDisplay !== "-" ? rowItem.meterDisplay : "";
    setMeterVal(rawMeter.replace(/[^0-9.]/g, ""));

    // Parse kategori & detail
    const kat = rowItem.kategori_masalah || (rowItem.cacatDisplay && rowItem.cacatDisplay.length === 1 ? rowItem.cacatDisplay : "A");
    setKategori(kat);

    let cleanDetail = rowItem.detail_masalah || (rowItem.cacatDisplay !== "START" && rowItem.cacatDisplay !== "FINISH" ? rowItem.cacatDisplay || "" : "");
    cleanDetail = cleanDetail.replace(/\(Titik:\s*[^)]+\)/gi, "").trim();
    setDetailMasalah(cleanDetail);

    // Parse blok
    const rawBlok = rowItem.keterangan_cacat || "";
    const matchBlok = rawBlok.match(/Blok\s*([^\s,]+)/i);
    const parsedBlok = matchBlok ? matchBlok[1] : rawBlok.replace(/[^0-9]/g, "");
    setBlok(parsedBlok);

    setInitialData({
      kategori: kat,
      detail: cleanDetail,
      blok: parsedBlok,
    });
  }, [rowItem, isOpen]);

  if (!isOpen || !rowItem) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rowItem.header_id) {
      setErrorMsg("ID Header tidak valid.");
      return;
    }

    if (meterVal.trim() === "" || isNaN(parseFloat(meterVal))) {
      setErrorMsg("Harap masukkan angka meter yang valid.");
      return;
    }

    const num = parseFloat(meterVal);
    if (num < 0) {
      setErrorMsg("Nilai meter tidak boleh negatif.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    // Cek apakah user benar-benar mengubah data cacat/blok/kategori
    const isDefectChanged =
      detailMasalah.trim() !== initialData.detail.trim() ||
      kategori !== initialData.kategori ||
      blok.trim() !== initialData.blok.trim();

    try {
      const res = await updateQuickMeterValue({
        headerId: rowItem.header_id,
        detailId: rowItem.db_id,
        newMeter: num,
        rowType,
        pcsIndex: rowItem.pcs_index,
        // Jangan kirim field cacat jika user hanya mengedit meter agar daftar cacat bertingkat tidak tertimpa/hilang
        newKategori: rowType === "DEFECT" && isDefectChanged ? kategori : undefined,
        newDetailMasalah: rowType === "DEFECT" && isDefectChanged ? detailMasalah : undefined,
        newBlok: rowType === "DEFECT" && isDefectChanged ? blok : undefined,
      });

      if (res.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || "Gagal menyimpan perubahan.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan sistem saat menyimpan.");
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
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs ${
              isStart ? "bg-indigo-600" : isFinish ? "bg-emerald-600" : "bg-sky-600"
            }`}>
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>Edit Data Meter</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-sky-100/80 text-sky-800 font-extrabold">
                  Baris #{rowItem.displayNo || "-"}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {rowItem.oprStr || "Operator"} {rowItem.grpStr ? `(${rowItem.grpStr})` : ""} • Jam {rowItem.jamStr || "-"}
              </p>
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

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 text-xs font-semibold animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Badge Tipe Baris */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-slate-500">Tipe Baris:</span>
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wide border ${
                isStart
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : isFinish
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {isStart ? "Sesi Start Meter" : isFinish ? "Sesi Finish Meter" : "Titik Kendala / Cacat"}
            </span>
            {rowItem.pcs_index && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                PCS {rowItem.pcs_index}
              </span>
            )}
          </div>

          {/* Input Meter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center justify-between">
              <span>NILAI METER (m) <span className="text-rose-500">*</span></span>
              <span className="text-[10px] font-normal text-slate-400">Posisi Counter / Kain</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                required
                value={meterVal}
                onChange={(e) => setMeterVal(e.target.value)}
                placeholder="Contoh: 301"
                className="w-full pl-3 pr-12 py-2.5 bg-white border-2 border-sky-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 rounded-xl font-mono text-base font-black text-slate-800 placeholder:text-slate-300 transition-all outline-hidden shadow-xs"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                METER
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {isStart
                ? "Nilai awal saat operator memulai sesi operasional."
                : isFinish
                ? "Nilai akhir kain saat selesai shift atau potong roll."
                : "Posisi meter saat temuan kendala/cacat dicatat."}
            </p>
          </div>

          {/* Kolom Tambahan jika Baris Defect */}
          {rowType === "DEFECT" && (
            <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1 flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">Kategori</label>
                  <select
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                    className="px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 outline-hidden focus:border-sky-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        Kode {c.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">Nomor Blok (Opsional)</label>
                  <input
                    type="text"
                    value={blok}
                    onChange={(e) => setBlok(e.target.value)}
                    placeholder="Contoh: 4"
                    className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium text-slate-800 outline-hidden focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-700">Detail Masalah / Nama Cacat</label>
                <input
                  type="text"
                  value={detailMasalah}
                  onChange={(e) => setDetailMasalah(e.target.value)}
                  placeholder="Contoh: Keluar Jarum L2/L3"
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium text-slate-800 outline-hidden focus:border-sky-500"
                />
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-1">
            {rowItem.header_id ? (
              <a
                href={`/edit/${rowItem.header_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-sky-600 transition-colors"
                title="Buka form input lengkap di tab baru"
              >
                <span>Form Lengkap</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            ) : <div />}

            <div className="flex items-center gap-2">
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
          </div>
        </form>
      </div>
    </div>
  );
}
