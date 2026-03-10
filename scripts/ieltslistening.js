#!/usr/bin/env node

/**
 * Usage:
 *   Edit CONFIG below, then run:
 *   node scripts/ielts.js
 */

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const CONFIG = {
  pageUrl: 'https://practicepteonline.com/ielts-listening-test-204/',
  outputPath: '', // e.g. './ielts-202.json'
  writeDb: true,
  debug: true,
  dbName: 'ielts',
  remote: true, // true => --remote, false => --local
  testMeta: {
    series: 'Cambridge IELTS',
    book: 20,
    test: 4,
    module: 'listening', // listening | reading | writing | speaking
    testCode: 'C20-T4-L',
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

function inferQuestionTypeFromInstruction(instruction) {
  const text = instruction.toLowerCase();
  if (
    text.includes('label the') ||
    (text.includes('write the correct letter') && text.includes('questions'))
  ) {
    return 'matching';
  }
  if (
    text.includes('complete the') ||
    text.includes('write one word') ||
    text.includes('write no more than') ||
    text.includes('write one number')
  ) {
    return 'fill_blank';
  }
  if (text.includes('choose the correct letter')) {
    return 'single_choice';
  }
  if (
    text.includes('choose two') ||
    text.includes('choose three') ||
    (text.includes('choose') && text.includes('letters'))
  ) {
    return 'multiple_choice';
  }
  if (text.includes('match') || text.includes('matching')) {
    return 'matching';
  }
  return 'unknown';
}

function parseNumbersFromHeading(line) {
  const nums = [...line.matchAll(/\d+/g)].map((m) => Number(m[0]));
  if (nums.length === 0) return [];
  if (nums.length === 2 && /[-–—]/.test(line)) {
    const [start, end] = nums;
    if (start <= end && end - start <= 20) {
      const range = [];
      for (let i = start; i <= end; i += 1) range.push(i);
      return range;
    }
  }
  return nums;
}

function parsePartHeading(line) {
  const match = line.match(/^(Part\s+\d+)\s*:?\s*(.*)$/i);
  if (!match) {
    return { partTitle: line, inlineSubtitle: '' };
  }

  const partTitle = match[1].trim();
  const trailing = match[2].trim();
  return { partTitle, inlineSubtitle: trailing };
}

function buildStructuredQuestions(questionText, answers, imageUrlsByQuestion = new Map()) {
  const answersByNumber = new Map(answers.map((a) => [a.number, a.answer]));
  const lines = questionText
    .split('\n')
    .map(normalizeLine)
    .filter((line) => line && !line.startsWith('<input'));

  const questions = [];
  let currentPart = '';
  let currentInstruction = '';
  let currentType = 'unknown';
  let currentSubtitle = '';
  let pendingSharedNumbers = [];
  let pendingSharedPrompt = '';
  let pendingSharedOptions = [];
  let activeQuestion = null;

  const flushActiveQuestion = () => {
    if (!activeQuestion) return;
    questions.push({
      number: activeQuestion.number,
      type: activeQuestion.type,
      part: activeQuestion.part,
      subtitle: activeQuestion.subtitle,
      instruction: activeQuestion.instruction,
      prompt: activeQuestion.prompt,
      options: activeQuestion.options,
      imageUrls: imageUrlsByQuestion.get(activeQuestion.number) || [],
      answer: answersByNumber.get(activeQuestion.number) || '',
      tableRef: null,
    });
    activeQuestion = null;
  };

  const flushSharedBlock = () => {
    if (!pendingSharedNumbers.length || !pendingSharedPrompt) return;
    for (const n of pendingSharedNumbers) {
      questions.push({
        number: n,
        type: currentType,
        part: currentPart,
        subtitle: currentSubtitle,
        instruction: currentInstruction,
        prompt: pendingSharedPrompt,
        options: pendingSharedOptions.slice(),
        imageUrls: imageUrlsByQuestion.get(n) || [],
        answer: answersByNumber.get(n) || '',
        tableRef: null,
      });
    }
    pendingSharedNumbers = [];
    pendingSharedPrompt = '';
    pendingSharedOptions = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/<[^>]+>/g, '').trim();
    if (!line) continue;

    if (/^Part\s+\d+\s*:?/i.test(line)) {
      flushActiveQuestion();
      flushSharedBlock();
      const { partTitle, inlineSubtitle } = parsePartHeading(line);
      currentPart = partTitle;
      currentSubtitle = '';
      pendingSharedNumbers = [];
      if (/^Questions?\s+\d+/i.test(inlineSubtitle)) {
        currentSubtitle = inlineSubtitle;
        pendingSharedNumbers = parseNumbersFromHeading(inlineSubtitle);
      } else if (inlineSubtitle) {
        currentSubtitle = inlineSubtitle;
      }
      continue;
    }

    if (/^Questions?\s+\d+/i.test(line)) {
      flushActiveQuestion();
      flushSharedBlock();
      currentSubtitle = line;
      pendingSharedNumbers = parseNumbersFromHeading(line);
      continue;
    }

    if (/^(Complete the|Choose\b|Write\b|Match\b|Label\b)/i.test(line)) {
      flushActiveQuestion();
      flushSharedBlock();
      currentInstruction = line;
      currentType = inferQuestionTypeFromInstruction(line);
      if (currentType === 'matching' && pendingSharedNumbers.length > 1) {
        pendingSharedPrompt = line;
      }
      continue;
    }

    const optionMatch = line.match(/^(?:_+\s*)?([A-E])(?:[.)])?\s+(.+)$/);
    const canCaptureOptions =
      currentType === 'single_choice' || currentType === 'multiple_choice' || currentType === 'matching';
    if (optionMatch && canCaptureOptions) {
      const [, label, text] = optionMatch;
      const option = { label, text: text.trim() };
      if (activeQuestion) {
        activeQuestion.options.push(option);
      } else {
        pendingSharedOptions.push(option);
      }
      continue;
    }

    const numberedQuestion = line.match(/^(\d+)\.\s*(.+)$/);
    if (numberedQuestion) {
      flushActiveQuestion();
      flushSharedBlock();
      activeQuestion = {
        number: Number(numberedQuestion[1]),
        type: currentType,
        part: currentPart,
        subtitle: currentSubtitle,
        instruction: currentInstruction,
        prompt: numberedQuestion[2].trim(),
        options: [],
      };
      continue;
    }

    const numberedBlank = line.match(/^(\d+)\s+_+$/);
    if (numberedBlank) {
      flushActiveQuestion();
      const questionNo = Number(numberedBlank[1]);
      questions.push({
        number: questionNo,
        type: currentType,
        part: currentPart,
        subtitle: currentSubtitle,
        instruction: currentInstruction,
        prompt: pendingSharedPrompt || line,
        options: pendingSharedOptions.slice(),
        imageUrls: imageUrlsByQuestion.get(questionNo) || [],
        answer: answersByNumber.get(questionNo) || '',
        tableRef: null,
      });
      if (pendingSharedNumbers.length) {
        pendingSharedNumbers = pendingSharedNumbers.filter((n) => n !== questionNo);
        if (!pendingSharedNumbers.length) {
          pendingSharedPrompt = '';
          pendingSharedOptions = [];
        }
      }
      continue;
    }

    if (currentType === 'fill_blank' && /\(\d+\)\s*_+/.test(line)) {
      flushActiveQuestion();
      flushSharedBlock();
      const nums = [...line.matchAll(/\((\d+)\)\s*_+/g)].map((m) => Number(m[1]));
      for (const n of nums) {
        questions.push({
          number: n,
          type: 'fill_blank',
          part: currentPart,
          subtitle: currentSubtitle,
          instruction: currentInstruction,
          prompt: line,
          options: [],
          imageUrls: imageUrlsByQuestion.get(n) || [],
          answer: answersByNumber.get(n) || '',
          tableRef: null,
        });
      }
      continue;
    }

    if (
      pendingSharedNumbers.length > 1 &&
      currentType !== 'fill_blank' &&
      !pendingSharedPrompt &&
      !/^_+/.test(line)
    ) {
      pendingSharedPrompt = line;
      continue;
    }

    if (!/^(A|B|C|D|E)\b/.test(line) && !/\(\d+\)\s*_+/.test(line) && !line.includes('____')) {
      currentSubtitle = line;
    }
  }

  flushActiveQuestion();
  flushSharedBlock();

  const byNumber = new Map();
  for (const q of questions) {
    byNumber.set(q.number, q);
  }

  const result = [];
  for (const [number, answer] of answersByNumber.entries()) {
    if (byNumber.has(number)) {
      result.push(byNumber.get(number));
    } else {
      result.push({
        number,
        type: 'unknown',
        part: currentPart,
        subtitle: '',
        instruction: '',
        prompt: '',
        options: [],
        imageUrls: imageUrlsByQuestion.get(number) || [],
        answer,
        tableRef: null,
      });
    }
  }

  result.sort((a, b) => a.number - b.number);
  return result;
}

function extractQuestionHtml(contentHtml) {
  const marker = contentHtml.search(/bg-showmore-action-|Show Answers/i);
  return (marker >= 0 ? contentHtml.slice(0, marker) : contentHtml)
    .replace(/<audio\b[^>]*>[\s\S]*?<\/audio>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .trim();
}

function extractTableRows(tableHtml) {
  const rows = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(tableHtml)) !== null) {
    const cells = [];
    const cellRe = /<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      const [, tag, attrs, inner] = cellMatch;
      const colspan = Number((attrs.match(/colspan=['"]?(\d+)/i) || [])[1] || 1);
      const rowspan = Number((attrs.match(/rowspan=['"]?(\d+)/i) || [])[1] || 1);
      const sanitizedInner = sanitizeHtmlForStorage(inner.trim());
      cells.push({
        tag: tag.toLowerCase(),
        text: stripHtmlToText(inner),
        html: sanitizedInner,
        colspan,
        rowspan,
      });
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function inferPartForTable(tableHtml, questionText) {
  const tableText = stripHtmlToText(tableHtml);
  const idx = questionText.indexOf(tableText.slice(0, Math.min(80, tableText.length)));
  if (idx < 0) return '';
  const upto = questionText.slice(0, idx);
  const parts = [...upto.matchAll(/Part\s+\d+\s*:[^\n]*/gi)];
  return parts.length ? parts[parts.length - 1][0].trim() : '';
}

function extractTables(questionHtml, questionText) {
  const tables = [];
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  let index = 0;
  while ((tableMatch = tableRe.exec(questionHtml)) !== null) {
    index += 1;
    const fullHtml = tableMatch[0];
    const sanitizedTableHtml = sanitizeHtmlForStorage(fullHtml);
    const text = stripHtmlToText(fullHtml);
    const questionNumbers = [
      ...new Set([...fullHtml.matchAll(/\((\d+)\)\s*<input\b/gi)].map((m) => Number(m[1]))),
    ].sort((a, b) => a - b);
    tables.push({
      id: `table_${index}`,
      part: inferPartForTable(fullHtml, questionText),
      questionNumbers,
      rawHtml: sanitizedTableHtml,
      text,
      rows: extractTableRows(fullHtml),
    });
  }
  return tables;
}

function attachTableRefs(questions, tables) {
  const map = new Map();
  for (const table of tables) {
    for (const n of table.questionNumbers) {
      if (!map.has(n)) map.set(n, table.id);
    }
  }
  for (const q of questions) {
    q.tableRef = map.get(q.number) || null;
  }
}

function buildParts(questions, tables) {
  const partMap = new Map();
  const ensurePart = (name) => {
    const key = name || 'Unknown Part';
    if (!partMap.has(key)) {
      partMap.set(key, { part: key, questions: [], tables: [] });
    }
    return partMap.get(key);
  };

  for (const q of questions) {
    ensurePart(q.part).questions.push(q.number);
  }
  for (const t of tables) {
    ensurePart(t.part).tables.push(t.id);
  }

  return [...partMap.values()];
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
  const partNo = Number((partTitle.match(/Part\s+(\d+)/i) || [])[1] || NaN);
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

  for (const q of result.questions) {
    const partIdExpr = q.part
      ? `(SELECT id FROM ielts_test_parts WHERE test_id=${testIdExpr} AND part_title=${sqlQuote(q.part)} LIMIT 1)`
      : 'NULL';

    lines.push(
      `INSERT INTO ielts_questions (
  test_id, part_id, question_no, question_type, subtitle, instruction, prompt, image_urls_json, answer, table_ref
) VALUES (
  ${testIdExpr}, ${partIdExpr}, ${sqlInt(q.number)}, ${sqlQuote(q.type)}, ${sqlQuote(q.subtitle || '')},
  ${sqlQuote(q.instruction || '')}, ${sqlQuote(q.prompt || '')}, ${sqlQuote(JSON.stringify(q.imageUrls || []))},
  ${sqlQuote(q.answer || '')}, ${sqlQuote(q.tableRef)}
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

  for (let i = 0; i < result.tables.length; i += 1) {
    const table = result.tables[i];
    const partIdExpr = table.part
      ? `(SELECT id FROM ielts_test_parts WHERE test_id=${testIdExpr} AND part_title=${sqlQuote(table.part)} LIMIT 1)`
      : 'NULL';

    lines.push(
      `INSERT INTO ielts_tables (
  test_id, part_id, table_ref, question_numbers_json, text_content, raw_html, sort_order
) VALUES (
  ${testIdExpr}, ${partIdExpr}, ${sqlQuote(table.id)}, ${sqlQuote(JSON.stringify(table.questionNumbers || []))},
  ${sqlQuote(table.text || '')}, ${sqlQuote(table.rawHtml || '')}, ${i}
);`
    );

    for (let r = 0; r < (table.rows || []).length; r += 1) {
      const row = table.rows[r] || [];
      for (let c = 0; c < row.length; c += 1) {
        const cell = row[c];
        lines.push(
          `INSERT INTO ielts_table_cells (
  table_id, row_index, col_index, tag, text_content, cell_html, colspan, rowspan
) VALUES (
  (SELECT id FROM ielts_tables WHERE test_id=${testIdExpr} AND table_ref=${sqlQuote(table.id)} LIMIT 1),
  ${r}, ${c}, ${sqlQuote(cell.tag)}, ${sqlQuote(cell.text || '')}, ${sqlQuote(cell.html || '')},
  ${sqlInt(cell.colspan || 1)}, ${sqlInt(cell.rowspan || 1)}
);`
        );
      }
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
    tables: [],
    parts: [],
  };

  const questionHtml = extractQuestionHtml(contentHtml);
  const questionText = extractQuestionText(questionHtml);
  const imageUrlsByQuestion = extractQuestionImageUrlsMap(questionHtml, CONFIG.pageUrl);
  debugLog('Question image map size:', imageUrlsByQuestion.size);
  debugLog('Extracted question text length:', questionText.length);
  result.questions = buildStructuredQuestions(questionText, result.answers, imageUrlsByQuestion);
  result.tables = extractTables(questionHtml, questionText);
  attachTableRefs(result.questions, result.tables);
  result.parts = buildParts(result.questions, result.tables);
  debugLog('Parsed summary', {
    audioUrls: result.audioUrls.length,
    answers: result.answers.length,
    questions: result.questions.length,
    tables: result.tables.length,
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

    console.log(`Imported into D1 database \"${CONFIG.dbName}\" (${CONFIG.remote ? 'remote' : 'local'})`);
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
