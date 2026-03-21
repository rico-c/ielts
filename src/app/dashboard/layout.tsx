"use client";

import { UserButton } from "@clerk/nextjs";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  NotebookPen,
  Settings,
  SquareChartGantt,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

const menuItems = [
  { href: "/dashboard", label: "概览", icon: LayoutDashboard },
  { href: "/dashboard/practice", label: "剑雅真题", icon: BookOpen },
  { href: "/dashboard/mock-exam", label: "口语模考", icon: SquareChartGantt },
  { href: "/dashboard/word-review", label: "单词复习", icon: NotebookPen },
  { href: "/dashboard/materials", label: "独家资料", icon: FileText },
  { href: "/dashboard/settings", label: "设置", icon: Settings },
] as const;

function SidebarIcon({
  icon: Icon,
  active,
}: {
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
        active ? "bg-transparent text-slate-900" : "bg-transparent text-slate-500 group-hover:text-slate-700"
      }`}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
    </span>
  );
}

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  const Icon = collapsed ? ChevronRight : ChevronLeft;

  return <Icon className="h-4 w-4" strokeWidth={2.4} />;
}

function MobileCloseIcon() {
  return <X className="h-4 w-4" strokeWidth={2.2} />;
}

function MobileMenuText() {
  return <span>关闭</span>;
}

function CollapseLabel({ collapsed }: { collapsed: boolean }) {
  return <span>{collapsed ? "" : "收起"}</span>;
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#f8fafc]">
      <div
        className="absolute inset-0 z-0 opacity-80"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(59,130,246,0.10), transparent 28%), radial-gradient(circle at 85% 15%, rgba(99,102,241,0.10), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)",
        }}
      />

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/20 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/30 bg-transparent backdrop-blur-xl transition-transform duration-300 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-[88px]" : "md:w-72"}`}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link
            href="/"
            className={`flex items-center transition-all duration-300 ${collapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100"}`}
          >
            <Image src="/logo.png" alt="优秀IELTS" width={132} height={32} className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center gap-2 rounded-lg p-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 md:hidden"
            >
              <MobileCloseIcon />
              <MobileMenuText />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="hidden items-center gap-2 rounded-lg p-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 md:inline-flex"
            >
              <SidebarToggleIcon collapsed={collapsed} />
              <CollapseLabel collapsed={collapsed} />
            </button>
          </div>
        </div>

        <nav className={`flex-1 space-y-1 overflow-y-auto transition-all duration-300 ${collapsed ? "px-2 py-3" : "p-4"}`}>
          {menuItems.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center rounded-xl px-3 py-1 transition-colors ${
                  collapsed ? "justify-center" : "gap-3"
                } ${active ? "bg-transparent text-slate-900" : "text-slate-500 hover:bg-transparent hover:text-slate-700"}`}
                title={collapsed ? item.label : undefined}
              >
                <SidebarIcon icon={item.icon} active={active} />
                {collapsed ? null : <span className={`text-sm font-medium ${active ? 'text-slate-900' : 'text-slate-500'}`}>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed ? (
          <div className="px-4 pb-2">
            <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 shadow-sm">
              <h3 className="font-bold text-gray-900">优秀雅思免费版</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                当前所有功能免费使用
              </p>
              {/* <Link
                href="/dashboard#pricing"
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-white bg-white/80 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-white"
              >
                查看价格
              </Link> */}
            </div>
          </div>
        ) : null}

        <div className={`transition-all duration-300 ${collapsed ? "px-2 py-4" : "p-4"}`}>
          <div className={`flex items-center rounded-xl px-3 py-2 hover:bg-slate-50 ${collapsed ? "justify-center" : "gap-3"}`}>
            <UserButton />
          </div>
        </div>
      </aside>

      <main className={`relative z-10 flex-1 p-2 transition-all duration-300 md:p-3 md:pl-0 ${collapsed ? "md:ml-[88px]" : "md:ml-72"}`}>
        <div className="h-full overflow-y-auto rounded-2xl bg-white p-4 shadow-xl shadow-slate-200/50 md:p-8">
          <div className="mb-4 md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              菜单
            </button>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
