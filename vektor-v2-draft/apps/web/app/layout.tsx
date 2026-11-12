import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastHost } from "@/components/toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "VEKTOR - Fleet Telemetry & Tracking", template: "%s | VEKTOR" },
  description: "Fleet management, GPS vehicle tracking and asset monitoring for African fleet operators.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#101D35" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
