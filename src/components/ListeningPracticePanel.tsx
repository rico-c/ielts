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
import { Check, X } from "lucide-react";
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

function hasRenderableHtmlContent(html: string | null) {
  if (!html) return false;

  if (stripHtml(html)) {
    return true;
  }

  return /<(img|audio|video|iframe|svg|table|hr|br)\b/i.test(html);
}

function normalizeGroupedMultipleChoicePrompt(value: string) {
  return normalizeText(value)
    .replace(/^\d+\s*-\s*\d+\s*/, "")
    .replace(/^\d+\s*/, "")
    .replace(/[.,;:!?]/g, "")
    .trim();
}

function getHeadingSectionLabel(stem: string) {
  const match = stripHtml(stem).match(/section\s+([a-z])/i);
  return match ? match[1].toUpperCase() : null;
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

function parseStyleAttribute(style: string, tagName?: string) {
  return style
    .split(";")
    .reduce<Record<string, string | number>>((acc, rule) => {
      const [rawProp, rawValue] = rule.split(":");
      if (!rawProp || !rawValue) return acc;

      const prop = rawProp
        .trim()
        .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
      const value = rawValue.trim();

      if (
        tagName === "table" &&
        (prop === "width" || prop === "minWidth" || prop === "maxWidth")
      ) {
        return acc;
      }

      acc[prop] = /^\d+(\.\d+)?$/.test(value) ? Number(value) : value;
      return acc;
    }, {});
}

function isSafeHtmlAttributeName(name: string) {
  return /^[a-zA-Z_:][a-zA-Z0-9:._-]*$/.test(name);
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

function getOptionLabel(option: { label: string; text: string }) {
  return option.label.trim() || option.text.trim();
}

function replacePlaceholdersWithDropZones(
  text: string,
  questionsByNo: Map<number, ListeningQuestion>,
  optionsByLabel: Map<string, { label: string; text: string }>,
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
    const selectedLabel = typeof answer === "string" ? answer : "";
    const selectedOption =
      selectedLabel ? optionsByLabel.get(selectedLabel) ?? null : null;
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
        <span className="flex flex-col gap-2">
          <span
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const droppedLabel = event.dataTransfer
                .getData("text/plain")
                .trim();
              if (droppedLabel) onAnswerChange(question.id, droppedLabel);
            }}
            className={`inline-flex min-h-10 min-w-32 items-center rounded-xl border-2 border-dashed px-3 py-2 text-sm transition-colors ${
              submitted
                ? correct
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : selectedLabel
                    ? "border-rose-300 bg-rose-50 text-rose-900"
                    : "border-slate-300 bg-white text-slate-400"
                : selectedLabel
                  ? "border-blue-300 bg-blue-50 text-slate-900"
                  : "border-slate-300 bg-white text-slate-400"
            }`}
          >
            {selectedOption ? (
              <span className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">
                  {selectedOption.text}
                </span>
                <button
                  type="button"
                  onClick={() => onAnswerChange(question.id, "")}
                  aria-label={`Clear answer for question ${question.questionNo}`}
                  className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            ) : (
              <span className="font-semibold text-slate-500">
                {question.questionNo}
              </span>
            )}
          </span>
          {submitted && acceptedAnswers.length > 0 ? (
            <span className="text-xs text-slate-600">
              正确答案:{" "}
              <span className="font-semibold text-slate-900">
                {acceptedAnswers[0]}
              </span>
            </span>
          ) : null}
        </span>
      </span>,
    );

    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
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
  dragQuestionsByNo: Map<number, ListeningQuestion> | null,
  dragOptionsByLabel: Map<string, { label: string; text: string }> | null,
  headingQuestionsByNo: Map<number, ListeningQuestion> | null,
  headingQuestionsBySectionLabel: Map<string, ListeningQuestion> | null,
  headingOptionsByLabel: Map<string, { label: string; text: string }> | null,
  answers: Record<string, AnswerValue>,
  submitted: boolean,
  onAnswerChange: (questionId: string, value: string) => void,
  key: string,
): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (!text.includes("#####-")) {
      return text;
    }

    if (dragQuestionsByNo && dragOptionsByLabel) {
      return (
        <Fragment key={key}>
          {replacePlaceholdersWithDropZones(
            text,
            dragQuestionsByNo,
            dragOptionsByLabel,
            answers,
            submitted,
            onAnswerChange,
          )}
        </Fragment>
      );
    }

    if (!questionsByNo) {
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

  if (tagName === "a" && headingQuestionsByNo) {
    const questionNo = Number((element.textContent ?? "").trim());
    const question = Number.isFinite(questionNo)
      ? headingQuestionsByNo.get(questionNo)
      : null;

    if (question) {
      const answer = answers[question.id];
      const selectedLabel = typeof answer === "string" ? answer : "";
      const selectedOption =
        selectedLabel && headingOptionsByLabel
          ? headingOptionsByLabel.get(selectedLabel) ?? null
          : null;
      const acceptedAnswers = parseAnswerValues(
        question.answerText,
        question.answerJson,
      );
      const correct = submitted
        ? isCorrectAnswer(answer, question.answerText, question.answerJson)
        : null;

      return (
        <span key={key} className="flex w-full flex-col gap-2 align-middle">
          <span
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const droppedLabel = event.dataTransfer
                .getData("text/plain")
                .trim();
              if (droppedLabel) onAnswerChange(question.id, droppedLabel);
            }}
            className={`flex min-h-10 w-full min-w-28 items-center rounded-2xl border-2 border-dashed px-4 py-2 text-sm transition-colors ${
              submitted
                ? correct
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : selectedLabel
                    ? "border-rose-300 bg-rose-50 text-rose-900"
                    : "border-slate-300 bg-white text-slate-400"
                : selectedLabel
                  ? "border-blue-300 bg-blue-50 text-slate-900"
                  : "border-slate-300 bg-white text-slate-400"
            }`}
          >
            {selectedOption ? (
              <span className="flex items-center gap-3">
                <span className="font-semibold text-slate-900">
                  {question.questionNo}
                </span>
                <span>{selectedOption.text}</span>
                <button
                  type="button"
                  onClick={() => onAnswerChange(question.id, "")}
                  aria-label="Clear answer"
                  className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            ) : (
              <>
                <span className="font-semibold text-slate-900">
                  {question.questionNo}
                </span>
                {/* <span>Drop here</span> */}
              </>
            )}
          </span>
          {submitted && acceptedAnswers.length > 0 ? (
            <span className="text-xs text-slate-600">
              正确答案:{" "}
              <span className="font-semibold text-slate-900">
                {acceptedAnswers[0]}
              </span>
            </span>
          ) : null}
        </span>
      );
    }
  }

  if (headingQuestionsBySectionLabel && ["p", "div", "span"].includes(tagName)) {
    const sectionLabel = stripHtml(element.innerHTML);
    const question =
      sectionLabel.length === 1
        ? headingQuestionsBySectionLabel.get(sectionLabel.toUpperCase()) ?? null
        : null;

    if (question) {
      const answer = answers[question.id];
      const selectedLabel = typeof answer === "string" ? answer : "";
      const selectedOption =
        selectedLabel && headingOptionsByLabel
          ? headingOptionsByLabel.get(selectedLabel) ?? null
          : null;
      const acceptedAnswers = parseAnswerValues(
        question.answerText,
        question.answerJson,
      );
      const correct = submitted
        ? isCorrectAnswer(answer, question.answerText, question.answerJson)
        : null;

      const headingProps: Record<string, unknown> = { key: `${key}-heading` };
      for (const attr of Array.from(element.attributes)) {
        if (!isSafeHtmlAttributeName(attr.name)) {
          continue;
        }

        if (attr.name === "class") {
          headingProps.className = attr.value;
          continue;
        }

        if (attr.name === "style") {
          headingProps.style = parseStyleAttribute(attr.value, tagName) as CSSProperties;
          continue;
        }

        headingProps[attr.name] = attr.value;
      }

      return createElement(
        "div",
        { key, className: "space-y-3" },
        createElement(tagName, headingProps, sectionLabel),
        <span className="flex w-full flex-col gap-2 align-middle">
          <span
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const droppedLabel = event.dataTransfer
                .getData("text/plain")
                .trim();
              if (droppedLabel) onAnswerChange(question.id, droppedLabel);
            }}
            className={`flex min-h-10 w-full min-w-28 items-center rounded-2xl border-2 border-dashed px-4 py-2 text-sm transition-colors ${
              submitted
                ? correct
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : selectedLabel
                    ? "border-rose-300 bg-rose-50 text-rose-900"
                    : "border-slate-300 bg-white text-slate-400"
                : selectedLabel
                  ? "border-blue-300 bg-blue-50 text-slate-900"
                  : "border-slate-300 bg-white text-slate-400"
            }`}
          >
            {selectedOption ? (
              <span className="flex items-center gap-3">
                <span className="font-semibold text-slate-900">
                  {question.questionNo}
                </span>
                <span>{selectedOption.text}</span>
                <button
                  type="button"
                  onClick={() => onAnswerChange(question.id, "")}
                  aria-label="Clear answer"
                  className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            ) : (
              <span className="font-semibold text-slate-900">
                {question.questionNo}
              </span>
            )}
          </span>
          {submitted && acceptedAnswers.length > 0 ? (
            <span className="text-xs text-slate-600">
              正确答案:{" "}
              <span className="font-semibold text-slate-900">
                {acceptedAnswers[0]}
              </span>
            </span>
          ) : null}
        </span>,
      );
    }
  }

  const props: Record<string, unknown> = { key };

  for (const attr of Array.from(element.attributes)) {
    if (!isSafeHtmlAttributeName(attr.name)) {
      continue;
    }

    if (attr.name === "class") {
      props.className = attr.value;
      continue;
    }

    if (attr.name === "style") {
      props.style = parseStyleAttribute(attr.value, tagName) as CSSProperties;
      continue;
    }

    if (
      tagName === "table" &&
      (attr.name === "width" ||
        attr.name === "min-width" ||
        attr.name === "max-width")
    ) {
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
      dragQuestionsByNo,
      dragOptionsByLabel,
      headingQuestionsByNo,
      headingQuestionsBySectionLabel,
      headingOptionsByLabel,
      answers,
      submitted,
      onAnswerChange,
      `${key}-${index}`,
    ),
  );

  return createElement(tagName, props, ...children);
}

const HtmlBlock = memo(
  function HtmlBlock({
    html,
    questionsByNo = null,
    dragQuestionsByNo = null,
    dragOptionsByLabel = null,
    headingQuestionsByNo = null,
    headingQuestionsBySectionLabel = null,
    headingOptionsByLabel = null,
    answers,
    submitted,
    onAnswerChange,
  }: {
    html: string | null;
    questionsByNo?: Map<number, ListeningQuestion> | null;
    dragQuestionsByNo?: Map<number, ListeningQuestion> | null;
    dragOptionsByLabel?: Map<string, { label: string; text: string }> | null;
    headingQuestionsByNo?: Map<number, ListeningQuestion> | null;
    headingQuestionsBySectionLabel?: Map<string, ListeningQuestion> | null;
    headingOptionsByLabel?: Map<string, { label: string; text: string }> | null;
    answers: Record<string, AnswerValue>;
    submitted: boolean;
    onAnswerChange: (questionId: string, value: string) => void;
  }) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
      setIsMounted(true);
    }, []);

    if (!hasRenderableHtmlContent(html)) return null;

    const safeHtml: string = html ?? "";

    if (
      !isMounted ||
      (!questionsByNo &&
        !dragQuestionsByNo &&
        !headingQuestionsByNo &&
        !headingQuestionsBySectionLabel)
    ) {
      return (
        <div
          className="ielts-richtext prose prose-slate max-w-none text-sm"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      );
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(safeHtml, "text/html");
    const children = Array.from(doc.body.childNodes).map((node, index) =>
      renderHtmlNode(
        node,
        questionsByNo,
        dragQuestionsByNo,
        dragOptionsByLabel,
        headingQuestionsByNo,
        headingQuestionsBySectionLabel,
        headingOptionsByLabel,
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
  },
  (prevProps, nextProps) => {
    if (prevProps.html !== nextProps.html) return false;
    if (prevProps.questionsByNo !== nextProps.questionsByNo) return false;
    if (prevProps.dragQuestionsByNo !== nextProps.dragQuestionsByNo)
      return false;
    if (prevProps.dragOptionsByLabel !== nextProps.dragOptionsByLabel)
      return false;
    if (prevProps.headingQuestionsByNo !== nextProps.headingQuestionsByNo)
      return false;
    if (
      prevProps.headingQuestionsBySectionLabel !==
      nextProps.headingQuestionsBySectionLabel
    )
      return false;
    if (prevProps.headingOptionsByLabel !== nextProps.headingOptionsByLabel)
      return false;
    if (prevProps.submitted !== nextProps.submitted) return false;

    if (
      !prevProps.questionsByNo &&
      !nextProps.questionsByNo &&
      !prevProps.dragQuestionsByNo &&
      !nextProps.dragQuestionsByNo &&
      !prevProps.headingQuestionsByNo &&
      !nextProps.headingQuestionsByNo &&
      !prevProps.headingQuestionsBySectionLabel &&
      !nextProps.headingQuestionsBySectionLabel
    ) {
      return true;
    }

    return (
      prevProps.answers === nextProps.answers &&
      prevProps.onAnswerChange === nextProps.onAnswerChange
    );
  },
);

export default function ListeningPracticePanel({
  paper,
  activePartNo,
  onPartChange,
}: {
  paper: ListeningPracticePaper;
  activePartNo?: number;
  onPartChange?: (partNo: number) => void;
}) {
  const expectedPartNos =
    paper.module === "writing"
      ? [1, 2]
      : paper.module === "reading"
        ? [1, 2, 3]
        : [1, 2, 3, 4];
  const moduleLabel =
    paper.module === "reading"
      ? "Reading"
      : paper.module === "writing"
        ? "Writing"
        : "Listening";
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [activePartId, setActivePartId] = useState(
    () => paper.parts[0]?.id ?? "",
  );
  const [submittedParts, setSubmittedParts] = useState<Record<string, boolean>>(
    {},
  );
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
    () =>
      paper.parts.find((part) => part.id === activePartId) ??
      paper.parts[0] ??
      null,
    [activePartId, paper],
  );
  const selectedPartNo = activePartNo ?? currentPart?.partNo ?? expectedPartNos[0];

  useEffect(() => {
    if (paper.parts.length === 0) {
      setActivePartId("");
      return;
    }

    const nextPart =
      typeof activePartNo === "number"
        ? paper.parts.find((part) => part.partNo === activePartNo) ??
          paper.parts[0]
        : paper.parts[0];

    if (nextPart && nextPart.id !== activePartId) {
      setActivePartId(nextPart.id);
    }
  }, [activePartId, activePartNo, paper]);
  const currentIsWriting = paper.module === "writing";
  const currentSubmitted = currentPart
    ? Boolean(submittedParts[currentPart.id])
    : false;
  const currentWritingAnswerKey = currentPart
    ? `writing:${currentPart.id}`
    : "";

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
  const currentHeadingQuestionsByNo = useMemo(() => {
    if (!currentPart) return null;

    const headingQuestions = currentPart.groups
      .filter((group) => group.questionType === "matching_headings")
      .flatMap((group) => group.questions)
      .map((question) => [question.questionNo, question] as const);

    return headingQuestions.length > 0 ? new Map(headingQuestions) : null;
  }, [currentPart]);
  const currentHeadingOptionsByLabel = useMemo(() => {
    if (!currentPart) return null;

    const headingGroups = currentPart.groups.filter(
      (group) => group.questionType === "matching_headings",
    );
    const options = headingGroups.flatMap((group) => group.sharedOptions);

    return options.length > 0
      ? new Map(options.map((option) => [getOptionLabel(option), option] as const))
      : null;
  }, [currentPart]);
  const currentHeadingQuestionsBySectionLabel = useMemo(() => {
    if (!currentPart) return null;

    const entries = currentPart.groups
      .filter((group) => group.questionType === "matching_headings")
      .flatMap((group) => group.questions)
      .map((question) => [getHeadingSectionLabel(question.stem), question] as const)
      .filter((entry): entry is [string, ListeningQuestion] => Boolean(entry[0]));

    return entries.length > 0 ? new Map(entries) : null;
  }, [currentPart]);
  const firstSingleChoiceGroupId = useMemo(() => {
    if (!currentPart) return null;

    return (
      currentPart.groups.find((group) => group.questionType === "single_choice")
        ?.id ?? null
    );
  }, [currentPart]);

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
            <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-slate-900">
              {paper.title} · Test {paper.testNo} · {moduleLabel}
            </h2>
            {/* <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
              {moduleLabel}
            </p> */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {expectedPartNos.map((partNo) => {
                const active = partNo === selectedPartNo;
                const part = paper.parts.find((item) => item.partNo === partNo);

                return (
                  <button
                    key={partNo}
                    type="button"
                    onClick={() => {
                      if (part) {
                        setActivePartId(part.id);
                      }
                      onPartChange?.(partNo);
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    }`}
                  >
                    Part {partNo}
                  </button>
                );
              })}
            </div>
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
                {hasRenderableHtmlContent(currentPart.instructionHtml) ? (
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

            {hasRenderableHtmlContent(currentPart.contentHtml) ? (
              <HtmlBlock
                html={currentPart.contentHtml}
                answers={answers}
                submitted={currentSubmitted}
                headingQuestionsByNo={currentHeadingQuestionsByNo}
                headingQuestionsBySectionLabel={currentHeadingQuestionsBySectionLabel}
                headingOptionsByLabel={currentHeadingOptionsByLabel}
                onAnswerChange={updateAnswer}
              />
            ) : null}
          </div>

          <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
            {currentIsWriting ? (
              // <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
              <div className="space-y-3">
                <textarea
                  value={
                    typeof answers[currentWritingAnswerKey] === "string"
                      ? answers[currentWritingAnswerKey]
                      : ""
                  }
                  onChange={(event) =>
                    updateAnswer(currentWritingAnswerKey, event.target.value)
                  }
                  placeholder="在这里开始写作..."
                  className="min-h-[420px] w-full rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-sm leading-7 text-slate-700 outline-none transition-colors focus:border-slate-400"
                />
              </div>
            ) : (
              // </div>
              currentPart.groups.map((group) => (
                <article
                  key={group.id}
                  className="rounded-[1.5rem] bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
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
                    const isMatchingHeadings =
                      group.questionType === "matching_headings";
                    const isMatchingToMain =
                      group.questionType === "matching_to_main" &&
                      Boolean(group.contentHtml || group.instructionHtml);
                    const isMapLabeling =
                      group.questionType === "map_labeling";
                    const isTableOptions =
                      group.questionType === "table_options";
                    const showGroupHtml =
                      group.questionType !== "single_choice" ||
                      group.id === firstSingleChoiceGroupId;
                    const isDragMatching =
                      group.questionType === "matching" ||
                      group.questionType === "matching_opinion";
                    const dragOptionsByLabel =
                      isMatchingToMain && group.sharedOptions.length > 0
                        ? new Map(
                            group.sharedOptions.map((option) => [
                              getOptionLabel(option),
                              option,
                            ] as const),
                          )
                        : null;
                    const groupedMultipleChoice =
                      group.questionType === "multiple_choice" &&
                      group.questions.length > 1 &&
                      new Set(
                        group.questions.map((question) =>
                          normalizeGroupedMultipleChoicePrompt(
                            stripHtml(question.stem || group.title),
                          ),
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

                          {showGroupHtml &&
                          hasRenderableHtmlContent(group.instructionHtml) ? (
                            <HtmlBlock
                              html={group.instructionHtml}
                              questionsByNo={
                                inlineFillBlank ? questionsByNo : null
                              }
                              dragQuestionsByNo={
                                isMatchingToMain ? questionsByNo : null
                              }
                              dragOptionsByLabel={dragOptionsByLabel}
                              answers={answers}
                              submitted={currentSubmitted}
                              onAnswerChange={updateAnswer}
                            />
                          ) : null}
                          {group.imageUrl ? (
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                              {/* 'http://uimg.gximg.cn/ieltscb' +  */}
                              <img
                                src={group.imageUrl}
                                alt={group.title || "Question illustration"}
                                className="h-auto w-[500px] object-contain"
                              />
                            </div>
                          ) : null}
                          {showGroupHtml &&
                          hasRenderableHtmlContent(group.contentHtml) &&
                          !isMatchingHeadings &&
                          !isMapLabeling &&
                          !isTableOptions &&
                          NeedHideHTML !== group.contentHtml ? (
                            <div className="">
                              <HtmlBlock
                                html={group.contentHtml}
                                questionsByNo={
                                  inlineFillBlank ? questionsByNo : null
                                }
                                dragQuestionsByNo={
                                  isMatchingToMain ? questionsByNo : null
                                }
                                dragOptionsByLabel={dragOptionsByLabel}
                                headingQuestionsByNo={null}
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
                          <div className="mt-2 space-y-3">
                            {isMatchingHeadings ? (
                              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                                {/* <div className="rounded-2xl border border-slate-200 bg-white p-4"> */}
                                  {/* <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    Options
                                  </p> */}
                                  <div className="mt-3 space-y-2">
                                    {group.sharedOptions.map((option) => (
                                      <div
                                        key={option.id}
                                        draggable
                                        onDragStart={(event) => {
                                          event.dataTransfer.setData(
                                            "text/plain",
                                            getOptionLabel(option),
                                          );
                                          event.dataTransfer.effectAllowed =
                                            "move";
                                        }}
                                        className="cursor-grab rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 active:cursor-grabbing"
                                      >
                                        {option.label ? (
                                          <span className="mr-2 font-semibold text-slate-900">
                                            {option.label}.
                                          </span>
                                        ) : null}
                                        <span>{option.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                {/* </div> */}

                                {/* <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                                  将右侧标题拖拽到上方阅读正文中对应题号的位置。
                                </div> */}
                              </div>
                            ) : isMatchingToMain ? (
                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="mt-3 space-y-2">
                                  {group.sharedOptions.map((option) => (
                                    <div
                                      key={option.id}
                                      draggable
                                      onDragStart={(event) => {
                                        event.dataTransfer.setData(
                                          "text/plain",
                                          getOptionLabel(option),
                                        );
                                        event.dataTransfer.effectAllowed =
                                          "move";
                                      }}
                                      className="cursor-grab rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 active:cursor-grabbing"
                                    >
                                      {option.label ? (
                                        <span className="mr-2 font-semibold text-slate-900">
                                          {option.label}.
                                        </span>
                                      ) : null}
                                      <span>{option.text}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : isDragMatching ? (
                              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                                <div className="space-y-3">
                                  {group.questions.map((question) => {
                                    const answer = answers[question.id];
                                    const selectedLabel =
                                      typeof answer === "string" ? answer : "";
                                    const selectedOption =
                                      group.sharedOptions.find(
                                        (option) =>
                                          getOptionLabel(option) ===
                                          selectedLabel,
                                      );
                                    const correct = currentSubmitted
                                      ? isCorrectAnswer(
                                          answer,
                                          question.answerText,
                                          question.answerJson,
                                        )
                                      : null;
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
                                        <div className="flex flex-row flex-wrap items-start justify-between gap-3">
                                          <div className="space-y-3 flex items-center gap-5">
                                            <div className="text-sm leading-6 text-slate-700">
                                              {stripHtml(question.stem) ||
                                                stripHtml(group.title)}
                                            </div>
                                            <div
                                              onDragOver={(event) =>
                                                event.preventDefault()
                                              }
                                              onDrop={(event) => {
                                                event.preventDefault();
                                                const droppedLabel =
                                                  event.dataTransfer
                                                    .getData("text/plain")
                                                    .trim();
                                                if (droppedLabel)
                                                  updateAnswer(
                                                    question.id,
                                                    droppedLabel,
                                                  );
                                              }}
                                              className={`min-h-10 rounded-2xl border-2 border-dashed px-4 py-3 transition-colors ${
                                                selectedOption
                                                  ? "border-blue-300 bg-blue-50"
                                                  : "border-slate-300 bg-white"
                                              }`}
                                            >
                                              {selectedOption ? (
                                                <div className="flex items-start justify-between gap-3">
                                                  <div className="text-sm text-slate-700">
                                                    <span className="mr-2 font-semibold text-slate-900">
                                                      {selectedOption.label}.
                                                    </span>
                                                    <span>
                                                      {selectedOption.text}
                                                    </span>
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      updateAnswer(
                                                        question.id,
                                                        "",
                                                      )
                                                    }
                                                    aria-label="Clear answer"
                                                    className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                                                  >
                                                    <X className="h-4 w-4" />
                                                  </button>
                                                </div>
                                              ) : (
                                                <div className="text-sm text-slate-400">
                                                  Drag an option here
                                                </div>
                                              )}
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
                                              {correct
                                                ? "Correct"
                                                : "Incorrect"}
                                            </div>
                                          ) : null}
                                        </div>

                                        {currentSubmitted &&
                                        acceptedAnswers.length > 0 ? (
                                          <div className="mt-3 text-sm text-slate-700">
                                            正确答案:{" "}
                                            <span className="font-semibold text-slate-900">
                                              {acceptedAnswers[0]}
                                            </span>
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  {/* <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    Options
                                  </p> */}
                                  <div className="mt-3 space-y-2">
                                    {group.sharedOptions.map((option) => (
                                      <div
                                        key={option.id}
                                        draggable
                                        onDragStart={(event) => {
                                          event.dataTransfer.setData(
                                            "text/plain",
                                            getOptionLabel(option),
                                          );
                                          event.dataTransfer.effectAllowed =
                                            "move";
                                        }}
                                        className="cursor-grab rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 active:cursor-grabbing"
                                      >
                                        {option.label ? (
                                          <span className="mr-2 font-semibold text-slate-900">
                                            {option.label}.
                                          </span>
                                        ) : null}
                                        <span>{option.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : isMapLabeling || isTableOptions ? (
                              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                                <table className="min-w-full table-fixed border-collapse text-sm">
                                  <colgroup>
                                    <col className="w-[40%] min-w-[20rem]" />
                                    {group.sharedOptions.map((option) => (
                                      <col key={`col-${option.id}`} className="w-[10%]" />
                                    ))}
                                  </colgroup>
                                  <thead>
                                    <tr className="bg-slate-50">
                                      <th className="min-w-80 px-4 py-3 text-left font-semibold text-slate-900">
                                        Question
                                      </th>
                                      {group.sharedOptions.map((option) => (
                                        <th
                                          key={option.id}
                                          className="min-w-16 px-2 py-3 text-center font-semibold text-slate-700"
                                        >
                                          {getOptionLabel(option)}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.questions.map((question) => {
                                      const answer = answers[question.id];
                                      const selectedLabel =
                                        typeof answer === "string" ? answer : "";
                                      const correct = currentSubmitted
                                        ? isCorrectAnswer(
                                            answer,
                                            question.answerText,
                                            question.answerJson,
                                          )
                                        : null;
                                      const acceptedAnswers = parseAnswerValues(
                                        question.answerText,
                                        question.answerJson,
                                      );

                                      return (
                                        <tr
                                          key={question.id}
                                          className="border-t border-slate-200"
                                        >
                                          <td className="px-4 py-4 align-top text-slate-700">
                                            <div className="space-y-2">
                                              <div className="font-medium leading-6 text-slate-900">
                                                {stripHtml(question.stem) ||
                                                  stripHtml(group.title)}
                                              </div>
                                              {currentSubmitted &&
                                              acceptedAnswers.length > 0 ? (
                                                <div className="text-xs text-slate-500">
                                                  正确答案:{" "}
                                                  <span className="font-semibold text-slate-900">
                                                    {acceptedAnswers[0]}
                                                  </span>
                                                </div>
                                              ) : null}
                                            </div>
                                          </td>
                                          {group.sharedOptions.map((option) => {
                                            const optionLabel =
                                              getOptionLabel(option);
                                            const selected =
                                              selectedLabel === optionLabel;
                                            const optionIsCorrect =
                                              isCorrectAnswer(
                                                optionLabel,
                                                question.answerText,
                                                question.answerJson,
                                              );
                                            const cellClass = currentSubmitted
                                              ? selected && correct
                                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                                : selected && !correct
                                                  ? "border-rose-300 bg-rose-50 text-rose-700"
                                                  : optionIsCorrect
                                                    ? "border-emerald-200 bg-emerald-50/60 text-emerald-700"
                                                    : "border-slate-200 bg-white text-slate-300"
                                              : selected
                                                ? "border-blue-300 bg-blue-50 text-blue-700"
                                                : "border-slate-200 bg-white text-slate-300 hover:border-slate-300 hover:bg-slate-50";

                                            return (
                                              <td
                                                key={`${question.id}-${option.id}`}
                                                className="px-1.5 py-2 text-center"
                                              >
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    updateAnswer(
                                                      question.id,
                                                      selected
                                                        ? ""
                                                        : optionLabel,
                                                    )
                                                  }
                                                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${cellClass}`}
                                                  aria-label={`Question ${question.questionNo} choose ${optionLabel}`}
                                                >
                                                  {selected ? (
                                                    <Check className="h-4 w-4" />
                                                  ) : currentSubmitted &&
                                                    optionIsCorrect ? (
                                                    <Check className="h-4 w-4 opacity-60" />
                                                  ) : null}
                                                </button>
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : groupedMultipleChoice ? (
                              (() => {
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
                                                toggleOption(
                                                  getOptionValue(option),
                                                )
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

                                    {currentSubmitted &&
                                    acceptedAnswers.length > 0 ? (
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
                            ) : (
                              group.questions.map((question) => {
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
                                  group.questionType !== "fill_blank" &&
                                  group.questionType !== "matching" &&
                                  group.questionType !== "matching_opinion" &&
                                  group.questionType !== "matching_headings" &&
                                  group.questionType !== "map_labeling";
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
                                          {group.sharedOptions.map((option) =>
                                            (() => {
                                              const optionValue =
                                                getOptionValue(option);

                                              return (
                                                <label
                                                  key={option.id}
                                                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors ${
                                                    typeof answer ===
                                                      "string" &&
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
                                                      typeof answer ===
                                                        "string" &&
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
                                            })(),
                                          )}
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

                                    {currentSubmitted &&
                                    acceptedAnswers.length > 0 ? (
                                      <div className="mt-3 text-sm text-slate-700">
                                        正确答案:{" "}
                                        <span className="font-semibold text-slate-900">
                                          {acceptedAnswers.join(" / ")}
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
