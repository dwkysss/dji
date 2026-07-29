import React from "react";
import {
  Settings2,
  User,
  Box,
  FileText,
  CheckCircle2,
  Factory,
} from "lucide-react";

interface HeaderSummaryCardProps {
  operatorName: string;
  shiftName: string;
  nomorMc: string;
  design: string;
  onEdit: () => void;
  statusMatching: string;
  potonganKe?: string | number;
  pcsCount?: number;
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
  showEditButton = true,
  showEditButtonPlacement = "right",
}: HeaderSummaryCardProps) {
  const isBottom = showEditButton && showEditButtonPlacement === "bottom";

  if (isBottom) {
    return (
      <div className="bg-white border border-sky-100 rounded-2xl shadow-sm overflow-hidden mb-0 flex flex-col justify-between">
        <div className="grid grid-cols-2 grow">
          <div className="p-2.5 sm:p-3 lg:p-4 bg-sky-50/80">
            <div className="flex items-center gap-1 mb-0.5">
              <Factory className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-sky-600 shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-bold text-sky-600 uppercase tracking-wider">
                Mesin & Desain
              </span>
            </div>
            <p className="text-xs sm:text-sm font-black text-slate-900 leading-tight break-words">
              {nomorMc || "Belum dipilih"} / {design || "-"}
            </p>
          </div>

          <div className="p-2.5 sm:p-3 lg:p-4 bg-slate-50/80">
            <div className="flex items-center gap-1 mb-0.5">
              <CheckCircle2 className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-slate-600 shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                Status Matching
              </span>
            </div>
            <p className="text-xs sm:text-sm font-black text-slate-900 leading-tight break-words">
              {statusMatching || "-"}
            </p>
          </div>

          <div className="p-2.5 sm:p-3 lg:p-4 bg-slate-50/80">
            <div className="flex items-center gap-1 mb-0.5">
              <User className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-slate-600 shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                Operator ({shiftName})
              </span>
            </div>
            <p className="text-xs sm:text-sm font-black text-slate-900 leading-tight break-words">
              {operatorName || "Belum dipilih"}
            </p>
          </div>

          <div className="p-2.5 sm:p-3 lg:p-4 bg-sky-50/80">
            <div className="flex items-center gap-1 mb-0.5">
              <Box className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-sky-600 shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-bold text-sky-600 uppercase tracking-wider">
                Potongan Ke
              </span>
            </div>
            <p className="text-xs sm:text-sm font-black text-slate-900 leading-tight break-words">
              {potonganKe || "-"}
            </p>
          </div>

          {pcsCount !== undefined && (
            <div className="p-2.5 sm:p-3 lg:p-4 bg-sky-50/60 col-span-2 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-500 shrink-0" />
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  PCS:
                </span>
              </div>
              <span className="px-3 py-1 bg-[#0070bc] text-white font-black text-xs sm:text-sm rounded-lg shadow-sm">
                {pcsCount} Pcs
              </span>
            </div>
          )}
        </div>

        {showEditButton && (
          <div className="px-4 py-3 bg-white flex justify-center">
            <button
              type="button"
              onClick={onEdit}
              className="flex min-w-56 items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-sky-50 text-sky-600 border border-sky-200 hover:border-sky-300 rounded-xl font-bold text-sm transition-colors shadow-sm"
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
      className={`bg-sky-50/80 border border-sky-100 rounded-2xl p-5 sm:p-6 shadow-sm mb-0 ${isBottom
          ? "flex flex-col items-stretch gap-3"
          : "flex flex-col lg:flex-row lg:items-center justify-between gap-5"
        }`}
    >
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${pcsCount !== undefined ? 'xl:grid-cols-5' : 'xl:grid-cols-4'} gap-5 flex-1`}>
        {/* Mesin & Desain */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
            <Factory className="w-6 h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">
              Mesin & Desain
            </span>
            <span className="text-xl font-black text-slate-900 leading-tight truncate">
              {nomorMc || "Belum dipilih"} / {design || "-"}
            </span>
          </div>
        </div>

        {/* Operator */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Operator ({shiftName})
            </span>
            <span className="text-xl font-black text-slate-900 leading-tight truncate">
              {operatorName || "Belum dipilih"}
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${statusMatching === "OK" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}
          >
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Status Matching
            </span>
            <span
              className={`text-xl font-black leading-tight truncate ${statusMatching === "OK" ? "text-emerald-700" : "text-rose-700"}`}
            >
              {statusMatching || "-"}
            </span>
          </div>
        </div>

        {/* Potongan Ke */}
        {potonganKe && (
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Box className="w-6 h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Potongan Ke
              </span>
              <span className="text-xl font-black text-slate-900 leading-tight truncate">
                {potonganKe}
              </span>
            </div>
          </div>
        )}

        {/* Jumlah PCS */}
        {pcsCount !== undefined && (
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Target PCS
              </span>
              <span className="text-xl font-black text-amber-700 leading-tight truncate">
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
          className="flex min-w-52 items-center justify-center gap-2 px-6 py-4 bg-white hover:bg-sky-50 text-sky-600 border border-sky-200 hover:border-sky-300 rounded-xl font-bold text-base transition-colors shrink-0 shadow-sm"
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
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-sky-50 text-sky-600 border border-sky-200 hover:border-sky-300 rounded-xl font-bold text-sm transition-colors shadow-sm"
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
