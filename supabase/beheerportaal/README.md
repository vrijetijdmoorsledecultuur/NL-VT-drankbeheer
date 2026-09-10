# Herstel Beheerportaal

Deze migraties herstellen het afzonderlijke oude Beheerportaal in het schema
`beheerportaal`. Daardoor blijven de bestaande tabellen van andere toepassingen
in `public` onaangeroerd.

Voer de bestanden in deze volgorde uit:

1. `01_schema.sql`
2. `02_tellingen.sql`
3. `03_telplekken_en_verwerking.sql`
4. `04_login_email_phone_pin.sql`

Voeg daarna `beheerportaal` toe aan **Project Settings > API > Exposed schemas**
in Supabase en herlaad de API-configuratie.

Configureer de applicatie met:

```text
NEXT_PUBLIC_SUPABASE_SCHEMA=beheerportaal
```

De vierde migratie koppelt bestaande Supabase Auth-gebruikers aan een profiel in
Beheerportaal. Ze kopieert alleen noodzakelijke accountvelden en verwijdert of
wijzigt geen gegevens in `public`.

De migraties maken de functionele structuur opnieuw aan, maar bevatten geen
historische tellingen uit het verdwenen Supabase-project. Zulke tellingen mogen
alleen uit een echte back-up of export worden geïmporteerd.
