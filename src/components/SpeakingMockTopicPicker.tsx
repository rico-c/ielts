"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  SpeakingMockCatalog,
  SpeakingMockTopic,
  SpeakingPart1Topic,
  SpeakingPart23Topic,
  SpeakingTopicGroup,
} from "@/lib/speaking-db";

type Props = {
  catalog: SpeakingMockCatalog;
};

function TopicCountLabel({ topic }: { topic: SpeakingMockTopic }) {
  if (topic.group === "part1") {
    return <span>{topic.questions.length} 题</span>;
  }

  return <span>{topic.part3Questions.length} 题</span>;
}

function QuestionList({
  title,
  questions,
}: {
  title: string;
  questions: string[];
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="mt-0 space-y-3">
        {questions.map((question, index) => (
          <div
            key={`${title}-${index + 1}`}
            className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700"
          >
            <span className="mr-2 font-semibold text-slate-500">
              Q{index + 1}.
            </span>
            {question}
          </div>
        ))}
      </div>
    </section>
  );
}

function Part1TopicPreview({ topic }: { topic: SpeakingPart1Topic }) {
  return <QuestionList title="" questions={topic.questions} />;
}

function Part23TopicPreview({ topic }: { topic: SpeakingPart23Topic }) {
  return (
    <div className="">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm mb-2" >
        <h3 className="text-lg font-semibold text-slate-900">Part 2</h3>
        <div className="mt-4 space-y-3">
          {topic.part2Questions.map((question, index) => (
            <div
              key={`part2-${index + 1}`}
              className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700"
            >
              <span className="mr-2 font-semibold text-slate-500">
                Q{index + 1}.
              </span>
              {question}
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
          <div className="text-sm font-semibold text-slate-900">
            Requirement
          </div>
          <div className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
            {topic.requirements.map((item, index) => (
              <div
                key={`requirement-${index + 1}`}
                className="rounded-xl bg-white/70 px-3 py-2"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <QuestionList title="Part 3" questions={topic.part3Questions} />
    </div>
  );
}

function TopicButton({
  expanded,
  topic,
  onPreviewToggle,
}: {
  expanded: boolean;
  topic: SpeakingMockTopic;
  onPreviewToggle: () => void;
}) {
  return (
    <article
      className={`rounded-[1.25rem] border px-4 py-4 transition-all ${
        expanded
          ? "border-blue-300 bg-blue-50 shadow-sm shadow-blue-100/70"
          : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-900">
            {topic.topic}
          </div>
          <div className="flex items-center gap-2">
            <div className=" text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              {topic.group === "part1" ? "Part 1" : "Part 2 & Part 3"}
            </div>
            <div className=" inline-flex rounded-full bg-white/80  text-xs font-medium text-slate-500">
              <TopicCountLabel topic={topic} />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          <button
            type="button"
            onClick={onPreviewToggle}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-700"
          >
            {expanded ? "收起题目" : "查看题目"}
          </button>
          <Link
            href={`/dashboard/mock-exam/session?group=${topic.group}&topicId=${encodeURIComponent(topic.topicId)}`}
            className="inline-flex items-center justify-center rounded-full bg-blue-400 px-4 py-2 text-sm font-semibold text-white! transition-colors hover:bg-blue-700"
          >
            开始模考
          </Link>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 border-t border-blue-200/70 pt-4">
          {topic.group === "part1" ? (
            <Part1TopicPreview topic={topic} />
          ) : (
            <Part23TopicPreview topic={topic} />
          )}
        </div>
      ) : null}
    </article>
  );
}

export default function SpeakingMockTopicPicker({ catalog }: Props) {
  const [expandedPreviewKey, setExpandedPreviewKey] = useState<string | null>(
    null,
  );

  function getPreviewKey(group: SpeakingTopicGroup, topicId: string) {
    return `${group}:${topicId}`;
  }

  function handlePreviewToggle(group: SpeakingTopicGroup, topicId: string) {
    const nextKey = getPreviewKey(group, topicId);
    setExpandedPreviewKey((current) => (current === nextKey ? null : nextKey));
  }

  return (
    <div className="space-y-6">
      {/* <section className="rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6 shadow-sm sm:p-8">
        <div className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700 shadow-sm">
          Speaking Mock Selector
        </div>
        <h2 className="mt-5 text-3xl font-bold text-slate-900 sm:text-4xl">先选题，再决定查看还是开考</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          当前题库直接读取 `speaking_questions`。题目已拆成 Part 1 与 Part 2 &amp; Part 3 两个板块，先点 Topic，再选择下一步操作。
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.5rem] border border-white/80 bg-white/80 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Part 1 Topics</div>
            <div className="mt-2 text-3xl font-extrabold text-slate-900">{catalog.part1Topics.length}</div>
            <div className="mt-1 text-sm text-slate-500">适合先快速浏览高频短答题。</div>
          </div>
          <div className="rounded-[1.5rem] border border-white/80 bg-white/80 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Part 2 & Part 3 Topics</div>
            <div className="mt-2 text-3xl font-extrabold text-slate-900">{catalog.part23Topics.length}</div>
            <div className="mt-1 text-sm text-slate-500">按同一 `topic_id` 把 Cue Card 和追问绑定在一起。</div>
          </div>
        </div>
      </section> */}
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Part 1</h3>
              <p className="mt-1 text-sm text-slate-500">
                点击 Topic 后，可查看题目或直接进入模考。
              </p>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
              {catalog.part1Topics.length} Topics
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {catalog.part1Topics.map((topic) => (
              <TopicButton
                key={topic.topicId}
                expanded={
                  expandedPreviewKey === getPreviewKey("part1", topic.topicId)
                }
                topic={topic}
                onPreviewToggle={() =>
                  handlePreviewToggle("part1", topic.topicId)
                }
              />
            ))}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                Part 2 &amp; Part 3
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                同 Topic 下会同时展示 Cue Card 和对应的 Part 3 追问。
              </p>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
              {catalog.part23Topics.length} Topics
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {catalog.part23Topics.map((topic) => (
              <TopicButton
                key={topic.topicId}
                expanded={
                  expandedPreviewKey === getPreviewKey("part23", topic.topicId)
                }
                topic={topic}
                onPreviewToggle={() =>
                  handlePreviewToggle("part23", topic.topicId)
                }
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
