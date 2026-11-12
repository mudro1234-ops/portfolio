import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Help centre" };

const TOPICS = [
  { q: "Why does a vehicle show \"Stale position\" or \"Offline\"?", a: "VEKTOR judges tracking from the age of the last GPS fix. If no fix has arrived within the stale threshold the position is labelled stale; after the offline threshold the vehicle is offline. A registered tracker is never assumed to be online. Thresholds can be changed in Settings." },
  { q: "How do I connect a GPS tracker?", a: "Install the tracker with a compatible SIM, point it at your Traccar server, then register its IMEI under GPS Devices and link it to a vehicle. The Settings page shows the webhook details Traccar needs." },
  { q: "How are trips created?", a: "A trip starts when a vehicle reports a speed above the start threshold and ends after it stays below the stop speed for the configured number of minutes. Defaults are 8 km/h, 3 km/h and 10 minutes, and can be tuned per organisation." },
  { q: "How does smartphone tracking work?", a: "Drivers sign in to the driver app, review the tracking policy and give explicit consent. Location is sent only while tracking is on, and drivers can stop tracking or withdraw consent at any time." },
  { q: "What can each role do?", a: "Owners and administrators manage the workspace. Fleet managers manage vehicles, drivers and operations. Dispatchers coordinate trips and alerts. Analysts have read-only access. Drivers use the mobile app." },
  { q: "How do I invite my team?", a: "Open Team & Permissions, enter an email address and choose a role. Share the invitation link with the person; it works once and expires after 7 days." },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4"><Link href="/"><Logo /></Link><Link href="/login" className="text-sm font-medium text-brand">Sign in</Link></div></header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-ink">Help centre</h1>
        <p className="mt-1 text-sm text-muted">Answers to common questions about VEKTOR.</p>
        <div className="mt-6 space-y-3">
          {TOPICS.map((t) => (
            <details key={t.q} className="rounded-card border border-slate-200 bg-white p-4 shadow-card">
              <summary className="cursor-pointer text-sm font-semibold text-ink">{t.q}</summary>
              <p className="mt-2 text-sm text-muted">{t.a}</p>
            </details>
          ))}
        </div>
      </main>
    </div>
  );
}
