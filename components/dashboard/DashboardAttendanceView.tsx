"use client";

import React, { useMemo } from "react";
import { Users, AlertTriangle, TrendingUp, BarChart2 } from "lucide-react";
import { getShiftDate } from "@/lib/shift-utils";

export interface AttendanceStats {
  totalPegawai: number;
  countHadir: number;
  countTidakHadir: number;
  persentaseHadir: number;
  listHadir: {
    name: string;
    pcs: number;
    mesin: string;
  }[];
  listTidakHadir: string[];
  teamBreakdown: {
    team: string;
    key: "A" | "B" | "C";
    hadir: number;
    total: number;
    pct: number;
  }[];
}

export interface DashboardAttendanceViewProps {
  attendanceStats?: AttendanceStats;
  operatorList: { name: string; shift: string }[];
  transactions?: any[];
  uniqueOperators?: string[];
  operatorsByShift?: Record<string, string[]>;
  dateRangeMode?: "TODAY" | "7DAYS" | "30DAYS" | "CUSTOM";
  startDate?: string;
  endDate?: string;
}

export default function DashboardAttendanceView({
  attendanceStats: propStats,
  operatorList,
  transactions = [],
  uniqueOperators = [],
  operatorsByShift = { A: [], B: [], C: [], Lainnya: [] },
  dateRangeMode = "TODAY",
  startDate = "",
  endDate = "",
}: DashboardAttendanceViewProps) {
  const computedStats = useMemo<AttendanceStats>(() => {
    if (propStats) return propStats;

    const totalPegawai = uniqueOperators.length;

    let dateScoped = transactions;
    const now = new Date();
    const todayStr = getShiftDate(now);

    dateScoped = dateScoped.filter((item) => {
      const itemDate = new Date(item.tanggal);
      if (isNaN(itemDate.getTime())) return true;
      if (dateRangeMode === "TODAY")
        return item.tanggal === todayStr || itemDate.toLocaleDateString("en-CA") === todayStr;
      if (dateRangeMode === "7DAYS") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return itemDate >= sevenDaysAgo && itemDate <= now;
      }
      if (dateRangeMode === "30DAYS") {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return itemDate >= thirtyDaysAgo && itemDate <= now;
      }
      if (dateRangeMode === "CUSTOM") {
        if (!startDate && !endDate) return true;
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (start && end) {
          end.setHours(23, 59, 59, 999);
          return itemDate >= start && itemDate <= end;
        } else if (start) return itemDate >= start;
        else if (end) {
          end.setHours(23, 59, 59, 999);
          return itemDate <= end;
        }
      }
      return true;
    });

    const hadirOperators = new Set(dateScoped.map((t) => t.nama_operator).filter(Boolean));
    const countHadir = hadirOperators.size;
    const countTidakHadir = Math.max(0, totalPegawai - countHadir);
    const persentaseHadir =
      totalPegawai > 0 ? (countHadir / totalPegawai) * 100 : 0;

    const hadirDetailsMap = new Map<string, { pcs: number; mesinSet: Set<string> }>();
    dateScoped.forEach((t) => {
      if (t.nama_operator) {
        const cur = hadirDetailsMap.get(t.nama_operator) || { pcs: 0, mesinSet: new Set<string>() };
        cur.pcs += (t.hasil_pcs || 0);
        if (t.mesin_id) cur.mesinSet.add(t.mesin_id);
        hadirDetailsMap.set(t.nama_operator, cur);
      }
    });

    const listHadir = Array.from(hadirOperators)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => {
        const det = hadirDetailsMap.get(name);
        return {
          name,
          pcs: det?.pcs || 0,
          mesin: Array.from(det?.mesinSet || []).sort().join(", "),
        };
      });

    const listTidakHadir: string[] = uniqueOperators.filter(
      (op) => !hadirOperators.has(op),
    );

    const teamBreakdown = (["A", "B", "C"] as const).map((teamKey) => {
      const teamOps = operatorsByShift[teamKey] || [];
      const teamHadirCount = teamOps.filter((name) => hadirOperators.has(name)).length;
      const teamTotal = teamOps.length;
      const teamPct = teamTotal > 0 ? (teamHadirCount / teamTotal) * 100 : 0;
      return {
        team: `Tim ${teamKey}`,
        key: teamKey,
        hadir: teamHadirCount,
        total: teamTotal,
        pct: teamPct,
      };
    });

    return {
      totalPegawai,
      countHadir,
      countTidakHadir,
      persentaseHadir,
      listHadir,
      listTidakHadir,
      teamBreakdown,
    };
  }, [propStats, transactions, uniqueOperators, operatorsByShift, dateRangeMode, startDate, endDate]);

  const attendanceStats = computedStats;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Attendance KPI Cards */}
      <div
        data-tour="dashboard-kpi"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        <div className="bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-5 flex flex-col justify-between h-full min-h-[11rem] shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              Total Pegawai Pabrik
            </span>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-50 text-slate-600">
              <Users className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-black tracking-tight text-slate-800">
              {attendanceStats.totalPegawai}{" "}
              <span className="text-sm font-semibold opacity-80">
                Orang
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-500 font-bold">
              Terdaftar dalam sistem
            </div>
          </div>
        </div>

        <div className="bg-[#0070bc] rounded-xl sm:rounded-2xl p-5 flex flex-col justify-between h-full min-h-[11rem] shadow-md text-white relative overflow-hidden group hover:scale-[1.01] transition-transform">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-sky-400/20 blur-xl group-hover:scale-125 transition-all duration-300 pointer-events-none" />
          <div className="flex justify-between items-start relative z-10">
            <span className="text-sky-100 text-[10px] font-bold uppercase tracking-wider">
              Pegawai Hadir
            </span>
            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
              <Users className="w-3.5 h-3.5 text-white" />
            </span>
          </div>
          <div className="mt-2 relative z-10">
            <div className="text-3xl font-black tracking-tight flex items-baseline gap-1">
              {attendanceStats.countHadir}{" "}
              <span className="text-sm font-semibold opacity-80">
                Orang
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-sky-200 font-semibold">
              Tercatat memproduksi barang
            </div>
          </div>
        </div>

        <div className="bg-rose-50/40 border border-rose-100 rounded-xl sm:rounded-2xl p-5 flex flex-col justify-between h-full min-h-[11rem] shadow-[0_8px_30px_rgba(0,0,0,0.015)] relative">
          {attendanceStats.countTidakHadir > 0 && (
            <div className="absolute inset-0 ring-2 ring-rose-500 rounded-xl sm:rounded-2xl pointer-events-none" />
          )}
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              Tidak Hadir / 0 Hasil
            </span>
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${attendanceStats.countTidakHadir > 0 ? "bg-rose-100 text-rose-600 animate-pulse" : "bg-slate-50 text-slate-500"}`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-black tracking-tight text-slate-800">
              {attendanceStats.countTidakHadir}{" "}
              <span className="text-sm font-semibold opacity-80 text-slate-500">
                Orang
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-600 font-bold">
              Pegawai tidak ada rekaman hari ini
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-5 flex flex-col justify-between h-full min-h-[11rem] shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              Tingkat Kehadiran
            </span>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-black tracking-tight text-slate-800">
              {attendanceStats.persentaseHadir.toFixed(1)}%
            </div>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-600 font-bold">
              Persentase dari total pegawai
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Card 1: Daftar Pegawai Hadir */}
        <div className="bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col shadow-[0_8px_30px_rgba(0,0,0,0.02)] h-[440px]">
          <div className="border-b border-slate-100 pb-4 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Pegawai Hadir
              </h3>
              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {attendanceStats.countHadir} Orang
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-semibold mt-1">
              Pegawai aktif memproduksi barang di rentang waktu ini.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
            {attendanceStats.listHadir.length > 0 ? (
              attendanceStats.listHadir.map((item) => {
                const opObj = operatorList.find((o) => o.name.toLowerCase() === item.name.toLowerCase());
                const teamName = opObj?.shift ? `Tim ${opObj.shift.toUpperCase()}` : null;
                const teamColor =
                  opObj?.shift?.toUpperCase() === "A"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : opObj?.shift?.toUpperCase() === "B"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-purple-50 text-purple-700 border-purple-200";

                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {item.name.substring(0, 2)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-800 truncate">
                            {item.name}
                          </span>
                          {teamName && (
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${teamColor}`}>
                              {teamName}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold truncate">
                          {item.mesin ? `Mesin: ${item.mesin}` : "Produksi"} • {item.pcs.toLocaleString()} output
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md shrink-0 ml-2">
                      HADIR
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Users className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs font-semibold">
                  Belum ada rekaman pegawai hadir
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Daftar Tidak Hadir */}
        <div className="bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col shadow-[0_8px_30px_rgba(0,0,0,0.02)] h-[440px]">
          <div className="border-b border-slate-100 pb-4 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                Daftar Tidak Hadir
              </h3>
              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                {attendanceStats.countTidakHadir} Orang
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-semibold mt-1">
              Pegawai yang belum memiliki rekaman produksi di rentang waktu ini.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
            {attendanceStats.listTidakHadir.length > 0 ? (
              attendanceStats.listTidakHadir.map((op: string) => {
                const opObj = operatorList.find((o) => o.name.toLowerCase() === op.toLowerCase());
                const teamName = opObj?.shift ? `Tim ${opObj.shift.toUpperCase()}` : null;
                const teamColor =
                  opObj?.shift?.toUpperCase() === "A"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : opObj?.shift?.toUpperCase() === "B"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-purple-50 text-purple-700 border-purple-200";

                return (
                  <div
                    key={op}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100/50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs uppercase shrink-0">
                        {op.substring(0, 2)}
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-semibold text-slate-700 truncate">
                          {op}
                        </span>
                        {teamName && (
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${teamColor}`}>
                            {teamName}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold text-rose-500 bg-rose-50 px-2 py-1 rounded-md shrink-0 ml-2">
                      ABSENT
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Users className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs font-semibold">
                  Semua pegawai hadir!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Visualisasi Kehadiran per Tim */}
        <div className="md:col-span-2 lg:col-span-1 bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col justify-between shadow-[0_8px_30px_rgba(0,0,0,0.02)] h-[440px]">
          <div>
            <div className="border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-sky-600" />
                Kehadiran per Tim
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                Distribusi rasio kehadiran operator aktif per tim kerja.
              </p>
            </div>

            {/* Team Breakdown Bars */}
            <div className="space-y-4">
              {attendanceStats.teamBreakdown.map((tb) => {
                const barColor =
                  tb.key === "A"
                    ? "bg-blue-500"
                    : tb.key === "B"
                      ? "bg-emerald-500"
                      : "bg-purple-500";

                return (
                  <div key={tb.key} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-slate-700">
                        {tb.team}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        <strong className="text-slate-800 font-black">{tb.hadir}</strong> / {tb.total} Pegawai ({tb.pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${Math.min(100, Math.max(tb.pct, 0))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Footer Box */}
          <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100 mt-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
              {attendanceStats.persentaseHadir.toFixed(0)}%
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">
                Tingkat Kehadiran Keseluruhan
              </div>
              <div className="text-[11px] text-sky-800 font-medium mt-0.5">
                {attendanceStats.countHadir} dari {attendanceStats.totalPegawai} pegawai tercatat aktif berproduksi.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
