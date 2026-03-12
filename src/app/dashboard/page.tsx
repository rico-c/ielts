import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import ElevenLabsVoiceAssistant from "@/components/ElevenLabsVoiceAssistant";
import IeltsTestRenderer from "@/components/IeltsTestRenderer";

export default async function DashboardPage() {
  const { userId } = await auth();
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "";

  return (
    <div className="space-y-6">
      <section id="dashboard-voice" className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Voice Lab</h2>
          <p className="text-ink-soft mt-2 text-sm leading-7">
            先把你现有的语音助教保留到受保护区域里。后面如果你想把它改成只对登录用户开放，再把对应 API 一并保护即可。
          </p>
        </div>
        <ElevenLabsVoiceAssistant agentId={agentId} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Latest Test Preview</h2>
          <p className="text-ink-soft mt-2 text-sm leading-7">
            dashboard 里也保留题库预览，方便后续扩成真正的个人练习工作台。
          </p>
        </div>
        <IeltsTestRenderer />
      </section>
    </div>
  );
}
