import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { publicSupabaseConfig } from "@/lib/env";

const PUBLIC = ["/", "/housekeeping", "/login", "/setup", "/api/setup", "/api/health", "/auth/callback", "/manifest.webmanifest", "/sw.js", "/icons", "/_next"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const url = req.nextUrl;

  if (url.pathname === "/" || PUBLIC.some((p) => p !== "/" && url.pathname.startsWith(p))) return res;

  const config = publicSupabaseConfig();
  const supabase = createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (c: { name: string; value: string; options?: CookieOptions }[]) =>
          c.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  // admin route guard
  if (url.pathname.startsWith("/admin")) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (prof?.role !== "admin") return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!api/public|_next/static|_next/image|favicon.ico).*)"]
};
