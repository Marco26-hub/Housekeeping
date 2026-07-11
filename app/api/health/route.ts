import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, { ok: boolean; ms: number }> = {};
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_APP_URL",
    "SETUP_SECRET"
  ];
  const missing = required.filter((key) => !process.env[key]);
  checks.environment = { ok: missing.length === 0, ms: 0 };
  let supabaseOk = false;
  let storageOk = false;

  try {
    const start = Date.now();
    const { error } = await supabaseAdmin().from("reports").select("id", { count: "exact", head: true });
    supabaseOk = !error;
    checks.supabase = { ok: supabaseOk, ms: Date.now() - start };
  } catch {
    checks.supabase = { ok: false, ms: 0 };
  }

  try {
    const start = Date.now();
    const { data, error } = await supabaseAdmin().storage.listBuckets();
    const names = new Set((data ?? []).map((bucket) => bucket.name));
    storageOk = !error && ["report-photos", "report-pdfs", "company-logos"].every((name) => names.has(name));
    checks.storage = { ok: storageOk, ms: Date.now() - start };
  } catch {
    checks.storage = { ok: false, ms: 0 };
  }

  const status = supabaseOk && storageOk && missing.length === 0 ? 200 : 503;

  return NextResponse.json(
    { status: status === 200 ? "ok" : "degraded", checks, ...(missing.length ? { missing } : {}) },
    { status }
  );
}
