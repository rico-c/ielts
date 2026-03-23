"use client";

import { Rocket, X } from "lucide-react";
import { useEffect, useState } from "react";

const XHS_PRO_CAMPAIGN_FORM_URL =
  "https://youshowedu.feishu.cn/share/base/form/shrcnN0j9wu1clWSqL4gWeFi8fc";
const XHS_PRO_CAMPAIGN_DISMISSED_KEY = "ieltsXhsProCampaignDismissed";

type XhsProCampaignCardProps = {
  collapsed: boolean;
  isVip: boolean;
};

export default function XhsProCampaignCard({
  collapsed,
  isVip,
}: XhsProCampaignCardProps) {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(
        window.localStorage.getItem(XHS_PRO_CAMPAIGN_DISMISSED_KEY) === "true",
      );
    } catch {
      setDismissed(false);
    } finally {
      setReady(true);
    }
  }, []);

  function handleDismiss() {
    setDismissed(true);

    try {
      window.localStorage.setItem(XHS_PRO_CAMPAIGN_DISMISSED_KEY, "true");
    } catch {}
  }

  if (!ready || collapsed || isVip || dismissed) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rose-200/70 shadow-lg transition-transform duration-300 hover:scale-[1.02]">
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-rose-50/95 via-white/80 to-orange-50/95 backdrop-blur-md" />
      <div className="absolute -right-10 -top-10 z-0 h-24 w-24 rounded-full bg-rose-300/30 blur-2xl animate-pulse" />
      <div className="absolute -bottom-10 -left-10 z-0 h-24 w-24 rounded-full bg-amber-300/25 blur-2xl animate-pulse delay-700" />

      <div className="relative z-10 p-4">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/70 hover:text-slate-600"
          aria-label="关闭卡片"
          title="关闭卡片"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="mb-1 font-bold text-gray-900">发小红书领 3 天 PRO</h3>
        <p className="mb-4 text-xs font-medium leading-relaxed text-slate-600">
          发布好评内容后填写表单参与领取
        </p>
        <button
          type="button"
          onClick={() =>
            window.open(
              XHS_PRO_CAMPAIGN_FORM_URL,
              "_blank",
              "noopener,noreferrer",
            )
          }
          className="group flex w-full items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/85 py-2.5 text-sm font-semibold text-gray-700 shadow-sm backdrop-blur-sm transition-all hover:border-rose-200 hover:bg-white hover:text-rose-600 hover:shadow-md"
        >
          <Rocket className="h-4 w-4 text-rose-500 transition-transform duration-300 group-hover:scale-110" />
          <span>立即参加</span>
        </button>
      </div>
    </div>
  );
}
