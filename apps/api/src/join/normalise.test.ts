import { describe, expect, it } from "vitest";
import { normaliseEmail, normalisePhone } from "./normalise.js";

describe("normaliseEmail", () => {
  it("lowercases the whole address", () => {
    expect(normaliseEmail("Jane.Doe@Example.COM")).toBe("jane.doe@example.com");
  });

  it("strips dots from the local part of a gmail address", () => {
    expect(normaliseEmail("j.a.n.e@gmail.com")).toBe("jane@gmail.com");
  });

  it("leaves dots alone for non-gmail addresses", () => {
    expect(normaliseEmail("j.doe@example.com")).toBe("j.doe@example.com");
  });
});

describe("normalisePhone", () => {
  it("adds +91 to a bare 10-digit number", () => {
    expect(normalisePhone("9876543210")).toBe("+919876543210");
  });

  it("strips a leading 0 before adding +91", () => {
    expect(normalisePhone("09876543210")).toBe("+919876543210");
  });

  it("normalises a 91-prefixed number without the +", () => {
    expect(normalisePhone("919876543210")).toBe("+919876543210");
  });

  it("leaves an already-E.164 number alone", () => {
    expect(normalisePhone("+919876543210")).toBe("+919876543210");
  });

  it("strips spaces, hyphens, and parens before normalising", () => {
    expect(normalisePhone("+91 98765-43210")).toBe("+919876543210");
  });
});
