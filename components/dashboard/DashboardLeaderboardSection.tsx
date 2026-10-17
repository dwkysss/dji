"use client";

import React, { useMemo } from "react";
import {
  computeLeaderboardData,
  LeaderboardData,
} from "./leaderboard/leaderboardUtils";
import TopOperatorsCard from "./leaderboard/TopOperatorsCard";
import TopMachinesCard from "./leaderboard/TopMachinesCard";
import CriticalMachinesCard from "./leaderboard/CriticalMachinesCard";

export interface DashboardLeaderboardSectionProps {
  metricMode: "PCS" | "METER";
  dateFilteredTransactions?: any[];
  leaderboard?: LeaderboardData;
}

export default function DashboardLeaderboardSection({
  metricMode,
  dateFilteredTransactions,
  leaderboard: propLeaderboard,
}: DashboardLeaderboardSectionProps) {
  const leaderboard = useMemo(() => {
    if (propLeaderboard) return propLeaderboard;
    return computeLeaderboardData(dateFilteredTransactions, metricMode);
  }, [propLeaderboard, dateFilteredTransactions, metricMode]);

  return (
    <div
      data-tour="dashboard-leaderboard"
      className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6"
    >
      <TopOperatorsCard
        topOperators={leaderboard.topOperators}
        metricMode={metricMode}
      />
      <TopMachinesCard
        topMachines={leaderboard.topMachines}
        metricMode={metricMode}
      />
      <CriticalMachinesCard
        criticalMachines={leaderboard.criticalMachines}
      />
    </div>
  );
}
