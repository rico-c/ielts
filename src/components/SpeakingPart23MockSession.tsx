"use client";

import {
  Crown,
  LoaderCircle,
  Mic,
  Pause,
  Square,
  UserRound,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  SpeakingPart23MockDetail,
  SpeakingPart3Question,
} from "@/lib/speaking-db";
import {
  convertBlobToWav,
  getSupportedMimeType,
} from "@/lib/speaking-mock-audio";
import { useMembership } from "@/hooks/useMembership";
import { openDashboardPricingModal } from "@/lib/pricing-modal";
import {
  createSpeakingMockSubmitFormData,
  type SpeakingMockSubmissionPayload,
  type SpeakingMockSubmitResponse,
} from "@/lib/speaking-mock-review";
import PracticeSessionTracker from "@/components/PracticeSessionTracker";

type Props = {
  topicId: string;
};

type LoadState = "loading" | "success" | "error";

type AnswerRecord = {
  phase: "part2" | "part3";
  questionId: number;
  question: string;
  examinerAudioUrl: string | null;
  audioUrl: string;
  audioFile: File;
  mimeType: string;
  createdAt: number;
};

type RecordingTarget = {
  phase: "part2" | "part3";
  id: number;
  question: string;
  audioUrl: string | null;
};

function Part2CueCardBubble({
  question,
  requirements,
}: {
  question: string;
  requirements: string[];
}) {
  return (
    <div className="flex justify-start">
      <div className="flex max-w-4xl items-end gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2563eb,#1d4ed8)] text-sm font-bold text-white shadow-sm">
          雅
        </div>

        <div className="max-w-3xl rounded-[1.5rem] rounded-bl-md border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            <Volume2 className="h-4 w-4" />
            雅思考官
          </div>
          <div className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
            Part 2 Cue Card
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-800">{question}</p>

          {requirements.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
              <div className="text-sm font-semibold text-slate-900">
                Requirement
              </div>
              <div className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                {requirements.map((item, index) => (
                  <div
                    key={`cue-card-requirement-${index + 1}`}
                    className="rounded-xl bg-white/80 px-3 py-2"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Part3ExaminerBubble({
  question,
  isPlaying,
  onReplay,
}: {
  question: SpeakingPart3Question;
  isPlaying: boolean;
  onReplay: () => void;
}) {
  return (
    <div className="flex justify-start">
      <div className="flex max-w-4xl items-end gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2563eb,#1d4ed8)] text-sm font-bold text-white shadow-sm">
          雅
        </div>

        <div className="max-w-3xl rounded-[1.5rem] rounded-bl-md border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            <Volume2 className="h-4 w-4" />
            雅思考官
          </div>
          <div className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            Part 3
          </div>
          <div className="mt-3 flex items-center gap-3">
            <p className="min-w-0 flex-1 text-sm leading-7 text-slate-800">
              {question.question}
            </p>
            <button
              type="button"
              onClick={onReplay}
              disabled={!question.audioUrl}
              aria-label={isPlaying ? "暂停考官音频" : "播放考官音频"}
              className={`mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
                question.audioUrl
                  ? "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100"
                  : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300"
              }`}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
          </div>
          {!question.audioUrl ? (
            <span className="mt-3 block text-xs text-slate-400">
              当前题目暂无音频
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function UserBubble({ answer }: { answer: AnswerRecord }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-3xl rounded-[1.5rem] rounded-br-md border border-blue-200 bg-blue-600 px-5 py-4 text-white shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
          <UserRound className="h-4 w-4" />
          考生
        </div>
        <p className="mt-3 text-sm leading-7 text-blue-50">
          {answer.phase === "part2"
            ? "已完成 Cue Card 回答，接下来进入 Part 3 追问。"
            : "已完成本题录音，系统会继续进入下一道 Part 3 问题。"}
        </p>
        <audio controls src={answer.audioUrl} className="mt-4 w-full" />
      </div>
    </div>
  );
}

function TransitionBubble() {
  return (
    <div className="flex justify-start">
      <div className="max-w-3xl rounded-[1.5rem] border border-blue-100 bg-blue-50 px-5 py-4 text-sm leading-7 text-blue-900 shadow-sm">
        Cue Card 已结束，下面开始 Part 3 追问。
      </div>
    </div>
  );
}

export default function SpeakingPart23MockSession({ topicId }: Props) {
  const router = useRouter();
  const { isVip, loading: membershipLoading } = useMembership();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [detail, setDetail] = useState<SpeakingPart23MockDetail | null>(null);
  const [error, setError] = useState("");
  const [part2Answer, setPart2Answer] = useState<AnswerRecord | null>(null);
  const [part3Answers, setPart3Answers] = useState<AnswerRecord[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(
    null,
  );
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0);
  const [isConvertingAudio, setIsConvertingAudio] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [playingQuestionId, setPlayingQuestionId] = useState<number | null>(
    null,
  );

  const recorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingTargetRef = useRef<RecordingTarget | null>(null);
  const playingAudioRef = useRef<HTMLAudioElement | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const answerUrlsRef = useRef<string[]>([]);

  const activePart3Question = useMemo(() => {
    if (!detail || !part2Answer) return null;
    return part3Answers.length < detail.part3Questions.length
      ? detail.part3Questions[part3Answers.length]
      : null;
  }, [detail, part2Answer, part3Answers.length]);

  const isCompleted =
    !!detail &&
    !!part2Answer &&
    part3Answers.length >= detail.part3Questions.length;

  useEffect(() => {
    let cancelled = false;

    async function loadTopicDetail() {
      setLoadState("loading");
      setError("");

      try {
        const response = await fetch(
          `/api/speaking/mock-topic?group=part23&topicId=${encodeURIComponent(topicId)}`,
          { cache: "no-store" },
        );
        const json = (await response.json()) as {
          detail?: SpeakingPart23MockDetail;
          error?: string;
        };

        if (!response.ok || !json.detail) {
          throw new Error(json.error || "Failed to load speaking topic.");
        }

        if (cancelled) return;

        setDetail(json.detail);
        setPart2Answer(null);
        setPart3Answers([]);
        setLoadState("success");
      } catch (loadError) {
        if (cancelled) return;
        setLoadState("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load speaking topic.",
        );
      }
    }

    loadTopicDetail();

    return () => {
      cancelled = true;
    };
  }, [topicId]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      playingAudioRef.current?.pause();
      setPlayingQuestionId(null);
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      for (const url of answerUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  useEffect(() => {
    if (!activePart3Question?.audioUrl) {
      return;
    }

    const audio = new Audio(activePart3Question.audioUrl);
    playingAudioRef.current?.pause();
    playingAudioRef.current = audio;
    setPlayingQuestionId(activePart3Question.id);

    audio.onended = () => {
      if (playingAudioRef.current === audio) {
        playingAudioRef.current = null;
      }
      setPlayingQuestionId((current) =>
        current === activePart3Question.id ? null : current,
      );
    };

    audio.play().catch(() => {
      setPlayingQuestionId(null);
      setError("");
    });

    return () => {
      audio.pause();
      audio.onended = null;
      if (playingAudioRef.current === audio) {
        playingAudioRef.current = null;
      }
      setPlayingQuestionId((current) =>
        current === activePart3Question.id ? null : current,
      );
    };
  }, [activePart3Question?.audioUrl, activePart3Question?.id]);

  useEffect(() => {
    if (!isRecording || !recordingStartedAt) {
      setRecordingElapsedSeconds(0);
      return;
    }

    setRecordingElapsedSeconds(
      Math.max(1, Math.floor((Date.now() - recordingStartedAt) / 1000)),
    );

    const intervalId = window.setInterval(() => {
      setRecordingElapsedSeconds(
        Math.max(1, Math.floor((Date.now() - recordingStartedAt) / 1000)),
      );
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRecording, recordingStartedAt]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [loadState, part2Answer?.questionId, part3Answers.length, activePart3Question?.id]);

  function stopMediaStream() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  function replayExaminerAudio(question: SpeakingPart3Question) {
    if (!question.audioUrl) return;

    if (playingAudioRef.current && playingQuestionId === question.id) {
      playingAudioRef.current.pause();
      playingAudioRef.current = null;
      setPlayingQuestionId(null);
      return;
    }

    setError("");
    const audio = new Audio(question.audioUrl);
    playingAudioRef.current?.pause();
    playingAudioRef.current = audio;
    setPlayingQuestionId(question.id);
    audio.onended = () => {
      if (playingAudioRef.current === audio) {
        playingAudioRef.current = null;
      }
      setPlayingQuestionId((current) =>
        current === question.id ? null : current,
      );
    };
    audio.play().catch((playError) => {
      setPlayingQuestionId(null);
      setError(
        playError instanceof Error ? playError.message : "考官音频播放失败。",
      );
    });
  }

  async function handleStartRecording() {
    if (!detail) return;

    setError("");

    if (typeof MediaRecorder === "undefined") {
      setError("当前浏览器不支持本地录音。");
      return;
    }

    const recordingTarget: RecordingTarget | null = !part2Answer
      ? {
          phase: "part2",
          id: detail.part2Prompt.id,
          question: detail.part2Prompt.question,
          audioUrl: null,
        }
      : activePart3Question
        ? {
            phase: "part3",
            id: activePart3Question.id,
            question: activePart3Question.question,
            audioUrl: activePart3Question.audioUrl,
          }
        : null;

    if (!recordingTarget) {
      return;
    }

    try {
      playingAudioRef.current?.pause();
      playingAudioRef.current = null;
      setPlayingQuestionId(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      recordingTargetRef.current = recordingTarget;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const target = recordingTargetRef.current;
        const finalMimeType = recorder.mimeType || mimeType || "audio/webm";

        setIsRecording(false);
        setRecordingStartedAt(null);
        setRecordingElapsedSeconds(0);
        stopMediaStream();
        recorderRef.current = null;

        if (!target || audioChunksRef.current.length === 0) {
          audioChunksRef.current = [];
          return;
        }

        try {
          setIsConvertingAudio(true);
          const sourceBlob = new Blob(audioChunksRef.current, {
            type: finalMimeType,
          });
          const wavBlob = await convertBlobToWav(sourceBlob);
          const file = new File(
            [wavBlob],
            `${target.phase}-${target.id}-${new Date().toISOString().replace(/[:.]/g, "-")}.wav`,
            { type: "audio/wav" },
          );
          const audioUrl = URL.createObjectURL(wavBlob);
          const answerRecord: AnswerRecord = {
            phase: target.phase,
            questionId: target.id,
            question: target.question,
            examinerAudioUrl: target.audioUrl,
            audioUrl,
            audioFile: file,
            mimeType: "audio/wav",
            createdAt: Date.now(),
          };

          answerUrlsRef.current.push(audioUrl);

          if (target.phase === "part2") {
            setPart2Answer(answerRecord);
          } else {
            setPart3Answers((current) => [...current, answerRecord]);
          }
        } catch (conversionError) {
          setError(
            conversionError instanceof Error
              ? conversionError.message
              : "录音转 WAV 失败。",
          );
        } finally {
          setIsConvertingAudio(false);
          audioChunksRef.current = [];
          recordingTargetRef.current = null;
        }
      };

      recorder.start(250);
      recorderRef.current = recorder;
      setIsRecording(true);
      setRecordingStartedAt(Date.now());
    } catch (recordError) {
      stopMediaStream();
      setError(
        recordError instanceof Error ? recordError.message : "录音启动失败。",
      );
    }
  }

  function handleStopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
  }

  async function handleSubmitForAiReview() {
    if (!isVip) {
      openDashboardPricingModal();
      return;
    }

    if (!submissionDraft) {
      setError("当前没有可提交的模考数据。");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/speaking/mock-session", {
        method: "POST",
        body: createSpeakingMockSubmitFormData(submissionDraft),
      });

      const json = (await response.json()) as
        | SpeakingMockSubmitResponse
        | { error?: string };

      if (!response.ok || !("sessionUuid" in json)) {
        throw new Error(
          "error" in json && typeof json.error === "string"
            ? json.error
            : "提交 AI 评分失败。",
        );
      }

      router.push(
        `/dashboard/mock-exam/records?session=${encodeURIComponent(json.sessionUuid)}`,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "提交 AI 评分失败。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const submissionDraft = useMemo<SpeakingMockSubmissionPayload | null>(() => {
    if (!detail) return null;

    return {
      group: "part23",
      topicId: detail.topicId,
      topic: detail.topic,
      turns: [
        {
          phase: "part2",
          questionId: detail.part2Prompt.id,
          question: detail.part2Prompt.question,
          requirements: detail.part2Prompt.requirements,
          examinerAudioUrl: null,
          userAudioFile: part2Answer?.audioFile ?? null,
        },
        ...detail.part3Questions.map((question, index) => ({
          phase: "part3" as const,
          questionId: question.id,
          question: question.question,
          requirements: [],
          examinerAudioUrl: question.audioUrl,
          userAudioFile: part3Answers[index]?.audioFile ?? null,
        })),
      ],
    };
  }, [detail, part2Answer, part3Answers]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {loadState === "success" && detail ? (
        <PracticeSessionTracker
          key={`part23-${detail.topicId}`}
          activityType="speaking_mock"
          sourcePath={`/dashboard/mock-exam/session?group=part23&topicId=${encodeURIComponent(detail.topicId)}`}
          itemTitle={`口语模拟 · Part 2 & Part 3 · ${detail.topic}`}
          itemSubtitle="口语模考"
          module="speaking"
          topicId={detail.topicId}
          topicGroup="part23"
          questionCount={1 + detail.part3Questions.length}
        />
      ) : null}

      {loadState === "loading" ? (
        <section className="flex flex-1 items-center justify-center rounded-[1.75rem] border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
          <div className="flex items-center justify-center gap-2">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            正在加载 Part 2 / Part 3 题目...
          </div>
        </section>
      ) : null}

      {loadState === "error" ? (
        <section className="flex flex-1 items-center justify-center rounded-[1.75rem] border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm text-rose-700 shadow-sm">
          {error || "题目加载失败，请稍后重试。"}
        </section>
      ) : null}

      {loadState === "success" && detail ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <section className="min-h-0 flex-1 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
            <div className="h-full space-y-4 overflow-y-auto bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] px-4 py-5 sm:px-6">
              <Part2CueCardBubble
                question={detail.part2Prompt.question}
                requirements={detail.part2Prompt.requirements}
              />

              {part2Answer ? <UserBubble answer={part2Answer} /> : null}

              {part2Answer ? <TransitionBubble /> : null}

              {part2Answer
                ? detail.part3Questions.map((question, index) => {
                    if (index > part3Answers.length) {
                      return null;
                    }

                    const answer = part3Answers[index];

                    return (
                      <div key={question.id} className="space-y-4">
                        <Part3ExaminerBubble
                          question={question}
                          isPlaying={playingQuestionId === question.id}
                          onReplay={() => replayExaminerAudio(question)}
                        />
                        {answer ? <UserBubble answer={answer} /> : null}
                      </div>
                    );
                  })
                : null}

              {isRecording && recordingStartedAt ? (
                <div className="flex justify-end">
                  <div className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">
                    正在录音 · {recordingElapsedSeconds}s
                  </div>
                </div>
              ) : null}

              {isConvertingAudio ? (
                <div className="flex justify-end">
                  <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm">
                    正在转换 WAV...
                  </div>
                </div>
              ) : null}

              {isCompleted ? (
                <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-7 text-emerald-800">
                  Part 2 &amp; Part 3 已完成。当前所有考官题目和用户录音都已经保存在前端状态里，后续可以直接打包提交评分。
                </div>
              ) : null}

              <div ref={scrollAnchorRef} />
            </div>
          </section>

          {error ? (
            <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              {error}
            </section>
          ) : null}

          <div className="shrink-0 bg-white/95 px-4 py-4 backdrop-blur">
            <div className="mb-4 text-center text-sm text-slate-500">
              {!part2Answer
                ? "先完成 Part 2 Cue Card 录音，随后自动进入 Part 3。"
                : isCompleted
                  ? "本场 Part 2 / Part 3 已全部完成。"
                  : "当前正在进行 Part 3。"}
            </div>

            <div className="flex justify-center">
              {!isCompleted ? (
                isRecording ? (
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    aria-label="结束录音"
                    disabled={isConvertingAudio || isSubmitting}
                    className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-200 transition-colors hover:bg-rose-700"
                  >
                    <Square className="h-8 w-8" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    aria-label="开始录音"
                    disabled={isConvertingAudio || isSubmitting}
                    className="inline-flex h-24 w-24 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                  >
                    <Mic className="h-8 w-8" />
                  </button>
                )
              ) : (
                isVip ? (
                  <button
                    type="button"
                    onClick={handleSubmitForAiReview}
                    disabled={isConvertingAudio || isSubmitting || membershipLoading}
                    className="cursor-pointer inline-flex items-center justify-center rounded-full bg-slate-900 px-8 py-6 text-sm font-semibold text-white shadow-lg shadow-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                  >
                    {membershipLoading
                      ? "读取会员状态..."
                      : isSubmitting
                        ? "正在评分中"
                        : "提交AI评分"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitForAiReview}
                    disabled={membershipLoading}
                    className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-8 py-6 text-sm font-semibold text-amber-800 shadow-lg shadow-amber-100 transition-colors hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <Crown className="h-4 w-4" />
                    {membershipLoading ? "读取会员状态..." : "PRO专属AI评分"}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
