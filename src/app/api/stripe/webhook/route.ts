import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import dayjs from "dayjs";
import { getDatabase } from "@/lib/db";
import { PRICE_ID } from "@/constants/priceid";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  httpClient: Stripe.createFetchHttpClient(),
});
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
export const dynamic = "force-dynamic";

const valid_price_ids = Object.values(PRICE_ID);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    if (!sig || !endpointSecret) {
      console.error("Webhook signature or secret missing");
      return NextResponse.json(
        { error: "Webhook signature or secret missing" },
        { status: 400 },
      );
    }
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 },
    );
  }

  const db = await getDatabase();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Retrieve metadata
        const userId = session.metadata?.user_id;
        const userEmail = session.metadata?.user_email;
        const priceId = session.metadata?.price_id;
        const isAlipay = session.metadata?.alipay === "true";

        if (!userId || !userEmail) {
          console.error("Missing user metadata in session");
          break;
        }

        // Validate priceId
        if (priceId && !valid_price_ids.includes(priceId)) {
          console.error(`Invalid price_id: ${priceId}`);
          break;
        }

        const enddateadd =
          priceId === PRICE_ID.MONTHLY
            ? 'month'
            : priceId === PRICE_ID.YEARLY
              ? 'year'
              : 'month';

        let startDate: number = dayjs().unix(); // Default to now in seconds
        let endDate: number = dayjs().add(1, enddateadd).unix(); // Default to 31 days from now
        let stripeSubscriptionId: string | null = null;
        const stripeCustomerId = (session.customer as string) || null;

        if (session.mode === "subscription") {
          stripeSubscriptionId = (session.subscription as string) || null;
          if (stripeSubscriptionId) {
            try {
              const subscriptionResponse =
                await stripe.subscriptions.retrieve(stripeSubscriptionId);
              // Use 'any' to access properties that may not be in the SDK types but exist in the API response
              const subscription = subscriptionResponse as any;

              // Ensure we have valid values, fallback to defaults if undefined
              if (typeof subscription.current_period_start === "number") {
                startDate = subscription.current_period_start;
              }
              if (typeof subscription.current_period_end === "number") {
                endDate = subscription.current_period_end;
              }
            } catch (subError: any) {
              console.error("Error retrieving subscription:", subError.message);
              // Use default values set above
            }
          }
        } else if (isAlipay || session.mode === "payment") {
          // One-time payment (Alipay). Assume 31 days access.
          startDate = dayjs().unix();
          endDate = dayjs().add(1, enddateadd).unix();
        }

        // Final validation - ensure no undefined values
        const insertData = {
          userId: userId || "",
          userEmail: userEmail || "",
          stripeCustomerId: stripeCustomerId || null,
          stripeSubscriptionId: stripeSubscriptionId || null,
          priceId: priceId || null,
          status: "active",
          startDate: typeof startDate === "number" ? startDate : dayjs().unix(),
          endDate:
            typeof endDate === "number"
              ? endDate
              : dayjs().add(1, enddateadd).unix(),
        };

        console.log("Inserting member data:", insertData);

        // Insert into members table
        const stmt = db.prepare(`
            INSERT INTO members (
                user_id, email, stripe_customer_id, stripe_subscription_id, price_id, status, start_date, end_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        await stmt
          .bind(
            insertData.userId,
            insertData.userEmail,
            insertData.stripeCustomerId,
            insertData.stripeSubscriptionId,
            insertData.priceId,
            insertData.status,
            insertData.startDate,
            insertData.endDate,
          )
          .run();

        console.log(`User ${userId} subscribed/paid via ${session.mode}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        if (
          invoice.billing_reason === "subscription_cycle" ||
          invoice.billing_reason === "subscription_create"
        ) {
          const subscriptionId = invoice.subscription as string;
          const periodEnd = invoice.lines.data[0]?.period.end; // Seconds

          if (subscriptionId && periodEnd) {
            // Update member record
            await db
              .prepare(
                `
                    UPDATE members 
                    SET end_date = ?, status = 'active' 
                    WHERE stripe_subscription_id = ?
                `,
              )
              .bind(periodEnd, subscriptionId)
              .run();
            console.log(
              `Updated subscription ${subscriptionId} expiry to ${periodEnd}`,
            );
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error(`Error processing webhook: ${err.message}`);
    return NextResponse.json(
      { error: "Error processing webhook" },
      { status: 500 },
    );
  }
}
