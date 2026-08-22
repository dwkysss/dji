import React from "react";
import {
  X,
  ClipboardCheck,
  User,
  Scale,
  Clock,
  AlertTriangle,
  FileText,
  Package,
  Box,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface MendingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  mendingData: any | null;
}

export default function MendingDetailModal({
  isOpen,
  onClose,
  mendingData,
}: MendingDetailModalProps) {
  if (!isOpen || !mendingData) return null;

  const d = mendingData;
  const detail = mendingData.detail || {};
  const header = mendingData.header || {};
  const isMeteran = header.panel_no === "METERAN";
  const itemLabel = isMeteran ? "Titik Meter" : "Panel";

  let gradeA = 0,
    gradeB = 0,
    gradeBS = 0;
  (d.items || []).forEach((item: any) => {
    if (item.hasil_mending === "A") gradeA++;
    if (item.hasil_mending === "B") gradeB++;
    if (item.hasil_mending === "BS") gradeBS++;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col my-auto animate-scaleIn overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0070bc]/10 flex items-center justify-center text-[#0070bc]">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Detail Hasil Mending
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                ID: {d.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/30">
          {/* Info Utama */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Hasil Mending
              </p>
              <div className="text-sm font-bold text-slate-800 flex flex-wrap items-center gap-3 mt-1">
                {gradeA > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                    A: {gradeA}
                  </span>
                )}
                {gradeB > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                    B: {gradeB}
                  </span>
                )}
                {gradeBS > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 text-rose-700 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                    BS: {gradeBS}
                  </span>
                )}
                {gradeA === 0 && gradeB === 0 && gradeBS === 0 && (
                  <span>-</span>
                )}
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                {itemLabel}
              </p>
              <p className="text-sm font-bold text-slate-800">
                {isMeteran
                  ? "Titik Meter " + (detail.meter_kain ?? "-")
                  : "Panel " + header.panel_no}{" "}
                / PCS {detail.pcs_index}
              </p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Desain
              </p>
              <p className="text-sm font-bold text-slate-800">
                {header.design_id || "-"}
              </p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Potongan
              </p>
              <p className="text-sm font-bold text-[#0070bc]">
                Ke-{header.potongan_ke || "-"}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-sm mb-6">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 font-bold text-slate-600 flex items-center gap-2">
              <Box className="w-4 h-4" /> Spesifikasi Produksi
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4">
              <div className="p-3 border-r border-b md:border-b-0 border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Mesin
                </p>
                <p className="font-bold text-slate-800">
                  {header.nomor_mc || "-"}
                </p>
              </div>
              <div className="p-3 border-r border-b md:border-b-0 border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  No. Order
                </p>
                <p className="font-bold text-slate-800">
                  {header.no_order_barang || "-"}
                </p>
              </div>
              <div className="p-3 border-r border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Pick
                </p>
                <p className="font-bold text-slate-800">{header.pick || "-"}</p>
              </div>
              <div className="p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Tanggal Potong
                </p>
                <p className="font-bold text-slate-800">
                  {header.tanggal_potong || "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Info Inspeksi */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <User className="w-4 h-4" /> Informasi Mending
              </h4>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-sm">
                <div className="flex justify-between p-3 border-b border-slate-100">
                  <span className="text-slate-500">Petugas Mending</span>
                  <span className="font-bold text-slate-800">
                    {d.petugas_mending || "-"}
                  </span>
                </div>
                <div className="flex justify-between p-3 border-b border-slate-100">
                  <span className="text-slate-500">Tanggal Mending</span>
                  <span className="font-bold text-slate-800">
                    {d.tanggal_mending || "-"}
                  </span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-slate-500">Waktu Mending</span>
                  <span className="font-bold text-slate-800">
                    {d.start_mending} s/d {d.finish_mending}
                  </span>
                </div>
              </div>
            </div>

            {/* Keterangan */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Keterangan Mending
              </h4>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-sm h-full p-4">
                <p className="text-sm text-slate-700 italic">
                  {(d.keterangan_mending || "")
                    .replace(/\[ELAPSED:\d+\]/gi, "")
                    .replace(/\[PAUSE:\d+\]/gi, "")
                    .trim() || "Tidak ada catatan."}
                </p>
              </div>
            </div>
          </div>

          {/* List of Panels */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Box className="w-4 h-4" /> Rincian {itemLabel} di PCS Ini
            </h4>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3">
                        {isMeteran ? "Titik Meter" : "Panel"}
                      </th>
                      <th className="px-4 py-3 text-center">Hasil Mending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(d.items || []).map((item: any, idx: number) => {
                      const itemDetail = item.detail || {};
                      const itemHeader = itemDetail.header || header;

                      let itemText = "-";
                      let itemColor = "text-slate-800";

                      if (item.hasil_mending === "A") {
                        itemText = "Grade A";
                        itemColor = "text-emerald-700";
                      } else if (item.hasil_mending === "B") {
                        itemText = "Grade B";
                        itemColor = "text-amber-700";
                      } else if (item.hasil_mending === "BS") {
                        itemText = "Grade BS";
                        itemColor = "text-rose-700";
                      }

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-800">
                            {itemHeader.panel_no === "METERAN"
                              ? "Titik Meter " + (itemDetail.meter_kain ?? "-")
                              : "Panel " + itemHeader.panel_no}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className={`text-sm font-bold ${itemColor}`}>
                              {itemText}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
