"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import IeltsTestSelector, {
  BOOK_NUMBERS,
  TEST_NUMBERS,
} from "@/components/IeltsTestSelector";
import ListeningPracticePanel from "@/components/ListeningPracticePanel";
import type { ListeningPracticePaper } from "@/lib/ielts-db";

const SERIES = "Cambridge IELTS";
const MODULES = [
  { id: "listening", label: "听力", enabled: true },
  { id: "reading", label: "阅读", enabled: true },
  { id: "writing", label: "写作", enabled: true },
  { id: "speaking", label: "口语", enabled: false, suffix: "· 当季题库" },
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
    <section className="space-y-4">
      <IeltsTestSelector
        activeBookNo={activeBookNo}
        activeModuleId={activeModule}
        activeTestNo={activeTestNo ?? 1}
        modules={MODULES}
        onBookChange={(bookNo) => {
          setActiveBookNo(bookNo);
          setActiveTestNo(1);
          setActivePartNo(undefined);
        }}
        onModuleChange={(moduleId) => {
          setActiveModule(moduleId as ModuleId);
          setActiveTestNo(1);
          setActivePartNo(undefined);
        }}
        onTestChange={(testNo) => {
          setActiveTestNo(testNo);
          setActivePartNo(undefined);
        }}
        onCollapsedChange={setIsSelectorCollapsed}
        summaryLabel={collapsedSummary}
      />

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

      {/* <section className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white shadow-sm">
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
      </section> */}
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
