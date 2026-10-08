"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

export interface DeletePanelTarget {
  id: string;
  name: string;
  panelNo?: string;
}

interface DeletePanelModalProps {
  isOpen: boolean;
  item: DeletePanelTarget | null;
  onClose: () => void;
  onConfirm: (mode: "permanent" | "keep_slot") => Promise<void> | void;
  isDeleting?: boolean;
}

export default function DeletePanelModal({
  isOpen,
  item,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeletePanelModalProps) {
  const [pendingDeleteMode, setPendingDeleteMode] = useState<"permanent" | "keep_slot" | null>(null);

  if (!isOpen || !item) return null;

  const handleClose = () => {
    setPendingDeleteMode(null);
    onClose();
  };

  const handleConfirm = async (mode: "permanent" | "keep_slot") => {
    await onConfirm(mode);
    setPendingDeleteMode(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
        {pendingDeleteMode === null ? (
          /* Step 1: Pilih Opsi Hapus */
          <>
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-3 mx-auto">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-center text-slate-800 mb-1">Pilih Opsi Hapus Panel</h3>
            <p className="text-xs text-center text-slate-500 mb-5">
              Panel: <span className="font-semibold text-slate-700">{item.panelNo ? `Panel ${item.panelNo} - ` : ""}{item.name}</span>
            </p>

            <div className="flex flex-col gap-3 mb-5">
              {/* Opsi 1: Hapus Baris Panel (Permanen / Nomor Tetap) */}
              <button
                type="button"
                onClick={() => setPendingDeleteMode("permanent")}
                className="flex items-start gap-3 p-3.5 rounded-xl border-2 border-rose-100 bg-rose-50/40 hover:bg-rose-50 hover:border-rose-300 text-left transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm group-hover:scale-105 transition-transform">
                  1
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-slate-800 group-hover:text-rose-700 transition-colors flex items-center justify-between">
                    <span>Hapus Baris Panel</span>
                    <span className="text-[10px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded font-semibold">Permanen</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Hapus data baris ini sepenuhnya dari database. Nomor panel lain <span className="font-semibold text-rose-600">tidak akan bergeser</span>.
                  </p>
                </div>
              </button>

              {/* Opsi 2: Tandai Dihapus (Nomor Tetap) */}
              <button
                type="button"
                onClick={() => setPendingDeleteMode("keep_slot")}
                className="flex items-start gap-3 p-3.5 rounded-xl border-2 border-amber-100 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-300 text-left transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm group-hover:scale-105 transition-transform">
                  2
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-slate-800 group-hover:text-amber-800 transition-colors flex items-center justify-between">
                    <span>Tandai Dihapus (Nomor Tetap)</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-semibold">Nomor Tetap</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Nomor panel tetap berada di posisinya (tidak bergeser), panel diberi tanda <span className="font-semibold text-rose-600">DIHAPUS</span>, dan tidak dihitung dalam total penjumlahan panel.
                  </p>
                </div>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="w-full h-10 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
              >
                Batal
              </button>
            </div>
          </>
        ) : (
          /* Step 2: Layar Konfirmasi Kedua */
          <>
            <div className={`w-12 h-12 rounded-full ${pendingDeleteMode === "permanent" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"} flex items-center justify-center mb-3 mx-auto`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-center text-slate-800 mb-1">Konfirmasi Penghapusan</h3>
            <p className="text-xs text-center text-slate-500 mb-4">
              Apakah Anda yakin ingin melanjutkan tindakan ini?
            </p>

            {pendingDeleteMode === "permanent" ? (
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 mb-5 text-left">
                <div className="flex items-center gap-2 mb-1 font-bold text-xs text-rose-800">
                  <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px]">1</span>
                  Opsi 1: Hapus Baris Panel (Permanen)
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Data baris <span className="font-semibold text-rose-700">{item.panelNo ? `Panel ${item.panelNo}` : item.name}</span> akan <strong>dihapus permanen</strong>. Nomor panel lain <strong>tidak akan bergeser</strong>.
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 mb-5 text-left">
                <div className="flex items-center gap-2 mb-1 font-bold text-xs text-amber-900">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">2</span>
                  Opsi 2: Tandai Dihapus (Nomor Tetap)
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Nomor panel <span className="font-semibold text-amber-800">{item.panelNo ? `Panel ${item.panelNo}` : item.name}</span> akan <strong>tetap di tempat</strong> dan berstatus <strong>DIHAPUS</strong> (tidak dihitung dalam total penjumlahan panel).
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPendingDeleteMode(null)}
                disabled={isDeleting}
                className="flex-1 h-11 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 border border-slate-200 cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={() => handleConfirm(pendingDeleteMode)}
                disabled={isDeleting}
                className={`flex-1 h-11 rounded-xl font-bold text-xs text-white ${pendingDeleteMode === "permanent" ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20" : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"} shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer`}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Ya, Hapus Data
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
