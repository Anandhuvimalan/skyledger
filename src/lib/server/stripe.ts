import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnvFile } from "dotenv";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;
let envLoaded = false;

function loadLocalStripeEnv() {
  if (envLoaded) {
    return;
  }

  const envPath = resolve(process.cwd(), ".env.local");

  if (existsSync(envPath)) {
    loadEnvFile({ path: envPath, override: false });
  }

  envLoaded = true;
}

function getStripeSecretKey() {
  if (!process.env.STRIPE_SECRET_KEY) {
    loadLocalStripeEnv();
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  return secretKey;
}

export function getStripeClient() {
  if (!stripeClient) {
    stripeClient = new Stripe(getStripeSecretKey());
  }

  return stripeClient;
}

export async function createStripeInvoiceCheckoutSession({
  origin,
  invoiceId,
  invoiceNumber,
  agentId,
  customerEmail,
  amount,
  description,
}: {
  origin: string;
  invoiceId: string;
  invoiceNumber: string;
  agentId: string;
  customerEmail?: string;
  amount: number;
  description: string;
}) {
  const stripe = getStripeClient();

  return stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${origin}/agent/payments?invoice=${encodeURIComponent(invoiceId)}&stripe_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/agent/payments?invoice=${encodeURIComponent(invoiceId)}&stripe_canceled=1`,
    payment_method_types: ["card"],
    customer_email: customerEmail,
    billing_address_collection: "auto",
    metadata: {
      app: "skyledger",
      agentId,
      invoiceId,
      invoiceNumber,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `SkyLedger settlement ${invoiceNumber}`,
            description,
          },
        },
      },
    ],
  });
}

export async function retrieveStripeCheckoutPayment(checkoutSessionId: string) {
  const stripe = getStripeClient();
  const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);
  const paymentIntentId =
    typeof checkoutSession.payment_intent === "string"
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent?.id;

  if (!paymentIntentId) {
    throw new Error("Stripe checkout session has no payment intent.");
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge =
    paymentIntent.latest_charge && typeof paymentIntent.latest_charge !== "string"
      ? paymentIntent.latest_charge
      : null;
  const cardDetails =
    charge?.payment_method_details?.type === "card" ? charge.payment_method_details.card : null;
  const balanceTransaction =
    charge?.balance_transaction && typeof charge.balance_transaction !== "string"
      ? charge.balance_transaction
      : null;

  return {
    checkoutSession,
    paymentIntent,
    cardLastFour: cardDetails?.last4 ?? "0000",
    processingFee: balanceTransaction ? Number((balanceTransaction.fee / 100).toFixed(2)) : 0,
  };
}
