"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function QCBarcodeRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/mending/barcode");
  }, [router]);

  return (
    <div className="w-full h-full min-h-[50vh] flex flex-col items-center justify-center p-8 text-center">
      <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
      <p className="text-sm font-bold text-slate-700">
        Mengalihkan ke halaman Cetak Barcode Mending...
      </p>
    </div>
  );
}
