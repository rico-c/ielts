const fs = require("fs");
const path = require("path");

const contentDir = path.join(__dirname, "../content/blogs");
const outputFile = path.join(__dirname, "../src/lib/blog-data.json");

function parseFrontmatter(fileContents) {
  const normalized = fileContents.replace(/\r\n/g, "\n");

  if (!normalized.startsWith("---\n")) {
    return {
      data: {},
      content: normalized,
    };
  }

  const endIndex = normalized.indexOf("\n---\n", 4);

  if (endIndex === -1) {
    return {
      data: {},
      content: normalized,
    };
  }

  const rawMeta = normalized.slice(4, endIndex);
  const content = normalized.slice(endIndex + 5).trim();
  const data = {};

  rawMeta.split("\n").forEach((line) => {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      return;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    data[key] = value;
  });

  return { data, content };
}

function generateBlogData() {
  if (!fs.existsSync(contentDir)) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, "[]\n");
    return;
  }

  const fileNames = fs
    .readdirSync(contentDir)
    .filter((fileName) => fileName.endsWith(".md"));

  const posts = fileNames.map((fileName) => {
    const slug = fileName.replace(/\.md$/, "");
    const fullPath = path.join(contentDir, fileName);
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { data, content } = parseFrontmatter(fileContents);

    return {
      slug,
      title: data.title || slug,
      date: data.date || new Date().toISOString().slice(0, 10),
      description: data.description || "",
      author: data.author || "优秀雅思 教研组",
      banner: data.banner || "",
      content,
    };
  });

  posts.sort((a, b) => (a.date < b.date ? 1 : -1));

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(posts, null, 2)}\n`);
  console.log(`Generated blog data with ${posts.length} posts.`);
}

generateBlogData();
