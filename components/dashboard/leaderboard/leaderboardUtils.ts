import { isMeterItem } from "@/hooks/useDashboardKpis";
import { isBsAwalAkhir, isPanelGagalCacat, hasRealDefect } from "@/lib/mending-grade-utils";

export interface TopOperatorItem {
  name: string;
  value: number;
  pcs: number;
  meter: number;
  group: string;
}

export interface TopMachineItem {
  id: string;
  value: number;
  pcs: number;
  meter: number;
  downtime?: number;
}

export interface CriticalMachineItem {
  id: string;
  defects: number;
  downtime: number;
}

export interface LeaderboardData {
  topOperators: TopOperatorItem[];
  topMachines: TopMachineItem[];
  criticalMachines: CriticalMachineItem[];
}

export const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}j`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  return parts.join(" ");
};

export function computeLeaderboardData(
  dateFilteredTransactions: any[] | undefined,
  metricMode: "PCS" | "METER"
): LeaderboardData {
  if (!dateFilteredTransactions || dateFilteredTransactions.length === 0) {
    return { topOperators: [], topMachines: [], criticalMachines: [] };
  }

  const isMeterMode = metricMode === "METER";
  const leaderboardData = dateFilteredTransactions.filter((item) => {
    if (!item.is_production || !item.header_id) return false;
    const isMeter = isMeterItem(item);
    return isMeterMode ? isMeter : !isMeter;
  });

  // 1. Top Operators
  const operatorMap: Record<
    string,
    { headers: Set<string>; meterHeaders: Map<string, number>; panelSet: Set<string>; group: string }
  > = {};

  leaderboardData.forEach((item) => {
    if (item.grade === "BS") return;

    if (!operatorMap[item.nama_operator]) {
      operatorMap[item.nama_operator] = {
        headers: new Set(),
        meterHeaders: new Map(),
        panelSet: new Set(),
        group: item.group || "Tanpa Group",
      };
    }

    operatorMap[item.nama_operator].headers.add(item.header_id);
    operatorMap[item.nama_operator].meterHeaders.set(
      item.header_id,
      Math.max(
        operatorMap[item.nama_operator].meterHeaders.get(item.header_id) || 0,
        parseFloat(item.hasil_meter as any) || 0
      )
    );

    if (
      item.panel_no !== undefined &&
      item.panel_no !== null &&
      !isNaN(Number(item.panel_no)) &&
      (item.hasil_meter || 0) === 0
    ) {
      const key = `${item.mesin_id}_${item.design}_${item.potongan_ke}_${Number(item.panel_no)}`;
      operatorMap[item.nama_operator].panelSet.add(key);
    }
  });

  const topOperators: TopOperatorItem[] = Object.entries(operatorMap)
    .map(([name, data]) => {
      const meter = Array.from(data.meterHeaders.values()).reduce(
        (sum, value) => sum + value,
        0
      );
      const totalPanel = data.panelSet.size;
      return {
        name,
        value: isMeterMode ? meter : totalPanel,
        pcs: totalPanel,
        meter,
        group: data.group,
      };
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // 2. Top Machines
  const machineMap: Record<
    string,
    {
      headers: Set<string>;
      meterHeaders: Map<string, number>;
      downtimeHeaders: Map<string, number>;
      panelSet: Set<string>;
    }
  > = {};

  leaderboardData.forEach((item) => {
    if (item.grade === "BS") return;

    if (!machineMap[item.mesin_id]) {
      machineMap[item.mesin_id] = {
        headers: new Set(),
        meterHeaders: new Map(),
        downtimeHeaders: new Map(),
        panelSet: new Set(),
      };
    }

    machineMap[item.mesin_id].headers.add(item.header_id);
    machineMap[item.mesin_id].meterHeaders.set(
      item.header_id,
      Math.max(
        machineMap[item.mesin_id].meterHeaders.get(item.header_id) || 0,
        parseFloat(item.hasil_meter as any) || 0
      )
    );
    machineMap[item.mesin_id].downtimeHeaders.set(
      item.header_id,
      item.total_downtime_detik || 0
    );

    if (
      item.panel_no !== undefined &&
      item.panel_no !== null &&
      !isNaN(Number(item.panel_no)) &&
      (item.hasil_meter || 0) === 0
    ) {
      const key = `${item.mesin_id}_${item.design}_${item.potongan_ke}_${Number(item.panel_no)}`;
      machineMap[item.mesin_id].panelSet.add(key);
    }
  });

  const topMachines: TopMachineItem[] = Object.entries(machineMap)
    .map(([id, data]) => {
      const meter = Array.from(data.meterHeaders.values()).reduce(
        (sum, value) => sum + value,
        0
      );
      const downtime = Array.from(data.downtimeHeaders.values()).reduce(
        (sum, val) => sum + val,
        0
      );
      const totalPanel = data.panelSet.size;
      return {
        id,
        value: isMeterMode ? meter : totalPanel,
        pcs: totalPanel,
        meter,
        downtime,
      };
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // 3. Critical Machines
  const criticalMap: Record<string, { defects: number; downtime: number }> = {};
  leaderboardData.forEach((item) => {
    if (!criticalMap[item.mesin_id]) {
      criticalMap[item.mesin_id] = { defects: 0, downtime: 0 };
    }
    if (
      !isBsAwalAkhir(item) &&
      !isPanelGagalCacat(item) &&
      hasRealDefect(item) &&
      (item.status_qc === "Recheck" ||
        item.grade === "BS" ||
        (item.kategori_masalah && item.kategori_masalah.trim() !== ""))
    ) {
      criticalMap[item.mesin_id].defects += 1;
    }
    if (item.total_downtime_detik && item.total_downtime_detik > 0) {
      criticalMap[item.mesin_id].downtime = Math.max(
        criticalMap[item.mesin_id].downtime,
        item.total_downtime_detik
      );
    }
  });

  const criticalMachines: CriticalMachineItem[] = Object.entries(criticalMap)
    .map(([id, stats]) => ({
      id,
      defects: stats.defects,
      downtime: stats.downtime,
    }))
    .filter((m) => m.defects > 0 || m.downtime > 0)
    .sort((a, b) => {
      if (b.defects !== a.defects) return b.defects - a.defects;
      return b.downtime - a.downtime;
    })
    .slice(0, 5);

  return { topOperators, topMachines, criticalMachines };
}
