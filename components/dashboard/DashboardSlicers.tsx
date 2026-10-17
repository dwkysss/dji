"use client";

import React from "react";
import DateRangeSlicer, { DateRangeSlicerProps } from "./slicers/DateRangeSlicer";
import MetricModeSlicer, { MetricModeSlicerProps } from "./slicers/MetricModeSlicer";
import MachineFilterDropdown, { MachineFilterDropdownProps } from "./slicers/MachineFilterDropdown";
import OperatorFilterDropdown, { OperatorFilterDropdownProps } from "./slicers/OperatorFilterDropdown";

export interface DashboardSlicersProps
  extends DateRangeSlicerProps,
    MetricModeSlicerProps,
    MachineFilterDropdownProps,
    OperatorFilterDropdownProps {}

export default function DashboardSlicers(props: DashboardSlicersProps) {
  return (
    <div
      data-tour="dashboard-slicers"
      className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:flex lg:flex-row lg:items-center lg:flex-nowrap w-full"
    >
      <DateRangeSlicer
        dateRangeMode={props.dateRangeMode}
        setDateRangeMode={props.setDateRangeMode}
        startDate={props.startDate}
        setStartDate={props.setStartDate}
        endDate={props.endDate}
        setEndDate={props.setEndDate}
      />
      <MetricModeSlicer
        metricMode={props.metricMode}
        setMetricMode={props.setMetricMode}
        setSelectedMachines={props.setSelectedMachines}
      />
      <MachineFilterDropdown
        selectedMachines={props.selectedMachines}
        setSelectedMachines={props.setSelectedMachines}
        isMachineDropdownOpen={props.isMachineDropdownOpen}
        setIsMachineDropdownOpen={props.setIsMachineDropdownOpen}
        machineDropdownRef={props.machineDropdownRef}
        machineButtonLabel={props.machineButtonLabel}
        machinesByType={props.machinesByType}
      />
      <OperatorFilterDropdown
        selectedOperators={props.selectedOperators}
        setSelectedOperators={props.setSelectedOperators}
        isOperatorDropdownOpen={props.isOperatorDropdownOpen}
        setIsOperatorDropdownOpen={props.setIsOperatorDropdownOpen}
        operatorDropdownRef={props.operatorDropdownRef}
        operatorButtonLabel={props.operatorButtonLabel}
        operatorsByShift={props.operatorsByShift}
      />
    </div>
  );
}
