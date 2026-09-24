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
    pathname.startsWith("/api") ||
    pathname.startsWith("/~offline");

  // ─────────────────────────────────────────────────────────────────────────
  // FIX MASALAH 1: Deteksi penumpukan cookie yang bisa menyebabkan HTTP 431.
  //
  // Nginx memiliki batas default 32KB (4 buffer × 8KB) untuk seluruh request
  // header. Cookie Supabase (sb-*) bisa menumpuk hingga melebihi batas ini
  // terutama di tablet yang tidak pernah dibersihkan, menyebabkan Nginx
  // menolak request dan Chrome menampilkan "This page couldn't load".
  //
  // Solusi: Periksa ukuran header Cookie di sisi Next.js SEBELUM Nginx
  // berkesempatan menolak. Jika sudah > 20KB, paksa bersihkan cookie Supabase
  // dan arahkan ulang ke /login untuk sesi baru yang bersih.
  // ─────────────────────────────────────────────────────────────────────────
  const COOKIE_SIZE_LIMIT_BYTES = 20 * 1024; // 20KB — batas aman sebelum 431
  const rawCookieHeader = request.headers.get("cookie") || "";
  const cookieSizeBytes = new TextEncoder().encode(rawCookieHeader).length;

  if (cookieSizeBytes > COOKIE_SIZE_LIMIT_BYTES) {
    if (!isPublicPath) {
      // Cookie sudah terlalu besar — bersihkan semua sb-* dan redirect ke login
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("session_expired", "1");
      loginUrl.searchParams.set("reason", "cookie_overflow");

      const overflowResponse = NextResponse.redirect(loginUrl);

      // Hapus semua cookie Supabase yang menumpuk agar browser mendapat sesi bersih
      request.cookies.getAll().forEach(({ name }) => {
        if (isSupabaseCookie(name)) {
          overflowResponse.cookies.set(name, "", {
            maxAge: 0,
            path: "/",
            sameSite: "lax",
            secure: true,
          });
        }
      });

      return overflowResponse;
    } else {
      // Jika sudah di halaman publik (seperti /login), bersihkan cookie langsung di response tanpa redirect loop
      const cleanResponse = NextResponse.next();
      request.cookies.getAll().forEach(({ name }) => {
        if (isSupabaseCookie(name)) {
          cleanResponse.cookies.set(name, "", {
            maxAge: 0,
            path: "/",
            sameSite: "lax",
            secure: true,
          });
        }
      });
      return cleanResponse;
    }
  }

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
      const hasSupabaseCookies = request.cookies.getAll().some((c) => isSupabaseCookie(c.name));

      // Jika ada error autentikasi saat membuka halaman privat dan ada sisa cookie Supabase,
      // hapus SEMUA cookie Supabase yang rusak dan redirect paksa ke /login.
      // Ini mencegah tablet menampilkan layar kosong "This page couldn't load" akibat token korup.
      if (hasSupabaseCookies || error.status === 401 || error.status === 403) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.searchParams.set("session_expired", "1");

        const redirectResponse = NextResponse.redirect(loginUrl);

        // Hapus SEMUA cookie Supabase yang ada agar tidak ada sisa token rusak
        request.cookies.getAll().forEach(({ name }) => {
          if (isSupabaseCookie(name)) {
            redirectResponse.cookies.set(name, "", {
              maxAge: 0,
              path: "/",
              sameSite: "lax",
              secure: true,
            });
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
