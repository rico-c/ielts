
import ElevenLabsVoiceAssistant from "@/components/ElevenLabsVoiceAssistant";

export default function Home() {
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "";

  return (
    <main className="min-h-screen bg-[#f4f1ea]">
      <ElevenLabsVoiceAssistant agentId={agentId} />
    </main>
  );
}
