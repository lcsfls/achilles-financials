import type { MetadataRoute } from "next";

/**
 * Web app manifest — makes Achilles installable on a phone home screen and run
 * standalone (no browser chrome). Served at /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Achilles Financials",
    short_name: "Achilles",
    description: "Self-hosted private wealth dashboard — banking, precious metals, investments.",
    start_url: "/",
    display: "standalone",
    background_color: "#07080c",
    theme_color: "#07080c",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
