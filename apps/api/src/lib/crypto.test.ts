import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto.js";

const KEY = "test-encryption-key-do-not-use-in-prod";

describe("encrypt/decrypt (AES-256-GCM, v1 envelope)", () => {
  it("round-trips a secret", () => {
    const plaintext = "rzp_test_ABC123";
    const encrypted = encrypt(plaintext, KEY);
    expect(decrypt(encrypted, KEY)).toBe(plaintext);
  });

  it("produces the v1:<iv>:<tag>:<data> envelope format", () => {
    const encrypted = encrypt("secret", KEY);
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
  });

  it("never encrypts the same plaintext to the same ciphertext twice", () => {
    // a fresh random IV per call — a fixed IV would leak equal-plaintext
    // patterns across rows, which matters for stored API secrets.
    const a = encrypt("secret", KEY);
    const b = encrypt("secret", KEY);
    expect(a).not.toBe(b);
  });

  it("rejects tampered ciphertext instead of returning garbage", () => {
    const encrypted = encrypt("secret", KEY);
    const [v, iv, tag, data] = encrypted.split(":");
    const bytes = Buffer.from(data!, "base64");
    bytes[0] = bytes[0]! ^ 0xff; // flip a real byte, not just append text
    const tampered = [v, iv, tag, bytes.toString("base64")].join(":");
    expect(() => decrypt(tampered, KEY)).toThrow();
  });

  it("rejects decryption under the wrong key", () => {
    const encrypted = encrypt("secret", KEY);
    expect(() => decrypt(encrypted, "a-completely-different-key")).toThrow();
  });
});
