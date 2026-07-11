import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";

export async function POST() {
  const sb = supabaseServer();
  const { error } = await sb.auth.signOut();
  if (error) return NextResponse.json({ error: "signout_failed" }, { status: 500 });
  return NextResponse.redirect(new URL("/login", appUrl()));
}
