#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

const CONFIG = {
  db: "ielts",
  remote: true,
  dryRun: false,
};

const TABLES_TO_CLEAR = [
  "question_options",
  "questions",
  "question_groups",
  "paper_parts",
  "exam_papers", 
];

function parseArgs(argv) {
  const options = {
    db: CONFIG.db,
    remote: CONFIG.remote,
    dryRun: CONFIG.dryRun,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--db") options.db = argv[++i] || options.db;
    else if (arg === "--remote") options.remote = true;
    else if (arg === "--local") options.remote = false;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/clear-d1-data.mjs [--db ielts] [--remote|--local] [--dry-run]

Examples:
  node scripts/clear-d1-data.mjs --local
  node scripts/clear-d1-data.mjs --remote
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function buildSql() {
  const statements = ["PRAGMA foreign_keys = OFF;"];

  for (const tableName of TABLES_TO_CLEAR) {
    statements.push(`DELETE FROM ${tableName};`);
  }

  statements.push("PRAGMA foreign_keys = ON;");
  return statements.join("\n\n");
}

async function executeSql(sql, options) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ielts-clear-"));
  const filePath = path.join(tmpDir, "clear.sql");

  try {
    await writeFile(filePath, sql, "utf8");
    const args = ["wrangler", "d1", "execute", options.db, options.remote ? "--remote" : "--local", "--file", filePath];
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
  const sql = buildSql();

  console.log(
    `Prepared clear for ${TABLES_TO_CLEAR.length} tables on ${options.db} (${options.remote ? "remote" : "local"}).`
  );

  if (options.dryRun) {
    console.log(sql);
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
