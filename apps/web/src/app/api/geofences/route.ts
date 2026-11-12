import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime="nodejs";
export async function POST(request:Request){
 try{
  const supabase=await createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
  const body=await request.json();
  const name=typeof body.name==="string"?body.name.trim():"";
  const organizationId=typeof body.organizationId==="string"?body.organizationId:"";
  const latitude=Number(body.latitude),longitude=Number(body.longitude),radius=Number(body.radius);
  if(!name||!organizationId||!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isInteger(radius))return NextResponse.json({error:"Enter a name, map coordinates and a whole-number radius."},{status:400});
  const {data,error}=await supabase.rpc("create_geofence_circle",{target_organization:organizationId,fence_name:name,center_latitude:latitude,center_longitude:longitude,radius_metres:radius});
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({id:data,created:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not create geofence."},{status:500});}
}