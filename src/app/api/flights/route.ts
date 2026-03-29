import { NextResponse } from "next/server";

import { requireSession } from "@/lib/server/auth";
import { fetchLiveAirportBoard } from "@/lib/server/aviationstack";
import {
  DEFAULT_LIVE_BOARD_AIRPORT,
  isTrackedUsAirport,
  type LiveBoardType,
} from "@/lib/live-airspace";

function normalizeBoardType(value: string | null): LiveBoardType {
  return value === "arrival" ? "arrival" : "departure";
}

export async function GET(request: Request) {
  const session = await requireSession().catch(() => null);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const airportCode = searchParams.get("airport")?.trim().toUpperCase() || DEFAULT_LIVE_BOARD_AIRPORT;
  const boardType = normalizeBoardType(searchParams.get("type"));

  if (!isTrackedUsAirport(airportCode)) {
    return NextResponse.json(
      { error: "Unsupported airport. Choose one of the tracked top US hubs." },
      { status: 400 }
    );
  }

  try {
    const payload = await fetchLiveAirportBoard({
      airportCode,
      boardType,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load live airspace data." },
      { status: 500 }
    );
  }
}
