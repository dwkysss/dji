import React from "react";
import { CheckCircle, Eye, Trash2, Edit3, Plus } from "lucide-react";

interface MeterMendingTableProps {
  displayItems: any[];
  selections: Record<string, string>;
  onSelectGrade: (id: string, grade: string) => void;
  onOpenDetail: (headerId: string) => void;
  onOpenAddQC?: (detail: any) => void;
  onOpenEditDetail?: (detail: any) => void;
  onDeleteDetail: (val: any) => void;
  selectedDetailIds?: string[];
  onToggleSelectDetail?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
}

export default function MeterMendingTable({
  displayItems,
  selections,
  onSelectGrade,
  onOpenDetail,
  onOpenAddQC,
  onOpenEditDetail,
  onDeleteDetail,
  selectedDetailIds = [],
  onToggleSelectDetail,
  onToggleSelectAll,
}: MeterMendingTableProps) {
  const selectableIds = React.useMemo(() => {
    return displayItems
      .filter((it) => !it.isTotalRow && !it.isStartRow && !it.is_deleted && it.status_inspeksi !== "Dihapus" && it.status_mending !== "Dihapus")
      .map((it) => it.id);
  }, [displayItems]);

  const isAllSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedDetailIds?.includes(id));
  const isSomeSelected = selectableIds.some((id) => selectedDetailIds?.includes(id)) && !isAllSelected;

  return (
    <table className="w-full min-w-[720px] text-left text-xs border-collapse">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
          {onToggleSelectDetail && (
            <th className="px-1.5 py-2 w-8 text-center border-r border-slate-100" rowSpan={2}>
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isSomeSelected;
                }}
                onChange={() => onToggleSelectAll && onToggleSelectAll(selectableIds)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                title="Pilih Semua Baris"
              />
            </th>
          )}
          <th className="sticky left-0 z-20 bg-slate-50 px-2 py-2 w-8 text-center border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" rowSpan={2}>NO</th>
          <th className="px-2 py-2 w-20 text-center border-r border-slate-100 whitespace-nowrap" rowSpan={2}>TGL</th>
          <th className="px-1.5 py-2 w-10 text-center border-r border-slate-100" rowSpan={2}>Group</th>
          <th className="px-2 py-2 w-24 text-center border-r border-slate-100" rowSpan={2}>Operator</th>
          <th className="px-1.5 py-2 text-center w-12 border-r border-slate-100" rowSpan={2}>METER</th>
          <th className="px-1.5 py-2 text-center w-12 border-r border-slate-100" rowSpan={2}>KET ✓/X</th>
          <th className="px-2 py-2 min-w-[160px] w-full text-center border-r border-slate-100" rowSpan={2}>KETERANGAN CACAT</th>
          <th className="px-2 py-2 text-center w-24 border-r border-slate-100" rowSpan={2}>AKSI</th>
          <th className="px-2 py-1 border-b border-slate-200 font-extrabold text-slate-600 text-center border-r border-slate-100" colSpan={3}>MENDING</th>
        </tr>
        <tr className="bg-slate-50">
          <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-emerald-600 border-r border-slate-100 w-16">A</th>
          <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-amber-600 border-r border-slate-100 w-16">B</th>
          <th className="px-1 py-1 border-b border-slate-200 text-center font-black text-rose-600 border-r border-slate-100 w-16">BS</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
        {displayItems.map((item: any, index: number) => {
          if (item.isTotalRow) {
            return (
              <tr key={item.id || index} className="bg-slate-100 border-t-2 border-b-2 border-slate-300">
                <td colSpan={onToggleSelectDetail ? 12 : 11} className="sticky left-0 z-10 bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  {item.totalLabel} <span className="font-extrabold text-slate-800 ml-1">{item.totalMeter}</span>
                </td>
              </tr>
            );
          }

          if (item.isStartRow) {
            return (
              <tr key={item.id || index} className="hover:bg-slate-50 transition-colors">
                {onToggleSelectDetail && (
                  <td className="px-1.5 py-1.5 text-center border-r border-slate-100 border-b border-slate-100"></td>
                )}
                <td className="sticky left-0 z-10 bg-white px-1 py-1.5 font-bold text-slate-800 text-center text-xs w-7 border-r border-slate-100 border-b border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  {item.displayNo}
                </td>
                <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap text-xs w-24 border-r border-slate-100 border-b border-slate-100">
                  {item.showTgl ? item.tglStr : ""}
                </td>
                <td className="px-1.5 py-1.5 font-medium text-slate-700 text-center text-xs w-12 border-r border-slate-100 border-b border-slate-100">
                  {item.showGrp ? item.grpStr : ""}
                </td>
                <td className="px-2 py-1.5 font-medium text-slate-700 leading-tight text-xs w-28 border-r border-slate-100 border-b border-slate-100">
                  {item.showOpr ? item.oprStr : ""}
                </td>
                <td className="px-1.5 py-1.5 text-center font-bold text-slate-800 text-xs w-14 border-r border-slate-100 border-b border-slate-100">
                  {item.meterDisplay}
                </td>
                <td className="px-1.5 py-1.5 text-center font-bold text-sm w-14 border-r border-slate-100 border-b border-slate-100">
                  {/* Empty KET for START */}
                </td>
                <td className="px-3 py-1.5 text-[11px] font-bold text-slate-400 whitespace-pre leading-tight border-r border-slate-100 border-b border-slate-100">
                  START
                </td>
                <td className="px-2 py-1.5 text-center w-24 border-r border-slate-100 border-b border-slate-100">
                  {/* Empty AKSI for START */}
                </td>
                <td className="px-1 py-1.5 border-b border-slate-100 border-r border-slate-100 w-28"></td>
                <td className="px-1 py-1.5 border-b border-slate-100 border-r border-slate-100 w-28"></td>
                <td className="px-1 py-1.5 border-b border-slate-100 w-28"></td>
              </tr>
            );
          }

          const isDeleted = !!item.is_deleted || item.status_inspeksi === "Dihapus" || item.status_mending === "Dihapus" || (item.keterangan_cacat || "").includes("[DIHAPUS]");
          const isRowQcModified = item.hasTambahanQC || !!item.keterangan_cacat?.includes("[TAMBAHAN QC]") || !!item.keterangan_cacat?.includes("[TAMBAHAN MENDING]") || (!!item.keterangan_qc && item.keterangan_qc !== "-");

          const cacatRawLines = (item.cacatDisplay && item.cacatDisplay !== "-")
            ? item.cacatDisplay.split("\n").map((l: string) => l.trim()).filter(Boolean)
            : [];

          const parsedCacatItems = cacatRawLines.map((line: string) => {
            const isLineQc = line.includes("[QC]") || line.includes("[TAMBAHAN QC]") || line.includes("[TAMBAHAN MENDING]") || item.hasTambahanQC;
            const cleanText = line
              .replace(/\[QC\]/gi, "")
              .replace(/\[TAMBAHAN QC\]/gi, "")
              .replace(/\[TAMBAHAN MENDING\]/gi, "")
              .replace(/^([A-Z0-9]\s*[-.]\s*|\d+\.\s*|\d+-\s*)/i, "")
              .trim();
            return { isLineQc, text: cleanText };
          }).filter((c: any) => c.text.length > 0 && c.text !== "-");

          return (
            <tr
              key={item.id || index}
              className={`transition-colors ${
                isDeleted
                  ? "bg-slate-100/60 opacity-80"
                  : isRowQcModified
                  ? "bg-sky-50/90 hover:bg-sky-100/60 border-y border-sky-200"
                  : (item.isIstirahat || item.hasIstirahat)
                  ? "bg-amber-50/30 hover:bg-amber-50/50"
                  : "bg-white hover:bg-slate-50"
              }`}
            >
              {onToggleSelectDetail && (
                <td className="px-1.5 py-1 text-center border-r border-slate-100 border-b border-slate-100">
                  {!isDeleted ? (
                    <input
                      type="checkbox"
                      checked={selectedDetailIds?.includes(item.id)}
                      onChange={() => onToggleSelectDetail(item.id)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  ) : null}
                </td>
              )}
              <td className={`sticky left-0 z-10 px-1 py-1.5 font-bold text-slate-800 text-center text-xs w-7 border-r border-slate-100 border-b border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isDeleted ? "bg-slate-100" : isRowQcModified ? "bg-sky-100/70" : (item.isIstirahat || item.hasIstirahat) ? "bg-[#fffbeb]" : "bg-white"}`}>
                <div className="flex flex-col items-center justify-center">
                  <span>{item.displayNo}</span>
                  {isDeleted ? (
                    <span className="text-[8px] font-black bg-rose-100 text-rose-700 px-1 py-0.2 rounded mt-0.5 leading-none shadow-sm border border-rose-200">
                      DIHAPUS
                    </span>
                  ) : isRowQcModified ? (
                    <span className="block text-[8px] font-black bg-sky-100 text-[#0070bc] px-1 py-0.5 rounded mt-0.5 leading-none border border-sky-300 shadow-2xs">+ QC</span>
                  ) : null}
                </div>
              </td>
              <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap text-xs w-24 border-r border-slate-100 border-b border-slate-100">
                {item.showTgl ? item.tglStr : ""}
              </td>
              <td className="px-1.5 py-1.5 font-medium text-slate-700 text-center text-xs w-12 border-r border-slate-100 border-b border-slate-100">
                {item.showGrp ? item.grpStr : ""}
              </td>
              <td className={`px-2 py-1.5 font-medium text-slate-700 leading-tight text-xs w-28 border-r border-slate-100 border-b border-slate-100 ${item.hasIstirahat ? "italic font-bold text-amber-600" : ""}`}>
                {item.hasIstirahat ? "Istirahat" : (item.showOpr ? item.oprStr : "")}
              </td>
              <td className="px-1.5 py-1.5 text-center font-bold text-slate-800 text-xs w-14 border-r border-slate-100 border-b border-slate-100">
                {item.meterDisplay}
              </td>
              <td className="px-1.5 py-1.5 text-center font-bold text-sm w-14 border-r border-slate-100 border-b border-slate-100">
                {isDeleted ? <span className="text-slate-400 font-bold">-</span> : !item.isGradable ? "" : (item.indikator_stop || item.kategori_masalah || isRowQcModified ? <span className="text-rose-600">X</span> : <span className="text-emerald-600">✓</span>)}
              </td>
              <td className="px-3 py-1.5 text-[11px] font-medium whitespace-pre leading-tight border-r border-slate-100 border-b border-slate-100">
                {isDeleted ? (
                  <div className="italic text-slate-400 font-medium">[Titik Dihapus]</div>
                ) : (
                  <>
                    {item.backupOpName && item.hasIstirahat && <div className="text-slate-700 font-bold mb-0.5">{item.backupOpName}</div>}
                    {parsedCacatItems.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {parsedCacatItems.map((cItem: any, idx: number) => {
                          const numPrefix = parsedCacatItems.length > 1 ? `${idx + 1}. ` : "";
                          return (
                            <div
                              key={idx}
                              className={
                                cItem.isLineQc
                                  ? "text-[#0070bc] font-semibold"
                                  : (!item.isGradable || item.isGagalCacatOnly)
                                  ? "text-slate-500 font-medium"
                                  : "text-rose-600 font-medium"
                              }
                            >
                              {numPrefix}{cItem.text}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      !item.backupOpName && <span className="text-slate-400">-</span>
                    )}
                    {item.keterangan_qc && item.keterangan_qc !== "-" && (
                      <div className="text-[#0070bc] bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5 font-bold text-[10px] mt-0.5 shadow-2xs flex items-center gap-1 w-fit">
                        <span className="text-[#0070bc] font-black">QC:</span> {item.keterangan_qc}
                      </div>
                    )}
                  </>
                )}
              </td>
              <td className="px-2 py-1.5 text-center w-24 border-r border-slate-100 border-b border-slate-100">
                {isDeleted ? (
                  <span className="text-[10px] text-slate-400 font-semibold italic text-center block">Dihapus</span>
                ) : item.isGradable ? (
                  <div className="flex items-center justify-center gap-1">
                    {onOpenAddQC && (
                      <button
                        onClick={() => onOpenAddQC(item)}
                        className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
                        title="Tambah Temuan / Catatan"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onOpenEditDetail && (
                      <button
                        onClick={() => onOpenEditDetail(item)}
                        className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 transition-all shadow-xs cursor-pointer"
                        title="Koreksi Data Bawaan"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteDetail({ id: item.id, name: `${item.kategori_masalah || 'Masalah'} - ${item.detail_masalah || 'Tidak ada detail'}` })}
                      className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-all shadow-sm cursor-pointer"
                      title="Hapus Rincian"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : null}
              </td>
              <td className="px-1 py-1 text-center border-r border-slate-100 border-b border-slate-100 w-16">
                {isDeleted ? (
                  <span className="text-slate-300 font-bold block text-center">-</span>
                ) : item.isGradable ? (
                  <button
                    onClick={() => onSelectGrade(item.id, "A")}
                    className={`w-7 h-7 mx-auto flex items-center justify-center rounded-md transition-all border ${selections[item.id] === "A" ? "border-emerald-500 bg-emerald-100 text-emerald-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-emerald-300 hover:text-emerald-500"}`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </td>
              <td className="px-1 py-1 text-center border-r border-slate-100 border-b border-slate-100 w-16">
                {isDeleted ? (
                  <span className="text-slate-300 font-bold block text-center">-</span>
                ) : item.isGradable ? (
                  <button
                    onClick={() => onSelectGrade(item.id, "B")}
                    className={`w-7 h-7 mx-auto flex items-center justify-center rounded-md transition-all border ${selections[item.id] === "B" ? "border-amber-500 bg-amber-100 text-amber-700 shadow-sm" : "border-slate-200 bg-white text-slate-300 hover:border-amber-300 hover:text-amber-500"}`}
                  >
                    <span className="text-[10px] font-black">B</span>
                  </button>
                ) : null}
              </td>
              <td className="px-1 py-1 text-center border-b border-slate-100 w-16">
                {isDeleted ? (
                  <span className="text-slate-300 font-bold block text-center">-</span>
                ) : item.isGradable ? (
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
      </tbody>
    </table>
  );
}
