import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";
import ServiceWorker from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: { default: "Area Operatori | The Blondes Cleaning", template: "%s | The Blondes Cleaning" },
  description: "Area operatori per i report degli interventi The Blondes Cleaning",
  manifest: "/manifest.webmanifest",
  applicationName: "The Blondes Cleaning — Report",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "TBC Report" }
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <Toaster position="top-center" toastOptions={{ duration: 3500 }} />
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
