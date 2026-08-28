import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Nama-nama cookie Supabase yang perlu dibersihkan saat session rusak
const SUPABASE_COOKIE_PREFIXES = ["sb-", "supabase-auth-token"];

function isSupabaseCookie(name: string): boolean {
  return SUPABASE_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Jangan jalankan logika auth pada halaman publik
  const isPublicPath =
    pathname === "/login" ||
    pathname === "/change-password" ||
    pathname.includes("/print") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api");

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    // Jika ada error autentikasi (token kadaluarsa / cookie rusak) dan bukan halaman publik,
    // hapus semua cookie Supabase yang rusak dan redirect paksa ke /login.
    // Ini mencegah tablet menampilkan layar kosong "This page couldn't load".
    if (error && !isPublicPath) {
      const isTokenError =
        error.message?.toLowerCase().includes("invalid") ||
        error.message?.toLowerCase().includes("expired") ||
        error.message?.toLowerCase().includes("jwt") ||
        error.status === 401 ||
        error.status === 403;

      if (isTokenError) {
        // Buat response redirect ke halaman login
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.searchParams.set("session_expired", "1");

        const redirectResponse = NextResponse.redirect(loginUrl);

        // Hapus SEMUA cookie Supabase yang ada agar tidak ada sisa token rusak
        request.cookies.getAll().forEach(({ name }) => {
          if (isSupabaseCookie(name)) {
            redirectResponse.cookies.delete(name);
          }
        });

        return redirectResponse;
      }
    }
  } catch (e) {
    // Abaikan error jaringan (tablet offline sementara) agar halaman tidak membeku
    // Jika tablet offline, biarkan tetap lanjut - jangan paksa logout
  }

  return response;
}
