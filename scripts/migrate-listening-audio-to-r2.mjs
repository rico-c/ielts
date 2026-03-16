#!/usr/bin/env node

// 将 module为听力的 音频换成自己的r2的url

import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

const CONFIG = {
  db: "ielts",
  bucket: "ielts",
  remote: true,
  dryRun: false,
  onlyEmptyTestField: true,
  publicBaseUrl: "https://ieltsfile.youshowedu.com",
  objectPrefix: "audio",
};

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function buildObjectKey(partId, audioUrl) {
  const extensionMatch = String(audioUrl).match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "mp3";
  return `${CONFIG.objectPrefix}/${partId}.${extension}`;
}

function inferContentType(audioUrl, responseContentType) {
  if (responseContentType?.trim()) {
    return responseContentType.split(";")[0].trim();
  }

  const lower = String(audioUrl).toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  return "application/octet-stream";
}

function parseArgs(argv) {
  const options = {
    ...CONFIG,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--db") options.db = argv[++i] || options.db;
    else if (arg === "--bucket") options.bucket = argv[++i] || options.bucket;
    else if (arg === "--public-base-url") options.publicBaseUrl = argv[++i] || options.publicBaseUrl;
    else if (arg === "--remote") options.remote = true;
    else if (arg === "--local") options.remote = false;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--all") options.onlyEmptyTestField = false;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/migrate-listening-audio-to-r2.mjs [--db ielts] [--bucket ielts] [--public-base-url https://cdn.example.com]
                                             [--remote|--local] [--dry-run] [--all]

Examples:
  node scripts/migrate-listening-audio-to-r2.mjs --dry-run
  node scripts/migrate-listening-audio-to-r2.mjs --public-base-url https://pub-xxxx.r2.dev --remote

Notes:
  1. By default the script only processes listening rows where paper_parts.test is empty.
  2. Uploaded objects use the key pattern: audio/<paper_part_id>.<ext>
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.publicBaseUrl || options.publicBaseUrl === "https://your-public-base-url") {
    throw new Error("Set CONFIG.publicBaseUrl or pass --public-base-url before running this script.");
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
      continue;
    }
  }

  return rows;
}

async function fetchListeningRows(options) {
  const where = [
    `module = 'listening'`,
    `audio_url IS NOT NULL`,
    `TRIM(audio_url) <> ''`,
  ];

  if (options.onlyEmptyTestField) {
    where.push(`(test IS NULL OR TRIM(test) = '')`);
  }

  const sql = `
    SELECT id, audio_url
    FROM paper_parts
    WHERE ${where.join(" AND ")}
    ORDER BY sort_order ASC, part_no ASC
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
    (row) => typeof row?.id === "string" && typeof row?.audio_url === "string",
  );
}

async function updateTestField(options, partId, finalUrl) {
  const sql = `UPDATE paper_parts SET test = ${sqlQuote(finalUrl)} WHERE id = ${sqlQuote(partId)};`;

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

async function uploadAudioObject(options, filePath, objectKey, contentType) {
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
      contentType,
    ],
    process.cwd(),
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = await fetchListeningRows(options);

  console.log(
    `Prepared ${rows.length} listening audio rows from ${options.db} (${options.remote ? "remote" : "local"}).`,
  );

  if (rows.length === 0) {
    return;
  }

  const baseUrl = ensureTrailingSlash(options.publicBaseUrl);

  for (const row of rows) {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ielts-audio-migrate-"));

    try {
      const response = await fetch(row.audio_url);
      if (!response.ok) {
        throw new Error(`Failed to download audio for ${row.id}: ${response.status} ${response.statusText}`);
      }

      const objectKey = buildObjectKey(row.id, row.audio_url);
      const filePath = path.join(tmpDir, path.basename(objectKey));
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = inferContentType(row.audio_url, response.headers.get("content-type"));
      const finalUrl = `${baseUrl}${objectKey}`;

      await writeFile(filePath, buffer);

      console.log(`Processing ${row.id}`);
      console.log(`  source: ${row.audio_url}`);
      console.log(`  target: ${finalUrl}`);

      if (options.dryRun) {
        continue;
      }

      await uploadAudioObject(options, filePath, objectKey, contentType);
      await updateTestField(options, row.id, finalUrl);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
