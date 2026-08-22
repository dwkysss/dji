"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface QCDefectItem {
  id: string;
  nama_cacat: string;
  kategori: string;
  keterangan?: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

const FALLBACK_QC_DEFECTS: QCDefectItem[] = [
  { id: "1", nama_cacat: "L1 Putus", kategori: "Benang", sort_order: 1, is_active: true },
  { id: "2", nama_cacat: "L2 Putus", kategori: "Benang", sort_order: 2, is_active: true },
  { id: "3", nama_cacat: "Bolong Corak", kategori: "Corak & Rajutan", sort_order: 3, is_active: true },
  { id: "4", nama_cacat: "Bolong Bredel", kategori: "Corak & Rajutan", sort_order: 4, is_active: true },
  { id: "5", nama_cacat: "BT Keluar Jarum", kategori: "Jarum & Benang", sort_order: 5, is_active: true },
  { id: "6", nama_cacat: "BT Lolos", kategori: "Benang", sort_order: 6, is_active: true },
  { id: "7", nama_cacat: "BT Kejepit", kategori: "Benang", sort_order: 7, is_active: true },
  { id: "8", nama_cacat: "Floating Kerajut", kategori: "Corak & Rajutan", sort_order: 8, is_active: true },
  { id: "9", nama_cacat: "BT Narik Jalan", kategori: "Benang", sort_order: 9, is_active: true },
  { id: "10", nama_cacat: "BT Narik", kategori: "Benang", sort_order: 10, is_active: true },
  { id: "11", nama_cacat: "Kotor Karat", kategori: "Kebersihan & Noda", sort_order: 11, is_active: true },
  { id: "12", nama_cacat: "Kotor Oli", kategori: "Kebersihan & Noda", sort_order: 12, is_active: true },
  { id: "13", nama_cacat: "Pinggiran Kebabad", kategori: "Finishing & Pinggiran", sort_order: 13, is_active: true },
  { id: "14", nama_cacat: "Benang Kendor", kategori: "Benang", sort_order: 14, is_active: true },
];

/**
 * Mengambil daftar cacat QC yang aktif untuk digunakan di modal QC & Mending
 */
export async function getQCDefects(): Promise<{
  success: boolean;
  data: QCDefectItem[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("master_qc_defects")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("nama_cacat", { ascending: true });

    if (error || !data || data.length === 0) {
      return { success: true, data: FALLBACK_QC_DEFECTS };
    }

    return { success: true, data: data as QCDefectItem[] };
  } catch (err: any) {
    console.error("getQCDefects error:", err);
    return { success: true, data: FALLBACK_QC_DEFECTS };
  }
}

/**
 * Mengambil semua data master cacat QC (termasuk nonaktif) untuk halaman Admin
 */
export async function getAllQCDefectsAdmin(): Promise<{
  success: boolean;
  data: QCDefectItem[];
  error?: string;
}> {
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("master_qc_defects")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("nama_cacat", { ascending: true });

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: (data || []) as QCDefectItem[] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Membuat master cacat QC baru
 */
export async function createQCDefect(input: {
  nama_cacat: string;
  kategori?: string;
  keterangan?: string;
  sort_order?: number;
}): Promise<{ success: boolean; data?: QCDefectItem; error?: string }> {
  try {
    const cleanNama = input.nama_cacat.trim();
    if (!cleanNama) {
      return { success: false, error: "Nama cacat wajib diisi!" };
    }

    const cleanKategori = (input.kategori || "Umum").trim();
    const cleanKeterangan = (input.keterangan || "").trim();

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("master_qc_defects")
      .insert({
        nama_cacat: cleanNama,
        kategori: cleanKategori || "Umum",
        keterangan: cleanKeterangan || null,
        sort_order: input.sort_order ?? 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: `Nama cacat "${cleanNama}" sudah ada di master!` };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/qc-defects");
    revalidatePath("/qc");
    revalidatePath("/mending");
    return { success: true, data: data as QCDefectItem };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Mengubah data master cacat QC
 */
export async function updateQCDefect(
  id: string,
  input: {
    nama_cacat?: string;
    kategori?: string;
    keterangan?: string;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!id) return { success: false, error: "ID tidak valid!" };

    const supabase = await createAdminClient();
    const payload: any = { updated_at: new Date().toISOString() };

    if (input.nama_cacat !== undefined) payload.nama_cacat = input.nama_cacat.trim();
    if (input.kategori !== undefined) payload.kategori = input.kategori.trim() || "Umum";
    if (input.keterangan !== undefined) payload.keterangan = input.keterangan.trim() || null;
    if (input.is_active !== undefined) payload.is_active = input.is_active;
    if (input.sort_order !== undefined) payload.sort_order = input.sort_order;

    const { error } = await supabase
      .from("master_qc_defects")
      .update(payload)
      .eq("id", id);

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "Nama cacat tersebut sudah digunakan!" };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/qc-defects");
    revalidatePath("/qc");
    revalidatePath("/mending");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Menghapus data master cacat QC
 */
export async function deleteQCDefect(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!id) return { success: false, error: "ID tidak valid!" };

    const supabase = await createAdminClient();
    const { error } = await supabase.from("master_qc_defects").delete().eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/qc-defects");
    revalidatePath("/qc");
    revalidatePath("/mending");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
