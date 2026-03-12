import {
  getCloudflareContext,
  initOpenNextCloudflareForDev,
} from "@opennextjs/cloudflare";
import type {
  IeltsPart,
  IeltsPassage,
  IeltsQuestion,
  IeltsQuestionGroup,
  IeltsQuestionOption,
  IeltsTable,
  IeltsTableCell,
  IeltsTestData,
  QuestionType,
} from "@/types/ielts";

interface TestRow {
  id: number;
  source_url: string;
  source_page_id: number | null;
  title: string;
  scraped_at: string | null;
  series: string | null;
  book_no: number | null;
  test_no: number | null;
  module: string | null;
  test_code: string | null;
}

interface PartRow {
  part_title: string;
  sort_order: number;
}

interface QuestionRow {
  question_no: number;
  question_type: QuestionType;
  question_subtype: string | null;
  group_ref: string | null;
  passage_no: number | null;
  subtitle: string | null;
  instruction: string | null;
  prompt: string | null;
  image_urls_json: string | null;
  answer: string | null;
  table_ref: string | null;
  question_meta_json: string | null;
  part_title: string | null;
}

interface OptionRow {
  question_no: number;
  option_label: string;
  option_text: string;
  sort_order: number;
}

interface TableRow {
  table_ref: string;
  part_title: string | null;
  question_numbers_json: string;
  text_content: string | null;
  raw_html: string | null;
  sort_order: number;
}

interface CellRow {
  table_ref: string;
  row_index: number;
  col_index: number;
  tag: string;
  text_content: string | null;
  cell_html: string | null;
  colspan: number;
  rowspan: number;
}

interface PassageRow {
  passage_no: number;
  part_title: string | null;
  title: string | null;
  text_content: string | null;
  raw_html: string | null;
  sort_order: number;
}

interface GroupRow {
  group_ref: string;
  part_title: string | null;
  passage_no: number | null;
  heading: string | null;
  instruction: string | null;
  question_type: QuestionType;
  question_subtype: string | null;
  question_from: number | null;
  question_to: number | null;
  shared_prompt: string | null;
  option_set_json: string | null;
  sort_order: number;
}

interface FilterInput {
  series?: string;
  bookNo?: number;
  testNo?: number;
  module?: string;
}

function parseJsonArray(value: string): number[] {
  try {
    const data = JSON.parse(value);
    return Array.isArray(data) ? data.filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

function parseJsonStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const data = JSON.parse(value);
    return Array.isArray(data) ? data.filter((s) => typeof s === "string" && s.length > 0) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const data = JSON.parse(value);
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function parseOptionSetJson(value: string | null): IeltsQuestionOption[] {
  if (!value) return [];
  try {
    const data = JSON.parse(value);
    if (!Array.isArray(data)) return [];
    return data
      .map((item, index) => {
        if (!item || typeof item !== "object") return null;
        const raw = item as { label?: unknown; text?: unknown; sortOrder?: unknown };
        if (typeof raw.label !== "string" || typeof raw.text !== "string") return null;
        return {
          label: raw.label,
          text: raw.text,
          sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : index,
        };
      })
      .filter(Boolean) as IeltsQuestionOption[];
  } catch {
    return [];
  }
}

function groupTableRows(cells: IeltsTableCell[]): IeltsTableCell[][] {
  const rows = new Map<number, IeltsTableCell[]>();
  for (const cell of cells) {
    if (!rows.has(cell.rowIndex)) rows.set(cell.rowIndex, []);
    rows.get(cell.rowIndex)?.push(cell);
  }

  return [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, rowCells]) => rowCells.sort((a, b) => a.colIndex - b.colIndex));
}

export function getDbOrThrow(): D1Database {
  // Fallback init for local dev in case Next config init hook is not picked up.
  initOpenNextCloudflareForDev();
  const { env } = getCloudflareContext();
  const db = (env as { DB?: D1Database } | undefined)?.DB;
  if (!db) {
    throw new Error("Cloudflare D1 binding \"DB\" is not available in current runtime.");
  }
  return db;
}

export async function getLatestIeltsTestData(
  db: D1Database,
  filters: FilterInput = {}
): Promise<IeltsTestData | null> {
  const conditions: string[] = [];
  const bindValues: Array<string | number> = [];

  if (filters.series) {
    conditions.push("series = ?");
    bindValues.push(filters.series);
  }
  if (typeof filters.bookNo === "number") {
    conditions.push("book_no = ?");
    bindValues.push(filters.bookNo);
  }
  if (typeof filters.testNo === "number") {
    conditions.push("test_no = ?");
    bindValues.push(filters.testNo);
  }
  if (filters.module) {
    conditions.push("module = ?");
    bindValues.push(filters.module);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const testResult = await db
    .prepare(
      `SELECT id, source_url, source_page_id, title, scraped_at, series, book_no, test_no, module, test_code
       FROM ielts_tests
       ${whereClause}
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`
    )
    .bind(...bindValues)
    .all<TestRow>();

  const test = testResult.results[0];
  if (!test) return null;

  const testId = test.id;

  const [audioResult, partsResult, optionsResult, tablesResult, cellsResult] = await Promise.all([
    db
      .prepare("SELECT url FROM ielts_test_audio_urls WHERE test_id = ? ORDER BY sort_order ASC, id ASC")
      .bind(testId)
      .all<{ url: string }>(),
    db
      .prepare("SELECT part_title, sort_order FROM ielts_test_parts WHERE test_id = ? ORDER BY sort_order ASC, id ASC")
      .bind(testId)
      .all<PartRow>(),
    db
      .prepare(
        `SELECT q.question_no, o.option_label, o.option_text, o.sort_order
         FROM ielts_question_options o
         JOIN ielts_questions q ON o.question_id = q.id
         WHERE q.test_id = ?
         ORDER BY q.question_no ASC, o.sort_order ASC, o.id ASC`
      )
      .bind(testId)
      .all<OptionRow>(),
    db
      .prepare(
        `SELECT t.table_ref, p.part_title, t.question_numbers_json, t.text_content, t.raw_html, t.sort_order
         FROM ielts_tables t
         LEFT JOIN ielts_test_parts p ON t.part_id = p.id
         WHERE t.test_id = ?
         ORDER BY t.sort_order ASC, t.id ASC`
      )
      .bind(testId)
      .all<TableRow>(),
    db
      .prepare(
        `SELECT t.table_ref, c.row_index, c.col_index, c.tag, c.text_content, c.cell_html, c.colspan, c.rowspan
         FROM ielts_table_cells c
         JOIN ielts_tables t ON c.table_id = t.id
         WHERE t.test_id = ?
         ORDER BY t.sort_order ASC, c.row_index ASC, c.col_index ASC`
      )
      .bind(testId)
      .all<CellRow>(),
  ]);

  let questionsResult: { results: QuestionRow[] } = { results: [] };
  try {
    questionsResult = await db
      .prepare(
        `SELECT q.question_no, q.question_type, q.question_subtype, q.group_ref, q.passage_no,
                q.subtitle, q.instruction, q.prompt, q.image_urls_json, q.answer, q.table_ref, q.question_meta_json,
                p.part_title
         FROM ielts_questions q
         LEFT JOIN ielts_test_parts p ON q.part_id = p.id
         WHERE q.test_id = ?
         ORDER BY q.question_no ASC`
      )
      .bind(testId)
      .all<QuestionRow>();
  } catch {
    const legacyQuestions = await db
      .prepare(
        `SELECT q.question_no, q.question_type, q.subtitle, q.instruction, q.prompt, q.image_urls_json, q.answer, q.table_ref, p.part_title
         FROM ielts_questions q
         LEFT JOIN ielts_test_parts p ON q.part_id = p.id
         WHERE q.test_id = ?
         ORDER BY q.question_no ASC`
      )
      .bind(testId)
      .all<{
        question_no: number;
        question_type: QuestionType;
        subtitle: string | null;
        instruction: string | null;
        prompt: string | null;
        image_urls_json: string | null;
        answer: string | null;
        table_ref: string | null;
        part_title: string | null;
      }>();

    questionsResult = {
      results: legacyQuestions.results.map((row) => ({
        question_no: row.question_no,
        question_type: row.question_type,
        question_subtype: "",
        group_ref: null,
        passage_no: null,
        subtitle: row.subtitle,
        instruction: row.instruction,
        prompt: row.prompt,
        image_urls_json: row.image_urls_json,
        answer: row.answer,
        table_ref: row.table_ref,
        question_meta_json: "{}",
        part_title: row.part_title,
      })),
    };
  }

  let passagesResult: { results: PassageRow[] } = { results: [] };
  let groupsResult: { results: GroupRow[] } = { results: [] };

  try {
    passagesResult = await db
      .prepare(
        `SELECT ps.passage_no, p.part_title, ps.title, ps.text_content, ps.raw_html, ps.sort_order
         FROM ielts_passages ps
         LEFT JOIN ielts_test_parts p ON ps.part_id = p.id
         WHERE ps.test_id = ?
         ORDER BY ps.sort_order ASC, ps.id ASC`
      )
      .bind(testId)
      .all<PassageRow>();
  } catch {
    passagesResult = { results: [] };
  }

  try {
    groupsResult = await db
      .prepare(
        `SELECT g.group_ref, p.part_title, g.passage_no, g.heading, g.instruction, g.question_type,
                g.question_subtype, g.question_from, g.question_to, g.shared_prompt, g.option_set_json, g.sort_order
         FROM ielts_question_groups g
         LEFT JOIN ielts_test_parts p ON g.part_id = p.id
         WHERE g.test_id = ?
         ORDER BY g.sort_order ASC, g.id ASC`
      )
      .bind(testId)
      .all<GroupRow>();
  } catch {
    groupsResult = { results: [] };
  }

  const optionMap = new Map<number, IeltsQuestionOption[]>();
  for (const row of optionsResult.results) {
    if (!optionMap.has(row.question_no)) optionMap.set(row.question_no, []);
    optionMap.get(row.question_no)?.push({
      label: row.option_label,
      text: row.option_text,
      sortOrder: row.sort_order,
    });
  }

  const questions: IeltsQuestion[] = questionsResult.results.map((row) => ({
    number: row.question_no,
    type: row.question_type,
    questionSubtype: row.question_subtype ?? "",
    part: row.part_title ?? "",
    passageNo: row.passage_no,
    groupRef: row.group_ref,
    subtitle: row.subtitle ?? "",
    instruction: row.instruction ?? "",
    prompt: row.prompt ?? "",
    imageUrls: parseJsonStringArray(row.image_urls_json),
    answer: row.answer ?? "",
    tableRef: row.table_ref,
    questionMeta: parseJsonObject(row.question_meta_json),
    options: optionMap.get(row.question_no) ?? [],
  }));

  const cellsByTable = new Map<string, IeltsTableCell[]>();
  for (const row of cellsResult.results) {
    if (!cellsByTable.has(row.table_ref)) cellsByTable.set(row.table_ref, []);
    cellsByTable.get(row.table_ref)?.push({
      rowIndex: row.row_index,
      colIndex: row.col_index,
      tag: row.tag,
      text: row.text_content ?? "",
      html: row.cell_html ?? "",
      colspan: row.colspan,
      rowspan: row.rowspan,
    });
  }

  const tables: IeltsTable[] = tablesResult.results.map((row) => ({
    id: row.table_ref,
    part: row.part_title ?? "",
    questionNumbers: parseJsonArray(row.question_numbers_json),
    text: row.text_content ?? "",
    rawHtml: row.raw_html ?? "",
    rows: groupTableRows(cellsByTable.get(row.table_ref) ?? []),
  }));

  const passages: IeltsPassage[] = passagesResult.results.map((row) => ({
    id: `passage_${row.passage_no}`,
    passageNo: row.passage_no,
    part: row.part_title ?? "",
    title: row.title ?? "",
    text: row.text_content ?? "",
    rawHtml: row.raw_html ?? "",
    sortOrder: row.sort_order,
  }));

  const groups: IeltsQuestionGroup[] = groupsResult.results.map((row) => ({
    id: row.group_ref,
    part: row.part_title ?? "",
    passageNo: row.passage_no,
    heading: row.heading ?? "",
    instruction: row.instruction ?? "",
    questionType: row.question_type,
    questionSubtype: row.question_subtype ?? "",
    questionFrom: row.question_from,
    questionTo: row.question_to,
    sharedPrompt: row.shared_prompt ?? "",
    options: parseOptionSetJson(row.option_set_json),
    sortOrder: row.sort_order,
  }));

  const parts: IeltsPart[] = partsResult.results.map((row) => ({
    part: row.part_title,
    questions: questions.filter((q) => q.part === row.part_title).map((q) => q.number),
    tables: tables.filter((t) => t.part === row.part_title).map((t) => t.id),
  }));

  return {
    id: test.id,
    sourceUrl: test.source_url,
    sourcePageId: test.source_page_id,
    title: test.title,
    scrapedAt: test.scraped_at,
    series: test.series ?? "",
    bookNo: test.book_no,
    testNo: test.test_no,
    module: test.module ?? "",
    testCode: test.test_code ?? "",
    audioUrls: audioResult.results.map((r) => r.url),
    parts,
    questions,
    tables,
    passages,
    groups,
  };
}
