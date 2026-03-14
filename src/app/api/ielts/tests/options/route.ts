import { NextResponse } from "next/server";
import { getAvailableListeningTestNos } from "@/lib/ielts-db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const module = searchParams.get("module");
  const bookNo = Number(searchParams.get("bookNo"));

  if (module !== "listening") {
    return NextResponse.json({ testNos: [] });
  }

  if (!Number.isFinite(bookNo)) {
    return NextResponse.json({ error: "Invalid bookNo." }, { status: 400 });
  }

  try {
    const testNos = await getAvailableListeningTestNos(bookNo);
    return NextResponse.json({ testNos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load test options.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
