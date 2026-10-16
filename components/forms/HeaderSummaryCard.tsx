import React from "react";
import {
  Settings2,
  User,
  Box,
  FileText,
  CheckCircle2,
  Factory,
} from "lucide-react";
import { useInputTheme } from "@/lib/input-theme-context";

interface HeaderSummaryCardProps {
  operatorName: string;
  shiftName: string;
  nomorMc: string;
  design: string;
  onEdit: () => void;
  statusMatching: string;
  potonganKe?: string | number;
  pcsCount?: number;
  maxPanel?: number | null;
  showEditButton?: boolean;
  showEditButtonPlacement?: "right" | "bottom";
}

function HeaderSummaryCard({
  operatorName,
  shiftName,
  nomorMc,
  design,
  onEdit,
  statusMatching,
  potonganKe,
  pcsCount,
  maxPanel,
  showEditButton = true,
  showEditButtonPlacement = "right",
}: HeaderSummaryCardProps) {
  const { isDark } = useInputTheme();
  const isBottom = showEditButton && showEditButtonPlacement === "bottom";

  if (isBottom) {
    return (
      <div className={`rounded-2xl shadow-sm overflow-hidden mb-0 flex flex-col justify-between transition-colors ${
        isDark ? "bg-slate-900 border border-slate-800 text-white" : "bg-white border border-sky-100"
      }`}>
        <div className="grid grid-cols-2 grow">
          <div className={`p-2.5 sm:p-3 lg:p-4 ${isDark ? "bg-slate-950/70" : "bg-sky-50/80"}`}>
            <div className="flex items-center gap-1 mb-0.5">
              <Factory className={`w-3 h-3 lg:w-3.5 lg:h-3.5 shrink-0 ${isDark ? "text-blue-400" : "text-sky-600"}`} />
              <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-sky-600"}`}>
                Mesin & Desain
              </span>
            </div>
            <p className={`text-xs sm:text-sm font-black leading-tight break-words ${isDark ? "text-white" : "text-slate-900"}`}>
              {nomorMc || "Belum dipilih"} / {design || "-"}
            </p>
          </div>

          <div className={`p-2.5 sm:p-3 lg:p-4 ${isDark ? "bg-slate-900/90" : "bg-slate-50/80"}`}>
            <div className="flex items-center gap-1 mb-0.5">
              <CheckCircle2 className={`w-3 h-3 lg:w-3.5 lg:h-3.5 shrink-0 ${isDark ? "text-emerald-400" : "text-slate-600"}`} />
              <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-700"}`}>
                Status Matching
              </span>
            </div>
            <p className={`text-xs sm:text-sm font-black leading-tight break-words ${isDark ? "text-emerald-400" : "text-slate-900"}`}>
              {statusMatching || "-"}
            </p>
          </div>

          <div className={`p-2.5 sm:p-3 lg:p-4 ${isDark ? "bg-slate-900/90" : "bg-slate-50/80"}`}>
            <div className="flex items-center gap-1 mb-0.5">
              <User className={`w-3 h-3 lg:w-3.5 lg:h-3.5 shrink-0 ${isDark ? "text-slate-400" : "text-slate-600"}`} />
              <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-700"}`}>
                Operator ({shiftName})
              </span>
            </div>
            <p className={`text-xs sm:text-sm font-black leading-tight break-words ${isDark ? "text-white" : "text-slate-900"}`}>
              {operatorName || "Belum dipilih"}
            </p>
          </div>

          <div className={`p-2.5 sm:p-3 lg:p-4 ${isDark ? "bg-slate-950/70" : "bg-sky-50/80"}`}>
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <div className="flex items-center gap-1">
                <Box className={`w-3 h-3 lg:w-3.5 lg:h-3.5 shrink-0 ${isDark ? "text-blue-400" : "text-sky-600"}`} />
                <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-blue-300" : "text-sky-600"}`}>
                  Potongan Ke
                </span>
              </div>
              {maxPanel ? (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                  isDark ? "bg-blue-600 text-white" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                }`}>
                  Max: {maxPanel}
                </span>
              ) : null}
            </div>
            <p className={`text-xs sm:text-sm font-black leading-tight break-words ${isDark ? "text-white" : "text-slate-900"}`}>
              {potonganKe || "-"}
            </p>
          </div>

          {pcsCount !== undefined && (
            <div className={`p-2.5 sm:p-3 lg:p-4 col-span-2 border-t flex items-center justify-between ${
              isDark ? "bg-slate-950 border-slate-800" : "bg-sky-50/60 border-slate-100"
            }`}>
              <div className="flex items-center gap-2">
                <FileText className={`w-4 h-4 shrink-0 ${isDark ? "text-blue-400" : "text-sky-500"}`} />
                <span className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-700"}`}>
                  PCS:
                </span>
              </div>
              <span className={`px-3 py-1 font-black text-xs sm:text-sm rounded-lg shadow-sm text-white ${
                isDark ? "bg-blue-600" : "bg-[#0070bc]"
              }`}>
                {pcsCount} Pcs
              </span>
            </div>
          )}
        </div>

        {showEditButton && (
          <div className={`px-4 py-3 flex justify-center ${isDark ? "bg-slate-900 border-t border-slate-800" : "bg-white"}`}>
            <button
              type="button"
              onClick={onEdit}
              className={`flex min-w-56 items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm cursor-pointer active:scale-95 ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 hover:border-blue-500/50"
                  : "bg-white hover:bg-sky-50 text-sky-600 border border-sky-200 hover:border-sky-300"
              }`}
            >
              <Settings2 className="w-5 h-5" />
              Ubah Header
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl p-5 sm:p-6 mb-0 transition-all duration-300 ${
        isDark
          ? "bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 text-white shadow-xl"
          : "bg-sky-50/80 border border-sky-100 text-slate-800 shadow-sm"
      } ${
        isBottom
          ? "flex flex-col items-stretch gap-3"
          : "flex flex-col lg:flex-row lg:items-center justify-between gap-5"
      }`}
    >
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${pcsCount !== undefined ? 'xl:grid-cols-5' : 'xl:grid-cols-4'} gap-5 flex-1`}>
        {/* Mesin & Desain */}
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${
            isDark ? "bg-slate-800 text-blue-400 border border-slate-700" : "bg-sky-100 text-sky-600"
          }`}>
            <Factory className="w-6 h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-sky-600"}`}>
              Mesin & Desain
            </span>
            <span className={`text-xl font-black leading-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
              {nomorMc || "Belum dipilih"} / {design || "-"}
            </span>
          </div>
        </div>

        {/* Operator */}
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${
            isDark ? "bg-slate-800 text-slate-400 border border-slate-700" : "bg-slate-100 text-slate-500"
          }`}>
            <User className="w-6 h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Operator ({shiftName})
            </span>
            <span className={`text-xl font-black leading-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
              {operatorName || "Belum dipilih"}
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 border ${
              isDark
                ? statusMatching === "OK"
                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/30"
                  : "bg-rose-950/80 text-rose-400 border-rose-500/30"
                : statusMatching === "OK"
                ? "bg-emerald-100 text-emerald-600 border-transparent"
                : "bg-rose-100 text-rose-600 border-transparent"
            }`}
          >
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Status Matching
            </span>
            <span
              className={`text-xl font-black leading-tight truncate ${
                isDark
                  ? statusMatching === "OK" ? "text-emerald-400" : "text-rose-400"
                  : statusMatching === "OK" ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {statusMatching || "-"}
            </span>
          </div>
        </div>

        {/* Potongan Ke */}
        {potonganKe && (
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${
              isDark ? "bg-blue-950 text-blue-400 border border-blue-800/50" : "bg-indigo-100 text-indigo-600"
            }`}>
              <Box className="w-6 h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-blue-300" : "text-slate-500"}`}>
                  Potongan Ke
                </span>
                {maxPanel ? (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                    isDark ? "bg-blue-600 text-white shadow-xs" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}>
                    Max: {maxPanel} Panel
                  </span>
                ) : null}
              </div>
              <span className={`text-xl font-black leading-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                {potonganKe}
              </span>
            </div>
          </div>
        )}

        {/* Jumlah PCS */}
        {pcsCount !== undefined && (
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${
              isDark ? "bg-amber-950/80 text-amber-400 border border-amber-500/30" : "bg-amber-100 text-amber-600"
            }`}>
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Jumlah PCS
              </span>
              <span className={`text-xl font-black leading-tight truncate ${isDark ? "text-amber-400" : "text-amber-700"}`}>
                {pcsCount} Pcs
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Edit Button (optional) */}
      {showEditButton && !isBottom && (
        <button
          type="button"
          onClick={onEdit}
          className={`flex min-w-52 items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-base transition-all shrink-0 shadow-sm cursor-pointer active:scale-95 ${
            isDark
              ? "bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 hover:border-blue-500/50 shadow-xs"
              : "bg-white hover:bg-sky-50 text-sky-600 border border-sky-200 hover:border-sky-300 shadow-sm"
          }`}
        >
          <Settings2 className="w-5 h-5" />
          Ubah Header
        </button>
      )}

      {showEditButton && isBottom && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={onEdit}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm cursor-pointer active:scale-95 ${
              isDark
                ? "bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 hover:border-blue-500/50 shadow-xs"
                : "bg-white hover:bg-sky-50 text-sky-600 border border-sky-200 hover:border-sky-300 shadow-sm"
            }`}
          >
            <Settings2 className="w-5 h-5" />
            Ubah Header
          </button>
        </div>
      )}
    </div>
  );
}

export default React.memo(HeaderSummaryCard);
