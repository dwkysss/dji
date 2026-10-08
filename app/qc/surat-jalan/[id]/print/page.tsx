"use client";

import React, { useState, useEffect } from "react";
import { getSuratJalanById } from "@/actions/surat-jalan-actions";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import SuratJalanPrintTemplate from '@/components/SuratJalanPrintTemplate';

export default function PrintSuratJalanPage() {
  const router = useRouter();
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || typeof id !== "string") return;
      setIsLoading(true);
      const res = await getSuratJalanById(id);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setErrorMsg(res.error || "Gagal memuat Surat Jalan");
      }
      setIsLoading(false);
    };
    fetchData();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Memuat dokumen...</div>;
  }

  if (errorMsg || !data) {
    return <div className="flex h-screen items-center justify-center text-red-500">{errorMsg}</div>;
  }

  return (
    <div className="bg-slate-200 min-h-screen py-8 print:bg-white print:py-0 flex flex-col items-center justify-start">
      
      {/* Tombol Print (Sembunyi saat diprint) */}
      <div className="max-w-[210mm] w-full mx-auto mb-4 flex justify-between items-center print:hidden px-4">
        <button 
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/qc/surat-jalan");
            }
          }}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium bg-white px-4 py-2 rounded-lg shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-[#0070bc] hover:bg-[#005a96] text-white px-6 py-2.5 rounded-lg shadow-sm font-bold transition-colors"
        >
          <Printer className="w-4 h-4" />
          Cetak Dokumen
        </button>
      </div>

      {/* Kertas A4 */}
      <div className="bg-white shadow-md print:shadow-none print:w-full print:m-0 w-[210mm] min-h-[297mm] flex flex-col items-center">
        {/* Copy 1 (Top Half) */}
        <div className="w-full h-[148.5mm]">
          <SuratJalanPrintTemplate data={data} />
        </div>
      </div>
    </div>
  );
}
