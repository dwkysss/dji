import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unduh Aplikasi DJI - Android APK & Desktop",
  description: "Unduh file APK resmi aplikasi Portal Produksi & QC PT Dentelle Jaya Infinitex untuk smartphone dan tablet Android.",
};

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
