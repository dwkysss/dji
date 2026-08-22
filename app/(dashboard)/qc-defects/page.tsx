"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getAllQCDefectsAdmin,
  createQCDefect,
  updateQCDefect,
  deleteQCDefect,
  QCDefectItem,
} from "@/actions/qc-defect-actions";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Tag,
  Scissors,
  CheckSquare,
  Sparkles,
  Layers,
  HelpCircle,
} from "lucide-react";

const DEFAULT_CATEGORIES = [
  "Semua",
  "Benang",
  "Corak & Rajutan",
  "Jarum & Benang",
  "Kebersihan & Noda",
  "Finishing & Pinggiran",
  "Umum",
];

export default function QCDefectsAdminPage() {
  const [defects, setDefects] = useState<QCDefectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<QCDefectItem | null>(null);

  // Form States
  const [formNama, setFormNama] = useState("");
  const [formKategori, setFormKategori] = useState("Benang");
  const [formKeterangan, setFormKeterangan] = useState("");
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await getAllQCDefectsAdmin();
      if (res.success) {
        setDefects(res.data);
      } else {
        setErrorMsg(res.error || "Gagal memuat data master cacat QC");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered List
  const filteredDefects = useMemo(() => {
    return defects.filter((item) => {
      const matchSearch =
        item.nama_cacat.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.kategori && item.kategori.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.keterangan && item.keterangan.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCategory =
        selectedCategory === "Semua" || item.kategori === selectedCategory;

      return matchSearch && matchCategory;
    });
  }, [defects, searchQuery, selectedCategory]);

  // Categories available in existing data
  const dynamicCategories = useMemo(() => {
    const cats = new Set<string>(["Semua"]);
    defects.forEach((d) => {
      if (d.kategori) cats.add(d.kategori);
    });
    return Array.from(cats);
  }, [defects]);

  // Stats
  const stats = useMemo(() => {
    const total = defects.length;
    const active = defects.filter((d) => d.is_active).length;
    const inactive = total - active;
    const categoriesCount = new Set(defects.map((d) => d.kategori)).size;
    return { total, active, inactive, categoriesCount };
  }, [defects]);

  const handleOpenAdd = () => {
    setFormNama("");
    setFormKategori("Benang");
    setFormKeterangan("");
    setFormSortOrder(defects.length + 1);
    setFormIsActive(true);
    setErrorMsg("");
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (item: QCDefectItem) => {
    setSelectedItem(item);
    setFormNama(item.nama_cacat);
    setFormKategori(item.kategori || "Umum");
    setFormKeterangan(item.keterangan || "");
    setFormSortOrder(item.sort_order || 0);
    setFormIsActive(item.is_active);
    setErrorMsg("");
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (item: QCDefectItem) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };

  const handleToggleActive = async (item: QCDefectItem) => {
    try {
      const nextStatus = !item.is_active;
      // Optimistic update
      setDefects((prev) =>
        prev.map((d) => (d.id === item.id ? { ...d, is_active: nextStatus } : d))
      );
      const res = await updateQCDefect(item.id, { is_active: nextStatus });
      if (!res.success) {
        fetchData();
      }
    } catch (e) {
      fetchData();
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim()) {
      setErrorMsg("Nama cacat tidak boleh kosong");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await createQCDefect({
        nama_cacat: formNama.trim(),
        kategori: formKategori.trim(),
        keterangan: formKeterangan.trim(),
        sort_order: formSortOrder,
      });

      if (res.success) {
        setIsAddModalOpen(false);
        fetchData();
      } else {
        setErrorMsg(res.error || "Gagal menambahkan cacat");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan sistem");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !formNama.trim()) {
      setErrorMsg("Nama cacat tidak boleh kosong");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await updateQCDefect(selectedItem.id, {
        nama_cacat: formNama.trim(),
        kategori: formKategori.trim(),
        keterangan: formKeterangan.trim(),
        sort_order: formSortOrder,
        is_active: formIsActive,
      });

      if (res.success) {
        setIsEditModalOpen(false);
        fetchData();
      } else {
        setErrorMsg(res.error || "Gagal mengubah cacat");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan sistem");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      const res = await deleteQCDefect(selectedItem.id);
      if (res.success) {
        setIsDeleteModalOpen(false);
        fetchData();
      } else {
        setErrorMsg(res.error || "Gagal menghapus cacat");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan sistem");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0070bc] to-sky-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-sky-900/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Master Data Khusus QC & Mending</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Master Cacat QC & Mending
          </h1>
          <p className="text-sky-100 text-xs sm:text-sm mt-1 max-w-xl font-medium">
            Kelola daftar temuan cacat kain khusus untuk bagian Inspeksi (QC) dan Mending. Pilihan ini terpisah dari opsi masalah teknis operator mesin.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-3 bg-white/10 hover:bg-white/20 active:scale-95 rounded-2xl transition-all cursor-pointer text-white backdrop-blur-xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex-1 md:flex-initial px-5 py-3 bg-white text-[#0070bc] hover:bg-sky-50 font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-sky-950/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Cacat Baru</span>
          </button>
        </div>

        {/* Decorative background circle */}
        <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Cacat</span>
            <Tag className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-800">{stats.total}</p>
          <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">
            Item terdaftar di master
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Aktif</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600">{stats.active}</p>
          <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">
            Tampil di modal QC/Mending
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Nonaktif</span>
            <XCircle className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-600">{stats.inactive}</p>
          <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">
            Disembunyikan sementara
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Kategori</span>
            <Layers className="w-4 h-4" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-purple-600">{stats.categoriesCount}</p>
          <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">
            Kelompok jenis cacat
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Controls Bar: Search & Category Pills */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari cacat atau kategori..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9.5 pr-4 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            <span className="text-xs font-bold text-slate-500 self-end sm:self-auto">
              Menampilkan <span className="text-slate-900">{filteredDefects.length}</span> dari {defects.length} cacat
            </span>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {dynamicCategories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#0070bc] text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100/60"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Defects Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center w-16">No</th>
                <th className="py-3.5 px-4">Nama Temuan Cacat</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4">Keterangan</th>
                <th className="py-3.5 px-4 text-center w-28">Status</th>
                <th className="py-3.5 px-4 text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0070bc]" />
                    <span className="font-medium">Memuat master cacat...</span>
                  </td>
                </tr>
              ) : filteredDefects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700">Tidak ada cacat yang cocok</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Coba ganti kata kunci pencarian atau kategori filter
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDefects.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Urutan */}
                    <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                      {idx + 1}
                    </td>

                    {/* Nama Cacat */}
                    <td className="py-3.5 px-4 font-black text-slate-800">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            item.is_active ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                        />
                        <span className="text-slate-900">{item.nama_cacat}</span>
                      </div>
                    </td>

                    {/* Kategori Badge */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-bold">
                        <Tag className="w-3 h-3 text-sky-500" />
                        {item.kategori || "Umum"}
                      </span>
                    </td>

                    {/* Keterangan */}
                    <td className="py-3.5 px-4 text-slate-500 font-medium max-w-xs truncate">
                      {item.keterangan || "-"}
                    </td>

                    {/* Toggle Status Aktif */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleActive(item)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                          item.is_active
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                        title="Klik untuk mengubah status"
                      >
                        {item.is_active ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Aktif</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                            <span>Nonaktif</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#0070bc] hover:bg-sky-50 transition-all cursor-pointer"
                          title="Edit Cacat"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                          title="Hapus Cacat"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Cacat */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-gradient-to-r from-[#0070bc] to-sky-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white backdrop-blur-xs">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">Tambah Cacat QC & Mending</h3>
                  <p className="text-xs text-sky-100 font-medium">
                    Master pilihan temuan baru untuk inspeksi
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Temuan Cacat <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: L1 Putus, Bolong Corak, dll."
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kategori
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Benang, Corak & Rajutan, Kebersihan..."
                  value={formKategori}
                  onChange={(e) => setFormKategori(e.target.value)}
                  list="category-suggestions"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
                <datalist id="category-suggestions">
                  <option value="Benang" />
                  <option value="Corak & Rajutan" />
                  <option value="Jarum & Benang" />
                  <option value="Kebersihan & Noda" />
                  <option value="Finishing & Pinggiran" />
                  <option value="Umum" />
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Keterangan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Deskripsi singkat mengenai jenis cacat..."
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#0070bc] hover:bg-sky-700 active:scale-95 text-white font-bold text-xs transition-all shadow-md shadow-[#0070bc]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Menyimpan..." : "Simpan Cacat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Cacat */}
      {isEditModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white backdrop-blur-xs">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">Edit Master Cacat</h3>
                  <p className="text-xs text-slate-300 font-medium">
                    Ubah rincian atau status cacat
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Temuan Cacat <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kategori
                </label>
                <input
                  type="text"
                  value={formKategori}
                  onChange={(e) => setFormKategori(e.target.value)}
                  list="category-suggestions"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Keterangan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_active_toggle"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-[#0070bc] rounded-md focus:ring-sky-500 cursor-pointer"
                />
                <label
                  htmlFor="is_active_toggle"
                  className="text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Status Aktif (Ditampilkan di form QC & Mending)
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs transition-all shadow-md shadow-slate-900/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {isDeleteModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4 text-rose-600">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Hapus Cacat Ini?
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Apakah Anda yakin ingin menghapus master cacat{" "}
              <strong className="text-slate-800 font-black">
                &ldquo;{selectedItem.nama_cacat}&rdquo;
              </strong>
              ? Data cacat yang telah diinput sebelumnya di riwayat tidak akan terhapus.
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={submitting}
                className="flex-1 h-10 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={submitting}
                className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
