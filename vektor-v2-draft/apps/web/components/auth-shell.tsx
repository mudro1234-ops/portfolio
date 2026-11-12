import Link from "next/link";
import { Logo } from "@/components/logo";
import { MapPin, ShieldCheck, Gauge } from "lucide-react";

export function AuthShell({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <Logo light />
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">Know where every vehicle is, and what needs attention.</h2>
          <ul className="mt-8 space-y-4 text-sm text-slate-300">
            <li className="flex gap-3"><MapPin className="h-5 w-5 shrink-0 text-brand" aria-hidden /> Live tracking from hardware trackers and consent-based smartphones.</li>
            <li className="flex gap-3"><Gauge className="h-5 w-5 shrink-0 text-brand" aria-hidden /> Trips, geofences, fuel, maintenance and reports in one place.</li>
            <li className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-brand" aria-hidden /> Every company's data is isolated and role-protected.</li>
          </ul>
        </div>
        <p className="text-xs text-slate-500">Built for fleet operators in Zimbabwe and across Africa.</p>
      </aside>
      <main className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-8 block lg:hidden"><Logo /></Link>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
