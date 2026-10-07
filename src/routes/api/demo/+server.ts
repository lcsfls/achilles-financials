import { json } from "@sveltejs/kit";
import { seedDemoData, clearDemoData } from "$lib/server/demo";


export async function POST() {
  seedDemoData();
  return json({ ok: true });
}

export async function DELETE() {
  clearDemoData();
  return json({ ok: true });
}
