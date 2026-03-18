export interface Heading {
  text: string;
  level: number;
  id: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function processInline(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
}

function slugifyHeading(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isTableDelimiter(line: string) {
  return /^\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(line.trim());
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function markdownToHtml(markdown: string) {
  const headings: Heading[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];

  let index = 0;
  let inCodeBlock = false;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }

    html.push(`<p>${processInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      if (inCodeBlock) {
        html.push("</code></pre>");
      } else {
        html.push("<pre><code>");
      }
      inCodeBlock = !inCodeBlock;
      index += 1;
      continue;
    }

    if (inCodeBlock) {
      html.push(`${escapeHtml(line)}\n`);
      index += 1;
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const id = slugifyHeading(text);

      if (level === 2 || level === 3) {
        headings.push({ text, level, id });
      }

      html.push(`<h${level} id="${id}">${processInline(text)}</h${level}>`);
      index += 1;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      html.push(`<blockquote><p>${processInline(trimmed.slice(2).trim())}</p></blockquote>`);
      index += 1;
      continue;
    }

    if (
      trimmed.includes("|") &&
      index + 1 < lines.length &&
      isTableDelimiter(lines[index + 1])
    ) {
      flushParagraph();
      const headerCells = parseTableRow(trimmed);
      index += 2;
      const rows: string[][] = [];

      while (index < lines.length && lines[index].trim().includes("|")) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }

      html.push("<div class=\"blog-table-wrapper\"><table><thead><tr>");
      headerCells.forEach((cell) => {
        html.push(`<th>${processInline(cell)}</th>`);
      });
      html.push("</tr></thead><tbody>");
      rows.forEach((row) => {
        html.push("<tr>");
        row.forEach((cell) => {
          html.push(`<td>${processInline(cell)}</td>`);
        });
        html.push("</tr>");
      });
      html.push("</tbody></table></div>");
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      const items: string[] = [];

      while (index < lines.length) {
        const current = lines[index].trim();
        const match = current.match(/^[-*]\s+(.*)$/);
        if (!match) {
          break;
        }
        items.push(match[1]);
        index += 1;
      }

      html.push("<ul>");
      items.forEach((item) => {
        html.push(`<li>${processInline(item)}</li>`);
      });
      html.push("</ul>");
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      const items: string[] = [];

      while (index < lines.length) {
        const current = lines[index].trim();
        const match = current.match(/^\d+\.\s+(.*)$/);
        if (!match) {
          break;
        }
        items.push(match[1]);
        index += 1;
      }

      html.push("<ol>");
      items.forEach((item) => {
        html.push(`<li>${processInline(item)}</li>`);
      });
      html.push("</ol>");
      continue;
    }

    paragraph.push(trimmed);
    index += 1;
  }

  flushParagraph();

  if (inCodeBlock) {
    html.push("</code></pre>");
  }

  return {
    html: html.join(""),
    headings,
  };
}
