"use client";

import {
  LoaderCircle,
  Mic,
  Pause,
  Square,
  UserRound,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  SpeakingPart1MockDetail,
  SpeakingPart1Question,
} from "@/lib/speaking-db";

type Props = {
  topicId: string;
};

type LoadState = "loading" | "success" | "error";

type AnswerRecord = {
  questionId: number;
  question: string;
  examinerAudioUrl: string | null;
  audioUrl: string;
  audioFile: File;
  mimeType: string;
  createdAt: number;
};

function getSupportedMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return "";
}

function formatFileSize(size: number) {
  return `${(size / 1024).toFixed(0)} KB`;
}

function interleaveChannels(buffer: AudioBuffer) {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }

  const length = buffer.length * buffer.numberOfChannels;
  const result = new Float32Array(length);
  let writeIndex = 0;

  for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
      result[writeIndex] = buffer.getChannelData(channelIndex)[sampleIndex];
      writeIndex += 1;
    }
  }

  return result;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function audioBufferToWavBlob(buffer: AudioBuffer) {
  const channelData = interleaveChannels(buffer);
  const bytesPerSample = 2;
  const blockAlign = buffer.numberOfChannels * bytesPerSample;
  const byteRate = buffer.sampleRate * blockAlign;
  const dataSize = channelData.length * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, buffer.numberOfChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let index = 0; index < channelData.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, channelData[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

async function convertBlobToWav(sourceBlob: Blob) {
  const AudioContextConstructor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("当前浏览器不支持音频转码。");
  }

  const audioContext = new AudioContextConstructor();

  try {
    const arrayBuffer = await sourceBlob.arrayBuffer();
    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBufferToWavBlob(decodedBuffer);
  } finally {
    await audioContext.close();
  }
}

function ExaminerBubble({
  question,
  isActive,
  isPlaying,
  onReplay,
}: {
  question: SpeakingPart1Question;
  isActive: boolean;
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
            {/* {isActive ? (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                Current
              </span>
            ) : null} */}
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
          已完成本题录音，完成全部答题后可以提交评分。
        </p>
        {/* <div className="mt-3 text-xs text-blue-100/85">
          {answer.audioFile.name} · {formatFileSize(answer.audioFile.size)}
        </div> */}
        <audio controls src={answer.audioUrl} className="mt-4 w-full" />
      </div>
    </div>
  );
}

export default function SpeakingPart1MockSession({ topicId }: Props) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [detail, setDetail] = useState<SpeakingPart1MockDetail | null>(null);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(
    null,
  );
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0);
  const [isConvertingAudio, setIsConvertingAudio] = useState(false);
  const [playingQuestionId, setPlayingQuestionId] = useState<number | null>(
    null,
  );

  const recorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingQuestionRef = useRef<SpeakingPart1Question | null>(null);
  const playingAudioRef = useRef<HTMLAudioElement | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const answerUrlsRef = useRef<string[]>([]);

  const activeQuestion = useMemo(() => {
    if (!detail) return null;
    return answers.length < detail.questions.length
      ? detail.questions[answers.length]
      : null;
  }, [answers.length, detail]);

  const isCompleted = !!detail && answers.length >= detail.questions.length;
  const progressLabel = detail
    ? `${answers.length}/${detail.questions.length}`
    : "0/0";

  useEffect(() => {
    let cancelled = false;

    async function loadTopicDetail() {
      setLoadState("loading");
      setError("");

      try {
        const response = await fetch(
          `/api/speaking/mock-topic?group=part1&topicId=${encodeURIComponent(topicId)}`,
          { cache: "no-store" },
        );
        const json = (await response.json()) as {
          detail?: SpeakingPart1MockDetail;
          error?: string;
        };

        if (!response.ok || !json.detail) {
          throw new Error(json.error || "Failed to load speaking topic.");
        }

        if (cancelled) return;

        setDetail(json.detail);
        setAnswers([]);
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
    if (!activeQuestion?.audioUrl) {
      return;
    }

    const audio = new Audio(activeQuestion.audioUrl);
    playingAudioRef.current?.pause();
    playingAudioRef.current = audio;
    setPlayingQuestionId(activeQuestion.id);

    audio.onended = () => {
      if (playingAudioRef.current === audio) {
        playingAudioRef.current = null;
      }
      setPlayingQuestionId((current) =>
        current === activeQuestion.id ? null : current,
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
        current === activeQuestion.id ? null : current,
      );
    };
  }, [activeQuestion?.audioUrl, activeQuestion?.id]);

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
  }, [answers.length, activeQuestion?.id, loadState]);

  function stopMediaStream() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  function replayExaminerAudio(question: SpeakingPart1Question) {
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
    if (!activeQuestion) return;

    setError("");

    if (typeof MediaRecorder === "undefined") {
      setError("当前浏览器不支持本地录音。");
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
      recordingQuestionRef.current = activeQuestion;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const question = recordingQuestionRef.current;
        const finalMimeType = recorder.mimeType || mimeType || "audio/webm";

        setIsRecording(false);
        setRecordingStartedAt(null);
        setRecordingElapsedSeconds(0);
        stopMediaStream();
        recorderRef.current = null;

        if (!question || audioChunksRef.current.length === 0) {
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
            `part1-${question.id}-${new Date().toISOString().replace(/[:.]/g, "-")}.wav`,
            { type: "audio/wav" },
          );
          const audioUrl = URL.createObjectURL(wavBlob);
          answerUrlsRef.current.push(audioUrl);

          setAnswers((current) => [
            ...current,
            {
              questionId: question.id,
              question: question.question,
              examinerAudioUrl: question.audioUrl,
              audioUrl,
              audioFile: file,
              mimeType: "audio/wav",
              createdAt: Date.now(),
            },
          ]);
        } catch (conversionError) {
          setError(
            conversionError instanceof Error
              ? conversionError.message
              : "录音转 WAV 失败。",
          );
        } finally {
          setIsConvertingAudio(false);
          audioChunksRef.current = [];
          recordingQuestionRef.current = null;
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

  function handleSubmitForAiReview() {
    setError("");
    console.log("Speaking mock submission draft", submissionDraft);
  }

  const submissionDraft = useMemo(() => {
    if (!detail) return null;

    return {
      group: "part1" as const,
      topicId: detail.topicId,
      topic: detail.topic,
      turns: detail.questions.map((question, index) => ({
        questionId: question.id,
        question: question.question,
        examinerAudioUrl: question.audioUrl,
        userAudioFile: answers[index]?.audioFile ?? null,
      })),
    };
  }, [answers, detail]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {loadState === "loading" ? (
        <section className="flex flex-1 items-center justify-center rounded-[1.75rem] border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
          <div className="flex items-center justify-center gap-2">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            正在加载 Part 1 题目...
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
              {detail.questions.map((question, index) => {
                if (index > answers.length) {
                  return null;
                }

                const answer = answers[index];

                return (
                  <div key={question.id} className="space-y-4">
                    <ExaminerBubble
                      question={question}
                      isActive={activeQuestion?.id === question.id}
                      isPlaying={playingQuestionId === question.id}
                      onReplay={() => replayExaminerAudio(question)}
                    />
                    {answer ? <UserBubble answer={answer} /> : null}
                  </div>
                );
              })}

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
                  Part 1
                  已完成。当前所有考官题目和用户录音都已经保存在前端状态里，后续可以直接打包提交评分。
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
            <div className="flex justify-center">
              {!isCompleted ? (
                isRecording ? (
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    aria-label="结束录音"
                    disabled={isConvertingAudio}
                    className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-200 transition-colors hover:bg-rose-700"
                  >
                    <Square className="h-8 w-8" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    aria-label="开始录音"
                    disabled={isConvertingAudio}
                    className="inline-flex h-24 w-24 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                  >
                    <Mic className="h-8 w-8" />
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitForAiReview}
                  disabled={isConvertingAudio}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                >
                  提交AI评分
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
