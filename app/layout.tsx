import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { BluetoothProvider } from "@/lib/bluetooth-context";
import GlobalWidgets from "@/components/GlobalWidgets";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DJI",
  description: "Portal Produksi dan Quality Control DJI",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      style={{ colorScheme: "light" }}
    >
      <body className="min-h-full bg-[var(--background)] text-[#1f2d3d] flex flex-col font-sans">
        <AuthProvider>
          <BluetoothProvider>
            <GlobalWidgets />
            <div className="min-h-full flex flex-col flex-1">
              {children}
            </div>
          </BluetoothProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
