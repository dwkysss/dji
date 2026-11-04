import { NextRequest, NextResponse } from "next/server";
import { getRecentShiftInputHistory } from "@/actions/continuous-actions";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const nomorMc = searchParams.get("nomorMc") || searchParams.get("mc") || undefined;
    const potonganKe = searchParams.get("potonganKe") || searchParams.get("potongan") || undefined;
    const limitCount = parseInt(searchParams.get("limit") || "100", 10);
    const panelTypeParam = searchParams.get("panelType") || "ALL";
    const panelType = panelTypeParam === "METERAN" ? "METERAN" : panelTypeParam === "PANEL" ? "PANEL" : "ALL";

    const res = await getRecentShiftInputHistory(nomorMc, limitCount, panelType, potonganKe);

    if (res.success && Array.isArray(res.data)) {
      res.data = res.data.filter((p: any) =>
        p.panel_no !== "Downtime Mekanik (Direct)" &&
        p.panel_no !== "BERHENTI" &&
        p.pcs !== 0 &&
        p.pcs !== "0"
      );
    }

    return NextResponse.json(res, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, data: [], error: err?.message || "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
