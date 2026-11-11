import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const body = await request.json();
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 2000) : "";
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";
    if (!question || !organizationId) return NextResponse.json({ error: "Question and workspace are required." }, { status: 400 });
    const { data: membership } = await supabase.from("organization_memberships").select("organization_id").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
    if (!membership) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });

    const [vehicles, drivers, trips, alerts, fuel, maintenance] = await Promise.all([
      supabase.from("vehicles").select("registration_number,status").eq("organization_id", organizationId).limit(100),
      supabase.from("drivers").select("full_name,status,licence_expiry").eq("organization_id", organizationId).limit(100),
      supabase.from("trips").select("status,distance_km,started_at").eq("organization_id", organizationId).limit(100),
      supabase.from("alerts").select("alert_type,severity,message,occurred_at,acknowledged_at").eq("organization_id", organizationId).is("acknowledged_at", null).limit(100),
      supabase.from("fuel_records").select("quantity_litres,total_cost,currency,filled_at").eq("organization_id", organizationId).limit(100),
      supabase.from("maintenance_records").select("title,scheduled_at,completed_at,cost,currency").eq("organization_id", organizationId).limit(100)
    ]);
    const snapshot = { vehicles: vehicles.data ?? [], drivers: drivers.data ?? [], trips: trips.data ?? [], openAlerts: alerts.data ?? [], fuel: fuel.data ?? [], maintenance: maintenance.data ?? [] };
    const prompt = "You are Madrude Fleet Intelligence, a careful fleet operations assistant. Answer only from the tenant-scoped snapshot below. Clearly state when data is missing. Never claim GPS is live unless the data explicitly supports it. Do not make changes or claim to perform actions. Give concise, practical recommendations.\n\nWORKSPACE DATA:\n" + JSON.stringify(snapshot) + "\n\nUSER QUESTION:\n" + question;
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    let answer = "";
    if (geminiKey) { try {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      const data = await response.json();
      if (response.ok) answer = data.candidates?.[0]?.content?.parts?.map((p: {text?:string})=>p.text??"").join("\n") ?? "";
    } catch { answer = ""; } }
    if (!answer && groqKey) { try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method:"POST", headers:{Authorization:`Bearer ${groqKey}`,"Content-Type":"application/json"}, body:JSON.stringify({model:process.env.GROQ_MODEL||"llama-3.3-70b-versatile",messages:[{role:"user",content:prompt}],temperature:0.2}) });
      const data=await response.json(); if(response.ok) answer=data.choices?.[0]?.message?.content??"";
    } catch { answer = ""; } }
    if (!answer && openRouterKey) { try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method:"POST", headers:{Authorization:`Bearer ${openRouterKey}`,"Content-Type":"application/json"}, body:JSON.stringify({model:process.env.OPENROUTER_MODEL||"openai/gpt-4o-mini",messages:[{role:"user",content:prompt}],temperature:0.2}) });
      const data=await response.json(); if(response.ok) answer=data.choices?.[0]?.message?.content??"";
    } catch { answer = ""; } }
    if (!answer) return NextResponse.json({ error: "No AI provider is configured or all configured providers failed. Add a server-side Gemini, Groq or OpenRouter API key." }, { status: 503 });
    return NextResponse.json({ answer });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Assistant request failed." }, { status: 500 });
  }
}