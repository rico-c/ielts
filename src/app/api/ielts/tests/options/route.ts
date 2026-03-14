import { NextResponse } from "next/server";
import { getAvailableIeltsTestNos, getDbOrThrow } from "@/lib/ielts-db";

function toOptionalNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const series = searchParams.get("series") || undefined;
    const bookNo = toOptionalNumber(searchParams.get("bookNo"));
    const module = searchParams.get("module") || undefined;

    const db = getDbOrThrow();
    const testNos = await getAvailableIeltsTestNos(db, { series, bookNo, module });

    return NextResponse.json({ testNos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
