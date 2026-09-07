"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ExternalLink } from "lucide-react";

export default function LoginForm() {
  const marketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "/";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Accesso effettuato");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-md p-6">
        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-xl font-bold">SWA</div>
          <h1 className="mt-3 text-xl font-semibold">SWA Housekeeping</h1>
          <p className="text-sm text-gray-500">Area operatori · Report interventi</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} className="input" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full btn-lg">
            {loading ? "Accesso…" : "Accedi"}
          </button>
        </form>
        <a href={marketingUrl} target="_blank" rel="noopener noreferrer"
          className="mt-5 flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-brand-700">
          Torna al sito SWA Housekeeping <ExternalLink size={14} />
        </a>
      </div>
    </main>
  );
}
