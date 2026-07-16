import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULTS = {
  age: 30,
  monthlySavings: 1500,
  annualReturnPct: 6.5,
  inflationPct: 2.0,
  withdrawalRatePct: 3.5,
  monthlyExpenses: 2500,
  startNetWorth: null as number | null, // null = automatisch aus Portfolio
};

export async function GET() {
  const raw = getSetting("fire_params");
  const params = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  return NextResponse.json({ params });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const params = { ...DEFAULTS, ...body };
  setSetting("fire_params", JSON.stringify(params));
  return NextResponse.json({ ok: true });
}
