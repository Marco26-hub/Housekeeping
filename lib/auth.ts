import { supabaseServer } from "./supabase/server";
import { redirect } from "next/navigation";

export async function requireUser() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb
    .from("profiles")
    .select("id, full_name, role, company_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  return { user, profile, sb };
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.profile.role !== "admin") redirect("/dashboard");
  return ctx;
}
