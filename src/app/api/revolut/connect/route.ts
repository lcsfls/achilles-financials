import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { createRequisition } from "@/lib/gocardless";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { country } = await req.json().catch(() => ({ country: "DE" }));
    const origin = process.env.APP_URL || new URL(req.url).origin;
    const { link } = await createRequisition(`${origin}/api/revolut/callback`, country || "DE");

    const qrDataUrl = await QRCode.toDataURL(link, {
      width: 480,
      margin: 2,
      color: { dark: "#0a0a0a", light: "#f5f0e0" },
      errorCorrectionLevel: "M",
    });

    return NextResponse.json({ link, qrDataUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }, { status: 500 });
  }
}
