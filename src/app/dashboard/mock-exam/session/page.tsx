import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpeakingMockTopic, type SpeakingTopicGroup } from "@/lib/speaking-db";

type SearchParams = {
  group?: string;
  topicId?: string;
};

type Props = {
  searchParams: Promise<SearchParams>;
};

function normalizeGroup(value: string | undefined): SpeakingTopicGroup | null {
  if (value === "part1" || value === "part23") {
    return value;
  }

  return null;
}

export default async function SpeakingMockSessionPage({ searchParams }: Props) {
  const { group, topicId } = await searchParams;
  const normalizedGroup = normalizeGroup(group);
  const normalizedTopicId = topicId?.trim();

  if (!normalizedGroup || !normalizedTopicId) {
    notFound();
  }

  const topic = await getSpeakingMockTopic(normalizedGroup, normalizedTopicId);

  if (!topic) {
    notFound();
  }

  const summaryText =
    topic.group === "part1"
      ? `已接通 ${topic.questions.length} 道 Part 1 题目。`
      : `已接通 ${topic.part2Questions.length} 道 Part 2 题目、${topic.requirements.length} 条 requirement 和 ${topic.part3Questions.length} 道 Part 3 题目。`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/mock-exam"
          className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:text-blue-700"
        >
          返回题库选择
        </Link>
      </div>

      <section className="rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6 shadow-sm sm:p-8">
        <div className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700 shadow-sm">
          Speaking Mock Session
        </div>
        <h1 className="mt-5 text-3xl font-bold text-slate-900 sm:text-4xl">{topic.topic}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          {topic.group === "part1" ? "Part 1 模考入口" : "Part 2 & Part 3 模考入口"}
        </p>
        <p className="mt-2 text-sm leading-7 text-slate-600 sm:text-base">{summaryText}</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Current Topic</div>
          <div className="mt-2 text-xl font-bold text-slate-900">{topic.topic}</div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Mode</div>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {topic.group === "part1" ? "Part 1" : "Part 2 & Part 3"}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status</div>
          <div className="mt-2 text-xl font-bold text-slate-900">待补完整模考逻辑</div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
        这里先作为新的模考界面入口，题目上下文已经可以按 Topic 带进来。你后面补计时、录音、流程控制时，直接在这个页面继续扩展就行。
      </section>
    </div>
  );
}
