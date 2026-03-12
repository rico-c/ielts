import { NextResponse } from "next/server";

function getAgentId(request: Request): string {
  const { searchParams } = new URL(request.url);
  return (
    searchParams.get("agent_id") ||
    process.env.ELEVENLABS_AGENT_ID ||
    process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ||
    ""
  );
}

export async function GET(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = getAgentId(request);

  if (!apiKey) {
    return NextResponse.json({ error: "Missing ELEVENLABS_API_KEY on server." }, { status: 500 });
  }

  if (!agentId) {
    return NextResponse.json({ error: "Missing ElevenLabs agent_id." }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
        },
      },
    );

    const body = (await response.json()) as { token?: string; detail?: unknown };
    if (!response.ok || !body.token) {
      const detail = typeof body.detail === "string" ? body.detail : "Failed to get conversation token.";
      return NextResponse.json({ error: detail }, { status: response.status || 500 });
    }

    return NextResponse.json({ token: body.token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
