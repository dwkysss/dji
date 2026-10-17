"use client";

import { useMemo, useEffect } from "react";
import { getShiftDate } from "@/lib/shift-utils";
import {
  DashboardTransaction,
  isMeterItem,
  calculateStatsForDataset,
  calculateDelta,
  calculatePointDelta,
  getPreviousPeriodTransactions,
  DatasetStats,
} from "@/lib/kpi-calculation-utils";

export { type DashboardTransaction, isMeterItem, type DatasetStats };

export interface UseDashboardKpisProps {
  transactions: DashboardTransaction[];
  dateFilteredTransactions: DashboardTransaction[];
  dateRangeMode: "TODAY" | "7DAYS" | "30DAYS" | "CUSTOM";
  startDate: string;
  endDate: string;
  selectedOperators: string[];
  selectedMachines: string[];
  chartGradeFilter: "ALL" | "GRADE_A" | "GRADE_B" | "BS" | "UNGRADED";
  metricMode: "PCS" | "METER";
  cachedKpiSummary: {
    stats?: any;
    deltas?: any;
    savedAt?: string;
  } | null;
}

export function useDashboardKpis({
  transactions,
  dateFilteredTransactions,
  dateRangeMode,
  startDate,
  endDate,
  selectedOperators,
  selectedMachines,
  chartGradeFilter,
  metricMode,
  cachedKpiSummary,
}: UseDashboardKpisProps) {
  // Filter for previous period transactions (for delta comparisons)
  const prevFilteredTransactions = useMemo(() => {
    return getPreviousPeriodTransactions({
      transactions,
      dateRangeMode,
      startDate,
      endDate,
      selectedOperators,
      selectedMachines,
    });
  }, [transactions, dateRangeMode, startDate, endDate, selectedOperators, selectedMachines]);

  // Main KPI calculations
  const computedStats = useMemo(() => {
    const isMeterMode = metricMode === "METER";
    const modeScoped = dateFilteredTransactions.filter((item) => {
      const isMeter = isMeterItem(item);
      return isMeterMode ? isMeter : !isMeter;
    });
    return calculateStatsForDataset(modeScoped, chartGradeFilter, selectedOperators.length);
  }, [dateFilteredTransactions, chartGradeFilter, metricMode, selectedOperators.length]);

  // Delta computations for active vs prior period
  const computedDeltas = useMemo(() => {
    const isMeterMode = metricMode === "METER";
    const modeScopedDelta = dateFilteredTransactions.filter((item) => {
      const isMeter = isMeterItem(item);
      return isMeterMode ? isMeter : !isMeter;
    });
    const modeScopedPrev = prevFilteredTransactions.filter((item) => {
      const isMeter = isMeterItem(item);
      return isMeterMode ? isMeter : !isMeter;
    });

    const statsForDelta = calculateStatsForDataset(
      modeScopedDelta,
      chartGradeFilter,
      selectedOperators.length
    );
    const statsForPrev = calculateStatsForDataset(
      modeScopedPrev,
      chartGradeFilter,
      selectedOperators.length
    );

    return {
      oee: calculatePointDelta(statsForDelta.oee, statsForPrev.oee),
      availability: calculatePointDelta(
        statsForDelta.availability,
        statsForPrev.availability
      ),
      performance: calculatePointDelta(
        statsForDelta.performance,
        statsForPrev.performance
      ),
      quality: calculatePointDelta(statsForDelta.quality, statsForPrev.quality),
      totalProduksi: calculateDelta(
        statsForDelta.totalProduksi,
        statsForPrev.totalProduksi
      ),
      totalProduksiMeter: calculateDelta(
        statsForDelta.totalProduksiMeter,
        statsForPrev.totalProduksiMeter
      ),
      countMasalah: calculateDelta(
        statsForDelta.countMasalah,
        statsForPrev.countMasalah
      ),
    };
  }, [
    dateFilteredTransactions,
    prevFilteredTransactions,
    chartGradeFilter,
    metricMode,
    selectedOperators.length,
  ]);

  // Fallback to cached summary while live transactions are loading
  const stats = useMemo(() => {
    if (transactions.length === 0 && cachedKpiSummary?.stats) {
      return {
        ...computedStats,
        ...cachedKpiSummary.stats,
      };
    }
    return computedStats;
  }, [computedStats, transactions.length, cachedKpiSummary]);

  const deltas = useMemo(() => {
    if (transactions.length === 0 && cachedKpiSummary?.deltas) {
      return cachedKpiSummary.deltas;
    }
    return computedDeltas;
  }, [computedDeltas, transactions.length, cachedKpiSummary]);

  // Save latest KPI summary and transactions snapshot to localStorage
  useEffect(() => {
    if (transactions.length > 0 && computedStats && computedDeltas) {
      try {
        const todayShift = getShiftDate(new Date());
        const existingStr = localStorage.getItem("dji_dashboard_cache");
        const existing = existingStr ? JSON.parse(existingStr) : {};
        const payload = {
          ...existing,
          shiftDate: todayShift,
          savedAt: new Date().toISOString(),
          stats: computedStats,
          deltas: computedDeltas,
          transactions: transactions.slice(0, 500),
        };
        localStorage.setItem("dji_dashboard_cache", JSON.stringify(payload));
        localStorage.setItem("dji_dashboard_kpi_summary", JSON.stringify({
          savedAt: payload.savedAt,
          stats: computedStats,
          deltas: computedDeltas,
        }));
      } catch (e) {
        console.warn("Gagal menyimpan ringkasan KPI & transaksi:", e);
      }
    }
  }, [transactions, computedStats, computedDeltas]);

  // Human-readable grade label for KPI card subtitles
  const gradeLabel = useMemo(() => {
    if (chartGradeFilter === "GRADE_A") return "Grade A";
    if (chartGradeFilter === "GRADE_B") return "Grade B";
    if (chartGradeFilter === "BS") return "BS";
    if (chartGradeFilter === "UNGRADED") return "Belum Diinspeksi";
    return "Semua Grade";
  }, [chartGradeFilter]);

  return {
    stats,
    deltas,
    gradeLabel,
  };
}
