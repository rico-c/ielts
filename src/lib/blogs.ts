import blogData from "./blog-data.json";
import { markdownToHtml, type Heading } from "./blog-markdown";

export interface BlogPostSummary {
  slug: string;
  title: string;
  date: string;
  description: string;
  author: string;
  banner?: string;
}

export interface BlogPost extends BlogPostSummary {
  contentHtml: string;
  headings: Heading[];
}

interface BlogPostRecord extends BlogPostSummary {
  content: string;
}

export function getSortedPostsData(): BlogPostSummary[] {
  return blogData as BlogPostSummary[];
}

export async function getPostData(slug: string): Promise<BlogPost> {
  const post = (blogData as BlogPostRecord[]).find((item) => item.slug === slug);

  if (!post) {
    throw new Error(`Post not found: ${slug}`);
  }

  const { html, headings } = markdownToHtml(post.content);

  return {
    slug: post.slug,
    title: post.title,
    date: post.date,
    description: post.description,
    author: post.author,
    banner: post.banner,
    contentHtml: html,
    headings,
  };
}
