"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface AppHeaderProps {
  nomeMedico?: string;
  titulo?: "Dr" | "Dra" | null;
  /** Conteúdo centralizado da barra (título da página, nome do paciente...). */
  centro?: ReactNode;
}

interface MedicoBasico { nome: string; titulo: "Dr" | "Dra" | null }

function getIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function getPrimeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

const LINK_MENU = "flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-(--text2) transition hover:bg-(--bg2)";

export function AppHeader({ nomeMedico, titulo, centro }: AppHeaderProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [saindo, setSaindo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [medico, setMedico] = useState<MedicoBasico | null>(null);

  // Sem nome vindo do servidor (páginas client), busca o médico logado.
  useEffect(() => {
    if (nomeMedico) return;
    let ativo = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("medicos").select("nome, titulo").eq("id", user.id).maybeSingle();
      if (ativo) setMedico({ nome: data?.nome ?? user.email ?? "Usuário", titulo: (data?.titulo as "Dr" | "Dra" | null) ?? null });
    })();
    return () => { ativo = false; };
  }, [nomeMedico, supabase]);

  const nome = nomeMedico ?? medico?.nome ?? "";
  const tituloEfetivo = titulo ?? medico?.titulo ?? null;

  async function handleLogout() {
    setSaindo(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const nomeExibido = `${tituloEfetivo ? `${tituloEfetivo}. ` : ""}${getPrimeiroNome(nome)}`;

  return (
    <div
      className="nc-topbar"
      style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12 }}
    >
      {/* Esquerda: marca (leva à página principal) */}
      <div style={{ minWidth: 0 }}>
        <Link href="/dashboard" title="Página principal" style={{ textDecoration: "none" }}>
          <span className="text-base font-extrabold text-white tracking-tight">
            NEFRO<span className="font-medium text-white/45">-UFTM</span>
          </span>
        </Link>
      </div>

      {/* Centro: contexto da página */}
      <div style={{ minWidth: 0, maxWidth: "100%", display: "flex", justifyContent: "center", overflow: "hidden" }}>
        {centro}
      </div>

      {/* Direita: navegação e perfil */}
      <div className="relative flex items-center justify-end gap-2.5" style={{ minWidth: 0 }}>
        <Link
          href="/pacientes"
          className="hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
          style={{ textDecoration: "none", border: "1px solid rgba(255,255,255,0.18)" }}
        >
          📋 Pacientes
        </Link>

        <div
          onClick={() => setShowMenu((v) => !v)}
          title={nome || "Perfil"}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-white/25 bg-white/15 text-xs font-bold text-white transition hover:bg-white/25"
        >
          {nome ? getIniciais(nome) : "··"}
        </div>

        {showMenu && (
          <>
            <div onClick={() => setShowMenu(false)} className="fixed inset-0 z-40" />
            <div className="absolute top-[120%] right-0 z-50 min-w-50 overflow-hidden rounded-xl border border-(--border) bg-(--card) shadow-(--nc-shadow-md)">
              <div className="border-b border-(--border) bg-(--card2) px-4 py-3">
                <p className="text-xs font-bold text-(--text)">{nomeExibido}</p>
                <p className="text-xs text-(--text3) mt-0.5">{nome}</p>
              </div>
              <Link href="/pacientes" className={LINK_MENU} style={{ textDecoration: "none" }} onClick={() => setShowMenu(false)}>
                📋 Todos os pacientes
              </Link>
              <Link href="/perfil" className={LINK_MENU} style={{ textDecoration: "none" }} onClick={() => setShowMenu(false)}>
                🔑 Alterar senha
              </Link>
              <Link href="/termos" className={LINK_MENU} style={{ textDecoration: "none" }} onClick={() => setShowMenu(false)}>
                📄 Termo de uso
              </Link>
              <Link href="/privacidade" className={LINK_MENU} style={{ textDecoration: "none" }} onClick={() => setShowMenu(false)}>
                🔒 Política de privacidade
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
