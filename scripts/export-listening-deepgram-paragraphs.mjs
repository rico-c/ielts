#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

const CONFIG = {
  db: "ielts",
  remote: true,
  limit: 0,
  pollIntervalMs: Number(process.env.DEEPGRAM_POLL_INTERVAL_MS || 300),
  apiKey: process.env.DEEPGRAM_API_KEY || "237ee0c374aa4eb5ebfe634a971234d96df8ffd2",
  output: "",
  ids: [],
  smartFormat: true,
  language: "en",
  model: "nova-3",
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
    else if (arg === "--poll-interval-ms") options.pollIntervalMs = Number(argv[++i] || options.pollIntervalMs);
    else if (arg === "--api-key") options.apiKey = argv[++i] || options.apiKey;
    else if (arg === "--output") options.output = argv[++i] || options.output;
    else if (arg === "--language") options.language = argv[++i] || options.language;
    else if (arg === "--model") options.model = argv[++i] || options.model;
    else if (arg === "--no-smart-format") options.smartFormat = false;
    else if (arg === "--id") options.ids.push(argv[++i]);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/export-listening-deepgram-paragraphs.mjs [--db ielts] [--remote|--local]
                                                        [--limit 10] [--id PART_ID]
                                                        [--api-key YOUR_DEEPGRAM_KEY]
                                                        [--output deepgram-listening-paragraphs.json]
                                                        [--language en] [--model nova-3]
                                                        [--poll-interval-ms 300]
                                                        [--no-smart-format]

Examples:
  DEEPGRAM_API_KEY=your_key \\
  node scripts/export-listening-deepgram-paragraphs.mjs --remote

  node scripts/export-listening-deepgram-paragraphs.mjs --remote --id paper_part_123 \\
    --output output/deepgram-paper-part-123.json

Notes:
  1. Reads paper_parts where module = 'listening' and audio_url is available.
  2. Sends each audio_url to Deepgram /v1/listen.
  3. Extracts res.results.channels[0].alternatives[0].paragraphs.paragraphs.
  4. Saves a JSON file containing { id, audio_url, paragraphs } for each successful row.
  5. Requires a Deepgram API key via --api-key or DEEPGRAM_API_KEY.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.apiKey) {
    throw new Error("Missing Deepgram API key. Pass --api-key or set DEEPGRAM_API_KEY.");
  }

  if (!Number.isFinite(options.limit) || options.limit < 0) {
    throw new Error("--limit must be a non-negative number.");
  }

  if (!Number.isFinite(options.pollIntervalMs) || options.pollIntervalMs < 0) {
    throw new Error("--poll-interval-ms must be a non-negative number.");
  }

  if (!options.output) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    options.output = `output/deepgram-listening-paragraphs-${timestamp}.json`;
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

async function fetchListeningPaperParts(options) {
  const conditions = [
    `module = 'listening'`,
    `audio_url IS NOT NULL`,
    `TRIM(audio_url) <> ''`,
    `transcript_detail IS NULL`,
  ];

  if (options.ids.length > 0) {
    conditions.push(`id IN (${options.ids.map(sqlQuote).join(", ")})`);
  }

  const limitClause = options.limit > 0 ? `LIMIT ${Math.trunc(options.limit)}` : "";
  const sql = `
    SELECT id, paper_id, part_no, title, audio_url
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
    (row) =>
      typeof row?.id === "string" &&
      typeof row?.audio_url === "string",
  );
}

async function updateTranscriptDetail(id, transcriptDetail, options) {
  const sql = `
    UPDATE paper_parts
    SET transcript_detail = ${sqlQuote(transcriptDetail)}
    WHERE id = ${sqlQuote(id)}
  `;

  await runWrangler(
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
}

async function requestDeepgram(audioUrl, options) {
  const endpoint = new URL("https://api.deepgram.com/v1/listen");
  endpoint.searchParams.set("language", options.language);
  endpoint.searchParams.set("model", options.model);

  if (options.smartFormat) {
    endpoint.searchParams.set("smart_format", "true");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Token ${options.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ url: audioUrl }),
  });

  const rawText = await response.text();
  let parsedBody = null;

  try {
    parsedBody = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsedBody = rawText;
  }

  if (!response.ok) {
    throw new Error(
      `Deepgram request failed (${response.status} ${response.statusText}): ${
        typeof parsedBody === "string" ? parsedBody : JSON.stringify(parsedBody)
      }`,
    );
  }

  return parsedBody;
}

function extractParagraphs(res) {
  const paragraphs = res?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs;

  if (!Array.isArray(paragraphs)) {
    throw new Error(`Deepgram response missing paragraphs array: ${JSON.stringify(res)}`);
  }

  return paragraphs;
}

async function writeOutputFile(outputPath, payload) {
  const absolutePath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(process.cwd(), outputPath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return absolutePath;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = await fetchListeningPaperParts(options);

  console.log(
    `Prepared ${rows.length} listening paper_parts rows from ${options.db} (${options.remote ? "remote" : "local"}).`,
  );

  const items = [];
  const failures = [];

  for (const [index, row] of rows.entries()) {
    console.log(`[${index + 1}/${rows.length}] Requesting Deepgram for ${row.id}`);

    try {
      const res = await requestDeepgram(row.audio_url, options);
      const paragraphs = extractParagraphs(res);
      await updateTranscriptDetail(row.id, JSON.stringify(paragraphs), options);

      items.push({
        id: row.id,
        paper_id: row.paper_id ?? null,
        part_no: row.part_no ?? null,
        title: row.title ?? null,
        audio_url: row.audio_url,
        paragraphs,
      });

      console.log(`  Saved ${row.id}: paragraphs=${paragraphs.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({
        id: row.id,
        audio_url: row.audio_url,
        error: message,
      });
      console.error(`  Failed ${row.id}: ${message}`);
    }

    if (options.pollIntervalMs > 0 && index < rows.length - 1) {
      await sleep(options.pollIntervalMs);
    }
  }

  const outputPayload = {
    generatedAt: new Date().toISOString(),
    db: options.db,
    remote: options.remote,
    language: options.language,
    model: options.model,
    total: rows.length,
    successCount: items.length,
    failureCount: failures.length,
    items,
    failures,
  };

  const outputPath = await writeOutputFile(options.output, outputPayload);
  console.log(`Wrote ${items.length} items to ${outputPath}`);
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(String(error));
  }
  process.exit(1);
});
