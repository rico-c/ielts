#!/usr/bin/env node

import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// UPDATE paper_parts SET instruction_html = test WHERE test IS NOT NULL;
// UPDATE paper_parts SET test = NULL;

const execFileAsync = promisify(execFile);

const CONFIG = {
  db: "ielts",
  bucket: "ielts",
  remote: true,
  dryRun: false,
  publicBaseUrl: "https://ieltsfile.youshowedu.com",
  objectPrefix: "image",
};

function sqlQuote(value) {
  if (value == null) {
    return "NULL";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function parseArgs(argv) {
  const options = { ...CONFIG };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--db") options.db = argv[++i] || options.db;
    else if (arg === "--bucket") options.bucket = argv[++i] || options.bucket;
    else if (arg === "--public-base-url") options.publicBaseUrl = argv[++i] || options.publicBaseUrl;
    else if (arg === "--remote") options.remote = true;
    else if (arg === "--local") options.remote = false;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/list-question-group-images.mjs [--db ielts] [--bucket ielts] [--public-base-url https://cdn.example.com]
                                          [--remote|--local] [--dry-run]

Examples:
  node scripts/list-question-group-images.mjs --dry-run --local
  node scripts/list-question-group-images.mjs --public-base-url https://cdn.example.com --remote

Notes:
  1. The script scans paper_parts.instruction_html for <img ...> tags.
  2. Each img src is downloaded, uploaded to R2 under image/<uuid>.<ext>, then replaced in instruction_html.
  3. The rewritten HTML is stored into paper_parts.test.
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
    }
  }

  return rows;
}

function extractImgTags(html) {
  if (!html || !html.trim()) {
    return [];
  }

  return Array.from(html.matchAll(/<img\b[^>]*>/gi), (match) => match[0]);
}

function extractImgSrc(imgTag) {
  const match = imgTag.match(/\bsrc\s*=\s*(['"])(.*?)\1/i);
  return match ? match[2] : "";
}

function inferExtension(sourceUrl, responseContentType) {
  if (responseContentType) {
    const contentType = responseContentType.split(";")[0].trim().toLowerCase();
    if (contentType === "image/jpeg") return "jpg";
    if (contentType === "image/png") return "png";
    if (contentType === "image/gif") return "gif";
    if (contentType === "image/webp") return "webp";
    if (contentType === "image/svg+xml") return "svg";
    if (contentType === "image/avif") return "avif";
  }

  const extensionMatch = String(sourceUrl).match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  return extensionMatch ? extensionMatch[1].toLowerCase() : "bin";
}

function inferContentType(sourceUrl, responseContentType) {
  if (responseContentType?.trim()) {
    return responseContentType.split(";")[0].trim();
  }

  const lower = String(sourceUrl).toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".avif")) return "image/avif";
  return "application/octet-stream";
}

async function fetchQuestionGroups(options) {
  const sql = `
    SELECT id, instruction_html, test
    FROM paper_parts
    WHERE instruction_html IS NOT NULL
      AND TRIM(instruction_html) <> ''
      AND instruction_html LIKE '%<img%'
      AND (test IS NULL OR TRIM(test) = '')
    ORDER BY id ASC
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
      typeof row?.instruction_html === "string" &&
      (row?.test == null || typeof row?.test === "string"),
  );
}

async function uploadImageObject(options, filePath, objectKey, contentType) {
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

async function updateTestField(options, rowId, html) {
  const sql = `UPDATE paper_parts SET test = ${sqlQuote(html)} WHERE id = ${sqlQuote(rowId)};`;

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

async function migrateImageSrc(options, src, uploadCache) {
  if (uploadCache.has(src)) {
    return uploadCache.get(src);
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ielts-image-migrate-"));

  try {
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText} (${src})`);
    }

    const extension = inferExtension(src, response.headers.get("content-type"));
    const objectKey = `${options.objectPrefix}/${crypto.randomUUID()}.${extension}`;
    const filePath = path.join(tmpDir, path.basename(objectKey));
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = inferContentType(src, response.headers.get("content-type"));
    const finalUrl = `${ensureTrailingSlash(options.publicBaseUrl)}${objectKey}`;

    await writeFile(filePath, buffer);

    if (!options.dryRun) {
      await uploadImageObject(options, filePath, objectKey, contentType);
    }

    uploadCache.set(src, finalUrl);
    return finalUrl;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = await fetchQuestionGroups(options);
  const uploadCache = new Map();

  console.log(
    `Prepared ${rows.length} paper_parts rows from ${options.db} (${options.remote ? "remote" : "local"}).`,
  );

  let updatedCount = 0;
  let migratedImageCount = 0;

  for (const row of rows) {
    const imgTags = extractImgTags(row.instruction_html);
    if (imgTags.length === 0) {
      continue;
    }

    let nextInstructionHtml = row.instruction_html;
    let rowChanged = false;

    for (const imgTag of imgTags) {
      const src = extractImgSrc(imgTag);
      if (!src) {
        continue;
      }
      console.log(`  source: ${src}`);
      const finalUrl = await migrateImageSrc(options, src, uploadCache);
      nextInstructionHtml = nextInstructionHtml.split(src).join(finalUrl);
      migratedImageCount += 1;
      rowChanged = true;

      console.log(`Processed ${row.id}`);
      console.log(`  target: ${finalUrl}`);
      console.log('------')
    }

    if (!rowChanged) {
      continue;
    }

    if (!options.dryRun) {
      await updateTestField(options, row.id, nextInstructionHtml);
    }

    updatedCount += 1;
  }

  console.log(`Updated ${updatedCount} paper_parts rows.`);
  console.log(`Migrated ${migratedImageCount} img src references.`);
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
