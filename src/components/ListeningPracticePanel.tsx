"use client";

import {
  createElement,
  Fragment,
  memo,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import ListeningAudioPlayer from "@/components/ListeningAudioPlayer";
import type { ListeningPracticePaper, ListeningQuestion } from "@/lib/ielts-db";
import { NeedHideHTML } from "@/constants/htmlhide";

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

function parseAnswerValues(
  answerText: string | null,
  answerJson: string | null,
) {
  const rawValues: string[] = [];

  if (answerText) {
    rawValues.push(answerText);
  }

  if (answerJson) {
    try {
      const parsed = JSON.parse(answerJson);
      if (Array.isArray(parsed)) {
        rawValues.push(
          ...parsed.filter((item): item is string => typeof item === "string"),
        );
      }
    } catch {
      return rawValues;
    }
  }

  return rawValues;
}

function getAcceptedValues(
  answerText: string | null,
  answerJson: string | null,
) {
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

function isCorrectAnswer(
  value: AnswerValue | undefined,
  answerText: string | null,
  answerJson: string | null,
) {
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

    return (
      JSON.stringify(normalizedValues) === JSON.stringify(normalizedAnswers)
    );
  }

  return false;
}

function parseStyleAttribute(style: string) {
  return style
    .split(";")
    .reduce<Record<string, string | number>>((acc, rule) => {
      const [rawProp, rawValue] = rule.split(":");
      if (!rawProp || !rawValue) return acc;

      const prop = rawProp
        .trim()
        .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
      const value = rawValue.trim();

      acc[prop] = /^\d+(\.\d+)?$/.test(value) ? Number(value) : value;
      return acc;
    }, {});
}

function getInlineInputClasses(correct: boolean | null) {
  if (correct === true) {
    return "border-emerald-400 bg-emerald-50 text-emerald-900";
  }

  if (correct === false) {
    return "border-rose-400 bg-rose-50 text-rose-900";
  }

  return "border-slate-300 bg-white text-slate-900";
}

function getOptionValue(option: { label: string; text: string }) {
  return option.label.trim() || option.text.trim();
}

function replacePlaceholdersWithInputs(
  text: string,
  questionsByNo: Map<number, ListeningQuestion>,
  answers: Record<string, AnswerValue>,
  submitted: boolean,
  onAnswerChange: (questionId: string, value: string) => void,
) {
  const pattern = /#####-(\d+)-#####/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(text)) !== null) {
    const [token, rawQuestionNo] = match;
    const start = match.index;
    const questionNo = Number(rawQuestionNo);
    const question = questionsByNo.get(questionNo);

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    if (!question) {
      nodes.push(token);
      lastIndex = start + token.length;
      continue;
    }

    const answer = answers[question.id];
    const correct = submitted
      ? isCorrectAnswer(answer, question.answerText, question.answerJson)
      : null;
    const acceptedAnswers = parseAnswerValues(
      question.answerText,
      question.answerJson,
    );

    nodes.push(
      <span
        key={`${question.id}-wrapper`}
        className="mx-1 inline-flex max-w-full align-middle"
      >
        <span className="relative inline-flex">
          <input
            type="text"
            value={typeof answer === "string" ? answer : ""}
            onChange={(event) =>
              onAnswerChange(question.id, event.target.value)
            }
            aria-label={`Question ${question.questionNo}`}
            className={`h-9 min-w-24 max-w-40 rounded-md border px-2 text-center text-sm font-semibold outline-none transition-colors focus:border-slate-500 ${getInlineInputClasses(correct)}`}
          />
          <span className="pointer-events-none absolute -top-[5px] left-2 rounded bg-white px-1 text-[12px] font-bold leading-none text-slate-500">
            {question.questionNo}
          </span>
        </span>
        {submitted && acceptedAnswers.length > 0 ? (
          <span className="ml-2 inline-flex items-center text-xs font-medium text-slate-500">
            {acceptedAnswers[0]}
          </span>
        ) : null}
      </span>,
    );

    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function arraysEqual(left: string[], right: string[]) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function renderHtmlNode(
  node: ChildNode,
  questionsByNo: Map<number, ListeningQuestion> | null,
  answers: Record<string, AnswerValue>,
  submitted: boolean,
  onAnswerChange: (questionId: string, value: string) => void,
  key: string,
): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (!questionsByNo || !text.includes("#####-")) {
      return text;
    }

    return (
      <Fragment key={key}>
        {replacePlaceholdersWithInputs(
          text,
          questionsByNo,
          answers,
          submitted,
          onAnswerChange,
        )}
      </Fragment>
    );
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  const props: Record<string, unknown> = { key };

  for (const attr of Array.from(element.attributes)) {
    if (attr.name === "class") {
      props.className = attr.value;
      continue;
    }

    if (attr.name === "style") {
      props.style = parseStyleAttribute(attr.value) as CSSProperties;
      continue;
    }

    if (attr.name === "colspan") {
      props.colSpan = Number(attr.value);
      continue;
    }

    if (attr.name === "rowspan") {
      props.rowSpan = Number(attr.value);
      continue;
    }

    props[attr.name] = attr.value;
  }

  const children = Array.from(element.childNodes).map((child, index) =>
    renderHtmlNode(
      child,
      questionsByNo,
      answers,
      submitted,
      onAnswerChange,
      `${key}-${index}`,
    ),
  );

  return createElement(tagName, props, ...children);
}

const HtmlBlock = memo(function HtmlBlock({
  html,
  questionsByNo = null,
  answers,
  submitted,
  onAnswerChange,
}: {
  html: string | null;
  questionsByNo?: Map<number, ListeningQuestion> | null;
  answers: Record<string, AnswerValue>;
  submitted: boolean;
  onAnswerChange: (questionId: string, value: string) => void;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!html) return null;

  if (!isMounted || !questionsByNo) {
    return (
      <div
        className="ielts-richtext prose prose-slate max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const children = Array.from(doc.body.childNodes).map((node, index) =>
    renderHtmlNode(
      node,
      questionsByNo,
      answers,
      submitted,
      onAnswerChange,
      `node-${index}`,
    ),
  );

  return (
    <div className="ielts-richtext prose prose-slate max-w-none text-sm">
      {children}
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.html !== nextProps.html) return false;
  if (prevProps.questionsByNo !== nextProps.questionsByNo) return false;
  if (prevProps.submitted !== nextProps.submitted) return false;

  if (!prevProps.questionsByNo && !nextProps.questionsByNo) {
    return true;
  }

  return prevProps.answers === nextProps.answers && prevProps.onAnswerChange === nextProps.onAnswerChange;
});

export default function ListeningPracticePanel({
  paper,
}: {
  paper: ListeningPracticePaper;
}) {
  const moduleLabel =
    paper.module === "reading"
      ? "Reading Practice"
      : paper.module === "writing"
        ? "Writing Practice"
        : "Listening Practice";
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [activePartId, setActivePartId] = useState(() => paper.parts[0]?.id ?? "");
  const [submittedParts, setSubmittedParts] = useState<Record<string, boolean>>({});
  const updateAnswer = (questionId: string, value: string) =>
    setAnswers((current) => ({
      ...current,
      [questionId]: value,
    }));
  const updateGroupAnswers = (questionIds: string[], value: string[]) =>
    setAnswers((current) => {
      const next = { ...current };
      for (const questionId of questionIds) {
        next[questionId] = value;
      }
      return next;
    });

  const currentPart = useMemo(
    () => paper.parts.find((part) => part.id === activePartId) ?? paper.parts[0] ?? null,
    [activePartId, paper],
  );
  const currentIsWriting = paper.module === "writing";
  const currentSubmitted = currentPart ? Boolean(submittedParts[currentPart.id]) : false;
  const currentWritingAnswerKey = currentPart ? `writing:${currentPart.id}` : "";

  const currentPartQuestions = useMemo(
    () =>
      currentPart
        ? currentPart.groups.flatMap((group) =>
            group.questions.map((question) => ({
              ...question,
              group,
              part: currentPart,
            })),
          )
        : [],
    [currentPart],
  );

  const totalQuestions = currentPartQuestions.length;
  const correctCount = currentSubmitted
    ? currentPartQuestions.filter((question) =>
        isCorrectAnswer(
          answers[question.id],
          question.answerText,
          question.answerJson,
        ),
      ).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-[var(--line)] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
              {moduleLabel}
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
              {paper.title} · Test {paper.testNo}
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {paper.parts.map((part) => {
              const active = part.id === currentPart?.id;

              return (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => setActivePartId(part.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  Part {part.partNo}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentSubmitted && !currentIsWriting ? (
              <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                得分 {correctCount} / {totalQuestions}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (!currentPart) return;

                setSubmittedParts((current) => ({
                  ...current,
                  [currentPart.id]: true,
                }));
              }}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              {currentIsWriting ? "保存作文" : "提交并查看答案"}
            </button>
          </div>
        </div>
      </div>

      {currentPart ? (
        <section
          key={currentPart.id}
          className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-sm"
        >
          <div className=" px-6 py-4 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">
                  {currentPart.title}
                </h3>
                {currentPart.instructionHtml ? (
                  <div className="mt-2">
                    <HtmlBlock
                      html={currentPart.instructionHtml}
                      answers={answers}
                      submitted={currentSubmitted}
                      onAnswerChange={updateAnswer}
                    />
                  </div>
                ) : null}
              </div>
              {currentPart.audioUrl ? (
                <div className="text-xs font-medium text-slate-500">
                  Audio ready
                </div>
              ) : null}
            </div>

            {currentPart.audioUrl ? (
              <div className="mt-5">
                <ListeningAudioPlayer
                  src={currentPart.audioUrl}
                  title={`${paper.title} Test ${paper.testNo} · Part ${currentPart.partNo}`}
                />
              </div>
            ) : null}

            {currentPart.contentHtml ? (
              <HtmlBlock
                html={currentPart.contentHtml}
                answers={answers}
                submitted={currentSubmitted}
                onAnswerChange={updateAnswer}
              />
            ) : null}
          </div>

          <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
            {currentIsWriting ? (
              // <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                <div className="space-y-3">
                  <textarea
                    value={typeof answers[currentWritingAnswerKey] === "string" ? answers[currentWritingAnswerKey] : ""}
                    onChange={(event) => updateAnswer(currentWritingAnswerKey, event.target.value)}
                    placeholder="在这里开始写作..."
                    className="min-h-[420px] w-full rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-sm leading-7 text-slate-700 outline-none transition-colors focus:border-slate-400"
                  />
                </div>
              // </div>
            ) : currentPart.groups.map((group) => (
              <article
                key={group.id}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
              >
                {(() => {
                  const questionsByNo = new Map(
                    group.questions.map(
                      (question) => [question.questionNo, question] as const,
                    ),
                  );
                  const inlineFillBlank =
                    group.questionType === "fill_blank" &&
                    Boolean(group.contentHtml || group.instructionHtml);
                  const groupedMultipleChoice =
                    group.questionType === "multiple_choice" &&
                    group.questions.length > 1 &&
                    new Set(
                      group.questions.map((question) =>
                        stripHtml(question.stem || group.title),
                      ),
                    ).size === 1;

                  return (
                    <>
                      <div className="space-y-3">
                        {/* <div className="flex flex-wrap items-start justify-between gap-3">
                          {group.answerRule ? (
                            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                              {group.answerRule}
                            </div>
                          ) : null}
                        </div> */}

                        {group.instructionHtml ? (
                          <HtmlBlock
                            html={group.instructionHtml}
                            questionsByNo={
                              inlineFillBlank ? questionsByNo : null
                            }
                            answers={answers}
                            submitted={currentSubmitted}
                            onAnswerChange={updateAnswer}
                          />
                        ) : null}
                        {group.contentHtml && (NeedHideHTML !== group.contentHtml) ? (
                          <div className="">
                            <HtmlBlock
                              html={group.contentHtml}
                              questionsByNo={
                                inlineFillBlank ? questionsByNo : null
                              }
                              answers={answers}
                              submitted={currentSubmitted}
                              onAnswerChange={updateAnswer}
                            />
                          </div>
                        ) : null}

                        {/* {group.sharedOptions.length > 0 && group.questionType !== "fill_blank" ? (
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
                  ) : null} */}
                      </div>

                      {!inlineFillBlank ? (
                        <div className="mt-5 space-y-3">
                          {groupedMultipleChoice
                            ? (() => {
                                const prompt =
                                  stripHtml(group.questions[0]?.stem) ||
                                  stripHtml(group.title);
                                const selectedValues = Array.isArray(
                                  answers[group.questions[0]?.id],
                                )
                                  ? (answers[group.questions[0].id] as string[])
                                  : [];
                                const correct = currentSubmitted
                                  ? group.questions.every((question) =>
                                      isCorrectAnswer(
                                        answers[question.id],
                                        question.answerText,
                                        question.answerJson,
                                      ),
                                    )
                                  : null;
                                const acceptedAnswers = parseAnswerValues(
                                  group.questions[0]?.answerText ?? null,
                                  group.questions[0]?.answerJson ?? null,
                                )
                                  .map((item) => {
                                    const match = item.match(
                                      /^\s*([A-Z])\.\s*(.*)$/i,
                                    );
                                    return normalizeText(
                                      match ? match[1] : item,
                                    );
                                  })
                                  .filter(Boolean);
                                const toggleOption = (value: string) => {
                                  const normalizedValue = normalizeText(value);
                                  const nextValues = selectedValues.includes(
                                    normalizedValue,
                                  )
                                    ? selectedValues.filter(
                                        (item) => item !== normalizedValue,
                                      )
                                    : [...selectedValues, normalizedValue];

                                  updateGroupAnswers(
                                    group.questions.map(
                                      (question) => question.id,
                                    ),
                                    nextValues,
                                  );
                                };

                                return (
                                  <div
                                    className={`rounded-2xl border px-4 py-4 ${
                                      currentSubmitted
                                        ? correct
                                          ? "border-emerald-200 bg-emerald-50/70"
                                          : "border-rose-200 bg-rose-50/70"
                                        : "border-slate-200 bg-slate-50/60"
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="space-y-1">
                                        <div className="text-sm font-semibold text-slate-900">
                                          Questions{" "}
                                          {group.questionRangeStart ??
                                            group.questions[0]?.questionNo}
                                          -
                                          {group.questionRangeEnd ??
                                            group.questions.at(-1)?.questionNo}
                                        </div>
                                        <div className="text-sm leading-6 text-slate-700">
                                          {prompt}
                                        </div>
                                      </div>
                                      {currentSubmitted ? (
                                        <div
                                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                            correct
                                              ? "bg-emerald-100 text-emerald-700"
                                              : "bg-rose-100 text-rose-700"
                                          }`}
                                        >
                                          {correct ? "Correct" : "Incorrect"}
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="mt-4 space-y-2">
                                      {group.sharedOptions.map((option) => {
                                        const optionValue = normalizeText(
                                          getOptionValue(option),
                                        );
                                        const checked =
                                          selectedValues.includes(optionValue);

                                        return (
                                          <label
                                            key={option.id}
                                            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors ${
                                              checked
                                                ? "border-slate-400 bg-white"
                                                : "border-slate-200 bg-white/80 hover:border-slate-300"
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={() =>
                                                toggleOption(getOptionValue(option))
                                              }
                                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                                            />
                                            <span className="text-slate-700">
                                              {option.label ? (
                                                <span className="mr-2 font-semibold text-slate-900">
                                                  {option.label}.
                                                </span>
                                              ) : null}
                                              <span>{option.text}</span>
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>

                                    {currentSubmitted && acceptedAnswers.length > 0 ? (
                                      <div className="mt-3 text-sm text-slate-700">
                                        正确答案:{" "}
                                        <span className="font-semibold text-slate-900">
                                          {acceptedAnswers
                                            .map((item) => item.toUpperCase())
                                            .join(" / ")}
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })()
                            : group.questions.map((question) => {
                                const answer = answers[question.id];
                                const correct = currentSubmitted
                                  ? isCorrectAnswer(
                                      answer,
                                      question.answerText,
                                      question.answerJson,
                                    )
                                  : null;
                                const hasOptions =
                                  group.sharedOptions.length > 0 &&
                                  group.questionType !== "fill_blank";
                                const acceptedAnswers = parseAnswerValues(
                                  question.answerText,
                                  question.answerJson,
                                );

                                return (
                                  <div
                                    key={question.id}
                                    className={`rounded-2xl border px-4 py-4 ${
                                      currentSubmitted
                                        ? correct
                                          ? "border-emerald-200 bg-emerald-50/70"
                                          : "border-rose-200 bg-rose-50/70"
                                        : "border-slate-200 bg-slate-50/60"
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="space-y-1">
                                        {/* <div className="text-sm font-semibold text-slate-900">
                                          Question {question.questionNo}
                                        </div> */}
                                        <div className="text-sm leading-6 text-slate-700">
                                          {stripHtml(question.stem) ||
                                            stripHtml(group.title)}
                                        </div>
                                        {question.subLabel ? (
                                          <div className="text-sm text-slate-500">
                                            {stripHtml(question.subLabel)}
                                          </div>
                                        ) : null}
                                      </div>
                                      {currentSubmitted ? (
                                        <div
                                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                            correct
                                              ? "bg-emerald-100 text-emerald-700"
                                              : "bg-rose-100 text-rose-700"
                                          }`}
                                        >
                                          {correct ? "Correct" : "Incorrect"}
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="mt-4">
                                      {hasOptions ? (
                                        <div className="space-y-2">
                                          {group.sharedOptions.map((option) => (
                                            (() => {
                                              const optionValue = getOptionValue(option);

                                              return (
                                            <label
                                              key={option.id}
                                              className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors ${
                                                typeof answer === "string" &&
                                                answer === optionValue
                                                  ? "border-slate-400 bg-white"
                                                  : "border-slate-200 bg-white/80 hover:border-slate-300"
                                              }`}
                                            >
                                              <input
                                                type="radio"
                                                name={`question-${question.id}`}
                                                value={optionValue}
                                                checked={
                                                  typeof answer === "string" &&
                                                  answer === optionValue
                                                }
                                                onChange={(event) =>
                                                  updateAnswer(
                                                    question.id,
                                                    event.target.value,
                                                  )
                                                }
                                                className="mt-0.5 h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-400"
                                              />
                                              <span className="text-slate-700">
                                                {option.label ? (
                                                  <span className="mr-2 font-semibold text-slate-900">
                                                    {option.label}.
                                                  </span>
                                                ) : null}
                                                <span>{option.text}</span>
                                              </span>
                                            </label>
                                              );
                                            })()
                                          ))}
                                        </div>
                                      ) : (
                                        <input
                                          type="text"
                                          value={
                                            typeof answer === "string"
                                              ? answer
                                              : ""
                                          }
                                          onChange={(event) =>
                                            updateAnswer(
                                              question.id,
                                              event.target.value,
                                            )
                                          }
                                          placeholder="输入你的答案"
                                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400"
                                        />
                                      )}
                                    </div>

                                    {currentSubmitted && acceptedAnswers.length > 0 ? (
                                      <div className="mt-3 text-sm text-slate-700">
                                        正确答案:{" "}
                                        <span className="font-semibold text-slate-900">
                                          {acceptedAnswers.join(" / ")}
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
