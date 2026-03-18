import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDatabase } from "@/lib/db";

interface AddWordbookRequest {
  word: string;
  phonetic?: string | null;
  definition?: string | null;
  translation?: string | null;
  exampleSentence?: string | null;
  audioUrl?: string | null;
  sourceQuestionId?: string | null;
  sourceQuestionType?: string | null;
}

function normalizeWord(input: string) {
  return input.toLowerCase().replace(/[^\w'-]/g, "").trim();
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
    const q = (searchParams.get("q") || "").trim().toLowerCase();

    const db = await getDatabase();
    const whereClause = q ? "WHERE user_id = ? AND word_text LIKE ?" : "WHERE user_id = ?";
    const params = q ? [userId, `%${q}%`] : [userId];

    const { results: countResults } = await db
      .prepare(`SELECT COUNT(*) AS total FROM user_wordbook_entries ${whereClause}`)
      .bind(...params)
      .all();

    const { results } = await db
      .prepare(
        `SELECT id, word_id, word_text, phonetic, definition, translation, example_sentence, audio_url, created_at
         FROM user_wordbook_entries
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all();

    return NextResponse.json({
      success: true,
      data: results,
      total: Number((countResults[0] as { total?: number } | undefined)?.total ?? 0),
      count: results.length,
    });
  } catch (error) {
    console.error("Error fetching wordbook:", error);
    return NextResponse.json({ error: "Failed to fetch wordbook" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as AddWordbookRequest;
    const normalizedWord = normalizeWord(body.word || "");

    if (!normalizedWord) {
      return NextResponse.json({ error: "Invalid word" }, { status: 400 });
    }

    const db = await getDatabase();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO vocabulary_words (
          word, phonetic, definition, translation, example_sentence, audio_url, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(word) DO UPDATE SET
          phonetic = COALESCE(excluded.phonetic, vocabulary_words.phonetic),
          definition = COALESCE(excluded.definition, vocabulary_words.definition),
          translation = COALESCE(excluded.translation, vocabulary_words.translation),
          example_sentence = COALESCE(excluded.example_sentence, vocabulary_words.example_sentence),
          audio_url = COALESCE(excluded.audio_url, vocabulary_words.audio_url),
          updated_at = excluded.updated_at`,
      )
      .bind(
        normalizedWord,
        body.phonetic ?? null,
        body.definition ?? null,
        body.translation ?? null,
        body.exampleSentence ?? null,
        body.audioUrl ?? null,
        now,
      )
      .run();

    const { results: wordRows } = await db
      .prepare("SELECT id FROM vocabulary_words WHERE word = ? LIMIT 1")
      .bind(normalizedWord)
      .all();

    const wordId = (wordRows[0] as { id?: number } | undefined)?.id;
    if (!wordId) {
      return NextResponse.json({ error: "Failed to create vocabulary record" }, { status: 500 });
    }

    await db
      .prepare(
        `INSERT INTO user_wordbook_entries (
          user_id, word_id, word_text, phonetic, definition, translation, example_sentence, audio_url,
          source_question_id, source_question_type, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, word_text) DO UPDATE SET
          word_id = excluded.word_id,
          phonetic = COALESCE(excluded.phonetic, user_wordbook_entries.phonetic),
          definition = COALESCE(excluded.definition, user_wordbook_entries.definition),
          translation = COALESCE(excluded.translation, user_wordbook_entries.translation),
          example_sentence = COALESCE(excluded.example_sentence, user_wordbook_entries.example_sentence),
          audio_url = COALESCE(excluded.audio_url, user_wordbook_entries.audio_url),
          source_question_id = COALESCE(excluded.source_question_id, user_wordbook_entries.source_question_id),
          source_question_type = COALESCE(excluded.source_question_type, user_wordbook_entries.source_question_type),
          updated_at = excluded.updated_at`,
      )
      .bind(
        userId,
        wordId,
        normalizedWord,
        body.phonetic ?? null,
        body.definition ?? null,
        body.translation ?? null,
        body.exampleSentence ?? null,
        body.audioUrl ?? null,
        body.sourceQuestionId ?? null,
        body.sourceQuestionType ?? null,
        now,
        now,
      )
      .run();

    return NextResponse.json({
      success: true,
      data: { word: normalizedWord, wordId },
      message: "Added to wordbook",
    });
  } catch (error) {
    console.error("Error adding wordbook entry:", error);
    return NextResponse.json({ error: "Failed to add word to wordbook" }, { status: 500 });
  }
}
