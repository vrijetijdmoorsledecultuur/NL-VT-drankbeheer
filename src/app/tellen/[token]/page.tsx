import { getGebouwen } from "@/app/tellen/[token]/actions";
import TellerApp from "@/components/TellerApp";

export default async function TellenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gebouwen = await getGebouwen(token);

  if (gebouwen.length === 0) {
    return (
      <div className="min-h-screen bg-[#F7F7FB] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#ECECF3] p-8 max-w-sm text-center">
          <div className="font-bold text-[#171A2B] mb-2">Link niet geldig</div>
          <p className="text-sm text-[#8A8FA8]">
            Deze link werkt niet (meer). Vraag de systeembeheerder om de tellen-link opnieuw door te sturen.
          </p>
        </div>
      </div>
    );
  }

  return <TellerApp token={token} gebouwen={gebouwen} />;
}
