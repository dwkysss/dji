"use client";

import React from "react";
import { Lock, RefreshCw, X } from "lucide-react";

interface MachineBlockGuardModalProps {
  isOpen: boolean;
  onClose: () => void;
  nomorMc: string;
  onOpenHandoff: () => void;
}

export default function MachineBlockGuardModal({
  isOpen,
  onClose,
  nomorMc,
  onOpenHandoff,
}: MachineBlockGuardModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-sky-100 bg-sky-50/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base leading-tight">
                Block Mesin Sedang Aktif
              </h3>
              <p className="text-[11px] text-[#0070bc] font-semibold">
                Mesin {nomorMc || "-"} sedang dalam status perbaikan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
          <p>
            Fitur <strong className="text-slate-900">Lapor Mesin Mati</strong> tidak dapat
            digunakan saat <strong className="text-slate-900">Mesin {nomorMc || "-"}</strong>{" "}
            masih dalam status <strong className="text-slate-900">Block Mesin</strong> agar
            tidak terjadi laporan downtime ganda.
          </p>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1">
            <p>
              • Gunakan <strong className="text-[#0070bc]">Serah Terima Shift</strong> jika
              terjadi pergantian operator/shift.
            </p>
            <p>
              • Gunakan <strong className="text-emerald-700">Unblock Mesin</strong> jika
              perbaikan sudah selesai dan mesin kembali jalan.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenHandoff();
            }}
            className="flex-[2] h-11 bg-[#0070bc] hover:bg-[#005a96] text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-[#0070bc]/20 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Buka Serah Terima Shift</span>
          </button>
        </div>
      </div>
    </div>
  );
}
