const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatPaise(paise: string | number | bigint): string {
  const rupees = Number(paise) / 100;
  return rupeeFormatter.format(rupees);
}

const LEAK_CLASS_LABELS: Record<string, string> = {
  PAYMENT_BLOCKED: "Payment blocked",
  ISSUER_DOWNTIME: "Issuer downtime",
  SILENT_ABANDON: "Silent abandon",
  PRE_CHECKOUT_DROP: "Pre-checkout drop",
  METHOD_CONCENTRATION: "Method concentration",
  POST_PURCHASE_LEAK: "Post-purchase leak",
};

export function leakClassLabel(leakClass: string): string {
  return LEAK_CLASS_LABELS[leakClass] ?? leakClass;
}

const METHOD_LABELS: Record<string, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Netbanking",
  wallet: "Wallet",
  emi: "EMI",
};

export function methodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method;
}

export function shortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
