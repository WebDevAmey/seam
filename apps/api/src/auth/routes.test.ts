import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { authRoutes } from "./routes.js";

beforeAll(() => {
  process.env.JWT_SECRET = "test-jwt-secret-do-not-use-in-prod";
});

function freshEmail(): string {
  return `auth-test-${randomUUID()}@example.com`;
}

async function signup(email: string, password = "correct-horse-battery") {
  return authRoutes.request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test Merchant", email, password }),
  });
}

describe("POST /auth/signup", () => {
  it("creates an account and returns a usable token", async () => {
    const email = freshEmail();
    const res = await signup(email);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { token: string; merchant: { email: string } };
    expect(body.merchant.email).toBe(email);
    expect(typeof body.token).toBe("string");
  });

  it("rejects a duplicate email", async () => {
    const email = freshEmail();
    await signup(email);
    const second = await signup(email);
    expect(second.status).toBe(409);
  });

  it("rejects a password under 8 characters", async () => {
    const res = await signup(freshEmail(), "short");
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("logs in with the right password", async () => {
    const email = freshEmail();
    await signup(email, "correct-horse-battery");
    const res = await authRoutes.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-battery" }),
    });
    expect(res.status).toBe(200);
  });

  it("rejects the wrong password without revealing whether the email exists", async () => {
    const email = freshEmail();
    await signup(email, "correct-horse-battery");
    const wrongPassword = await authRoutes.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "wrong-password" }),
    });
    const noSuchAccount = await authRoutes.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: freshEmail(), password: "wrong-password" }),
    });
    expect(wrongPassword.status).toBe(401);
    expect(noSuchAccount.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await noSuchAccount.json());
  });
});

describe("GET /auth/me", () => {
  it("returns the merchant for a valid token", async () => {
    const email = freshEmail();
    const signupRes = await signup(email);
    const { token } = (await signupRes.json()) as { token: string };

    const res = await authRoutes.request("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { email: string };
    expect(body.email).toBe(email);
  });

  it("rejects a missing or invalid token", async () => {
    const missing = await authRoutes.request("/auth/me");
    const invalid = await authRoutes.request("/auth/me", { headers: { Authorization: "Bearer garbage" } });
    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
  });
});
