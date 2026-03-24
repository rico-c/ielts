"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import IeltsTestSelector, {
  BOOK_NUMBERS,
  TEST_NUMBERS,
} from "@/components/IeltsTestSelector";
import ListeningAudioPlayer, {
  type ListeningAudioPlayerHandle,
} from "@/components/ListeningAudioPlayer";
import type {
  ListeningPracticePaper,
  ListeningTranscriptSentence,
} from "@/lib/ielts-db";

type PracticeState = "idle" | "loading" | "success" | "error";

type IntensiveSentence = ListeningTranscriptSentence & {
  id: string;
  paragraphIndex: number;
  sentenceIndex: number;
  displayIndex: number;
};

function parseBookNo(value: string | null) {
  const parsed = Number(value);
  return BOOK_NUMBERS.includes(parsed) ? parsed : 20;
}

function parseTestNo(value: string | null) {
  const parsed = Number(value);
  return TEST_NUMBERS.includes(parsed as (typeof TEST_NUMBERS)[number])
    ? parsed
    : 1;
}

function parsePartNo(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 4 ? parsed : 1;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";

  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getActiveSentenceIndex(
  sentences: IntensiveSentence[],
  currentTime: number,
) {
  if (sentences.length === 0) return -1;

  for (let index = sentences.length - 1; index >= 0; index -= 1) {
    if (currentTime >= sentences[index].start) {
      return index;
    }
  }

  return -1;
}

function IntensiveListeningContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const audioRef = useRef<ListeningAudioPlayerHandle | null>(null);
  const sentenceListContainerRef = useRef<HTMLDivElement | null>(null);
  const sentenceRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [activeBookNo, setActiveBookNo] = useState(() =>
    parseBookNo(searchParams.get("book")),
  );
  const [activeTestNo, setActiveTestNo] = useState(() =>
    parseTestNo(searchParams.get("test")),
  );
  const [activePartNo, setActivePartNo] = useState(() =>
    parsePartNo(searchParams.get("part")),
  );
  const [practiceState, setPracticeState] = useState<PracticeState>("idle");
  const [practicePaper, setPracticePaper] =
    useState<ListeningPracticePaper | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showOriginal, setShowOriginal] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);

  const practiceApiUrl = useMemo(() => {
    const params = new URLSearchParams({
      series: "Cambridge IELTS",
      bookNo: String(activeBookNo),
      module: "listening",
      testNo: String(activeTestNo),
    });

    return `/api/ielts/tests/detail?${params.toString()}`;
  }, [activeBookNo, activeTestNo]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("book", String(activeBookNo));
    params.set("test", String(activeTestNo));
    params.set("part", String(activePartNo));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeBookNo, activePartNo, activeTestNo, pathname, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadPracticePaper() {
      setPracticeState("loading");

      try {
        const response = await fetch(practiceApiUrl, { cache: "no-store" });
        const json = (await response.json()) as {
          paper?: ListeningPracticePaper;
          error?: string;
        };

        if (!response.ok || !json.paper) {
          throw new Error(json.error || "Failed to load practice paper.");
        }

        if (cancelled) return;

        setPracticePaper(json.paper);
        setPracticeState("success");
      } catch {
        if (cancelled) return;
        setPracticePaper(null);
        setPracticeState("error");
      }
    }

    loadPracticePaper();

    return () => {
      cancelled = true;
    };
  }, [practiceApiUrl]);

  useEffect(() => {
    const availablePartNos =
      practicePaper?.parts.map((part) => part.partNo) ?? [];
    if (availablePartNos.length === 0) return;

    setActivePartNo((current) =>
      availablePartNos.includes(current) ? current : availablePartNos[0],
    );
  }, [practicePaper]);

  const activePart = useMemo(() => {
    if (!practicePaper) return null;

    return (
      practicePaper.parts.find((part) => part.partNo === activePartNo) ??
      practicePaper.parts[0] ??
      null
    );
  }, [activePartNo, practicePaper]);

  useEffect(() => {
    setCurrentTime(0);
    sentenceRefs.current = [];
  }, [activePart?.id]);

  const sentences = useMemo(() => {
    if (!activePart) return [];

    const flattened = activePart.transcriptDetail.flatMap(
      (paragraph, paragraphIndex) =>
        paragraph.sentences.map((sentence, sentenceIndex) => ({
          ...sentence,
          id: `${paragraphIndex}-${sentenceIndex}-${sentence.start}`,
          paragraphIndex,
          sentenceIndex,
          displayIndex: 0,
        })),
    );

    return flattened.map((sentence, index) => ({
      ...sentence,
      displayIndex: index + 1,
    })) as IntensiveSentence[];
  }, [activePart]);

  const activeSentenceIndex = useMemo(
    () => getActiveSentenceIndex(sentences, currentTime),
    [currentTime, sentences],
  );

  useEffect(() => {
    if (activeSentenceIndex < 0) return;

    const container = sentenceListContainerRef.current;
    const activeElement = sentenceRefs.current[activeSentenceIndex];
    if (!container || !activeElement) return;

    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;
    const elementTop = activeElement.offsetTop;
    const elementBottom = elementTop + activeElement.offsetHeight;
    const padding = -60;

    if (elementTop < containerTop + padding) {
      container.scrollTo({
        top: Math.max(0, elementTop - padding),
        behavior: "smooth",
      });
      return;
    }

    if (elementBottom > containerBottom - padding) {
      container.scrollTo({
        top: elementBottom - container.clientHeight + padding,
        behavior: "smooth",
      });
    }
  }, [activeSentenceIndex]);

  async function jumpToSentence(index: number) {
    const nextSentence = sentences[index];
    if (!nextSentence) return;

    audioRef.current?.seekTo(nextSentence.start);
    setCurrentTime(nextSentence.start);

    try {
      await audioRef.current?.play();
    } catch {
      // Ignore autoplay interruptions and keep the manual seek.
    }
  }

  function goToPreviousSentence() {
    if (sentences.length === 0) return;
    const targetIndex = activeSentenceIndex > 0 ? activeSentenceIndex - 1 : 0;
    void jumpToSentence(targetIndex);
  }

  function goToNextSentence() {
    if (sentences.length === 0) return;

    const targetIndex =
      activeSentenceIndex >= 0
        ? Math.min(activeSentenceIndex + 1, sentences.length - 1)
        : 0;

    void jumpToSentence(targetIndex);
  }

  const summaryLabel = `IELTS${activeBookNo} · Test ${activeTestNo} · Part ${activePartNo}`;
  const hasSentences = sentences.length > 0;

  return (
    <section className="space-y-4">
      <IeltsTestSelector
        activeBookNo={activeBookNo}
        activePartNo={activePartNo}
        activeTestNo={activeTestNo}
        onBookChange={(bookNo) => {
          setActiveBookNo(bookNo);
          setActiveTestNo(1);
          setActivePartNo(1);
        }}
        onPartChange={setActivePartNo}
        onTestChange={(testNo) => {
          setActiveTestNo(testNo);
          setActivePartNo(1);
        }}
        partNos={[1, 2, 3, 4]}
        summaryLabel={summaryLabel}
      />

      {practiceState === "loading" ? (
        <div className="rounded-[2rem] border border-[var(--line)] bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
          <div className="flex items-center justify-center gap-2">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            <span>正在加载精听材料...</span>
          </div>
        </div>
      ) : null}

      {practiceState === "error" ? (
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm text-rose-700 shadow-sm">
          精听材料加载失败，请稍后重试。
        </div>
      ) : null}

      {practiceState === "success" && activePart ? (
        <div className="space-y-4">
          <section className="rounded-[2rem] border border-[var(--line)] bg-white p-4 shadow-sm sm:p-6">
            {activePart.audioUrl ? (
              <ListeningAudioPlayer
                ref={audioRef}
                src={activePart.audioUrl}
                title={activePart.title}
                transcript={activePart.transcript}
                showTranscriptToggle={false}
                onTimeUpdate={setCurrentTime}
              />
            ) : (
              <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                当前 Part 暂无音频。
              </div>
            )}
            <div className="flex flex-wrap items-start justify-between gap-4 mt-4">
              <div className="flex flex-wrap gap-5">
                <button
                  type="button"
                  onClick={() => setShowOriginal((current) => !current)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    showOriginal
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-900 bg-white text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {showOriginal ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  原文
                </button>
                <button
                  type="button"
                  onClick={() => setShowTranslation((current) => !current)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    showTranslation
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-900 bg-white text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {showTranslation ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  译文
                </button>
                <button
                  type="button"
                  onClick={goToPreviousSentence}
                  disabled={!hasSentences}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SkipBack className="h-4 w-4" />
                  上一句
                </button>
                <button
                  type="button"
                  onClick={goToNextSentence}
                  disabled={!hasSentences}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  下一句
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[var(--line)] bg-white p-4 shadow-sm sm:p-6">
            {hasSentences ? (
              <div
                ref={sentenceListContainerRef}
                className="max-h-[52vh] space-y-3 overflow-y-auto pr-1 sm:max-h-[60vh]"
              >
                {sentences.map((sentence, index) => {
                  const isActive = index === activeSentenceIndex;

                  return (
                    <button
                      key={sentence.id}
                      ref={(node) => {
                        sentenceRefs.current[index] = node;
                      }}
                      type="button"
                      onClick={() => {
                        void jumpToSentence(index);
                      }}
                      className={`block w-full rounded-[1.4rem] border px-4 py-4 text-left transition-all sm:px-5 ${
                        isActive
                          ? "border-sky-300 bg-sky-50 shadow-[0_12px_30px_rgba(14,165,233,0.12)]"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                        {/* <span>句子 {sentence.displayIndex}</span> */}
                        <span>{formatTime(sentence.start)}</span>
                        {/* <span>-</span> */}
                        {/* <span>{formatTime(sentence.end)}</span> */}
                      </div>

                      {showOriginal ? (
                        <div className="text-base font-medium leading-7 text-slate-900 sm:text-lg">
                          {sentence.text}
                        </div>
                      ) : null}

                      {showTranslation ? (
                        <div
                          className={`${showOriginal ? "mt-2" : ""} text-sm leading-7 text-slate-600 sm:text-base`}
                        >
                          {sentence.cn || "暂无译文"}
                        </div>
                      ) : null}

                      {!showOriginal && !showTranslation ? (
                        <div className="text-sm text-slate-500">
                          已隐藏原文和译文，点击上方按钮恢复显示。
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                当前 Part 还没有可用的逐句 transcript_detail 数据。
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default function IntensiveListeningPage() {
  return (
    <Suspense
      fallback={
        <section className="space-y-6">
          <div className="rounded-[2rem] border border-[var(--line)] bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
            正在加载精听页面...
          </div>
        </section>
      }
    >
      <IntensiveListeningContent />
    </Suspense>
  );
}
