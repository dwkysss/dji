"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getShiftDate, parseAsWibDate, getJakartaDateTimeString } from "@/lib/shift-utils";

export interface MachineBlockHandoffLog {
  id: string;
  startTime: number;
  operatorName: string;
  shift: string;
  timestamp: string;
  dateStr: string;
  dateIso: string;
  notes: string;
}

export interface ActiveMachineBlockData {
  id: string;
  draftHeaderId: string;
  nomorMc: string;
  startTime: number;
  startTimeStr: string;
  startDateStr: string;
  dateIso: string;
  initialReporter: string;
  shift: string;
  isAutoBlocked: boolean;
  lastHeartbeatHour: number;
  handoffLogs: MachineBlockHandoffLog[];
}

function parseDowntimeEventsArray(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function groupIdToShiftName(groupId: number | string | null | undefined, fallback = "A"): string {
  if (!groupId) return fallback;
  const s = String(groupId).toUpperCase();
  if (s === "2" || s.includes("B")) return "B";
  if (s === "3" || s.includes("C")) return "C";
  if (s === "1" || s.includes("A")) return "A";
  return fallback;
}

function resolveGroupIdNum(groupId: string | number | null | undefined): number | null {
  if (groupId === null || groupId === undefined || groupId === "") return null;
  const parsed = parseInt(String(groupId), 10);
  if (!isNaN(parsed)) return parsed;
  const str = String(groupId).toUpperCase();
  if (str.includes("A")) return 1;
  if (str.includes("B")) return 2;
  if (str.includes("C")) return 3;
  return null;
}

function buildActiveBlockFromRow(row: any, dt: any): ActiveMachineBlockData {
  const parsedStart =
    typeof dt.startTime === "number" && dt.startTime > 0
      ? dt.startTime
      : row.tanggal_jam
        ? parseAsWibDate(row.tanggal_jam).getTime()
        : Date.now();

  const shift = dt.shift || groupIdToShiftName(row.group_id, "A");
  const startDateObj = new Date(parsedStart);

  return {
    id: dt.blockId || `block-${parsedStart}`,
    draftHeaderId: row.id,
    nomorMc: row.nomor_mc || "",
    startTime: parsedStart,
    startTimeStr:
      dt.startTimeStr ||
      startDateObj.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }),
    startDateStr:
      dt.startDateStr ||
      startDateObj.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }),
    dateIso: dt.dateIso || row.tgl || getShiftDate(startDateObj),
    initialReporter: dt.initialReporter || "Operator",
    shift,
    isAutoBlocked: Boolean(dt.isAutoBlocked),
    lastHeartbeatHour: typeof dt.lastHeartbeatHour === "number" ? dt.lastHeartbeatHour : 0,
    handoffLogs: Array.isArray(dt.handoffLogs) ? dt.handoffLogs : [],
  };
}

function mergeHandoffLogs(
  existingLogs: MachineBlockHandoffLog[] = [],
  incomingLogs: MachineBlockHandoffLog[] = []
): MachineBlockHandoffLog[] {
  const byId = new Map<string, MachineBlockHandoffLog>();
  for (const log of existingLogs) {
    if (log && log.id) byId.set(log.id, log);
  }
  for (const log of incomingLogs) {
    if (log && log.id) byId.set(log.id, log);
  }
  return Array.from(byId.values()).sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
}

async function getDbClient() {
  try {
    return await createAdminClient();
  } catch {
    return await createClient();
  }
}

async function findActiveDraftRow(db: any, nomorMc: string): Promise<{ row: any; event: any } | null> {
  if (!nomorMc) return null;
  const { data: rows, error } = await db
    .from("production_headers")
    .select(
      "id, tgl, tanggal_jam, operator_id, group_id, design_id, nomor_mc, potongan_ke, total_downtime_detik, downtime_events"
    )
    .eq("nomor_mc", nomorMc)
    .eq("panel_no", "Downtime Mekanik (Direct)")
    .order("tanggal_jam", { ascending: false })
    .limit(10);

  if (error || !rows || rows.length === 0) return null;

  for (const row of rows) {
    const events = parseDowntimeEventsArray(row.downtime_events);
    const draftEvt = events.find((e: any) => e && e.isDraft === true);
    if (draftEvt) {
      return { row, event: draftEvt };
    }
  }
  return null;
}

export async function getActiveMachineBlock(nomorMc: string): Promise<{
  success: boolean;
  block: ActiveMachineBlockData | null;
  error?: string;
}> {
  try {
    if (!nomorMc) return { success: true, block: null };
    const supabase = await createClient();
    const found = await findActiveDraftRow(supabase, nomorMc);
    if (!found) {
      return { success: true, block: null };
    }
    return {
      success: true,
      block: buildActiveBlockFromRow(found.row, found.event),
    };
  } catch (error: any) {
    console.error("Exception in getActiveMachineBlock:", error);
    return { success: false, block: null, error: error.message || "Unknown error" };
  }
}

export async function syncMachineBlockMetadata(data: {
  headerId?: string;
  nomorMc: string;
  handoffLogs: MachineBlockHandoffLog[];
  shift?: string;
  operatorId?: string;
  groupId?: string;
}): Promise<{
  success: boolean;
  headerId?: string;
  handoffLogs?: MachineBlockHandoffLog[];
  alreadyClosed?: boolean;
  error?: string;
}> {
  try {
    const db = await getDbClient();

    let targetRow: any = null;
    let existingEvent: any = null;

    if (data.headerId) {
      const { data: row } = await db
        .from("production_headers")
        .select(
          "id, tgl, tanggal_jam, operator_id, group_id, design_id, nomor_mc, potongan_ke, total_downtime_detik, downtime_events"
        )
        .eq("id", data.headerId)
        .maybeSingle();

      if (row) {
        const events = parseDowntimeEventsArray(row.downtime_events);
        const draftEvt = events.find((e: any) => e && e.isDraft === true);
        if (draftEvt) {
          targetRow = row;
          existingEvent = draftEvt;
        }
      }
    }

    if (!targetRow && data.nomorMc) {
      const found = await findActiveDraftRow(db, data.nomorMc);
      if (found) {
        targetRow = found.row;
        existingEvent = found.event;
      }
    }

    if (!targetRow || !existingEvent) {
      return {
        success: false,
        alreadyClosed: true,
        error: "Blokir mesin sudah diselesaikan atau dibatalkan dari perangkat lain.",
      };
    }

    const mergedLogs = mergeHandoffLogs(
      Array.isArray(existingEvent.handoffLogs) ? existingEvent.handoffLogs : [],
      Array.isArray(data.handoffLogs) ? data.handoffLogs : []
    );

    const updatedEvent = {
      ...existingEvent,
      shift: data.shift || existingEvent.shift,
      handoffLogs: mergedLogs,
    };

    const updatePayload: Record<string, any> = {
      downtime_events: JSON.stringify([updatedEvent]),
    };
    const groupIdNum = resolveGroupIdNum(data.groupId || data.shift);
    if (groupIdNum !== null) updatePayload.group_id = groupIdNum;
    const opIdNum = data.operatorId && !isNaN(parseInt(data.operatorId, 10)) ? parseInt(data.operatorId, 10) : null;
    if (opIdNum !== null) updatePayload.operator_id = opIdNum;

    const { error: updateError } = await db
      .from("production_headers")
      .update(updatePayload)
      .eq("id", targetRow.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, headerId: targetRow.id, handoffLogs: mergedLogs };
  } catch (error: any) {
    console.error("Exception in syncMachineBlockMetadata:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

export async function submitMechanicDowntime(data: {
  nomorMc: string;
  operatorId: string;
  groupId: string;
  designId: string;
  tanggalProduksi: string;
  potonganKe: string;
  downtimeEvent: any;
  createdTime?: number | string;
  headerId?: string;
  isHeartbeat?: boolean;
  heartbeatHour?: number;
  isFinalizingBlock?: boolean;
  course?: string;
  pick?: string;
  rpm?: string | number;
}) {
  try {
    const supabase = await createClient();

    // 1. Prepare header data (+ fallback spesifikasi mesin jika course/pick/rpm/design belum terisi)
    let resolvedDesignId = data.designId ? String(data.designId).trim() : "";
    let resolvedCourse = data.course ? String(data.course).trim() : "";
    let resolvedPick = data.pick ? String(data.pick).trim() : "";
    let resolvedRpm =
      data.rpm !== undefined && data.rpm !== null && String(data.rpm).trim() !== ""
        ? parseInt(String(data.rpm), 10)
        : null;
    if (resolvedRpm !== null && isNaN(resolvedRpm)) resolvedRpm = null;

    if (data.nomorMc && (!resolvedDesignId || (!resolvedCourse && !resolvedPick) || !resolvedRpm)) {
      const { data: latestSpec } = await supabase
        .from("production_headers")
        .select("design_id, course, pick, rpm")
        .eq("nomor_mc", data.nomorMc)
        .not("design_id", "is", null)
        .order("tanggal_jam", { ascending: false })
        .limit(5);

      if (latestSpec && latestSpec.length > 0) {
        const best =
          latestSpec.find((r: any) => r.course || r.pick || r.rpm) || latestSpec[0];
        if (!resolvedDesignId && best?.design_id) resolvedDesignId = String(best.design_id);
        if (!resolvedCourse && best?.course) resolvedCourse = String(best.course);
        if (!resolvedPick && best?.pick) resolvedPick = String(best.pick);
        if (!resolvedRpm && best?.rpm) resolvedRpm = Number(best.rpm) || null;
      }
    }

    const operatorIdNum = data.operatorId && !isNaN(parseInt(data.operatorId)) ? parseInt(data.operatorId) : null;
    const groupIdNum = resolveGroupIdNum(data.groupId);
    const potonganKeNum = data.potonganKe && !isNaN(parseInt(data.potonganKe)) ? parseInt(data.potonganKe) : null;

    const eventDate = data.createdTime ? parseAsWibDate(data.createdTime) : new Date();
    const tanggalJam = getJakartaDateTimeString(eventDate);
    const tgl = data.tanggalProduksi || getShiftDate(eventDate);

    let dt = { ...(data.downtimeEvent || {}) };
    const isDraft = Boolean(dt.isDraft);
    const durasiSec = (dt && dt.durasiDetik && !isNaN(parseInt(dt.durasiDetik))) ? parseInt(dt.durasiDetik) : 0;

    // 2. ANTI-DUPLICATION GUARD A: Saat membuat DRAFT baru (!headerId && isDraft)
    // Pastikan 1 mesin maksimal hanya punya 1 draft blokir aktif di DB
    if (isDraft && !data.headerId && data.nomorMc) {
      const existing = await findActiveDraftRow(supabase, data.nomorMc);
      if (existing) {
        return {
          success: true,
          headerId: existing.row.id,
          alreadyExists: true,
          existingBlock: buildActiveBlockFromRow(existing.row, existing.event),
        };
      }
    }

    // Generate unique header ID or reuse provided headerId (for updating draft)
    const headerId = data.headerId || `mekanik-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const isExisting = Boolean(data.headerId);

    if (isExisting) {
      // Ambil state terbaru dari DB untuk validasi concurrency (anti-race-condition)
      const { data: existingRow } = await supabase
        .from("production_headers")
        .select(
          "id, tgl, tanggal_jam, operator_id, group_id, design_id, nomor_mc, potongan_ke, total_downtime_detik, downtime_events"
        )
        .eq("id", headerId)
        .maybeSingle();

      const existingEvents = parseDowntimeEventsArray(existingRow?.downtime_events);
      const existingDraftEvt = existingEvents.find((e: any) => e && e.isDraft === true);

      // ANTI-DUPLICATION GUARD B: Jika sedang Heartbeat atau Finalisasi, tapi draft di DB sudah hilang / sudah selesai
      if ((data.isHeartbeat || data.isFinalizingBlock) && (!existingRow || !existingDraftEvt)) {
        return {
          success: false,
          alreadyClosed: true,
          error: "Perbaikan mesin ini sudah diselesaikan atau dibatalkan dari perangkat lain.",
        };
      }

      // ANTI-DUPLICATION GUARD C: Monotonic Guard untuk Live Heartbeat Update
      if (data.isHeartbeat && existingDraftEvt) {
        const dbHeartbeatHour = typeof existingDraftEvt.lastHeartbeatHour === "number" ? existingDraftEvt.lastHeartbeatHour : 0;
        const incomingHour = typeof data.heartbeatHour === "number" ? data.heartbeatHour : 0;
        if (incomingHour > 0 && dbHeartbeatHour >= incomingHour) {
          return {
            success: true,
            headerId,
            skipped: true,
            existingBlock: buildActiveBlockFromRow(existingRow, existingDraftEvt),
          };
        }

        // Pertahankan metadata & handoffLogs dari DB agar heartbeat dari Laptop tidak menimpa log dari Tablet A
        dt = {
          ...existingDraftEvt,
          ...dt,
          blockId: existingDraftEvt.blockId || dt.blockId,
          startTime: existingDraftEvt.startTime || dt.startTime,
          startTimeStr: existingDraftEvt.startTimeStr || dt.startTimeStr,
          startDateStr: existingDraftEvt.startDateStr || dt.startDateStr,
          dateIso: existingDraftEvt.dateIso || dt.dateIso,
          initialReporter: existingDraftEvt.initialReporter || dt.initialReporter,
          shift: existingDraftEvt.shift || dt.shift,
          lastHeartbeatHour: incomingHour || dbHeartbeatHour,
          handoffLogs: mergeHandoffLogs(
            Array.isArray(existingDraftEvt.handoffLogs) ? existingDraftEvt.handoffLogs : [],
            Array.isArray(dt.handoffLogs) ? dt.handoffLogs : []
          ),
        };
      }

      // Jika finalisasi blok, gabungkan juga handoffLogs terbaru dari DB agar tidak ada log yang hilang
      if (data.isFinalizingBlock && existingDraftEvt) {
        dt = {
          ...dt,
          isDraft: false,
          handoffLogs: mergeHandoffLogs(
            Array.isArray(existingDraftEvt.handoffLogs) ? existingDraftEvt.handoffLogs : [],
            Array.isArray(dt.handoffLogs) ? dt.handoffLogs : []
          ),
        };
      }

      const nowWib = getJakartaDateTimeString(new Date());
      const rawDikerjakan = String(dt?.dikerjakanOleh || "").trim();
      const pkMatch = rawDikerjakan.match(/^Perbaikan Khusus\s*\((.*)\)$/i);
      const resolvedPic = pkMatch && pkMatch[1] ? pkMatch[1].trim() : (rawDikerjakan || null);

      const updatePayload: Record<string, any> = {
        tanggal_jam: data.isFinalizingBlock ? tanggalJam : nowWib,
        total_downtime_detik: durasiSec,
        downtime_events: JSON.stringify([dt]),
        group_id: groupIdNum,
        operator_id: operatorIdNum,
      };
      if (resolvedPic) updatePayload.pic = resolvedPic;
      if (resolvedDesignId) updatePayload.design_id = resolvedDesignId;
      if (resolvedCourse) updatePayload.course = resolvedCourse;
      if (resolvedPick) updatePayload.pick = resolvedPick;
      if (resolvedRpm !== null) updatePayload.rpm = resolvedRpm;

      const { error: updateError } = await supabase
        .from("production_headers")
        .update(updatePayload)
        .eq("id", headerId);

      if (updateError) {
        console.error("Error updating mechanic dummy header:", updateError);
        return { success: false, error: updateError.message };
      }

      // Hapus downtime_records lama sebelum mengisi yang baru
      await supabase.from("downtime_records").delete().eq("header_id", headerId);
    } else {
      // We will inject a dummy production_headers just for this downtime
      const rawDikerjakan = String(dt?.dikerjakanOleh || "").trim();
      const pkMatch = rawDikerjakan.match(/^Perbaikan Khusus\s*\((.*)\)$/i);
      const resolvedPic = pkMatch && pkMatch[1] ? pkMatch[1].trim() : (rawDikerjakan || null);

      const headerPayload: Record<string, any> = {
        id: headerId,
        tgl,
        tanggal_jam: tanggalJam,
        operator_id: operatorIdNum,
        group_id: groupIdNum,
        pic: resolvedPic,
        design_id: resolvedDesignId || null,
        course: resolvedCourse || null,
        pick: resolvedPick || null,
        rpm: resolvedRpm,
        nomor_mc: data.nomorMc || null,
        potongan_ke: potonganKeNum,
        panel_no: "Downtime Mekanik (Direct)", // Special marker for dummy header
        pcs: 0, // no pieces
        total_downtime_detik: durasiSec,
        downtime_events: JSON.stringify([dt])
      };

      const { error: headerError } = await supabase
        .from("production_headers")
        .insert(headerPayload);

      if (headerError) {
        console.error("Error inserting mechanic dummy header:", headerError);
        return { success: false, error: headerError.message };
      }
    }

    // 3. Prepare downtime_records data
    const downtimeRecordsData: any[] = [];
    if (dt.problems && Array.isArray(dt.problems)) {
      dt.problems.forEach((p: any) => {
        downtimeRecordsData.push({
          header_id: headerId,
          kategori: p.kategori || dt.kategori,
          detail: p.details ? (Array.isArray(p.details) ? p.details.join(", ") : p.details) : dt.detail,
          durasi_detik: durasiSec,
          blok: p.blok || dt.blok || null,
          dikerjakan_oleh: dt.dikerjakanOleh || null
        });
      });
    } else if (dt.kategori) {
      downtimeRecordsData.push({
        header_id: headerId,
        kategori: dt.kategori,
        detail: dt.detail,
        durasi_detik: durasiSec,
        blok: dt.blok || null,
        dikerjakan_oleh: dt.dikerjakanOleh || null
      });
    }

    if (downtimeRecordsData.length > 0) {
      const { error: dtError } = await supabase
        .from("downtime_records")
        .insert(downtimeRecordsData);

      if (dtError) {
        console.error("Error inserting mechanic downtime_records:", dtError);
        return { success: false, error: dtError.message };
      }
    }

    return { success: true, headerId };
  } catch (error: any) {
    console.error("Exception in submitMechanicDowntime:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

export async function cancelMechanicDowntime(headerId?: string, nomorMc?: string) {
  try {
    if (!headerId && !nomorMc) return { success: false, error: "Header ID atau Nomor Mesin diperlukan" };
    const db = await getDbClient();

    const targetIds = new Set<string>();
    if (headerId) targetIds.add(headerId);

    // Pastikan juga jika ada draft aktif lain untuk nomorMc yang sama ikut dibersihkan
    if (nomorMc) {
      const found = await findActiveDraftRow(db, nomorMc);
      if (found?.row?.id) {
        targetIds.add(found.row.id);
      }
    }

    for (const id of targetIds) {
      await db.from("downtime_records").delete().eq("header_id", id);
      await db.from("production_details").delete().eq("header_id", id);
      await db.from("production_headers").delete().eq("id", id);
    }

    return { success: true, deletedIds: Array.from(targetIds) };
  } catch (error: any) {
    console.error("Exception in cancelMechanicDowntime:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}
