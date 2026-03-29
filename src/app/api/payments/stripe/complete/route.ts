import { NextResponse } from "next/server";

import { requireSession } from "@/lib/server/auth";
import { recordStripeCheckoutPayment } from "@/lib/server/state";

export async function POST(request: Request) {
  const session = await requireSession().catch(() => null);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "AGENT") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await request.json()) as { checkoutSessionId?: string };

  if (!body.checkoutSessionId) {
    return NextResponse.json({ error: "Missing Stripe checkout session id." }, { status: 400 });
  }

  try {
    const result = await recordStripeCheckoutPayment(session, body.checkoutSessionId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to confirm Stripe payment.";
    const status =
      message === "FORBIDDEN" ? 403 : message === "NOT_FOUND" ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
