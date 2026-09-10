"use client";

import { useEffect, useState } from "react";

export default function Greeting({ firstName }: { firstName?: string }) {
  const [groet, setGroet] = useState("Goedendag");

  useEffect(() => {
    const uur = new Date().getHours();
    setGroet(uur < 12 ? "Goedemorgen" : uur < 18 ? "Goedemiddag" : "Goedenavond");
  }, []);

  return (
    <>
      {groet}
      {firstName ? `, ${firstName}` : ""}
    </>
  );
}
