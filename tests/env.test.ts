import { appUrl, publicSupabaseConfig, serviceRoleKey } from "@/lib/env";

describe("environment validation", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("rejects missing Supabase public configuration", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => publicSupabaseConfig()).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("rejects silent placeholder configuration", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-key";
    expect(() => publicSupabaseConfig()).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("requires service role and application URL", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(() => serviceRoleKey()).toThrow("SUPABASE_SERVICE_ROLE_KEY");
    expect(() => appUrl()).toThrow("NEXT_PUBLIC_APP_URL");
  });
});
