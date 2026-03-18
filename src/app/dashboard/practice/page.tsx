"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, LoaderCircle } from "lucide-react";
import ElevenLabsVoiceAssistant from "@/components/ElevenLabsVoiceAssistant";
import ListeningPracticePanel from "@/components/ListeningPracticePanel";
import type { ListeningPracticePaper } from "@/lib/ielts-db";

const BOOK_NUMBERS = Array.from({ length: 13 }, (_, index) => index + 8);
const TEST_NUMBERS = [1, 2, 3, 4] as const;
const SERIES = "Cambridge IELTS";
const MODULES = [
  { id: "listening", label: "听力", enabled: true },
  { id: "reading", label: "阅读", enabled: true },
  { id: "writing", label: "写作", enabled: true },
  { id: "speaking", label: "口语", enabled: false },
] as const;
type ModuleId = (typeof MODULES)[number]["id"];
type PracticeState = "idle" | "loading" | "success" | "error";

function parseBookNo(value: string | null) {
  const parsed = Number(value);
  return BOOK_NUMBERS.includes(parsed) ? parsed : 20;
}

function parseModuleId(value: string | null): ModuleId {
  return MODULES.some((module) => module.id === value && module.enabled)
    ? (value as ModuleId)
    : "listening";
}

function parsePositiveNumber(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseTestNo(value: string | null) {
  const parsed = Number(value);
  return TEST_NUMBERS.includes(parsed as (typeof TEST_NUMBERS)[number])
    ? parsed
    : 1;
}

function getExpectedPartNos(module: ModuleId) {
  if (module === "writing") return [1, 2];
  if (module === "reading") return [1, 2, 3];
  return [1, 2, 3, 4];
}

function formatModuleLabel(module: ModuleId) {
  return module.charAt(0).toUpperCase() + module.slice(1);
}

function DashboardPracticeContent() {
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeBookNo, setActiveBookNo] = useState(() =>
    parseBookNo(searchParams.get("book")),
  );
  const [activeModule, setActiveModule] = useState<ModuleId>(() =>
    parseModuleId(searchParams.get("module")),
  );
  const [activeTestNo, setActiveTestNo] = useState<number | undefined>(
    () => parseTestNo(searchParams.get("test")),
  );
  const [activePartNo, setActivePartNo] = useState<number | undefined>(() =>
    parsePositiveNumber(searchParams.get("part")),
  );
  const [isSelectorCollapsed, setIsSelectorCollapsed] = useState(false);
  const [practiceState, setPracticeState] = useState<PracticeState>("idle");
  const [practicePaper, setPracticePaper] =
    useState<ListeningPracticePaper | null>(null);
  const collapsedSummary = `IELTS${activeBookNo}${typeof activeTestNo === "number" ? ` · Test ${activeTestNo}` : ""} · ${formatModuleLabel(activeModule)}`;

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
    if (!practicePaper) return;
    const expectedPartNos = getExpectedPartNos(activeModule);

    setActivePartNo((current) => {
      if (typeof current === "number" && expectedPartNos.includes(current)) {
        return current;
      }

      return expectedPartNos[0];
    });
  }, [activeModule, practicePaper]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("book", String(activeBookNo));
    params.set("module", activeModule);

    if (typeof activeTestNo === "number") {
      params.set("test", String(activeTestNo));
    }

    if (typeof activePartNo === "number") {
      params.set("part", String(activePartNo));
    }

    const nextUrl = `${pathname}?${params.toString()}`;
    router.replace(nextUrl, { scroll: false });
  }, [activeBookNo, activeModule, activePartNo, activeTestNo, pathname, router]);

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
        <div
          className={`border-b border-[var(--line)] bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(255,255,255,0.98))] px-6 py-4 ${
            isSelectorCollapsed ? "cursor-pointer" : ""
          }`}
          onClick={() => {
            if (isSelectorCollapsed) {
              setIsSelectorCollapsed(false);
            }
          }}
        >
          <div className="flex items-center gap-5 justify-between">
            {/* <div className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                Cambridge IELTS
              </div> */}
            {/* <h1 className=" text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              剑雅真题
            </h1> */}
            {isSelectorCollapsed ? (
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                {collapsedSummary}
              </h2>
            ) : (
              <div className="flex items-center flex-wrap justify-start gap-2">
                {BOOK_NUMBERS.map((bookNo) => {
                  const active = bookNo === activeBookNo;

                  return (
                    <button
                      key={bookNo}
                      type="button"
                      onClick={() => {
                        setActiveBookNo(bookNo);
                        setActiveTestNo(1);
                        setActivePartNo(undefined);
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
            )}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsSelectorCollapsed((current) => !current);
              }}
              className="inline-flex items-center gap-1 rounded-full bg-transparent px-1 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              {isSelectorCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
              <span>{isSelectorCollapsed ? "展开" : "收起"}</span>
            </button>
          </div>
        </div>

        <div
          className={`grid overflow-hidden transition-all duration-300 ease-out ${
            isSelectorCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
          }`}
        >
          <div className="min-h-0">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-4">
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
                            setActiveTestNo(1);
                            setActivePartNo(undefined);
                          }
                        }}
                        disabled={!module.enabled}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "bg-slate-900 text-white"
                            : module.enabled
                              ? "border border-[var(--line)] bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                              : "cursor-not-allowed border border-dashed border-slate-200 bg-slate-50 text-slate-400"
                        }`}
                      >
                        {module.label}
                        {!module.enabled ? " · 当季题库" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap justify-start gap-2">
                  {TEST_NUMBERS.map((testNo) => {
                    const active = testNo === activeTestNo;

                    return (
                      <button
                        key={testNo}
                        type="button"
                        onClick={() => {
                          setActiveTestNo(testNo);
                          setActivePartNo(undefined);
                        }}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "bg-slate-900 text-white"
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
        </div>
      </div>

      {practiceState === "loading" ? (
        <div className="rounded-[2rem] border border-[var(--line)] bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
          <div className="flex items-center justify-center gap-2">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            <span>正在加载题目内容...</span>
          </div>
        </div>
      ) : null}

      {practiceState === "error" ? (
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm text-rose-700 shadow-sm">
          题目加载失败，请稍后重试。
        </div>
      ) : null}

      {practiceState === "success" && practicePaper ? (
        <ListeningPracticePanel
          paper={practicePaper}
          activePartNo={activePartNo}
          onPartChange={setActivePartNo}
          hideHeaderSummary={isSelectorCollapsed}
        />
      ) : null}

      <section className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white shadow-sm">
        <div className="border-b border-[var(--line)] bg-[linear-gradient(135deg,rgba(238,242,255,0.98),rgba(255,255,255,0.98))] px-6 py-6 sm:px-8">
          <div className="inline-flex rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-indigo-700">
            Speaking Mock
          </div>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">口语模考</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                做完剑雅真题后，直接继续 Part 1、Part 2、Part 3 的连续口语模拟。这里保留 AI 对话入口，方便切换到独立模考节奏。
              </p>
            </div>
            <Link
              href="/dashboard/voice"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-200 hover:text-indigo-700"
            >
              打开独立口语页
            </Link>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-6">
          <ElevenLabsVoiceAssistant agentId={agentId} />
        </div>
      </section>
    </section>
  );
}

export default function DashboardPracticePage() {
  return (
    <Suspense
      fallback={
        <section className="space-y-6">
          <div className="rounded-[2rem] border border-[var(--line)] bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
            正在加载练习页面...
          </div>
        </section>
      }
    >
      <DashboardPracticeContent />
    </Suspense>
  );
}
