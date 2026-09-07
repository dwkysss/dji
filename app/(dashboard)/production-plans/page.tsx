"use client";

import { useState, useEffect } from "react";
import { getAllProductionPlans, deleteProductionPlan, upsertProductionPlan, getRecentPlansByMachine } from "@/actions/plan-actions";
import { getMachineConfigs, getAllMaxPanelConfigs } from "@/actions/machine-config-actions";
import { REGISTERED_MACHINES } from "@/lib/constants";
import { FileSpreadsheet, Plus, Edit, Trash2, RefreshCw, X, Save, Search } from "lucide-react";

export default function ProductionPlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recentPlans, setRecentPlans] = useState<any[]>([]);
  const [machineConfigs, setMachineConfigs] = useState<Record<string, { default_pcs: number; input_type: "PANEL" | "METER" }>>({});
  const [maxPanelConfigs, setMaxPanelConfigs] = useState<Record<string, number>>({});

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  useEffect(() => {
    // 1. Instantly read from localStorage for zero-delay responsiveness
    try {
      if (typeof window !== "undefined") {
        const cachedPcs = localStorage.getItem("dji_machine_configs");
        const cachedTypes = localStorage.getItem("dji_machine_input_types");
        if (cachedPcs) {
          const parsed = JSON.parse(cachedPcs);
          const parsedTypes = cachedTypes ? JSON.parse(cachedTypes) : {};
          const map: Record<string, { default_pcs: number; input_type: "PANEL" | "METER" }> = {};
          Object.keys(parsed).forEach((mc) => {
            const mcKey = mc.toUpperCase().trim();
            map[mcKey] = {
              default_pcs: Number(parsed[mc]) || 1,
              input_type: parsedTypes[mc] === "METER" ? "METER" : "PANEL",
            };
          });
          setMachineConfigs(map);
        }
      }
    } catch (e) {
      console.error("Error reading localStorage machine configs:", e);
    }

    // 2. Fetch fresh configs from database
    getMachineConfigs().then((res) => {
      if (res.success && res.data) {
        const map: Record<string, { default_pcs: number; input_type: "PANEL" | "METER" }> = {};
        res.data.forEach((m) => {
          map[m.nomor_mc.toUpperCase().trim()] = { default_pcs: m.default_pcs, input_type: m.input_type };
        });
        setMachineConfigs((prev) => ({ ...prev, ...map }));
      }
    });

    // 3. Fetch max panel configs from database
    getAllMaxPanelConfigs().then((res) => {
      if (res.success && res.data) {
        setMaxPanelConfigs(res.data);
      }
    });
  }, []);

  useEffect(() => {
    if (formData.nomor_mc && !formData.id) {
      getRecentPlansByMachine(formData.nomor_mc).then(res => {
        if (res.success && res.data) {
          setRecentPlans(res.data);
        } else {
          setRecentPlans([]);
        }
      });
    } else {
      setRecentPlans([]);
    }
  }, [formData.nomor_mc, formData.id]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await getAllProductionPlans(currentPage, perPage, searchQuery);
      if (res.success && res.data) {
        setPlans(res.data);
        setTotalCount(res.total || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [currentPage, perPage, searchQuery]);

  const handleMachineChange = (mc: string) => {
    const mcKey = mc.toUpperCase().trim();
    if (!mcKey) {
      setFormData((prev: any) => ({ ...prev, nomor_mc: "" }));
      return;
    }

    // 1. Check in state, then fallback to localStorage if needed
    let defaultPcs = machineConfigs[mcKey]?.default_pcs;
    let inputType = machineConfigs[mcKey]?.input_type;

    if ((defaultPcs === undefined || inputType === undefined) && typeof window !== "undefined") {
      try {
        const localPcs = JSON.parse(localStorage.getItem("dji_machine_configs") || "{}");
        const localTypes = JSON.parse(localStorage.getItem("dji_machine_input_types") || "{}");
        if (localPcs[mcKey] !== undefined) {
          defaultPcs = Number(localPcs[mcKey]);
        }
        if (localTypes[mcKey]) {
          inputType = localTypes[mcKey];
        }
      } catch (e) {
        console.error(e);
      }
    }

    const detectedType = inputType || (mcKey.startsWith("R11") || mcKey.startsWith("R12") || mcKey.startsWith("R16") ? "METER" : "PANEL");
    const finalDefaultPcs = defaultPcs !== undefined && defaultPcs !== null ? defaultPcs : 1;
    const defaultMaxPanel = maxPanelConfigs[mcKey] ?? maxPanelConfigs[`MAX_PANEL:${mcKey}`];

    setFormData((prev: any) => {
      const isNewPlan = !prev.id;
      const isDifferentMachine = prev.nomor_mc !== mc;

      return {
        ...prev,
        nomor_mc: mc,
        input_type: (isNewPlan || isDifferentMachine) ? detectedType : (prev.input_type || detectedType),
        pcs_count: (isNewPlan || isDifferentMachine) ? finalDefaultPcs : (prev.pcs_count ?? finalDefaultPcs),
        max_panel: (isNewPlan || isDifferentMachine)
          ? (detectedType === "METER" ? "" : (defaultMaxPanel !== undefined ? String(defaultMaxPanel) : ""))
          : prev.max_panel,
      };
    });
  };

  const handleOpenModal = (plan?: any) => {
    setErrorMsg(null);
    if (plan) {
      const mcKey = String(plan.nomor_mc || "").toUpperCase().trim();
      const cfg = machineConfigs[mcKey];
      const detectedType = plan.input_type || cfg?.input_type || (mcKey.startsWith("R11") || mcKey.startsWith("R12") || mcKey.startsWith("R16") ? "METER" : "PANEL");
      setFormData({
        ...plan,
        input_type: detectedType,
        max_panel: plan.max_panel !== undefined && plan.max_panel !== null ? plan.max_panel : "",
        pcs_count: plan.pcs_count || cfg?.default_pcs || 1,
      });
    } else {
      setFormData({
        nomor_mc: "",
        input_type: "PANEL",
        potongan_ke: "",
        max_panel: "",
        design_id: "",
        pick: "",
        course: "",
        no_order_barang: "",
        no_customer: "",
        jenis_benang_dasar: "",
        liner: "",
        heavy: "",
        shadow: "",
        pinggiran: "",
        rpm: "",
        pcs_count: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nomor_mc || !formData.potongan_ke) {
      setErrorMsg("Nomor Mesin dan Potongan Ke harus diisi.");
      return;
    }
    
    setSaving(true);
    setErrorMsg(null);
    try {
      // Force uppercase for relevant fields as a good practice
      const payload = {
        ...formData,
        pcs_count: Number(formData.pcs_count) || 1,
      };
      const strFields = ["design_id", "pick", "course", "no_order_barang", "no_customer", "jenis_benang_dasar", "liner", "heavy", "shadow", "pinggiran", "rpm"];
      strFields.forEach(f => {
        if (typeof payload[f] === "string") {
          payload[f] = payload[f].toUpperCase();
        }
      });
      
      const res = await upsertProductionPlan(payload);
      if (res.success) {
        setIsModalOpen(false);
        fetchPlans();
      } else {
        setErrorMsg(res.error || "Gagal menyimpan jadwal.");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Yakin ingin menghapus jadwal ini?")) {
      try {
        const res = await deleteProductionPlan(id);
        if (res.success) {
          fetchPlans();
        } else {
          alert("Gagal menghapus: " + res.error);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto pb-20 p-4 sm:p-6 lg:p-8 animate-fadeIn flex flex-col min-w-0 space-y-6">
      {/* Integrated Header Card */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200/80 relative">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-6 right-6 h-[3px] bg-gradient-to-r from-sky-400 via-[#0070bc] to-indigo-500 rounded-full opacity-80" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Title & Info */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#0070bc] via-sky-600 to-blue-700 text-white flex items-center justify-center shadow-lg shadow-[#0070bc]/25 shrink-0 ring-4 ring-sky-50 transition-transform duration-300 hover:scale-105">
              <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  Jadwal Produksi
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-50 text-[#0070bc] border border-sky-200/80 uppercase tracking-wider">
                  {totalCount} Jadwal
                </span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">
                Kelola spesifikasi header untuk operator
              </p>
            </div>
          </div>

          {/* Controls: Search, Refresh, Tambah Jadwal */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Search Input with icon */}
            <div className="relative flex-1 sm:flex-initial">
              <input
                type="text"
                placeholder="Cari Mesin..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 pl-9 pr-4 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none text-xs sm:text-sm font-semibold text-slate-700 placeholder:text-slate-400 w-full sm:w-52 transition-all shadow-2xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchPlans}
              disabled={loading}
              className="h-10 w-10 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-600 border border-slate-200 rounded-xl transition-all flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-50 shadow-2xs"
              title="Muat Ulang Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#0070bc]" : ""}`} />
            </button>

            {/* Tambah Jadwal Button */}
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#0070bc] to-[#005a96] hover:from-[#005a96] hover:to-[#004777] active:scale-95 text-white font-extrabold text-xs shadow-md shadow-[#0070bc]/25 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Tambah Jadwal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Card (Putih-Biru Theme) */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200/80 overflow-hidden relative">
        {loading && plans.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center bg-white/80">
            <RefreshCw className="w-8 h-8 text-[#0070bc] animate-spin mb-4" />
            <p className="font-bold text-slate-600 animate-pulse text-sm">Memuat jadwal produksi...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-sky-50 text-[#0070bc] rounded-2xl flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-8 h-8 stroke-[1.8]" />
            </div>
            <p className="font-extrabold text-slate-700 text-sm">Belum ada jadwal produksi</p>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Klik tombol &quot;+ Tambah Jadwal&quot; untuk membuat jadwal baru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-[11px] sm:text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[10px] font-black text-slate-600 uppercase tracking-wider">
                  <th className="px-3.5 py-3 text-center w-16">Aksi</th>
                  <th className="px-3.5 py-3">Mesin</th>
                  <th className="px-3.5 py-3">Potongan</th>
                  <th className="px-3.5 py-3">Target Produksi</th>
                  <th className="px-3.5 py-3">Jumlah PCS</th>
                  <th className="px-3.5 py-3">Design</th>
                  <th className="px-3.5 py-3">Pick</th>
                  <th className="px-3.5 py-3">Course</th>
                  <th className="px-3.5 py-3">No Order</th>
                  <th className="px-3.5 py-3">Customer</th>
                  <th className="px-3.5 py-3 text-center">RPM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {plans.map((p) => {
                  const mcKey = String(p.nomor_mc || "").toUpperCase();
                  const isMeter = p.input_type === "METER" || machineConfigs[mcKey]?.input_type === "METER" || mcKey.startsWith("R11") || mcKey.startsWith("R12") || mcKey.startsWith("R16");
                  const targetVal = p.target_meter || p.max_panel;

                  return (
                    <tr key={p.id} className="hover:bg-sky-50/40 transition-colors group">
                      {/* Action buttons */}
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenModal(p)}
                            className="p-1.5 text-[#0070bc] hover:bg-sky-100/70 rounded-lg transition-colors cursor-pointer"
                            title="Edit Jadwal"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Jadwal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Mesin & Jenis Badge */}
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-sky-50 text-[#0070bc] border border-sky-200/80 px-2 py-0.5 rounded-lg font-black text-xs shadow-2xs">
                            {p.nomor_mc}
                          </span>
                          {isMeter ? (
                            <span className="text-[9px] font-black bg-sky-100/70 text-[#0070bc] border border-sky-200 px-1.5 py-0.5 rounded-md tracking-wider">
                              METER
                            </span>
                          ) : (
                            <span className="text-[9px] font-black bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-md tracking-wider">
                              PANEL
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Potongan Ke */}
                      <td className="px-3.5 py-2.5">
                        <span className="bg-slate-100 text-slate-800 border border-slate-200/80 px-2.5 py-0.5 rounded-lg font-black text-xs">
                          {p.potongan_ke}
                        </span>
                      </td>

                      {/* Target Produksi */}
                      <td className="px-3.5 py-2.5">
                        {targetVal ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg font-black text-xs bg-sky-50 text-[#0070bc] border border-sky-200/70">
                            {targetVal} {isMeter ? "Meter" : "Panel"}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-medium">-</span>
                        )}
                      </td>

                      {/* Jumlah PCS */}
                      <td className="px-3.5 py-2.5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg font-black text-xs bg-blue-50 text-[#0070bc] border border-blue-200/70">
                          {p.pcs_count || 1} PCS
                        </span>
                      </td>

                      {/* Design */}
                      <td className="px-3.5 py-2.5 font-bold text-slate-800">{p.design_id || "-"}</td>

                      {/* Pick */}
                      <td className="px-3.5 py-2.5 text-slate-600">{p.pick || "-"}</td>

                      {/* Course */}
                      <td className="px-3.5 py-2.5 text-slate-600">{p.course || "-"}</td>

                      {/* No Order */}
                      <td className="px-3.5 py-2.5 text-slate-600">{p.no_order_barang || "-"}</td>

                      {/* Customer */}
                      <td className="px-3.5 py-2.5 text-slate-600">{p.no_customer || "-"}</td>

                      {/* RPM */}
                      <td className="px-3.5 py-2.5 text-center">
                        {p.rpm ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg font-black text-xs bg-sky-50 text-[#0070bc] border border-sky-200/70">
                            {p.rpm}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {plans.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50/60">
            <div className="text-xs font-semibold text-slate-500">
              Menampilkan <span className="font-black text-slate-700">{totalCount === 0 ? 0 : (currentPage - 1) * perPage + 1}</span> - <span className="font-black text-slate-700">{Math.min(currentPage * perPage, totalCount)}</span> dari <span className="font-black text-[#0070bc]">{totalCount}</span> Jadwal
            </div>
            <div className="flex items-center gap-2">
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-9 px-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-xs font-bold text-slate-700 outline-none cursor-pointer shadow-2xs"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n} / halaman</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-9 px-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-xs font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
              >
                Prev
              </button>
              <span className="px-2.5 py-1 rounded-xl bg-sky-50 text-[#0070bc] border border-sky-200/80 text-xs font-black">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-9 px-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-xs font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0070bc] text-white flex items-center justify-center shadow-sm">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-800">
                    {formData.id ? "Edit Jadwal Produksi" : "Tambah Jadwal Produksi"}
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">Atur data dan target spesifikasi header mesin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 text-rose-600 border border-rose-200 text-xs rounded-xl font-bold">
                  {errorMsg}
                </div>
              )}
              
              {/* Jenis Inputan Badge & Switch */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide">Jenis Inputan Mesin</span>
                  <span className="text-[11px] text-slate-500 font-medium">Format pelaporan produksi: Panel atau Meteran</span>
                </div>
                <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, input_type: "PANEL" })}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${formData.input_type !== "METER" ? "bg-[#0070bc] text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    PANEL
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, input_type: "METER" })}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${formData.input_type === "METER" ? "bg-[#0070bc] text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    METER
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Nomor Mesin *</label>
                  <select
                    required
                    value={formData.nomor_mc}
                    onChange={(e) => handleMachineChange(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none uppercase font-black text-slate-800 text-xs shadow-2xs"
                  >
                    <option value="">-- Pilih --</option>
                    {REGISTERED_MACHINES.map(mc => (
                      <option key={mc} value={mc}>{mc}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Potongan Ke *</label>
                  <input
                    type="number"
                    required
                    value={formData.potongan_ke}
                    onChange={(e) => setFormData({ ...formData, potongan_ke: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none font-black text-[#0070bc] text-xs shadow-2xs"
                    placeholder="Contoh: 550"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                    <span>{formData.input_type === "METER" ? "Target Meter" : "Max Panel"}</span>
                    <span className="text-[10px] text-slate-400 font-normal lowercase">{formData.input_type === "METER" ? "meter" : "target"}</span>
                  </label>
                  <input
                    type="number"
                    value={formData.max_panel || ""}
                    onChange={(e) => setFormData({ ...formData, max_panel: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none font-black text-[#0070bc] text-xs shadow-2xs"
                    placeholder={formData.input_type === "METER" ? "Contoh: 250" : "Contoh: 50"}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                    <span>Jumlah PCS</span>
                    <span className="text-[10px] text-slate-400 font-normal lowercase">1-6</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={formData.pcs_count !== undefined && formData.pcs_count !== null ? formData.pcs_count : ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : parseInt(e.target.value);
                      setFormData({ ...formData, pcs_count: val });
                    }}
                    className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none font-black text-[#0070bc] text-xs shadow-2xs"
                    placeholder="1"
                  />
                </div>
              </div>

              {recentPlans.length > 0 && (
                <div className="flex flex-col gap-1.5 bg-sky-50/50 p-3 rounded-xl border border-sky-100 mb-2">
                  <label className="text-[11px] font-black text-[#0070bc] uppercase tracking-wider">Salin dari Riwayat (Opsional)</label>
                  <select
                    className="h-10 px-3 rounded-xl border border-sky-200 focus:border-[#0070bc] outline-none font-bold text-slate-800 text-xs bg-white shadow-2xs"
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const selected = recentPlans.find(p => p.id === e.target.value);
                      if (selected) {
                        setFormData({
                          ...formData,
                          design_id: selected.design_id || "",
                          pick: selected.pick || "",
                          course: selected.course || "",
                          no_order_barang: selected.no_order_barang || "",
                          no_customer: selected.no_customer || "",
                          jenis_benang_dasar: selected.jenis_benang_dasar || "",
                          liner: selected.liner || "",
                          heavy: selected.heavy || "",
                          shadow: selected.shadow || "",
                          pinggiran: selected.pinggiran || "",
                          rpm: selected.rpm || "",
                        });
                      }
                      e.target.value = "";
                    }}
                  >
                    <option value="">-- Pilih Riwayat (Otomatis salin data) --</option>
                    {recentPlans.map(rp => (
                      <option key={rp.id} value={rp.id}>
                        Potongan {rp.potongan_ke} | Design: {rp.design_id || "-"} | Order: {rp.no_order_barang || "-"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Design</label>
                  <input
                    type="text"
                    value={formData.design_id}
                    onChange={(e) => setFormData({ ...formData, design_id: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none uppercase font-semibold text-slate-800 text-xs shadow-2xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">RPM</label>
                  <input
                    type="text"
                    value={formData.rpm}
                    onChange={(e) => setFormData({ ...formData, rpm: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none uppercase font-semibold text-slate-800 text-xs shadow-2xs"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Pick</label>
                  <input
                    type="text"
                    value={formData.pick}
                    onChange={(e) => setFormData({ ...formData, pick: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none uppercase font-semibold text-slate-800 text-xs shadow-2xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Course</label>
                  <input
                    type="text"
                    value={formData.course}
                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none uppercase font-semibold text-slate-800 text-xs shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">No Order</label>
                  <input
                    type="text"
                    value={formData.no_order_barang}
                    onChange={(e) => setFormData({ ...formData, no_order_barang: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none uppercase font-semibold text-slate-800 text-xs shadow-2xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">No Customer</label>
                  <input
                    type="text"
                    value={formData.no_customer}
                    onChange={(e) => setFormData({ ...formData, no_customer: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none uppercase font-semibold text-slate-800 text-xs shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Benang Dasar</label>
                  <input
                    type="text"
                    value={formData.jenis_benang_dasar}
                    onChange={(e) => setFormData({ ...formData, jenis_benang_dasar: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none uppercase font-semibold text-slate-800 text-xs shadow-2xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Liner</label>
                  <input
                    type="text"
                    value={formData.liner}
                    onChange={(e) => setFormData({ ...formData, liner: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none uppercase font-semibold text-slate-800 text-xs shadow-2xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Heavy</label>
                  <input
                    type="text"
                    value={formData.heavy}
                    onChange={(e) => setFormData({ ...formData, heavy: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none uppercase font-semibold text-slate-800 text-xs shadow-2xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Shadow</label>
                  <input
                    type="text"
                    value={formData.shadow}
                    onChange={(e) => setFormData({ ...formData, shadow: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none uppercase font-semibold text-slate-800 text-xs shadow-2xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Pinggiran</label>
                  <input
                    type="text"
                    value={formData.pinggiran}
                    onChange={(e) => setFormData({ ...formData, pinggiran: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-500/10 focus:bg-white bg-slate-50/70 outline-none uppercase font-semibold text-slate-800 text-xs shadow-2xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-4 w-full py-3 bg-gradient-to-r from-[#0070bc] to-[#005a96] hover:from-[#005a96] hover:to-[#004777] active:scale-[0.98] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-[#0070bc]/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Simpan Jadwal</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
