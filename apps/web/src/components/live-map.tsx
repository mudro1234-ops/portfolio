"use client";
import {useEffect,useRef} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
type PositionRow={vehicle_id:string;label?:string;position?:{type?:string;coordinates?:number[]}|null;is_stale?:boolean;speed_kph?:number|null};
export default function LiveMap({rows}:{rows:PositionRow[]}){
 const container=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{
  const token=process.env.NEXT_PUBLIC_MAPBOX_TOKEN;if(!token||!container.current)return;
  mapboxgl.accessToken=token;
  const valid=rows.filter(r=>r.position?.coordinates?.length===2&&Number.isFinite(r.position.coordinates[0])&&Number.isFinite(r.position.coordinates[1]));
  const center=valid.length?[valid[0].position!.coordinates![0],valid[0].position!.coordinates![1]] as [number,number]:[31.05,-17.82] as [number,number];
  const map=new mapboxgl.Map({container:container.current,style:"mapbox://styles/mapbox/dark-v11",center,zoom:valid.length?10:5});
  map.addControl(new mapboxgl.NavigationControl(),"top-right");
  map.on("load",()=>{
   valid.forEach(row=>{
    const coords=row.position!.coordinates!;
    const popup=document.createElement("div"),title=document.createElement("strong"),status=document.createElement("div"),speed=document.createElement("div");
    title.textContent=row.label||row.vehicle_id;status.textContent=row.is_stale?"Stale GPS fix":"Recent GPS fix";speed.textContent=String(row.speed_kph??0)+" km/h";
    popup.append(title,status,speed);
    new mapboxgl.Marker({color:row.is_stale?"#8793a5":"#b7e84a"}).setLngLat([coords[0],coords[1]]).setPopup(new mapboxgl.Popup().setDOMContent(popup)).addTo(map);
   });
   if(valid.length>1){const bounds=new mapboxgl.LngLatBounds();valid.forEach(row=>bounds.extend([row.position!.coordinates![0],row.position!.coordinates![1]]));map.fitBounds(bounds,{padding:60,maxZoom:12});}
  });
  return()=>map.remove();
 },[rows]);
 if(!process.env.NEXT_PUBLIC_MAPBOX_TOKEN)return <div className="notice">Mapbox is not configured. Add NEXT_PUBLIC_MAPBOX_TOKEN in Vercel to enable the fleet map. The vehicle status list remains available below.</div>;
 return <div ref={container} style={{height:460,width:"100%",borderRadius:14,overflow:"hidden",border:"1px solid #23334b"}} aria-label="Fleet vehicle positions map"/>;
}
