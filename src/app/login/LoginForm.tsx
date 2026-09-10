"use client";

import { useFormStatus } from "react-dom";
import { login, requestPincodeReset } from "./actions";

function LoginButtons() {
  const { pending } = useFormStatus();

  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold py-2.5 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Bezig…" : "Inloggen"}
      </button>
      <button
        type="submit"
        formAction={requestPincodeReset}
        formNoValidate
        disabled={pending}
        className="w-full text-sm font-semibold text-[#6D5AE6] py-1 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Even geduld…" : "Pincode vergeten?"}
      </button>
    </>
  );
}

export default function LoginForm({ error, message }: { error?: string; message?: string }) {
  return (
    <form action={login} className="bg-white rounded-2xl border border-[#ECECF3] p-6 space-y-4">
      <div>
        <label className="text-xs font-semibold text-[#8A8FA8] uppercase" htmlFor="identifier">
          E-mailadres of gsm-nummer
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          required
          autoComplete="username"
          placeholder="naam@voorbeeld.be of 0470 00 00 00"
          className="w-full mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-[#8A8FA8] uppercase" htmlFor="pin">
          Persoonlijke pincode
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          required
          inputMode="numeric"
          autoComplete="current-password"
          placeholder="••••••"
          className="w-full mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
        />
      </div>

      {error && <div role="alert" className="text-sm text-[#B4231C] bg-[#FCEDEC] rounded-lg px-3 py-2">{error}</div>}
      {message && <div role="status" className="text-sm text-[#176B4D] bg-[#E9F7F1] rounded-lg px-3 py-2">{message}</div>}

      <LoginButtons />
    </form>
  );
}
