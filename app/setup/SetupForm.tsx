"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function SetupForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    setup_secret: "",
    company_name: "",
    admin_name: "",
    admin_email: "",
    admin_password: ""
  });

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.admin_password.length < 8) return toast.error("Password minimo 8 caratteri");
    setBusy(true);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form)
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return toast.error(d.error ?? "Errore setup");
    }
    toast.success("Setup completato! Accedi con le tue credenziali.");
    router.push("/login");
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-4">
      <div>
        <label className="label">Codice setup *</label>
        <input type="password" className="input" value={form.setup_secret}
          onChange={(e) => set("setup_secret", e.target.value)} required minLength={16}
          autoComplete="off" placeholder="Codice configurato sul server" />
      </div>
      <div>
        <label className="label">Nome azienda *</label>
        <input className="input" value={form.company_name}
          onChange={(e) => set("company_name", e.target.value)} required placeholder="Es. Pulizie Rossi SRL" />
      </div>
      <div>
        <label className="label">Tuo nome completo *</label>
        <input className="input" value={form.admin_name}
          onChange={(e) => set("admin_name", e.target.value)} required placeholder="Mario Rossi" />
      </div>
      <div>
        <label className="label">Email admin *</label>
        <input type="email" className="input" value={form.admin_email}
          onChange={(e) => set("admin_email", e.target.value)} required placeholder="admin@azienda.it" />
      </div>
      <div>
        <label className="label">Password *</label>
        <input type="password" className="input" value={form.admin_password}
          onChange={(e) => set("admin_password", e.target.value)} required
          minLength={8} placeholder="min. 8 caratteri" />
      </div>
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "Creazione…" : "Crea account e accedi"}
      </button>
    </form>
  );
}
