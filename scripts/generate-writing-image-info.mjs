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
  ids: [],
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "",
  location: process.env.GOOGLE_VERTEX_LOCATION || "global",
  model: process.env.GOOGLE_VERTEX_MODEL || "gemini-2.5-flash",
  imageHost: "ieltsfile.youshowedu.com",
  descriptionLanguage: "zh-CN",
  maxOutputTokens: 400,
  temperature: 0.2,
  thinkingBudget: 0,
  inlineImageByteLimit: 7 * 1024 * 1024,
  minDescriptionLength: 60,
  descriptionRetries: 2,
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
    else if (arg === "--id") options.ids.push(argv[++i]);
    else if (arg === "--project-id") options.projectId = argv[++i] || options.projectId;
    else if (arg === "--location") options.location = argv[++i] || options.location;
    else if (arg === "--model") options.model = argv[++i] || options.model;
    else if (arg === "--image-host") options.imageHost = argv[++i] || options.imageHost;
    else if (arg === "--description-language") {
      options.descriptionLanguage = argv[++i] || options.descriptionLanguage;
    } else if (arg === "--max-output-tokens") {
      options.maxOutputTokens = Number(argv[++i] || options.maxOutputTokens);
    } else if (arg === "--temperature") {
      options.temperature = Number(argv[++i] || options.temperature);
    } else if (arg === "--thinking-budget") {
      options.thinkingBudget = Number(argv[++i] || options.thinkingBudget);
    } else if (arg === "--min-description-length") {
      options.minDescriptionLength = Number(argv[++i] || options.minDescriptionLength);
    } else if (arg === "--description-retries") {
      options.descriptionRetries = Number(argv[++i] || options.descriptionRetries);
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/generate-writing-image-info.mjs [--db ielts] [--remote|--local] [--overwrite] [--dry-run]
                                              [--limit 10] [--id PART_ID]
                                              [--project-id your-gcp-project] [--location global]
                                              [--model gemini-2.5-flash]
                                              [--image-host ieltsfile.youshowedu.com]
                                              [--description-language zh-CN]
                                              [--max-output-tokens 400] [--temperature 0.2]
                                              [--thinking-budget 0]
                                              [--min-description-length 60] [--description-retries 2]

Examples:
  GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \\
  node scripts/generate-writing-image-info.mjs --remote --limit 5

  node scripts/generate-writing-image-info.mjs --remote --overwrite \\
    --model gemini-2.5-flash --description-language en --id paper_part_123

Notes:
  1. Reads paper_parts where module = 'writing' and part_no = 1.
  2. Parses content_html and only keeps <img> URLs under the configured host.
  3. Uses a Google service account / ADC to call Gemini on Vertex AI.
  4. Stores image_info as plain text. If multiple images exist, their descriptions are joined with blank lines.
  5. Thinking is disabled by default for Gemini 2.5 Flash to avoid wasting tokens on internal reasoning.
  6. Very short descriptions are treated as suspicious and retried automatically.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.limit) || options.limit < 0) {
    throw new Error("--limit must be a non-negative number.");
  }

  if (!Number.isFinite(options.maxOutputTokens) || options.maxOutputTokens <= 0) {
    throw new Error("--max-output-tokens must be a positive number.");
  }

  if (!Number.isFinite(options.temperature) || options.temperature < 0 || options.temperature > 2) {
    throw new Error("--temperature must be between 0 and 2.");
  }

  if (!Number.isFinite(options.thinkingBudget) || options.thinkingBudget < 0) {
    throw new Error("--thinking-budget must be a non-negative number.");
  }

  if (!Number.isFinite(options.minDescriptionLength) || options.minDescriptionLength <= 0) {
    throw new Error("--min-description-length must be a positive number.");
  }

  if (!Number.isFinite(options.descriptionRetries) || options.descriptionRetries < 0) {
    throw new Error("--description-retries must be a non-negative number.");
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

async function getGoogleClientInfo(options) {
  let GoogleAuth;

  try {
    ({ GoogleAuth } = await import("google-auth-library"));
  } catch {
    throw new Error(
      'Missing dependency "google-auth-library". Run `npm i` in /Users/rico/Desktop/ielts first.',
    );
  }

  const auth = new GoogleAuth({
    projectId: options.projectId || undefined,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const accessToken = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  const projectId = options.projectId || (await auth.getProjectId().catch(() => null)) || null;

  if (!accessToken) {
    throw new Error(
      "Failed to obtain Google access token. Check GOOGLE_APPLICATION_CREDENTIALS or ADC setup.",
    );
  }

  if (!projectId) {
    throw new Error("Missing Google Cloud project id. Pass --project-id or set GOOGLE_CLOUD_PROJECT.");
  }

  return { accessToken, projectId };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithRetry(url, init, config = {}) {
  const retries = config.retries ?? 3;
  const retryStatuses = new Set(config.retryStatuses ?? [429, 500, 502, 503, 504]);
  const label = config.label || "request";

  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (!retryStatuses.has(response.status) || attempt === retries) {
        return response;
      }

      lastError = new Error(`${label} failed with status ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === retries) {
        throw lastError;
      }
    }

    await sleep(750 * attempt);
  }

  throw lastError || new Error(`${label} failed`);
}

function isTargetHost(urlString, imageHost) {
  try {
    return new URL(urlString).hostname.toLowerCase() === imageHost.toLowerCase();
  } catch {
    return false;
  }
}

function extractImageUrlsFromHtml(html, imageHost) {
  if (!html || !html.trim()) {
    return [];
  }

  const urls = [];
  const seen = new Set();

  for (const match of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi)) {
    const src = match[2]?.trim();
    if (!src || seen.has(src) || !isTargetHost(src, imageHost)) {
      continue;
    }

    seen.add(src);
    urls.push(src);
  }

  return urls;
}

function inferImageMimeType(imageUrl, response) {
  const headerType = response.headers.get("content-type");
  if (headerType?.trim()) {
    return headerType.split(";")[0].trim().toLowerCase();
  }

  const ext = path.extname(new URL(imageUrl).pathname).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".avif") return "image/avif";
  return "application/octet-stream";
}

function buildDescriptionPrompt(language, minDescriptionLength, attempt) {
  const retryHint = attempt > 1
    ? "上一次回答过短或不完整，这次请务必输出完整段落。"
    : "";

  if (String(language).toLowerCase().startsWith("en")) {
    return [
      "Describe the image in one complete paragraph.",
      "Focus on the visible chart or diagram type, topic, axes, legend, categories, units, time periods, and the main overall patterns or contrasts.",
      "Do not mention IELTS, do not use bullet points, and do not invent unreadable details.",
      `Write at least ${Math.max(minDescriptionLength, 80)} characters and use complete sentences.`,
      retryHint,
      "Return plain text only.",
    ].join(" ");
  }

  return [
    "请用一整段简体中文完整描述这张图片。",
    "重点说明可见的图表或流程图类型、主题、坐标轴、图例、分类、单位、时间范围，以及整体最明显的趋势或对比。",
    "不要提 IELTS，不要用列表，不要臆造看不清的细节。",
    `至少写 ${Math.max(minDescriptionLength, 60)} 个汉字，并且必须使用完整句子，不要只写半句。`,
    retryHint,
    "只返回纯文本。",
  ].join("");
}

function buildGenerateContentUrl(projectId, location, model) {
  const serviceEndpoint = location === "global"
    ? "aiplatform.googleapis.com"
    : `${location}-aiplatform.googleapis.com`;

  return `https://${serviceEndpoint}/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
}

function parseJsonIfPossible(text) {
  if (!text?.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function summarizeErrorBody(bodyText, bodyJson) {
  if (bodyJson?.error?.message) {
    const status = bodyJson.error.status ? ` (${bodyJson.error.status})` : "";
    return `${bodyJson.error.message}${status}`;
  }

  if (bodyText?.trim()) {
    return bodyText.trim().slice(0, 500);
  }

  return "empty response body";
}

function buildModelHint(model) {
  return [
    `Model "${model}" may be unavailable in this project or region.`,
    'Try "--model gemini-2.5-flash" first.',
    'If your project only exposes versioned names, also try "--model gemini-2.0-flash-001".',
  ].join(" ");
}

function extractGeneratedText(body) {
  const candidates = Array.isArray(body?.candidates) ? body.candidates : [];
  if (candidates.length === 0) {
    throw new Error(`Gemini returned no candidates: ${JSON.stringify(body)}`);
  }

  const firstCandidate = candidates[0];
  const parts = Array.isArray(firstCandidate?.content?.parts) ? firstCandidate.content.parts : [];
  const text = parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();

  if (!text) {
    throw new Error(
      `Gemini returned an empty description. finishReason=${firstCandidate?.finishReason || "unknown"}`,
    );
  }

  return text;
}

function isSuspiciouslyShortDescription(description, options) {
  return description.trim().length < options.minDescriptionLength;
}

async function describeImageOnce(imageUrl, accessToken, projectId, options, attempt) {
  const imageResponse = await fetchWithRetry(imageUrl, undefined, {
    retries: 3,
    label: `image download ${imageUrl}`,
  });

  if (!imageResponse.ok) {
    throw new Error(
      `Failed to download image ${imageUrl}: ${imageResponse.status} ${imageResponse.statusText}`,
    );
  }

  const mimeType = inferImageMimeType(imageUrl, imageResponse);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  if (imageBuffer.length === 0) {
    throw new Error(`Image ${imageUrl} is empty.`);
  }

  const imagePart = imageBuffer.length <= options.inlineImageByteLimit
    ? {
        inlineData: {
          mimeType,
          data: imageBuffer.toString("base64"),
        },
      }
    : {
        fileData: {
          mimeType,
          fileUri: imageUrl,
        },
      };

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildDescriptionPrompt(options.descriptionLanguage, options.minDescriptionLength, attempt) },
          imagePart,
        ],
      },
    ],
    generationConfig: {
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
      responseMimeType: "text/plain",
      thinkingConfig: {
        thinkingBudget: options.thinkingBudget,
      },
    },
  };

  const response = await fetchWithRetry(
    buildGenerateContentUrl(projectId, options.location, options.model),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    },
    {
      retries: 3,
      label: `Gemini generateContent ${options.model}`,
    },
  );

  const rawBody = await response.text();
  const body = parseJsonIfPossible(rawBody);
  if (!response.ok) {
    const modelHint = response.status === 404 ? ` ${buildModelHint(options.model)}` : "";
    throw new Error(
      `Gemini request failed: HTTP ${response.status} ${response.statusText}; ${summarizeErrorBody(rawBody, body)}${modelHint}`,
    );
  }

  return {
    description: extractGeneratedText(body),
    finishReason: body?.candidates?.[0]?.finishReason || null,
    mimeType,
    byteLength: imageBuffer.length,
    model: body?.modelVersion || options.model,
  };
}

async function describeImage(imageUrl, accessToken, projectId, options) {
  let lastResult = null;

  for (let attempt = 1; attempt <= options.descriptionRetries + 1; attempt += 1) {
    const result = await describeImageOnce(imageUrl, accessToken, projectId, options, attempt);
    lastResult = result;

    if (!isSuspiciouslyShortDescription(result.description, options)) {
      return result;
    }

    console.warn(
      `Short description for ${imageUrl} on attempt ${attempt}: length=${result.description.length}, finishReason=${result.finishReason || "unknown"}`,
    );
  }

  throw new Error(
    `Description remained too short after ${options.descriptionRetries + 1} attempt(s): ${JSON.stringify(lastResult)}`,
  );
}

async function fetchPaperParts(options) {
  const conditions = [
    "module = 'writing'",
    "part_no = 1",
    "content_html IS NOT NULL",
    "TRIM(content_html) <> ''",
    "content_html LIKE '%<img%'",
    `content_html LIKE ${sqlQuote(`%${options.imageHost}%`)}`,
  ];

  if (!options.overwrite) {
    conditions.push("(image_info IS NULL OR TRIM(CAST(image_info AS TEXT)) = '')");
  }

  if (options.ids.length > 0) {
    conditions.push(`id IN (${options.ids.map(sqlQuote).join(", ")})`);
  }

  const limitClause = options.limit > 0 ? `LIMIT ${Math.trunc(options.limit)}` : "";
  const sql = `
    SELECT id, title, content_html, image_info
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
      typeof row?.content_html === "string",
  );
}

async function updateImageInfo(options, rowId, imageInfo) {
  const finalText = imageInfo
    .map((item) => item?.description || "")
    .map((text) => text.trim())
    .filter(Boolean)
    .join("\n\n");

  const sql = `
    UPDATE paper_parts
    SET image_info = ${sqlQuote(finalText)}
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
  const { accessToken, projectId } = await getGoogleClientInfo(options);
  const rows = await fetchPaperParts(options);

  console.log(
    `Prepared ${rows.length} writing part 1 paper_parts rows from ${options.db} (${options.remote ? "remote" : "local"}).`,
  );

  let successCount = 0;
  let skippedCount = 0;
  let failureCount = 0;

  for (const [index, row] of rows.entries()) {
    console.log(`[${index + 1}/${rows.length}] Processing ${row.id}`);

    try {
      const imageUrls = extractImageUrlsFromHtml(row.content_html, options.imageHost);

      if (imageUrls.length === 0) {
        console.log(`Skipped ${row.id}: no matching images under ${options.imageHost}`);
        skippedCount += 1;
        continue;
      }

      const imageInfo = [];

      for (const imageUrl of imageUrls) {
        const described = await describeImage(imageUrl, accessToken, projectId, options);
        imageInfo.push({
          url: imageUrl,
          description: described.description,
        });
      }

      if (options.dryRun) {
        console.log(
          `DRY RUN ${row.id}:\n${imageInfo.map((item) => item.description).join("\n\n")}`,
        );
      } else {
        await updateImageInfo(options, row.id, imageInfo);
        console.log(`Updated ${row.id}: ${imageInfo.length} image description(s).`);
      }

      successCount += 1;
    } catch (error) {
      failureCount += 1;
      console.error(`Failed ${row.id}:`, error);
    }
  }

  console.log(
    `Done. Success=${successCount}, Skipped=${skippedCount}, Failed=${failureCount}, DryRun=${options.dryRun}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
