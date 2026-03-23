"use client";

import dynamic from "next/dynamic";

const ChatwayWidget = dynamic(() => import("@/components/ChatwayWidget"), {
  ssr: false,
});

export function DeferredChatwayWidget() {
  return <ChatwayWidget />;
}
