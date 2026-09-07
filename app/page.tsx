/* eslint-disable @next/next/no-css-tags, @next/next/no-page-custom-font */
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";

export const metadata = {
  title: "SWA Housekeeping | Housekeeping Luxury",
  description: "Property management e housekeeping luxury per ville premium su Lago di Garda, Lago di Como e Milano."
};

function loadHousekeepingBody() {
  const htmlPath = path.join(process.cwd(), "public", "housekeeping", "index.html");
  const source = fs.readFileSync(htmlPath, "utf8");
  const body = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? source;
  return body
    .replaceAll('href="assets/', 'href="/housekeeping/assets/')
    .replaceAll('src="assets/', 'src="/housekeeping/assets/')
    .replaceAll('href="privacy-policy.html"', 'href="/housekeeping/privacy-policy.html"')
    .replaceAll('href="cookie-policy.html"', 'href="/housekeeping/cookie-policy.html"')
    .replaceAll('href="trattamento-dati.html"', 'href="/housekeeping/trattamento-dati.html"')
    .replaceAll('href="terms.html"', 'href="/housekeeping/terms.html"')
    .replaceAll('href="ordini.html"', 'href="/housekeeping/ordini.html"')
    .replaceAll('href="resi-cancellazioni.html"', 'href="/housekeeping/resi-cancellazioni.html"')
    .replaceAll('href="cura-biancheria.html"', 'href="/housekeeping/cura-biancheria.html"')
    .replaceAll('href="spedizioni.html"', 'href="/housekeeping/spedizioni.html"')
    .replaceAll('href="/chi-siamo.html"', 'href="/housekeeping/chi-siamo.html"')
    .replaceAll('href="en/"', 'href="/housekeeping/en/"')
    .replaceAll('href="de/"', 'href="/housekeeping/de/"')
    .replaceAll('href="uk/"', 'href="/housekeeping/uk/"')
    .replaceAll('href="ru/"', 'href="/housekeeping/ru/"')
    .replaceAll('href="nl/"', 'href="/housekeeping/nl/"')
    .replaceAll('href="ar/"', 'href="/housekeeping/ar/"')
    .replaceAll('href="./"', 'href="/"');
}

export default function MarketingHome() {
  const body = loadHousekeepingBody();

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <link rel="stylesheet" href="/housekeeping/assets/css/styles.css" />
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: body }} />
      <Link
        href="/login"
        className="fixed bottom-5 right-5 z-[9999] rounded-full bg-black px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-2xl ring-1 ring-[#c6a96b]/70 transition hover:bg-[#c6a96b] hover:text-black"
      >
        Area operatori
      </Link>
    </>
  );
}
