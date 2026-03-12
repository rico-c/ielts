import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import Image from "next/image";
import ElevenLabsVoiceAssistant from "@/components/ElevenLabsVoiceAssistant";
import IeltsTestRenderer from "@/components/IeltsTestRenderer";

const capabilityCards = [
  {
    eyebrow: "Speaking Lab",
    title: "口语不是录完就结束，而是当场纠偏。",
    body: "接入语音助教后，练习会变成接近真实考场的来回对话。你能快速定位发音、节奏、停顿和回应组织上的问题。",
  },
  {
    eyebrow: "Reading + Listening",
    title: "最新题目结构直接落到页面里。",
    body: "抓取后的阅读、听力题型会按 part、题组、表格与图片原位展示，适合直接做题、复盘与二次整理。",
  },
  {
    eyebrow: "Training Rhythm",
    title: "把零散刷题，改成可复用的训练节奏。",
    body: "首页不是展示功能清单，而是把核心练习入口、题库预览与备考逻辑放到一个页面上，减少进入成本。",
  },
];

const moduleCards = [
  ["Listening", "Section 场景切分、音频回放、答案核对与错题回看。"],
  ["Reading", "段落、表格、图片和题组绑定，适合做题后快速定位证据。"],
  ["Writing", "可继续扩展为 task 1 / task 2 模板、批改与提纲生成。"],
  ["Speaking", "语音对练、追问、跟读和口语素材组织可以共用一套入口。"],
];

const milestones = [
  "先进入首页，确认四科训练入口和今天优先练什么。",
  "直接在首页下半区预览最新题目结构，不用跳后台。",
  "口语训练区即时开始连麦式对话，减少“先配置再练习”的阻力。",
];

export default async function Home() {
  const { userId } = await auth();
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "";
  const stats = [
    ["4 Modules", "听说读写统一收口"],
    ["Live Voice", "内嵌语音助教"],
    ["Latest Test", "首页直看最新题目"],
    ["Cloudflare", "适合轻量快速部署"],
  ];

  return (
    <main className="ielts-shell min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="glass-panel flex items-center justify-between rounded-[1.5rem] px-5 py-4 sm:px-6">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/logo.png"
              alt="优秀IELTS"
              width={180}
              height={48}
              priority
              className="h-10 w-auto sm:h-11"
            />
          </Link>
          <div className="flex items-center gap-3">
            {userId ? (
              <Link
                href="/dashboard"
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
              >
                进入 Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-up"
                  className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-white"
                >
                  注册
                </Link>
                <Link
                  href="/sign-in"
                  className="accent-gradient rounded-full px-5 py-2 text-sm font-semibold text-white"
                >
                  登录
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="glass-panel overflow-hidden rounded-[2rem]">
          <div className="grid gap-10 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-12 lg:py-14">
            <div className="max-w-3xl">
              <div className="section-kicker inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]">
                全真模拟
              </div>
              <h1 className="font-display mt-6 text-5xl leading-none text-slate-900 sm:text-6xl lg:text-7xl">
                模拟雅思口语考试
                <br />
                &
                <span className="ml-3 italic text-[var(--accent-deep)]">
                  高效提升
                </span>
                的AI系统
              </h1>
              <p className="text-ink-soft mt-6 max-w-2xl text-base leading-8 sm:text-lg">
                参考 PTE
                项目的信息架构，但不复制它的视觉语气。这个版本把雅思产品的重点放在
                真实训练入口、题库即看即练、以及口语助教的即时反馈上。
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {userId ? (
                  <Link
                    href="/dashboard"
                    className="accent-gradient rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(159,77,41,0.26)] transition-transform hover:-translate-y-0.5"
                  >
                    进入 Dashboard
                  </Link>
                ) : (
                  <Link
                    href="/sign-up"
                    className="accent-gradient rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(159,77,41,0.26)] transition-transform hover:-translate-y-0.5"
                  >
                    免费注册开始练习
                  </Link>
                )}
                <a
                  href="#test-preview"
                  className="rounded-full border border-[var(--line)] bg-white/70 px-6 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-white"
                >
                  查看题库预览
                </a>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                {stats.map(([value, label]) => (
                  <div
                    key={value}
                    className="rounded-[1.4rem] border border-white/60 bg-white/56 px-4 py-4"
                  >
                    <div className="text-sm uppercase tracking-[0.22em] text-[var(--accent-deep)]">
                      {value}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex min-h-[420px] flex-col justify-between rounded-[2rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(245,232,220,0.92))] p-6 sm:p-8">
              <div className="absolute right-6 top-6 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(194,107,67,0.34),transparent_70%)] blur-md" />
              <div className="relative">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Today&apos;s flow
                </div>
                <div className="mt-4 space-y-4">
                  {milestones.map((item, index) => (
                    <div
                      key={item}
                      className="flex gap-4 rounded-[1.25rem] border border-white/70 bg-white/72 p-4"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                        0{index + 1}
                      </div>
                      <p className="text-sm leading-7 text-slate-700">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative mt-6 rounded-[1.5rem] bg-slate-900 px-5 py-5 text-white">
                <div className="text-xs uppercase tracking-[0.24em] text-white/60">
                  Positioning
                </div>
                <p className="mt-3 text-sm leading-7 text-white/84">
                  不是单纯“放一个聊天框”，而是把首页做成雅思备考的总控台，既能承接流量，也能直接开始训练。
                </p>
                <p className="mt-3 text-sm leading-7 text-white/60">
                  登录后进入受保护的
                  dashboard，继续做题、看题库和使用个人训练入口。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {capabilityCards.map((card) => (
            <article
              key={card.title}
              className="glass-panel rounded-[1.75rem] p-6"
            >
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--accent-deep)]">
                {card.eyebrow}
              </div>
              <h2 className="mt-4 text-2xl font-semibold leading-8 text-slate-900">
                {card.title}
              </h2>
              <p className="text-ink-soft mt-4 text-sm leading-7">
                {card.body}
              </p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
            <div className="section-kicker inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]">
              Module coverage
            </div>
            <h2 className="font-display mt-5 text-4xl leading-tight text-slate-900">
              保留 PTE 首页“全科覆盖”的骨架，
              <br />
              但把内容换成雅思自己的训练语言。
            </h2>
            <div className="mt-8 grid gap-4">
              {moduleCards.map(([title, desc]) => (
                <div
                  key={title}
                  className="rounded-[1.4rem] border border-white/70 bg-white/60 p-5"
                >
                  <div className="text-lg font-semibold text-slate-900">
                    {title}
                  </div>
                  <p className="text-ink-soft mt-2 text-sm leading-7">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
            <div className="section-kicker inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]">
              Build direction
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["Hero", "主张不是“题多”，而是“可以立刻开始练”。"],
                ["Trust", "用训练节奏、模块覆盖和题库结构替代空泛背书。"],
                ["Voice", "把语音助教升级成首页主功能，不藏到子页面。"],
                ["Preview", "首页直接展示最新 test 数据，提升产品感知。"],
              ].map(([title, desc]) => (
                <div
                  key={title}
                  className="rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface-strong)] p-5"
                >
                  <div className="text-sm uppercase tracking-[0.2em] text-[var(--accent-deep)]">
                    {title}
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-[1.6rem] border border-dashed border-[rgba(159,77,41,0.34)] bg-[rgba(255,247,240,0.92)] p-5">
              <p className="text-sm leading-7 text-slate-700">
                当前首页已经更像一个上线可用的教育产品入口。如果后续继续补写作批改、会员方案和案例评价，这一版可以直接继续往上扩。
              </p>
            </div>
          </div>
        </section>

        <section
          id="voice-lab"
          className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]"
        >
          <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
            <div className="section-kicker inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]">
              Voice assistant
            </div>
            <h2 className="font-display mt-5 text-4xl leading-tight text-slate-900">
              首页直接开口练，
              <br />
              不先做“功能说明页”。
            </h2>
            <p className="text-ink-soft mt-5 text-sm leading-7">
              这里保留了现有 ElevenLabs
              语音对话能力，但视觉上已经并入落地页。用户进入首页后，不需要理解技术细节，就能直接开始口语会话。
            </p>
          </div>
          <ElevenLabsVoiceAssistant agentId={agentId} />
        </section>

        <section
          id="test-preview"
          className="glass-panel rounded-[2rem] p-3 sm:p-4"
        >
          <div className="px-4 pb-2 pt-3 sm:px-6">
            <div className="section-kicker inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]">
              Latest test preview
            </div>
            <h2 className="font-display mt-5 text-4xl leading-tight text-slate-900">
              题库不是一句口号，
              <br />
              而是首页里真的能展开看的内容。
            </h2>
            <p className="text-ink-soft mt-4 max-w-3xl text-sm leading-7">
              下面直接挂载最新 IELTS
              试题数据组件，让落地页既承担转化，也承担产品预览。这样用户在点击注册前，就已经知道题型、数据结构和练习体验是什么。
            </p>
          </div>
          <IeltsTestRenderer />
        </section>
      </div>
    </main>
  );
}
