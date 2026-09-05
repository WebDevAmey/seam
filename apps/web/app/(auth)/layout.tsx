import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center gap-2 w-fit">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#3b82f6] text-[14px] font-bold text-white">
            S
          </span>
          <span className="font-heading text-[16px] font-semibold tracking-tight text-[#f0f0f0]">Seam</span>
        </Link>
        <div className="rounded-2xl border border-white/[0.06] bg-[#0c0c0c] p-7 shadow-2xl">{children}</div>
        <Link href="/" className="mt-5 block text-center text-[13px] text-[#8a8a8a] hover:text-[#f0f0f0]">
          ← Back to the site
        </Link>
      </div>
    </div>
  );
}
