import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const points = [
  "AI 口语模拟对练",
  "剑雅真题结构化练习",
  "登录后继续个人备考节奏",
  "后续可扩展写作批改与题库",
];

export default function BlogCTA() {
  return (
    <section className="relative mt-16 overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-8 shadow-xl shadow-blue-100/40 sm:p-10">
      <div className="absolute -left-10 bottom-0 h-44 w-44 rounded-full bg-blue-200/30 blur-3xl" />
      <div className="absolute -right-10 top-0 h-44 w-44 rounded-full bg-cyan-200/30 blur-3xl" />
      <div className="relative">
        <Image
          src="/logo.png"
          alt="优秀雅思"
          width={120}
          height={32}
          className="mb-5 h-10 w-auto opacity-90"
          unoptimized
        />
        <h2 className="max-w-2xl text-2xl font-bold text-slate-900 sm:text-3xl">
          把博客里的方法，直接接进你的 IELTS 训练流程
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-8 text-slate-600">
          不只是看技巧。进入平台后，可以把口语练习、真题训练和后续复盘放进一套更稳定的备考节奏里。
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {points.map((point) => (
            <li key={point} className="flex items-center gap-2 text-sm text-slate-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
              {point}
            </li>
          ))}
        </ul>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white! transition-colors hover:bg-blue-700"
        >
          返回首页看看平台功能
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
