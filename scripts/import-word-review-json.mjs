#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const options = {
    input: "data/word-review.json",
    db: "ielts",
    format: "json",
    deckCode: "",
    dumpJson: false,
    remote: true,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") options.input = argv[++index] || options.input;
    else if (arg === "--db") options.db = argv[++index] || options.db;
    else if (arg === "--format") options.format = argv[++index] || options.format;
    else if (arg === "--deck-code") options.deckCode = argv[++index] || options.deckCode;
    else if (arg === "--dump-json") options.dumpJson = true;
    else if (arg === "--remote") options.remote = true;
    else if (arg === "--local") options.remote = false;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/import-word-review-json.mjs [--input data/word-review.json] [--format json|text] [--deck-code ielts_core_6] [--db ielts] [--remote|--local] [--dry-run] [--dump-json]

JSON format:
{
  "decks": [
    {
      "code": "ielts_core_6",
      "words": [
        {
          "word": "abandon",
          "phonetic": "əˈbændən",
          "partOfSpeech": "v.",
          "definition": "to leave something completely",
          "translation": "放弃；遗弃",
          "exampleSentence": "Many farmers had to abandon the land.",
          "level": "intermediate",
          "source": "cambridge-ielts-core",
          "frequencyScore": 98.6
        }
      ]
    }
  ]
}

Text format:
location  /ləuˈkeɪʃn/  n. 位置，场所；（电影的）外景拍摄地
breakdown /ˈbreɪkdaun/ n. 垮台，倒塌，破裂；（健康、精神等）衰竭，衰弱
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

function normalizeWord(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^\w' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDecks(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.decks)) {
    throw new Error("Input JSON must contain a top-level `decks` array.");
  }

  return raw.decks.map((deck, deckIndex) => {
    const code = String(deck?.code || "").trim();
    const words = Array.isArray(deck?.words) ? deck.words : [];

    if (!code) {
      throw new Error(`Deck at index ${deckIndex} is missing a valid code.`);
    }

    return {
      code,
      words: words.map((word, wordIndex) => {
        const normalized = normalizeWord(word?.word);
        if (!normalized) {
          throw new Error(`Deck ${code} contains an invalid word at index ${wordIndex}.`);
        }

        return {
          word: normalized,
          phonetic: word?.phonetic ?? null,
          partOfSpeech: word?.partOfSpeech ?? null,
          definition: word?.definition ?? null,
          translation: word?.translation ?? null,
          exampleSentence: word?.exampleSentence ?? null,
          audioUrl: word?.audioUrl ?? null,
          level: word?.level ?? null,
          source: word?.source ?? code,
          frequencyScore: Number.isFinite(Number(word?.frequencyScore)) ? Number(word.frequencyScore) : null,
        };
      }),
    };
  });
}

function splitTextLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /^(.+?)\s+(\[[^\]]+\]+|\{[^}]+\}+|\/[^/]+\/)\s+([A-Za-z./-]+\.)\s*(.+)$/,
  );

  let rawWord = "";
  let phonetic = null;
  let rawPartOfSpeech = null;
  let rawMeaning = "";

  if (match) {
    [, rawWord, phonetic, rawPartOfSpeech, rawMeaning] = match;
  } else {
    const chineseIndex = trimmed.search(/[\u3400-\u9FFF]/);
    if (chineseIndex <= 0) {
      throw new Error(`Unable to parse line: ${line}`);
    }

    rawWord = trimmed.slice(0, chineseIndex).trim();
    rawMeaning = trimmed.slice(chineseIndex).trim();
  }

  const word = normalizeWord(rawWord);
  const normalizedPhonetic = phonetic
    ? phonetic.replace(/^[\/[{]+|[\/\]}]+$/g, "").trim()
    : null;
  const translation = rawMeaning.trim();

  if (!word) {
    throw new Error(`Invalid word in line: ${line}`);
  }

  return {
    word,
    phonetic: normalizedPhonetic || null,
    partOfSpeech: rawPartOfSpeech?.trim() || null,
    definition: translation || null,
    translation: translation || null,
    exampleSentence: null,
    audioUrl: null,
    level: null,
    source: null,
    frequencyScore: null,
  };
}

function normalizeTextDeck(text, deckCode) {
  const code = String(deckCode || "").trim();
  if (!code) {
    throw new Error("Text format requires --deck-code.");
  }

  const words = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitTextLine);

  return [
    {
      code,
      words: words.map((word) => ({
        ...word,
        source: code,
      })),
    },
  ];
}

function buildSql(decks) {
  const statements = [];

  decks.forEach((deck) => {
    deck.words.forEach((word, index) => {
      statements.push(
        `INSERT INTO vocabulary_words (
          word, phonetic, part_of_speech, definition, translation, example_sentence, audio_url, level, source, created_at, updated_at
        ) VALUES (
          ${sqlQuote(word.word)},
          ${sqlQuote(word.phonetic)},
          ${sqlQuote(word.partOfSpeech)},
          ${sqlQuote(word.definition)},
          ${sqlQuote(word.translation)},
          ${sqlQuote(word.exampleSentence)},
          ${sqlQuote(word.audioUrl)},
          ${sqlQuote(word.level)},
          ${sqlQuote(word.source)},
          unixepoch(),
          unixepoch()
        )
        ON CONFLICT(word) DO UPDATE SET
          phonetic = COALESCE(excluded.phonetic, vocabulary_words.phonetic),
          part_of_speech = COALESCE(excluded.part_of_speech, vocabulary_words.part_of_speech),
          definition = COALESCE(excluded.definition, vocabulary_words.definition),
          translation = COALESCE(excluded.translation, vocabulary_words.translation),
          example_sentence = COALESCE(excluded.example_sentence, vocabulary_words.example_sentence),
          audio_url = COALESCE(excluded.audio_url, vocabulary_words.audio_url),
          level = COALESCE(excluded.level, vocabulary_words.level),
          source = COALESCE(excluded.source, vocabulary_words.source),
          updated_at = unixepoch();`,
      );

      statements.push(
        `INSERT INTO word_review_deck_words (deck_code, word_id, sort_order, frequency_score, created_at)
         SELECT ${sqlQuote(deck.code)}, id, ${index + 1}, ${word.frequencyScore ?? "NULL"}, unixepoch()
         FROM vocabulary_words
         WHERE word = ${sqlQuote(word.word)}
         ON CONFLICT(deck_code, word_id) DO UPDATE SET
           sort_order = excluded.sort_order,
           frequency_score = COALESCE(excluded.frequency_score, word_review_deck_words.frequency_score);`,
      );
    });
  });
  return statements.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), options.input);
  const inputText = await readFile(inputPath, "utf8");
  const decks =
    options.format === "text"
      ? normalizeTextDeck(inputText, options.deckCode)
      : normalizeDecks(JSON.parse(inputText));

  if (options.dumpJson) {
    process.stdout.write(`${JSON.stringify({ decks }, null, 2)}\n`);
    return;
  }

  const sql = buildSql(decks);

  if (options.dryRun) {
    process.stdout.write(sql);
    return;
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ielts-word-review-"));
  const sqlFile = path.join(tempDir, "import-word-review.sql");

  try {
    await writeFile(sqlFile, sql, "utf8");

    const args = [
      "d1",
      "execute",
      options.db,
      options.remote ? "--remote" : "--local",
      "--file",
      sqlFile,
    ];

    const { stdout, stderr } = await execFileAsync("npx", ["wrangler", ...args], {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 8,
    });

    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
