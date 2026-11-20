import React from "react";
import { getPotonganTrackingData } from "@/actions/tracking-actions";
import PotonganTrackingView from "@/components/track/PotonganTrackingView";

export const dynamic = "force-dynamic";

interface TrackPageProps {
  params: Promise<{
    mc: string;
    potongan: string;
  }>;
  searchParams: Promise<{
    pcs?: string;
  }>;
}

export async function generateMetadata({ params }: TrackPageProps) {
  const { mc, potongan } = await params;
  const decodedMc = decodeURIComponent(mc).toUpperCase();
  return {
    title: `Tracking MC ${decodedMc} / Pot ${potongan} — PT DJI`,
    description: `Live tracking status produksi, QC, dan mending untuk MC ${decodedMc} Potongan ${potongan}.`,
  };
}

export default async function TrackPotonganPage({
  params,
  searchParams,
}: TrackPageProps) {
  const { mc, potongan } = await params;
  const { pcs } = await searchParams;

  const potonganNum = parseInt(potongan, 10);
  const initialPcs = pcs ? parseInt(pcs, 10) : 1;

  const res = await getPotonganTrackingData(mc, potonganNum);

  if (!res.success || !res.data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-slate-200 p-6 text-center space-y-2">
          <h1 className="text-lg font-black text-slate-900">Terjadi Kesalahan</h1>
          <p className="text-xs text-slate-500">
            {res.error || "Gagal memuat data tracking potongan kain."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <PotonganTrackingView
      initialData={res.data}
      initialPcs={Number.isFinite(initialPcs) && initialPcs > 0 ? initialPcs : 1}
    />
  );
}
