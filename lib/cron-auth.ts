import { NextResponse } from "next/server";

/**
 * Memvalidasi apakah pemanggil endpoint CRON memiliki hak akses yang sah.
 * Mendukung header: `Authorization: Bearer <CRON_SECRET>`
 * Atau query param: `?secret=<CRON_SECRET>` atau `?key=<CRON_SECRET>`
 *
 * Mengembalikan `null` jika lolos otorisasi, atau `NextResponse` 401 jika gagal.
 */
export function checkCronAuth(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  
  // Jika CRON_SECRET belum diset di environment (.env), izinkan agar fitur tidak macet mendadak
  if (!cronSecret) {
    return null;
  }

  // 1. Cek Authorization Header: "Bearer <CRON_SECRET>"
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();
    if (token === cronSecret) {
      return null;
    }
  }

  // 2. Cek Query Param
  try {
    const url = new URL(request.url);
    const secretParam = url.searchParams.get("secret") || url.searchParams.get("key");
    if (secretParam === cronSecret) {
      return null;
    }
  } catch (e) {}

  return NextResponse.json(
    {
      success: false,
      error: "Unauthorized: Token otorisasi CRON tidak valid atau tidak disertakan.",
    },
    { status: 401 }
  );
}
