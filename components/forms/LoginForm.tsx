"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { resolveLoginEmail } from "@/actions/user-actions";
import { Loader2, ShieldCheck, X } from "lucide-react";

export default function LoginForm() {
  const { login, isLoading } = useAuth();
  const [nip, setNip] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState<boolean>(false);
  const autoLoginTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Restore remembered credentials & trigger auto-login on mount
  useEffect(() => {
    try {
      const savedNip = localStorage.getItem("dji_remembered_nip");
      const savedPwdEnc = localStorage.getItem("dji_remembered_pwd");
      const savedRemember = localStorage.getItem("dji_remember_me");
      const manualLogout = localStorage.getItem("dji_manual_logout");

      if (savedRemember === "false") {
        setRememberMe(false);
      }

      if (savedNip && savedPwdEnc) {
        const decodedPwd = atob(savedPwdEnc);
        setNip(savedNip);
        setPassword(decodedPwd);

        // Hanya jalankan AUTO LOGIN jika BUKAN karena pengguna sengaja menekan tombol "Logout"
        // (misal tablet baru dibuka, refresh, atau session expired)
        if (manualLogout !== "1") {
          setIsAutoLoggingIn(true);
          autoLoginTimerRef.current = setTimeout(() => {
            performLogin(savedNip, decodedPwd, true);
          }, 400);
        }
      }
    } catch (e) {
      console.warn("Gagal memulihkan kredensial:", e);
    }

    return () => {
      if (autoLoginTimerRef.current) clearTimeout(autoLoginTimerRef.current);
    };
  }, []);

  const cancelAutoLogin = () => {
    if (autoLoginTimerRef.current) {
      clearTimeout(autoLoginTimerRef.current);
    }
    setIsAutoLoggingIn(false);
    try {
      localStorage.setItem("dji_manual_logout", "1");
    } catch (e) {}
  };

  const performLogin = async (inputNip: string, inputPwd: string, isAuto = false) => {
    if (isLoading) return;
    setError(null);

    const cleanNip = inputNip.trim();
    const cleanPassword = inputPwd.trim();

    if (!cleanNip || !cleanPassword) {
      setError("NIP dan password wajib diisi.");
      setIsAutoLoggingIn(false);
      return;
    }

    try {
      const loginEmail = await resolveLoginEmail(cleanNip);
      const result = await login(loginEmail, cleanPassword);

      if (!result.success) {
        setIsAutoLoggingIn(false);
        if (result.error?.toLowerCase().includes("invalid login credentials")) {
          setError("NIP/Email atau Password yang Anda masukkan salah.");
          // Jika salah, bersihkan credential yang tersimpan agar tidak terus-terusan auto-login gagal
          if (isAuto) {
            localStorage.removeItem("dji_remembered_pwd");
          }
        } else {
          setError(result.error || "Gagal masuk.");
        }
      } else {
        // Hapus flag manual logout saat login berhasil
        localStorage.removeItem("dji_manual_logout");

        // Simpan / update remembered credentials
        if (rememberMe) {
          localStorage.setItem("dji_remembered_nip", cleanNip);
          localStorage.setItem("dji_remembered_pwd", btoa(cleanPassword));
          localStorage.setItem("dji_remember_me", "true");
        } else {
          localStorage.removeItem("dji_remembered_nip");
          localStorage.removeItem("dji_remembered_pwd");
          localStorage.setItem("dji_remember_me", "false");
        }
      }
    } catch (err) {
      setIsAutoLoggingIn(false);
      setError("Terjadi kesalahan jaringan saat mencoba masuk.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    cancelAutoLogin();
    try {
      localStorage.removeItem("dji_manual_logout");
    } catch (e) {}
    await performLogin(nip, password);
  };

  return (
    <div className="w-full max-w-md p-8 sm:p-10 bg-white/70 backdrop-blur-xl border border-white shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-[32px] flex flex-col items-center relative">
      {/* Brand Icon & Header */}
      <div className="text-center mb-6 flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0070bc] to-[#004777] shadow-lg shadow-[#0070bc]/30 flex items-center justify-center text-white mb-4">
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-slate-900 to-[#0070bc] bg-clip-text text-transparent">Login Portal</h2>
        <p className="text-xs text-slate-500 font-semibold mt-1">
          {isAutoLoggingIn ? "Menghubungkan sesi Anda..." : "Masukkan kredensial Anda"}
        </p>
      </div>

      {/* Auto-Login Notification Box */}
      {isAutoLoggingIn && (
        <div className="w-full mb-5 p-3 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-between gap-3 animate-fadeIn shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Loader2 className="w-4 h-4 text-[#0070bc] animate-spin shrink-0" />
            <div className="text-xs font-bold text-slate-700 truncate">
              Masuk otomatis sebagai <span className="font-mono text-[#0070bc] font-black">{nip}</span>...
            </div>
          </div>
          <button
            type="button"
            onClick={cancelAutoLogin}
            className="px-2.5 py-1 rounded-lg text-[11px] font-black text-rose-600 hover:bg-rose-100 transition-all cursor-pointer flex items-center gap-1 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Batal</span>
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1">No Induk Pegawai (NIP)</label>
          <input
            suppressHydrationWarning
            type="text"
            value={nip}
            onChange={(e) => {
              cancelAutoLogin();
              setNip(e.target.value);
            }}
            disabled={isLoading || isAutoLoggingIn}
            placeholder="Masukkan NIP Anda"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            className="w-full h-12 rounded-2xl bg-white/80 border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-xs focus:outline-none focus:ring-4 focus:ring-[#0070bc]/15 focus:border-[#0070bc] transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1">Password</label>
          <input
            suppressHydrationWarning
            type="password"
            value={password}
            onChange={(e) => {
              cancelAutoLogin();
              setPassword(e.target.value);
            }}
            disabled={isLoading || isAutoLoggingIn}
            placeholder="••••••••"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="current-password"
            className="w-full h-12 rounded-2xl bg-white/80 border border-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-xs focus:outline-none focus:ring-4 focus:ring-[#0070bc]/15 focus:border-[#0070bc] transition-all"
          />
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between px-1 py-1">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded-md border-slate-300 text-[#0070bc] focus:ring-[#0070bc]/20 cursor-pointer accent-[#0070bc]"
            />
            <span className="text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors">
              Ingat Saya di Tablet Ini
            </span>
          </label>
        </div>

        {/* Status Loading & Error */}
        <div className="min-h-[30px] flex items-center justify-center my-1">
          {isLoading ? (
            <div className="flex items-center gap-2 text-[#0070bc] text-xs font-bold">
              <Loader2 className="w-4 h-4 animate-spin text-[#0070bc]" />
              <span>Memverifikasi akun...</span>
            </div>
          ) : error ? (
            <div className="text-red-600 text-[11px] font-bold text-center bg-red-50 px-4 py-2 rounded-xl border border-red-100 w-full animate-shake">
              {error}
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isLoading || isAutoLoggingIn}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#004777] to-[#0070bc] hover:to-[#00a2ff] active:scale-[0.98] text-white font-black text-sm tracking-wide transition-all duration-300 cursor-pointer shadow-lg shadow-[#0070bc]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <span>Masuk Sekarang</span>
        </button>
      </form>
    </div>
  );
}
