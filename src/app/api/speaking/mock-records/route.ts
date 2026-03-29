import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSpeakingMockSessionDetails } from "@/lib/speaking-mock-records";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const records = await getSpeakingMockSessionDetails(userId);
    return NextResponse.json({ records });
  } catch (error) {
    console.error("Failed to load speaking mock records:", error);
    return NextResponse.json(
      { error: "Failed to load speaking mock records." },
      { status: 500 },
    );
  }
}
