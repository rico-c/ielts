"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export const BOOK_NUMBERS = Array.from({ length: 13 }, (_, index) => index + 8);
export const TEST_NUMBERS = [1, 2, 3, 4] as const;

export type SelectorModuleTab = {
  id: string;
  label: string;
  enabled?: boolean;
  suffix?: string;
};

type IeltsTestSelectorProps = {
  activeBookNo: number;
  activeTestNo: number;
  activePartNo?: number;
  activeModuleId?: string;
  modules?: readonly SelectorModuleTab[];
  onBookChange: (bookNo: number) => void;
  onTestChange: (testNo: number) => void;
  onPartChange?: (partNo: number) => void;
  onModuleChange?: (moduleId: string) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  partNos?: readonly number[];
  summaryLabel: string;
};

export default function IeltsTestSelector({
  activeBookNo,
  activeTestNo,
  activePartNo,
  activeModuleId,
  modules,
  onBookChange,
  onTestChange,
  onPartChange,
  onModuleChange,
  onCollapsedChange,
  partNos,
  summaryLabel,
}: IeltsTestSelectorProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const hasModules = Boolean(modules && activeModuleId && onModuleChange);
  const hasParts = Boolean(partNos?.length && onPartChange);

  function updateCollapsed(nextValue: boolean) {
    setIsCollapsed(nextValue);
    onCollapsedChange?.(nextValue);
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white shadow-sm">
      <div
        className={`border-b border-[var(--line)] bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(255,255,255,0.98))] px-6 py-4 ${
          isCollapsed ? "cursor-pointer" : ""
        }`}
        onClick={() => {
          if (isCollapsed) {
            updateCollapsed(false);
          }
        }}
      >
        <div className="flex items-center justify-between gap-5">
          {isCollapsed ? (
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
              {summaryLabel}
            </h2>
          ) : (
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-start gap-2">
              {BOOK_NUMBERS.map((bookNo) => {
                const active = bookNo === activeBookNo;

                return (
                  <button
                    key={bookNo}
                    type="button"
                    onClick={() => onBookChange(bookNo)}
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
              updateCollapsed(!isCollapsed);
            }}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-transparent px-1 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
            <span>{isCollapsed ? "展开" : "收起"}</span>
          </button>
        </div>
      </div>

      <div
        className={`grid overflow-hidden transition-all duration-300 ease-out ${
          isCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        }`}
      >
        <div className="min-h-0">
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
            {hasModules ? (
              <div className="flex flex-wrap gap-2">
                {modules?.map((module) => {
                  const active = module.id === activeModuleId;
                  const enabled = module.enabled !== false;

                  return (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() => {
                        if (enabled) {
                          onModuleChange?.(module.id);
                        }
                      }}
                      disabled={!enabled}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-slate-900 text-white"
                          : enabled
                            ? "border border-[var(--line)] bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                            : "cursor-not-allowed border border-dashed border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                    >
                      {module.label}
                      {!enabled && module.suffix ? ` ${module.suffix}` : ""}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {TEST_NUMBERS.map((testNo) => {
                const active = testNo === activeTestNo;

                return (
                  <button
                    key={testNo}
                    type="button"
                    onClick={() => onTestChange(testNo)}
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

            {hasParts ? (
              <div className="flex flex-wrap gap-2">
                {partNos?.map((partNo) => {
                  const active = partNo === activePartNo;

                  return (
                    <button
                      key={partNo}
                      type="button"
                      onClick={() => onPartChange?.(partNo)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-blue-600 text-white"
                          : "border border-[var(--line)] bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                      }`}
                    >
                      Part {partNo}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
