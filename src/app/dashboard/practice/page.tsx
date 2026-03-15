"use client";

import { useEffect, useMemo, useState } from "react";
import ListeningPracticePanel from "@/components/ListeningPracticePanel";
import type { ListeningPracticePaper } from "@/lib/ielts-db";

const BOOK_NUMBERS = Array.from({ length: 16 }, (_, index) => index + 5);
const SERIES = "Cambridge IELTS";
const MODULES = [
  { id: "listening", label: "听力", enabled: true },
  { id: "reading", label: "阅读", enabled: true },
  { id: "writing", label: "写作", enabled: true },
  { id: "speaking", label: "口语", enabled: false },
] as const;
type ModuleId = (typeof MODULES)[number]["id"];
type TestSelectorState = "idle" | "loading" | "success" | "error";
type PracticeState = "idle" | "loading" | "success" | "error";

export default function DashboardPracticePage() {
  const [activeBookNo, setActiveBookNo] = useState(20);
  const [activeModule, setActiveModule] = useState<ModuleId>("listening");
  const [activeTestNo, setActiveTestNo] = useState<number | undefined>(
    undefined,
  );
  const [availableTestNos, setAvailableTestNos] = useState<number[]>([]);
  const [testSelectorState, setTestSelectorState] =
    useState<TestSelectorState>("idle");
  const [practiceState, setPracticeState] = useState<PracticeState>("idle");
  const [practicePaper, setPracticePaper] =
    useState<ListeningPracticePaper | null>(null);

  const optionsApiUrl = useMemo(() => {
    const params = new URLSearchParams({
      series: SERIES,
      bookNo: String(activeBookNo),
      module: activeModule,
    });
    return `/api/ielts/tests/options?${params.toString()}`;
  }, [activeBookNo, activeModule]);

  const practiceApiUrl = useMemo(() => {
    if (typeof activeTestNo !== "number") return "";

    const params = new URLSearchParams({
      series: SERIES,
      bookNo: String(activeBookNo),
      module: activeModule,
      testNo: String(activeTestNo),
    });
    return `/api/ielts/tests/detail?${params.toString()}`;
  }, [activeBookNo, activeModule, activeTestNo]);

  useEffect(() => {
    let cancelled = false;

    async function loadTestNos() {
      setTestSelectorState("loading");

      try {
        const response = await fetch(optionsApiUrl, { cache: "no-store" });
        const json = (await response.json()) as {
          testNos?: number[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(json.error || "Failed to load available tests.");
        }

        const nextTestNos = Array.isArray(json.testNos)
          ? json.testNos.filter(
              (value): value is number =>
                typeof value === "number" && Number.isFinite(value),
            )
          : [];

        if (cancelled) return;

        setAvailableTestNos(nextTestNos);
        setActiveTestNo((current) => {
          if (typeof current === "number" && nextTestNos.includes(current))
            return current;
          return nextTestNos[0];
        });
        setTestSelectorState("success");
      } catch {
        if (cancelled) return;
        setAvailableTestNos([]);
        setActiveTestNo(undefined);
        setTestSelectorState("error");
      }
    }

    loadTestNos();
    return () => {
      cancelled = true;
    };
  }, [optionsApiUrl]);

  useEffect(() => {
    if (!practiceApiUrl) {
      setPracticeState("idle");
      setPracticePaper(null);
      return;
    }

    let cancelled = false;

    async function loadPracticePaper() {
      setPracticeState("loading");

      try {
        const response = await fetch(practiceApiUrl, { cache: "no-store" });
        const json = (await response.json()) as {
          paper?: ListeningPracticePaper;
          error?: string;
        };

        if (!response.ok || !json.paper) {
          throw new Error(json.error || "Failed to load practice paper.");
        }

        if (cancelled) return;

        setPracticePaper(json.paper);
        setPracticeState("success");
      } catch {
        if (cancelled) return;
        setPracticePaper(null);
        setPracticeState("error");
      }
    }

    loadPracticePaper();
    return () => {
      cancelled = true;
    };
  }, [practiceApiUrl]);

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white shadow-sm">
        <div className="border-b border-[var(--line)] bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(255,255,255,0.98))] px-6 py-6 sm:px-8">
          <div className="flex items-center gap-5 lg:flex-row lg:items-start">
            {/* <div className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                Cambridge IELTS
              </div> */}
            <h1 className=" text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              剑雅真题
            </h1>

            <div className="flex items-center flex-wrap justify-start gap-2 lg:max-w-[60%] lg:justify-end">
              {BOOK_NUMBERS.map((bookNo) => {
                const active = bookNo === activeBookNo;

                return (
                  <button
                    key={bookNo}
                    type="button"
                    onClick={() => {
                      setActiveBookNo(bookNo);
                      setActiveTestNo(undefined);
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-slate-900 text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)]"
                        : "border border-[var(--line)] bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    }`}
                  >
                    剑{bookNo}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-1 flex-wrap items-center gap-4">
            <div className="flex flex-wrap gap-2">
              {MODULES.map((module) => {
                const active = module.id === activeModule;

                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => {
                      if (module.enabled) {
                        setActiveModule(module.id);
                        setActiveTestNo(undefined);
                      }
                    }}
                    disabled={!module.enabled}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-blue-600 text-white"
                        : module.enabled
                          ? "border border-[var(--line)] bg-blue-50/60 text-blue-700 hover:bg-blue-100"
                          : "cursor-not-allowed border border-dashed border-slate-200 bg-slate-50 text-slate-400"
                    }`}
                  >
                    {module.label}
                    {!module.enabled ? " · 当季题库" : ""}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
              {testSelectorState === "loading" ? (
                <div className="rounded-full border border-[var(--line)] bg-slate-50 px-4 py-2 text-sm text-slate-500">
                  正在加载 TEST...
                </div>
              ) : null}

              {testSelectorState !== "loading" &&
              availableTestNos.length === 0 ? (
                <div className="rounded-full border border-dashed border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400">
                  暂无可选 TEST
                </div>
              ) : null}

              {availableTestNos.length > 0 ? (
                <div className=" w-0.5 text-sm bg-neutral-300 mr-2">
                </div>
              ) : null}

              {availableTestNos.map((testNo) => {
                const active = testNo === activeTestNo;

                return (
                  <button
                    key={testNo}
                    type="button"
                    onClick={() => setActiveTestNo(testNo)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-emerald-600 text-white"
                        : "border border-[var(--line)] bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    }`}
                  >
                    Test {testNo}
                  </button>
                );
              })}
            </div>
          </div>

          {/* <div className="rounded-2xl border border-[var(--line)] bg-[rgba(248,250,252,0.9)] px-4 py-3 text-sm text-slate-600">
            当前查看:{" "}
            <span className="font-semibold text-slate-900">
              剑{activeBookNo}
            </span>
            {" · "}
            <span className="font-semibold text-slate-900">
              {MODULES.find((item) => item.id === activeModule)?.label}
            </span>
            {typeof activeTestNo === "number" ? (
              <>
                {" · "}
                <span className="font-semibold text-slate-900">
                  Test {activeTestNo}
                </span>
              </>
            ) : null}
          </div> */}
        </div>
      </div>

      {practiceState === "loading" ? (
        <div className="rounded-[2rem] border border-[var(--line)] bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
          正在加载题目内容...
        </div>
      ) : null}

      {practiceState === "error" ? (
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm text-rose-700 shadow-sm">
          题目加载失败，请稍后重试。
        </div>
      ) : null}

      {practiceState === "success" && practicePaper ? (
        <ListeningPracticePanel paper={practicePaper} />
      ) : null}
    </section>
  );
}
