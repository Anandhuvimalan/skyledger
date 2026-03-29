"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  MapPin,
  Plane,
  Search,
  Users,
} from "lucide-react";

import { SEAT_TYPES, parsePassengerCsv } from "@/lib/booking-passengers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatCurrency,
  getSeatTypeLabel,
  type FlightSearchResult,
  type SeatType,
} from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";
import { getTrackedUsAirport, TOP_US_AIRPORTS } from "@/lib/live-airspace";

interface PassengerDraft {
  fullName: string;
  passportId: string;
}

function getDefaultTravelDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createEmptyPassenger(): PassengerDraft {
  return {
    fullName: "",
    passportId: "",
  };
}

export default function BookFlightPage() {
  const router = useRouter();
  const bookFlight = useDemoStore((state) => state.bookFlight);

  const [isSearching, setIsSearching] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [bookedFlight, setBookedFlight] = useState<string | null>(null);
  const [searchSummary, setSearchSummary] = useState<string | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [selectedPassengers, setSelectedPassengers] = useState(1);
  const [selectedTravelDate, setSelectedTravelDate] = useState(getDefaultTravelDate());
  const [seatType, setSeatType] = useState<SeatType>("ECONOMY");
  const [origin, setOrigin] = useState("JFK");
  const [destination, setDestination] = useState("LAX");
  const [flights, setFlights] = useState<FlightSearchResult[]>([]);
  const [passengerManifest, setPassengerManifest] = useState<PassengerDraft[]>([
    createEmptyPassenger(),
  ]);

  useEffect(() => {
    setPassengerManifest((currentManifest) =>
      Array.from({ length: selectedPassengers }, (_, index) => currentManifest[index] ?? createEmptyPassenger())
    );
  }, [selectedPassengers]);

  const resetResults = (message?: string | null) => {
    setFlights([]);
    setShowResults(false);
    setSearchSummary(null);
    if (message !== undefined) {
      setSearchMessage(message);
    }
  };

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSearching(true);
    setSearchMessage(null);
    setShowResults(false);

    if (origin === destination) {
      setFlights([]);
      setSearchMessage("Choose different origin and destination airports.");
      setShowResults(true);
      setIsSearching(false);
      return;
    }

    try {
      const response = await fetch("/api/flights/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin,
          destination,
          travelDate: selectedTravelDate,
          passengers: selectedPassengers,
        }),
      });
      const payload = (await response.json()) as {
        flights?: FlightSearchResult[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to search live flights.");
      }

      const nextFlights = payload.flights ?? [];
      const originAirport = getTrackedUsAirport(origin);
      const destinationAirport = getTrackedUsAirport(destination);

      setFlights(nextFlights);
      setSearchSummary(
        `${origin} ${originAirport?.city ?? ""} to ${destination} ${destinationAirport?.city ?? ""} on ${selectedTravelDate} for ${selectedPassengers} passenger${selectedPassengers === 1 ? "" : "s"}`
      );
      setSearchMessage(
        nextFlights.length === 0
          ? "No live flights were returned for that route right now. Try another top-US-hub pair."
          : null
      );
      setShowResults(true);
    } catch (error) {
      setFlights([]);
      setSearchMessage(error instanceof Error ? error.message : "Unable to search live flights.");
      setShowResults(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePassengerCountChange = (value: string) => {
    const nextCount = Math.max(1, Math.min(25, Number(value) || 1));
    setSelectedPassengers(nextCount);
    resetResults(
      "Passenger count changed. Search again to refresh live pricing and seat availability."
    );
  };

  const updatePassenger = (index: number, field: keyof PassengerDraft, value: string) => {
    setPassengerManifest((currentManifest) =>
      currentManifest.map((passenger, passengerIndex) =>
        passengerIndex === index
          ? {
              ...passenger,
              [field]: field === "passportId" ? value.toUpperCase() : value,
            }
          : passenger
      )
    );
  };

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const rows = parsePassengerCsv(await file.text());

      if (rows.length === 0) {
        throw new Error("The CSV file is empty. Add passenger name and passport ID columns.");
      }

      if (rows.length > 25) {
        throw new Error("CSV import supports up to 25 passengers per booking.");
      }

      setSelectedPassengers(rows.length);
      setPassengerManifest(
        rows.map((row) => ({
          fullName: row.fullName,
          passportId: row.passportId,
        }))
      );
      resetResults(
        `Imported ${rows.length} passenger${rows.length === 1 ? "" : "s"} from CSV. Search again to refresh pricing for this manifest.`
      );
    } catch (error) {
      setSearchMessage(error instanceof Error ? error.message : "Unable to import passenger CSV.");
    } finally {
      event.target.value = "";
    }
  };

  const handleBook = async (flight: FlightSearchResult) => {
    const normalizedManifest = passengerManifest.map((passenger) => ({
      fullName: passenger.fullName.trim(),
      passportId: passenger.passportId.trim().toUpperCase(),
    }));

    if (normalizedManifest.some((passenger) => !passenger.fullName || !passenger.passportId)) {
      setSearchMessage("Enter every passenger name and passport ID before ticketing.");
      return;
    }

    if (selectedPassengers > flight.seats) {
      setSearchMessage(
        `Only ${flight.seats} seats are available on ${flight.flightNumber}. Reduce the passenger count or choose another flight.`
      );
      return;
    }

    setBookedFlight(flight.id);
    setIsBooking(true);
    setSearchMessage(null);

    try {
      const { ticketNumber } = await bookFlight({
        flight,
        travelDate: selectedTravelDate,
        passengers: selectedPassengers,
        seatType,
        passengerManifest: normalizedManifest,
      });
      router.push(`/agent/bookings?created=${encodeURIComponent(ticketNumber)}`);
    } catch (error) {
      setBookedFlight(null);
      setSearchMessage(error instanceof Error ? error.message : "Unable to create booking.");
    } finally {
      setIsBooking(false);
    }
  };

  const swapAirports = () => {
    setOrigin(destination);
    setDestination(origin);
    resetResults(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Book a Flight</h1>
        <p className="mt-1 text-muted-foreground">
          Search a live AviationStack route, capture the full passenger manifest, then ticket the booking into settlement.
        </p>
      </div>

      <Card className="border-0 bg-card/50 shadow-lg backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            Flight Search
          </CardTitle>
          <CardDescription>
            Booking now requires passenger names, passport IDs, and a seat cabin so customer bills can be generated per traveler.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_1fr_1fr_1fr]">
              <div className="space-y-2">
                <Label htmlFor="origin" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Origin
                </Label>
                <select
                  id="origin"
                  name="origin"
                  value={origin}
                  onChange={(event) => {
                    setOrigin(event.target.value);
                    resetResults(null);
                  }}
                  className="h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm"
                >
                  {TOP_US_AIRPORTS.map((airport) => (
                    <option key={airport.code} value={airport.code}>
                      {airport.code} - {airport.city}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end justify-center lg:justify-start">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={swapAirports}
                  aria-label="Swap origin and destination"
                  className="h-10 w-10 shrink-0"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Destination
                </Label>
                <select
                  id="destination"
                  name="destination"
                  value={destination}
                  onChange={(event) => {
                    setDestination(event.target.value);
                    resetResults(null);
                  }}
                  className="h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm"
                >
                  {TOP_US_AIRPORTS.map((airport) => (
                    <option key={airport.code} value={airport.code}>
                      {airport.code} - {airport.city}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Departure Date
                </Label>
                <Input
                  type="date"
                  id="date"
                  name="date"
                  required
                  className="bg-background/50"
                  value={selectedTravelDate}
                  onChange={(event) => {
                    setSelectedTravelDate(event.target.value);
                    resetResults(null);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="passengers" className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Passengers
                </Label>
                <Input
                  type="number"
                  id="passengers"
                  name="passengers"
                  min="1"
                  max="25"
                  value={selectedPassengers}
                  onChange={(event) => handlePassengerCountChange(event.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seatType" className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-muted-foreground" />
                  Seat Cabin
                </Label>
                <select
                  id="seatType"
                  name="seatType"
                  value={seatType}
                  onChange={(event) => setSeatType(event.target.value as SeatType)}
                  className="h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm"
                >
                  {SEAT_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {getSeatTypeLabel(value)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Passenger Manifest</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter each passenger name and passport ID, or import a CSV with `fullName,passportId`.
                  </p>
                </div>
                <div className="w-full max-w-sm space-y-1">
                  <Label htmlFor="passengerCsv" className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <FileSpreadsheet className="h-4 w-4" />
                    Import CSV
                  </Label>
                  <Input
                    id="passengerCsv"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => void handleCsvImport(event)}
                    className="bg-background/70"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {passengerManifest.map((passenger, index) => (
                  <div key={`passenger-${index + 1}`} className="rounded-xl border bg-background/70 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="font-medium">Passenger {index + 1}</div>
                      <Badge variant="outline">{getSeatTypeLabel(seatType)}</Badge>
                    </div>
                    <div className="grid gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`passenger-name-${index}`}>Full Name</Label>
                        <Input
                          id={`passenger-name-${index}`}
                          value={passenger.fullName}
                          onChange={(event) => updatePassenger(index, "fullName", event.target.value)}
                          placeholder="Passenger full name"
                          className="bg-background/80"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`passenger-passport-${index}`}>Passport ID</Label>
                        <Input
                          id={`passenger-passport-${index}`}
                          value={passenger.passportId}
                          onChange={(event) => updatePassenger(index, "passportId", event.target.value)}
                          placeholder="Passport number"
                          className="bg-background/80"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-dashed bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                Seat numbers are auto-assigned after ticketing. Customer bills will be created per passenger with their name, passport ID, seat number, seat cabin, and charge amount.
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={isSearching}
                className="group relative w-full overflow-hidden md:w-auto"
              >
                <span
                  className={`flex items-center gap-2 transition-all ${
                    isSearching ? "opacity-0" : "opacity-100"
                  }`}
                >
                  <Search className="h-4 w-4" />
                  Search Flights
                </span>
                {isSearching ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  </div>
                ) : null}
              </Button>
            </div>
          </form>

          {searchMessage ? (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
              {searchMessage}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {showResults ? (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              Available Flights <Badge variant="secondary">{flights.length} results</Badge>
            </h2>
            {searchSummary ? <p className="text-sm text-muted-foreground">{searchSummary}</p> : null}
          </div>

          <div className="grid gap-4">
            {flights.map((flight) => {
              const selectedCabinPrice = flight.seatPricing[seatType];
              const hasEnoughSeats = flight.seats >= selectedPassengers;

              return (
                <Card
                  key={flight.id}
                  className={`border-l-4 transition-all duration-300 hover:shadow-md ${
                    hasEnoughSeats ? "border-l-primary" : "border-l-amber-500"
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex-1">
                        <div className="mb-2 text-lg font-semibold text-primary">{flight.airline}</div>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold">{flight.departureTime}</div>
                            <div className="text-sm font-medium text-muted-foreground">{flight.origin}</div>
                          </div>

                          <div className="relative flex flex-1 flex-col items-center justify-center px-4">
                            <div className="mb-1 text-xs text-muted-foreground">
                              {Math.floor(flight.durationMinutes / 60)}h {flight.durationMinutes % 60}m
                            </div>
                            <div className="h-[2px] w-full bg-border">
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2">
                                <Plane className="h-4 w-4 rotate-90 text-muted-foreground" />
                              </div>
                            </div>
                            <div className="mt-1 text-xs font-medium text-emerald-600">Direct</div>
                          </div>

                          <div className="text-center">
                            <div className="text-2xl font-bold">{flight.arrivalTime}</div>
                            <div className="text-sm font-medium text-muted-foreground">{flight.destination}</div>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-[320px] space-y-4 border-t pt-4 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
                        <div>
                          <div className="text-sm text-muted-foreground">Cabin pricing for this flight</div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            {SEAT_TYPES.map((value) => (
                              <div
                                key={`${flight.id}-${value}`}
                                className={`rounded-xl border p-3 ${
                                  seatType === value
                                    ? "border-primary bg-primary/10"
                                    : "border-border bg-background/80"
                                }`}
                              >
                                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                  {getSeatTypeLabel(value)}
                                </div>
                                <div className="mt-2 text-lg font-semibold">
                                  {formatCurrency(flight.seatPricing[value])}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl border bg-muted/30 p-4">
                          <div className="text-sm text-muted-foreground">Selected cabin total</div>
                          <div className="mt-1 text-3xl font-bold tracking-tight">
                            {formatCurrency(selectedCabinPrice)}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {getSeatTypeLabel(seatType)} for {selectedPassengers} passenger
                            {selectedPassengers === 1 ? "" : "s"}
                          </div>
                          <div
                            className={`mt-2 text-xs font-medium ${
                              hasEnoughSeats ? "text-emerald-600" : "text-amber-600"
                            }`}
                          >
                            {hasEnoughSeats
                              ? `${flight.seats} seats currently available`
                              : `Only ${flight.seats} seats available for this request`}
                          </div>
                        </div>

                        {bookedFlight === flight.id ? (
                          <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {isBooking ? "Ticketing..." : "Ticketed"}
                          </Button>
                        ) : (
                          <Button
                            className="w-full"
                            onClick={() => void handleBook(flight)}
                            disabled={isBooking || !hasEnoughSeats}
                          >
                            {hasEnoughSeats ? `Book ${getSeatTypeLabel(seatType)}` : "Not Enough Seats"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
