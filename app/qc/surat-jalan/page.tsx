"use client";

import React, { useState, useEffect } from "react";
import {
  getSuratJalanList,
  updateSuratJalanStatus,
} from "@/actions/surat-jalan-actions";
import {
  ClipboardList,
  Plus,
  Search,
  FileText,
  CheckCircle,
  Package,
  Truck,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import ProductTour, { ProductTourStep } from "@/components/ProductTour";

const QC_SURAT_JALAN_TOUR_STEPS: ProductTourStep[] = [
  {
    target: "qc-sj-header",
    title: "Surat Jalan QC",
    description:
      "Halaman ini dipakai untuk mengelola surat jalan pengiriman kain hasil QC.",
  },
  {
    target: "qc-sj-actions",
    title: "Filter dan Buat Surat Jalan",
    description:
      "Pilih tanggal untuk memfilter, buat surat jalan baru, atau cetak beberapa surat jalan yang dipilih.",
  },
  {
    target: "qc-sj-list",
    title: "Daftar Surat Jalan",
    description:
      "Daftar menampilkan nomor surat jalan, tanggal, tujuan, jumlah muatan, status, dan aksi cetak/update status.",
  },
  {
    target: "qc-sj-list",
    title: "Pilih dan Cetak",
    description:
      "Centang beberapa baris untuk print batch, atau gunakan ikon di kolom aksi untuk cetak satu surat jalan.",
  },
];

export default function SuratJalanPage() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isTourOpen, setIsTourOpen] = useState(false);

  const [filterDate, setFilterDate] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, [filterDate]);

  const fetchData = async () => {
    setIsLoading(true);
    const res = await getSuratJalanList(filterDate);
    if (res.success && res.data) {
      setData(res.data);
      setSelectedIds([]); // Reset selection on refresh
    } else {
      setErrorMsg(res.error || "Gagal memuat data Surat Jalan");
    }
    setIsLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    if (!confirm(`Ubah status menjadi ${status}?`)) return;
    const res = await updateSuratJalanStatus(id, status);
    if (res.success) {
      fetchData();
    } else {
      alert("Gagal update status: " + res.error);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === data.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.map((d) => d.id));
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto pb-20 animate-fadeIn">
      {/* Header */}
      <div
        data-tour="qc-sj-header"
        className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6"
      >
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-[#0070bc]" />
            Surat Jalan
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Kelola pengiriman kain hasil produksi ke gudang atau tujuan lain.
          </p>
        </div>
        <div
          data-tour="qc-sj-actions"
          className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
        >
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-4 py-2 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-[#0070bc] focus:ring-4 focus:ring-[#0070bc]/10 transition-all bg-white hover:bg-slate-50 cursor-pointer w-40 shadow-sm"
          />
          {selectedIds.length > 0 && (
            <Link
              href={`/qc/surat-jalan/batch-print?ids=${selectedIds.join(",")}`}
              className="bg-slate-700 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Print Selected ({selectedIds.length})
            </Link>
          )}
          <button
            type="button"
            onClick={() => setIsTourOpen(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <HelpCircle className="w-4 h-4" />
            Tutorial
          </button>
          <Link
            href="/qc/surat-jalan/create"
            className="bg-[#0070bc] hover:bg-[#005a96] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Buat Surat Jalan
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 font-medium text-sm">
          {errorMsg}
        </div>
      )}

      {/* List */}
      <div
        data-tour="qc-sj-list"
        className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      >
        {isLoading ? (
          <div className="p-10 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-[#0070bc]/20 border-t-[#0070bc] rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-500 mt-4">
              Memuat data...
            </p>
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">
              Belum ada Surat Jalan
            </h3>
            <p className="text-slate-500 text-sm max-w-sm">
              Anda belum membuat Surat Jalan pengiriman. Klik tombol Buat Surat
              Jalan untuk mulai.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                <tr>
                  <th className="px-6 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={
                        data.length > 0 && selectedIds.length === data.length
                      }
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-[#0070bc] focus:ring-[#0070bc]/30 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4">No. Surat Jalan</th>
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4">Tujuan</th>
                  <th className="px-6 py-4">Jumlah Muatan</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => {
                  let parsedTujuan = item.tujuan;
                  try {
                    const t = JSON.parse(item.tujuan);
                    if (t.tujuan) {
                      parsedTujuan = `${t.tujuan}${t.kab_kota ? `, ${t.kab_kota}` : ""}`;
                    }
                  } catch (e) {}

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="w-4 h-4 rounded border-slate-300 text-[#0070bc] focus:ring-[#0070bc]/30 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800">
                          {item.no_surat_jalan}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-700">
                          {new Date(item.tanggal).toLocaleDateString("id-ID")}
                        </div>
                        <div className="text-xs text-slate-400">
                          {new Date(item.created_at).toLocaleTimeString(
                            "id-ID",
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {parsedTujuan}
                      </td>
                      <td className="px-6 py-4 font-bold text-[#0070bc]">
                        {item.surat_jalan_details[0]?.count || 0} Item
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            item.status === "DRAFT"
                              ? "bg-amber-100 text-amber-700"
                              : item.status === "DIKIRIM"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.status === "DRAFT" && (
                            <button
                              onClick={() => updateStatus(item.id, "DIKIRIM")}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors tooltip"
                              title="Tandai Dikirim"
                            >
                              <Truck className="w-4 h-4" />
                            </button>
                          )}
                          {item.status === "DIKIRIM" && (
                            <button
                              onClick={() => updateStatus(item.id, "SELESAI")}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors tooltip"
                              title="Tandai Selesai"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <Link
                            href={`/qc/surat-jalan/${item.id}/print`}
                            target="_blank"
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors tooltip"
                            title="Cetak PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ProductTour
        steps={QC_SURAT_JALAN_TOUR_STEPS}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />
    </div>
  );
}
