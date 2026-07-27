"use server";

import { createClient } from "@/lib/supabase/server";

export interface OperatorItem {
  id: number;
  nama_operator: string;
  shift: string; // "A" | "B" | "C"
}

/**
 * Fetch all operators from database
 */
export async function getOperatorsList(): Promise<{ success: boolean; data?: OperatorItem[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("operators")
      .select("id, nama_operator, shift")
      .order("nama_operator", { ascending: true });

    if (error) {
      console.error("Error fetching operators:", error);
      return { success: false, error: error.message };
    }

    const formatted = (data || []).map((item: any) => ({
      id: Number(item.id),
      nama_operator: String(item.nama_operator).trim(),
      shift: item.shift ? String(item.shift).toUpperCase() : "A",
    }));

    return { success: true, data: formatted };
  } catch (err: any) {
    console.error("Error in getOperatorsList:", err);
    return { success: false, error: err.message || "Failed to fetch operators" };
  }
}

/**
 * Update operator's team/shift assignment
 */
export async function updateOperatorShift(
  id: number,
  shift: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const targetShift = shift.toUpperCase();

    if (!["A", "B", "C"].includes(targetShift)) {
      return { success: false, error: "Shift tidak valid. Pilih A, B, atau C." };
    }

    const { error } = await supabase
      .from("operators")
      .update({ shift: targetShift })
      .eq("id", id);

    if (error) {
      console.error("Error updating operator shift:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error in updateOperatorShift:", err);
    return { success: false, error: err.message || "Failed to update shift" };
  }
}

/**
 * Create a new operator with team assignment
 */
export async function createOperator(
  namaOperator: string,
  shift: string = "A"
): Promise<{ success: boolean; data?: OperatorItem; error?: string }> {
  try {
    const supabase = await createClient();
    const nameTrim = namaOperator.trim();
    const shiftUpper = shift.toUpperCase();

    if (!nameTrim) {
      return { success: false, error: "Nama operator wajib diisi." };
    }

    const { data, error } = await supabase
      .from("operators")
      .insert({ nama_operator: nameTrim, shift: shiftUpper })
      .select("id, nama_operator, shift")
      .single();

    if (error) {
      console.error("Error creating operator:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        id: Number(data.id),
        nama_operator: data.nama_operator,
        shift: data.shift,
      },
    };
  } catch (err: any) {
    console.error("Error in createOperator:", err);
    return { success: false, error: err.message || "Failed to create operator" };
  }
}

/**
 * Delete an operator record
 */
export async function deleteOperator(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("operators").delete().eq("id", id);

    if (error) {
      console.error("Error deleting operator:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteOperator:", err);
    return { success: false, error: err.message || "Failed to delete operator" };
  }
}
