import { NextResponse } from "next/server";
import { getDbOrThrow, getLatestIeltsTestData } from "@/lib/ielts-db";

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
    const testNo = toOptionalNumber(searchParams.get("testNo"));
    const module = searchParams.get("module") || undefined;

    const db = getDbOrThrow();
    const data = await getLatestIeltsTestData(db, { series, bookNo, testNo, module });

    if (!data) {
      return NextResponse.json({ error: "No IELTS test found for current filters." }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
