import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // Version aus package.json fest ins Build backen — so kennt die App ihre
  // Version auch ohne Control-Kanal (z. B. plain Docker ohne Bind-Mount).
  env: { APP_VERSION: pkg.version },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Kein Einbetten in fremde Seiten. Ohne das könnte eine Seite
          // Achilles unsichtbar überlagern und Klicks abfangen — bei einer
          // App, die im LAN ohne Login laufen kann, keine Theorie.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: [
              "default-src 'self'",
              // Next injiziert Inline-Skripte für Hydration; 'unsafe-inline'
              // ist hier der Preis dafür, dass die App überhaupt lädt.
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              // Bank-Logos kommen von Enable Banking, Datei-URLs vom Rausch-SVG
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              // Kurse und Kurse-Proxy laufen serverseitig; der Browser
              // spricht nur mit der App selbst.
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; ") },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Die eigene Adresse nicht an fremde Seiten weiterreichen — sie
          // verrät sonst den internen Hostnamen.
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
