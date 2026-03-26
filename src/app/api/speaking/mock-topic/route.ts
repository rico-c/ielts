import { NextResponse } from "next/server";
import {
  getSpeakingPart1MockDetail,
  getSpeakingPart23MockDetail,
} from "@/lib/speaking-db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const group = searchParams.get("group");
  const topicId = searchParams.get("topicId")?.trim();

  if (group !== "part1" && group !== "part23") {
    return NextResponse.json({ error: "Unsupported group." }, { status: 400 });
  }

  if (!topicId) {
    return NextResponse.json({ error: "Missing topicId." }, { status: 400 });
  }

  try {
    const detail =
      group === "part1"
        ? await getSpeakingPart1MockDetail(topicId)
        : await getSpeakingPart23MockDetail(topicId);

    if (!detail) {
      return NextResponse.json({ error: "Speaking topic not found." }, { status: 404 });
    }

    return NextResponse.json({ detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load speaking topic.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
