export default function SetupRequired() {
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#080d18",color:"#edf4ff",fontFamily:"Arial, sans-serif"}}>
    <section style={{maxWidth:560,border:"1px solid #23334b",borderRadius:16,padding:28,background:"#101a2b"}}>
      <p style={{color:"#56c6a9",fontSize:11,letterSpacing:2,fontWeight:700}}>MADRude / FLEET INTELLIGENCE</p>
      <h1>Workspace setup required</h1>
      <p style={{color:"#91a1b8",lineHeight:1.7}}>The application is not connected to Supabase yet. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your local environment or deployment settings, then restart or redeploy the web application.</p>
      <p style={{color:"#91a1b8",fontSize:12}}>Do not place the Supabase service-role key in a NEXT_PUBLIC variable.</p>
    </section>
  </main>;
}
