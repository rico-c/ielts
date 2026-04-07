import Image from "next/image";
import Link from "next/link";

interface SiteFooterProps {
  showFriendLinks?: boolean;
}

export default function SiteFooter({ showFriendLinks = false }: SiteFooterProps) {
  return (
    <footer className="border-t border-slate-200/80 bg-white/70 pt-16 pb-8 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 grid gap-8 md:grid-cols-4">
          <div>
            <Image
              src="/logo.png"
              alt="优秀雅思"
              width={120}
              height={30}
              className="mb-6 h-10 w-auto opacity-80"
              unoptimized
            />
            <p className="text-sm leading-7 text-slate-500">
              优秀雅思 聚合 AI 口语模拟、真题训练、博客内容与个人备考工作台，把备考方法和实际训练接到一起。
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-slate-900">产品</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li>
                <Link href="/dashboard/practice" className="hover:text-blue-600">
                  真题练习
                </Link>
              </li>
              <li>
                <Link href="/dashboard/voice" className="hover:text-blue-600">
                  AI 口语对练
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-blue-600">
                  个人备考平台
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-slate-900">资源</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li>
                <Link href="/blogs" className="hover:text-blue-600">
                  博客文章
                </Link>
              </li>
              <li>
                <Link href="/#features" className="hover:text-blue-600">
                  平台功能
                </Link>
              </li>
              <li>
                <Link href="/#practice" className="hover:text-blue-600">
                  训练路径
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-slate-900">联系</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li>official@youshowedu.com</li>
              <li>Mon - Sun / 10:00 - 22:00</li>
              <li>Youshow Education PTY LTD</li>
            </ul>
          </div>
        </div>

        {showFriendLinks ? (
          <div className="mb-8 rounded-3xl border border-slate-200 bg-slate-50/80 px-6 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-sm font-semibold tracking-[0.16em] text-slate-900 uppercase">
                  友情链接
                </h4>
                <p className="mt-2 text-sm text-slate-500">
                  收录与推荐优秀的学习和工具站点。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="https://twelve.tools"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit transition-opacity hover:opacity-85"
                >
                  <img
                    src="https://twelve.tools/badge0-white.svg"
                    alt="Featured on Twelve Tools"
                    width="200"
                    height="54"
                  />
                </a>
                <a
                  href="https://showmebest.ai"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit transition-opacity hover:opacity-85"
                >
                  <img
                    src="https://showmebest.ai/badge/feature-badge-white.webp"
                    alt="Featured on ShowMeBestAI"
                    width="220"
                    height="60"
                  />
                </a>
              </div>
            </div>
          </div>
        ) : null}

        <div className="border-t border-slate-200 pt-8">
          <div className="flex flex-col items-center justify-center gap-4 text-sm text-slate-400 md:flex-row">
            <p>© 2026 优秀雅思. All rights reserved.</p>
            <div className="flex gap-4">
              <Link href="/terms" className="transition-colors hover:text-slate-600">
                服务条款
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-slate-600">
                隐私政策
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
