"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconPlus, IconSearch } from "./Icons";
import { NotificationBell } from "./NotificationBell";

// Barra de cima do computador: busca global (⌘K), sino e atalho pra prospectar.
export function DesktopTopbar() {
  const router = useRouter();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(params.get("q") ?? "");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="desk-topbar">
      <form
        className="global-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const q = value.trim();
          router.push(q ? `/conversations?q=${encodeURIComponent(q)}` : "/conversations");
        }}
      >
        <IconSearch size={20} />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Buscar pessoa, cargo ou empresa nas conversas..."
          aria-label="Buscar leads"
        />
        <kbd>⌘ K</kbd>
      </form>
      <div className="row" style={{ gap: 12 }}>
        <NotificationBell />
        <Link href="/campaigns/new" className="btn btn-primary btn-pill">
          <IconPlus size={18} strokeWidth={2.4} /> Nova campanha
        </Link>
      </div>
    </header>
  );
}
