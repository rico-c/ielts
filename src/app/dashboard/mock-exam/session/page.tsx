import Link from "next/link";
import { notFound } from "next/navigation";
import SpeakingPart1MockSession from "@/components/SpeakingPart1MockSession";
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

  if (normalizedGroup === "part1") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div>
          <Link
            href="/dashboard/mock-exam"
            className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:text-blue-700"
          >
            返回
          </Link>
        </div>

        <div className="min-h-0 flex-1">
          <SpeakingPart1MockSession topicId={normalizedTopicId} />
        </div>
      </div>
    );
  }

  const topic = await getSpeakingMockTopic(normalizedGroup, normalizedTopicId);

  if (!topic) {
    notFound();
  }

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
          Part 2 &amp; Part 3 的模考流程还没接到新的对话式界面里。
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
        当前这一版先优先接通 Part 1 的问答录音流程。你后面如果继续补 Part 2 &amp; Part 3，
        可以复用同一套题目拉取、录音缓存和统一提交结构。
      </section>
    </div>
  );
}
