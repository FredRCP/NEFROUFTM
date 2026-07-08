"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface AppHeaderProps {
  nomeMedico: string;
  titulo?: "Dr" | "Dra" | null;
}

function getIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function getPrimeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

export function AppHeader({ nomeMedico, titulo }: AppHeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saindo, setSaindo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  async function handleLogout() {
    setSaindo(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const nomeExibido = `${titulo ? `${titulo}. ` : ""}${getPrimeiroNome(nomeMedico)}`;

  return (
    <div className="nc-topbar justify-between">
      <div className="flex items-center gap-4">
        <span className="text-base font-extrabold text-white tracking-tight">
          NEFRO<span className="font-medium text-white/45">-UFTM</span>
        </span>

        {/* Link para listagem de pacientes */}
        <Link
          href="/pacientes"
          className="hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
          style={{ textDecoration: "none" }}
        >
          📋 Pacientes (Lista completa)
        </Link>
      </div>

      <div className="relative flex items-center gap-2.5">
        <span className="hidden text-sm font-semibold text-white/90 sm:inline">{nomeExibido}</span>

        <div
          onClick={() => setShowMenu((v) => !v)}
          title={nomeMedico}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-white/25 bg-white/15 text-xs font-bold text-white transition hover:bg-white/25"
        >
          {getIniciais(nomeMedico)}
        </div>

        {showMenu && (
          <>
            <div onClick={() => setShowMenu(false)} className="fixed inset-0 z-40" />
            <div className="absolute top-[120%] right-0 z-50 min-w-50 overflow-hidden rounded-xl border border-(--border) bg-(--card) shadow-(--nc-shadow-md)">
              <div className="border-b border-(--border) bg-(--card2) px-4 py-3">
                <p className="text-xs font-bold text-(--text)">{nomeExibido}</p>
                <p className="text-xs text-(--text3) mt-0.5">{nomeMedico}</p>
              </div>
              {/* Link pacientes no menu mobile */}
              <Link
                href="/pacientes"
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-(--text2) transition hover:bg-(--bg2)"
                style={{ textDecoration: "none" }}
                onClick={() => setShowMenu(false)}
              >
                📋 Todos os pacientes
              </Link>
              <Link
                href="/perfil"
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-(--text2) transition hover:bg-(--bg2)"
                style={{ textDecoration: "none" }}
                onClick={() => setShowMenu(false)}
              >
                🔑 Alterar senha
              </Link>
              <div style={{ height: 1, background: "var(--border)" }} />
              <button
                onClick={handleLogout}
                disabled={saindo}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-(--red) transition hover:bg-(--red-dim)"
              >
                → {saindo ? "Saindo..." : "Sair"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}