import { NextResponse } from "next/server";

import type { FlightSearchInput } from "@/lib/demo-data";
import { requireSession } from "@/lib/server/auth";
import { searchLiveFlights } from "@/lib/server/aviationstack";

export async function POST(request: Request) {
  const session = await requireSession().catch(() => null);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as FlightSearchInput;

  try {
    const flights = await searchLiveFlights(body);
    return NextResponse.json({ flights });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to search flights." },
      { status: 500 }
    );
  }
}
