import React from "react";
import { CheckCircle, Eye, Trash2 } from "lucide-react";

interface PanelMendingTableProps {
  displayItems: any[];
  selections: Record<string, string>;
  onSelectGrade: (id: string, grade: string) => void;
  onOpenDetail: (headerId: string) => void;
  onDeleteDetail: (val: any) => void;
  totalGradable: number;
  totalA: number;
  totalB: number;
  totalBS: number;
}

export default function PanelMendingTable({
  displayItems,
  selections,
  onSelectGrade,
  onOpenDetail,
  onDeleteDetail,
  totalGradable,
  totalA,
  totalB,
  totalBS,
}: PanelMendingTableProps) {
  return (
    <table className="w-full min-w-[720px] text-left text-xs border-collapse">
      <thead>
        <tr className="bg-slate-50">
          <th className="sticky left-0 z-20 bg-slate-50 px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-12 text-center border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" rowSpan={2}>PNL NO</th>
          <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-20 text-center whitespace-nowrap border-r border-slate-100" rowSpan={2}>TGL</th>
          <th className="px-1.5 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-12 text-center border-r border-slate-100" rowSpan={2}>Group</th>
          <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-24 text-center border-r border-slate-100" rowSpan={2}>Operator</th>
          <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-14 text-center border-r border-slate-100" rowSpan={2}>KET ✓/X</th>
          <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 min-w-[160px] w-full text-center border-r border-slate-100" rowSpan={2}>KETERANGAN CACAT</th>
          <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-12 text-center border-r border-slate-100" rowSpan={2}>AKSI</th>
          <th className="px-1 py-1 border-b border-slate-200 font-extrabold text-slate-600 text-center border-r border-slate-100" colSpan={3}>MENDING</th>
        </tr>
        <tr className="bg-slate-50">
          <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-emerald-600 border-r border-slate-100 w-16">A</th>
          <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-amber-600 border-r border-slate-100 w-16">B</th>
          <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-rose-600 border-r border-slate-100 w-16">BS</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 text-xs">
        {displayItems.map((item: any, index: number) => {
          if (item.isTotalRow) {
            return (
              <tr key={item.id || index} className="bg-slate-100 border-t border-b border-slate-200 font-semibold text-slate-700">
                <td colSpan={4} className="sticky left-0 z-10 bg-slate-100 px-3 py-2 text-right whitespace-nowrap border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  {item.totalLabel}
                </td>
                <td className="px-1 py-2 text-center text-slate-800 font-extrabold whitespace-nowrap border-r border-slate-100">
                  {item.totalCount} Panel
                </td>
                <td colSpan={2} className="bg-slate-100 border-r border-slate-100"></td>
                <td className="px-1 py-2 text-center text-emerald-600 bg-emerald-50/20 font-black border-r border-slate-100 w-16">
                  {item.countA}
                </td>
                <td className="px-1 py-2 text-center text-amber-600 bg-amber-50/20 font-black border-r border-slate-100 w-16">
                  {item.countB}
                </td>
                <td className="px-1 py-2 text-center text-rose-600 bg-rose-50/20 font-black w-16">
                  {item.countBS}
                </td>
              </tr>
            );
          }

          return (
            <tr key={item.id} className={`transition-colors ${(item.isIstirahat || item.hasIstirahat) ? "bg-amber-50/30 hover:bg-amber-50/50" : "bg-white hover:bg-slate-50"}`}>
              <td className={`sticky left-0 z-10 px-2 py-1 font-bold text-slate-800 text-center border-r border-slate-100 border-b border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${(item.isIstirahat || item.hasIstirahat) ? "bg-[#fffbeb]" : "bg-white"}`}>
                {item.displayNo}
              </td>
              <td className="px-2 py-1 text-slate-600 whitespace-nowrap border-r border-slate-100 border-b border-slate-100">
                {item.showTgl ? (item.tglStr || "-") : ""}
              </td>
              <td className="px-1.5 py-1 font-medium text-slate-700 text-center border-r border-slate-100 border-b border-slate-100">
                {item.showGrp ? (item.grpStr || "-") : ""}
              </td>
              <td className={`px-2 py-1 leading-tight border-r border-slate-100 border-b border-slate-100 ${(!item.showOpr && (item.isIstirahat || item.hasIstirahat)) ? "italic font-bold text-amber-600" : "font-medium text-slate-700"}`}>
                {item.showOpr ? (item.oprBase || item.grpStr || "-") : ((item.isIstirahat || item.hasIstirahat) ? "Istirahat" : "")}
              </td>
              <td className="px-2 py-1 text-center font-bold text-sm border-r border-slate-100 border-b border-slate-100">
                {item.indikator_stop || item.kategori_masalah ? <span className="text-rose-600">X</span> : <span className="text-emerald-600">✓</span>}
              </td>
              <td className="px-2 py-1 text-[11px] font-medium whitespace-pre-line leading-tight border-r border-slate-100 border-b border-slate-100">
                {(item.isIstirahat || item.hasIstirahat) ? (
                  <>
                    {item.backupOpName && <div className="font-bold text-slate-700 mb-0.5">{item.backupOpName}</div>}
                    {item.cacatDisplay && item.cacatDisplay !== "-" ? (
                      <div className="text-rose-600">{item.cacatDisplay}</div>
                    ) : (
                      !item.backupOpName && <span className="text-slate-400">-</span>
                    )}
                  </>
                ) : (
                  <div className={item.cacatDisplay && item.cacatDisplay !== "-" ? "text-rose-600" : "text-slate-400"}>
                    {item.cacatDisplay || "-"}
                  </div>
                )}
              </td>
              <td className="px-2 py-1 border-r border-slate-100 border-b border-slate-100">
                {item.isGradable ? (
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onDeleteDetail({ id: item.id, name: `${item.kategori_masalah || 'Masalah'} - ${item.detail_masalah || 'Tidak ada detail'}` })}
                      className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 transition-all shadow-sm"
                      title="Hapus Rincian"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : null}
              </td>
              <td className="px-1 py-1 text-center border-r border-slate-100 border-b border-slate-100 w-16">
                {item.isGradable ? (
                  <button
                    onClick={() => onSelectGrade(item.id, "A")}
                    className={`w-7 h-7 mx-auto flex items-center justify-center rounded-md transition-all border ${selections[item.id] === "A" ? "border-emerald-500 bg-emerald-100 text-emerald-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-emerald-300 hover:text-emerald-500"}`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </td>
              <td className="px-1 py-1 text-center border-r border-slate-100 border-b border-slate-100 w-16">
                {item.isGradable ? (
                  <button
                    onClick={() => onSelectGrade(item.id, "B")}
                    className={`w-7 h-7 mx-auto flex items-center justify-center rounded-md transition-all border ${selections[item.id] === "B" ? "border-amber-500 bg-amber-100 text-amber-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-amber-300 hover:text-amber-500"}`}
                  >
                    <span className="text-[10px] font-black">B</span>
                  </button>
                ) : null}
              </td>
              <td className="px-1 py-1 text-center border-b border-slate-100 w-16">
                {item.isGradable ? (
                  <button
                    onClick={() => onSelectGrade(item.id, "BS")}
                    className={`w-7 h-7 mx-auto flex items-center justify-center rounded-md transition-all border ${selections[item.id] === "BS" ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-rose-300 hover:text-rose-500"}`}
                  >
                    <span className="text-[10px] font-black">BS</span>
                  </button>
                ) : null}
              </td>
            </tr>
          );
        })}
        {totalGradable > 0 && (
          <tr className="bg-slate-50 font-bold border-t border-slate-200 text-[11px] text-slate-700 uppercase tracking-wider">
            <td className="px-2 py-3 text-right font-extrabold border-r border-slate-100" colSpan={7}>
              Total ({totalGradable} Panel):
            </td>
            <td className="px-1 py-3 text-center text-emerald-600 bg-emerald-50/40 font-black border-r border-slate-100">
              {totalA}
            </td>
            <td className="px-1 py-3 text-center text-amber-600 bg-amber-50/40 font-black border-r border-slate-100">
              {totalB}
            </td>
            <td className="px-1 py-3 text-center text-rose-600 bg-rose-50/40 font-black border-r border-slate-100">
              {totalBS}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
