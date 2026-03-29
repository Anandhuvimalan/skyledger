"use client";

import { create } from "zustand";

import type {
  AppState,
  FlightSearchResult,
  GlAccount,
  JournalEntry,
  PaymentMethod,
  SeatType,
  TravelAgent,
} from "@/lib/demo-data";

interface AddAccountInput {
  accountNumber: string;
  name: string;
  type: GlAccount["type"];
  balance: number;
}

interface AddAgentInput {
  name: string;
  arcNumber: string;
  email: string;
  annualVolume: number;
  tier: TravelAgent["tier"];
  overrideRate: number;
  password: string;
}

interface AddJournalEntryInput {
  description: string;
  reference: string;
  lines: JournalEntry["lines"];
}

interface BookFlightInput {
  flight: FlightSearchResult;
  travelDate: string;
  passengers: number;
  seatType: SeatType;
  passengerManifest: Array<{
    fullName: string;
    passportId: string;
  }>;
}

interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  cardLastFour: string;
}

interface SettlementBatchResult {
  created: number;
  invoiceNumbers: string[];
}

interface RevenueBatchResult {
  recognized: number;
  value: number;
}

const emptyState: AppState = {
  currentUser: null,
  currentAgentId: undefined,
  nowIso: new Date().toISOString(),
  accounts: [],
  agents: [],
  bookings: [],
  bookingPassengers: [],
  invoices: [],
  payments: [],
  journals: [],
  revenueRules: [],
};

interface DemoStore extends AppState {
  hydrated: boolean;
  loading: boolean;
  unauthorized: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
  addAccount: (input: AddAccountInput) => Promise<void>;
  addAgent: (input: AddAgentInput) => Promise<void>;
  toggleAgentStatus: (agentId: string) => Promise<void>;
  addJournalEntry: (input: AddJournalEntryInput) => Promise<string>;
  postDraftJournals: () => Promise<number>;
  generateSettlementBatch: () => Promise<SettlementBatchResult>;
  recordPayment: (input: RecordPaymentInput) => Promise<{ applied: number; remainingBalance: number }>;
  deferInvoice: (invoiceId: string) => Promise<string | null>;
  bookFlight: (input: BookFlightInput) => Promise<{ bookingId: string; ticketNumber: string; invoiceNumber?: string }>;
  runRevenueRecognitionBatch: () => Promise<RevenueBatchResult>;
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}`;

    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return payload as T;
}

async function callAction<T>(action: string, payload?: unknown) {
  return fetchJson<T>("/api/actions", {
    method: "POST",
    body: JSON.stringify({ action, payload }),
  });
}

export const useDemoStore = create<DemoStore>()((set, get) => ({
  ...emptyState,
  hydrated: false,
  loading: false,
  unauthorized: false,
  error: null,

  hydrate: async () => {
    set({ loading: true, error: null });

    try {
      const state = await fetchJson<AppState>("/api/state");
      set({
        ...state,
        hydrated: true,
        loading: false,
        unauthorized: false,
        error: null,
      });
    } catch (error) {
      const status = typeof error === "object" && error !== null && "status" in error
        ? Number(error.status)
        : 500;

      set({
        ...emptyState,
        hydrated: true,
        loading: false,
        unauthorized: status === 401,
        error: error instanceof Error ? error.message : "Unable to load application state.",
      });
    }
  },

  logout: async () => {
    await fetchJson("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    set({
      ...emptyState,
      hydrated: true,
      unauthorized: true,
      loading: false,
      error: null,
    });
  },

  addAccount: async (input) => {
    set({ loading: true, error: null });
    try {
      await callAction("addAccount", input);
      await get().hydrate();
    } finally {
      set({ loading: false });
    }
  },

  addAgent: async (input) => {
    set({ loading: true, error: null });
    try {
      await callAction("addAgent", input);
      await get().hydrate();
    } finally {
      set({ loading: false });
    }
  },

  toggleAgentStatus: async (agentId) => {
    set({ loading: true, error: null });
    try {
      await callAction("toggleAgentStatus", { agentId });
      await get().hydrate();
    } finally {
      set({ loading: false });
    }
  },

  addJournalEntry: async (input) => {
    set({ loading: true, error: null });
    try {
      const result = await callAction<{ id: string }>("addJournalEntry", input);
      await get().hydrate();
      return result.id;
    } finally {
      set({ loading: false });
    }
  },

  postDraftJournals: async () => {
    set({ loading: true, error: null });
    try {
      const result = await callAction<{ posted: number }>("postDraftJournals");
      await get().hydrate();
      return result.posted;
    } finally {
      set({ loading: false });
    }
  },

  generateSettlementBatch: async () => {
    set({ loading: true, error: null });
    try {
      const result = await callAction<SettlementBatchResult>("generateSettlementBatch");
      await get().hydrate();
      return result;
    } finally {
      set({ loading: false });
    }
  },

  recordPayment: async (input) => {
    set({ loading: true, error: null });
    try {
      const result = await callAction<{ applied: number; remainingBalance: number }>(
        "recordPayment",
        input
      );
      await get().hydrate();
      return result;
    } finally {
      set({ loading: false });
    }
  },

  deferInvoice: async (invoiceId) => {
    set({ loading: true, error: null });
    try {
      const result = await callAction<{ dueDate: string | null }>("deferInvoice", { invoiceId });
      await get().hydrate();
      return result.dueDate;
    } finally {
      set({ loading: false });
    }
  },

  bookFlight: async (input) => {
    set({ loading: true, error: null });
    try {
      const result = await callAction<{
        bookingId: string;
        ticketNumber: string;
        invoiceNumber?: string;
      }>("bookFlight", input);
      await get().hydrate();
      return result;
    } finally {
      set({ loading: false });
    }
  },

  runRevenueRecognitionBatch: async () => {
    set({ loading: true, error: null });
    try {
      const result = await callAction<RevenueBatchResult>("runRevenueRecognitionBatch");
      await get().hydrate();
      return result;
    } finally {
      set({ loading: false });
    }
  },
}));
