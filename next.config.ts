import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // Version aus package.json fest ins Build backen — so kennt die App ihre
  // Version auch ohne Control-Kanal (z. B. plain Docker ohne Bind-Mount).
  env: { APP_VERSION: pkg.version },
};

export default nextConfig;
