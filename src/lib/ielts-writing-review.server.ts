import {
  countEssayWords,
  getTaskFulfillmentLabel,
  normalizeWritingAiReview,
  stripHtmlToPlainText,
  type WritingAiReview,
  type WritingTaskType,
} from "@/lib/ielts-writing-review";

export type WritingReviewPromptContext = {
  id: string;
  paperTitle: string;
  paperTestNo: number | null;
  partNo: number;
  title: string;
  instructionHtml: string | null;
  contentHtml: string | null;
  imageInfo: string | null;
};

type WorkersAiBinding = {
  run(model: string, inputs: unknown): Promise<unknown>;
};

type WorkersAiEnv = CloudflareEnv & {
  AI?: WorkersAiBinding;
  WORKERS_AI_MODEL?: string;
  WORKERS_AI_URL?: string;
};

type ReviewPromptPayload = {
  taskType: WritingTaskType;
  minimumWordCount: number;
  wordCount: number;
  essay: string;
  context: WritingReviewPromptContext;
  strictJson?: boolean;
};

const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const DEFAULT_WORKERS_AI_URL = "https://llm.ricardocao-biker.workers.dev";

const REVIEW_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overview", "criteria", "contentFeedback", "improvementSuggestions"],
  properties: {
    overview: {
      type: "string",
      description: "1-2 句中文总评，直接概括当前作文的得分水平和主要短板。",
    },
    criteria: {
      type: "object",
      additionalProperties: false,
      required: [
        "taskFulfillment",
        "coherenceAndCohesion",
        "lexicalResource",
        "grammaticalRangeAndAccuracy",
      ],
      properties: {
        taskFulfillment: {
          type: "object",
          additionalProperties: false,
          required: ["band", "comment"],
          properties: {
            band: { type: "number", minimum: 0, maximum: 9, multipleOf: 0.5 },
            comment: { type: "string" },
          },
        },
        coherenceAndCohesion: {
          type: "object",
          additionalProperties: false,
          required: ["band", "comment"],
          properties: {
            band: { type: "number", minimum: 0, maximum: 9, multipleOf: 0.5 },
            comment: { type: "string" },
          },
        },
        lexicalResource: {
          type: "object",
          additionalProperties: false,
          required: ["band", "comment"],
          properties: {
            band: { type: "number", minimum: 0, maximum: 9, multipleOf: 0.5 },
            comment: { type: "string" },
          },
        },
        grammaticalRangeAndAccuracy: {
          type: "object",
          additionalProperties: false,
          required: ["band", "comment"],
          properties: {
            band: { type: "number", minimum: 0, maximum: 9, multipleOf: 0.5 },
            comment: { type: "string" },
          },
        },
      },
    },
    contentFeedback: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
      description: "针对这篇作文内容本身的中文点评，每条一句。",
    },
    improvementSuggestions: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["priority", "title", "action", "example"],
        properties: {
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
          title: { type: "string" },
          action: { type: "string" },
          example: { type: "string" },
        },
      },
    },
  },
} as const;

function normalizePlainTextResponse(text: string) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fencedMatch ? fencedMatch[1] : text;
  return raw.trim();
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function looksLikeWritingReviewPayload(value: unknown): value is Record<string, unknown> {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.overview === "string" &&
    isObjectRecord(value.criteria) &&
    Array.isArray(value.contentFeedback) &&
    Array.isArray(value.improvementSuggestions)
  );
}

function extractStructuredReviewPayload(aiResult: unknown): Record<string, unknown> | null {
  if (looksLikeWritingReviewPayload(aiResult)) {
    return aiResult;
  }

  if (Array.isArray(aiResult)) {
    for (let index = aiResult.length - 1; index >= 0; index -= 1) {
      const nested = extractStructuredReviewPayload(aiResult[index]);
      if (nested) return nested;
    }

    return null;
  }

  if (!isObjectRecord(aiResult)) {
    return null;
  }

  const nestedCandidates = [aiResult.response, aiResult.result];
  for (const candidate of nestedCandidates) {
    const nested = extractStructuredReviewPayload(candidate);
    if (nested) return nested;
  }

  const choices = Array.isArray(aiResult.choices) ? aiResult.choices : [];
  for (const choice of choices) {
    if (!isObjectRecord(choice) || !isObjectRecord(choice.message)) {
      continue;
    }

    const nested = extractStructuredReviewPayload(choice.message.content);
    if (nested) return nested;
  }

  return null;
}

function extractTextFromWorkersAI(aiResult: unknown) {
  const nonEmpty = (value: unknown) => {
    if (typeof value !== "string") return "";
    return value.trim();
  };

  const pickMessageContent = (value: unknown) => {
    if (typeof value === "string") return value;
    if (!Array.isArray(value)) return "";

    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (!isObjectRecord(item)) return "";
        if (typeof item.text === "string") return item.text;
        if (typeof item.content === "string") return item.content;
        if (typeof item.value === "string") return item.value;
        if (looksLikeWritingReviewPayload(item)) return JSON.stringify(item);
        return "";
      })
      .filter(Boolean)
      .join("\n");
  };

  if (Array.isArray(aiResult)) {
    const lastTask = aiResult[aiResult.length - 1];
    if (!lastTask || typeof lastTask !== "object") return "";

    const nestedResponse = (lastTask as Record<string, unknown>).response;
    const nestedRaw = nonEmpty(nestedResponse);
    if (nestedRaw) return nestedRaw;

    if (isObjectRecord(nestedResponse)) {
      const structured = extractStructuredReviewPayload(nestedResponse);
      if (structured) return JSON.stringify(structured);

      const nestedText = nonEmpty(nestedResponse.response);
      if (nestedText) return nestedText;
    }
  }

  if (!aiResult || typeof aiResult !== "object") return "";

  const result = aiResult as Record<string, unknown>;
  const rootResponse = nonEmpty(result.response);
  if (rootResponse) return rootResponse;

  const resultObj = isObjectRecord(result.result) ? result.result : null;
  if (resultObj) {
    const resultResponse = nonEmpty(resultObj.response);
    if (resultResponse) return resultResponse;

    const structured = extractStructuredReviewPayload(resultObj);
    if (structured) return JSON.stringify(structured);

    const resultChoices = Array.isArray(resultObj.choices) ? resultObj.choices : [];
    if (resultChoices[0] && typeof resultChoices[0] === "object") {
      const message = (resultChoices[0] as Record<string, unknown>).message;
      const content = pickMessageContent(isObjectRecord(message) ? message.content : undefined);
      if (content) return content;
    }
  }

  const structured = extractStructuredReviewPayload(result);
  if (structured) return JSON.stringify(structured);

  const rootChoices = Array.isArray(result.choices) ? result.choices : [];
  if (rootChoices[0] && typeof rootChoices[0] === "object") {
    const message = (rootChoices[0] as Record<string, unknown>).message;
    const content = pickMessageContent(isObjectRecord(message) ? message.content : undefined);
    if (content) return content;
  }

  return "";
}

function parseJsonResponse(rawText: string) {
  const normalized = normalizePlainTextResponse(rawText);
  if (!normalized) {
    throw new Error("Workers AI returned empty text.");
  }

  try {
    return JSON.parse(normalized);
  } catch (error) {
    throw new Error(
      `Failed to parse Workers AI JSON response: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function buildPrompt({
  taskType,
  minimumWordCount,
  wordCount,
  essay,
  context,
  strictJson = false,
}: ReviewPromptPayload) {
  const instructionText = stripHtmlToPlainText(context.instructionHtml);
  const contentText = stripHtmlToPlainText(context.contentHtml);
  const taskLabel = taskType === "part1" ? "IELTS Academic Writing Task 1" : "IELTS Writing Task 2";
  const taskCriterion = getTaskFulfillmentLabel(taskType);

  return `请你作为一名严格的雅思写作考官，对下面这篇作文进行估分。

评分规则：
1. 必须严格按照 IELTS Writing 的四项标准打分。
2. 本题为 ${taskLabel}，第一项标准必须按 ${taskCriterion} 评估。
3. 分数只能使用 0 到 9 之间、步长为 0.5 的 band。
4. 点评和建议必须使用简体中文，并且必须针对这篇作文本身，不能给空泛模板。
5. 不要改写整篇作文，不要输出题外解释，只返回符合 schema 的 JSON。
6. 如果作文明显低于建议字数，需要在点评中明确指出其对分数的影响。
7. 所有字符串内容里不要使用 ASCII 双引号字符 "。如需强调，请改用单引号或中文引号。
8. 输出必须是合法 JSON；不要在 JSON 前后添加任何解释文字。
${strictJson ? '9. 这是一次 JSON 修复重试，必须输出单行合法 JSON，不能包含 markdown 代码块，不能包含注释，不能包含多余逗号。' : ""}

题目信息：
- paper: ${context.paperTitle}${context.paperTestNo ? ` Test ${context.paperTestNo}` : ""}
- part: ${context.partNo}
- title: ${context.title}
- recommended_words: ${minimumWordCount}+
- actual_words: ${wordCount}

题目说明：
${instructionText || "无"}

题目正文：
${contentText || "无"}

${
  taskType === "part1"
    ? `图表信息（来自 paper_parts.image_info）：
${context.imageInfo?.trim() || "无"}`
    : ""
}

考生作文：
${essay.trim()}`;
}

function buildPlainTextPrompt({
  taskType,
  minimumWordCount,
  wordCount,
  essay,
  context,
}: ReviewPromptPayload) {
  const instructionText = stripHtmlToPlainText(context.instructionHtml);
  const contentText = stripHtmlToPlainText(context.contentHtml);
  const taskLabel = taskType === "part1" ? "IELTS Academic Writing Task 1" : "IELTS Writing Task 2";
  const taskCriterion = getTaskFulfillmentLabel(taskType);

  return `请你作为一名严格的雅思写作考官，对下面这篇作文进行估分。

输出要求：
1. 只输出纯文本，不要 JSON，不要 Markdown 代码块，不要前言，不要解释。
2. 每个字段单独占一行，严格使用“KEY: value”格式。
3. value 内不要换行。
4. 所有点评和建议必须是简体中文。
5. 分数只能使用 0 到 9 之间、步长为 0.5 的 band。
6. 第一项评分标准必须按 ${taskCriterion} 评估。
7. 必须按下面顺序输出这些键，且不要遗漏：
OVERALL_BAND
TASK_FULFILLMENT_BAND
TASK_FULFILLMENT_COMMENT
COHERENCE_AND_COHESION_BAND
COHERENCE_AND_COHESION_COMMENT
LEXICAL_RESOURCE_BAND
LEXICAL_RESOURCE_COMMENT
GRAMMATICAL_RANGE_AND_ACCURACY_BAND
GRAMMATICAL_RANGE_AND_ACCURACY_COMMENT
OVERVIEW
CONTENT_FEEDBACK_1
CONTENT_FEEDBACK_2
CONTENT_FEEDBACK_3
SUGGESTION_1_PRIORITY
SUGGESTION_1_TITLE
SUGGESTION_1_ACTION
SUGGESTION_1_EXAMPLE
SUGGESTION_2_PRIORITY
SUGGESTION_2_TITLE
SUGGESTION_2_ACTION
SUGGESTION_2_EXAMPLE
SUGGESTION_3_PRIORITY
SUGGESTION_3_TITLE
SUGGESTION_3_ACTION
SUGGESTION_3_EXAMPLE
8. PRIORITY 只能填写 high、medium、low。

题目信息：
- paper: ${context.paperTitle}${context.paperTestNo ? ` Test ${context.paperTestNo}` : ""}
- part: ${context.partNo}
- title: ${context.title}
- recommended_words: ${minimumWordCount}+
- actual_words: ${wordCount}

题目说明：
${instructionText || "无"}

题目正文：
${contentText || "无"}

${
  taskType === "part1"
    ? `图表信息（来自 paper_parts.image_info）：
${context.imageInfo?.trim() || "无"}`
    : ""
}

考生作文：
${essay.trim()}`;
}

function truncateForLog(text: string, maxLength = 1000) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...<truncated>`;
}

function parseBandValue(value: string, fallback = 5.5) {
  const match = value.match(/\d+(?:\.\d+)?/);
  return Number(match?.[0] ?? fallback);
}

function parsePlainTextFieldMap(text: string) {
  const normalized = normalizePlainTextResponse(text);
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const fields = new Map<string, string>();

  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    fields.set(match[1], match[2].trim());
  }

  return fields;
}

function parsePlainTextReviewResponse(
  rawText: string,
  {
    taskType,
    wordCount,
  }: {
    taskType: WritingTaskType;
    wordCount: number;
  },
) {
  const fields = parsePlainTextFieldMap(rawText);
  const requiredKeys = [
    "OVERALL_BAND",
    "TASK_FULFILLMENT_BAND",
    "TASK_FULFILLMENT_COMMENT",
    "COHERENCE_AND_COHESION_BAND",
    "COHERENCE_AND_COHESION_COMMENT",
    "LEXICAL_RESOURCE_BAND",
    "LEXICAL_RESOURCE_COMMENT",
    "GRAMMATICAL_RANGE_AND_ACCURACY_BAND",
    "GRAMMATICAL_RANGE_AND_ACCURACY_COMMENT",
    "OVERVIEW",
    "CONTENT_FEEDBACK_1",
    "CONTENT_FEEDBACK_2",
    "SUGGESTION_1_PRIORITY",
    "SUGGESTION_1_TITLE",
    "SUGGESTION_1_ACTION",
    "SUGGESTION_1_EXAMPLE",
    "SUGGESTION_2_PRIORITY",
    "SUGGESTION_2_TITLE",
    "SUGGESTION_2_ACTION",
    "SUGGESTION_2_EXAMPLE",
  ];

  for (const key of requiredKeys) {
    if (!fields.get(key)) {
      throw new Error(`Workers AI plain-text response missing field: ${key}`);
    }
  }

  return normalizeWritingAiReview(
    {
      overallBand: parseBandValue(fields.get("OVERALL_BAND") ?? ""),
      overview: fields.get("OVERVIEW") ?? "",
      criteria: {
        taskFulfillment: {
          band: parseBandValue(fields.get("TASK_FULFILLMENT_BAND") ?? ""),
          comment: fields.get("TASK_FULFILLMENT_COMMENT") ?? "",
        },
        coherenceAndCohesion: {
          band: parseBandValue(fields.get("COHERENCE_AND_COHESION_BAND") ?? ""),
          comment: fields.get("COHERENCE_AND_COHESION_COMMENT") ?? "",
        },
        lexicalResource: {
          band: parseBandValue(fields.get("LEXICAL_RESOURCE_BAND") ?? ""),
          comment: fields.get("LEXICAL_RESOURCE_COMMENT") ?? "",
        },
        grammaticalRangeAndAccuracy: {
          band: parseBandValue(fields.get("GRAMMATICAL_RANGE_AND_ACCURACY_BAND") ?? ""),
          comment: fields.get("GRAMMATICAL_RANGE_AND_ACCURACY_COMMENT") ?? "",
        },
      },
      contentFeedback: [
        fields.get("CONTENT_FEEDBACK_1"),
        fields.get("CONTENT_FEEDBACK_2"),
        fields.get("CONTENT_FEEDBACK_3"),
      ].filter((item): item is string => Boolean(item)),
      improvementSuggestions: [1, 2, 3]
        .map((index) => {
          const priority = fields.get(`SUGGESTION_${index}_PRIORITY`);
          const title = fields.get(`SUGGESTION_${index}_TITLE`);
          const action = fields.get(`SUGGESTION_${index}_ACTION`);
          const example = fields.get(`SUGGESTION_${index}_EXAMPLE`);

          if (!priority || !title || !action || !example) {
            return null;
          }

          return {
            priority,
            title,
            action,
            example,
          };
        })
        .filter(Boolean),
    },
    {
      taskType,
      wordCount,
    },
  );
}

async function runWithBinding(
  env: WorkersAiEnv,
  model: string,
  messages: Array<{ role: string; content: string }>,
) {
  if (!env.AI) {
    return null;
  }

  return env.AI.run(model, {
    messages,
    response_format: {
      type: "json_schema",
      json_schema: REVIEW_RESPONSE_SCHEMA,
    },
    temperature: 0.1,
    max_tokens: 1800,
  });
}

async function runWithUrl(
  env: WorkersAiEnv,
  messages: Array<{ role: string; content: string }>,
) {
  const url =
    env.WORKERS_AI_URL?.trim() ||
    process.env.WORKERS_AI_URL?.trim() ||
    DEFAULT_WORKERS_AI_URL;
  if (!url) {
    return null;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messages,
      response_format: {
        type: "json_schema",
        json_schema: REVIEW_RESPONSE_SCHEMA,
      },
      temperature: 0.1,
    }),
  });

  const rawBody = await response.text();
  let parsedBody: unknown = rawBody;

  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsedBody = rawBody;
  }

  if (!response.ok) {
    throw new Error(
      `Workers AI request failed (${response.status} ${response.statusText}): ${
        typeof parsedBody === "string" ? parsedBody : JSON.stringify(parsedBody)
      }`,
    );
  }

  return parsedBody;
}

export async function generateWritingAiReview(
  env: WorkersAiEnv,
  context: WritingReviewPromptContext,
  essay: string,
): Promise<WritingAiReview> {
  const trimmedEssay = essay.trim();
  const taskType: WritingTaskType = context.partNo === 1 ? "part1" : "part2";
  const minimumWordCount = taskType === "part1" ? 150 : 250;
  const wordCount = countEssayWords(trimmedEssay);
  const model =
    env.WORKERS_AI_MODEL?.trim() ||
    process.env.WORKERS_AI_MODEL?.trim() ||
    DEFAULT_WORKERS_AI_MODEL;
  let lastError: unknown = null;
  let lastRawText = "";

  if (env.AI) {
    for (const strictJson of [false, true]) {
      const prompt = buildPrompt({
        taskType,
        minimumWordCount,
        wordCount,
        essay: trimmedEssay,
        context,
        strictJson,
      });
      const messages = [
        {
          role: "system",
          content:
            "你是一名严谨的 IELTS Writing 考官。你必须依据 IELTS 官方四项写作标准估分，并且只返回合法 JSON。",
        },
        {
          role: "user",
          content: prompt,
        },
      ];

      try {
        const rawResult = await runWithBinding(env, model, messages);

        if (!rawResult) {
          throw new Error(
            "Workers AI is not configured. Add an AI binding or set WORKERS_AI_URL.",
          );
        }

        const structuredPayload = extractStructuredReviewPayload(rawResult);
        if (structuredPayload) {
          return normalizeWritingAiReview(structuredPayload, {
            taskType,
            wordCount,
          });
        }

        const rawText = extractTextFromWorkersAI(rawResult);
        lastRawText = rawText;
        if (!rawText) {
          console.error("Unrecognized Workers AI payload for writing review:", {
            strictJson,
            topLevelType: Array.isArray(rawResult) ? "array" : typeof rawResult,
            topLevelKeys: isObjectRecord(rawResult) ? Object.keys(rawResult).slice(0, 12) : [],
          });
        }
        const parsed = parseJsonResponse(rawText);

        return normalizeWritingAiReview(parsed, {
          taskType,
          wordCount,
        });
      } catch (error) {
        lastError = error;

        if (!(error instanceof Error) || !error.message.includes("Failed to parse Workers AI JSON response")) {
          throw error;
        }

        console.error("Workers AI returned malformed JSON for writing review:", {
          strictJson,
          message: error.message,
          rawTextPreview: truncateForLog(lastRawText),
        });
      }
    }
  }

  try {
    const plainTextPrompt = buildPlainTextPrompt({
      taskType,
      minimumWordCount,
      wordCount,
      essay: trimmedEssay,
      context,
    });
    const urlMessages = [
      {
        role: "system",
        content:
          "你是一名严谨的 IELTS Writing 考官。你必须按要求只输出纯文本字段，不要 JSON，不要 Markdown。",
      },
      {
        role: "user",
        content: plainTextPrompt,
      },
    ];
    const rawUrlResult = await runWithUrl(env, urlMessages);
    if (!rawUrlResult) {
      throw new Error(
        "Workers AI is not configured. Add an AI binding or set WORKERS_AI_URL.",
      );
    }

    const rawText = extractTextFromWorkersAI(rawUrlResult);
    lastRawText = rawText;

    if (!rawText) {
      console.error("Workers AI URL fallback returned empty text for writing review:", {
        topLevelType: Array.isArray(rawUrlResult) ? "array" : typeof rawUrlResult,
        topLevelKeys: isObjectRecord(rawUrlResult) ? Object.keys(rawUrlResult).slice(0, 12) : [],
      });
      throw new Error("Workers AI returned empty text.");
    }

    return parsePlainTextReviewResponse(rawText, {
      taskType,
      wordCount,
    });
  } catch (error) {
    console.error("Workers AI URL fallback failed for writing review:", {
      message: error instanceof Error ? error.message : String(error),
      rawTextPreview: truncateForLog(lastRawText),
    });
    lastError = error;
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Failed to generate writing review.");
}
