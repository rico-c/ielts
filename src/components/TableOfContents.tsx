"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Heading } from "@/lib/blog-markdown";

export default function TableOfContents({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "0% 0% -72% 0%" },
    );

    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      headings.forEach((heading) => {
        const element = document.getElementById(heading.id);
        if (element) {
          observer.unobserve(element);
        }
      });
    };
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className="sticky top-28 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5 shadow-lg shadow-slate-200/40 backdrop-blur">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
        文章目录
      </p>
      <ul className="space-y-3 text-sm">
        {headings.map((heading) => (
          <li key={heading.id} style={{ paddingLeft: `${(heading.level - 2) * 14}px` }}>
            <Link
              href={`#${heading.id}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(heading.id)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
                setActiveId(heading.id);
              }}
              className={`block border-l-2 pl-3 transition-colors ${
                activeId === heading.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-blue-600"
              }`}
            >
              {heading.text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
