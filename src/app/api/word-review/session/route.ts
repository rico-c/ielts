import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDatabase } from "@/lib/db";
import { getWordReviewDeckByCode } from "@/constants/word-review-decks";

type ReviewResult = "correct" | "incorrect" | "mastered" | "skipped";

interface UpdateSessionBody {
  deckCode: string;
  wordId?: number | null;
  currentPosition: number;
  result?: ReviewResult;
}

async function getDeckByCode(code: string) {
  const db = await getDatabase();
  const deck = getWordReviewDeckByCode(code);
  return { db, deck };
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const deckCode = searchParams.get("deck");

    if (!deckCode) {
      return NextResponse.json({ error: "Missing deck parameter" }, { status: 400 });
    }

    const { db, deck } = await getDeckByCode(deckCode);
    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    const wordsQuery =
      deck.code === "wordbook"
        ? `SELECT
             e.word_id AS wordId,
             e.word_text AS word,
             e.phonetic,
             e.definition,
             e.translation,
             e.example_sentence AS exampleSentence,
             e.audio_url AS audioUrl
           FROM user_wordbook_entries e
           WHERE e.user_id = ?
           ORDER BY e.created_at DESC`
        : `SELECT
             vw.id AS wordId,
             vw.word,
             vw.phonetic,
             vw.definition,
             vw.translation,
             vw.example_sentence AS exampleSentence,
             vw.audio_url AS audioUrl
           FROM word_review_deck_words dw
           JOIN vocabulary_words vw ON vw.id = dw.word_id
           WHERE dw.deck_code = ?
           ORDER BY dw.sort_order ASC, dw.id ASC`;

    const wordsBind = deck.code === "wordbook" ? [userId] : [deck.code];
    const { results: words } = await db.prepare(wordsQuery).bind(...wordsBind).all();
    const totalCount = words.length;

    const { results: progressRows } = await db
      .prepare(
        `SELECT id, current_position, reviewed_count, mastered_count, total_count_snapshot, last_word_id, last_reviewed_at
         FROM user_word_review_progress
         WHERE user_id = ? AND deck_code = ?
         LIMIT 1`,
      )
      .bind(userId, deck.code)
      .all();

    const progressRow = progressRows[0] as
      | {
          id: number;
          current_position: number;
          reviewed_count: number;
          mastered_count: number;
          total_count_snapshot: number;
          last_word_id: number | null;
          last_reviewed_at: number | null;
        }
      | undefined;

    const now = Math.floor(Date.now() / 1000);

    if (!progressRow) {
      await db
        .prepare(
          `INSERT INTO user_word_review_progress (
            user_id, deck_code, current_position, reviewed_count, mastered_count, total_count_snapshot, created_at, updated_at
          ) VALUES (?, ?, 0, 0, 0, ?, ?, ?)`,
        )
        .bind(userId, deck.code, totalCount, now, now)
        .run();
    } else if (progressRow.total_count_snapshot !== totalCount) {
      await db
        .prepare(
          `UPDATE user_word_review_progress
           SET total_count_snapshot = ?, updated_at = ?
           WHERE user_id = ? AND deck_code = ?`,
        )
        .bind(totalCount, now, userId, deck.code)
        .run();
    }

    const currentPosition = Math.max(0, Math.min(progressRow?.current_position ?? 0, Math.max(totalCount - 1, 0)));

    return NextResponse.json({
      success: true,
      data: {
        deck,
        words,
        progress: {
          currentPosition,
          reviewedCount: progressRow?.reviewed_count ?? 0,
          masteredCount: progressRow?.mastered_count ?? 0,
          totalCount,
          lastWordId: progressRow?.last_word_id ?? null,
          lastReviewedAt: progressRow?.last_reviewed_at ?? null,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching word review session:", error);
    return NextResponse.json({ error: "Failed to fetch word review session" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as UpdateSessionBody;
    const deckCode = body.deckCode?.trim();
    const currentPosition = Number.isFinite(body.currentPosition) ? Math.max(0, Math.floor(body.currentPosition)) : 0;

    if (!deckCode) {
      return NextResponse.json({ error: "Missing deckCode" }, { status: 400 });
    }

    const { db, deck } = await getDeckByCode(deckCode);
    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    const now = Math.floor(Date.now() / 1000);
    const wordId = body.wordId ?? null;
    const result = body.result;

    if (wordId && result) {
      const { results: existingRows } = await db
        .prepare(
          `SELECT review_count, correct_count, incorrect_count, status
           FROM user_word_review_word_progress
           WHERE user_id = ? AND deck_code = ? AND word_id = ?
           LIMIT 1`,
        )
        .bind(userId, deck.code, wordId)
        .all();

      const existing = existingRows[0] as
        | {
            review_count?: number;
            correct_count?: number;
            incorrect_count?: number;
            status?: string;
          }
        | undefined;

      const reviewCount = (existing?.review_count ?? 0) + 1;
      const correctCount = (existing?.correct_count ?? 0) + (result === "correct" || result === "mastered" ? 1 : 0);
      const incorrectCount = (existing?.incorrect_count ?? 0) + (result === "incorrect" ? 1 : 0);

      let status = existing?.status ?? "new";
      if (result === "mastered") status = "mastered";
      if (result === "incorrect") status = "difficult";
      if (result === "correct") status = correctCount >= 3 ? "mastered" : "learning";
      if (result === "skipped" && status === "new") status = "learning";

      await db
        .prepare(
          `INSERT INTO user_word_review_word_progress (
             user_id, deck_code, word_id, status, review_count, correct_count, incorrect_count, last_result,
             last_reviewed_at, next_review_at, mastered_at, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, deck_code, word_id) DO UPDATE SET
             status = excluded.status,
             review_count = excluded.review_count,
             correct_count = excluded.correct_count,
             incorrect_count = excluded.incorrect_count,
             last_result = excluded.last_result,
             last_reviewed_at = excluded.last_reviewed_at,
             next_review_at = excluded.next_review_at,
             mastered_at = excluded.mastered_at,
             updated_at = excluded.updated_at`,
        )
        .bind(
          userId,
          deck.code,
          wordId,
          status,
          reviewCount,
          correctCount,
          incorrectCount,
          result,
          now,
          now + 24 * 60 * 60,
          status === "mastered" ? now : null,
          now,
          now,
        )
        .run();
    }

    const { results: masteredRows } = await db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM user_word_review_word_progress
         WHERE user_id = ? AND deck_code = ? AND status = 'mastered'`,
      )
      .bind(userId, deck.code)
      .all();

    const masteredCount = Number((masteredRows[0] as { total?: number } | undefined)?.total ?? 0);

    await db
      .prepare(
        `INSERT INTO user_word_review_progress (
          user_id, deck_code, current_position, reviewed_count, mastered_count, last_word_id, last_reviewed_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, deck_code) DO UPDATE SET
          current_position = excluded.current_position,
          reviewed_count = CASE WHEN ? IS NOT NULL THEN user_word_review_progress.reviewed_count + 1 ELSE user_word_review_progress.reviewed_count END,
          mastered_count = excluded.mastered_count,
          last_word_id = excluded.last_word_id,
          last_reviewed_at = excluded.last_reviewed_at,
          updated_at = excluded.updated_at`,
      )
      .bind(
        userId,
        deck.code,
        currentPosition,
        result ? 1 : 0,
        masteredCount,
        wordId,
        now,
        now,
        now,
        result ?? null,
      )
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating word review session:", error);
    return NextResponse.json({ error: "Failed to save word review session" }, { status: 500 });
  }
}
