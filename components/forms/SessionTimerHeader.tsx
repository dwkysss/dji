import React from "react";
import { Clock, Timer, Play, Pause, RotateCcw, HelpCircle, ArrowLeft } from "lucide-react";
import { formatHHMM, formatTimerSeconds } from "@/lib/shift-utils";

interface SessionTimerHeaderProps {
  title: string;
  icon?: React.ReactNode;
  onBack: () => void;
  backLabel?: string;
  startTime?: string | null;
  elapsedSeconds: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onCancel: () => void;
  cancelLabel?: string;
  onHelp?: () => void;
  pauseLabel?: string;
}

export default function SessionTimerHeader({
  title,
  icon,
  onBack,
  backLabel = "Kembali ke Antrean",
  startTime,
  elapsedSeconds,
  isPaused,
  onTogglePause,
  onCancel,
  cancelLabel = "Batal",
  onHelp,
  pauseLabel = "Inspeksi",
}: SessionTimerHeaderProps) {
  const shortBackLabel = backLabel.toLowerCase().includes("antrean") ? "Antrean" : "Kembali";

  return (
    <div className="mb-4 sm:mb-6 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xs rounded-2xl p-3 sm:p-4 transition-all">
      {/* ======================================================== */}
      {/* MOBILE VIEW (< md) : 2-Row Compact & Balanced Header     */}
      {/* ======================================================== */}
      <div className="flex md:hidden flex-col gap-2.5">
        {/* Row 1: Back Navigation, Title & Help Button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all shrink-0 active:scale-95 cursor-pointer shadow-2xs"
              title={backLabel}
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span>{shortBackLabel}</span>
            </button>

            <h1 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5 truncate min-w-0">
              {icon}
              <span className="truncate">{title}</span>
            </h1>
          </div>

          {onHelp && (
            <button
              type="button"
              onClick={onHelp}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-2xs cursor-pointer"
              title="Bantuan Tutorial"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Row 2: Timer Badges & Action Buttons (Single Balanced Line) */}
        <div className="flex items-center gap-2 justify-between pt-2 border-t border-slate-100/90">
          {/* Time Badges (Start Time + Running Timer) */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 h-9 shrink-0 shadow-2xs">
            {startTime && (
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 font-bold" title="Jam Mulai">
                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{formatHHMM(startTime)}</span>
              </div>
            )}

            {startTime && <div className="w-px h-3.5 bg-slate-200 shrink-0" />}

            <div
              className={`flex items-center gap-1.5 text-xs font-mono font-black ${
                isPaused ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isPaused ? "bg-amber-500" : "bg-emerald-500 animate-ping"
                }`}
              />
              <Timer className="w-3.5 h-3.5 shrink-0" />
              <span className="tracking-wide">{formatTimerSeconds(elapsedSeconds)}</span>
              {isPaused && (
                <span className="text-[8px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-bold uppercase tracking-wider ml-0.5">
                  PAUSED
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons: Pause/Lanjut & Batal */}
          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
            <button
              type="button"
              onClick={onTogglePause}
              className={`flex-1 max-w-[125px] h-9 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0 active:scale-95 cursor-pointer ${
                isPaused
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
                  : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200"
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 fill-current shrink-0" /> : <Pause className="w-3.5 h-3.5 fill-current shrink-0" />}
              <span className="truncate">{isPaused ? "Lanjut" : "Pause"}</span>
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="h-9 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold border border-rose-200/80 transition-all flex items-center justify-center gap-1 shrink-0 active:scale-95 cursor-pointer shadow-2xs"
              title={cancelLabel}
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Batal</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DESKTOP / TABLET VIEW (>= md) : Sleek Single Row Layout  */}
      {/* ======================================================== */}
      <div className="hidden md:flex md:items-center justify-between gap-4">
        {/* Left Section: Back button + Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all shrink-0 active:scale-95 cursor-pointer"
            title={backLabel}
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span className="truncate">{backLabel}</span>
          </button>

          <div className="h-5 w-px bg-slate-200 shrink-0" />

          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2 truncate">
            {icon}
            <span className="truncate">{title}</span>
          </h1>
        </div>

        {/* Right Section: Timer Controls & Actions (1 horizontal row) */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 justify-end">
          {startTime && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 h-10 px-3 rounded-xl text-xs shadow-2xs shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden xl:inline">Mulai</span>
              <div className="flex items-center gap-1.5 font-extrabold text-slate-700">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="font-mono">{formatHHMM(startTime)}</span>
              </div>
            </div>
          )}

          <div
            className={`h-10 px-3 sm:px-3.5 rounded-xl text-xs font-black flex items-center gap-2 border shadow-2xs transition-all shrink-0 ${
              isPaused
                ? "bg-amber-50/90 border-amber-200 text-amber-700"
                : "bg-emerald-50/90 border-emerald-200 text-emerald-700"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isPaused ? "bg-amber-500" : "bg-emerald-500 animate-ping"
              }`}
            />
            <Timer className="w-4 h-4 text-current shrink-0" />
            <span className="font-mono text-sm tracking-wider">
              {formatTimerSeconds(elapsedSeconds)}
            </span>
            {isPaused && (
              <span className="text-[9px] bg-amber-200/90 text-amber-900 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ml-0.5">
                PAUSED
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onTogglePause}
            className={`h-10 px-3.5 sm:px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-xs shrink-0 cursor-pointer ${
              isPaused
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
                : "bg-amber-500 hover:bg-amber-600 text-white active:scale-95 shadow-amber-200"
            }`}
          >
            {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
            <span>{isPaused ? `Lanjut ${pauseLabel}` : `Pause ${pauseLabel}`}</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="h-10 px-3 sm:px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold border border-rose-200/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>{cancelLabel}</span>
          </button>

          {onHelp && (
            <button
              type="button"
              onClick={onHelp}
              className="h-10 px-3 sm:px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline">Bantuan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
