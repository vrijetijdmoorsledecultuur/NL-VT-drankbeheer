"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPin, Phone } from "lucide-react";
import type { Building, Reservation, Contact } from "@/lib/types";
import { updateContact } from "@/app/(app)/contacten/actions";

const BUILDING_TONES = [
  { bg: "bg-[#FDF3E6]", border: "border-[#F0D8AE]", text: "text-[#8A5A16]" },
  { bg: "bg-[#EEF1F8]", border: "border-[#D7DCEC]", text: "text-[#3F4B6B]" },
  { bg: "bg-[#E7F0FD]", border: "border-[#C6DCF8]", text: "text-[#2E5490]" },
  { bg: "bg-[#FCEFE4]", border: "border-[#F0CDAE]", text: "text-[#96500F]" },
  { bg: "bg-[#F1ECFC]", border: "border-[#DACDF5]", text: "text-[#5B3FA8]" },
];

function ContactEditRow({ reservation, contact, canEdit }: { reservation: Reservation; contact: Contact | null; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [vereniging, setVereniging] = useState(contact?.vereniging || "");
  const [contactpersoon, setContactpersoon] = useState(contact?.contactpersoon || reservation.huurder);
  const [telefoon, setTelefoon] = useState(contact?.telefoon || reservation.telefoon || "");
  const [pending, setPending] = useState(false);

  if (!contact) {
    return <div className="font-semibold text-[#171A2B]">{reservation.huurder}</div>;
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <input value={vereniging} onChange={(e) => setVereniging(e.target.value)} placeholder="Vereniging" className="w-full rounded-lg border border-[#ECECF3] px-2 py-1 text-sm" />
        <input value={contactpersoon} onChange={(e) => setContactpersoon(e.target.value)} placeholder="Contactpersoon" className="w-full rounded-lg border border-[#ECECF3] px-2 py-1 text-sm" />
        <input value={telefoon} onChange={(e) => setTelefoon(e.target.value)} placeholder="Telefoon" className="w-full rounded-lg border border-[#ECECF3] px-2 py-1 text-sm" />
        <div className="flex gap-2">
          <button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await updateContact(contact.id, { vereniging, contactpersoon, telefoon });
              setPending(false);
              setEditing(false);
            }}
            className="text-xs font-semibold text-white bg-[#6D5AE6] rounded-lg px-2.5 py-1"
          >
            Bewaren
          </button>
          <button onClick={() => setEditing(false)} className="text-xs font-semibold text-[#5B5F82]">Annuleer</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="font-semibold text-[#171A2B]">{contact.vereniging || reservation.huurder}</div>
      {contact.contactpersoon && <div className="text-sm text-[#5B5F82]">{contact.contactpersoon}</div>}
      {canEdit && (
        <button onClick={() => setEditing(true)} className="text-xs text-[#6D5AE6] font-semibold underline decoration-dotted">
          Bewerk naam/telefoon
        </button>
      )}
    </div>
  );
}

export default function ZaalbezettingView({
  selectedDate,
  buildings,
  reservations,
  contacts,
  canEdit,
}: {
  selectedDate: string;
  buildings: Building[];
  reservations: Reservation[];
  contacts: Contact[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  const buildingsWithData = buildings.filter((b) => reservations.some((r) => r.building_id === b.id));

  return (
    <div>
      <div className="text-[11px] font-semibold tracking-wide text-[#6D5AE6] uppercase">Beheerportaal</div>
      <h1 className="text-2xl font-bold text-[#171A2B] mb-1">Zaalbezetting</h1>

      <div className="bg-[#EFEBFF] rounded-2xl p-4 mb-6 text-sm text-[#5B5F82]">
        Bezetting komt uit geüploade PDF-rapporten (module Reservaties).
      </div>

      <div className="mb-6">
        <label className="text-xs font-semibold text-[#8A8FA8] uppercase">Datum</label>
        <input
          type="date"
          defaultValue={selectedDate}
          onChange={(e) => router.push(`/zaalbezetting?datum=${e.target.value}`)}
          className="block mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
        />
      </div>

      {buildingsWithData.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#ECECF3] px-5 py-6 text-sm text-[#B0B4CC]">
          Geen reservaties gevonden voor deze datum.
        </div>
      ) : (
        <div className="space-y-6">
          {buildingsWithData.map((b, i) => {
            const tone = BUILDING_TONES[i % BUILDING_TONES.length];
            const items = reservations.filter((r) => r.building_id === b.id);
            return (
              <div key={b.id}>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={15} className="text-[#8A8FA8]" />
                  <span className="font-semibold text-[#171A2B]">{b.name}</span>
                </div>
                <div className="space-y-3">
                  {items.map((r) => (
                    <div key={r.id} className={`rounded-2xl border ${tone.bg} ${tone.border} p-4`}>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {r.ruimte && (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full bg-white/60 ${tone.text}`}>
                            {r.ruimte}
                            {(r.activiteit_start || r.activiteit_eind) && ` · ${r.activiteit_start ?? "?"} – ${r.activiteit_eind ?? "?"}`}
                          </span>
                        )}
                        {(r.toegang_start || r.toegang_eind) && (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/60 text-[#5B5F82]">
                            Toegang {r.toegang_start ?? "?"} – {r.toegang_eind ?? "?"}
                          </span>
                        )}
                      </div>
                      <ContactEditRow reservation={r} contact={r.contact_id ? contactById.get(r.contact_id) || null : null} canEdit={canEdit} />
                      {r.activiteit && <div className="text-sm text-[#5B5F82] mt-1">{r.activiteit}</div>}
                      {r.telefoon && (
                        <div className="flex items-center gap-1.5 text-sm text-[#1B8E63] mt-1">
                          <Phone size={13} /> {r.telefoon}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
