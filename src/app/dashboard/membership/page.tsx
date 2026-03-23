"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Crown,
  LoaderCircle,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { PRICE_ID } from "@/constants/priceid";
import { useMembership } from "@/hooks/useMembership";

function getPlanLabel(plan?: string) {
  if (plan === PRICE_ID.MONTHLY) {
    return "PRO 月度会员";
  }

  if (plan === PRICE_ID.YEARLY) {
    return "PRO 年度会员";
  }

  if (plan) {
    return "PRO 会员";
  }

  return "免费版";
}

function formatExpiryDate(expiryDate?: number) {
  if (!expiryDate) {
    return "未开通";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(expiryDate * 1000));
}

export default function DashboardMembershipPage() {
  const { isVip, expiryDate, plan, loading, error } = useMembership();
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [portalError, setPortalError] = useState("");

  async function handleOpenPortal() {
    if (isOpeningPortal) {
      return;
    }

    setIsOpeningPortal(true);
    setPortalError("");

    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error || "暂时无法打开会员管理中心。");
      }

      window.location.href = data.url;
    } catch (requestError) {
      setPortalError(
        requestError instanceof Error
          ? requestError.message
          : "暂时无法打开会员管理中心。",
      );
      setIsOpeningPortal(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3 text-slate-600">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">正在读取会员状态...</span>
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-rose-600" />
            <div>
              <h1 className="text-xl font-bold text-rose-900">会员状态读取失败</h1>
              <p className="mt-2 text-sm leading-7 text-rose-700">
                当前无法获取会员信息，请稍后刷新页面重试。
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 shadow-sm">
          Membership Center
        </div>
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              会员中心
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
              这里用于查看你的会员状态、套餐类型和到期时间。已开通会员时，也可以直接进入 Stripe
              portal 管理账单。
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white bg-white/80 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">
            <Crown
              className={`h-4 w-4 ${isVip ? "text-amber-500" : "text-slate-400"}`}
            />
            {isVip ? "当前为会员用户" : "当前为免费用户"}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">当前计划</div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900">
            {getPlanLabel(plan)}
          </div>
        </article>
        <article className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">会员状态</div>
          <div
            className={`mt-3 text-2xl font-extrabold ${isVip ? "text-emerald-600" : "text-slate-900"}`}
          >
            {isVip ? "有效中" : "未开通"}
          </div>
        </article>
        <article className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">到期时间</div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900">
            {formatExpiryDate(expiryDate)}
          </div>
        </article>
      </section>

      {isVip ? (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  当前会员权益
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  你当前已经具备 PRO 会员访问资格，可以继续使用后续开放的 AI
                  能力和更多专属内容。
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {[
                "查看当前会员套餐与有效期",
                "跳转 Stripe portal 管理账单和订阅",
                "继续进入真题、精听、口语模考等训练流程",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_28px_60px_rgba(15,23,42,0.18)] sm:p-8">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white/10 p-3 text-amber-300">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">账单管理</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  如果你需要查看账单、支付方式或订阅状态，可以直接进入 Stripe
                  的会员管理页面。
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void handleOpenPortal();
                }}
                disabled={isOpeningPortal}
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isOpeningPortal ? "正在跳转..." : "管理会员账单"}
              </button>
              <Link
                href="/dashboard/practice"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/8"
              >
                继续练习
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {portalError ? (
              <p className="mt-4 text-sm text-rose-300">{portalError}</p>
            ) : null}
          </article>
        </section>
      ) : (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-500">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                你还没有开通会员
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                当前账号仍是免费版。你可以回到 dashboard，通过 sidebar
                中的价格弹窗查看套餐并决定是否升级。
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold !text-white transition-colors hover:bg-blue-700"
            >
              返回概览
            </Link>
            <Link
              href="/dashboard/practice"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-600"
            >
              继续免费版
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
