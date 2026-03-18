import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

const features = [
  "免费使用单词复习能力",
  "免费进入剑雅真题结构化练习",
  "免费查看学习资料",
  "免费查看最新真题结构和答案",
];

interface PricingSectionProps {
  mode?: "landing" | "dashboard";
  ctaHref: string;
  ctaLabel: string;
}

export default function PricingSection({
  mode = "landing",
  ctaHref,
  ctaLabel,
}: PricingSectionProps) {
  const isDashboard = mode === "dashboard";

  return (
    <section
      id="pricing"
      className={isDashboard ? "rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-8" : "relative overflow-hidden py-24"}
    >
      {isDashboard ? null : (
        <>
          <div className="absolute left-0 top-1/2 -z-10 h-[380px] w-[380px] -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-100/60 to-cyan-100/40 blur-[110px]" />
          <div className="absolute right-0 top-0 -z-10 h-[320px] w-[320px] rounded-full bg-gradient-to-l from-indigo-100/60 to-sky-100/40 blur-[110px]" />
        </>
      )}

      <div className={isDashboard ? "" : "mx-auto max-w-6xl"}>
        <div className={isDashboard ? "mb-8" : "mb-14 text-center"}>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
            Pricing
          </div>
          <h2 className={`mt-5 font-extrabold text-gray-900 ${isDashboard ? "text-3xl" : "text-4xl sm:text-5xl"}`}>
            目前只有一个计划，先把免费版做到足够好用
          </h2>
          <p className={`mt-4 leading-8 text-gray-600 ${isDashboard ? "max-w-3xl text-sm sm:text-base" : "mx-auto max-w-3xl text-lg"}`}>
            现在不做复杂套餐。你进入平台后，可以直接免费使用当前开放的核心能力；后续如果增加付费权益，也会继续沿用这块组件统一承接。
          </p>
        </div>

        <div className={`grid gap-8 mx-auto max-w-xl`}>
          <article className="rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-8 shadow-xl shadow-blue-100/40 sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                  Free Plan
                </div>
                <h3 className="mt-4 text-3xl font-bold text-gray-900">优秀IELTS 免费版</h3>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 sm:text-base">
                  您可以免费开始雅思备考
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/80 bg-white/80 px-6 py-5 text-center shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                  当前价格
                </div>
                <div className="mt-2 text-4xl font-extrabold text-blue-600">￥0</div>
                {/* <div className="mt-1 text-sm text-gray-500"></div> */}
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature}
                  className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/70 px-2 py-2"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <p className="text-sm leading-7 text-gray-700">{feature}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={ctaHref}
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold !text-white transition-colors hover:bg-blue-700"
              >
                {ctaLabel}
              </Link>
              <span className="inline-flex items-center rounded-full border border-blue-100 bg-white/80 px-4 py-3 text-sm text-gray-500">
                当前没有付费门槛
              </span>
            </div>
          </article>
{/* 
          <aside className="rounded-[2rem] border border-gray-100 bg-white p-8 shadow-lg shadow-slate-200/30">
            <div className="rounded-[1.5rem] bg-gray-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                为什么先只保留免费版
              </div>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-gray-600">
                <li>先把核心训练路径验证清楚，再考虑权益分层。</li>
                <li>首页和 dashboard 共用同一个价格组件，后面扩计划时不用重做结构。</li>
                <li>用户现在看到的价格信息简单直接，不会被复杂套餐干扰。</li>
              </ul>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[1.5rem] border border-gray-100 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                  Plan Count
                </div>
                <div className="mt-2 text-3xl font-extrabold text-gray-900">1</div>
              </div>
              <div className="rounded-[1.5rem] border border-gray-100 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                  Billing
                </div>
                <div className="mt-2 text-3xl font-extrabold text-gray-900">Free</div>
              </div>
              <div className="rounded-[1.5rem] border border-gray-100 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                  Upgrade
                </div>
                <div className="mt-2 text-3xl font-extrabold text-gray-900">Later</div>
              </div>
            </div>
          </aside> */}
        </div>
      </div>
    </section>
  );
}
