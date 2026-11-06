import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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
  // Hitung ukuran file APK secara dinamis dari disk agar selalu sinkron 100% dengan file unduhan aktual
  let apkSizeStr = "10.2 MB";
  try {
    const apkFilePath = path.join(process.cwd(), "public", "downloads", "dji-app.apk");
    if (fs.existsSync(apkFilePath)) {
      const stat = fs.statSync(apkFilePath);
      const mb = (stat.size / (1024 * 1024)).toFixed(1);
      apkSizeStr = `${mb} MB`;
    }
  } catch (err) {
    console.warn("[app-version] Gagal membaca ukuran file APK dari disk:", err);
  }

  const versionInfo: AppVersionResponse = {
    latestVersionName: "1.1.1",
    latestVersionCode: 3,
    apkUrl: "/downloads/dji-app.apk",
    apkSize: apkSizeStr,
    releaseNotes: [
      "Optimasi drastis ukuran APK dari 75 MB menjadi 10.2 MB (hemat memori dan penyimpanan tablet)",
      "Pencegahan freeze dan crash WebView Android ('This page couldn't load')",
      "Pembaruan manajemen heartbeat WebSocket ESP32 multi-tab",
      "Penyempurnaan sinkronisasi otomatis offline tanpa data dobel",
      "Perbaikan akurasi laporan bulanan mesin rajut meteran"
    ],
    mandatory: false,
    publishedAt: new Date().toISOString(),
  };

  return NextResponse.json(versionInfo, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
