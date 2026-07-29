"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getMachineConfigs,
  upsertAllMachineConfigs,
  getBlockRequiredDefects,
  saveBlockRequiredDefects,
  MachineConfig,
} from "@/actions/machine-config-actions";
import {
  getProblemCategories,
  getProblemDetailsGrouped,
  ProblemCategoryItem,
} from "@/actions/problem-detail-actions";
import {
  SlidersHorizontal,
  Cpu,
  Box,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Check,
} from "lucide-react";

const FALLBACK_CATEGORIES: Record<string, { desc: string; items: string[] }> = {
  A: {
    desc: "Masalah & Perbaikan Benang",
    items: [
      "L1 Benang timbul putus",
      "L2 Benang timbul putus",
      "L3 Benang timbul putus",
      "Benang lolos",
      "Bolong corak",
      "Benang narik/Kendor",
      "Benang Nyilang",
      "Perbaikan/Beset benang Dasar",
      "Benang Kejepit/Jebol/Kusut",
      "Jalur benang",
    ],
  },
  B: {
    desc: "Perbaikan Jarum & Element Rajutan (Mechanical)",
    items: [
      "Jarum pattern patah/bengkok",
      "Ganti Jacquard",
      "Ganti jarum Compoun Nedle, pattern",
      "Ngampul",
      "Ganti dari scaloop ke non scaloop atau sebaliknya",
      "Ngegaris/Stopline",
      "Keluar Jarum",
      "Ganti String bar",
      "Ganti PBO",
      "Pressan As beam kendor",
      "Tensi tensioner",
    ],
  },
  C: {
    desc: "Pengaturan & Design setup",
    items: [
      "Loading design/Ganti Design",
      "Perbaikan corak/revisi",
      "Salah ganti design",
      "Error design",
      "Proofing/PCB",
      "Ganti Pattern Disk",
      "Ganti pick",
    ],
  },
  D: {
    desc: "Bahan Baku & Penggantian Benang",
    items: [
      "Ganti benang dasar L1/L2",
      "Salah ganti benang dasar",
      "Ganti benang Pattern Linner",
      "Ganti benang Pattern Heavy",
      "Ganti benang Pattern Shadow",
      "Ganti benang pattern keseluruhan (L,H,S)",
      "salah ganti benang pattern",
      "Ngelancarin",
    ],
  },
  E: {
    desc: "Masalah Kelistrikan",
    items: [
      "Error Servo Drive",
      "Ganti motor servo",
      "Sensor Benang/Laser Stop",
      "Perbaikan Eletrik lainnya",
      "Konsleting",
      "Perbaikan listrik",
    ],
  },
  F: {
    desc: "Perawatan Mesin, Perbaikan Mekanik (Maintenance)",
    items: [
      "Perbaikan cilynder Angin",
      "Ganti Bellow",
      "Blower tidak jalan / Rusak",
      "Service mekanik rutin",
      "Perbaikan mekanik lainnya",
    ],
  },
  G: {
    desc: "Faktor Eksternal & Non-Teknis",
    items: [
      "Lampu mati / Genset",
      "Angin kompresor habis / Tekanan drop",
      "Lain-lain non teknis",
    ],
  },
};

export default function MachineConfigPage() {
  const [configs, setConfigs] = useState<MachineConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"MACHINES" | "BLOCK_REQUIRED">("MACHINES");
  const [searchQuery, setSearchQuery] = useState("");

  // Required block defects list
  const [requiredBlockDefects, setRequiredBlockDefects] = useState<string[]>([]);
  // Dynamic categories & details map
  const [categoriesMap, setCategoriesMap] = useState<Record<string, { desc: string; items: string[] }>>(FALLBACK_CATEGORIES);

  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Machine Configs
      const cfgRes = await getMachineConfigs();
      if (cfgRes.success && cfgRes.data) {
        setConfigs(cfgRes.data);
      }

      // 2. Fetch Master Categories & Details to build dynamic groups
      const [catRes, detRes] = await Promise.all([
        getProblemCategories(),
        getProblemDetailsGrouped(),
      ]);

      if (catRes.success && catRes.categories && detRes.success && detRes.grouped) {
        const dynamicMap: Record<string, { desc: string; items: string[] }> = {};
        catRes.categories.forEach((cat) => {
          const dbItems = detRes.grouped[cat.kode];
          const fallbackItems = FALLBACK_CATEGORIES[cat.kode]?.items || [];
          dynamicMap[cat.kode] = {
            desc: cat.label,
            items: dbItems && dbItems.length > 0 ? dbItems : fallbackItems,
          };
        });
        if (Object.keys(dynamicMap).length > 0) {
          setCategoriesMap(dynamicMap);
        }
      }

      // 3. Load Saved Block Defects from Database (Supabase)
      const blockRes = await getBlockRequiredDefects();
      if (blockRes.success && blockRes.data && Array.isArray(blockRes.data)) {
        setRequiredBlockDefects(blockRes.data);
        try {
          localStorage.setItem("dji_required_block_defects", JSON.stringify(blockRes.data));
        } catch (e) {}
      } else {
        const savedBlock = localStorage.getItem("dji_required_block_defects");
        if (savedBlock) {
          try {
            const parsed = JSON.parse(savedBlock);
            if (Array.isArray(parsed)) setRequiredBlockDefects(parsed);
          } catch (e) {}
        }
      }
    } catch (err: any) {
      console.error("Failed to load machine config page data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleRequiredDefect = (item: string) => {
    setRequiredBlockDefects((prev) =>
      prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]
    );
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setToastMsg(null);
    try {
      // Build maps for local caching
      const mapPcs: Record<string, number> = {};
      const mapTypes: Record<string, string> = {};
      configs.forEach((cfg) => {
        if (cfg.nomor_mc) {
          const mcRaw = cfg.nomor_mc.trim();
          const mcUpper = mcRaw.toUpperCase();
          mapPcs[mcRaw] = cfg.default_pcs;
          mapPcs[mcUpper] = cfg.default_pcs;
          mapTypes[mcRaw] = cfg.input_type;
          mapTypes[mcUpper] = cfg.input_type;
        }
      });

      localStorage.setItem("dji_machine_configs", JSON.stringify(mapPcs));
      localStorage.setItem("dji_machine_input_types", JSON.stringify(mapTypes));
      localStorage.setItem("dji_required_block_defects", JSON.stringify(requiredBlockDefects));
      window.dispatchEvent(new Event("storage_dji_required_block_defects"));

      const [res, blockSaveRes] = await Promise.all([
        upsertAllMachineConfigs(configs),
        saveBlockRequiredDefects(requiredBlockDefects),
      ]);

      if (res.success && blockSaveRes.success) {
        setToastMsg({ type: "success", text: "Pengaturan & Aturan Mesin berhasil disimpan ke Database!" });
      } else {
        setToastMsg({ type: "error", text: res.error || "Gagal menyimpan ke database" });
      }
    } catch (e: any) {
      setToastMsg({ type: "error", text: e.message || "Terjadi kesalahan saat menyimpan" });
    } finally {
      setSaving(false);
    }
  };

  const filteredConfigs = useMemo(() => {
    if (!searchQuery.trim()) return configs;
    return configs.filter((c) =>
      c.nomor_mc.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [configs, searchQuery]);

  const totalActiveRequiredCount = useMemo(() => {
    const allCategoryItems = new Set<string>();
    Object.values(categoriesMap).forEach((group) => {
      group.items.forEach((item) => allCategoryItems.add(item));
    });
    return requiredBlockDefects.filter((d) => allCategoryItems.has(d)).length;
  }, [categoriesMap, requiredBlockDefects]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* HEADER CARD */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
            <SlidersHorizontal className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Pengaturan Parameter & Aturan Mesin
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 uppercase tracking-wide">
                Konfigurasi System
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-500 mt-0.5">
              Kelola default PCS, Mode Input (Panel/Meter), dan instruksi Wajib Nomor Blok per mesin
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="px-6 py-3 rounded-2xl bg-[#0070bc] hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-200 transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Simpan Semua Pengaturan
          </button>
        </div>
      </div>

      {/* TOAST MESSAGE */}
      {toastMsg && (
        <div
          className={`p-4 rounded-2xl border font-bold text-xs flex items-center gap-3 animate-fadeIn ${
            toastMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {toastMsg.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* TAB SWITCHER & MAIN CONTENT CONTAINER */}
      <div className="bg-white rounded-[28px] border border-slate-200 p-6 shadow-sm space-y-6">
        {/* TABS HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab("MACHINES")}
              className={`px-5 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2.5 whitespace-nowrap cursor-pointer border ${
                activeTab === "MACHINES"
                  ? "bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02]"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Cpu className="w-4 h-4 text-amber-400" />
              <span>Parameter Default Mesin</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-800 text-amber-300">
                {configs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("BLOCK_REQUIRED")}
              className={`px-5 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2.5 whitespace-nowrap cursor-pointer border ${
                activeTab === "BLOCK_REQUIRED"
                  ? "bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02]"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Box className="w-4 h-4 text-rose-400" />
              <span>Aturan Wajib Nomor Blok</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-900 text-rose-200">
                {totalActiveRequiredCount} Wajib
              </span>
            </button>
          </div>

          {activeTab === "MACHINES" && (
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nomor mesin (R1, STM...)..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* TAB 1: PARAMETER DEFAULT MESIN */}
        {activeTab === "MACHINES" && (
          <div className="space-y-6">
            <div className="text-xs text-slate-600 bg-blue-50/80 p-4 rounded-2xl border border-blue-100 flex items-start gap-3">
              <SlidersHorizontal className="w-5 h-5 text-[#0070bc] shrink-0 mt-0.5" />
              <p className="leading-relaxed font-medium">
                <strong className="text-slate-800 font-extrabold">Catatan Sistem:</strong> Parameter default PCS dan Mode Input (Panel/Meter) di bawah ini otomatis diterapkan saat Admin membuat Jadwal Produksi baru atau saat Operator membuka Form Input Laporan.
              </p>
            </div>

            {loading ? (
              <div className="py-16 text-center text-slate-400 font-bold text-sm flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 text-[#0070bc] animate-spin" />
                <span>Memuat parameter mesin...</span>
              </div>
            ) : filteredConfigs.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-bold text-sm">
                Tidak ada mesin yang sesuai dengan kata kunci pencarian.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredConfigs.map((cfg: MachineConfig) => {
                  const idx = configs.findIndex((c) => c.nomor_mc === cfg.nomor_mc);

                  return (
                    <div
                      key={cfg.nomor_mc}
                      className="flex flex-col gap-3 p-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 shadow-xs hover:border-blue-300 hover:bg-white transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="bg-slate-900 text-white font-black px-3 py-1 rounded-xl text-xs tracking-wider font-mono shadow-xs">
                          {cfg.nomor_mc}
                        </span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            cfg.input_type === "METER"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          MODE {cfg.input_type}
                        </span>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-200/60">
                        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200">
                          <span className="text-xs font-extrabold text-slate-600">
                            Default PCS:
                          </span>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={cfg.default_pcs}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              const newConfigs = [...configs];
                              newConfigs[idx].default_pcs = val;
                              setConfigs(newConfigs);
                            }}
                            className="w-14 h-8 text-center rounded-lg font-black text-[#0070bc] bg-slate-50 focus:bg-white border border-slate-200 outline-none text-xs"
                          />
                        </div>

                        <div className="flex items-center p-1 bg-slate-200/80 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              const newConfigs = [...configs];
                              newConfigs[idx].input_type = "PANEL";
                              setConfigs(newConfigs);
                            }}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              cfg.input_type === "PANEL"
                                ? "bg-[#0070bc] text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            PANEL
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newConfigs = [...configs];
                              newConfigs[idx].input_type = "METER";
                              setConfigs(newConfigs);
                            }}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              cfg.input_type === "METER"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            METER
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ATURAN WAJIB NOMOR BLOK */}
        {activeTab === "BLOCK_REQUIRED" && (
          <div className="space-y-6">
            <div className="text-xs text-rose-950 bg-rose-50/80 p-4 rounded-2xl border border-rose-200/80 flex items-start gap-3">
              <Box className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-medium">
                <strong className="font-extrabold text-rose-900">Aturan Wajib Nomor Blok:</strong> Centang detail masalah yang <strong>WAJIB MENGISI NOMOR BLOK</strong> saat dilaporkan operator. Jika diatur <strong>TIDAK BLOK</strong>, isian nomor blok akan bersifat opsional / tersembunyi.
              </p>
            </div>

            <div className="space-y-6">
              {Object.entries(categoriesMap).map(([catCode, catGroup]) => {
                const reqCount = catGroup.items.filter((item) =>
                  requiredBlockDefects.includes(item)
                ).length;

                return (
                  <div
                    key={catCode}
                    className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="bg-slate-900 text-amber-400 font-black text-xs px-3 py-1 rounded-xl font-mono">
                          [{catCode}]
                        </span>
                        <span className="text-sm font-extrabold text-slate-800">
                          {catGroup.desc}
                        </span>
                      </div>
                      <span className="text-xs font-black text-slate-500 bg-slate-200/70 px-2.5 py-1 rounded-lg">
                        {reqCount} / {catGroup.items.length} Wajib Blok
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {catGroup.items.map((item) => {
                        const isReq = requiredBlockDefects.includes(item);
                        return (
                          <button
                            type="button"
                            key={item}
                            onClick={() => toggleRequiredDefect(item)}
                            className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between select-none active:scale-95 ${
                              isReq
                                ? "bg-rose-50/90 border-rose-300 text-rose-950 shadow-xs"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <span className="pr-2 text-left">{item}</span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 flex items-center gap-1 ${
                                isReq
                                  ? "bg-rose-600 text-white"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {isReq && <Check className="w-3 h-3 stroke-[3]" />}
                              {isReq ? "WAJIB BLOK" : "TIDAK BLOK"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
