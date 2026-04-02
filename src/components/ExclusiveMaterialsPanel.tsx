"use client";

import Link from "next/link";
import { ExternalLink, FileText, Globe, LibraryBig, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type MaterialType = "web" | "pdf";
type MaterialFilter = "all" | MaterialType;

interface ExclusiveMaterialItem {
  title: string;
  description: string;
  url: string;
  type: MaterialType;
}

interface ExclusiveMaterialsResponse {
  success: boolean;
  data: {
    items: ExclusiveMaterialItem[];
    total: number;
    counts: {
      web: number;
      pdf: number;
    };
  };
}

const filterOptions: Array<{
  value: MaterialFilter;
  label: string;
  description: string;
}> = [
  {
    value: "all",
    label: "全部资料",
    description: "网页资料和 PDF 手册一起看",
  },
  {
    value: "web",
    label: "网页资料",
    description: "适合直接在线阅读和跳转",
  },
  {
    value: "pdf",
    label: "PDF 手册",
    description: "适合阶段整理和下载保存",
  },
];

function getTypeLabel(type: MaterialType) {
  return type === "web" ? "WEB" : "PDF";
}

function getTypeAccent(type: MaterialType) {
  return type === "web"
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

export default function ExclusiveMaterialsPanel() {
  const [items, setItems] = useState<ExclusiveMaterialItem[]>([]);
  const [counts, setCounts] = useState({ web: 0, pdf: 0 });
  const [selectedFilter, setSelectedFilter] = useState<MaterialFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMaterials() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/materials/exclusive", {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("资料接口暂时不可用");
        }

        const payload = (await response.json()) as ExclusiveMaterialsResponse;
        setItems(payload.data.items);
        setCounts(payload.data.counts);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : "资料加载失败");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadMaterials();

    return () => {
      controller.abort();
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (selectedFilter === "all") {
      return items;
    }

    return items.filter((item) => item.type === selectedFilter);
  }, [items, selectedFilter]);

  const currentCount =
    selectedFilter === "all"
      ? items.length
      : selectedFilter === "web"
        ? counts.web
        : counts.pdf;

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-[1.75rem] border border-white/70 bg-white/70 shadow-sm"
            />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-[1.6rem] border border-white/70 bg-white/70 shadow-sm"
            />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-[2rem] border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-orange-50 p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-white p-3 text-rose-500 shadow-sm">
            <RefreshCcw className="h-5 w-5" />
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">独家资料暂时没有加载成功</h2>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              重新加载
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-7">

      {filteredItems.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/70 p-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-900">当前分类还没有资料</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            你后续只需要继续往后端静态数据里补充内容，这里会自动展示。
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredItems.map((item) => (
            <article
              key={`${item.type}-${item.url}`}
              className="group relative overflow-hidden rounded-[1.55rem] border border-white/80 bg-white/90 p-4 shadow-sm transition-al hover:shadow-xl hover:shadow-slate-900/5"
            >
              <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent opacity-60" />
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.14em] ${getTypeAccent(item.type)}`}
                >
                  {getTypeLabel(item.type)}
                </span>
                <span className="rounded-full bg-slate-100 p-1.5 text-slate-500 transition-colors group-hover:bg-slate-900 group-hover:text-white">
                  {item.type === "web" ? (
                    <Globe className="h-3.5 w-3.5" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                </span>
              </div>

              <h3 className="mt-4 line-clamp-2 text-base font-bold leading-7 text-slate-900">
                {item.title}
              </h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{item.description}</p>

              <Link
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold !text-white transition-colors hover:bg-slate-700"
              >
                打开
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
