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
    latestVersionName: "1.1.0",
    latestVersionCode: 2,
    apkUrl: "/downloads/dji-app.apk",
    apkSize: "75.2 MB",
    releaseNotes: [
      "Pembaruan Tampilan Portal Offline Baru (Modular CSS/JS)",
      "Tampilan Riwayat Potongan dibuat 1:1 identik dengan versi online (tabel panel, kolom tgl, jam, grup, operator, status KET, cacat, dan downtime)",
      "Sinkronisasi otomatis parameter mesin, potongan, operator & nomor panel dari database",
      "Fitur Laporan Mesin Mati Total & Timer Downtime Lokal",
      "Pencegahan Cache Basi Browser & WebView Offline",
      "Peningkatan sinkronisasi otomatis saat internet kembali pulih"
    ],
    mandatory: false,
    publishedAt: "2026-10-27T08:30:00Z",
  };

  return NextResponse.json(versionInfo, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
