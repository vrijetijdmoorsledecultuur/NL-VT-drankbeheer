import { getGastContext, getGastProducten } from "@/app/gast/[code]/actions";
import GastForm from "@/components/GastForm";

export default async function GastPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getGastContext(code);

  if (!context) {
    return (
      <div className="min-h-screen bg-[#F7F7FB] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#ECECF3] p-8 max-w-sm text-center">
          <div className="font-bold text-[#171A2B] mb-2">Code niet geldig</div>
          <p className="text-sm text-[#8A8FA8]">
            Deze code werkt niet (meer) &mdash; ze is mogelijk verlopen. Neem contact op met de organisatie voor
            een nieuwe code.
          </p>
        </div>
      </div>
    );
  }

  const producten = await getGastProducten(code);

  return <GastForm code={code} context={context} producten={producten} />;
}
