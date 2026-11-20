"use client";

import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { getOperatorsList } from "@/actions/operator-actions";
import {
  PowerOff,
  Save,
  RefreshCw,
  CheckCircle2,
  User,
  Calendar,
  Settings2,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  Loader2,
  RotateCcw,
  History,
  Hash,
  Sun,
  Sunset,
  Moon,
} from "lucide-react";
import { submitStatusMesin, StatusMesinInput, getLastMachineSpec } from "@/actions/status-actions";
import { getRecentPlansByMachine } from "@/actions/plan-actions";
import { getShiftName } from "@/lib/shift-utils";
import { useAuth } from "@/lib/auth-context";
import { REGISTERED_MACHINES } from "@/lib/constants";

const MESIN_OPTIONS = REGISTERED_MACHINES;

const FALLBACK_GROUPS = [
  { id: 1, name: "A" },
  { id: 2, name: "B" },
  { id: 3, name: "C" },
];

const FALLBACK_OPERATORS = [
  { id: 1, name: "Rohmat", shift: "A" }, { id: 2, name: "M.Alwi", shift: "A" }, { id: 3, name: "Anwar", shift: "A" },
  { id: 4, name: "Jaya", shift: "A" }, { id: 5, name: "Riki S", shift: "A" }, { id: 6, name: "Sandi M", shift: "A" },
  { id: 7, name: "Padlan", shift: "A" }, { id: 8, name: "Rissa A", shift: "A" }, { id: 9, name: "Devi K", shift: "A" },
  { id: 10, name: "Novi S", shift: "A" }, { id: 11, name: "Udin", shift: "A" },
  { id: 12, name: "Irfan", shift: "B" }, { id: 13, name: "Anton", shift: "B" }, { id: 14, name: "Ahmad S", shift: "B" },
  { id: 15, name: "Saepudin", shift: "B" }, { id: 16, name: "Parid", shift: "B" }, { id: 17, name: "Noval", shift: "B" },
  { id: 18, name: "Sigit", shift: "B" }, { id: 19, name: "Rani Y", shift: "B" }, { id: 20, name: "Yanti P", shift: "B" },
  { id: 21, name: "Irma P", shift: "B" }, { id: 22, name: "Aris W", shift: "B" },
  { id: 23, name: "Tubagus", shift: "C" }, { id: 24, name: "Andri Y", shift: "C" }, { id: 25, name: "Royana", shift: "C" },
  { id: 26, name: "Komara", shift: "C" }, { id: 27, name: "Sopian", shift: "C" }, { id: 28, name: "Iki S", shift: "C" },
  { id: 29, name: "Hardi", shift: "C" }, { id: 30, name: "Rini D", shift: "C" }, { id: 31, name: "Neneng", shift: "C" },
  { id: 32, name: "Rina R", shift: "C" }, { id: 33, name: "Farhan", shift: "C" }
];

const STATUS_PRESETS = ["LIBUR", "MAINTENANCE", "RUSAK", "TIDAK ADA ORDER", "MATI LISTRIK", "STAND BY"];

const SHIFT_SLOTS: Array<{
  id: "SHIFT_1" | "SHIFT_2" | "SHIFT_3";
  label: string;
  timeRange: string;
}> = [
  { id: "SHIFT_1", label: "Shift 1 (Pagi)", timeRange: "07:10 – 15:10 WIB" },
  { id: "SHIFT_2", label: "Shift 2 (Siang / Sore)", timeRange: "15:10 – 23:10 WIB" },
  { id: "SHIFT_3", label: "Shift 3 (Malam)", timeRange: "23:10 – 07:10 WIB" },
];

function FormSection({ step, title, icon, children }: { step: number; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 sm:gap-2.5">
        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#0070bc] flex items-center justify-center shrink-0">
          <span className="text-[10px] font-black text-white">{step}</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-slate-400 w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0">{icon}</span>
          <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-wider truncate">{title}</span>
        </div>
        <div className="flex-1 h-px bg-slate-100" />
      </div>
      <div className="pl-1 sm:pl-8">
        {children}
      </div>
    </div>
  );
}

export default function StatusMesinForm() {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [cakupan, setCakupan] = useState<"FULL_DAY" | "SHIFT">("FULL_DAY");
  const [shiftSlot, setShiftSlot] = useState<"SHIFT_1" | "SHIFT_2" | "SHIFT_3">(() => {
    const cur = getShiftName(new Date());
    return cur === "Shift 2" ? "SHIFT_2" : cur === "Shift 3" ? "SHIFT_3" : "SHIFT_1";
  });
  const [isRange, setIsRange] = useState(false);
  const [isLoadingSpec, setIsLoadingSpec] = useState(false);
  const [specSourceDate, setSpecSourceDate] = useState<string | null>(null);
  const [recentPlans, setRecentPlans] = useState<any[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [selectedHistoryLabel, setSelectedHistoryLabel] = useState<string | null>(null);
  const [showMaterialDetails, setShowMaterialDetails] = useState(false);

  const idempotencyKeyRef = useRef(Math.random().toString(36).substring(2, 15));

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<any>({
    defaultValues: {
      nomorMc: "",
      grupId: "",
      operatorId: "",
      potonganKe: "",
      pick: "",
      course: "",
      rpm: "",
      designId: "",
      noOrderBarang: "",
      noCustomer: "",
      jenisBenangDasar: "",
      liner: "",
      heavy: "",
      shadow: "",
      pinggiran: "",
      status: "",
      tanggalOff: new Date().toISOString().split("T")[0],
      sampaiTanggalOff: "",
    }
  });

  const [operators, setOperators] = useState(FALLBACK_OPERATORS);

  useEffect(() => {
    async function loadOperators() {
      const res = await getOperatorsList();
      if (res.success && res.data && res.data.length > 0) {
        setOperators(
          res.data.map((op) => ({
            id: op.id,
            name: op.nama_operator,
            shift: op.shift,
          }))
        );
      }
    }
    loadOperators();
  }, []);

  const selectedGrupId = watch("grupId");
  const selectedMesin = watch("nomorMc");
  const selectedTanggal = watch("tanggalOff");
  const watchNoOrder = watch("noOrderBarang");
  const watchBenangDasar = watch("jenisBenangDasar");
  const selectedGroup = FALLBACK_GROUPS.find(g => g.id.toString() === selectedGrupId);

  const applyHistoryPlan = (plan: any) => {
    if (!plan) return;
    setValue("potonganKe", plan.potongan_ke !== undefined && plan.potongan_ke !== null ? String(plan.potongan_ke) : "", { shouldValidate: true });
    setValue("designId", plan.design_id || "", { shouldValidate: true });
    setValue("rpm", plan.rpm ? String(plan.rpm) : "", { shouldValidate: true });
    setValue("pick", plan.pick || "", { shouldValidate: true });
    setValue("course", plan.course || "", { shouldValidate: true });
    setValue("noOrderBarang", plan.no_order_barang || "");
    setValue("noCustomer", plan.no_customer || "");
    setValue("jenisBenangDasar", plan.jenis_benang_dasar || "");
    setValue("liner", plan.liner || "");
    setValue("heavy", plan.heavy || "");
    setValue("shadow", plan.shadow || "");
    setValue("pinggiran", plan.pinggiran || "");
    setSpecSourceDate(plan.tgl || null);
    setSelectedHistoryLabel(
      `Potongan #${plan.potongan_ke ?? "-"} • ${plan.design_id || "-"}${plan.tgl ? ` (${plan.tgl})` : ""}`
    );
  };

  const loadLastSpec = async (mc: string, dateStr?: string) => {
    if (!mc) return;
    setIsLoadingSpec(true);
    setIsLoadingRecent(true);
    setSelectedHistoryLabel(null);
    try {
      const [specRes, recentRes] = await Promise.all([
        getLastMachineSpec(mc, dateStr),
        getRecentPlansByMachine(mc),
      ]);

      const plans = recentRes.success && recentRes.data ? recentRes.data : [];
      setRecentPlans(plans);

      if (specRes.success && specRes.data) {
        const d = specRes.data;
        setValue("potonganKe", d.potonganKe || "", { shouldValidate: true });
        setValue("designId", d.designId || "", { shouldValidate: true });
        setValue("rpm", d.rpm || "", { shouldValidate: true });
        setValue("pick", d.pick || "", { shouldValidate: true });
        setValue("course", d.course || "", { shouldValidate: true });
        setValue("noOrderBarang", d.noOrderBarang || "");
        setValue("noCustomer", d.noCustomer || "");
        setValue("jenisBenangDasar", d.jenisBenangDasar || "");
        setValue("liner", d.liner || "");
        setValue("heavy", d.heavy || "");
        setValue("shadow", d.shadow || "");
        setValue("pinggiran", d.pinggiran || "");
        setSpecSourceDate(d.sourceDate || null);
      } else if (plans.length > 0) {
        applyHistoryPlan(plans[0]);
      } else {
        setSpecSourceDate(null);
      }
    } catch (e) {
      console.error("Gagal mengambil spesifikasi terakhir:", e);
      setSpecSourceDate(null);
      setRecentPlans([]);
    } finally {
      setIsLoadingSpec(false);
      setIsLoadingRecent(false);
    }
  };

  // Otomatis tarik spesifikasi terakhir & daftar riwayat saat mesin atau tanggal dipilih/berubah
  useEffect(() => {
    if (selectedMesin) {
      loadLastSpec(selectedMesin, selectedTanggal);
    } else {
      setRecentPlans([]);
      setSpecSourceDate(null);
      setSelectedHistoryLabel(null);
    }
  }, [selectedMesin, selectedTanggal]);

  const filteredOperators = operators.filter(op => {
    if (!selectedGroup) return false;
    return op.shift === selectedGroup.name;
  });

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    data.idempotencyKey = idempotencyKeyRef.current;
    data.cakupan = cakupan;
    data.isRange = isRange;

    if (cakupan === "SHIFT") {
      const operator = operators.find(o => o.id.toString() === data.operatorId);
      data.pic = operator ? operator.name : (user?.fullName || "");
      data.shiftSlot = shiftSlot;
    } else {
      data.pic = "-";
      data.operatorId = undefined;
      data.grupId = undefined;
      data.shiftSlot = undefined;
    }
    data.status = data.status ? data.status.trim() : "";

    try {
      const result = await submitStatusMesin(data);
      if (result.success) {
        setSuccessData(data);
        idempotencyKeyRef.current = Math.random().toString(36).substring(2, 15);
      } else {
        setErrorMsg(result.error || "Gagal menyimpan status mesin.");
      }
    } catch (err: any) {
      setErrorMsg("Terjadi kesalahan sistem: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSuccess = () => {
    setSuccessData(null);
    setSelectedStatus("");
    setIsRange(false);
    setSpecSourceDate(null);
    setRecentPlans([]);
    setSelectedHistoryLabel(null);
    setShowMaterialDetails(false);
    reset({
      nomorMc: "",
      status: "",
      grupId: "",
      operatorId: "",
      potonganKe: "",
      pick: "",
      course: "",
      rpm: "",
      designId: "",
      noOrderBarang: "",
      noCustomer: "",
      jenisBenangDasar: "",
      liner: "",
      heavy: "",
      shadow: "",
      pinggiran: "",
      tanggalOff: new Date().toISOString().split("T")[0],
      sampaiTanggalOff: "",
    });
  };

  if (successData) {
    return (
      <div className="w-full max-w-lg bg-white border border-[#e9ecef] rounded-2xl sm:rounded-[24px] p-5 sm:p-8 shadow-xl flex flex-col items-center justify-center text-center animate-scaleIn">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4 sm:mb-5 shadow-inner">
          <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600" />
        </div>
        <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-1">Status Berhasil Dicatat!</h2>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mb-6 leading-relaxed">
          Mesin <strong className="text-slate-700">{successData.nomorMc}</strong> dilaporkan{" "}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-bold text-xs">
            {successData.status}
          </span>{" "}
          untuk{" "}
          <strong className="text-slate-700">
            {successData.cakupan === "FULL_DAY"
              ? "1 Hari Penuh (Semua Shift)"
              : SHIFT_SLOTS.find((s) => s.id === successData.shiftSlot)?.label || "1 Shift Tertentu"}
          </strong>{" "}
          pada <strong className="text-slate-700">{successData.tanggalOff}{successData.isRange && successData.sampaiTanggalOff ? ` s/d ${successData.sampaiTanggalOff}` : ""}</strong>.
        </p>
        <div className="w-full p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-6 grid grid-cols-2 gap-3 text-left">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Shift / Operator</div>
            <div className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5">
              {successData.cakupan === "FULL_DAY"
                ? "Semua Shift (A, B, C)"
                : `${SHIFT_SLOTS.find((s) => s.id === successData.shiftSlot)?.label || "-"} • ${successData.pic || "-"}`}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Potongan Ke</div>
            <div className="text-xs sm:text-sm font-bold text-sky-700 mt-0.5">
              {successData.potonganKe ? `Ke-${successData.potonganKe}` : "-"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Design</div>
            <div className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5">{successData.designId || "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">No. Order</div>
            <div className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5">{successData.noOrderBarang || "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">RPM</div>
            <div className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5">{successData.rpm || "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Pick / Course</div>
            <div className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5">{successData.pick || "-"} / {successData.course || "-"}</div>
          </div>
        </div>
        <button
          onClick={handleCloseSuccess}
          className="w-full h-11 sm:h-12 bg-[#0070bc] hover:bg-[#004777] active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
          Lapor Mesin Lain
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border border-[#e9ecef] rounded-2xl sm:rounded-[24px] shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 sm:gap-3 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 bg-gradient-to-r from-rose-50/60 to-white">
        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600 shrink-0">
          <PowerOff className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-black text-slate-800">Lapor Mesin Off / Stop</h2>
          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">Bypass form produksi untuk mesin libur atau stop panjang</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-3.5 sm:p-6 flex flex-col gap-5 sm:gap-7">

        {/* STEP 1 — Info Dasar & Cakupan Waktu */}
        <FormSection step={1} title="Info Dasar & Cakupan Waktu" icon={<Calendar className="w-4 h-4" />}>
          {/* Pilihan Cakupan Waktu */}
          <div className="flex flex-col gap-2 mb-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cakupan Berhenti</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setCakupan("FULL_DAY")}
                className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  cakupan === "FULL_DAY"
                    ? "bg-sky-50/80 border-sky-600 text-sky-950 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                  cakupan === "FULL_DAY" ? "border-sky-600 bg-sky-600" : "border-slate-300"
                }`}>
                  {cakupan === "FULL_DAY" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-black flex items-center gap-1.5">
                    1 Hari Penuh (Semua Shift)
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-200/70 text-sky-800">Rekomendasi</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium leading-snug mt-0.5">
                    Otomatis berlaku untuk Shift A, B, & C sekaligus (libur pabrik, stop order, dsb.)
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCakupan("SHIFT")}
                className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  cakupan === "SHIFT"
                    ? "bg-sky-50/80 border-sky-600 text-sky-950 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                  cakupan === "SHIFT" ? "border-sky-600 bg-sky-600" : "border-slate-300"
                }`}>
                  {cakupan === "SHIFT" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-black">Per Shift Tertentu</div>
                  <div className="text-[11px] text-slate-500 font-medium leading-snug mt-0.5">
                    Hanya berlaku untuk satu grup / shift operasional tertentu
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Pilihan Waktu Shift (Pagi / Siang / Malam) khusus mode Per Shift Tertentu */}
          {cakupan === "SHIFT" && (
            <div className="flex flex-col gap-1.5 mb-3 animate-fadeIn">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                Waktu Shift Operasional (Penempatan di Laporan)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {SHIFT_SLOTS.map((slot) => {
                  const isActive = shiftSlot === slot.id;
                  const SlotIcon = slot.id === "SHIFT_1" ? Sun : slot.id === "SHIFT_2" ? Sunset : Moon;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setShiftSlot(slot.id)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        isActive
                          ? "bg-sky-50/90 border-sky-600 text-sky-950 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:border-sky-300 hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? "bg-sky-600 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <SlotIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black truncate">{slot.label}</div>
                        <div className="text-[10px] font-semibold text-slate-500 truncate">{slot.timeRange}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Tanggal Mulai */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                {isRange ? "Tanggal Mulai" : "Tanggal"}
              </label>
              <input
                type="date"
                {...register("tanggalOff", { required: "Tanggal wajib diisi" })}
                className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:bg-white focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none transition-all"
              />
              {errors.tanggalOff && <p className="text-[10px] text-rose-500 font-bold">{errors.tanggalOff?.message as string}</p>}
            </div>

            {cakupan === "FULL_DAY" && isRange && (
              <div className="flex flex-col gap-1 animate-fadeIn">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Sampai Tanggal</label>
                <input
                  type="date"
                  {...register("sampaiTanggalOff")}
                  className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:bg-white focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none transition-all"
                />
              </div>
            )}

            {cakupan === "SHIFT" ? (
              <>
                {/* Grup */}
                <div className="flex flex-col gap-1 animate-fadeIn">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Grup</label>
                  <select
                    {...register("grupId", { required: cakupan === "SHIFT" ? "Grup wajib dipilih" : false })}
                    onChange={(e) => {
                      setValue("grupId", e.target.value);
                      setValue("operatorId", "");
                    }}
                    className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 focus:bg-white focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="">-- Pilih Grup --</option>
                    {FALLBACK_GROUPS.map(g => (
                      <option key={g.id} value={g.id}>Grup {g.name}</option>
                    ))}
                  </select>
                  {errors.grupId && <p className="text-[10px] text-rose-500 font-bold">{errors.grupId?.message as string}</p>}
                </div>

                {/* Operator */}
                <div className="flex flex-col gap-1 animate-fadeIn">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Operator Bertugas</label>
                  <select
                    {...register("operatorId", { required: cakupan === "SHIFT" ? "Operator wajib dipilih" : false })}
                    disabled={!selectedGrupId}
                    className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 focus:bg-white focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">{selectedGrupId ? "-- Pilih Operator --" : "-- Pilih Grup Dulu --"}</option>
                    {filteredOperators.map(op => (
                      <option key={op.id} value={op.id}>{op.name}</option>
                    ))}
                  </select>
                  {errors.operatorId && <p className="text-[10px] text-rose-500 font-bold">{errors.operatorId?.message as string}</p>}
                </div>
              </>
            ) : (
              <div className="sm:col-span-2 flex items-center gap-2 pt-5">
                <button
                  type="button"
                  onClick={() => setIsRange(!isRange)}
                  className="text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-2 rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {isRange ? "Gunakan 1 Tanggal Saja" : "+ Libur Beberapa Hari Sekaligus (Rentang Tanggal)"}
                </button>
              </div>
            )}
          </div>

          {cakupan === "FULL_DAY" && (
            <div className="mt-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Status ini akan otomatis dicatat untuk <strong>seluruh Shift (A, B, dan C)</strong> pada tanggal terpilih. Tidak perlu input berulang per shift.
              </span>
            </div>
          )}
        </FormSection>

        {/* STEP 2 — Pilih Mesin */}
        <FormSection step={2} title="Pilih Mesin" icon={<Cpu className="w-4 h-4" />}>
          <div className="flex flex-wrap gap-2">
            {MESIN_OPTIONS.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setValue("nomorMc", m, { shouldValidate: true })}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border-2 text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer ${
                  selectedMesin === m
                    ? "bg-[#0070bc] border-[#004777] text-white shadow-md shadow-sky-500/20 scale-105"
                    : "bg-white border-slate-200 text-slate-600 hover:border-sky-300 hover:bg-sky-50 active:scale-95"
                }`}
              >
                {m}
              </button>
            ))}
            <input type="hidden" {...register("nomorMc", { required: "Mesin wajib dipilih" })} />
          </div>
          {errors.nomorMc && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.nomorMc?.message as string}</p>}
          {selectedMesin ? (
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 border border-sky-200 rounded-full animate-fadeIn">
              <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              <span className="text-xs font-bold text-sky-700">Mesin Dipilih: {selectedMesin}</span>
            </div>
          ) : (
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold animate-fadeIn">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Silakan klik salah satu tombol mesin di atas (cth: <strong>R1</strong>) untuk memuat spesifikasi otomatis.</span>
            </div>
          )}
        </FormSection>

        {/* STEP 3 — Spesifikasi & Riwayat */}
        <FormSection step={3} title="Spesifikasi & Parameter Produksi" icon={<Settings2 className="w-4 h-4" />}>
          {/* Dropdown Salin dari Riwayat Mesin */}
          {selectedMesin && (
            <div className="mb-4 p-3.5 sm:p-4 bg-sky-50/80 border border-sky-200 rounded-2xl flex flex-col gap-2 shadow-2xs animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-[11px] font-black text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  Pilih dari Riwayat Mesin {selectedMesin} (Potongan & Desain)
                </label>
                {isLoadingRecent ? (
                  <span className="text-[10px] text-sky-600 font-bold flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Memuat riwayat...
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-600 font-semibold bg-white px-2.5 py-0.5 rounded-full border border-sky-200">
                    {recentPlans.length} riwayat ditemukan
                  </span>
                )}
              </div>

              <select
                disabled={isLoadingRecent || recentPlans.length === 0}
                defaultValue=""
                className="h-11 px-3.5 rounded-xl border border-sky-200 focus:border-[#0070bc] focus:ring-4 focus:ring-sky-400/20 outline-none font-bold text-slate-800 text-xs bg-white shadow-xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                onChange={(e) => {
                  if (!e.target.value) return;
                  const selected = recentPlans.find((p) => p.id === e.target.value);
                  if (selected) {
                    applyHistoryPlan(selected);
                  }
                  e.target.value = "";
                }}
              >
                <option value="">
                  {isLoadingRecent
                    ? "-- Sedang memuat riwayat mesin... --"
                    : recentPlans.length === 0
                    ? "-- Belum ada riwayat tercatat untuk mesin ini --"
                    : "-- Pilih Riwayat untuk Mengisi Parameter Lengkap (Potongan, Design, Order, Benang) --"}
                </option>
                {recentPlans.map((rp, idx) => (
                  <option key={rp.id} value={rp.id}>
                    {idx === 0 ? "★ [Terakhir] " : ""}Potongan #{rp.potongan_ke ?? "-"} | Design: {rp.design_id || "-"} | Order: {rp.no_order_barang || "-"} | RPM: {rp.rpm || "-"}{rp.tgl ? ` (${rp.tgl})` : ""}
                  </option>
                ))}
              </select>

              {selectedHistoryLabel && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg animate-fadeIn">
                  <span>Parameter disalin dari riwayat: {selectedHistoryLabel}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-[11px] text-slate-500 font-medium">
              Parameter teknis & nomor potongan aktif mesin (otomatis terisi dari riwayat terakhir, dapat diubah manual).
            </p>
            {isLoadingSpec && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 border border-sky-200 rounded-lg text-sky-700 text-xs font-bold animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                <span>Mengambil spesifikasi data sebelumnya...</span>
              </div>
            )}
            {!isLoadingSpec && specSourceDate && !selectedHistoryLabel && (
              <div className="inline-flex items-center px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold animate-fadeIn">
                <span>Terisi otomatis dari data tgl {specSourceDate}</span>
              </div>
            )}
            {!isLoadingSpec && !selectedMesin && (
              <div className="inline-flex items-center px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-xs font-medium">
                <span>Pilih mesin di Langkah 2 terlebih dahulu</span>
              </div>
            )}
            {!isLoadingSpec && !specSourceDate && selectedMesin && (
              <button
                type="button"
                onClick={() => loadLastSpec(selectedMesin, selectedTanggal)}
                className="text-[11px] font-bold text-sky-600 hover:text-sky-800 hover:underline cursor-pointer"
              >
                Cek Spec Terakhir
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-sky-700 uppercase tracking-wider flex items-center gap-1">
                <Hash className="w-3 h-3" /> Potongan Ke
              </label>
              <input
                type="number"
                inputMode="numeric"
                {...register("potonganKe", { required: "Potongan ke wajib diisi (atau pilih dari riwayat)" })}
                placeholder="cth: 596"
                className="h-11 px-3 rounded-xl bg-sky-50/50 border border-sky-200 text-sm font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-400 outline-none transition-all"
              />
              {errors.potonganKe && <p className="text-[10px] text-rose-500 font-bold">{errors.potonganKe?.message as string}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Design</label>
              <input
                type="text"
                {...register("designId", { required: "Design wajib diisi" })}
                placeholder="cth: TCD 5826"
                className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:bg-white focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none transition-all"
              />
              {errors.designId && <p className="text-[10px] text-rose-500 font-bold">{errors.designId?.message as string}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">RPM</label>
              <input
                type="text"
                {...register("rpm", { required: "RPM wajib diisi" })}
                placeholder="cth: 240"
                className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:bg-white focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none transition-all"
              />
              {errors.rpm && <p className="text-[10px] text-rose-500 font-bold">{errors.rpm?.message as string}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Pick</label>
              <input
                type="text"
                {...register("pick", { required: "Pick wajib diisi" })}
                placeholder="cth: 44"
                className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:bg-white focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none transition-all"
              />
              {errors.pick && <p className="text-[10px] text-rose-500 font-bold">{errors.pick?.message as string}</p>}
            </div>
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Course</label>
              <input
                type="text"
                {...register("course", { required: "Course wajib diisi" })}
                placeholder="cth: 68"
                className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:bg-white focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none transition-all"
              />
              {errors.course && <p className="text-[10px] text-rose-500 font-bold">{errors.course?.message as string}</p>}
            </div>
          </div>

          {/* Toggle Detail Order & Material Benang */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowMaterialDetails((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span>Detail Order & Material Benang (Opsional)</span>
                {(watchNoOrder || watchBenangDasar) && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold truncate max-w-[200px] sm:max-w-xs">
                    {watchNoOrder ? `Order: ${watchNoOrder}` : "Material Terisi"}
                  </span>
                )}
              </div>
              {showMaterialDetails ? (
                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>

            {showMaterialDetails && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 bg-slate-50/70 border border-slate-200 rounded-2xl animate-fadeIn">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">No. Order Barang</label>
                  <input
                    type="text"
                    {...register("noOrderBarang")}
                    placeholder="cth: EXR/26/130"
                    className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">No. Customer</label>
                  <input
                    type="text"
                    {...register("noCustomer")}
                    placeholder="Opsional"
                    className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Benang Dasar</label>
                  <input
                    type="text"
                    {...register("jenisBenangDasar")}
                    placeholder="Opsional"
                    className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Liner</label>
                  <input
                    type="text"
                    {...register("liner")}
                    placeholder="Opsional"
                    className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Heavy</label>
                  <input
                    type="text"
                    {...register("heavy")}
                    placeholder="Opsional"
                    className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Shadow</label>
                  <input
                    type="text"
                    {...register("shadow")}
                    placeholder="Opsional"
                    className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1 col-span-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Pinggiran</label>
                  <input
                    type="text"
                    {...register("pinggiran")}
                    placeholder="Opsional"
                    className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </FormSection>

        {/* STEP 4 — Status */}
        <FormSection step={4} title="Status Berhenti" icon={<AlertTriangle className="w-4 h-4" />}>
          {/* Preset chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            {STATUS_PRESETS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSelectedStatus(s);
                  setValue("status", s, { shouldValidate: true });
                }}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wide transition-all duration-200 cursor-pointer ${
                  selectedStatus === s
                    ? "bg-rose-600 border-rose-700 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Manual input */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-slate-400">Atau ketik manual:</label>
            <input
              type="text"
              {...register("status", { required: "Status mesin wajib diisi" })}
              placeholder="Ketik alasan berhenti..."
              onChange={(e) => {
                register("status").onChange(e);
                setSelectedStatus(e.target.value.trim().toUpperCase());
              }}
              className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:bg-white focus:border-rose-400 focus:ring-1 focus:ring-rose-400 outline-none transition-all"
            />
            {errors.status && <p className="text-[10px] text-rose-500 font-bold">{errors.status?.message as string}</p>}
          </div>
        </FormSection>

        {/* Error */}
        {errorMsg && (
          <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-13 py-3.5 mt-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] text-sm"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" /> Menyimpan...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" /> Laporkan Status Mesin
            </>
          )}
        </button>

      </form>
    </div>
  );
}
