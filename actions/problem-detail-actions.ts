"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ProblemDetailItem {
  id: string;
  kategori: string;
  nama_detail: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProblemCategoryItem {
  kode: string;
  label: string;
  description?: string;
  color?: string;
  created_at?: string;
  updated_at?: string;
}

// ----------------------------------------------------
// CATEGORY ACTIONS
// ----------------------------------------------------

export async function getProblemCategories(): Promise<{
  success: boolean;
  categories: ProblemCategoryItem[];
  error?: string;
}> {
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("master_problem_categories")
      .select("*")
      .order("kode", { ascending: true });

    if (error) {
      return { success: false, categories: [], error: error.message };
    }
    return { success: true, categories: data || [] };
  } catch (err: any) {
    return { success: false, categories: [], error: err.message };
  }
}

export async function createProblemCategory(input: {
  kode: string;
  label: string;
  description?: string;
}): Promise<{ success: boolean; data?: ProblemCategoryItem; error?: string }> {
  try {
    const cleanKode = input.kode.trim().toUpperCase();
    const cleanLabel = input.label.trim();
    if (!cleanKode || !cleanLabel) {
      return { success: false, error: "Kode Kategori dan Label wajib diisi!" };
    }

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("master_problem_categories")
      .insert({
        kode: cleanKode,
        label: cleanLabel,
        description: (input.description || "").trim(),
        color: "from-amber-500 to-orange-600",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: `Kode Kategori "${cleanKode}" sudah digunakan!` };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/problem-details");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateProblemCategory(
  kode: string,
  input: { label?: string; description?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!kode) return { success: false, error: "Kode Kategori tidak valid!" };

    const supabase = await createAdminClient();
    const updatePayload: any = { updated_at: new Date().toISOString() };

    if (input.label !== undefined) updatePayload.label = input.label.trim();
    if (input.description !== undefined) updatePayload.description = input.description.trim();

    const { error } = await supabase
      .from("master_problem_categories")
      .update(updatePayload)
      .eq("kode", kode);

    if (error) return { success: false, error: error.message };

    revalidatePath("/problem-details");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteProblemCategory(
  kode: string,
  cascade: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!kode) return { success: false, error: "Kode Kategori tidak valid!" };

    const supabase = await createAdminClient();

    if (cascade) {
      // Hapus seluruh detail masalah pada kategori ini
      await supabase.from("master_problem_details").delete().eq("kategori", kode);
    } else {
      // Check if category still has details attached
      const { count, error: countErr } = await supabase
        .from("master_problem_details")
        .select("*", { count: "exact", head: true })
        .eq("kategori", kode);

      if (countErr) return { success: false, error: countErr.message };

      if (count && count > 0) {
        return {
          success: false,
          error: `Kategori [${kode}] masih memiliki ${count} detail masalah!`,
        };
      }
    }

    const { error } = await supabase.from("master_problem_categories").delete().eq("kode", kode);

    if (error) return { success: false, error: error.message };

    revalidatePath("/problem-details");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------
// PROBLEM DETAIL ACTIONS
// ----------------------------------------------------

export async function getProblemDetailsGrouped(): Promise<{
  success: boolean;
  grouped: Record<string, string[]>;
  rawList: ProblemDetailItem[];
  error?: string;
}> {
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("master_problem_details")
      .select("*")
      .order("kategori", { ascending: true })
      .order("nama_detail", { ascending: true });

    if (error) {
      console.error("Error fetching master_problem_details:", error);
      return { success: false, grouped: {}, rawList: [], error: error.message };
    }

    const grouped: Record<string, string[]> = {};
    const rawList: ProblemDetailItem[] = data || [];

    rawList.forEach((item) => {
      if (!item.is_active) return;
      if (!grouped[item.kategori]) {
        grouped[item.kategori] = [];
      }
      grouped[item.kategori].push(item.nama_detail);
    });

    return { success: true, grouped, rawList };
  } catch (err: any) {
    console.error("Failed to get problem details:", err);
    return { success: false, grouped: {}, rawList: [], error: err.message };
  }
}

export async function createProblemDetail(input: {
  kategori: string;
  nama_detail: string;
}): Promise<{ success: boolean; data?: ProblemDetailItem; error?: string }> {
  try {
    if (!input.kategori || !input.nama_detail || input.nama_detail.trim() === "") {
      return { success: false, error: "Kategori dan nama detail wajib diisi!" };
    }

    const supabase = await createAdminClient();
    const cleanKategori = input.kategori.trim().toUpperCase();
    const cleanNama = input.nama_detail.trim();

    const { data, error } = await supabase
      .from("master_problem_details")
      .insert({
        kategori: cleanKategori,
        nama_detail: cleanNama,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: `Detail masalah "${cleanNama}" sudah ada pada Kategori ${cleanKategori}!` };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/problem-details");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateProblemDetail(
  id: string,
  input: { nama_detail?: string; is_active?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!id) return { success: false, error: "ID tidak valid!" };

    const supabase = await createAdminClient();
    const updatePayload: any = { updated_at: new Date().toISOString() };

    if (input.nama_detail !== undefined) {
      updatePayload.nama_detail = input.nama_detail.trim();
    }
    if (input.is_active !== undefined) {
      updatePayload.is_active = input.is_active;
    }

    const { error } = await supabase
      .from("master_problem_details")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "Nama detail masalah tersebut sudah digunakan!" };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/problem-details");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteProblemDetail(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!id) return { success: false, error: "ID tidak valid!" };

    const supabase = await createAdminClient();
    const { error } = await supabase.from("master_problem_details").delete().eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/problem-details");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
