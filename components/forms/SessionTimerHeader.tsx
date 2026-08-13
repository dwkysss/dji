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
  return (
    <div className="mb-6 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xs rounded-2xl p-3.5 sm:p-4 transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        {/* Left Section: Back button + Title */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all shrink-0 active:scale-95 cursor-pointer"
            title={backLabel}
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span className="truncate max-w-[140px] sm:max-w-none">{backLabel}</span>
          </button>

          <div className="h-5 w-px bg-slate-200 shrink-0 hidden sm:block" />

          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2 truncate">
            {icon}
            <span className="truncate">{title}</span>
          </h1>
        </div>

        {/* Right Section: Timer Controls & Actions (1 horizontal row on Laptop & Tablet) */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 sm:gap-2.5 shrink-0 justify-start md:justify-end">
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
