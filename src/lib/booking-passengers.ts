import type { SeatPricing, SeatType } from "@/lib/demo-data";

export const SEAT_TYPES: readonly SeatType[] = [
  "ECONOMY",
  "PREMIUM_ECONOMY",
  "BUSINESS",
];

const SEAT_TYPE_MULTIPLIERS: Record<SeatType, number> = {
  ECONOMY: 1,
  PREMIUM_ECONOMY: 1.35,
  BUSINESS: 1.9,
};

const SEAT_LAYOUTS: Record<
  SeatType,
  {
    startRow: number;
    rowCount: number;
    letters: string[];
  }
> = {
  ECONOMY: {
    startRow: 18,
    rowCount: 18,
    letters: ["A", "B", "C", "D", "E", "F"],
  },
  PREMIUM_ECONOMY: {
    startRow: 10,
    rowCount: 8,
    letters: ["A", "C", "D", "F"],
  },
  BUSINESS: {
    startRow: 2,
    rowCount: 8,
    letters: ["A", "C", "D", "F"],
  },
};

function hashSeed(seed: string) {
  return Array.from(seed).reduce(
    (sum, character) => (sum * 31 + character.charCodeAt(0)) % 2147483647,
    7
  );
}

export function buildSeatPricing(economyTotal: number): SeatPricing {
  return {
    ECONOMY: Number(economyTotal.toFixed(2)),
    PREMIUM_ECONOMY: Number((economyTotal * SEAT_TYPE_MULTIPLIERS.PREMIUM_ECONOMY).toFixed(2)),
    BUSINESS: Number((economyTotal * SEAT_TYPE_MULTIPLIERS.BUSINESS).toFixed(2)),
  };
}

export function allocateAmountByCount(totalAmount: number, count: number) {
  const safeCount = Math.max(1, count);
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / safeCount);
  const remainder = totalCents - baseCents * safeCount;

  return Array.from({ length: safeCount }, (_, index) =>
    Number(((baseCents + (index < remainder ? 1 : 0)) / 100).toFixed(2))
  );
}

export function assignSeatNumbers(seatType: SeatType, count: number, seed: string) {
  const layout = SEAT_LAYOUTS[seatType];
  const totalSlots = layout.rowCount * layout.letters.length;
  const startOffset = hashSeed(seed) % totalSlots;

  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    const slotIndex = (startOffset + index) % totalSlots;
    const row = layout.startRow + Math.floor(slotIndex / layout.letters.length);
    const letter = layout.letters[slotIndex % layout.letters.length];
    return `${row}${letter}`;
  });
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parsePassengerCsv(csvText: string) {
  const lines = csvText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const firstRow = parseCsvLine(lines[0]);
  const normalizedHeaders = firstRow.map(normalizeHeader);
  const nameIndex = normalizedHeaders.findIndex((header) =>
    ["name", "fullname", "passengername", "travelername"].includes(header)
  );
  const passportIndex = normalizedHeaders.findIndex((header) =>
    ["passport", "passportid", "passportnumber", "passportno"].includes(header)
  );
  const hasHeader = nameIndex !== -1 && passportIndex !== -1;
  const rows = (hasHeader ? lines.slice(1) : lines).map(parseCsvLine);
  const resolvedNameIndex = hasHeader ? nameIndex : 0;
  const resolvedPassportIndex = hasHeader ? passportIndex : 1;

  return rows
    .map((columns) => ({
      fullName: (columns[resolvedNameIndex] ?? "").trim(),
      passportId: (columns[resolvedPassportIndex] ?? "").trim().toUpperCase(),
    }))
    .filter((row) => row.fullName || row.passportId);
}
