import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  upsertPracticeActivityLog,
  type PracticeActivityType,
} from "@/lib/practice-analytics";

function isPracticeActivityType(value: unknown): value is PracticeActivityType {
  return (
    value === "cambridge_practice" ||
    value === "speaking_mock" ||
    value === "intensive_listening"
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    if (
      typeof body.sessionKey !== "string" ||
      !isPracticeActivityType(body.activityType) ||
      typeof body.sourcePath !== "string" ||
      typeof body.itemTitle !== "string" ||
      !isFiniteNumber(body.startedAt) ||
      !isFiniteNumber(body.endedAt)
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const startedAt = Math.floor(body.startedAt);
    const endedAt = Math.floor(body.endedAt);
    if (endedAt - startedAt < 5) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    await upsertPracticeActivityLog(userId, {
      sessionKey: body.sessionKey,
      activityType: body.activityType,
      sourcePath: body.sourcePath,
      itemTitle: body.itemTitle,
      itemSubtitle: typeof body.itemSubtitle === "string" ? body.itemSubtitle : null,
      module: typeof body.module === "string" ? body.module : null,
      bookNo: isFiniteNumber(body.bookNo) ? Math.floor(body.bookNo) : null,
      testNo: isFiniteNumber(body.testNo) ? Math.floor(body.testNo) : null,
      partNo: isFiniteNumber(body.partNo) ? Math.floor(body.partNo) : null,
      topicId: typeof body.topicId === "string" ? body.topicId : null,
      topicGroup: typeof body.topicGroup === "string" ? body.topicGroup : null,
      questionCount: isFiniteNumber(body.questionCount)
        ? Math.floor(body.questionCount)
        : 0,
      startedAt,
      endedAt,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save practice session.",
      },
      { status: 500 },
    );
  }
}
