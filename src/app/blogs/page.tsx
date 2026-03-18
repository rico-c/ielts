import type { Metadata } from "next";
import Link from "next/link";
import { getSortedPostsData } from "@/lib/blogs";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "IELTS 博客",
  description: "优秀IELTS 博客，整理口语、写作、阅读与听力的高频备考问题和训练方法。",
};

export default function BlogsPage() {
  const posts = getSortedPostsData();

  return (
    <div className="min-h-screen text-slate-900">
      <SiteHeader />

      <main className="pb-16 pt-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <section className="mb-14 rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-xl shadow-slate-200/40 backdrop-blur sm:p-12">
            <p className="section-kicker inline-flex rounded-full px-4 py-2 text-xs font-semibold tracking-[0.24em] uppercase">
              IELTS Blog
            </p>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              把雅思高频问题拆成可以直接执行的训练动作
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
              从 Speaking、Writing 到 Reading、Listening，博客会持续补充更具体的备考方法、题型思路和训练节奏建议。
            </p>
          </section>

          <div className="grid gap-8">
            {posts.length === 0 ? (
              <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
                暂时还没有博客文章。
              </div>
            ) : null}

            {posts.map((post) => (
              <article
                key={post.slug}
                className="rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-8 shadow-lg shadow-slate-200/30 backdrop-blur transition-transform hover:-translate-y-1"
              >
                <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <time dateTime={post.date} className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
                    {post.date}
                  </time>
                  <span>By {post.author}</span>
                </div>

                <h2 className="text-2xl font-bold text-slate-900 transition-colors hover:text-blue-600">
                  <Link href={`/blogs/${post.slug}`}>{post.title}</Link>
                </h2>
                <p className="mt-4 text-base leading-8 text-slate-600">{post.description}</p>
                <Link
                  href={`/blogs/${post.slug}`}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
                >
                  阅读全文 <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
