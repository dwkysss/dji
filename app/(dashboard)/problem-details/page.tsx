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
  saveProblemGroupMapping,
  getProblemGroupMapping,
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
  Tag,
  ArrowRightLeft,
  X,
  Folder,
  ChevronUp,
  ChevronDown,
  Check,
} from "lucide-react";
import { GROUPED_PROBLEM_DETAILS } from "@/lib/constants";

const FALLBACK_CATEGORIES: ProblemCategoryItem[] = [
  { kode: "A", label: "Masalah dan Perbaikan Benang", description: "Masalah terkait benang dasar, benang timbul, & perbaikan benang", color: "from-amber-500 to-orange-600" },
  { kode: "B", label: "Perbaikan Jarum dan Element Rajutan (Mechanical)", description: "Kerusakan jarum, modul, tali jacquard & komputasi", color: "from-rose-500 to-pink-600" },
  { kode: "C", label: "Pengaturan dan Design stup", description: "Setting corak, ganti design, PCB & artikel", color: "from-sky-500 to-blue-600" },
  { kode: "D", label: "Bahan Baku dan penggantian Benang", description: "Penggantian benang dasar & pattern keseluruhan", color: "from-emerald-500 to-teal-600" },
  { kode: "E", label: "Masalah Kelistrikan", description: "Inverter, PLC, sensor & instalasi kelistrikan", color: "from-purple-500 to-violet-600" },
  { kode: "F", label: "Perawatan Mesin,Perbaikan Mekanik (maintenance)", description: "Gearbox, cylinder, bearing, rem & pelumasan", color: "from-indigo-500 to-blue-700" },
  { kode: "G", label: "Faktor Eksternal dan Non-Teknis", description: "Ganggauan utilitas eksternal, libur & instruksi", color: "from-slate-500 to-zinc-600" },
  { kode: "H", label: "Mekanik Direct", description: "Perbaikan langsung oleh tim mekanik", color: "from-amber-600 to-yellow-600" },
];

export default function ProblemDetailsPage() {
  const [categoriesList, setCategoriesList] = useState<ProblemCategoryItem[]>(FALLBACK_CATEGORIES);
  const [rawList, setRawList] = useState<ProblemDetailItem[]>([]);
  const [groupMapping, setGroupMapping] = useState<Record<string, { groupName: string; items: string[] }[]>>({});
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

  // Group Management Modal State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroupIdx, setEditingGroupIdx] = useState<number | null>(null);
  const [groupFormName, setGroupFormName] = useState("");
  const [newGroupNameInput, setNewGroupNameInput] = useState("");

  // Inline Banner Group Editing State
  const [inlineEditingGroup, setInlineEditingGroup] = useState<string | null>(null);
  const [inlineGroupNewName, setInlineGroupNewName] = useState("");

  // Group Delete & Reset Confirmation Modal States
  const [deletingGroupInfo, setDeletingGroupInfo] = useState<{ groupName: string; count: number } | null>(null);
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);

  // Form State
  const [formKategori, setFormKategori] = useState("A");
  const [formNamaDetail, setFormNamaDetail] = useState("");
  const [formSubKategori, setFormSubKategori] = useState("");
  const [customSubKatInput, setCustomSubKatInput] = useState("");
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
      if (detRes.success) {
        if (detRes.rawList) setRawList(detRes.rawList);
        if (detRes.groupMapping) setGroupMapping(detRes.groupMapping);
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

  // Current Category Groups
  const currentCategoryGroups = useMemo(() => {
    return groupMapping[activeCategory] || [];
  }, [groupMapping, activeCategory]);

  // Filtered items by category & search query
  const filteredItems = useMemo(() => {
    return rawList.filter((item) => {
      const matchCat = item.kategori === activeCategory;
      const matchQuery =
        !searchQuery.trim() ||
        item.nama_detail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.sub_kategori || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [rawList, activeCategory, searchQuery]);

  // Items organized by group for current category
  const itemsByGroup = useMemo(() => {
    const groupsMap = new Map<string, ProblemDetailItem[]>();

    // 1. Initialize with predefined groups in order
    currentCategoryGroups.forEach((g) => {
      groupsMap.set(g.groupName, []);
    });

    // 2. Add "Lain-lain / Tambahan" group container if needed
    if (!groupsMap.has("Lain-lain / Tambahan")) {
      groupsMap.set("Lain-lain / Tambahan", []);
    }

    // 3. Place filtered items into groups
    filteredItems.forEach((item) => {
      const groupName = item.sub_kategori || "Lain-lain / Tambahan";
      if (!groupsMap.has(groupName)) {
        groupsMap.set(groupName, []);
      }
      groupsMap.get(groupName)!.push(item);
    });

    // 4. Convert to array of { groupName, items }
    const result: { groupName: string; items: ProblemDetailItem[] }[] = [];
    groupsMap.forEach((items, groupName) => {
      // If searching, only include groups that have matching items
      if (searchQuery.trim() && items.length === 0) return;
      result.push({ groupName, items });
    });

    return result;
  }, [filteredItems, currentCategoryGroups, searchQuery]);

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
  const handleOpenAdd = (cat?: string, defaultGroup?: string) => {
    const targetCat = cat || activeCategory;
    setFormKategori(targetCat);
    setFormNamaDetail("");
    const catGroups = groupMapping[targetCat] || [];
    setFormSubKategori(defaultGroup || (catGroups.length > 0 ? catGroups[0].groupName : "Umum"));
    setCustomSubKatInput("");
    setFormIsActive(true);
    setErrorMsg("");
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (item: ProblemDetailItem) => {
    setEditingItem(item);
    setFormKategori(item.kategori);
    setFormNamaDetail(item.nama_detail);
    setFormSubKategori(item.sub_kategori || "");
    setCustomSubKatInput("");
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

    const effectiveSubKat = formSubKategori === "__NEW__" ? customSubKatInput.trim() : formSubKategori;

    setSubmitting(true);
    setErrorMsg("");
    const res = await createProblemDetail({
      kategori: formKategori,
      nama_detail: formNamaDetail,
      sub_kategori: effectiveSubKat || "Umum",
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

    const effectiveSubKat = formSubKategori === "__NEW__" ? customSubKatInput.trim() : formSubKategori;

    setSubmitting(true);
    setErrorMsg("");
    const res = await updateProblemDetail(editingItem.id, {
      nama_detail: formNamaDetail,
      is_active: formIsActive,
      sub_kategori: effectiveSubKat,
      kategori: editingItem.kategori,
      old_nama_detail: editingItem.nama_detail,
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

  // Group Management Handlers
  const handleOpenManageGroups = () => {
    setNewGroupNameInput("");
    setEditingGroupIdx(null);
    setGroupFormName("");
    setErrorMsg("");
    setIsGroupModalOpen(true);
  };

  const handleAddNewGroup = async () => {
    if (!newGroupNameInput.trim()) return;
    const name = newGroupNameInput.trim();
    const updated = { ...groupMapping };
    if (!updated[activeCategory]) updated[activeCategory] = [];

    if (updated[activeCategory].some((g) => g.groupName.toLowerCase() === name.toLowerCase())) {
      setErrorMsg(`Kelompok "${name}" sudah ada!`);
      return;
    }

    updated[activeCategory].push({ groupName: name, items: [] });
    setGroupMapping(updated);
    setNewGroupNameInput("");
    setErrorMsg("");

    await saveProblemGroupMapping(updated);
  };

  const handleRenameGroup = async (idx: number) => {
    if (!groupFormName.trim()) return;
    const newName = groupFormName.trim();
    const updated = { ...groupMapping };
    const currentGroups = updated[activeCategory] || [];
    if (!currentGroups[idx]) return;

    currentGroups[idx].groupName = newName;
    setGroupMapping(updated);
    setEditingGroupIdx(null);
    setGroupFormName("");

    await saveProblemGroupMapping(updated);
    fetchData();
  };

  const handleDeleteGroup = async (idx: number) => {
    const updated = { ...groupMapping };
    const currentGroups = updated[activeCategory] || [];
    if (!currentGroups[idx]) return;

    const groupToDelete = currentGroups[idx];
    if (groupToDelete.items.length > 0) {
      // Move items to "Lain-lain / Tambahan"
      let fallbackGroup = currentGroups.find((g, i) => i !== idx && g.groupName.toLowerCase().includes("lain"));
      if (!fallbackGroup) {
        fallbackGroup = { groupName: "Lain-lain / Tambahan", items: [] };
        currentGroups.push(fallbackGroup);
      }
      fallbackGroup.items.push(...groupToDelete.items);
    }

    currentGroups.splice(idx, 1);
    setGroupMapping(updated);
    await saveProblemGroupMapping(updated);
    fetchData();
  };

  // Direct Inline CRUD for Banner Headers
  const handleStartInlineEditGroup = (oldName: string) => {
    setInlineEditingGroup(oldName);
    setInlineGroupNewName(oldName);
  };

  const handleSaveInlineEditGroup = async (oldName: string) => {
    if (!inlineGroupNewName.trim() || inlineGroupNewName.trim() === oldName) {
      setInlineEditingGroup(null);
      return;
    }
    const newName = inlineGroupNewName.trim();
    const updated = { ...groupMapping };
    const currentGroups = updated[activeCategory] || [];
    const targetGroup = currentGroups.find((g) => g.groupName === oldName);

    if (targetGroup) {
      targetGroup.groupName = newName;
      setGroupMapping(updated);
      setInlineEditingGroup(null);
      await saveProblemGroupMapping(updated);
      fetchData();
    } else {
      // If it was Lain-lain / Tambahan fallback, create the group with new name
      const fallbackItems = itemsByGroup.find((g) => g.groupName === oldName)?.items.map((i) => i.nama_detail) || [];
      currentGroups.push({ groupName: newName, items: fallbackItems });
      updated[activeCategory] = currentGroups;
      setGroupMapping(updated);
      setInlineEditingGroup(null);
      await saveProblemGroupMapping(updated);
      fetchData();
    }
  };

  const handleOpenDeleteGroupModal = (groupName: string) => {
    const targetGroup = itemsByGroup.find((g) => g.groupName === groupName);
    const count = targetGroup ? targetGroup.items.length : 0;
    setDeletingGroupInfo({ groupName, count });
    setErrorMsg("");
  };

  const handleConfirmDeleteGroup = async () => {
    if (!deletingGroupInfo) return;
    setSubmitting(true);
    setErrorMsg("");

    const groupName = deletingGroupInfo.groupName;
    const updated = { ...groupMapping };
    const currentGroups = updated[activeCategory] || [];
    const idx = currentGroups.findIndex((g) => g.groupName === groupName);

    if (idx !== -1) {
      const groupToDelete = currentGroups[idx];
      if (groupToDelete.items.length > 0) {
        let fallbackGroup = currentGroups.find(
          (g, i) => i !== idx && (g.groupName.toLowerCase().includes("lain") || g.groupName.toLowerCase().includes("umum"))
        );
        if (!fallbackGroup) {
          fallbackGroup = { groupName: "Lain-lain / Tambahan", items: [] };
          currentGroups.push(fallbackGroup);
        }
        fallbackGroup.items.push(...groupToDelete.items);
      }
      currentGroups.splice(idx, 1);
      setGroupMapping(updated);
      await saveProblemGroupMapping(updated);
    }

    setSubmitting(false);
    setDeletingGroupInfo(null);
    fetchData();
  };

  const handleConfirmResetGroups = async () => {
    setSubmitting(true);
    const updated = { ...groupMapping };
    updated[activeCategory] = JSON.parse(JSON.stringify(GROUPED_PROBLEM_DETAILS[activeCategory] || []));
    setGroupMapping(updated);
    await saveProblemGroupMapping(updated);
    setSubmitting(false);
    setIsResetConfirmModalOpen(false);
    fetchData();
  };

  const handleMoveGroupPosition = async (groupName: string, direction: "up" | "down") => {
    const updated = { ...groupMapping };
    const currentGroups = [...(updated[activeCategory] || [])];
    const idx = currentGroups.findIndex((g) => g.groupName === groupName);
    if (idx === -1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentGroups.length) return;

    const temp = currentGroups[idx];
    currentGroups[idx] = currentGroups[targetIdx];
    currentGroups[targetIdx] = temp;

    updated[activeCategory] = currentGroups;
    setGroupMapping(updated);
    await saveProblemGroupMapping(updated);
    fetchData();
  };

  const handleQuickMoveItem = async (item: ProblemDetailItem, targetGroupName: string) => {
    if (!targetGroupName || item.sub_kategori === targetGroupName) return;

    const updated = { ...groupMapping };
    const currentGroups = updated[activeCategory] || [];

    // Remove from old group
    currentGroups.forEach((g) => {
      g.items = g.items.filter((name) => name !== item.nama_detail);
    });

    // Add to target group
    let targetGroup = currentGroups.find((g) => g.groupName === targetGroupName);
    if (!targetGroup) {
      targetGroup = { groupName: targetGroupName, items: [] };
      currentGroups.push(targetGroup);
    }
    if (!targetGroup.items.includes(item.nama_detail)) {
      targetGroup.items.push(item.nama_detail);
    }

    setGroupMapping(updated);
    await saveProblemGroupMapping(updated);
    fetchData();
  };

  return (
    <div className="space-y-6 pb-20 font-sans">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-200 shrink-0">
            <ListFilter className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Master Detail & Kelompok Masalah
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 uppercase tracking-wide">
                Master Data
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-500 mt-0.5">
              Atur kategori, kelompok header (sub-kategori), dan opsi detail masalah untuk form operator, QC, & Mending
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
            onClick={handleOpenManageGroups}
            className="px-4 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs shadow-md shadow-sky-200 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Layers className="w-4 h-4 text-sky-200" />
            Kelola Kelompok (Header)
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
            className="px-5 py-3 rounded-2xl bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-xs shadow-md shadow-amber-200 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
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
                  className={`w-10 h-10 rounded-xl bg-linear-to-r ${currentCat.color || "from-amber-500 to-orange-600"} text-white font-black text-lg flex items-center justify-center shrink-0 shadow-xs`}
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
                      className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                      title="Edit Nama & Deskripsi Kategori"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenDeleteCategory(currentCat)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Hapus Kategori Ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {currentCat.description || "Tidak ada deskripsi"}
                  </p>
                </div>
              </div>

              {/* Search Bar & Manage Groups shortcut */}
              <div className="flex items-center gap-2">
                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Cari detail / sub-kategori Kategori ${activeCategory}...`}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <button
                  onClick={handleOpenManageGroups}
                  className="px-3.5 py-2 rounded-xl bg-white border border-sky-200 hover:bg-sky-50 text-sky-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
                  title="Atur Kelompok Sub-Kategori"
                >
                  <Layers className="w-3.5 h-3.5 text-sky-600" />
                  <span>Atur Kelompok</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* ITEMS LIST ORGANIZED BY GROUP HEADERS */}
        <div className="space-y-6">
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
            itemsByGroup.map((groupObj, gIdx) => {
              if (groupObj.items.length === 0 && searchQuery.trim()) return null;

              return (
                <div key={gIdx} className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  {/* Group Header Banner with Direct CRUD */}
                  <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    {inlineEditingGroup === groupObj.groupName ? (
                      <div className="flex items-center gap-2 flex-1 max-w-md animate-in fade-in-50">
                        <input
                          type="text"
                          value={inlineGroupNewName}
                          onChange={(e) => setInlineGroupNewName(e.target.value)}
                          className="px-3 py-1.5 bg-white border border-sky-400 rounded-lg text-xs font-bold text-slate-800 focus:outline-none flex-1 shadow-inner"
                          autoFocus
                          placeholder="Nama kelompok header..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveInlineEditGroup(groupObj.groupName);
                            } else if (e.key === "Escape") {
                              setInlineEditingGroup(null);
                            }
                          }}
                        />
                        <button
                          onClick={() => handleSaveInlineEditGroup(groupObj.groupName)}
                          className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Simpan</span>
                        </button>
                        <button
                          onClick={() => setInlineEditingGroup(null)}
                          className="px-2 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-bold cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 font-black text-xs uppercase tracking-wider border border-sky-200 shadow-2xs">
                          {groupObj.groupName}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">
                          ({groupObj.items.length} detail masalah)
                        </span>

                        <div className="flex items-center gap-0.5 ml-1 bg-white/80 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                          <button
                            onClick={() => handleStartInlineEditGroup(groupObj.groupName)}
                            className="p-1 rounded-md text-slate-500 hover:text-sky-700 hover:bg-sky-50 transition-colors cursor-pointer"
                            title="Ubah Nama Kelompok Header Ini"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveGroupPosition(groupObj.groupName, "up")}
                            disabled={gIdx === 0}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            title="Pindah Urutan ke Atas"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveGroupPosition(groupObj.groupName, "down")}
                            disabled={gIdx === itemsByGroup.length - 1}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            title="Pindah Urutan ke Bawah"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteGroupModal(groupObj.groupName)}
                            className="p-1 rounded-md text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus Kelompok Header Ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenAdd(activeCategory, groupObj.groupName)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                        title="Tambah item ke kelompok ini"
                      >
                        <Plus className="w-3 h-3 text-amber-600" />
                        Tambah ke Kelompok Ini
                      </button>
                    </div>
                  </div>

                  {/* Group Table */}
                  <div className="overflow-x-auto">
                    {groupObj.items.length === 0 ? (
                      <div className="p-4 text-center text-xs font-semibold text-slate-400 italic bg-white">
                        Belum ada item di dalam kelompok ini. Klik "Tambah ke Kelompok Ini" untuk menambahkan.
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse text-xs bg-white">
                        <thead>
                          <tr className="border-b border-slate-150 bg-slate-50/60 text-slate-500 text-[11px]">
                            <th className="py-2.5 px-4 font-extrabold w-12 text-center">No</th>
                            <th className="py-2.5 px-4 font-extrabold">Nama Detail Masalah</th>
                            <th className="py-2.5 px-4 font-extrabold">Kategori</th>
                            <th className="py-2.5 px-4 font-extrabold">Kelompok Header (Pindah Cepat)</th>
                            <th className="py-2.5 px-4 font-extrabold text-center">Status</th>
                            <th className="py-2.5 px-4 font-extrabold text-right sticky right-0 bg-slate-50/90 z-10">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {groupObj.items.map((item, idx) => (
                            <tr
                              key={item.id}
                              className="hover:bg-amber-50/30 transition-colors group"
                            >
                              <td className="py-3 px-4 font-bold text-slate-400 text-center">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-4 font-extrabold text-slate-800 text-sm">
                                {item.nama_detail}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-500">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-black text-[11px]">
                                  [{item.kategori}]
                                </span>
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-600">
                                <select
                                  value={item.sub_kategori || groupObj.groupName}
                                  onChange={(e) => handleQuickMoveItem(item, e.target.value)}
                                  className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-bold cursor-pointer hover:bg-sky-100 transition-colors focus:ring-2 focus:ring-sky-500 shadow-2xs"
                                  title="Pindahkan detail masalah ke kelompok lain"
                                >
                                  {currentCategoryGroups.map((g, i) => (
                                    <option key={i} value={g.groupName}>
                                      📁 {g.groupName}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => handleToggleActive(item)}
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black transition-all cursor-pointer inline-flex items-center gap-1.5 ${
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
                              <td className="py-3 px-4 text-right sticky right-0 bg-white group-hover:bg-amber-50/90 transition-colors z-10">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenEdit(item)}
                                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                                    title="Edit Detail Masalah"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleOpenDelete(item)}
                                    className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
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
              );
            })
          )}
        </div>
      </div>

      {/* MODAL: KELOLA KELOMPOK (SUB-KATEGORI HEADER) */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[28px] border border-slate-200 p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white font-black flex items-center justify-center shadow-md shadow-sky-200">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    Kelola Kelompok Header [Kategori {activeCategory}]
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Tambah, ubah nama, atau hapus kelompok header sub-kategori
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGroupModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 font-bold cursor-pointer"
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

            {/* Input Tambah Group Baru */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-700">
                + Tambah Kelompok Header Baru
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGroupNameInput}
                  onChange={(e) => setNewGroupNameInput(e.target.value)}
                  placeholder="Contoh: Area Jarum & Jacquard..."
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddNewGroup();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddNewGroup}
                  disabled={!newGroupNameInput.trim()}
                  className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Tambah
                </button>
              </div>
            </div>

            {/* Daftar Kelompok yang Ada */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                Daftar Kelompok Aktif ({currentCategoryGroups.length})
              </label>
              <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                {currentCategoryGroups.length === 0 ? (
                  <div className="p-4 text-center text-xs font-medium text-slate-400 italic bg-slate-50 rounded-xl">
                    Belum ada kelompok khusus. Semua item berada di kelompok standar.
                  </div>
                ) : (
                  currentCategoryGroups.map((g, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                    >
                      {editingGroupIdx === idx ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={groupFormName}
                            onChange={(e) => setGroupFormName(e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white border border-sky-400 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleRenameGroup(idx);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleRenameGroup(idx)}
                            className="px-3 py-1.5 bg-sky-600 text-white text-[11px] font-bold rounded-lg hover:bg-sky-700"
                          >
                            Simpan
                          </button>
                          <button
                            onClick={() => setEditingGroupIdx(null)}
                            className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-[11px]"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-1">
                            <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 text-xs font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <span className="font-extrabold text-slate-800 text-xs block">
                                {g.groupName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold block">
                                {g.items.length} item detail masalah
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingGroupIdx(idx);
                                setGroupFormName(g.groupName);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                              title="Ubah Nama Kelompok"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenDeleteGroupModal(g.groupName)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                              title="Hapus Kelompok"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsResetConfirmModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset ke Kelompok Standar
              </button>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 font-bold cursor-pointer"
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
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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
                    Opsi baru untuk Kategori [{formKategori}]
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 font-bold cursor-pointer"
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
                  onChange={(e) => {
                    const newCat = e.target.value;
                    setFormKategori(newCat);
                    const catGroups = groupMapping[newCat] || [];
                    if (catGroups.length > 0) {
                      setFormSubKategori(catGroups[0].groupName);
                    }
                  }}
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
                  Kelompok Header (Sub-Kategori)
                </label>
                <select
                  value={formSubKategori}
                  onChange={(e) => setFormSubKategori(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500"
                >
                  {(groupMapping[formKategori] || []).map((g, i) => (
                    <option key={i} value={g.groupName}>
                      {g.groupName}
                    </option>
                  ))}
                  <option value="__NEW__">+ Buat Kelompok Header Baru...</option>
                </select>
              </div>

              {formSubKategori === "__NEW__" && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block text-xs font-extrabold text-sky-700 mb-1">
                    Nama Kelompok Header Baru
                  </label>
                  <input
                    type="text"
                    value={customSubKatInput}
                    onChange={(e) => setCustomSubKatInput(e.target.value)}
                    placeholder="Ketik nama kelompok baru..."
                    className="w-full px-4 py-2.5 bg-sky-50 border border-sky-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500"
                    autoFocus
                  />
                </div>
              )}

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
                  autoFocus={formSubKategori !== "__NEW__"}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-linear-to-r from-amber-500 to-orange-600 text-white text-xs font-black shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 font-bold cursor-pointer"
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

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Kelompok Header (Sub-Kategori)
                </label>
                <select
                  value={formSubKategori}
                  onChange={(e) => setFormSubKategori(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500"
                >
                  {(groupMapping[editingItem.kategori] || []).map((g, i) => (
                    <option key={i} value={g.groupName}>
                      {g.groupName}
                    </option>
                  ))}
                  <option value="__NEW__">+ Pindahkan ke Kelompok Baru...</option>
                </select>
              </div>

              {formSubKategori === "__NEW__" && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block text-xs font-extrabold text-sky-700 mb-1">
                    Nama Kelompok Header Baru
                  </label>
                  <input
                    type="text"
                    value={customSubKatInput}
                    onChange={(e) => setCustomSubKatInput(e.target.value)}
                    placeholder="Ketik nama kelompok baru..."
                    className="w-full px-4 py-2.5 bg-sky-50 border border-sky-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500"
                    autoFocus
                  />
                </div>
              )}

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
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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
                  const res = await deleteProblemDetail(deletingItem.id, deletingItem.nama_detail, deletingItem.kategori);
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

      {/* MODAL: KONFIRMASI HAPUS KELOMPOK HEADER */}
      {deletingGroupInfo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[28px] border border-slate-200 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800">
                Hapus Kelompok Header?
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Apakah Anda yakin ingin menghapus kelompok header{" "}
                <span className="font-extrabold text-slate-800 underline decoration-rose-400">
                  "{deletingGroupInfo.groupName}"
                </span>
                ?
              </p>
              {deletingGroupInfo.count > 0 ? (
                <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold text-left flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-sky-600" />
                  <span className="leading-relaxed">
                    Terdapat <strong>{deletingGroupInfo.count} detail masalah</strong> di dalam kelompok ini. Item-item tersebut <strong>tidak akan terhapus</strong>, melainkan otomatis dialihkan ke kelompok <em>Lain-lain / Tambahan</em>.
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 font-medium italic">
                  Kelompok ini sedang kosong.
                </p>
              )}
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
                onClick={() => setDeletingGroupInfo(null)}
                className="px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold transition-all active:scale-95 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDeleteGroup}
                className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-200 transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 stroke-[2.5]" />
                )}
                Ya, Hapus Kelompok
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI RESET KELOMPOK STANDAR */}
      {isResetConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[28px] border border-slate-200 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mx-auto shadow-inner">
              <RefreshCw className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800">
                Reset ke Kelompok Standar?
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Apakah Anda yakin ingin mengembalikan struktur susunan kelompok header untuk <strong>Kategori [{activeCategory}]</strong> ke susunan standar bawaan sistem?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmModalOpen(false)}
                className="px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold transition-all active:scale-95 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmResetGroups}
                className="px-6 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black shadow-md shadow-sky-200 transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                )}
                Ya, Reset Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
