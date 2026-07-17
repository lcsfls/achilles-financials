"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, LogIn, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (!res.ok) {
      // Die Sperrmeldung trägt einen {n}-Platzhalter — ohne die Sekunden
      // stünde er wörtlich auf dem Schirm.
      const d = await res.json();
      setError(t(d.error, d.seconds !== undefined ? { n: d.seconds } : undefined));
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="aurora" />
      <div className="rise w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e9cd6f] to-[#9a7a26] shadow-[0_16px_40px_-10px_rgba(212,175,55,0.6)]">
            <Shield className="h-8 w-8 text-[#1a1405]" strokeWidth={2} />
          </div>
          <div>
            <div className="font-display text-3xl gold-text">Achilles Financials</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.28em] text-muted-2">Private Wealth Dashboard</div>
          </div>
        </div>

        <form onSubmit={submit} className="glass space-y-4 rounded-glass p-7">
          <div className="space-y-1.5">
            <Label>{t("Benutzername")}</Label>
            <Input autoFocus autoComplete="username" value={username} onChange={(e) => { setUsername(e.target.value); setError(null); }} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("Passwort")}</Label>
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-soft/25 bg-rose-soft/8 px-3 py-2.5 text-xs text-rose-soft">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy || !username || !password}>
            <LogIn className="h-4 w-4" /> {busy ? t("Anmelden …") : t("Anmelden")}
          </Button>
        </form>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-2">
          {t("Passwort vergessen? Es lässt sich nur direkt in der Datenbank zurücksetzen — siehe README.")}
        </p>
      </div>
    </div>
  );
}
