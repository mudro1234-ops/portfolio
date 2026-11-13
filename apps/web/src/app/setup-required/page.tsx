export default function SetupRequired() {
  return <main className="formPage"><section className="formCard">
    <div className="eyebrow">VEKTOR · PLATFORM SETUP</div>
    <h1>Workspace setup required</h1>
    <p className="muted">The application is not connected to Supabase yet. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your deployment settings, then redeploy the web application.</p>
    <p className="muted">Do not place the Supabase service-role key in a NEXT_PUBLIC variable.</p>
  </section></main>;
}
