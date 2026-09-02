"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ProblemDetailItem {
  id: string;
  kategori: string;
  nama_detail: string;
  sub_kategori?: string;
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

import { GROUPED_PROBLEM_DETAILS } from "@/lib/constants";

// ----------------------------------------------------
// PROBLEM DETAIL & GROUP MAPPING ACTIONS
// ----------------------------------------------------

export async function getProblemGroupMapping(): Promise<{
  success: boolean;
  mapping: Record<string, { groupName: string; items: string[] }[]>;
  error?: string;
}> {
  try {
    const supabase = await createAdminClient();

    // 1. Fetch saved mapping from machine_configs
    const { data: configRow } = await supabase
      .from("machine_configs")
      .select("input_type")
      .eq("nomor_mc", "PROBLEM_GROUP_MAPPING")
      .maybeSingle();

    let rawMapping: Record<string, { groupName: string; items: string[] }[]> = {};

    if (configRow && configRow.input_type) {
      try {
        rawMapping = JSON.parse(configRow.input_type);
      } catch (_) {
        rawMapping = {};
      }
    }

    // 2. Fetch all active master details to know EXACT real items per category
    const { data: allDetails } = await supabase
      .from("master_problem_details")
      .select("kategori, nama_detail")
      .eq("is_active", true)
      .order("nama_detail", { ascending: true });

    const activeDetailsByCat: Record<string, string[]> = {};
    if (allDetails && Array.isArray(allDetails)) {
      allDetails.forEach((row) => {
        const cat = row.kategori?.toUpperCase();
        if (!cat) return;
        if (!activeDetailsByCat[cat]) activeDetailsByCat[cat] = [];
        if (!activeDetailsByCat[cat].includes(row.nama_detail)) {
          activeDetailsByCat[cat].push(row.nama_detail);
        }
      });
    }

    const cleanMapping: Record<string, { groupName: string; items: string[] }[]> = {};

    // Determine all categories to process
    const allCats = Array.from(
      new Set([
        ...Object.keys(GROUPED_PROBLEM_DETAILS),
        ...Object.keys(rawMapping),
        ...Object.keys(activeDetailsByCat),
      ])
    );

    allCats.forEach((cat) => {
      const activeItemsForCat = activeDetailsByCat[cat] || [];
      const assignedItems = new Set<string>();

      // Get configured groups for this category
      let groups = rawMapping[cat];
      if (!groups || !Array.isArray(groups) || groups.length === 0) {
        groups = JSON.parse(JSON.stringify(GROUPED_PROBLEM_DETAILS[cat] || [{ groupName: "Umum", items: [] }]));
      }

      // Clean each group's items so it ONLY contains real active items from DB
      const cleanedGroups: { groupName: string; items: string[] }[] = [];

      groups.forEach((g) => {
        const validGroupItems: string[] = [];
        (g.items || []).forEach((itemStr) => {
          // Match real active item in DB (case-insensitive)
          const matchedRealItem = activeItemsForCat.find(
            (real) => real.toLowerCase() === itemStr.toLowerCase()
          );
          if (matchedRealItem && !assignedItems.has(matchedRealItem)) {
            validGroupItems.push(matchedRealItem);
            assignedItems.add(matchedRealItem);
          }
        });

        if (validGroupItems.length > 0 || (rawMapping && rawMapping[cat])) {
          cleanedGroups.push({
            groupName: g.groupName,
            items: validGroupItems,
          });
        }
      });

      // Any remaining unassigned active items go to "Lain-lain / Tambahan"
      const unassignedItems = activeItemsForCat.filter((item) => !assignedItems.has(item));
      if (unassignedItems.length > 0) {
        let fallbackGroup = cleanedGroups.find(
          (g) => g.groupName.toLowerCase().includes("lain") || g.groupName.toLowerCase().includes("umum")
        );
        if (!fallbackGroup) {
          fallbackGroup = { groupName: "Lain-lain / Tambahan", items: [] };
          cleanedGroups.push(fallbackGroup);
        }
        fallbackGroup.items.push(...unassignedItems);
      }

      cleanMapping[cat] = cleanedGroups;
    });

    return { success: true, mapping: cleanMapping };
  } catch (err: any) {
    console.error("Error getting problem group mapping:", err);
    return { success: true, mapping: GROUPED_PROBLEM_DETAILS };
  }
}

export async function saveProblemGroupMapping(
  mapping: Record<string, { groupName: string; items: string[] }[]>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createAdminClient();

    const { error } = await supabase.from("machine_configs").upsert(
      {
        nomor_mc: "PROBLEM_GROUP_MAPPING",
        default_pcs: 1,
        input_type: JSON.stringify(mapping),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "nomor_mc" }
    );

    if (error) {
      console.error("Error saving PROBLEM_GROUP_MAPPING:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/problem-details");
    revalidatePath("/qc");
    revalidatePath("/mending");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getProblemDetailsGrouped(): Promise<{
  success: boolean;
  grouped: Record<string, string[]>;
  rawList: ProblemDetailItem[];
  groupMapping: Record<string, { groupName: string; items: string[] }[]>;
  error?: string;
}> {
  try {
    const supabase = await createAdminClient();
    const [{ data, error }, mappingRes] = await Promise.all([
      supabase
        .from("master_problem_details")
        .select("*")
        .order("kategori", { ascending: true })
        .order("nama_detail", { ascending: true }),
      getProblemGroupMapping(),
    ]);

    if (error) {
      console.error("Error fetching master_problem_details:", error);
      return { success: false, grouped: {}, rawList: [], groupMapping: GROUPED_PROBLEM_DETAILS, error: error.message };
    }

    const mapping = mappingRes.mapping || GROUPED_PROBLEM_DETAILS;
    const grouped: Record<string, string[]> = {};
    const rawList: ProblemDetailItem[] = (data || []).map((item) => {
      // Find item's group
      const catGroups = mapping[item.kategori] || [];
      const foundGroup = catGroups.find((g) => g.items.includes(item.nama_detail));
      return {
        ...item,
        sub_kategori: foundGroup?.groupName || "Lain-lain / Tambahan",
      };
    });

    rawList.forEach((item) => {
      if (!item.is_active) return;
      if (!grouped[item.kategori]) {
        grouped[item.kategori] = [];
      }
      grouped[item.kategori].push(item.nama_detail);
    });

    return { success: true, grouped, rawList, groupMapping: mapping };
  } catch (err: any) {
    console.error("Failed to get problem details:", err);
    return { success: false, grouped: {}, rawList: [], groupMapping: GROUPED_PROBLEM_DETAILS, error: err.message };
  }
}

export async function createProblemDetail(input: {
  kategori: string;
  nama_detail: string;
  sub_kategori?: string;
}): Promise<{ success: boolean; data?: ProblemDetailItem; error?: string }> {
  try {
    if (!input.kategori || !input.nama_detail || input.nama_detail.trim() === "") {
      return { success: false, error: "Kategori dan nama detail wajib diisi!" };
    }

    const supabase = await createAdminClient();
    const cleanKategori = input.kategori.trim().toUpperCase();
    const cleanNama = input.nama_detail.trim();
    const cleanSubKat = (input.sub_kategori || "").trim();

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

    // Update group mapping
    if (cleanSubKat) {
      const mappingRes = await getProblemGroupMapping();
      if (mappingRes.success && mappingRes.mapping) {
        const mapping = mappingRes.mapping;
        if (!mapping[cleanKategori]) mapping[cleanKategori] = [];
        
        let targetGroup = mapping[cleanKategori].find((g) => g.groupName.toLowerCase() === cleanSubKat.toLowerCase());
        if (!targetGroup) {
          targetGroup = { groupName: cleanSubKat, items: [] };
          mapping[cleanKategori].push(targetGroup);
        }
        if (!targetGroup.items.includes(cleanNama)) {
          targetGroup.items.push(cleanNama);
        }
        await saveProblemGroupMapping(mapping);
      }
    }

    revalidatePath("/problem-details");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateProblemDetail(
  id: string,
  input: { nama_detail?: string; is_active?: boolean; sub_kategori?: string; kategori?: string; old_nama_detail?: string }
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

    // Update in group mapping if name or sub_kategori changed
    if (input.kategori) {
      const cleanCat = input.kategori.toUpperCase();
      const oldName = input.old_nama_detail?.trim() || input.nama_detail?.trim();
      const newName = input.nama_detail?.trim() || oldName;
      const newSubKat = (input.sub_kategori || "").trim();

      const mappingRes = await getProblemGroupMapping();
      if (mappingRes.success && mappingRes.mapping && mappingRes.mapping[cleanCat]) {
        const mapping = mappingRes.mapping;

        // Remove old name from all groups in category
        if (oldName) {
          mapping[cleanCat].forEach((g) => {
            g.items = g.items.filter((item) => item !== oldName);
          });
        }

        // Add new name to target sub_kategori
        if (newName && newSubKat) {
          let targetGroup = mapping[cleanCat].find((g) => g.groupName.toLowerCase() === newSubKat.toLowerCase());
          if (!targetGroup) {
            targetGroup = { groupName: newSubKat, items: [] };
            mapping[cleanCat].push(targetGroup);
          }
          if (!targetGroup.items.includes(newName)) {
            targetGroup.items.push(newName);
          }
        }

        await saveProblemGroupMapping(mapping);
      }
    }

    revalidatePath("/problem-details");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteProblemDetail(id: string, nama_detail?: string, kategori?: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!id) return { success: false, error: "ID tidak valid!" };

    const supabase = await createAdminClient();
    const { error } = await supabase.from("master_problem_details").delete().eq("id", id);

    if (error) return { success: false, error: error.message };

    // Also remove from group mapping
    if (nama_detail && kategori) {
      const cleanCat = kategori.toUpperCase();
      const mappingRes = await getProblemGroupMapping();
      if (mappingRes.success && mappingRes.mapping && mappingRes.mapping[cleanCat]) {
        const mapping = mappingRes.mapping;
        mapping[cleanCat].forEach((g) => {
          g.items = g.items.filter((item) => item !== nama_detail);
        });
        await saveProblemGroupMapping(mapping);
      }
    }

    revalidatePath("/problem-details");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
