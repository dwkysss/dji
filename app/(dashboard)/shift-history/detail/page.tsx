"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { searchEmployeeHistory, markPotonganAsCut } from "@/actions/employee-actions";
import { deleteProductionDetailRow } from "@/actions/qc-actions";
import CompactHeaderCard from "@/components/forms/CompactHeaderCard";
import {
  Loader2,
  ArrowLeft,
  Clock,
  AlertCircle,
  Timer,
  Wrench,
  ChevronRight,
  Printer,
  Scissors,
  CheckCircle,
  X,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import PanelHistoryTable from "@/app/(employee)/history/detail/components/PanelHistoryTable";
import MeterHistoryTable from "@/app/(employee)/history/detail/components/MeterHistoryTable";
import PrintableProductionReport from "@/components/reports/PrintableProductionReport";

function ShiftHistoryDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const nomor_mc = searchParams.get("mc");
  const design_id = searchParams.get("design");
  const potongan_ke = searchParams.get("potongan");
  const tgl = searchParams.get("tgl");

  const [detailData, setDetailData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Tandai Potong Kain Modal State
  const [isMarkCutModalOpen, setIsMarkCutModalOpen] = useState(false);
  const [markCutDate, setMarkCutDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isSubmittingMarkCut, setIsSubmittingMarkCut] = useState(false);
  const [markCutError, setMarkCutError] = useState<string | null>(null);

  // Deletion Modal States (seperti di halaman Inspeksi QC)
  const [detailToDelete, setDetailToDelete] = useState<any | null>(null);
  const [pendingDeleteMode, setPendingDeleteMode] = useState<"shift" | "keep_slot" | null>(null);
  const [isDeletingDetail, setIsDeletingDetail] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchDetail = async () => {
    if (!nomor_mc || !potongan_ke) {
      setErrorMsg("Parameter tidak lengkap.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await searchEmployeeHistory({
        nomor_mc: nomor_mc,
        design_id: design_id || undefined,
        potongan_ke: potongan_ke,
        includeDetails: true,
      });

      if (res.success && res.data && res.data.length > 0) {
        const batch = res.data.find(
          (b: any) =>
            String(b.nomor_mc || "").trim().toUpperCase() === String(nomor_mc || "").trim().toUpperCase() &&
            b.potongan_ke == potongan_ke
        );

        if (batch) {
          setDetailData(batch);
        } else {
          setDetailData(res.data[0]);
        }
      } else {
        setErrorMsg("Data tidak ditemukan.");
      }
    } catch (err: any) {
      setErrorMsg("Terjadi kesalahan jaringan.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [nomor_mc, design_id, potongan_ke, tgl]);

  const handleDeletePanel = async (mode: "shift" | "keep_slot") => {
    if (!detailToDelete) return;
    setIsDeletingDetail(true);
    try {
      const res = await deleteProductionDetailRow(detailToDelete.id, mode);
      if (res.success) {
        showToast(
          mode === "shift"
            ? "Data baris berhasil dihapus dan nomor panel digeser."
            : "Data baris ditandai DIHAPUS (slot tetap)."
        );
        setDetailToDelete(null);
        setPendingDeleteMode(null);
        await fetchDetail();
      } else {
        showToast("Gagal menghapus baris: " + res.error, "error");
      }
    } catch (err: any) {
      showToast("Terjadi kesalahan: " + err.message, "error");
    } finally {
      setIsDeletingDetail(false);
    }
  };

  const formatDurationNice = (totalSec: number | string) => {
    const sec = typeof totalSec === "string" ? parseInt(totalSec) || 0 : totalSec || 0;
    if (sec <= 0) return "0 dtk";
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    if (hours > 0) {
      if (minutes > 0) return `${hours} Jam ${minutes} Mnt`;
      return `${hours} Jam`;
    }
    if (minutes > 0) {
      if (seconds > 0) return `${minutes} Mnt ${seconds} Dtk`;
      return `${minutes} Mnt`;
    }
    return `${seconds} Dtk`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-[#0070bc] mb-4" />
        <span className="text-slate-500 font-medium">Memuat Detail...</span>
      </div>
    );
  }

  if (errorMsg || !detailData) {
    return (
      <div className="flex-1 p-6 sm:p-10 flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h3 className="text-lg font-bold text-slate-800">{errorMsg || "Data tidak ditemukan."}</h3>
        <button
          onClick={() => router.push("/shift-history")}
          className="mt-6 flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold text-slate-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full min-w-0 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-[999] px-5 py-3.5 rounded-2xl shadow-xl border flex items-center gap-3 animate-slideIn ${
            toastMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-xs font-bold">{toastMessage.text}</span>
        </div>
      )}

      {/* Header Nav */}
      <div className="flex items-center justify-between gap-2 mb-6 no-print">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/shift-history")}
            className="h-9 w-9 shrink-0 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 flex items-center justify-center transition-colors shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
            <span
              className="hover:text-[#0070bc] cursor-pointer transition-colors"
              onClick={() => router.push("/shift-history")}
            >
              Riwayat (Kepala Shift)
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-700 font-black">Detail & Koreksi</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!detailData?.panels?.some(
            (p: any) =>
              String(p.panel_no || "").toUpperCase().includes("BS AKHIR") ||
              String(p.panel_no || "").toUpperCase() === "BS AKHIR"
          ) && (
            <button
              type="button"
              onClick={() => {
                setMarkCutDate(detailData?.tgl || new Date().toISOString().split("T")[0]);
                setMarkCutError(null);
                setIsMarkCutModalOpen(true);
              }}
              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
              title="Tandai Selesai Potong & Buat BS Akhir"
            >
              <Scissors className="w-4 h-4" />
              <span>Tandai Potong Kain</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="h-9 px-3.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-black text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
            title="Cetak Laporan / Simpan PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </div>

      <CompactHeaderCard
        nomorMc={detailData.nomor_mc}
        shiftName={detailData.panels?.[0]?.groups?.nama_grup || "-"}
        operatorName={detailData.operators_list}
        design={detailData.design_id}
        pcsCount={detailData.total_panels}
        panelPotongan={`- / ${detailData.potongan_ke}`}
        courseRpm={`${detailData.course || "-"} / ${detailData.rpm || "-"}`}
        noCustomer={detailData.no_customer || "-"}
        noOrder={detailData.no_order_barang || "-"}
        tanggalPotong={(() => {
          let latest =
            detailData.waktu_input_terakhir ||
            detailData.tanggal_jam ||
            detailData.created_at ||
            detailData.tgl ||
            "";
          if (detailData.panels && Array.isArray(detailData.panels)) {
            detailData.panels.forEach((p: any) => {
              const ts = p.tanggal_jam || p.created_at;
              if (ts && (!latest || String(ts).localeCompare(String(latest)) > 0)) {
                latest = ts;
              }
            });
          }
          return latest || detailData.tanggal_potong || "-";
        })()}
        statusMatching={detailData.status_matching || "-"}
        pick={detailData.pick || "-"}
        benangDasar={detailData.jenis_benang_dasar || "-"}
        liner={detailData.liner || "-"}
        heavy={detailData.heavy || "-"}
        shadow={detailData.shadow || "-"}
        pinggiran={detailData.pinggiran || "-"}
        tanggalProduksi={(() => {
          let oldest =
            detailData.tanggal_jam || detailData.created_at || detailData.tgl;
          if (detailData.panels && Array.isArray(detailData.panels)) {
            detailData.panels.forEach((p: any) => {
              const ts = p.tanggal_jam || p.created_at || p.tgl;
              if (ts && (!oldest || String(ts).localeCompare(String(oldest)) < 0)) {
                oldest = ts;
              }
            });
          }
          return oldest || "-";
        })()}
        course={detailData.course}
        rpm={detailData.rpm}
        potonganKe={detailData.potongan_ke}
      />

      {/* Downtime Info */}
      {detailData.total_downtime_detik > 0 && (
        <div className="mb-6 rounded-xl overflow-hidden border border-amber-200 shadow-sm">
          <div className="bg-amber-500 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Timer className="w-4 h-4 text-white shrink-0" />
              <span className="text-white text-xs font-black uppercase tracking-wide">
                Downtime Terdeteksi
              </span>
            </div>
            <span className="text-white font-black text-sm sm:text-base whitespace-nowrap">
              {formatDurationNice(detailData.total_downtime_detik)}
            </span>
          </div>
        </div>
      )}

      {/* Laporan Produksi Table */}
      <div className="pb-4">
        {(() => {
          const pcsGroups: { [key: string]: any[] } = {};

          const uniqueById = new Map();
          (detailData.panels || []).forEach((panel: any) => {
            if (!uniqueById.has(panel.id)) {
              uniqueById.set(panel.id, {
                ...panel,
                production_details: [...(panel.production_details || [])],
              });
            }
          });

          const deduplicatedPanels = Array.from(uniqueById.values());
          const finalPanels: any[] = [];
          const seenPanelNo = new Map<string, any>();

          deduplicatedPanels.forEach((panel: any) => {
            if (panel.panel_no === "METERAN") {
              finalPanels.push(panel);
            } else {
              const key = panel.panel_no;
              const existing = seenPanelNo.get(key);
              if (existing) {
                existing.production_details.push(...(panel.production_details || []));

                let existingDt: any[] = [];
                try {
                  const parsed =
                    typeof existing.downtime_events === "string"
                      ? JSON.parse(existing.downtime_events)
                      : existing.downtime_events;
                  existingDt = Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                  existingDt = [];
                }
                let newDt: any[] = [];
                try {
                  const parsed =
                    typeof panel.downtime_events === "string"
                      ? JSON.parse(panel.downtime_events)
                      : panel.downtime_events;
                  newDt = Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                  newDt = [];
                }
                existing.downtime_events = [...existingDt, ...newDt];

                const existingPcs = parseInt(existing.pcs || "1");
                const newPcs = parseInt(panel.pcs || "1");
                if (newPcs > existingPcs) existing.pcs = newPcs.toString();
              } else {
                seenPanelNo.set(key, panel);
              }
            }
          });

          finalPanels.push(...Array.from(seenPanelNo.values()));

          const oldestPanelIdByOperator = new Map<string, string>();
          const sortedByTime = [...finalPanels].sort((a, b) =>
            String(a.tanggal_jam || "").localeCompare(String(b.tanggal_jam || ""))
          );
          sortedByTime.forEach((p: any) => {
            const opr =
              p.operators?.nama_operator || p.pic || p.created_by_name || "";
            const grp = p.groups?.nama_grup || "";
            const operatorStr = (grp ? `(${grp}) ` : "") + opr;
            if (!oldestPanelIdByOperator.has(operatorStr)) {
              oldestPanelIdByOperator.set(operatorStr, p.id);
            }
          });

          finalPanels.forEach((panel: any) => {
            const numPcs = parseInt(panel.pcs || "1");
            for (let i = 1; i <= numPcs; i++) {
              const pcsKey = i.toString();
              if (!pcsGroups[pcsKey]) {
                pcsGroups[pcsKey] = [];
              }

              const panelClone = { ...panel };

              let dtEvents: any[] = [];
              try {
                dtEvents =
                  typeof panelClone.downtime_events === "string"
                    ? JSON.parse(panelClone.downtime_events)
                    : panelClone.downtime_events || [];
              } catch (e) {
                dtEvents = [];
              }

              const matchedEvents = dtEvents.filter(
                (e: any) =>
                  !e.pcsKe ||
                  e.pcsKe === "Semua" ||
                  e.pcsKe.split(",").map((x: any) => x.trim()).includes(pcsKey)
              );

              let hasDetails = false;
              if (panelClone.production_details) {
                const filteredDetails = panelClone.production_details.filter(
                  (d: any) => {
                    const pIndex = d.pcs_index ? parseInt(d.pcs_index) : 1;
                    return pIndex === i;
                  }
                );
                const hasErrors = filteredDetails.some(
                  (d: any) => d.kategori_masalah || d.keterangan_cacat
                );
                if (hasErrors) {
                  hasDetails = true;
                  panelClone.production_details = filteredDetails;
                } else {
                  panelClone.production_details = [];
                }
              }

              const isIstirahat =
                panelClone.production_details?.some((d: any) =>
                  d.keterangan_cacat?.toUpperCase().includes("ISTIRAHAT")
                ) ||
                dtEvents.some((e: any) =>
                  e.kategori?.toUpperCase().includes("ISTIRAHAT")
                );

              const isMeterInput = panelClone.panel_no === "METERAN";
              const opr =
                panelClone.operators?.nama_operator ||
                panelClone.pic ||
                panelClone.created_by_name ||
                "";
              const grp = panelClone.groups?.nama_grup || "";
              const operatorStr = (grp ? `(${grp}) ` : "") + opr;
              const isOldest =
                oldestPanelIdByOperator.get(operatorStr) === panelClone.id;
              const isFinishReport =
                isMeterInput &&
                panelClone.meter_akhir !== null &&
                panelClone.meter_akhir !== undefined &&
                String(panelClone.meter_akhir).trim() !== "";

              if (isMeterInput) {
                if (
                  isOldest ||
                  isFinishReport ||
                  matchedEvents.length > 0 ||
                  hasDetails ||
                  isIstirahat
                ) {
                  pcsGroups[pcsKey].push(panelClone);
                }
              } else {
                if (panelClone.production_details.length === 0) {
                  panelClone.production_details =
                    panel.production_details?.filter((d: any) => {
                      const pIndex = d.pcs_index ? parseInt(d.pcs_index) : 1;
                      return pIndex === i;
                    }) || [];
                }
                pcsGroups[pcsKey].push(panelClone);
              }
            }
          });

          const sortedPcsKeys = Object.keys(pcsGroups).sort(
            (a, b) => parseInt(a) - parseInt(b)
          );
          if (sortedPcsKeys.length === 0) return null;

          const isMeterReport = detailData.panels?.some(
            (p: any) => p.panel_no === "METERAN"
          );

          return (
            <div className="mb-6">
              {!isMeterReport && (
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  Rincian per Panel
                </h4>
              )}
              <div className="w-full overflow-x-auto pb-4 custom-scrollbar bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex w-max min-w-full gap-8">
                  {sortedPcsKeys.map((pcsKey) => {
                    const pcsLabel = `PCS ${pcsKey}`;
                    const panels = pcsGroups[pcsKey].sort((a, b) => {
                      if (a.panel_no === "METERAN" && b.panel_no === "METERAN") {
                        return String(a.tanggal_jam || "").localeCompare(
                          String(b.tanggal_jam || "")
                        );
                      }
                      if (a.panel_no === "METERAN") return 1;
                      if (b.panel_no === "METERAN") return -1;

                      const pA = parseInt(a.panel_no || "0");
                      const pB = parseInt(b.panel_no || "0");
                      if (pA === pB) {
                        const isABs =
                          String(a.panel_no || "").includes("(BS)") ||
                          String(a.panel_no || "").includes("(GAGAL)");
                        const isBBs =
                          String(b.panel_no || "").includes("(BS)") ||
                          String(b.panel_no || "").includes("(GAGAL)");
                        if (isABs && !isBBs) return -1;
                        if (!isABs && isBBs) return 1;
                        return String(a.tanggal_jam || "").localeCompare(
                          String(b.tanggal_jam || "")
                        );
                      }
                      return pA - pB;
                    });

                    const isMeter =
                      detailData.is_meter ||
                      panels.some((p: any) => p.panel_no === "METERAN");

                    return (
                      <div
                        key={pcsKey}
                        className="w-min flex-none bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
                      >
                        <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 text-center">
                          <span className="font-black text-slate-800 text-sm tracking-wider uppercase">
                            {pcsLabel}
                          </span>
                        </div>
                        {isMeter ? (
                          <MeterHistoryTable
                            panels={panels}
                            pcsKey={pcsKey}
                            setDetailToDelete={setDetailToDelete}
                          />
                        ) : (
                          <PanelHistoryTable
                            panels={panels}
                            pcsKey={pcsKey}
                            setDetailToDelete={setDetailToDelete}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ================= MODAL HAPUS BARIS PANEL (SEPERTI DI HALAMAN INSPEKSI QC) ================= */}
      {detailToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            {pendingDeleteMode === null ? (
              /* Step 1: Pilih Opsi Hapus */
              <>
                <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-3 mx-auto">
                  <AlertTriangle className="w-6 h-6 text-rose-600" />
                </div>
                <h3 className="text-lg font-bold text-center text-slate-800 mb-1">
                  Pilih Opsi Hapus Baris Panel
                </h3>
                <p className="text-xs text-center text-slate-500 mb-5">
                  Panel:{" "}
                  <span className="font-semibold text-slate-700">
                    {detailToDelete.panelNo
                      ? `Panel ${detailToDelete.panelNo} - `
                      : ""}
                    {detailToDelete.name}
                  </span>
                </p>

                <div className="flex flex-col gap-3 mb-5">
                  {/* Opsi 1: Hapus & Geser */}
                  <button
                    type="button"
                    onClick={() => setPendingDeleteMode("shift")}
                    className="flex items-start gap-3 p-3.5 rounded-xl border-2 border-rose-100 bg-rose-50/40 hover:bg-rose-50 hover:border-rose-300 text-left transition-all group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-xs group-hover:scale-105 transition-transform">
                      1
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-slate-800 group-hover:text-rose-700 transition-colors flex items-center justify-between">
                        <span>Hapus & Geser Nomor Panel</span>
                        <span className="text-[10px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded font-semibold">
                          Permanen
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Hapus data baris ini sepenuhnya. Nomor panel berikutnya akan digeser naik 1 angka (contoh: Panel 4 jadi Panel 3).
                      </p>
                    </div>
                  </button>

                  {/* Opsi 2: Tandai Dihapus (Nomor Tetap) */}
                  <button
                    type="button"
                    onClick={() => setPendingDeleteMode("keep_slot")}
                    className="flex items-start gap-3 p-3.5 rounded-xl border-2 border-amber-100 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-300 text-left transition-all group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-xs group-hover:scale-105 transition-transform">
                      2
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-slate-800 group-hover:text-amber-800 transition-colors flex items-center justify-between">
                        <span>Tandai Dihapus (Nomor Tetap)</span>
                        <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-semibold">
                          Nomor Tetap
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Nomor panel tetap berada di posisinya (tidak bergeser), panel diberi tanda{" "}
                        <span className="font-semibold text-rose-600">DIHAPUS</span>, dan tidak dihitung dalam total penjumlahan panel.
                      </p>
                    </div>
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setDetailToDelete(null);
                      setPendingDeleteMode(null);
                    }}
                    className="w-full h-10 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </>
            ) : (
              /* Step 2: Layar Konfirmasi Kedua */
              <>
                <div
                  className={`w-12 h-12 rounded-full ${
                    pendingDeleteMode === "shift"
                      ? "bg-rose-100 text-rose-600"
                      : "bg-amber-100 text-amber-600"
                  } flex items-center justify-center mb-3 mx-auto`}
                >
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-center text-slate-800 mb-1">
                  Konfirmasi Penghapusan
                </h3>
                <p className="text-xs text-center text-slate-500 mb-4">
                  Apakah Anda yakin ingin melanjutkan tindakan ini?
                </p>

                {pendingDeleteMode === "shift" ? (
                  <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 mb-5 text-left">
                    <div className="flex items-center gap-2 mb-1 font-bold text-xs text-rose-800">
                      <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px]">
                        1
                      </span>
                      Opsi 1: Hapus & Geser Nomor Panel
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Data baris{" "}
                      <span className="font-semibold text-rose-700">
                        {detailToDelete.panelNo
                          ? `Panel ${detailToDelete.panelNo}`
                          : detailToDelete.name}
                      </span>{" "}
                      akan <strong>dihapus permanen</strong> dan nomor panel setelahnya akan{" "}
                      <strong>digeser naik 1 nomor</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 mb-5 text-left">
                    <div className="flex items-center gap-2 mb-1 font-bold text-xs text-amber-900">
                      <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">
                        2
                      </span>
                      Opsi 2: Tandai Dihapus (Nomor Tetap)
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Nomor panel{" "}
                      <span className="font-semibold text-amber-800">
                        {detailToDelete.panelNo
                          ? `Panel ${detailToDelete.panelNo}`
                          : detailToDelete.name}
                      </span>{" "}
                      akan <strong>tetap di tempat</strong> dan berstatus{" "}
                      <strong>DIHAPUS</strong> (tidak dihitung dalam total penjumlahan panel).
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPendingDeleteMode(null)}
                    disabled={isDeletingDetail}
                    className="flex-1 h-11 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 border border-slate-200 cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePanel(pendingDeleteMode)}
                    disabled={isDeletingDetail}
                    className={`flex-1 h-11 rounded-xl font-bold text-xs text-white ${
                      pendingDeleteMode === "shift"
                        ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                        : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                    } shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer`}
                  >
                    {isDeletingDetail ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Ya, Hapus Data
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <PrintableProductionReport
        detailData={detailData}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
      />
    </div>
  );
}

export default function ShiftHistoryDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 animate-spin text-[#0070bc] mb-4" />
          <span className="text-slate-500 font-medium">Memuat Detail...</span>
        </div>
      }
    >
      <ShiftHistoryDetailContent />
    </Suspense>
  );
}
