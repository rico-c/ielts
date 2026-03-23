import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  httpClient: Stripe.createFetchHttpClient(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json() as { priceId: string; isSubscription: boolean; userId: string; email: string };
    const { priceId, isSubscription, userId, email } = body;

    if (!priceId) {
      return NextResponse.json({ error: "Price ID is required" }, { status: 400 });
    }

    if (!userId || !email) {
      return NextResponse.json({ error: "User login required" }, { status: 401 });
    }

    const isAlipay = !isSubscription;

    const params: any = {
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: isAlipay ? "payment" : "subscription",
      customer_email: email,
      billing_address_collection: "auto",
      success_url: `${req.headers.get("origin")}/dashboard?success=true`,
      cancel_url: `${req.headers.get("origin")}/dashboard?canceled=true`,
      metadata: {
        user_email: email,
        user_id: userId,
        price_id: priceId,
        alipay: isAlipay ? "true" : "false",
      },
      locale: "zh",
      allow_promotion_codes: true,
    };

    if (isAlipay) {
      params["payment_method_types"] = ["alipay"];
    } else {
      params["payment_method_types"] = ["card"];
    }

    const session = await stripe.checkout.sessions.create(params as any);

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: any) {
    console.error("Stripe Checkout Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
