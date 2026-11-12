import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { EmptyState, LinkButton } from "@/components/ui";
import { signOut } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Access denied" };

export default async function AccessDeniedPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const suspended = reason === "suspended";
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-card border border-slate-200 bg-white shadow-card">
        <EmptyState
          icon={<ShieldAlert className="h-6 w-6" />}
          title={suspended ? "This workspace is not available" : "You don't have access to this page"}
          description={suspended
            ? "The organisation is suspended, or your membership is inactive. Contact your administrator or VEKTOR support."
            : "Your role does not include this area. Ask your organisation owner or administrator if you need access."}
          action={<div className="flex gap-2">
            {!suspended && <LinkButton href="/overview">Back to workspace</LinkButton>}
            <form action={signOut}><button className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">Sign out</button></form>
          </div>}
        />
        <p className="pb-6 text-center text-xs text-muted"><Link href="/help" className="hover:underline">Help centre</Link></p>
      </div>
    </div>
  );
}
