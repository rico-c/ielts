#!/usr/bin/env node
// 我希望你帮我写一个脚本，检查当前的表中所有的字段中，一旦检查到.png 或者其他的图片，尾缀，查看这个图片的url是不是使用 youshowedu.com 这个域名，如果有不是的则打印出来


import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CONFIG = {
  db: "ielts",
  remote: true,
  allowedDomain: "youshowedu.com",
};

const TABLES = [
  {
    table: "exam_papers",
    idColumn: "id",
    textColumns: ["source_paper_id", "title", "book", "version"],
  },
  {
    table: "paper_parts",
    idColumn: "id",
    textColumns: ["test", "title", "instruction_html", "content_html", "audio_url", "meta_json"],
  },
  {
    table: "question_groups",
    idColumn: "id",
    textColumns: ["title", "instruction_html", "content_html", "question_type", "answer_rule", "shared_options_json", "meta_json"],
  },
  {
    table: "questions",
    idColumn: "id",
    textColumns: ["stem", "sub_label", "answer_text", "answer_json", "explanation_html", "meta_json"],
  },
  {
    table: "question_options",
    idColumn: "id",
    textColumns: ["option_key", "option_text"],
  },
];

function parseArgs(argv) {
  const options = { ...CONFIG };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--db") options.db = argv[++i] || options.db;
    else if (arg === "--domain") options.allowedDomain = argv[++i] || options.allowedDomain;
    else if (arg === "--remote") options.remote = true;
    else if (arg === "--local") options.remote = false;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/check-image-url-domains.mjs [--db ielts] [--domain youshowedu.com] [--remote|--local]

Examples:
  node scripts/check-image-url-domains.mjs --remote
  node scripts/check-image-url-domains.mjs --local --domain youshowedu.com

Notes:
  1. The script scans known text columns across the current tables.
  2. It extracts image URLs and prints every match with its table and column.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function runWrangler(args, cwd) {
  const { stdout, stderr } = await execFileAsync("npx", ["wrangler", ...args], {
    cwd,
    maxBuffer: 20 * 1024 * 1024,
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

function extractUrls(text) {
  if (!text || !text.trim()) {
    return [];
  }

  const matches = text.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  return [...new Set(matches)];
}

function isImageUrl(url) {
  return /\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:[?#][^\s"'<>]*)?$/i.test(url);
}

function isAllowedHost(url, allowedDomain) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const normalizedDomain = allowedDomain.toLowerCase();
    return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
  } catch {
    return false;
  }
}

async function fetchTableRows(options, tableConfig) {
  const selectColumns = [tableConfig.idColumn, ...tableConfig.textColumns].join(", ");
  const sql = `SELECT ${selectColumns} FROM ${tableConfig.table};`;

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

  return extractRowsFromD1Json(stdout);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let hitCount = 0;

  for (const tableConfig of TABLES) {
    const rows = await fetchTableRows(options, tableConfig);

    for (const row of rows) {
      const rowId = row?.[tableConfig.idColumn];
      if (typeof rowId !== "string" || !rowId) {
        continue;
      }

      for (const column of tableConfig.textColumns) {
        const value = row?.[column];
        if (typeof value !== "string" || !value.trim()) {
          continue;
        }

        const urls = extractUrls(value).filter(isImageUrl);
        for (const url of urls) {
          const allowed = isAllowedHost(url, options.allowedDomain) ? "allowed" : "external";
          console.log(`${tableConfig.table}\t${rowId}\t${column}\t${allowed}\t${url}`);
          hitCount += 1;
        }
      }
    }
  }

  console.log(`Found ${hitCount} image URLs total.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
