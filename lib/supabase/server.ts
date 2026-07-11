import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicSupabaseConfig, serviceRoleKey } from "@/lib/env";

export function supabaseServer() {
  const store = cookies();
  const config = publicSupabaseConfig();
  return createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              store.set(name, value, options)
            );
          } catch {
            /* invoked from RSC — ignore */
          }
        }
      }
    }
  );
}

export function supabaseAdmin() {
  const config = publicSupabaseConfig();
  return createClient(
    config.url,
    serviceRoleKey(),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
