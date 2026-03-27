import { roundIeltsBandScore } from "@/lib/ielts-writing-review";

export type SpeakingMockSessionGroup = "part1" | "part23";
export type SpeakingMockTurnPhase = "part1" | "part2" | "part3";
export type SpeakingMockRecordStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type SpeakingCriterionKey =
  | "pronunciation"
  | "fluencyAndCoherence"
  | "lexicalResource"
  | "grammaticalRangeAndAccuracy";

export type SpeakingCriterionReview = {
  band: number;
  comment: string;
};

export type SpeakingImprovementSuggestion = {
  priority: "high" | "medium" | "low";
  title: string;
  action: string;
  example: string;
};

export type SpeakingAiReview = {
  overallBand: number;
  overview: string;
  criteria: Record<SpeakingCriterionKey, SpeakingCriterionReview>;
  strengths: string[];
  suggestions: SpeakingImprovementSuggestion[];
};

export type SpeakingMockSubmissionTurnDraft<TFile = File | null> = {
  phase: SpeakingMockTurnPhase;
  questionId: number;
  question: string;
  requirements: string[];
  examinerAudioUrl: string | null;
  userAudioFile: TFile;
};

export type SpeakingMockSubmissionTurnPayload = Omit<
  SpeakingMockSubmissionTurnDraft<never>,
  "userAudioFile"
> & {
  userAudioField: string;
};

export type SpeakingMockSubmissionPayload<TFile = File | null> = {
  group: SpeakingMockSessionGroup;
  topicId: string;
  topic: string;
  turns: SpeakingMockSubmissionTurnDraft<TFile>[];
};

export type SpeakingMockSubmissionRequestPayload = {
  group: SpeakingMockSessionGroup;
  topicId: string;
  topic: string;
  turns: SpeakingMockSubmissionTurnPayload[];
};

export type SpeakingMockSubmitResponse = {
  sessionId: number;
  sessionUuid: string;
  status: SpeakingMockRecordStatus;
};

export type SpeakingMockRecordSummary = {
  id: number;
  sessionUuid: string;
  group: SpeakingMockSessionGroup;
  topicId: string;
  topicTitle: string;
  status: SpeakingMockRecordStatus;
  turnCount: number;
  answeredCount: number;
  overallBand: number | null;
  submittedAt: number;
  scoringCompletedAt: number | null;
  createdAt: number;
  updatedAt: number;
  overview: string | null;
  criteria: Partial<Record<SpeakingCriterionKey, SpeakingCriterionReview>>;
  strengths: string[];
  suggestions: SpeakingImprovementSuggestion[];
  errorMessage: string | null;
};

export type SpeakingMockRecordTurn = {
  id: number;
  turnIndex: number;
  phase: SpeakingMockTurnPhase;
  questionText: string;
  userAudioUrl: string | null;
  isHistoryAudio: boolean;
  transcriptText: string | null;
  pronunciationScore: number | null;
  createdAt: number;
  updatedAt: number;
};

export type SpeakingMockRecordDetail = SpeakingMockRecordSummary & {
  turns: SpeakingMockRecordTurn[];
};

export function normalizeSpeakingBandScore(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return roundIeltsBandScore(numeric);
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

function sanitizeStringList(value: unknown, fallback: string[]) {
  const normalized = Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.replace(/\s+/g, " ").trim() : ""))
        .filter(Boolean)
        .slice(0, 4)
    : [];

  return normalized.length > 0 ? normalized : fallback;
}

function sanitizeSuggestions(
  value: unknown,
  criteria: Record<SpeakingCriterionKey, SpeakingCriterionReview>,
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
            title: sanitizeText(record.title, "优先修正当前口语回答中的短板"),
            action: sanitizeText(
              record.action,
              "重新录一遍同题回答，先压缩停顿，再提高表达展开和句式准确性。",
            ),
            example: sanitizeText(
              record.example,
              "先用 2 句直接回答，再补 1 个原因和 1 个具体例子，最后用一句总结收尾。",
            ),
          } satisfies SpeakingImprovementSuggestion;
        })
        .filter((item): item is SpeakingImprovementSuggestion => Boolean(item))
        .slice(0, 4)
    : [];

  if (suggestions.length >= 2) {
    return suggestions;
  }

  const weakestCriteria = (
    Object.entries(criteria) as [SpeakingCriterionKey, SpeakingCriterionReview][]
  )
    .sort((left, right) => left[1].band - right[1].band)
    .slice(0, 2);

  const fallbackSuggestions = weakestCriteria.map(([key, criterion], index) => {
    const title =
      key === "pronunciation"
        ? "先稳住发音清晰度"
        : key === "fluencyAndCoherence"
          ? "减少停顿并拉顺回答结构"
          : key === "lexicalResource"
            ? "扩大词汇选择并减少重复"
            : "控制语法错误并增加句式变化";

    return {
      priority: index === 0 ? "high" : "medium",
      title,
      action: criterion.comment,
      example: "用同一道题重复练习 2 到 3 次，每次只专注修正一个问题。",
    } satisfies SpeakingImprovementSuggestion;
  });

  return [...suggestions, ...fallbackSuggestions].slice(0, 3);
}

export function normalizeSpeakingCriteria(
  value: unknown,
): Partial<Record<SpeakingCriterionKey, SpeakingCriterionReview>> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const result: Partial<Record<SpeakingCriterionKey, SpeakingCriterionReview>> = {};

  for (const key of [
    "pronunciation",
    "fluencyAndCoherence",
    "lexicalResource",
    "grammaticalRangeAndAccuracy",
  ] satisfies SpeakingCriterionKey[]) {
    const criterion =
      record[key] && typeof record[key] === "object"
        ? (record[key] as Record<string, unknown>)
        : null;

    if (!criterion) {
      continue;
    }

    result[key] = {
      band: sanitizeBand(criterion.band),
      comment: sanitizeText(criterion.comment, ""),
    };
  }

  return result;
}

export function normalizeSpeakingSuggestions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const priority =
        record.priority === "high" || record.priority === "medium" || record.priority === "low"
          ? record.priority
          : "medium";

      return {
        priority,
        title: sanitizeText(record.title, "优先修正当前口语回答中的短板"),
        action: sanitizeText(
          record.action,
          "重新录一遍同题回答，先压缩停顿，再提高表达展开和句式准确性。",
        ),
        example: sanitizeText(
          record.example,
          "先用 2 句直接回答，再补 1 个原因和 1 个具体例子，最后用一句总结收尾。",
        ),
      } satisfies SpeakingImprovementSuggestion;
    })
    .filter((item): item is SpeakingImprovementSuggestion => Boolean(item))
    .slice(0, 4);
}

export function normalizeSpeakingAiReview(
  raw: unknown,
  {
    pronunciationBand,
  }: {
    pronunciationBand: number | null;
  },
): SpeakingAiReview {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawCriteria =
    record.criteria && typeof record.criteria === "object"
      ? (record.criteria as Record<string, unknown>)
      : {};

  const normalizedPronunciationBand =
    pronunciationBand === null ? 5.5 : sanitizeBand(pronunciationBand);

  const criteria: Record<SpeakingCriterionKey, SpeakingCriterionReview> = {
    pronunciation: {
      band: normalizedPronunciationBand,
      comment: sanitizeText(
        rawCriteria.pronunciation && typeof rawCriteria.pronunciation === "object"
          ? (rawCriteria.pronunciation as Record<string, unknown>).comment
          : undefined,
        "发音基本可以理解，但音准、连读和重音控制还不够稳定。",
      ),
    },
    fluencyAndCoherence: {
      band: sanitizeBand(
        rawCriteria.fluencyAndCoherence && typeof rawCriteria.fluencyAndCoherence === "object"
          ? (rawCriteria.fluencyAndCoherence as Record<string, unknown>).band
          : undefined,
      ),
      comment: sanitizeText(
        rawCriteria.fluencyAndCoherence && typeof rawCriteria.fluencyAndCoherence === "object"
          ? (rawCriteria.fluencyAndCoherence as Record<string, unknown>).comment
          : undefined,
        "回答有基本推进，但停顿控制和逻辑衔接还不够自然。",
      ),
    },
    lexicalResource: {
      band: sanitizeBand(
        rawCriteria.lexicalResource && typeof rawCriteria.lexicalResource === "object"
          ? (rawCriteria.lexicalResource as Record<string, unknown>).band
          : undefined,
      ),
      comment: sanitizeText(
        rawCriteria.lexicalResource && typeof rawCriteria.lexicalResource === "object"
          ? (rawCriteria.lexicalResource as Record<string, unknown>).comment
          : undefined,
        "词汇足以完成基本表达，但重复和搭配不够自然。",
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
        "句式有一定变化，但准确率和稳定性还会拉低得分。",
      ),
    },
  };

  const overallBand = roundIeltsBandScore(
    (criteria.pronunciation.band +
      criteria.fluencyAndCoherence.band +
      criteria.lexicalResource.band +
      criteria.grammaticalRangeAndAccuracy.band) /
      4,
  );

  return {
    overallBand,
    overview: sanitizeText(
      record.overview,
      "这次口语回答已经具备基本作答能力，但流利度、语言展开和表达准确性还有明显提分空间。",
    ),
    criteria,
    strengths: sanitizeStringList(record.strengths, [
      "能够围绕题目给出基本回应，没有明显跑题。",
      "整体表达可理解，具备继续打磨成更高分回答的基础。",
    ]),
    suggestions: sanitizeSuggestions(record.suggestions, criteria),
  };
}

export function convertPronunciationScoreToBand(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return roundIeltsBandScore((Math.max(0, Math.min(100, numeric)) / 100) * 9);
}

export function createSpeakingMockSubmitFormData(
  payload: SpeakingMockSubmissionPayload<File | null>,
) {
  const formData = new FormData();

  const turns = payload.turns.map((turn, index) => {
    const userAudioField = `audio_${index + 1}`;
    if (turn.userAudioFile) {
      formData.append(
        userAudioField,
        turn.userAudioFile,
        turn.userAudioFile.name,
      );
    }

    return {
      phase: turn.phase,
      questionId: turn.questionId,
      question: turn.question,
      requirements: turn.requirements,
      examinerAudioUrl: turn.examinerAudioUrl,
      userAudioField,
    } satisfies SpeakingMockSubmissionTurnPayload;
  });

  const metadata: SpeakingMockSubmissionRequestPayload = {
    group: payload.group,
    topicId: payload.topicId,
    topic: payload.topic,
    turns,
  };

  formData.append("metadata", JSON.stringify(metadata));
  return formData;
}
