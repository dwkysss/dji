"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getEmployeeHistoryDetail } from "@/actions/employee-actions";
import { Loader2, ArrowLeft } from "lucide-react";
import EmployeeForm from "@/components/forms/EmployeeForm";
import ContinuousForm from "@/components/forms/ContinuousForm";

function EditProductionContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const headerId = params.id as string;
  const defaultMeter = searchParams.get("meter") || undefined;
  const rawPcs = searchParams.get("pcs");
  const defaultPcsIndex = (rawPcs && rawPcs !== "undefined" && rawPcs !== "null") ? rawPcs : undefined;
  const returnUrl = searchParams.get("returnUrl") || undefined;

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!headerId) return;

    const fetchDetail = async () => {
      try {
        const res = await getEmployeeHistoryDetail(headerId);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setErrorMsg(res.error || "Gagal memuat data laporan.");
        }
      } catch (err: any) {
        setErrorMsg("Terjadi kesalahan jaringan.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [headerId]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10 w-full animate-fadeIn">
        <Loader2 className="w-10 h-10 animate-spin text-[#0070bc] mb-4" />
        <span className="text-slate-500 font-medium">Memuat Data Laporan...</span>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10 w-full animate-fadeIn">
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl max-w-md text-center shadow-sm">
          <h3 className="font-bold text-lg mb-2">Terjadi Kesalahan</h3>
          <p className="text-sm">{errorMsg || "Data tidak ditemukan."}</p>
          <button 
            onClick={() => router.push("/history")}
            className="mt-4 px-4 py-2 bg-red-100 text-red-700 font-bold text-xs rounded-xl"
          >
            Kembali ke Riwayat
          </button>
        </div>
      </div>
    );
  }

  const isMeteran = data.panel_no === "METERAN";

  return (
    <div className="flex-1 flex flex-col items-center animate-fadeIn py-8 px-4 w-full">
      <div className="w-full max-w-6xl flex justify-between items-center mb-6">
        <button 
          onClick={() => {
            if (returnUrl) {
              router.push(returnUrl);
            } else {
              router.back();
            }
          }}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-semibold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          Batal Edit
        </button>
        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold shadow-sm border border-amber-200">
          MODE EDIT DATA
        </span>
      </div>
      
      {isMeteran ? (
        <ContinuousForm 
          initialData={data} 
          isEdit={true} 
          defaultMeter={defaultMeter} 
          defaultPcsIndex={defaultPcsIndex}
          returnUrl={returnUrl}
        />
      ) : (
        <EmployeeForm initialData={data} isEdit={true} returnUrl={returnUrl} />
      )}
    </div>
  );
}

export default function EditProductionPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center p-10 w-full animate-fadeIn">
        <Loader2 className="w-10 h-10 animate-spin text-[#0070bc] mb-4" />
        <span className="text-slate-500 font-medium">Memuat Data Laporan...</span>
      </div>
    }>
      <EditProductionContent />
    </Suspense>
  );
}
