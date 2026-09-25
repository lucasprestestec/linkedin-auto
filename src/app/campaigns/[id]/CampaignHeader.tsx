"use client";

import { useState, useTransition } from "react";
import { IconTrash, IconSettings } from "@/components/Icons";
import { CampaignForm } from "../CampaignForm";
import { deleteCampaign, updateCampaign } from "../actions";

// Nome + oferta da campanha, com "Editar" que abre o mesmo formulário de criação.
export function CampaignHeader({ id, name, instructions, leads }: { id: string; name: string; instructions: string; leads: number }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <section className="card card-pad narrow">
        <CampaignForm action={updateCampaign.bind(null, id)} initial={{ name, instructions }} submitLabel="Salvar" onCancel={() => setEditing(false)} />
        <button
          type="button"
          className="btn btn-ghost btn-sm danger-link"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Apagar a campanha "${name}"? ${leads ? `As ${leads} pessoas dela continuam em Conversas.` : ""}`)) return;
            startTransition(() => deleteCampaign(id));
          }}
        >
          <IconTrash size={15} /> Apagar campanha
        </button>
      </section>
    );
  }

  return (
    <header className="page-hero rise camp-hero">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <h1 className="display page-title camp-title">{name}</h1>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
          <IconSettings size={15} /> Editar
        </button>
      </div>
      {instructions ? (
        <p className="hero-sub camp-offer-full">{instructions}</p>
      ) : (
        <p className="hero-sub">
          Você ainda não disse o que oferecer.{" "}
          <button type="button" className="link-btn brand" onClick={() => setEditing(true)}>
            Escrever agora
          </button>
        </p>
      )}
    </header>
  );
}
