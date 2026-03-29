"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import useSWR from "swr";
import {
  Activity,
  Clock3,
  PlaneLanding,
  PlaneTakeoff,
  Radio,
  RefreshCcw,
  TimerReset,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/demo-data";
import {
  DEFAULT_LIVE_BOARD_AIRPORT,
  getTrackedUsAirport,
  MAJOR_US_CARRIER_FILTERS,
  TOP_US_AIRPORTS,
  type LiveBoardFlight,
  type LiveBoardResponse,
  type LiveBoardType,
} from "@/lib/live-airspace";
import { cn } from "@/lib/utils";

const REFRESH_INTERVAL_MS = 4 * 60 * 1000;

async function fetchBoard(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
  });
  const payload = (await response.json()) as LiveBoardResponse & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || "Unable to load the live airspace board.");
  }

  return payload;
}

function formatAirportTime(value: string | null, timeZone: string) {
  if (!value) {
    return "TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(value));
}

function formatAirportTimestamp(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(value));
}

function getStatusClassName(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("active")) {
    return "border-emerald-400/30 bg-emerald-400/15 text-emerald-200";
  }

  if (normalized.includes("landed")) {
    return "border-sky-400/30 bg-sky-400/15 text-sky-200";
  }

  if (normalized.includes("cancel") || normalized.includes("divert") || normalized.includes("incident")) {
    return "border-rose-400/30 bg-rose-400/15 text-rose-200";
  }

  return "border-amber-400/30 bg-amber-400/15 text-amber-100";
}

function matchesCarrierFilter(flight: LiveBoardFlight, carrierFilterId: string) {
  if (carrierFilterId === "ALL") {
    return true;
  }

  const carrier = MAJOR_US_CARRIER_FILTERS.find((option) => option.id === carrierFilterId);

  if (!carrier) {
    return true;
  }

  const normalizedName = flight.carrierName.toLowerCase();

  return (
    carrier.codes.includes(flight.carrierCode.toUpperCase()) ||
    carrier.names.some((name) => normalizedName.includes(name))
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <Card className="border-white/10 bg-white/5 shadow-none backdrop-blur">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
          <p className="text-2xl font-semibold text-white">{value}</p>
          <p className="text-sm text-slate-400">{detail}</p>
        </div>
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

export function LiveAirspaceBoard({ role }: { role: "admin" | "agent" }) {
  const [selectedAirport, setSelectedAirport] = useState(DEFAULT_LIVE_BOARD_AIRPORT);
  const [boardType, setBoardType] = useState<LiveBoardType>("departure");
  const [carrierFilter, setCarrierFilter] = useState("ALL");

  const airport = getTrackedUsAirport(selectedAirport) ?? TOP_US_AIRPORTS[0];
  const query = `/api/flights?airport=${selectedAirport}&type=${boardType}`;
  const { data, error, isLoading, isValidating, mutate } = useSWR<LiveBoardResponse>(query, fetchBoard, {
    refreshInterval: REFRESH_INTERVAL_MS,
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  });
  const visibleFlights = (data?.flights ?? []).filter((flight) => matchesCarrierFilter(flight, carrierFilter));
  const delayedFlights = visibleFlights.filter((flight) => flight.delayMinutes > 0);
  const activeFlights = visibleFlights.filter((flight) => flight.status.toLowerCase().includes("active"));
  const totalEstimatedValue = visibleFlights.reduce(
    (sum, flight) => sum + flight.estimatedTicketValue,
    0
  );
  const averageDelayMinutes =
    delayedFlights.length === 0
      ? 0
      : Math.round(delayedFlights.reduce((sum, flight) => sum + flight.delayMinutes, 0) / delayedFlights.length);
  const heading =
    role === "admin"
      ? "Watch inbound and outbound flow at the largest US hubs, then relate live operations back to settlements and revenue exposure."
      : "Use the live board to gauge what is moving at the busiest US airports before you quote, book, or settle with the airline.";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Live US Airspace Board</h1>
        <p className="text-muted-foreground">{heading}</p>
      </div>

      <section className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.2),_transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:32px_32px]" />

        <div className="relative space-y-6 p-5 md:p-7">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/10">
                  AviationStack Secure Relay
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-300">
                  Refresh every 4 minutes
                </Badge>
                {isValidating ? (
                  <Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
                    Refreshing live feed
                  </Badge>
                ) : null}
              </div>

              <div>
                <h2 className="text-2xl font-semibold text-white">
                  {airport.city} {boardType === "departure" ? "Departures" : "Arrivals"}
                </h2>
                <p className="mt-1 max-w-3xl text-sm text-slate-300">
                  {airport.name}. {airport.spotlight}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 xl:items-end">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-cyan-200" />
                Local field time zone: {airport.timeZone.replace("_", " ")}
              </div>
              <div>
                Last sync:{" "}
                <span className="font-medium text-white">
                  {data ? formatAirportTimestamp(data.fetchedAt, airport.timeZone) : "Waiting for feed"}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void mutate()}
                className="border-white/15 bg-transparent text-slate-100 hover:bg-white/10 hover:text-white"
              >
                <RefreshCcw className={cn("mr-2 h-4 w-4", isValidating && "animate-spin")} />
                Refresh now
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(["departure", "arrival"] as LiveBoardType[]).map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant="ghost"
                  onClick={() => setBoardType(option)}
                  className={cn(
                    "rounded-full border px-4 text-sm transition-colors",
                    boardType === option
                      ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100 hover:bg-cyan-300/15"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {option === "departure" ? (
                    <PlaneTakeoff className="mr-2 h-4 w-4" />
                  ) : (
                    <PlaneLanding className="mr-2 h-4 w-4" />
                  )}
                  {option === "departure" ? "Departure board" : "Arrival board"}
                </Button>
              ))}
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              {TOP_US_AIRPORTS.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => setSelectedAirport(option.code)}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition-all",
                    selectedAirport === option.code
                      ? "border-cyan-300/40 bg-cyan-300/12 shadow-[0_0_24px_rgba(34,211,238,0.18)]"
                      : "border-white/8 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-white">{option.code}</span>
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{option.city}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{option.spotlight}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Carrier filter</span>
              {MAJOR_US_CARRIER_FILTERS.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant="ghost"
                  onClick={() => setCarrierFilter(option.id)}
                  className={cn(
                    "rounded-full border px-4 text-sm",
                    carrierFilter === option.id
                      ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-100 hover:bg-emerald-300/15"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
              <MetricCard
                label="Flights Visible"
                value={String(visibleFlights.length)}
                detail={`${boardType === "departure" ? "Outbound" : "Inbound"} records after carrier filtering`}
                icon={<Radio className="h-4 w-4" />}
              />
              <MetricCard
                label="Active"
                value={String(activeFlights.length)}
                detail="Currently operating live in AviationStack feed"
                icon={<Activity className="h-4 w-4" />}
              />
              <MetricCard
                label="Delay Load"
                value={delayedFlights.length === 0 ? "Clean" : `${averageDelayMinutes} min`}
                detail={
                  delayedFlights.length === 0
                    ? "No delayed movements in the filtered board"
                    : `${delayedFlights.length} delayed flights in view`
                }
                icon={<TimerReset className="h-4 w-4" />}
              />
              <MetricCard
                label="Est. Ticket Value"
                value={formatCurrency(totalEstimatedValue)}
                detail="Modeled fare value derived on the server for quick commercial context"
                icon={<PlaneTakeoff className="h-4 w-4" />}
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error.message}
            </div>
          ) : null}

          <div className="hidden overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Flight</th>
                    <th className="px-4 py-3 font-medium">Carrier</th>
                    <th className="px-4 py-3 font-medium">Route</th>
                    <th className="px-4 py-3 font-medium">Scheduled</th>
                    <th className="px-4 py-3 font-medium">Estimated</th>
                    <th className="px-4 py-3 font-medium">Gate</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Delay</th>
                    <th className="px-4 py-3 text-right font-medium">Est. Value</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && visibleFlights.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                        Loading live board...
                      </td>
                    </tr>
                  ) : null}
                  {!isLoading && visibleFlights.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                        No flights matched the current airport and carrier filters.
                      </td>
                    </tr>
                  ) : null}
                  {visibleFlights.map((flight) => (
                    <tr key={flight.id} className="border-b border-white/6 text-slate-200 transition-colors hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{flight.flightCode}</div>
                        <div className="text-xs text-slate-400">{flight.aircraft || "Aircraft pending"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{flight.carrierName}</div>
                        <div className="text-xs text-slate-400">{flight.carrierCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">
                          {flight.originCode} {boardType === "departure" ? "→" : "←"} {flight.destinationCode}
                        </div>
                        <div className="text-xs text-slate-400">
                          {boardType === "departure" ? flight.destinationName : flight.originName}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {formatAirportTime(flight.scheduledTime, airport.timeZone)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">
                          {formatAirportTime(flight.estimatedTime, airport.timeZone)}
                        </div>
                        <div className="text-xs text-slate-400">
                          {flight.actualTime ? `Actual ${formatAirportTime(flight.actualTime, airport.timeZone)}` : "Awaiting actual"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{flight.terminal ? `T${flight.terminal}` : "TBD"}</div>
                        <div className="text-xs text-slate-400">
                          {flight.gate ? `Gate ${flight.gate}` : flight.baggage ? `Baggage ${flight.baggage}` : "Gate pending"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn("border", getStatusClassName(flight.status))}>{flight.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {flight.delayMinutes > 0 ? `${flight.delayMinutes} min` : "On time"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white">
                        {formatCurrency(flight.estimatedTicketValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 md:hidden">
            {isLoading && visibleFlights.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                Loading live board...
              </div>
            ) : null}
            {!isLoading && visibleFlights.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                No flights matched the current airport and carrier filters.
              </div>
            ) : null}
            {visibleFlights.map((flight) => (
              <div key={flight.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">{flight.flightCode}</div>
                    <div className="text-sm text-slate-400">{flight.carrierName}</div>
                  </div>
                  <Badge className={cn("border", getStatusClassName(flight.status))}>{flight.status}</Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Route</div>
                    <div className="mt-1 font-medium text-white">
                      {flight.originCode} {boardType === "departure" ? "→" : "←"} {flight.destinationCode}
                    </div>
                    <div className="text-slate-400">
                      {boardType === "departure" ? flight.destinationName : flight.originName}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Timing</div>
                    <div className="mt-1 font-medium text-white">
                      {formatAirportTime(flight.scheduledTime, airport.timeZone)} / {formatAirportTime(flight.estimatedTime, airport.timeZone)}
                    </div>
                    <div className="text-slate-400">
                      {flight.delayMinutes > 0 ? `${flight.delayMinutes} min delay` : "On time"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Stand</div>
                    <div className="mt-1 text-white">
                      {flight.terminal ? `T${flight.terminal}` : "TBD"} {flight.gate ? `• Gate ${flight.gate}` : ""}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Est. Value</div>
                    <div className="mt-1 font-semibold text-white">{formatCurrency(flight.estimatedTicketValue)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
