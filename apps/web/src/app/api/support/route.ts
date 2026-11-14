import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const { data, error } = await supabase
    .from("support_requests")
    .select("id,organization_id,subject,description,status,priority,created_at,updated_at")
    .eq("requester_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const body = await request.json();
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const priority = typeof body.priority === "string" ? body.priority : "normal";
    if (!organizationId || subject.length < 3 || subject.length > 180 || description.length < 5 || description.length > 10000 || !["low", "normal", "high", "urgent"].includes(priority)) {
      return NextResponse.json({ error: "Choose a workspace, provide a subject and describe the issue. Check the field limits." }, { status: 400 });
    }
    const { data: membership, error: membershipError } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipError || !membership) return NextResponse.json({ error: "You do not belong to that workspace." }, { status: 403 });
    const { data, error } = await supabase
      .from("support_requests")
      .insert({ organization_id: organizationId, requester_user_id: user.id, subject, description, priority })
      .select("id,subject,status,priority,created_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ created: true, request: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Your support request could not be submitted." }, { status: 400 });
  }
}
