import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ error:"Sign in required." },{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!service)return NextResponse.json({error:"Mobile tracking is not configured."},{status:503});
  const userClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await userClient.auth.getUser(token);
  if(authError||!user)return NextResponse.json({error:"Invalid session."},{status:401});
  try{
    const body=await request.json();
    const latitude=Number(body.latitude),longitude=Number(body.longitude);
    const accuracy=Number(body.accuracy??0),speed=Number(body.speed??0),heading=Number(body.heading??0);
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return NextResponse.json({error:"Invalid coordinates."},{status:400});
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:driver}=await admin.from("drivers").select("id,organization_id").eq("user_id",user.id).eq("status","active").maybeSingle();
    if(!driver)return NextResponse.json({error:"No active driver profile is linked to this account."},{status:403});
    const {data:consent}=await admin.from("tracking_consents").select("id").eq("driver_id",driver.id).eq("organization_id",driver.organization_id).eq("status","granted").is("withdrawn_at",null).order("recorded_at",{ascending:false}).limit(1).maybeSingle();
    if(!consent)return NextResponse.json({error:"Tracking consent is not active. Ask your fleet administrator to record your consent."},{status:403});
    const {data:assignment}=await admin.from("vehicle_assignments").select("vehicle_id").eq("driver_id",driver.id).eq("organization_id",driver.organization_id).is("ends_at",null).order("starts_at",{ascending:false}).limit(1).maybeSingle();
    if(!assignment)return NextResponse.json({error:"No active vehicle assignment."},{status:409});
    const now=new Date().toISOString(),position=`SRID=4326;POINT(${longitude} ${latitude})`;
    const {error:insertError}=await admin.from("vehicle_positions").insert({organization_id:driver.organization_id,vehicle_id:assignment.vehicle_id,source:"mobile",position,device_time:now,received_at:now,accuracy_m:accuracy,speed_kph:speed*3.6,heading_deg:heading});
    if(insertError)throw insertError;
    const {error:stateError}=await admin.from("vehicle_current_state").upsert({vehicle_id:assignment.vehicle_id,organization_id:driver.organization_id,position,device_time:now,received_at:now,speed_kph:speed*3.6,heading_deg:heading,source:"mobile",is_stale:false,updated_at:now},{onConflict:"vehicle_id"});
    if(stateError)throw stateError;
    return NextResponse.json({accepted:true,vehicleId:assignment.vehicle_id});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Position could not be saved."},{status:500});}
}