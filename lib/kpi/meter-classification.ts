import { MeterItemCandidate } from "./kpi-types";

export const isMeterMachine = (mesinId?: string): boolean => {
  const mc = String(mesinId || "").trim().toUpperCase();
  return mc.startsWith("R11") || mc.startsWith("R12") || mc.startsWith("R16");
};

export const hasMeterMeasurement = (hasilMeter?: number, posisiMeter?: any): boolean => {
  return (Number(hasilMeter) || 0) > 0 || (Number(posisiMeter) || 0) > 0;
};

export const isMeterPanelLabel = (panelStr?: string, panelNo?: any): boolean => {
  const pStr = String(panelStr || panelNo || "").toUpperCase().trim();
  return pStr === "METERAN" || pStr.includes("METER");
};

export const isMeterItem = (item: MeterItemCandidate): boolean => {
  if (item.is_meter === true) return true;
  if (isMeterPanelLabel(item.panel_no_str, item.panel_no)) return true;
  if (hasMeterMeasurement(item.hasil_meter, item.posisi_meter)) return true;
  return isMeterMachine(item.mesin_id);
};
