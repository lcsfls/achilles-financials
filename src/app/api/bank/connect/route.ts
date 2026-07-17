import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { startAuth } from "@/lib/enablebanking";
import { callbackUrl } from "@/lib/app-url";

import { isEnabled } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isEnabled("enablebanking")) {
    return NextResponse.json({ error: "Die Enable-Banking-Integration ist nicht aktiviert." }, { status: 400 });
  }
  try {
    const { aspspName, country } = await req.json();
    if (!aspspName || !country) {
      return NextResponse.json({ error: "Bank und Land sind erforderlich" }, { status: 400 });
    }

    const { url } = await startAuth(aspspName, country, callbackUrl(req.url));

    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 480,
      margin: 2,
      color: { dark: "#0a0a0a", light: "#f5f0e0" },
      errorCorrectionLevel: "M",
    });

    return NextResponse.json({ link: url, qrDataUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }, { status: 500 });
  }
}
