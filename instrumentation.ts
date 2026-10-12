/**
 * Next.js Server Lifecycle Instrumentation Hook
 * ============================================================================================
 * Dipanggil secara otomatis oleh Next.js tepat saat server pertama kali dinyalakan di VPS.
 * Menginisialisasi internal server scheduler tanpa perlu crontab Linux eksternal.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initServerScheduler } = await import("@/lib/server-scheduler");
    initServerScheduler();
  }
}
