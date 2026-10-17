import { DashboardTransaction, AvailabilityAndOeeParams } from "./kpi-types";

export function calculateEffectiveWorkSeconds(
  gradeScoped: DashboardTransaction[],
  totalDetikTersedia: number
): { totalDowntimeDetik: number; totalDetikKerjaEfektif: number } {
  const uniqueGradeScopedHeadersMap = new Map<string, DashboardTransaction>();
  gradeScoped.forEach((item) => {
    if (item.header_id && !uniqueGradeScopedHeadersMap.has(item.header_id)) {
      uniqueGradeScopedHeadersMap.set(item.header_id, item);
    }
  });

  const uniqueGradeScopedHeaders = Array.from(uniqueGradeScopedHeadersMap.values());
  const totalDowntimeDetik = uniqueGradeScopedHeaders.reduce(
    (acc, curr) => acc + (curr.total_downtime_detik || 0),
    0
  );
  const totalDetikKerjaEfektif = Math.max(0, totalDetikTersedia - totalDowntimeDetik);

  return { totalDowntimeDetik, totalDetikKerjaEfektif };
}

export function calculateAvailabilityAndOee(params: AvailabilityAndOeeParams) {
  const {
    gradeScoped,
    selectedOperatorsCount,
    totalTarget,
    totalHasilPcs,
    quality,
  } = params;

  const uniqueDatesCount = new Set(gradeScoped.map((item) => item.tanggal)).size || 1;
  const hoursPerDay = selectedOperatorsCount > 0 ? 8 : 24;
  const totalDetikTersedia = uniqueDatesCount * hoursPerDay * 3600;

  const { totalDowntimeDetik, totalDetikKerjaEfektif } = calculateEffectiveWorkSeconds(
    gradeScoped,
    totalDetikTersedia
  );

  const availability =
    totalDetikTersedia > 0 ? (totalDetikKerjaEfektif / totalDetikTersedia) * 100 : 0;
  const performance = totalTarget > 0 ? (totalHasilPcs / totalTarget) * 100 : 0;
  const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;

  return {
    availability,
    performance,
    oee,
    efisiensi: availability,
    totalDetikTersedia,
    totalDowntimeDetik,
  };
}
