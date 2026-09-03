import { Resend } from "resend";

export function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("E-mailverzending is nog niet geconfigureerd.");
  }
  return new Resend(apiKey);
}

// Zonder eigen geverifieerd domein bij Resend kan enkel vanaf dit testadres
// verstuurd worden. Zodra een eigen domein is geverifieerd, kan de afzender
// via RESEND_AFZENDER worden aangepast.
export const AFZENDER = process.env.RESEND_AFZENDER || "Beheerportaal <onboarding@resend.dev>";
