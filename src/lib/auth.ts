import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

function signingKey(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error("JWT_SECRET must be configured with at least 32 characters");
  return new TextEncoder().encode(value);
}

export async function createToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("cinemaxxx")
    .setAudience("cinemaxxx-admin")
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(signingKey());
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      algorithms: ["HS256"], issuer: "cinemaxxx", audience: "cinemaxxx-admin",
    });
    return payload.role === "admin";
  } catch {
    return false;
  }
}

function equal(left: string, right: string): boolean {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}

export function validateCredentials(email: unknown, password: unknown): boolean {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  // Missing configuration must fail closed, never enable a published default login.
  if (!expectedEmail || !expectedPassword || typeof email !== "string" || typeof password !== "string") return false;
  const emailMatches = equal(email.trim().toLowerCase(), expectedEmail.trim().toLowerCase());
  const passwordMatches = equal(password, expectedPassword);
  return emailMatches && passwordMatches;
}
