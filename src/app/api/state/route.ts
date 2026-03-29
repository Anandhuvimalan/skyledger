import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/server/auth";
import { buildAppState } from "@/lib/server/state";

export async function GET() {
  const session = await getSessionUser();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(buildAppState(session));
}
