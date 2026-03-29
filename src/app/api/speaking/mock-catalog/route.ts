import { NextResponse } from "next/server";
import { getSpeakingMockCatalog } from "@/lib/speaking-db";

export async function GET() {
  try {
    const catalog = await getSpeakingMockCatalog();
    return NextResponse.json({ catalog });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load speaking catalog.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
