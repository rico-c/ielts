"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";

type ChatRole = "user" | "agent" | "system";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

type TranscriptEvent = {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: number;
  isFinal?: boolean;
  raw: unknown;
};

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown error";
}

function parseIncomingMessage(message: unknown): ChatMessage | null {
  if (!message || typeof message !== "object") return null;

  const raw = message as Record<string, unknown>;
  const roleRaw = toText(raw.source || raw.role || raw.type).toLowerCase();
  const text = toText(raw.message || raw.text || raw.transcript || raw.content).trim();
  if (!text) return null;

  let role: ChatRole = "system";
  if (roleRaw.includes("user")) role = "user";
  if (roleRaw.includes("agent") || roleRaw.includes("assistant")) role = "agent";

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
  };
}

async function getConversationToken(agentId: string): Promise<string> {
  const response = await fetch(`/api/elevenlabs/conversation-token?agent_id=${encodeURIComponent(agentId)}`, {
    method: "GET",
    cache: "no-store",
  });

  const data = (await response.json()) as { token?: string; error?: string };
  if (!response.ok || !data.token) {
    throw new Error(data.error || "Failed to get conversation token.");
  }
  return data.token;
}

type ElevenLabsVoiceAssistantProps = {
  agentId: string;
};

export default function ElevenLabsVoiceAssistant({ agentId }: ElevenLabsVoiceAssistantProps) {
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [transcriptEvents, setTranscriptEvents] = useState<TranscriptEvent[]>([]);
  const [micMuted, setMicMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState("");
  const [recordedAudioFile, setRecordedAudioFile] = useState<File | null>(null);
  const [transcriptJsonUrl, setTranscriptJsonUrl] = useState("");
  const [transcriptJsonFileName, setTranscriptJsonFileName] = useState("");

  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const transcriptEventsRef = useRef<TranscriptEvent[]>([]);
  const sessionFinalizedRef = useRef(false);

  useEffect(() => {
    transcriptEventsRef.current = transcriptEvents;
  }, [transcriptEvents]);

  const conversation = useConversation({
    micMuted,
    volume,
    onConnect: () => setError(""),
    onDisconnect: () => {
      finalizeSessionAssets();
    },
    onError: (err) => setError(getErrorMessage(err)),
    onMessage: (message) => {
      const event = buildTranscriptEvent(message);
      if (!event) return;
      setMessages((prev) => [...prev, { id: event.id, role: event.role, text: event.text }]);
      setTranscriptEvents((prev) => [...prev, event]);
    },
  });

  const statusLabel = useMemo(() => {
    if (conversation.status === "connected") return "已连接";
    if (conversation.status === "connecting") return "连接中";
    return "未连接";
  }, [conversation.status]);

  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
      if (transcriptJsonUrl) {
        URL.revokeObjectURL(transcriptJsonUrl);
      }
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [recordedAudioUrl, transcriptJsonUrl]);

  function getSupportedMimeType(): string {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ];

    for (const mimeType of candidates) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return "";
  }

  function startLocalRecording(stream: MediaStream) {
    if (typeof MediaRecorder === "undefined") {
      setError("当前浏览器不支持本地录音。");
      return;
    }

    const mimeType = getSupportedMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    audioChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      if (audioChunksRef.current.length === 0) return;

      const finalMimeType = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: finalMimeType });
      const extension = finalMimeType.includes("mp4") ? "m4a" : "webm";
      const file = new File(
        [blob],
        `ielts-speaking-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`,
        { type: finalMimeType },
      );

      setRecordedAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setRecordedAudioFile(file);
    };

    recorder.start(1000);
    recorderRef.current = recorder;
  }

  function stopLocalRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    recorderRef.current = null;

    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
  }

  function finalizeSessionAssets() {
    if (sessionFinalizedRef.current) return;
    sessionFinalizedRef.current = true;
    stopLocalRecording();
    exportTranscriptAsJson(transcriptEventsRef.current);
  }

  function buildTranscriptEvent(message: unknown): TranscriptEvent | null {
    const parsed = parseIncomingMessage(message);
    if (!parsed) return null;

    const raw = message as Record<string, unknown>;
    const finalFlag = raw.isFinal ?? raw.final ?? raw.is_final;

    return {
      ...parsed,
      timestamp: Date.now(),
      isFinal: typeof finalFlag === "boolean" ? finalFlag : undefined,
      raw: message,
    };
  }

  function exportTranscriptAsJson(events: TranscriptEvent[]) {
    if (events.length === 0) return;

    const fileName = `ielts-transcript-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const payload = {
      exportedAt: new Date().toISOString(),
      agentId,
      eventCount: events.length,
      events,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    setTranscriptJsonUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    setTranscriptJsonFileName(fileName);
  }

  async function handleStartSession() {
    if (!agentId || agentId === "agent-id") {
      setError("请先配置 NEXT_PUBLIC_ELEVENLABS_AGENT_ID。");
      return;
    }

    setError("");

    try {
      sessionFinalizedRef.current = false;
      setMessages([]);
      setTranscriptEvents([]);
      transcriptEventsRef.current = [];
      setRecordedAudioFile(null);
      setRecordedAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      setTranscriptJsonUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      setTranscriptJsonFileName("");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      startLocalRecording(stream);

      const token = await getConversationToken(agentId);
      await conversation.startSession({
        conversationToken: token,
        connectionType: "webrtc",
      });
    } catch (err) {
      stopLocalRecording();
      setError(getErrorMessage(err));
    }
  }

  async function handleEndSession() {
    setError("");
    try {
      await conversation.endSession();
      finalizeSessionAssets();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  // async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  //   event.preventDefault();
  //   const text = input.trim();
  //   if (!text) return;

  //   const timestamp = Date.now();
  //   setMessages((prev) => [...prev, { id: `local-${timestamp}`, role: "user", text }]);
  //   setTranscriptEvents((prev) => [
  //     ...prev,
  //     {
  //       id: `local-${timestamp}`,
  //       role: "user",
  //       text,
  //       timestamp,
  //       isFinal: true,
  //       raw: { source: "user", text, origin: "text-input" },
  //     },
  //   ]);
  //   setInput("");

  //   try {
  //     await conversation.sendUserMessage(text);
  //   } catch (err) {
  //     setError(getErrorMessage(err));
  //   }
  // }

  return (
    <section className="glass-panel mx-auto flex w-full max-w-none flex-col gap-4 rounded-[2rem] p-6 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">AI 口语助教</h1>
        <span className="text-sm text-slate-500">
          状态: {statusLabel}
          {conversation.isSpeaking ? " · AI讲话中" : ""}
        </span>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleStartSession}
          disabled={conversation.status !== "disconnected"}
          className="rounded-full bg-[var(--accent-deep)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-[rgba(159,77,41,0.38)]"
        >
          开始对话
        </button>
        <button
          type="button"
          onClick={handleEndSession}
          disabled={conversation.status === "disconnected"}
          className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          结束对话
        </button>
        <button
          type="button"
          onClick={() => setMicMuted((prev) => !prev)}
          disabled={conversation.status !== "connected"}
          className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {micMuted ? "取消静音" : "麦克风静音"}
        </button>
      </div>

      <label className="flex items-center gap-3 text-sm text-slate-600">
        音量
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          className="w-40"
        />
        <span>{Math.round(volume * 100)}%</span>
      </label>

      <div className="h-80 overflow-y-auto rounded-[1.5rem] border border-[var(--line)] bg-[rgba(255,250,244,0.9)] p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">开始语音会话后，这里会显示你和 AI 的对话内容。</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((message) => (
              <li key={message.id} className="text-sm">
                <span className="mr-2 inline-block rounded-full border border-[var(--line)] bg-white/80 px-2 py-0.5 text-xs uppercase text-slate-600">
                  {message.role}
                </span>
                <span className="text-slate-800">{message.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            if (conversation.status === "connected") {
              conversation.sendUserActivity();
            }
          }}
          placeholder="输入文字继续对话"
          className="flex-1 rounded-full border border-[var(--line)] bg-white/80 px-4 py-3 text-sm text-slate-800 outline-none focus:border-[var(--accent-deep)]"
        />
        <button
          type="submit"
          disabled={conversation.status !== "connected"}
          className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          发送
        </button>
      </form> */}

      {recordedAudioFile ? (
        <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/80 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-900">本地录音已保存</p>
              <p className="text-xs text-slate-500">
                {recordedAudioFile.name} · {(recordedAudioFile.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <a
              href={recordedAudioUrl}
              download={recordedAudioFile.name}
              className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              下载录音
            </a>
          </div>
          <audio controls src={recordedAudioUrl} className="w-full" />
        </div>
      ) : null}

      {transcriptEvents.length > 0 ? (
        <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/80 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-900">Transcript Events</p>
              <p className="text-xs text-slate-500">
                已保存 {transcriptEvents.length} 条事件
              </p>
            </div>
            {transcriptJsonUrl ? (
              <a
                href={transcriptJsonUrl}
                download={transcriptJsonFileName}
                className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                下载 JSON
              </a>
            ) : null}
          </div>
          <div className="max-h-48 overflow-y-auto rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
            <pre className="whitespace-pre-wrap break-words">
              {JSON.stringify(transcriptEvents.slice(-5), null, 2)}
            </pre>
          </div>
        </div>
      ) : null}

      {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
