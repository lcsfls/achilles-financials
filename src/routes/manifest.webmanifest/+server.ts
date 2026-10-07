/**
 * Web app manifest — makes Achilles installable on a phone home screen and run
 * standalone (no browser chrome).
 */
export function GET() {
  const manifest = {
    name: "Achilles Financials",
    short_name: "Achilles",
    description: "Self-hosted private wealth dashboard — banking, precious metals, investments.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#f6f7f9",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
