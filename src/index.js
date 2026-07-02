// NL-VT-drankbeheer — Cloudflare Worker (geen externe dependencies)

function j(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

function b64url(bytes) {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pbkdf2Hash(password, saltBytes) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

async function maakPinHash(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const dk = await pbkdf2Hash(pin, salt);
  return `pbkdf2$100000$${b64url(salt)}$${b64url(dk)}`;
}

async function checkPin(pin, hash) {
  try {
    const [, , saltB64, dkB64] = hash.split("$");
    const salt = unb64url(saltB64);
    const verwacht = unb64url(dkB64);
    const dk = await pbkdf2Hash(pin, salt);
    if (dk.length !== verwacht.length) return false;
    let diff = 0;
    for (let i = 0; i < dk.length; i++) diff |= dk[i] ^ verwacht[i];
    return diff === 0;
  } catch {
    return false;
  }
}

async function hmac(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return b64url(new Uint8Array(sig));
}

async function maakSessie(data, secret) {
  const payload = JSON.stringify(data);
  const payloadB64 = b64url(new TextEncoder().encode(payload));
  const sig = await hmac(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

async function leesSessie(token, secret) {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const verwachtSig = await hmac(secret, payloadB64);
    if (sig !== verwachtSig) return null;
    const data = JSON.parse(new TextDecoder().decode(unb64url(payloadB64)));
    if (!data.expires || data.expires < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function getCookie(request, naam) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.split(/;\s*/).find((c) => c.startsWith(naam + "="));
  return match ? match.slice(naam.length + 1) : null;
}

async function huidigeGebruiker(request, env) {
  const token = getCookie(request, "sessie");
  if (!token) return null;
  return await leesSessie(token, env.SESSION_SECRET);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const db = env.DB;

    try {
      // ---- Publiek: login/logout ----
      if (path === "/api/login" && method === "POST") {
        const { email, pin } = await request.json();
        const user = await db
          .prepare("SELECT id, naam, email, rol, pin_hash FROM gebruikers WHERE email=? AND actief=1")
          .bind(email)
          .first();
        if (!user || !(await checkPin(pin, user.pin_hash))) {
          return j({ fout: "E-mail of pincode onjuist." }, 401);
        }
        const sessie = await maakSessie(
          { id: user.id, naam: user.naam, email: user.email, rol: user.rol, expires: Date.now() + 12 * 3600 * 1000 },
          env.SESSION_SECRET
        );
        return j(
          { id: user.id, naam: user.naam, email: user.email, rol: user.rol },
          200,
          { "Set-Cookie": `sessie=${sessie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${12 * 3600}` }
        );
      }

      if (path === "/api/logout" && method === "POST") {
        return j({ ok: true }, 200, { "Set-Cookie": "sessie=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
      }

      const gebruiker = await huidigeGebruiker(request, env);

      if (path === "/api/me") {
        if (!gebruiker) return j({ fout: "Niet aangemeld." }, 401);
        return j(gebruiker);
      }

      if (!gebruiker) return j({ fout: "Niet aangemeld." }, 401);
      const isBeheerder = gebruiker.rol === "beheerder";

      if (path === "/api/gebouwen" && method === "GET") {
        const r = await db.prepare("SELECT naam FROM gebouwen ORDER BY naam").all();
        return j({ gebouwen: r.results.map((x) => x.naam) });
      }

      if (path === "/api/zalen" && method === "GET") {
        const gebouw = url.searchParams.get("gebouw");
        const r = await db
          .prepare("SELECT z.naam FROM zalen z JOIN gebouwen g ON g.id=z.gebouw_id WHERE g.naam=? ORDER BY z.naam")
          .bind(gebouw)
          .all();
        return j({ zalen: r.results.map((x) => x.naam) });
      }

      if (path === "/api/config" && method === "GET") {
        const gebouw = url.searchParams.get("gebouw");
        const locatie = url.searchParams.get("locatie");
        let sql = "SELECT id, dranksoort, categorie, prijs_per_stuk, locatie, flesjes_per_bak FROM drankconfig WHERE gebouw=? AND actief=1";
        const params = [gebouw];
        if (locatie) {
          sql += " AND locatie=?";
          params.push(locatie);
        }
        sql += " ORDER BY volgorde";
        const producten = await db.prepare(sql).bind(...params).all();
        const stocks = await db.prepare("SELECT drank, stock FROM voorraad WHERE gebouw=?").bind(gebouw).all();
        const stockMap = {};
        stocks.results.forEach((s) => (stockMap[s.drank] = s.stock));
        return j({ producten: producten.results.map((p) => ({ ...p, stock: stockMap[p.dranksoort] || 0 })) });
      }

      if (path === "/api/registraties" && method === "GET") {
        const r = await db.prepare("SELECT registratie_id, gebouw, zaal, datum, vereniging, fase, status FROM registraties ORDER BY id DESC LIMIT 20").all();
        return j({ registraties: r.results });
      }

      if (path === "/api/registraties" && method === "POST") {
        const { fase, gebouw, datum, zaal, vereniging, regels } = await request.json();
        const registratie_id = `REG-${Date.now()}`;
        await db
          .prepare("INSERT INTO registraties (registratie_id, gebouw, zaal, datum, vereniging, fase, status, aangemaakt_door) VALUES (?,?,?,?,?,?,?,?)")
          .bind(registratie_id, gebouw, zaal || "", datum, vereniging || "", fase, "open", gebruiker.naam)
          .run();
        for (const regel of regels) {
          await db
            .prepare("INSERT INTO voorraad (gebouw, drank, stock) VALUES (?,?,?) ON CONFLICT(gebouw,drank) DO UPDATE SET stock=excluded.stock")
            .bind(gebouw, regel.dranksoort, regel.totaal_voor)
            .run();
          await db
            .prepare("INSERT INTO voorraad_mutaties (gebouw, drank, mutatie_type, hoeveelheid, datum, registratie_id) VALUES (?,?,?,?,?,?)")
            .bind(gebouw, regel.dranksoort, "voortelling", regel.totaal_voor, datum, registratie_id)
            .run();
        }
        return j({ registratie_id });
      }

      // ---- Beheer: enkel voor beheerders ----
      if (path.startsWith("/api/beheer/")) {
        if (!isBeheerder) return j({ fout: "Geen toegang." }, 403);

        if (path === "/api/beheer/gebruikers" && method === "GET") {
          const r = await db.prepare("SELECT id, naam, email, rol, actief FROM gebruikers ORDER BY naam").all();
          return j({ gebruikers: r.results });
        }
        if (path === "/api/beheer/gebruiker" && method === "POST") {
          const { naam, email, rol, pin } = await request.json();
          const pin_hash = await maakPinHash(pin);
          await db.prepare("INSERT INTO gebruikers (naam, email, rol, pin_hash, actief) VALUES (?,?,?,?,1)").bind(naam, email, rol, pin_hash).run();
          return j({ ok: true });
        }
        if (path === "/api/beheer/gebruiker" && method === "PATCH") {
          const { id, nieuwe_pin, actief } = await request.json();
          if (nieuwe_pin) {
            const pin_hash = await maakPinHash(nieuwe_pin);
            await db.prepare("UPDATE gebruikers SET pin_hash=? WHERE id=?").bind(pin_hash, id).run();
          }
          if (actief !== undefined) {
            await db.prepare("UPDATE gebruikers SET actief=? WHERE id=?").bind(actief ? 1 : 0, id).run();
          }
          return j({ ok: true });
        }
        if (path === "/api/beheer/gebruiker/wijzig" && method === "PATCH") {
          const { id, naam, email, rol } = await request.json();
          await db.prepare("UPDATE gebruikers SET naam=?, email=?, rol=? WHERE id=?").bind(naam, email, rol, id).run();
          return j({ ok: true });
        }

        if (path === "/api/beheer/config" && method === "GET") {
          const gebouwenR = await db.prepare("SELECT naam FROM gebouwen ORDER BY naam").all();
          const drankenR = await db
            .prepare("SELECT dranksoort, categorie, MIN(prijs_per_stuk) as prijs_per_stuk, MIN(flesjes_per_bak) as flesjes_per_bak FROM drankconfig GROUP BY dranksoort, categorie ORDER BY categorie, dranksoort")
            .all();
          const matrixR = await db.prepare("SELECT gebouw, dranksoort, actief, locatie FROM drankconfig").all();
          return j({ gebouwen: gebouwenR.results.map((x) => x.naam), dranken: drankenR.results, matrix: matrixR.results });
        }

        if (path === "/api/beheer/config/status" && method === "PUT") {
          // status: "uit" | "Frigo" | "Koelcel" | "Drankberging"
          const { gebouw, dranksoort, status } = await request.json();
          if (status === "uit") {
            await db.prepare("UPDATE drankconfig SET actief=0 WHERE gebouw=? AND dranksoort=?").bind(gebouw, dranksoort).run();
          } else {
            const bestaat = await db.prepare("SELECT id FROM drankconfig WHERE gebouw=? AND dranksoort=?").bind(gebouw, dranksoort).first();
            if (bestaat) {
              await db.prepare("UPDATE drankconfig SET actief=1, locatie=? WHERE gebouw=? AND dranksoort=?").bind(status, gebouw, dranksoort).run();
            } else {
              const bron = await db.prepare("SELECT categorie, eenheid, flesjes_per_bak, prijs_per_stuk FROM drankconfig WHERE dranksoort=? LIMIT 1").bind(dranksoort).first();
              await db
                .prepare("INSERT INTO drankconfig (gebouw, zaal, volgorde, categorie, dranksoort, eenheid, flesjes_per_bak, locatie, prijs_per_stuk, actief) VALUES (?,?,?,?,?,?,?,?,?,1)")
                .bind(gebouw, "Alle zalen", 999, bron?.categorie || "Overig", dranksoort, bron?.eenheid || "flesje", bron?.flesjes_per_bak || 24, status, bron?.prijs_per_stuk || 0)
                .run();
            }
          }
          return j({ ok: true });
        }

        if (path === "/api/beheer/config/prijs" && method === "PUT") {
          const { dranksoort, prijs_per_stuk } = await request.json();
          await db.prepare("UPDATE drankconfig SET prijs_per_stuk=? WHERE dranksoort=?").bind(prijs_per_stuk, dranksoort).run();
          return j({ ok: true });
        }

        if (path === "/api/beheer/config/bak" && method === "PUT") {
          const { dranksoort, flesjes_per_bak } = await request.json();
          await db.prepare("UPDATE drankconfig SET flesjes_per_bak=? WHERE dranksoort=?").bind(flesjes_per_bak, dranksoort).run();
          return j({ ok: true });
        }

        if (path === "/api/beheer/gebouwen" && method === "GET") {
          const r = await db.prepare("SELECT id, naam FROM gebouwen ORDER BY naam").all();
          return j({ gebouwen: r.results });
        }
        if (path === "/api/beheer/gebouw" && method === "POST") {
          const { naam } = await request.json();
          await db.prepare("INSERT OR IGNORE INTO gebouwen (naam) VALUES (?)").bind(naam).run();
          return j({ ok: true });
        }
        if (path === "/api/beheer/gebouw" && method === "DELETE") {
          const { id } = await request.json();
          await db.prepare("DELETE FROM zalen WHERE gebouw_id=?").bind(id).run();
          await db.prepare("DELETE FROM gebouwen WHERE id=?").bind(id).run();
          return j({ ok: true });
        }

        if (path === "/api/beheer/zalen" && method === "GET") {
          const gebouw_id = url.searchParams.get("gebouw_id");
          const r = await db.prepare("SELECT id, naam FROM zalen WHERE gebouw_id=? ORDER BY naam").bind(gebouw_id).all();
          return j({ zalen: r.results });
        }
        if (path === "/api/beheer/zaal" && method === "POST") {
          const { gebouw_id, naam } = await request.json();
          await db.prepare("INSERT INTO zalen (gebouw_id, naam) VALUES (?,?)").bind(gebouw_id, naam).run();
          return j({ ok: true });
        }
        if (path === "/api/beheer/zaal" && method === "DELETE") {
          const { id } = await request.json();
          await db.prepare("DELETE FROM zalen WHERE id=?").bind(id).run();
          return j({ ok: true });
        }
      }

      return j({ fout: "Niet gevonden." }, 404);
    } catch (e) {
      return j({ fout: "Serverfout: " + e.message }, 500);
    }
  },
};
