import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

// Zonder eigen geverifieerd domein bij Resend kan enkel vanaf dit testadres
// verstuurd worden. Zodra jullie een domein verifiëren, kan dit aangepast
// worden naar bv. "Beheerportaal <bestellingen@moorslede.be>".
export const AFZENDER = process.env.RESEND_AFZENDER || "Beheerportaal <onboarding@resend.dev>";
