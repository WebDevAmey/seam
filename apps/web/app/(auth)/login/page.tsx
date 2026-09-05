"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <h1 className="font-heading text-[20px] font-semibold text-[#f0f0f0]">Sign in</h1>
        <p className="mt-1 text-[13px] text-[#8a8a8a]">Where revenue leaked, and what got recovered.</p>
      </div>

      {state?.error && (
        <p className="rounded-lg border border-[#ef4444]/25 bg-[#ef4444]/5 px-3 py-2 text-[13px] text-[#ef4444]">
          {state.error}
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-[13px] font-medium text-[#8a8a8a]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-white/[0.06] bg-[#050505] px-3 py-2.5 text-[14px] text-[#f0f0f0] outline-none focus:border-[#3b82f6] focus:ring-4 focus:ring-[#3b82f6]/10"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-[13px] font-medium text-[#8a8a8a]">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-white/[0.06] bg-[#050505] px-3 py-2.5 text-[14px] text-[#f0f0f0] outline-none focus:border-[#3b82f6] focus:ring-4 focus:ring-[#3b82f6]/10"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#3b82f6] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#60a5fa] disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-[13px] text-[#8a8a8a]">
        No account?{" "}
        <Link href="/signup" className="font-medium text-[#3b82f6] hover:text-[#60a5fa]">
          Create one
        </Link>
      </p>
    </form>
  );
}
