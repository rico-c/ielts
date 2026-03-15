import { NextResponse } from "next/server";
import { getPracticePaper } from "@/lib/ielts-db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const module = searchParams.get("module");
  const bookNo = Number(searchParams.get("bookNo"));
  const testNo = Number(searchParams.get("testNo"));

  if (module !== "listening" && module !== "reading" && module !== "writing") {
    return NextResponse.json({ error: "Unsupported module." }, { status: 400 });
  }

  if (!Number.isFinite(bookNo) || !Number.isFinite(testNo)) {
    return NextResponse.json({ error: "Invalid bookNo or testNo." }, { status: 400 });
  }

  try {
    const paper = await getPracticePaper(bookNo, testNo, module);

    if (!paper) {
      return NextResponse.json({ error: "Practice paper not found." }, { status: 404 });
    }

    return NextResponse.json({ paper });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load practice paper.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
