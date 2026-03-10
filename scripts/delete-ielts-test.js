#!/usr/bin/env node

/**
 * Delete one IELTS test and all related rows from D1.
 *
 * Preferred way:
 *   Edit CONFIG below, then run:
 *   node scripts/delete-ielts-test.js
 *
 * Usage examples:
 *   node scripts/delete-ielts-test.js --by test_code --value C20-T3-L --remote --yes
 *   node scripts/delete-ielts-test.js --by source_url --value https://practicepteonline.com/ielts-listening-test-203/ --yes
 *   node scripts/delete-ielts-test.js --by id --value 12 --local --yes
 *
 * Safety:
 *   Without --yes, this script only previews matching rows and related counts.
 */

const os = require('node:os');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const DEFAULT_DB_NAME = 'ielts';
const DEFAULT_REMOTE = true;
const CONFIG = {
  dbName: 'ielts',
  remote: true, // true => --remote, false => --local
  by: 'test_code', // id | source_url | test_code
  value: 'C20-T3-L',
  yes: true, // true will execute deletion
  debug: false,
};

function parseArgs(argv) {
  const args = {
    dbName: CONFIG.dbName || DEFAULT_DB_NAME,
    remote: typeof CONFIG.remote === 'boolean' ? CONFIG.remote : DEFAULT_REMOTE,
    by: CONFIG.by || '',
    value: CONFIG.value || '',
    yes: Boolean(CONFIG.yes),
    debug: Boolean(CONFIG.debug),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--db' && argv[i + 1]) {
      args.dbName = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--by' && argv[i + 1]) {
      args.by = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--value' && argv[i + 1]) {
      args.value = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--remote') {
      args.remote = true;
      continue;
    }
    if (token === '--local') {
      args.remote = false;
      continue;
    }
    if (token === '--yes') {
      args.yes = true;
      continue;
    }
    if (token === '--debug') {
      args.debug = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function printUsage() {
  console.log(`Usage:
  node scripts/delete-ielts-test.js --by <id|source_url|test_code> --value <VALUE> [--db ielts] [--remote|--local] [--yes] [--debug]

Examples:
  node scripts/delete-ielts-test.js --by test_code --value C20-T3-L --remote --yes
  node scripts/delete-ielts-test.js --by source_url --value https://practicepteonline.com/ielts-listening-test-203/ --yes
  node scripts/delete-ielts-test.js --by id --value 12 --local --yes

Notes:
  - Script uses CONFIG defaults; CLI arguments override CONFIG.
  - Without --yes, script only previews what would be deleted.
  - Deletion is done from ielts_tests and child tables are removed by ON DELETE CASCADE.`);
}

function debugLog(enabled, ...args) {
  if (!enabled) return;
  console.log('[DEBUG]', ...args);
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildWhereClause(by, value) {
  if (by === 'id') {
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      throw new Error(`Invalid id value: ${value}`);
    }
    return `id = ${n}`;
  }
  if (by === 'source_url') {
    if (!value) throw new Error('source_url value cannot be empty');
    return `source_url = ${sqlQuote(value)}`;
  }
  if (by === 'test_code') {
    if (!value) throw new Error('test_code value cannot be empty');
    return `test_code = ${sqlQuote(value)}`;
  }
  throw new Error(`Invalid --by value: ${by}. Use id, source_url, or test_code.`);
}

function buildPreviewSql(whereClause) {
  return `
PRAGMA foreign_keys = ON;

SELECT
  t.id,
  t.source_url,
  t.title,
  t.test_code,
  t.series,
  t.book_no,
  t.test_no,
  t.module,
  (SELECT COUNT(*) FROM ielts_test_audio_urls a WHERE a.test_id = t.id) AS audio_count,
  (SELECT COUNT(*) FROM ielts_test_parts p WHERE p.test_id = t.id) AS part_count,
  (SELECT COUNT(*) FROM ielts_questions q WHERE q.test_id = t.id) AS question_count,
  (SELECT COUNT(*)
     FROM ielts_question_options o
    WHERE o.question_id IN (SELECT q2.id FROM ielts_questions q2 WHERE q2.test_id = t.id)
  ) AS option_count,
  (SELECT COUNT(*) FROM ielts_tables tb WHERE tb.test_id = t.id) AS table_count,
  (SELECT COUNT(*)
     FROM ielts_table_cells c
    WHERE c.table_id IN (SELECT tb2.id FROM ielts_tables tb2 WHERE tb2.test_id = t.id)
  ) AS table_cell_count
FROM ielts_tests t
WHERE ${whereClause}
ORDER BY t.id;
`.trim();
}

function buildDeleteSql(whereClause) {
  return `
PRAGMA foreign_keys = ON;
DELETE FROM ielts_tests WHERE ${whereClause};
SELECT changes() AS deleted_tests;
`.trim();
}

async function runD1Sql(sql, { dbName, remote, cwd, debug }) {
  const filePath = path.join(os.tmpdir(), `ielts-delete-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  await fs.writeFile(filePath, sql, 'utf8');
  const args = ['wrangler', 'd1', 'execute', dbName, remote ? '--remote' : '--local', '--file', filePath];
  debugLog(debug, 'Running:', `npx ${args.join(' ')}`);
  try {
    const { stdout, stderr } = await execFileAsync('npx', args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout, stderr };
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  if (!args.by || !args.value) {
    printUsage();
    throw new Error('Missing required filter. Set CONFIG.by/CONFIG.value or pass --by/--value.');
  }

  const whereClause = buildWhereClause(args.by, args.value);
  const modeLabel = args.remote ? 'remote' : 'local';

  console.log(`Target DB: ${args.dbName} (${modeLabel})`);
  console.log(`Filter: ${args.by} = ${args.value}`);

  console.log('\nPreview matching tests and dependent row counts:');
  const previewSql = buildPreviewSql(whereClause);
  const preview = await runD1Sql(previewSql, {
    dbName: args.dbName,
    remote: args.remote,
    cwd: process.cwd(),
    debug: args.debug,
  });
  if (preview.stdout && preview.stdout.trim()) console.log(preview.stdout.trim());
  if (preview.stderr && preview.stderr.trim()) console.error(preview.stderr.trim());

  if (!args.yes) {
    console.log('\nDry-run only. Re-run with --yes to execute deletion.');
    return;
  }

  console.log('\nDeleting from ielts_tests (child rows cascade automatically)...');
  const delSql = buildDeleteSql(whereClause);
  const del = await runD1Sql(delSql, {
    dbName: args.dbName,
    remote: args.remote,
    cwd: process.cwd(),
    debug: args.debug,
  });
  if (del.stdout && del.stdout.trim()) console.log(del.stdout.trim());
  if (del.stderr && del.stderr.trim()) console.error(del.stderr.trim());

  console.log('\nPost-delete verification:');
  const verify = await runD1Sql(buildPreviewSql(whereClause), {
    dbName: args.dbName,
    remote: args.remote,
    cwd: process.cwd(),
    debug: args.debug,
  });
  if (verify.stdout && verify.stdout.trim()) console.log(verify.stdout.trim());
  if (verify.stderr && verify.stderr.trim()) console.error(verify.stderr.trim());
}

main().catch((err) => {
  console.error('[ERROR]', err && err.message ? err.message : err);
  process.exit(1);
});
