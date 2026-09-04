"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PincodeHerstellenPage() {
  const [pin, setPin] = useState("");
  const [bevestiging, setBevestiging] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "invalid">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    async function recoverSession() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!exchangeError && data.session) {
          window.history.replaceState({}, "", "/pincode-herstellen");
          setStatus("ready");
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      setStatus(data.session ? "ready" : "invalid");
    }
    recoverSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setStatus("ready");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(pin)) {
      setError("Kies een pincode van precies 6 cijfers.");
      return;
    }
    if (pin !== bevestiging) {
      setError("De twee pincodes komen niet overeen.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: pin });
    if (updateError) {
      setError("De herstel-link is verlopen of ongeldig. Vraag een nieuwe herstelmail aan.");
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    setSaved(true);
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7FB] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#ECECF3] p-6">
        <div className="text-[11px] font-semibold tracking-wide text-[#6D5AE6] uppercase">Beheerportaal</div>
        <h1 className="text-2xl font-bold text-[#171A2B] mt-1 mb-2">Nieuwe pincode</h1>
        <p className="text-sm text-[#8A8FA8] mb-5">Kies een nieuwe persoonlijke pincode van 6 cijfers.</p>

        {saved ? (
          <div className="space-y-4">
            <div className="text-sm text-[#176B4D] bg-[#E9F7F1] rounded-lg px-3 py-2">Je nieuwe pincode is opgeslagen.</div>
            <a href="/login" className="block text-center rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold py-2.5">Naar inloggen</a>
          </div>
        ) : status === "ready" ? (
          <form onSubmit={submit} className="space-y-4">
            <input aria-label="Nieuwe pincode" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="Nieuwe pincode" className="w-full rounded-lg border border-[#ECECF3] px-3 py-2 text-sm" />
            <input aria-label="Bevestig pincode" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={bevestiging} onChange={(e) => setBevestiging(e.target.value.replace(/\D/g, ""))} placeholder="Herhaal pincode" className="w-full rounded-lg border border-[#ECECF3] px-3 py-2 text-sm" />
            {error && <div className="text-sm text-[#B4231C] bg-[#FCEDEC] rounded-lg px-3 py-2">{error}</div>}
            <button disabled={busy} className="w-full rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold py-2.5 disabled:opacity-50">{busy ? "Opslaan…" : "Nieuwe pincode opslaan"}</button>
          </form>
        ) : status === "loading" ? (
          <div className="text-sm text-[#8A8FA8]">Herstel-link controleren…</div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-[#B4231C] bg-[#FCEDEC] rounded-lg px-3 py-2">Deze herstel-link is verlopen of ongeldig.</div>
            <a href="/login" className="block text-center text-sm font-semibold text-[#6D5AE6]">Nieuwe herstelmail aanvragen</a>
          </div>
        )}
      </div>
    </div>
  );
}
