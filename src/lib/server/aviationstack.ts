import type { FlightSearchInput, FlightSearchResult } from "@/lib/demo-data";
import { normalizeAirportInput } from "@/lib/demo-data";
import { buildSeatPricing } from "@/lib/booking-passengers";
import {
  getTrackedUsAirport,
  type LiveBoardFlight,
  type LiveBoardResponse,
  type LiveBoardType,
} from "@/lib/live-airspace";

const AVIATIONSTACK_BASE_URL = "http://api.aviationstack.com/v1";
const LIVE_BOARD_CACHE_TTL_MS = 3 * 60 * 1000;

const liveBoardCache = new Map<
  string,
  {
    expiresAt: number;
    payload: LiveBoardResponse;
  }
>();

interface AviationStackCollectionResponse<T> {
  data?: T[];
  error?: {
    message?: string;
    info?: string;
    code?: string | number;
  };
}

interface AviationStackAirline {
  name?: string | null;
  iata?: string | null;
  icao?: string | null;
}

interface AviationStackFlight {
  number?: string | null;
  iata?: string | null;
  icao?: string | null;
}

interface AviationStackMovement {
  airport?: string | null;
  timezone?: string | null;
  iata?: string | null;
  icao?: string | null;
  terminal?: string | null;
  gate?: string | null;
  baggage?: string | null;
  delay?: number | null;
  scheduled?: string | null;
  estimated?: string | null;
  actual?: string | null;
}

interface AviationStackBoardRow {
  flight_status?: string | null;
  airline?: AviationStackAirline;
  flight?: AviationStackFlight;
  departure?: AviationStackMovement;
  arrival?: AviationStackMovement;
  aircraft?: {
    registration?: string | null;
    iata?: string | null;
    icao?: string | null;
  } | null;
}

function getMovementTime(movement?: AviationStackMovement | null) {
  return movement?.estimated ?? movement?.scheduled ?? movement?.actual ?? null;
}

function toTimeLabel(value?: string | null) {
  if (!value) {
    return "TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function calculateDurationMinutes(departure?: string | null, arrival?: string | null) {
  if (!departure || !arrival) {
    return 180;
  }

  const departureTime = new Date(departure).getTime();
  const arrivalTime = new Date(arrival).getTime();
  const diff = Math.round((arrivalTime - departureTime) / 60000);

  return Number.isFinite(diff) && diff > 30 ? diff : 180;
}

function hashNumber(seed: string) {
  let hash = 0;

  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 2147483647;
  }

  return hash;
}

function estimateFare({
  origin,
  destination,
  durationMinutes,
  passengers,
  airlineCode,
  travelDate,
}: {
  origin: string;
  destination: string;
  durationMinutes: number;
  passengers: number;
  airlineCode: string;
  travelDate: string;
}) {
  const routeHash = hashNumber(`${origin}-${destination}-${airlineCode}-${travelDate}`);
  const durationHours = Math.max(durationMinutes / 60, 1);
  const perPassenger =
    95 +
    durationHours * 62 +
    (routeHash % 170) +
    (origin[0] === destination[0] ? 0 : 85);

  return Number((perPassenger * passengers).toFixed(2));
}

function estimateSeats(seed: string) {
  return 6 + (hashNumber(seed) % 28);
}

async function fetchAviationStackCollection<T>(
  endpoint: string,
  params: Record<string, string | undefined>
) {
  const accessKey = process.env.AVIATIONSTACK_API_KEY;

  if (!accessKey) {
    throw new Error("AVIATIONSTACK_API_KEY is not configured.");
  }

  const query = new URLSearchParams({
    access_key: accessKey,
  });

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  const response = await fetch(`${AVIATIONSTACK_BASE_URL}/${endpoint}?${query.toString()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  const payload = (await response.json()) as AviationStackCollectionResponse<T>;

  if (!response.ok || payload.error) {
    throw new Error(
      payload.error?.info || payload.error?.message || "Unable to load AviationStack data."
    );
  }

  return payload.data ?? [];
}

function normalizeStatus(value?: string | null) {
  if (!value) {
    return "Scheduled";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function sortByScheduledTime<T extends { scheduledTime: string | null }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.scheduledTime ? new Date(left.scheduledTime).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.scheduledTime
      ? new Date(right.scheduledTime).getTime()
      : Number.MAX_SAFE_INTEGER;

    return leftTime - rightTime;
  });
}

function buildLiveBoardFlight(row: AviationStackBoardRow, boardType: LiveBoardType, index: number) {
  const departure = row.departure ?? {};
  const arrival = row.arrival ?? {};
  const selectedMovement = boardType === "departure" ? departure : arrival;
  const carrierName = row.airline?.name?.trim() || "Unknown Carrier";
  const carrierCode =
    row.airline?.iata?.trim() || row.airline?.icao?.trim() || carrierName.slice(0, 2).toUpperCase();
  const flightCode =
    row.flight?.iata?.trim() ||
    `${carrierCode}${row.flight?.number?.trim() || String(index + 1).padStart(3, "0")}`;
  const originCode = departure.iata?.trim().toUpperCase() || "TBD";
  const destinationCode = arrival.iata?.trim().toUpperCase() || "TBD";
  const scheduledTime = selectedMovement.scheduled ?? null;
  const estimatedTime = selectedMovement.estimated ?? selectedMovement.actual ?? scheduledTime;
  const actualTime = selectedMovement.actual ?? null;
  const durationMinutes = calculateDurationMinutes(
    departure.scheduled ?? departure.estimated,
    arrival.scheduled ?? arrival.estimated
  );
  const estimatedTicketValue = estimateFare({
    origin: originCode,
    destination: destinationCode,
    durationMinutes,
    passengers: 1,
    airlineCode: carrierCode,
    travelDate: new Date().toISOString().slice(0, 10),
  });

  return {
    id: `${boardType}-${flightCode}-${scheduledTime ?? index}`,
    boardType,
    flightCode,
    carrierName,
    carrierCode,
    originCode,
    originName: departure.airport?.trim() || originCode,
    destinationCode,
    destinationName: arrival.airport?.trim() || destinationCode,
    scheduledTime,
    estimatedTime,
    actualTime,
    terminal: selectedMovement.terminal?.trim() || null,
    gate: selectedMovement.gate?.trim() || null,
    baggage: arrival.baggage?.trim() || null,
    status: normalizeStatus(row.flight_status),
    delayMinutes: Math.max(0, Number(selectedMovement.delay ?? 0)),
    aircraft:
      row.aircraft?.registration?.trim() ||
      row.aircraft?.iata?.trim() ||
      row.aircraft?.icao?.trim() ||
      null,
    estimatedTicketValue,
  } satisfies LiveBoardFlight;
}

export async function fetchLiveAirportBoard({
  airportCode,
  boardType,
}: {
  airportCode: string;
  boardType: LiveBoardType;
}) {
  const trackedAirport = getTrackedUsAirport(airportCode);

  if (!trackedAirport) {
    throw new Error("Unsupported airport. Choose one of the tracked US hubs.");
  }

  const cacheKey = `${trackedAirport.code}:${boardType}`;
  const cached = liveBoardCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const rows = await fetchAviationStackCollection<AviationStackBoardRow>("flights", {
    limit: "100",
    [boardType === "departure" ? "dep_iata" : "arr_iata"]: trackedAirport.code,
  });
  const flights = sortByScheduledTime(
    rows.map((row, index) => buildLiveBoardFlight(row, boardType, index))
  );
  const fetchedAt = new Date().toISOString();
  const payload: LiveBoardResponse = {
    airportCode: trackedAirport.code,
    airportName: trackedAirport.name,
    city: trackedAirport.city,
    timeZone: trackedAirport.timeZone,
    boardType,
    fetchedAt,
    cachedUntil: new Date(Date.now() + LIVE_BOARD_CACHE_TTL_MS).toISOString(),
    flights,
  };

  liveBoardCache.set(cacheKey, {
    expiresAt: Date.now() + LIVE_BOARD_CACHE_TTL_MS,
    payload,
  });

  return payload;
}

export async function searchLiveFlights({
  origin,
  destination,
  passengers,
  travelDate,
}: FlightSearchInput): Promise<FlightSearchResult[]> {
  const normalizedOrigin = normalizeAirportInput(origin);
  const normalizedDestination = normalizeAirportInput(destination);
  const rows = await fetchAviationStackCollection<AviationStackBoardRow>("flights", {
    dep_iata: normalizedOrigin,
    arr_iata: normalizedDestination,
    limit: "10",
  });
  const operationalRows = rows.filter((item) => {
    const status = item.flight_status?.toLowerCase() ?? "";
    return !["cancelled", "diverted", "incident"].includes(status);
  });
  const prioritizedRows = operationalRows.filter((item) => {
    const status = item.flight_status?.toLowerCase() ?? "";
    return status === "active" || status === "scheduled";
  });
  const matches = (prioritizedRows.length > 0 ? prioritizedRows : operationalRows)
    .sort((left, right) => {
      const leftTime = getMovementTime(left.departure)
        ? new Date(getMovementTime(left.departure) as string).getTime()
        : Number.MAX_SAFE_INTEGER;
      const rightTime = getMovementTime(right.departure)
        ? new Date(getMovementTime(right.departure) as string).getTime()
        : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    })
    .slice(0, 6);

  return matches.map((item, index) => {
    const airline = item.airline?.name || "Unknown Carrier";
    const airlineCode = item.airline?.iata || item.airline?.icao || "XX";
    const flightNumber =
      item.flight?.iata || `${airlineCode}${item.flight?.number || String(index + 1)}`;
    const durationMinutes = calculateDurationMinutes(
      getMovementTime(item.departure),
      getMovementTime(item.arrival)
    );
    const economyPrice = estimateFare({
      origin: normalizedOrigin,
      destination: normalizedDestination,
      durationMinutes,
      passengers,
      airlineCode,
      travelDate,
    });
    const seatPricing = buildSeatPricing(economyPrice);

    return {
      id: `${normalizedOrigin}-${normalizedDestination}-${travelDate}-${flightNumber}-${index}`,
      airline,
      airlineCode,
      flightNumber,
      origin: normalizedOrigin,
      destination: normalizedDestination,
      departureTime: toTimeLabel(getMovementTime(item.departure)),
      arrivalTime: toTimeLabel(getMovementTime(item.arrival)),
      durationMinutes,
      price: seatPricing.ECONOMY,
      seatPricing,
      seats: estimateSeats(`${flightNumber}-${travelDate}`),
    } satisfies FlightSearchResult;
  });
}
