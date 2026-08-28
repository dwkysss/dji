"use server";

import { createClient } from "@/lib/supabase/server";
import { REGISTERED_MACHINES } from "@/lib/constants";

export interface MachineConfig {
  nomor_mc: string;
  default_pcs: number;
  input_type: "PANEL" | "METER";
}

const STANDARD_MACHINES = REGISTERED_MACHINES;

const DEFAULT_MACHINES: Record<string, number> = {
  R1: 1, R2: 1, R1C: 1, R2C: 1, R3B: 1, R11: 1, R12: 1, R16: 1, T1C: 1, T2A: 1,
};

const DEFAULT_INPUT_TYPES: Record<string, "PANEL" | "METER"> = {
  R11: "METER",
  R12: "METER",
  R16: "METER",
};

export async function getMachineConfigs(): Promise<{ success: boolean; data: MachineConfig[]; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("machine_configs")
      .select("nomor_mc, default_pcs, input_type");

    if (error && error.code !== "PGRST116" && !error.message.includes("does not exist")) {
      console.error("Error fetching machine_configs:", error);
    }

    const configMap = new Map<string, { rawName: string; pcs: number; input_type?: "PANEL" | "METER" }>();
    if (data && Array.isArray(data)) {
      data.forEach((item: any) => {
        if (item.nomor_mc && !String(item.nomor_mc).startsWith("REQUIRED_BLOCK:")) {
          const rawName = String(item.nomor_mc).trim();
          configMap.set(rawName.toUpperCase(), {
            rawName,
            pcs: item.default_pcs !== undefined && item.default_pcs !== null ? Number(item.default_pcs) : 1,
            input_type: item.input_type === "METER" ? "METER" : "PANEL",
          });
        }
      });
    }

    // Merge standard machines list with any extra machines present in DB
    const allMachineNamesSet = new Set<string>(STANDARD_MACHINES);
    configMap.forEach((v) => {
      if (v.rawName) allMachineNamesSet.add(v.rawName);
    });

    const results: MachineConfig[] = Array.from(allMachineNamesSet).map((mc) => {
      const mcKey = mc.toUpperCase();
      const dbObj = configMap.get(mcKey);
      const fallbackPcs = DEFAULT_MACHINES[mc] || 1;
      const fallbackType = DEFAULT_INPUT_TYPES[mc] || "PANEL";

      return {
        nomor_mc: mc,
        default_pcs: dbObj?.pcs !== undefined ? dbObj.pcs : fallbackPcs,
        input_type: dbObj?.input_type || fallbackType,
      };
    });

    return { success: true, data: results };
  } catch (err: any) {
    console.error("Error in getMachineConfigs:", err);
    // Return fallback list if error
    const fallbackData = STANDARD_MACHINES.map((mc) => ({
      nomor_mc: mc,
      default_pcs: DEFAULT_MACHINES[mc] || 1,
      input_type: DEFAULT_INPUT_TYPES[mc] || ("PANEL" as const),
    }));
    return { success: true, data: fallbackData };
  }
}

export async function upsertMachineConfig(nomorMc: string, defaultPcs: number, inputType: "PANEL" | "METER" = "PANEL") {
  try {
    const supabase = await createClient();

    const payload = {
      nomor_mc: nomorMc.trim(),
      default_pcs: Number(defaultPcs),
      input_type: inputType,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("machine_configs").upsert(payload, { onConflict: "nomor_mc" });

    if (error) {
      console.error("Error saving machine config:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error in upsertMachineConfig:", err);
    return { success: false, error: err.message };
  }
}

export async function upsertAllMachineConfigs(configs: MachineConfig[]) {
  try {
    const supabase = await createClient();

    const payloads = configs.map((cfg) => ({
      nomor_mc: cfg.nomor_mc.trim(),
      default_pcs: Number(cfg.default_pcs),
      input_type: cfg.input_type === "METER" ? "METER" : "PANEL",
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("machine_configs").upsert(payloads, { onConflict: "nomor_mc" });

    if (error) {
      console.error("Error in upsertAllMachineConfigs:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error in upsertAllMachineConfigs:", err);
    return { success: false, error: err.message };
  }
}

export async function getBlockRequiredDefects(): Promise<{ success: boolean; data: string[] }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("machine_configs")
      .select("nomor_mc")
      .like("nomor_mc", "REQUIRED_BLOCK:%");

    if (!error && data && Array.isArray(data) && data.length > 0) {
      const list = data.map((r: any) => String(r.nomor_mc).replace("REQUIRED_BLOCK:", ""));
      return { success: true, data: list };
    }
  } catch (e) {
    console.error("Error in getBlockRequiredDefects:", e);
  }

  const defaultList = [
    "L1 Benang timbul putus",
    "L2 Benang timbul putus",
    "L3 Benang timbul putus",
    "Benang lolos",
    "Bolong corak",
    "Jarum pattern patah/bengkok",
    "Keluar Jarum",
    "Error design",
    "Error Servo Drive",
    "Sensor Benang/Laser Stop",
    "Ganti motor servo",
    "Konsleting",
  ];
  return { success: true, data: defaultList };
}

export async function saveBlockRequiredDefects(defects: string[]) {
  try {
    const supabase = await createClient();

    // 1. Clear previous REQUIRED_BLOCK rows
    await supabase
      .from("machine_configs")
      .delete()
      .like("nomor_mc", "REQUIRED_BLOCK:%");

    // 2. Insert new REQUIRED_BLOCK rows
    if (defects && defects.length > 0) {
      const payloads = defects.map((d) => ({
        nomor_mc: `REQUIRED_BLOCK:${d}`,
        default_pcs: 1,
        input_type: "REQUIRED",
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("machine_configs")
        .upsert(payloads, { onConflict: "nomor_mc" });

      if (error) {
        console.error("Error saving block required defects:", error);
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error in saveBlockRequiredDefects:", err);
    return { success: false, error: err.message };
  }
}

export async function getMaxPanelConfig(
  nomorMc: string,
  potonganKe?: number | string
): Promise<number | null> {
  try {
    const supabase = await createClient();
    const mcUpper = String(nomorMc || "").toUpperCase().trim();

    // 1. Check specific for MC + Potongan (e.g. MAX_PANEL:R1:1)
    if (potonganKe !== undefined && potonganKe !== null && potonganKe !== "") {
      const specificKey = `MAX_PANEL:${mcUpper}:${potonganKe}`;
      const { data: specData } = await supabase
        .from("machine_configs")
        .select("default_pcs")
        .eq("nomor_mc", specificKey)
        .maybeSingle();

      if (specData && specData.default_pcs > 0) {
        return Number(specData.default_pcs);
      }
    }

    // 2. Check for specific MC default (e.g. MAX_PANEL:R1)
    const mcKey = `MAX_PANEL:${mcUpper}`;
    const { data: mcData } = await supabase
      .from("machine_configs")
      .select("default_pcs")
      .eq("nomor_mc", mcKey)
      .maybeSingle();

    if (mcData && mcData.default_pcs > 0) {
      return Number(mcData.default_pcs);
    }

    // 3. Check for global default (e.g. MAX_PANEL:GLOBAL)
    const { data: globalData } = await supabase
      .from("machine_configs")
      .select("default_pcs")
      .eq("nomor_mc", "MAX_PANEL:GLOBAL")
      .maybeSingle();

    if (globalData && globalData.default_pcs > 0) {
      return Number(globalData.default_pcs);
    }

    return null;
  } catch (err) {
    console.error("Error in getMaxPanelConfig:", err);
    return null;
  }
}

export async function saveMaxPanelConfig(
  nomorMc: string,
  maxPanel: number,
  potonganKe?: number | string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const mcUpper = String(nomorMc || "").toUpperCase().trim();
    const key =
      potonganKe !== undefined && potonganKe !== null && potonganKe !== ""
        ? `MAX_PANEL:${mcUpper}:${potonganKe}`
        : `MAX_PANEL:${mcUpper}`;

    const payload = {
      nomor_mc: key,
      default_pcs: Number(maxPanel),
      input_type: "MAX_PANEL",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("machine_configs")
      .upsert(payload, { onConflict: "nomor_mc" });

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error("Error in saveMaxPanelConfig:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteMaxPanelConfig(
  nomorMc: string,
  potonganKe?: number | string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const mcUpper = String(nomorMc || "").toUpperCase().trim();
    const key =
      potonganKe !== undefined && potonganKe !== null && potonganKe !== ""
        ? `MAX_PANEL:${mcUpper}:${potonganKe}`
        : `MAX_PANEL:${mcUpper}`;

    const { error } = await supabase
      .from("machine_configs")
      .delete()
      .eq("nomor_mc", key);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteMaxPanelConfig:", err);
    return { success: false, error: err.message };
  }
}

export async function getAllMaxPanelConfigs(): Promise<{
  success: boolean;
  data: Record<string, number>;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("machine_configs")
      .select("nomor_mc, default_pcs")
      .like("nomor_mc", "MAX_PANEL:%");

    if (error) throw error;

    const map: Record<string, number> = {};
    if (data && Array.isArray(data)) {
      data.forEach((row: any) => {
        const cleanKey = String(row.nomor_mc).replace("MAX_PANEL:", "");
        map[cleanKey] = Number(row.default_pcs);
      });
    }

    return { success: true, data: map };
  } catch (err: any) {
    console.error("Error in getAllMaxPanelConfigs:", err);
    return { success: false, data: {} };
  }
}
