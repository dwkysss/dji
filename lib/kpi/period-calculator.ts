import { DashboardTransaction, DeltaResult, PeriodFilterOptions } from "./kpi-types";

export function calculateDelta(curr: number, prev: number): DeltaResult {
  if (prev === 0) {
    if (curr > 0) return { value: 100, type: "up" };
    return { value: 0, type: "flat" };
  }
  const diff = curr - prev;
  const pct = (diff / prev) * 100;
  return {
    value: parseFloat(pct.toFixed(1)),
    type: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
  };
}

export function calculatePointDelta(curr: number, prev: number): DeltaResult {
  const diff = curr - prev;
  return {
    value: parseFloat(diff.toFixed(1)),
    type: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
  };
}

function filterByCustomRange(
  transactions: DashboardTransaction[],
  startDate: string,
  endDate: string
): DashboardTransaction[] {
  if (!startDate && !endDate) return [];
  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : new Date();

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

  const prevStart = new Date(start);
  prevStart.setDate(start.getDate() - diffDays);
  const prevEnd = new Date(start);

  return transactions.filter((item) => {
    const itemDate = new Date(item.tanggal);
    if (isNaN(itemDate.getTime())) return false;
    return itemDate >= prevStart && itemDate < prevEnd;
  });
}

function filterByDaysBack(
  transactions: DashboardTransaction[],
  daysBackStart: number,
  daysBackEnd: number
): DashboardTransaction[] {
  const now = new Date();
  const startLimit = new Date();
  startLimit.setDate(now.getDate() - daysBackStart);
  const endLimit = new Date();
  endLimit.setDate(now.getDate() - daysBackEnd);

  return transactions.filter((item) => {
    const itemDate = new Date(item.tanggal);
    if (isNaN(itemDate.getTime())) return false;
    return itemDate >= endLimit && itemDate < startLimit;
  });
}

export function getPreviousPeriodTransactions(
  optionsOrTransactions: PeriodFilterOptions | DashboardTransaction[],
  dateRangeMode?: "TODAY" | "7DAYS" | "30DAYS" | "CUSTOM",
  startDate?: string,
  endDate?: string,
  selectedOperators?: string[],
  selectedMachines?: string[]
): DashboardTransaction[] {
  const options: PeriodFilterOptions = Array.isArray(optionsOrTransactions)
    ? {
        transactions: optionsOrTransactions,
        dateRangeMode: dateRangeMode || "TODAY",
        startDate: startDate || "",
        endDate: endDate || "",
        selectedOperators: selectedOperators || [],
        selectedMachines: selectedMachines || [],
      }
    : optionsOrTransactions;

  let result = options.transactions;

  if (options.dateRangeMode === "TODAY") {
    const yesterday = new Date();
    yesterday.setDate(new Date().getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    result = result.filter((item) => item.tanggal === yesterdayStr);
  } else if (options.dateRangeMode === "7DAYS") {
    result = filterByDaysBack(result, 7, 14);
  } else if (options.dateRangeMode === "30DAYS") {
    result = filterByDaysBack(result, 30, 60);
  } else if (options.dateRangeMode === "CUSTOM") {
    result = filterByCustomRange(result, options.startDate, options.endDate);
  }

  if (options.selectedOperators.length > 0) {
    result = result.filter((item) => options.selectedOperators.includes(item.nama_operator));
  }

  if (options.selectedMachines.length > 0) {
    result = result.filter((item) => options.selectedMachines.includes(item.mesin_id));
  }

  return result;
}
