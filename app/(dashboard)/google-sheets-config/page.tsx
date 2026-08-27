"use client";

import React, { useState, useEffect } from "react";
import { 
  getGoogleSheetConfigs, 
  updateGoogleSheetConfig, 
  GoogleSheetConfigItem,
  getAutoSyncScheduleSettings,
  updateAutoSyncScheduleSettings,
  syncAllMonthlyMachines
} from "@/actions/google-sheet-actions";
import { 
  FileSpreadsheet, 
  Link as LinkIcon, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  RefreshCw,
  Sliders,
  Clock,
  Zap,
  ShieldCheck,
  Check
} from "lucide-react";

export default function GoogleSheetsConfigPage() {
  const [configs, setConfigs] = useState<GoogleSheetConfigItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Auto-Sync Schedule States
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleSafeMode, setScheduleSafeMode] = useState(true);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isTestingSchedule, setIsTestingSchedule] = useState(false);

  // Form states per item
  const [formData, setFormData] = useState<Record<string, {
    web_app_url: string;
    spreadsheet_id: string;
    is_active: boolean;
  }>>({});

  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchConfigs();
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      const res = await getAutoSyncScheduleSettings();
      if (res.success) {
        setScheduleTime(res.time);
        setScheduleEnabled(res.enabled);
        setScheduleSafeMode(res.safeMode);
      }
    } catch (_) {}
  };

  const fetchConfigs = async () => {
    setIsLoading(true);
    try {
      const res = await getGoogleSheetConfigs();
      if (res.success && res.data) {
        // Filter out auto_sync_schedule from general report cards
        const reportConfigs = res.data.filter(c => c.id !== "auto_sync_schedule");
        setConfigs(reportConfigs);
        const initialForm: Record<string, any> = {};
        reportConfigs.forEach((item) => {
          initialForm[item.id] = {
            web_app_url: item.web_app_url || "",
            spreadsheet_id: item.spreadsheet_id || "",
            is_active: item.is_active ?? true,
          };
        });
        setFormData(initialForm);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (id: string, field: "web_app_url" | "spreadsheet_id" | "is_active", val: any) => {
    setFormData((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: val,
      },
    }));
  };

  const handleSaveConfig = async (id: string) => {
    const data = formData[id];
    if (!data) return;

    setSavingId(id);
    try {
      const res = await updateGoogleSheetConfig(id, {
        web_app_url: data.web_app_url,
        spreadsheet_id: data.spreadsheet_id,
        is_active: data.is_active,
      });

      if (res.success) {
        setToast({
          type: "success",
          message: "Konfigurasi Google Sheet berhasil diperbarui!",
        });
        setTimeout(() => setToast(null), 4000);
        fetchConfigs();
      } else {
        setToast({
          type: "error",
          message: res.error || "Gagal menyimpan konfigurasi.",
        });
      }
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Terjadi kesalahan sistem.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveSchedule = async () => {
    setIsSavingSchedule(true);
    try {
      const res = await updateAutoSyncScheduleSettings({
        time: scheduleTime,
        enabled: scheduleEnabled,
        safeMode: scheduleSafeMode,
      });

      if (res.success) {
        setToast({
          type: "success",
          message: `Jadwal Auto-Sync berhasil disimpan! (Setiap hari pukul ${scheduleTime} WIB)`,
        });
        setTimeout(() => setToast(null), 4500);
      } else {
        setToast({
          type: "error",
          message: res.error || "Gagal menyimpan jadwal auto-sync.",
        });
      }
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Terjadi kesalahan saat menyimpan jadwal.",
      });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleTestAutoSync = async () => {
    setIsTestingSchedule(true);
    try {
      const res = await syncAllMonthlyMachines(undefined, undefined, scheduleSafeMode);
      if (res.success) {
        setToast({
          type: "success",
          message: `Test Auto-Sync Berhasil: ${res.message}`,
        });
        setTimeout(() => setToast(null), 5000);
      } else {
        setToast({
          type: "error",
          message: res.message || "Gagal melakukan test auto-sync.",
        });
      }
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Terjadi kesalahan saat menjalankan test auto-sync.",
      });
    } finally {
      setIsTestingSchedule(false);
    }
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto pb-24 animate-fadeIn">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 text-white ${
          toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"
        }`}>
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {/* HEADER CARD */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-[28px] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-200 text-white shrink-0">
            <FileSpreadsheet className="w-7 h-7 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Integrasi Google Sheets
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                Admin Panel
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-500 mt-0.5">
              Kelola jadwal sinkronisasi otomatis harian dan endpoint Google Apps Script untuk masing-masing laporan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            type="button"
            onClick={() => { fetchConfigs(); fetchSchedule(); }}
            disabled={isLoading}
            className="p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all cursor-pointer shadow-2xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ⏰ JADWAL AUTO-SYNC HARIAN CARD */}
      <div className="mb-8 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent bg-white p-6 sm:p-8 rounded-[28px] border-2 border-amber-200 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-100 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-200 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-800">
                  Jadwal Otomatis Harian (Auto-Sync Cron)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 uppercase">
                  Waktu WIB
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Sistem akan menyinkronkan seluruh 10 mesin secara otomatis pada jam yang Anda tentukan setiap hari.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none self-start sm:self-auto">
            <span className="text-xs font-bold text-slate-700">
              {scheduleEnabled ? "Auto-Sync Aktif" : "Auto-Sync Nonaktif"}
            </span>
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600 relative"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
          {/* Jam Eksekusi */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Pilih Waktu Eksekusi Harian (WIB)
            </label>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="h-12 px-4 rounded-2xl bg-white border-2 border-amber-200 text-sm font-black text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none w-full transition-all shadow-xs"
            />
          </div>

          {/* Mode Keamanan */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Mode Eksekusi
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScheduleSafeMode(true)}
                className={`flex-1 h-12 rounded-2xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  scheduleSafeMode 
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs" 
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                🛡️ Mode Aman
              </button>
              <button
                type="button"
                onClick={() => setScheduleSafeMode(false)}
                className={`flex-1 h-12 rounded-2xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  !scheduleSafeMode 
                    ? "border-amber-500 bg-amber-50 text-amber-800 shadow-xs" 
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                🔄 Timpa Semua
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-5 md:pt-0 self-end md:self-center">
            <button
              type="button"
              onClick={handleSaveSchedule}
              disabled={isSavingSchedule}
              className="flex-1 h-12 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black text-xs shadow-md shadow-amber-200 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSavingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Jadwal
            </button>
            <button
              type="button"
              onClick={handleTestAutoSync}
              disabled={isTestingSchedule}
              className="h-12 px-4 rounded-2xl border-2 border-amber-300 hover:bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Jalankan simulasi auto-sync 10 mesin sekarang"
            >
              {isTestingSchedule ? <Loader2 className="w-4 h-4 animate-spin text-amber-700" /> : <Zap className="w-4 h-4 text-amber-600" />}
              <span className="hidden sm:inline">Uji Sekarang</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONFIGURATION LIST */}
      <div className="mb-4">
        <h2 className="text-lg font-black text-slate-800 tracking-tight mb-1">
          Daftar Endpoint Google Apps Script per Laporan
        </h2>
        <p className="text-xs font-semibold text-slate-400">
          Masukkan Web App URL yang Anda dapatkan setelah melakukan Deploy di Google Apps Script masing-masing file sheet.
        </p>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-[28px] p-16 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
          <h3 className="text-lg font-black text-slate-800 mb-1">Memuat Konfigurasi Integrasi...</h3>
        </div>
      ) : (
        <div className="space-y-6">
          {configs.map((cfg) => {
            const form = formData[cfg.id] || {
              web_app_url: cfg.web_app_url || "",
              spreadsheet_id: cfg.spreadsheet_id || "",
              is_active: cfg.is_active ?? true,
            };
            const isSaving = savingId === cfg.id;

            return (
              <div
                key={cfg.id}
                className="bg-white rounded-[28px] p-6 sm:p-7 shadow-sm border border-slate-200 transition-all hover:border-emerald-300 flex flex-col gap-5"
              >
                {/* Header Item */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800">
                        {cfg.report_name}
                      </h3>
                      <p className="text-xs font-semibold text-slate-400">
                        {cfg.description || "Endpoint pengiriman data laporan ke Google Sheets"}
                      </p>
                    </div>
                  </div>

                  {/* Status Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto select-none">
                    <span className="text-xs font-bold text-slate-600">
                      {form.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => handleFieldChange(cfg.id, "is_active", e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 relative"></div>
                  </label>
                </div>

                {/* Form Inputs */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  {/* Web App URL */}
                  <div className="lg:col-span-8 space-y-1.5">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-emerald-600" />
                      URL Google Apps Script (Web App Endpoint)
                    </label>
                    <input
                      type="url"
                      value={form.web_app_url}
                      onChange={(e) => handleFieldChange(cfg.id, "web_app_url", e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="h-11 px-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none w-full transition-all shadow-inner"
                    />
                  </div>

                  {/* Spreadsheet ID */}
                  <div className="lg:col-span-4 space-y-1.5">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-slate-400" />
                      Spreadsheet ID (Opsional)
                    </label>
                    <input
                      type="text"
                      value={form.spreadsheet_id}
                      onChange={(e) => handleFieldChange(cfg.id, "spreadsheet_id", e.target.value)}
                      placeholder="Contoh: 1Vtbz1xCpJQpeNE..."
                      className="h-11 px-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none w-full transition-all shadow-inner"
                    />
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <div className="text-[11px] text-slate-400 font-semibold">
                    Kunci Laporan: <code className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold">{cfg.id}</code>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveConfig(cfg.id)}
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-md shadow-emerald-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
