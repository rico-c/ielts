"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, ChevronRight } from "lucide-react";
import { WORD_REVIEW_DECKS } from "@/constants/word-review-decks";

interface DeckItem {
  code: string;
  nameZh: string;
  nameEn: string;
  description: string | null;
  totalCount: number;
  progress: {
    currentPosition: number;
    reviewedCount: number;
    masteredCount: number;
    lastReviewedAt: number | null;
    completedAt: number | null;
  };
}

function createFallbackDeck(deck: (typeof WORD_REVIEW_DECKS)[number]): DeckItem {
  return {
    code: deck.code,
    nameZh: deck.nameZh,
    nameEn: deck.nameEn,
    description: deck.description,
    totalCount: 0,
    progress: {
      currentPosition: 0,
      reviewedCount: 0,
      masteredCount: 0,
      lastReviewedAt: null,
      completedAt: null,
    },
  };
}

export default function WordReviewPage() {
  const [decks, setDecks] = useState<DeckItem[]>(WORD_REVIEW_DECKS.map(createFallbackDeck));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDecks = async () => {
      try {
        const response = await fetch("/api/word-review/decks");
        const data = (await response.json()) as { success?: boolean; data?: DeckItem[] };

        if (data.success && Array.isArray(data.data)) {
          const serverMap = new Map(data.data.map((item) => [item.code, item]));
          setDecks(
            WORD_REVIEW_DECKS.map((deck) => {
              const serverDeck = serverMap.get(deck.code);
              return serverDeck
                ? {
                    ...serverDeck,
                    nameZh: deck.nameZh,
                    nameEn: deck.nameEn,
                    description: deck.description,
                  }
                : createFallbackDeck(deck);
            }),
          );
        }
      } catch (error) {
        console.error("Failed to fetch decks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDecks();
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">单词复习</h1>
        <p className="mt-1 text-sm text-slate-500">沿用 PTE 的 deck + 进度保存方案，在 IELTS 里复刻完整单词复习工作流。</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {decks.map((deck) => {
          const progressText = deck.totalCount > 0 ? `${Math.min(deck.progress.currentPosition + 1, deck.totalCount)}/${deck.totalCount}` : "0/0";
          const codeLabel = deck.code.replaceAll("_", " ");

          return (
            <Link
              key={deck.code}
              href={`/dashboard/word-review/${deck.code}`}
              className="group relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 p-5 pl-7 shadow-[0_6px_14px_rgba(120,53,15,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(120,53,15,0.12)]"
            >
              <div className="pointer-events-none absolute left-0 top-0 h-full w-2 bg-gradient-to-b from-orange-400 via-amber-400 to-orange-300" />
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-orange-700">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>{codeLabel}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">{deck.nameZh}</h2>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400">{deck.nameEn}</p>
                  {deck.description ? <p className="max-w-[32ch] text-sm text-gray-600">{deck.description}</p> : null}
                </div>
                <ChevronRight className="h-5 w-5 text-orange-300 transition-colors group-hover:text-orange-500" />
              </div>

              <div className="mt-5 rounded-lg border border-amber-100/90 bg-white/80 px-3 py-2.5 text-sm text-gray-700 backdrop-blur-[1px]">
                {loading ? (
                  <div className="flex min-h-5 items-center justify-between">
                    <span className="inline-block h-4 w-20 animate-pulse rounded bg-amber-100" />
                    <span className="inline-block h-4 w-16 animate-pulse rounded bg-amber-100" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">进度 {progressText}</span>
                    <span className="text-gray-600">已掌握 {deck.progress.masteredCount}</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {loading ? <div className="text-xs text-slate-400">正在同步你的复习进度...</div> : null}
    </div>
  );
}
