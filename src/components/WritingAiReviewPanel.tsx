"use client";

import {
  getTaskFulfillmentLabel,
  getTaskFulfillmentLabelZh,
  type WritingAiReview,
  type WritingCriterionKey,
} from "@/lib/ielts-writing-review";

const PRIORITY_STYLES = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
} as const;

export default function WritingAiReviewPanel({
  review,
}: {
  review: WritingAiReview;
}) {
  const criterionItems: Array<{
    key: WritingCriterionKey;
    label: string;
    labelZh: string;
  }> = [
    {
      key: "taskFulfillment",
      label: getTaskFulfillmentLabel(review.taskType),
      labelZh: getTaskFulfillmentLabelZh(review.taskType),
    },
    {
      key: "coherenceAndCohesion",
      label: "Coherence & Cohesion",
      labelZh: "连贯与衔接",
    },
    {
      key: "lexicalResource",
      label: "Lexical Resource",
      labelZh: "词汇资源",
    },
    {
      key: "grammaticalRangeAndAccuracy",
      label: "Grammar Range & Accuracy",
      labelZh: "语法多样性与准确性",
    },
  ];

  return (
    <section className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
            AI Writing Review
          </div>
          <div>
            <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">
              预估总分 {review.overallBand.toFixed(1)}
            </h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">{review.overview}</p>
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Word Count
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{review.wordCount}</div>
          <div className="mt-1 text-xs text-slate-500">
            {review.taskType === "part1" ? "建议 150+" : "建议 250+"}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {criterionItems.map((item) => {
          const criterion = review.criteria[item.key];

          return (
            <article
              key={item.key}
              className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                  <div className="mt-1 text-xs font-medium text-slate-500">{item.labelZh}</div>
                </div>
                <div className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">
                  {criterion.band.toFixed(1)}
                </div>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{criterion.comment}</p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="text-base font-bold text-slate-900">内容点评</h4>
          <div className="mt-3 space-y-3">
            {review.contentFeedback.map((item) => (
              <div
                key={item}
                className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="text-base font-bold text-slate-900">针对性提高建议</h4>
          <div className="mt-3 space-y-3">
            {review.improvementSuggestions.map((item, index) => (
              <article key={`${item.title}-${index}`} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${PRIORITY_STYLES[item.priority]}`}
                  >
                    {item.priority}
                  </span>
                  <h5 className="text-sm font-semibold text-slate-900">{item.title}</h5>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.action}</p>
                <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-6 text-slate-500">
                  练习方向：{item.example}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
