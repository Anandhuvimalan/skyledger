import { NextResponse } from "next/server";

import { getInvoiceStatus } from "@/lib/demo-data";
import { requireSession } from "@/lib/server/auth";
import { buildAppState } from "@/lib/server/state";
import { createStripeInvoiceCheckoutSession } from "@/lib/server/stripe";

export async function POST(request: Request) {
  const session = await requireSession().catch(() => null);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "AGENT") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await request.json()) as {
    invoiceId?: string;
    amount?: number;
  };

  if (!body.invoiceId || !body.amount || body.amount <= 0) {
    return NextResponse.json({ error: "Provide a valid invoice and amount." }, { status: 400 });
  }

  const state = buildAppState(session);
  const invoice = state.invoices.find((item) => item.id === body.invoiceId);

  if (!invoice) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const invoiceStatus = getInvoiceStatus(invoice);

  if (invoiceStatus === "PAID") {
    return NextResponse.json({ error: "This invoice is already settled." }, { status: 400 });
  }

  const amount = Number(Math.min(body.amount, invoice.balanceDue).toFixed(2));

  if (amount <= 0) {
    return NextResponse.json({ error: "No balance remains on this invoice." }, { status: 400 });
  }

  try {
    const checkoutSession = await createStripeInvoiceCheckoutSession({
      origin: new URL(request.url).origin,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      agentId: session.id,
      customerEmail: session.email,
      amount,
      description:
        amount === invoice.balanceDue
          ? `Full settlement for ${invoice.invoiceNumber}`
          : `Partial settlement for ${invoice.invoiceNumber}`,
    });

    return NextResponse.json({
      ok: true,
      checkoutUrl: checkoutSession.url,
      checkoutSessionId: checkoutSession.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start Stripe checkout." },
      { status: 500 }
    );
  }
}
