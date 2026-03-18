#!/usr/bin/env node

import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

const CONFIG = {
  db: "ielts",
  remote: true,
  overwrite: false,
  dryRun: false,
  limit: 0,
  languageCode: "en-GB",
  pollIntervalMs: 3000,
  timeoutMs: 10 * 60 * 1000,
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
    else if (arg === "--language-code") options.languageCode = argv[++i] || options.languageCode;
    else if (arg === "--id") options.ids.push(argv[++i]);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/transcribe-paper-parts.mjs [--db ielts] [--remote|--local] [--overwrite] [--dry-run]
                                         [--limit 10] [--language-code en-GB] [--id PART_ID]

Examples:
  node scripts/transcribe-paper-parts.mjs --remote --limit 5
  node scripts/transcribe-paper-parts.mjs --local --overwrite --id paper_part_123

Notes:
  1. Reads rows from paper_parts where audio_url is not NULL.
  2. Downloads each audio file and sends it to Google Cloud Speech-to-Text.
  3. Stores transcript JSON, including word-level timestamps, into paper_parts.transcript.
  4. Requires paper_parts.transcript to exist. Run migrations first.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.limit) || options.limit < 0) {
    throw new Error("--limit must be a non-negative number.");
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

async function readGoogleApiKey(projectRoot) {
  const filePath = path.join(projectRoot, "src/constants/apikeys.ts");
  const source = await readFile(filePath, "utf8");
  const match = source.match(/GCP_GOOGLE_APIKEY\s*=\s*['"]([^'"]+)['"]/);

  if (!match?.[1]) {
    throw new Error(`Could not read GCP_GOOGLE_APIKEY from ${filePath}`);
  }

  return match[1];
}

function inferEncoding(audioUrl, contentType) {
  const lowerUrl = String(audioUrl).toLowerCase();
  const normalizedContentType = String(contentType || "").split(";")[0].trim().toLowerCase();

  if (normalizedContentType === "audio/mpeg" || lowerUrl.endsWith(".mp3")) return "MP3";
  if (normalizedContentType === "audio/flac" || lowerUrl.endsWith(".flac")) return "FLAC";
  if (normalizedContentType === "audio/wav" || normalizedContentType === "audio/x-wav" || lowerUrl.endsWith(".wav")) {
    return undefined;
  }
  if (normalizedContentType === "audio/webm" || lowerUrl.endsWith(".webm")) return "WEBM_OPUS";
  if (normalizedContentType === "audio/ogg" || lowerUrl.endsWith(".ogg") || lowerUrl.endsWith(".opus")) {
    return "OGG_OPUS";
  }
  if (normalizedContentType === "audio/mp4" || normalizedContentType === "audio/x-m4a" || lowerUrl.endsWith(".m4a")) {
    return "MP3";
  }

  return undefined;
}

function toBase64(buffer) {
  return Buffer.from(buffer).toString("base64");
}

function normalizeWordInfo(wordInfo) {
  return {
    word: wordInfo.word ?? "",
    startTime: wordInfo.startTime ?? null,
    endTime: wordInfo.endTime ?? null,
    speakerTag: wordInfo.speakerTag ?? null,
    confidence: wordInfo.confidence ?? null,
  };
}

function buildTranscriptPayload(row, response, config) {
  const results = Array.isArray(response.results) ? response.results : [];
  const alternatives = [];
  const words = [];
  const transcriptParts = [];

  for (const result of results) {
    const firstAlternative = Array.isArray(result.alternatives) ? result.alternatives[0] : null;
    if (!firstAlternative) continue;

    if (typeof firstAlternative.transcript === "string" && firstAlternative.transcript.trim()) {
      transcriptParts.push(firstAlternative.transcript.trim());
    }

    alternatives.push({
      transcript: firstAlternative.transcript ?? "",
      confidence: firstAlternative.confidence ?? null,
      words: Array.isArray(firstAlternative.words) ? firstAlternative.words.map(normalizeWordInfo) : [],
    });

    if (Array.isArray(firstAlternative.words)) {
      words.push(...firstAlternative.words.map(normalizeWordInfo));
    }
  }

  return {
    provider: "google-cloud-speech-to-text-v1",
    transcribedAt: new Date().toISOString(),
    paperPartId: row.id,
    partTitle: row.title,
    audioUrl: row.audio_url,
    config,
    transcript: transcriptParts.join(" ").replace(/\s+/g, " ").trim(),
    alternatives,
    words,
    rawResults: results,
  };
}

async function pollOperation(operationName, apiKey, options) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < options.timeoutMs) {
    const response = await fetch(
      `https://speech.googleapis.com/v1/operations/${encodeURIComponent(operationName)}?key=${encodeURIComponent(apiKey)}`,
      {
        method: "GET",
      },
    );

    const body = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to poll operation ${operationName}: ${JSON.stringify(body)}`);
    }

    if (body.done) {
      if (body.error) {
        throw new Error(`Transcription operation failed: ${JSON.stringify(body.error)}`);
      }
      return body.response ?? {};
    }

    await new Promise((resolve) => setTimeout(resolve, options.pollIntervalMs));
  }

  throw new Error(`Timed out waiting for operation ${operationName}`);
}

async function transcribeAudio(row, apiKey, options) {
  const audioResponse = await fetch(row.audio_url);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`);
  }

  const contentType = audioResponse.headers.get("content-type");
  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
  const encoding = inferEncoding(row.audio_url, contentType);
  const config = {
    languageCode: options.languageCode,
    enableWordTimeOffsets: true,
    enableAutomaticPunctuation: true,
  };

  if (encoding) {
    config.encoding = encoding;
  }

  const requestBody = {
    config,
    audio: {
      content: toBase64(audioBuffer),
    },
  };

  const response = await fetch(
    `https://speech.googleapis.com/v1/speech:longrunningrecognize?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    },
  );

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Google Speech request failed: ${JSON.stringify(body)}`);
  }

  if (!body.name) {
    throw new Error(`Google Speech did not return operation name: ${JSON.stringify(body)}`);
  }

  const finalResponse = await pollOperation(body.name, apiKey, options);
  return buildTranscriptPayload(row, finalResponse, config);
}

async function fetchPaperParts(options) {
  const conditions = [
    "audio_url IS NOT NULL",
    "TRIM(audio_url) <> ''",
  ];

  if (!options.overwrite) {
    conditions.push("(transcript IS NULL OR TRIM(transcript) = '')");
  }

  if (options.ids.length > 0) {
    conditions.push(`id IN (${options.ids.map(sqlQuote).join(", ")})`);
  }

  const limitClause = options.limit > 0 ? `LIMIT ${Math.trunc(options.limit)}` : "";
  const sql = `
    SELECT id, title, audio_url, transcript
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
      typeof row?.title === "string" &&
      typeof row?.audio_url === "string",
  );
}

async function updateTranscript(options, rowId, transcriptPayload) {
  const sql = `
    UPDATE paper_parts
    SET transcript = ${sqlQuote(JSON.stringify(transcriptPayload))}
    WHERE id = ${sqlQuote(rowId)};
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

async function main() {
  const projectRoot = process.cwd();
  const options = parseArgs(process.argv.slice(2));
  const apiKey = 'AIzaSyAIJodN0db1Q0pozPPFEDatt0XFg0VqeLc';
  const rows = await fetchPaperParts(options);

  console.log(
    `Prepared ${rows.length} paper_parts rows from ${options.db} (${options.remote ? "remote" : "local"}).`,
  );

  let successCount = 0;
  let failureCount = 0;

  for (const [index, row] of rows.entries()) {
    console.log(`[${index + 1}/${rows.length}] Transcribing ${row.id} ${row.audio_url}`);

    try {
      const transcriptPayload = await transcribeAudio(row, apiKey, options);

      if (options.dryRun) {
        console.log(
          `DRY RUN ${row.id}: transcript length=${transcriptPayload.transcript.length}, words=${transcriptPayload.words.length}`,
        );
      } else {
        await updateTranscript(options, row.id, transcriptPayload);
        console.log(
          `Updated ${row.id}: transcript length=${transcriptPayload.transcript.length}, words=${transcriptPayload.words.length}`,
        );
      }

      successCount += 1;
    } catch (error) {
      failureCount += 1;
      console.error(`Failed ${row.id}:`, error);
    }
  }

  console.log(`Done. Success=${successCount}, Failed=${failureCount}, DryRun=${options.dryRun}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
