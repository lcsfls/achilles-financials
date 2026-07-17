"use client";

import { useEffect } from "react";

/**
 * Registers the service worker after load. Kept in its own client component so
 * the root layout stays a server component. No-ops where SW is unsupported.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Wait for load so registration never competes with first paint.
    const onLoad = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);
  return null;
}
