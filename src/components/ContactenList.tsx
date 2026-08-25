"use client";

import { useMemo, useState } from "react";
import { Phone, Trash2 } from "lucide-react";
import type { Contact } from "@/lib/types";
import { updateContact, deleteContact } from "@/app/(app)/contacten/actions";
import PincodeConfirmModal from "@/components/PincodeConfirmModal";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function displayLetter(c: Contact) {
  const base = (c.vereniging || c.ruwe_naam || "").trim();
  return base.charAt(0).toUpperCase();
}

function ContactCard({ contact, canEdit, heeftPincode }: { contact: Contact; canEdit: boolean; heeftPincode: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pincodeModalOpen, setPincodeModalOpen] = useState(false);
  const [vereniging, setVereniging] = useState(contact.vereniging || "");
  const [contactpersoon, setContactpersoon] = useState(contact.contactpersoon || "");
  const [telefoon, setTelefoon] = useState(contact.telefoon || "");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    await updateContact(contact.id, { vereniging, contactpersoon, telefoon });
    setPending(false);
    setEditing(false);
  }

  async function confirmDelete() {
    setPending(true);
    await deleteContact(contact.id);
    setPending(false);
  }

  function startDelete() {
    if (heeftPincode) {
      setPincodeModalOpen(true);
    } else {
      setConfirmingDelete(true);
    }
  }

  const isSplit = !!(contact.vereniging || contact.contactpersoon);

  if (confirmingDelete) {
    return (
      <div className="bg-white rounded-2xl border border-[#F6C6C0] p-5">
        <div className="text-sm font-semibold text-[#171A2B] mb-1">
          {contact.vereniging || contact.ruwe_naam} verwijderen?
        </div>
        <p className="text-xs text-[#8A8FA8] mb-4">
          Reservaties die naar dit contact verwijzen blijven bestaan, maar verliezen de koppeling met dit
          contactfiche.
        </p>
        <div className="flex gap-2">
          <button
            onClick={confirmDelete}
            disabled={pending}
            className="text-sm font-semibold text-white bg-[#D6493C] rounded-lg px-3 py-1.5 disabled:opacity-50"
          >
            {pending ? "Bezig\u2026" : "Ja, verwijderen"}
          </button>
          <button onClick={() => setConfirmingDelete(false)} className="text-sm font-semibold text-[#5B5F82] px-3 py-1.5">
            Annuleer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] p-5">
      <div className="text-xs text-[#B0B4CC] mb-1">Ruwe naam: {contact.ruwe_naam}</div>

      {editing ? (
        <div className="space-y-2">
          <input
            value={vereniging}
            onChange={(e) => setVereniging(e.target.value)}
            placeholder="Vereniging"
            className="w-full rounded-lg border border-[#ECECF3] px-3 py-1.5 text-sm"
          />
          <input
            value={contactpersoon}
            onChange={(e) => setContactpersoon(e.target.value)}
            placeholder="Contactpersoon"
            className="w-full rounded-lg border border-[#ECECF3] px-3 py-1.5 text-sm"
          />
          <input
            value={telefoon}
            onChange={(e) => setTelefoon(e.target.value)}
            placeholder="Telefoon"
            className="w-full rounded-lg border border-[#ECECF3] px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={pending} className="text-sm font-semibold text-white bg-[#6D5AE6] rounded-lg px-3 py-1.5 disabled:opacity-50">
              Bewaren
            </button>
            <button onClick={() => setEditing(false)} className="text-sm font-semibold text-[#5B5F82] px-3 py-1.5">
              Annuleer
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="font-semibold text-[#171A2B]">
            Vereniging: {contact.vereniging || <span className="text-[#B0B4CC] font-normal">nog niet gesplitst</span>}
          </div>
          <div className="text-[#5B5F82] text-sm mt-0.5">Contactpersoon: {contact.contactpersoon || "—"}</div>
          {contact.telefoon && (
            <div className="flex items-center gap-1.5 text-sm text-[#1B8E63] mt-1">
              <Phone size={13} /> {contact.telefoon}
            </div>
          )}
          {canEdit && (
            <div className="flex items-center gap-3 mt-2">
              <button onClick={() => setEditing(true)} className="text-sm text-[#6D5AE6] font-semibold">
                Bewerk
              </button>
              <button
                onClick={startDelete}
                className="text-sm text-[#B0B4CC] hover:text-[#D6493C] font-semibold flex items-center gap-1"
              >
                <Trash2 size={13} /> Verwijder
              </button>
            </div>
          )}
          {!isSplit && (
            <div className="text-[11px] text-[#C9862A] mt-1">Nog niet opgesplitst</div>
          )}
        </>
      )}

      <PincodeConfirmModal
        open={pincodeModalOpen}
        title={`${contact.vereniging || contact.ruwe_naam} verwijderen?`}
        description="Reservaties die naar dit contact verwijzen blijven bestaan, maar verliezen de koppeling."
        onCancel={() => setPincodeModalOpen(false)}
        onConfirmed={() => {
          setPincodeModalOpen(false);
          confirmDelete();
        }}
      />
    </div>
  );
}

export default function ContactenList({
  contacts,
  canEdit,
  heeftPincode = false,
}: {
  contacts: Contact[];
  canEdit: boolean;
  heeftPincode?: boolean;
}) {
  const [letter, setLetter] = useState<string | null>(null);

  const availableLetters = useMemo(() => new Set(contacts.map((c) => displayLetter(c))), [contacts]);
  const filtered = letter ? contacts.filter((c) => displayLetter(c) === letter) : contacts;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-5">
        <button
          onClick={() => setLetter(null)}
          className={`w-9 h-9 rounded-lg text-sm font-semibold border ${!letter ? "border-[#6D5AE6] text-[#6D5AE6]" : "border-[#ECECF3] text-[#171A2B]"}`}
        >
          A-Z
        </button>
        {ALPHABET.map((l) => {
          const has = availableLetters.has(l);
          return (
            <button
              key={l}
              disabled={!has}
              onClick={() => setLetter(l)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold border ${
                !has ? "border-[#ECECF3] text-[#D8DAE8] cursor-default" : letter === l ? "border-[#6D5AE6] text-[#6D5AE6]" : "border-[#ECECF3] text-[#171A2B]"
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>

      <div className="text-sm font-semibold text-[#171A2B] mb-3">{filtered.length} contacten</div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#ECECF3] px-5 py-6 text-sm text-[#B0B4CC]">
          Nog geen contacten &mdash; die worden automatisch aangemaakt bij het inlezen van reservatie-PDF&apos;s.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <ContactCard key={c.id} contact={c} canEdit={canEdit} heeftPincode={heeftPincode} />
          ))}
        </div>
      )}
    </div>
  );
}
