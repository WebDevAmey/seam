/** Lowercase, and strip dots from the local part of a gmail address —
 * `j.a.n.e@gmail.com` and `jane@gmail.com` are the same inbox. */
export function normaliseEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.indexOf("@");
  if (atIndex === -1) return trimmed;

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  const normalisedLocal = domain === "gmail.com" ? local.replaceAll(".", "") : local;
  return `${normalisedLocal}@${domain}`;
}

/** E.164-ish normalisation for Indian numbers: strip formatting, add +91 to
 * a bare 10-digit number, strip a leading 0 first. */
export function normalisePhone(phone: string): string {
  const digitsAndPlus = phone.replace(/[^\d+]/g, "");
  if (digitsAndPlus.startsWith("+")) return digitsAndPlus;

  const digits = digitsAndPlus.replace(/^0+/, "");
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}
