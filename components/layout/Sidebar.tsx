"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  ClipboardList,
  ClipboardCheck,
  MessageSquare,
  Scissors,
  LogOut,
  Menu,
  X,
  User,
  Settings,
  HelpCircle,
  History,
  RefreshCw,
  ChevronDown,
  Factory,
  Wrench,
  MoreHorizontal,
  QrCode,
  PowerOff,
  FileSpreadsheet,
  Calendar,
  ShieldCheck,
  Users,
  Megaphone,
  ListFilter,
  SlidersHorizontal,
  Bell,
  FlaskConical,
  Tag,
  Trophy,
  UserCheck,
  Package,
} from "lucide-react";

const MACHINE_INPUT_TYPES: Record<string, string> = {
  "MC-01": "METER",
  "MC-02": "METER",
};

function isNavItemActive(
  itemHref: string,
  currentPathname: string,
  allItems: any[],
): boolean {
  if (currentPathname === itemHref) return true;

  if (itemHref === "/input" || itemHref === "/input-meter") {
    if (currentPathname === "/input" || currentPathname === "/input-meter")
      return true;
  }

  if (itemHref === "/") {
    return currentPathname === "/";
  }

  if (currentPathname.startsWith(itemHref + "/")) {
    const hasMoreSpecificMatch = allItems.some(
      (other: any) =>
        other.href !== itemHref &&
        other.href.length > itemHref.length &&
        (currentPathname === other.href ||
          currentPathname.startsWith(other.href + "/")),
    );
    return !hasMoreSpecificMatch;
  }

  return false;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [inputRoute, setInputRoute] = useState<string>("/input");

  useEffect(() => {
    const checkInputRoute = () => {
      try {
        const saved = localStorage.getItem("dji_form_header");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.nomorMc) {
            const isMeter = MACHINE_INPUT_TYPES[parsed.nomorMc.toUpperCase()] === "METER";
            setInputRoute(isMeter ? "/input-meter" : "/input");
            return;
          }
        }
      } catch (e) { }
      setInputRoute("/input");
    };

    checkInputRoute();
    window.addEventListener("storage", checkInputRoute);
    window.addEventListener("focus", checkInputRoute);
    return () => {
      window.removeEventListener("storage", checkInputRoute);
      window.removeEventListener("focus", checkInputRoute);
    };
  }, []);

  if (!user) return null;

  const menuGroups = [
    {
      label: "Dashboard",
      groupIcon: LayoutDashboard,
      items: [
        {
          name: "Dashboard Umum",
          href: "/",
          icon: LayoutDashboard,
          roles: ["admin", "manager", "kepala_shift"],
        },
        {
          name: "Monitoring Mesin",
          href: "/machines",
          icon: Factory,
          roles: ["admin", "manager", "kepala_shift"],
        },
        {
          name: "Dashboard Pegawai",
          href: "/dashboard",
          icon: LayoutDashboard,
          roles: ["admin", "manager", "operator", "kepala_shift"],
        },
      ],
    },
    {
      label: "Kepala Shift",
      groupIcon: UserCheck,
      items: [
        {
          name: "Kinerja Shift Bulanan",
          href: "/shift-performance",
          icon: Trophy,
          roles: ["admin", "manager", "kepala_shift"],
        },
        {
          name: "Koreksi Riwayat Input",
          href: "/shift-history",
          icon: ClipboardCheck,
          roles: ["admin", "manager", "kepala_shift"],
        },
      ],
    },
    {
      label: "Produksi",
      groupIcon: Factory,
      items: [
        {
          name: "Input Produksi",
          href: inputRoute,
          icon: ClipboardList,
          roles: ["admin", "operator", "kepala_shift"],
        },
        {
          name: "Riwayat Input",
          href: "/history",
          icon: History,
          roles: ["admin", "operator", "kepala_shift"],
        },
        {
          name: "Lapor Mesin Off",
          href: "/status-mesin",
          icon: PowerOff,
          roles: ["admin", "operator", "kepala_shift"],
        },
      ],
    },
    {
      label: "QC Inspection",
      groupIcon: ClipboardCheck,
      items: [
        {
          name: "QC Inspection",
          href: "/qc",
          icon: ClipboardCheck,
          roles: ["admin", "inspeksi", "mending"],
        },
        {
          name: "Riwayat QC",
          href: "/qc/history",
          icon: History,
          roles: ["admin", "inspeksi", "mending"],
        },
        {
          name: "Surat Jalan",
          href: "/qc/surat-jalan",
          icon: ClipboardList,
          roles: ["admin"],
        },
        {
          name: "Master Cacat QC",
          href: "/qc-defects",
          icon: Tag,
          roles: ["admin", "manager", "inspeksi", "mending"],
        },
      ],
    },
    {
      label: "Mending",
      groupIcon: Wrench,
      items: [
        {
          name: "Hasil Akhir Pengerjaan Mending",
          href: "/mending",
          icon: Scissors,
          roles: ["admin", "mending", "inspeksi"],
        },
        {
          name: "Riwayat Mending",
          href: "/mending/history",
          icon: History,
          roles: ["admin", "mending", "inspeksi"],
        },
        {
          name: "Cetak Barcode",
          href: "/mending/barcode",
          icon: QrCode,
          roles: ["admin", "mending", "inspeksi"],
        },
      ],
    },
    {
      label: "Final Inspek",
      groupIcon: ClipboardCheck,
      items: [
        {
          name: "Final Inspek Mending",
          href: "/final-inspection",
          icon: ClipboardCheck,
          roles: ["admin", "mending", "inspeksi", "manager"],
        },
        {
          name: "Riwayat Final Inspek",
          href: "/final-inspection/history",
          icon: History,
          roles: ["admin", "mending", "inspeksi", "manager"],
        },
      ],
    },
    {
      label: "Packing",
      groupIcon: Package,
      items: [
        {
          name: "Antrian & Tracking Packing",
          href: "/packing",
          icon: Package,
          roles: ["admin", "mending", "inspeksi", "manager"],
        },
      ],
    },
    {
      label: "Laporan",
      groupIcon: FileSpreadsheet,
      items: [
        {
          name: "Laporan Bulanan",
          href: "/reports/monthly-machine",
          icon: FileSpreadsheet,
          roles: ["admin", "manager", "kepala_shift"],
        },
        {
          name: "Laporan Produksi",
          href: "/reports/mending-production",
          icon: FileSpreadsheet,
          roles: ["admin", "manager", "inspeksi", "mending", "kepala_shift"],
        },
        {
          name: "Laporan Potong Kain",
          href: "/reports/mending-potong",
          icon: FileSpreadsheet,
          roles: ["admin", "manager", "inspeksi", "mending"],
        },
      ],
    },
    {
      label: "Admin",
      groupIcon: ShieldCheck,
      items: [
        {
          name: "Jadwal Produksi",
          href: "/production-plans",
          icon: Calendar,
          roles: ["admin", "manager"],
        },
        {
          name: "Master Detail Masalah",
          href: "/problem-details",
          icon: ListFilter,
          roles: ["admin", "manager", "kepala_shift", "inspeksi", "mending"],
        },
        {
          name: "Parameter & Aturan Mesin",
          href: "/machine-config",
          icon: SlidersHorizontal,
          roles: ["admin", "manager", "kepala_shift"],
        },
        {
          name: "Integrasi Google Sheets",
          href: "/google-sheets-config",
          icon: FileSpreadsheet,
          roles: ["admin", "manager"],
        },
        {
          name: "Chatbot AI",
          href: "/chatbot",
          icon: MessageSquare,
          roles: ["admin", "manager"],
        },
        {
          name: "Manajemen Akun",
          href: "/users",
          icon: Users,
          roles: ["admin"],
        },
        {
          name: "Set Pengumuman",
          href: "/announcements",
          icon: Megaphone,
          roles: ["admin", "manager"],
        },
        {
          name: "Uji Skenario Tampilan",
          href: "/test-scenarios",
          icon: FlaskConical,
          roles: ["admin", "manager"],
        },
      ],
    },
    {
      label: "Lainnya",
      groupIcon: MoreHorizontal,
      items: [
        {
          name: "Master Data",
          href: "/master-data",
          icon: FileSpreadsheet,
          roles: ["admin", "manager"],
        },
        {
          name: "Pengumuman Internal",
          href: "#announcement-modal",
          icon: Bell,
          roles: ["admin", "manager", "operator", "inspeksi", "mending", "kepala_shift"],
          isModal: true,
        },
        {
          name: "Sync Spreadsheet",
          href: "/sync",
          icon: RefreshCw,
          roles: ["admin"],
        },
      ],
    },
  ];

  const generalItems = [
    { name: "Settings", href: "#", icon: Settings, roles: ["admin"] },
    { name: "Help", href: "#", icon: HelpCircle, roles: ["admin", "operator", "kepala_shift"] },
  ];

  const filteredGeneralItems = generalItems.filter((item) =>
    item.roles.includes(user.role),
  );

  const allNavItems = [
    ...menuGroups.flatMap((g) => g.items),
    ...generalItems,
  ];

  const getInitialOpenGroups = () => {
    const open: Record<string, boolean> = {};
    menuGroups.forEach((group) => {
      const hasActive = group.items.some((item) =>
        isNavItemActive(item.href, pathname, allNavItems),
      );
      open[group.label] = hasActive;
    });
    const anyOpen = Object.values(open).some(Boolean);
    if (!anyOpen && menuGroups.length > 0) {
      open[menuGroups[0].label] = true;
    }
    return open;
  };

  return (
    <SidebarInner
      user={user}
      pathname={pathname}
      logout={logout}
      isMobileOpen={isMobileOpen}
      setIsMobileOpen={setIsMobileOpen}
      menuGroups={menuGroups}
      generalItems={generalItems}
      filteredGeneralItems={filteredGeneralItems}
      getInitialOpenGroups={getInitialOpenGroups}
      allNavItems={allNavItems}
    />
  );
}

function SidebarInner({
  user,
  pathname,
  logout,
  isMobileOpen,
  setIsMobileOpen,
  menuGroups,
  generalItems,
  filteredGeneralItems,
  getInitialOpenGroups,
  allNavItems,
}: any) {
  const [openGroups, setOpenGroups] =
    useState<Record<string, boolean>>(getInitialOpenGroups);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#f0f2f5] text-slate-800 md:border md:border-[#dbe1eb] md:rounded-[32px] md:shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden">
      <div className="h-20 flex items-center px-5 md:group-hover:px-6 border-b border-[#dbe1eb] gap-3 transition-all duration-300">
        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 transition-all duration-500 md:group-hover:scale-110 overflow-hidden shadow-xs">
          <img
            src="/assets/dji-logo.png"
            alt="DJI Logo"
            className="w-6 h-6 object-contain"
          />
        </div>
        <div className="flex flex-col whitespace-nowrap transition-all duration-300 md:opacity-0 md:w-0 md:group-hover:opacity-100 md:group-hover:w-auto overflow-hidden">
          <span className="font-extrabold tracking-tight text-slate-900 leading-tight text-base">
            DJI
          </span>
          <span className="text-[8px] text-slate-400 font-extrabold tracking-widest uppercase mt-0.5">
            Portal & Dashboard
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {menuGroups.map((group: any) => {
          const visibleItems = group.items.filter((item: any) =>
            item.roles.includes(user.role),
          );
          if (visibleItems.length === 0) return null;

          const isGroupOpen = openGroups[group.label] ?? false;
          const hasActiveChild = visibleItems.some((item: any) =>
            isNavItemActive(item.href, pathname, allNavItems),
          );

          return (
            <div key={group.label} className="overflow-hidden">
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between gap-3 px-3.5 h-10 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
              >
                <div className="flex items-center gap-3">
                  {(() => {
                    const GIcon = group.groupIcon;
                    return (
                      <GIcon
                        className={`w-5 h-5 shrink-0 transition-colors ${hasActiveChild ? "text-[#0070bc]" : "text-slate-400"}`}
                      />
                    );
                  })()}
                  <span
                    className={`whitespace-nowrap text-[11px] font-extrabold tracking-wider uppercase transition-all duration-300 md:opacity-0 md:w-0 md:group-hover:opacity-100 md:group-hover:w-auto overflow-hidden ${hasActiveChild ? "text-[#0070bc]" : ""}`}
                  >
                    {group.label}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 transition-all duration-300 md:opacity-0 md:group-hover:opacity-100
                    ${isGroupOpen ? "rotate-180" : "rotate-0"}`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out md:hidden md:group-hover:block ${isGroupOpen ? "max-h-96 opacity-100 mt-0.5" : "max-h-0 opacity-0"}`}
              >
                <nav className="space-y-0.5 pl-4 border-l-2 border-slate-200/80 ml-5 mb-1">
                  {visibleItems.map((item: any) => {
                    const Icon = item.icon;
                    const isActive = isNavItemActive(item.href, pathname, allNavItems);
                    if (item.isModal) {
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => {
                            setIsMobileOpen(false);
                            setIsAnnouncementModalOpen(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 h-9 rounded-xl text-xs font-semibold text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-all duration-200 group/item cursor-pointer text-left"
                        >
                          <Icon className="w-4 h-4 shrink-0 transition-transform group-hover/item:scale-105 text-amber-500" />
                          <span className="whitespace-nowrap transition-all duration-300 md:opacity-0 md:w-0 md:group-hover:opacity-100 md:group-hover:w-auto overflow-hidden">
                            {item.name}
                          </span>
                        </button>
                      );
                    }
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 h-9 rounded-xl text-xs font-semibold transition-all duration-200 group/item
                          ${
                            isActive
                              ? "bg-white shadow-sm text-[#0070bc]"
                              : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/60"
                          }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-transform group-hover/item:scale-105 ${isActive ? "text-[#0070bc]" : "text-slate-400"}`}
                        />
                        <span className="whitespace-nowrap transition-all duration-300 md:opacity-0 md:w-0 md:group-hover:opacity-100 md:group-hover:w-auto overflow-hidden">
                          {item.name}
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          );
        })}

        {filteredGeneralItems.length > 0 && (
          <div className="h-px bg-slate-200/80 mx-2 my-2 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300" />
        )}

        <div className="space-y-0.5">
          {filteredGeneralItems.map((item: any) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(item.href, pathname, allNavItems);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-4 px-3.5 h-10 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 group/item
                  ${
                    isActive
                      ? "bg-white shadow-sm text-[#0070bc]"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                  }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform group-hover/item:scale-105 ${isActive ? "text-[#0070bc]" : "text-slate-400"}`}
                />
                <span className="whitespace-nowrap transition-all duration-300 md:opacity-0 md:w-0 md:group-hover:opacity-100 md:group-hover:w-auto overflow-hidden">
                  {item.name}
                </span>
              </Link>
            );
          })}

          <button
            onClick={logout}
            className="w-full flex items-center gap-4 px-3.5 h-10 rounded-2xl text-xs sm:text-sm font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50/80 transition-all duration-200 cursor-pointer group/logout"
          >
            <LogOut className="w-5 h-5 text-slate-400 group-hover/logout:text-red-500 shrink-0 transition-transform duration-200 group-hover/logout:translate-x-0.5" />
            <span className="whitespace-nowrap transition-all duration-300 md:opacity-0 md:w-0 md:group-hover:opacity-100 md:group-hover:w-auto overflow-hidden">
              Logout
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="print:hidden no-print hidden md:flex flex-col w-20 hover:w-64 h-[calc(100vh-2rem)] fixed top-4 left-4 z-30 transition-all duration-300 ease-in-out group">
        {SidebarContent()}
      </aside>

      {/* MOBILE HEADER */}
      <header className="print:hidden no-print md:hidden h-16 w-full fixed top-0 left-0 bg-white border-b border-[#e9ecef] shadow-xs z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
            <img
              src="/assets/dji-logo.png"
              alt="DJI Logo"
              className="w-5 h-5 object-contain"
            />
          </div>
          <span className="font-extrabold text-slate-900 tracking-tight text-sm leading-none">
            DJI
          </span>
        </div>

        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="text-slate-500 hover:text-slate-900 focus:outline-none p-1 cursor-pointer"
          aria-label="Toggle Menu"
        >
          {isMobileOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </header>

      {/* MOBILE DRAWER OVERLAY */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="print:hidden no-print md:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-30 animate-fadeIn"
        />
      )}

      {/* MOBILE DRAWER SIDEBAR */}
      <div
        className={`print:hidden no-print md:hidden fixed inset-y-0 left-0 w-64 h-full z-40 transform transition-transform duration-300 ease-out bg-[#f0f2f5] ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {SidebarContent()}
      </div>
    </>
  );
}
