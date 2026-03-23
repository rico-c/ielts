import Link from "next/link";
import { ArrowRight, ChartColumnIncreasing, Clock3, Target } from "lucide-react";

const analysisCards = [
  {
    title: "训练概览",
    description:
      "后续会把真题练习、精听、口语模考和单词复习汇总到同一个视图里，先看清本周练习密度。",
    icon: ChartColumnIncreasing,
    accent: "from-blue-500 to-cyan-500",
  },
  {
    title: "薄弱项追踪",
    description:
      "把错题集中模块、停留时长和练习频率拉出来，避免只凭感觉安排下一步。",
    icon: Target,
    accent: "from-emerald-500 to-teal-500",
  },
  {
    title: "备考节奏",
    description:
      "按天和按周观察训练连续性，确认你到底是在稳定推进，还是只是偶尔冲刺。",
    icon: Clock3,
    accent: "from-amber-500 to-orange-500",
  },
];

export default function DashboardAnalyticsPage() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 shadow-sm sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 shadow-sm">
          Learning Analytics
        </div>
        <h1 className="mt-5 text-3xl font-extrabold text-slate-900 sm:text-4xl">
          学习分析
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          这个页面会逐步承接你的训练数据，把学习强度、阶段短板和下一步动作做成真正可用的仪表盘。
          现在先提供统一入口，后续可以继续把各模块的数据接进来。
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {analysisCards.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.title}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white shadow-lg`}>
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-lg font-bold text-slate-900">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_28px_60px_rgba(15,23,42,0.18)] sm:p-8">
        <h2 className="text-2xl font-bold">下一步最值得先接入的数据</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
          如果你准备继续扩展这个页面，优先级建议是：真题练习次数、单词复习完成率、口语模考记录和精听完成度。
          这些指标已经足够支撑一个有判断力的学习分析页。
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard/practice"
            className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
          >
            继续真题练习
          </Link>
          <Link
            href="/dashboard/word-review"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/8"
          >
            打开单词复习
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
