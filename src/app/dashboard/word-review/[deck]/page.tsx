"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  Loader2,
  SkipForward,
  Volume2,
} from "lucide-react";
import { WORD_REVIEW_DECKS } from "@/constants/word-review-decks";

interface ReviewWord {
  wordId: number;
  word: string;
  phonetic?: string | null;
  definition?: string | null;
  translation?: string | null;
  exampleSentence?: string | null;
  audioUrl?: string | null;
}

interface SessionData {
  deck: {
    code: string;
    nameZh: string;
    nameEn: string;
  };
  words: ReviewWord[];
  progress: {
    currentPosition: number;
    reviewedCount: number;
    masteredCount: number;
    totalCount: number;
  };
}

type ReviewResult = "correct" | "incorrect" | "mastered" | "skipped";

const SHORTCUT_KEYS = {
  playAudio: "F",
  showDefinition: "C",
  correct: "A",
  incorrect: "S",
  mastered: "D",
  previous: "Z",
  skip: "X",
} as const;

export default function WordReviewDeckPage() {
  const params = useParams<{ deck: string }>();
  const router = useRouter();
  const deckCode = params.deck;

  const [session, setSession] = useState<SessionData | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [hideDefinitionFirst, setHideDefinitionFirst] = useState(false);
  const [audioFirstMode, setAudioFirstMode] = useState(false);
  const [isDefinitionRevealed, setIsDefinitionRevealed] = useState(true);
  const [isWordInfoRevealed, setIsWordInfoRevealed] = useState(true);
  const pendingSaveCountRef = useRef(0);
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    if (!deckCode) return;

    const isKnownDeck = WORD_REVIEW_DECKS.some((deck) => deck.code === deckCode);
    if (!isKnownDeck) {
      router.push("/dashboard/word-review");
      return;
    }

    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/word-review/session?deck=${encodeURIComponent(deckCode)}`);
        const data = (await response.json()) as { success?: boolean; data?: SessionData; error?: string };

        if (data.success && data.data) {
          setSession(data.data);
          setIndex(data.data.progress.currentPosition || 0);
        } else {
          alert(data.error || "加载单词复习数据失败");
          router.push("/dashboard/word-review");
        }
      } catch (error) {
        console.error("Failed to fetch review session:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [deckCode, router]);

  const currentWord = useMemo(() => {
    if (!session || session.words.length === 0) return null;
    return session.words[Math.max(0, Math.min(index, session.words.length - 1))];
  }, [index, session]);

  const enqueueSaveProgress = useCallback(
    (payload: { wordId?: number; currentPosition: number; result?: ReviewResult }) => {
      if (!session) return;

      pendingSaveCountRef.current += 1;
      setSyncing(true);

      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            await fetch("/api/word-review/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                deckCode: session.deck.code,
                ...payload,
              }),
            });
          } catch (error) {
            console.error("Failed to save review progress:", error);
          } finally {
            pendingSaveCountRef.current = Math.max(0, pendingSaveCountRef.current - 1);
            if (pendingSaveCountRef.current === 0) {
              setSyncing(false);
            }
          }
        });
    },
    [session],
  );

  const nextWord = useCallback(
    (result?: ReviewResult) => {
      if (!session || !currentWord) return;

      enqueueSaveProgress({
        wordId: currentWord.wordId,
        currentPosition: index,
        result,
      });

      setIndex((prev) => Math.min(prev + 1, session.words.length - 1));
    },
    [currentWord, enqueueSaveProgress, index, session],
  );

  const prevWord = useCallback(() => {
    if (session && currentWord) {
      enqueueSaveProgress({
        wordId: currentWord.wordId,
        currentPosition: index,
      });
    }

    setIndex((prev) => Math.max(prev - 1, 0));
  }, [currentWord, enqueueSaveProgress, index, session]);

  const playAudio = useCallback(() => {
    if (!currentWord?.word || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentWord.word);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }, [currentWord?.word]);

  useEffect(() => {
    if (!currentWord) return;
    setIsDefinitionRevealed(!hideDefinitionFirst);
    setIsWordInfoRevealed(!audioFirstMode);
  }, [audioFirstMode, currentWord, hideDefinitionFirst]);

  useEffect(() => {
    if (!currentWord || !autoPlayAudio) return;
    playAudio();
  }, [autoPlayAudio, currentWord, playAudio]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target.isContentEditable) {
          return;
        }
      }

      const key = event.key.toLowerCase();
      if (key === SHORTCUT_KEYS.playAudio.toLowerCase()) {
        event.preventDefault();
        playAudio();
        return;
      }
      if (key === SHORTCUT_KEYS.correct.toLowerCase()) {
        event.preventDefault();
        nextWord("correct");
        return;
      }
      if (key === SHORTCUT_KEYS.showDefinition.toLowerCase()) {
        if (hideDefinitionFirst && !isDefinitionRevealed) {
          event.preventDefault();
          setIsDefinitionRevealed(true);
        }
        return;
      }
      if (key === SHORTCUT_KEYS.incorrect.toLowerCase()) {
        event.preventDefault();
        nextWord("incorrect");
        return;
      }
      if (key === SHORTCUT_KEYS.mastered.toLowerCase()) {
        event.preventDefault();
        nextWord("mastered");
        return;
      }
      if (key === SHORTCUT_KEYS.previous.toLowerCase()) {
        event.preventDefault();
        if (index > 0) prevWord();
        return;
      }
      if (key === SHORTCUT_KEYS.skip.toLowerCase()) {
        event.preventDefault();
        if (session && index < session.words.length - 1) nextWord("skipped");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hideDefinitionFirst, index, isDefinitionRevealed, nextWord, playAudio, prevWord, session]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="rounded-[1.75rem] border border-amber-200/70 bg-white/75 p-6 shadow-[0_24px_70px_-45px_rgba(161,98,7,0.75)] backdrop-blur sm:p-8">
          <div className="flex items-center gap-3 text-amber-900">
            <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
            <p className="text-sm font-medium">正在加载单词复习数据...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-rose-700">单词复习数据加载失败。</div>;
  }

  if (session.words.length === 0) {
    return (
      <div className="relative mx-auto max-w-5xl space-y-5 overflow-hidden rounded-[2rem] border border-amber-200/60 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-6 sm:p-8">
        <Link href="/dashboard/word-review" className="inline-flex items-center gap-2 text-sm font-medium text-amber-800 transition hover:text-amber-950">
          <ArrowLeft className="h-4 w-4" />
          返回单词复习
        </Link>
        <div className="rounded-2xl border border-white/70 bg-white/80 p-6 text-sm leading-7 text-amber-900/80 shadow-[0_20px_60px_-35px_rgba(180,83,9,0.55)] backdrop-blur">
          当前 deck 还没有可复习单词。你可以先通过 JSON 导入词库，或后续接入单词本入口。
        </div>
      </div>
    );
  }

  const shouldShowWordInfo = !audioFirstMode || isWordInfoRevealed;
  const shouldShowDefinition = !hideDefinitionFirst || isDefinitionRevealed;
  const definitionVisibleByDefault = !hideDefinitionFirst;
  const wordVisibleByDefault = !audioFirstMode;

  return (
    <div className="relative mx-auto max-w-5xl space-y-6 overflow-hidden px-4 py-4 sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-amber-300/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-8 -left-24 h-64 w-64 rounded-full bg-orange-300/25 blur-3xl" />

      <header className="rounded-[1.75rem] border border-amber-200/70 bg-white/65 p-5 shadow-[0_24px_70px_-45px_rgba(161,98,7,0.75)] backdrop-blur sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard/word-review" className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 transition hover:text-amber-950">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
          <div className="flex items-center gap-3 text-xs font-medium text-amber-900/80 sm:text-sm">
            <span className="rounded-full border border-amber-200/80 bg-amber-100/70 px-3 py-1">
              进度 {index + 1}/{session.words.length}
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-100/80 px-3 py-1">
              已掌握 {session.progress.masteredCount}
            </span>
            {syncing ? <span className="text-xs text-amber-700">正在同步...</span> : null}
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-semibold tracking-tight text-amber-950 sm:text-3xl">{session.deck.nameZh}</h1>
          <p className="mt-1 text-sm text-amber-900/65">{session.deck.nameEn}</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAutoPlayAudio((prev) => !prev)}
            aria-pressed={autoPlayAudio}
            className={`inline-flex items-center gap-3 rounded-full border px-3 py-2 text-xs font-semibold tracking-wide transition sm:text-sm ${
              autoPlayAudio ? "border-sky-200 bg-sky-50/70 text-sky-900/85" : "border-amber-200 bg-white/70 text-amber-900/75 hover:bg-amber-50/70"
            }`}
          >
            <span>自动播放发音</span>
            <span className={`relative h-6 w-11 rounded-full transition ${autoPlayAudio ? "bg-sky-400/75" : "bg-amber-200/80"}`} aria-hidden>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${autoPlayAudio ? "left-[22px]" : "left-0.5"}`} />
            </span>
            <span className={`text-[10px] font-bold ${autoPlayAudio ? "text-sky-800" : "text-amber-700/80"}`}>{autoPlayAudio ? "ON" : "OFF"}</span>
          </button>

          <button
            type="button"
            onClick={() => setHideDefinitionFirst((prev) => !prev)}
            aria-pressed={definitionVisibleByDefault}
            className={`inline-flex items-center gap-3 rounded-full border px-3 py-2 text-xs font-semibold tracking-wide transition sm:text-sm ${
              definitionVisibleByDefault ? "border-orange-200 bg-orange-50/75 text-orange-900/85" : "border-amber-200 bg-white/70 text-amber-900/75 hover:bg-amber-50/70"
            }`}
          >
            <span>{definitionVisibleByDefault ? "默认显示释义" : "先隐藏释义"}</span>
            <span className={`relative h-6 w-11 rounded-full transition ${definitionVisibleByDefault ? "bg-orange-400/75" : "bg-amber-200/80"}`} aria-hidden>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${definitionVisibleByDefault ? "left-[22px]" : "left-0.5"}`} />
            </span>
            <span className={`text-[10px] font-bold ${definitionVisibleByDefault ? "text-orange-800" : "text-amber-700/80"}`}>{definitionVisibleByDefault ? "ON" : "OFF"}</span>
          </button>

          <button
            type="button"
            onClick={() => setAudioFirstMode((prev) => !prev)}
            aria-pressed={wordVisibleByDefault}
            className={`inline-flex items-center gap-3 rounded-full border px-3 py-2 text-xs font-semibold tracking-wide transition sm:text-sm ${
              wordVisibleByDefault ? "border-emerald-200 bg-emerald-50/75 text-emerald-900/85" : "border-amber-200 bg-white/70 text-amber-900/75 hover:bg-amber-50/70"
            }`}
          >
            <span>{wordVisibleByDefault ? "默认显示单词" : "先只听音"}</span>
            <span className={`relative h-6 w-11 rounded-full transition ${wordVisibleByDefault ? "bg-emerald-400/75" : "bg-amber-200/80"}`} aria-hidden>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${wordVisibleByDefault ? "left-[22px]" : "left-0.5"}`} />
            </span>
            <span className={`text-[10px] font-bold ${wordVisibleByDefault ? "text-emerald-800" : "text-amber-700/80"}`}>{wordVisibleByDefault ? "ON" : "OFF"}</span>
          </button>
        </div>
      </header>

      <section className="rounded-[1.9rem] border border-orange-200/65 bg-gradient-to-br from-white/80 via-orange-50/70 to-amber-50/70 p-5 shadow-[0_30px_80px_-50px_rgba(194,65,12,0.7)] backdrop-blur sm:p-7">
        {currentWord ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-[0_20px_55px_-40px_rgba(120,53,15,0.8)] sm:p-7">
              <div className="mb-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={playAudio}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-800 transition hover:scale-[1.03] hover:bg-sky-100"
                  aria-label="播放发音"
                  title={`播放发音 (${SHORTCUT_KEYS.playAudio})`}
                >
                  <Volume2 className="h-5 w-5" />
                </button>
                <span className="rounded-md border border-sky-200 bg-white/80 px-2 py-1 text-[10px] font-semibold tracking-wider text-sky-800">
                  {SHORTCUT_KEYS.playAudio}
                </span>
                {audioFirstMode && !isWordInfoRevealed ? (
                  <span className="rounded-full bg-amber-100/80 px-3 py-1 text-xs font-medium text-amber-800">当前为先听音模式</span>
                ) : null}
              </div>

              {!shouldShowWordInfo ? (
                <button
                  type="button"
                  onClick={() => setIsWordInfoRevealed(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
                >
                  <Eye className="h-4 w-4" />
                  显示单词信息
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <h2 className="text-4xl font-semibold leading-tight tracking-tight text-amber-950 sm:text-5xl">{currentWord.word}</h2>
                    {currentWord.phonetic ? <span className="text-base text-amber-900/60">/{currentWord.phonetic}/</span> : null}
                  </div>

                  {!shouldShowDefinition ? (
                    <button
                      type="button"
                      onClick={() => setIsDefinitionRevealed(true)}
                      title={`显示释义 (${SHORTCUT_KEYS.showDefinition})`}
                      className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-800 transition hover:bg-orange-100"
                    >
                      <Eye className="h-4 w-4" />
                      显示释义
                      <span className="rounded-md border border-orange-300 bg-white/75 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-orange-800">
                        {SHORTCUT_KEYS.showDefinition}
                      </span>
                    </button>
                  ) : null}

                  {shouldShowDefinition && currentWord.definition ? (
                    <p className="rounded-2xl border border-amber-100 bg-amber-50/65 px-4 py-3 text-sm leading-7 text-amber-950 sm:text-base">
                      {currentWord.definition}
                    </p>
                  ) : null}

                  {shouldShowDefinition && currentWord.translation ? (
                    <p className="text-sm leading-7 text-amber-900/80 sm:text-base">中译：{currentWord.translation}</p>
                  ) : null}

                  {hideDefinitionFirst && isDefinitionRevealed ? (
                    <button
                      type="button"
                      onClick={() => setIsDefinitionRevealed(false)}
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm text-amber-900/80 transition hover:bg-amber-50"
                    >
                      <EyeOff className="h-4 w-4" />
                      再次隐藏释义
                    </button>
                  ) : null}

                  {currentWord.exampleSentence ? (
                    <p className="text-sm italic leading-7 text-amber-900/65 sm:text-base">"{currentWord.exampleSentence}"</p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                onClick={() => nextWord("correct")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-500 bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_-22px_rgba(14,116,144,1)] transition hover:-translate-y-0.5 hover:bg-sky-600"
                title={`认识 (${SHORTCUT_KEYS.correct})`}
              >
                <CheckCircle2 className="h-4 w-4" />
                认识
                <span className="rounded-md border border-white/40 bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider">{SHORTCUT_KEYS.correct}</span>
              </button>
              <button
                onClick={() => nextWord("incorrect")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-500 bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_-22px_rgba(194,65,12,1)] transition hover:-translate-y-0.5 hover:bg-orange-600"
                title={`不认识 (${SHORTCUT_KEYS.incorrect})`}
              >
                <CircleAlert className="h-4 w-4" />
                不认识
                <span className="rounded-md border border-white/40 bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider">{SHORTCUT_KEYS.incorrect}</span>
              </button>
              <button
                onClick={() => nextWord("mastered")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500 bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_-22px_rgba(5,150,105,1)] transition hover:-translate-y-0.5 hover:bg-emerald-600"
                title={`已掌握 (${SHORTCUT_KEYS.mastered})`}
              >
                <CheckCircle2 className="h-4 w-4" />
                已掌握
                <span className="rounded-md border border-white/40 bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider">{SHORTCUT_KEYS.mastered}</span>
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/70 bg-white/70 p-4 backdrop-blur">
        <button
          onClick={prevWord}
          disabled={index === 0}
          className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
          title={`上一个 (${SHORTCUT_KEYS.previous})`}
        >
          上一个
          <span className="ml-2 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-800">
            {SHORTCUT_KEYS.previous}
          </span>
        </button>
        <button
          onClick={() => nextWord("skipped")}
          disabled={index >= session.words.length - 1}
          className="inline-flex items-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          title={`跳过 (${SHORTCUT_KEYS.skip})`}
        >
          <SkipForward className="h-4 w-4" />
          跳过
          <span className="rounded-md border border-sky-300 bg-white px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-sky-800">
            {SHORTCUT_KEYS.skip}
          </span>
        </button>
      </footer>
    </div>
  );
}
