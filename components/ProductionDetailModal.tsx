import React from "react";
import {
  X,
  Edit,
  Box,
  ClipboardList,
  Clock,
  Package,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface ProductionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  detailData: any | null;
  isLoading?: boolean;
  hideEdit?: boolean;
}

export default function ProductionDetailModal({
  isOpen,
  onClose,
  detailData,
  isLoading = false,
  hideEdit = false,
}: ProductionDetailModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col my-auto animate-scaleIn overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="p-12 sm:p-20 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#0070bc] mb-4" />
            <span className="text-slate-500 font-medium">Memuat Detail...</span>
          </div>
        ) : detailData ? (
          <>
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col min-w-0 pr-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-800 truncate">
                  Detail Laporan Produksi
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5 truncate">
                  ID: {detailData.id}
                </p>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {!hideEdit && (
                  <button
                    onClick={() => router.push(`/edit/${detailData.id}`)}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold text-xs transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Edit Data</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar bg-slate-50/30">
              {/* Info Header */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 mb-6 sm:mb-8">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Mesin & Grup
                  </p>
                  <p className="text-sm font-bold text-slate-800">
                    {detailData.nomor_mc || "-"} / Grup{" "}
                    {detailData.groups?.nama_grup || detailData.group_id}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Operator
                  </p>
                  <p className="text-sm font-bold text-slate-800">
                    {detailData.pic ||
                      detailData.operators?.nama_operator ||
                      "No Name"}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Design
                  </p>
                  <p className="text-sm font-bold text-slate-800">
                    {detailData.designs?.nama_design ||
                      detailData.design_id ||
                      "-"}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Total PCS
                  </p>
                  <p className="text-sm font-bold text-[#0070bc]">
                    {detailData.pcs} PCS
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Spesifikasi Panel */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Box className="w-4 h-4" /> Spesifikasi Produksi
                  </h4>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-sm">
                    <div className="flex justify-between p-3 border-b border-slate-100">
                      <span className="text-slate-500">Panel / Potongan</span>
                      <span className="font-bold text-slate-800">
                        {detailData.panel_no === "METERAN"
                          ? "-"
                          : detailData.panel_no || "-"}{" "}
                        / {detailData.potongan_ke || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 border-b border-slate-100">
                      <span className="text-slate-500">Course / RPM</span>
                      <span className="font-bold text-slate-800">
                        {detailData.course || "-"} / {detailData.rpm || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 border-b border-slate-100">
                      <span className="text-slate-500">No. Customer</span>
                      <span className="font-bold text-slate-800">
                        {detailData.no_customer || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 border-b border-slate-100">
                      <span className="text-slate-500">No. Order</span>
                      <span className="font-bold text-slate-800">
                        {detailData.no_order_barang || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 border-b border-slate-100">
                      <span className="text-slate-500">Tanggal Potong</span>
                      <span className="font-bold text-slate-800">
                        {detailData.tanggal_potong || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 border-b border-slate-100">
                      <span className="text-slate-500">Status Matching</span>
                      <span className="font-bold text-slate-800">
                        {detailData.status_matching || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between p-3">
                      <span className="text-slate-500">Pick</span>
                      <span className="font-bold text-slate-800">
                        {detailData.pick || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Benang & Material */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" /> Benang & Material
                  </h4>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-sm">
                    <div className="flex justify-between p-3 border-b border-slate-100">
                      <span className="text-slate-500">Benang Dasar</span>
                      <span className="font-bold text-slate-800">
                        {detailData.jenis_benang_dasar || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 border-b border-slate-100">
                      <span className="text-slate-500">Liner</span>
                      <span className="font-bold text-slate-800">
                        {detailData.liner || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 border-b border-slate-100">
                      <span className="text-slate-500">Heavy</span>
                      <span className="font-bold text-slate-800">
                        {detailData.heavy || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 border-b border-slate-100">
                      <span className="text-slate-500">Shadow</span>
                      <span className="font-bold text-slate-800">
                        {detailData.shadow || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between p-3">
                      <span className="text-slate-500">Pinggiran</span>
                      <span className="font-bold text-slate-800">
                        {detailData.pinggiran || "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Downtime Info */}
              {detailData.total_downtime_detik > 0 && (
                <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-800">
                      Total Downtime: {detailData.total_downtime_detik} Detik
                    </h4>
                    <p className="text-xs text-amber-700 mt-1">
                      Terdapat waktu tunggu (downtime) selama produksi sesi ini
                      berjalan.
                    </p>
                  </div>
                </div>
              )}

              {/* Detail PCS */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" /> Rincian per PCS
                </h4>

                {detailData.details && detailData.details.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {detailData.details.map((pcs: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border shadow-sm ${pcs.kategori_masalah ? "bg-red-50/50 border-red-200" : "bg-white border-slate-200"}`}
                      >
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                            PCS #{pcs.pcs_index}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            {pcs.jml_hasil_produksi || 1} Hasil
                          </span>
                        </div>
                        
                        {(() => {
                          const meterMatch = pcs.detail_masalah?.match(/\(Titik:\s*([\d.]+[a-zA-Z]*)\)/);
                          const defectMeter = meterMatch ? meterMatch[1] : null;
                          const cleanDetail = pcs.detail_masalah?.replace(/\s*\(Titik:\s*[\d.]+[a-zA-Z]*\)/g, '').trim();
                          
                          return (
                            <>

                        {pcs.kategori_masalah ? (
                          <div className="space-y-2 mt-2 pt-2 border-t border-red-100/50">
                            <div className="flex gap-2">
                              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-red-400 uppercase">
                                  Kategori Masalah
                                </span>
                                <span className="text-xs font-semibold text-red-700">
                                  {pcs.kategori_masalah}
                                </span>
                              </div>
                            </div>
                            {(pcs.spesifik_masalah || cleanDetail || pcs.detail_masalah) && (
                              <div className="pl-6 text-xs text-slate-600">
                                <span className="font-semibold">Spesifik:</span>{" "}
                                {pcs.spesifik_masalah || cleanDetail || pcs.detail_masalah}
                              </div>
                            )}
                            {pcs.keterangan_cacat && (
                              <div className="pl-6 text-xs text-slate-600">
                                <span className="font-semibold">Cacat:</span>{" "}
                                {pcs.keterangan_cacat}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2 text-emerald-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-xs font-semibold">
                              Produksi Normal / Sukses
                            </span>
                          </div>
                        )}

                        {pcs.meter_kain && (
                          <div className="mt-2 text-xs font-semibold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            Meter Total: {pcs.meter_kain}
                          </div>
                        )}
                        {defectMeter && (
                          <div className="mt-2 inline-flex items-center px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 border border-orange-200 text-xs font-bold gap-1.5">
                            Titik Cacat: {defectMeter}
                          </div>
                        )}
                        </>
                      );
                    })()}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">
                    Tidak ada rincian PCS yang disimpan.
                  </p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
