import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import BlogCTA from "@/components/BlogCTA";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import TableOfContents from "@/components/TableOfContents";
import { getPostData, getSortedPostsData } from "@/lib/blogs";

interface Props {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  return getSortedPostsData().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const post = await getPostData(slug);
    return {
      title: post.title,
      description: post.description,
    };
  } catch {
    return {
      title: "博客文章不存在",
    };
  }
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params;

  try {
    const post = await getPostData(slug);

    return (
      <div className="min-h-screen text-slate-900">
        <SiteHeader />

        <main className="pb-16 pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Link
              href="/blogs"
              className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-blue-600"
            >
              <ArrowLeft className="h-4 w-4" />
              返回博客列表
            </Link>

            <div className="grid gap-10 lg:grid-cols-12">
              <article className="lg:col-span-8">
                <header className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur sm:p-10">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <time dateTime={post.date} className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
                      {post.date}
                    </time>
                    <span>By {post.author}</span>
                  </div>
                  <h1 className="mt-5 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
                    {post.title}
                  </h1>
                  {/* <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
                    {post.description}
                  </p> */}
                </header>

                {post.banner ? (
                  <div className="relative mt-8 h-[220px] overflow-hidden rounded-[2rem] border border-white/70 shadow-xl shadow-slate-200/40 sm:h-[360px]">
                    <Image
                      src={post.banner}
                      alt={post.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 800px"
                      unoptimized
                    />
                  </div>
                ) : null}

                <div
                  className="blog-prose mt-8 rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-xl shadow-slate-200/30 backdrop-blur sm:p-10"
                  dangerouslySetInnerHTML={{ __html: post.contentHtml }}
                />

                <BlogCTA />
              </article>

              <aside className="hidden lg:col-span-4 lg:block">
                <TableOfContents headings={post.headings} />
              </aside>
            </div>
          </div>
        </main>

        <SiteFooter />
      </div>
    );
  } catch {
    notFound();
  }
}
