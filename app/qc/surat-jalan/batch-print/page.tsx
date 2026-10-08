"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSuratJalanById } from "@/actions/surat-jalan-actions";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import SuratJalanPrintTemplate from "@/components/SuratJalanPrintTemplate";

function BatchPrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");
  
  const [dataList, setDataList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!idsParam) {
        setErrorMsg("Tidak ada Surat Jalan yang dipilih.");
        setIsLoading(false);
        return;
      }

      const ids = idsParam.split(",");
      try {
        const results = await Promise.all(ids.map(id => getSuratJalanById(id)));
        
        const validData = results
          .filter(res => res.success && res.data)
          .map(res => res.data);
          
        if (validData.length === 0) {
          setErrorMsg("Gagal memuat semua Surat Jalan yang dipilih.");
        } else {
          setDataList(validData);
        }
      } catch (err: any) {
        setErrorMsg("Terjadi kesalahan: " + err.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAllData();
  }, [idsParam]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Memuat dokumen...</div>;
  }

  if (errorMsg || dataList.length === 0) {
    return <div className="flex h-screen items-center justify-center text-red-500">{errorMsg}</div>;
  }

  // Chunk array into pairs (2 items per page)
  const pages = [];
  for (let i = 0; i < dataList.length; i += 2) {
    pages.push(dataList.slice(i, i + 2));
  }

  return (
    <div className="bg-slate-200 min-h-screen py-8 print:bg-white print:py-0 flex flex-col items-center justify-start">
      
      {/* Header Print */}
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
          Cetak {dataList.length} Dokumen
        </button>
      </div>

      {/* Pages Render */}
      {pages.map((pageItems, pageIndex) => (
        <div 
          key={pageIndex} 
          className="bg-white shadow-md print:shadow-none print:w-full print:m-0 w-[210mm] h-[297mm] flex flex-col items-center mb-8 print:mb-0"
          style={{ pageBreakAfter: "always" }}
        >
          {/* Top Half */}
          <div className={`w-full h-[148.5mm] overflow-hidden ${pageItems.length > 1 ? 'border-b border-dashed border-slate-300 print:border-none' : ''}`}>
            <SuratJalanPrintTemplate data={pageItems[0]} />
          </div>
          
          {/* Bottom Half */}
          {pageItems[1] ? (
            <div className="w-full h-[148.5mm] overflow-hidden">
              <SuratJalanPrintTemplate data={pageItems[1]} />
            </div>
          ) : (
            <div className="w-full h-[148.5mm] flex items-center justify-center text-slate-300 print:hidden overflow-hidden">
              (Halaman Kosong)
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function BatchPrintPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Memuat...</div>}>
      <BatchPrintContent />
    </Suspense>
  );
}
