"use client";

import { SignInButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

export type PricingPlanFeature =
  | string
  | {
      label: string;
    };

export type PricingBillingOption = {
  id: string;
  label: string;
  price: string;
  priceSuffix?: string;
  priceCaption?: string;
  checkoutPriceId?: string;
  isSubscription?: boolean;
};

export type PricingPlan = {
  id: string;
  badge?: string;
  title: string;
  description?: string;
  price?: string;
  priceLabel?: string;
  priceSuffix?: string;
  priceCaption?: string;
  billingOptions?: readonly PricingBillingOption[];
  defaultBillingOptionId?: string;
  features?: readonly PricingPlanFeature[];
  ctaHref?: string;
  ctaLabel?: string;
  ctaLabelByBillingOptionId?: Readonly<Record<string, string>>;
  note?: string;
  variant?: "featured" | "default";
  size?: "default" | "compact";
  className?: string;
};

type PricingPlanCardProps = {
  plans: readonly PricingPlan[];
  className?: string;
};

function getFeatureLabel(feature: PricingPlanFeature) {
  return typeof feature === "string" ? feature : feature.label;
}

function PlanCard({ plan }: { plan: PricingPlan }) {
  const { user, isLoaded } = useUser();
  const {
    badge,
    title,
    description,
    price,
    priceLabel = "价格",
    priceSuffix,
    priceCaption,
    billingOptions,
    defaultBillingOptionId,
    features = [],
    ctaHref,
    ctaLabel,
    ctaLabelByBillingOptionId,
    note,
    variant = "default",
    size = "default",
    className,
  } = plan;

  const isFeatured = variant === "featured";
  const isCompact = size === "compact";
  const availableBillingOptions = billingOptions ?? [];
  const [selectedBillingId, setSelectedBillingId] = useState(
    defaultBillingOptionId ?? availableBillingOptions[0]?.id ?? "",
  );
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const activeBillingOption = useMemo(() => {
    if (availableBillingOptions.length === 0) return null;

    return (
      availableBillingOptions.find((option) => option.id === selectedBillingId) ??
      availableBillingOptions[0]
    );
  }, [availableBillingOptions, selectedBillingId]);

  const displayPrice = activeBillingOption?.price ?? price ?? "";
  const displayPriceSuffix = activeBillingOption?.priceSuffix ?? priceSuffix;
  const displayPriceCaption = activeBillingOption?.priceCaption ?? priceCaption;
  const displayCtaLabel =
    (activeBillingOption ? ctaLabelByBillingOptionId?.[activeBillingOption.id] : undefined) ??
    ctaLabel;
  const displayCheckoutPriceId = activeBillingOption?.checkoutPriceId;

  async function handleCheckout() {
    if (!displayCheckoutPriceId || isSubmittingCheckout || !isLoaded) {
      return;
    }

    if (!user) {
      return;
    }

    const email = user.primaryEmailAddress?.emailAddress;

    if (!email) {
      setCheckoutError("当前账号缺少邮箱，暂时无法发起支付。");
      return;
    }

    setIsSubmittingCheckout(true);
    setCheckoutError("");

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId: displayCheckoutPriceId,
          isSubscription: activeBillingOption?.isSubscription ?? false,
          userId: user.id,
          email,
        }),
      });

      const data = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error || "发起支付失败，请稍后重试。");
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("Failed to create Stripe checkout session:", error);
      setCheckoutError(error instanceof Error ? error.message : "发起支付失败，请稍后重试。");
      setIsSubmittingCheckout(false);
    }
  }

  const cardClassName = [
    "rounded-[2rem] border",
    isCompact ? "p-6 sm:p-7" : "p-8 sm:p-10",
    isFeatured
      ? "border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 shadow-xl shadow-blue-100/40"
      : "border-slate-200 bg-white shadow-sm",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const badgeClassName = isFeatured
    ? "bg-white text-blue-700 shadow-sm"
    : "bg-slate-100 text-slate-600";

  const pricePanelClassName = isFeatured
    ? "border-white/80 bg-white/80"
    : "border-slate-200 bg-slate-50";

  const priceTextClassName = isFeatured ? "text-blue-600" : "text-slate-900";
  const noteClassName = isFeatured
    ? "border-blue-100 bg-white/80 text-gray-500"
    : "border-slate-200 bg-slate-50 text-slate-500";
  const headerClassName = "flex flex-wrap items-start justify-between gap-4";
  const titleClassName = isCompact
    ? "mt-3 text-2xl font-bold text-gray-900"
    : "mt-4 text-3xl font-bold text-gray-900";
  const descriptionClassName = isCompact
    ? "mt-2 max-w-2xl text-sm leading-6 text-gray-600"
    : "mt-3 max-w-2xl text-sm leading-7 text-gray-600 sm:text-base";
  const priceBoxClassName = isCompact
    ? "px-5 py-4 text-left"
    : "px-6 py-5 text-center";
  const billingToggleClassName = "mb-4 inline-flex rounded-full border border-slate-200 bg-white p-1";
  const featureGridClassName = isCompact
    ? "mt-6 grid gap-2"
    : "mt-8 grid gap-0 sm:grid-cols-2";
  const featureRowClassName = isCompact
    ? "border-transparent bg-transparent px-0 py-1"
    : `px-0 py-1`;
  const featureTextClassName = isCompact
    ? "text-sm leading-6 text-gray-600"
    : "text-sm leading-7 text-gray-700";
  const actionRowClassName = isCompact
    ? "mt-6 flex flex-wrap gap-2.5"
    : "mt-8 flex flex-wrap gap-3";

  return (
    <article className={cardClassName}>
      <div className={headerClassName}>
        <div>
          {badge ? (
            <div
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClassName}`}
            >
              {badge}
            </div>
          ) : null}
          <h3 className={titleClassName}>{title}</h3>
          {description ? (
            <p className={descriptionClassName}>
              {description}
            </p>
          ) : null}
        </div>

        <div
          className={`rounded-[1.5rem] border shadow-sm ${pricePanelClassName} ${priceBoxClassName}`}
        >
          {availableBillingOptions.length > 1 ? (
            <div className={billingToggleClassName}>
              {availableBillingOptions.map((option) => {
                const active = option.id === activeBillingOption?.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedBillingId(option.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
            {priceLabel}
          </div>
          <div
            className={`mt-2 flex items-end gap-2 ${
              isCompact ? "justify-start" : "justify-center"
            }`}
          >
            <span className={`text-4xl font-extrabold ${priceTextClassName}`}>
              {displayPrice}
            </span>
            {displayPriceSuffix ? (
              <span className="pb-1 text-sm font-medium text-slate-500">
                {displayPriceSuffix}
              </span>
            ) : null}
          </div>
          {displayPriceCaption ? (
            <div className="mt-1 text-sm text-gray-500">{displayPriceCaption}</div>
          ) : null}
        </div>
      </div>

      {features.length > 0 ? (
        <div className={featureGridClassName}>
          {features.map((feature) => {
            const label = getFeatureLabel(feature);

            return (
              <div
                key={label}
                className={`flex items-start gap-3 rounded-2xl ${featureRowClassName}`}
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <p className={featureTextClassName}>{label}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {(ctaHref && displayCtaLabel) || note ? (
        <div className={actionRowClassName}>
          {displayCtaLabel ? (
            displayCheckoutPriceId ? (
              user ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleCheckout();
                  }}
                  disabled={isSubmittingCheckout || !isLoaded}
                  className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold !text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  {isSubmittingCheckout ? "正在跳转支付..." : displayCtaLabel}
                </button>
              ) : (
                <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                  <button
                    type="button"
                    disabled={!isLoaded}
                    className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold !text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                  >
                    {displayCtaLabel}
                  </button>
                </SignInButton>
              )
            ) : ctaHref ? (
              <Link
                href={ctaHref}
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold !text-white transition-colors hover:bg-blue-700"
              >
                {displayCtaLabel}
              </Link>
            ) : null
          ) : null}
          {note ? (
            <span
              className={`inline-flex items-center rounded-full border px-4 py-3 text-sm ${noteClassName}`}
            >
              {note}
            </span>
          ) : null}
        </div>
      ) : null}
      {checkoutError ? <p className="mt-3 text-sm text-rose-600">{checkoutError}</p> : null}
    </article>
  );
}

export default function PricingPlanCard({
  plans,
  className,
}: PricingPlanCardProps) {
  const wrapperClassName = [
    "grid gap-6 xl:items-start",
    plans.length > 1
      ? "mx-auto max-w-6xl xl:grid-cols-[0.82fr_1.18fr]"
      : "mx-auto max-w-xl",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClassName}>
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
