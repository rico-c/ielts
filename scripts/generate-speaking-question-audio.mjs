#!/usr/bin/env node

import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";

const execFileAsync = promisify(execFile);

const AVAILABLE_VOICES = [
  "achernar",
  "achird",
  "algenib",
  "algieba",
  "alnilam",
  "aoede",
  "autonoe",
  "callirrhoe",
  "charon",
  "despina",
  "enceladus",
  "erinome",
  "fenrir",
  "gacrux",
  "iapetus",
  "kore",
  "laomedeia",
  "leda",
  "orus",
  "puck",
  "pulcherrima",
  "rasalgethi",
  "sadachbia",
  "sadaltager",
  "schedar",
  "sulafat",
  "umbriel",
  "vindemiatrix",
  "zephyr",
  "zubenelgenubi",
];

const MODELS = [
  // "gemini-2.5-pro-preview-tts",
  "gemini-2.5-flash-preview-tts",
];

const CONFIG = {
  db: "ielts",
  bucket: "ielts",
  remote: true,
  dryRun: false,
  overwrite: false,
  stopOnError: false,
  limit: 0,
  publicBaseUrl: process.env.PUBLIC_R2_BASE_URL || "https://ieltsfile.youshowedu.com",
  objectPrefix: "speaking_question",
  authMode: "service-account",
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
  projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "",
  serviceAccountFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
  serviceAccountJson:
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "",
  sampleRate: 24000,
  channels: 1,
  sampleWidth: 2,
};

function parseArgs(argv) {
  const options = { ...CONFIG, ids: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--db") options.db = argv[++index] || options.db;
    else if (arg === "--bucket") options.bucket = argv[++index] || options.bucket;
    else if (arg === "--public-base-url") options.publicBaseUrl = argv[++index] || options.publicBaseUrl;
    else if (arg === "--object-prefix") options.objectPrefix = argv[++index] || options.objectPrefix;
    else if (arg === "--auth-mode") options.authMode = argv[++index] || options.authMode;
    else if (arg === "--api-key") options.apiKey = argv[++index] || options.apiKey;
    else if (arg === "--project-id") options.projectId = argv[++index] || options.projectId;
    else if (arg === "--service-account-file") options.serviceAccountFile = argv[++index] || options.serviceAccountFile;
    else if (arg === "--remote") options.remote = true;
    else if (arg === "--local") options.remote = false;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--overwrite") options.overwrite = true;
    else if (arg === "--stop-on-error") options.stopOnError = true;
    else if (arg === "--limit") options.limit = Number(argv[++index] || options.limit);
    else if (arg === "--id") options.ids.push(argv[++index]);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/generate-speaking-question-audio.mjs [--db ielts] [--bucket ielts]
                                                   [--public-base-url https://cdn.example.com]
                                                   [--auth-mode service-account|api-key]
                                                   [--project-id your-gcp-project]
                                                   [--service-account-file ./service-account.json]
                                                   [--api-key YOUR_GEMINI_API_KEY]
                                                   [--remote|--local] [--dry-run] [--overwrite]
                                                   [--limit 20] [--id 123] [--stop-on-error]

Notes:
  1. Reads speaking_questions where part IN (1, 3).
  2. By default skips rows that already have audio_url.
  3. Alternates models between gemini-2.5-pro-preview-tts and gemini-2.5-flash-preview-tts.
  4. Assigns a stable voice per topic_id from the built-in AVAILABLE_VOICES list.
  5. Saves WAV files to R2 under speaking_question/<row_id>.wav and updates audio_url.
  6. Service-account mode reads ADC from --service-account-file, GOOGLE_APPLICATION_CREDENTIALS,
     or GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_SERVICE_ACCOUNT_KEY.
  7. API-key mode remains available as a fallback.
  8. Default behavior is continue-on-error so one failed row does not stop the batch.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.publicBaseUrl) {
    throw new Error("Missing --public-base-url or PUBLIC_R2_BASE_URL.");
  }

  if (!["service-account", "api-key"].includes(options.authMode)) {
    throw new Error("--auth-mode must be either service-account or api-key.");
  }

  if (!options.dryRun && options.authMode === "api-key" && !options.apiKey) {
    throw new Error("Missing Gemini API key. Set GEMINI_API_KEY / GOOGLE_API_KEY or pass --api-key.");
  }

  if (!Number.isFinite(options.limit) || options.limit < 0) {
    throw new Error("--limit must be a non-negative number.");
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sqlQuote(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function getStableIndex(value, size) {
  const normalized = String(value ?? "");
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }

  return hash % size;
}

function getVoiceForRow(row) {
  const topicKey = row.topic_id ?? `row:${row.id}`;
  return AVAILABLE_VOICES[getStableIndex(topicKey, AVAILABLE_VOICES.length)];
}

let authContextPromise;

function buildGoogleAuth(options) {
  const authOptions = {
    scopes: [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/generative-language",
    ],
  };

  if (options.serviceAccountFile) {
    authOptions.keyFile = options.serviceAccountFile;
  } else if (options.serviceAccountJson) {
    authOptions.credentials = JSON.parse(options.serviceAccountJson);
  }

  return new GoogleAuth(authOptions);
}

async function getAuthContext(options) {
  if (options.authMode === "api-key") {
    return {
      headers: {},
      projectId: options.projectId || "",
    };
  }

  if (!authContextPromise) {
    authContextPromise = (async () => {
      const auth = buildGoogleAuth(options);
      const client = await auth.getClient();
      const detectedProjectId = options.projectId || (await auth.getProjectId()) || "";

      if (!detectedProjectId) {
        throw new Error(
          "Missing Google Cloud project id. Set --project-id or GOOGLE_CLOUD_PROJECT when using service-account auth.",
        );
      }

      return { auth, client, projectId: detectedProjectId };
    })();
  }

  const context = await authContextPromise;
  const tokenResponse = await context.client.getAccessToken();
  const accessToken =
    typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;

  if (!accessToken) {
    throw new Error("Failed to obtain an OAuth access token from the service account credentials.");
  }

  return {
    projectId: context.projectId,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-goog-user-project": context.projectId,
    },
  };
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

async function fetchSpeakingRows(options) {
  const where = [`part IN (1, 3)`];

  if (!options.overwrite) {
    where.push(`(audio_url IS NULL OR TRIM(audio_url) = '')`);
  }

  if (options.ids.length > 0) {
    where.push(`id IN (${options.ids.map((id) => sqlQuote(id)).join(", ")})`);
  }

  const sql = `
    SELECT id, topic_id, part, topic, question, audio_url
    FROM speaking_questions
    WHERE ${where.join(" AND ")}
    ORDER BY part ASC, topic_id ASC, id ASC
    ${options.limit > 0 ? `LIMIT ${Math.trunc(options.limit)}` : ""}
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
      (typeof row?.id === "number" || typeof row?.id === "string") &&
      typeof row?.question === "string" &&
      row.question.trim().length > 0,
  );
}

async function updateAudioUrlField(options, rowId, finalUrl) {
  const sql = `UPDATE speaking_questions SET audio_url = ${sqlQuote(finalUrl)} WHERE id = ${sqlQuote(rowId)};`;

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

async function uploadAudioObject(options, filePath, objectKey) {
  await runWrangler(
    [
      "r2",
      "object",
      "put",
      `${options.bucket}/${objectKey}`,
      options.remote ? "--remote" : "--local",
      "--file",
      filePath,
      "--content-type",
      "audio/wav",
    ],
    process.cwd(),
  );
}

function buildWaveHeader(dataLength, sampleRate, channels, sampleWidth) {
  const blockAlign = channels * sampleWidth;
  const byteRate = sampleRate * blockAlign;
  const buffer = Buffer.alloc(44);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(sampleWidth * 8, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
}

function pcmToWaveBuffer(pcmBuffer, options) {
  const header = buildWaveHeader(
    pcmBuffer.length,
    options.sampleRate,
    options.channels,
    options.sampleWidth,
  );
  return Buffer.concat([header, pcmBuffer]);
}

function buildObjectKey(options, rowId) {
  return `${options.objectPrefix.replace(/^\/+|\/+$/g, "")}/${rowId}.wav`;
}

async function generateSpeech({ options, model, text, voice, attempt = 1 }) {
  const authContext = await getAuthContext(options);
  const apiUrl =
    options.authMode === "api-key"
      ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(options.apiKey)}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice,
          },
        },
      },
    },
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...authContext.headers,
    },
    body: JSON.stringify(requestBody),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    if (attempt < 4 && (response.status === 429 || response.status >= 500)) {
      await sleep(attempt * 1500);
      return generateSpeech({ options, model, text, voice, attempt: attempt + 1 });
    }
    throw new Error(`Gemini TTS request failed: ${response.status} ${response.statusText} ${JSON.stringify(json)}`);
  }

  const base64Audio = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (typeof base64Audio !== "string" || base64Audio.length === 0) {
    throw new Error(`Gemini TTS returned no audio payload: ${JSON.stringify(json)}`);
  }

  return Buffer.from(base64Audio, "base64");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = await fetchSpeakingRows(options);
  const failures = [];

  console.log(
    `Prepared ${rows.length} speaking_questions audio rows from ${options.db} (${options.remote ? "remote" : "local"}).`,
  );

  if (rows.length === 0) {
    return;
  }

  const baseUrl = ensureTrailingSlash(options.publicBaseUrl);

  for (const [index, row] of rows.entries()) {
    const rowId = String(row.id);
    const model = MODELS[index % MODELS.length];
    const voice = getVoiceForRow(row);
    const objectKey = buildObjectKey(options, rowId);
    const finalUrl = `${baseUrl}${objectKey}`;

    console.log(`[${index + 1}/${rows.length}] ${rowId} part ${row.part} · ${row.topic}`);
    console.log(`  model: ${model}`);
    console.log(`  voice: ${voice}`);
    console.log(`  target: ${finalUrl}`);

    if (options.dryRun) {
      continue;
    }

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ielts-speaking-tts-"));

    try {
      const pcmBuffer = await generateSpeech({
        options,
        model,
        text: row.question,
        voice,
      });
      const wavBuffer = pcmToWaveBuffer(pcmBuffer, options);
      const filePath = path.join(tmpDir, `${rowId}.wav`);

      await writeFile(filePath, wavBuffer);
      await uploadAudioObject(options, filePath, objectKey);
      await updateAudioUrlField(options, rowId, finalUrl);
      console.log(`  uploaded`);
      await sleep(400);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ rowId, message });
      console.error(`  failed: ${message}`);

      if (options.stopOnError) {
        throw error;
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }

  if (failures.length > 0) {
    console.error(`Finished with ${failures.length} failures.`);
    for (const failure of failures) {
      console.error(`  ${failure.rowId}: ${failure.message}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
