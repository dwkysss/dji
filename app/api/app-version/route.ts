import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface AppVersionResponse {
  latestVersionName: string;
  latestVersionCode: number;
  apkUrl: string;
  apkSize: string;
  releaseNotes: string[];
  mandatory: boolean;
  publishedAt: string;
}

export async function GET() {
  const versionInfo: AppVersionResponse = {
    latestVersionName: "1.0.0",
    latestVersionCode: 1,
    apkUrl: "/downloads/dji-app.apk",
    apkSize: "21.6 MB",
    releaseNotes: [
      "Fitur Form Input Darurat Offline (Panel & Meteran)",
      "Peningkatan WebView cache saat offline",
      "Perlindungan tombol Back (Double-tap to exit)",
      "Dukungan kamera untuk foto cacat kain & QR scan",
      "Pencegahan layar mati otomatis (WakeLock)"
    ],
    mandatory: false,
    publishedAt: "2026-10-17T15:00:00Z",
  };

  return NextResponse.json(versionInfo, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
