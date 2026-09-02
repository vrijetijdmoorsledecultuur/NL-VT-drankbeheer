import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7FB] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-[11px] font-semibold tracking-wide text-[#6D5AE6] uppercase">Beheerportaal</div>
          <h1 className="text-2xl font-bold text-[#171A2B] mt-1">Zalen & verbruik</h1>
        </div>

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
              autoComplete="current-password"
              placeholder="••••••"
              className="w-full mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <div className="text-sm text-[#B4231C] bg-[#FCEDEC] rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold py-2.5"
          >
            Inloggen
          </button>
        </form>

        <p className="text-center text-xs text-[#8A8FA8] mt-4">
          Geen toegang? Vraag de beheerder om je e-mailadres of gsm-nummer te activeren.
        </p>
        <p className="text-center text-[11px] text-[#A8ABBA] mt-2">
          Een bestaand beheeraccount kan eerst nog het huidige wachtwoord gebruiken en daarna een pincode instellen.
        </p>
      </div>
    </div>
  );
}
