import { jwtVerify, SignJWT } from "jose";
import { requireEnv } from "../env.js";

export type SessionPayload = {
  merchantId: string;
  email: string;
  name: string;
};

// Read fresh each call, not cached as a module-level constant at import
// time — the constant-at-import pattern this is adapted from makes runtime
// secret rotation (and testing with a changed secret) silently not work.
function secretKey(): Uint8Array {
  return new TextEncoder().encode(requireEnv("JWT_SECRET"));
}

export async function generateToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.merchantId === "string" &&
      typeof payload.email === "string" &&
      typeof payload.name === "string"
    ) {
      return { merchantId: payload.merchantId, email: payload.email, name: payload.name };
    }
    return null;
  } catch {
    return null;
  }
}
