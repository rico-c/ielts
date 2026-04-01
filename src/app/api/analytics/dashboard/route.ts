import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getPracticeActivityDashboard } from "@/lib/practice-analytics";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dashboard = await getPracticeActivityDashboard(userId, {
      dailyDays: 28,
      recentLimit: 12,
    });

    return NextResponse.json({ dashboard });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load analytics dashboard.",
      },
      { status: 500 },
    );
  }
}
