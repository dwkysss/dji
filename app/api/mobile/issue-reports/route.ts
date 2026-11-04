import { NextRequest, NextResponse } from "next/server";
import {
  createIssueReport,
  fetchIssueReports,
  updateIssueReportStatus,
  deleteIssueReport,
} from "@/actions/issue-report-actions";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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
    const nomorMc = searchParams.get("nomorMc") || undefined;
    const status = (searchParams.get("status") as any) || "ALL";

    const res = await fetchIssueReports({ nomorMc, status });
    return NextResponse.json(res, { status: 200, headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, data: [], error: err?.message || "Server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await createIssueReport(body);
    return NextResponse.json(res, {
      status: res.success ? 200 : 400,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Invalid payload" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { reportId, status, resolutionNotes, resolvedBy } = body;
    if (!reportId || !status) {
      return NextResponse.json(
        { success: false, error: "Missing reportId or status" },
        { status: 400, headers: corsHeaders }
      );
    }
    const res = await updateIssueReportStatus(reportId, status, resolutionNotes, resolvedBy);
    return NextResponse.json(res, {
      status: res.success ? 200 : 400,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { reportId } = body;
    if (!reportId) {
      return NextResponse.json(
        { success: false, error: "Missing reportId" },
        { status: 400, headers: corsHeaders }
      );
    }
    const res = await deleteIssueReport(reportId);
    return NextResponse.json(res, {
      status: res.success ? 200 : 400,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
