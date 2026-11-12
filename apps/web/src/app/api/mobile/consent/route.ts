import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime="nodejs";
export async function POST(request:Request){
 const auth=request.headers.get("authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"";
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!token)return NextResponse.json({error:"Sign in required."},{status:401});
 if(!url||!anon||!service)return NextResponse.json({error:"Consent service is not configured."},{status:503});
 const userClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await userClient.auth.getUser(token);
 if(error||!user)return NextResponse.json({error:"Invalid session."},{status:401});
 try{
  const body=await request.json(),status=body.status==="withdrawn"?"withdrawn":"granted";
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:driver}=await admin.from("drivers").select("id,organization_id").eq("user_id",user.id).eq("status","active").maybeSingle();
  if(!driver)return NextResponse.json({error:"No active driver profile is linked to this account."},{status:403});
  const now=new Date().toISOString();
  if(status==="withdrawn"){
   const {error:updateError}=await admin.from("tracking_consents").update({status:"withdrawn",withdrawn_at:now}).eq("driver_id",driver.id).eq("organization_id",driver.organization_id).eq("status","granted").is("withdrawn_at",null);
   if(updateError)throw updateError;
   return NextResponse.json({accepted:true,status});
  }
  const {error:insertError}=await admin.from("tracking_consents").insert({organization_id:driver.organization_id,driver_id:driver.id,status:"granted",purpose:"Share assigned vehicle location during an active work shift.",policy_version:"madrude-mobile-v1",granted_at:now});
  if(insertError)throw insertError;
  return NextResponse.json({accepted:true,status});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Consent could not be recorded."},{status:500});}
}