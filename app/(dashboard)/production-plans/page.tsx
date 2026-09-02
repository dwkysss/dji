"use client";

import { useState, useEffect } from "react";
import { getAllProductionPlans, deleteProductionPlan, upsertProductionPlan, getRecentPlansByMachine } from "@/actions/plan-actions";
import { getMachineConfigs } from "@/actions/machine-config-actions";
import { REGISTERED_MACHINES } from "@/lib/constants";
import { FileSpreadsheet, Plus, Edit, Trash2, RefreshCw, X, Save } from "lucide-react";

export default function ProductionPlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recentPlans, setRecentPlans] = useState<any[]>([]);
  const [machineConfigs, setMachineConfigs] = useState<Record<string, { default_pcs: number; input_type: "PANEL" | "METER" }>>({});

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  useEffect(() => {
    getMachineConfigs().then(res => {
      if (res.success && res.data) {
        const map: Record<string, { default_pcs: number; input_type: "PANEL" | "METER" }> = {};
        res.data.forEach(m => {
          map[m.nomor_mc.toUpperCase()] = { default_pcs: m.default_pcs, input_type: m.input_type };
        });
        setMachineConfigs(map);
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
    const mcKey = mc.toUpperCase();
    const detectedType = machineConfigs[mcKey]?.input_type || (mcKey.startsWith("R11") || mcKey.startsWith("R12") || mcKey.startsWith("R16") ? "METER" : "PANEL");
    const defaultPcs = machineConfigs[mcKey]?.default_pcs || 1;
    setFormData((prev: any) => ({
      ...prev,
      nomor_mc: mc,
      input_type: prev.id ? prev.input_type || detectedType : detectedType,
      pcs_count: prev.pcs_count || defaultPcs,
    }));
  };

  const handleOpenModal = (plan?: any) => {
    setErrorMsg(null);
    if (plan) {
      const mcKey = String(plan.nomor_mc || "").toUpperCase();
      const detectedType = plan.input_type || machineConfigs[mcKey]?.input_type || (mcKey.startsWith("R11") || mcKey.startsWith("R12") || mcKey.startsWith("R16") ? "METER" : "PANEL");
      setFormData({
        ...plan,
        input_type: detectedType,
        max_panel: plan.max_panel !== undefined && plan.max_panel !== null ? plan.max_panel : "",
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
        pcs_count: 1,
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
      const payload = { ...formData };
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
    <div className="p-4 sm:p-8 space-y-6 max-w-full overflow-hidden flex flex-col h-[calc(100vh-2rem)] min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 shrink-0 lg:flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0070bc] to-[#004777] flex items-center justify-center shadow-lg shadow-sky-200">
            <FileSpreadsheet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Jadwal Produksi</h1>
            <p className="text-sm font-semibold text-slate-500">Kelola spesifikasi header untuk operator</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Cari Mesin..."
            value={searchQuery}
            onChange={(e) => {
               setSearchQuery(e.target.value);
               setCurrentPage(1);
            }}
            className="h-10 px-4 rounded-xl border border-slate-200 focus:border-[#0070bc] outline-none text-sm w-32 sm:w-48"
          />
          <button 
            onClick={fetchPlans}
            disabled={loading}
            className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 p-2.5 rounded-xl transition-all shadow-sm"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-[#0070bc] hover:bg-[#005a96] text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Tambah Jadwal
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm relative">
        {loading && plans.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
            <RefreshCw className="w-8 h-8 text-[#0070bc] animate-spin mb-4" />
            <p className="font-bold text-slate-600 animate-pulse">Memuat jadwal...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-bold text-slate-400">Belum ada jadwal produksi.</p>
          </div>
        ) : null}

        <table className="w-full text-left border-collapse text-[11px] sm:text-xs whitespace-nowrap">
          <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-md shadow-[0_1px_2px_rgba(0,0,0,0.05)] z-20">
            <tr>
              <th className="px-3 py-2.5 font-bold text-slate-600 uppercase tracking-wider">Aksi</th>
              <th className="px-3 py-2.5 font-bold text-slate-600 uppercase tracking-wider">Mesin</th>
              <th className="px-3 py-2.5 font-bold text-slate-600 uppercase tracking-wider">Potongan</th>
              <th className="px-3 py-2.5 font-bold text-emerald-700 uppercase tracking-wider">Target Produksi</th>
              <th className="px-3 py-2.5 font-bold text-blue-600 uppercase tracking-wider">Jumlah PCS</th>
              <th className="px-3 py-2.5 font-bold text-slate-600 uppercase tracking-wider">Design</th>
              <th className="px-3 py-2.5 font-bold text-slate-600 uppercase tracking-wider">Pick</th>
              <th className="px-3 py-2.5 font-bold text-slate-600 uppercase tracking-wider">Course</th>
              <th className="px-3 py-2.5 font-bold text-slate-600 uppercase tracking-wider">No Order</th>
              <th className="px-3 py-2.5 font-bold text-slate-600 uppercase tracking-wider">Customer</th>
              <th className="px-3 py-2.5 font-bold text-slate-600 uppercase tracking-wider">RPM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {plans.map((p) => (
              <tr key={p.id} className="hover:bg-blue-50/50 transition-colors even:bg-slate-50/50 group">
                <td className="px-3 py-1.5 flex gap-1">
                  <button onClick={() => handleOpenModal(p)} className="p-1 text-blue-600 hover:bg-blue-100 rounded opacity-70 group-hover:opacity-100 transition-opacity">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1 text-red-600 hover:bg-red-100 rounded opacity-70 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="bg-slate-700 text-white px-2 py-0.5 rounded shadow-sm font-bold tracking-wide">{p.nomor_mc}</span>
                    {(() => {
                      const mcKey = String(p.nomor_mc || "").toUpperCase();
                      const isMeter = p.input_type === "METER" || machineConfigs[mcKey]?.input_type === "METER" || mcKey.startsWith("R11") || mcKey.startsWith("R12") || mcKey.startsWith("R16");
                      return isMeter ? (
                        <span className="text-[9px] font-black bg-teal-100 text-teal-800 border border-teal-300 px-1.5 py-0.5 rounded shadow-2xs">METER</span>
                      ) : (
                        <span className="text-[9px] font-black bg-sky-100 text-sky-800 border border-sky-300 px-1.5 py-0.5 rounded shadow-2xs">PANEL</span>
                      );
                    })()}
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-bold">{p.potongan_ke}</span>
                </td>
                <td className="px-3 py-1.5">
                  {(() => {
                    const mcKey = String(p.nomor_mc || "").toUpperCase();
                    const isMeter = p.input_type === "METER" || machineConfigs[mcKey]?.input_type === "METER" || mcKey.startsWith("R11") || mcKey.startsWith("R12") || mcKey.startsWith("R16");
                    const targetVal = p.target_meter || p.max_panel;
                    if (!targetVal) return <span className="text-slate-400 font-medium italic">-</span>;
                    return isMeter ? (
                      <span className="bg-teal-100 text-teal-800 border border-teal-200 px-2 py-0.5 rounded font-bold shadow-xs">
                        {targetVal} Meter
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold shadow-xs">
                        {targetVal} Panel
                      </span>
                    );
                  })()}
                </td>
                <td className="px-3 py-1.5">
                  <span className="bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-bold">{p.pcs_count || 1} PCS</span>
                </td>
                <td className="px-3 py-1.5 font-semibold text-slate-700">{p.design_id || "-"}</td>
                <td className="px-3 py-1.5 text-slate-600">{p.pick || "-"}</td>
                <td className="px-3 py-1.5 text-slate-600">{p.course || "-"}</td>
                <td className="px-3 py-1.5 text-slate-600">{p.no_order_barang || "-"}</td>
                <td className="px-3 py-1.5 text-slate-600">{p.no_customer || "-"}</td>
                <td className="px-3 py-1.5 text-slate-600">
                  {p.rpm ? <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">{p.rpm}</span> : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {plans.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
            <div className="text-xs font-semibold text-slate-600">
              Menampilkan {totalCount === 0 ? 0 : (currentPage - 1) * perPage + 1} - {Math.min(currentPage * perPage, totalCount)} dari {totalCount} Jadwal
            </div>
            <div className="flex items-center gap-2">
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-9 px-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold outline-none"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n} / halaman</option>
                ))}
              </select>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-xs font-bold disabled:opacity-50 hover:bg-slate-100 transition-colors"
              >
                Prev
              </button>
              <span className="text-xs font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-xs font-bold disabled:opacity-50 hover:bg-slate-100 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">
                {formData.id ? "Edit Jadwal Produksi" : "Tambah Jadwal Produksi"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl font-semibold">
                  {errorMsg}
                </div>
              )}
              
              {/* Jenis Inputan Badge & Switch */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800 uppercase">Jenis Inputan Mesin</span>
                  <span className="text-[11px] text-slate-500 font-medium">Format pelaporan produksi: Panel atau Meteran</span>
                </div>
                <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, input_type: "PANEL" })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${formData.input_type !== "METER" ? "bg-sky-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    PANEL
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, input_type: "METER" })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${formData.input_type === "METER" ? "bg-teal-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    METER
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Nomor Mesin *</label>
                  <select
                    required
                    value={formData.nomor_mc}
                    onChange={(e) => handleMachineChange(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none uppercase font-bold"
                  >
                    <option value="">-- Pilih --</option>
                    {REGISTERED_MACHINES.map(mc => (
                      <option key={mc} value={mc}>{mc}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Potongan Ke *</label>
                  <input
                    type="number"
                    required
                    value={formData.potongan_ke}
                    onChange={(e) => setFormData({ ...formData, potongan_ke: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-amber-600"
                    placeholder="Contoh: 550"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={`text-xs font-bold uppercase flex items-center justify-between ${formData.input_type === "METER" ? "text-teal-700" : "text-emerald-700"}`}>
                    <span>{formData.input_type === "METER" ? "Target Meter" : "Max Panel"}</span>
                    <span className="text-[10px] text-slate-400 font-normal lowercase">{formData.input_type === "METER" ? "meter" : "target"}</span>
                  </label>
                  <input
                    type="number"
                    value={formData.max_panel || ""}
                    onChange={(e) => setFormData({ ...formData, max_panel: e.target.value })}
                    className={`h-10 px-3 rounded-xl border outline-none font-bold ${formData.input_type === "METER" ? "border-teal-300 focus:border-teal-500 text-teal-800 bg-teal-50/40 placeholder:text-teal-300" : "border-emerald-300 focus:border-emerald-500 text-emerald-800 bg-emerald-50/40 placeholder:text-emerald-300"}`}
                    placeholder={formData.input_type === "METER" ? "Contoh: 250" : "Contoh: 50"}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-blue-700 uppercase flex items-center justify-between">
                    <span>Jumlah PCS</span>
                    <span className="text-[10px] text-slate-400 font-normal lowercase">1-6</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={formData.pcs_count || 1}
                    onChange={(e) => setFormData({ ...formData, pcs_count: parseInt(e.target.value) || 1 })}
                    className="h-10 px-3 rounded-xl border border-blue-300 focus:border-blue-500 outline-none font-bold text-blue-800 bg-blue-50/40"
                    placeholder="1"
                  />
                </div>
              </div>

              {recentPlans.length > 0 && (
                <div className="flex flex-col gap-1.5 bg-blue-50 p-3 rounded-xl border border-blue-100 mb-2">
                  <label className="text-xs font-bold text-blue-700 uppercase">Salin dari Riwayat (Opsional)</label>
                  <select
                    className="h-10 px-3 rounded-xl border border-blue-200 focus:border-blue-500 outline-none font-semibold text-blue-900 bg-white"
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
                  <label className="text-xs font-bold text-slate-600 uppercase">Design</label>
                  <input
                    type="text"
                    value={formData.design_id}
                    onChange={(e) => setFormData({ ...formData, design_id: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none uppercase"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">RPM</label>
                  <input
                    type="text"
                    value={formData.rpm}
                    onChange={(e) => setFormData({ ...formData, rpm: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none uppercase"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Pick</label>
                  <input
                    type="text"
                    value={formData.pick}
                    onChange={(e) => setFormData({ ...formData, pick: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none uppercase"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Course</label>
                  <input
                    type="text"
                    value={formData.course}
                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">No Order</label>
                  <input
                    type="text"
                    value={formData.no_order_barang}
                    onChange={(e) => setFormData({ ...formData, no_order_barang: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none uppercase"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">No Customer</label>
                  <input
                    type="text"
                    value={formData.no_customer}
                    onChange={(e) => setFormData({ ...formData, no_customer: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Benang Dasar</label>
                  <input
                    type="text"
                    value={formData.jenis_benang_dasar}
                    onChange={(e) => setFormData({ ...formData, jenis_benang_dasar: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none uppercase"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Liner</label>
                  <input
                    type="text"
                    value={formData.liner}
                    onChange={(e) => setFormData({ ...formData, liner: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none uppercase"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Heavy</label>
                  <input
                    type="text"
                    value={formData.heavy}
                    onChange={(e) => setFormData({ ...formData, heavy: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none uppercase"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Shadow</label>
                  <input
                    type="text"
                    value={formData.shadow}
                    onChange={(e) => setFormData({ ...formData, shadow: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none uppercase"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Pinggiran</label>
                  <input
                    type="text"
                    value={formData.pinggiran}
                    onChange={(e) => setFormData({ ...formData, pinggiran: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none uppercase"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-4 w-full py-3 bg-[#0070bc] hover:bg-[#005a96] text-white font-bold rounded-xl flex items-center justify-center gap-2"
              >
                {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Simpan Jadwal
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
