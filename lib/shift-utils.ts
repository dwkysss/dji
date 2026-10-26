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
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return formatter.format(dt);
}

/**
 * Returns the operational shift date (YYYY-MM-DD) in Asia/Jakarta timezone.
 * Any timestamp occurring between 00:00:00 and 07:09:59 WIB belongs to Shift 3 of the PREVIOUS day.
 */
export function getShiftDate(dateInput: Date | string | number): string {
  const dt = parseAsWibDate(dateInput);

  // Calculate total minutes from 00:00 in WIB timezone
  const hourStr = dt.toLocaleTimeString("en-US", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false });
  const minStr = dt.toLocaleTimeString("en-US", { timeZone: "Asia/Jakarta", minute: "2-digit" });
  const hour = parseInt(hourStr);
  const min = parseInt(minStr);
  const totalMinutes = (isNaN(hour) ? 0 : hour) * 60 + (isNaN(min) ? 0 : min);

  // 07:10 AM = (7 * 60) + 10 = 430 minutes
  // If time is before 07:10 AM WIB, it belongs to previous operational day (Shift 3 yesterday)
  if (totalMinutes < 430) {
    const prevDt = new Date(dt.getTime() - 24 * 60 * 60 * 1000);
    return prevDt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  }

  return dt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

/**
 * Returns the shift name ("Shift 1", "Shift 2", or "Shift 3") for a given timestamp.
 */
export function getShiftName(dateInput: Date | string | number): "Shift 1" | "Shift 2" | "Shift 3" {
  const dt = parseAsWibDate(dateInput);

  const hourStr = dt.toLocaleTimeString("en-US", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false });
  const minStr = dt.toLocaleTimeString("en-US", { timeZone: "Asia/Jakarta", minute: "2-digit" });
  const hour = parseInt(hourStr);
  const min = parseInt(minStr);
  const totalMinutes = (isNaN(hour) ? 0 : hour) * 60 + (isNaN(min) ? 0 : min);

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
        return dt.toLocaleTimeString("en-GB", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
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
      return dt.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
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
    const dateStr = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }); // YYYY-MM-DD

    // 4 possible upcoming boundaries
    const b0710 = new Date(`${dateStr}T07:10:00+07:00`).getTime();
    const b1510 = new Date(`${dateStr}T15:10:00+07:00`).getTime();
    const b2310 = new Date(`${dateStr}T23:10:00+07:00`).getTime();

    // Tomorrow 07:10 WIB
    const tomorrowDt = new Date(dt.getTime() + 24 * 3600 * 1000);
    const tomorrowDateStr = tomorrowDt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
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

