"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import {
  IconArrowRight,
  IconBars,
  IconBriefcase,
  IconLink,
  IconLinkedin,
  IconPlus,
  IconRocket,
  IconSearch,
  IconUsers,
} from "@/components/Icons";
import { goProspect } from "./prospectEvents";

export function QuickSearch() {
  const [value, setValue] = useState("");
  return (
    <form
      className="quick-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        goProspect({ target: "builder", title: value.trim() || undefined });
        setValue("");
      }}
    >
      <IconSearch size={22} />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar cargos, palavras-chave ou empresas..."
        aria-label="Cargo que você quer buscar"
        enterKeyHint="search"
      />
      <button type="submit" aria-label="Montar busca">
        <IconArrowRight size={22} strokeWidth={2.4} />
      </button>
    </form>
  );
}

const ICONS = [IconUsers, IconBars, IconRocket, IconBriefcase];
const TONES = ["lav", "cream", "peach", "lav"];

export function ProfileShortcuts({ profiles }: { profiles: { title: string; subtitle: string }[] }) {
  return (
    <section className="shortcuts" aria-labelledby="shortcuts-title">
      <div className="section-row">
        <h2 id="shortcuts-title">Perfis sugeridos</h2>
        <button type="button" className="link-btn" onClick={() => goProspect({ target: "builder" })}>
          Ver todos
        </button>
      </div>
      <div className="shortcut-scroll">
        {profiles.map((p, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <button key={p.title} type="button" className={`shortcut tile-${TONES[i % TONES.length]}`} onClick={() => goProspect({ target: "builder", title: p.title })}>
              <span className="shortcut-icon">
                <Icon size={20} />
              </span>
              <b>{p.title}</b>
              <span>{p.subtitle}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function FindMoreCard({ people }: { people: { firstName: string | null; lastName: string | null }[] }) {
  return (
    <section className="find-card" aria-labelledby="find-title">
      <div className="find-card-art" aria-hidden="true">
        <span className="find-card-back" />
        <span className="find-card-logo">
          <IconLinkedin size={34} />
        </span>
        <svg className="find-card-arrow" width="44" height="44" viewBox="0 0 44 44" fill="none">
          <path d="M6 38c4-14 14-24 30-28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M26 8l10 2-3 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="find-eyebrow">Encontre mais leads</span>
      <h2 id="find-title" className="find-title">
        Cole perfis do LinkedIn
        <br />
        ou faça uma busca
      </h2>
      <div className="avatar-stack">
        {people.map((p, i) => (
          <span key={i} className="avatar-stack-item">
            <Avatar firstName={p.firstName} lastName={p.lastName} size={42} />
          </span>
        ))}
        <button type="button" className="avatar-stack-add" onClick={() => goProspect({ target: "paste" })} aria-label="Colar perfis">
          <IconPlus size={18} />
        </button>
      </div>
      <div className="find-buttons">
        <button type="button" className="btn find-btn-ghost" onClick={() => goProspect({ target: "paste" })}>
          <IconLink size={18} /> Colar perfis
        </button>
        <button type="button" className="btn find-btn-light" onClick={() => goProspect({ target: "builder" })}>
          <IconSearch size={18} /> Buscar no LinkedIn
        </button>
      </div>
    </section>
  );
}
