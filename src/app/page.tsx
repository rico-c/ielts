import { auth } from "@clerk/nextjs/server";
import { SignInButton, UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import ElevenLabsVoiceAssistant from "@/components/ElevenLabsVoiceAssistant";
import UniversityTicker from "@/components/UniversityTicker";

const featureCards = [
  {
    title: "真题结构化练习",
    description:
      "听力、阅读题组按 Part、题号、表格和图片整理，进入页面就能直接做题、核对和复盘。",
    accent: "from-blue-400 to-blue-600",
  },
  {
    title: "AI 口语模拟对练",
    description:
      "首页即可开始口语练习，围绕 Part 1、Part 2、Part 3 做连续对话和即时反馈。",
    accent: "from-indigo-400 to-indigo-600",
  },
  {
    title: "听说读写统一工作台",
    description:
      "训练入口、真题练习和学习路径集中在一个界面里，减少来回切换和寻找成本。",
    accent: "from-cyan-400 to-cyan-600",
  },
  {
    title: "练习与复盘一体化",
    description:
      "登录后直接进入个人备考平台，把练习进度、题目回看和后续训练串起来。",
    accent: "from-emerald-400 to-emerald-600",
  },
  {
    title: "写作训练可持续扩展",
    description:
      "可继续接入 Task 1、Task 2、批改建议、范文与模板，保持同一套训练体验。",
    accent: "from-amber-400 to-amber-600",
  },
  {
    title: "更贴近真实考试节奏",
    description:
      "把开始练习、进入题库、语音训练和复盘放在最短路径上，降低拖延和中断。",
    accent: "from-violet-400 to-violet-600",
  },
];

const moduleCards = [
  {
    title: "Speaking",
    description:
      "覆盖 Part 1、Part 2、Part 3，支持连续追问、表达训练和临场反应练习。",
    badge: "Live practice",
  },
  {
    title: "Writing",
    description:
      "围绕 Task 1 / Task 2 持续扩展提纲建议、批改结果、范文和高频题库。",
    badge: "Scaffold ready",
  },
  {
    title: "Reading",
    description: "按段落、题号和题型结构展示，做题后能快速定位原文与证据点。",
    badge: "Structured review",
  },
  {
    title: "Listening",
    description: "把音频播放、题组作答、答案核对和错题回看放进同一条训练流程。",
    badge: "Audio workflow",
  },
];

const statCards = [
  { label: "Modules", value: "4", description: "听说读写统一训练" },
  { label: "Voice Lab", value: "AI", description: "首页即可开始口语对练" },
  { label: "Latest Test", value: "Now", description: "真题内容随时进入练习" },
  { label: "Dashboard", value: "1", description: "登录后继续个人备考节奏" },
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
                IELTS 全科智能备考平台
              </div>

              <h1 className="font-song mb-8 text-5xl font-semibold tracking-tight text-gray-900 sm:text-6xl">
                <span className="text-blue-600">99%</span>还原度的
                <br />
                模拟雅思口语考试
              </h1>

              <p className="mb-10 max-w-2xl text-xl leading-relaxed text-gray-500">
                从 AI 口语模拟到剑雅真题练习，把听、说、读、写训练放进同一套工作流里。
                进入首页就能开始练习，登录后继续保存你的备考节奏。
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
                    免费开始备考
                  </Link>
                )}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  AI 口语模拟
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  剑雅真题练习
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  登录后继续训练
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

          <div className="-mx-4 mb-12 sm:-mx-6 lg:-mx-8">
            <UniversityTicker />
          </div>

          <section id="features" className="py-12">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">
                更懂你的雅思备考平台
              </h2>
              <p className="mx-auto max-w-2xl text-gray-500">
                结合AI数据分析，指定最适合你的学习计划
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
                  从开口练习到真题训练
                  <br />
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    建立一条更清晰的 IELTS 备考路径
                  </span>
                </h2>
                <p className="mb-10 text-lg leading-relaxed text-gray-600">
                  先用 AI 口语练开口和应答，再进入真题训练做听力、阅读和写作复盘。
                  每个模块都围绕真实备考场景来组织，而不是把功能零散堆在一起。
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
                        AI Speaking Practice
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        不用先找入口，进入首页就能直接开始口语模拟。
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                      Live
                    </span>
                  </div>
                  {/* <ElevenLabsVoiceAssistant agentId={agentId} /> */}
                </section>
              </div>
            </div>
          </section>

          <section id="questions" className="py-8">
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  剑雅真题随时进入练习
                </h2>
                <p className="mt-2 max-w-2xl text-gray-500">
                  登录后可继续进入个人备考平台，按模块、Test 和 Part 快速切换，保持稳定的刷题节奏。
                </p>
              </div>
              <Link
                href={userId ? "/dashboard" : "/sign-in"}
                className="inline-flex items-center justify-center rounded-full border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-blue-200 hover:text-blue-600"
              >
                {userId ? "进入平台继续练习" : "登录后保存训练记录"}
              </Link>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-100 bg-gray-50 pt-16 pb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 grid gap-8 md:grid-cols-4">
            <div>
              <Image
                src="/logo.png"
                alt="优秀IELTS"
                width={120}
                height={30}
                className="mb-6 opacity-80"
                unoptimized
              />
              <p className="text-sm leading-relaxed text-gray-500">
                优秀IELTS 聚合 AI 口语模拟、剑雅真题练习与个人备考工作台，
                帮你把听说读写训练放进同一套高频复盘流程。
              </p>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-gray-900">产品</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>
                  <Link href="/dashboard/practice" className="hover:text-blue-600">
                    真题练习
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/voice" className="hover:text-blue-600">
                    AI 口语对练
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="hover:text-blue-600">
                    个人备考平台
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-gray-900">资源</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>
                  <a href="#features" className="hover:text-blue-600">
                    平台功能
                  </a>
                </li>
                <li>
                  <a href="#practice" className="hover:text-blue-600">
                    训练路径
                  </a>
                </li>
                <li>
                  <a href="#questions" className="hover:text-blue-600">
                    真题入口
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-gray-900">联系</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>official@youshowedu.com</li>
                <li>Mon - Sun / 10:00 - 22:00</li>
              </ul>
            </div>
          </div>

          <div className="mb-8 border-t border-gray-200 pt-8">
            <h4 className="mb-4 text-center text-sm font-semibold text-gray-500">
              友情链接
            </h4>
          </div>

          <div className="border-t border-gray-200 pt-8">
            <div className="flex flex-col items-center justify-center gap-4 text-sm text-gray-400 md:flex-row">
              <p>© 2026 优秀IELTS. All rights reserved.</p>
              <p>Youshow Education PTY LTD</p>
              <div className="flex gap-4">
                <Link href="/terms" className="transition-colors hover:text-gray-600">
                  服务条款
                </Link>
                <Link href="/privacy" className="transition-colors hover:text-gray-600">
                  隐私政策
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
