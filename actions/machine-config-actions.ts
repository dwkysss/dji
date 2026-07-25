"use server";

import { createClient } from "@/lib/supabase/server";

export interface MachineConfig {
  nomor_mc: string;
  default_pcs: number;
  input_type: "PANEL" | "METER";
}

const STANDARD_MACHINES = [
  "R1", "R2", "R3", "R6", "R11", "R12", "R16", "T1C", "T2A", "STM", 
  "S2A", "R1C", "S1A", "R2C", "R3B", "R5B", "Warping D6", "Winding"
];

const DEFAULT_MACHINES: Record<string, number> = {
  R1: 1, R2: 1, R3: 1, R6: 1, R11: 1, R12: 1, R16: 1,
  T1C: 1, T2A: 1, STM: 1, S2A: 1, R1C: 1, S1A: 1, R2C: 1, R3B: 1, R5B: 1,
  "Warping D6": 1, Winding: 1,
};

const DEFAULT_INPUT_TYPES: Record<string, "PANEL" | "METER"> = {
  T2A: "METER",
  "Warping D6": "METER",
  Winding: "METER",
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
        if (item.nomor_mc) {
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
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "required_block_defects")
      .single();

    if (data && data.value && Array.isArray(data.value)) {
      return { success: true, data: data.value };
    }
  } catch (e) {}

  const defaultList = [
    "L1/L2/L3 Benang timbul putus",
    "Benang lolos",
    "Bolong corak",
    "Jarum pattern patah/bengkok",
    "Ganti Jacquard",
  ];
  return { success: true, data: defaultList };
}

export async function saveBlockRequiredDefects(defects: string[]) {
  try {
    const supabase = await createClient();
    const payload = {
      key: "required_block_defects",
      value: defects,
      updated_at: new Date().toISOString(),
    };

    await supabase.from("app_settings").upsert(payload, { onConflict: "key" });
    return { success: true };
  } catch (err: any) {
    return { success: true }; // graceful fallback to local storage
  }
}

