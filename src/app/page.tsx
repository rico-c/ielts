import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import {
  AudioLines,
  BookOpenText,
  BrainCircuit,
  Layers3,
  PenTool,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import UniversityTicker from "@/components/UniversityTicker";
import PricingSection from "@/components/PricingSection";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import Testimonials from "@/components/Testimonials";
import { getSortedPostsData } from "@/lib/blogs";
import { DeferredChatwayWidget } from "@/components/HomeDeferred";

const featureCards: Array<{
  title: string;
  description: string;
  accent: string;
  icon: LucideIcon;
}> = [
  {
    title: "真题结构化练习",
    description:
      "听力、阅读题组按 Part、题号、表格和图片整理，进入页面就能直接做题、核对和复盘。",
    accent: "from-blue-400 to-blue-600",
    icon: BookOpenText,
  },
  {
    title: "AI 口语模拟对练",
    description:
      "首页即可开始口语练习，围绕 Part 1、Part 2、Part 3 做连续对话和即时反馈。",
    accent: "from-indigo-400 to-indigo-600",
    icon: AudioLines,
  },
  {
    title: "听说读写统一工作台",
    description:
      "训练入口、真题练习和学习路径集中在一个界面里，减少来回切换和寻找成本。",
    accent: "from-cyan-400 to-cyan-600",
    icon: Layers3,
  },
  {
    title: "练习与复盘一体化",
    description:
      "登录后直接进入个人备考平台，把练习进度、题目回看和后续训练串起来。",
    accent: "from-emerald-400 to-emerald-600",
    icon: Workflow,
  },
  {
    title: "写作训练可持续扩展",
    description:
      "可继续接入 Task 1、Task 2、批改建议、范文与模板，保持同一套训练体验。",
    accent: "from-amber-400 to-amber-600",
    icon: PenTool,
  },
  {
    title: "更贴近真实考试节奏",
    description:
      "把开始练习、进入题库、语音训练和复盘放在最短路径上，降低拖延和中断。",
    accent: "from-violet-400 to-violet-600",
    icon: BrainCircuit,
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

const practiceFlowStats = [
  { label: "Start", value: "Speaking first" },
  { label: "Focus", value: "Test-based drills" },
  { label: "Loop", value: "Review and continue" },
];

export default async function Home() {
  const { userId } = await auth();
  const latestPosts = getSortedPostsData().slice(0, 3);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <DeferredChatwayWidget />

      <SiteHeader />

      <main className="flex-grow pb-16 pt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <section className="mb-24 grid items-center gap-12 lg:grid-cols-2">
            <div className="text-left">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                IELTS 智能备考平台
              </div>

              <h1 className="font-song mb-8 text-5xl font-semibold tracking-tight text-gray-900 sm:text-6xl">
                90天突破雅思8分
                <br />
                雅思学习<span className="text-blue-600">神器</span>
              </h1>

              <p className="mb-10 max-w-2xl text-xl leading-relaxed text-gray-500">
                8-20剑雅真题，行业领先的AI口语模拟，写作评分，听力精听，阅读批改，丝滑而高效率的雅思备考体验
              </p>

              <div className="flex flex-wrap gap-4">
                {userId ? (
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-4 text-lg font-semibold text-white! shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-500/30"
                  >
                    进入备考平台
                  </Link>
                ) : (
                  <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                    <button className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-4 text-lg font-semibold text-white! shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-500/30">
                      免费开始备考
                    </button>
                  </SignInButton>
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
              </div>
            </div>

            <div className="relative hidden h-[500px] w-full lg:flex">
              <div className="relative z-10 w-full p-6">
                <div className="relative h-full overflow-hidden rounded-[2rem]">
                  <Image
                    src="/hero.png"
                    alt="优秀雅思首页功能预览"
                    fill
                    className="object-contain object-center"
                    sizes="(min-width: 1024px) 50vw, 100vw"
                  />
                </div>
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
              {featureCards.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article
                    key={feature.title}
                    className="group rounded-3xl border border-gray-100 bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-2xl hover:shadow-gray-200/50"
                  >
                    <div
                      className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.accent} text-white shadow-lg ring-1 ring-white/50`}
                    >
                      <Icon className="h-6 w-6" strokeWidth={2.1} />
                    </div>
                    <h3 className="mb-3 text-xl font-bold text-gray-900 transition-colors group-hover:text-blue-600">
                      {feature.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-gray-500">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          {/* <section id="practice" className="relative overflow-hidden py-24">
            <div className="absolute left-0 top-1/2 -z-10 h-[460px] w-[460px] -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-100/65 to-indigo-100/30 blur-[120px]" />
            <div className="absolute right-0 top-0 -z-10 h-[420px] w-[420px] rounded-full bg-gradient-to-l from-cyan-100/60 to-sky-100/25 blur-[120px]" />

            <div className="rounded-[2.75rem] border border-white/80 bg-white/70 p-6 shadow-[0_35px_100px_rgba(148,163,184,0.22)] backdrop-blur-xl sm:p-8 lg:p-10">
              <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                    Study Flow
                  </div>
                  <h2 className="mt-6 text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
                    从开口练习到真题训练
                    <br />
                    <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                      建立一条更清晰的 IELTS 备考路径
                    </span>
                  </h2>
                  <p className="mt-6 text-lg leading-8 text-gray-600">
                    我们尽力为您提供最舒适的备考学习体验，兼顾效率与备考舒适度
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {practiceFlowStats.map((item) => (
                    <div
                      key={item.label}
                      className="min-w-[150px] rounded-[1.5rem] border border-slate-200/70 bg-white/85 px-5 py-4 shadow-sm"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {item.label}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[0.72fr_0.9fr_1.05fr]">
                <section className="rounded-[2rem] border border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 p-6 text-white shadow-[0_28px_60px_rgba(15,23,42,0.22)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/80">
                    Entry Point
                  </div>
                  <h3 className="mt-4 text-2xl font-bold leading-tight">
                    科学的备考方案
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    进入优秀雅思 后，不需要先理解复杂功能结构。首页会先把你带进 AI 口语练习，再顺着路径进入真题训练和个人控制台。
                  </p>
                  <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Current route
                    </div>
                    <div className="mt-3 space-y-3 text-sm text-slate-200">
                      <div className="flex items-center justify-between rounded-xl bg-white/6 px-3 py-3">
                        <span>Homepage</span>
                        <span className="text-blue-200">Start</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white/6 px-3 py-3">
                        <span>Practice</span>
                        <span className="text-blue-200">Deepen</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white/6 px-3 py-3">
                        <span>Dashboard</span>
                        <span className="text-blue-200">Continue</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[2rem] border border-slate-200/70 bg-white/88 p-5 shadow-sm">
                  <div className="mb-5 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Module Path
                        </div>
                      <h3 className="mt-2 text-2xl font-bold text-slate-900">
                        丝滑的刷题体验
                      </h3>
                    </div>

                  </div>

                  <div className="space-y-4">
                    {moduleCards.map((item, index) => (
                      <div
                        key={item.title}
                        className="group relative rounded-[1.5rem] border border-slate-200/70 bg-slate-50/80 p-4 transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-lg hover:shadow-slate-200/40"
                      >
                        {index < moduleCards.length - 1 ? (
                          <div className="absolute left-9 top-[74px] h-10 w-px bg-gradient-to-b from-blue-200 to-transparent" />
                        ) : null}
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-md shadow-blue-200/70">
                            0{index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-base font-bold text-slate-900">{item.title}</h4>
                              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                {item.badge}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-7 text-slate-600">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-slate-950 text-white shadow-[0_32px_70px_rgba(15,23,42,0.28)]">
                  <div className="border-b border-white/10 px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/80">
                          Training Surface
                        </p>
                        <h3 className="mt-2 text-2xl font-bold">
                          数据驱动学习路径
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 p-6">
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Step A
                          </p>
                          <h4 className="mt-2 text-lg font-semibold text-white">
                            AI Speaking Practice
                          </h4>
                          <p className="mt-2 text-sm leading-7 text-slate-300">
                            首页直接提供 AI 口语模拟入口，先帮你开口、进入考试语境，再继续往下训练。
                          </p>
                        </div>
                        <div className="rounded-2xl bg-emerald-400/12 px-3 py-2 text-xs font-semibold text-emerald-200">
                          Fast start
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Step B
                        </p>
                        <h4 className="mt-2 text-base font-semibold text-white">
                          Structured Test Practice
                        </h4>
                        <p className="mt-2 text-sm leading-7 text-slate-300">
                          从口语切到剑雅真题，继续按 Test 和 Part 推进，而不是重新找路。
                        </p>
                      </div>

                      <div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-blue-500/18 to-cyan-400/10 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200/80">
                          Step C
                        </p>
                        <h4 className="mt-2 text-base font-semibold text-white">
                          Dashboard Continuity
                        </h4>
                        <p className="mt-2 text-sm leading-7 text-slate-200">
                          训练后回到控制台，接住下一轮节奏，而不是把体验断开。
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                      <div className="flex flex-wrap gap-3">
                        <span className="rounded-full bg-white/8 px-3 py-2 text-xs font-medium text-slate-300">
                          Speaking first
                        </span>
                        <span className="rounded-full bg-white/8 px-3 py-2 text-xs font-medium text-slate-300">
                          Test workflow
                        </span>
                        <span className="rounded-full bg-white/8 px-3 py-2 text-xs font-medium text-slate-300">
                          Review loop
                        </span>
                      </div>
                      <p className="mt-4 text-sm leading-7 text-slate-300">
                        从首页开口、到真题练习、再到 dashboard 继续复盘，你的每一步都会被接住，不需要在不同页面里反复找入口。
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </section> */}

          <div className="-mx-4 sm:-mx-6 lg:-mx-8">
            <Testimonials />
          </div>

          <PricingSection
            ctaHref={userId ? "/dashboard" : "/sign-up"}
            ctaLabel={userId ? "" : ""}
          />

          <section id="questions" className="py-8">
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  进入博客平台查看备考攻略
                </h2>
                <p className="mt-2 max-w-2xl text-gray-500">
                  不只是看技巧。这里会持续补充口语、写作、阅读和听力的高频问题拆解，学完可以直接回到平台训练。
                </p>
              </div>
              <Link
                href="/blogs"
                className="inline-flex items-center justify-center rounded-full border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-blue-200 hover:text-blue-600"
              >
                查看全部博客
              </Link>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {latestPosts.map((post) => (
                <article
                  key={post.slug}
                  className="rounded-[1.75rem] border border-gray-100 bg-white p-7 shadow-lg shadow-slate-200/30"
                >
                  <time
                    dateTime={post.date}
                    className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                  >
                    {post.date}
                  </time>
                  <h3 className="mt-4 text-xl font-bold leading-8 text-gray-900">
                    <Link
                      href={`/blogs/${post.slug}`}
                      className="transition-colors hover:text-blue-600"
                    >
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-gray-500">
                    {post.description}
                  </p>
                  <Link
                    href={`/blogs/${post.slug}`}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    阅读全文 <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>

            {/* <div className="mt-10 flex flex-col gap-4 rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">练完文章里的方法，再回平台实战</h3>
                <p className="mt-2 text-sm text-gray-500">
                  登录后可继续进入个人备考平台，按模块、Test 和 Part 快速切换，保持稳定的刷题节奏。
                </p>
              </div>
              <Link
                href={userId ? "/dashboard" : "/sign-in"}
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                {userId ? "进入平台继续练习" : "登录后保存训练记录"}
              </Link>
            </div> */}
          </section>
        </div>
      </main>

      <SiteFooter showFriendLinks />
    </div>
  );
}
