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
  Cpu,
} from "lucide-react";
import { submitStatusMesin, StatusMesinInput } from "@/actions/status-actions";
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

function FormSection({ step, title, icon, children }: { step: number; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-full bg-[#0070bc] flex items-center justify-center shrink-0">
          <span className="text-[10px] font-black text-white">{step}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 w-4 h-4">{icon}</span>
          <span className="text-xs font-black text-slate-600 uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex-1 h-px bg-slate-100" />
      </div>
      <div className="pl-8">
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

  const idempotencyKeyRef = useRef(Math.random().toString(36).substring(2, 15));

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<any>({
    defaultValues: {
      nomorMc: "",
      grupId: "",
      operatorId: "",
      pick: "",
      course: "",
      rpm: "",
      designId: "",
      status: "",
      tanggalOff: new Date().toISOString().split("T")[0],
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
  const selectedGroup = FALLBACK_GROUPS.find(g => g.id.toString() === selectedGrupId);

  const filteredOperators = operators.filter(op => {
    if (!selectedGroup) return false;
    return op.shift === selectedGroup.name;
  });

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    data.idempotencyKey = idempotencyKeyRef.current;
    const operator = operators.find(o => o.id.toString() === data.operatorId);
    data.pic = operator ? operator.name : (user?.fullName || "");
    data.status = data.status ? data.status.toUpperCase() : "";

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
    reset({
      nomorMc: "",
      status: "",
      grupId: "",
      operatorId: "",
      pick: "",
      course: "",
      rpm: "",
      designId: "",
      tanggalOff: new Date().toISOString().split("T")[0],
    });
  };

  if (successData) {
    return (
      <div className="w-full max-w-lg bg-white border border-[#e9ecef] rounded-[24px] p-8 shadow-xl flex flex-col items-center justify-center text-center animate-scaleIn">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5 shadow-inner">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-xl font-black text-slate-800 mb-1">Status Berhasil Dicatat!</h2>
        <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">
          Mesin <strong className="text-slate-700">{successData.nomorMc}</strong> dilaporkan{" "}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-bold text-xs">
            {successData.status}
          </span>{" "}
          pada <strong className="text-slate-700">{successData.tanggalOff}</strong>.
        </p>
        <div className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-6 grid grid-cols-2 gap-3 text-left">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Operator</div>
            <div className="text-sm font-bold text-slate-700 mt-0.5">{successData.pic}</div>
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Design</div>
            <div className="text-sm font-bold text-slate-700 mt-0.5">{successData.designId || "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">RPM</div>
            <div className="text-sm font-bold text-slate-700 mt-0.5">{successData.rpm || "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Pick / Course</div>
            <div className="text-sm font-bold text-slate-700 mt-0.5">{successData.pick || "-"} / {successData.course || "-"}</div>
          </div>
        </div>
        <button
          onClick={handleCloseSuccess}
          className="w-full h-12 bg-[#0070bc] hover:bg-[#004777] active:scale-95 text-white text-sm font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
        >
          <ChevronRight className="w-4 h-4" />
          Lapor Mesin Lain
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border border-[#e9ecef] rounded-[24px] shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-rose-50/60 to-white">
        <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600 shrink-0">
          <PowerOff className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-800">Lapor Mesin Off / Stop</h2>
          <p className="text-[11px] text-slate-500 font-medium">Bypass form produksi untuk mesin libur atau stop panjang</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 flex flex-col gap-7">

        {/* STEP 1 — Info Dasar */}
        <FormSection step={1} title="Info Dasar" icon={<Calendar className="w-4 h-4" />}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Tanggal */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tanggal</label>
              <input
                type="date"
                {...register("tanggalOff", { required: "Tanggal wajib diisi" })}
                className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:bg-white focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none transition-all"
              />
              {errors.tanggalOff && <p className="text-[10px] text-rose-500 font-bold">{errors.tanggalOff?.message as string}</p>}
            </div>

            {/* Grup */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Grup / Shift</label>
              <select
                {...register("grupId", { required: "Grup wajib dipilih" })}
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
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Operator Bertugas</label>
              <select
                {...register("operatorId", { required: "Operator wajib dipilih" })}
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
          </div>
        </FormSection>

        {/* STEP 2 — Pilih Mesin */}
        <FormSection step={2} title="Pilih Mesin" icon={<Cpu className="w-4 h-4" />}>
          <div className="flex flex-wrap gap-2">
            {MESIN_OPTIONS.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setValue("nomorMc", m, { shouldValidate: true })}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-black transition-all duration-200 ${
                  selectedMesin === m
                    ? "bg-[#0070bc] border-[#004777] text-white shadow-md shadow-sky-500/20"
                    : "bg-white border-slate-200 text-slate-600 hover:border-sky-300 hover:bg-sky-50"
                }`}
              >
                {m}
              </button>
            ))}
            <input type="hidden" {...register("nomorMc", { required: "Mesin wajib dipilih" })} />
          </div>
          {errors.nomorMc && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.nomorMc?.message as string}</p>}
          {selectedMesin && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 border border-sky-200 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span className="text-xs font-bold text-sky-700">Dipilih: {selectedMesin}</span>
            </div>
          )}
        </FormSection>

        {/* STEP 3 — Spesifikasi */}
        <FormSection step={3} title="Spesifikasi Terakhir" icon={<Settings2 className="w-4 h-4" />}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <div className="flex flex-col gap-1">
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
                className={`px-3 py-1.5 rounded-lg border-2 text-[11px] font-black uppercase tracking-wide transition-all duration-200 ${
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
                setSelectedStatus(e.target.value.toUpperCase());
              }}
              className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:bg-white focus:border-rose-400 focus:ring-1 focus:ring-rose-400 outline-none transition-all uppercase"
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
