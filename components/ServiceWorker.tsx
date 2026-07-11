"use client";
import { useEffect } from "react";
export default function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        if (process.env.NODE_ENV !== "production") console.error("Service worker registration failed", error);
      });
    }
  }, []);
  return null;
}
