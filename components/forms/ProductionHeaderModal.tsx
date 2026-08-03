import React from "react";
import { X, Save, Settings2, Trash2, Plus, Minus, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { UseFormRegister, FieldErrors, UseFormWatch } from "react-hook-form";
import { ProductionFormInput } from "@/lib/schemas";

interface ProductionHeaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  watch: UseFormWatch<any>;
  groups: any[];
  operators: any[];
  activeShiftName: string;
  onClearHeader: () => void;
  highlightPotonganKe?: boolean;
  highlightOperator?: boolean;
  pcsCount?: number;
  onChangePcsCount?: (count: number) => void;
}

export default function ProductionHeaderModal({
  isOpen,
  onClose,
  register,
  errors,
  watch,
  groups,
  operators,
  activeShiftName,
  onClearHeader,
  highlightPotonganKe,
  highlightOperator,
  pcsCount,
  onChangePcsCount,
}: ProductionHeaderModalProps) {
  const { user } = useAuth();

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${isOpen ? '' : 'hidden'}`}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Konfigurasi Header Produksi</h2>
              <p className="text-xs font-semibold text-slate-500">Konfigurasi ini akan berlaku untuk semua panel/roll yang Anda input.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClearHeader} className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors">
              <Trash2 className="w-3 h-3" />
              Reset Header
            </button>
            <button onClick={onClose} type="button" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Modal (Form) */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {/* Banner Peringatan Pergantian Shift (Jika ada highlightOperator) */}
          {highlightOperator && (
            <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-start gap-3 animate-fadeIn shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Settings2 className="w-4 h-4 animate-spin" />
              </div>
              <div>
                <h4 className="text-xs font-black text-amber-900 uppercase">
                  Penggantian Shift - Harap Ganti Nama Operator
                </h4>
                <p className="text-[11px] font-semibold text-amber-800 mt-0.5 leading-relaxed">
                  Laporan Akhir Shift telah disimpan. Silakan pilih <strong>Nama Operator & Grup Shift</strong> yang bertugas untuk shift baru ini.
                </p>
              </div>
            </div>
          )}

          {/* Operator & Grup */}
          <div className={`flex flex-col gap-4 mb-6 p-5 rounded-xl border transition-all duration-500 ${
            highlightOperator 
              ? 'bg-amber-50/70 border-2 border-amber-400 shadow-md ring-2 ring-amber-400 ring-offset-2' 
              : 'bg-slate-50 border-slate-100'
          }`}>
            <div className="flex flex-col gap-2">
              <label className={`text-[10px] font-bold uppercase tracking-wider ${highlightOperator ? 'text-amber-900' : 'text-slate-500'}`}>
                Grup Shift *
              </label>
              <select {...register("groupId")} className={`h-11 px-4 rounded-xl text-sm font-semibold transition-all outline-none ${
                highlightOperator
                  ? 'bg-white border-2 border-amber-400 text-amber-900 font-extrabold focus:ring-4 focus:ring-amber-400/20'
                  : 'bg-white border border-slate-200 text-slate-700 focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 shadow-sm'
              }`}>
                {groups.map(g => <option key={g.id} value={g.id.toString()}>Grup {g.name}</option>)}
              </select>
              {errors.groupId && <span className="text-red-500 text-[10px] font-bold">{errors.groupId.message as string}</span>}
            </div>
            
            <div className="flex flex-col gap-2">
              <label className={`text-[10px] font-bold uppercase tracking-wider ${highlightOperator ? 'text-amber-900' : 'text-slate-500'}`}>
                Nama Operator (Shift {activeShiftName}) * {highlightOperator && <span className="text-amber-600 ml-1 font-black animate-pulse">(Wajib Disesuaikan)</span>}
              </label>
              <select {...register("operatorId")} className={`h-11 px-4 rounded-xl text-sm font-semibold transition-all outline-none ${
                highlightOperator
                  ? 'bg-white border-2 border-amber-500 text-amber-900 font-black focus:ring-4 focus:ring-amber-400/20 shadow-md ring-2 ring-amber-300'
                  : 'bg-white border border-slate-200 text-slate-700 focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 shadow-sm'
              }`}>
                <option value="">-- Pilih Operator --</option>
                {operators.map(op => <option key={op.id} value={op.id.toString()}>{op.name}</option>)}
              </select>
              {errors.operatorId && <span className="text-red-500 text-[10px] font-bold">{errors.operatorId.message as string}</span>}
            </div>

            {/* Target Jumlah PCS (Read-Only / Configured by Admin) */}
            {pcsCount !== undefined && (
              <div className="mt-2 p-4 bg-slate-100/80 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      Jumlah PCS per Panel
                      <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-black">Diatur Admin</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      Jumlah potongan PCS otomatis ditentukan dari Jadwal Produksi Admin.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm shrink-0 self-center sm:self-auto">
                  <span className="text-lg font-black text-slate-800">
                    {pcsCount}
                  </span>
                  <span className="text-xs font-bold text-slate-500 uppercase">PCS</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
            {/* Kolom Kiri */}
            <div className="space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Status Matching *</label>
                <select {...register("statusMatching")} className="h-11 px-4 rounded-xl bg-sky-50 border border-sky-200 text-sm focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20 outline-none font-bold text-sky-900 transition-all">
                  <option value="">-- Wajib Pilih --</option>
                  <option value="OK">OK</option>
                  <option value="Tidak OK">Tidak OK</option>
                </select>
                {errors.statusMatching && <span className="text-red-500 text-[10px] font-bold">{errors.statusMatching.message as string}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Design *</label>
                <input type="text" {...register("designId")} placeholder="Ketik nama design..." className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 outline-none shadow-sm transition-all uppercase" />
                {errors.designId && <span className="text-red-500 text-[10px] font-bold">{errors.designId.message as string}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Nomor Mesin</label>
                <select {...register("nomorMc")} className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 outline-none shadow-sm transition-all">
                  <option value="">-- Pilih --</option>
                  {["R1", "R2", "R3B", "R1C", "R2C", "R11", "R12", "R16", "T1C", "T2A", "Warping D6", "Winding"].map(mc => (
                    <option key={mc} value={mc}>{mc}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">RPM</label>
                <input type="number" inputMode="numeric" onWheel={(e) => (e.target as HTMLElement).blur()} {...register("rpm")} placeholder="Misal: 540" className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 outline-none shadow-sm transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Pick</label>
                  <input type="text" {...register("pick")} placeholder="Misal: 16 atau 18, 8" className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 outline-none shadow-sm transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Course</label>
                  <input type="number" inputMode="numeric" onWheel={(e) => (e.target as HTMLElement).blur()} {...register("course")} placeholder="Misal: 546" className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 outline-none shadow-sm transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">No. Order Barang</label>
                  <input type="text" {...register("noOrderBarang")} placeholder="EXT/..." className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 outline-none shadow-sm transition-all uppercase" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">No. Customer</label>
                  <input type="number" inputMode="numeric" onWheel={(e) => (e.target as HTMLElement).blur()} {...register("noCustomer")} placeholder="Customer..." className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 outline-none shadow-sm transition-all" />
                </div>
              </div>
            </div>

            {/* Kolom Kanan */}
            <div className="space-y-5">
              <div className={`flex flex-col gap-1.5 p-4 rounded-xl border transition-all duration-500 ${highlightPotonganKe ? 'bg-amber-100 border-amber-400 shadow-md ring-2 ring-amber-400 ring-offset-2' : 'bg-sky-50/50 border-sky-100'}`}>
                <label className={`text-[10px] font-black uppercase tracking-wider ${highlightPotonganKe ? 'text-amber-800' : 'text-sky-700'}`}>
                  Potongan Ke * {highlightPotonganKe && <span className="text-emerald-600 ml-1 animate-pulse">(+1 Otomatis Karena Potong Kain)</span>}
                </label>
                <input type="number" inputMode="numeric" onWheel={(e) => (e.target as HTMLElement).blur()} {...register("potonganKe")} className={`h-11 px-4 rounded-xl bg-white border text-sm font-black focus:ring-4 outline-none shadow-sm transition-all placeholder:font-medium ${highlightPotonganKe ? 'border-amber-400 text-amber-900 focus:border-amber-500 focus:ring-amber-400/20' : 'border-sky-300 text-sky-900 focus:border-sky-500 focus:ring-sky-400/20'}`} placeholder="Misal: 288 (Wajib diisi)" />
                {errors.potonganKe && <span className="text-red-500 text-[10px] font-bold mt-1">{errors.potonganKe.message as string}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Jenis benang dasar</label>
                <input type="text" {...register("jenisBenangDasar")} className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 outline-none shadow-sm transition-all uppercase" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Liner</label>
                <input type="text" {...register("liner")} className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 outline-none shadow-sm transition-all uppercase" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Heavy</label>
                <input type="text" {...register("heavy")} className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 outline-none shadow-sm transition-all uppercase" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Shadow</label>
                <input type="text" {...register("shadow")} className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 outline-none shadow-sm transition-all uppercase" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Pinggiran</label>
                <input type="text" {...register("pinggiran")} className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 outline-none shadow-sm transition-all uppercase" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-[#0070bc] hover:bg-[#005a96] text-white font-bold text-sm rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Simpan Konfigurasi
          </button>
        </div>
      </div>
    </div>
  );
}
