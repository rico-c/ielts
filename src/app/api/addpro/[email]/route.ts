import dayjs from "dayjs";
import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ email: string }>;
}

async function handleAddPro(_request: NextRequest, { params }: RouteParams) {
  try {
    const { email: emailParam } = await params;
    const email = decodeURIComponent(emailParam).trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email" },
        { status: 400 }
      );
    }

    const client = await clerkClient();
    const users = await client.users.getUserList({
      emailAddress: [email],
      limit: 1,
    });
    const targetUser = users.data[0];

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const db = await getDatabase();
    const existingMembership = await db
      .prepare("SELECT id, user_id, price_id, start_date, end_date FROM members WHERE user_id = ? LIMIT 1")
      .bind(targetUser.id)
      .first();

    if (existingMembership) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "Membership record already exists",
        userId: targetUser.id,
        membership: existingMembership,
      });
    }

    const startDate = dayjs().unix();
    const endDate = dayjs().add(3, "day").unix();

    await db
      .prepare(`
        INSERT INTO members (
          user_id, email, stripe_customer_id, stripe_subscription_id, price_id, status, start_date, end_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        targetUser.id,
        email,
        null,
        null,
        "redbook_3daypro",
        "active",
        startDate,
        endDate
      )
      .run();

    return NextResponse.json({
      success: true,
      skipped: false,
      message: "3-day PRO membership added",
      userId: targetUser.id,
      startDate,
      endDate,
      priceId: "redbook_3daypro",
    });
  } catch (error) {
    console.error("Add PRO error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
        errorDetails: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, context: RouteParams) {
  return handleAddPro(request, context);
}

export async function POST(request: NextRequest, context: RouteParams) {
  return handleAddPro(request, context);
}
