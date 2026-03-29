import { randomUUID } from "node:crypto";

import type {
  AppState,
  Booking,
  BookingPassenger,
  FlightSearchResult,
  GlAccount,
  Invoice,
  JournalEntry,
  Payment,
  RevenueRule,
  SeatType,
  TravelAgent,
} from "@/lib/demo-data";
import {
  addDays,
  calculateInvoiceAmounts,
  createRecordId,
  formatRoute,
  getBookingCommission,
  getBookingGross,
  getBookingNetDue,
  getInvoiceStatus,
  nextInvoiceNumber,
  nextJournalId,
} from "@/lib/demo-data";
import {
  allocateAmountByCount,
  assignSeatNumbers,
  buildSeatPricing,
} from "@/lib/booking-passengers";
import type { SessionUser } from "@/lib/server/auth";
import { getDatabase, withTransaction } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/security";
import { retrieveStripeCheckoutPayment } from "@/lib/server/stripe";

type AccountRow = {
  id: string;
  account_number: string;
  account_name: string;
  account_type: GlAccount["type"];
  normal_balance: "DEBIT" | "CREDIT";
  debit_total: number | null;
  credit_total: number | null;
};

type AgentRow = {
  id: string;
  agency_name: string;
  arc_number: string;
  contact_email: string;
  annual_volume: number | null;
  commission_tier: TravelAgent["tier"];
  override_rate: number | null;
  status: TravelAgent["status"];
};

type BookingRow = {
  id: string;
  travel_agent_id: string;
  airline_id: string;
  ticket_number: string;
  pnr: string;
  passenger_name: string;
  seat_type: Booking["seatType"] | null;
  route_origin: string;
  route_destination: string;
  booking_date: string;
  flight_date: string;
  passenger_count: number;
  base_fare: number;
  taxes_fees: number;
  total_amount: number;
  commission_rate: number;
  payment_status: Booking["paymentStatus"];
  revenue_status: Booking["revenueStatus"];
  invoice_id: string | null;
};

type BookingPassengerRow = {
  id: string;
  booking_id: string;
  passenger_sequence: number;
  full_name: string;
  passport_id: string;
  seat_type: BookingPassenger["seatType"];
  seat_number: string;
  base_fare: number;
  taxes_fees: number;
  total_amount: number;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  travel_agent_id: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  commission_offset: number;
  taxes: number;
  total_due: number;
  status: Invoice["status"];
};

type PaymentRow = {
  id: string;
  invoice_id: string;
  travel_agent_id: string;
  payment_date: string;
  amount: number;
  payment_method: Payment["paymentMethod"];
  card_last_four: string | null;
  status: Payment["status"];
};

type JournalRow = {
  id: string;
  entry_date: string;
  description: string | null;
  reference_number: string | null;
  status: JournalEntry["status"];
};

type JournalLineRow = {
  journal_entry_id: string;
  account_number: string;
  account_name: string;
  debit_amount: number;
  credit_amount: number;
};

type RevenueRuleRow = {
  id: string;
  rule_name: string;
  recognition_trigger: string;
  debit_account_number: string;
  debit_account_name: string;
  credit_account_number: string;
  credit_account_name: string;
  last_run: string | null;
};

function assertAdmin(session: SessionUser) {
  if (session.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
}

function assertAgent(session: SessionUser) {
  if (session.role !== "AGENT") {
    throw new Error("FORBIDDEN");
  }
}

function getTodayDateString() {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

function getNowIso() {
  return new Date().toISOString();
}

function toDateOnly(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function makePnr() {
  return randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
}

function normalizePassengerManifest(
  passengerManifest: Array<{ fullName: string; passportId: string }>,
  passengers: number
) {
  const normalized = passengerManifest.map((passenger) => ({
    fullName: passenger.fullName.trim(),
    passportId: passenger.passportId.trim().toUpperCase(),
  }));

  if (normalized.length !== passengers) {
    throw new Error("Passenger manifest must match the passenger count.");
  }

  if (normalized.some((passenger) => !passenger.fullName || !passenger.passportId)) {
    throw new Error("Every passenger must include a full name and passport ID.");
  }

  return normalized;
}

function createLegacyPassengerRows(booking: Booking) {
  const seatNumbers = assignSeatNumbers(booking.seatType, booking.passengers, booking.ticketNumber);
  const baseFareShares = allocateAmountByCount(booking.baseFare, booking.passengers);
  const taxShares = allocateAmountByCount(booking.taxes, booking.passengers);

  return Array.from({ length: booking.passengers }, (_, index) => ({
    id: `legacy-${booking.id}-${index + 1}`,
    bookingId: booking.id,
    sequence: index + 1,
    fullName: index === 0 ? booking.travelerName : `Passenger ${index + 1}`,
    passportId: "PENDING",
    seatType: booking.seatType,
    seatNumber: seatNumbers[index],
    baseFare: baseFareShares[index],
    taxes: taxShares[index],
    totalAmount: Number((baseFareShares[index] + taxShares[index]).toFixed(2)),
  }) satisfies BookingPassenger);
}

function getAccountIdByNumber(accountNumber: string) {
  const row = getDatabase()
    .prepare('SELECT id FROM "GlAccount" WHERE account_number = ?')
    .get(accountNumber) as { id: string } | undefined;

  if (!row) {
    throw new Error(`Missing GL account ${accountNumber}`);
  }

  return row.id;
}

function createJournalEntry(
  db: ReturnType<typeof getDatabase>,
  {
    id,
    dateIso,
    description,
    reference,
    status,
    createdBy,
    lines,
  }: {
    id: string;
    dateIso: string;
    description: string;
    reference: string;
    status: "DRAFT" | "POSTED";
    createdBy: string;
    lines: Array<{ accountNumber: string; debit: number; credit: number; description?: string }>;
  }
) {
  db.prepare(
    'INSERT INTO "JournalEntry" (id, entry_date, description, reference_number, entry_type, status, created_by, posted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    dateIso,
    description,
    reference,
    "GENERAL",
    status,
    createdBy,
    status === "POSTED" ? dateIso : null
  );

  const insertLine = db.prepare(
    'INSERT INTO "JournalEntryLine" (id, journal_entry_id, gl_account_id, debit_amount, credit_amount, description) VALUES (?, ?, ?, ?, ?, ?)'
  );

  for (const line of lines) {
    insertLine.run(
      createRecordId("jel"),
      id,
      getAccountIdByNumber(line.accountNumber),
      Number(line.debit.toFixed(2)),
      Number(line.credit.toFixed(2)),
      line.description ?? null
    );
  }
}

function getInvoiceBalance(db: ReturnType<typeof getDatabase>, invoiceId: string) {
  const invoice = db
    .prepare('SELECT total_due FROM "Invoice" WHERE id = ?')
    .get(invoiceId) as { total_due: number } | undefined;

  if (!invoice) {
    return 0;
  }

  const paymentRow = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS paid FROM "Payment" WHERE invoice_id = ?')
    .get(invoiceId) as { paid: number | null };

  return Number(Math.max(invoice.total_due - (paymentRow.paid ?? 0), 0).toFixed(2));
}

function syncInvoiceAndBookingStatuses(db: ReturnType<typeof getDatabase>, invoiceId: string) {
  const invoice = db
    .prepare('SELECT due_date FROM "Invoice" WHERE id = ?')
    .get(invoiceId) as { due_date: string } | undefined;

  if (!invoice) {
    return;
  }

  const balance = getInvoiceBalance(db, invoiceId);
  const status = getInvoiceStatus(
    {
      status: balance <= 0 ? "PAID" : "UNPAID",
      balanceDue: balance,
      dueDate: toDateOnly(invoice.due_date),
    },
    getTodayDateString()
  );

  db.prepare('UPDATE "Invoice" SET status = ? WHERE id = ?').run(
    balance <= 0 ? "PAID" : "UNPAID",
    invoiceId
  );

  const bookingStatus =
    status === "PAID" ? "PAID" : status === "OVERDUE" ? "OVERDUE" : "UNPAID";

  db.prepare(
    'UPDATE "Booking" SET payment_status = ? WHERE id IN (SELECT booking_id FROM "InvoiceLine" WHERE invoice_id = ?)'
  ).run(bookingStatus, invoiceId);
}

function applyPaymentToInvoice(
  db: ReturnType<typeof getDatabase>,
  {
    invoiceId,
    agentId,
    amount,
    paymentMethod,
    cardLastFour,
    createdBy,
    stripePaymentId,
    processingFee,
  }: {
    invoiceId: string;
    agentId: string;
    amount: number;
    paymentMethod: Payment["paymentMethod"];
    cardLastFour: string;
    createdBy: string;
    stripePaymentId?: string | null;
    processingFee?: number;
  }
) {
  const invoice = db
    .prepare(
      'SELECT id, invoice_number, travel_agent_id FROM "Invoice" WHERE id = ? AND travel_agent_id = ?'
    )
    .get(invoiceId, agentId) as
    | { id: string; invoice_number: string; travel_agent_id: string }
    | undefined;

  if (!invoice) {
    throw new Error("NOT_FOUND");
  }

  if (stripePaymentId) {
    const existingStripePayment = db
      .prepare(
        'SELECT id, amount, invoice_id FROM "Payment" WHERE stripe_payment_id = ? LIMIT 1'
      )
      .get(stripePaymentId) as
      | { id: string; amount: number; invoice_id: string }
      | undefined;

    if (existingStripePayment) {
      return {
        paymentId: existingStripePayment.id,
        applied: existingStripePayment.amount,
        remainingBalance: getInvoiceBalance(db, existingStripePayment.invoice_id),
        invoiceNumber: invoice.invoice_number,
      };
    }
  }

  const currentBalance = getInvoiceBalance(db, invoice.id);
  const applied = Number(Math.min(amount, currentBalance).toFixed(2));
  const remainingBalance = Number(Math.max(currentBalance - applied, 0).toFixed(2));

  if (applied <= 0) {
    return {
      paymentId: null,
      applied: 0,
      remainingBalance,
      invoiceNumber: invoice.invoice_number,
    };
  }

  const paymentId = createRecordId("payment");

  db.prepare(
    'INSERT INTO "Payment" (id, invoice_id, travel_agent_id, payment_date, amount, payment_method, card_last_four, stripe_payment_id, processing_fee, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    paymentId,
    invoice.id,
    agentId,
    getNowIso(),
    applied,
    paymentMethod,
    cardLastFour,
    stripePaymentId ?? null,
    processingFee ?? 0,
    "SETTLED"
  );

  syncInvoiceAndBookingStatuses(db, invoice.id);

  createJournalEntry(db, {
    id: nextJournalId(listAllJournalIds(db)),
    dateIso: getNowIso(),
    description: "Agent Payment Applied",
    reference: invoice.invoice_number,
    status: "POSTED",
    createdBy,
    lines: [
      {
        accountNumber: "1010",
        debit: applied,
        credit: 0,
      },
      {
        accountNumber: "1110",
        debit: 0,
        credit: applied,
      },
    ],
  });

  return {
    paymentId,
    applied,
    remainingBalance,
    invoiceNumber: invoice.invoice_number,
  };
}

function listAllInvoiceNumbers(db: ReturnType<typeof getDatabase>) {
  return (db.prepare('SELECT invoice_number FROM "Invoice"').all() as Array<{ invoice_number: string }>).map(
    (row) => row.invoice_number
  );
}

function listAllJournalIds(db: ReturnType<typeof getDatabase>) {
  return (db.prepare('SELECT id FROM "JournalEntry"').all() as Array<{ id: string }>).map(
    (row) => row.id
  );
}

function nextTicketNumber(db: ReturnType<typeof getDatabase>) {
  const rows = db
    .prepare('SELECT ticket_number FROM "Booking"')
    .all() as Array<{ ticket_number: string }>;
  const largest = rows
    .map((row) => Number(row.ticket_number.replaceAll("-", "").slice(-4)))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 9700);

  return `006-248135${String(largest + 1).padStart(4, "0")}`;
}

function getOrCreateAirline(
  db: ReturnType<typeof getDatabase>,
  airlineName: string,
  airlineCode: string
) {
  const existing = db
    .prepare('SELECT id FROM "Airline" WHERE upper(iata_code) = upper(?)')
    .get(airlineCode) as { id: string } | undefined;

  if (existing) {
    return existing.id;
  }

  const id = createRecordId("airline");
  db.prepare(
    'INSERT INTO "Airline" (id, name, iata_code, icao_code, dot_number, fiscal_year_end) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, airlineName, airlineCode, airlineCode, null, null);
  return id;
}

function mapAgents(session: SessionUser) {
  const db = getDatabase();
  const baseQuery =
    session.role === "ADMIN"
      ? 'SELECT * FROM "TravelAgent" ORDER BY annual_volume DESC, agency_name ASC'
      : 'SELECT * FROM "TravelAgent" WHERE id = ?';
  const rows = (
    session.role === "ADMIN"
      ? db.prepare(baseQuery).all()
      : db.prepare(baseQuery).all(session.id)
  ) as AgentRow[];

  return rows.map(
    (row) =>
      ({
        id: row.id,
        name: row.agency_name,
        arcNumber: row.arc_number,
        email: row.contact_email,
        annualVolume: row.annual_volume ?? 0,
        tier: row.commission_tier,
        overrideRate: row.override_rate ?? 0,
        status: row.status,
      }) satisfies TravelAgent
  );
}

function mapBookings(session: SessionUser) {
  const db = getDatabase();
  const rows = (
    session.role === "ADMIN"
      ? db
          .prepare(
            `
            SELECT
              b.*,
              (
                SELECT invoice_id
                FROM "InvoiceLine" il
                WHERE il.booking_id = b.id
                LIMIT 1
              ) AS invoice_id
            FROM "Booking" b
            ORDER BY b.booking_date DESC
            `
          )
          .all()
      : db
          .prepare(
            `
            SELECT
              b.*,
              (
                SELECT invoice_id
                FROM "InvoiceLine" il
                WHERE il.booking_id = b.id
                LIMIT 1
              ) AS invoice_id
            FROM "Booking" b
            WHERE b.travel_agent_id = ?
            ORDER BY b.booking_date DESC
            `
          )
          .all(session.id)
  ) as BookingRow[];

  return rows.map(
    (row) =>
      ({
        id: row.id,
        agentId: row.travel_agent_id,
        airlineId: row.airline_id,
        ticketNumber: row.ticket_number,
        pnr: row.pnr,
        travelerName: row.passenger_name,
        seatType: row.seat_type ?? "ECONOMY",
        origin: row.route_origin,
        destination: row.route_destination,
        bookingDate: toDateOnly(row.booking_date),
        flightDate: toDateOnly(row.flight_date),
        baseFare: row.base_fare,
        taxes: row.taxes_fees,
        passengers: row.passenger_count,
        commissionRate: row.commission_rate,
        paymentStatus: row.payment_status,
        revenueStatus: row.revenue_status,
        invoiceId: row.invoice_id ?? undefined,
      }) satisfies Booking
  );
}

function mapBookingPassengers(session: SessionUser, bookings: Booking[]) {
  const db = getDatabase();
  const rows = (
    session.role === "ADMIN"
      ? db
          .prepare(
            `
            SELECT
              bp.id,
              bp.booking_id,
              bp.passenger_sequence,
              bp.full_name,
              bp.passport_id,
              bp.seat_type,
              bp.seat_number,
              bp.base_fare,
              bp.taxes_fees,
              bp.total_amount
            FROM "BookingPassenger" bp
            INNER JOIN "Booking" b ON b.id = bp.booking_id
            ORDER BY b.booking_date DESC, bp.passenger_sequence ASC
            `
          )
          .all()
      : db
          .prepare(
            `
            SELECT
              bp.id,
              bp.booking_id,
              bp.passenger_sequence,
              bp.full_name,
              bp.passport_id,
              bp.seat_type,
              bp.seat_number,
              bp.base_fare,
              bp.taxes_fees,
              bp.total_amount
            FROM "BookingPassenger" bp
            INNER JOIN "Booking" b ON b.id = bp.booking_id
            WHERE b.travel_agent_id = ?
            ORDER BY b.booking_date DESC, bp.passenger_sequence ASC
            `
          )
          .all(session.id)
  ) as BookingPassengerRow[];

  const passengers = rows.map(
    (row) =>
      ({
        id: row.id,
        bookingId: row.booking_id,
        sequence: row.passenger_sequence,
        fullName: row.full_name,
        passportId: row.passport_id,
        seatType: row.seat_type,
        seatNumber: row.seat_number,
        baseFare: row.base_fare,
        taxes: row.taxes_fees,
        totalAmount: row.total_amount,
      }) satisfies BookingPassenger
  );

  const passengerIdsByBooking = new Set(passengers.map((passenger) => passenger.bookingId));

  return [
    ...passengers,
    ...bookings
      .filter((booking) => !passengerIdsByBooking.has(booking.id))
      .flatMap((booking) => createLegacyPassengerRows(booking)),
  ];
}

function mapPayments(session: SessionUser) {
  const db = getDatabase();
  const rows = (
    session.role === "ADMIN"
      ? db.prepare('SELECT * FROM "Payment" ORDER BY payment_date DESC').all()
      : db
          .prepare('SELECT * FROM "Payment" WHERE travel_agent_id = ? ORDER BY payment_date DESC')
          .all(session.id)
  ) as PaymentRow[];

  return rows.map(
    (row) =>
      ({
        id: row.id,
        agentId: row.travel_agent_id,
        invoiceId: row.invoice_id,
        paymentDate: row.payment_date,
        amount: row.amount,
        paymentMethod: row.payment_method,
        cardLastFour: row.card_last_four ?? "0000",
        status: row.status,
      }) satisfies Payment
  );
}

function mapInvoices(session: SessionUser, payments: Payment[]) {
  const db = getDatabase();
  const rows = (
    session.role === "ADMIN"
      ? db.prepare('SELECT * FROM "Invoice" ORDER BY issue_date DESC').all()
      : db
          .prepare('SELECT * FROM "Invoice" WHERE travel_agent_id = ? ORDER BY issue_date DESC')
          .all(session.id)
  ) as InvoiceRow[];

  const invoiceLineRows = (
    session.role === "ADMIN"
      ? db.prepare('SELECT invoice_id, booking_id FROM "InvoiceLine"').all()
      : db
          .prepare(
            `
            SELECT il.invoice_id, il.booking_id
            FROM "InvoiceLine" il
            INNER JOIN "Invoice" i ON i.id = il.invoice_id
            WHERE i.travel_agent_id = ?
            `
          )
          .all(session.id)
  ) as Array<{ invoice_id: string; booking_id: string }>;

  const bookingIdsByInvoice = new Map<string, string[]>();

  for (const row of invoiceLineRows) {
    const bucket = bookingIdsByInvoice.get(row.invoice_id) ?? [];
    bucket.push(row.booking_id);
    bookingIdsByInvoice.set(row.invoice_id, bucket);
  }

  return rows.map((row) => {
    const paid = payments
      .filter((payment) => payment.invoiceId === row.id)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const balanceDue = Number(Math.max(row.total_due - paid, 0).toFixed(2));
    const dueDate = toDateOnly(row.due_date);

    return {
      id: row.id,
      agentId: row.travel_agent_id,
      invoiceNumber: row.invoice_number,
      issueDate: toDateOnly(row.issue_date),
      dueDate,
      subtotal: row.subtotal,
      commissionCredit: row.commission_offset,
      taxes: row.taxes,
      totalDue: row.total_due,
      balanceDue,
      status: getInvoiceStatus(
        {
          status: row.status,
          balanceDue,
          dueDate,
        },
        getTodayDateString()
      ),
      bookingIds: bookingIdsByInvoice.get(row.id) ?? [],
    } satisfies Invoice;
  });
}

function mapJournals() {
  const db = getDatabase();
  const journals = db
    .prepare('SELECT id, entry_date, description, reference_number, status FROM "JournalEntry" ORDER BY entry_date DESC')
    .all() as JournalRow[];
  const lines = db
    .prepare(
      `
      SELECT
        l.journal_entry_id,
        a.account_number,
        a.account_name,
        l.debit_amount,
        l.credit_amount
      FROM "JournalEntryLine" l
      INNER JOIN "GlAccount" a ON a.id = l.gl_account_id
      ORDER BY l.rowid ASC
      `
    )
    .all() as JournalLineRow[];

  return journals.map(
    (journal) =>
      ({
        id: journal.id,
        date: journal.entry_date,
        description: journal.description ?? "",
        reference: journal.reference_number ?? "",
        status: journal.status,
        lines: lines
          .filter((line) => line.journal_entry_id === journal.id)
          .map((line) => ({
            accountNumber: line.account_number,
            name: line.account_name,
            debit: line.debit_amount,
            credit: line.credit_amount,
          })),
      }) satisfies JournalEntry
  );
}

function mapAccounts() {
  const db = getDatabase();
  const rows = db
    .prepare(
      `
      SELECT
        a.id,
        a.account_number,
        a.account_name,
        a.account_type,
        a.normal_balance,
        COALESCE(SUM(CASE WHEN j.status = 'POSTED' THEN l.debit_amount ELSE 0 END), 0) AS debit_total,
        COALESCE(SUM(CASE WHEN j.status = 'POSTED' THEN l.credit_amount ELSE 0 END), 0) AS credit_total
      FROM "GlAccount" a
      LEFT JOIN "JournalEntryLine" l ON l.gl_account_id = a.id
      LEFT JOIN "JournalEntry" j ON j.id = l.journal_entry_id
      GROUP BY a.id, a.account_number, a.account_name, a.account_type, a.normal_balance
      ORDER BY a.account_number ASC
      `
    )
    .all() as AccountRow[];

  return rows.map((row) => {
    const debits = row.debit_total ?? 0;
    const credits = row.credit_total ?? 0;
    const balance =
      row.normal_balance === "DEBIT" ? debits - credits : credits - debits;

    return {
      id: row.id,
      accountNumber: row.account_number,
      name: row.account_name,
      type: row.account_type,
      balance: Number(balance.toFixed(2)),
    } satisfies GlAccount;
  });
}

function mapRevenueRules() {
  const db = getDatabase();
  const rows = db
    .prepare(
      `
      SELECT
        r.id,
        r.rule_name,
        r.recognition_trigger,
        debit.account_number AS debit_account_number,
        debit.account_name AS debit_account_name,
        credit.account_number AS credit_account_number,
        credit.account_name AS credit_account_name,
        r.last_run
      FROM "RevenueRule" r
      INNER JOIN "GlAccount" debit ON debit.id = r.gl_debit_account_id
      INNER JOIN "GlAccount" credit ON credit.id = r.gl_credit_account_id
      ORDER BY r.rule_name ASC
      `
    )
    .all() as RevenueRuleRow[];

  return rows.map(
    (row) =>
      ({
        id: row.id,
        name: row.rule_name,
        trigger: row.recognition_trigger,
        debitAccount: `${row.debit_account_number} - ${row.debit_account_name}`,
        creditAccount: `${row.credit_account_number} - ${row.credit_account_name}`,
        lastRun: row.last_run ?? "Never",
      }) satisfies RevenueRule
  );
}

export function buildAppState(session: SessionUser): AppState {
  const nowIso = getNowIso();
  const payments = mapPayments(session);
  const invoices = mapInvoices(session, payments);
  const bookings = mapBookings(session);
  const bookingPassengers = mapBookingPassengers(session, bookings);

  return {
    currentUser: session,
    currentAgentId: session.role === "AGENT" ? session.id : undefined,
    nowIso,
    accounts: session.role === "ADMIN" ? mapAccounts() : [],
    agents: mapAgents(session),
    bookings,
    bookingPassengers,
    invoices,
    payments,
    journals: session.role === "ADMIN" ? mapJournals() : [],
    revenueRules: session.role === "ADMIN" ? mapRevenueRules() : [],
  };
}

export function addAccount(
  session: SessionUser,
  input: {
    accountNumber: string;
    name: string;
    type: GlAccount["type"];
    balance: number;
  }
) {
  assertAdmin(session);

  withTransaction((db) => {
    const id = createRecordId("acct");
    const normalBalance =
      input.type === "ASSET" || input.type === "EXPENSE" ? "DEBIT" : "CREDIT";

    db.prepare(
      'INSERT INTO "GlAccount" (id, account_number, account_name, account_type, normal_balance, parent_account_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, input.accountNumber, input.name, input.type, normalBalance, null, 1);

    if (input.balance > 0) {
      createJournalEntry(db, {
        id: nextJournalId(listAllJournalIds(db)),
        dateIso: getNowIso(),
        description: `Opening balance for ${input.name}`,
        reference: input.accountNumber,
        status: "POSTED",
        createdBy: session.name,
        lines: [
          {
            accountNumber: input.accountNumber,
            debit: normalBalance === "DEBIT" ? input.balance : 0,
            credit: normalBalance === "CREDIT" ? input.balance : 0,
          },
          {
            accountNumber: "1010",
            debit: normalBalance === "CREDIT" ? input.balance : 0,
            credit: normalBalance === "DEBIT" ? input.balance : 0,
          },
        ],
      });
    }
  });
}

export function addAgent(
  session: SessionUser,
  input: {
    name: string;
    arcNumber: string;
    email: string;
    annualVolume: number;
    tier: TravelAgent["tier"];
    overrideRate: number;
    password: string;
  }
) {
  assertAdmin(session);

  getDatabase()
    .prepare(
      'INSERT INTO "TravelAgent" (id, agency_name, arc_number, iata_number, commission_tier, contact_email, password_hash, annual_volume, status, override_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      createRecordId("agent"),
      input.name,
      input.arcNumber,
      null,
      input.tier,
      input.email,
      hashPassword(input.password),
      input.annualVolume,
      "ACTIVE",
      input.overrideRate
    );
}

export function toggleAgentStatus(session: SessionUser, agentId: string) {
  assertAdmin(session);
  const db = getDatabase();
  const row = db
    .prepare('SELECT status FROM "TravelAgent" WHERE id = ?')
    .get(agentId) as { status: string } | undefined;

  if (!row) {
    throw new Error("NOT_FOUND");
  }

  db.prepare('UPDATE "TravelAgent" SET status = ? WHERE id = ?').run(
    row.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
    agentId
  );
}

export function addJournalEntry(
  session: SessionUser,
  input: {
    description: string;
    reference: string;
    lines: JournalEntry["lines"];
  }
) {
  assertAdmin(session);
  const db = getDatabase();
  const id = nextJournalId(listAllJournalIds(db));

  createJournalEntry(db, {
    id,
    dateIso: getNowIso(),
    description: input.description,
    reference: input.reference,
    status: "DRAFT",
    createdBy: session.name,
    lines: input.lines.map((line) => ({
      accountNumber: line.accountNumber,
      debit: line.debit,
      credit: line.credit,
    })),
  });

  return id;
}

export function postDraftJournals(session: SessionUser) {
  assertAdmin(session);
  const db = getDatabase();
  const draftRows = db
    .prepare('SELECT id FROM "JournalEntry" WHERE status = ?')
    .all("DRAFT") as Array<{ id: string }>;

  if (draftRows.length === 0) {
    return 0;
  }

  db.prepare('UPDATE "JournalEntry" SET status = ?, posted_at = ? WHERE status = ?').run(
    "POSTED",
    getNowIso(),
    "DRAFT"
  );

  return draftRows.length;
}

export function generateSettlementBatch(session: SessionUser) {
  assertAdmin(session);

  return withTransaction((db) => {
    const pendingRows = db
      .prepare(
        `
        SELECT *
        FROM "Booking"
        WHERE id NOT IN (SELECT booking_id FROM "InvoiceLine")
        ORDER BY booking_date DESC
        `
      )
      .all() as Array<{ id: string }>;

    if (pendingRows.length === 0) {
      return { created: 0, invoiceNumbers: [] as string[] };
    }

    const grouped = new Map<string, Booking[]>();
    const currentState = buildAppState(session);

    for (const booking of currentState.bookings.filter((item) =>
      pendingRows.some((pending) => pending.id === item.id)
    )) {
      const bucket = grouped.get(booking.agentId) ?? [];
      bucket.push(booking);
      grouped.set(booking.agentId, bucket);
    }

    const insertInvoice = db.prepare(
      'INSERT INTO "Invoice" (id, invoice_number, travel_agent_id, issue_date, due_date, subtotal, commission_offset, taxes, total_due, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertLine = db.prepare(
      'INSERT INTO "InvoiceLine" (id, invoice_id, booking_id, description, amount, commission_amount, net_amount) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    let invoiceNumbers = listAllInvoiceNumbers(db);
    const created: string[] = [];
    const today = getTodayDateString();

    for (const [agentId, bookings] of grouped.entries()) {
      const totals = calculateInvoiceAmounts(bookings);
      const invoiceNumber = nextInvoiceNumber(invoiceNumbers);
      const invoiceId = createRecordId("invoice");
      invoiceNumbers = [...invoiceNumbers, invoiceNumber];
      created.push(invoiceNumber);

      insertInvoice.run(
        invoiceId,
        invoiceNumber,
        agentId,
        `${today}T00:00:00.000Z`,
        `${addDays(today, 14)}T00:00:00.000Z`,
        totals.subtotal,
        totals.commissionCredit,
        totals.taxes,
        totals.totalDue,
        "UNPAID"
      );

      for (const booking of bookings) {
        insertLine.run(
          createRecordId("invline"),
          invoiceId,
          booking.id,
          `${booking.origin}-${booking.destination}`,
          getBookingGross(booking),
          getBookingCommission(booking),
          getBookingNetDue(booking)
        );
      }

      syncInvoiceAndBookingStatuses(db, invoiceId);
    }

    return {
      created: created.length,
      invoiceNumbers: created,
    };
  });
}

export function bookFlight(
  session: SessionUser,
  input: {
    flight: FlightSearchResult;
    travelDate: string;
    passengers: number;
    seatType: SeatType;
    passengerManifest: Array<{
      fullName: string;
      passportId: string;
    }>;
  }
) {
  assertAgent(session);

  return withTransaction((db) => {
    const agent = db
      .prepare(
        'SELECT commission_tier, override_rate, agency_name FROM "TravelAgent" WHERE id = ?'
      )
      .get(session.id) as
      | { commission_tier: string; override_rate: number; agency_name: string }
      | undefined;

    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    const manifest = normalizePassengerManifest(input.passengerManifest, input.passengers);
    const nowIso = getNowIso();
    const today = getTodayDateString();
    const seatPricing = input.flight.seatPricing ?? buildSeatPricing(input.flight.price);
    const grossFare = Number((seatPricing[input.seatType] ?? input.flight.price).toFixed(2));
    const baseFare = Number((grossFare / 1.11).toFixed(2));
    const taxes = Number((grossFare - baseFare).toFixed(2));
    const commissionRate = agent.override_rate;
    const commissionAmount = Number((baseFare * commissionRate).toFixed(2));
    const netDue = Number((grossFare - commissionAmount).toFixed(2));
    const airlineId = getOrCreateAirline(db, input.flight.airline, input.flight.airlineCode);
    const ticketNumber = nextTicketNumber(db);
    const bookingId = createRecordId("booking");
    const leadPassenger = manifest[0];

    db.prepare(
      'INSERT INTO "Booking" (id, ticket_number, pnr, travel_agent_id, airline_id, passenger_name, seat_type, route_origin, route_destination, flight_date, booking_date, passenger_count, base_fare, taxes_fees, total_amount, commission_rate, commission_amount, revenue_status, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      bookingId,
      ticketNumber,
      makePnr(),
      session.id,
      airlineId,
      leadPassenger.fullName,
      input.seatType,
      input.flight.origin,
      input.flight.destination,
      `${input.travelDate}T00:00:00.000Z`,
      nowIso,
      input.passengers,
      baseFare,
      taxes,
      grossFare,
      commissionRate,
      commissionAmount,
      "DEFERRED",
      "UNPAID"
    );

    const passengerBaseFares = allocateAmountByCount(baseFare, manifest.length);
    const passengerTaxes = allocateAmountByCount(taxes, manifest.length);
    const seatNumbers = assignSeatNumbers(input.seatType, manifest.length, ticketNumber);
    const insertPassenger = db.prepare(
      'INSERT INTO "BookingPassenger" (id, booking_id, passenger_sequence, full_name, passport_id, seat_type, seat_number, base_fare, taxes_fees, total_amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    for (const [index, passenger] of manifest.entries()) {
      const passengerBaseFare = passengerBaseFares[index];
      const passengerTaxesAmount = passengerTaxes[index];
      insertPassenger.run(
        createRecordId("bpax"),
        bookingId,
        index + 1,
        passenger.fullName,
        passenger.passportId,
        input.seatType,
        seatNumbers[index],
        passengerBaseFare,
        passengerTaxesAmount,
        Number((passengerBaseFare + passengerTaxesAmount).toFixed(2)),
        nowIso
      );
    }

    const candidateInvoices = db
      .prepare(
        'SELECT id, invoice_number FROM "Invoice" WHERE travel_agent_id = ? AND substr(issue_date, 1, 10) = ? AND status != ? ORDER BY issue_date DESC'
      )
      .all(session.id, today, "PAID") as Array<{ id: string; invoice_number: string }>;

    let invoiceId: string;
    let invoiceNumber: string;
    const existingInvoice = candidateInvoices.find((item) => getInvoiceBalance(db, item.id) > 0);

    if (existingInvoice) {
      invoiceId = existingInvoice.id;
      invoiceNumber = existingInvoice.invoice_number;
      const existingBookings = buildAppState(session).bookings.filter(
        (booking) => booking.invoiceId === invoiceId
      );
      const totals = calculateInvoiceAmounts([
        ...existingBookings,
        {
          id: bookingId,
          agentId: session.id,
          airlineId,
          ticketNumber,
          pnr: "",
          travelerName: leadPassenger.fullName,
          seatType: input.seatType,
          origin: input.flight.origin,
          destination: input.flight.destination,
          bookingDate: today,
          flightDate: input.travelDate,
          baseFare,
          taxes,
          passengers: input.passengers,
          commissionRate,
          paymentStatus: "UNPAID",
          revenueStatus: "DEFERRED",
          invoiceId,
        },
      ]);

      db.prepare(
        'UPDATE "Invoice" SET subtotal = ?, commission_offset = ?, taxes = ?, total_due = ?, status = ? WHERE id = ?'
      ).run(
        totals.subtotal,
        totals.commissionCredit,
        totals.taxes,
        totals.totalDue,
        "UNPAID",
        invoiceId
      );
    } else {
      invoiceId = createRecordId("invoice");
      invoiceNumber = nextInvoiceNumber(listAllInvoiceNumbers(db));
      db.prepare(
        'INSERT INTO "Invoice" (id, invoice_number, travel_agent_id, issue_date, due_date, subtotal, commission_offset, taxes, total_due, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        invoiceId,
        invoiceNumber,
        session.id,
        nowIso,
        `${addDays(today, 14)}T00:00:00.000Z`,
        grossFare,
        commissionAmount,
        taxes,
        netDue,
        "UNPAID"
      );
    }

    db.prepare(
      'INSERT INTO "InvoiceLine" (id, invoice_id, booking_id, description, amount, commission_amount, net_amount) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      createRecordId("invline"),
      invoiceId,
      bookingId,
      `${input.flight.airline} ${input.flight.flightNumber} ${formatRoute(input.flight.origin, input.flight.destination)} ${manifest.length} pax ${input.seatType.toLowerCase().replaceAll("_", " ")}`,
      grossFare,
      commissionAmount,
      netDue
    );

    syncInvoiceAndBookingStatuses(db, invoiceId);

    createJournalEntry(db, {
      id: nextJournalId(listAllJournalIds(db)),
      dateIso: nowIso,
      description: `Ticket Sale (${agent.agency_name})`,
      reference: ticketNumber,
      status: "DRAFT",
      createdBy: session.name,
      lines: [
        {
          accountNumber: "1110",
          debit: netDue,
          credit: 0,
        },
        {
          accountNumber: "5110",
          debit: commissionAmount,
          credit: 0,
        },
        {
          accountNumber: "2100",
          debit: 0,
          credit: baseFare,
        },
        {
          accountNumber: "2200",
          debit: 0,
          credit: taxes,
        },
      ],
    });

    return {
      bookingId,
      ticketNumber,
      invoiceNumber,
    };
  });
}

export function recordPayment(
  session: SessionUser,
  input: {
    invoiceId: string;
    amount: number;
    paymentMethod: Payment["paymentMethod"];
    cardLastFour: string;
  }
) {
  assertAgent(session);

  return withTransaction((db) =>
    applyPaymentToInvoice(db, {
      invoiceId: input.invoiceId,
      agentId: session.id,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      cardLastFour: input.cardLastFour,
      createdBy: session.name,
    })
  );
}

export function deferInvoice(session: SessionUser, invoiceId: string) {
  assertAgent(session);
  const db = getDatabase();
  const invoice = db
    .prepare('SELECT id, due_date FROM "Invoice" WHERE id = ? AND travel_agent_id = ?')
    .get(invoiceId, session.id) as { id: string; due_date: string } | undefined;

  if (!invoice) {
    throw new Error("NOT_FOUND");
  }

  const nextDueDate = addDays(toDateOnly(invoice.due_date), 7);
  db.prepare('UPDATE "Invoice" SET due_date = ?, status = ? WHERE id = ?').run(
    `${nextDueDate}T00:00:00.000Z`,
    "UNPAID",
    invoiceId
  );
  syncInvoiceAndBookingStatuses(db, invoiceId);
  return nextDueDate;
}

export function runRevenueRecognitionBatch(session: SessionUser) {
  assertAdmin(session);

  return withTransaction((db) => {
    const dueRows = db
      .prepare(
        `
        SELECT id, route_origin, route_destination, base_fare
        FROM "Booking"
        WHERE revenue_status = 'DEFERRED'
          AND substr(flight_date, 1, 10) <= ?
        `
      )
      .all(getTodayDateString()) as Array<{
      id: string;
      route_origin: string;
      route_destination: string;
      base_fare: number;
    }>;

    if (dueRows.length === 0) {
      return { recognized: 0, value: 0 };
    }

    const recognizedValue = Number(
      dueRows.reduce((sum, row) => sum + row.base_fare, 0).toFixed(2)
    );

    const updateBooking = db.prepare('UPDATE "Booking" SET revenue_status = ? WHERE id = ?');
    for (const row of dueRows) {
      updateBooking.run("RECOGNIZED", row.id);
    }

    createJournalEntry(db, {
      id: nextJournalId(listAllJournalIds(db)),
      dateIso: getNowIso(),
      description: `Revenue Recognition Batch (${dueRows.length} itineraries)`,
      reference: dueRows
        .slice(0, 5)
        .map((row) => formatRoute(row.route_origin, row.route_destination))
        .join(", "),
      status: "POSTED",
      createdBy: session.name,
      lines: [
        {
          accountNumber: "2100",
          debit: recognizedValue,
          credit: 0,
        },
        {
          accountNumber: "4010",
          debit: 0,
          credit: recognizedValue,
        },
      ],
    });

    db.prepare('UPDATE "RevenueRule" SET last_run = ? WHERE id = ?').run(getNowIso(), "rule-flight");

    return {
      recognized: dueRows.length,
      value: recognizedValue,
    };
  });
}

export async function recordStripeCheckoutPayment(
  session: SessionUser,
  checkoutSessionId: string
) {
  assertAgent(session);

  const { checkoutSession, paymentIntent, cardLastFour, processingFee } =
    await retrieveStripeCheckoutPayment(checkoutSessionId);
  const metadata = checkoutSession.metadata ?? {};
  const invoiceId = metadata.invoiceId;
  const sessionAgentId = metadata.agentId;

  if (!invoiceId || !sessionAgentId || sessionAgentId !== session.id) {
    throw new Error("FORBIDDEN");
  }

  if (checkoutSession.payment_status !== "paid" || paymentIntent.status !== "succeeded") {
    throw new Error("Stripe checkout has not completed successfully.");
  }

  const amount = Number(((checkoutSession.amount_total ?? 0) / 100).toFixed(2));
  const stripePaymentId = paymentIntent.id;

  return withTransaction((db) =>
    applyPaymentToInvoice(db, {
      invoiceId,
      agentId: session.id,
      amount,
      paymentMethod: "CARD",
      cardLastFour,
      createdBy: session.name,
      stripePaymentId,
      processingFee,
    })
  );
}

export function getInvoiceDocument(session: SessionUser, invoiceId: string) {
  const state = buildAppState(session);
  const invoice = state.invoices.find((item) => item.id === invoiceId);

  if (!invoice) {
    throw new Error("NOT_FOUND");
  }

  const agent = state.agents.find((item) => item.id === invoice.agentId);
  const bookings = state.bookings.filter((booking) => invoice.bookingIds.includes(booking.id));
  const bookingPassengers = state.bookingPassengers.filter((passenger) =>
    bookings.some((booking) => booking.id === passenger.bookingId)
  );
  const relatedPayments = state.payments.filter((payment) => payment.invoiceId === invoice.id);

  return {
    invoice,
    agent,
    bookings,
    bookingPassengers,
    payments: relatedPayments,
  };
}

export function getCustomerBillDocument(
  session: SessionUser,
  bookingId: string,
  passengerId: string
) {
  const state = buildAppState(session);
  const airlineStatement = getDatabase().prepare(
    `
      SELECT a.name
      FROM "Booking" b
      INNER JOIN "Airline" a ON a.id = b.airline_id
      WHERE b.id = ?
      LIMIT 1
      `
  );
  const booking = state.bookings.find((item) => item.id === bookingId);
  const passenger = state.bookingPassengers.find(
    (item) => item.id === passengerId && item.bookingId === bookingId
  );

  if (!booking || !passenger) {
    throw new Error("NOT_FOUND");
  }

  const agent = state.agents.find((item) => item.id === booking.agentId);
  const invoice = booking.invoiceId
    ? state.invoices.find((item) => item.id === booking.invoiceId)
    : undefined;
  const airline = airlineStatement.get(booking.id) as { name: string } | undefined;

  return {
    booking,
    passenger,
    agent,
    invoice,
    airlineName: airline?.name ?? "SkyLedger Airways",
  };
}

export function getCustomerBillDocuments(
  session: SessionUser,
  items: Array<{ bookingId: string; passengerId: string }>
) {
  const state = buildAppState(session);
  const airlineStatement = getDatabase().prepare(
    `
      SELECT a.name
      FROM "Booking" b
      INNER JOIN "Airline" a ON a.id = b.airline_id
      WHERE b.id = ?
      LIMIT 1
      `
  );
  const dedupedItems = Array.from(
    new Map(items.map((item) => [`${item.bookingId}:${item.passengerId}`, item])).values()
  );

  return dedupedItems.map(({ bookingId, passengerId }) => {
    const booking = state.bookings.find((item) => item.id === bookingId);
    const passenger = state.bookingPassengers.find(
      (item) => item.id === passengerId && item.bookingId === bookingId
    );

    if (!booking || !passenger) {
      throw new Error("NOT_FOUND");
    }

    const agent = state.agents.find((item) => item.id === booking.agentId);
    const invoice = booking.invoiceId
      ? state.invoices.find((item) => item.id === booking.invoiceId)
      : undefined;
    const airline = airlineStatement.get(booking.id) as { name: string } | undefined;

    return {
      booking,
      passenger,
      agent,
      invoice,
      airlineName: airline?.name ?? "SkyLedger Airways",
    };
  });
}

export function getPaymentDocument(session: SessionUser, paymentId: string) {
  const state = buildAppState(session);
  const payment = state.payments.find((item) => item.id === paymentId);

  if (!payment) {
    throw new Error("NOT_FOUND");
  }

  const invoice = state.invoices.find((item) => item.id === payment.invoiceId);
  const agent = state.agents.find((item) => item.id === payment.agentId);

  if (!invoice) {
    throw new Error("NOT_FOUND");
  }

  return {
    payment,
    invoice,
    agent,
  };
}
