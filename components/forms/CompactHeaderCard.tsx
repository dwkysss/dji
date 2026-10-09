"use client";

import React, { useState, useEffect } from "react";
import { Factory, Layers, Scissors, ChevronDown } from "lucide-react";

interface CompactHeaderCardProps {
  nomorMc: string;
  shiftName: string;
  operatorName: string;
  design: string;
  pcsCount: number;

  // Spesifikasi Produksi
  panelPotongan: string;
  courseRpm: string;
  noCustomer: string;
  noOrder: string;
  tanggalPotong: string;
  statusMatching: string;
  pick: string;

  // Benang & Material
  benangDasar: string;
  liner: string;
  heavy: string;
  shadow: string;
  pinggiran: string;

  // Added for report parity
  tanggalProduksi?: string;
  rollNo?: string;
  course?: string;
  rpm?: string;
  potonganKe?: string;
}

function InfoField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none truncate">
        {label}
      </span>
      <span
        className={`text-xs sm:text-sm font-extrabold leading-snug break-words ${
          highlight ? "text-[#0070bc]" : "text-slate-900"
        }`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function formatFullDateTime(dateVal?: string): string {
  if (!dateVal || dateVal === "-" || dateVal === "—") return "—";

  try {
    let str = String(dateVal).trim();
    if (!str) return "—";

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    let dt: Date;
    if (str.includes("T")) {
      dt = new Date(str);
    } else if (str.includes(" ")) {
      const parts = str.split(" ");
      const dPart = parts[0];
      const tPart = parts[1] || "00:00:00";
      if (str.includes("Z") || str.includes("+") || str.includes("-", 10)) {
        dt = new Date(str);
      } else {
        dt = new Date(`${dPart}T${tPart}`);
      }
    } else {
      dt = new Date(str);
    }

    if (isNaN(dt.getTime())) {
      return dateVal;
    }

    const year = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" });
    const month = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta", month: "2-digit" });
    const day = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta", day: "2-digit" });
    const timeStr = dt.toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).replace(".", ":");

    return `${year}-${month}-${day} ${timeStr}`;
  } catch (e) {
    return dateVal;
  }
}

export default function CompactHeaderCard(props: CompactHeaderCardProps) {
  const potKe = props.potonganKe || (props.panelPotongan ? props.panelPotongan.split(" / ")[1] : "-");
  const crs = props.course || (props.courseRpm ? props.courseRpm.split(" / ")[0] : "-");
  const rpm = props.rpm || (props.courseRpm ? props.courseRpm.split(" / ")[1] : "-");
  const tglProd = formatFullDateTime(props.tanggalProduksi);
  const tglPotong = formatFullDateTime(props.tanggalPotong);

  // Toggle hanya berlaku khusus untuk layar HP/Mobile (< sm) dengan default tertutup (collapse) sesuai permintaan.
  // Di Laptop dan Tablet (sm ke atas), rincian spesifikasi SELALU tampil penuh secara permanen (sm:!block).
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    // Bersihkan residu preferensi lama dari localStorage agar tidak mengganggu tampilan laptop
    try {
      localStorage.removeItem("dji_header_card_expanded");
    } catch (e) {}
  }, []);

  const handleMobileToggle = () => {
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      setIsMobileOpen((prev) => !prev);
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden shadow-xs border border-slate-200/90 mb-4 sm:mb-6 bg-white transition-all">
      {/* === BANNER HEADER === */}
      <div
        onClick={handleMobileToggle}
        className="relative px-3.5 sm:px-8 py-3 sm:py-4.5 flex items-center justify-between gap-3 overflow-hidden select-none cursor-pointer sm:cursor-default"
        style={{
          background: "linear-gradient(135deg, #091e42 0%, #0d386b 60%, #0052cc 100%)",
        }}
      >
        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-white/5 pointer-events-none" />

        {/* Left: Machine + Potongan Blocks */}
        <div className="flex items-center gap-2.5 sm:gap-6 z-10 min-w-0">
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-slate-900/60 backdrop-blur-sm flex items-center justify-center border border-slate-700/80 shrink-0 shadow-inner">
            <Factory className="w-5 h-5 sm:w-7 sm:h-7 text-slate-300" />
          </div>

          <div className="flex items-center gap-2.5 sm:gap-6 min-w-0">
            <div>
              <div className="text-slate-300/80 text-[9px] sm:text-[11px] font-bold uppercase tracking-widest leading-none mb-0.5 sm:mb-1">
                NOMOR MESIN
              </div>
              <div className="text-base sm:text-3xl font-black text-white tracking-tight leading-none truncate">
                {props.nomorMc || "—"}
              </div>
            </div>

            {/* Divider */}
            <div className="h-6 sm:h-8 w-px bg-white/20 shrink-0" />

            <div>
              <div className="text-slate-300/80 text-[9px] sm:text-[11px] font-bold uppercase tracking-widest leading-none mb-0.5 sm:mb-1">
                POTONGAN
              </div>
              <div className="text-base sm:text-3xl font-black text-white tracking-tight leading-none truncate">
                {potKe || "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Design (Di laptop tampil bersih tanpa tombol chevron; di mobile ada toggle ringkas) */}
        <div className="z-10 flex items-center gap-2 shrink-0">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-2.5 sm:px-4 py-1 sm:py-1.5 text-right sm:min-w-[120px]">
            <span className="text-white/60 text-[8px] sm:text-[9px] uppercase tracking-widest font-bold block leading-tight">
              DESIGN
            </span>
            <span className="text-white font-black text-xs sm:text-lg tracking-tight leading-tight block truncate max-w-[110px] sm:max-w-none">
              {props.design || "—"}
            </span>
          </div>

          {/* KHUSUS MOBILE (< sm): Tombol toggle kecil hanya tampil di HP (default mengarah ke bawah karena tertutup) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMobileOpen((prev) => !prev);
            }}
            className="flex sm:hidden h-7 w-7 rounded-lg bg-white/15 hover:bg-white/25 active:scale-95 text-white items-center justify-center transition-all border border-white/20 cursor-pointer shadow-2xs"
            title={isMobileOpen ? "Sembunyikan Rincian Spesifikasi" : "Lihat Spesifikasi Lengkap"}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isMobileOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* === BODY (Spesifikasi & Material) === */}
      {/* Laptop & Tablet (sm:): SELALU TAMPIL PERMANEN (sm:!block). Mobile: mengikuti toggle isMobileOpen */}
      <div className={`bg-white border-t border-slate-100 ${isMobileOpen ? "block" : "hidden sm:!block"}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {/* LEFT: Spesifikasi Produksi */}
          <div className="p-3.5 sm:p-6">
            <div className="flex items-center gap-2 mb-3 sm:mb-5">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-blue-50 flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
              </div>
              <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-wider">
                SPESIFIKASI PRODUKSI
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3.5 sm:gap-x-6 gap-y-2.5 sm:gap-y-4">
              <InfoField label="TANGGAL PRODUKSI" value={tglProd} />
              <InfoField label="TANGGAL POTONG" value={tglPotong} />
              <InfoField label="PICK" value={props.pick} />
              <InfoField label="COURSE" value={crs} />
              <InfoField label="RPM" value={rpm} />
              <InfoField label="NO. ORDER BARANG" value={props.noOrder} />
              <InfoField label="NO. CUSTOMER" value={props.noCustomer} />
            </div>
          </div>

          {/* RIGHT: Material Benang */}
          <div className="p-3.5 sm:p-6">
            <div className="flex items-center gap-2 mb-3 sm:mb-5">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-purple-50 flex items-center justify-center shrink-0">
                <Scissors className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
              </div>
              <span className="text-[11px] sm:text-xs font-black text-slate-600 uppercase tracking-wider">
                MATERIAL BENANG
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-x-3.5 sm:gap-x-0 gap-y-2.5 sm:gap-y-4">
              <div className="col-span-2 sm:col-span-1">
                <InfoField label="JENIS BENANG DASAR" value={props.benangDasar} />
              </div>
              <InfoField label="LINER" value={props.liner} />
              <InfoField label="HEAVY" value={props.heavy} />
              <InfoField label="SHADOW" value={props.shadow} />
              <InfoField label="PINGGIRAN" value={props.pinggiran} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
