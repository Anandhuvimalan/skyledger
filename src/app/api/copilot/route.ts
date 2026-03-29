import { NextResponse } from "next/server";

import { requireSession } from "@/lib/server/auth";
import { askCopilot } from "@/lib/server/copilot";

export async function POST(request: Request) {
  const session = await requireSession().catch(() => null);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { message?: string };

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  try {
    const result = await askCopilot(session, body.message.trim());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Copilot request failed." },
      { status: 500 }
    );
  }
}
