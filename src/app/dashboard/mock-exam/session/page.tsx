import Link from "next/link";
import { notFound } from "next/navigation";
import SpeakingPart23MockSession from "@/components/SpeakingPart23MockSession";
import SpeakingPart1MockSession from "@/components/SpeakingPart1MockSession";
import SpeakingMockTabs from "@/components/SpeakingMockTabs";
import type { SpeakingTopicGroup } from "@/lib/speaking-db";

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

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SpeakingMockTabs activeTab="random" />

      <div>
        <Link
          href="/dashboard/mock-exam"
          className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:text-blue-700"
        >
          返回题库选择
        </Link>
      </div>

      <div className="min-h-0 flex-1">
        {normalizedGroup === "part1" ? (
          <SpeakingPart1MockSession topicId={normalizedTopicId} />
        ) : (
          <SpeakingPart23MockSession topicId={normalizedTopicId} />
        )}
      </div>
    </div>
  );
}
