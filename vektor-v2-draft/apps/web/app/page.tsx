import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, Route, Hexagon, Fuel, Wrench, BarChart3, Smartphone, Cpu, Bot, Lock } from "lucide-react";
import { Logo } from "@/components/logo";
import { LinkButton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

const FEATURES = [
  { icon: MapPin, title: "Live tracking", text: "See every vehicle on the map with speed, heading and the exact time of its last GPS fix. Old positions are labelled stale or offline, never shown as live." },
  { icon: Route, title: "Trips", text: "Journeys are recorded automatically from GPS data, with distance, duration and route playback." },
  { icon: Hexagon, title: "Geofences", text: "Draw depots, customer sites and restricted areas and get alerted when vehicles enter or leave." },
  { icon: Fuel, title: "Fuel & expenses", text: "Record fuel purchases with receipts and track cost per kilometre and unusual consumption." },
  { icon: Wrench, title: "Maintenance", text: "Schedule services, track costs and get reminders before vehicles are due." },
  { icon: BarChart3, title: "Reports", text: "Utilisation, distance, fuel, maintenance and alert reports with CSV export." },
  { icon: Cpu, title: "Hardware trackers", text: "Connect compatible 4G GPS trackers through a Traccar gateway." },
  { icon: Smartphone, title: "Driver app", text: "Consent-based smartphone tracking for drivers, who can stop tracking at any time." },
  { icon: Bot, title: "AI fleet assistant", text: "Ask questions about your fleet. Answers use only your own records and never invent data." },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/overview");

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/help" className="hidden px-3 py-2 text-sm text-muted hover:text-ink sm:block">Help</Link>
          <LinkButton href="/login" variant="secondary">Sign in</LinkButton>
          <LinkButton href="/register">Start free trial</LinkButton>
        </nav>
      </header>

      <section className="bg-navy">
        <div className="mx-auto max-w-6xl px-6 py-20 text-white">
          <p className="text-xs font-semibold tracking-[0.25em] text-brand">FLEET TELEMETRY &amp; TRACKING</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            One platform to see, manage and understand your fleet.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">
            VEKTOR brings vehicle tracking, drivers, trips, geofences, fuel, maintenance and analytics together - built for fleet operators in Zimbabwe and across Africa.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/register">Create your workspace</LinkButton>
            <LinkButton href="/login" variant="secondary" className="!bg-transparent !text-white !border-slate-500 hover:!bg-white/10">Sign in</LinkButton>
          </div>
          <p className="mt-4 text-sm text-slate-400">14-day free trial. Multi-tenant, role-based and private by design.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-ink">Everything a fleet manager needs</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-card border border-slate-200 p-5">
              <Icon className="h-5 w-5 text-brand" aria-hidden />
              <h3 className="mt-3 font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-canvas">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Lock className="mt-1 h-5 w-5 text-brand" aria-hidden />
            <div>
              <h3 className="font-semibold text-ink">Your data stays yours</h3>
              <p className="max-w-xl text-sm text-muted">Every company is isolated at the database level. Drivers consent to smartphone tracking and can withdraw it whenever they choose.</p>
            </div>
          </div>
          <LinkButton href="/register">Get started</LinkButton>
        </div>
      </section>
      <footer className="px-6 py-6 text-center text-xs text-muted">VEKTOR - Fleet Telemetry &amp; Tracking</footer>
    </div>
  );
}
