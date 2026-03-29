import type { SessionUser } from "@/lib/server/auth";
import { buildAppState, bookFlight, recordPayment } from "@/lib/server/state";
import { formatCurrency, formatRoute, getSeatTypeLabel, type SeatType } from "@/lib/demo-data";
import { searchLiveFlights } from "@/lib/server/aviationstack";

export interface CopilotReply {
  reply: string;
  refreshState?: boolean;
}

function extractFlightSearch(message: string) {
  const dateMatch = message.match(/\b\d{4}-\d{2}-\d{2}\b/);
  const airportMatches = message.toUpperCase().match(/\b[A-Z]{3}\b/g) ?? [];
  const passengersMatch = message.match(/(\d+)\s*(passenger|pax|traveler|travellers?)/i);
  const [origin, destination] = airportMatches;

  if (!origin || !destination || !dateMatch) {
    return null;
  }

  return {
    origin,
    destination,
    travelDate: dateMatch[0],
    passengers: passengersMatch ? Number(passengersMatch[1]) : 1,
  };
}

function buildAgentContext(session: SessionUser) {
  const state = buildAppState(session);
  const openInvoices = state.invoices.filter((invoice) => invoice.balanceDue > 0);
  const outstanding = openInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);
  const recentBookings = state.bookings.slice(0, 5).map((booking) => ({
    ticketNumber: booking.ticketNumber,
    route: formatRoute(booking.origin, booking.destination),
    flightDate: booking.flightDate,
    netDue: formatCurrency(booking.baseFare + booking.taxes - booking.baseFare * booking.commissionRate),
    paymentStatus: booking.paymentStatus,
    revenueStatus: booking.revenueStatus,
  }));

  return {
    summary: [
      `Agent: ${session.name}`,
      `ARC: ${session.arcNumber ?? "N/A"}`,
      `Open invoices: ${openInvoices.length}`,
      `Outstanding balance: ${formatCurrency(outstanding)}`,
    ].join("\n"),
    recentBookings,
  };
}

function extractTravelerName(message: string) {
  const explicitMatch = message.match(
    /(?:traveler|traveller|passenger)(?:\s+name)?(?:\s+is)?\s*[:=-]?\s*([A-Za-z][A-Za-z .'-]{1,80})/i
  );

  if (explicitMatch?.[1]) {
    return explicitMatch[1].trim();
  }

  const trailingMatch = message.match(/\bfor\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){1,3})$/);
  return trailingMatch?.[1]?.trim() ?? null;
}

function extractPassportId(message: string) {
  const explicitMatch = message.match(
    /(?:passport|passport\s+id|passport\s+number)(?:\s+is)?\s*[:=-]?\s*([A-Za-z0-9-]{4,20})/i
  );

  return explicitMatch?.[1]?.trim().toUpperCase() ?? null;
}

function extractSeatType(message: string): SeatType {
  const normalized = message.toLowerCase();

  if (normalized.includes("business")) {
    return "BUSINESS";
  }

  if (normalized.includes("premium economy") || normalized.includes("premium")) {
    return "PREMIUM_ECONOMY";
  }

  return "ECONOMY";
}

async function maybeHandleAgentAction(
  session: SessionUser,
  message: string
): Promise<CopilotReply | null> {
  if (session.role !== "AGENT") {
    return null;
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("book")) {
    const flightSearch = extractFlightSearch(message);
    const travelerName = extractTravelerName(message);
    const passportId = extractPassportId(message);
    const seatType = extractSeatType(message);

    if (!flightSearch || !travelerName || !passportId) {
      return {
        reply:
          "To book with copilot, say: Book JFK to LAX on YYYY-MM-DD for 1 passenger. Traveler name: John Doe. Passport: P1234567.",
      };
    }

    if (flightSearch.passengers !== 1) {
      return {
        reply:
          "Copilot can only ticket one passenger at a time right now. Use the booking page for multi-passenger manifests and CSV import.",
      };
    }

    const liveFlights = await searchLiveFlights(flightSearch);

    if (liveFlights.length === 0) {
      return {
        reply: "No matching live flights were found for that route and date, so nothing was booked.",
      };
    }

    const selectedFlight = liveFlights[0];
    const result = bookFlight(session, {
      flight: selectedFlight,
      travelDate: flightSearch.travelDate,
      passengers: flightSearch.passengers,
      seatType,
      passengerManifest: [
        {
          fullName: travelerName,
          passportId,
        },
      ],
    });

    return {
      reply: `Booked ${travelerName} on ${selectedFlight.airline} ${selectedFlight.flightNumber} in ${getSeatTypeLabel(seatType)}. Ticket ${result.ticketNumber} was issued and added to ${result.invoiceNumber ?? "a new invoice"}.`,
      refreshState: true,
    };
  }

  if (normalized.includes("pay")) {
    const state = buildAppState(session);
    const openInvoices = [...state.invoices]
      .filter((invoice) => invoice.balanceDue > 0)
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate));

    if (openInvoices.length === 0) {
      return { reply: "There are no open invoices to pay right now." };
    }

    const invoiceNumberMatch = message.match(/\bINV-[A-Z0-9-]+\b/i)?.[0]?.toUpperCase();
    const invoice =
      openInvoices.find((item) => item.invoiceNumber.toUpperCase() === invoiceNumberMatch) ??
      openInvoices[0];
    const explicitAmountMatch =
      message.match(/\bpay\s+\$?(\d+(?:\.\d{1,2})?)/i) ??
      message.match(/\bamount\s+\$?(\d+(?:\.\d{1,2})?)/i);
    const requestedAmount = explicitAmountMatch ? Number(explicitAmountMatch[1]) : invoice.balanceDue;
    const result = recordPayment(session, {
      invoiceId: invoice.id,
      amount: requestedAmount,
      paymentMethod: "CARD",
      cardLastFour: "0000",
    });

    if (result.applied <= 0) {
      return {
        reply: `No payment was applied to ${invoice.invoiceNumber}. Its remaining balance is ${formatCurrency(invoice.balanceDue)}.`,
      };
    }

    return {
      reply:
        result.remainingBalance === 0
          ? `Applied ${formatCurrency(result.applied)} to ${invoice.invoiceNumber}. The invoice is now fully paid.`
          : `Applied ${formatCurrency(result.applied)} to ${invoice.invoiceNumber}. Remaining balance: ${formatCurrency(result.remainingBalance)}.`,
      refreshState: true,
    };
  }

  return null;
}

function buildAdminContext(session: SessionUser) {
  const state = buildAppState(session);
  const totalRecognizedRevenue = state.bookings
    .filter((booking) => booking.revenueStatus === "RECOGNIZED")
    .reduce((sum, booking) => sum + booking.baseFare, 0);
  const totalDeferredRevenue = state.bookings
    .filter((booking) => booking.revenueStatus === "DEFERRED")
    .reduce((sum, booking) => sum + booking.baseFare, 0);
  const outstandingReceivables = state.invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);
  const topAgencies = state.agents.slice(0, 5).map((agent) => {
    const openBalance = state.invoices
      .filter((invoice) => invoice.agentId === agent.id)
      .reduce((sum, invoice) => sum + invoice.balanceDue, 0);

    return {
      agent: agent.name,
      arcNumber: agent.arcNumber,
      openBalance: formatCurrency(openBalance),
    };
  });

  return {
    summary: [
      `Admin: ${session.name}`,
      `Recognized revenue: ${formatCurrency(totalRecognizedRevenue)}`,
      `Deferred revenue: ${formatCurrency(totalDeferredRevenue)}`,
      `Open receivables: ${formatCurrency(outstandingReceivables)}`,
      `Active agencies: ${state.agents.filter((agent) => agent.status === "ACTIVE").length}`,
    ].join("\n"),
    topAgencies,
  };
}

function getSystemInstruction(session: SessionUser) {
  if (session.role === "AGENT") {
    return [
      "You are the SkyLedger Agent Copilot.",
      "You help travel agents with flight search summaries, bookings guidance, invoice balances, and payments owed to the airline.",
      "Never answer internal airline security topics, internal codes, secrets, or engineering instructions.",
      "Keep answers practical, short, and action-oriented.",
    ].join(" ");
  }

  return [
    "You are the SkyLedger Admin Copilot.",
    "You help airline finance admins understand revenue, deferred revenue, receivables, travel-agent balances, journals, and settlements.",
    "Do not answer secret-management, internal security, or unrelated coding questions.",
    "Keep answers concise and grounded in the live app data provided.",
  ].join(" ");
}

export async function askCopilot(session: SessionUser, message: string): Promise<CopilotReply> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const agentAction = await maybeHandleAgentAction(session, message);

  if (agentAction) {
    return agentAction;
  }

  const roleContext =
    session.role === "AGENT" ? buildAgentContext(session) : buildAdminContext(session);

  let augmentedFlightContext = "";
  const flightSearch = session.role === "AGENT" ? extractFlightSearch(message) : null;

  if (flightSearch) {
    try {
      const liveFlights = await searchLiveFlights(flightSearch);
      if (liveFlights.length > 0) {
        augmentedFlightContext = `Live flight options:\n${liveFlights
          .slice(0, 5)
          .map(
            (flight) =>
              `- ${flight.airline} ${flight.flightNumber} ${flight.origin}-${flight.destination} ${flight.departureTime}-${flight.arrivalTime}, ${formatCurrency(flight.price)}, seats ${flight.seats}`
          )
          .join("\n")}`;
      }
    } catch {
      augmentedFlightContext = "";
    }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: getSystemInstruction(session) }],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  roleContext.summary,
                  `Structured context: ${JSON.stringify(roleContext, null, 2)}`,
                  augmentedFlightContext,
                  `User request: ${message}`,
                ]
                  .filter(Boolean)
                  .join("\n\n"),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 700,
        },
      }),
      cache: "no-store",
    }
  );

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
    error?: { message?: string };
  };

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message || "Copilot could not generate a response.");
  }

  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";

  if (!text) {
    throw new Error("Copilot returned an empty response.");
  }

  return { reply: text };
}
