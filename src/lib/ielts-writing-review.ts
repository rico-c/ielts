export type WritingTaskType = "part1" | "part2";

export type WritingCriterionKey =
  | "taskFulfillment"
  | "coherenceAndCohesion"
  | "lexicalResource"
  | "grammaticalRangeAndAccuracy";

export type WritingCriterionReview = {
  band: number;
  comment: string;
};

export type WritingImprovementSuggestion = {
  priority: "high" | "medium" | "low";
  title: string;
  action: string;
  example: string;
};

export type WritingAiReview = {
  taskType: WritingTaskType;
  overallBand: number;
  wordCount: number;
  overview: string;
  criteria: Record<WritingCriterionKey, WritingCriterionReview>;
  contentFeedback: string[];
  improvementSuggestions: WritingImprovementSuggestion[];
};

const DEFAULT_CONTENT_FEEDBACK = "这篇作文已经回应了题目，但仍有明显提分空间。";
const DEFAULT_SUGGESTION_EXAMPLE = "先重写一个主体段，补足论证或数据支撑，再检查语言准确性。";

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function stripHtmlToPlainText(html: string | null) {
  if (!html) return "";

  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function countEssayWords(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function roundIeltsBandScore(score: number) {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(9, Math.round(score * 2) / 2));
}

export function getTaskFulfillmentLabel(taskType: WritingTaskType) {
  return taskType === "part1" ? "Task Achievement" : "Task Response";
}

export function getTaskFulfillmentLabelZh(taskType: WritingTaskType) {
  return taskType === "part1" ? "任务完成度" : "任务回应度";
}

function sanitizeText(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function sanitizeBand(value: unknown, fallback = 5.5) {
  const numeric = typeof value === "number" ? value : Number(value);
  return roundIeltsBandScore(Number.isFinite(numeric) ? numeric : fallback);
}

function sanitizeFeedbackList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean)
    .slice(0, 4);
}

function sanitizeSuggestions(
  value: unknown,
  taskType: WritingTaskType,
  criteria: Record<WritingCriterionKey, WritingCriterionReview>,
) {
  const suggestions = Array.isArray(value)
    ? value
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const record = item as Record<string, unknown>;
          const priority =
            record.priority === "high" ||
            record.priority === "medium" ||
            record.priority === "low"
              ? record.priority
              : "medium";

          return {
            priority,
            title: sanitizeText(record.title, "补强当前作文的核心短板"),
            action: sanitizeText(record.action, "围绕当前题目重写一个主体段，补足内容展开和语言准确性。"),
            example: sanitizeText(record.example, DEFAULT_SUGGESTION_EXAMPLE),
          } satisfies WritingImprovementSuggestion;
        })
        .filter((item): item is WritingImprovementSuggestion => Boolean(item))
        .slice(0, 4)
    : [];

  if (suggestions.length >= 2) {
    return suggestions;
  }

  const weakestCriteria = (
    Object.entries(criteria) as [WritingCriterionKey, WritingCriterionReview][]
  )
    .sort((left, right) => left[1].band - right[1].band)
    .slice(0, 2);

  const fallbackSuggestions = weakestCriteria.map(([key, criterion], index) => {
    const title =
      key === "taskFulfillment"
        ? `${getTaskFulfillmentLabelZh(taskType)}优先提分`
        : key === "coherenceAndCohesion"
          ? "优化段落逻辑与衔接"
          : key === "lexicalResource"
            ? "提升词汇准确度"
            : "压缩语法错误并增加句式控制";

    return {
      priority: index === 0 ? "high" : "medium",
      title,
      action: criterion.comment,
      example: DEFAULT_SUGGESTION_EXAMPLE,
    } satisfies WritingImprovementSuggestion;
  });

  return [...suggestions, ...fallbackSuggestions].slice(0, 3);
}

export function normalizeWritingAiReview(
  raw: unknown,
  {
    taskType,
    wordCount,
  }: {
    taskType: WritingTaskType;
    wordCount: number;
  },
): WritingAiReview {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawCriteria =
    record.criteria && typeof record.criteria === "object"
      ? (record.criteria as Record<string, unknown>)
      : {};

  const criteria: Record<WritingCriterionKey, WritingCriterionReview> = {
    taskFulfillment: {
      band: sanitizeBand(
        rawCriteria.taskFulfillment &&
          typeof rawCriteria.taskFulfillment === "object"
          ? (rawCriteria.taskFulfillment as Record<string, unknown>).band
          : undefined,
      ),
      comment: sanitizeText(
        rawCriteria.taskFulfillment &&
          typeof rawCriteria.taskFulfillment === "object"
          ? (rawCriteria.taskFulfillment as Record<string, unknown>).comment
          : undefined,
        `${getTaskFulfillmentLabel(taskType)} 有基本回应，但完成质量还不够稳定。`,
      ),
    },
    coherenceAndCohesion: {
      band: sanitizeBand(
        rawCriteria.coherenceAndCohesion &&
          typeof rawCriteria.coherenceAndCohesion === "object"
          ? (rawCriteria.coherenceAndCohesion as Record<string, unknown>).band
          : undefined,
      ),
      comment: sanitizeText(
        rawCriteria.coherenceAndCohesion &&
          typeof rawCriteria.coherenceAndCohesion === "object"
          ? (rawCriteria.coherenceAndCohesion as Record<string, unknown>).comment
          : undefined,
        "段落结构基本存在，但信息推进和衔接还可以更自然。",
      ),
    },
    lexicalResource: {
      band: sanitizeBand(
        rawCriteria.lexicalResource &&
          typeof rawCriteria.lexicalResource === "object"
          ? (rawCriteria.lexicalResource as Record<string, unknown>).band
          : undefined,
      ),
      comment: sanitizeText(
        rawCriteria.lexicalResource &&
          typeof rawCriteria.lexicalResource === "object"
          ? (rawCriteria.lexicalResource as Record<string, unknown>).comment
          : undefined,
        "词汇能支撑基本表达，但准确性和搭配自然度还有提升空间。",
      ),
    },
    grammaticalRangeAndAccuracy: {
      band: sanitizeBand(
        rawCriteria.grammaticalRangeAndAccuracy &&
          typeof rawCriteria.grammaticalRangeAndAccuracy === "object"
          ? (rawCriteria.grammaticalRangeAndAccuracy as Record<string, unknown>).band
          : undefined,
      ),
      comment: sanitizeText(
        rawCriteria.grammaticalRangeAndAccuracy &&
          typeof rawCriteria.grammaticalRangeAndAccuracy === "object"
          ? (rawCriteria.grammaticalRangeAndAccuracy as Record<string, unknown>).comment
          : undefined,
        "句式有一定变化，但错误率和控制力还会影响稳定得分。",
      ),
    },
  };

  const overallBand = roundIeltsBandScore(
    (criteria.taskFulfillment.band +
      criteria.coherenceAndCohesion.band +
      criteria.lexicalResource.band +
      criteria.grammaticalRangeAndAccuracy.band) /
      4,
  );

  const contentFeedback = sanitizeFeedbackList(record.contentFeedback);

  return {
    taskType,
    overallBand,
    wordCount,
    overview: sanitizeText(record.overview, DEFAULT_CONTENT_FEEDBACK),
    criteria,
    contentFeedback: contentFeedback.length > 0 ? contentFeedback : [DEFAULT_CONTENT_FEEDBACK],
    improvementSuggestions: sanitizeSuggestions(record.improvementSuggestions, taskType, criteria),
  };
}
