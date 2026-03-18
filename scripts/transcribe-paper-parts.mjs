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
  languageCode: "en-GB",
  location: "global",
  model: "long",
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "gen-lang-client-0788141694",
  gcsBucket: process.env.GCS_BUCKET || "ieltsyoushow",
  gcsPrefix: process.env.GCS_PREFIX || "paper-parts-audio",
  pollIntervalMs: Number(process.env.GOOGLE_SPEECH_POLL_INTERVAL_MS || 5000),
  pollTimeoutMs: Number(process.env.GOOGLE_SPEECH_POLL_TIMEOUT_MS || 30 * 60 * 1000),
  keepGcsAudio: false,
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
    else if (arg === "--location") options.location = argv[++i] || options.location;
    else if (arg === "--model") options.model = argv[++i] || options.model;
    else if (arg === "--project-id") options.projectId = argv[++i] || options.projectId;
    else if (arg === "--gcs-bucket") options.gcsBucket = argv[++i] || options.gcsBucket;
    else if (arg === "--gcs-prefix") options.gcsPrefix = argv[++i] || options.gcsPrefix;
    else if (arg === "--poll-interval-ms") options.pollIntervalMs = Number(argv[++i] || options.pollIntervalMs);
    else if (arg === "--poll-timeout-ms") options.pollTimeoutMs = Number(argv[++i] || options.pollTimeoutMs);
    else if (arg === "--keep-gcs-audio") options.keepGcsAudio = true;
    else if (arg === "--id") options.ids.push(argv[++i]);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/transcribe-paper-parts.mjs [--db ielts] [--remote|--local] [--overwrite] [--dry-run]
                                         [--limit 10] [--language-code en-GB] [--location global]
                                         [--model long] [--project-id your-gcp-project]
                                         [--gcs-bucket your-bucket] [--gcs-prefix paper-parts-audio]
                                         [--poll-interval-ms 5000] [--poll-timeout-ms 1800000]
                                         [--keep-gcs-audio] [--id PART_ID]

Examples:
  GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \\
  GOOGLE_CLOUD_PROJECT=your-gcp-project \\
  GCS_BUCKET=your-audio-bucket \\
  node scripts/transcribe-paper-parts.mjs --remote --limit 5

  node scripts/transcribe-paper-parts.mjs --local --overwrite --project-id your-gcp-project \\
    --gcs-bucket your-audio-bucket --id paper_part_123

Notes:
  1. Reads rows from paper_parts where audio_url is not NULL.
  2. Downloads each audio file, uploads it to Google Cloud Storage, then uses Speech-to-Text V2 batchRecognize.
  3. Stores transcript plain text into paper_parts.transcript.
  4. Requires paper_parts.transcript to exist. Run migrations first.
  5. Requires Cloud Speech-to-Text API and Cloud Storage permissions on the target project/bucket.
  6. Uses Application Default Credentials / service account auth instead of API keys.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.limit) || options.limit < 0) {
    throw new Error("--limit must be a non-negative number.");
  }

  if (!options.projectId) {
    throw new Error("Missing Google Cloud project id. Pass --project-id or set GOOGLE_CLOUD_PROJECT.");
  }

  if (!options.gcsBucket) {
    throw new Error("Missing GCS bucket. Pass --gcs-bucket or set GCS_BUCKET.");
  }

  if (!Number.isFinite(options.pollIntervalMs) || options.pollIntervalMs <= 0) {
    throw new Error("--poll-interval-ms must be a positive number.");
  }

  if (!Number.isFinite(options.pollTimeoutMs) || options.pollTimeoutMs <= 0) {
    throw new Error("--poll-timeout-ms must be a positive number.");
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

function sanitizeObjectPart(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "audio";
}

function buildGcsObjectName(row, audioUrl, prefix) {
  const url = new URL(audioUrl);
  const ext = path.extname(url.pathname) || ".bin";
  const safePrefix = prefix.replace(/^\/+|\/+$/g, "");
  const safeTitle = sanitizeObjectPart(row.title);
  const safeId = sanitizeObjectPart(row.id);
  const filename = `${safeId}-${safeTitle}-${crypto.randomUUID()}${ext}`;
  return safePrefix ? `${safePrefix}/${filename}` : filename;
}

function getAudioContentType(audioResponse, audioUrl) {
  const headerType = audioResponse.headers.get("content-type");
  if (headerType) {
    return headerType.split(";")[0].trim();
  }

  const ext = path.extname(new URL(audioUrl).pathname).toLowerCase();
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".ogg") return "audio/ogg";
  return "application/octet-stream";
}

function buildTranscriptText(response) {
  const results = Array.isArray(response.results) ? response.results : [];
  const transcriptParts = [];

  for (const result of results) {
    const firstAlternative = Array.isArray(result.alternatives) ? result.alternatives[0] : null;
    if (!firstAlternative) continue;

    if (typeof firstAlternative.transcript === "string" && firstAlternative.transcript.trim()) {
      transcriptParts.push(firstAlternative.transcript.trim());
    }
  }

  return transcriptParts.join(" ").replace(/\s+/g, " ").trim();
}

async function uploadAudioToGcs(row, audioBuffer, contentType, accessToken, options) {
  const objectName = buildGcsObjectName(row, row.audio_url, options.gcsPrefix);
  const uploadUrl = new URL(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(options.gcsBucket)}/o`);
  uploadUrl.searchParams.set("uploadType", "media");
  uploadUrl.searchParams.set("name", objectName);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": contentType,
      "content-length": String(audioBuffer.length),
    },
    body: audioBuffer,
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`GCS upload failed: ${JSON.stringify(body)}`);
  }

  return {
    gcsUri: `gs://${options.gcsBucket}/${objectName}`,
    objectName,
    uploadResponse: body,
  };
}

async function deleteGcsObject(accessToken, bucket, objectName) {
  const deleteUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}`;
  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const body = await response.text();
    throw new Error(`GCS delete failed: ${response.status} ${body}`);
  }
}

async function startBatchRecognize(gcsUri, accessToken, options) {
  const config = {
    autoDecodingConfig: {},
    languageCodes: [options.languageCode],
    model: options.model,
    features: {
      enableWordTimeOffsets: true,
      enableAutomaticPunctuation: true,
    },
  };

  const requestBody = {
    config,
    files: [{ uri: gcsUri }],
    recognitionOutputConfig: {
      inlineResponseConfig: {},
    },
  };
  const recognizerPath = `projects/${options.projectId}/locations/${options.location}/recognizers/_`;

  const response = await fetch(
    `https://speech.googleapis.com/v2/${recognizerPath}:batchRecognize`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    },
  );

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Google Speech request failed: ${JSON.stringify(body)}`);
  }

  return {
    operationName: body.name,
    recognizerPath,
    config,
  };
}

async function pollOperation(operationName, accessToken, options) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < options.pollTimeoutMs) {
    const response = await fetch(`https://speech.googleapis.com/v2/${operationName}`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(`Google operation poll failed: ${JSON.stringify(body)}`);
    }

    if (body.done) {
      if (body.error) {
        throw new Error(`Google Speech operation failed: ${JSON.stringify(body.error)}`);
      }

      return body.response ?? {};
    }

    await sleep(options.pollIntervalMs);
  }

  throw new Error(`Timed out waiting for Google Speech operation after ${options.pollTimeoutMs}ms.`);
}

function extractBatchInlineTranscript(batchResponse) {
  const results = batchResponse?.results && typeof batchResponse.results === "object"
    ? Object.values(batchResponse.results)
    : [];

  if (results.length === 0) {
    throw new Error(`BatchRecognize returned no file results: ${JSON.stringify(batchResponse)}`);
  }

  const firstResult = results[0];
  if (firstResult?.error) {
    throw new Error(`BatchRecognize file result failed: ${JSON.stringify(firstResult.error)}`);
  }

  const transcript = firstResult?.inlineResult?.transcript;
  if (!transcript) {
    throw new Error(`BatchRecognize response missing inline transcript: ${JSON.stringify(firstResult)}`);
  }

  return {
    transcript,
    metadata: firstResult.metadata ?? transcript.metadata ?? null,
    batchFileResult: firstResult,
  };
}

async function transcribeAudio(row, accessToken, options) {
  const audioResponse = await fetch(row.audio_url);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`);
  }

  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
  const contentType = getAudioContentType(audioResponse, row.audio_url);
  const upload = await uploadAudioToGcs(row, audioBuffer, contentType, accessToken, options);

  try {
    const batchJob = await startBatchRecognize(upload.gcsUri, accessToken, options);
    const batchResponse = await pollOperation(batchJob.operationName, accessToken, options);
    const extracted = extractBatchInlineTranscript(batchResponse);

    return buildTranscriptText({
      results: extracted.transcript.results,
      metadata: extracted.metadata,
    });
  } finally {
    if (!options.keepGcsAudio) {
      await deleteGcsObject(accessToken, options.gcsBucket, upload.objectName).catch((error) => {
        console.warn(`Warning: failed to delete GCS object ${upload.objectName}: ${error.message}`);
      });
    }
  }
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

async function updateTranscript(options, rowId, transcriptText) {
  const sql = `
    UPDATE paper_parts
    SET transcript = ${sqlQuote(transcriptText)}
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
  const options = parseArgs(process.argv.slice(2));
  const accessToken = await getGoogleAccessToken();
  const rows = await fetchPaperParts(options);

  console.log(
    `Prepared ${rows.length} paper_parts rows from ${options.db} (${options.remote ? "remote" : "local"}).`,
  );

  let successCount = 0;
  let failureCount = 0;

  for (const [index, row] of rows.entries()) {
    console.log(`[${index + 1}/${rows.length}] Transcribing ${row.id} ${row.audio_url}`);

    try {
      const transcriptText = await transcribeAudio(row, accessToken, options);

      if (options.dryRun) {
        console.log(
          `DRY RUN ${row.id}: transcript length=${transcriptText.length}`,
        );
      } else {
        await updateTranscript(options, row.id, transcriptText);
        console.log(
          `Updated ${row.id}: transcript length=${transcriptText.length}`,
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
