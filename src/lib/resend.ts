import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

// Zonder eigen geverifieerd domein bij Resend kan enkel vanaf dit testadres
// verstuurd worden. Zodra een eigen domein is geverifieerd, kan de afzender
// via RESEND_AFZENDER worden aangepast.
export const AFZENDER = process.env.RESEND_AFZENDER || "Beheerportaal <onboarding@resend.dev>";
