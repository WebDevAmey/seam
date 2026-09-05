import type { Context, Next } from "hono";
import { verifyToken, type SessionPayload } from "./jwt.js";

// Every route file that uses either middleware below types its Hono app as
// `new Hono<AuthEnv>()` so `c.get("merchantId")` comes back as a real
// `string`, not `unknown` — and so the handler reads the *authenticated*
// merchant id, not a re-parsed URL param that TS can only widen to
// `string | undefined` once a generic middleware sits in front of it.
export type AuthEnv = { Variables: { merchantId: string } };

async function authenticate(c: Context): Promise<SessionPayload | null> {
  const header = c.req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return null;
  return verifyToken(token);
}

/** Requires a valid session; doesn't check it against any URL param. Use
 * this where the route doesn't take a target merchant id from the URL. */
export async function requireSession(c: Context<AuthEnv>, next: Next) {
  const session = await authenticate(c);
  if (!session) return c.json({ error: "unauthorised" }, 401);
  c.set("merchantId", session.merchantId);
  await next();
}

/** For `/merchants/:id/...` routes: the URL names a target merchant, and a
 * valid session for merchant A must not read or write merchant B's data
 * just because it can guess B's id — so the session's own merchantId has to
 * actually match the one in the URL, not just be *a* valid session. */
export async function requireOwnMerchant(c: Context<AuthEnv>, next: Next) {
  const session = await authenticate(c);
  if (!session) return c.json({ error: "unauthorised" }, 401);
  if (session.merchantId !== c.req.param("id")) {
    return c.json({ error: "forbidden" }, 403);
  }
  c.set("merchantId", session.merchantId);
  await next();
}
