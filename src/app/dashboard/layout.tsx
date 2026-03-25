"use client";

import { UserButton } from "@clerk/nextjs";
import {
  BookOpen,
  ChartColumnIncreasing,
  ChevronLeft,
  ChevronRight,
  Crown,
  FileCheck,
  Headphones,
  LayoutDashboard,
  MessageSquarePlus,
  NotebookPen,
  Rocket,
  Settings,
  SquareChartGantt,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import PricingSection from "@/components/PricingSection";
import XhsProCampaignCard from "@/components/XhsProCampaignCard";
import { useMembership } from "@/hooks/useMembership";
import { OPEN_DASHBOARD_PRICING_MODAL_EVENT } from "@/lib/pricing-modal";

type DashboardMenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  requiresVip?: boolean;
};

const menuItems: DashboardMenuItem[] = [
  { href: "/dashboard", label: "概览", icon: LayoutDashboard },
  { href: "/dashboard/practice", label: "剑雅真题", icon: BookOpen },
  { href: "/dashboard/mock-exam", label: "口语模考", icon: SquareChartGantt },
  {
    href: "/dashboard/intensive-listening",
    label: "精听练习",
    icon: Headphones,
  },
  // { href: "/dashboard/shadowing", label: "跟读练习", icon: Mic2 },
  { href: "/dashboard/word-review", label: "单词复习", icon: NotebookPen },
  { href: "/dashboard/materials", label: "独家资料", icon: FileCheck },
  { href: "/dashboard/analytics", label: "学习分析", icon: ChartColumnIncreasing },
  { href: "/dashboard/membership", label: "会员中心", icon: Crown, requiresVip: true },
  { href: "/dashboard/settings", label: "设置", icon: Settings },
];

const USER_FEEDBACK_FORM_URL =
  "https://youshowedu.feishu.cn/share/base/form/shrcnauIHhoq0iDWx7L1zuW6RP0";

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
        active
          ? "bg-transparent text-slate-900"
          : "bg-transparent text-slate-500 group-hover:text-slate-700"
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

function ProBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-bold tracking-[0.12em] text-amber-700 shadow-sm">
      PRO
    </span>
  );
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const { isVip } = useMembership();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const visibleMenuItems = menuItems.filter((item) => !item.requiresVip || isVip);

  useEffect(() => {
    setMobileOpen(false);
    setPricingModalOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!pricingModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPricingModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pricingModalOpen]);

  useEffect(() => {
    function handleOpenPricingModal() {
      setPricingModalOpen(true);
    }

    window.addEventListener(
      OPEN_DASHBOARD_PRICING_MODAL_EVENT,
      handleOpenPricingModal,
    );

    return () => {
      window.removeEventListener(
        OPEN_DASHBOARD_PRICING_MODAL_EVENT,
        handleOpenPricingModal,
      );
    };
  }, []);

  function openUserFeedbackForm() {
    window.open(USER_FEEDBACK_FORM_URL, "_blank", "noopener,noreferrer");
  }

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
        <div
          className={`flex h-16 items-center px-4 ${collapsed ? "justify-center" : "justify-between"}`}
        >
          <Link
            href="/"
            className={`flex items-center transition-all duration-300 ${collapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100"}`}
          >
            <Image
              src="/logo.png"
              alt="优秀IELTS"
              width={132}
              height={32}
              className="h-10 w-auto"
            />
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
              className="hidden items-center rounded-lg p-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 md:inline-flex"
            >
              <SidebarToggleIcon collapsed={collapsed} />
              <CollapseLabel collapsed={collapsed} />
            </button>
          </div>
        </div>

        <nav
          className={`flex-1 space-y-1 overflow-y-auto transition-all duration-300 p-2`}
        >
          {visibleMenuItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center rounded-xl px-3 py-0.5 transition-colors ${
                  collapsed ? "justify-center" : "gap-1"
                } ${active ? "bg-transparent text-slate-900" : "text-slate-500 hover:bg-transparent hover:text-slate-700"}`}
                title={collapsed ? item.label : undefined}
              >
                <SidebarIcon icon={item.icon} active={active} />
                {collapsed ? null : (
                  <span
                    className={`text-sm font-medium ${active ? "text-slate-900" : "text-slate-500"}`}
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {!collapsed && !isVip ? (
          <div className="mt-auto space-y-2 px-4 pb-0">
            <XhsProCampaignCard collapsed={collapsed} isVip={isVip} />

            <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 shadow-sm">
              <h3 className="font-bold text-gray-900">优秀雅思PRO会员</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                享受AI引擎助力高效提分
              </p>
              <button
                type="button"
                onClick={() => setPricingModalOpen(true)}
                className="group mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white bg-white/80 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:border-blue-200 hover:bg-white hover:text-blue-600"
              >
                <Rocket className="h-4 w-4 text-blue-600 transition-transform duration-300 group-hover:scale-110" />
                查看价格
              </button>
            </div>
          </div>
        ) : null}

        <div
          className={`transition-all duration-300 ${collapsed ? "px-2 py-4" : "p-4"}`}
        >
          <div
            className={`flex items-center rounded-xl px-3 py-2 ${collapsed ? "justify-between" : "gap-3"}`}
          >
            <UserButton />
            {!collapsed && isVip ? <ProBadge /> : null}
            <button
              type="button"
              onClick={openUserFeedbackForm}
              className={`${collapsed ? "" : "ml-auto "}inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700`}
              aria-label="提交反馈"
              title="提交反馈"
            >
              <MessageSquarePlus className="h-4 w-4" strokeWidth={2.1} />
            </button>
          </div>
        </div>
      </aside>

      <main
        className={`relative z-10 flex-1 p-2 transition-all duration-300 md:p-3 md:pl-0 ${collapsed ? "md:ml-[88px]" : "md:ml-72"}`}
      >
        <div className="h-full overflow-y-auto rounded-2xl bg-white p-4 shadow-xl shadow-slate-200/50 md:p-6">
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

      {pricingModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            onClick={() => setPricingModalOpen(false)}
            aria-label="关闭价格弹窗"
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-[#f8fbff] shadow-2xl shadow-slate-900/20">
            <button
              type="button"
              onClick={() => setPricingModalOpen(false)}
              className="absolute right-8 top-8 cursor-pointer"
              aria-label="关闭价格弹窗"
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
            </button>
            <div className="overflow-y-auto ">
              <PricingSection
                mode="dashboard"
                ctaHref="/dashboard/practice"
                ctaLabel=""
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
