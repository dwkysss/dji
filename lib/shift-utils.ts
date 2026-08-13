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
  if (dateInput instanceof Date) return dateInput;
  if (!dateInput) return new Date();

  const str = String(dateInput).trim();
  if (!str) return new Date();

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
  const str = String(timeInput).trim().replace(/\./g, ":");
  if (!str) return "";

  // Simple HH:mm
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const parts = str.split(":");
    return `${parts[0].padStart(2, "0")}:${parts[1]}`;
  }

  // Simple HH:mm:ss
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(str)) {
    const parts = str.split(":");
    return `${parts[0].padStart(2, "0")}:${parts[1]}`;
  }

  // ISO or date-time string
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
  } catch (e) {
    // fallback
  }

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

