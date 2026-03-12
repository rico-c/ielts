import ElevenLabsVoiceAssistant from "@/components/ElevenLabsVoiceAssistant";

export default function DashboardVoicePage() {
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "";

  return (
    <div className="space-y-4">
      <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/70 p-6">
        <div className="section-kicker inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]">
          Voice lab
        </div>
        <h1 className="font-display mt-5 text-4xl leading-tight text-slate-900">独立口语训练页</h1>
        <p className="text-ink-soft mt-4 text-sm leading-7">
          如果你后面要做会话记录、分数评估或用户历史数据，这个页面更适合作为正式训练入口。
        </p>
      </section>
      <ElevenLabsVoiceAssistant agentId={agentId} />
    </div>
  );
}
