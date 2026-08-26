"use server";

import { createClient } from "@/lib/supabase/server";

export interface TimerSession {
  id: string;
  type: "qc" | "mending" | "final_inspection";
  nomor_mc: string;
  design_id: string;
  potongan_ke: string;
  pcs_index: string;
  start_time: string;
  elapsed_seconds: number;
  pause_seconds: number;
  is_paused: boolean;
  paused_at?: string | null;
  updated_at?: string;
}

const buildSessionId = (
  type: "qc" | "mending" | "final_inspection",
  nomor_mc: string,
  design_id: string,
  potongan_ke: string | number,
  pcs_index: string | number
) => {
  return `${type}_${nomor_mc}_${potongan_ke}_${pcs_index}`;
};

export async function getTimerSession(
  type: "qc" | "mending" | "final_inspection",
  nomor_mc: string,
  design_id: string,
  potongan_ke: string | number,
  pcs_index: string | number
) {
  try {
    const supabase = await createClient();
    const sessionId = buildSessionId(type, nomor_mc, design_id, potongan_ke, pcs_index);
    const legacySessionId = `${type}_${nomor_mc}_${design_id}_${potongan_ke}_${pcs_index}`;

    const { data, error } = await supabase
      .from("inspection_timer_sessions")
      .select("*")
      .or(`id.eq."${sessionId}",id.eq."${legacySessionId}",and(type.eq.${type},nomor_mc.eq.${nomor_mc},potongan_ke.eq.${potongan_ke},pcs_index.eq.${pcs_index})`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching timer session:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error("Server action error in getTimerSession:", err);
    return { success: false, error: err.message };
  }
}

export async function upsertTimerSession(params: {
  type: "qc" | "mending" | "final_inspection";
  nomor_mc: string;
  design_id: string;
  potongan_ke: string | number;
  pcs_index: string | number;
  start_time?: string;
  elapsed_seconds?: number;
  pause_seconds?: number;
  is_paused?: boolean;
  paused_at?: string | null;
}) {
  try {
    const supabase = await createClient();
    const sessionId = buildSessionId(
      params.type,
      params.nomor_mc,
      params.design_id,
      params.potongan_ke,
      params.pcs_index
    );

    // Clean up any legacy duplicates first
    const legacySessionId = `${params.type}_${params.nomor_mc}_${params.design_id}_${params.potongan_ke}_${params.pcs_index}`;
    if (legacySessionId !== sessionId) {
      await supabase
        .from("inspection_timer_sessions")
        .delete()
        .eq("id", legacySessionId);
    }

    // Check existing
    const { data: existing } = await supabase
      .from("inspection_timer_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    const nowIso = new Date().toISOString();

    const payload: any = {
      id: sessionId,
      type: params.type,
      nomor_mc: String(params.nomor_mc),
      design_id: String(params.design_id),
      potongan_ke: String(params.potongan_ke),
      pcs_index: String(params.pcs_index),
      start_time: existing?.start_time ? existing.start_time : (params.start_time || nowIso),
      elapsed_seconds: params.elapsed_seconds ?? existing?.elapsed_seconds ?? 0,
      pause_seconds: params.pause_seconds ?? existing?.pause_seconds ?? 0,
      is_paused: params.is_paused ?? existing?.is_paused ?? false,
      paused_at: params.paused_at !== undefined ? params.paused_at : (existing?.paused_at ?? null),
      updated_at: nowIso,
    };

    const { data, error } = await supabase
      .from("inspection_timer_sessions")
      .upsert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("Error upserting timer session:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error("Server action error in upsertTimerSession:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteTimerSession(
  type: "qc" | "mending" | "final_inspection",
  nomor_mc: string,
  design_id: string,
  potongan_ke: string | number,
  pcs_index: string | number
) {
  try {
    const supabase = await createClient();
    const sessionId = buildSessionId(type, nomor_mc, design_id, potongan_ke, pcs_index);
    const legacySessionId = `${type}_${nomor_mc}_${design_id}_${potongan_ke}_${pcs_index}`;

    const { error } = await supabase
      .from("inspection_timer_sessions")
      .delete()
      .or(`id.eq."${sessionId}",id.eq."${legacySessionId}",and(type.eq.${type},nomor_mc.eq.${nomor_mc},potongan_ke.eq.${potongan_ke},pcs_index.eq.${pcs_index})`);

    if (error) {
      console.error("Error deleting timer session:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Server action error in deleteTimerSession:", err);
    return { success: false, error: err.message };
  }
}

export async function getActiveTimerSessions(type: "qc" | "mending" | "final_inspection") {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("inspection_timer_sessions")
      .select("*")
      .eq("type", type);

    if (error) {
      console.error("Error fetching active timer sessions:", error);
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error("Server action error in getActiveTimerSessions:", err);
    return { success: false, error: err.message, data: [] };
  }
}
