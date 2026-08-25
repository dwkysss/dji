import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Paksa redirect ke HTTPS jika diakses lewat HTTP (misal: dji-v20.vercel.app)
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("host");

  if (proto === "http" && host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
    return NextResponse.redirect(`https://${host}${request.nextUrl.pathname}${request.nextUrl.search}`, 301);
  }

  try {
    const response = await updateSession(request);
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    return response;
  } catch (err) {
    const res = NextResponse.next();
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    return res;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files & PWA assets:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, manifest.json, sw.js, workbox-*.js, icons/, assets/
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|sw.js|workbox-.*|icons/.*|assets/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js)$).*)",
  ],
};
