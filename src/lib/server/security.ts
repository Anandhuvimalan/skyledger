import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, hashedPassword: string | null | undefined) {
  if (!hashedPassword) {
    return false;
  }

  const [salt, storedHash] = hashedPassword.split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const derived = scryptSync(password, salt, 64);
  const stored = Buffer.from(storedHash, "hex");

  if (derived.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(derived, stored);
}

export function createSessionToken() {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
