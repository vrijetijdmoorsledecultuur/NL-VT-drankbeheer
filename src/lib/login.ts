export const PHONE_LOGIN_DOMAIN = "phone.drankbeheer.app";

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return email.includes("@") ? email : null;
}

export function normalizePhone(value: string) {
  let phone = value.trim().replace(/[^\d+]/g, "");
  if (!phone) return null;
  if (phone.startsWith("0032")) phone = `+32${phone.slice(4)}`;
  else if (phone.startsWith("0")) phone = `+32${phone.slice(1)}`;
  else if (!phone.startsWith("+")) phone = `+${phone}`;
  return /^\+\d{9,15}$/.test(phone) ? phone : null;
}

export function phoneLoginEmail(phone: string) {
  return `${phone.replace(/\D/g, "")}@${PHONE_LOGIN_DOMAIN}`;
}

export function isPhoneLoginEmail(email: string | null | undefined) {
  return Boolean(email?.endsWith(`@${PHONE_LOGIN_DOMAIN}`));
}

export function validLoginPin(value: string) {
  return /^\d{6}$/.test(value);
}
