"use client";

import { useEffect, useMemo, useState } from "react";
import type { IeltsQuestion, IeltsTable, IeltsTestData } from "@/types/ielts";

type LoadState = "idle" | "loading" | "success" | "error";

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

    if (prevGroup) {
      prevGroup.questions.push(q);
    }
  }

  return groups;
}

function TableView({ table }: { table: IeltsTable }) {
  return (
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
                    {cell.text}
                  </Tag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function IeltsTestRenderer(props: Props) {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<IeltsTestData | null>(null);

  const apiUrl = useMemo(() => buildApiUrl(props), [props.series, props.bookNo, props.testNo, props.module]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState("loading");
      setError("");

      try {
        const response = await fetch(apiUrl, { cache: "no-store" });
        const json = (await response.json()) as { data?: IeltsTestData; error?: string };

        if (!response.ok) {
          throw new Error(json.error || "Failed to load IELTS test data.");
        }

        if (!cancelled) {
          setData(json.data ?? null);
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
    return <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-5">暂无题目数据。</div>;
  }

  const tableMap = new Map(data.tables.map((t) => [t.id, t]));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/68 p-6 shadow-[0_16px_40px_rgba(58,46,34,0.06)]">
        <h1 className="text-2xl font-semibold text-slate-900">{data.title}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {data.series} Book {data.bookNo ?? "-"} Test {data.testNo ?? "-"} ({data.module || "-"})
          {data.testCode ? ` · ${data.testCode}` : ""}
        </p>
        <p className="mt-1 text-xs text-slate-500">来源: {data.sourceUrl}</p>

        {data.audioUrls.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {data.audioUrls.map((url) => (
              <audio key={url} controls className="w-full">
                <source src={url} />
              </audio>
            ))}
          </div>
        ) : null}
      </section>

      {data.parts.map((part) => {
        const partQuestions = data.questions.filter((q) => q.part === part.part);
        const questionGroups = buildQuestionGroups(partQuestions);
        const partTables = part.tables.map((id) => tableMap.get(id)).filter(Boolean) as IeltsTable[];

        return (
          <section key={part.part} className="rounded-[1.75rem] border border-[var(--line)] bg-white/68 p-6 shadow-[0_16px_40px_rgba(58,46,34,0.06)]">
            <h2 className="text-xl font-semibold text-slate-900">{part.part}</h2>

            {partTables.length > 0 ? (
              <div className="mt-4 flex flex-col gap-4">
                {partTables.map((table) => (
                  <TableView key={table.id} table={table} />
                ))}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3">
              {questionGroups.map((group) => {
                const q = group.questions[0];
                const firstNo = group.questions[0].number;
                const lastNo = group.questions[group.questions.length - 1].number;
                const qLabel = group.questions.length > 1 ? `Q${firstNo}-${lastNo}` : `Q${q.number}`;

                return (
                  <article key={group.key} className="rounded-[1.4rem] border border-[var(--line)] bg-[rgba(255,249,242,0.96)] p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-white">{qLabel}</span>
                      <span className="rounded-full border border-[var(--line)] bg-white/80 px-2 py-0.5 text-slate-700">{typeLabel(q.type)}</span>
                      {group.questions.length > 1 ? (
                        <span className="rounded-full border border-[var(--line)] bg-white/80 px-2 py-0.5 text-slate-700">共 {group.questions.length} 题</span>
                      ) : null}
                      {q.tableRef ? <span className="text-slate-500">关联表格: {q.tableRef}</span> : null}
                    </div>

                    {q.subtitle ? <p className="mt-2 text-sm text-slate-500">{q.subtitle}</p> : null}
                    {q.instruction ? <p className="mt-1 text-sm font-medium text-slate-800">{q.instruction}</p> : null}
                    {q.prompt ? <p className="mt-1 text-slate-700">{q.prompt}</p> : null}

                    {q.imageUrls.length > 0 ? (
                      <div className="mt-3 grid gap-3">
                        {q.imageUrls.map((url, index) => (
                          <a
                            key={`${qLabel}-img-${index}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-xl border border-[var(--line)] bg-white"
                          >
                            <img
                              src={url}
                              alt={`${qLabel} image ${index + 1}`}
                              loading="lazy"
                              className="h-auto w-full object-contain"
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}

                    {q.options.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-sm text-slate-700">
                        {q.options.map((opt) => (
                          <li key={`${qLabel}-${opt.label}`}>
                            {opt.label}. {opt.text}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <p className="mt-3 text-sm font-medium text-green-700">
                      答案:
                      {" "}
                      {group.questions.length > 1
                        ? group.questions.map((item) => `Q${item.number}=${item.answer || "-"}`).join(", ")
                        : q.answer || "-"}
                    </p>
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
