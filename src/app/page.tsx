import { auth } from "@clerk/nextjs/server";
import { SignInButton, UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import ElevenLabsVoiceAssistant from "@/components/ElevenLabsVoiceAssistant";

const featureCards = [
  {
    title: "最新真题结构化展示",
    description:
      "阅读和听力题组直接按 part、表格、图片与题号组织，进入页面就能做题和复盘。",
    accent: "from-blue-400 to-blue-600",
  },
  {
    title: "AI 口语陪练即时反馈",
    description:
      "把 ElevenLabs 对话入口放在首页主区，接近 PTE 首页把核心训练入口直接前置的方式。",
    accent: "from-indigo-400 to-indigo-600",
  },
  {
    title: "听说读写统一入口",
    description:
      "落地页不再是单独介绍功能，而是先把 IELTS 备考路径和下一步动作讲清楚。",
    accent: "from-cyan-400 to-cyan-600",
  },
  {
    title: "Dashboard 延续同一结构",
    description:
      "登录后保留同样的信息层级，首页概览、训练入口和题库预览统一到一个工作台。",
    accent: "from-emerald-400 to-emerald-600",
  },
  {
    title: "适合继续扩写作模块",
    description:
      "后续可以无缝插入 Task 1、Task 2、批改、模板与范文，不需要再推翻页面骨架。",
    accent: "from-amber-400 to-amber-600",
  },
  {
    title: "围绕真实考试节奏设计",
    description:
      "把开始练习、进入 dashboard、查看最新题目和语音训练都放在最短路径上。",
    accent: "from-violet-400 to-violet-600",
  },
];

const moduleCards = [
  {
    title: "Speaking",
    description:
      "Part 1、Part 2、Part 3 的陪练、追问和表达组织可以共用同一个会话入口。",
    badge: "Live practice",
  },
  {
    title: "Writing",
    description:
      "继续扩展 Task 1 / Task 2 模板、批改结果、提纲建议和高频题库。",
    badge: "Scaffold ready",
  },
  {
    title: "Reading",
    description: "段落、题号、表格和证据链按结构展示，适合做题后快速定位原文。",
    badge: "Structured review",
  },
  {
    title: "Listening",
    description: "音频、题组、答案核对和错题回看都能继续并到统一的训练工作流。",
    badge: "Audio workflow",
  },
];

const statCards = [
  { label: "Modules", value: "4", description: "听说读写统一入口" },
  { label: "Voice Lab", value: "AI", description: "首页直接开始对话" },
  { label: "Latest Test", value: "Now", description: "最新题目即时预览" },
  { label: "Dashboard", value: "1", description: "登录后延续同一结构" },
];

export default async function Home() {
  const { userId } = await auth();
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "";

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="fixed inset-x-0 top-4 z-50 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="优秀IELTS"
              width={160}
              height={40}
              className="h-12 w-auto"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-gray-600 md:flex">
            <a
              href="#features"
              className="transition-colors hover:text-blue-600"
            >
              功能
            </a>
            <a
              href="#practice"
              className="transition-colors hover:text-blue-600"
            >
              价格
            </a>
            <a
              href="#questions"
              className="transition-colors hover:text-blue-600"
            >
              博客
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {userId ? null : (
              <Link
                href="/sign-up"
                className="hidden rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-blue-200 hover:text-blue-600 sm:inline-flex"
              >
                注册
              </Link>
            )}
            {userId ? (
              <Link
                href="/dashboard"
                className="text-sm font-medium text-gray-700 transition-colors hover:text-blue-600"
              >
                进入备考平台
              </Link>
            ) : (
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700">
                  登录
                </button>
              </SignInButton>
            )}
            {userId ? <UserButton /> : null}
          </div>
        </div>
      </header>

      <main className="flex-grow pb-16 pt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <section className="mb-24 grid items-center gap-12 lg:grid-cols-2">
            <div className="text-left">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                IELTS 全科训练工作台
              </div>

              <h1 className="font-song mb-8 text-5xl font-semibold tracking-tight text-gray-900 sm:text-6xl">
                <span className="text-blue-600">99%</span>还原度的
                <br />
                模拟雅思口语考试
              </h1>

              <p className="mb-10 max-w-2xl text-xl leading-relaxed text-gray-500">
                这里直接对齐 `pte` 的落地页结构：固定头部、双栏
                hero、能力卡片、训练模块说明、核心练习区和最新题目区。 内容保留
                IELTS 自己的功能，不再走当前那套暖色玻璃拟态页面。
              </p>

              <div className="flex flex-wrap gap-4">
                {userId ? (
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-4 text-lg font-semibold !text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-500/30"
                  >
                    进入备考平台
                  </Link>
                ) : (
                  <Link
                    href="/sign-up"
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-500/30"
                  >
                    免费开始练习
                  </Link>
                )}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  AI 口语陪练
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  最新题库预览
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  登录后进入工作台
                </div>
              </div>
            </div>

            <div className="relative hidden h-[500px] w-full lg:flex">
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-blue-100 via-indigo-50 to-cyan-100" />
              <div className="absolute -left-6 top-10 h-32 w-32 rounded-full bg-blue-300/30 blur-3xl" />
              <div className="absolute bottom-12 right-0 h-40 w-40 rounded-full bg-indigo-300/30 blur-3xl" />

              <div className="relative z-10 grid w-full grid-cols-2 gap-4 p-6">
                {statCards.map((item, index) => (
                  <div
                    key={item.label}
                    className={`flex flex-col justify-center rounded-[1.75rem] border border-white/60 bg-white/80 p-8 text-center shadow-xl shadow-blue-100/60 backdrop-blur-xl transition-transform hover:scale-[1.02] ${
                      index % 2 === 1 ? "translate-y-8" : ""
                    }`}
                  >
                    <div className="mb-2 text-4xl font-extrabold text-blue-600">
                      {item.value}
                    </div>
                    <div className="mb-1 font-bold text-gray-900">
                      {item.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="features" className="py-12">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">
                和 PTE 基本一致的落地页层级
              </h2>
              <p className="mx-auto max-w-2xl text-gray-500">
                保留首页展示、能力卡、核心练习区和题目展示区的顺序，只把内容换成
                IELTS 的产品能力。
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {featureCards.map((feature) => (
                <article
                  key={feature.title}
                  className="group rounded-3xl border border-gray-100 bg-white p-8 transition-all duration-300 hover:border-transparent hover:shadow-2xl hover:shadow-gray-200/50"
                >
                  <div
                    className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.accent} text-lg font-bold text-white shadow-lg`}
                  >
                    {feature.title.slice(0, 1)}
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-gray-900 transition-colors group-hover:text-blue-600">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section id="practice" className="relative overflow-hidden py-24">
            <div className="absolute left-0 top-1/2 -z-10 h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-100/50 to-indigo-100/40 blur-[100px]" />
            <div className="absolute bottom-0 right-0 -z-10 h-[360px] w-[360px] rounded-full bg-gradient-to-l from-cyan-100/50 to-sky-100/40 blur-[100px]" />

            <div className="grid items-start gap-20 lg:grid-cols-2">
              <div>
                <h2 className="mb-6 text-4xl font-extrabold leading-tight text-gray-900">
                  保留 PTE 首页的模块说明区
                  <br />
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    但换成 IELTS 的训练组织方式
                  </span>
                </h2>
                <p className="mb-10 text-lg leading-relaxed text-gray-600">
                  这一区块沿用 `pte`
                  的左右双栏：左侧解释模块和训练价值，右侧放统计卡和操作预览。这样两个产品在信息结构上基本统一。
                </p>

                <div className="space-y-4">
                  {moduleCards.map((item, index) => (
                    <div
                      key={item.title}
                      className="group flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 font-semibold text-blue-600">
                        0{index + 1}
                      </div>
                      <div>
                        <h4 className="mb-1 text-base font-bold text-gray-900">
                          {item.title}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {item.description}
                        </p>
                      </div>
                      <div className="ml-auto hidden rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 md:block">
                        {item.badge}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6">
                <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-xl shadow-gray-200/40">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        Voice Practice
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        首页直接开始口语训练，避免先登录再找入口。
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                      Live
                    </span>
                  </div>
                  <ElevenLabsVoiceAssistant agentId={agentId} />
                </section>
              </div>
            </div>
          </section>

          <section id="questions" className="py-8">
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  Latest IELTS Test Preview
                </h2>
                <p className="mt-2 max-w-2xl text-gray-500">
                  这一块在结构上对应 `pte` 首页后半段的内容区，只不过把 SEO
                  文案换成真实的题库预览组件。
                </p>
              </div>
              <Link
                href={userId ? "/dashboard" : "/sign-in"}
                className="inline-flex items-center justify-center rounded-full border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-blue-200 hover:text-blue-600"
              >
                {userId ? "去 Dashboard 继续练习" : "登录后保存训练记录"}
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
