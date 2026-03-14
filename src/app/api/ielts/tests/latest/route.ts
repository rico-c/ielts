import { NextResponse } from "next/server";
import { getAvailableListeningTestNos } from "@/lib/ielts-db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const module = searchParams.get("module") ?? "listening";
  const bookNo = Number(searchParams.get("bookNo") ?? "20");

  if (module !== "listening") {
    return NextResponse.json({ error: "Only listening is supported right now." }, { status: 400 });
  }

  if (!Number.isFinite(bookNo)) {
    return NextResponse.json({ error: "Invalid bookNo." }, { status: 400 });
  }

  try {
    const testNos = await getAvailableListeningTestNos(bookNo);
    const latestTestNo = testNos.at(-1) ?? null;

    return NextResponse.json({
      bookNo,
      module,
      latestTestNo,
      testNos,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load latest test.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
