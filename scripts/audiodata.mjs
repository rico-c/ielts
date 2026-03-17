#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

const DATA = [
  // {
  //   title: "IELTS14",
  //   book: "listening",
  //   test_no: 1,
  //   parts: [
  //     "https://ieltscat-oss.xdf.cn/1004/158382324490656.mp3",
  //     "https://ieltscat-oss.xdf.cn/1004/1557457024914295.mp3",
  //     "https://ieltscat-oss.xdf.cn/1004/1557457095247730.mp3",
  //     "https://ieltscat-oss.xdf.cn/1004/1583823292194383.mp3",
  //   ],
  // },
  // {
  //   title: "IELTS14",
  //   book: "listening",
  //   test_no: 2,
  //   parts: [
  //     "https://ieltscat-oss.xdf.cn/1004/1583823551677804.mp3",
  //     "https://ieltscat-oss.xdf.cn/1004/1562584018837967.mp3",
  //     "https://ieltscat-oss.xdf.cn/1004/1562584053123776.mp3",
  //     "https://ieltscat-oss.xdf.cn/1004/1583824166411947.mp3",
  //   ],
  // },
  // {
  //   title: "IELTS14",
  //   book: "listening",
  //   test_no: 3,
  //   parts: [
  //     "https://ieltscat-oss.xdf.cn/1004/1583824213284198.mp3",
  //     "https://ieltscat-oss.xdf.cn/1004/1557479256591425.mp3",
  //     "https://ieltscat-oss.xdf.cn/1004/1557481957672885.mp3",
  //     "https://ieltscat-oss.xdf.cn/1004/1583830580258909.mp3",
  //   ],
  // },
  // {
  //   title: "IELTS14",
  //   book: "listening",
  //   test_no: 4,
  //   parts: [
  //     "https://ieltscat-oss.xdf.cn/1004/1583824286603820.mp3",
  //     "https://ieltscat-oss.xdf.cn/1004/1557541649989285.mp3",
  //     "https://ieltscat-oss.xdf.cn/1004/155754163051016.mp3",
  //     "https://ieltscat-oss.xdf.cn/1004/1583824337913519.mp3",
  //   ],
  // },
  {
    title: "IELTS13",
    book: "listening",
    test_no: 1,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583822840562872.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557570278488222.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557570465126419.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583822864357305.mp3"
    ],
  },
  {
    title: "IELTS13",
    book: "listening",
    test_no: 2,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583822896793977.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557561536833584.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557562822794371.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583822926987242.mp3"
    ],
  },
  {
    title: "IELTS13",
    book: "listening",
    test_no: 3,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583822983764241.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557647120914448.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557648011544516.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583823008717483.mp3"
    ],
  },
  {
    title: "IELTS13",
    book: "listening",
    test_no: 4,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583823150344339.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557744724363294.mp3",
      "https://ieltscat-oss.xdf.cn/1004/155774477190951.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583823119110139.mp3"
    ],
  },
  {
    title: "IELTS12",
    book: "listening",
    test_no: 1,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583822432257851.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557735585517114.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557735549450438.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583822590945862.mp3"
    ],
  },
  {
    title: "IELTS12",
    book: "listening",
    test_no: 2,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583822627199541.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557735770499711.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557736810490697.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583822652892978.mp3"
    ],
  },
  {
    title: "IELTS12",
    book: "listening",
    test_no: 3,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/158382268386155.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557804421577290.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557804385698660.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583822716104649.mp3"
    ],
  },
  {
    title: "IELTS12",
    book: "listening",
    test_no: 4,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583822752743756.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557815392386844.mp3",
      "https://ieltscat-oss.xdf.cn/1004/155781723902210.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583822797139117.mp3"
    ],
  },
  {
    title: "IELTS11",
    book: "listening",
    test_no: 1,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583822040737602.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557909460288590.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557804256670119.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583822171713700.mp3"
    ],
  },
  {
    title: "IELTS11",
    book: "listening",
    test_no: 2,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583822097950854.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557886662663901.mp3",
      "https://ieltscat-oss.xdf.cn/1004/155788815590775.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583822231376147.mp3"
    ],
  },
  {
    title: "IELTS11",
    book: "listening",
    test_no: 3,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583822270520906.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557886617401469.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557888051696991.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583822300928109.mp3"
    ],
  },
  {
    title: "IELTS11",
    book: "listening",
    test_no: 4,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/158382233626098.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557908726491667.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557910246581801.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583822375522556.mp3"
    ],
  },
  {
    title: "IELTS10",
    book: "listening",
    test_no: 1,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583821600412130.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557903497546228.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557905479954268.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583821629215682.mp3"
    ],
  },
  {
    title: "IELTS10",
    book: "listening",
    test_no: 2,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583821667595598.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1558062445638846.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1558063527457656.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583821698118353.mp3"
    ],
  },
  {
    title: "IELTS10",
    book: "listening",
    test_no: 3,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583826869069638.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557976435681156.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557978842635871.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583828009151818.mp3"
    ],
  },
  {
    title: "IELTS10",
    book: "listening",
    test_no: 4,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/158382187679668.mp3",
      "https://ieltscat-oss.xdf.cn/1004/155797758695085.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557999145831228.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583821945474693.mp3"
    ],
  },
  {
    title: "IELTS9",
    book: "listening",
    test_no: 1,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583821274286921.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557910656932751.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557911719210490.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583821317314674.mp3"
    ],
  },
  {
    title: "IELTS9",
    book: "listening",
    test_no: 2,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/158382135624062.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557996004892750.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1557996960149660.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583821394695511.mp3"
    ],
  },
  {
    title: "IELTS9",
    book: "listening",
    test_no: 3,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583821432792328.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1558079742769933.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1562727741117874.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583821473516502.mp3"
    ],
  },
  {
    title: "IELTS9",
    book: "listening",
    test_no: 4,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583821546496943.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1558060890258543.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1558062021199574.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583821515756588.mp3"
    ],
  },
  {
    title: "IELTS8",
    book: "listening",
    test_no: 1,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583820707577361.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1558074498067265.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1558077577672725.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583820741989567.mp3"
    ],
  },
  {
    title: "IELTS8",
    book: "listening",
    test_no: 2,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583820781215495.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1558158456550244.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1558159086593734.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583820841443279.mp3"
    ],
  },
  {
    title: "IELTS8",
    book: "listening",
    test_no: 3,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583821058728871.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1558085667107338.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1558078320074562.mp3",
      "https://ieltscat-oss.xdf.cn/1004/158382109998739.mp3"
    ],
  },
  {
    title: "IELTS8",
    book: "listening",
    test_no: 4,
    parts: [
      "https://ieltscat-oss.xdf.cn/1004/1583821162808351.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1558167965707309.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1558237786232625.mp3",
      "https://ieltscat-oss.xdf.cn/1004/1583821202401677.mp3"
    ],
  },
];

const CONFIG = {
  db: "ielts",
  remote: true,
  dryRun: false,
};

function sqlQuote(value) {
  if (value == null) {
    return "NULL";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function parseArgs(argv) {
  const options = { ...CONFIG };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--db") options.db = argv[++i] || options.db;
    else if (arg === "--remote") options.remote = true;
    else if (arg === "--local") options.remote = false;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/audiodata.mjs [--db ielts] [--remote|--local] [--dry-run]

Examples:
  node scripts/audiodata.mjs --dry-run
  node scripts/audiodata.mjs --local

Notes:
  1. DATA[*].parts[0..3] maps to paper_parts.part_no = 1..4.
  2. Matching is based on exam_papers.title + exam_papers.book + exam_papers.test_no.
  3. The script updates paper_parts.test for matched listening parts.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function buildSql(data) {
  const statements = ["PRAGMA foreign_keys = ON;"];
  let updateCount = 0;

  for (const item of data) {
    if (!Array.isArray(item.parts)) {
      continue;
    }

    for (let index = 0; index < item.parts.length; index += 1) {
      const testValue = item.parts[index];
      const partNo = index + 1;

      if (!testValue || !String(testValue).trim()) {
        continue;
      }

      statements.push(`UPDATE paper_parts
SET test = ${sqlQuote(testValue)}
WHERE id IN (
  SELECT pp.id
  FROM paper_parts pp
  JOIN exam_papers ep ON ep.id = pp.paper_id
  WHERE ep.title = ${sqlQuote(item.title)}
    AND ep.book = ${sqlQuote(item.book)}
    AND ep.test_no = ${Number(item.test_no)}
    AND pp.module = ${sqlQuote(item.book)}
    AND pp.part_no = ${partNo}
);`);
      updateCount += 1;
    }
  }

  return {
    sql: statements.join("\n\n"),
    updateCount,
  };
}

async function executeSql(sql, options) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ielts-audiodata-"));
  const filePath = path.join(tmpDir, "audiodata.sql");

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
  const { sql, updateCount } = buildSql(DATA);

  console.log(
    `Prepared ${updateCount} paper_parts.test updates on ${options.db} (${options.remote ? "remote" : "local"}).`,
  );

  if (updateCount === 0) {
    return;
  }

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
