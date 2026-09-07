import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import SetupForm from "./SetupForm";

export default async function SetupPage() {
  const requiredEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SETUP_SECRET: process.env.SETUP_SECRET
  };
  const missing = Object.entries(requiredEnv)
    .filter(([, value]) => !value || value.includes("placeholder"))
    .map(([key]) => key);

  if (missing.length > 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card w-full max-w-lg p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Setup non configurato</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-950">Mancano alcune variabili server</h1>
          <p className="mt-3 text-sm text-gray-600">
            Aggiungile in <code>.env.local</code>, poi riavvia il server locale con <code>npm run dev</code>.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-gray-800">
            {missing.map((key) => (
              <li key={key} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-mono">
                {key}
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-2xl bg-gray-950 p-4 text-xs text-gray-100">
            <p>SUPABASE_SERVICE_ROLE_KEY si trova in Supabase: Project Settings - API - service_role.</p>
            <p className="mt-2">SETUP_SECRET puoi sceglierlo tu, per esempio: setup-theswa-housekeeping-2026-demo</p>
          </div>
        </div>
      </div>
    );
  }

  const sb = createClient(
    requiredEnv.NEXT_PUBLIC_SUPABASE_URL!,
    requiredEnv.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Block if any company already exists
  const { count, error } = await sb.from("companies").select("id", { count: "exact", head: true });
  if (error) throw new Error(`Impossibile verificare il setup: ${error.message}`);
  if ((count ?? 0) > 0) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-brand-700">Setup iniziale</h1>
          <p className="text-sm text-gray-500 mt-1">Crea l&apos;account admin e la tua azienda</p>
        </div>
        <SetupForm />
      </div>
    </div>
  );
}
