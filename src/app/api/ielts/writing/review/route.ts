import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getWritingPartContext } from "@/lib/ielts-db";
import { countEssayWords } from "@/lib/ielts-writing-review";
import { generateWritingAiReview } from "@/lib/ielts-writing-review.server";

type ReviewRequestBody = {
  partId?: string;
  essay?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReviewRequestBody;
    const partId = body.partId?.trim();
    const essay = body.essay?.trim() ?? "";

    if (!partId) {
      return NextResponse.json({ error: "Missing partId." }, { status: 400 });
    }

    if (!essay) {
      return NextResponse.json({ error: "Essay content is required." }, { status: 400 });
    }

    if (countEssayWords(essay) < 20) {
      return NextResponse.json(
        { error: "作文内容过短，至少写到 20 个英文单词后再提交评分。" },
        { status: 400 },
      );
    }

    const context = await getWritingPartContext(partId);
    if (!context) {
      return NextResponse.json({ error: "Writing task not found." }, { status: 404 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const review = await generateWritingAiReview(env, context, essay);

    return NextResponse.json({ review });
  } catch (error) {
    console.error("Failed to review writing task:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate AI writing review.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
