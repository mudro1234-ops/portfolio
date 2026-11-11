import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
export const runtime="nodejs";
export async function POST(request:Request){
 try{
  const supabase=await createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
  const body=await request.json();
  const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
  const role=typeof body.role==="string"?body.role:"analyst";
  const organizationId=typeof body.organizationId==="string"?body.organizationId:"";
  const allowed=["owner","admin","fleet_manager","dispatcher","driver","analyst"];
  if(!organizationId||!email.includes("@")||!allowed.includes(role))return NextResponse.json({error:"Enter a valid email and role."},{status:400});
  const {data:membership}=await supabase.from("organization_memberships").select("role").eq("organization_id",organizationId).eq("user_id",user.id).maybeSingle();
  if(!membership||!["owner","admin"].includes(membership.role))return NextResponse.json({error:"Only workspace owners and admins can invite members."},{status:403});
  if(membership.role==="admin"&&["owner","admin"].includes(role))return NextResponse.json({error:"Admins cannot invite owners or other admins."},{status:403});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!service)return NextResponse.json({error:"Invitation service is not configured. Add SUPABASE_SERVICE_ROLE_KEY."},{status:503});
  const admin=createAdminClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:invited,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:process.env.NEXT_PUBLIC_APP_URL?process.env.NEXT_PUBLIC_APP_URL+"/auth/callback":undefined});
  if(inviteError)throw inviteError;
  const {error:insertError}=await admin.from("organization_memberships").upsert({organization_id:organizationId,user_id:invited.user.id,role},{onConflict:"organization_id,user_id"});
  if(insertError)throw insertError;
  await admin.from("audit_logs").insert({organization_id:organizationId,actor_user_id:user.id,action:"invite",resource_type:"organization_membership",resource_id:invited.user.id,metadata:{email,role}});
  return NextResponse.json({sent:true,email,role});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invitation could not be sent."},{status:400});}
}