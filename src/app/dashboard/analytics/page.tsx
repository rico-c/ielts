import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarRange,
  ChartColumnIncreasing,
  Clock3,
  Headphones,
  Mic2,
  Target,
} from "lucide-react";
import {
  getPracticeActivityDashboard,
  type PracticeActivityDailyStat,
  type PracticeActivityDistributionStat,
  type PracticeActivityHourStat,
  type PracticeActivityRecord,
} from "@/lib/practice-analytics";

const DAYS_TO_SHOW = 28;

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

function formatCompactDuration(seconds: number) {
  if (seconds <= 0) return "0m";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${Math.max(1, minutes)}m`;
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

function formatShortDate(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00+08:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function formatWeekday(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00+08:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    weekday: "short",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function getActivityMeta(key: string) {
  if (key === "cambridge_practice") {
    return {
      label: "剑雅真题",
      icon: BookOpen,
      badgeClass: "bg-blue-50 text-blue-700",
      barClass: "from-blue-500 to-cyan-400",
    };
  }

  if (key === "intensive_listening") {
    return {
      label: "精听练习",
      icon: Headphones,
      badgeClass: "bg-emerald-50 text-emerald-700",
      barClass: "from-emerald-500 to-teal-400",
    };
  }

  return {
    label: "口语模考",
    icon: Mic2,
    badgeClass: "bg-amber-50 text-amber-700",
    barClass: "from-amber-500 to-orange-400",
  };
}

function getModuleMeta(key: string) {
  if (key === "listening") {
    return { label: "听力", barClass: "from-sky-500 to-cyan-400" };
  }

  if (key === "reading") {
    return { label: "阅读", barClass: "from-indigo-500 to-blue-400" };
  }

  if (key === "writing") {
    return { label: "写作", barClass: "from-violet-500 to-fuchsia-400" };
  }

  if (key === "speaking_mock") {
    return { label: "口语模考", barClass: "from-amber-500 to-orange-400" };
  }

  if (key === "intensive_listening") {
    return { label: "精听练习", barClass: "from-emerald-500 to-teal-400" };
  }

  return { label: key, barClass: "from-slate-500 to-slate-400" };
}

function getActivityBadge(recordType: string) {
  const meta = getActivityMeta(recordType);

  return {
    label: meta.label,
    icon: meta.icon,
    className: meta.badgeClass,
  };
}

function buildFilledDailyStats(stats: PracticeActivityDailyStat[], days: number) {
  const map = new Map(stats.map((item) => [item.dateKey, item]));
  const result: PracticeActivityDailyStat[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCHours(date.getUTCHours() + 8, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - offset);
    const dateKey = date.toISOString().slice(0, 10);
    const existing = map.get(dateKey);

    result.push(
      existing ?? {
        dateKey,
        durationSeconds: 0,
        sessionCount: 0,
        questionCount: 0,
      },
    );
  }

  return result;
}

function buildFilledHourStats(stats: PracticeActivityHourStat[]) {
  const map = new Map(stats.map((item) => [item.hour, item]));

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    durationSeconds: map.get(hour)?.durationSeconds ?? 0,
    sessionCount: map.get(hour)?.sessionCount ?? 0,
  }));
}

function getCurrentStreak(stats: PracticeActivityDailyStat[]) {
  let streak = 0;

  for (let index = stats.length - 1; index >= 0; index -= 1) {
    if (stats[index]?.durationSeconds > 0) {
      streak += 1;
      continue;
    }

    break;
  }

  return streak;
}

function getTopDurationStat<T extends { durationSeconds: number }>(items: T[]) {
  return items.reduce<T | null>((current, item) => {
    if (!current || item.durationSeconds > current.durationSeconds) {
      return item;
    }

    return current;
  }, null);
}

function getHeatLevel(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) return "bg-slate-100";

  const ratio = value / maxValue;

  if (ratio >= 0.8) return "bg-blue-600";
  if (ratio >= 0.55) return "bg-blue-500";
  if (ratio >= 0.3) return "bg-blue-300";
  return "bg-blue-100";
}

export default async function DashboardAnalyticsPage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 shadow-sm sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 shadow-sm">
            Learning Analytics
          </div>
          <h1 className="mt-5 text-3xl font-extrabold text-slate-900 sm:text-4xl">学习分析</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            登录后会开始记录你的练习时长、题目数和训练轨迹。分析页会基于这些真实记录生成趋势图、模块分布和最近练习明细。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/dashboard/practice"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold !text-white transition-colors hover:bg-blue-700"
            >
              去开始练习
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const dashboard = await getPracticeActivityDashboard(userId, {
    dailyDays: DAYS_TO_SHOW,
    recentLimit: 12,
  });

  const dailyStats = buildFilledDailyStats(dashboard.dailyStats, DAYS_TO_SHOW);
  const hourStats = buildFilledHourStats(dashboard.hourStats);
  const last7Days = dailyStats.slice(-7);
  const last7DurationSeconds = last7Days.reduce((sum, item) => sum + item.durationSeconds, 0);
  const currentStreak = getCurrentStreak(dailyStats);
  const bestDay = getTopDurationStat(dailyStats);
  const bestHour = getTopDurationStat(hourStats);
  const topActivity = getTopDurationStat(dashboard.activityTypeStats);
  const topModule = getTopDurationStat(dashboard.moduleStats);
  const maxDailyDuration = Math.max(...dailyStats.map((item) => item.durationSeconds), 0);
  const maxHourDuration = Math.max(...hourStats.map((item) => item.durationSeconds), 0);
  const avgDailyDuration = Math.round(last7DurationSeconds / 7);

  const summaryCards = [
    {
      label: "今日练习时长",
      value: formatDuration(dashboard.summary.todayDurationSeconds),
      description: "按北京时间累计今天的真实投入时长",
    },
    {
      label: "近 7 天总时长",
      value: formatDuration(last7DurationSeconds),
      description: avgDailyDuration > 0 ? `日均 ${formatCompactDuration(avgDailyDuration)}` : "最近一周还没有形成稳定节奏",
    },
    {
      label: "总练习次数",
      value: `${dashboard.summary.totalSessionCount}次`,
      description: `累计做了 ${dashboard.summary.totalQuestionCount} 道题`,
    },
    {
      label: "连续练习",
      value: `${currentStreak}天`,
      description: currentStreak > 0 ? "连续性已经形成，重点是别断掉" : "从今天开始重新拉起节奏",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 shadow-sm sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 shadow-sm">
          Learning Analytics
        </div>
        <div className="mt-5 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl font-song">
              学习分析
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
              这页已经开始用你当前的练习时长和练习记录做真实分析。现在可以直接看近 28 天趋势、练习类型分布、模块投入、活跃时段和最近训练明细。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[1.5rem] border border-white/80 bg-white/80 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                最常投入
              </div>
              <div className="mt-3 text-lg font-bold text-slate-900">
                {topActivity ? getActivityMeta(topActivity.key).label : "暂无数据"}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {topActivity ? formatDuration(topActivity.durationSeconds) : "开始练习后这里会自动更新"}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/80 bg-white/80 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                最长单次
              </div>
              <div className="mt-3 text-lg font-bold text-slate-900">
                {formatDuration(dashboard.summary.longestSessionDurationSeconds)}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                平均单次 {formatCompactDuration(dashboard.summary.averageSessionDurationSeconds)}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/80 bg-white/80 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                活跃时段
              </div>
              <div className="mt-3 text-lg font-bold text-slate-900">
                {bestHour ? `${String(bestHour.hour).padStart(2, "0")}:00` : "暂无数据"}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {bestHour ? `累计 ${formatCompactDuration(bestHour.durationSeconds)}` : "开始练习后这里会自动更新"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {summaryCards.map((item) => (
          <article
            key={item.label}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {item.label}
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900">{item.value}</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <ChartColumnIncreasing className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                28-Day Trend
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">近 28 天练习趋势</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                把每天的投入时长、练习次数和题目量放在同一条时间线上，能直接看出你是稳定推进还是间歇冲刺。
              </p>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex h-64 items-end gap-2">
              {dailyStats.map((item) => {
                const height = maxDailyDuration > 0 ? Math.max(10, Math.round((item.durationSeconds / maxDailyDuration) * 100)) : 0;

                return (
                  <div key={item.dateKey} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <div className="text-[11px] text-slate-400">
                      {item.durationSeconds > 0 ? formatCompactDuration(item.durationSeconds) : ""}
                    </div>
                    <div className="flex h-52 w-full items-end rounded-t-2xl bg-slate-100/80 px-1">
                      <div
                        className="w-full rounded-t-2xl bg-gradient-to-t from-blue-600 to-cyan-400 transition-all"
                        style={{ height: `${height}%` }}
                        title={`${formatShortDate(item.dateKey)} · ${formatDuration(item.durationSeconds)} · ${item.sessionCount}次`}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500">{formatShortDate(item.dateKey)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <CalendarRange className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Consistency
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">训练连续性</h2>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-2">
            {dailyStats.map((item) => (
              <div key={item.dateKey} className="space-y-1">
                <div className="text-center text-[10px] text-slate-400">{formatWeekday(item.dateKey)}</div>
                <div
                  className={`h-9 rounded-xl ${getHeatLevel(item.durationSeconds, maxDailyDuration)}`}
                  title={`${formatShortDate(item.dateKey)} · ${formatDuration(item.durationSeconds)} · ${item.sessionCount}次`}
                />
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm text-slate-500">表现最强的一天</div>
              <div className="mt-1 text-lg font-bold text-slate-900">
                {bestDay && bestDay.durationSeconds > 0
                  ? `${formatShortDate(bestDay.dateKey)} · ${formatDuration(bestDay.durationSeconds)}`
                  : "暂无数据"}
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm text-slate-500">累计活跃天数</div>
              <div className="mt-1 text-lg font-bold text-slate-900">
                {dashboard.summary.activeDayCount}天
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Activity Mix
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">练习类型分布</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                看你当前的时间主要压在哪类训练上，能快速判断备考结构是不是偏科。
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {dashboard.activityTypeStats.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-7 text-slate-600">
                还没有练习记录。进入真题练习、精听或口语模考后，这里会自动生成分布图。
              </div>
            ) : (
              dashboard.activityTypeStats.map((item) => {
                const meta = getActivityMeta(item.key);
                const Icon = meta.icon;
                const width = topActivity && topActivity.durationSeconds > 0
                  ? Math.max(12, Math.round((item.durationSeconds / topActivity.durationSeconds) * 100))
                  : 0;

                return (
                  <div key={item.key} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-2xl p-2 ${meta.badgeClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{meta.label}</div>
                          <div className="text-sm text-slate-500">
                            {item.sessionCount}次练习 · {item.questionCount}题
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-slate-900">
                          {formatDuration(item.durationSeconds)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 h-3 rounded-full bg-white">
                      <div
                        className={`h-3 rounded-full bg-gradient-to-r ${meta.barClass}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Time Window
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">一天里的活跃时段</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                把练习开始时间按小时聚合，能看出你最容易进入状态的时间窗口。
              </p>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex h-64 items-end gap-2">
              {hourStats.map((item) => {
                const height = maxHourDuration > 0 ? Math.max(8, Math.round((item.durationSeconds / maxHourDuration) * 100)) : 0;

                return (
                  <div key={item.hour} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <div className="text-[10px] text-slate-400">
                      {item.durationSeconds > 0 ? formatCompactDuration(item.durationSeconds) : ""}
                    </div>
                    <div className="flex h-52 w-full items-end rounded-t-xl bg-slate-100/80 px-[2px]">
                      <div
                        className="w-full rounded-t-xl bg-gradient-to-t from-indigo-600 to-sky-400"
                        style={{ height: `${height}%` }}
                        title={`${String(item.hour).padStart(2, "0")}:00 · ${formatDuration(item.durationSeconds)}`}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500">{String(item.hour).padStart(2, "0")}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-600">
              <ChartColumnIncreasing className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Module Focus
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">模块投入分布</h2>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {dashboard.moduleStats.map((item) => {
              const meta = getModuleMeta(item.key);
              const width = topModule && topModule.durationSeconds > 0
                ? Math.max(12, Math.round((item.durationSeconds / topModule.durationSeconds) * 100))
                : 0;

              return (
                <div key={item.key}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{meta.label}</div>
                      <div className="text-sm text-slate-500">
                        {item.sessionCount}次练习 · {item.questionCount}题
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-slate-700">
                      {formatDuration(item.durationSeconds)}
                    </div>
                  </div>
                  <div className="mt-3 h-3 rounded-full bg-slate-100">
                    <div
                      className={`h-3 rounded-full bg-gradient-to-r ${meta.barClass}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm text-slate-500">当前投入最多的模块</div>
            <div className="mt-2 text-lg font-bold text-slate-900">
              {topModule ? getModuleMeta(topModule.key).label : "暂无数据"}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {topModule ? formatDuration(topModule.durationSeconds) : "开始练习后这里会自动更新"}
            </div>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Recent Records
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">最近练习记录</h2>
              </div>
            </div>

            <Link
              href="/dashboard/practice"
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
            >
              继续练习
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {dashboard.recentRecords.length === 0 ? (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-7 text-slate-600">
              还没有练习记录。进入剑雅真题、口语模拟或精听练习后，系统会自动记录本次训练时长和题目摘要。
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-slate-200">
              <div className="grid grid-cols-[1.3fr_0.9fr_0.6fr_0.6fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                <div>练习内容</div>
                <div>时间</div>
                <div>题量</div>
                <div>时长</div>
              </div>

              <div className="divide-y divide-slate-200">
                {dashboard.recentRecords.map((record: PracticeActivityRecord) => {
                  const badge = getActivityBadge(record.activityType);
                  const Icon = badge.icon;

                  return (
                    <Link
                      key={record.id}
                      href={record.sourcePath}
                      className="grid grid-cols-[1.3fr_0.9fr_0.6fr_0.6fr] gap-3 px-4 py-4 transition-colors hover:bg-blue-50/60"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {badge.label}
                          </span>
                        </div>
                        <div className="mt-2 truncate text-sm font-semibold text-slate-900">
                          {record.itemTitle}
                        </div>
                        <div className="mt-1 truncate text-sm text-slate-500">
                          {record.itemSubtitle || "点击可回到对应练习页面"}
                        </div>
                      </div>

                      <div className="text-sm text-slate-600">{formatRecordTime(record.endedAt)}</div>
                      <div className="text-sm font-semibold text-slate-700">
                        {record.questionCount > 0 ? `${record.questionCount}题` : "-"}
                      </div>
                      <div className="text-sm font-semibold text-slate-700">
                        {formatDuration(record.durationSeconds)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
