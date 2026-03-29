export type AppRole = "ADMIN" | "AGENT";
export type AccountType = "ASSET" | "LIABILITY" | "REVENUE" | "EXPENSE";
export type AgentStatus = "ACTIVE" | "SUSPENDED";
export type BookingPaymentStatus = "UNPAID" | "PAID" | "OVERDUE";
export type RevenueStatus = "DEFERRED" | "RECOGNIZED";
export type InvoiceStatus = "DRAFT" | "UNPAID" | "PAID" | "OVERDUE";
export type JournalStatus = "DRAFT" | "POSTED";
export type PaymentStatus = "PENDING" | "SETTLED";
export type PaymentMethod = "CARD" | "UATP" | "ACH";
export type SeatType = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS";
export type SeatPricing = Record<SeatType, number>;

export interface CurrentUser {
  id: string;
  role: AppRole;
  name: string;
  email?: string;
  arcNumber?: string;
}

export interface GlAccount {
  id: string;
  accountNumber: string;
  name: string;
  type: AccountType;
  balance: number;
}

export interface TravelAgent {
  id: string;
  name: string;
  arcNumber: string;
  email: string;
  annualVolume: number;
  tier: "Tier 1" | "Tier 2" | "Tier 3";
  overrideRate: number;
  status: AgentStatus;
}

export interface Booking {
  id: string;
  agentId: string;
  airlineId: string;
  ticketNumber: string;
  pnr: string;
  travelerName: string;
  seatType: SeatType;
  origin: string;
  destination: string;
  bookingDate: string;
  flightDate: string;
  baseFare: number;
  taxes: number;
  passengers: number;
  commissionRate: number;
  paymentStatus: BookingPaymentStatus;
  revenueStatus: RevenueStatus;
  invoiceId?: string;
}

export interface BookingPassenger {
  id: string;
  bookingId: string;
  sequence: number;
  fullName: string;
  passportId: string;
  seatType: SeatType;
  seatNumber: string;
  baseFare: number;
  taxes: number;
  totalAmount: number;
}

export interface Invoice {
  id: string;
  agentId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  commissionCredit: number;
  taxes: number;
  totalDue: number;
  balanceDue: number;
  status: InvoiceStatus;
  bookingIds: string[];
}

export interface Payment {
  id: string;
  agentId: string;
  invoiceId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  cardLastFour: string;
  status: PaymentStatus;
}

export interface JournalLine {
  accountNumber: string;
  name: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  reference: string;
  status: JournalStatus;
  lines: JournalLine[];
}

export interface RevenueRule {
  id: string;
  name: string;
  trigger: string;
  debitAccount: string;
  creditAccount: string;
  lastRun: string;
}

export interface FlightSearchResult {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  price: number;
  seatPricing: SeatPricing;
  seats: number;
}

export interface AppState {
  currentUser: CurrentUser | null;
  currentAgentId?: string;
  nowIso: string;
  accounts: GlAccount[];
  agents: TravelAgent[];
  bookings: Booking[];
  bookingPassengers: BookingPassenger[];
  invoices: Invoice[];
  payments: Payment[];
  journals: JournalEntry[];
  revenueRules: RevenueRule[];
}

export interface FlightSearchInput {
  origin: string;
  destination: string;
  travelDate: string;
  passengers: number;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatShortDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatRoute(origin: string, destination: string) {
  return `${origin}-${destination}`;
}

export function getSeatTypeLabel(seatType: SeatType) {
  switch (seatType) {
    case "PREMIUM_ECONOMY":
      return "Premium Economy";
    case "BUSINESS":
      return "Business";
    default:
      return "Economy";
  }
}

export function normalizeAirportInput(value: string) {
  const [code] = value.trim().toUpperCase().split(/[\s-]+/);
  return code || "JFK";
}

export function getTodayDateString() {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

export function getInvoiceStatus(
  invoice: Pick<Invoice, "status" | "balanceDue" | "dueDate">,
  nowDate = getTodayDateString()
) {
  if (invoice.balanceDue <= 0) {
    return "PAID" satisfies InvoiceStatus;
  }

  if (invoice.status === "DRAFT") {
    return "DRAFT" satisfies InvoiceStatus;
  }

  if (invoice.dueDate < nowDate) {
    return "OVERDUE" satisfies InvoiceStatus;
  }

  return "UNPAID" satisfies InvoiceStatus;
}

export function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function nextInvoiceNumber(existingNumbers: string[]) {
  const largest = existingNumbers
    .map((number) => Number(number.split("-").pop()))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 0);

  return `INV-${String(largest + 1).padStart(10, "0")}`;
}

export function nextJournalId(existingIds: string[]) {
  const largest = existingIds
    .map((id) => Number(id.replace("JE-", "")))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 0);

  return `JE-${String(largest + 1).padStart(6, "0")}`;
}

export function createRecordId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getAgentById(state: Pick<AppState, "agents">, agentId?: string) {
  if (!agentId) {
    return undefined;
  }

  return state.agents.find((agent) => agent.id === agentId);
}

export function getCurrentAgent(state: Pick<AppState, "agents" | "currentAgentId">) {
  return getAgentById(state, state.currentAgentId);
}

export function getAgentBookings(state: Pick<AppState, "bookings">, agentId?: string) {
  if (!agentId) {
    return [];
  }

  return state.bookings.filter((booking) => booking.agentId === agentId);
}

export function getBookingPassengers(
  state: Pick<AppState, "bookingPassengers">,
  bookingId?: string
) {
  if (!bookingId) {
    return [];
  }

  return state.bookingPassengers.filter((passenger) => passenger.bookingId === bookingId);
}

export function getAgentInvoices(state: Pick<AppState, "invoices">, agentId?: string) {
  if (!agentId) {
    return [];
  }

  return state.invoices.filter((invoice) => invoice.agentId === agentId);
}

export function getAgentPayments(state: Pick<AppState, "payments">, agentId?: string) {
  if (!agentId) {
    return [];
  }

  return state.payments.filter((payment) => payment.agentId === agentId);
}

export function getInvoiceById(state: Pick<AppState, "invoices">, invoiceId?: string) {
  if (!invoiceId) {
    return undefined;
  }

  return state.invoices.find((invoice) => invoice.id === invoiceId);
}

export function getBookingGross(booking: Booking) {
  return Number((booking.baseFare + booking.taxes).toFixed(2));
}

export function getBookingCommission(booking: Booking) {
  return Number((booking.baseFare * booking.commissionRate).toFixed(2));
}

export function getBookingNetDue(booking: Booking) {
  return Number((getBookingGross(booking) - getBookingCommission(booking)).toFixed(2));
}

export function calculateInvoiceAmounts(bookings: Booking[]) {
  const subtotal = Number(
    bookings.reduce((sum, booking) => sum + getBookingGross(booking), 0).toFixed(2)
  );
  const commissionCredit = Number(
    bookings.reduce((sum, booking) => sum + getBookingCommission(booking), 0).toFixed(2)
  );
  const taxes = Number(
    bookings.reduce((sum, booking) => sum + booking.taxes, 0).toFixed(2)
  );
  const totalDue = Number((subtotal - commissionCredit).toFixed(2));

  return {
    subtotal,
    commissionCredit,
    taxes,
    totalDue,
  };
}

export function getBookingSettlementStatus(
  booking: Booking,
  invoice?: Invoice,
  nowDate = getTodayDateString()
) {
  if (!invoice) {
    return "PENDING_BATCH" as const;
  }

  return getInvoiceStatus(invoice, nowDate);
}

export function getPendingSettlementBookings(state: AppState) {
  return state.bookings.filter(
    (booking) =>
      getBookingSettlementStatus(booking, getInvoiceById(state, booking.invoiceId), state.nowIso.slice(0, 10)) ===
      "PENDING_BATCH"
  );
}

export function buildRevenueChartData(bookings: Booking[]) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - (5 - index));
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date),
    };
  });

  return months.map(({ key, label }) => {
    const monthBookings = bookings.filter((booking) => booking.flightDate.slice(0, 7) === key);

    return {
      name: label,
      recognized: Number(
        monthBookings
          .filter((booking) => booking.revenueStatus === "RECOGNIZED")
          .reduce((sum, booking) => sum + booking.baseFare, 0)
          .toFixed(2)
      ),
      deferred: Number(
        monthBookings
          .filter((booking) => booking.revenueStatus === "DEFERRED")
          .reduce((sum, booking) => sum + booking.baseFare, 0)
          .toFixed(2)
      ),
    };
  });
}
