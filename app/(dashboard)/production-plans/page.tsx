"use client";

import { useState, useEffect } from "react";
import {
  getAllProductionPlans,
  deleteProductionPlan,
  upsertProductionPlan,
  upsertBatchProductionPlans,
  getRecentPlansByMachine,
  checkDuplicateProductionPlans,
  type DuplicatePotonganConflict,
} from "@/actions/plan-actions";
import { getMachineConfigs, getAllMaxPanelConfigs } from "@/actions/machine-config-actions";
import { REGISTERED_MACHINES } from "@/lib/constants";
import { FileSpreadsheet, Plus, Edit, Trash2, RefreshCw, X, Save, Search, QrCode, Printer, Layers, Factory, CheckSquare, AlertTriangle } from "lucide-react";
import ProductionPlanBarcodeModal, { PlanBarcodeData } from "@/components/modals/ProductionPlanBarcodeModal";
import BatchA4BarcodeModal from "@/components/modals/BatchA4BarcodeModal";

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

  // Batch Range Mode states
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");

  // Duplicate / Already-Scheduled & Already-Produced Detection states
  const [duplicateConflicts, setDuplicateConflicts] = useState<DuplicatePotonganConflict[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateConfirmState, setDuplicateConfirmState] = useState<{
    conflicts: DuplicatePotonganConflict[];
    andPrintBarcode: boolean;
    totalInRange: number;
  } | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Barcode Modal states
  const [barcodeModalPlan, setBarcodeModalPlan] = useState<PlanBarcodeData | null>(null);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);

  // Batch A4 Print Selection states
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [batchBarcodePlans, setBatchBarcodePlans] = useState<PlanBarcodeData[]>([]);
  const [isBatchBarcodeOpen, setIsBatchBarcodeOpen] = useState(false);

  // Filters & Workflow Status states
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "COMPLETED" | "ALL">("ACTIVE");
  const [statusCounts, setStatusCounts] = useState({ active: 0, completed: 0, all: 0 });
  const [machineGroupFilter, setMachineGroupFilter] = useState<"ALL" | "RASCHEL" | "TRICOTE">("ALL");
  const [machineNoFilter, setMachineNoFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "PANEL" | "METER">("ALL");

  const filteredMachineOptions = REGISTERED_MACHINES.filter((mc) => {
    if (machineGroupFilter === "RASCHEL") return mc.startsWith("R");
    if (machineGroupFilter === "TRICOTE") return mc.startsWith("T");
    return true;
  });

  const isPlanMeter = (p: any) => {
    const mcKey = String(p.nomor_mc || "").toUpperCase();
    return (
      p.input_type === "METER" ||
      machineConfigs[mcKey]?.input_type === "METER" ||
      mcKey.startsWith("R11") ||
      mcKey.startsWith("R12") ||
      mcKey.startsWith("R16") ||
      mcKey.startsWith("T")
    );
  };

  const displayedPlans = plans.filter((p) => {
    if (typeFilter === "ALL") return true;
    const meter = isPlanMeter(p);
    return typeFilter === "METER" ? meter : !meter;
  });

  const panelCountInPage = plans.filter((p) => !isPlanMeter(p)).length;
  const meterCountInPage = plans.length - panelCountInPage;

  const handleOpenBarcodeModal = (plan: any) => {
    setBarcodeModalPlan(plan);
    setIsBarcodeModalOpen(true);
  };

  const toggleSelectPlan = (id: string) => {
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allCurrentPageSelected =
    displayedPlans.length > 0 && displayedPlans.every((p) => selectedPlanIds.has(String(p.id)));

  const toggleSelectAllCurrentPage = () => {
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (allCurrentPageSelected) {
        displayedPlans.forEach((p) => next.delete(String(p.id)));
      } else {
        displayedPlans.forEach((p) => next.add(String(p.id)));
      }
      return next;
    });
  };

  const handleOpenBatchA4Print = () => {
    const selected: PlanBarcodeData[] = plans
      .filter((p) => selectedPlanIds.has(String(p.id)))
      .map((p) => {
        const mcKey = String(p.nomor_mc || "").toUpperCase();
        const isMeter =
          p.input_type === "METER" ||
          machineConfigs[mcKey]?.input_type === "METER" ||
          mcKey.startsWith("R11") ||
          mcKey.startsWith("R12") ||
          mcKey.startsWith("R16") ||
          mcKey.startsWith("T");
        return {
          ...p,
          input_type: isMeter ? "METER" : "PANEL",
        };
      });

    if (selected.length === 0) return;
    setBatchBarcodePlans(selected);
    setIsBatchBarcodeOpen(true);
  };
  
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

  // Real-time check for duplicate / already-produced potongan
  useEffect(() => {
    if (!isModalOpen || !formData.nomor_mc) {
      setDuplicateConflicts([]);
      setCheckingDuplicates(false);
      return;
    }

    const potList: number[] = [];
    if (isRangeMode && !formData.id) {
      const fromNum = parseInt(rangeFrom, 10);
      const toNum = parseInt(rangeTo, 10);
      if (
        !isNaN(fromNum) &&
        !isNaN(toNum) &&
        fromNum > 0 &&
        toNum >= fromNum &&
        toNum - fromNum <= 100
      ) {
        for (let p = fromNum; p <= toNum; p++) {
          potList.push(p);
        }
      }
    } else {
      const potNum = parseInt(String(formData.potongan_ke || ""), 10);
      if (!isNaN(potNum) && potNum > 0) {
        potList.push(potNum);
      }
    }

    if (potList.length === 0) {
      setDuplicateConflicts([]);
      setCheckingDuplicates(false);
      return;
    }

    let cancelled = false;
    setCheckingDuplicates(true);

    const timer = setTimeout(async () => {
      try {
        const res = await checkDuplicateProductionPlans(
          formData.nomor_mc,
          potList,
          formData.id ? String(formData.id) : undefined
        );
        if (!cancelled) {
          setDuplicateConflicts(res.success ? res.conflicts : []);
        }
      } catch (e) {
        console.error("Failed to check duplicates:", e);
        if (!cancelled) setDuplicateConflicts([]);
      } finally {
        if (!cancelled) setCheckingDuplicates(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isModalOpen, formData.nomor_mc, formData.potongan_ke, formData.id, isRangeMode, rangeFrom, rangeTo]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await getAllProductionPlans(currentPage, perPage, searchQuery, {
        statusFilter,
        machineGroup: machineGroupFilter,
        machineNo: machineNoFilter,
      });
      if (res.success && res.data) {
        setPlans(res.data);
        setTotalCount(res.total || 0);
        if (res.counts) {
          setStatusCounts(res.counts);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [currentPage, perPage, searchQuery, statusFilter, machineGroupFilter, machineNoFilter]);

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
    setIsRangeMode(false);
    setRangeFrom("");
    setRangeTo("");
    setDuplicateConflicts([]);
    setDuplicateConfirmState(null);
    if (plan) {
      const mcKey = String(plan.nomor_mc || "").toUpperCase().trim();
      const cfg = machineConfigs[mcKey];
      const detectedType = plan.input_type || cfg?.input_type || (mcKey.startsWith("R11") || mcKey.startsWith("R12") || mcKey.startsWith("R16") ? "METER" : "PANEL");
      setFormData({
        ...plan,
        input_type: detectedType,
        max_panel: plan.max_panel !== undefined && plan.max_panel !== null ? plan.max_panel : "",
        pcs_count: plan.pcs_count || cfg?.default_pcs || 1,
        jenis_ob: plan.jenis_ob || "",
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
        jenis_ob: "",
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

  const executeSave = async (andPrintBarcode = false, skipPotongans: number[] = []) => {
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

      let res: any;
      if (isRangeMode && !formData.id) {
        const fromNum = parseInt(rangeFrom, 10);
        const toNum = parseInt(rangeTo, 10);
        res = await upsertBatchProductionPlans(
          payload,
          fromNum,
          toNum,
          skipPotongans.length > 0 ? { skipPotongans } : undefined
        );
      } else {
        res = await upsertProductionPlan(payload);
      }

      if (res.success) {
        setDuplicateConfirmState(null);
        setDuplicateConflicts([]);
        setIsModalOpen(false);
        fetchPlans();
        if (andPrintBarcode) {
          const resolvedInputType: "PANEL" | "METER" =
            payload.input_type || machineConfigs[payload.nomor_mc]?.input_type || "PANEL";

          if (isRangeMode && !formData.id) {
            const fromNum = parseInt(rangeFrom, 10);
            const toNum = parseInt(rangeTo, 10);
            const savedPots: number[] = Array.isArray(res.savedPotongans)
              ? res.savedPotongans
              : Array.from({ length: toNum - fromNum + 1 }, (_, i) => fromNum + i);
            const generatedPlans: PlanBarcodeData[] = savedPots.map((pot) => ({
              ...payload,
              potongan_ke: pot,
              input_type: resolvedInputType,
            }));
            if (generatedPlans.length > 0) {
              setBatchBarcodePlans(generatedPlans);
              setIsBatchBarcodeOpen(true);
            }
          } else {
            handleOpenBarcodeModal({
              ...payload,
              id: (res as any)?.data?.id || formData.id,
              input_type: resolvedInputType,
            });
          }
        }
      } else {
        setDuplicateConfirmState(null);
        setErrorMsg(res.error || "Gagal menyimpan jadwal.");
      }
    } catch (e: any) {
      setDuplicateConfirmState(null);
      setErrorMsg(e.message || "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent, andPrintBarcode = false) => {
    e.preventDefault();
    if (!formData.nomor_mc) {
      setErrorMsg("Nomor Mesin harus dipilih.");
      return;
    }

    const potListToCheck: number[] = [];
    if (isRangeMode && !formData.id) {
      const fromNum = parseInt(rangeFrom, 10);
      const toNum = parseInt(rangeTo, 10);
      if (isNaN(fromNum) || isNaN(toNum) || fromNum <= 0 || toNum <= 0) {
        setErrorMsg("Rentang potongan (Dari & Sampai) harus diisi dengan angka bulat positif.");
        return;
      }
      if (toNum < fromNum) {
        setErrorMsg("Nomor potongan 'Sampai' harus lebih besar atau sama dengan potongan 'Dari'.");
        return;
      }
      if (toNum - fromNum > 100) {
        setErrorMsg("Maksimal rentang 100 potongan sekaligus dalam sekali simpan.");
        return;
      }
      for (let p = fromNum; p <= toNum; p++) {
        potListToCheck.push(p);
      }
    } else {
      if (!formData.potongan_ke) {
        setErrorMsg("Nomor Mesin dan Potongan Ke harus diisi.");
        return;
      }
      const potNum = parseInt(String(formData.potongan_ke), 10);
      if (!isNaN(potNum) && potNum > 0) {
        potListToCheck.push(potNum);
      }
    }

    // Pastikan pengecekan duplikat up-to-date sebelum menyimpan (Opsi B: Peringatan + Konfirmasi)
    setSaving(true);
    setErrorMsg(null);
    try {
      const checkRes = await checkDuplicateProductionPlans(
        formData.nomor_mc,
        potListToCheck,
        formData.id ? String(formData.id) : undefined
      );
      const conflicts = checkRes.success ? checkRes.conflicts : duplicateConflicts;
      setDuplicateConflicts(conflicts);

      if (conflicts.length > 0) {
        setSaving(false);
        setDuplicateConfirmState({
          conflicts,
          andPrintBarcode,
          totalInRange: potListToCheck.length,
        });
        return;
      }
    } catch (err) {
      console.error("Duplicate pre-save check error:", err);
    }

    await executeSave(andPrintBarcode);
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
    <div className="w-full max-w-[1440px] mx-auto pb-20 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 animate-fadeIn flex flex-col min-w-0 space-y-5">
      {/* Clean Enterprise Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>Manajemen Produksi</span>
            <span>•</span>
            <span className="text-[#0070bc]">Rencana Potongan</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Jadwal Produksi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Kelola spesifikasi potongan mesin, target produksi, dan cetak label QR tracking A4.
          </p>
        </div>

        {/* Primary Actions */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={fetchPlans}
            disabled={loading}
            className="h-10 px-3.5 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 border border-slate-200 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold cursor-pointer disabled:opacity-50 shadow-2xs"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#0070bc]" : "text-slate-500"}`} />
            <span className="hidden sm:inline">Muat Ulang</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="h-10 px-4 rounded-xl bg-[#0070bc] hover:bg-[#005a96] active:scale-[0.98] text-white font-bold text-xs shadow-sm shadow-[#0070bc]/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Tambah Jadwal</span>
          </button>
        </div>
      </div>

      {/* Compact Summary Strip (3 KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Jadwal Aktif vs Selesai */}
        <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Antrean Jadwal Aktif
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-slate-900 tabular-nums">
                {statusCounts.active}
              </span>
              <span className="text-xs font-medium text-slate-500">
                aktif • <strong className="text-emerald-600">{statusCounts.completed}</strong> selesai
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Komposisi Halaman */}
        <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Tampilan Aktif
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm font-extrabold text-slate-800 tabular-nums">
                {panelCountInPage}{" "}
                <span className="text-xs font-semibold text-slate-500">Panel</span>
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-sm font-extrabold text-[#0070bc] tabular-nums">
                {meterCountInPage}{" "}
                <span className="text-xs font-semibold text-slate-500">All Over</span>
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0070bc] flex items-center justify-center shrink-0">
            <Factory className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Antrean Cetak QR A4 */}
        <div
          className={`rounded-2xl border px-4 py-3.5 flex items-center justify-between shadow-2xs transition-colors ${
            selectedPlanIds.size > 0
              ? "bg-emerald-50/70 border-emerald-200"
              : "bg-white border-slate-200/80"
          }`}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Cetak Massal QR A4
            </p>
            {selectedPlanIds.size > 0 ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-black text-emerald-700 tabular-nums">
                  {selectedPlanIds.size} terpilih
                </span>
                <button
                  type="button"
                  onClick={handleOpenBatchA4Print}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Printer className="w-3 h-3" />
                  <span>Cetak A4</span>
                </button>
              </div>
            ) : (
              <p className="text-xs font-medium text-slate-500 mt-1 truncate">
                Centang baris tabel untuk cetak A4
              </p>
            )}
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              selectedPlanIds.size > 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            <CheckSquare className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Unified Enterprise Data Table Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
        {/* Status Tabs Strip (Aktif / Selesai / Semua) */}
        <div className="px-4 pt-3 border-b border-slate-200/80 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 -mb-px">
            {(
              [
                { key: "ACTIVE", label: "Aktif", count: statusCounts.active },
                { key: "COMPLETED", label: "Selesai", count: statusCounts.completed },
                { key: "ALL", label: "Semua", count: statusCounts.all },
              ] as const
            ).map((tab) => {
              const isActiveTab = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.key);
                    setCurrentPage(1);
                    setSelectedPlanIds(new Set());
                  }}
                  className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    isActiveTab
                      ? "border-[#0070bc] text-[#0070bc]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${
                      isActiveTab
                        ? "bg-sky-50 text-[#0070bc]"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Contextual Bulk Actions (Docked seamlessly on right) */}
          {selectedPlanIds.size > 0 && (
            <div className="flex items-center gap-2 bg-emerald-50/70 border border-emerald-200 rounded-xl px-3 py-1 mb-2 shadow-2xs">
              <span className="text-xs font-extrabold text-emerald-700 tabular-nums">
                {selectedPlanIds.size} dipilih
              </span>
              <span className="text-emerald-200">|</span>
              <button
                type="button"
                onClick={handleOpenBatchA4Print}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak QR A4</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlanIds(new Set())}
                className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-white/80 transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          )}
        </div>

        {/* Integrated Filter Toolbar */}
        <div className="px-4 py-3 border-b border-slate-200/80 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Left: Search + Machine Group + Specific Machine */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative w-full sm:w-60">
              <input
                type="text"
                placeholder="Cari mesin, design, order..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 pl-9 pr-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none text-xs font-semibold text-slate-700 placeholder:text-slate-400 w-full transition-all"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Filter Jenis Mesin (Raschel / Tricote) */}
            <select
              value={machineGroupFilter}
              onChange={(e) => {
                const nextGroup = e.target.value as "ALL" | "RASCHEL" | "TRICOTE";
                setMachineGroupFilter(nextGroup);
                setMachineNoFilter("ALL");
                setCurrentPage(1);
              }}
              aria-label="Filter Jenis Mesin"
              className="h-9 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] bg-white outline-none text-xs font-bold text-slate-700 cursor-pointer"
            >
              <option value="ALL">Semua Jenis Mesin</option>
              <option value="RASCHEL">Raschel (R)</option>
              <option value="TRICOTE">Tricote (T)</option>
            </select>

            {/* Filter Nomor Mesin Spesifik */}
            <select
              value={machineNoFilter}
              onChange={(e) => {
                setMachineNoFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter Nomor Mesin"
              className="h-9 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] bg-white outline-none text-xs font-bold text-slate-700 cursor-pointer"
            >
              <option value="ALL">Semua No. Mesin</option>
              {filteredMachineOptions.map((mc) => (
                <option key={mc} value={mc}>
                  Mesin {mc}
                </option>
              ))}
            </select>
          </div>

          {/* Right: Panel / All Over Segmented Filter */}
          <div className="inline-flex bg-slate-200/60 p-0.5 rounded-xl border border-slate-200/80 self-start lg:self-auto shrink-0">
            {(
              [
                { key: "ALL", label: "Semua" },
                { key: "PANEL", label: "Panel" },
                { key: "METER", label: "All Over" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTypeFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  typeFilter === tab.key
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        {loading && plans.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center bg-white">
            <RefreshCw className="w-7 h-7 text-[#0070bc] animate-spin mb-3" />
            <p className="font-bold text-slate-600 text-sm">Memuat jadwal produksi...</p>
          </div>
        ) : displayedPlans.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-7 h-7 stroke-[1.7]" />
            </div>
            <p className="font-bold text-slate-800 text-sm">Tidak ada jadwal ditemukan</p>
            <p className="text-xs text-slate-400 font-medium mt-1">
              {typeFilter !== "ALL"
                ? "Coba ubah filter tipe mesin ke Semua atau tambahkan jadwal baru."
                : 'Klik tombol "Tambah Jadwal" untuk membuat rencana potongan baru.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="pl-4 pr-2 py-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={toggleSelectAllCurrentPage}
                      title="Pilih semua di halaman ini"
                      className="w-4 h-4 rounded border-slate-300 accent-[#0070bc] cursor-pointer align-middle"
                    />
                  </th>
                  <th className="px-3 py-3">Mesin &amp; Potongan</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Design</th>
                  <th className="px-3 py-3">Order &amp; Customer</th>
                  <th className="px-3 py-3">Target &amp; PCS</th>
                  <th className="px-3 py-3">Spesifikasi Teknis</th>
                  <th className="pl-3 pr-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedPlans.map((p) => {
                  const isMeter = isPlanMeter(p);
                  const targetVal = p.target_meter || p.max_panel;
                  const isSelected = selectedPlanIds.has(String(p.id));
                  const hasOrder = Boolean(p.no_order_barang && p.no_order_barang !== "-");
                  const hasCust = Boolean(p.no_customer && p.no_customer !== "-");
                  const hasSpecs = Boolean(p.pick || p.course || p.rpm);

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors group ${
                        isSelected ? "bg-sky-50/70" : "hover:bg-slate-50/80"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="pl-4 pr-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectPlan(String(p.id))}
                          className="w-4 h-4 rounded border-slate-300 accent-[#0070bc] cursor-pointer align-middle"
                        />
                      </td>

                      {/* Mesin & Potongan */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex items-center justify-center min-w-[44px] px-2 py-1 rounded-lg bg-slate-900 text-white font-black text-xs tracking-wide tabular-nums">
                            {p.nomor_mc}
                          </span>
                          <div>
                            <div className="font-extrabold text-slate-900 text-xs tabular-nums leading-tight">
                              Potongan {p.potongan_ke}
                            </div>
                            <span
                              className={`inline-block mt-0.5 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                                isMeter
                                  ? "bg-sky-50 text-[#0070bc] border border-sky-200/70"
                                  : "bg-slate-100 text-slate-500 border border-slate-200/70"
                              }`}
                            >
                              {isMeter ? "All Over" : "Panel"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status Progres Live */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {p.workflow_status === "COMPLETED" ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Selesai
                          </span>
                        ) : p.workflow_status === "INSPECTED" ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            Inspeksi QC
                          </span>
                        ) : p.workflow_status === "IN_PRODUCTION" ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-50 text-[#0070bc] border border-sky-200/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0070bc]" />
                            Produksi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Terjadwal
                          </span>
                        )}
                      </td>

                      {/* Design */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {p.design_id ? (
                          <span className="font-bold text-slate-900 text-xs">
                            {p.design_id}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Belum diatur</span>
                        )}
                      </td>

                      {/* Order & Customer */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {hasOrder || hasCust ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-800 text-xs tabular-nums flex items-center gap-1.5 flex-wrap">
                              <span>{hasOrder ? p.no_order_barang : "—"}</span>
                              {hasOrder && p.jenis_ob && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-wide ${
                                    p.jenis_ob === "DJI"
                                      ? "bg-sky-100 text-sky-800"
                                      : "bg-indigo-100 text-indigo-800"
                                  }`}
                                >
                                  OB {p.jenis_ob}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium tabular-nums">
                              {hasCust ? `Cust: ${p.no_customer}` : "Tanpa customer"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-medium">—</span>
                        )}
                      </td>

                      {/* Target & PCS */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-slate-700 font-bold text-[11px] tabular-nums">
                            <Layers className="w-3 h-3 text-slate-400" />
                            {p.pcs_count || 1} PCS
                          </span>
                          {targetVal ? (
                            <span className="font-bold text-slate-800 text-xs tabular-nums">
                              {targetVal} {isMeter ? "m" : "pnl"}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Target bebas</span>
                          )}
                        </div>
                      </td>

                      {/* Spesifikasi Teknis (Pick / Course / RPM) */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {hasSpecs ? (
                          <div className="flex items-center gap-2 text-[11px] tabular-nums">
                            {p.pick && (
                              <span className="text-slate-600">
                                <span className="text-slate-400 font-medium">P:</span>{" "}
                                <strong className="text-slate-800">{p.pick}</strong>
                              </span>
                            )}
                            {p.course && (
                              <span className="text-slate-600">
                                <span className="text-slate-400 font-medium">C:</span>{" "}
                                <strong className="text-slate-800">{p.course}</strong>
                              </span>
                            )}
                            {p.rpm && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                                {p.rpm} RPM
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-medium">—</span>
                        )}
                      </td>

                      {/* Action Buttons (Right-aligned) */}
                      <td className="pl-3 pr-4 py-3 whitespace-nowrap text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenBarcodeModal({
                                ...p,
                                input_type: isMeter ? "METER" : "PANEL",
                              })
                            }
                            className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-[11px] font-bold transition-colors cursor-pointer"
                            title="Lihat & Cetak QR Tracking"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>QR</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenModal(p)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-transparent hover:border-slate-200 hover:bg-white text-slate-500 hover:text-[#0070bc] transition-colors cursor-pointer"
                            title="Edit Jadwal"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-transparent hover:border-rose-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Hapus Jadwal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/80 bg-slate-50/50">
            <div className="text-xs font-medium text-slate-500 tabular-nums">
              Menampilkan{" "}
              <span className="font-bold text-slate-800">
                {totalCount === 0 ? 0 : (currentPage - 1) * perPage + 1}–
                {Math.min(currentPage * perPage, totalCount)}
              </span>{" "}
              dari <span className="font-bold text-slate-900">{totalCount}</span> jadwal
            </div>
            <div className="flex items-center gap-2">
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} / hal
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-8 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Prev
              </button>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-bold tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in border border-slate-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200/80 flex justify-between items-center bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0070bc] text-white flex items-center justify-center shadow-xs shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                    {formData.id ? "Edit Jadwal Produksi" : "Tambah Jadwal Produksi"}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                    Atur spesifikasi potongan mesin dan target produksi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
              {/* Scrollable Form Body */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5 bg-white">
                {errorMsg && (
                  <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 text-xs rounded-xl font-bold">
                    {errorMsg}
                  </div>
                )}

                {/* SECTION 1: Identitas Mesin & Target */}
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 space-y-4">
                  {/* Top Control Strip: Jenis Inputan + Mode Potongan */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
                    <div>
                      <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider block">
                        Konfigurasi Potongan
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Pilih jenis kain (Panel / All Over) dan mode input
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Panel / All Over Switch */}
                      <div className="inline-flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, input_type: "PANEL" })}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                            formData.input_type !== "METER"
                              ? "bg-[#0070bc] text-white shadow-2xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          PANEL
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, input_type: "METER" })}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                            formData.input_type === "METER"
                              ? "bg-[#0070bc] text-white shadow-2xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          ALL OVER
                        </button>
                      </div>

                      {/* 1 Pot / Rentang Switch (only when adding new) */}
                      {!formData.id && (
                        <div className="inline-flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setIsRangeMode(false)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              !isRangeMode
                                ? "bg-slate-900 text-white shadow-2xs"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                            title="Input 1 potongan"
                          >
                            1 Potongan
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsRangeMode(true);
                              if (!rangeFrom && formData.potongan_ke) {
                                setRangeFrom(String(formData.potongan_ke));
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              isRangeMode
                                ? "bg-slate-900 text-white shadow-2xs"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                            title="Input beberapa potongan sekaligus (misal: 100 s/d 105)"
                          >
                            Rentang
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Clean 2x2 Grid — Perfectly Aligned */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Nomor Mesin */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Nomor Mesin <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={formData.nomor_mc}
                        onChange={(e) => handleMachineChange(e.target.value)}
                        className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none uppercase font-bold text-slate-900 text-xs transition-all"
                      >
                        <option value="">-- Pilih Mesin --</option>
                        {REGISTERED_MACHINES.map((mc) => (
                          <option key={mc} value={mc}>
                            {mc}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Potongan Ke / Rentang Potongan */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                        <span>
                          {isRangeMode ? "Rentang Potongan" : "Potongan Ke"}{" "}
                          <span className="text-rose-500">*</span>
                        </span>
                        {isRangeMode &&
                          rangeFrom &&
                          rangeTo &&
                          Number(rangeTo) >= Number(rangeFrom) && (
                            <span className="text-[10px] font-bold text-[#0070bc] normal-case">
                              {Number(rangeTo) - Number(rangeFrom) + 1} potongan
                            </span>
                          )}
                      </label>
                      {!isRangeMode ? (
                        <input
                          type="number"
                          required
                          value={formData.potongan_ke || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, potongan_ke: e.target.value })
                          }
                          className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none font-bold text-slate-900 text-xs tabular-nums transition-all"
                          placeholder="Contoh: 550"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            required
                            value={rangeFrom}
                            onChange={(e) => setRangeFrom(e.target.value)}
                            className="h-10 w-full px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none font-bold text-slate-900 text-xs tabular-nums text-center"
                            placeholder="Dari (mis. 100)"
                          />
                          <span className="text-slate-400 font-bold text-xs shrink-0">s/d</span>
                          <input
                            type="number"
                            required
                            value={rangeTo}
                            onChange={(e) => setRangeTo(e.target.value)}
                            className="h-10 w-full px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none font-bold text-slate-900 text-xs tabular-nums text-center"
                            placeholder="Sampai (mis. 105)"
                          />
                        </div>
                      )}
                    </div>

                    {/* Target Produksi */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                        <span>
                          {formData.input_type === "METER" ? "Target Panjang" : "Max Panel"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium normal-case">
                          {formData.input_type === "METER" ? "meter (opsional)" : "panel (opsional)"}
                        </span>
                      </label>
                      <input
                        type="number"
                        value={formData.max_panel || ""}
                        onChange={(e) => setFormData({ ...formData, max_panel: e.target.value })}
                        className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none font-bold text-slate-900 text-xs tabular-nums transition-all"
                        placeholder={
                          formData.input_type === "METER" ? "Contoh: 250" : "Contoh: 50"
                        }
                      />
                    </div>

                    {/* Jumlah PCS */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                        <span>Jumlah PCS</span>
                        <span className="text-[10px] text-slate-400 font-medium normal-case">
                          1 – 6 PCS
                        </span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={
                          formData.pcs_count !== undefined && formData.pcs_count !== null
                            ? formData.pcs_count
                            : ""
                        }
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : parseInt(e.target.value);
                          setFormData({ ...formData, pcs_count: val });
                        }}
                        className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none font-bold text-slate-900 text-xs tabular-nums transition-all"
                        placeholder="1"
                      />
                    </div>
                  </div>

                  {/* Real-Time Duplicate / Already-Produced Warning Banner */}
                  {checkingDuplicates && (
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 px-1">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0070bc]" />
                      <span>Memeriksa riwayat jadwal &amp; produksi potongan...</span>
                    </div>
                  )}

                  {!checkingDuplicates && duplicateConflicts.length > 0 && (() => {
                    const hasProd = duplicateConflicts.some((c) => c.inProduction);
                    const hasPlan = duplicateConflicts.some((c) => c.inPlan);
                    const single = duplicateConflicts.length === 1 && !isRangeMode ? duplicateConflicts[0] : null;
                    const planCount = duplicateConflicts.filter((c) => c.inPlan).length;
                    const prodCount = duplicateConflicts.filter((c) => c.inProduction).length;

                    return (
                      <div
                        className={`rounded-xl border p-3 space-y-2 ${
                          hasProd
                            ? "bg-rose-50/80 border-rose-200 text-rose-900"
                            : "bg-amber-50/90 border-amber-200 text-amber-900"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              hasProd ? "text-rose-600" : "text-amber-600"
                            }`}
                          />
                          <div className="flex-1 min-w-0 space-y-1">
                            {single ? (
                              <>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs font-extrabold">
                                    Potongan {single.potongan_ke} di mesin {formData.nomor_mc}
                                    {single.inPlan && single.inProduction
                                      ? " sudah pernah dijadwalkan & diproduksi."
                                      : single.inProduction
                                      ? " sudah pernah masuk riwayat produksi."
                                      : " sudah pernah dijadwalkan."}
                                  </span>
                                  {single.inPlan && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-extrabold">
                                      Sudah Dijadwalkan
                                    </span>
                                  )}
                                  {single.inProduction && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-extrabold">
                                      Sudah Diproduksi
                                    </span>
                                  )}
                                </div>
                                {(single.planDesignId || single.prodDesignId || single.planNoOrder || single.prodNoOrder) && (
                                  <p className="text-[11px] font-medium opacity-85">
                                    Data sebelumnya: Design{" "}
                                    <strong>{single.planDesignId || single.prodDesignId || "-"}</strong>
                                    {(single.planNoOrder || single.prodNoOrder) && (
                                      <>
                                        {" "}• No Order{" "}
                                        <strong>{single.planNoOrder || single.prodNoOrder}</strong>
                                      </>
                                    )}
                                  </p>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="text-xs font-extrabold">
                                  Ditemukan {duplicateConflicts.length} potongan bentrok di mesin{" "}
                                  {formData.nomor_mc}
                                  {hasPlan && hasProd
                                    ? ` (${planCount} sudah dijadwalkan, ${prodCount} sudah diproduksi)`
                                    : hasProd
                                    ? " (sudah pernah diproduksi)"
                                    : " (sudah pernah dijadwalkan)"}
                                </div>
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {duplicateConflicts.slice(0, 12).map((c) => (
                                    <span
                                      key={c.potongan_ke}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-bold border ${
                                        c.inProduction
                                          ? "bg-rose-100/90 text-rose-800 border-rose-300"
                                          : "bg-amber-100/90 text-amber-800 border-amber-300"
                                      }`}
                                    >
                                      <span>Pot. {c.potongan_ke}</span>
                                      <span className="opacity-75 font-semibold">
                                        (
                                        {c.inPlan && c.inProduction
                                          ? "Jadwal & Produksi"
                                          : c.inProduction
                                          ? "Produksi"
                                          : "Jadwal"}
                                        )
                                      </span>
                                    </span>
                                  ))}
                                  {duplicateConflicts.length > 12 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-white/80 border border-slate-200 text-slate-600">
                                      +{duplicateConflicts.length - 12} lainnya
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Quick Copy from Recent History */}
                  {recentPlans.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/70 flex flex-col gap-1.5">
                      <label className="text-[10.5px] font-bold text-[#0070bc] uppercase tracking-wider">
                        Salin Spesifikasi dari Riwayat Mesin (Opsional)
                      </label>
                      <select
                        className="h-9 px-3 rounded-xl border border-sky-200 focus:border-[#0070bc] outline-none font-semibold text-slate-700 text-xs bg-white"
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const selected = recentPlans.find((p) => p.id === e.target.value);
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
                        <option value="">-- Pilih riwayat potongan untuk menyalin otomatis --</option>
                        {recentPlans.map((rp) => (
                          <option key={rp.id} value={rp.id}>
                            Potongan {rp.potongan_ke} | Design: {rp.design_id || "-"} | Order:{" "}
                            {rp.no_order_barang || "-"}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* SECTION 2: Data Desain & Order */}
                <div className="space-y-3">
                  <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Identitas Desain &amp; Order
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Design
                      </label>
                      <input
                        type="text"
                        value={formData.design_id}
                        onChange={(e) => setFormData({ ...formData, design_id: e.target.value })}
                        placeholder="Kode design"
                        className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none uppercase font-semibold text-slate-800 text-xs placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        No Order
                      </label>
                      <input
                        type="text"
                        value={formData.no_order_barang}
                        onChange={(e) =>
                          setFormData({ ...formData, no_order_barang: e.target.value })
                        }
                        placeholder="Mis. EXR/26/126"
                        className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none uppercase font-semibold text-slate-800 text-xs placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
                      />
                      <div className="grid grid-cols-3 gap-1 pt-0.5">
                        {[
                          { val: "", label: "Auto" },
                          { val: "STM", label: "OB STM" },
                          { val: "DJI", label: "OB DJI" },
                        ].map((opt) => {
                          const active = (formData.jenis_ob || "") === opt.val;
                          return (
                            <button
                              key={opt.val || "auto"}
                              type="button"
                              onClick={() => setFormData({ ...formData, jenis_ob: opt.val })}
                              className={`h-7 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer ${
                                active
                                  ? opt.val === "DJI"
                                    ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                                    : opt.val === "STM"
                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                                    : "bg-slate-800 text-white border-slate-800 shadow-2xs"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        No Customer
                      </label>
                      <input
                        type="text"
                        value={formData.no_customer}
                        onChange={(e) =>
                          setFormData({ ...formData, no_customer: e.target.value })
                        }
                        placeholder="Kode customer"
                        className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none uppercase font-semibold text-slate-800 text-xs placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Spesifikasi Teknis & Benang */}
                <div className="space-y-3">
                  <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Spesifikasi Mesin &amp; Benang
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Pick
                      </label>
                      <input
                        type="text"
                        value={formData.pick}
                        onChange={(e) => setFormData({ ...formData, pick: e.target.value })}
                        className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none uppercase font-semibold text-slate-800 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Course
                      </label>
                      <input
                        type="text"
                        value={formData.course}
                        onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                        className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none uppercase font-semibold text-slate-800 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        RPM
                      </label>
                      <input
                        type="text"
                        value={formData.rpm}
                        onChange={(e) => setFormData({ ...formData, rpm: e.target.value })}
                        className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none uppercase font-semibold text-slate-800 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Benang Dasar
                      </label>
                      <input
                        type="text"
                        value={formData.jenis_benang_dasar}
                        onChange={(e) =>
                          setFormData({ ...formData, jenis_benang_dasar: e.target.value })
                        }
                        className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none uppercase font-semibold text-slate-800 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Liner
                      </label>
                      <input
                        type="text"
                        value={formData.liner}
                        onChange={(e) => setFormData({ ...formData, liner: e.target.value })}
                        className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none uppercase font-semibold text-slate-800 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Heavy
                      </label>
                      <input
                        type="text"
                        value={formData.heavy}
                        onChange={(e) => setFormData({ ...formData, heavy: e.target.value })}
                        className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none uppercase font-semibold text-slate-800 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Shadow
                      </label>
                      <input
                        type="text"
                        value={formData.shadow}
                        onChange={(e) => setFormData({ ...formData, shadow: e.target.value })}
                        className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none uppercase font-semibold text-slate-800 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Pinggiran
                      </label>
                      <input
                        type="text"
                        value={formData.pinggiran}
                        onChange={(e) => setFormData({ ...formData, pinggiran: e.target.value })}
                        className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#0070bc] focus:ring-2 focus:ring-sky-500/15 bg-white outline-none uppercase font-semibold text-slate-800 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky Modal Footer */}
              <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200/80 bg-slate-50/80 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-10 px-4 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={(e) => handleSave(e, true)}
                    className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                    title="Simpan jadwal dan langsung buka pratinjau cetak QR"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>
                      {isRangeMode && !formData.id
                        ? "Simpan & Cetak QR A4"
                        : "Simpan & Cetak QR"}
                    </span>
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 px-5 bg-[#0070bc] hover:bg-[#005a96] active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {saving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>
                      {saving
                        ? "Menyimpan..."
                        : isRangeMode &&
                          rangeFrom &&
                          rangeTo &&
                          Number(rangeTo) >= Number(rangeFrom)
                        ? `Simpan ${Number(rangeTo) - Number(rangeFrom) + 1} Jadwal`
                        : "Simpan Jadwal"}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog Konfirmasi Potongan Duplikat / Sudah Diproduksi (Opsi B) */}
      {duplicateConfirmState && (() => {
        const { conflicts, andPrintBarcode, totalInRange } = duplicateConfirmState;
        const isBatch = isRangeMode && !formData.id;
        const conflictPotList = conflicts.map((c) => c.potongan_ke);
        const newCountIfSkip = Math.max(0, totalInRange - conflicts.length);
        const hasProd = conflicts.some((c) => c.inProduction);

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-200/80 flex items-start justify-between gap-3 bg-white">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      hasProd
                        ? "bg-rose-100 text-rose-600"
                        : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                      Potongan Sudah Pernah Ada
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Mesin <strong className="text-slate-800">{formData.nomor_mc}</strong> memiliki{" "}
                      <strong className="text-slate-800">{conflicts.length} potongan</strong> yang
                      sudah dijadwalkan atau diproduksi.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setDuplicateConfirmState(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-5 space-y-3 max-h-[55vh] overflow-y-auto">
                <div className="space-y-2">
                  {conflicts.map((c) => (
                    <div
                      key={c.potongan_ke}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-extrabold text-slate-900 tabular-nums">
                            Potongan {c.potongan_ke}
                          </span>
                          {c.inPlan && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold">
                              Sudah Dijadwalkan
                            </span>
                          )}
                          {c.inProduction && (
                            <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold">
                              Sudah Diproduksi
                            </span>
                          )}
                        </div>
                        {(c.planDesignId || c.prodDesignId || c.planNoOrder || c.prodNoOrder) && (
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                            Design: <strong className="text-slate-700">{c.planDesignId || c.prodDesignId || "-"}</strong>
                            {(c.planNoOrder || c.prodNoOrder) && (
                              <>
                                {" "}• Order: <strong className="text-slate-700">{c.planNoOrder || c.prodNoOrder}</strong>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {isBatch
                    ? newCountIfSkip > 0
                      ? `Anda dapat melewati ${conflicts.length} potongan yang sudah ada (hanya menyimpan ${newCountIfSkip} potongan baru), atau tetap menimpa seluruh rentang.`
                      : "Seluruh potongan dalam rentang ini sudah ada. Pilih 'Timpa Semua' jika memang ingin memperbarui data jadwalnya."
                    : "Apakah Anda yakin ingin tetap menyimpan dan menimpa data jadwal potongan ini?"}
                </p>
              </div>

              {/* Footer */}
              <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200/80 bg-slate-50/80 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setDuplicateConfirmState(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>

                {isBatch && newCountIfSkip > 0 && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => executeSave(andPrintBarcode, conflictPotList)}
                    className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {saving ? "Menyimpan..." : `Lewati yang Ada (Simpan ${newCountIfSkip} Baru)`}
                  </button>
                )}

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => executeSave(andPrintBarcode, [])}
                  className={`h-9 px-4 rounded-xl text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 ${
                    hasProd
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  {saving
                    ? "Menyimpan..."
                    : isBatch
                    ? "Timpa Semua"
                    : "Tetap Simpan & Timpa"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Cetak Barcode Potongan (Satuan) */}
      <ProductionPlanBarcodeModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        plan={barcodeModalPlan}
      />

      {/* Modal Cetak Massal A4 (6 Label / Lembar) */}
      <BatchA4BarcodeModal
        isOpen={isBatchBarcodeOpen}
        onClose={() => setIsBatchBarcodeOpen(false)}
        plans={batchBarcodePlans}
      />
    </div>
  );
}
