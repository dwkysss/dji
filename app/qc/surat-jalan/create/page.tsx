"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSuratJalan, SuratJalanItem, SuratJalanHeader } from "@/actions/surat-jalan-actions";
import { ArrowLeft, Save, ScanLine, Trash2, Box, Camera, Keyboard, X, CheckCircle, HelpCircle } from "lucide-react";
import Link from "next/link";
import CameraScanner from "@/components/CameraScanner";
import SuratJalanPrintTemplate from "@/components/SuratJalanPrintTemplate";
import ProductTour, { ProductTourStep } from "@/components/ProductTour";

const QC_CREATE_SJ_TOUR_STEPS: ProductTourStep[] = [
  { target: "qc-create-sj-header", title: "Buat Surat Jalan", description: "Halaman ini dipakai untuk membuat dokumen pengiriman dari barcode yang sudah lolos QC." },
  { target: "qc-create-sj-info", title: "Info Pengiriman", description: "Isi tujuan, alamat, kota, provinsi, kode pos, dan detail pengiriman lainnya." },
  { target: "qc-create-sj-scanner", title: "Scan Barcode", description: "Gunakan scanner infrared atau kamera untuk memasukkan kain ke daftar muatan." },
  { target: "qc-create-sj-items", title: "Daftar Muatan", description: "Kain yang berhasil discan akan muncul di sini. Hapus baris jika ada scan yang salah." },
  { target: "qc-create-sj-actions", title: "Preview dan Simpan", description: "Preview dokumen sebelum menyimpan, lalu tekan Simpan Surat Jalan jika muatan sudah lengkap." },
];

export default function CreateSuratJalanPage() {
  const router = useRouter();
  
  const [header, setHeader] = useState<SuratJalanHeader>({
    tujuan: "",
    alamat_detail: "",
    kab_kota: "",
    provinsi: "",
    kode_pos: "",
    negara: "",
    telepon: "",
    supir: "",
    no_polisi: "",
    keterangan: "",
    pakai_benang_dji: false
  });

  const [items, setItems] = useState<SuratJalanItem[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanSuccessMsg, setScanSuccessMsg] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<"infrared" | "camera">("infrared");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  const scanInputRef = useRef<HTMLTextAreaElement>(null);

  const processScannedData = (val: string) => {
    try {
      const parsed = JSON.parse(val);
      if (parsed.kode_design && parsed.nomor_mesin) {
        const isDuplicate = items.some(
          i => i.nomor_mc === parsed.nomor_mesin && 
               i.design_id === parsed.kode_design && 
               i.potongan_ke === String(parsed.potongan_ke) &&
               i.pcs_ke === String(parsed.pcs_ke)
        );

        if (!isDuplicate) {
          const newItem: SuratJalanItem = {
            nomor_mc: parsed.nomor_mesin,
            design_id: parsed.kode_design,
            potongan_ke: String(parsed.potongan_ke),
            berat_kain: parsed.berat_kain ? parsed.berat_kain.replace(' kg', '') : "0",
            jumlah_panel: parseInt(parsed.jumlah_panel) || 1,
            pcs_ke: String(parsed.pcs_ke || "-"),
            grade: parsed.grade || "A",
            no_order: parsed.no_order || "-",
            no_customer: parsed.no_customer || "-"
          };
          setItems(prev => [...prev, newItem]);
          setErrorMsg(null);
          setScanSuccessMsg(`Berhasil ditambahkan: MC ${newItem.nomor_mc} Pot ${newItem.potongan_ke} PCS ${newItem.pcs_ke}`);
          setTimeout(() => setScanSuccessMsg(null), 2500);
        } else {
          setErrorMsg("Batch ini sudah ada di dalam daftar muatan!");
        }
      }
    } catch (err) {
      // JSON belum komplit atau gagal parsing
    }
  };

  // Handle barcode scanner input (it acts like a keyboard pasting JSON and pressing enter)
  const handleScanInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setScanInput(val);
    processScannedData(val);
    // Bersihkan input jika ada awalan kurung kurawal
    if (val.includes('}')) {
       setTimeout(() => setScanInput(""), 50);
    }
  };

  const handleCameraScanSuccess = (decodedText: string) => {
    processScannedData(decodedText);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!header.tujuan) {
      setErrorMsg("Tujuan pengiriman harus diisi!");
      return;
    }
    if (items.length === 0) {
      setErrorMsg("Belum ada muatan kain yang di-scan!");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await createSuratJalan(header, items);
    if (res.success) {
      router.push("/qc/surat-jalan");
    } else {
      setErrorMsg(res.error || "Terjadi kesalahan saat menyimpan");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full pb-20 animate-fadeIn relative">
      
      {/* Toast Notification */}
      {scanSuccessMsg && (
        <div className="fixed top-4 right-4 z-[100] bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="font-semibold text-sm">{scanSuccessMsg}</span>
        </div>
      )}

      {/* Header */}
      <div data-tour="qc-create-sj-header" className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
        <Link href="/qc/surat-jalan" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            Buat Surat Jalan Baru
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Lengkapi informasi pengiriman dan scan barcode kain yang akan dimuat.</p>
        </div>
        <button type="button" onClick={() => setIsTourOpen(true)} className="h-11 px-4 rounded-full bg-[#0070bc] hover:bg-[#004777] text-white text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2 self-start md:self-auto">
          <HelpCircle className="w-4 h-4" /> Tu
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 font-medium text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Kolom Kiri - Form Header */}
        <div className="lg:col-span-1 space-y-6">
          <div data-tour="qc-create-sj-info" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Info Pengiriman</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Tujuan Pengiriman *</label>
                <input 
                  type="text" 
                  required
                  value={header.tujuan}
                  onChange={(e) => setHeader({...header, tujuan: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0070bc]/20 focus:border-[#0070bc] transition-all"
                  placeholder="Contoh: PT. SAURINDOTEX MANDIRI"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Alamat Detail *</label>
                <textarea 
                  required
                  value={header.alamat_detail}
                  onChange={(e) => setHeader({...header, alamat_detail: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0070bc]/20 focus:border-[#0070bc] transition-all h-20 resize-none"
                  placeholder="Contoh: Kawasan Industri PT Lippo City..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Kab / Kota *</label>
                <input 
                  type="text" 
                  required
                  value={header.kab_kota}
                  onChange={(e) => setHeader({...header, kab_kota: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0070bc]/20 focus:border-[#0070bc] transition-all"
                  placeholder="Contoh: Kab. Bekasi"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Provinsi *</label>
                <input 
                  type="text" 
                  required
                  value={header.provinsi}
                  onChange={(e) => setHeader({...header, provinsi: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0070bc]/20 focus:border-[#0070bc] transition-all"
                  placeholder="Contoh: Jawa Barat"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Kode Pos *</label>
                  <input 
                    type="text" 
                    required
                    value={header.kode_pos}
                    onChange={(e) => setHeader({...header, kode_pos: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0070bc]/20 focus:border-[#0070bc] transition-all"
                    placeholder="Contoh: 17550"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Negara *</label>
                  <input 
                    type="text" 
                    required
                    value={header.negara}
                    onChange={(e) => setHeader({...header, negara: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0070bc]/20 focus:border-[#0070bc] transition-all"
                    placeholder="Contoh: Indonesia"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Telepon Tujuan</label>
                <input 
                  type="text" 
                  value={header.telepon}
                  onChange={(e) => setHeader({...header, telepon: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0070bc]/20 focus:border-[#0070bc] transition-all"
                  placeholder="Contoh: 021-8974469"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Keterangan Tambahan</label>
                <textarea 
                  value={header.keterangan}
                  onChange={(e) => setHeader({...header, keterangan: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0070bc]/20 focus:border-[#0070bc] transition-all h-24 resize-none"
                  placeholder="Keterangan opsional..."
                />
              </div>

              <div className="flex items-center gap-3 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="benang-dji"
                  checked={header.pakai_benang_dji || false}
                  onChange={(e) => setHeader({...header, pakai_benang_dji: e.target.checked})}
                  className="w-5 h-5 rounded border-slate-300 text-[#0070bc] focus:ring-[#0070bc]"
                />
                <label htmlFor="benang-dji" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                  Pakai Benang DJI
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan - Scan & Daftar Muatan */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Scanner Area */}
          <div data-tour="qc-create-sj-scanner" className="bg-[#0070bc]/5 border border-[#0070bc]/20 p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-[#0070bc]/10 pb-3">
              <h3 className="font-bold text-[#0070bc] flex items-center gap-2">
                <ScanLine className="w-5 h-5" /> 
                Mode Scanner
              </h3>
              <div className="flex bg-white rounded-lg p-1 border border-[#0070bc]/20 shadow-sm">
                <button
                  type="button"
                  onClick={() => setScanMode("infrared")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${scanMode === "infrared" ? "bg-[#0070bc] text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  Scanner Infrared
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode("camera")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${scanMode === "camera" ? "bg-[#0070bc] text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Kamera HP / Webcam
                </button>
              </div>
            </div>

            {scanMode === "infrared" ? (
              <div className="flex items-start gap-4 animate-fadeIn">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0 text-[#0070bc]">
                  <ScanLine className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-600 mb-3 font-medium">Arahkan kursor ke kotak di bawah ini, lalu tembakkan scanner infrared ke Barcode yang tertempel pada kain.</p>
                  <textarea 
                    ref={scanInputRef}
                    value={scanInput}
                    onChange={handleScanInput}
                    className="w-full bg-white border border-[#0070bc]/30 rounded-xl p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0070bc]/40 transition-all opacity-70 focus:opacity-100 shadow-inner"
                    placeholder="Klik disini lalu mulai scan barcode..."
                    rows={2}
                  />
                </div>
              </div>
            ) : (
              <div className="animate-fadeIn w-full max-w-sm mx-auto">
                <p className="text-sm text-slate-600 mb-3 text-center font-medium">Arahkan kamera ke Barcode (QR Code) pada kertas.</p>
                <CameraScanner 
                  onScanSuccess={handleCameraScanSuccess} 
                />
              </div>
            )}
          </div>

          {/* Tabel Muatan */}
          <div data-tour="qc-create-sj-items" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Daftar Muatan ({items.length} Item)</h3>
            </div>

            {items.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Box className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">Belum ada muatan.</p>
                <p className="text-xs text-slate-400 mt-1">Silakan scan barcode untuk menambah muatan.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">Mesin</th>
                      <th className="px-4 py-3">Design</th>
                      <th className="px-4 py-3">Potongan</th>
                      <th className="px-4 py-3">Berat / Panel</th>
                      <th className="px-4 py-3">Grade</th>
                      <th className="px-4 py-3 text-right rounded-r-lg">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-bold text-slate-800">{item.nomor_mc}</td>
                        <td className="px-4 py-3 font-medium text-[#0070bc]">{item.design_id}</td>
                        <td className="px-4 py-3">{item.potongan_ke}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-700">{item.berat_kain} kg</span>
                          <span className="text-xs text-slate-500 ml-1">/ {item.jumlah_panel} pcs</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded">
                            {item.grade}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            type="button" 
                            onClick={() => removeItem(idx)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          <div data-tour="qc-create-sj-actions" className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-xl shadow-sm font-bold transition-all"
            >
              Preview
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-[#0070bc] hover:bg-[#005a96] text-white px-6 py-2.5 rounded-xl shadow-sm font-bold transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? "Menyimpan..." : "Simpan Surat Jalan"}
            </button>
          </div>

        </div>
      </form>

      <ProductTour
        steps={QC_CREATE_SJ_TOUR_STEPS}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />

      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsPreviewOpen(false)} />
          <div className="relative bg-slate-200 w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-300 flex items-center justify-between bg-white shrink-0">
              <h2 className="text-lg font-bold text-slate-800">Preview Surat Jalan (Rangkap 2)</h2>
              <button onClick={() => setIsPreviewOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
              <div className="bg-white shadow-md w-[210mm] min-h-[297mm] flex flex-col items-center shrink-0">
                <div className="w-full h-[148.5mm]">
                  <SuratJalanPrintTemplate data={{
                    no_surat_jalan: "DRAFT-XXXX",
                    tanggal: new Date().toISOString(),
                    tujuan: JSON.stringify({
                       tujuan: header.tujuan,
                       alamat_detail: header.alamat_detail,
                       kab_kota: header.kab_kota,
                       provinsi: header.provinsi,
                       kode_pos: header.kode_pos,
                       negara: header.negara,
                       telepon: header.telepon,
                       pakai_benang_dji: header.pakai_benang_dji
                    }),
                    surat_jalan_details: items
                  }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
