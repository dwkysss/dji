"use client";

import React, { useState, useMemo } from "react";
import {
  computeParetoData,
  getAvailableParetoMachines,
} from "./pareto/paretoUtils";
import DashboardParetoHeader from "./pareto/DashboardParetoHeader";
import DashboardParetoBanner from "./pareto/DashboardParetoBanner";
import DashboardParetoChart from "./pareto/DashboardParetoChart";
import DashboardParetoCards from "./pareto/DashboardParetoCards";

export interface DashboardParetoSectionProps {
  dateFilteredTransactions: any[];
  metricMode: "PCS" | "METER";
}

export const DashboardParetoSection: React.FC<DashboardParetoSectionProps> = ({
  dateFilteredTransactions,
  metricMode,
}) => {
  const [paretoMode, setParetoMode] = useState<"COUNT" | "DURATION">("COUNT");
  const [paretoGroupBy, setParetoGroupBy] = useState<"KATEGORI" | "MESIN">("KATEGORI");
  const [selectedParetoMachine, setSelectedParetoMachine] = useState<string>("ALL");
  const [showAllParetoCards, setShowAllParetoCards] = useState(false);

  const availableParetoMachines = useMemo(() => {
    return getAvailableParetoMachines(dateFilteredTransactions);
  }, [dateFilteredTransactions]);

  const paretoProblemData = useMemo(() => {
    return computeParetoData({
      dateFilteredTransactions,
      metricMode,
      paretoMode,
      paretoGroupBy,
      selectedParetoMachine,
    });
  }, [dateFilteredTransactions, paretoMode, paretoGroupBy, selectedParetoMachine, metricMode]);

  const vitalFewItems = paretoProblemData.list.filter((item) => item.isVital80);

  return (
    <div className="bg-white border border-[#e9ecef] rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] mt-6">
      <DashboardParetoHeader
        paretoGroupBy={paretoGroupBy}
        setParetoGroupBy={setParetoGroupBy}
        availableParetoMachines={availableParetoMachines}
        selectedParetoMachine={selectedParetoMachine}
        setSelectedParetoMachine={setSelectedParetoMachine}
        paretoMode={paretoMode}
        setParetoMode={setParetoMode}
      />

      <DashboardParetoBanner
        vitalFewItems={vitalFewItems}
        paretoGroupBy={paretoGroupBy}
      />

      <DashboardParetoChart
        list={paretoProblemData.list}
        showAllParetoCards={showAllParetoCards}
        paretoMode={paretoMode}
      />

      <DashboardParetoCards
        list={paretoProblemData.list}
        showAllParetoCards={showAllParetoCards}
        setShowAllParetoCards={setShowAllParetoCards}
        paretoGroupBy={paretoGroupBy}
        paretoMode={paretoMode}
      />
    </div>
  );
};

export default DashboardParetoSection;
