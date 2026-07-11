"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicSupabaseConfig } from "@/lib/env";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function supabaseBrowser() {
  if (!_client) {
    const config = publicSupabaseConfig();
    _client = createBrowserClient(
      config.url,
      config.anonKey
    );
  }
  return _client;
}
