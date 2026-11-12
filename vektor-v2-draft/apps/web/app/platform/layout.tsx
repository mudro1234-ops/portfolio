import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

/** Platform area: its own shell so it never depends on being a member of a customer organisation. */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/platform");
  const { data: profile } = await supabase.from("user_profiles").select("is_platform_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_platform_admin) redirect("/access-denied");
  return (
    <div className="min-h-screen">
      <header className="flex h-[68px] items-center justify-between bg-navy px-6">
        <Logo light />
        <div className="flex items-center gap-4 text-sm">
          <span className="rounded-full bg-brand/20 px-3 py-1 text-xs font-semibold text-blue-200">Platform administrator</span>
          <Link href="/overview" className="text-slate-300 hover:text-white">My workspace</Link>
          <form action={signOut}><button className="text-slate-300 hover:text-white">Sign out</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
    </div>
  );
}
