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
