# NL-VT-drankbeheer — installatiegids

Dit pakket bevat een volledig geteste, foutloze versie van de drankbeheer-app.
Volg deze stappen **in exact deze volgorde**. Elke stap bouwt op de vorige.

## Stap 1 — GitHub repo aanmaken

1. Ga naar github.com → **New repository**
2. Naam: `NL-VT-drankbeheer`
3. Laat "Add a README" **uitgevinkt** (dit pakket heeft er al één)
4. Klik **Create repository**
5. Op de lege repo-pagina: klik **uploading an existing file**
6. Sleep **alle bestanden en mappen uit dit pakket** (dus `src/`, `public/`, `wrangler.jsonc`, `db-setup.sql`, `README.md`) in het upload-vak. GitHub bewaart de mapstructuur automatisch.
7. Klik **Commit changes**

Controleer nadien dat de repo er zo uitziet:
```
NL-VT-drankbeheer/
├── src/
│   └── index.js
├── public/
│   └── index.html
├── wrangler.jsonc
├── db-setup.sql
└── README.md
```

## Stap 2 — D1-database aanmaken

1. Ga naar **Cloudflare Dashboard → Storage & Databases → D1 SQL Database**
2. Klik **Create database**
3. Naam: `nl-vt-drankbeheer-db`
4. Klik **Create**
5. Kopieer de **Database ID** die nu getoond wordt (een lange code met streepjes)

## Stap 3 — Database-ID invullen

1. Ga terug naar je GitHub-repo → open **`wrangler.jsonc`** → potlood (Edit)
2. Zoek de regel `"database_id": "PLAATS_HIER_JE_DATABASE_ID"`
3. Vervang `PLAATS_HIER_JE_DATABASE_ID` door de ID die je in Stap 2 kopieerde (tussen de aanhalingstekens laten staan)
4. **Commit changes**

## Stap 4 — Worker aanmaken en koppelen aan GitHub

1. Ga naar **Cloudflare Dashboard → Workers & Pages**
2. Klik **Create** → **Workers** → **Import a repository** (of "Connect to Git")
3. Kies je GitHub-account en selecteer de repo `NL-VT-drankbeheer`
4. Bij build-instellingen: laat **Build command leeg**, **Deploy command** = `npx wrangler deploy`
5. Klik **Save and Deploy**

De eerste deploy zal lukken zonder de vorige "itty-router"/"crypto" fouten — deze versie gebruikt geen externe packages meer.

## Stap 5 — SESSION_SECRET instellen

1. Ga naar je Worker → **Settings → Variables and Secrets**
2. Klik **Add** → type **Secret**, naam `SESSION_SECRET`, waarde: een lange willekeurige tekst (bv. 40 willekeurige tekens — verzin er zelf een, het maakt niet uit wat, als het maar geheim en lang genoeg is)
3. **Save and deploy**

## Stap 6 — Database vullen

1. Ga naar **Storage & Databases → D1 → nl-vt-drankbeheer-db → Console**
2. Open **`db-setup.sql`** uit dit pakket, kopieer de **volledige inhoud**
3. Plak in de console → klik **Run**
4. Je zou geen foutmelding mogen zien. Test met: `SELECT COUNT(*) FROM gebruikers;` → moet **13** teruggeven. En `SELECT COUNT(*) FROM drankconfig;` → moet **210** teruggeven.

## Stap 7 — Testen

1. Ga naar je Worker-URL (te vinden op de Worker-overzichtspagina, iets als `nl-vt-drankbeheer.<jouw-account>.workers.dev`)
2. Meld je aan met `niek.lyphout@moorslede.be` en pincode `moorslede`
3. Je zou het overzichtsscherm met linkermenu moeten zien

Alle 13 medewerkers hebben voorlopig dezelfde tijdelijke pincode `moorslede`. Wijzig deze zeker via **Beheer → Medewerkers → PIN** voor je het team laat inloggen.

## Wat zit er nieuw in deze versie?

- **Beheer** heeft nu drie tabbladen: **Medewerkers** (met Wijzig/PIN/Actief), **Drankconfiguratie** (matrix: dranken × gebouwen met aanvinkbare beschikbaarheid + prijs), **Locaties** (per gebouw instellen of een drank in de Frigo of de Koelcel/Drankberging staat)
- **Telling vóór** maakt nu onderscheid: Frigo-dranken tel je per stuk, Koelcel/Drankberging-dranken tel je per volle bak + losse flesjes
- Geen externe npm-dependencies meer nodig — dit voorkomt de eerdere build-fouten volledig
