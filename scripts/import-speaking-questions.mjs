#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const options = {
    input: "data/speaking-questions-2026-01-04.json",
    db: "ielts",
    remote: true,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") options.input = argv[++index] || options.input;
    else if (arg === "--db") options.db = argv[++index] || options.db;
    else if (arg === "--remote") options.remote = true;
    else if (arg === "--local") options.remote = false;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/import-speaking-questions.mjs [--input data/speaking-questions-2026-01-04.json] [--db ielts] [--remote|--local] [--dry-run]

Examples:
  node scripts/import-speaking-questions.mjs --local
  node scripts/import-speaking-questions.mjs --remote
  node scripts/import-speaking-questions.mjs --dry-run
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function sqlQuote(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlInt(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw new Error(`Expected integer value, received: ${value}`);
  }
  return String(number);
}

function normalizeItems(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Input JSON must be an object.");
  }

  const buckets = [
    ...(Array.isArray(raw.newQuestions) ? raw.newQuestions : []),
    ...(Array.isArray(raw.retainedQuestions) ? raw.retainedQuestions : []),
  ];

  const rows = [];

  for (const [itemIndex, item] of buckets.entries()) {
    const part = Number(item?.part);
    const topic = String(item?.topic || "").trim();
    const topicId = String(item?.topicId || "").trim();
    const requirement = Array.isArray(item?.requirement)
      ? item.requirement
          .map((entry) => String(entry || "").trim())
          .filter(Boolean)
      : [];
    const questions = Array.isArray(item?.question)
      ? item.question
          .map((entry) => String(entry || "").trim())
          .filter(Boolean)
      : [];

    if (!Number.isInteger(part) || part < 1 || part > 3) {
      throw new Error(`Item ${itemIndex} has invalid part: ${item?.part}`);
    }

    if (!topic) {
      throw new Error(`Item ${itemIndex} is missing topic.`);
    }

    if (!topicId) {
      throw new Error(`Item ${itemIndex} is missing topicId.`);
    }

    if (questions.length === 0) {
      throw new Error(`Item ${itemIndex} (${topic}) has no questions.`);
    }

    for (const question of questions) {
      rows.push({
        part,
        topic,
        topicId,
        question,
        requirement: JSON.stringify(requirement),
      });
    }
  }

  return rows;
}

function buildSql(rows) {
  const topicIds = [...new Set(rows.map((row) => row.topicId))];
  const topics = [...new Set(rows.map((row) => row.topic))];
  const statements = [];

  if (topicIds.length > 0) {
    statements.push(
      `DELETE FROM speaking_questions
       WHERE topic_id IN (${topicIds.map(sqlQuote).join(", ")})
          OR topic IN (${topics.map(sqlQuote).join(", ")});`,
    );
  }

  for (const row of rows) {
    statements.push(
      `INSERT INTO speaking_questions (
         part, topic, topic_id, question, requirement, created_at, updated_at
       ) VALUES (
         ${sqlInt(row.part)},
         ${sqlQuote(row.topic)},
         ${sqlQuote(row.topicId)},
         ${sqlQuote(row.question)},
         ${sqlQuote(row.requirement)},
         unixepoch(),
         unixepoch()
       );`,
    );
  }
  return statements.join("\n\n");
}

async function executeSql(sql, options) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ielts-speaking-import-"));
  const filePath = path.join(tmpDir, "speaking-questions.sql");

  try {
    await writeFile(filePath, sql, "utf8");
    const args = [
      "wrangler",
      "d1",
      "execute",
      options.db,
      options.remote ? "--remote" : "--local",
      "--file",
      filePath,
    ];
    const { stdout, stderr } = await execFileAsync("npx", args, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout, stderr };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), options.input);
  const raw = JSON.parse(await readFile(inputPath, "utf8"));
  const rows = normalizeItems(raw);
  const sql = buildSql(rows);

  console.log(
    `Prepared ${rows.length} speaking_questions rows from ${options.input} on ${options.db} (${options.remote ? "remote" : "local"}).`,
  );

  if (options.dryRun) {
    process.stdout.write(sql);
    return;
  }

  const result = await executeSql(sql, options);
  if (result.stdout?.trim()) console.log(result.stdout.trim());
  if (result.stderr?.trim()) console.error(result.stderr.trim());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
