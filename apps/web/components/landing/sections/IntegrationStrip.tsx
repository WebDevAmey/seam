const INTEGRATIONS = [
  { label: "Shopify", accent: "saffron" as const },
  { label: "Razorpay", accent: "indigo" as const },
  { label: "Postgres", accent: "teal" as const },
];

const accentClasses: Record<string, string> = {
  saffron: "fine-hover:bg-accent-saffron/5",
  indigo: "fine-hover:bg-accent-indigo/5",
  teal: "fine-hover:bg-accent-teal/5",
};

export function IntegrationStrip() {
  return (
    <section className="border-b border-border-primary bg-bg-primary py-12 sm:py-14" aria-labelledby="integrations-title">
      <div className="w-[calc(100%-24px)] sm:w-[calc(100%-32px)] mx-auto">
        <div className="flex flex-col items-center text-center">
          <p
            id="integrations-title"
            className="reveal inline-flex items-center rounded-full border border-border-primary bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-text-light shadow-sm"
          >
            The two systems Seam actually joins
          </p>

          <div className="mt-8 grid w-full grid-cols-3 gap-3">
            {INTEGRATIONS.map(({ label, accent }) => (
              <div
                key={label}
                className={`reveal group/logo flex h-16 w-full items-center justify-center rounded-lg px-5 transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${accentClasses[accent]}`}
              >
                <span className="font-serif text-xl italic tracking-tight text-text-secondary opacity-70 transition-opacity duration-200 group-hover/logo:opacity-100">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
