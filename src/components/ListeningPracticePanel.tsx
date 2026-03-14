"use client";

import { useMemo, useState } from "react";
import ListeningAudioPlayer from "@/components/ListeningAudioPlayer";
import type { ListeningPracticePaper } from "@/lib/ielts-db";

type AnswerValue = string | string[];

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function stripHtml(html: string | null) {
  if (!html) return "";

  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAnswerValues(answerText: string | null, answerJson: string | null) {
  const rawValues: string[] = [];

  if (answerText) {
    rawValues.push(answerText);
  }

  if (answerJson) {
    try {
      const parsed = JSON.parse(answerJson);
      if (Array.isArray(parsed)) {
        rawValues.push(...parsed.filter((item): item is string => typeof item === "string"));
      }
    } catch {
      return rawValues;
    }
  }

  return rawValues;
}

function getAcceptedValues(answerText: string | null, answerJson: string | null) {
  const accepted = new Set<string>();

  for (const raw of parseAnswerValues(answerText, answerJson)) {
    const normalized = normalizeText(raw);
    if (normalized) accepted.add(normalized);

    const match = raw.match(/^\s*([A-Z])\.\s*(.*)$/i);
    if (match) {
      accepted.add(normalizeText(match[1]));
      accepted.add(normalizeText(match[2]));
    }
  }

  return accepted;
}

function isCorrectAnswer(value: AnswerValue | undefined, answerText: string | null, answerJson: string | null) {
  const accepted = getAcceptedValues(answerText, answerJson);
  if (accepted.size === 0) return false;

  if (typeof value === "string") {
    return accepted.has(normalizeText(value));
  }

  if (Array.isArray(value)) {
    const normalizedValues = value.map(normalizeText).filter(Boolean).sort();
    const normalizedAnswers = parseAnswerValues(answerText, answerJson)
      .map((item) => {
        const match = item.match(/^\s*([A-Z])\.\s*(.*)$/i);
        return normalizeText(match ? match[1] : item);
      })
      .filter(Boolean)
      .sort();

    return JSON.stringify(normalizedValues) === JSON.stringify(normalizedAnswers);
  }

  return false;
}

function HtmlBlock({ html }: { html: string | null }) {
  if (!html) return null;

  return <div className="prose prose-slate max-w-none text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function ListeningPracticePanel({ paper }: { paper: ListeningPracticePaper }) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitted, setSubmitted] = useState(false);

  const flatQuestions = useMemo(
    () =>
      paper.parts.flatMap((part) =>
        part.groups.flatMap((group) =>
          group.questions.map((question) => ({
            ...question,
            group,
            part,
          })),
        ),
      ),
    [paper],
  );

  const totalQuestions = flatQuestions.length;
  const correctCount = submitted
    ? flatQuestions.filter((question) => isCorrectAnswer(answers[question.id], question.answerText, question.answerJson)).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-[var(--line)] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Listening Practice</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
              {paper.title} · Test {paper.testNo}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              当前共 {paper.parts.length} 个 Part，{totalQuestions} 道题。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {submitted ? (
              <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                得分 {correctCount} / {totalQuestions}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setSubmitted(true)}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              提交并查看答案
            </button>
          </div>
        </div>
      </div>

      {paper.parts.map((part) => (
        <section
          key={part.id}
          className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-sm"
        >
          <div className="border-b border-[var(--line)] px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Part {part.partNo}</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">{part.title}</h3>
              </div>
              {part.audioUrl ? <div className="text-xs font-medium text-slate-500">Audio ready</div> : null}
            </div>

            {part.audioUrl ? (
              <div className="mt-5">
                <ListeningAudioPlayer src={part.audioUrl} title={`${paper.title} Test ${paper.testNo} · Part ${part.partNo}`} />
              </div>
            ) : null}

            {part.instructionHtml ? (
              <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-4">
                <HtmlBlock html={part.instructionHtml} />
              </div>
            ) : null}

            {part.contentHtml ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <HtmlBlock html={part.contentHtml} />
              </div>
            ) : null}
          </div>

          <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
            {part.groups.map((group) => (
              <article key={group.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">
                        {group.title || `Questions ${group.questionRangeStart ?? ""}-${group.questionRangeEnd ?? ""}`}
                      </h4>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                        {group.questionType.replaceAll("_", " ")}
                      </p>
                    </div>
                    {group.answerRule ? (
                      <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                        {group.answerRule}
                      </div>
                    ) : null}
                  </div>

                  {group.instructionHtml ? <HtmlBlock html={group.instructionHtml} /> : null}
                  {group.contentHtml ? (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                      <HtmlBlock html={group.contentHtml} />
                    </div>
                  ) : null}

                  {group.sharedOptions.length > 0 && group.questionType !== "fill_blank" ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Options</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {group.sharedOptions.map((option) => (
                          <div key={option.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                            {option.label ? <span className="mr-2 font-semibold text-slate-900">{option.label}.</span> : null}
                            <span>{option.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 space-y-3">
                  {group.questions.map((question) => {
                    const answer = answers[question.id];
                    const correct = submitted
                      ? isCorrectAnswer(answer, question.answerText, question.answerJson)
                      : null;
                    const hasOptions = group.sharedOptions.length > 0 && group.questionType !== "fill_blank";
                    const acceptedAnswers = parseAnswerValues(question.answerText, question.answerJson);

                    return (
                      <div
                        key={question.id}
                        className={`rounded-2xl border px-4 py-4 ${
                          submitted
                            ? correct
                              ? "border-emerald-200 bg-emerald-50/70"
                              : "border-rose-200 bg-rose-50/70"
                            : "border-slate-200 bg-slate-50/60"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-slate-900">Question {question.questionNo}</div>
                            <div className="text-sm leading-6 text-slate-700">
                              {stripHtml(question.stem) || stripHtml(group.title)}
                            </div>
                            {question.subLabel ? <div className="text-sm text-slate-500">{stripHtml(question.subLabel)}</div> : null}
                          </div>
                          {submitted ? (
                            <div
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                correct ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {correct ? "Correct" : "Incorrect"}
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4">
                          {hasOptions ? (
                            <select
                              value={typeof answer === "string" ? answer : ""}
                              onChange={(event) =>
                                setAnswers((current) => ({
                                  ...current,
                                  [question.id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400"
                            >
                              <option value="">请选择答案</option>
                              {group.sharedOptions.map((option) => (
                                <option key={option.id} value={option.label}>
                                  {option.label ? `${option.label}. ${option.text}` : option.text}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={typeof answer === "string" ? answer : ""}
                              onChange={(event) =>
                                setAnswers((current) => ({
                                  ...current,
                                  [question.id]: event.target.value,
                                }))
                              }
                              placeholder="输入你的答案"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400"
                            />
                          )}
                        </div>

                        {submitted && acceptedAnswers.length > 0 ? (
                          <div className="mt-3 text-sm text-slate-700">
                            正确答案: <span className="font-semibold text-slate-900">{acceptedAnswers.join(" / ")}</span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
