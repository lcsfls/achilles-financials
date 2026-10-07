import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import QRCode from "qrcode";
import { startAuth } from "$lib/server/enablebanking";
import { callbackUrl } from "$lib/server/app-url";

import { isEnabled } from "$lib/server/integrations";


export async function POST({ request: req }: RequestEvent) {
  if (!isEnabled("enablebanking")) {
    return json({ error: "Die Enable-Banking-Integration ist nicht aktiviert." }, { status: 400 });
  }
  try {
    const { aspspName, country } = await req.json();
    if (!aspspName || !country) {
      return json({ error: "Bank und Land sind erforderlich" }, { status: 400 });
    }

    const { url } = await startAuth(aspspName, country, callbackUrl(req.url));

    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 480,
      margin: 2,
      color: { dark: "#0a0a0a", light: "#f5f0e0" },
      errorCorrectionLevel: "M",
    });

    return json({ link: url, qrDataUrl });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }, { status: 500 });
  }
}
