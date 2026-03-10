#!/usr/bin/env node

/**
 * Usage:
 *   Edit CONFIG below, then run:
 *   node scripts/ieltsreading.js
 */

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const CONFIG = {
  pageUrl: 'https://practicepteonline.com/ielts-reading-test-310/',
  outputPath: '', // e.g. './ielts-reading-310.json'
  writeDb: true,
  debug: true,
  dbName: 'ielts',
  remote: true, // true => --remote, false => --local
  testMeta: {
    series: 'Cambridge IELTS',
    book: 20,
    test: 0,
    module: 'reading', // listening | reading | writing | speaking
    testCode: 'C20-Tx-R',
  },
};

function debugLog(...args) {
  if (CONFIG.debug) {
    console.log('[DEBUG]', ...args);
  }
}

function decodeHtmlEntities(text) {
  const named = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
  };

  const replacedNamed = text.replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, (m) => named[m] || m);

  return replacedNamed
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

function stripHtmlToText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<input\b[^>]*>/gi, ' ____ ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|article|h1|h2|h3|h4|h5|h6|li|ol|ul)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

function sanitizeHtmlForStorage(html) {
  return html
    .replace(/\sstyle\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/\sstyle\s*=\s*[^\s>]+/gi, '')
    .replace(/\sclass\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/\sclass\s*=\s*[^\s>]+/gi, '')
    .replace(/\swidth\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/\swidth\s*=\s*[^\s>]+/gi, '')
    .replace(/\sheight\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/\sheight\s*=\s*[^\s>]+/gi, '')
    .replace(/\salign\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/\salign\s*=\s*[^\s>]+/gi, '')
    .replace(/\svalign\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/\svalign\s*=\s*[^\s>]+/gi, '')
    .replace(/\sbgcolor\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/\sbgcolor\s*=\s*[^\s>]+/gi, '');
}

function normalizeLine(line) {
  return line
    .replace(/\u00a0/g, ' ')
    .replace(/[•●]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumbersFromHeading(line) {
  const nums = [...line.matchAll(/\d+/g)].map((m) => Number(m[0]));
  if (nums.length === 0) return [];
  if (nums.length === 2 && /(?:-|–|—|to|and)/i.test(line)) {
    const [start, end] = nums;
    if (start <= end && end - start <= 40) {
      const range = [];
      for (let i = start; i <= end; i += 1) range.push(i);
      return range;
    }
  }
  return nums;
}

function inferPassageNoFromQuestionNo(n) {
  if (n <= 13) return 1;
  if (n <= 26) return 2;
  return 3;
}

function inferSubtypeFromInstruction(instruction) {
  const text = instruction.toLowerCase();

  if (text.includes('do the following statements agree') && text.includes('claims of the writer')) {
    return 'yes_no_not_given';
  }
  if (text.includes('do the following statements agree')) {
    return 'true_false_not_given';
  }
  if (text.includes('which section contains')) {
    return 'section_matching';
  }
  if (text.includes('match each statement')) {
    return 'people_matching';
  }
  if (text.includes('complete each sentence') && text.includes('correct ending')) {
    return 'sentence_ending_matching';
  }
  if (text.includes('choose the correct letter')) {
    return 'single_choice';
  }
  if (text.includes('complete the notes') || text.includes('complete the summary')) {
    return 'summary_completion';
  }
  if (text.includes('choose one word') || text.includes('one word and/or a number')) {
    return 'summary_completion';
  }
  if (text.includes('complete the sentences') || text.includes('complete the table')) {
    return 'fill_blank';
  }

  return 'unknown';
}

function subtypeToType(subtype) {
  if (subtype === 'single_choice') return 'single_choice';
  if (subtype === 'true_false_not_given' || subtype === 'yes_no_not_given') return 'single_choice';
  if (subtype === 'summary_completion' || subtype === 'fill_blank') return 'fill_blank';
  if (subtype === 'unknown') return 'unknown';
  return 'matching';
}

function shouldUseSharedOptions(subtype) {
  return (
    subtype === 'section_matching' ||
    subtype === 'people_matching' ||
    subtype === 'sentence_ending_matching' ||
    subtype === 'true_false_not_given' ||
    subtype === 'yes_no_not_given'
  );
}

function defaultOptionsForSubtype(subtype) {
  if (subtype === 'true_false_not_given') {
    return [
      { label: 'TRUE', text: 'The statement agrees with the information.' },
      { label: 'FALSE', text: 'The statement contradicts the information.' },
      { label: 'NOT GIVEN', text: 'There is no information on this.' },
    ];
  }
  if (subtype === 'yes_no_not_given') {
    return [
      { label: 'YES', text: 'The statement agrees with the claims of the writer.' },
      { label: 'NO', text: 'The statement contradicts the claims of the writer.' },
      { label: 'NOT GIVEN', text: 'It is impossible to say what the writer thinks about this.' },
    ];
  }
  return [];
}

function extractQuestionBlocks(questionText) {
  const lines = questionText
    .split('\n')
    .map(normalizeLine)
    .filter((line) => line && !line.startsWith('<input'));

  const groups = [];
  const questions = [];
  let currentGroup = null;
  let activeQuestion = null;
  let fallbackInstruction = '';

  const flushActiveQuestion = () => {
    if (!activeQuestion) return;
    questions.push(activeQuestion);
    activeQuestion = null;
  };

  const finalizeGroup = () => {
    if (!currentGroup) return;
    if (currentGroup.sharedOptions.length === 0) {
      currentGroup.sharedOptions = defaultOptionsForSubtype(currentGroup.questionSubtype);
    }
    groups.push(currentGroup);
    currentGroup = null;
  };

  for (const line of lines) {
    if (/^Questions?\s+\d+/i.test(line)) {
      flushActiveQuestion();
      finalizeGroup();
      const nums = parseNumbersFromHeading(line);
      const startNo = nums[0] || 1;
      const passageNo = inferPassageNoFromQuestionNo(startNo);
      currentGroup = {
        id: `group_${groups.length + 1}`,
        heading: line,
        questionNumbers: nums,
        questionFrom: nums.length ? Math.min(...nums) : null,
        questionTo: nums.length ? Math.max(...nums) : null,
        instruction: '',
        questionSubtype: 'unknown',
        questionType: 'unknown',
        sharedPrompt: '',
        sharedOptions: [],
        passageNo,
      };
      continue;
    }

    if (!currentGroup) {
      continue;
    }

    const optionMatch = line.match(/^(?:_+\s*)?([A-G])(?:[.)])\s+(.+)$/);
    if (optionMatch) {
      const [, label, text] = optionMatch;
      const option = { label, text: text.trim() };
      if (shouldUseSharedOptions(currentGroup.questionSubtype) || !activeQuestion) {
        if (!currentGroup.sharedOptions.find((o) => o.label === option.label && o.text === option.text)) {
          currentGroup.sharedOptions.push(option);
        }
      } else {
        activeQuestion.options.push(option);
      }
      continue;
    }

    const explicitAnswerOption = line.match(/^(TRUE|FALSE|NOT GIVEN|YES|NO)\b/i);
    if (explicitAnswerOption && shouldUseSharedOptions(currentGroup.questionSubtype)) {
      const label = explicitAnswerOption[1].toUpperCase();
      if ((label === 'YES' || label === 'NO') && currentGroup.questionSubtype !== 'yes_no_not_given') {
        currentGroup.questionSubtype = 'yes_no_not_given';
        currentGroup.questionType = subtypeToType('yes_no_not_given');
      } else if (
        (label === 'TRUE' || label === 'FALSE') &&
        currentGroup.questionSubtype !== 'yes_no_not_given'
      ) {
        currentGroup.questionSubtype = 'true_false_not_given';
        currentGroup.questionType = subtypeToType('true_false_not_given');
      }
      if (!currentGroup.sharedOptions.find((o) => o.label === label)) {
        currentGroup.sharedOptions.push({ label, text: line });
      }
      continue;
    }

    const numberedQuestion = line.match(/^(\d+)\.\s*(.+)$/);
    if (numberedQuestion) {
      flushActiveQuestion();
      const number = Number(numberedQuestion[1]);
      const prompt = numberedQuestion[2].trim();
      activeQuestion = {
        number,
        type: currentGroup.questionType || 'unknown',
        questionSubtype: currentGroup.questionSubtype || 'unknown',
        part: `Passage ${inferPassageNoFromQuestionNo(number)}`,
        subtitle: currentGroup.heading,
        instruction: currentGroup.instruction || fallbackInstruction,
        prompt,
        options: shouldUseSharedOptions(currentGroup.questionSubtype)
          ? currentGroup.sharedOptions.slice()
          : [],
        imageUrls: [],
        answer: '',
        tableRef: null,
        groupRef: currentGroup.id,
        passageNo: inferPassageNoFromQuestionNo(number),
      };
      continue;
    }

    const instructionCandidate = /^(Choose\b|Complete\b|Look\b|Do\b|Reading passage\b|Write\b)/i.test(line);
    if (instructionCandidate) {
      flushActiveQuestion();
      if (currentGroup.instruction) {
        currentGroup.instruction = `${currentGroup.instruction} ${line}`.trim();
      } else {
        currentGroup.instruction = line;
      }
      const subtype = inferSubtypeFromInstruction(currentGroup.instruction);
      currentGroup.questionSubtype = subtype;
      currentGroup.questionType = subtypeToType(subtype);
      fallbackInstruction = currentGroup.instruction;
      continue;
    }

    const inlineBlanks = [...line.matchAll(/\((\d+)\)/g)].map((m) => Number(m[1]));
    const maybeBlankPrompt = /(?:\.{3,}|…{2,}|_{2,}|\b\(\d+\))/i.test(line);
    if (inlineBlanks.length > 0 && maybeBlankPrompt) {
      flushActiveQuestion();
      for (const number of inlineBlanks) {
        questions.push({
          number,
          type: currentGroup.questionType === 'unknown' ? 'fill_blank' : currentGroup.questionType,
          questionSubtype:
            currentGroup.questionSubtype === 'unknown' ? 'summary_completion' : currentGroup.questionSubtype,
          part: `Passage ${inferPassageNoFromQuestionNo(number)}`,
          subtitle: currentGroup.heading,
          instruction: currentGroup.instruction || fallbackInstruction,
          prompt: line,
          options: shouldUseSharedOptions(currentGroup.questionSubtype)
            ? currentGroup.sharedOptions.slice()
            : [],
          imageUrls: [],
          answer: '',
          tableRef: null,
          groupRef: currentGroup.id,
          passageNo: inferPassageNoFromQuestionNo(number),
        });
      }
      continue;
    }

    if (activeQuestion && !optionMatch) {
      activeQuestion.prompt = `${activeQuestion.prompt} ${line}`.trim();
      continue;
    }

    if (!currentGroup.sharedPrompt) {
      currentGroup.sharedPrompt = line;
    }
  }

  flushActiveQuestion();
  finalizeGroup();

  return { questions, groups };
}

function fillAnswers(questions, answers) {
  const byNumber = new Map(questions.map((q) => [q.number, q]));
  const result = [];

  for (const { number, answer } of answers) {
    const parsed = byNumber.get(number);
    if (parsed) {
      result.push({ ...parsed, answer });
      continue;
    }

    const passageNo = inferPassageNoFromQuestionNo(number);
    result.push({
      number,
      type: 'unknown',
      questionSubtype: 'unknown',
      part: `Passage ${passageNo}`,
      subtitle: '',
      instruction: '',
      prompt: '',
      options: [],
      imageUrls: [],
      answer,
      tableRef: null,
      groupRef: null,
      passageNo,
      questionMeta: {},
    });
  }

  result.sort((a, b) => a.number - b.number);
  return result;
}

function buildPassagesFromQuestions(questions) {
  const passageNos = [...new Set(questions.map((q) => q.passageNo).filter((n) => Number.isFinite(n)))].sort(
    (a, b) => a - b
  );

  return passageNos.map((passageNo, index) => ({
    id: `passage_${passageNo}`,
    passageNo,
    part: `Passage ${passageNo}`,
    title: `Passage ${passageNo}`,
    text: '',
    rawHtml: '',
    sortOrder: index,
  }));
}

function buildParts(questions) {
  const partMap = new Map();

  for (const q of questions) {
    if (!partMap.has(q.part)) {
      partMap.set(q.part, { part: q.part, questions: [], tables: [] });
    }
    partMap.get(q.part).questions.push(q.number);
  }

  return [...partMap.values()].sort((a, b) => {
    const aNo = Number((a.part.match(/(\d+)/) || [])[1] || 0);
    const bNo = Number((b.part.match(/(\d+)/) || [])[1] || 0);
    return aNo - bNo;
  });
}

function extractQuestionHtml(contentHtml) {
  const marker = contentHtml.search(/bg-showmore-action-|Show Answers/i);
  return (marker >= 0 ? contentHtml.slice(0, marker) : contentHtml)
    .replace(/<audio\b[^>]*>[\s\S]*?<\/audio>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .trim();
}

function extractAudioUrls(html, baseUrl) {
  const urls = new Map();
  const re = /(?:src|href)=['"]([^'"]+\.(?:mp3|m4a|wav)(?:\?[^'"]*)?)['"]/gi;

  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      const url = new URL(match[1], baseUrl);
      const key = `${url.origin}${url.pathname}`;
      if (!urls.has(key)) {
        urls.set(key, url.href);
      }
    } catch {
      // Ignore malformed URLs.
    }
  }

  return [...urls.values()];
}

function extractImageUrls(html, baseUrl) {
  const urls = new Map();
  const re = /<img\b[^>]*>/gi;

  let match;
  while ((match = re.exec(html)) !== null) {
    const tag = match[0];
    const srcMatch =
      tag.match(/\ssrc=['"]([^'"]+)['"]/i) ||
      tag.match(/\sdata-src=['"]([^'"]+)['"]/i) ||
      tag.match(/\sdata-lazy-src=['"]([^'"]+)['"]/i);
    const src = srcMatch ? srcMatch[1] : '';
    if (!src) continue;

    try {
      const url = new URL(src, baseUrl);
      const key = `${url.origin}${url.pathname}`;
      if (!urls.has(key)) {
        urls.set(key, url.href);
      }
    } catch {
      // Ignore malformed URLs.
    }
  }

  return [...urls.values()];
}

function extractQuestionImageUrlsMap(questionHtml, baseUrl) {
  const map = new Map();
  const lines = questionHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let currentNumbers = [];
  for (const rawLine of lines) {
    const imageUrls = extractImageUrls(rawLine, baseUrl);
    const line = normalizeLine(stripHtmlToText(rawLine));

    if (line && /^Questions?\s+\d+/i.test(line)) {
      currentNumbers = parseNumbersFromHeading(line);
    }

    const questionMatch = line ? line.match(/^(\d+)\.\s*/) : null;
    if (questionMatch) {
      currentNumbers = [Number(questionMatch[1])];
    }

    if (!imageUrls.length || !currentNumbers.length) continue;

    for (const number of currentNumbers) {
      if (!map.has(number)) map.set(number, []);
      const existing = map.get(number);
      for (const url of imageUrls) {
        if (!existing.includes(url)) {
          existing.push(url);
        }
      }
    }
  }

  return map;
}

function extractAnswers(html) {
  const hiddenAnswerDiv = html.match(/<div\s+id=['"]bg-showmore-hidden-[^'"]+['"][^>]*>([\s\S]*?)<\/div>/i);
  const answerBlock = hiddenAnswerDiv ? hiddenAnswerDiv[1] : html;

  const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  const answers = [];

  let liMatch;
  let number = 1;
  while ((liMatch = liRe.exec(answerBlock)) !== null) {
    const answerText = stripHtmlToText(liMatch[1]);
    if (answerText) {
      answers.push({ number, answer: answerText });
      number += 1;
    }
  }

  return answers;
}

function extractQuestionText(questionHtml) {
  return stripHtmlToText(questionHtml).replace(/<input[^>]*$/i, '').trim();
}

function extractSlug(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

async function fetchPageContent(pageUrl) {
  const page = new URL(pageUrl);
  const slug = extractSlug(page.pathname);
  if (!slug) {
    throw new Error(`Cannot infer slug from URL: ${pageUrl}`);
  }

  const apiUrl = new URL(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}`, page.origin).href;
  debugLog('Fetching WordPress API:', apiUrl);
  const res = await fetch(apiUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Node.js scraper)',
      accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch WordPress API: ${res.status} ${res.statusText}`);
  }

  const pages = await res.json();
  debugLog('WordPress API response pages:', Array.isArray(pages) ? pages.length : 'not-array');
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error(`No page found for slug: ${slug}`);
  }

  const pageData = pages[0];
  const contentHtml = pageData?.content?.rendered;
  if (!contentHtml) {
    throw new Error('WordPress API did not return content.rendered');
  }

  return {
    pageId: pageData.id,
    title: decodeHtmlEntities(pageData?.title?.rendered || ''),
    contentHtml,
  };
}

function sqlQuote(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.trunc(n)) : 'NULL';
}

function parsePartMeta(partTitle) {
  const partNo = Number((partTitle.match(/(\d+)/i) || [])[1] || NaN);
  return {
    partNo: Number.isFinite(partNo) ? partNo : null,
  };
}

function buildSqlForImport(result) {
  const lines = [];
  const sourceUrlQ = sqlQuote(result.sourceUrl);
  const testIdExpr = `(SELECT id FROM ielts_tests WHERE source_url=${sourceUrlQ})`;
  const meta = result.testMeta || {};

  lines.push('PRAGMA foreign_keys = ON;');

  lines.push(
    `INSERT INTO ielts_tests (
  source_url, source_page_id, title, scraped_at, updated_at,
  series, book_no, test_no, module, test_code
)
VALUES (
  ${sourceUrlQ}, ${sqlInt(result.pageId)}, ${sqlQuote(result.title)}, ${sqlQuote(result.scrapedAt)}, datetime('now'),
  ${sqlQuote(meta.series || '')}, ${sqlInt(meta.book)}, ${sqlInt(meta.test)}, ${sqlQuote(meta.module || '')}, ${sqlQuote(meta.testCode || '')}
)
ON CONFLICT(source_url) DO UPDATE SET
  source_page_id = excluded.source_page_id,
  title = excluded.title,
  scraped_at = excluded.scraped_at,
  series = excluded.series,
  book_no = excluded.book_no,
  test_no = excluded.test_no,
  module = excluded.module,
  test_code = excluded.test_code,
  updated_at = datetime('now');`
  );

  lines.push(`DELETE FROM ielts_test_audio_urls WHERE test_id=${testIdExpr};`);
  lines.push(`DELETE FROM ielts_question_options WHERE question_id IN (SELECT id FROM ielts_questions WHERE test_id=${testIdExpr});`);
  lines.push(`DELETE FROM ielts_questions WHERE test_id=${testIdExpr};`);
  lines.push(`DELETE FROM ielts_table_cells WHERE table_id IN (SELECT id FROM ielts_tables WHERE test_id=${testIdExpr});`);
  lines.push(`DELETE FROM ielts_tables WHERE test_id=${testIdExpr};`);
  lines.push(`DELETE FROM ielts_question_groups WHERE test_id=${testIdExpr};`);
  lines.push(`DELETE FROM ielts_passages WHERE test_id=${testIdExpr};`);
  lines.push(`DELETE FROM ielts_test_parts WHERE test_id=${testIdExpr};`);

  for (let i = 0; i < result.audioUrls.length; i += 1) {
    const url = result.audioUrls[i];
    lines.push(
      `INSERT INTO ielts_test_audio_urls (test_id, url, sort_order) VALUES (${testIdExpr}, ${sqlQuote(url)}, ${i});`
    );
  }

  for (let i = 0; i < result.parts.length; i += 1) {
    const part = result.parts[i];
    const sortedNums = [...(part.questions || [])].sort((a, b) => a - b);
    const from = sortedNums.length ? sortedNums[0] : null;
    const to = sortedNums.length ? sortedNums[sortedNums.length - 1] : null;
    const { partNo } = parsePartMeta(part.part || '');

    lines.push(
      `INSERT INTO ielts_test_parts (test_id, part_no, part_title, question_from, question_to, sort_order)
VALUES (${testIdExpr}, ${sqlInt(partNo)}, ${sqlQuote(part.part || 'Unknown Part')}, ${sqlInt(from)}, ${sqlInt(to)}, ${i});`
    );
  }

  for (let i = 0; i < result.passages.length; i += 1) {
    const passage = result.passages[i];
    const partTitle = `Passage ${passage.passageNo}`;
    const partIdExpr = `(SELECT id FROM ielts_test_parts WHERE test_id=${testIdExpr} AND part_title=${sqlQuote(partTitle)} LIMIT 1)`;

    lines.push(
      `INSERT INTO ielts_passages (
  test_id, part_id, passage_no, title, text_content, raw_html, sort_order
) VALUES (
  ${testIdExpr}, ${partIdExpr}, ${sqlInt(passage.passageNo)}, ${sqlQuote(passage.title || '')},
  ${sqlQuote(passage.text || '')}, ${sqlQuote(passage.rawHtml || '')}, ${i}
);`
    );
  }

  for (let i = 0; i < result.groups.length; i += 1) {
    const group = result.groups[i];
    const partTitle = `Passage ${group.passageNo}`;
    const partIdExpr = `(SELECT id FROM ielts_test_parts WHERE test_id=${testIdExpr} AND part_title=${sqlQuote(partTitle)} LIMIT 1)`;

    lines.push(
      `INSERT INTO ielts_question_groups (
  test_id, part_id, passage_no, group_ref, heading, instruction,
  question_type, question_subtype, question_from, question_to,
  shared_prompt, option_set_json, sort_order
) VALUES (
  ${testIdExpr}, ${partIdExpr}, ${sqlInt(group.passageNo)}, ${sqlQuote(group.id)}, ${sqlQuote(group.heading || '')}, ${sqlQuote(group.instruction || '')},
  ${sqlQuote(group.questionType || 'unknown')}, ${sqlQuote(group.questionSubtype || '')}, ${sqlInt(group.questionFrom)}, ${sqlInt(group.questionTo)},
  ${sqlQuote(group.sharedPrompt || '')}, ${sqlQuote(JSON.stringify(group.sharedOptions || []))}, ${i}
);`
    );
  }

  for (const q of result.questions) {
    const partIdExpr = q.part
      ? `(SELECT id FROM ielts_test_parts WHERE test_id=${testIdExpr} AND part_title=${sqlQuote(q.part)} LIMIT 1)`
      : 'NULL';

    lines.push(
      `INSERT INTO ielts_questions (
  test_id, part_id, question_no, question_type, question_subtype, group_ref, passage_no,
  subtitle, instruction, prompt, image_urls_json, answer, table_ref, question_meta_json
) VALUES (
  ${testIdExpr}, ${partIdExpr}, ${sqlInt(q.number)}, ${sqlQuote(q.type)}, ${sqlQuote(q.questionSubtype || '')}, ${sqlQuote(q.groupRef || null)}, ${sqlInt(q.passageNo)},
  ${sqlQuote(q.subtitle || '')}, ${sqlQuote(q.instruction || '')}, ${sqlQuote(q.prompt || '')}, ${sqlQuote(JSON.stringify(q.imageUrls || []))},
  ${sqlQuote(q.answer || '')}, ${sqlQuote(q.tableRef)}, ${sqlQuote(JSON.stringify(q.questionMeta || {}))}
);`
    );

    for (let i = 0; i < (q.options || []).length; i += 1) {
      const option = q.options[i];
      lines.push(
        `INSERT INTO ielts_question_options (question_id, option_label, option_text, sort_order)
VALUES (
  (SELECT id FROM ielts_questions WHERE test_id=${testIdExpr} AND question_no=${sqlInt(q.number)} LIMIT 1),
  ${sqlQuote(option.label)}, ${sqlQuote(option.text)}, ${i}
);`
      );
    }
  }

  return lines.join('\n');
}

async function importToD1ViaWrangler(sql, { dbName, remote, cwd }) {
  const filePath = path.join(os.tmpdir(), `ielts-import-${Date.now()}.sql`);
  await fs.writeFile(filePath, sql, 'utf8');
  debugLog('SQL temp file:', filePath);

  const args = ['wrangler', 'd1', 'execute', dbName, remote ? '--remote' : '--local', '--file', filePath];
  debugLog('Running command:', `npx ${args.join(' ')}`);
  try {
    const { stdout, stderr } = await execFileAsync('npx', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
    debugLog('Wrangler stdout length:', stdout ? stdout.length : 0);
    debugLog('Wrangler stderr length:', stderr ? stderr.length : 0);
    return { stdout, stderr };
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
}

async function main() {
  debugLog('Start scrape', {
    pageUrl: CONFIG.pageUrl,
    writeDb: CONFIG.writeDb,
    dbName: CONFIG.dbName,
    remote: CONFIG.remote,
    testMeta: CONFIG.testMeta,
  });

  const { pageId, title, contentHtml } = await fetchPageContent(CONFIG.pageUrl);
  debugLog('Fetched page content', {
    pageId,
    title,
    contentHtmlLength: contentHtml.length,
  });

  const result = {
    sourceUrl: CONFIG.pageUrl,
    pageId,
    title,
    scrapedAt: new Date().toISOString(),
    testMeta: {
      series: CONFIG.testMeta?.series || '',
      book: CONFIG.testMeta?.book ?? null,
      test: CONFIG.testMeta?.test ?? null,
      module: CONFIG.testMeta?.module || '',
      testCode: CONFIG.testMeta?.testCode || '',
    },
    questionTypeDefinitions: {
      single_choice: 'Single answer multiple choice (A/B/C...)',
      multiple_choice: 'Multiple answers required (e.g. Choose TWO)',
      fill_blank: 'Fill in the blank (word/number completion)',
      matching: 'Matching information/options',
      unknown: 'Type could not be inferred',
    },
    audioUrls: extractAudioUrls(contentHtml, CONFIG.pageUrl),
    answers: extractAnswers(contentHtml),
    questions: [],
    groups: [],
    passages: [],
    tables: [],
    parts: [],
  };

  const questionHtml = extractQuestionHtml(contentHtml);
  const questionText = extractQuestionText(questionHtml);
  const imageUrlsByQuestion = extractQuestionImageUrlsMap(questionHtml, CONFIG.pageUrl);
  debugLog('Question image map size:', imageUrlsByQuestion.size);
  debugLog('Extracted question text length:', questionText.length);

  const parsed = extractQuestionBlocks(questionText);
  const questionsWithAnswers = fillAnswers(parsed.questions, result.answers);
  const groupById = new Map(parsed.groups.map((g) => [g.id, g]));

  for (const q of questionsWithAnswers) {
    q.imageUrls = imageUrlsByQuestion.get(q.number) || [];
    if (shouldUseSharedOptions(q.questionSubtype) && (!q.options || q.options.length === 0)) {
      const groupOptions = q.groupRef ? groupById.get(q.groupRef)?.sharedOptions || [] : [];
      q.options = groupOptions.length ? groupOptions : defaultOptionsForSubtype(q.questionSubtype);
    }
  }

  result.questions = questionsWithAnswers;
  result.groups = parsed.groups;
  result.passages = buildPassagesFromQuestions(result.questions);
  result.parts = buildParts(result.questions);

  debugLog('Parsed summary', {
    audioUrls: result.audioUrls.length,
    answers: result.answers.length,
    questions: result.questions.length,
    groups: result.groups.length,
    passages: result.passages.length,
    parts: result.parts.length,
  });
  debugLog('Question number sample:', result.questions.slice(0, 10).map((q) => q.number));

  const json = JSON.stringify(result, null, 2);

  if (CONFIG.outputPath) {
    await fs.writeFile(CONFIG.outputPath, json + '\n', 'utf8');
    console.log(`Saved JSON: ${CONFIG.outputPath}`);
  } else if (!CONFIG.writeDb) {
    console.log(json);
  }

  if (CONFIG.writeDb) {
    const sql = buildSqlForImport(result);
    debugLog('Generated SQL length:', sql.length);
    debugLog('Generated SQL line count:', sql.split('\n').length);
    const { stdout, stderr } = await importToD1ViaWrangler(sql, {
      dbName: CONFIG.dbName,
      remote: CONFIG.remote,
      cwd: process.cwd(),
    });

    console.log(`Imported into D1 database "${CONFIG.dbName}" (${CONFIG.remote ? 'remote' : 'local'})`);
    if (stdout && stdout.trim()) console.log(stdout.trim());
    if (stderr && stderr.trim()) console.error(stderr.trim());
  }
}

main().catch((err) => {
  console.error('[ERROR]', err && err.message ? err.message : err);
  if (err && err.stack) {
    console.error('[ERROR STACK]');
    console.error(err.stack);
  }
  process.exit(1);
});
