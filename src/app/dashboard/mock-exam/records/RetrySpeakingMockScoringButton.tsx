"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  sessionUuid: string;
};

export default function RetrySpeakingMockScoringButton({ sessionUuid }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleRetry() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/speaking/mock-session/retry", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ sessionUuid }),
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "重新评分失败，请稍后再试。");
      }

      router.refresh();
    } catch (retryError) {
      setError(
        retryError instanceof Error ? retryError.message : "重新评分失败，请稍后再试。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => {
          void handleRetry();
        }}
        disabled={isSubmitting}
        className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "正在重新评分..." : "重新评分"}
      </button>

      {error ? <div className="mt-2 text-sm text-rose-600">{error}</div> : null}
    </div>
  );
}
