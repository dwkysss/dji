export * from "./kpi/kpi-types";
export * from "./kpi/meter-classification";
export * from "./kpi/production-counter";
export * from "./kpi/defect-counter";
export * from "./kpi/oee-calculator";
export * from "./kpi/period-calculator";

import {
  DashboardTransaction,
  DatasetStats,
} from "./kpi/kpi-types";
import { countUniquePanels, calculateProductionVolumes } from "./kpi/production-counter";
import { calculateDefectStats, calculateTotalProblemsCount } from "./kpi/defect-counter";
import { calculateAvailabilityAndOee } from "./kpi/oee-calculator";

export function filterByGrade(
  dataset: DashboardTransaction[],
  gradeFilter: string
): DashboardTransaction[] {
  if (gradeFilter === "GRADE_A") {
    return dataset.filter((item) => item.grade === "GRADE A");
  }
  if (gradeFilter === "GRADE_B") {
    return dataset.filter((item) => item.grade === "GRADE B");
  }
  if (gradeFilter === "BS") {
    return dataset.filter((item) => item.grade === "BS");
  }
  return dataset;
}

export interface StatsDatasetOptions {
  dataset: DashboardTransaction[];
  gradeFilter: string;
  selectedOperatorsCount?: number;
}

export function calculateStatsForDataset(
  datasetOrOptions: DashboardTransaction[] | StatsDatasetOptions,
  gradeFilterArg: string = "ALL",
  selectedOperatorsCountArg: number = 0
): DatasetStats {
  const isOptions = !Array.isArray(datasetOrOptions);
  const dataset = isOptions ? datasetOrOptions.dataset : datasetOrOptions;
  const gradeFilter = isOptions ? datasetOrOptions.gradeFilter : gradeFilterArg;
  const selectedOperatorsCount = isOptions
    ? datasetOrOptions.selectedOperatorsCount || 0
    : selectedOperatorsCountArg;

  const gradeScoped = filterByGrade(dataset, gradeFilter);
  const productionOnly = gradeScoped.filter((item) => item.is_production);

  const totalProduksi = countUniquePanels(productionOnly, gradeFilter);
  const volumes = calculateProductionVolumes(productionOnly);
  const defects = calculateDefectStats({
    gradeScoped,
    totalProduksi,
    totalProduksiMeter: volumes.totalProduksiMeter,
  });
  const timeAndOee = calculateAvailabilityAndOee({
    gradeScoped,
    selectedOperatorsCount,
    totalTarget: volumes.totalTarget,
    totalHasilPcs: volumes.totalHasilPcs,
    quality: defects.quality,
  });
  const countMasalah = calculateTotalProblemsCount(gradeScoped);

  const countNolProduksi = gradeScoped.filter((item) => item.hasil_pcs === 0).length;
  const totalPanel = gradeScoped.length;

  return {
    totalProduksi,
    ...volumes,
    ...defects,
    ...timeAndOee,
    countMasalah,
    totalPanel,
    countNolProduksi,
  };
}
