import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VEKTOR | Fleet Telemetry & Tracking",
  description: "High-frequency fleet telemetry, geolocation and asset management.",
  applicationName: "VEKTOR",
  icons: { icon: "/vektor-mark.svg", shortcut: "/vektor-mark.svg" },
  openGraph: { title: "VEKTOR | Fleet Telemetry & Tracking", description: "High-frequency telemetry, geolocation and asset management.", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
