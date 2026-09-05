import { beforeAll, describe, expect, it } from "vitest";
import { generateToken, verifyToken } from "./jwt.js";

beforeAll(() => {
  process.env.JWT_SECRET = "test-jwt-secret-do-not-use-in-prod";
});

describe("generateToken / verifyToken", () => {
  it("round-trips the payload", async () => {
    const token = await generateToken({ merchantId: "m1", email: "a@example.com", name: "Asha" });
    const payload = await verifyToken(token);
    expect(payload).toEqual({ merchantId: "m1", email: "a@example.com", name: "Asha" });
  });

  it("rejects a tampered token", async () => {
    const token = await generateToken({ merchantId: "m1", email: "a@example.com", name: "Asha" });
    const tampered = token.slice(0, -2) + (token.slice(-2) === "AA" ? "BB" : "AA");
    expect(await verifyToken(tampered)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await generateToken({ merchantId: "m1", email: "a@example.com", name: "Asha" });
    process.env.JWT_SECRET = "a-completely-different-secret";
    const result = await verifyToken(token);
    process.env.JWT_SECRET = "test-jwt-secret-do-not-use-in-prod";
    expect(result).toBeNull();
  });

  it("rejects garbage input instead of throwing", async () => {
    expect(await verifyToken("not-a-real-token")).toBeNull();
  });
});
