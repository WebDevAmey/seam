import { jwtVerify } from "jose";

export type SessionPayload = {
  merchantId: string;
  email: string;
  name: string;
};

// Verify-only — apps/web never signs a token itself, it just relays what
// apps/api issued. Reads JWT_SECRET fresh each call, same reasoning as the
// apps/api copy of this function (see its own comment).
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
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
