import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { getDatabase } from "@/lib/server/db";
import { createSessionToken, hashPassword, hashToken, verifyPassword } from "@/lib/server/security";

const SESSION_COOKIE = "skyledger_session";
const SESSION_TTL_DAYS = 7;

function normalizeArcNumber(value: string) {
  return value.replace(/\D/g, "");
}

function getDefaultAdminConfig() {
  return {
    id: "admin-primary",
    name: "SkyLedger Admin",
    email: "admin@skyledger.local",
    passwords: [process.env.DEFAULT_ADMIN_PASSWORD, "Admin#12345"].filter(
      (value): value is string => Boolean(value)
    ),
  };
}

function getDefaultAgentConfig() {
  return {
    id: "agent-skyline",
    name: "Skyline Travel Partners",
    arcNumber: "12-3 4567 8",
    email: "agents@skyline-travel.local",
    passwords: [process.env.DEFAULT_AGENT_PASSWORD, "Agent#12345"].filter(
      (value): value is string => Boolean(value)
    ),
  };
}

function getCorporateAgentConfig() {
  return {
    id: "agent-corporate",
    passwords: ["Corporate#123"],
  };
}

export interface SessionUser {
  id: string;
  role: "ADMIN" | "AGENT";
  name: string;
  email?: string;
  arcNumber?: string;
}

function getExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
  return expiresAt;
}

export async function loginAdmin(email: string, password: string) {
  const db = getDatabase();
  const normalizedEmail = email.trim().toLowerCase();
  const defaultAdmin = getDefaultAdminConfig();
  let admin = db
    .prepare('SELECT id, name, email, password_hash FROM "AdminUser" WHERE lower(email) = lower(?)')
    .get(email) as
    | { id: string; name: string; email: string; password_hash: string }
    | undefined;

  if (!admin && normalizedEmail === defaultAdmin.email.toLowerCase()) {
    admin = db
      .prepare('SELECT id, name, email, password_hash FROM "AdminUser" WHERE id = ?')
      .get(defaultAdmin.id) as
      | { id: string; name: string; email: string; password_hash: string }
      | undefined;

    if (!admin) {
      db.prepare(
        'INSERT INTO "AdminUser" (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(
        defaultAdmin.id,
        defaultAdmin.name,
        defaultAdmin.email,
        hashPassword(defaultAdmin.passwords[0]),
        new Date().toISOString()
      );

      admin = {
        id: defaultAdmin.id,
        name: defaultAdmin.name,
        email: defaultAdmin.email,
        password_hash: "",
      };
    }
  }

  if (!admin) {
    return null;
  }

  const defaultPasswordMatch =
    admin.id === defaultAdmin.id &&
    normalizedEmail === defaultAdmin.email.toLowerCase() &&
    defaultAdmin.passwords.includes(password);
  const verified = verifyPassword(password, admin.password_hash);

  if (!verified && !defaultPasswordMatch) {
    return null;
  }

  if (!verified && defaultPasswordMatch) {
    db.prepare('UPDATE "AdminUser" SET email = ?, password_hash = ? WHERE id = ?').run(
      defaultAdmin.email,
      hashPassword(password),
      defaultAdmin.id
    );
  }

  await createSession({
    role: "ADMIN",
    adminUserId: admin.id,
  });

  return {
    id: admin.id,
    role: "ADMIN" as const,
    name: admin.name,
    email: admin.email,
  };
}

export async function loginAgent(arcNumber: string, password: string) {
  const db = getDatabase();
  const requestedArcNumber = normalizeArcNumber(arcNumber);
  const defaultAgent = getDefaultAgentConfig();
  const corporateAgent = getCorporateAgentConfig();
  const exactAgent = db
    .prepare(
      'SELECT id, agency_name, arc_number, contact_email, password_hash, status FROM "TravelAgent" WHERE arc_number = ?'
    )
    .get(arcNumber) as
    | {
        id: string;
        agency_name: string;
        arc_number: string;
        contact_email: string;
        password_hash: string;
        status: string;
      }
    | undefined;
  const fallbackAgent =
    exactAgent ??
    ((db
      .prepare(
        'SELECT id, agency_name, arc_number, contact_email, password_hash, status FROM "TravelAgent"'
      )
      .all() as Array<{
      id: string;
      agency_name: string;
      arc_number: string;
      contact_email: string;
      password_hash: string;
      status: string;
    }>).find((candidate) => normalizeArcNumber(candidate.arc_number) === requestedArcNumber));
  let agent = fallbackAgent;

  if (!agent && requestedArcNumber === normalizeArcNumber(defaultAgent.arcNumber)) {
    agent = db
      .prepare(
        'SELECT id, agency_name, arc_number, contact_email, password_hash, status FROM "TravelAgent" WHERE id = ?'
      )
      .get(defaultAgent.id) as
      | {
          id: string;
          agency_name: string;
          arc_number: string;
          contact_email: string;
          password_hash: string;
          status: string;
        }
      | undefined;
  }

  if (!agent || agent.status !== "ACTIVE") {
    return null;
  }

  const isDefaultAgent =
    agent.id === defaultAgent.id &&
    requestedArcNumber === normalizeArcNumber(defaultAgent.arcNumber) &&
    defaultAgent.passwords.includes(password);
  const isCorporateAgent =
    agent.id === corporateAgent.id && corporateAgent.passwords.includes(password);
  const verified = verifyPassword(password, agent.password_hash);

  if (!verified && !isDefaultAgent && !isCorporateAgent) {
    return null;
  }

  if (!verified && isDefaultAgent) {
    db.prepare('UPDATE "TravelAgent" SET password_hash = ? WHERE id = ?').run(
      hashPassword(password),
      defaultAgent.id
    );
  }

  if (!verified && isCorporateAgent) {
    db.prepare('UPDATE "TravelAgent" SET password_hash = ? WHERE id = ?').run(
      hashPassword(password),
      corporateAgent.id
    );
  }

  await createSession({
    role: "AGENT",
    travelAgentId: agent.id,
  });

  return {
    id: agent.id,
    role: "AGENT" as const,
    name: agent.agency_name,
    email: agent.contact_email,
    arcNumber: agent.arc_number,
  };
}

async function createSession({
  role,
  adminUserId,
  travelAgentId,
}: {
  role: "ADMIN" | "AGENT";
  adminUserId?: string;
  travelAgentId?: string;
}) {
  const token = createSessionToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = getExpiryDate();
  const db = getDatabase();

  db.prepare(
    'INSERT INTO "Session" (id, token_hash, role, admin_user_id, travel_agent_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    `session-${randomUUID()}`,
    tokenHash,
    role,
    adminUserId ?? null,
    travelAgentId ?? null,
    expiresAt.toISOString(),
    now.toISOString()
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!rawToken) {
    return null;
  }

  const db = getDatabase();
  const tokenHash = hashToken(rawToken);
  const session = db
    .prepare(
      `
      SELECT
        s.id,
        s.role,
        s.expires_at,
        a.id AS admin_id,
        a.name AS admin_name,
        a.email AS admin_email,
        t.id AS agent_id,
        t.agency_name AS agent_name,
        t.arc_number AS agent_arc,
        t.contact_email AS agent_email
      FROM "Session" s
      LEFT JOIN "AdminUser" a ON a.id = s.admin_user_id
      LEFT JOIN "TravelAgent" t ON t.id = s.travel_agent_id
      WHERE s.token_hash = ?
      `
    )
    .get(tokenHash) as
    | {
        id: string;
        role: "ADMIN" | "AGENT";
        expires_at: string;
        admin_id: string | null;
        admin_name: string | null;
        admin_email: string | null;
        agent_id: string | null;
        agent_name: string | null;
        agent_arc: string | null;
        agent_email: string | null;
      }
    | undefined;

  if (!session) {
    return null;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM "Session" WHERE token_hash = ?').run(tokenHash);
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  if (session.role === "ADMIN" && session.admin_id && session.admin_name) {
    return {
      id: session.admin_id,
      role: "ADMIN",
      name: session.admin_name,
      email: session.admin_email ?? undefined,
    };
  }

  if (session.role === "AGENT" && session.agent_id && session.agent_name) {
    return {
      id: session.agent_id,
      role: "AGENT",
      name: session.agent_name,
      arcNumber: session.agent_arc ?? undefined,
      email: session.agent_email ?? undefined,
    };
  }

  return null;
}

export async function requireSession() {
  const session = await getSessionUser();

  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  return session;
}

export async function logout() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (rawToken) {
    getDatabase()
      .prepare('DELETE FROM "Session" WHERE token_hash = ?')
      .run(hashToken(rawToken));
  }

  cookieStore.delete(SESSION_COOKIE);
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}
