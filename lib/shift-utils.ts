/**
 * Utility functions for Operational Shift Day (07:10 WIB - 07:10 WIB) calculations.
 * 
 * Shift 1 (Pagi): 07:10 - 15:10 WIB
 * Shift 2 (Sore): 15:10 - 23:10 WIB
 * Shift 3 (Malam): 23:10 - 07:10 WIB (crosses midnight)
 */

/**
 * Safely parses any date/time string into a Date object correctly evaluated in WIB (Asia/Jakarta +07:00).
 */
export function parseAsWibDate(dateInput: Date | string | number): Date {
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? new Date() : dateInput;
  if (typeof dateInput === "number") return isNaN(dateInput) ? new Date() : new Date(dateInput);
  if (!dateInput) return new Date();

  const str = String(dateInput).trim();
  if (!str) return new Date();

  // Epoch timestamp in numeric string format (e.g. "1729900000000" or "1729900000")
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) {
      return new Date(str.length === 10 ? num * 1000 : num);
    }
  }

  // Plain date string: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    // Set to 12:00 PM WIB so date-only strings are anchored securely mid-day
    return new Date(`${str}T12:00:00+07:00`);
  }

  // ISO or Space-separated date-time string
  if (str.includes(" ") || str.includes("T")) {
    let formatted = str.replace(" ", "T");

    // If ISO string already has timezone (+07:00, Z, etc.), parse directly
    const hasTimezone = formatted.includes("Z") || /\+[0-9]{2}:?[0-9]{2}$/.test(formatted) || /-[0-9]{2}:?[0-9]{2}$/.test(formatted);
    if (!hasTimezone) {
      // Local WIB timestamp without offset -> append +07:00 (NOT Z!)
      formatted += "+07:00";
    }

    const d = new Date(formatted);
    if (!isNaN(d.getTime())) return d;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

/**
 * Returns a formatted date-time string in Asia/Jakarta (WIB) timezone: "YYYY-MM-DD HH:mm:ss".
 */
export function getJakartaDateTimeString(dateInput?: Date | string | number): string {
  const dt = dateInput ? parseAsWibDate(dateInput) : new Date();
  const wibMs = dt.getTime() + 7 * 60 * 60 * 1000;
  const wibDate = new Date(wibMs);
  const iso = wibDate.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
}

/**
 * Returns the operational shift date (YYYY-MM-DD) in Asia/Jakarta timezone.
 * Any timestamp occurring between 00:00:00 and 07:09:59 WIB belongs to Shift 3 of the PREVIOUS day.
 * 
 * Uses exact UTC+7 mathematical calculation (Asia/Jakarta has constant +07:00 with no DST)
 * to ensure 100% deterministic and identical behavior across all environments (Windows, Linux, Docker, etc.).
 */
export function getShiftDate(dateInput: Date | string | number): string {
  const dt = parseAsWibDate(dateInput);

  // Pure UTC+7 arithmetic
  const wibMs = dt.getTime() + 7 * 60 * 60 * 1000;
  const wibDate = new Date(wibMs);
  const hour = wibDate.getUTCHours();
  const min = wibDate.getUTCMinutes();
  const totalMinutes = hour * 60 + min;

  // 07:10 AM = (7 * 60) + 10 = 430 minutes
  // If time is before 07:10 AM WIB, it belongs to previous operational day (Shift 3 yesterday)
  if (totalMinutes < 430) {
    const prevWibDate = new Date(wibMs - 24 * 60 * 60 * 1000);
    return prevWibDate.toISOString().slice(0, 10);
  }

  return wibDate.toISOString().slice(0, 10);
}

/**
 * Returns the shift name ("Shift 1", "Shift 2", or "Shift 3") for a given timestamp.
 */
export function getShiftName(dateInput: Date | string | number): "Shift 1" | "Shift 2" | "Shift 3" {
  const dt = parseAsWibDate(dateInput);

  const wibMs = dt.getTime() + 7 * 60 * 60 * 1000;
  const wibDate = new Date(wibMs);
  const hour = wibDate.getUTCHours();
  const min = wibDate.getUTCMinutes();
  const totalMinutes = hour * 60 + min;

  if (totalMinutes >= 430 && totalMinutes < 910) {
    // 07:10 - 15:10
    return "Shift 1";
  } else if (totalMinutes >= 910 && totalMinutes < 1390) {
    // 15:10 - 23:10
    return "Shift 2";
  } else {
    // 23:10 - 07:10
    return "Shift 3";
  }
}

/**
 * Given an operational shift date (YYYY-MM-DD) and a time string (HH:mm or HH:mm:ss),
 * converts it into the corresponding calendar timestamp in WIB, the operational date (tgl), and the shift name.
 * 
 * Factory Rule:
 * Cut-off is 07:10:00 WIB.
 * - Shift 1: 07:10 - 15:10 WIB (same calendar day)
 * - Shift 2: 15:10 - 23:10 WIB (same calendar day)
 * - Shift 3: 23:10 - 07:10 WIB:
 *    - 23:10 to 23:59: same calendar day
 *    - 00:00 to 07:09:59: next calendar day (opDate + 1 day)
 * 
 * Therefore, when the user inputs operational date D and a time < 07:10:
 * The wall-clock calendar timestamp is (D + 1 day) HH:mm:ss.
 * Its shift is "Shift 3", and its operational date (tgl) is D.
 */
export function getCalendarDateTimeFromShift(opDate: string, timeStr: string): {
  tanggal_jam: string;
  tgl: string;
  shift: "Shift 1" | "Shift 2" | "Shift 3";
} {
  const cleanDate = (opDate || "").trim();
  let cleanTime = (timeStr || "12:00").trim().replace(/\./g, ":");
  if (cleanTime.length === 5) cleanTime += ":00";
  const [hStr, mStr] = cleanTime.split(":");
  const totalMinutes = (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0);

  let calendarDate = cleanDate;
  // If time < 07:10 (0 to 429 minutes), it is the morning portion of Shift 3, occurring on calendar day D + 1.
  if (totalMinutes < 430 && /^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    const baseDate = parseAsWibDate(cleanDate);
    const nextDate = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
    calendarDate = nextDate.toISOString().slice(0, 10);
  }

  const tanggal_jam = `${calendarDate} ${cleanTime}`;
  const tgl = cleanDate;
  const shift = getShiftName(tanggal_jam);

  return { tanggal_jam, tgl, shift };
}

/**
 * Formats a timestamp into real-time display string for operators (e.g., "06 Agt 2026, 02:15 WIB").
 * Preserves the actual real-time clock without shifting.
 */
export function formatDisplayTimestamp(dateInput: Date | string | number): string {
  const dt = parseAsWibDate(dateInput);

  return dt.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " WIB";
}

/**
 * Formats a time string or ISO string into a clean HH:mm (24-hour) string in Asia/Jakarta (WIB).
 * Strips raw ISO format like "2026-08-13T03:37:19.282+00:00" into clean "03:37" or "10:37".
 */
export function formatHHMM(timeInput?: string | null): string {
  if (!timeInput) return "";
  const rawStr = String(timeInput).trim();
  if (!rawStr) return "";

  // 1. If ISO date-time string, parse directly using parseAsWibDate (DO NOT replace dot with colon first!)
  if (rawStr.includes("T") || rawStr.includes("-") || rawStr.length > 10) {
    try {
      const dt = parseAsWibDate(rawStr);
      if (!isNaN(dt.getTime())) {
        const wibMs = dt.getTime() + 7 * 60 * 60 * 1000;
        return new Date(wibMs).toISOString().slice(11, 16);
      }
    } catch (e) {}
  }

  // 2. Simple HH:mm or HH.mm
  const str = rawStr.replace(/\./g, ":");
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const parts = str.split(":");
    return `${parts[0].padStart(2, "0")}:${parts[1]}`;
  }

  // 3. Simple HH:mm:ss or HH.mm.ss
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(str)) {
    const parts = str.split(":");
    return `${parts[0].padStart(2, "0")}:${parts[1]}`;
  }

  try {
    const dt = parseAsWibDate(str);
    if (!isNaN(dt.getTime())) {
      const wibMs = dt.getTime() + 7 * 60 * 60 * 1000;
      return new Date(wibMs).toISOString().slice(11, 16);
    }
  } catch (e) {}

  return str;
}

/**
 * Formats total seconds into a digital stopwatch timer string (e.g., 65 -> "01:05", 3665 -> "01:01:05").
 */
export function formatTimerSeconds(totalSec: number): string {
  if (isNaN(totalSec) || totalSec < 0) totalSec = 0;
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Formats total seconds into a human-readable Indonesian duration string with automatic unit escalation:
 * - > 59 seconds -> Mnt (minutes)
 * - > 59 minutes -> Jam (hours)
 * - > 23 hours   -> Hari (days)
 *
 * Examples:
 * - 45       -> "45 Dtk"
 * - 125      -> "2 Mnt 5 Dtk"
 * - 9108     -> "2 Jam 31 Mnt"
 * - 484494   -> "5 Hari 14 Jam 34 Mnt"
 * - 753000   -> "8 Hari 17 Jam 10 Mnt"
 */
export function formatDurationSmart(
  totalSec: number | string | null | undefined,
  options?: { zeroText?: string; includeSeconds?: boolean }
): string {
  const zeroText = options?.zeroText ?? "0 Dtk";
  const includeSeconds = options?.includeSeconds ?? false;
  const sec = Math.floor(
    typeof totalSec === "string" ? parseFloat(totalSec) || 0 : Number(totalSec) || 0
  );
  if (sec <= 0 || isNaN(sec)) return zeroText;

  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days} Hari`);
    if (hours > 0) parts.push(`${hours} Jam`);
    if (minutes > 0) parts.push(`${minutes} Mnt`);
    if (includeSeconds && seconds > 0) parts.push(`${seconds} Dtk`);
  } else if (hours > 0) {
    parts.push(`${hours} Jam`);
    if (minutes > 0) parts.push(`${minutes} Mnt`);
    if (includeSeconds && seconds > 0) parts.push(`${seconds} Dtk`);
  } else if (minutes > 0) {
    parts.push(`${minutes} Mnt`);
    if (seconds > 0) parts.push(`${seconds} Dtk`);
  } else {
    parts.push(`${seconds} Dtk`);
  }

  return parts.join(" ");
}

export interface ShiftSegment {
  startTime: number;
  endTime: number;
  durationSec: number;
  shiftName: "Shift 1" | "Shift 2" | "Shift 3";
  shiftGroup: "A" | "B" | "C";
  shiftDate: string; // YYYY-MM-DD
}

/**
 * Automatically splits a continuous downtime interval across operational shift boundaries:
 * - Shift 1 (Pagi):  07:10 - 15:10 WIB
 * - Shift 2 (Sore):  15:10 - 23:10 WIB
 * - Shift 3 (Malam): 23:10 - 07:10 WIB
 */
export function getShiftBoundarySegments(startTimeMs: number, endTimeMs: number): ShiftSegment[] {
  if (endTimeMs <= startTimeMs) {
    return [];
  }

  const segments: ShiftSegment[] = [];
  let currentStart = startTimeMs;

  while (currentStart < endTimeMs) {
    const dt = parseAsWibDate(currentStart);
    const dateStr = new Date(dt.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10); // YYYY-MM-DD

    // 4 possible upcoming boundaries
    const b0710 = new Date(`${dateStr}T07:10:00+07:00`).getTime();
    const b1510 = new Date(`${dateStr}T15:10:00+07:00`).getTime();
    const b2310 = new Date(`${dateStr}T23:10:00+07:00`).getTime();

    // Tomorrow 07:10 WIB
    const tomorrowDt = new Date(dt.getTime() + 24 * 3600 * 1000);
    const tomorrowDateStr = new Date(tomorrowDt.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    const bNext0710 = new Date(`${tomorrowDateStr}T07:10:00+07:00`).getTime();

    const boundaries = [b0710, b1510, b2310, bNext0710].filter((b) => b > currentStart);
    const nextBoundary = Math.min(...boundaries);

    const segmentEnd = Math.min(endTimeMs, nextBoundary);
    const midPoint = currentStart + Math.floor((segmentEnd - currentStart) / 2);
    const shift = getShiftName(midPoint);
    const shiftGroup = shift === "Shift 1" ? "A" : shift === "Shift 2" ? "B" : "C";
    const opDate = getShiftDate(midPoint);

    segments.push({
      startTime: currentStart,
      endTime: segmentEnd,
      durationSec: Math.max(1, Math.floor((segmentEnd - currentStart) / 1000)),
      shiftName: shift,
      shiftGroup,
      shiftDate: opDate,
    });

    currentStart = segmentEnd;
  }

  return segments;
}

/**
 * Calculates remaining seconds from a given timestamp until the end of its active operational shift:
 * - Shift 1 (Pagi):  ends at 15:10 WIB (54,600s into the day)
 * - Shift 2 (Sore):  ends at 23:10 WIB (83,400s into the day)
 * - Shift 3 (Malam): ends at 07:10 WIB (25,800s next morning)
 */
export function getRemainingShiftSeconds(dateInput?: Date | string | number): number {
  const dt = dateInput ? parseAsWibDate(dateInput) : new Date();
  const wibMs = dt.getTime() + 7 * 60 * 60 * 1000;
  const wibDate = new Date(wibMs);
  const hour = wibDate.getUTCHours();
  const min = wibDate.getUTCMinutes();
  const sec = wibDate.getUTCSeconds();
  const currentTotalSeconds = hour * 3600 + min * 60 + sec;

  let endSec = 0;
  if (currentTotalSeconds >= 25800 && currentTotalSeconds < 54600) {
    // Shift 1 ends at 15:10
    endSec = 54600;
  } else if (currentTotalSeconds >= 54600 && currentTotalSeconds < 83400) {
    // Shift 2 ends at 23:10
    endSec = 83400;
  } else {
    // Shift 3 ends at 07:10 next morning
    if (currentTotalSeconds >= 83400) {
      endSec = 86400 + 25800; // tomorrow 07:10
    } else {
      endSec = 25800; // today 07:10
    }
  }

  return Math.max(0, endSec - currentTotalSeconds);
}


