"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, ArrowLeftRight, Gem, TrendingUp, Eye, QrCode, Settings, Shield, ShieldCheck, Flame, PiggyBank } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { apiJson, cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Übersicht", icon: LayoutDashboard },
  { href: "/transactions", label: "Transaktionen", icon: ArrowLeftRight },
  { href: "/metals", label: "Edelmetalle", icon: Gem },
  { href: "/investments", label: "Investments", icon: TrendingUp },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/pension", label: "Vorsorge", icon: PiggyBank },
  { href: "/emergency", label: "Notgroschen", icon: ShieldCheck },
  { href: "/fire", label: "FIRE", icon: Flame },
  { href: "/connect", label: "Verbinden", icon: QrCode },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

/** Seiten, die statt der Lesebreite die ganze Fensterbreite bekommen. */
const FULL_WIDTH = new Set(["/watchlist"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [checked, setChecked] = useState(false);

  // Ersteinrichtung: ohne abgeschlossenes Setup zum Wizard umleiten.
  //
  // Auf der Login-Seite darf das nicht laufen: /api/settings ist geschützt,
  // liefert dort also 401. Der Setup-Stand ist damit unbekannt — und die
  // Antwort ohne setupDone sähe aus wie „Setup fehlt“ und würde zum Wizard
  // schicken, den die Middleware sofort wieder auf /login zurückwirft.
  // Wer sich anmelden will, hat das Setup ohnehin hinter sich.
  useEffect(() => {
    if (pathname === "/login") { setChecked(true); return; }
    apiJson<{ setupDone: boolean }>("/api/settings")
      .then((s) => {
        if (!s.setupDone && pathname !== "/setup") router.replace("/setup");
        else setChecked(true);
      })
      .catch(() => setChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (pathname === "/setup" || pathname === "/login") {
    return (
      <div className="min-h-screen">
        <div className="aurora" />
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="aurora" />

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col p-4 lg:flex">
        <div className="glass flex h-full flex-col rounded-glass p-5">
          <Link href="/" className="flex items-center gap-3 px-2 pb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#e9cd6f] to-[#9a7a26] shadow-[0_8px_20px_-6px_rgba(212,175,55,0.55)]">
              <Shield className="h-5 w-5 text-[#1a1405]" strokeWidth={2.2} />
            </div>
            <div>
              <div className="font-display text-lg leading-tight tracking-wide gold-text">Achilles</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-2">Financials</div>
            </div>
          </Link>

          <div className="hairline mb-4" />

          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-all duration-200",
                    active
                      ? "bg-gradient-to-r from-gold/15 to-transparent text-gold-bright border border-gold/20 shadow-[0_0_24px_-8px_rgba(212,175,55,0.4)]"
                      : "text-muted hover:text-foreground hover:bg-white/[0.05] border border-transparent"
                  )}
                >
                  <Icon className={cn("h-[18px] w-[18px] transition-colors", active ? "text-gold" : "text-muted-2 group-hover:text-foreground")} strokeWidth={1.8} />
                  {t(label)}
                </Link>
              );
            })}
          </nav>

          <div className="hairline my-4" />
          <div className="px-2 text-[10px] leading-relaxed text-muted-2">
            Private Wealth Dashboard
            <br />
            Self-hosted · Proxmox
          </div>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="fixed inset-x-0 top-0 z-40 p-3 lg:hidden">
        <div className="glass flex items-center gap-1 overflow-x-auto rounded-2xl p-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs",
                  active ? "bg-gold/15 text-gold-bright" : "text-muted"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                <span className="hidden sm:inline">{t(label)}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <main className="min-w-0 flex-1 px-4 pb-16 pt-20 sm:px-6 lg:ml-64 lg:px-10 lg:pt-8">
        {/* 1400px sind eine Lesebreite — sinnvoll für Tabellen und Text.
            Ein Kachelraster gewinnt dagegen mit jeder Spalte, die draufpasst,
            und darf die volle Fensterbreite nutzen. */}
        <div className={cn("mx-auto", FULL_WIDTH.has(pathname) ? "max-w-none" : "max-w-[1400px]", !checked && "opacity-0")}>
          {children}
        </div>
      </main>
    </div>
  );
}
