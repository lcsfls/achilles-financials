import { NextRequest, NextResponse } from "next/server";
import { CsvError, assertCsvSize, parsePositionsCsv } from "@/lib/csv";
import { PositionError, upsertPositions } from "@/lib/positions";

export const dynamic = "force-dynamic";

/**
 * Import eines Depot-Exports (Bestand oder Orderliste).
 * Das Format wird erkannt, nicht vorausgesetzt — siehe src/lib/csv.ts.
 * Das Übernehmen ins Depot teilt sich der Import mit dem FinTS-Depotabruf,
 * siehe src/lib/positions.ts.
 */
export async function POST(req: NextRequest) {
  const { csv } = await req.json();
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "CSV-Inhalt fehlt" }, { status: 400 });
  }

  let parsed;
  try {
    assertCsvSize(csv);
    parsed = parsePositionsCsv(csv);
  } catch (e) {
    const msg = e instanceof CsvError ? e.message : "Die Datei konnte nicht gelesen werden.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const result = await upsertPositions(parsed.positions, "csv");
    return NextResponse.json({
      ...result,
      skipped: parsed.skipped,
      mode: parsed.mode,
      // Damit ein unbekannter Export überprüfbar ist, statt ihm glauben zu müssen
      detected: { delimiter: parsed.delimiter, headerRow: parsed.headerRow, mapping: parsed.mapping },
    });
  } catch (e) {
    const msg =
      e instanceof PositionError ? `${e.message} Bitte einen Export in EUR verwenden.` : "Import fehlgeschlagen.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
