/**
 * Formaat: DD-MM-JJJJ, voor weergave (niet voor opslag — dat blijft ISO
 * (JJJJ-MM-DD), zoals Postgres en <input type="date"> verwachten).
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const datePart = value.split("T")[0];
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return value;
  return `${d}-${m}-${y}`;
}

/** Zoals formatDate, maar met uur:minuut erbij (bv. voor "ingediend om"). */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const [datePart, timePart] = value.split("T");
  const formattedDate = formatDate(datePart);
  if (!timePart) return formattedDate;
  const time = timePart.slice(0, 5);
  return `${formattedDate} ${time}`;
}
