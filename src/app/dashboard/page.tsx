import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ChartColumnIncreasing,
  Clock3,
  FileText,
  GraduationCap,
  Headphones,
  NotebookPen,
  Sparkles,
  SquareChartGantt,
} from "lucide-react";
import { getPracticeActivityOverview } from "@/lib/practice-analytics";

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

function formatDuration(seconds: number) {
  if (seconds <= 0) return "0分钟";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}小时${minutes}分钟`;
  }

  if (hours > 0) {
    return `${hours}小时`;
  }

  return `${Math.max(1, minutes)}分钟`;
}

function formatRecordTime(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(timestamp * 1000));
}

function getActivityBadge(recordType: string) {
  if (recordType === "cambridge_practice") {
    return {
      label: "剑雅真题",
      icon: BookOpen,
      className: "bg-blue-50 text-blue-700",
    };
  }

  if (recordType === "intensive_listening") {
    return {
      label: "精听练习",
      icon: Headphones,
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: "口语模拟",
    icon: SquareChartGantt,
    className: "bg-amber-50 text-amber-700",
  };
}

export default async function DashboardPage() {
  const { userId } = await auth();
  const analytics = userId
    ? await getPracticeActivityOverview(userId)
    : {
        todayDurationSeconds: 0,
        totalDurationSeconds: 0,
        recentRecords: [],
      };

  const overviewStats = [
    {
      label: "今日练习时长",
      value: formatDuration(analytics.todayDurationSeconds),
      description: "按北京时间统计今天累计投入的练习时间",
    },
    {
      label: "总练习时长",
      value: formatDuration(analytics.totalDurationSeconds),
      description: "累计记录剑雅真题、口语模拟和精听练习时长",
    },
    { label: "真题范围", value: "剑8-剑20", description: "按册数和 Test 持续进入练习" },
    {
      label: "最近记录",
      value: String(analytics.recentRecords.length),
      description: "概览页展示最近 8 条记录，可直接返回对应练习页面",
    },
  ];

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
            这里现在不只是入口页，也会开始沉淀你的训练数据。剑雅真题、口语模拟和精听练习的时长与题目记录，
            都会回收到当前概览里统一展示。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard/practice"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold !text-white transition-colors hover:bg-blue-700"
            >
              继续真题练习
            </Link>
            <Link
              href="/dashboard/mock-exam"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-600"
            >
              打开口语模考
            </Link>
            <Link
              href="/dashboard/intensive-listening"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-600"
            >
              打开精听练习
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
                  如果你今天还没开始练，优先进入剑雅真题；如果想补听力精细度，就切到精听练习；
                  需要单独做口语节奏时，再进入口语模考。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {overviewStats.map((card) => (
            <div
              key={card.label}
              className="rounded-[1.5rem] border border-slate-200/80 bg-white p-6 text-center shadow-sm"
            >
              <div className="text-3xl font-extrabold text-blue-600">{card.value}</div>
              <div className="mt-2 font-semibold text-slate-900">{card.label}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">{card.description}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Practice Summary
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">练习时长统计</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50/70 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                Today
              </div>
              <div className="mt-3 text-3xl font-extrabold text-slate-900">
                {formatDuration(analytics.todayDurationSeconds)}
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                今天已经累计的练习时长，当前覆盖剑雅真题、口语模拟和精听练习。
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Total
              </div>
              <div className="mt-3 text-3xl font-extrabold text-slate-900">
                {formatDuration(analytics.totalDurationSeconds)}
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                历史累计总练习时长，会随着你在各模块停留和训练自动更新。
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/analytics"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
          >
            去学习分析页看扩展视图
            <ArrowRight className="h-4 w-4" />
          </Link>
        </article>

        <article className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <ChartColumnIncreasing className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Recent Records
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">练习记录</h2>
            </div>
          </div>

          {!userId ? (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-7 text-slate-600">
              登录后才会开始记录你的个人练习时长和题目记录。
            </div>
          ) : analytics.recentRecords.length === 0 ? (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-7 text-slate-600">
              还没有练习记录。进入剑雅真题、口语模拟或精听练习后，系统会自动记录本次训练时长和题目摘要。
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {analytics.recentRecords.map((record) => {
                const badge = getActivityBadge(record.activityType);
                const Icon = badge.icon;

                return (
                  <Link
                    key={record.id}
                    href={record.sourcePath}
                    className="block rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 transition-colors hover:border-blue-200 hover:bg-blue-50/50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {badge.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatRecordTime(record.endedAt)}
                          </span>
                        </div>
                        <div className="mt-3 text-base font-semibold text-slate-900">
                          {record.itemTitle}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {record.itemSubtitle || "点击可回到对应练习页面"}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3 text-sm text-slate-500">
                        <span>{formatDuration(record.durationSeconds)}</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
                          继续练习
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
