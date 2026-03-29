export type LiveBoardType = "departure" | "arrival";

export interface TrackedUsAirport {
  code: string;
  city: string;
  name: string;
  timeZone: string;
  spotlight: string;
}

export const TOP_US_AIRPORTS: TrackedUsAirport[] = [
  {
    code: "ATL",
    city: "Atlanta",
    name: "Hartsfield-Jackson Atlanta International",
    timeZone: "America/New_York",
    spotlight: "The country's busiest connection hub and a strong Delta operation center.",
  },
  {
    code: "DFW",
    city: "Dallas-Fort Worth",
    name: "Dallas/Fort Worth International",
    timeZone: "America/Chicago",
    spotlight: "American Airlines' largest fortress hub with heavy domestic and long-haul flow.",
  },
  {
    code: "DEN",
    city: "Denver",
    name: "Denver International",
    timeZone: "America/Denver",
    spotlight: "Mountain west throughput with dense United and Southwest traffic.",
  },
  {
    code: "ORD",
    city: "Chicago",
    name: "O'Hare International",
    timeZone: "America/Chicago",
    spotlight: "Major United and American gateway with constant arrival and departure churn.",
  },
  {
    code: "LAX",
    city: "Los Angeles",
    name: "Los Angeles International",
    timeZone: "America/Los_Angeles",
    spotlight: "Pacific-facing long-haul gateway with dense domestic bank structures.",
  },
  {
    code: "JFK",
    city: "New York",
    name: "John F. Kennedy International",
    timeZone: "America/New_York",
    spotlight: "Premium international gateway with strong Delta, American, and JetBlue traffic.",
  },
  {
    code: "LAS",
    city: "Las Vegas",
    name: "Harry Reid International",
    timeZone: "America/Los_Angeles",
    spotlight: "High-volume leisure airport with fast Southwest and ultra-low-cost turnover.",
  },
  {
    code: "MCO",
    city: "Orlando",
    name: "Orlando International",
    timeZone: "America/New_York",
    spotlight: "Theme-park demand center with strong family and leisure traffic waves.",
  },
  {
    code: "CLT",
    city: "Charlotte",
    name: "Charlotte Douglas International",
    timeZone: "America/New_York",
    spotlight: "American hub bank operations with heavy southeast connectivity.",
  },
  {
    code: "MIA",
    city: "Miami",
    name: "Miami International",
    timeZone: "America/New_York",
    spotlight: "Primary Latin America gateway with meaningful international arrival swings.",
  },
];

export const DEFAULT_LIVE_BOARD_AIRPORT = "JFK";

const trackedAirportLookup = new Map(
  TOP_US_AIRPORTS.map((airport) => [airport.code, airport] as const)
);

export function getTrackedUsAirport(code: string) {
  return trackedAirportLookup.get(code.trim().toUpperCase()) ?? null;
}

export function isTrackedUsAirport(code: string) {
  return getTrackedUsAirport(code) !== null;
}

export interface CarrierFilterOption {
  id: string;
  label: string;
  codes: string[];
  names: string[];
}

export const MAJOR_US_CARRIER_FILTERS: CarrierFilterOption[] = [
  {
    id: "ALL",
    label: "All carriers",
    codes: [],
    names: [],
  },
  {
    id: "AA",
    label: "American",
    codes: ["AA", "AAL"],
    names: ["american airlines", "american"],
  },
  {
    id: "DL",
    label: "Delta",
    codes: ["DL", "DAL"],
    names: ["delta air lines", "delta"],
  },
  {
    id: "UA",
    label: "United",
    codes: ["UA", "UAL"],
    names: ["united airlines", "united"],
  },
  {
    id: "WN",
    label: "Southwest",
    codes: ["WN", "SWA"],
    names: ["southwest airlines", "southwest"],
  },
];

export interface LiveBoardFlight {
  id: string;
  boardType: LiveBoardType;
  flightCode: string;
  carrierName: string;
  carrierCode: string;
  originCode: string;
  originName: string;
  destinationCode: string;
  destinationName: string;
  scheduledTime: string | null;
  estimatedTime: string | null;
  actualTime: string | null;
  terminal: string | null;
  gate: string | null;
  baggage: string | null;
  status: string;
  delayMinutes: number;
  aircraft: string | null;
  estimatedTicketValue: number;
}

export interface LiveBoardResponse {
  airportCode: string;
  airportName: string;
  city: string;
  timeZone: string;
  boardType: LiveBoardType;
  fetchedAt: string;
  cachedUntil: string;
  flights: LiveBoardFlight[];
}
