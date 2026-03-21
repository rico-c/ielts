"use client";

import {
  ChevronDown,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const SEEK_SECONDS = 5;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";

  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function ListeningAudioPlayer({
  src,
  title,
  transcript,
}: {
  src: string;
  title?: string;
  transcript?: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speedGroupId = useId();
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(true);
  const [isTranscriptVisible, setIsTranscriptVisible] = useState(false);
  const hasTranscript = typeof transcript === "string" && transcript.trim().length > 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setIsAudioLoading(true);
    setIsTranscriptVisible(false);
  }, [src]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      await audio.play();
      return;
    }

    audio.pause();
  }

  function seekTo(nextTime: number) {
    const audio = audioRef.current;
    if (!audio) return;

    const safeTime = Math.max(0, Math.min(nextTime, audio.duration || Infinity));
    audio.currentTime = safeTime;
    setCurrentTime(safeTime);
  }

  function seekBy(deltaSeconds: number) {
    const audio = audioRef.current;
    if (!audio) return;

    seekTo(audio.currentTime + deltaSeconds);
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-5">
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadStart={() => setIsAudioLoading(true)}
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
          setIsAudioLoading(false);
        }}
        onCanPlay={() => setIsAudioLoading(false)}
        onTimeUpdate={(event) => {
          setCurrentTime(event.currentTarget.currentTime);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsAudioLoading(false)}
      >
        <source src={src} />
      </audio>

      <div className="rounded-[1.2rem] border border-[rgba(148,163,184,0.2)] bg-[rgba(255,255,255,0.92)] px-8 py-8 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
        {/* <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold text-slate-900">{title || "Listening Audio"}</p>
          <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            {playbackRate}x
          </div>
        </div> */}

        <div className="mt-0 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              void togglePlayback();
            }}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white transition-transform hover:scale-[1.02]"
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
          >
            {isAudioLoading ? (
              <LoaderCircle
                className="h-[18px] w-[18px] animate-spin"
                strokeWidth={2.4}
              />
            ) : isPlaying ? (
              <Pause className="h-[18px] w-[18px]" strokeWidth={2.4} />
            ) : (
              <Play className="ml-0.5 h-[18px] w-[18px]" strokeWidth={2.4} />
            )}
          </button>

          <button
            type="button"
            onClick={() => seekBy(-SEEK_SECONDS)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
          >
            <RotateCcw className="h-[14px] w-[14px]" strokeWidth={2.2} />
            -5s
          </button>

          <button
            type="button"
            onClick={() => seekBy(SEEK_SECONDS)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
          >
            <RotateCw className="h-[14px] w-[14px]" strokeWidth={2.2} />
            +5s
          </button>

          {hasTranscript ? (
            <button
              type="button"
              onClick={() => setIsTranscriptVisible((current) => !current)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              原文
            </button>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <label htmlFor={speedGroupId} className="text-xs font-medium text-slate-500">
              倍速
            </label>
            <div className="relative">
              <select
                id={speedGroupId}
                value={playbackRate}
                onChange={(event) => setPlaybackRate(Number(event.target.value))}
                className="min-w-[88px] appearance-none rounded-full border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 shadow-[0_4px_12px_rgba(15,23,42,0.05)] outline-none transition-colors focus:border-slate-400"
              >
                {PLAYBACK_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}x
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                strokeWidth={2.3}
              />
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="relative">
            <div className="h-1.5 rounded-full bg-slate-200" />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#2563eb,#38bdf8)]"
              style={{ width: `${progress}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => seekTo(Number(event.target.value))}
              className="absolute inset-0 h-1.5 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-2px] [&::-webkit-slider-thumb]:h-[10px] [&::-webkit-slider-thumb]:w-[10px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-slate-900"
              aria-label="Audio progress"
            />
          </div>
        </div>
      </div>

      {hasTranscript && isTranscriptVisible ? (
        <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="mb-2 text-sm font-semibold text-slate-900">
            听力原文
          </div>
          <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {transcript}
          </div>
        </div>
      ) : null}
    </div>
  );
}
