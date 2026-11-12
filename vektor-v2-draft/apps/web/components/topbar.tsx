import Link from "next/link";
import { Bell, Search, LogOut, Settings as SettingsIcon } from "lucide-react";
import { OrgSwitcher } from "@/components/org-switcher";
import { signOut } from "@/app/auth/actions";
import { ROLE_LABELS, can } from "@/lib/permissions";
import type { AppContext } from "@/lib/context";
import { inputClass } from "@/components/ui";

export function Topbar({ ctx }: { ctx: AppContext }) {
  const initials = ctx.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <header className="sticky top-0 z-30 flex h-[68px] items-center gap-4 border-b border-slate-200 bg-white px-4 pl-14 md:px-8">
      <OrgSwitcher orgs={ctx.orgs} activeId={ctx.org.id} />
      <form action="/vehicles" method="get" role="search" className="relative ml-2 hidden max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input name="q" type="search" placeholder="Search vehicles by registration..." aria-label="Search vehicles" className={`${inputClass} !pl-9`} />
      </form>
      <div className="ml-auto flex items-center gap-2">
        <Link href="/notifications" aria-label={`Notifications${ctx.unreadNotifications ? `, ${ctx.unreadNotifications} unread` : ""}`}
          className="relative rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-ink">
          <Bell className="h-5 w-5" />
          {ctx.unreadNotifications > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white">
              {ctx.unreadNotifications > 9 ? "9+" : ctx.unreadNotifications}
            </span>
          )}
        </Link>
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">{initials}</span>
            <span className="hidden text-left leading-tight lg:block">
              <span className="block text-sm font-medium text-ink">{ctx.fullName}</span>
              <span className="block text-xs text-muted">{ROLE_LABELS[ctx.role]}</span>
            </span>
          </summary>
          <div className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
            <p className="truncate px-3 py-2 text-xs text-muted">{ctx.email}</p>
            {can(ctx.role, "settings") && (
              <Link href="/settings" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink hover:bg-slate-50"><SettingsIcon className="h-4 w-4" /> Settings</Link>
            )}
            <Link href="/help" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink hover:bg-slate-50">Help centre</Link>
            <form action={signOut}>
              <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-critical hover:bg-red-50"><LogOut className="h-4 w-4" /> Sign out</button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
