import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDatabase } from "@/lib/db";

// export const runtime = 'edge';

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ isVip: false, message: "Not logged in" }, { status: 401 });
    }

    const db = await getDatabase();
    const now = Math.floor(Date.now() / 1000); // Current time in seconds

    // Query for active membership that hasn't expired
    const stmt = db.prepare(`
        SELECT * FROM members 
        WHERE user_id = ? 
        AND status = 'active' 
        AND end_date > ? 
        ORDER BY end_date DESC 
        LIMIT 1
    `);

    const result = await stmt.bind(userId, now).first();

    if (result) {
      return NextResponse.json({
        isVip: true,
        expiryDate: result.end_date,
        plan: result.price_id,
        subscriptionId: result.stripe_subscription_id
      });
    } else {
      return NextResponse.json({
        isVip: false,
        expiryDate: null
      });
    }

  } catch (error: any) {
    console.error("Error fetching membership status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
