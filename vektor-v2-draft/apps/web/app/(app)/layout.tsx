import { getAppContext } from "@/lib/context";
import { visibleNav } from "@/lib/nav";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  const { workspace, admin } = visibleNav(ctx.role, ctx.isPlatformAdmin);
  return (
    <div className="flex min-h-screen">
      <Sidebar
        workspace={workspace.map(({ href, label, icon }) => ({ href, label, icon }))}
        admin={admin.map(({ href, label, icon }) => ({ href, label, icon }))}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar ctx={ctx} />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
