import Link from "next/link";
import type { ReactNode } from "react";

/** Moldura comum das páginas legais (termos e privacidade). */
export function LegalLayout({ titulo, atualizacao, children }: { titulo: string; atualizacao: string; children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#eef3f9" }}>
      <header style={{ background: "linear-gradient(135deg, #142c4a 0%, #1e3a5f 60%, #2563a8 100%)" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-nefrouftm.png" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
            <span className="text-base font-extrabold tracking-tight text-white">
              NEFRO<span className="font-medium text-white/60">-UFTM</span>
            </span>
          </div>
          <Link href="/dashboard" className="text-xs font-semibold text-white/80 hover:text-white">
            Voltar ao painel
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <article className="rounded-3xl bg-white px-6 py-8 shadow-xl sm:px-10">
          <h1 className="text-center text-2xl font-extrabold tracking-tight" style={{ color: "#1e3a5f" }}>
            {titulo}
          </h1>
          <p className="mt-2 text-center text-xs italic" style={{ color: "#5b7ba3" }}>
            Última atualização: {atualizacao}
          </p>
          <div className="mt-8">{children}</div>
        </article>
        <footer className="mt-6 text-center text-[11px]" style={{ color: "#5b7ba3" }}>
          NEFRO-UFTM · Equipe de Nefrologia · HC-UFTM
        </footer>
      </main>
    </div>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-7 first:mt-0">
      <h2 className="text-lg font-bold" style={{ color: "#1e3a5f" }}>{titulo}</h2>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed" style={{ color: "#1f2937" }}>{children}</div>
    </section>
  );
}

export function Lista({ itens }: { itens: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {itens.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  );
}
