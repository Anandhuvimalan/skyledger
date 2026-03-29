import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

import { hashPassword, verifyPassword } from "@/lib/server/security";

let database: DatabaseSync | null = null;
let initialized = false;

function resolveDatabasePath() {
  const configuredUrl = process.env.DATABASE_URL?.trim();
  const cwd = /* turbopackIgnore: true */ process.cwd();

  if (!configuredUrl) {
    return resolve(cwd, "dev.db");
  }

  if (configuredUrl.startsWith("file:")) {
    return resolve(cwd, configuredUrl.slice(5));
  }

  return resolve(cwd, configuredUrl);
}

function getTierOverride(tier: string) {
  switch (tier) {
    case "Tier 1":
      return 0.06;
    case "Tier 2":
      return 0.03;
    default:
      return 0.01;
  }
}

function hasColumn(db: DatabaseSync, table: string, column: string) {
  const rows = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function ensureColumn(
  db: DatabaseSync,
  table: string,
  column: string,
  definition: string
) {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
  }
}

function seedBaseData(db: DatabaseSync) {
  const adminCount = Number(
    (db.prepare('SELECT COUNT(*) AS count FROM "AdminUser"').get() as { count: number }).count
  );

  if (adminCount === 0) {
    db.prepare(
      'INSERT INTO "AdminUser" (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(
      "admin-primary",
      "SkyLedger Admin",
      process.env.DEFAULT_ADMIN_EMAIL ?? "admin@skyledger.local",
      hashPassword(process.env.DEFAULT_ADMIN_PASSWORD ?? "Admin#12345"),
      new Date().toISOString()
    );
  }

  const airlineCount = Number(
    (db.prepare('SELECT COUNT(*) AS count FROM "Airline"').get() as { count: number }).count
  );

  if (airlineCount === 0) {
    db.prepare(
      'INSERT INTO "Airline" (id, name, iata_code, icao_code, dot_number, fiscal_year_end) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      "airline-skyledger",
      "SkyLedger Airways",
      "SK",
      "SKL",
      "SL-100",
      `${new Date().getFullYear()}-12-31T00:00:00.000Z`
    );
  }

  const agentCount = Number(
    (db.prepare('SELECT COUNT(*) AS count FROM "TravelAgent"').get() as { count: number }).count
  );

  if (agentCount === 0) {
    const insertAgent = db.prepare(
      'INSERT INTO "TravelAgent" (id, agency_name, arc_number, iata_number, commission_tier, contact_email, password_hash, annual_volume, status, override_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    insertAgent.run(
      "agent-skyline",
      "Skyline Travel Partners",
      "12-3 4567 8",
      "IATA-7845123",
      "Tier 1",
      "agents@skyline-travel.local",
      hashPassword(process.env.DEFAULT_AGENT_PASSWORD ?? "Agent#12345"),
      1750000,
      "ACTIVE",
      0.06
    );

    insertAgent.run(
      "agent-corporate",
      "Corporate Journeys",
      "45-6 7890 1",
      "IATA-9912445",
      "Tier 2",
      "finance@corporate-journeys.local",
      hashPassword("Corporate#123"),
      420000,
      "ACTIVE",
      0.03
    );
  }

  const insertAccount = db.prepare(
    'INSERT INTO "GlAccount" (id, account_number, account_name, account_type, normal_balance, parent_account_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const selectAccount = db.prepare(
    'SELECT id FROM "GlAccount" WHERE account_number = ?'
  );
  const accounts = [
    ["acct-1010", "1010", "Cash and Cash Equivalents", "ASSET", "DEBIT"],
    ["acct-1110", "1110", "Accounts Receivable - ARC Settlement", "ASSET", "DEBIT"],
    ["acct-1120", "1120", "Settlement Clearing", "ASSET", "DEBIT"],
    ["acct-1210", "1210", "Prepaid Distribution Costs", "ASSET", "DEBIT"],
    ["acct-2100", "2100", "Air Traffic Liability", "LIABILITY", "CREDIT"],
    ["acct-2120", "2120", "Travel Agent Commission Payable", "LIABILITY", "CREDIT"],
    ["acct-2200", "2200", "Taxes Payable - Government", "LIABILITY", "CREDIT"],
    ["acct-2300", "2300", "Customer Refunds Payable", "LIABILITY", "CREDIT"],
    ["acct-2400", "2400", "Deferred Ancillary Revenue", "LIABILITY", "CREDIT"],
    ["acct-4010", "4010", "Passenger Revenue - Domestic", "REVENUE", "CREDIT"],
    ["acct-4020", "4020", "Passenger Revenue - International", "REVENUE", "CREDIT"],
    ["acct-4030", "4030", "Ancillary Revenue - Baggage", "REVENUE", "CREDIT"],
    ["acct-4040", "4040", "Loyalty Program Revenue", "REVENUE", "CREDIT"],
    ["acct-4080", "4080", "Ticket Breakage Revenue", "REVENUE", "CREDIT"],
    ["acct-5110", "5110", "Travel Agent Commissions Expense", "EXPENSE", "DEBIT"],
    ["acct-5120", "5120", "Payment Processing Fees", "EXPENSE", "DEBIT"],
    ["acct-5130", "5130", "Distribution Technology Expense", "EXPENSE", "DEBIT"],
  ] as const;

  for (const [id, number, name, type, normalBalance] of accounts) {
    const existing = selectAccount.get(number) as { id: string } | undefined;

    if (!existing) {
      insertAccount.run(id, number, name, type, normalBalance, null, 1);
    }
  }

  const ruleCount = Number(
    (db.prepare('SELECT COUNT(*) AS count FROM "RevenueRule"').get() as { count: number }).count
  );

  if (ruleCount === 0) {
    const insertRule = db.prepare(
      'INSERT INTO "RevenueRule" (id, rule_name, revenue_type, recognition_trigger, gl_debit_account_id, gl_credit_account_id, description, last_run) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    insertRule.run(
      "rule-flight",
      "Passenger Flight Completion",
      "PASSENGER",
      "FLIGHT_DATE",
      "acct-2100",
      "acct-4010",
      "Recognize passenger revenue when the itinerary is flown.",
      null
    );
    insertRule.run(
      "rule-loyalty",
      "Loyalty Point Redemption",
      "LOYALTY",
      "SERVICE_DATE",
      "acct-2100",
      "acct-4040",
      "Placeholder for loyalty revenue recognition.",
      null
    );
    insertRule.run(
      "rule-breakage",
      "Expired Unused Tickets",
      "BREAKAGE",
      "PATTERN_BASED",
      "acct-2100",
      "acct-4080",
      "Placeholder for breakage recognition.",
      null
    );
  }

  const periodCount = Number(
    (db.prepare('SELECT COUNT(*) AS count FROM "FinancialPeriod"').get() as { count: number }).count
  );

  if (periodCount === 0) {
    const year = new Date().getFullYear();
    db.prepare(
      'INSERT INTO "FinancialPeriod" (id, period_name, start_date, end_date, status, fiscal_year) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      `period-${year}`,
      `${year} Fiscal Year`,
      `${year}-01-01T00:00:00.000Z`,
      `${year}-12-31T23:59:59.999Z`,
      "OPEN",
      year
    );
  }

  const agentRates = db.prepare(
    'SELECT id, commission_tier, override_rate FROM "TravelAgent"'
  ).all() as Array<{ id: string; commission_tier: string; override_rate: number | null }>;

  const updateRate = db.prepare('UPDATE "TravelAgent" SET override_rate = ? WHERE id = ?');

  for (const agent of agentRates) {
    if (!agent.override_rate || agent.override_rate <= 0) {
      updateRate.run(getTierOverride(agent.commission_tier), agent.id);
    }
  }

  const defaultAdminEmail = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@skyledger.local";
  const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? "Admin#12345";
  const defaultAgentPassword = process.env.DEFAULT_AGENT_PASSWORD ?? "Agent#12345";

  const adminUser = db
    .prepare('SELECT email, password_hash FROM "AdminUser" WHERE id = ?')
    .get("admin-primary") as { email: string; password_hash: string } | undefined;

  if (adminUser) {
    if (adminUser.email !== defaultAdminEmail) {
      db.prepare('UPDATE "AdminUser" SET email = ? WHERE id = ?').run(
        defaultAdminEmail,
        "admin-primary"
      );
    }

    if (!verifyPassword(defaultAdminPassword, adminUser.password_hash)) {
      db.prepare('UPDATE "AdminUser" SET password_hash = ? WHERE id = ?').run(
        hashPassword(defaultAdminPassword),
        "admin-primary"
      );
    }
  }

  const seededAgent = db
    .prepare('SELECT password_hash FROM "TravelAgent" WHERE id = ?')
    .get("agent-skyline") as { password_hash: string } | undefined;

  if (seededAgent && !verifyPassword(defaultAgentPassword, seededAgent.password_hash)) {
    db.prepare('UPDATE "TravelAgent" SET password_hash = ? WHERE id = ?').run(
      hashPassword(defaultAgentPassword),
      "agent-skyline"
    );
  }

  const corporateAgent = db
    .prepare('SELECT password_hash FROM "TravelAgent" WHERE id = ?')
    .get("agent-corporate") as { password_hash: string } | undefined;

  if (corporateAgent && !verifyPassword("Corporate#123", corporateAgent.password_hash)) {
    db.prepare('UPDATE "TravelAgent" SET password_hash = ? WHERE id = ?').run(
      hashPassword("Corporate#123"),
      "agent-corporate"
    );
  }
}

export function getDatabase() {
  if (!database) {
    database = new DatabaseSync(resolveDatabasePath());
    database.exec("PRAGMA foreign_keys = ON;");
  }

  if (!initialized) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS "AdminUser" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL UNIQUE,
        "password_hash" TEXT NOT NULL,
        "created_at" DATETIME NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "Session" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "token_hash" TEXT NOT NULL UNIQUE,
        "role" TEXT NOT NULL,
        "admin_user_id" TEXT,
        "travel_agent_id" TEXT,
        "expires_at" DATETIME NOT NULL,
        "created_at" DATETIME NOT NULL,
        FOREIGN KEY ("admin_user_id") REFERENCES "AdminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("travel_agent_id") REFERENCES "TravelAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "BookingPassenger" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "booking_id" TEXT NOT NULL,
        "passenger_sequence" INTEGER NOT NULL,
        "full_name" TEXT NOT NULL,
        "passport_id" TEXT NOT NULL,
        "seat_type" TEXT NOT NULL DEFAULT 'ECONOMY',
        "seat_number" TEXT NOT NULL,
        "base_fare" REAL NOT NULL DEFAULT 0,
        "taxes_fees" REAL NOT NULL DEFAULT 0,
        "total_amount" REAL NOT NULL DEFAULT 0,
        "created_at" DATETIME NOT NULL,
        FOREIGN KEY ("booking_id") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    ensureColumn(database, "TravelAgent", "override_rate", "REAL NOT NULL DEFAULT 0.03");
    ensureColumn(database, "RevenueRule", "last_run", "TEXT");
    ensureColumn(database, "Booking", "passenger_count", "INTEGER NOT NULL DEFAULT 1");
    ensureColumn(database, "Booking", "seat_type", "TEXT NOT NULL DEFAULT 'ECONOMY'");

    seedBaseData(database);
    initialized = true;
  }

  return database;
}

export function withTransaction<T>(callback: (db: DatabaseSync) => T) {
  const db = getDatabase();

  db.exec("BEGIN IMMEDIATE");

  try {
    const result = callback(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
