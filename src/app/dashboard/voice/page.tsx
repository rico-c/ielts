import ElevenLabsVoiceAssistant from "@/components/ElevenLabsVoiceAssistant";

export default function DashboardVoicePage() {
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "";

  return (
    <div className="space-y-4">
      <section className="rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="inline-flex rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-indigo-700">
          Voice lab
        </div>
        <h1 className="mt-5 text-4xl font-extrabold leading-tight text-gray-900">独立口语训练页</h1>
        <p className="mt-4 text-sm leading-7 text-gray-600">
          如果你后面要做会话记录、分数评估或用户历史数据，这个页面更适合作为正式训练入口。
        </p>
      </section>
      <ElevenLabsVoiceAssistant agentId={agentId} />
    </div>
  );
}
