import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspaceEntry({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=" + encodeURIComponent("/workspace/" + slug));

  const { data: organization } = await supabase.from("organizations").select("id,workspace_type").eq("slug", slug).maybeSingle();
  if (!organization) notFound();

  const { data: membership } = await supabase.from("organization_memberships").select("id").eq("organization_id", organization.id).eq("user_id", user.id).maybeSingle();
  if (!membership) notFound();

  redirect("/");
}
