"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/browser";
import BrandMark from "@/components/brand-mark";
import LiveMap from "@/components/live-map";
type Point={type?:string;coordinates?:number[]}|null;
type Vehicle={id:string;registration_number:string;make:string|null;model:string|null;status:string};
type StateRow={vehicle_id:string;position:Point;device_time:string|null;received_at:string|null;speed_kph:number|null;heading_deg:number|null;source:string|null;is_stale:boolean};
const STALE_AFTER_MS=10*60*1000;
export default function TrackingPage(){
 const router=useRouter(),supabase=useMemo(()=>createClient(),[]);
 const [vehicles,setVehicles]=useState<Vehicle[]>([]),[states,setStates]=useState<StateRow[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[lastRefresh,setLastRefresh]=useState<Date|null>(null);
 const load=useCallback(async(initial=false)=>{
  if(initial)setLoading(true);setError("");
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user){router.replace("/login");return;}
  const {data:membership,error:membershipError}=await supabase.from("organization_memberships").select("organization_id").eq("user_id",user.id).order("created_at",{ascending:true}).limit(1).maybeSingle();
  if(membershipError||!membership){setError(membershipError?.message||"No company workspace is linked to this account yet.");setLoading(false);return;}
  const [vehicleResult,stateResult]=await Promise.all([
   supabase.from("vehicles").select("id,registration_number,make,model,status").eq("organization_id",membership.organization_id).order("registration_number"),
   supabase.from("vehicle_current_state").select("vehicle_id,position,device_time,received_at,speed_kph,heading_deg,source,is_stale").eq("organization_id",membership.organization_id)
  ]);
  if(vehicleResult.error||stateResult.error)setError(vehicleResult.error?.message||stateResult.error?.message||"Unable to load fleet tracking data.");
  else{setVehicles((vehicleResult.data??[]) as Vehicle[]);setStates((stateResult.data??[]) as StateRow[]);setLastRefresh(new Date());}
  setLoading(false);
 },[router,supabase]);
 useEffect(()=>{void load(true);const timer=window.setInterval(()=>void load(false),15000);return()=>window.clearInterval(timer);},[load]);
 const stateByVehicle=new Map(states.map(state=>[state.vehicle_id,state]));
 const now=Date.now();
 const mapRows=states.filter(state=>state.position).map(state=>{
  const vehicle=vehicles.find(item=>item.id===state.vehicle_id),fixTime=state.device_time?new Date(state.device_time).getTime():0;
  const stale=state.is_stale||!fixTime||now-fixTime>STALE_AFTER_MS||fixTime>now+60000;
  return {vehicle_id:state.vehicle_id,label:vehicle?.registration_number||state.vehicle_id,position:state.position,is_stale:stale,speed_kph:state.speed_kph};
 });
 const liveCount=mapRows.filter(row=>!row.is_stale).length,staleCount=mapRows.length-liveCount;
 return <main className="pageWrap">
  <header className="pageHeader"><div><BrandMark compact/><Link href="/" className="backLink">← VEKTOR Dashboard</Link><div className="eyebrow">FLEET VISIBILITY</div><h1>Live tracking</h1><p className="muted">Vehicle positions refresh every 15 seconds. A GPS fix older than 10 minutes is shown as stale, never live.</p></div><span className="pill">{lastRefresh?"Updated "+lastRefresh.toLocaleTimeString():"Connecting…"}</span></header>
  {error&&<p className="errorText" role="alert">{error}</p>}
  <div className="grid">
   <div className="card"><div className="metric-label">Registered vehicles</div><div className="metric">{loading?"—":vehicles.length}</div><div className="note">Vehicles in this workspace</div></div>
   <div className="card"><div className="metric-label">Recent GPS fixes</div><div className="metric">{loading?"—":liveCount}</div><div className="note">Received within the last 10 minutes</div></div>
   <div className="card"><div className="metric-label">Stale GPS fixes</div><div className="metric">{loading?"—":staleCount}</div><div className="note">Older than 10 minutes</div></div>
   <div className="card"><div className="metric-label">No GPS fix</div><div className="metric">{loading?"—":Math.max(0,vehicles.length-states.length)}</div><div className="note">No current position received</div></div>
  </div>
  <section className="card"><div className="head"><h2>Fleet map</h2><span className="pill">15-second refresh</span></div><LiveMap rows={mapRows}/></section>
  <section className="card tableCard"><h2>Vehicle location status</h2>
   {loading?<p className="muted">Loading fleet positions…</p>:vehicles.length===0?<div className="empty">No vehicles registered yet. <Link href="/vehicles">Add your first vehicle</Link>.</div>:<div className="tableScroll"><table><thead><tr><th>Registration</th><th>Vehicle</th><th>GPS status</th><th>Last device fix</th><th>Speed</th><th>Source</th></tr></thead><tbody>
    {vehicles.map(vehicle=>{const state=stateByVehicle.get(vehicle.id),fixTime=state?.device_time?new Date(state.device_time).getTime():0,stale=!state||state.is_stale||!fixTime||now-fixTime>STALE_AFTER_MS||fixTime>now+60000;return <tr key={vehicle.id}><td>{vehicle.registration_number}</td><td>{[vehicle.make,vehicle.model].filter(Boolean).join(" ")||"—"}</td><td><span className="pill">{!state?"No GPS fix":stale?"Stale":"Recent"}</span></td><td>{state?.device_time?new Date(state.device_time).toLocaleString():"—"}</td><td>{state?.speed_kph==null?"—":state.speed_kph.toFixed(1)+" km/h"}</td><td>{state?.source||"—"}</td></tr>;})}
   </tbody></table></div>}
  </section>
  <p className="note">GPS updates require a configured Traccar server and compatible tracker, or an explicitly consented mobile device. Dashboard polling does not control how often a tracker sends data.</p>
 </main>;
}
