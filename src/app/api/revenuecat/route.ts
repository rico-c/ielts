import { NextRequest, NextResponse } from "next/server";
import dayjs from "dayjs";
import { getDatabase } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const bearer = request.headers?.get("Authorization");
    if (!bearer?.includes("417701518")) {
      return NextResponse.json({ err: 403 });
    }
    const db = await getDatabase();
    const text = await request?.text();
    const parameters = JSON.parse(text);
    const { event } = parameters;
    let {
      app_user_id,
      original_app_user_id, // 原始userid
      aliases, // 所有曾用过的userid
      subscriber_attributes,
      period_type,
      type,
      new_product_id,
      product_id,
      purchased_at_ms,
    } = event;
    const email =
      subscriber_attributes?.email?.value ||
      subscriber_attributes?.email ||
      subscriber_attributes?.$email?.value ||
      "clerk@youshowedu.com";

    if (product_id?.includes(":")) {
      product_id = product_id.split(":")[0];
    }

    if (new_product_id?.includes(":")) {
      new_product_id = new_product_id.split(":")[0];
    }

    if (type === "INITIAL_PURCHASE") {
      let expiredTime;
      if (product_id === "PRO_month" && period_type === "TRIAL") {
        expiredTime = dayjs(purchased_at_ms).add(3, "day").unix();
      }

      if (product_id === "PRO_month" && period_type !== "TRIAL") {
        expiredTime = dayjs(purchased_at_ms).add(1, "month").unix();
      }

      // 3天免费试用
      if (product_id === "PRO_year" && period_type === "TRIAL") {
        expiredTime = dayjs(purchased_at_ms).add(3, "day").unix();
      }

      if (product_id === "PRO_year" && period_type !== "TRIAL") {
        expiredTime = dayjs(purchased_at_ms).add(1, "year").unix();
      }

      const stmt = db.prepare(`
        INSERT INTO members (
            user_id, email, stripe_customer_id, stripe_subscription_id, price_id, status, start_date, end_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

      await stmt
        .bind(
          app_user_id,
          email,
          aliases?.join(","),
          original_app_user_id,
          "revenuecat" + product_id,
          "active",
          dayjs(purchased_at_ms).unix(),
          expiredTime,
        )
        .run();
    }

    if (type === "RENEWAL") {
      let expiredTime;

      if (product_id === "PRO_year" && period_type !== "TRIAL") {
        expiredTime = dayjs(purchased_at_ms).add(1, "year").unix();
      }
      if (product_id === "PRO_month" && period_type === "TRIAL") {
        expiredTime = dayjs(purchased_at_ms).add(3, "day").unix();
      }
      if (product_id === "PRO_month" && period_type !== "TRIAL") {
        expiredTime = dayjs(purchased_at_ms).add(1, "month").unix();
      }

      const stmt = db.prepare(`
        INSERT INTO members (
            user_id, email, stripe_customer_id, stripe_subscription_id, price_id, status, start_date, end_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

      await stmt
        .bind(
          app_user_id,
          email,
          aliases?.join(","),
          original_app_user_id,
          "revenuecat" + product_id,
          "active",
          dayjs(purchased_at_ms).unix(),
          expiredTime,
        )
        .run();
    }

    if (type === "PRODUCT_CHANGE") {
      let expiredTime;
      if (new_product_id === "PRO_month" && period_type === "TRIAL") {
        expiredTime = dayjs(purchased_at_ms).add(3, "day").unix();
      }

      if (new_product_id === "PRO_month" && period_type !== "TRIAL") {
        expiredTime = dayjs(purchased_at_ms).add(1, "month").unix();
      }

      if (new_product_id === "PRO_year" && period_type === "TRIAL") {
        expiredTime = dayjs(purchased_at_ms).add(3, "day").unix();
      }

      if (new_product_id === "PRO_year" && period_type !== "TRIAL") {
        expiredTime = dayjs(purchased_at_ms).add(1, "year").unix();
      }

      const stmt = db.prepare(`
        INSERT INTO members (
            user_id, email, stripe_customer_id, stripe_subscription_id, price_id, status, start_date, end_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

      await stmt
        .bind(
          app_user_id,
          email,
          aliases?.join(","),
          original_app_user_id,
          "revenuecat" + product_id,
          "active",
          dayjs(purchased_at_ms).unix(),
          expiredTime,
        )
        .run();
    }

    return NextResponse.json({ ok: 1 });
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { message: err, success: false, code: 500 },
      { status: 500 },
    );
  }
}
