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
    <table className="w-full text-left text-xs border-collapse">
      <thead>
        <tr className="bg-slate-50">
          <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-12 border-r border-slate-100" rowSpan={2}>PNL NO</th>
          <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-20 whitespace-nowrap border-r border-slate-100" rowSpan={2}>TGL</th>
          <th className="px-1.5 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-12 text-center border-r border-slate-100" rowSpan={2}>Group</th>
          <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-24 border-r border-slate-100" rowSpan={2}>Operator</th>
          <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-16 text-center border-r border-slate-100" rowSpan={2}>KET ✓/X</th>
          <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-64 whitespace-nowrap border-r border-slate-100" rowSpan={2}>KETERANGAN CACAT</th>
          <th className="px-2 py-1.5 border-b border-slate-200 font-extrabold text-slate-600 w-16 text-center border-r border-slate-100" rowSpan={2}>AKSI</th>
          <th className="px-2 py-1 border-b border-slate-200 font-extrabold text-slate-600 text-center border-r border-slate-100" colSpan={3}>MENDING</th>
        </tr>
        <tr className="bg-slate-50">
          <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-emerald-600 border-r border-slate-100">A</th>
          <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-amber-600 border-r border-slate-100">B</th>
          <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-rose-600 border-r border-slate-100">BS</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 text-xs">
        {displayItems.map((item: any, index: number) => {
          if (item.isTotalRow) {
            return (
              <tr key={item.id || index} className="bg-slate-100 border-t border-b border-slate-200 font-semibold text-slate-700">
                <td colSpan={4} className="px-3 py-2 text-right whitespace-nowrap border-r border-slate-100">
                  {item.totalLabel}
                </td>
                <td className="px-1 py-2 text-center text-slate-800 font-extrabold whitespace-nowrap border-r border-slate-100">
                  {item.totalCount} Panel
                </td>
                <td colSpan={2} className="bg-slate-100 border-r border-slate-100"></td>
                <td className="px-1 py-2 text-center text-emerald-600 bg-emerald-50/20 font-black border-r border-slate-100">
                  {item.countA}
                </td>
                <td className="px-1 py-2 text-center text-amber-600 bg-amber-50/20 font-black border-r border-slate-100">
                  {item.countB}
                </td>
                <td className="px-1 py-2 text-center text-rose-600 bg-rose-50/20 font-black">
                  {item.countBS}
                </td>
              </tr>
            );
          }

          return (
            <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${item.final_inspection_id === 1 ? "bg-emerald-50/20" : ""}`}>
              <td className="px-2 py-1 font-bold text-slate-800 border-r border-slate-100 border-b border-slate-100">
                {item.displayNo}
              </td>
              <td className="px-2 py-1 text-slate-600 whitespace-nowrap border-r border-slate-100 border-b border-slate-100">
                {item.showTgl ? (item.tglStr || "-") : ""}
              </td>
              <td className="px-1.5 py-1 font-medium text-slate-700 text-center border-r border-slate-100 border-b border-slate-100">
                {item.showGrp ? (item.grpStr || "-") : ""}
              </td>
              <td className={`px-2 py-1 font-medium leading-tight border-r border-slate-100 border-b border-slate-100 ${((item.hasIstirahat || item.isIstirahat) && (!item.showOpr || !item.oprStr)) ? "italic font-bold text-amber-600" : "text-slate-700"}`}>
                {item.showOpr ? (item.oprStr || ((item.hasIstirahat || item.isIstirahat) ? "Istirahat" : "")) : ((item.hasIstirahat || item.isIstirahat) ? "Istirahat" : "")}
              </td>
              <td className="px-2 py-1 text-center font-bold text-sm border-r border-slate-100 border-b border-slate-100">
                {item.indikator_stop || item.kategori_masalah ? <span className="text-rose-600">X</span> : <span className="text-emerald-600">✓</span>}
              </td>
              <td className="px-2 py-1 text-[11px] font-medium whitespace-pre leading-tight border-r border-slate-100 border-b border-slate-100">
                {item.backupOpName && item.isIstirahat && <div className="text-slate-700 font-bold mb-0.5">{item.backupOpName}</div>}
                <div className={item.cacatDisplay && item.cacatDisplay !== "-" ? "text-rose-600" : "text-slate-400"}>
                  {!item.isIstirahat && (item.cacatDisplay || "-")}
                  {item.isIstirahat && item.cacatDisplay && item.cacatDisplay !== "-" && item.cacatDisplay}
                  {item.isIstirahat && (!item.cacatDisplay || item.cacatDisplay === "-") && !item.backupOpName && "-"}
                </div>
              </td>
              <td className="px-2 py-1 border-r border-slate-100 border-b border-slate-100">
                {item.isGradable ? (
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onOpenDetail(item.header_id)}
                      className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-[#0070bc] hover:border-[#0070bc]/30 transition-all shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
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
              <td className="px-1 py-1 text-center border-r border-slate-100 border-b border-slate-100">
                {item.isGradable ? (
                  <button
                    onClick={() => onSelectGrade(item.id, "A")}
                    className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md transition-all border ${selections[item.id] === "A" ? "border-emerald-500 bg-emerald-100 text-emerald-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-emerald-300 hover:text-emerald-500"}`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </td>
              <td className="px-1 py-1 text-center border-r border-slate-100 border-b border-slate-100">
                {item.isGradable ? (
                  <button
                    onClick={() => onSelectGrade(item.id, "B")}
                    className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md transition-all border ${selections[item.id] === "B" ? "border-amber-500 bg-amber-100 text-amber-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-amber-300 hover:text-amber-500"}`}
                  >
                    <span className="text-[10px] font-black">B</span>
                  </button>
                ) : null}
              </td>
              <td className="px-1 py-1 text-center border-b border-slate-100">
                {item.isGradable ? (
                  <button
                    onClick={() => onSelectGrade(item.id, "BS")}
                    className={`w-6 h-6 mx-auto flex items-center justify-center rounded-md transition-all border ${selections[item.id] === "BS" ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-rose-300 hover:text-rose-500"}`}
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
