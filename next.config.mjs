/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }] },
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
      {
        key: "Content-Security-Policy",
        value: "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://formsubmit.co; object-src 'none'; img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.unsplash.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; worker-src 'self' blob:; manifest-src 'self'"
      }
    ];
    if (isProduction) {
      securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    }
    return [{ source: "/(.*)", headers: securityHeaders }];
  }
};
export default nextConfig;
