import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.TRACCAR_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-traccar-token") !== secret) return NextResponse.json({ error: "Unauthorized GPS webhook." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "GPS ingestion is not configured." }, { status: 503 });
  try {
    const body = await request.json();
    const deviceId = String(body.device?.id ?? body.deviceId ?? "");
    const latitude = Number(body.position?.latitude ?? body.latitude);
    const longitude = Number(body.position?.longitude ?? body.longitude);
    const speedKnots = Number(body.position?.speed ?? body.speed ?? 0);
    const course = Number(body.position?.course ?? body.course ?? 0);
    const fixTime = new Date(body.position?.fixTime ?? body.fixTime ?? body.position?.deviceTime ?? body.deviceTime);
    if (!deviceId || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180 || Number.isNaN(fixTime.getTime())) return NextResponse.json({ error: "Invalid Traccar position payload." }, { status: 400 });
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: device, error: deviceError } = await supabase.from("gps_devices").select("id,organization_id,vehicle_id,active").eq("provider_device_id",deviceId).eq("provider","traccar").maybeSingle();
    if (deviceError || !device || !device.active || !device.vehicle_id) return NextResponse.json({ error: "No active Madrude vehicle is linked to this Traccar device." }, { status: 404 });
    const position = `SRID=4326;POINT(${longitude} ${latitude})`;
    const receivedAt = new Date().toISOString();
    const speedKph = speedKnots * 1.852;
    const { error: historyError } = await supabase.from("vehicle_positions").insert({ organization_id:device.organization_id,vehicle_id:device.vehicle_id,gps_device_id:device.id,source:"traccar",position,device_time:fixTime.toISOString(),received_at:receivedAt,speed_kph:speedKph,heading_deg:course });
    if (historyError) throw historyError;
    const stale = Date.now() - fixTime.getTime() > 10 * 60 * 1000 || fixTime.getTime() > Date.now() + 60 * 1000;
    const { data: current } = await supabase.from("vehicle_current_state").select("device_time").eq("vehicle_id",device.vehicle_id).maybeSingle();
    const outOfOrder = Boolean(current?.device_time && new Date(current.device_time).getTime() > fixTime.getTime());
    if (!outOfOrder) {
      const { error: stateError } = await supabase.from("vehicle_current_state").upsert({ vehicle_id:device.vehicle_id,organization_id:device.organization_id,position,device_time:fixTime.toISOString(),received_at:receivedAt,speed_kph:speedKph,heading_deg:course,source:"traccar",is_stale:stale,updated_at:receivedAt },{onConflict:"vehicle_id"});
      if (stateError) throw stateError;
      await supabase.from("gps_devices").update({last_seen_at:receivedAt}).eq("id",device.id);
    }
    return NextResponse.json({ accepted:true, stale, outOfOrder, vehicleId:device.vehicle_id });
  } catch (error) {
    return NextResponse.json({ error:error instanceof Error?error.message:"GPS ingestion failed." },{status:500});
  }
}