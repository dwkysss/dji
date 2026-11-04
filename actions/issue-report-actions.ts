"use server";

import { createClient } from "@/lib/supabase/server";

export interface IssueReportItem {
  id: string;
  category: "KESALAHAN_INPUT" | "KENDALA_MESIN" | "KOREKSI_CACAT" | "LAINNYA";
  nomorMc: string;
  potonganKe?: number | string | null;
  groupName?: string | null;
  panelOrMeter?: string | null;
  keterangan: string;
  senderName: string;
  senderUserId?: string | null;
  status: "PENDING" | "RESOLVED";
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface CreateIssueReportInput {
  category?: "KESALAHAN_INPUT" | "KENDALA_MESIN" | "KOREKSI_CACAT" | "LAINNYA";
  nomorMc: string;
  potonganKe?: number | string | null;
  groupName?: string | null;
  panelOrMeter?: string | null;
  keterangan: string;
  senderName: string;
  senderUserId?: string | null;
}

const REPORT_TARGET_ID = "SYSTEM_ISSUE_REPORT";

/**
 * Membuat Laporan Kesalahan Input / Kendala Baru
 */
export async function createIssueReport(
  input: CreateIssueReportInput
): Promise<{ success: boolean; data?: IssueReportItem; error?: string }> {
  try {
    const supabase = await createClient();
    const reportId = "rep_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const nowIso = new Date().toISOString();

    const reportContent = {
      category: input.category || "KESALAHAN_INPUT",
      nomorMc: (input.nomorMc || "").trim().toUpperCase(),
      potonganKe: input.potonganKe ? Number(input.potonganKe) : null,
      groupName: (input.groupName || "").trim() || null,
      panelOrMeter: input.panelOrMeter ? String(input.panelOrMeter).trim() : null,
      keterangan: (input.keterangan || "").trim(),
      senderName: (input.senderName || "Operator").trim(),
      senderUserId: input.senderUserId || null,
      status: "PENDING" as const,
      resolutionNotes: "",
      resolvedBy: "",
      resolvedAt: null,
      createdAt: nowIso,
    };

    // 1. Coba ke tabel dedicated jika ada
    const { error: directErr } = await supabase.from("operator_issue_reports").insert({
      id: reportId,
      category: reportContent.category,
      nomor_mc: reportContent.nomorMc,
      potongan_ke: reportContent.potonganKe,
      panel_or_meter: reportContent.panelOrMeter,
      keterangan: reportContent.keterangan,
      sender_name: reportContent.senderName,
      sender_user_id: reportContent.senderUserId,
      status: "PENDING",
      created_at: nowIso,
    });

    if (!directErr) {
      return {
        success: true,
        data: {
          id: reportId,
          ...reportContent,
        },
      };
    }

    // 2. Fallback resilient menggunakan app_direct_messages
    const dmPayload = {
      id: reportId,
      target_user_id: REPORT_TARGET_ID,
      target_user_name: "Admin / QC",
      sender_name: reportContent.senderName,
      message: JSON.stringify(reportContent),
      is_read: false,
      created_at: nowIso,
    };

    const { error: fallbackErr } = await supabase.from("app_direct_messages").insert(dmPayload);
    if (fallbackErr) {
      console.error("[createIssueReport] Fallback error:", fallbackErr.message);
      return { success: false, error: fallbackErr.message };
    }

    return {
      success: true,
      data: {
        id: reportId,
        ...reportContent,
      },
    };
  } catch (err: any) {
    console.error("[createIssueReport] Error:", err);
    return { success: false, error: err?.message || "Terjadi kesalahan saat mengirim laporan" };
  }
}

/**
 * Mengambil Daftar Laporan Kesalahan Input / Kendala
 */
export async function fetchIssueReports(filters?: {
  nomorMc?: string;
  status?: "ALL" | "PENDING" | "RESOLVED";
}): Promise<{ success: boolean; data: IssueReportItem[]; error?: string }> {
  try {
    const supabase = await createClient();

    // 1. Coba dari tabel dedicated terlebih dahulu
    const { data: dedicatedData, error: dedicatedErr } = await supabase
      .from("operator_issue_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (!dedicatedErr && Array.isArray(dedicatedData)) {
      let filtered = dedicatedData.map((d: any) => ({
        id: d.id,
        category: d.category || "KESALAHAN_INPUT",
        nomorMc: d.nomor_mc,
        potonganKe: d.potongan_ke,
        groupName: d.group_name || null,
        panelOrMeter: d.panel_or_meter,
        keterangan: d.keterangan,
        senderName: d.sender_name,
        senderUserId: d.sender_user_id,
        status: (d.status || "PENDING") as "PENDING" | "RESOLVED",
        resolutionNotes: d.resolution_notes || "",
        resolvedBy: d.resolved_by || "",
        resolvedAt: d.resolved_at || null,
        createdAt: d.created_at,
      }));

      if (filters?.nomorMc) {
        filtered = filtered.filter((r) => r.nomorMc === filters.nomorMc?.toUpperCase());
      }
      if (filters?.status && filters.status !== "ALL") {
        filtered = filtered.filter((r) => r.status === filters.status);
      }
      return { success: true, data: filtered };
    }

    // 2. Fallback resilient dari app_direct_messages
    let query = supabase
      .from("app_direct_messages")
      .select("*")
      .eq("target_user_id", REPORT_TARGET_ID)
      .order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.warn("[fetchIssueReports] Query fallback error:", error.message);
      return { success: true, data: [] };
    }

    const items: IssueReportItem[] = [];
    for (const row of data || []) {
      try {
        const parsed = JSON.parse(row.message);
        const status = row.is_read ? ("RESOLVED" as const) : (parsed.status as "PENDING" | "RESOLVED") || "PENDING";
        const item: IssueReportItem = {
          id: row.id,
          category: parsed.category || "KESALAHAN_INPUT",
          nomorMc: parsed.nomorMc || "-",
          potonganKe: parsed.potonganKe !== undefined ? parsed.potonganKe : null,
          groupName: parsed.groupName || null,
          panelOrMeter: parsed.panelOrMeter || null,
          keterangan: parsed.keterangan || row.message,
          senderName: row.sender_name || parsed.senderName || "Operator",
          senderUserId: parsed.senderUserId || null,
          status: status,
          resolutionNotes: parsed.resolutionNotes || "",
          resolvedBy: parsed.resolvedBy || "",
          resolvedAt: parsed.resolvedAt || null,
          createdAt: row.created_at || parsed.createdAt || new Date().toISOString(),
        };

        if (filters?.nomorMc && item.nomorMc.toUpperCase() !== filters.nomorMc.toUpperCase()) {
          continue;
        }
        if (filters?.status && filters.status !== "ALL" && item.status !== filters.status) {
          continue;
        }

        items.push(item);
      } catch (e) {
        // Abaikan jika bukan JSON laporan
      }
    }

    return { success: true, data: items };
  } catch (err: any) {
    console.error("[fetchIssueReports] Error:", err);
    return { success: true, data: [] };
  }
}

/**
 * Memperbarui Status Laporan (Tandai Sudah Diperbaiki / Kembalikan ke Pending)
 */
export async function updateIssueReportStatus(
  reportId: string,
  status: "PENDING" | "RESOLVED",
  resolutionNotes?: string,
  resolvedBy?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();

    // 1. Coba update ke operator_issue_reports
    const { error: dedicatedErr } = await supabase
      .from("operator_issue_reports")
      .update({
        status: status,
        resolution_notes: resolutionNotes || "",
        resolved_by: resolvedBy || "",
        resolved_at: status === "RESOLVED" ? nowIso : null,
        updated_at: nowIso,
      })
      .eq("id", reportId);

    if (!dedicatedErr) {
      return { success: true };
    }

    // 2. Fallback update ke app_direct_messages
    const { data: existing } = await supabase
      .from("app_direct_messages")
      .select("*")
      .eq("id", reportId)
      .single();

    if (existing) {
      let parsed: any = {};
      try {
        parsed = JSON.parse(existing.message);
      } catch (e) {
        parsed = { keterangan: existing.message };
      }

      parsed.status = status;
      if (resolutionNotes !== undefined) parsed.resolutionNotes = resolutionNotes;
      if (resolvedBy !== undefined) parsed.resolvedBy = resolvedBy;
      parsed.resolvedAt = status === "RESOLVED" ? nowIso : null;

      await supabase
        .from("app_direct_messages")
        .update({
          is_read: status === "RESOLVED",
          message: JSON.stringify(parsed),
        })
        .eq("id", reportId);
    }

    return { success: true };
  } catch (err: any) {
    console.error("[updateIssueReportStatus] Error:", err);
    return { success: false, error: err?.message || "Gagal memperbarui status laporan" };
  }
}

/**
 * Menghapus Laporan Kesalahan Input
 */
export async function deleteIssueReport(reportId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    await supabase.from("operator_issue_reports").delete().eq("id", reportId);
    await supabase.from("app_direct_messages").delete().eq("id", reportId);
    return { success: true };
  } catch (err: any) {
    console.error("[deleteIssueReport] Error:", err);
    return { success: false, error: err?.message || "Gagal menghapus laporan" };
  }
}

