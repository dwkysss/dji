"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getProblemCategories,
  createProblemCategory,
  updateProblemCategory,
  deleteProblemCategory,
  getProblemDetailsGrouped,
  createProblemDetail,
  updateProblemDetail,
  deleteProblemDetail,
  ProblemCategoryItem,
  ProblemDetailItem,
} from "@/actions/problem-detail-actions";
import {
  ListFilter,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Layers,
  Settings2,
  FolderPlus,
} from "lucide-react";

const FALLBACK_CATEGORIES: ProblemCategoryItem[] = [
  { kode: "A", label: "Benang Timbul/Lolos", description: "Masalah terkait benang timbul, benang lolos, & corak", color: "from-amber-500 to-orange-600" },
  { kode: "B", label: "Jarum/Jacquard", description: "Kerusakan jarum, modul, tali jacquard & komputasi", color: "from-rose-500 to-pink-600" },
  { kode: "C", label: "Design/Proofing", description: "Setting corak, ganti design, PCB & artikel", color: "from-sky-500 to-blue-600" },
  { kode: "D", label: "Benang Dasar/Rewind", description: "Penggantian benang dasar & pattern keseluruhan", color: "from-emerald-500 to-teal-600" },
  { kode: "E", label: "Servo/Elektrik", description: "Inverter, PLC, sensor & instalasi kelistrikan", color: "from-purple-500 to-violet-600" },
  { kode: "F", label: "Cylinder/Mekanik", description: "Gearbox, cylinder, bearing, rem & pelumasan", color: "from-indigo-500 to-blue-700" },
  { kode: "G", label: "Lain-lain/Libur", description: "Ganggauan utilitas eksternal, libur & instruksi", color: "from-slate-500 to-zinc-600" },
  { kode: "H", label: "Mekanik Direct", description: "Perbaikan langsung oleh tim mekanik", color: "from-amber-600 to-yellow-600" },
];

export default function ProblemDetailsPage() {
  const [categoriesList, setCategoriesList] = useState<ProblemCategoryItem[]>(FALLBACK_CATEGORIES);
  const [rawList, setRawList] = useState<ProblemDetailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("A");
  const [searchQuery, setSearchQuery] = useState("");

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isDeleteCatModalOpen, setIsDeleteCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProblemCategoryItem | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ProblemCategoryItem | null>(null);
  const [catFormKode, setCatFormKode] = useState("");
  const [catFormLabel, setCatFormLabel] = useState("");
  const [catFormDesc, setCatFormDesc] = useState("");

  // Detail Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProblemDetailItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ProblemDetailItem | null>(null);

  // Form State
  const [formKategori, setFormKategori] = useState("A");
  const [formNamaDetail, setFormNamaDetail] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, detRes] = await Promise.all([
        getProblemCategories(),
        getProblemDetailsGrouped(),
      ]);

      if (catRes.success && catRes.categories && catRes.categories.length > 0) {
        setCategoriesList(catRes.categories);
      }
      if (detRes.success && detRes.rawList) {
        setRawList(detRes.rawList);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const total = rawList.length;
    const active = rawList.filter((i) => i.is_active).length;
    const inactive = total - active;

    const countByCat: Record<string, number> = {};
    categoriesList.forEach((c) => (countByCat[c.kode] = 0));
    rawList.forEach((i) => {
      if (countByCat[i.kategori] !== undefined) {
        countByCat[i.kategori]++;
      } else {
        countByCat[i.kategori] = 1;
      }
    });

    return { total, active, inactive, countByCat };
  }, [rawList, categoriesList]);

  // Filtered items by category & search query
  const filteredItems = useMemo(() => {
    return rawList.filter((item) => {
      const matchCat = item.kategori === activeCategory;
      const matchQuery =
        !searchQuery.trim() ||
        item.nama_detail.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [rawList, activeCategory, searchQuery]);

  // Category Actions Handlers
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCatFormKode("");
    setCatFormLabel("");
    setCatFormDesc("");
    setErrorMsg("");
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: ProblemCategoryItem) => {
    setEditingCategory(cat);
    setCatFormKode(cat.kode);
    setCatFormLabel(cat.label);
    setCatFormDesc(cat.description || "");
    setErrorMsg("");
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    let res;
    if (editingCategory) {
      res = await updateProblemCategory(editingCategory.kode, {
        label: catFormLabel,
        description: catFormDesc,
      });
    } else {
      res = await createProblemCategory({
        kode: catFormKode,
        label: catFormLabel,
        description: catFormDesc,
      });
    }

    setSubmitting(false);
    if (res.success) {
      setIsCategoryModalOpen(false);
      fetchData();
    } else {
      setErrorMsg(res.error || "Gagal menyimpan kategori");
    }
  };

  const handleOpenDeleteCategory = (cat: ProblemCategoryItem) => {
    setDeletingCategory(cat);
    setErrorMsg("");
    setIsDeleteCatModalOpen(true);
  };

  const handleConfirmDeleteCategory = async (cascade: boolean = false) => {
    if (!deletingCategory) return;
    setSubmitting(true);
    setErrorMsg("");
    const res = await deleteProblemCategory(deletingCategory.kode, cascade);
    setSubmitting(false);

    if (res.success) {
      setIsDeleteCatModalOpen(false);
      const deletedKode = deletingCategory.kode;
      setDeletingCategory(null);
      if (activeCategory === deletedKode && categoriesList.length > 1) {
        setActiveCategory(categoriesList.find((c) => c.kode !== deletedKode)?.kode || "A");
      }
      fetchData();
    } else {
      setErrorMsg(res.error || "Gagal menghapus kategori");
    }
  };

  // Detail Actions Handlers
  const handleOpenAdd = (cat?: string) => {
    setFormKategori(cat || activeCategory);
    setFormNamaDetail("");
    setFormIsActive(true);
    setErrorMsg("");
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (item: ProblemDetailItem) => {
    setEditingItem(item);
    setFormKategori(item.kategori);
    setFormNamaDetail(item.nama_detail);
    setFormIsActive(item.is_active);
    setErrorMsg("");
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (item: ProblemDetailItem) => {
    setDeletingItem(item);
    setErrorMsg("");
    setIsDeleteModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNamaDetail.trim()) {
      setErrorMsg("Nama detail masalah tidak boleh kosong!");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    const res = await createProblemDetail({
      kategori: formKategori,
      nama_detail: formNamaDetail,
    });

    setSubmitting(false);
    if (res.success) {
      setIsAddModalOpen(false);
      fetchData();
    } else {
      setErrorMsg(res.error || "Gagal membuat detail masalah");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!formNamaDetail.trim()) {
      setErrorMsg("Nama detail masalah tidak boleh kosong!");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    const res = await updateProblemDetail(editingItem.id, {
      nama_detail: formNamaDetail,
      is_active: formIsActive,
    });

    setSubmitting(false);
    if (res.success) {
      setIsEditModalOpen(false);
      setEditingItem(null);
      fetchData();
    } else {
      setErrorMsg(res.error || "Gagal memperbarui detail masalah");
    }
  };

  const handleToggleActive = async (item: ProblemDetailItem) => {
    const res = await updateProblemDetail(item.id, {
      is_active: !item.is_active,
    });
    if (res.success) {
      fetchData();
    } else {
      alert("Gagal mengubah status: " + res.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-200 shrink-0">
            <ListFilter className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Master Detail & Kategori Masalah
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 uppercase tracking-wide">
                Master Data
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-500 mt-0.5">
              Kelola kategori & opsi pilihan detail masalah untuk form operator & dashboard Pareto
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleOpenAddCategory}
            className="px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-amber-400" />
            + Kategori Baru
          </button>
          <button
            onClick={() => handleOpenAdd()}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-xs shadow-md shadow-amber-200 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Tambah Detail Masalah
          </button>
        </div>
      </div>

      {/* OVERVIEW STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
              Total Opsi Masalah
            </span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">
              {stats.total} <span className="text-xs font-semibold text-slate-400">item</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider block">
              Status Aktif
            </span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">
              {stats.active} <span className="text-xs font-semibold text-slate-400">item</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold text-rose-500 uppercase tracking-wider block">
              Non-Aktif
            </span>
            <span className="text-2xl font-black text-rose-500 mt-1 block">
              {stats.inactive} <span className="text-xs font-semibold text-slate-400">item</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center font-bold">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* CATEGORY TABS & SEARCH */}
      <div className="bg-white rounded-[28px] border border-slate-200 p-6 shadow-sm space-y-6">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
          {categoriesList.map((catItem) => {
            const isActive = activeCategory === catItem.kode;
            const count = stats.countByCat[catItem.kode] || 0;

            return (
              <button
                key={catItem.kode}
                onClick={() => setActiveCategory(catItem.kode)}
                className={`px-4 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2.5 whitespace-nowrap cursor-pointer border ${
                  isActive
                    ? "bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02]"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center ${
                    isActive ? "bg-amber-400 text-slate-950" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {catItem.kode}
                </span>
                <span>{catItem.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isActive ? "bg-slate-800 text-amber-300" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Category Header Card */}
        {(() => {
          const currentCat = categoriesList.find((c) => c.kode === activeCategory) || {
            kode: activeCategory,
            label: `Kategori ${activeCategory}`,
            description: "Deskripsi kategori",
            color: "from-amber-500 to-orange-600",
          };

          return (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-r ${currentCat.color || "from-amber-500 to-orange-600"} text-white font-black text-lg flex items-center justify-center shrink-0 shadow-xs`}
                >
                  {activeCategory}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-800 text-sm">
                      Kategori [{activeCategory}] {currentCat.label}
                    </h3>
                    <button
                      onClick={() => handleOpenEditCategory(currentCat)}
                      className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      title="Edit Nama & Deskripsi Kategori"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenDeleteCategory(currentCat)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Hapus Kategori Ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {currentCat.description}
                  </p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Cari detail Kategori ${activeCategory}...`}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          );
        })()}

        {/* ITEMS LIST TABLE */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-slate-400 font-bold text-sm flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
              <span>Memuat data detail masalah...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-bold text-sm flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8 text-slate-300" />
              <span>
                {searchQuery
                  ? "Tidak ada detail masalah yang cocok dengan pencarian"
                  : `Belum ada detail masalah untuk Kategori ${activeCategory}`}
              </span>
              <button
                onClick={() => handleOpenAdd(activeCategory)}
                className="mt-2 text-xs font-black text-amber-600 hover:underline cursor-pointer"
              >
                + Tambah Detail Pertama Sekarang
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600">
                  <th className="py-3 px-4 font-black">No</th>
                  <th className="py-3 px-4 font-black">Nama Detail Masalah</th>
                  <th className="py-3 px-4 font-black">Kategori</th>
                  <th className="py-3 px-4 font-black text-center">Status</th>
                  <th className="py-3 px-4 font-black text-right sticky right-0 bg-slate-100/90 backdrop-blur-xs z-10">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="hover:bg-amber-50/40 transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-800 text-sm">
                      {item.nama_detail}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-500">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-black text-[11px]">
                        [{item.kategori}]
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleActive(item)}
                        className={`px-3 py-1 rounded-full text-[11px] font-black transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                          item.is_active
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-rose-100 text-rose-800 hover:bg-rose-200"
                        }`}
                      >
                        {item.is_active ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Aktif
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Non-Aktif
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right sticky right-0 bg-white group-hover:bg-amber-50/90 transition-colors z-10">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="Edit Detail Masalah"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleOpenDelete(item)}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="Hapus Detail Masalah"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL: TAMBAH / EDIT KATEGORI */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[28px] border border-slate-200 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 font-black flex items-center justify-center">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    {editingCategory ? `Edit Kategori [${editingCategory.kode}]` : "Tambah Kategori Baru"}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Atur kode, label, dan deskripsi kategori utama
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 font-bold"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Kode Kategori (Misal: A, B, I, J)
                </label>
                <input
                  type="text"
                  value={catFormKode}
                  onChange={(e) => setCatFormKode(e.target.value.toUpperCase())}
                  disabled={!!editingCategory}
                  placeholder="I"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 uppercase disabled:bg-slate-100"
                  autoFocus={!editingCategory}
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Label Kategori
                </label>
                <input
                  type="text"
                  value={catFormLabel}
                  onChange={(e) => setCatFormLabel(e.target.value)}
                  placeholder="Contoh: Pengujian Kualitas..."
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Deskripsi Kategori (Opsional)
                </label>
                <textarea
                  value={catFormDesc}
                  onChange={(e) => setCatFormDesc(e.target.value)}
                  placeholder="Deskripsi singkat masalah..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Simpan Kategori
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH DETAIL MASALAH */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[28px] border border-slate-200 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white font-black flex items-center justify-center">
                  <Plus className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    Tambah Detail Masalah
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Opsi baru untuk Kategori {formKategori}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 font-bold"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Kategori
                </label>
                <select
                  value={formKategori}
                  onChange={(e) => setFormKategori(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
                >
                  {categoriesList.map((c) => (
                    <option key={c.kode} value={c.kode}>
                      [{c.kode}] {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Nama Detail Masalah
                </label>
                <input
                  type="text"
                  value={formNamaDetail}
                  onChange={(e) => setFormNamaDetail(e.target.value)}
                  placeholder="Contoh: Jarum patah blok A..."
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-black shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 stroke-[3]" />
                  )}
                  Simpan Detail
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT DETAIL MASALAH */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[28px] border border-slate-200 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500 text-white font-black flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    Edit Detail Masalah
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Kategori [{editingItem.kategori}]
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 font-bold"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Nama Detail Masalah
                </label>
                <input
                  type="text"
                  value={formNamaDetail}
                  onChange={(e) => setFormNamaDetail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-extrabold text-slate-700">
                  Status Aktif
                </span>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI HAPUS DETAIL MASALAH */}
      {isDeleteModalOpen && deletingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[28px] border border-slate-200 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800">
                Hapus Detail Masalah?
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Apakah Anda yakin ingin menghapus detail masalah{" "}
                <span className="font-extrabold text-slate-800 underline decoration-rose-400">
                  "{deletingItem.nama_detail}"
                </span>{" "}
                dari Kategori [{deletingItem.kategori}]? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-left flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingItem(null);
                }}
                className="px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold transition-all active:scale-95 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  setErrorMsg("");
                  const res = await deleteProblemDetail(deletingItem.id);
                  setSubmitting(false);
                  if (res.success) {
                    setIsDeleteModalOpen(false);
                    setDeletingItem(null);
                    fetchData();
                  } else {
                    setErrorMsg(res.error || "Gagal menghapus detail masalah");
                  }
                }}
                className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-200 transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 stroke-[2.5]" />
                )}
                Ya, Hapus Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI HAPUS KATEGORI */}
      {isDeleteCatModalOpen && deletingCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[28px] border border-slate-200 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800">
                Hapus Kategori [{deletingCategory.kode}]?
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Apakah Anda yakin ingin menghapus Kategori{" "}
                <span className="font-extrabold text-slate-800 underline decoration-rose-400">
                  "{deletingCategory.label}"
                </span>
                ?
              </p>
              {stats.countByCat[deletingCategory.kode] > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold text-left flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Kategori ini masih memiliki <strong>{stats.countByCat[deletingCategory.kode]} detail masalah</strong>. Memilih hapus akan ikut menghapus semua detail di dalamnya.
                  </span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-left flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleConfirmDeleteCategory(true)}
                className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-200 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 stroke-[2.5]" />
                )}
                {stats.countByCat[deletingCategory.kode] > 0
                  ? `Hapus Kategori & ${stats.countByCat[deletingCategory.kode]} Detail Masalah`
                  : "Ya, Hapus Kategori Sekarang"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDeleteCatModalOpen(false);
                  setDeletingCategory(null);
                }}
                className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold transition-all active:scale-95 cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
