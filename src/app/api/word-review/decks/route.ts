import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDatabase } from "@/lib/db";
import { WORD_REVIEW_DECKS } from "@/constants/word-review-decks";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDatabase();

    const decks = await Promise.all(
      WORD_REVIEW_DECKS.map(async (deck) => {
        const totalQuery =
          deck.code === "wordbook"
            ? "SELECT COUNT(*) AS total FROM user_wordbook_entries WHERE user_id = ?"
            : "SELECT COUNT(*) AS total FROM word_review_deck_words WHERE deck_code = ?";
        const totalBind = deck.code === "wordbook" ? [userId] : [deck.code];

        const { results: totalRows } = await db.prepare(totalQuery).bind(...totalBind).all();
        const totalCount = Number((totalRows[0] as { total?: number } | undefined)?.total ?? 0);

        const { results: progressRows } = await db
          .prepare(
            `SELECT current_position, reviewed_count, mastered_count, last_reviewed_at, completed_at
             FROM user_word_review_progress
             WHERE user_id = ? AND deck_code = ?
             LIMIT 1`,
          )
          .bind(userId, deck.code)
          .all();

        const progress = progressRows[0] as
          | {
              current_position?: number;
              reviewed_count?: number;
              mastered_count?: number;
              last_reviewed_at?: number;
              completed_at?: number | null;
            }
          | undefined;

        return {
          code: deck.code,
          nameZh: deck.nameZh,
          nameEn: deck.nameEn,
          description: deck.description,
          totalCount,
          progress: {
            currentPosition: progress?.current_position ?? 0,
            reviewedCount: progress?.reviewed_count ?? 0,
            masteredCount: progress?.mastered_count ?? 0,
            lastReviewedAt: progress?.last_reviewed_at ?? null,
            completedAt: progress?.completed_at ?? null,
          },
        };
      }),
    );

    return NextResponse.json({ success: true, data: decks });
  } catch (error) {
    console.error("Error fetching word review decks:", error);
    return NextResponse.json({ error: "Failed to fetch word review decks" }, { status: 500 });
  }
}
