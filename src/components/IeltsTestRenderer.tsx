"use client";

import { useEffect, useMemo, useState } from "react";
import ListeningAudioPlayer from "@/components/ListeningAudioPlayer";
import type { IeltsQuestion, IeltsTable, IeltsTestData } from "@/types/ielts";

type LoadState = "idle" | "loading" | "success" | "error";
type QuestionResponse = string | string[];

interface Props {
  series?: string;
  bookNo?: number;
  testNo?: number;
  module?: string;
}

interface QuestionDisplayGroup {
  key: string;
  questions: IeltsQuestion[];
}

function buildApiUrl(props: Props) {
  const params = new URLSearchParams();
  if (props.series) params.set("series", props.series);
  if (typeof props.bookNo === "number") params.set("bookNo", String(props.bookNo));
  if (typeof props.testNo === "number") params.set("testNo", String(props.testNo));
  if (props.module) params.set("module", props.module);

  const query = params.toString();
  return query ? `/api/ielts/tests/latest?${query}` : "/api/ielts/tests/latest";
}

function typeLabel(type: string) {
  switch (type) {
    case "single_choice":
      return "单选";
    case "multiple_choice":
      return "多选";
    case "fill_blank":
      return "填空";
    case "matching":
      return "匹配";
    default:
      return "未知";
  }
}

function buildQuestionSignature(q: IeltsQuestion): string {
  const options = q.options
    .map((opt) => `${opt.label}|${opt.text}|${opt.sortOrder}`)
    .join("||");
  const images = q.imageUrls.join("||");
  return [q.type, q.subtitle, q.instruction, q.prompt, q.tableRef ?? "", options, images].join("###");
}

function buildQuestionGroups(questions: IeltsQuestion[]): QuestionDisplayGroup[] {
  const sorted = [...questions].sort((a, b) => a.number - b.number);
  const groups: QuestionDisplayGroup[] = [];

  for (const q of sorted) {
    const prevGroup = groups[groups.length - 1];
    const prev = prevGroup?.questions[prevGroup.questions.length - 1];
    const canMerge =
      Boolean(prev) &&
      prev.number + 1 === q.number &&
      buildQuestionSignature(prev) === buildQuestionSignature(q);

    if (!canMerge) {
      groups.push({ key: `group-${q.number}`, questions: [q] });
      continue;
    }

    prevGroup.questions.push(q);
  }

  return groups;
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeAnswerValue(value: string) {
  return value
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[’‘`]/g, "'")
    .replace(/[，、]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAnswerVariants(answer: string) {
  return answer
    .split(/(?:\s*\/\s*|\s*;\s*|\s*\|\s*|\s+or\s+)/i)
    .map((item) => normalizeAnswerValue(item))
    .filter(Boolean);
}

function parseAnswerSet(answer: string) {
  return answer
    .split(/(?:\s*,\s*|\s+and\s+|\s*&\s*|\s*\/\s*)/i)
    .map((item) => normalizeAnswerValue(item))
    .filter(Boolean)
    .sort();
}

function isQuestionCorrect(question: IeltsQuestion, response: QuestionResponse | undefined) {
  if (typeof response === "undefined") return false;

  if (question.type === "multiple_choice") {
    if (!Array.isArray(response)) return false;
    const selected = response.map(normalizeAnswerValue).sort();
    const expected = parseAnswerSet(question.answer);
    return selected.length > 0 && selected.length === expected.length && selected.every((value, index) => value === expected[index]);
  }

  if (Array.isArray(response)) return false;
  const normalizedResponse = normalizeAnswerValue(response);
  if (!normalizedResponse) return false;

  const answerVariants = parseAnswerVariants(question.answer);
  if (answerVariants.includes(normalizedResponse)) return true;

  if (question.type === "single_choice" || question.type === "matching") {
    const matchedOption = question.options.find((option) => normalizeAnswerValue(option.label) === normalizedResponse);
    if (matchedOption) {
      return answerVariants.includes(normalizeAnswerValue(matchedOption.text));
    }
  }

  return false;
}

function inlineInputClass(isRevealed: boolean, isCorrect: boolean) {
  if (!isRevealed) {
    return "border-b-2 border-slate-400 bg-transparent text-slate-900 outline-none focus:border-blue-500";
  }

  return isCorrect
    ? "border-b-2 border-emerald-500 bg-emerald-50 text-emerald-700 outline-none"
    : "border-b-2 border-rose-500 bg-rose-50 text-rose-700 outline-none";
}

function renderPromptWithBlank(
  question: IeltsQuestion,
  response: string,
  onChange: (value: string) => void,
  isRevealed: boolean,
  isCorrect: boolean
) {
  const prompt = question.prompt || "";
  const pattern = new RegExp(`\\(${question.number}\\)\\s*_+`, "g");
  const matches = [...prompt.matchAll(pattern)];

  if (matches.length === 0) {
    return (
      <div className="mt-2 flex flex-wrap items-end gap-3">
        {question.prompt ? <p className="text-slate-700">{question.prompt}</p> : null}
        <label className="inline-flex min-w-[180px] items-end">
          <span className="sr-only">Question {question.number}</span>
          <input
            value={response}
            onChange={(event) => onChange(event.target.value)}
            className={`w-full px-1 py-1 text-sm ${inlineInputClass(isRevealed, isCorrect)}`}
            placeholder={`Q${question.number}`}
          />
        </label>
      </div>
    );
  }

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, index) => {
    const start = match.index ?? 0;
    const fullMatch = match[0];
    const questionNo = match[0].match(/\((\d+)\)/)?.[1] ?? String(question.number);
    const leadingText = prompt.slice(lastIndex, start);

    if (leadingText) {
      nodes.push(
        <span key={`text-${index}`} className="whitespace-pre-wrap">
          {leadingText}
        </span>
      );
    }

    nodes.push(
      <label key={`input-${index}`} className="inline-flex items-end gap-1">
        <span className="text-slate-700">({questionNo})</span>
        <input
          value={response}
          onChange={(event) => onChange(event.target.value)}
          className={`min-w-[120px] px-1 py-1 text-sm ${inlineInputClass(isRevealed, isCorrect)}`}
          aria-label={`Question ${question.number}`}
        />
      </label>
    );

    lastIndex = start + fullMatch.length;
  });

  const trailingText = prompt.slice(lastIndex);
  if (trailingText) {
    nodes.push(
      <span key="tail" className="whitespace-pre-wrap">
        {trailingText}
      </span>
    );
  }

  return <div className="mt-2 flex flex-wrap items-end gap-x-2 gap-y-3 text-slate-700">{nodes}</div>;
}

function renderTableCellContent(
  cellText: string,
  questionsByNumber: Map<number, IeltsQuestion>,
  responses: Record<number, QuestionResponse>,
  onResponseChange: (questionNo: number, value: string) => void,
  answerVisibility: Record<string, boolean>,
) {
  const pattern = /\((\d+)\)\s*_+/g;
  const matches = [...cellText.matchAll(pattern)];
  if (matches.length === 0) return cellText;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, index) => {
    const start = match.index ?? 0;
    const questionNo = Number(match[1]);
    const leadingText = cellText.slice(lastIndex, start);
    const question = questionsByNumber.get(questionNo);
    const response = typeof responses[questionNo] === "string" ? (responses[questionNo] as string) : "";
    const isRevealed = answerVisibility[`question-${questionNo}`] ?? false;
    const isCorrect = question ? isQuestionCorrect(question, response) : false;

    if (leadingText) {
      nodes.push(
        <span key={`text-${questionNo}-${index}`} className="whitespace-pre-wrap">
          {leadingText}
        </span>
      );
    }

    nodes.push(
      <label key={`input-${questionNo}-${index}`} className="inline-flex items-end gap-1">
        <span>({questionNo})</span>
        <input
          value={response}
          onChange={(event) => onResponseChange(questionNo, event.target.value)}
          className={`min-w-[88px] px-1 py-1 text-sm ${inlineInputClass(isRevealed, isCorrect)}`}
          aria-label={`Question ${questionNo}`}
        />
      </label>
    );

    lastIndex = start + match[0].length;
  });

  const trailingText = cellText.slice(lastIndex);
  if (trailingText) {
    nodes.push(
      <span key="tail" className="whitespace-pre-wrap">
        {trailingText}
      </span>
    );
  }

  return <div className="flex flex-wrap items-end gap-x-2 gap-y-2">{nodes}</div>;
}

function QuestionAnswerFeedback({
  question,
  response,
  visible,
}: {
  question: IeltsQuestion;
  response: QuestionResponse | undefined;
  visible: boolean;
}) {
  if (!visible) return null;

  const isCorrect = isQuestionCorrect(question, response);
  const hasResponse = Array.isArray(response) ? response.length > 0 : Boolean(response?.trim());

  return (
    <div className={`mt-3 rounded-xl border px-3 py-3 text-sm ${isCorrect ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
      <p className="font-semibold">{hasResponse ? (isCorrect ? "回答正确" : "回答不正确") : "还没有作答"}</p>
      <p className="mt-1">正确答案: {question.answer || "-"}</p>
    </div>
  );
}

function QuestionEditor({
  question,
  response,
  onResponseChange,
  answerVisible,
}: {
  question: IeltsQuestion;
  response: QuestionResponse | undefined;
  onResponseChange: (value: QuestionResponse) => void;
  answerVisible: boolean;
}) {
  const isCorrect = isQuestionCorrect(question, response);

  if (question.type === "single_choice") {
    const selected = typeof response === "string" ? response : "";
    return (
      <div className="mt-3 space-y-2">
        {question.options.map((opt) => (
          <label key={`${question.number}-${opt.label}`} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-white/90 px-3 py-2">
            <input
              type="radio"
              name={`question-${question.number}`}
              checked={selected === opt.label}
              onChange={() => onResponseChange(opt.label)}
              className="mt-1"
            />
            <span className="text-sm text-slate-700">
              {opt.label}. {opt.text}
            </span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "multiple_choice") {
    const selected = Array.isArray(response) ? response : [];
    return (
      <div className="mt-3 space-y-2">
        {question.options.map((opt) => {
          const checked = selected.includes(opt.label);

          return (
            <label key={`${question.number}-${opt.label}`} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-white/90 px-3 py-2">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selected, opt.label]
                    : selected.filter((item) => item !== opt.label);
                  onResponseChange(next);
                }}
                className="mt-1"
              />
              <span className="text-sm text-slate-700">
                {opt.label}. {opt.text}
              </span>
            </label>
          );
        })}
      </div>
    );
  }

  if (question.type === "fill_blank") {
    const value = typeof response === "string" ? response : "";
    return renderPromptWithBlank(question, value, (next) => onResponseChange(next), answerVisible, isCorrect);
  }

  if (question.type === "matching") {
    const value = typeof response === "string" ? response : "";
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-600" htmlFor={`matching-${question.number}`}>
          选择答案
        </label>
        <input
          id={`matching-${question.number}`}
          type="text"
          value={value}
          onChange={(event) => onResponseChange(event.target.value)}
          className="w-24 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
          placeholder="如 A"
          maxLength={3}
        />
      </div>
    );
  }

  return null;
}

function TableView({
  table,
  questionsByNumber,
  responses,
  onResponseChange,
  answerVisibility,
  onToggleAnswers,
}: {
  table: IeltsTable;
  questionsByNumber: Map<number, IeltsQuestion>;
  responses: Record<number, QuestionResponse>;
  onResponseChange: (questionNo: number, value: string) => void;
  answerVisibility: Record<string, boolean>;
  onToggleAnswers: (key: string) => void;
}) {
  const tableQuestionNos = table.questionNumbers.filter((questionNo) => questionsByNumber.has(questionNo));

  return (
    <div className="rounded-[1.3rem] border border-[var(--line)] bg-[rgba(255,249,242,0.94)] p-4">
      <div className="overflow-x-auto rounded-xl border border-black/10 bg-white/70">
        <table className="min-w-full border-collapse text-sm">
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={`${table.id}-row-${rowIndex}`} className="border-t border-black/10 first:border-t-0">
                {row.map((cell) => {
                  const Tag = cell.tag === "th" ? "th" : "td";
                  return (
                    <Tag
                      key={`${table.id}-${rowIndex}-${cell.colIndex}`}
                      colSpan={cell.colspan}
                      rowSpan={cell.rowspan}
                      className="border-l border-black/10 px-3 py-2 text-left align-top first:border-l-0"
                    >
                      {renderTableCellContent(cell.text, questionsByNumber, responses, onResponseChange, answerVisibility)}
                    </Tag>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tableQuestionNos.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              tableQuestionNos.forEach((questionNo) => onToggleAnswers(`question-${questionNo}`));
            }}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            查看答案
          </button>

          <div className="mt-3 grid gap-2">
            {tableQuestionNos
              .map((questionNo) => questionsByNumber.get(questionNo))
              .filter(Boolean)
              .map((question) => (
                <QuestionAnswerFeedback
                  key={`table-answer-${question?.number}`}
                  question={question as IeltsQuestion}
                  response={responses[(question as IeltsQuestion).number]}
                  visible={answerVisibility[`question-${(question as IeltsQuestion).number}`] ?? false}
                />
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function IeltsTestRenderer(props: Props) {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<IeltsTestData | null>(null);
  const [responses, setResponses] = useState<Record<number, QuestionResponse>>({});
  const [answerVisibility, setAnswerVisibility] = useState<Record<string, boolean>>({});

  const apiUrl = useMemo(() => buildApiUrl(props), [props.series, props.bookNo, props.testNo, props.module]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState("loading");
      setError("");

      try {
        const response = await fetch(apiUrl, { cache: "no-store" });
        const json = (await response.json()) as { data?: IeltsTestData; error?: string };

        if (response.status === 404) {
          if (!cancelled) {
            setData(null);
            setResponses({});
            setAnswerVisibility({});
            setState("success");
          }
          return;
        }

        if (!response.ok) {
          throw new Error(json.error || "Failed to load IELTS test data.");
        }

        if (!cancelled) {
          setData(json.data ?? null);
          setResponses({});
          setAnswerVisibility({});
          setState("success");
        }
      } catch (err) {
        if (!cancelled) {
          setState("error");
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  if (state === "loading" || state === "idle") {
    return <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-5">正在加载题目...</div>;
  }

  if (state === "error") {
    return <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-5 text-red-700">加载失败: {error}</div>;
  }

  if (!data) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-[var(--line)] bg-white/70 p-8 text-center">
        <p className="text-lg font-semibold text-slate-900">当前筛选下还没有题目数据</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {props.series || "Cambridge IELTS"} · Book {props.bookNo ?? "-"} · {props.module || "-"}
          {typeof props.testNo === "number" ? ` · Test ${props.testNo}` : ""}
        </p>
      </div>
    );
  }

  const tableMap = new Map(data.tables.map((t) => [t.id, t]));
  const questionsByNumber = new Map(data.questions.map((question) => [question.number, question]));

  function updateResponse(questionNo: number, value: QuestionResponse) {
    setResponses((current) => ({ ...current, [questionNo]: value }));
  }

  function toggleAnswerVisibility(key: string) {
    setAnswerVisibility((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/68 p-6 shadow-[0_16px_40px_rgba(58,46,34,0.06)]">
        {data.audioUrls.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {data.audioUrls.map((url, index) => (
              <ListeningAudioPlayer
                key={url}
                src={url}
                title={data.audioUrls.length > 1 ? `Audio ${index + 1}` : "Listening Audio"}
              />
            ))}
          </div>
        ) : null}
      </section>

      {data.parts.map((part) => {
        const partQuestions = data.questions.filter((q) => q.part === part.part && !q.tableRef);
        const questionGroups = buildQuestionGroups(partQuestions);
        const partTables = part.tables.map((id) => tableMap.get(id)).filter(Boolean) as IeltsTable[];

        return (
          <section key={part.part} className="rounded-[1.75rem] border border-[var(--line)] bg-white/68 p-6 shadow-[0_16px_40px_rgba(58,46,34,0.06)]">
            <h2 className="text-xl font-semibold text-slate-900">{part.part}</h2>

            {partTables.length > 0 ? (
              <div className="mt-4 flex flex-col gap-4">
                {partTables.map((table) => (
                  <TableView
                    key={table.id}
                    table={table}
                    questionsByNumber={questionsByNumber}
                    responses={responses}
                    onResponseChange={(questionNo, value) => updateResponse(questionNo, value)}
                    answerVisibility={answerVisibility}
                    onToggleAnswers={toggleAnswerVisibility}
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3">
              {questionGroups.map((group) => {
                const first = group.questions[0];
                const firstNo = first.number;
                const lastNo = group.questions[group.questions.length - 1].number;
                const qLabel = group.questions.length > 1 ? `Q${firstNo}-${lastNo}` : `Q${firstNo}`;
                const sharedImageUrls = [...new Set(group.questions.flatMap((question) => question.imageUrls))];
                const sharedSubtitles = uniqueNonEmpty(group.questions.map((question) => question.subtitle));
                const sharedInstructions = uniqueNonEmpty(group.questions.map((question) => question.instruction));

                return (
                  <article key={group.key} className="rounded-[1.4rem] border border-[var(--line)] bg-[rgba(255,249,242,0.96)] p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-white">{qLabel}</span>
                      <span className="rounded-full border border-[var(--line)] bg-white/80 px-2 py-0.5 text-slate-700">
                        {typeLabel(first.type)}
                      </span>
                      {group.questions.length > 1 ? (
                        <span className="rounded-full border border-[var(--line)] bg-white/80 px-2 py-0.5 text-slate-700">
                          共 {group.questions.length} 题
                        </span>
                      ) : null}
                    </div>

                    {sharedSubtitles.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {sharedSubtitles.map((subtitle) => (
                          <p key={`${group.key}-${subtitle}`} className="text-sm text-slate-500">
                            {subtitle}
                          </p>
                        ))}
                      </div>
                    ) : null}

                    {sharedInstructions.length > 0 ? (
                      <div className="mt-1 space-y-1">
                        {sharedInstructions.map((instruction) => (
                          <p key={`${group.key}-${instruction}`} className="text-sm font-medium text-slate-800">
                            {instruction}
                          </p>
                        ))}
                      </div>
                    ) : null}

                    {sharedImageUrls.length > 0 ? (
                      <div className="mt-3 grid gap-3">
                        {sharedImageUrls.map((url, index) => (
                          <a
                            key={`${group.key}-img-${index}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-xl border border-[var(--line)] bg-white"
                          >
                            <img
                              src={url}
                              alt={`${qLabel} shared image ${index + 1}`}
                              loading="lazy"
                              className="h-auto w-full object-contain"
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-3 grid gap-4">
                      {group.questions.map((question) => {
                        const answerKey = `question-${question.number}`;
                        const response = responses[question.number];

                        return (
                          <div key={`question-card-${question.number}`} className="rounded-2xl border border-[var(--line)] bg-white/85 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900">Question {question.number}</p>
                              <span className="text-xs text-slate-400">{typeLabel(question.type)}</span>
                            </div>

                            {question.subtitle && !sharedSubtitles.includes(question.subtitle.trim()) ? (
                              <p className="mt-2 text-sm text-slate-500">{question.subtitle}</p>
                            ) : null}

                            {question.instruction && !sharedInstructions.includes(question.instruction.trim()) ? (
                              <p className="mt-1 text-sm font-medium text-slate-800">{question.instruction}</p>
                            ) : null}

                            {question.prompt && question.type !== "fill_blank" ? (
                              <p className="mt-2 text-slate-700">{question.prompt}</p>
                            ) : null}

                            <QuestionEditor
                              question={question}
                              response={response}
                              onResponseChange={(value) => updateResponse(question.number, value)}
                              answerVisible={answerVisibility[answerKey] ?? false}
                            />

                            <div className="mt-4">
                              <button
                                type="button"
                                onClick={() => toggleAnswerVisibility(answerKey)}
                                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                              >
                                查看答案
                              </button>
                              <QuestionAnswerFeedback
                                question={question}
                                response={response}
                                visible={answerVisibility[answerKey] ?? false}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
