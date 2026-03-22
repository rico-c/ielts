#!/usr/bin/env node

import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CONFIG = {
  db: "ielts",
  remote: true,
  limit: 0,
  overwrite: false,
  dryRun: false,
  module: "",
  ids: [],
  translatorUrl:
    process.env.TRANSLATOR_URL ||
    "https://interpreter.youshowedu.com/api/recordlion/translator",
  translatorApiKey: process.env.TRANSLATOR_API_KEY || "1",
  translatorTo: process.env.TRANSLATOR_TO || "zh",
  maxRetries: Number(process.env.TRANSLATOR_MAX_RETRIES || 3),
  retryDelayMs: Number(process.env.TRANSLATOR_RETRY_DELAY_MS || 2000),
  pollIntervalMs: Number(process.env.TRANSLATOR_POLL_INTERVAL_MS || 1200),
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
    else if (arg === "--limit") options.limit = Number(argv[++i] || options.limit);
    else if (arg === "--module") options.module = argv[++i] || options.module;
    else if (arg === "--id") options.ids.push(argv[++i]);
    else if (arg === "--overwrite") options.overwrite = true;
    else if (arg === "--skip-existing") options.overwrite = false;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--translator-url") options.translatorUrl = argv[++i] || options.translatorUrl;
    else if (arg === "--translator-api-key") {
      options.translatorApiKey = argv[++i] || options.translatorApiKey;
    } else if (arg === "--translator-to") {
      options.translatorTo = argv[++i] || options.translatorTo;
    }
    else if (arg === "--max-retries") options.maxRetries = Number(argv[++i] || options.maxRetries);
    else if (arg === "--retry-delay-ms") options.retryDelayMs = Number(argv[++i] || options.retryDelayMs);
    else if (arg === "--poll-interval-ms") options.pollIntervalMs = Number(argv[++i] || options.pollIntervalMs);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/translate-transcript-detail-to-test.mjs [--db ielts] [--remote|--local]
                                                       [--limit 10] [--id PART_ID]
                                                       [--module listening]
                                                       [--overwrite]
                                                       [--translator-url https://interpreter.youshowedu.com/api/recordlion/translator]
                                                       [--translator-api-key 1]
                                                       [--translator-to zh]
                                                       [--dry-run]

Examples:
  node scripts/translate-transcript-detail-to-test.mjs --remote --module listening

  node scripts/translate-transcript-detail-to-test.mjs --remote --id paper_part_123 --dry-run

Notes:
  1. Reads paper_parts where transcript_detail IS NOT NULL and TRIM(transcript_detail) <> ''.
  2. Traverses transcript_detail[*].sentences[*].text.
  3. Calls the translator API once per sentence.
  4. Writes the transformed transcript_detail JSON into paper_parts.test.
  5. Default behavior skips rows where paper_parts.test is not NULL/empty. Pass --overwrite to force overwrite.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.limit) || options.limit < 0) {
    throw new Error("--limit must be a non-negative number.");
  }

  if (!Number.isFinite(options.maxRetries) || options.maxRetries < 0) {
    throw new Error("--max-retries must be a non-negative number.");
  }

  if (!Number.isFinite(options.retryDelayMs) || options.retryDelayMs <= 0) {
    throw new Error("--retry-delay-ms must be a positive number.");
  }

  if (!Number.isFinite(options.pollIntervalMs) || options.pollIntervalMs < 0) {
    throw new Error("--poll-interval-ms must be a non-negative number.");
  }

  if (!options.translatorUrl) {
    throw new Error("Missing translator URL. Pass --translator-url or set TRANSLATOR_URL.");
  }

  if (!options.translatorApiKey) {
    throw new Error("Missing translator API key. Pass --translator-api-key or set TRANSLATOR_API_KEY.");
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

async function fetchPaperParts(options) {
  const conditions = [
    `transcript_detail IS NOT NULL`,
    `TRIM(transcript_detail) <> ''`,
  ];

  if (!options.overwrite) {
    conditions.push(`(test IS NULL OR TRIM(test) = '')`);
  }

  if (options.module) {
    conditions.push(`module = ${sqlQuote(options.module)}`);
  }

  if (options.ids.length > 0) {
    conditions.push(`id IN (${options.ids.map(sqlQuote).join(", ")})`);
  }

  const limitClause = options.limit > 0 ? `LIMIT ${Math.trunc(options.limit)}` : "";
  const sql = `
    SELECT id, paper_id, module, part_no, title, transcript_detail, test
    FROM paper_parts
    WHERE ${conditions.join("\n      AND ")}
    ORDER BY id ASC
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

  return extractRowsFromD1Json(stdout).filter(
    (row) => typeof row?.id === "string" && typeof row?.transcript_detail === "string",
  );
}

function normalizeResponse(text) {
  if (!text) {
    throw new Error("Translator returned empty text.");
  }

  return String(text).trim().replace(/^["']|["']$/g, "");
}

function isRetryableGenerateError(error) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("Translator returned empty text.") ||
    message.includes("Unexpected translator payload:") ||
    message.includes("fetch failed") ||
    /Translator request failed \(5\d{2}\b/.test(message) ||
    /Translator request failed \(429\b/.test(message)
  );
}

async function translateText(options, sourceText) {
  const endpoint = new URL(options.translatorUrl);
  endpoint.searchParams.set("apikey", options.translatorApiKey);
  endpoint.searchParams.set("to", options.translatorTo);
  endpoint.searchParams.set("text", sourceText);

  const response = await fetch(endpoint);

  const rawBody = await response.text();
  let parsedBody = null;

  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsedBody = rawBody;
  }

  if (!response.ok) {
    throw new Error(
      `Translator request failed (${response.status} ${response.statusText}): ${
        typeof parsedBody === "string" ? parsedBody : JSON.stringify(parsedBody)
      }`,
    );
  }

  if (!parsedBody || typeof parsedBody !== "object" || typeof parsedBody.res !== "string") {
    throw new Error(`Unexpected translator payload: ${JSON.stringify(parsedBody)}`);
  }

  const normalizedText = normalizeResponse(parsedBody.res);

  if (!normalizedText) {
    throw new Error(`Unexpected translator payload: ${JSON.stringify(parsedBody)}`);
  }

  return normalizedText.trim();
}

async function translateTextWithRetry(options, text) {
  const maxAttempts = options.maxRetries + 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await translateText(options, text);
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts || !isRetryableGenerateError(error)) {
        throw error;
      }

      const delayMs = options.retryDelayMs * attempt;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  Retry ${attempt}/${options.maxRetries} after error: ${message}`);
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function parseTranscriptDetail(raw, partId) {
  let parsed = null;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse transcript_detail for ${partId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`transcript_detail for ${partId} is not an array.`);
  }

  return parsed;
}

function collectUniqueTexts(transcriptDetail) {
  const uniqueTexts = [];
  const seen = new Set();

  for (const paragraph of transcriptDetail) {
    if (!paragraph || typeof paragraph !== "object") continue;
    const sentences = Array.isArray(paragraph.sentences) ? paragraph.sentences : [];

    for (const sentence of sentences) {
      const text = typeof sentence?.text === "string" ? sentence.text.trim() : "";
      if (!text || seen.has(text)) continue;
      seen.add(text);
      uniqueTexts.push(text);
    }
  }

  return uniqueTexts;
}

async function translateTexts(options, texts) {
  const translationMap = new Map();

  for (let index = 0; index < texts.length; index += 1) {
    const sourceText = texts[index];
    const translatedText = await translateTextWithRetry(options, sourceText);
    translationMap.set(sourceText, translatedText);
    console.log(`  Translated sentence ${index + 1}/${texts.length}`);
    console.log(`    EN: ${sourceText}`);
    console.log(`    ZH: ${translatedText}`);

    if (index < texts.length - 1) {
      await sleep(options.pollIntervalMs);
    }
  }

  return translationMap;
}

function attachChineseTranslations(transcriptDetail, translationMap) {
  return transcriptDetail.map((paragraph) => {
    if (!paragraph || typeof paragraph !== "object") {
      return paragraph;
    }

    const sentences = Array.isArray(paragraph.sentences) ? paragraph.sentences : [];

    return {
      ...paragraph,
      sentences: sentences.map((sentence) => {
        if (!sentence || typeof sentence !== "object") {
          return sentence;
        }

        const text = typeof sentence.text === "string" ? sentence.text.trim() : "";

        return {
          ...sentence,
          cn: text ? translationMap.get(text) || "" : "",
        };
      }),
    };
  });
}

async function updatePaperPartTestField(options, partId, testValue) {
  const sql = `
    UPDATE paper_parts
    SET test = ${sqlQuote(testValue)}
    WHERE id = ${sqlQuote(partId)};
  `;

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "translate-transcript-detail-"));
  const sqlFilePath = path.join(tempDir, "update.sql");

  try {
    await writeFile(sqlFilePath, `${sql}\n`, "utf8");
    await runWrangler(
      [
        "d1",
        "execute",
        options.db,
        options.remote ? "--remote" : "--local",
        "--file",
        sqlFilePath,
      ],
      process.cwd(),
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = await fetchPaperParts(options);

  console.log(
    `Prepared ${rows.length} paper_parts rows from ${options.db} (${options.remote ? "remote" : "local"}).`,
  );

  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const row of rows) {
    console.log(`Part ${row.id} (module=${row.module || "unknown"}, part=${row.part_no ?? "?"})`);

    try {
      const transcriptDetail = parseTranscriptDetail(row.transcript_detail, row.id);
      const uniqueTexts = collectUniqueTexts(transcriptDetail);

      if (uniqueTexts.length === 0) {
        skippedCount += 1;
        console.log("  Skip: no sentence text found.");
        continue;
      }

      const translationMap = await translateTexts(options, uniqueTexts);
      const enriched = attachChineseTranslations(transcriptDetail, translationMap);
      const serialized = JSON.stringify(enriched);

      if (!options.dryRun) {
        await updatePaperPartTestField(options, row.id, serialized);
      }

      updatedCount += 1;
      console.log(
        `  ${options.dryRun ? "DRY RUN" : "Updated"} ${row.id}: translated=${uniqueTexts.length}`,
      );
    } catch (error) {
      failedCount += 1;
      console.error(`  Failed ${row.id}: ${error instanceof Error ? error.message : String(error)}`);
    }

    await sleep(options.pollIntervalMs);
  }

  console.log(
    `${options.dryRun ? "Would update" : "Updated"} ${updatedCount} paper_parts rows; skipped ${skippedCount}; failed ${failedCount}.`,
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
