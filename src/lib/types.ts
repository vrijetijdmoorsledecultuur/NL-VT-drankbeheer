export type Role = "systeembeheerder" | "afdelingshoofd" | "gebouwbeheerder" | "administratie" | "theatertechnieker";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  pincode_hash?: string | null;
};

export type Telling = {
  reservation_id: string;
  product_id: string;
  vooraf: number | null;
  nadien: number | null;
  vooraf_frigo: number | null;
  vooraf_bakken: number | null;
  vooraf_los: number | null;
  nadien_frigo: number | null;
  nadien_bakken: number | null;
  nadien_los: number | null;
};

export type VerbruikRegel = {
  id: string;
  reservation_id: string | null;
  building_id: string | null;
  datum: string | null;
  product_id: string;
  aantal: number;
  wie: string | null;
  bewijs_url?: string | null;
};

export type ReservationBoete = {
  reservation_id: string;
  product_id: string;
  bewijs_url: string | null;
};

export type Contact = {
  id: string;
  ruwe_naam: string;
  vereniging: string | null;
  contactpersoon: string | null;
  telefoon: string | null;
  adres: string | null;
};

export type Reservation = {
  id: string;
  building_id: string;
  contact_id: string | null;
  huurder: string;
  adres: string | null;
  telefoon: string | null;
  activiteit: string | null;
  ruimte: string | null;
  begin_datum: string;
  eind_datum: string;
  toegang_start: string | null;
  activiteit_start: string | null;
  activiteit_eind: string | null;
  toegang_eind: string | null;
  status: "wacht" | "gecontroleerd";
  recreatex_verwerkt: boolean;
  recreatex_verwerkt_door: string | null;
  recreatex_verwerkt_op: string | null;
  bron: "pdf" | "manueel";
};

export type PendingRole = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};

export type Building = {
  id: string;
  name: string;
  actief: boolean;
  teller_token?: string;
};

export type RuweTelling = {
  id: string;
  building_id: string;
  reservation_id: string | null;
  type: "vooraf" | "nadien" | "controle";
  ingevoerd_door: string | null;
  status: "open" | "verwerkt";
  afwijking_bevestigd: boolean;
  telplek_id: string | null;
  vaste_voorraad_bevestigd: boolean;
  created_at: string;
};

export type VoorraadControletelling = {
  id: string;
  building_id: string;
  product_id: string;
  aantal: number;
  datum: string;
  created_at: string;
};

export type ProductPrijs = {
  id: string;
  product_id: string;
  prijs: number;
  geldig_vanaf: string;
  created_at: string;
};

export type Telplek = {
  id: string;
  building_id: string;
  naam: string;
  volgorde: number;
  vereist_telplek_id: string | null;
  heeft_vaste_voorraad: boolean;
  actief: boolean;
};

export type TelplekVasteVoorraadRegel = {
  telplek_id: string;
  product_id: string;
  aantal: number;
};

export type TelplekProduct = {
  telplek_id: string;
  product_id: string;
  standaard: boolean;
  volgorde: number;
};

export type Voorraadverplaatsing = {
  id: string;
  product_id: string;
  van_building_id: string;
  naar_building_id: string;
  aantal: number;
  datum: string;
  reden: string | null;
  wie: string | null;
  created_at: string;
};

export type Leverancier = {
  id: string;
  naam: string;
  email: string | null;
  telefoon: string | null;
  actief: boolean;
};

export type BestellingStatus = "concept" | "verstuurd" | "deels_geleverd" | "geleverd" | "geannuleerd";

export type Bestelling = {
  id: string;
  building_id: string;
  leverancier_id: string | null;
  status: BestellingStatus;
  notitie: string | null;
  aangemaakt_door: string | null;
  created_at: string;
  verstuurd_op: string | null;
};

export type LogboekRegel = {
  id: string;
  created_at: string;
  gebruiker_naam: string | null;
  actie: string;
  omschrijving: string;
  building_id: string | null;
  reservation_id: string | null;
};

export type Factuur = {
  id: string;
  building_id: string;
  naam: string;
  type: "factuur" | "creditnota";
  datum: string;
  bedrag: number;
  wie: string | null;
  created_at: string;
  status: "open" | "goedgekeurd";
  goedgekeurd_door: string | null;
  goedgekeurd_op: string | null;
  recreatex_verwerkt: boolean;
  recreatex_verwerkt_door: string | null;
  recreatex_verwerkt_op: string | null;
};

export type FactuurRegel = {
  factuur_id: string;
  product_id: string;
  aantal: number;
  prijs: number;
};

export type BestellingRegel = {
  bestelling_id: string;
  product_id: string;
  besteld_aantal: number;
  geleverd_aantal: number;
};

export type ReservationToegangscode = {
  id: string;
  reservation_id: string;
  code: string;
  geldig_vanaf: string;
  geldig_tot: string;
  verstuur_email: string | null;
  verstuur_op: string | null;
  verstuurd: boolean;
  created_at: string;
};

export type RuweTellingRegel = {
  ruwe_telling_id: string;
  product_id: string;
  aantal: number;
  frigo: number | null;
  bakken: number | null;
  los: number | null;
};

export type Afrekenmodus = "standaard" | "toeslag";

export type Product = {
  id: string;
  name: string;
  prijs: number;
  categorie: string;
  verpakking: number;
  actief: boolean;
  afrekenmodus: Afrekenmodus;
};

export const CATEGORIES = ["Non-alcoholisch", "Bier", "Wijn & cava", "Versnaperingen", "Diversen", "Boetes"];

export const AFREKENMODUS_LABELS: Record<Afrekenmodus, string> = {
  standaard: "Product (per gebouw aan te vinken of het standaard is)",
  toeslag: "Boete / toeslag (vast bedrag, niet per gebouw)",
};

export const ROLE_LABELS: Record<Role, string> = {
  systeembeheerder: "Systeembeheerder",
  afdelingshoofd: "Afdelingshoofd",
  gebouwbeheerder: "Gebouwbeheerder",
  administratie: "Administratief medewerker",
  theatertechnieker: "Theatertechnieker",
};
