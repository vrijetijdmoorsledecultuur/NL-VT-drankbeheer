/**
 * Geeft een voornaam om iemand mee aan te spreken. Gebruikt de ingestelde
 * naam als die er is (en geen e-mailadres blijkt te zijn — de standaardwaarde
 * bij aanmaken zonder opgegeven naam). Anders leidt het een nette voornaam af
 * uit het e-mailadres, zodat er nooit een kaal e-mailadres getoond wordt.
 */
export function voornaam(fullName: string | null | undefined, email?: string | null): string | undefined {
  const heeftEchteNaam = !!fullName && !fullName.includes("@");
  if (heeftEchteNaam) return fullName!.trim().split(" ")[0];

  const bron = !heeftEchteNaam && fullName ? fullName : email;
  if (!bron) return undefined;

  const lokaalDeel = bron.split("@")[0];
  const eersteStuk = lokaalDeel.split(/[._\-+0-9]/).filter(Boolean)[0];
  if (!eersteStuk) return undefined;

  return eersteStuk.charAt(0).toUpperCase() + eersteStuk.slice(1).toLowerCase();
}

/** Volledige weergavenaam: de ingestelde naam, of anders de afgeleide voornaam. */
export function weergavenaam(fullName: string | null | undefined, email?: string | null): string {
  const heeftEchteNaam = !!fullName && !fullName.includes("@");
  if (heeftEchteNaam) return fullName!.trim();
  return voornaam(fullName, email) || email || "Gebruiker";
}
