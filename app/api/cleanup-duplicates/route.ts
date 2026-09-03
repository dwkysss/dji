import { NextRequest, NextResponse } from "next/server";
import { cleanupDuplicateMeterFinishHeaders } from "@/actions/continuous-actions";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mc = searchParams.get("mc") || "R11";
  const potongan = searchParams.get("potongan") ? parseInt(searchParams.get("potongan")!) : 176;

  try {
    const res = await cleanupDuplicateMeterFinishHeaders({
      nomorMc: mc,
      potonganKe: potongan,
    });

    return NextResponse.json({
      success: res.success,
      deletedHeadersCount: res.deletedHeadersCount,
      message: res.success
        ? `Berhasil membersihkan ${res.deletedHeadersCount || 0} header duplikat untuk Mesin ${mc} Potongan ${potongan}.`
        : res.error,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Gagal membersihkan data" },
      { status: 500 }
    );
  }
}
