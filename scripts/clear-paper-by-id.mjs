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
  paperIds: [
    '32b2281d-5732-4b13-9cab-2d32e87e8e4c',
    'a88b2883-8801-418f-b26c-4b1be2f31034'
  ],
};

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function parseArgs(argv) {
  const options = {
    db: CONFIG.db,
    remote: CONFIG.remote,
    dryRun: CONFIG.dryRun,
    paperIds: [...CONFIG.paperIds],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--db") options.db = argv[++i] || options.db;
    else if (arg === "--remote") options.remote = true;
    else if (arg === "--local") options.remote = false;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--paper-id") options.paperIds.push(argv[++i] || "");
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/clear-paper-by-id.mjs [--db ielts] [--remote|--local] [--dry-run] [--paper-id <id>]

Examples:
  node scripts/clear-paper-by-id.mjs --local
  node scripts/clear-paper-by-id.mjs --paper-id 123 --paper-id 456 --remote

Notes:
  1. You can configure ids directly in CONFIG.paperIds.
  2. You can also append ids at runtime with repeated --paper-id flags.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.paperIds = options.paperIds.map((id) => id.trim()).filter(Boolean);
  return options;
}

function buildSql(paperIds) {
  if (paperIds.length === 0) {
    throw new Error("No paper ids configured. Update CONFIG.paperIds or pass --paper-id.");
  }

  const statements = ["PRAGMA foreign_keys = ON;"];

  for (const paperId of paperIds) {
    statements.push(`DELETE FROM exam_papers WHERE id = ${sqlQuote(paperId)};`);
  }

  return statements.join("\n\n");
}

async function executeSql(sql, options) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ielts-clear-paper-"));
  const filePath = path.join(tmpDir, "clear-paper.sql");

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
  const sql = buildSql(options.paperIds);

  console.log(
    `Prepared clear for ${options.paperIds.length} exam_papers ids on ${options.db} (${options.remote ? "remote" : "local"}).`,
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
