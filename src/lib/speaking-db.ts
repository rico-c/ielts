import { getDatabase } from "@/lib/db";

type SpeakingQuestionRow = {
  id: number;
  part: number;
  topic: string;
  topic_id: string | null;
  question: string;
  requirement: string | null;
  audio_url?: string | null;
};

export type SpeakingTopicGroup = "part1" | "part23";

export type SpeakingPart1Topic = {
  group: "part1";
  topicId: string;
  topic: string;
  questions: string[];
};

export type SpeakingPart23Topic = {
  group: "part23";
  topicId: string;
  topic: string;
  part2Questions: string[];
  requirements: string[];
  part3Questions: string[];
};

export type SpeakingMockTopic = SpeakingPart1Topic | SpeakingPart23Topic;

export type SpeakingMockCatalog = {
  part1Topics: SpeakingPart1Topic[];
  part23Topics: SpeakingPart23Topic[];
};

export type SpeakingPart1Question = {
  id: number;
  topic: string;
  topicId: string;
  question: string;
  audioUrl: string | null;
};

export type SpeakingPart1MockDetail = {
  group: "part1";
  topic: string;
  topicId: string;
  questions: SpeakingPart1Question[];
};

export type SpeakingPart23Prompt = {
  id: number;
  topic: string;
  topicId: string;
  question: string;
  requirements: string[];
};

export type SpeakingPart3Question = {
  id: number;
  topic: string;
  topicId: string;
  question: string;
  audioUrl: string | null;
};

export type SpeakingPart23MockDetail = {
  group: "part23";
  topic: string;
  topicId: string;
  part2Prompt: SpeakingPart23Prompt;
  part3Questions: SpeakingPart3Question[];
};

function compareTopicText(left: string, right: string) {
  return left.localeCompare(right, "zh-CN");
}

function ensureTopicId(row: SpeakingQuestionRow) {
  const topicId = row.topic_id?.trim();
  return topicId && topicId.length > 0 ? topicId : `part-${row.part}:${row.topic}`;
}

function parseRequirementList(raw: string | null) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  } catch {
    const value = raw.trim();
    return value ? [value] : [];
  }
}

function pushUnique(target: string[], values: string[]) {
  for (const value of values) {
    if (!target.includes(value)) {
      target.push(value);
    }
  }
}

export async function getSpeakingMockCatalog(): Promise<SpeakingMockCatalog> {
  const db = await getDatabase();
  const { results } = await db
    .prepare(
      `
        SELECT id, part, topic, topic_id, question, requirement
        FROM speaking_questions
        ORDER BY
          CASE
            WHEN part = 1 THEN 1
            WHEN part = 2 THEN 2
            ELSE 3
          END ASC,
          topic ASC,
          id ASC
      `,
    )
    .all<SpeakingQuestionRow>();

  const part1Map = new Map<string, SpeakingPart1Topic>();
  const part23Map = new Map<string, SpeakingPart23Topic>();

  for (const row of results ?? []) {
    const topicId = ensureTopicId(row);

    if (row.part === 1) {
      const current = part1Map.get(topicId) ?? {
        group: "part1",
        topicId,
        topic: row.topic,
        questions: [],
      };

      if (!current.questions.includes(row.question)) {
        current.questions.push(row.question);
      }

      part1Map.set(topicId, current);
      continue;
    }

    const current = part23Map.get(topicId) ?? {
      group: "part23",
      topicId,
      topic: row.topic,
      part2Questions: [],
      requirements: [],
      part3Questions: [],
    };

    if (row.part === 2) {
      if (!current.part2Questions.includes(row.question)) {
        current.part2Questions.push(row.question);
      }
      pushUnique(current.requirements, parseRequirementList(row.requirement));
    }

    if (row.part === 3 && !current.part3Questions.includes(row.question)) {
      current.part3Questions.push(row.question);
    }

    part23Map.set(topicId, current);
  }

  return {
    part1Topics: [...part1Map.values()].sort((left, right) => compareTopicText(left.topic, right.topic)),
    part23Topics: [...part23Map.values()].sort((left, right) => compareTopicText(left.topic, right.topic)),
  };
}

export async function getSpeakingMockTopic(group: SpeakingTopicGroup, topicId: string) {
  const catalog = await getSpeakingMockCatalog();
  const topics = group === "part1" ? catalog.part1Topics : catalog.part23Topics;

  return topics.find((topic) => topic.topicId === topicId) ?? null;
}

export async function getSpeakingPart1MockDetail(topicId: string): Promise<SpeakingPart1MockDetail | null> {
  const topic = await getSpeakingMockTopic("part1", topicId);

  if (!topic) {
    return null;
  }

  const db = await getDatabase();
  const { results } = await db
    .prepare(
      `
        SELECT id, part, topic, topic_id, question, requirement, audio_url
        FROM speaking_questions
        WHERE part = 1
          AND (
            topic_id = ?1
            OR ((topic_id IS NULL OR TRIM(topic_id) = '') AND topic = ?2)
          )
        ORDER BY id ASC
      `,
    )
    .bind(topicId, topic.topic)
    .all<SpeakingQuestionRow>();

  const questions = (results ?? []).map((row) => ({
    id: row.id,
    topic: row.topic,
    topicId: ensureTopicId(row),
    question: row.question,
    audioUrl: typeof row.audio_url === "string" && row.audio_url.trim().length > 0 ? row.audio_url.trim() : null,
  }));

  if (questions.length === 0) {
    return null;
  }

  return {
    group: "part1",
    topic: topic.topic,
    topicId: topic.topicId,
    questions,
  };
}

export async function getSpeakingPart23MockDetail(topicId: string): Promise<SpeakingPart23MockDetail | null> {
  const topic = await getSpeakingMockTopic("part23", topicId);

  if (!topic) {
    return null;
  }

  const db = await getDatabase();
  const { results } = await db
    .prepare(
      `
        SELECT id, part, topic, topic_id, question, requirement, audio_url
        FROM speaking_questions
        WHERE part IN (2, 3)
          AND (
            topic_id = ?1
            OR ((topic_id IS NULL OR TRIM(topic_id) = '') AND topic = ?2)
          )
        ORDER BY
          CASE
            WHEN part = 2 THEN 1
            ELSE 2
          END ASC,
          id ASC
      `,
    )
    .bind(topicId, topic.topic)
    .all<SpeakingQuestionRow>();

  const part2Row = (results ?? []).find((row) => row.part === 2);

  if (!part2Row) {
    return null;
  }

  const part3Questions = (results ?? [])
    .filter((row) => row.part === 3)
    .map((row) => ({
      id: row.id,
      topic: row.topic,
      topicId: ensureTopicId(row),
      question: row.question,
      audioUrl: typeof row.audio_url === "string" && row.audio_url.trim().length > 0 ? row.audio_url.trim() : null,
    }));

  return {
    group: "part23",
    topic: topic.topic,
    topicId: topic.topicId,
    part2Prompt: {
      id: part2Row.id,
      topic: part2Row.topic,
      topicId: ensureTopicId(part2Row),
      question: part2Row.question,
      requirements: parseRequirementList(part2Row.requirement),
    },
    part3Questions,
  };
}
