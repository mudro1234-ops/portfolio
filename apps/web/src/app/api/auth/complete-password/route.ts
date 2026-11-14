import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST() {
  const session = await createClient();
  const { data: { user }, error: authError } = await session.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });

  if (!user.app_metadata?.must_change_password) {
    return NextResponse.json({ completed: true });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return NextResponse.json({ error: "Password security service is not configured." }, { status: 503 });

  const admin = createAdminClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, must_change_password: false, password_changed_at: new Date().toISOString() },
  });
  if (error) return NextResponse.json({ error: "Your password was changed, but the account security status could not be updated. Please contact the administrator." }, { status: 500 });

  return NextResponse.json({ completed: true });
}
