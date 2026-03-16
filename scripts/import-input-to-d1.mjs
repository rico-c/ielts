#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const execFileAsync = promisify(execFile);

const TITLE = 'IELTS8';

// const BOOK = 'listening';
// const BOOK = 'reading';
const BOOK = 'writing';

// const TEST_NO = '1';
// const TEST_NO = '2';
// const TEST_NO = '3';
const TEST_NO = '4';

function parseArgs(argv) {
  const options = {
    input: "data/input.json",
    db: "ielts",
    remote: true,
    dryRun: false,
    paperId: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input") options.input = argv[++i] || options.input;
    else if (arg === "--db") options.db = argv[++i] || options.db;
    else if (arg === "--paper-id") options.paperId = argv[++i] || "";
    else if (arg === "--remote") options.remote = true;
    else if (arg === "--local") options.remote = false;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/import-input-to-d1.mjs [--input data/input.json] [--db ielts] [--remote|--local] [--paper-id <id>] [--dry-run]

Examples:
  node scripts/import-input-to-d1.mjs --input data/input.json --local
  node scripts/import-input-to-d1.mjs --input data/input.json --remote --paper-id cambridge-17-test-1-reading
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function sqlQuote(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlInt(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.trunc(n)) : "NULL";
}

function parseJsonSafely(text, filePath) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function inferModule(raw) {
  if (raw?.module) return String(raw.module).toLowerCase();
  const classify = String(raw?.classify || "");
  if (classify === "1") return "listening";
  if (classify === "2") return "reading";
  if (classify === "3") return "writing";
  return "reading";
}

function inferPartNo(raw, fallbackIndex) {
  if (typeof raw?.part_no === "number") return raw.part_no;
  const title = String(raw?.title || "");
  const match = title.match(/(\d+)/);
  if (match) return Number(match[1]);
  return fallbackIndex + 1;
}

function inferQuestionType(rawType, rawRealType, module) {
  const type = String(rawType || "");
  const realType = String(rawRealType || "");
  if (module === "writing") return "writing_task";
  if (type === "1") return "single_choice";
  if (type === "2") return "multiple_choice";
  if (type === "5") return "matching";
  if (type === "7") return module === "reading" ? "true_false_not_given" : "true_false";
  if (type === "9") return "matching_headings";
  if (type === "10") return "fill_blank";
  if (type === "11") return "matching_opinion";
  if (type === "26") return "map_labeling";
  if (realType === "11") return "fill_blank";
  if (realType === "9") return "single_choice";
  if (realType === "10") return "multiple_choice";

  // MANUAL
  if (type === "4") return "table_options";
  if (type === "14") return "fill_blank";
  if (type === "15") return "fill_blank";
  if (type === "17") return "fill_blank";
  if (type === "18") return "matching";
  if (type === "20") return "matching";
  if (type === "22") return "matching";
  if (type === "28") return "table_options";
  if (type === "29") return "matching_to_main";  // 选项拖拽到 题目中的空
  return "unknown";
}

function inferAnswerRule(...sources) {
  const joined = sources.map(stripHtml).filter(Boolean).join(" ");
  const patterns = [
    /ONE WORD AND\/OR A NUMBER/i,
    /ONE WORD ONLY/i,
    /NO MORE THAN TWO WORDS(?: AND\/OR A NUMBER)?/i,
    /NO MORE THAN THREE WORDS(?: AND\/OR A NUMBER)?/i,
    /TRUE\/FALSE\/NOT GIVEN/i,
    /YES\/NO\/NOT GIVEN/i,
    /Choose (?:ONE|TWO|THREE)/i,
  ];

  for (const pattern of patterns) {
    const match = joined.match(pattern);
    if (match) return match[0];
  }

  return "";
}

function deriveOptionParts(title, index) {
  const text = String(title || "").trim();
  const match = text.match(/^((?:[A-Z])|(?:[ivxlcdm]+)|TRUE|FALSE|NOT GIVEN|YES|NO)(?:[.)]\s*|\s+)(.+)$/);
  if (!match) {
    return {
      optionKey: "",
      optionText: text,
    };
  }

  const [, optionKey, remainder] = match;
  return {
    optionKey,
    optionText: remainder.trim() || optionKey,
  };
}

function buildAnswerFields(optionNames) {
  const raw = String(optionNames || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  if (raw.length === 0) {
    return { answerText: null, answerJson: null };
  }

  if (raw.length === 1) {
    return { answerText: raw[0], answerJson: null };
  }

  return { answerText: null, answerJson: JSON.stringify(raw) };
}

function getQuestionRange(questions) {
  const numbers = questions
    .map((item) => Number(item?.sort))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (numbers.length === 0) {
    return { start: null, end: null };
  }

  return { start: numbers[0], end: numbers[numbers.length - 1] };
}

function getSharedOptions(options) {
  if (!Array.isArray(options) || options.length === 0) return null;
  return JSON.stringify(
    options.map((option, index) => {
      const { optionKey, optionText } = deriveOptionParts(option?.title || "", index);
      return {
        id: String(option?.id || ""),
        label: optionKey,
        text: optionText,
        sortOrder: index,
      };
    })
  );
}

function getRawParts(input) {
  if (Array.isArray(input?.parts)) return input.parts;
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") {
    return Object.entries(input)
      .filter(([key, value]) => key !== "p_id" && value && typeof value === "object")
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, value]) => value);
  }
  return [];
}

function normalizeInput(input, forcedPaperId) {
  const paper = input?.paper && typeof input.paper === "object" ? input.paper : {};
  const rawParts = getRawParts(input);
  if (rawParts.length === 0) {
    throw new Error("No importable parts found in input JSON.");
  }

  const paperId = forcedPaperId || crypto.randomUUID();

  const examPaper = {
    id: paperId,
    source_paper_id: paperId,
    title: TITLE,
    book: BOOK || null,
    test_no: TEST_NO,
    year: paper.year ?? null,
    version: paper.version || null,
  };

  const normalized = {
    examPaper,
    parts: [],
    groups: [],
    questions: [],
    options: [],
  };

  let globalGroupOrder = 0;

  rawParts.forEach((rawPart, partIndex) => {
    const module = inferModule(rawPart);
    const partId = crypto.randomUUID();
    const partNo = inferPartNo(rawPart, partIndex);
    const partRecord = {
      id: partId,
      paper_id: paperId,
      module,
      part_no: partNo,
      title: String(rawPart?.title || `${module} ${partNo}`),
      instruction_html: rawPart?.desc || null,
      content_html: rawPart?.content || null,
      audio_url: rawPart?.audio || null,
      sort_order: partIndex,
      meta_json: JSON.stringify({
        raw_id: rawPart?.id || null,
        classify: rawPart?.classify || null,
        source_paper_id: paperId,
      }),
    };
    normalized.parts.push(partRecord);

    if (Array.isArray(rawPart?.groups)) {
      rawPart.groups.forEach((rawGroup, groupIndex) => {
        const groupId = crypto.randomUUID();
        const range = getQuestionRange(rawGroup?.questions || []);
        normalized.groups.push({
          id: groupId,
          part_id: partId,
          group_no: globalGroupOrder++,
          title: rawGroup?.title || null,
          instruction_html: rawGroup?.instruction_html || null,
          content_html: rawGroup?.content_html || null,
          question_type: String(rawGroup?.question_type || "unknown"),
          answer_rule: rawGroup?.answer_rule || null,
          question_range_start: range.start,
          question_range_end: range.end,
          shared_options_json: Array.isArray(rawGroup?.shared_options) ? JSON.stringify(rawGroup.shared_options) : null,
          meta_json: JSON.stringify({ source: "normalized_input", groupIndex }),
        });

        (rawGroup?.questions || []).forEach((rawQuestion, questionIndex) => {
          const questionId = crypto.randomUUID();
          const answer =
            rawQuestion?.answer_json != null
              ? { answerText: null, answerJson: JSON.stringify(rawQuestion.answer_json) }
              : buildAnswerFields(rawQuestion?.answer_text);

          normalized.questions.push({
            id: questionId,
            group_id: groupId,
            question_no: Number(rawQuestion?.question_no || questionIndex + 1),
            stem: String(rawQuestion?.stem || rawQuestion?.title || ""),
            sub_label: rawQuestion?.sub_label || null,
            answer_text: answer.answerText,
            answer_json: answer.answerJson,
            explanation_html: rawQuestion?.explanation_html || null,
            sort_order: questionIndex,
            meta_json: JSON.stringify({ source: "normalized_input" }),
          });

          (rawQuestion?.options || []).forEach((option, optionIndex) => {
            normalized.options.push({
              id: crypto.randomUUID(),
              question_id: questionId,
              option_key: option?.option_key || null,
              option_text: String(option?.option_text || option?.text || ""),
              is_correct:
                typeof option?.is_correct === "boolean" ? (option.is_correct ? 1 : 0) : option?.is_correct ?? null,
              sort_order: optionIndex,
            });
          });
        });
      });

      return;
    }

    const pages = Array.isArray(rawPart?.pages) ? rawPart.pages : [];
    if (pages.length === 0 && module === "writing") {
      normalized.groups.push({
        id: crypto.randomUUID(),
        part_id: partId,
        group_no: globalGroupOrder++,
        title: partRecord.title,
        instruction_html: rawPart?.desc || null,
        content_html: rawPart?.content || null,
        question_type: "writing_task",
        answer_rule: "",
        question_range_start: null,
        question_range_end: null,
        shared_options_json: null,
        meta_json: JSON.stringify({ source: "raw_part", page_id: null, section_id: null }),
      });
      return;
    }

    pages.forEach((page, pageIndex) => {
      const sections = Array.isArray(page?.sections) && page.sections.length > 0 ? page.sections : [null];
      sections.forEach((section, sectionIndex) => {
        const questions = Array.isArray(section?.questions) ? section.questions : [];
        const options = Array.isArray(section?.options) ? section.options : [];
        const range = getQuestionRange(questions);
        const groupId = crypto.randomUUID();
        const questionType = inferQuestionType(section?.type || page?.type, section?.real_type || page?.real_type, module);

        normalized.groups.push({
          id: groupId,
          part_id: partId,
          group_no: globalGroupOrder++,
          title: section?.title || page?.title || null,
          instruction_html: section?.desc || page?.desc || null,
          content_html: page?.content || null,
          question_type: questionType,
          answer_rule: inferAnswerRule(page?.desc, section?.desc, page?.content),
          question_range_start: range.start,
          question_range_end: range.end,
          shared_options_json: getSharedOptions(options),
          meta_json: JSON.stringify({
            source: "raw_part",
            raw_page_id: `${partIndex}:${pageIndex}`,
            raw_section_id: section?.id || null,
            raw_page_type: page?.type || null,
            raw_real_type: page?.real_type || null,
            image_url: section?.res || page?.res || null,
            image_info: Array.isArray(section?.res_info)
              ? section.res_info
              : Array.isArray(page?.res_info)
                ? page.res_info
                : [],
          }),
        });

        if (questions.length === 0 && module === "writing") {
          return;
        }

        questions.forEach((question, questionIndex) => {
          const questionId = crypto.randomUUID();
          const answer = buildAnswerFields(question?.option_names);
          normalized.questions.push({
            id: questionId,
            group_id: groupId,
            question_no: Number(question?.sort || questionIndex + 1),
            stem: String(question?.title || ""),
            sub_label: question?.desc || null,
            answer_text: answer.answerText,
            answer_json: answer.answerJson,
            explanation_html: null,
            sort_order: questionIndex,
            meta_json: JSON.stringify({
              raw_question_id: question?.id || null,
              raw_option_ids: question?.option_ids || null,
              first_question: Boolean(question?.first_question),
            }),
          });
        });
      });
    });
  });

  return normalized;
}

function buildSql(payload) {
  const lines = ["PRAGMA foreign_keys = ON;"];

  lines.push(`DELETE FROM exam_papers WHERE id = ${sqlQuote(payload.examPaper.id)};`);

  lines.push(`INSERT INTO exam_papers (
  id, source_paper_id, title, book, test_no, year, version
) VALUES (
  ${sqlQuote(payload.examPaper.id)},
  ${sqlQuote(payload.examPaper.source_paper_id)},
  ${sqlQuote(payload.examPaper.title)},
  ${sqlQuote(payload.examPaper.book)},
  ${sqlInt(payload.examPaper.test_no)},
  ${sqlInt(payload.examPaper.year)},
  ${sqlQuote(payload.examPaper.version)}
);`);

  for (const part of payload.parts) {
    lines.push(`INSERT INTO paper_parts (
  id, paper_id, module, part_no, title, instruction_html, content_html, audio_url, sort_order, meta_json
) VALUES (
  ${sqlQuote(part.id)},
  ${sqlQuote(part.paper_id)},
  ${sqlQuote(part.module)},
  ${sqlInt(part.part_no)},
  ${sqlQuote(part.title)},
  ${sqlQuote(part.instruction_html)},
  ${sqlQuote(part.content_html)},
  ${sqlQuote(part.audio_url)},
  ${sqlInt(part.sort_order)},
  ${sqlQuote(part.meta_json)}
);`);
  }

  for (const group of payload.groups) {
    lines.push(`INSERT INTO question_groups (
  id, part_id, group_no, title, instruction_html, content_html, question_type, answer_rule,
  question_range_start, question_range_end, shared_options_json, meta_json
) VALUES (
  ${sqlQuote(group.id)},
  ${sqlQuote(group.part_id)},
  ${sqlInt(group.group_no)},
  ${sqlQuote(group.title)},
  ${sqlQuote(group.instruction_html)},
  ${sqlQuote(group.content_html)},
  ${sqlQuote(group.question_type)},
  ${sqlQuote(group.answer_rule)},
  ${sqlInt(group.question_range_start)},
  ${sqlInt(group.question_range_end)},
  ${sqlQuote(group.shared_options_json)},
  ${sqlQuote(group.meta_json)}
);`);
  }

  for (const question of payload.questions) {
    lines.push(`INSERT INTO questions (
  id, group_id, question_no, stem, sub_label, answer_text, answer_json, explanation_html, sort_order, meta_json
) VALUES (
  ${sqlQuote(question.id)},
  ${sqlQuote(question.group_id)},
  ${sqlInt(question.question_no)},
  ${sqlQuote(question.stem)},
  ${sqlQuote(question.sub_label)},
  ${sqlQuote(question.answer_text)},
  ${sqlQuote(question.answer_json)},
  ${sqlQuote(question.explanation_html)},
  ${sqlInt(question.sort_order)},
  ${sqlQuote(question.meta_json)}
);`);
  }

  for (const option of payload.options) {
    lines.push(`INSERT INTO question_options (
  id, question_id, option_key, option_text, is_correct, sort_order
) VALUES (
  ${sqlQuote(option.id)},
  ${sqlQuote(option.question_id)},
  ${sqlQuote(option.option_key)},
  ${sqlQuote(option.option_text)},
  ${sqlInt(option.is_correct)},
  ${sqlInt(option.sort_order)}
);`);
  }

  return lines.join("\n\n");
}

async function executeSql(sql, options) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ielts-import-"));
  const filePath = path.join(tmpDir, "import.sql");

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
  const inputPath = path.resolve(process.cwd(), options.input);
  const content = await readFile(inputPath, "utf8");
  if (!content.trim()) {
    throw new Error(`Input file is empty: ${inputPath}`);
  }

  const input = parseJsonSafely(content, inputPath);
  const normalized = normalizeInput(input, options.paperId);
  const sql = buildSql(normalized);

  console.log(
    `Prepared import for paper ${normalized.examPaper.id}: ` +
      `${normalized.parts.length} parts, ${normalized.groups.length} groups, ` +
      `${normalized.questions.length} questions, ${normalized.options.length} options.`
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
