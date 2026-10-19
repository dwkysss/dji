import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "downloads", "dji-app.apk");

    if (!fs.existsSync(filePath)) {
      return new NextResponse("File APK belum tersedia di server.", { status: 404 });
    }

    const fileStat = fs.statSync(filePath);
    const fileStream = fs.createReadStream(filePath);

    // Convert Node ReadStream to Web ReadableStream
    const readable = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(readable as any, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": 'attachment; filename="dji-app.apk"',
        "Content-Length": String(fileStat.size),
        "Cache-Control": "public, max-age=3600, must-revalidate",
      },
    });
  } catch (error: any) {
    return new NextResponse(`Terjadi kesalahan server: ${error?.message || "Unknown"}`, { status: 500 });
  }
}
