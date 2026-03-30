import * as SpeechSDKModule from "microsoft-cognitiveservices-speech-sdk";
import {
  convertPronunciationScoreToBand,
  normalizeSpeakingAiReview,
  type SpeakingAiReview,
  type SpeakingMockSessionGroup,
  type SpeakingMockTurnPhase,
} from "@/lib/speaking-mock-review";

type WorkersAiBinding = {
  run(model: string, inputs: unknown): Promise<unknown>;
};

export type SpeakingReviewEnv = CloudflareEnv & {
  AI?: WorkersAiBinding;
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
  AZURE_SPEECH_LANGUAGE?: string;
  WORKERS_AI_MODEL?: string;
  WORKERS_AI_URL?: string;
};

export type SpeakingPronunciationTurnInput = {
  turnId: number;
  turnIndex: number;
  phase: SpeakingMockTurnPhase;
  questionText: string;
  requirements: string[];
  userAudioUrl: string;
};

export type SpeakingPronunciationTurnResult = {
  turnId: number;
  turnIndex: number;
  phase: SpeakingMockTurnPhase;
  questionText: string;
  requirements: string[];
  transcriptText: string;
  transcriptConfidence: number | null;
  pronunciationOverallScore: number | null;
  pronunciationAccuracyScore: number | null;
  pronunciationFluencyScore: number | null;
  pronunciationCompletenessScore: number | null;
  pronunciationProsodyScore: number | null;
  pronunciationBand: number | null;
  pronunciationResultJson: string;
};

export type SpeakingOverallReviewInput = {
  group: SpeakingMockSessionGroup;
  topicId: string;
  topicTitle: string;
  turns: SpeakingPronunciationTurnResult[];
};

type RecognizedSegment = {
  text: string;
  confidence: number | null;
  pronunciationScore: number | null;
  accuracyScore: number | null;
  fluencyScore: number | null;
  completenessScore: number | null;
  prosodyScore: number | null;
  wordCount: number;
  rawJson: unknown;
};

const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const DEFAULT_WORKERS_AI_URL = "https://llm.ricardocao-biker.workers.dev";
const DEFAULT_AZURE_LANGUAGE = "en-US";
const SpeechSDK = (SpeechSDKModule as { default?: any }).default ?? SpeechSDKModule;

const SPEAKING_REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overview", "criteria", "strengths", "suggestions"],
  properties: {
    overview: {
      type: "string",
      description: "1-2 句中文总评，直接概括当前口语水平和主要短板。",
    },
    criteria: {
      type: "object",
      additionalProperties: false,
      required: [
        "pronunciation",
        "fluencyAndCoherence",
        "lexicalResource",
        "grammaticalRangeAndAccuracy",
      ],
      properties: {
        pronunciation: {
          type: "object",
          additionalProperties: false,
          required: ["band", "comment"],
          properties: {
            band: { type: "number", minimum: 0, maximum: 9, multipleOf: 0.5 },
            comment: { type: "string" },
          },
        },
        fluencyAndCoherence: {
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
    strengths: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
    },
    suggestions: {
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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePlainTextResponse(text: string) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fencedMatch ? fencedMatch[1] : text;
  return raw.trim();
}

function truncateForLog(text: string, maxLength = 1000) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...<truncated>`;
}

function ensureSpeechSdkAvailable() {
  if (!SpeechSDK?.SpeechConfig) {
    throw new Error(
      "Azure Speech SDK 在当前运行时中未正确加载。请检查 Cloudflare Worker 打包后的 CJS/ESM 互操作兼容性。",
    );
  }
}

function readAscii(view: DataView, offset: number, length: number) {
  let result = "";

  for (let index = 0; index < length; index += 1) {
    result += String.fromCharCode(view.getUint8(offset + index));
  }

  return result;
}

type WavAudioMetadata = {
  summary: string;
  durationSeconds: number | null;
  channelCount: number | null;
  sampleRate: number | null;
  bitsPerSample: number | null;
  rmsLevel: number | null;
  peakLevel: number | null;
  pcmData: Buffer | null;
};

function getWavAudioMetadata(audioBuffer: Buffer): WavAudioMetadata {
  if (audioBuffer.byteLength < 44) {
    return {
      summary: `bytes=${audioBuffer.byteLength}, invalid_wav_header=true`,
      durationSeconds: null,
      channelCount: null,
      sampleRate: null,
      bitsPerSample: null,
      rmsLevel: null,
      peakLevel: null,
      pcmData: null,
    };
  }

  const view = new DataView(
    audioBuffer.buffer,
    audioBuffer.byteOffset,
    audioBuffer.byteLength,
  );
  const riff = readAscii(view, 0, 4);
  const wave = readAscii(view, 8, 4);

  if (riff !== "RIFF" || wave !== "WAVE") {
    return {
      summary: `bytes=${audioBuffer.byteLength}, header=${riff}/${wave}`,
      durationSeconds: null,
      channelCount: null,
      sampleRate: null,
      bitsPerSample: null,
      rmsLevel: null,
      peakLevel: null,
      pcmData: null,
    };
  }

  let chunkOffset = 12;
  let channelCount: number | null = null;
  let sampleRate: number | null = null;
  let bitsPerSample: number | null = null;
  let dataOffset: number | null = null;
  let dataSize: number | null = null;
  const visitedChunks: string[] = [];

  while (chunkOffset + 8 <= audioBuffer.byteLength) {
    const chunkId = readAscii(view, chunkOffset, 4);
    const chunkSize = view.getUint32(chunkOffset + 4, true);
    visitedChunks.push(chunkId);

    const chunkDataOffset = chunkOffset + 8;
    if (chunkDataOffset + chunkSize > audioBuffer.byteLength) {
      break;
    }

    if (chunkId === "fmt " && chunkSize >= 16) {
      channelCount = view.getUint16(chunkDataOffset + 2, true);
      sampleRate = view.getUint32(chunkDataOffset + 4, true);
      bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
    } else if (chunkId === "data") {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
      if (channelCount !== null && sampleRate !== null && bitsPerSample !== null) {
        break;
      }
    }

    chunkOffset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (
    channelCount === null ||
    sampleRate === null ||
    bitsPerSample === null ||
    dataOffset === null ||
    dataSize === null
  ) {
    return {
      summary: `bytes=${audioBuffer.byteLength}, chunks=${visitedChunks.join("/") || "none"}`,
      durationSeconds: null,
      channelCount,
      sampleRate,
      bitsPerSample,
      rmsLevel: null,
      peakLevel: null,
      pcmData: null,
    };
  }

  const remainingBytes = Math.max(0, audioBuffer.byteLength - dataOffset);
  const effectiveDataSize =
    dataSize > 0 ? Math.min(dataSize, remainingBytes) : remainingBytes;
  const pcmData =
    effectiveDataSize > 0
      ? audioBuffer.subarray(dataOffset, dataOffset + effectiveDataSize)
      : null;

  let peakLevel = 0;
  let squareSum = 0;
  let sampleCount = 0;

  if (bitsPerSample === 16 && pcmData) {
    const dataEnd = dataOffset + effectiveDataSize;
    for (let offset = dataOffset; offset + 1 < dataEnd; offset += 2) {
      const normalized = view.getInt16(offset, true) / 32768;
      const absolute = Math.abs(normalized);
      peakLevel = Math.max(peakLevel, absolute);
      squareSum += normalized * normalized;
      sampleCount += 1;
    }
  }

  const durationSeconds =
    channelCount > 0 && bitsPerSample > 0 && sampleRate > 0
      ? Number(
          (
            effectiveDataSize /
            (sampleRate * channelCount * Math.max(1, bitsPerSample / 8))
          ).toFixed(2),
        )
      : null;
  const rmsLevel =
    sampleCount > 0 ? Number(Math.sqrt(squareSum / sampleCount).toFixed(4)) : null;
  const normalizedPeak =
    sampleCount > 0 ? Number(peakLevel.toFixed(4)) : null;

    return {
      summary: [
        `bytes=${audioBuffer.byteLength}`,
        `chunks=${visitedChunks.join("/")}`,
        `channels=${channelCount}`,
        `sampleRate=${sampleRate}`,
        `bitsPerSample=${bitsPerSample}`,
        `dataSize=${dataSize}`,
        `effectiveDataSize=${effectiveDataSize}`,
        `duration=${durationSeconds ?? "unknown"}s`,
        `rms=${rmsLevel ?? "unknown"}`,
        `peak=${normalizedPeak ?? "unknown"}`,
      ].join(", "),
    durationSeconds,
    channelCount,
    sampleRate,
    bitsPerSample,
    rmsLevel,
    peakLevel: normalizedPeak,
    pcmData,
  };
}

function buildCanonicalPcmWavBuffer(metadata: WavAudioMetadata) {
  if (
    !metadata.pcmData ||
    metadata.channelCount === null ||
    metadata.sampleRate === null ||
    metadata.bitsPerSample === null
  ) {
    return null;
  }

  const headerSize = 44;
  const pcmData = metadata.pcmData;
  const buffer = Buffer.alloc(headerSize + pcmData.byteLength);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const blockAlign = metadata.channelCount * Math.max(1, metadata.bitsPerSample / 8);
  const byteRate = metadata.sampleRate * blockAlign;

  buffer.write("RIFF", 0, "ascii");
  view.setUint32(4, headerSize + pcmData.byteLength - 8, true);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, metadata.channelCount, true);
  view.setUint32(24, metadata.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, metadata.bitsPerSample, true);
  buffer.write("data", 36, "ascii");
  view.setUint32(40, pcmData.byteLength, true);
  pcmData.copy(buffer, headerSize);

  return buffer;
}

function getSpeechSdkEnumKey(enumLike: Record<string, unknown> | undefined, value: unknown) {
  if (!enumLike) {
    return String(value ?? "");
  }

  const matched = Object.entries(enumLike).find(([, candidate]) => candidate === value);
  return matched?.[0] || String(value ?? "");
}

function buildAzureCancellationMessage(event: any, audioSummary: string) {
  const reason = getSpeechSdkEnumKey(SpeechSDK.CancellationReason, event?.reason);
  const errorCode = getSpeechSdkEnumKey(SpeechSDK.CancellationErrorCode, event?.errorCode);
  const details = [
    typeof event?.errorDetails === "string" ? event.errorDetails.trim() : "",
    typeof event?.result?.errorDetails === "string" ? event.result.errorDetails.trim() : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const parts = [
    "Azure Speech 评分被取消",
    reason ? `reason=${reason}` : "",
    errorCode ? `errorCode=${errorCode}` : "",
    event?.sessionId ? `sessionId=${event.sessionId}` : "",
    audioSummary ? `audio=${audioSummary}` : "",
    details ? `details=${details}` : "",
  ].filter(Boolean);

  return parts.join("; ");
}

function getSpeechProperty(result: any, propertyId: unknown) {
  return result?.properties?.getProperty?.(propertyId);
}

function logAzureRecognitionResult(
  label: string,
  {
    turn,
    audioUrl,
    audioSummary,
    result,
  }: {
    turn: SpeakingPronunciationTurnInput;
    audioUrl: string;
    audioSummary: string;
    result: any;
  },
) {
  console.info(label, {
    turnId: turn.turnId,
    turnIndex: turn.turnIndex,
    phase: turn.phase,
    questionText: turn.questionText,
    audioUrl,
    audioSummary,
    reason: getSpeechSdkEnumKey(SpeechSDK.ResultReason, result?.reason),
    text: typeof result?.text === "string" ? result.text : "",
    duration: typeof result?.duration === "number" ? result.duration : null,
    offset: typeof result?.offset === "number" ? result.offset : null,
    errorDetails:
      typeof result?.errorDetails === "string" ? result.errorDetails.trim() : "",
    json:
      typeof result?.json === "string" ? truncateForLog(result.json, 2000) : "",
    recognitionStatus: getSpeechProperty(
      result,
      SpeechSDK.PropertyId?.SpeechServiceResponse_RecognitionStatus,
    ),
    jsonResult: truncateForLog(
      String(
        getSpeechProperty(
          result,
          SpeechSDK.PropertyId?.SpeechServiceResponse_JsonResult,
        ) ?? "",
      ),
      2000,
    ),
    speechSessionId: getSpeechProperty(
      result,
      SpeechSDK.PropertyId?.Speech_SessionId,
    ),
    detailedResultFlag: getSpeechProperty(
      result,
      SpeechSDK.PropertyId?.SpeechServiceResponse_RequestDetailedResultTrueFalse,
    ),
  });
}

function extractStructuredPayload(aiResult: unknown): Record<string, unknown> | null {
  if (
    isObjectRecord(aiResult) &&
    typeof aiResult.overview === "string" &&
    isObjectRecord(aiResult.criteria) &&
    Array.isArray(aiResult.strengths) &&
    Array.isArray(aiResult.suggestions)
  ) {
    return aiResult;
  }

  if (Array.isArray(aiResult)) {
    for (let index = aiResult.length - 1; index >= 0; index -= 1) {
      const nested = extractStructuredPayload(aiResult[index]);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  if (!isObjectRecord(aiResult)) {
    return null;
  }

  for (const candidate of [aiResult.response, aiResult.result]) {
    const nested = extractStructuredPayload(candidate);
    if (nested) {
      return nested;
    }
  }

  const choices = Array.isArray(aiResult.choices) ? aiResult.choices : [];
  for (const choice of choices) {
    if (!isObjectRecord(choice) || !isObjectRecord(choice.message)) {
      continue;
    }

    const nested = extractStructuredPayload(choice.message.content);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function extractTextFromWorkersAI(aiResult: unknown) {
  const nonEmpty = (value: unknown) => {
    if (typeof value !== "string") {
      return "";
    }

    return value.trim();
  };

  const pickMessageContent = (value: unknown) => {
    if (typeof value === "string") {
      return value;
    }

    if (!Array.isArray(value)) {
      return "";
    }

    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (!isObjectRecord(item)) return "";
        if (typeof item.text === "string") return item.text;
        if (typeof item.content === "string") return item.content;
        if (typeof item.value === "string") return item.value;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  };

  if (Array.isArray(aiResult)) {
    const lastTask = aiResult[aiResult.length - 1];
    if (!isObjectRecord(lastTask)) {
      return "";
    }

    const nestedResponse = lastTask.response;
    const nestedRaw = nonEmpty(nestedResponse);
    if (nestedRaw) {
      return nestedRaw;
    }
  }

  if (!isObjectRecord(aiResult)) {
    return "";
  }

  const rootResponse = nonEmpty(aiResult.response);
  if (rootResponse) {
    return rootResponse;
  }

  const resultObj = isObjectRecord(aiResult.result) ? aiResult.result : null;
  if (resultObj) {
    const resultResponse = nonEmpty(resultObj.response);
    if (resultResponse) {
      return resultResponse;
    }

    const resultChoices = Array.isArray(resultObj.choices) ? resultObj.choices : [];
    if (resultChoices[0] && isObjectRecord(resultChoices[0])) {
      const message = isObjectRecord(resultChoices[0].message)
        ? resultChoices[0].message
        : null;
      const content = pickMessageContent(message?.content);
      if (content) {
        return content;
      }
    }
  }

  const rootChoices = Array.isArray(aiResult.choices) ? aiResult.choices : [];
  if (rootChoices[0] && isObjectRecord(rootChoices[0])) {
    const message = isObjectRecord(rootChoices[0].message) ? rootChoices[0].message : null;
    const content = pickMessageContent(message?.content);
    if (content) {
      return content;
    }
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

function getAzureSpeechSetting(
  env: SpeakingReviewEnv,
  key: "AZURE_SPEECH_KEY" | "AZURE_SPEECH_REGION" | "AZURE_SPEECH_LANGUAGE",
) {
  return env[key]?.trim() || process.env[key]?.trim() || "";
}

function buildSpeakingPrompt(input: SpeakingOverallReviewInput) {
  const pronunciationBandCandidates = input.turns
    .map((turn) => turn.pronunciationBand)
    .filter((value): value is number => value !== null);
  const averagePronunciationBand =
    pronunciationBandCandidates.length > 0
      ? pronunciationBandCandidates.reduce((sum, value) => sum + value, 0) /
        pronunciationBandCandidates.length
      : null;

  const turnBlocks = input.turns
    .map((turn, index) => {
      const requirements =
        turn.requirements.length > 0 ? `\nrequirements: ${turn.requirements.join(" | ")}` : "";

      return `Turn ${index + 1}
phase: ${turn.phase}
question: ${turn.questionText}${requirements}
transcript: ${turn.transcriptText || "无有效转写"}
azure_pronunciation_score: ${turn.pronunciationOverallScore ?? "null"}
azure_accuracy_score: ${turn.pronunciationAccuracyScore ?? "null"}
azure_fluency_score: ${turn.pronunciationFluencyScore ?? "null"}
azure_completeness_score: ${turn.pronunciationCompletenessScore ?? "null"}
azure_prosody_score: ${turn.pronunciationProsodyScore ?? "null"}
azure_pronunciation_band_estimate: ${turn.pronunciationBand ?? "null"}`;
    })
    .join("\n\n");

  return `请你作为一名严格的雅思口语考官，对下面这次口语模考进行估分。

评分要求：
1. 必须按照 IELTS Speaking 的四项标准评分：Pronunciation、Fluency and Coherence、Lexical Resource、Grammatical Range and Accuracy。
2. 分数只能使用 0 到 9 之间、步长为 0.5 的 band。
3. 所有点评、优点、建议都必须使用简体中文，并且必须针对这次回答本身，不能写空泛模板。
4. 只返回符合 schema 的 JSON，不要额外解释。
5. Pronunciation 的 band 必须以 Azure 的发音结果为主，尽量贴近给定的发音 band 估计。
6. 如果转写内容明显过短、停顿过多、重复严重、语法错误多或词汇单一，必须在对应维度里明确指出。
7. 所有字符串内容里不要使用 ASCII 双引号字符 "。如需强调，请改用单引号或中文引号。

模考信息：
- group: ${input.group}
- topic_id: ${input.topicId}
- topic_title: ${input.topicTitle}
- azure_pronunciation_band_estimate: ${averagePronunciationBand?.toFixed(1) ?? "null"}

逐题信息：
${turnBlocks}`;
}

async function runWithBinding(
  env: SpeakingReviewEnv,
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
      json_schema: SPEAKING_REVIEW_SCHEMA,
    },
    temperature: 0.1,
    max_tokens: 1800,
  });
}

async function runWithUrl(
  env: SpeakingReviewEnv,
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
        json_schema: SPEAKING_REVIEW_SCHEMA,
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

function getWeightedAverage(
  segments: RecognizedSegment[],
  picker: (segment: RecognizedSegment) => number | null,
) {
  let weightedTotal = 0;
  let totalWeight = 0;

  for (const segment of segments) {
    const value = picker(segment);
    if (value === null || !Number.isFinite(value)) {
      continue;
    }

    const weight = Math.max(1, segment.wordCount);
    weightedTotal += value * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return null;
  }

  return Number((weightedTotal / totalWeight).toFixed(2));
}

function countWords(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function parseSpeechServiceJson(rawJson: string) {
  if (!rawJson.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractSegmentFromResult(result: any): RecognizedSegment | null {
  const rawJson = String(
    result?.properties?.getProperty?.(SpeechSDK.PropertyId?.SpeechServiceResponse_JsonResult) ??
      "",
  );
  const parsed = parseSpeechServiceJson(rawJson);
  const assessment = SpeechSDK.PronunciationAssessmentResult.fromResult(result);
  const topCandidate =
    parsed && Array.isArray(parsed.NBest) && isObjectRecord(parsed.NBest[0]) ? parsed.NBest[0] : null;
  const text = typeof result?.text === "string" ? result.text.replace(/\s+/g, " ").trim() : "";
  const confidence =
    topCandidate && typeof topCandidate.Confidence === "number" ? topCandidate.Confidence : null;
  const wordCountFromJson =
    topCandidate && Array.isArray(topCandidate.Words) ? topCandidate.Words.length : 0;
  const wordCount = Math.max(wordCountFromJson, countWords(text), 1);

  if (!text) {
    return null;
  }

  return {
    text,
    confidence,
    pronunciationScore:
      typeof assessment?.pronunciationScore === "number"
        ? assessment.pronunciationScore
        : null,
    accuracyScore:
      typeof assessment?.accuracyScore === "number" ? assessment.accuracyScore : null,
    fluencyScore:
      typeof assessment?.fluencyScore === "number" ? assessment.fluencyScore : null,
    completenessScore:
      typeof assessment?.completenessScore === "number" ? assessment.completenessScore : null,
    prosodyScore:
      typeof assessment?.prosodyScore === "number" ? assessment.prosodyScore : null,
    wordCount,
    rawJson: parsed ?? rawJson,
  };
}

async function stopContinuousRecognition(recognizer: any) {
  await new Promise<void>((resolve) => {
    recognizer.stopContinuousRecognitionAsync(
      () => resolve(),
      () => resolve(),
    );
  });
}

export async function generateTurnPronunciationAssessment(
  env: SpeakingReviewEnv,
  turn: SpeakingPronunciationTurnInput,
): Promise<SpeakingPronunciationTurnResult> {
  ensureSpeechSdkAvailable();

  const subscriptionKey = getAzureSpeechSetting(env, "AZURE_SPEECH_KEY");
  const region = getAzureSpeechSetting(env, "AZURE_SPEECH_REGION");
  const language =
    getAzureSpeechSetting(env, "AZURE_SPEECH_LANGUAGE") || DEFAULT_AZURE_LANGUAGE;
  const audioUrl = turn.userAudioUrl;

  if (!subscriptionKey || !region) {
    throw new Error(
      "Azure Speech 未配置。请设置 AZURE_SPEECH_KEY 和 AZURE_SPEECH_REGION。",
    );
  }

  console.info("Azure Speech input audio:", {
    turnId: turn.turnId,
    turnIndex: turn.turnIndex,
    phase: turn.phase,
    questionText: turn.questionText,
    audioUrl,
  });

  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(
      `无法读取口语录音 (${audioResponse.status} ${audioResponse.statusText})。`,
    );
  }

  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
  const audioMetadata = getWavAudioMetadata(audioBuffer);
  const audioSummary = audioMetadata.summary;
  const canonicalAudioBuffer = buildCanonicalPcmWavBuffer(audioMetadata);

  if (audioMetadata.durationSeconds === null || !canonicalAudioBuffer) {
    throw new Error(
      `上传录音不是有效的 WAV PCM 文件。当前音频头信息：${audioSummary}。请重新录音后再提交。`,
    );
  }

  const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, region);
  speechConfig.speechRecognitionLanguage = language;

  if (SpeechSDK.OutputFormat?.Detailed) {
    speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
  }

  console.info("Azure Speech scoring config:", {
    turnId: turn.turnId,
    turnIndex: turn.turnIndex,
    phase: turn.phase,
    questionText: turn.questionText,
    audioUrl,
    audioSummary,
    language,
    outputFormat:
      SpeechSDK.OutputFormat?.Detailed === speechConfig.outputFormat
        ? "Detailed"
        : "Simple",
  });

  const audioConfig = SpeechSDK.AudioConfig.fromWavFileInput(
    canonicalAudioBuffer,
    `turn-${turn.turnId}.wav`,
  );
  const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
  const assessmentConfig = new SpeechSDK.PronunciationAssessmentConfig(
    "",
    SpeechSDK.PronunciationAssessmentGradingSystem?.HundredMark,
    SpeechSDK.PronunciationAssessmentGranularity?.Phoneme,
    false,
  );

  if (typeof assessmentConfig.enableProsodyAssessment === "function") {
    assessmentConfig.enableProsodyAssessment();
  }

  assessmentConfig.applyTo(recognizer);
  let isClosed = false;

  const closeResources = () => {
    if (isClosed) {
      return;
    }

    isClosed = true;
    recognizer.close();
    audioConfig.close();
  };

  try {
    const segments = await new Promise<RecognizedSegment[]>((resolve, reject) => {
      const collected: RecognizedSegment[] = [];
      let settled = false;

      const finish = async (
        kind: "resolve" | "reject",
        value: RecognizedSegment[] | Error,
      ) => {
        if (settled) {
          return;
        }

        settled = true;

        try {
          await stopContinuousRecognition(recognizer);
        } catch {}

        closeResources();

        if (kind === "resolve") {
          resolve(value as RecognizedSegment[]);
          return;
        }

        reject(value);
      };

      recognizer.sessionStarted = (_sender: unknown, event: any) => {
        console.info("Azure Speech session started:", {
          turnId: turn.turnId,
          turnIndex: turn.turnIndex,
          phase: turn.phase,
          questionText: turn.questionText,
          audioUrl,
          audioSummary,
          sessionId: event?.sessionId ?? null,
        });
      };

      recognizer.speechStartDetected = (_sender: unknown, event: any) => {
        console.info("Azure Speech speech start detected:", {
          turnId: turn.turnId,
          turnIndex: turn.turnIndex,
          phase: turn.phase,
          questionText: turn.questionText,
          audioUrl,
          audioSummary,
          sessionId: event?.sessionId ?? null,
          offset: typeof event?.offset === "number" ? event.offset : null,
        });
      };

      recognizer.speechEndDetected = (_sender: unknown, event: any) => {
        console.info("Azure Speech speech end detected:", {
          turnId: turn.turnId,
          turnIndex: turn.turnIndex,
          phase: turn.phase,
          questionText: turn.questionText,
          audioUrl,
          audioSummary,
          sessionId: event?.sessionId ?? null,
          offset: typeof event?.offset === "number" ? event.offset : null,
        });
      };

      recognizer.recognizing = (_sender: unknown, event: any) => {
        logAzureRecognitionResult("Azure Speech recognizing event:", {
          turn,
          audioUrl,
          audioSummary,
          result: event?.result,
        });
      };

      recognizer.recognized = (_sender: unknown, event: any) => {
        logAzureRecognitionResult("Azure Speech recognized event:", {
          turn,
          audioUrl,
          audioSummary,
          result: event?.result,
        });

        if (event?.result?.reason !== SpeechSDK.ResultReason?.RecognizedSpeech) {
          return;
        }

        const segment = extractSegmentFromResult(event.result);
        if (segment) {
          collected.push(segment);
        }
      };

      recognizer.noMatch = (_sender: unknown, event: any) => {
        console.error("Azure Speech recognition no-match:", {
          turnId: turn.turnId,
          turnIndex: turn.turnIndex,
          phase: turn.phase,
          questionText: turn.questionText,
          audioUrl,
          audioSummary,
          reason: getSpeechSdkEnumKey(SpeechSDK.ResultReason, event?.result?.reason),
          noMatchReason: getSpeechSdkEnumKey(
            SpeechSDK.NoMatchReason,
            event?.result?.noMatchDetails?.reason,
          ),
          text: typeof event?.result?.text === "string" ? event.result.text : "",
          json:
            typeof event?.result?.json === "string"
              ? truncateForLog(event.result.json)
              : "",
          errorDetails:
            typeof event?.result?.errorDetails === "string"
              ? event.result.errorDetails.trim()
              : "",
        });
      };

      recognizer.canceled = (_sender: unknown, event: any) => {
        const detail = buildAzureCancellationMessage(event, audioSummary);
        const cancelReason = getSpeechSdkEnumKey(
          SpeechSDK.CancellationReason,
          event?.reason,
        );
        const cancelErrorCode = getSpeechSdkEnumKey(
          SpeechSDK.CancellationErrorCode,
          event?.errorCode,
        );
        console.error("Azure Speech recognition canceled:", {
          turnId: turn.turnId,
          turnIndex: turn.turnIndex,
          phase: turn.phase,
          questionText: turn.questionText,
          audioUrl,
          audioSummary,
          reason: cancelReason,
          errorCode: cancelErrorCode,
          sessionId: event?.sessionId ?? null,
          errorDetails:
            typeof event?.errorDetails === "string" ? event.errorDetails.trim() : "",
          resultErrorDetails:
            typeof event?.result?.errorDetails === "string"
              ? event.result.errorDetails.trim()
              : "",
          collectedSegmentCount: collected.length,
        });

        if (
          event?.reason === SpeechSDK.CancellationReason?.EndOfStream &&
          event?.errorCode === SpeechSDK.CancellationErrorCode?.NoError
        ) {
          console.info("Azure Speech end-of-stream cancellation ignored:", {
            turnId: turn.turnId,
            turnIndex: turn.turnIndex,
            phase: turn.phase,
            questionText: turn.questionText,
            audioUrl,
            audioSummary,
            collectedSegmentCount: collected.length,
          });
          return;
        }

        void finish("reject", new Error(detail));
      };

      recognizer.sessionStopped = (event: any) => {
        console.info("Azure Speech session stopped:", {
          turnId: turn.turnId,
          turnIndex: turn.turnIndex,
          phase: turn.phase,
          questionText: turn.questionText,
          audioUrl,
          audioSummary,
          sessionId: event?.sessionId ?? null,
          collectedSegmentCount: collected.length,
        });
        if (collected.length === 0) {
          void finish(
            "reject",
            new Error(
              `Azure Speech 未返回可用的转写结果。录音可能过短、静音或人声过弱；audio=${audioSummary}`,
            ),
          );
          return;
        }

        void finish("resolve", collected);
      };

      recognizer.startContinuousRecognitionAsync(
        () => undefined,
        (error: string) => {
          const detail = error?.trim()
            ? `Azure Speech 启动失败: ${error.trim()}; audio=${audioSummary}`
            : `Azure Speech 启动失败; audio=${audioSummary}`;
          console.error("Azure Speech failed to start recognition:", {
            turnId: turn.turnId,
            turnIndex: turn.turnIndex,
            phase: turn.phase,
            questionText: turn.questionText,
            audioUrl,
            audioSummary,
            error: error?.trim() || null,
          });
          void finish("reject", new Error(detail));
        },
      );
    });

    const transcriptText = segments.map((segment) => segment.text).join(" ").trim();
    const pronunciationOverallScore = getWeightedAverage(
      segments,
      (segment) => segment.pronunciationScore,
    );
    const pronunciationBand = convertPronunciationScoreToBand(pronunciationOverallScore);

    return {
      turnId: turn.turnId,
      turnIndex: turn.turnIndex,
      phase: turn.phase,
      questionText: turn.questionText,
      requirements: turn.requirements,
      transcriptText,
      transcriptConfidence: getWeightedAverage(segments, (segment) => segment.confidence),
      pronunciationOverallScore,
      pronunciationAccuracyScore: getWeightedAverage(
        segments,
        (segment) => segment.accuracyScore,
      ),
      pronunciationFluencyScore: getWeightedAverage(
        segments,
        (segment) => segment.fluencyScore,
      ),
      pronunciationCompletenessScore: getWeightedAverage(
        segments,
        (segment) => segment.completenessScore,
      ),
      pronunciationProsodyScore: getWeightedAverage(
        segments,
        (segment) => segment.prosodyScore,
      ),
      pronunciationBand,
      pronunciationResultJson: JSON.stringify(
        {
          segments,
        },
        null,
        2,
      ),
    };
  } finally {
    closeResources();
  }
}

export async function generateSpeakingAiReview(
  env: SpeakingReviewEnv,
  input: SpeakingOverallReviewInput,
): Promise<SpeakingAiReview> {
  const model =
    env.WORKERS_AI_MODEL?.trim() ||
    process.env.WORKERS_AI_MODEL?.trim() ||
    DEFAULT_WORKERS_AI_MODEL;
  const pronunciationBands = input.turns
    .map((turn) => turn.pronunciationBand)
    .filter((value): value is number => value !== null);
  const pronunciationBand =
    pronunciationBands.length > 0
      ? pronunciationBands.reduce((sum, value) => sum + value, 0) / pronunciationBands.length
      : null;
  const prompt = buildSpeakingPrompt(input);
  const messages = [
    {
      role: "system",
      content:
        "你是一名严谨的 IELTS Speaking 考官。你必须依据 IELTS 口语四项评分标准估分，并且只返回合法 JSON。",
    },
    {
      role: "user",
      content: prompt,
    },
  ];
  let lastError: unknown = null;
  let lastRawText = "";

  for (const runner of [
    async () => runWithBinding(env, model, messages),
    async () => runWithUrl(env, messages),
  ]) {
    try {
      const rawResult = await runner();
      if (!rawResult) {
        continue;
      }

      const structuredPayload = extractStructuredPayload(rawResult);
      if (structuredPayload) {
        return normalizeSpeakingAiReview(structuredPayload, {
          pronunciationBand,
        });
      }

      const rawText = extractTextFromWorkersAI(rawResult);
      lastRawText = rawText;
      if (!rawText) {
        throw new Error("Workers AI returned empty text.");
      }

      return normalizeSpeakingAiReview(parseJsonResponse(rawText), {
        pronunciationBand,
      });
    } catch (error) {
      lastError = error;
      console.error("Failed to generate speaking AI review:", {
        message: error instanceof Error ? error.message : String(error),
        rawTextPreview: truncateForLog(lastRawText),
      });
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Workers AI is not configured. Add an AI binding or set WORKERS_AI_URL.");
}
