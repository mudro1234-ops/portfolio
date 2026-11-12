import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
export const runtime="nodejs";
async function context(body:{organizationId?:string;userId?:string}){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return {error:NextResponse.json({error:"Sign in required."},{status:401})};const organizationId=String(body.organizationId||""),targetUserId=String(body.userId||"");
 if(!organizationId||!targetUserId)return {error:NextResponse.json({error:"Workspace and member are required."},{status:400})};
 const {data:actor}=await supabase.from("organization_memberships").select("role").eq("organization_id",organizationId).eq("user_id",user.id).maybeSingle();
 if(!actor||!["owner","admin"].includes(actor.role))return {error:NextResponse.json({error:"Insufficient permissions."},{status:403})};
 if(user.id===targetUserId)return {error:NextResponse.json({error:"You cannot change or remove your own membership here."},{status:400})};
 const {data:target}=await supabase.from("organization_memberships").select("role").eq("organization_id",organizationId).eq("user_id",targetUserId).maybeSingle();
 if(!target)return {error:NextResponse.json({error:"Member not found."},{status:404})};
 if(actor.role==="admin"&&["owner","admin"].includes(target.role))return {error:NextResponse.json({error:"Admins cannot manage owners or admins."},{status:403})};
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!service)return {error:NextResponse.json({error:"Membership service is not configured."},{status:503})};
 return {user,actor,target,organizationId,targetUserId,admin:createAdminClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})};
}
export async function PATCH(request:Request){
 try{const body=await request.json();const c=await context(body);if("error" in c)return c.error;const role=String(body.role||"");if(!["owner","admin","fleet_manager","dispatcher","driver","analyst"].includes(role))return NextResponse.json({error:"Invalid role."},{status:400});if(c.actor.role!=="owner"&&["owner","admin"].includes(role))return NextResponse.json({error:"Only the owner can assign owner/admin roles."},{status:403});const {error}=await c.admin.from("organization_memberships").update({role}).eq("organization_id",c.organizationId).eq("user_id",c.targetUserId);if(error)throw error;await c.admin.from("audit_logs").insert({organization_id:c.organizationId,actor_user_id:c.user.id,action:"role_change",resource_type:"organization_membership",resource_id:c.targetUserId,metadata:{from:c.target.role,to:role}});return NextResponse.json({updated:true});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Role update failed."},{status:400});}
}
export async function DELETE(request:Request){
 try{const body=await request.json();const c=await context(body);if("error" in c)return c.error;const {error}=await c.admin.from("organization_memberships").delete().eq("organization_id",c.organizationId).eq("user_id",c.targetUserId);if(error)throw error;await c.admin.from("audit_logs").insert({organization_id:c.organizationId,actor_user_id:c.user.id,action:"member_removed",resource_type:"organization_membership",resource_id:c.targetUserId,metadata:{previous_role:c.target.role}});return NextResponse.json({removed:true});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Member removal failed."},{status:400});}
}