"use client";

import { FormEvent, useMemo, useState } from "react";
import { useConversation } from "@elevenlabs/react";

type ChatRole = "user" | "agent" | "system";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
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
  const [micMuted, setMicMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  const conversation = useConversation({
    micMuted,
    volume,
    onConnect: () => setError(""),
    onError: (err) => setError(getErrorMessage(err)),
    onMessage: (message) => {
      const parsed = parseIncomingMessage(message);
      if (!parsed) return;
      setMessages((prev) => [...prev, parsed]);
    },
  });

  const statusLabel = useMemo(() => {
    if (conversation.status === "connected") return "已连接";
    if (conversation.status === "connecting") return "连接中";
    return "未连接";
  }, [conversation.status]);

  async function handleStartSession() {
    if (!agentId || agentId === "agent-id") {
      setError("请先配置 NEXT_PUBLIC_ELEVENLABS_AGENT_ID。");
      return;
    }

    setError("");

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const token = await getConversationToken(agentId);
      await conversation.startSession({
        conversationToken: token,
        connectionType: "webrtc",
      });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleEndSession() {
    setError("");
    try {
      await conversation.endSession();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "user", text }]);
    setInput("");

    try {
      await conversation.sendUserMessage(text);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-black">AI 口语助教</h1>
        <span className="text-sm text-black/60">
          状态: {statusLabel}
          {conversation.isSpeaking ? " · AI讲话中" : ""}
        </span>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleStartSession}
          disabled={conversation.status !== "disconnected"}
          className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-black/40"
        >
          开始对话
        </button>
        <button
          type="button"
          onClick={handleEndSession}
          disabled={conversation.status === "disconnected"}
          className="rounded-lg border border-black/20 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:text-black/40"
        >
          结束对话
        </button>
        <button
          type="button"
          onClick={() => setMicMuted((prev) => !prev)}
          disabled={conversation.status !== "connected"}
          className="rounded-lg border border-black/20 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:text-black/40"
        >
          {micMuted ? "取消静音" : "麦克风静音"}
        </button>
      </div>

      <label className="flex items-center gap-3 text-sm text-black/70">
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

      <div className="h-80 overflow-y-auto rounded-xl border border-black/10 bg-[#faf8f4] p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-black/50">开始语音会话后，这里会显示你和 AI 的对话内容。</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((message) => (
              <li key={message.id} className="text-sm">
                <span className="mr-2 inline-block rounded-full border border-black/20 px-2 py-0.5 text-xs uppercase">
                  {message.role}
                </span>
                <span>{message.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            if (conversation.status === "connected") {
              conversation.sendUserActivity();
            }
          }}
          placeholder="输入文字继续对话"
          className="flex-1 rounded-lg border border-black/20 px-3 py-2 text-sm outline-none focus:border-black/60"
        />
        <button
          type="submit"
          disabled={conversation.status !== "connected"}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-black/40"
        >
          发送
        </button>
      </form>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
