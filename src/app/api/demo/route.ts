import { NextResponse } from "next/server";
import { seedDemoData, clearDemoData } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function POST() {
  seedDemoData();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  clearDemoData();
  return NextResponse.json({ ok: true });
}
