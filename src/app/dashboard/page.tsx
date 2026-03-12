import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import ElevenLabsVoiceAssistant from "@/components/ElevenLabsVoiceAssistant";
import IeltsTestRenderer from "@/components/IeltsTestRenderer";

export default async function DashboardPage() {
  const { userId } = await auth();
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "";

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/70 p-6">
        <div className="section-kicker inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]">
          Protected dashboard
        </div>
        <h1 className="font-display mt-5 text-5xl leading-none text-slate-900">
          登录已生效，
          <br />
          当前用户可以访问训练区。
        </h1>
        <p className="text-ink-soft mt-5 max-w-2xl text-sm leading-7">
          当前 user id: <span className="font-semibold text-slate-800">{userId}</span>。
          这个页面只有登录后才能进。后续如果你要把做题记录、个人收藏或订阅状态绑定到用户，这里就是入口。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm font-semibold text-slate-700">
            返回首页
          </Link>
          <a href="#dashboard-voice" className="accent-gradient rounded-full px-5 py-3 text-sm font-semibold text-white">
            跳到口语训练
          </a>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Auth", "Clerk 登录、注册、用户按钮和 dashboard 路由保护已接通。"],
          ["Access", "middleware 只放行首页、登录注册页和公开 API。"],
          ["Scaffold", "后续可以继续往 dashboard/practice、dashboard/voice 拆页面。"],
        ].map(([title, body]) => (
          <article key={title} className="rounded-[1.5rem] border border-[var(--line)] bg-white/66 p-5">
            <div className="text-sm uppercase tracking-[0.22em] text-[var(--accent-deep)]">{title}</div>
            <p className="mt-3 text-sm leading-7 text-slate-700">{body}</p>
          </article>
        ))}
      </section>

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
