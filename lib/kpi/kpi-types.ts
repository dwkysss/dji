export interface DashboardTransaction {
  id: string | number;
  tanggal: string;
  tanggal_jam?: string;
  shift?: "Shift 1" | "Shift 2" | "Shift 3";
  hari: string;
  header_id: string;
  panel_no?: number;
  panel_no_str?: string;
  is_dummy_downtime?: boolean;
  is_meter?: boolean;
  potongan_ke?: string;
  nama_operator: string;
  mesin_id: string;
  hasil_pcs: number;
  hasil_meter?: number;
  posisi_meter?: number;
  target_pcs: number;
  status_qc: "Lolos" | "Recheck";
  rpm_mesin: number;
  grade: "GRADE A" | "GRADE B" | "BS" | "UNGRADED";
  design: string;
  group?: string;
  is_production?: boolean;
  total_downtime_detik?: number;
  kategori_masalah?: string;
  detail_masalah?: string;
  keterangan_cacat?: string;
}

export interface MeterItemCandidate {
  is_meter?: boolean;
  panel_no?: any;
  panel_no_str?: string;
  hasil_meter?: number;
  posisi_meter?: any;
  mesin_id?: string;
}

export interface DatasetStats {
  totalProduksi: number;
  totalProduksiMeter: number;
  totalTarget: number;
  totalHasilPcs: number;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  efisiensi: number;
  countMasalah: number;
  totalItems: number;
  totalPanel: number;
  countNolProduksi: number;
  countMasalahPanel: number;
  totalPanelValid: number;
  persentaseCacatPanel: number;
  fpyPanel: number;
  countMasalahMeteran: number;
  persentaseCacatMeteran: number;
  fpyMeteran: number;
  totalDetikTersedia: number;
  totalDowntimeDetik: number;
}

export interface DefectStatsParams {
  gradeScoped: DashboardTransaction[];
  totalProduksi: number;
  totalProduksiMeter: number;
}

export interface AvailabilityAndOeeParams {
  gradeScoped: DashboardTransaction[];
  selectedOperatorsCount: number;
  totalTarget: number;
  totalHasilPcs: number;
  quality: number;
}

export interface DeltaResult {
  value: number;
  type: "up" | "down" | "flat";
}

export interface PeriodFilterOptions {
  transactions: DashboardTransaction[];
  dateRangeMode: "TODAY" | "7DAYS" | "30DAYS" | "CUSTOM";
  startDate: string;
  endDate: string;
  selectedOperators: string[];
  selectedMachines: string[];
}
