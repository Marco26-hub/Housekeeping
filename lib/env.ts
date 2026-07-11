function required(name: string, value: string | undefined): string {
  if (!value || value.includes("placeholder")) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function publicSupabaseConfig() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  };
}

export function serviceRoleKey() {
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function appUrl() {
  return required("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL);
}
