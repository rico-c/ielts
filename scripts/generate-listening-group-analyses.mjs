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
  location: process.env.GOOGLE_CLOUD_LOCATION || "global",
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "gen-lang-client-0788141694",
  pollIntervalMs: Number(process.env.GEMINI_POLL_INTERVAL_MS || 1500),
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
    else if (arg === "--location") options.location = argv[++i] || options.location;
    else if (arg === "--model") options.model = argv[++i] || options.model;
    else if (arg === "--project-id") options.projectId = argv[++i] || options.projectId;
    else if (arg === "--poll-interval-ms") options.pollIntervalMs = Number(argv[++i] || options.pollIntervalMs);
    else if (arg === "--id") options.ids.push(argv[++i]);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/generate-listening-group-analyses.mjs [--db ielts] [--remote|--local] [--overwrite] [--dry-run]
                                                     [--limit 10] [--location global] [--model gemini-2.5-flash]
                                                     [--project-id your-gcp-project] [--poll-interval-ms 1500]
                                                     [--id PAPER_PART_ID]

Examples:
  GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \\
  GOOGLE_CLOUD_PROJECT=your-gcp-project \\
  node scripts/generate-listening-group-analyses.mjs --remote --limit 3

  node scripts/generate-listening-group-analyses.mjs --local --overwrite --id paper_part_123

Notes:
  1. Reads paper_parts where module = 'listening' and transcript is available.
  2. Loads question_groups and questions under each listening part.
  3. Uses Vertex AI Gemini to generate Chinese answer analyses per question group.
  4. Stores a JSON payload into question_groups.test.
  5. Requires question_groups.test column to exist.
  6. Uses Application Default Credentials / service account auth.
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

  if (!options.projectId) {
    throw new Error("Missing Google Cloud project id. Pass --project-id or set GOOGLE_CLOUD_PROJECT.");
  }

  if (!options.model) {
    throw new Error("Missing Vertex AI model. Pass --model or set GEMINI_MODEL.");
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

async function getGoogleAccessToken() {
  let GoogleAuth;

  try {
    ({ GoogleAuth } = await import("google-auth-library"));
  } catch {
    throw new Error(
      'Missing dependency "google-auth-library". Run `npm i` in /Users/rico/Desktop/ielts first.',
    );
  }

  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const accessToken = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;

  if (!accessToken) {
    throw new Error(
      "Failed to obtain Google access token. Check GOOGLE_APPLICATION_CREDENTIALS or ADC setup.",
    );
  }

  return accessToken;
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
  const promptPayload = {
    task: "为 IELTS listening 题组生成中文答案解析",
    requirements: [
      "只输出 JSON，不要 markdown，不要额外说明。",
      "语言必须是简体中文。",
      "每道题都要给出 concise 但明确的中文解析。",
      "解析必须优先依据 transcript、题干、选项和正确答案。",
      "如果 transcript 证据不足，可以说明'转写中未直接出现原句，但可根据语义对应判断'。",
      "不要捏造题目内容，不要修改题号，不要输出不存在的题目。",
    ],
    outputSchema: {
      groupSummaryZh: "字符串，概括这个题组考什么",
      analyses: [
        {
          questionId: "字符串",
          questionNo: "数字",
          answer: "字符串或字符串数组，使用数据库中的正确答案展示值",
          analysisZh: "字符串，2-4句中文解析",
        },
      ],
    },
    listeningPart: {
      partId: part.partId,
      partNo: part.partNo,
      title: part.partTitle,
      transcript: part.transcript,
    },
    questionGroup: {
      groupId: group.groupId,
      groupNo: group.groupNo,
      title: group.groupTitle,
      questionType: group.questionType,
      answerRule: group.answerRule,
      instructionText: stripHtml(group.instructionHtml),
      contentText: stripHtml(group.contentHtml),
      sharedOptions: group.sharedOptions.map((option) => ({
        label: option.label,
        text: option.text,
      })),
      questions: group.questions.map((question) => ({
        questionId: question.id,
        questionNo: question.questionNo,
        stem: stripHtml(question.stem),
        subLabel: question.subLabel,
        acceptedAnswers: question.acceptedAnswers.map((item) => item.display),
      })),
    },
  };

  return JSON.stringify(promptPayload, null, 2);
}

function extractTextFromCandidate(candidate) {
  const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function parseJsonResponse(text) {
  if (!text) {
    throw new Error("Vertex AI returned empty text.");
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fencedMatch ? fencedMatch[1].trim() : text.trim();
  return JSON.parse(raw);
}

function getVertexApiBaseUrl(location) {
  return location === "global"
    ? "https://aiplatform.googleapis.com/v1"
    : `https://${location}-aiplatform.googleapis.com/v1`;
}

async function generateGroupAnalysis(accessToken, options, part, group) {
  const endpoint = `${getVertexApiBaseUrl(options.location)}/projects/${encodeURIComponent(options.projectId)}/locations/${encodeURIComponent(options.location)}/publishers/google/models/${encodeURIComponent(options.model)}:generateContent`;
  const prompt = buildPrompt(part, group);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
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
      `Vertex AI request failed (${response.status} ${response.statusText}): ${
        typeof parsedBody === "string" ? parsedBody : JSON.stringify(parsedBody)
      }`,
    );
  }

  const candidate = Array.isArray(parsedBody?.candidates) ? parsedBody.candidates[0] : null;
  const text = extractTextFromCandidate(candidate);
  const parsed = parseJsonResponse(text);

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Unexpected Vertex AI payload: ${JSON.stringify(parsedBody)}`);
  }

  const analyses = Array.isArray(parsed.analyses) ? parsed.analyses : [];

  return {
    groupId: group.groupId,
    groupNo: group.groupNo,
    questionType: group.questionType,
    generatedAt: new Date().toISOString(),
    model: options.model,
    groupSummaryZh:
      typeof parsed.groupSummaryZh === "string" ? parsed.groupSummaryZh.trim() : "",
    analyses: analyses
      .map((item) => ({
        questionId: typeof item?.questionId === "string" ? item.questionId : "",
        questionNo:
          typeof item?.questionNo === "number"
            ? item.questionNo
            : Number(item?.questionNo || 0),
        answer: Array.isArray(item?.answer)
          ? item.answer.map((entry) => String(entry))
          : typeof item?.answer === "string"
            ? item.answer
            : "",
        analysisZh:
          typeof item?.analysisZh === "string" ? item.analysisZh.trim() : "",
      }))
      .filter((item) => item.questionId && item.questionNo > 0 && item.analysisZh),
  };
}

function buildStoredPayload(generated, group) {
  const byQuestionId = new Map(generated.analyses.map((item) => [item.questionId, item]));

  const analyses = group.questions.map((question) => {
    const generatedItem = byQuestionId.get(question.id);

    return {
      questionId: question.id,
      questionNo: question.questionNo,
      answer:
        question.acceptedAnswers.length <= 1
          ? (question.acceptedAnswers[0]?.display ?? "")
          : question.acceptedAnswers.map((item) => item.display),
      analysisZh: generatedItem?.analysisZh || "",
    };
  });

  return {
    source: "vertex-ai-gemini",
    model: generated.model,
    generatedAt: generated.generatedAt,
    groupId: group.groupId,
    groupNo: group.groupNo,
    questionType: group.questionType,
    groupSummaryZh: generated.groupSummaryZh,
    analyses,
  };
}

async function updateGroupTestField(options, groupId, payload) {
  const sql = `
    UPDATE question_groups
    SET test = ${sqlQuote(JSON.stringify(payload))}
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

  const accessToken = await getGoogleAccessToken();
  let updatedCount = 0;

  for (const part of parts) {
    console.log(`Part ${part.partId} (part ${part.partNo}) groups=${part.groups.length}`);

    for (const group of part.groups) {
      if (group.questions.length === 0) {
        console.log(`  Skip ${group.groupId}: no questions.`);
        continue;
      }

      const generated = await generateGroupAnalysis(accessToken, options, part, group);
      const payload = buildStoredPayload(generated, group);

      if (!options.dryRun) {
        await updateGroupTestField(options, group.groupId, payload);
      }

      updatedCount += 1;
      console.log(
        `  ${options.dryRun ? "DRY RUN" : "Updated"} ${group.groupId}: questions=${group.questions.length}`,
      );

      await sleep(options.pollIntervalMs);
    }
  }

  console.log(`${options.dryRun ? "Would update" : "Updated"} ${updatedCount} question_groups rows.`);
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
