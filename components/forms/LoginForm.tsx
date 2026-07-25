"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { resolveLoginEmail } from "@/actions/user-actions";

export default function LoginForm() {
  const { login, isLoading } = useAuth();
  const [nip, setNip] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);

    if (!nip || !password) {
      setError("NIP dan password wajib diisi.");
      return;
    }

    try {
      const cleanNip = nip.trim();
      const cleanPassword = password.trim();
      const loginEmail = await resolveLoginEmail(cleanNip);

      const result = await login(loginEmail, cleanPassword);
      if (!result.success) {
        if (result.error?.toLowerCase().includes("invalid login credentials")) {
          setError("NIP/Email atau Password yang Anda masukkan salah.");
        } else {
          setError(result.error || "Gagal masuk.");
        }
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan.");
    }
  };

  return (
    <div className="w-full max-w-md p-8 sm:p-10 bg-white/70 backdrop-blur-xl border border-white shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-[32px] flex flex-col items-center">
      {/* Brand Icon & Header */}
      <div className="text-center mb-8 flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0070bc] to-[#004777] shadow-lg shadow-[#0070bc]/30 flex items-center justify-center text-white mb-4">
          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-slate-900 to-[#0070bc] bg-clip-text text-transparent">Login Portal</h2>
        <p className="text-xs text-slate-500 font-semibold mt-1">Masukkan kredensial Anda</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1">No Induk Pegawai (NIP)</label>
          <input
            suppressHydrationWarning
            type="text"
            value={nip}
            onChange={(e) => setNip(e.target.value)}
            disabled={isLoading}
            placeholder=""
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            className="w-full h-12.5 rounded-2xl bg-white/80 border border-slate-200 px-4 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-4 focus:ring-[#0070bc]/15 focus:border-[#0070bc] transition-all"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1">Password</label>
          <input
            suppressHydrationWarning
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            placeholder="••••••••"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="current-password"
            className="w-full h-12.5 rounded-2xl bg-white/80 border border-slate-200 px-4 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-4 focus:ring-[#0070bc]/15 focus:border-[#0070bc] transition-all"
          />
        </div>

        {/* Status Loading & Error */}
        <div className="min-h-[40px] flex items-center justify-center my-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-[#0070bc] text-xs font-bold">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Memverifikasi...
            </div>
          ) : error ? (
            <div className="text-red-600 text-[11px] font-bold text-center bg-red-50 px-4 py-2 rounded-xl border border-red-100 w-full animate-shake">
              {error}
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12.5 mt-2 rounded-2xl bg-gradient-to-r from-[#004777] to-[#0070bc] hover:to-[#00a2ff] active:scale-[0.98] text-white font-bold transition-all duration-300 cursor-pointer shadow-lg shadow-[#0070bc]/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Masuk Sekarang
        </button>
      </form>
    </div>
  );
}
