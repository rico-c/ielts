import { getCloudflareContext } from "@opennextjs/cloudflare";

export type ListeningSharedOption = {
  id: string;
  label: string;
  text: string;
  sortOrder: number;
};

export type ListeningQuestion = {
  id: string;
  questionNo: number;
  stem: string;
  subLabel: string | null;
  answerText: string | null;
  answerJson: string | null;
  sortOrder: number;
};

export type ListeningQuestionGroup = {
  id: string;
  groupNo: number;
  title: string | null;
  instructionHtml: string | null;
  contentHtml: string | null;
  imageUrl: string | null;
  explain: string | null;
  questionType: string;
  answerRule: string | null;
  questionRangeStart: number | null;
  questionRangeEnd: number | null;
  sharedOptions: ListeningSharedOption[];
  questions: ListeningQuestion[];
};

export type ListeningPart = {
  id: string;
  partNo: number;
  title: string;
  instructionHtml: string | null;
  contentHtml: string | null;
  audioUrl: string | null;
  transcript: string | null;
  sortOrder: number;
  groups: ListeningQuestionGroup[];
};

export type ListeningPracticePaper = {
  id: string;
  title: string;
  book: string | null;
  testNo: number | null;
  module: "listening" | "reading" | "writing";
  parts: ListeningPart[];
};

type PaperRow = {
  id: string;
  title: string;
  book: string | null;
  test_no: number | null;
};

type PartRow = {
  id: string;
  part_no: number;
  title: string;
  instruction_html: string | null;
  content_html: string | null;
  audio_url: string | null;
  transcript: string | null;
  sort_order: number;
};

type GroupRow = {
  id: string;
  part_id: string;
  group_no: number;
  title: string | null;
  instruction_html: string | null;
  content_html: string | null;
  explain: string | null;
  meta_json: string | null;
  question_type: string;
  answer_rule: string | null;
  question_range_start: number | null;
  question_range_end: number | null;
  shared_options_json: string | null;
};

type QuestionRow = {
  id: string;
  group_id: string;
  question_no: number;
  stem: string;
  sub_label: string | null;
  answer_text: string | null;
  answer_json: string | null;
  sort_order: number;
};

function getPaperTitle(bookNo: number) {
  return `IELTS${bookNo}`;
}

async function getDb() {
  const { env } = await getCloudflareContext({ async: true });

  if (!env.DB) {
    throw new Error("Cloudflare D1 binding DB is not configured.");
  }

  return env.DB;
}

function isSequentialAlpha(labels: string[]) {
  return labels.every((label, index) => label === String.fromCharCode(65 + index));
}

function isSequentialRoman(labels: string[]) {
  const roman = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
  return labels.every((label, index) => label.toLowerCase() === roman[index]);
}

function isBooleanOptionSet(labels: string[]) {
  const normalized = new Set(labels.map((label) => label.toUpperCase()));
  const allowed = ["TRUE", "FALSE", "NOT GIVEN", "YES", "NO"];
  return labels.length > 0 && labels.every((label) => allowed.includes(label.toUpperCase())) && normalized.size >= 2;
}

function shouldRepairBrokenFillBlankOptions(options: ListeningSharedOption[], questionType: string) {
  if (questionType !== "fill_blank" || options.length === 0) {
    return false;
  }

  const labels = options.map((option) => option.label.trim()).filter(Boolean);
  if (labels.length !== options.length) {
    return false;
  }

  if (isSequentialAlpha(labels) || isSequentialRoman(labels) || isBooleanOptionSet(labels)) {
    return false;
  }

  return options.every((option) => option.text.trim().length > 0);
}

function parseSharedOptions(raw: string | null, questionType: string): ListeningSharedOption[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const options = parsed
      .map((item, index) => ({
        id: typeof item?.id === "string" ? item.id : String(item?.id ?? `${index}`),
        label: typeof item?.label === "string" ? item.label : String(item?.label ?? index + 1),
        text: typeof item?.text === "string" ? item.text : "",
        sortOrder: typeof item?.sortOrder === "number" ? item.sortOrder : index,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    if (shouldRepairBrokenFillBlankOptions(options, questionType)) {
      return options.map((option) => ({
        ...option,
        label: "",
        text: `${option.label}${option.text}`.trim(),
      }));
    }

    return options;
  } catch {
    return [];
  }
}

function parseGroupImageUrl(raw: string | null) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.image_url === "string" && parsed.image_url.trim() ? parsed.image_url.trim() : null;
  } catch {
    return null;
  }
}

export async function getAvailableTestNos(bookNo: number, module: "listening" | "reading" | "writing") {
  const db = await getDb();
  const title = getPaperTitle(bookNo);

  const { results } = await db
    .prepare(
      `
        SELECT DISTINCT test_no
        FROM exam_papers
        WHERE title = ?1
          AND book = ?2
          AND test_no IS NOT NULL
        ORDER BY test_no ASC
      `,
    )
    .bind(title, module)
    .all<{ test_no: number | null }>();

  return (results ?? [])
    .map((row: { test_no: number | null }) => row.test_no)
    .filter((value: number | null): value is number => typeof value === "number" && Number.isFinite(value));
}

export async function getPracticePaper(bookNo: number, testNo: number, module: "listening" | "reading" | "writing") {
  const db = await getDb();
  const title = getPaperTitle(bookNo);

  const paper = await db
    .prepare(
      `
        SELECT id, title, book, test_no
        FROM exam_papers
        WHERE title = ?1
          AND book = ?2
          AND test_no = ?3
        LIMIT 1
      `,
    )
    .bind(title, module, testNo)
    .first<PaperRow>();

  if (!paper) {
    return null;
  }

  const [partsResult, groupsResult, questionsResult] = await Promise.all([
    db
      .prepare(
        `
          SELECT id, part_no, title, instruction_html, content_html, audio_url, transcript, sort_order
          FROM paper_parts
          WHERE paper_id = ?1
            AND module = ?2
          ORDER BY sort_order ASC, part_no ASC
        `,
      )
      .bind(paper.id, module)
      .all<PartRow>(),
    db
      .prepare(
        `
          SELECT qg.id, qg.part_id, qg.group_no, qg.title, qg.instruction_html, qg.content_html,
                 qg.explain,
                 qg.meta_json,
                 qg.question_type, qg.answer_rule, qg.question_range_start, qg.question_range_end,
                 qg.shared_options_json
          FROM question_groups qg
          JOIN paper_parts pp ON pp.id = qg.part_id
          WHERE pp.paper_id = ?1
            AND pp.module = ?2
          ORDER BY pp.sort_order ASC, qg.group_no ASC
        `,
      )
      .bind(paper.id, module)
      .all<GroupRow>(),
    db
      .prepare(
        `
          SELECT q.id, q.group_id, q.question_no, q.stem, q.sub_label, q.answer_text, q.answer_json, q.sort_order
          FROM questions q
          JOIN question_groups qg ON qg.id = q.group_id
          JOIN paper_parts pp ON pp.id = qg.part_id
          WHERE pp.paper_id = ?1
            AND pp.module = ?2
          ORDER BY q.question_no ASC, q.sort_order ASC
        `,
      )
      .bind(paper.id, module)
      .all<QuestionRow>(),
  ]);

  const questionsByGroup = new Map<string, ListeningQuestion[]>();
  for (const row of questionsResult.results ?? []) {
    const nextQuestion: ListeningQuestion = {
      id: row.id,
      questionNo: row.question_no,
      stem: row.stem,
      subLabel: row.sub_label,
      answerText: row.answer_text,
      answerJson: row.answer_json,
      sortOrder: row.sort_order,
    };

    const current = questionsByGroup.get(row.group_id) ?? [];
    current.push(nextQuestion);
    questionsByGroup.set(row.group_id, current);
  }

  const groupsByPart = new Map<string, ListeningQuestionGroup[]>();
  for (const row of groupsResult.results ?? []) {
    const nextGroup: ListeningQuestionGroup = {
      id: row.id,
      groupNo: row.group_no,
      title: row.title,
      instructionHtml: row.instruction_html,
      contentHtml: row.content_html,
      imageUrl: parseGroupImageUrl(row.meta_json),
      explain: row.explain,
      questionType: row.question_type,
      answerRule: row.answer_rule,
      questionRangeStart: row.question_range_start,
      questionRangeEnd: row.question_range_end,
      sharedOptions: parseSharedOptions(row.shared_options_json, row.question_type),
      questions: (questionsByGroup.get(row.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    };

    const current = groupsByPart.get(row.part_id) ?? [];
    current.push(nextGroup);
    groupsByPart.set(row.part_id, current);
  }

  const parts: ListeningPart[] = (partsResult.results ?? []).map((row: PartRow) => ({
    id: row.id,
    partNo: row.part_no,
    title: row.title,
    instructionHtml: row.instruction_html,
    contentHtml: row.content_html,
    audioUrl: row.audio_url,
    transcript: row.transcript,
    sortOrder: row.sort_order,
    groups: (groupsByPart.get(row.id) ?? []).sort((a, b) => a.groupNo - b.groupNo),
  }));

  return {
    id: paper.id,
    title: paper.title,
    book: paper.book,
    testNo: paper.test_no,
    module,
    parts,
  } satisfies ListeningPracticePaper;
}
