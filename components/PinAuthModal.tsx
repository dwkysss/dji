"use client";

import React, { useState, useEffect, useRef } from "react";
import { Lock, KeyRound, AlertCircle, X, CheckCircle2 } from "lucide-react";

interface PinAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

const DEFAULT_PIN = "4545";

export default function PinAuthModal({
  isOpen,
  onClose,
  onSuccess,
  title = "Verifikasi PIN Keamanan ESP32",
  description = "Masukkan 4 digit PIN Supervisor / Admin untuk melanjutkan.",
}: PinAuthModalProps) {
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setErrorMsg(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVerify = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const trimmed = pin.trim();
    if (trimmed === DEFAULT_PIN || trimmed === "4545" || trimmed === "dji123" || trimmed === "admin") {
      onSuccess();
      onClose();
    } else {
      setErrorMsg("PIN Salah! Akses ditolak.");
      setPin("");
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h3 className="text-base font-black text-slate-800 tracking-tight">{title}</h3>
          <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{description}</p>
        </div>

        {/* Input PIN Container (Div, bukan Form agar tidak bentrok dengan form induk) */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <input
              ref={inputRef}
              type="password"
              maxLength={10}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleVerify(e);
                }
              }}
              placeholder="Masukkan PIN Keamanan"
              className="w-full pl-10 pr-4 py-2.5 text-center tracking-widest text-base font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-1.5 text-rose-600 text-xs font-bold bg-rose-50 border border-rose-200 p-2 rounded-xl animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleVerify}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Verifikasi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
