"use client";

import { useEffect, useRef } from "react";
import type { PracticeActivityType } from "@/lib/practice-analytics";

type PracticeSessionTrackerProps = {
  activityType: PracticeActivityType;
  sourcePath: string;
  itemTitle: string;
  itemSubtitle?: string | null;
  module?: string | null;
  bookNo?: number | null;
  testNo?: number | null;
  partNo?: number | null;
  topicId?: string | null;
  topicGroup?: string | null;
  questionCount?: number;
};

function sendPracticeSession(
  payload: Record<string, unknown>,
  preferBeacon: boolean,
) {
  const body = JSON.stringify(payload);

  if (preferBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/practice-session", blob);
    return;
  }

  void fetch("/api/analytics/practice-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  }).catch(() => {});
}

export default function PracticeSessionTracker({
  activityType,
  sourcePath,
  itemTitle,
  itemSubtitle,
  module,
  bookNo,
  testNo,
  partNo,
  topicId,
  topicGroup,
  questionCount = 0,
}: PracticeSessionTrackerProps) {
  const sessionKeyRef = useRef("");
  const startedAtRef = useRef(0);
  const lastSentEndedAtRef = useRef(0);
  const latestPayloadRef = useRef<Record<string, unknown> | null>(null);

  if (!sessionKeyRef.current) {
    sessionKeyRef.current =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  if (!startedAtRef.current) {
    startedAtRef.current = Math.floor(Date.now() / 1000);
  }

  latestPayloadRef.current = {
    sessionKey: sessionKeyRef.current,
    activityType,
    sourcePath,
    itemTitle,
    itemSubtitle: itemSubtitle ?? null,
    module: module ?? null,
    bookNo: bookNo ?? null,
    testNo: testNo ?? null,
    partNo: partNo ?? null,
    topicId: topicId ?? null,
    topicGroup: topicGroup ?? null,
    questionCount,
    startedAt: startedAtRef.current,
  };

  useEffect(() => {
    function flush(preferBeacon: boolean, force = false) {
      if (!latestPayloadRef.current) {
        return;
      }

      const endedAt = Math.floor(Date.now() / 1000);
      if (!force && endedAt - startedAtRef.current < 5) {
        return;
      }

      if (endedAt <= lastSentEndedAtRef.current) {
        return;
      }

      lastSentEndedAtRef.current = endedAt;
      sendPracticeSession(
        {
          ...latestPayloadRef.current,
          endedAt,
        },
        preferBeacon,
      );
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flush(true);
      }
    }

    function handlePageHide() {
      flush(true, true);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    const intervalId = window.setInterval(() => {
      flush(false);
    }, 15000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.clearInterval(intervalId);
      flush(false, true);
    };
  }, []);

  return null;
}
