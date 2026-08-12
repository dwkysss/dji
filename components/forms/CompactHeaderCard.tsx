import React from "react";
import { Factory, Layers, Scissors, Calendar } from "lucide-react";

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

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}([:.]\d{2})?$/.test(str)) {
      return str;
    }

    let dt: Date;
    if (str.includes("T")) {
      if (!str.includes("Z") && !str.includes("+") && !str.includes("-", 10)) {
        str = str + "Z";
      }
      dt = new Date(str);
    } else if (str.includes(" ")) {
      const parts = str.split(" ");
      const dPart = parts[0];
      const tPart = parts[1] || "00:00:00";
      if (!str.includes("Z") && !str.includes("+")) {
        dt = new Date(`${dPart}T${tPart}Z`);
      } else {
        dt = new Date(str);
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

  return (
    <div className="rounded-2xl overflow-hidden shadow-md border border-slate-200 mb-6 bg-white">
      {/* === BANNER HEADER === */}
      <div
        className="relative px-6 sm:px-8 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #091e42 0%, #0d386b 60%, #0052cc 100%)",
        }}
      >
        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-white/5 pointer-events-none" />

        {/* Left: Machine + Potongan */}
        <div className="flex items-center gap-4 z-10">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-900/60 backdrop-blur-sm flex items-center justify-center border border-slate-700/80 shrink-0 shadow-inner">
            <Factory className="w-6 h-6 sm:w-7 sm:h-7 text-slate-300" />
          </div>
          <div>
            <div className="text-slate-300/80 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest leading-none mb-1">
              NOMOR MESIN
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-none">
              {props.nomorMc || "—"}
            </div>
            <div className="mt-1 text-[#38bdf8] text-xs sm:text-sm font-bold">
              Potongan Ke-{potKe}
            </div>
          </div>
        </div>

        {/* Right: Design + Date */}
        <div className="z-10 flex flex-col items-start sm:items-end gap-2.5">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-1.5 text-left sm:text-right min-w-[120px]">
            <span className="text-white/60 text-[9px] uppercase tracking-widest font-bold block leading-tight">DESIGN</span>
            <span className="text-white font-black text-base sm:text-lg tracking-tight leading-tight">
              {props.design || "—"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1">
            <Calendar className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
            <span className="text-sky-200 text-xs font-semibold font-mono">{tglProd}</span>
          </div>
        </div>
      </div>

      {/* === BODY === */}
      <div className="bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">

          {/* LEFT: Spesifikasi Produksi */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center">
                <Layers className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
                SPESIFIKASI PRODUKSI
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
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
          <div className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-6 h-6 rounded bg-purple-50 flex items-center justify-center">
                <Scissors className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
                MATERIAL BENANG
              </span>
            </div>
            <div className="grid grid-cols-1 gap-y-4">
              <InfoField label="JENIS BENANG DASAR" value={props.benangDasar} />
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
