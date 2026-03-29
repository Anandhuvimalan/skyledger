import { NextResponse } from "next/server";

import { requireSession } from "@/lib/server/auth";
import {
  addAccount,
  addAgent,
  addJournalEntry,
  bookFlight,
  deferInvoice,
  generateSettlementBatch,
  postDraftJournals,
  recordPayment,
  runRevenueRecognitionBatch,
  toggleAgentStatus,
} from "@/lib/server/state";

export async function POST(request: Request) {
  const session = await requireSession().catch(() => null);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { action?: string; payload?: unknown };

  try {
    switch (body.action) {
      case "addAccount":
        addAccount(session, body.payload as Parameters<typeof addAccount>[1]);
        return NextResponse.json({ ok: true });
      case "addAgent":
        addAgent(session, body.payload as Parameters<typeof addAgent>[1]);
        return NextResponse.json({ ok: true });
      case "toggleAgentStatus":
        toggleAgentStatus(session, (body.payload as { agentId: string }).agentId);
        return NextResponse.json({ ok: true });
      case "addJournalEntry": {
        const id = addJournalEntry(session, body.payload as Parameters<typeof addJournalEntry>[1]);
        return NextResponse.json({ ok: true, id });
      }
      case "postDraftJournals": {
        const posted = postDraftJournals(session);
        return NextResponse.json({ ok: true, posted });
      }
      case "generateSettlementBatch": {
        const result = generateSettlementBatch(session);
        return NextResponse.json({ ok: true, ...result });
      }
      case "bookFlight": {
        const result = bookFlight(session, body.payload as Parameters<typeof bookFlight>[1]);
        return NextResponse.json({ ok: true, ...result });
      }
      case "recordPayment": {
        const result = recordPayment(session, body.payload as Parameters<typeof recordPayment>[1]);
        return NextResponse.json({ ok: true, ...result });
      }
      case "deferInvoice": {
        const dueDate = deferInvoice(session, (body.payload as { invoiceId: string }).invoiceId);
        return NextResponse.json({ ok: true, dueDate });
      }
      case "runRevenueRecognitionBatch": {
        const result = runRevenueRecognitionBatch(session);
        return NextResponse.json({ ok: true, ...result });
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    const status =
      message === "FORBIDDEN" ? 403 : message === "NOT_FOUND" ? 404 : message === "UNAUTHORIZED" ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
