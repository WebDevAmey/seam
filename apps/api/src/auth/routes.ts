import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { generateToken, verifyToken } from "./jwt.js";
import { comparePassword, hashPassword } from "./password.js";

export const authRoutes = new Hono();

const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// No OTP/email-verification step here — Seam has no email-sending
// credentials configured (see LIMITATIONS.md). An account is active
// immediately after signup; that's a disclosed scope cut, not an oversight.
authRoutes.post("/auth/signup", async (c) => {
  const body = signupSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.issues[0]?.message ?? "invalid input" }, 400);
  }

  const existing = await prisma.merchant.findUnique({ where: { email: body.data.email } });
  if (existing) {
    return c.json({ error: "an account with this email already exists" }, 409);
  }

  const passwordHash = await hashPassword(body.data.password);
  const merchant = await prisma.merchant.create({
    data: { name: body.data.name, email: body.data.email, passwordHash },
  });

  const token = await generateToken({ merchantId: merchant.id, email: merchant.email, name: merchant.name });
  return c.json({ token, merchant: { id: merchant.id, name: merchant.name, email: merchant.email } }, 201);
});

authRoutes.post("/auth/login", async (c) => {
  const body = loginSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const merchant = await prisma.merchant.findUnique({ where: { email: body.data.email } });
  if (!merchant?.passwordHash) {
    return c.json({ error: "invalid email or password" }, 401);
  }

  const valid = await comparePassword(body.data.password, merchant.passwordHash);
  if (!valid) {
    return c.json({ error: "invalid email or password" }, 401);
  }

  const token = await generateToken({ merchantId: merchant.id, email: merchant.email, name: merchant.name });
  return c.json({ token, merchant: { id: merchant.id, name: merchant.name, email: merchant.email } });
});

authRoutes.get("/auth/me", async (c) => {
  const header = c.req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return c.json({ error: "unauthorised" }, 401);

  const payload = await verifyToken(token);
  if (!payload) return c.json({ error: "unauthorised" }, 401);

  const merchant = await prisma.merchant.findUnique({ where: { id: payload.merchantId } });
  if (!merchant) return c.json({ error: "unauthorised" }, 401);

  return c.json({ id: merchant.id, name: merchant.name, email: merchant.email });
});
