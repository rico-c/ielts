import { NextResponse } from "next/server";
// import { auth } from "@clerk/nextjs/server";
// import Stripe from "stripe";
// import { getDatabase } from "@/lib/db";

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
//   httpClient: Stripe.createFetchHttpClient(),
// });

// export const runtime = 'edge';

export async function POST(req: Request) {
  // try {
  //   const { userId } = await auth();

  //   if (!userId) {
  //     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  //   }

  //   const db = await getDatabase();
    
  //   // Get customer ID from DB
  //   const member = await db.prepare(
  //     "SELECT stripe_customer_id FROM members WHERE user_id = ?"
  //   ).bind(userId).first() as { stripe_customer_id: string } | null;

  //   if (!member || !member.stripe_customer_id) {
  //     return NextResponse.json({ error: "No billing account found" }, { status: 404 });
  //   }

  //   const returnUrl = `${req.headers.get("origin")}/dashboard/membership`;

  //   const portalSession = await stripe.billingPortal.sessions.create({
  //     customer: member.stripe_customer_id,
  //     return_url: returnUrl,
  //   });

  //   return NextResponse.json({ url: portalSession.url });

  // } catch (error: any) {
  //   console.error("Error creating portal session:", error);
  //   return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  // }
}
