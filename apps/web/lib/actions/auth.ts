"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_BASE_URL = process.env.SEAM_API_URL ?? "http://localhost:8090";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days, matches the token's own expiry

type AuthResult = { error: string } | undefined;

async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function signup(_prevState: AuthResult, formData: FormData): Promise<AuthResult> {
  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");

  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const body = (await res.json()) as { token?: string; error?: string };

  if (!res.ok || !body.token) {
    return { error: body.error ?? "Something went wrong. Please try again." };
  }

  await setSessionCookie(body.token);
  redirect("/recovery");
}

export async function login(_prevState: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = formData.get("email");
  const password = formData.get("password");

  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { token?: string; error?: string };

  if (!res.ok || !body.token) {
    return { error: body.error ?? "Invalid email or password" };
  }

  await setSessionCookie(body.token);
  redirect("/recovery");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
  redirect("/login");
}

export async function getCurrentMerchant(): Promise<{ id: string; name: string; email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  if (!token) return null;

  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ id: string; name: string; email: string }>;
}

// Pages under app/(app) are only ever reached with a valid session —
// middleware.ts already redirects anything else to /login. This just
// gives those pages a merchant id without re-deriving that guarantee.
export async function requireCurrentMerchantId(): Promise<string> {
  const merchant = await getCurrentMerchant();
  if (!merchant) redirect("/login");
  return merchant.id;
}
