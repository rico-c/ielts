import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  FileText,
  GraduationCap,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import PricingSection from "@/components/PricingSection";

const primaryActions = [
  {
    title: "剑雅真题练习",
    description: "直接进入 Cambridge IELTS 练习页，按册数、Test 和模块继续做听力、阅读、写作训练。",
    href: "/dashboard/practice",
    badge: "核心入口",
    icon: BookOpen,
    accent: "from-blue-500 to-indigo-600",
  },
  {
    title: "单词复习",
    description: "目前保留单词本复习和雅思 6 分核心词汇两个词库，适合把高频词持续滚动复习。",
    href: "/dashboard/word-review",
    badge: "持续复盘",
    icon: NotebookPen,
    accent: "from-amber-500 to-orange-500",
  },
  {
    title: "独家资料",
    description: "查看平台内整理的备考手册、模板和后续会持续补充的资料入口。",
    href: "/dashboard/materials",
    badge: "资料入口",
    icon: FileText,
    accent: "from-emerald-500 to-teal-500",
  },
];

const overviewStats = [
  { label: "当前计划", value: "免费版", description: "无付费门槛，直接开始使用" },
  { label: "真题范围", value: "剑8-剑20", description: "按册数和 Test 持续进入练习" },
  { label: "单词词库", value: "2", description: "单词本复习 + 雅思 6 分核心词汇" },
  { label: "学习入口", value: "3", description: "真题、单词、资料统一收口" },
];

const workflowSteps = [
  {
    title: "先进入真题训练",
    description: "从听力、阅读或写作开始，快速进入今天的练习状态。",
  },
  {
    title: "再做单词复盘",
    description: "把练习过程里遇到的词汇回收到单词复习，形成更稳定的记忆闭环。",
  },
  {
    title: "最后补资料和模板",
    description: "需要提纲、模板或阶段资料时，再从独家资料入口继续往下看。",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6 shadow-sm sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700 shadow-sm">
            IELTS Workspace
          </div>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
            你的雅思训练工作台
            <br />
            从今天该练什么开始
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            这里不再只是一个占位 dashboard。当前工作台会把剑雅真题、单词复习和独家资料收在同一层，
            让你每天进入平台后都能直接知道先做什么、接着做什么。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard/practice"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold !text-white transition-colors hover:bg-blue-700"
            >
              继续真题练习
            </Link>
            <Link
              href="/dashboard/word-review"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-600"
            >
              打开单词复习
            </Link>
          </div>

          <div className="mt-10 rounded-[1.5rem] border border-white/80 bg-white/80 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">当前最适合的使用方式</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  如果你今天还没开始练，优先进入剑雅真题；如果已经刷完一轮题，再回到单词复习把高频词滚动一遍，
                  最后按需要去资料页看模板或备考手册。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {overviewStats.map((card) => (
            <div key={card.label} className="rounded-[1.5rem] border border-slate-200/80 bg-white p-6 text-center shadow-sm">
              <div className="text-3xl font-extrabold text-blue-600">{card.value}</div>
              <div className="mt-2 font-semibold text-slate-900">{card.label}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">{card.description}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {primaryActions.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.title}
              className="group rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/40"
            >
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white shadow-lg`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-5 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {item.badge}
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-900">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
              <Link
                href={item.href}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
              >
                进入
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[1.75rem] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_28px_60px_rgba(15,23,42,0.2)] sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/80">
            Recommended Flow
          </div>
          <h2 className="mt-5 text-3xl font-bold leading-tight">
            按这条顺序使用
            <br />
            体验会最顺
          </h2>

          <div className="mt-8 space-y-4">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="rounded-[1.5rem] border border-white/10 bg-white/6 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold text-blue-100">
                    0{index + 1}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Current Scope
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">当前 dashboard 里已经接通的能力</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-semibold text-slate-900">剑雅真题练习</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                已支持按册数、Test、模块查看和进入练习，是当前最核心的训练入口。
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-semibold text-slate-900">单词复习</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                已保留两个最常用词库，适合承接练习后的词汇复盘。
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-semibold text-slate-900">独家资料</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                资料页已经作为统一入口接好，后面可以继续补模板、手册和阶段资料。
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-semibold text-slate-900">免费版计划</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                当前全部围绕免费版展开，用户不需要先付费就能进入核心训练流程。
              </p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
