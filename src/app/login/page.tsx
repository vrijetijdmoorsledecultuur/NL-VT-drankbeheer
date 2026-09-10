import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7FB] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-[11px] font-semibold tracking-wide text-[#6D5AE6] uppercase">Beheerportaal</div>
          <h1 className="text-2xl font-bold text-[#171A2B] mt-1">Zalen & verbruik</h1>
        </div>

        <LoginForm error={error} message={message} />

        <p className="text-center text-xs text-[#8A8FA8] mt-4">
          Geen toegang? Vraag de beheerder om je e-mailadres of gsm-nummer te activeren.
        </p>
      </div>
    </div>
  );
}
