import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";

type TraccarPosition={
  deviceId?:string|number;
  latitude?:number;
  longitude?:number;
  speed?:number;
  course?:number;
  fixTime?:string;
  deviceTime?:string;
};

export async function POST(request:Request){
  const secret=process.env.TRACCAR_WEBHOOK_SECRET;
  if(!secret||request.headers.get("x-traccar-token")!==secret){
    return NextResponse.json({error:"Unauthorized GPS webhook."},{status:401});
  }
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!serviceKey)return NextResponse.json({error:"GPS ingestion is not configured."},{status:503});

  try{
    const body=await request.json();
    const candidates:TraccarPosition[]=Array.isArray(body.positions)
      ? body.positions
      : body.position && typeof body.position==="object"
        ? [{...body.position,deviceId:body.position.deviceId??body.device?.id??body.deviceId}]
        : [body];
    if(candidates.length===0)return NextResponse.json({accepted:0,ignored:true});

    const supabase=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    let accepted=0,staleCount=0,outOfOrderCount=0;
    for(const item of candidates){
      const deviceId=String(item.deviceId??body.device?.id??body.deviceId??"");
      const latitude=Number(item.latitude);
      const longitude=Number(item.longitude);
      const speedKnots=Number(item.speed??0);
      const course=Number(item.course??0);
      const fixTime=new Date(item.fixTime??item.deviceTime??"");
      if(!deviceId||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180||Number.isNaN(fixTime.getTime())){
        return NextResponse.json({error:"Invalid Traccar position payload."},{status:400});
      }

      const {data:device,error:deviceError}=await supabase.from("gps_devices")
        .select("id,organization_id,vehicle_id,active")
        .eq("provider_device_id",deviceId)
        .eq("provider","traccar")
        .maybeSingle();
      if(deviceError||!device||!device.active||!device.vehicle_id){
        return NextResponse.json({error:"No active VEKTOR vehicle is linked to Traccar device "+deviceId+"."},{status:404});
      }

      const position="SRID=4326;POINT("+longitude+" "+latitude+")";
      const receivedAt=new Date().toISOString();
      const speedKph=speedKnots*1.852;
      const {error:historyError}=await supabase.from("vehicle_positions").insert({
        organization_id:device.organization_id,
        vehicle_id:device.vehicle_id,
        gps_device_id:device.id,
        source:"traccar",
        position,
        device_time:fixTime.toISOString(),
        received_at:receivedAt,
        speed_kph:speedKph,
        heading_deg:course
      });
      if(historyError)throw historyError;

      const isStale=Date.now()-fixTime.getTime()>10*60*1000||fixTime.getTime()>Date.now()+60*1000;
      const {data:current,error:currentError}=await supabase.from("vehicle_current_state")
        .select("device_time")
        .eq("vehicle_id",device.vehicle_id)
        .maybeSingle();
      if(currentError)throw currentError;
      const outOfOrder=Boolean(current?.device_time&&new Date(current.device_time).getTime()>fixTime.getTime());
      if(!outOfOrder){
        const {error:stateError}=await supabase.from("vehicle_current_state").upsert({
          vehicle_id:device.vehicle_id,
          organization_id:device.organization_id,
          position,
          device_time:fixTime.toISOString(),
          received_at:receivedAt,
          speed_kph:speedKph,
          heading_deg:course,
          source:"traccar",
          is_stale:isStale,
          updated_at:receivedAt
        },{onConflict:"vehicle_id"});
        if(stateError)throw stateError;
        const {error:deviceUpdateError}=await supabase.from("gps_devices").update({last_seen_at:receivedAt}).eq("id",device.id);
        if(deviceUpdateError)throw deviceUpdateError;
      }
      accepted++;
      if(isStale)staleCount++;
      if(outOfOrder)outOfOrderCount++;
    }
    return NextResponse.json({accepted,staleCount,outOfOrderCount});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"GPS ingestion failed."},{status:500});
  }
}
