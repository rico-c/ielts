#!/usr/bin/env node

import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

const CONFIG = {
  db: "ielts",
  remote: true,
  overwrite: false,
  dryRun: false,
  limit: 0,
  workersAiUrl: process.env.WORKERS_AI_URL || "https://llm.ricardocao-biker.workers.dev",
  model: process.env.WORKERS_AI_MODEL || "workers-ai",
  maxRetries: Number(process.env.WORKERS_AI_MAX_RETRIES || 3),
  retryDelayMs: Number(process.env.WORKERS_AI_RETRY_DELAY_MS || 2000),
  pollIntervalMs: Number(
    process.env.WORKERS_AI_POLL_INTERVAL_MS || process.env.GEMINI_POLL_INTERVAL_MS || 1500,
  ),
  ids: [],
};

function sqlQuote(value) {
  if (value == null) {
    return "NULL";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function parseArgs(argv) {
  const options = { ...CONFIG, ids: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--db") options.db = argv[++i] || options.db;
    else if (arg === "--remote") options.remote = true;
    else if (arg === "--local") options.remote = false;
    else if (arg === "--overwrite") options.overwrite = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--limit") options.limit = Number(argv[++i] || options.limit);
    else if (arg === "--model") options.model = argv[++i] || options.model;
    else if (arg === "--workers-ai-url") options.workersAiUrl = argv[++i] || options.workersAiUrl;
    else if (arg === "--max-retries") options.maxRetries = Number(argv[++i] || options.maxRetries);
    else if (arg === "--retry-delay-ms") options.retryDelayMs = Number(argv[++i] || options.retryDelayMs);
    else if (arg === "--poll-interval-ms") options.pollIntervalMs = Number(argv[++i] || options.pollIntervalMs);
    else if (arg === "--id") options.ids.push(argv[++i]);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/generate-listening-group-analyses.mjs [--db ielts] [--remote|--local] [--overwrite] [--dry-run]
                                                     [--limit 10] [--model workers-ai]
                                                     [--workers-ai-url https://llm.ricardocao-biker.workers.dev]
                                                     [--max-retries 3] [--retry-delay-ms 2000] [--poll-interval-ms 1500]
                                                     [--id PAPER_PART_ID]

Examples:
  node scripts/generate-listening-group-analyses.mjs --remote --limit 3

  node scripts/generate-listening-group-analyses.mjs --local --overwrite --id paper_part_123

Notes:
  1. Reads paper_parts where module = 'listening' and transcript is available.
  2. Loads question_groups and questions under each listening part.
  3. Uses Cloudflare Worker AI to generate Chinese answer analyses per question group.
  4. Stores plain-text analyses into question_groups.test.
  5. Requires question_groups.test column to exist.
  6. Worker endpoint defaults to https://llm.ricardocao-biker.workers.dev.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.limit) || options.limit < 0) {
    throw new Error("--limit must be a non-negative number.");
  }

  if (!Number.isFinite(options.pollIntervalMs) || options.pollIntervalMs <= 0) {
    throw new Error("--poll-interval-ms must be a positive number.");
  }

  if (!Number.isFinite(options.maxRetries) || options.maxRetries < 0) {
    throw new Error("--max-retries must be a non-negative number.");
  }

  if (!Number.isFinite(options.retryDelayMs) || options.retryDelayMs <= 0) {
    throw new Error("--retry-delay-ms must be a positive number.");
  }

  if (!options.model) {
    throw new Error("Missing Worker AI model label. Pass --model or set WORKERS_AI_MODEL.");
  }

  if (!options.workersAiUrl) {
    throw new Error("Missing Worker AI URL. Pass --workers-ai-url or set WORKERS_AI_URL.");
  }

  return options;
}

async function runWrangler(args, cwd) {
  const { stdout, stderr } = await execFileAsync("npx", ["wrangler", ...args], {
    cwd,
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      WRANGLER_LOG_PATH: path.join(os.tmpdir(), `wrangler-${crypto.randomUUID()}.log`),
    },
  });

  return { stdout, stderr };
}

function extractRowsFromD1Json(raw) {
  const parsed = JSON.parse(raw);
  const payload = Array.isArray(parsed) ? parsed : [parsed];
  const rows = [];

  for (const entry of payload) {
    if (Array.isArray(entry?.results)) {
      rows.push(...entry.results);
      continue;
    }

    if (Array.isArray(entry?.result?.results)) {
      rows.push(...entry.result.results);
    }
  }

  return rows;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function stripHtml(html) {
  if (!html) return "";

  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseAnswerValues(answerText, answerJson) {
  const rawValues = [];

  if (answerText) {
    rawValues.push(answerText);
  }

  if (answerJson) {
    try {
      const parsed = JSON.parse(answerJson);
      if (Array.isArray(parsed)) {
        rawValues.push(...parsed.filter((item) => typeof item === "string"));
      }
    } catch {
      return rawValues;
    }
  }

  return rawValues;
}

function buildAcceptedAnswers(answerText, answerJson) {
  return parseAnswerValues(answerText, answerJson).map((item) => {
    const match = String(item).match(/^\s*([A-Z])\.\s*(.*)$/i);
    return {
      raw: String(item).trim(),
      normalized: normalizeText(match ? match[1] : item),
      display: match ? `${match[1].toUpperCase()}. ${match[2].trim()}` : String(item).trim(),
    };
  });
}

function parseSharedOptions(raw) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item, index) => ({
        id: typeof item?.id === "string" ? item.id : String(item?.id ?? index),
        label: typeof item?.label === "string" ? item.label.trim() : "",
        text: typeof item?.text === "string" ? item.text.trim() : "",
        sortOrder: typeof item?.sortOrder === "number" ? item.sortOrder : index,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return [];
  }
}

async function fetchListeningRows(options) {
  const conditions = [
    `pp.module = 'listening'`,
    `pp.transcript IS NOT NULL`,
    `TRIM(pp.transcript) <> ''`,
  ];

  if (!options.overwrite) {
    conditions.push(`(qg.test IS NULL OR TRIM(qg.test) = '')`);
  }

  if (options.ids.length > 0) {
    conditions.push(`pp.id IN (${options.ids.map(sqlQuote).join(", ")})`);
  }

  const limitClause = options.limit > 0 ? `LIMIT ${Math.trunc(options.limit)}` : "";

  const sql = `
    SELECT
      pp.id AS part_id,
      pp.paper_id,
      pp.part_no,
      pp.title AS part_title,
      pp.transcript,
      qg.id AS group_id,
      qg.group_no,
      qg.title AS group_title,
      qg.instruction_html,
      qg.content_html,
      qg.question_type,
      qg.answer_rule,
      qg.question_range_start,
      qg.question_range_end,
      qg.shared_options_json,
      qg.test
    FROM paper_parts pp
    JOIN question_groups qg ON qg.part_id = pp.id
    WHERE ${conditions.join("\n      AND ")}
    ORDER BY pp.id ASC, qg.group_no ASC
    ${limitClause}
  `;

  const { stdout } = await runWrangler(
    [
      "d1",
      "execute",
      options.db,
      options.remote ? "--remote" : "--local",
      "--json",
      "--command",
      sql,
    ],
    process.cwd(),
  );

  return extractRowsFromD1Json(stdout);
}

async function fetchQuestionsForGroups(options, groupIds) {
  if (groupIds.length === 0) {
    return [];
  }

  const sql = `
    SELECT
      q.id,
      q.group_id,
      q.question_no,
      q.stem,
      q.sub_label,
      q.answer_text,
      q.answer_json,
      q.explanation_html,
      q.sort_order
    FROM questions q
    WHERE q.group_id IN (${groupIds.map(sqlQuote).join(", ")})
    ORDER BY q.question_no ASC, q.sort_order ASC
  `;

  const { stdout } = await runWrangler(
    [
      "d1",
      "execute",
      options.db,
      options.remote ? "--remote" : "--local",
      "--json",
      "--command",
      sql,
    ],
    process.cwd(),
  );

  return extractRowsFromD1Json(stdout);
}

function buildPrompt(part, group) {
  const sharedOptionsText =
    group.sharedOptions.length > 0
      ? group.sharedOptions
          .map((option) => `${option.label || option.id}. ${option.text}`.trim())
          .join("\n")
      : "无";

  const questionsText = group.questions
    .map((question) => {
      const answers =
        question.acceptedAnswers.length <= 1
          ? (question.acceptedAnswers[0]?.display ?? "")
          : question.acceptedAnswers.map((item) => item.display).join(" / ");

      return [
        `题号: ${question.questionNo}`,
        `questionId: ${question.id}`,
        `题干: ${stripHtml(question.stem) || "无"}`,
        `subLabel: ${question.subLabel || "无"}`,
        `正确答案: ${answers || "无"}`,
      ].join("\n");
    })
    .join("\n\n");

  return `请为下面这组 IELTS Listening 题目生成中文答案解析。

输出要求：
1. 只输出纯文本，不要 JSON，不要 Markdown 代码块，不要额外前言或结尾。
2. 语言必须是简体中文。
3. 开头先写一行：题组总结：...
4. 然后按题号逐题输出，每题必须严格使用下面格式：
第X题
答案：...
解析：...

5. 每题解析控制在2到4句，优先依据 transcript、题干、选项和正确答案。
6. 如果 transcript 证据不足，可以明确写“转写中未直接出现原句，但可根据语义对应判断”。
7. 不要捏造题目内容，不要修改题号，不要遗漏题目。

听力信息：
- partId: ${part.partId}
- partNo: ${part.partNo}
- title: ${part.partTitle || "无"}

Transcript:
${part.transcript}

题组信息：
- groupId: ${group.groupId}
- groupNo: ${group.groupNo}
- title: ${group.groupTitle || "无"}
- questionType: ${group.questionType || "无"}
- answerRule: ${group.answerRule || "无"}
- instructionText: ${stripHtml(group.instructionHtml) || "无"}
- contentText: ${stripHtml(group.contentHtml) || "无"}

共享选项：
${sharedOptionsText}

题目列表：
${questionsText}`;
}

function normalizePlainTextResponse(text) {
  if (!text) {
    throw new Error("Worker AI returned empty text.");
  }

  const fencedMatch = text.match(/```(?:text|markdown)?\s*([\s\S]*?)```/i);
  const raw = fencedMatch ? fencedMatch[1] : text;
  return raw.trim();
}

function extractTextFromWorkersAI(aiResult) {
  const nonEmpty = (value) => {
    if (typeof value !== "string") return "";
    return value.trim();
  };

  const pickMessageContent = (value) => {
    if (typeof value === "string") return value;
    if (!Array.isArray(value)) return "";

    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return "";
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
    if (!lastTask || typeof lastTask !== "object") return "";

    const nestedResponse = lastTask.response;
    const nestedRaw = nonEmpty(nestedResponse);
    if (nestedRaw) return nestedRaw;

    if (nestedResponse && typeof nestedResponse === "object") {
      const nestedText = nonEmpty(nestedResponse.response);
      if (nestedText) return nestedText;
    }
  }

  if (!aiResult || typeof aiResult !== "object") return "";

  const rootResponse = nonEmpty(aiResult.response);
  if (rootResponse) return rootResponse;

  const resultObj = aiResult.result;
  if (resultObj && typeof resultObj === "object") {
    const resultResponse = nonEmpty(resultObj.response);
    if (resultResponse) return resultResponse;

    const resultChoices = Array.isArray(resultObj.choices) ? resultObj.choices : [];
    if (resultChoices[0] && typeof resultChoices[0] === "object") {
      const message = resultChoices[0].message;
      const content = pickMessageContent(message?.content);
      if (content) return content;
    }
  }

  const rootChoices = Array.isArray(aiResult.choices) ? aiResult.choices : [];
  if (rootChoices[0] && typeof rootChoices[0] === "object") {
    const message = rootChoices[0].message;
    const content = pickMessageContent(message?.content);
    if (content) return content;
  }

  return "";
}

function isRetryableGenerateError(error) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("Worker AI returned empty text.") ||
    message.includes("Unexpected Worker AI payload:") ||
    message.includes("fetch failed") ||
    /Worker AI request failed \(5\d{2}\b/.test(message) ||
    /Worker AI request failed \(429\b/.test(message)
  );
}

async function generateGroupAnalysis(options, part, group) {
  const prompt = buildPrompt(part, group);

  const response = await fetch(options.workersAiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content:
            "你是一个严谨的 IELTS 听力老师。你必须只输出纯文本格式的题目解析，不要 JSON，不要 markdown 代码块，不要补充任何解释文字。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    }),
  });

  const rawBody = await response.text();
  let parsedBody = null;

  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsedBody = rawBody;
  }

  if (!response.ok) {
    throw new Error(
      `Worker AI request failed (${response.status} ${response.statusText}): ${
        typeof parsedBody === "string" ? parsedBody : JSON.stringify(parsedBody)
      }`,
    );
  }

  const text = extractTextFromWorkersAI(parsedBody);
  const normalizedText = normalizePlainTextResponse(text);

  if (!normalizedText) {
    throw new Error(`Unexpected Worker AI payload: ${JSON.stringify(parsedBody)}`);
  }

  return normalizedText;
}

async function generateGroupAnalysisWithRetry(options, part, group) {
  const maxAttempts = options.maxRetries + 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await generateGroupAnalysis(options, part, group);
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts || !isRetryableGenerateError(error)) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      const delayMs = options.retryDelayMs * attempt;
      console.warn(
        `  Retry ${attempt}/${options.maxRetries} for ${group.groupId} after error: ${message}`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function updateGroupTestField(options, groupId, text) {
  const sql = `
    UPDATE question_groups
    SET test = ${sqlQuote(text)}
    WHERE id = ${sqlQuote(groupId)};
  `;

  await runWrangler(
    [
      "d1",
      "execute",
      options.db,
      options.remote ? "--remote" : "--local",
      "--command",
      sql,
    ],
    process.cwd(),
  );
}

function groupRowsByPart(rows) {
  const parts = new Map();

  for (const row of rows) {
    if (!parts.has(row.part_id)) {
      parts.set(row.part_id, {
        partId: row.part_id,
        paperId: row.paper_id,
        partNo: row.part_no,
        partTitle: row.part_title,
        transcript: row.transcript,
        groups: [],
      });
    }

    parts.get(row.part_id).groups.push({
      groupId: row.group_id,
      groupNo: row.group_no,
      groupTitle: row.group_title,
      instructionHtml: row.instruction_html,
      contentHtml: row.content_html,
      questionType: row.question_type,
      answerRule: row.answer_rule,
      questionRangeStart: row.question_range_start,
      questionRangeEnd: row.question_range_end,
      sharedOptions: parseSharedOptions(row.shared_options_json),
      existingTest: row.test,
      questions: [],
    });
  }

  return [...parts.values()];
}

function attachQuestions(parts, questions) {
  const byGroupId = new Map();

  for (const part of parts) {
    for (const group of part.groups) {
      byGroupId.set(group.groupId, group);
    }
  }

  for (const row of questions) {
    const targetGroup = byGroupId.get(row.group_id);
    if (!targetGroup) continue;

    targetGroup.questions.push({
      id: row.id,
      questionNo: row.question_no,
      stem: row.stem,
      subLabel: row.sub_label,
      answerText: row.answer_text,
      answerJson: row.answer_json,
      acceptedAnswers: buildAcceptedAnswers(row.answer_text, row.answer_json),
      sortOrder: row.sort_order,
    });
  }

  for (const part of parts) {
    for (const group of part.groups) {
      group.questions.sort((a, b) => a.sortOrder - b.sortOrder);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = await fetchListeningRows(options);
  const parts = groupRowsByPart(rows);
  const groupIds = rows.map((row) => row.group_id);
  const questions = await fetchQuestionsForGroups(options, groupIds);
  attachQuestions(parts, questions);

  console.log(
    `Prepared ${parts.length} listening paper_parts and ${groupIds.length} question_groups from ${options.db} (${options.remote ? "remote" : "local"}).`,
  );

  let updatedCount = 0;
  let failedCount = 0;

  for (const part of parts) {
    console.log(`Part ${part.partId} (part ${part.partNo}) groups=${part.groups.length}`);

    for (const group of part.groups) {
      if (group.questions.length === 0) {
        console.log(`  Skip ${group.groupId}: no questions.`);
        continue;
      }

      try {
        const generatedText = await generateGroupAnalysisWithRetry(options, part, group);

        if (!options.dryRun) {
          await updateGroupTestField(options, group.groupId, generatedText);
        }

        updatedCount += 1;
        console.log(
          `  ${options.dryRun ? "DRY RUN" : "Updated"} ${group.groupId}: questions=${group.questions.length}`,
        );
      } catch (error) {
        failedCount += 1;
        console.error(
          `  Failed ${group.groupId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      await sleep(options.pollIntervalMs);
    }
  }

  console.log(
    `${options.dryRun ? "Would update" : "Updated"} ${updatedCount} question_groups rows; failed ${failedCount}.`,
  );
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
    if (error.cause) {
      console.error("cause:", error.cause);
    }
    if (error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(String(error));
  }
  process.exit(1);
});
