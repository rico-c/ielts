import PricingPlanCard, { type PricingPlan } from "@/components/PricingPlanCard";
import { PRICE_ID } from "@/constants/priceid";

const freePlanFeatures = [
  "剑雅8-20题目练习",
  "有限的精听练习基础功能",
  "个人单词本复习",
];

const proPlanFeatures = [
  "免费版全部权益",
  "精听练习高级功能",
  "写作AI评分&解析",
  "口语模考AI评分&解析",
  "优质专项单词本复习",
  "澳新免服务费留学申请",
  "优质雅思视频课程",
  "更多专属资料与进阶内容"
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
  const plans: PricingPlan[] = [
    {
      id: "free",
      badge: "Free Plan",
      title: "优秀雅思 免费版",
      description: "免费进入剑雅题库练习",
      price: "￥0",
      features: freePlanFeatures,
      ctaHref,
      ctaLabel,
      note: "",
      variant: "default",
      size: "compact",
      className: "xl:mt-10",
    },
    {
      id: "pro",
      badge: "PRO Plan",
      title: "优秀雅思 PRO 会员",
      description: "完整训练权益与长期备考节奏",
      billingOptions: [
        {
          id: "monthly",
          label: "月付",
          price: "￥79",
          priceSuffix: "/月",
          priceCaption: "一个月 79 元",
          checkoutPriceId: PRICE_ID.MONTHLY,
          isSubscription: false,
        },
        {
          id: "yearly",
          label: "年付",
          price: "￥499",
          priceSuffix: "/年",
          priceCaption: "一年 499 元",
          checkoutPriceId: PRICE_ID.YEARLY,
          isSubscription: false,
        },
      ],
      defaultBillingOptionId: "yearly",
      features: proPlanFeatures,
      ctaHref,
      ctaLabel: "升级 PRO",
      ctaLabelByBillingOptionId: {
        monthly: "升级月度 PRO",
        yearly: "升级年度 PRO",
      },
      note: "",
      variant: "featured",
      className: "xl:-rotate-[0.35deg]",
    },
  ];

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
            选择适合你的计划和权益
          </h2>
          <p className={`mt-4 leading-8 text-gray-600 ${isDashboard ? "max-w-3xl text-sm sm:text-base" : "mx-auto max-w-3xl text-lg"}`}>
            行业领先的雅思备考平台，AI引擎助力高效提分
          </p>
        </div>

        <div>
          <PricingPlanCard plans={plans} />
        </div>
      </div>
    </section>
  );
}
