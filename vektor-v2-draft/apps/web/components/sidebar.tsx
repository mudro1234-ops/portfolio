"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  LayoutDashboard, MapPin, Truck, Users, Route, Hexagon, Bell, Wrench, Fuel, BarChart3, Bot,
  ShieldCheck, CreditCard, Settings, Cpu, History, Globe, HelpCircle, PanelLeftClose, PanelLeftOpen, Menu, X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import type { IconName } from "@/lib/nav";

const ICONS: Record<IconName, React.ComponentType<{ className?: string }>> = {
  layout: LayoutDashboard, map: MapPin, truck: Truck, users: Users, route: Route, hexagon: Hexagon,
  bell: Bell, wrench: Wrench, fuel: Fuel, chart: BarChart3, bot: Bot, shield: ShieldCheck,
  card: CreditCard, settings: Settings, cpu: Cpu, history: History, globe: Globe, help: HelpCircle,
};

interface Item { href: string; label: string; icon: IconName }

export function Sidebar({ workspace, admin }: { workspace: Item[]; admin: Item[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("vektor.sidebar") === "1"); } catch { /* ignore */ }
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem("vektor.sidebar", c ? "0" : "1"); } catch { /* ignore */ }
      return !c;
    });
  };

  const renderGroup = (label: string, items: Item[], compact: boolean) => items.length === 0 ? null : (
    <div className="mt-6 first:mt-0">
      {!compact && <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.18em] text-slate-500">{label}</p>}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={compact ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-brand text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
                  compact && "justify-center px-0",
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!compact && <span className="truncate">{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="fixed left-3 top-3.5 z-40 rounded-lg border border-slate-200 bg-white p-2 text-ink shadow-card md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-navy transition-all duration-200",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-[76px]" : "md:w-[250px]", "w-[250px]",
        )}
      >
        <div className={clsx("flex h-[68px] items-center border-b border-white/10 px-4", collapsed && "md:justify-center md:px-0")}>
          {collapsed ? <span className="hidden md:block"><Logo light subtitle={false} className="[&>div]:hidden" /></span> : null}
          <span className={clsx(collapsed && "md:hidden")}><Logo light /></span>
          <button onClick={() => setOpen(false)} aria-label="Close navigation" className="ml-auto text-slate-400 md:hidden"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Main">
          <div className={clsx(collapsed && "md:hidden")}>
            {renderGroup("WORKSPACE", workspace, false)}
            {renderGroup("ADMINISTRATION", admin, false)}
          </div>
          <div className={clsx("hidden", collapsed && "md:block")}>
            {renderGroup("WORKSPACE", workspace, true)}
            {renderGroup("ADMINISTRATION", admin, true)}
          </div>
        </nav>
        <div className="hidden border-t border-white/10 p-3 md:block">
          <button onClick={toggle} className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Collapse</>}
          </button>
        </div>
      </aside>
      {/* spacer keeps content aligned with the fixed sidebar */}
      <div className={clsx("hidden shrink-0 transition-all duration-200 md:block", collapsed ? "w-[76px]" : "w-[250px]")} aria-hidden />
    </>
  );
}
