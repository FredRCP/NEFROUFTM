"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarAvaliado, atualizarSituacaoDialitica } from "@/lib/actions/acompanhamentos";
import { PendenciasModal } from "@/components/PendenciasModal";
import { excluirPendencia } from "@/lib/actions/pendencias";
import type { AcompanhamentoNefro, Paciente, Internacao, Pendencia } from "@/types/database";

interface PacienteCardProps {
  acompanhamento: AcompanhamentoNefro;
  paciente: Paciente;
  internacao: Internacao;
  pendencias: Pendencia[];
}

type Situacao = "hd_hoje" | "hd_amanha" | "sem_hd_programada" | "conservador";

const SITUACAO: Record<Situacao, { label: string; cor: string; bg: string }> = {
  hd_hoje: { label: "HD hoje", cor: "var(--red)", bg: "var(--red-dim)" },
  hd_amanha: { label: "HD amanhã", cor: "var(--amber)", bg: "var(--amber-dim)" },
  sem_hd_programada: { label: "Sem HD", cor: "var(--green)", bg: "var(--green-dim)" },
  conservador: { label: "Conservador", cor: "#0f766e", bg: "#ccfbf1" },
};

/** Conduta ainda não definida no dia (zerada à meia-noite). */
const SEM_CONDUTA = { label: "Definir conduta", cor: "var(--text2)", bg: "var(--card2)" };

const DIAGNOSTICO_LABEL: Record<string, string> = {
  IRA: "IRA",
  DRC_D: "DRC dialítica",
  IRA_sobre_DRC: "IRA sobre DRC",
};

const AMARELO_BORDA = "#f59e0b";
const AMARELO_FUNDO = "#fef3c7";

/** Primeiro e segundo nome, em maiúsculas. */
function nomeAbreviado(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean);
  const base = partes.length <= 2 ? partes.join(" ") : `${partes[0]} ${partes[1]}`;
  return base.toUpperCase();
}

export function PacienteCard({ acompanhamento, paciente, internacao, pendencias }: PacienteCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [menuHd, setMenuHd] = useState(false);
  const [modalPendencias, setModalPendencias] = useState(false);

  const avaliado = acompanhamento.avaliado_hoje;
  const temPendencia = pendencias.length > 0;
  const situacaoKey = acompanhamento.situacao_dialitica as Situacao | null;
  const sit = (situacaoKey && SITUACAO[situacaoKey]) || SEM_CONDUTA;

  function toggleAvaliado() {
    startTransition(() => {
      marcarAvaliado(acompanhamento.id, !avaliado);
    });
  }

  function excluirDoCard(p: Pendencia) {
    if (!window.confirm("Excluir esta pendência?")) return;
    startTransition(async () => {
      await excluirPendencia(p.id);
    });
  }

  function mudarSituacao(valor: Situacao) {
    setMenuHd(false);
    startTransition(() => {
      atualizarSituacaoDialitica(acompanhamento.id, valor);
    });
  }

  return (
    <div
      onClick={() => router.push(`/pacientes/${acompanhamento.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && router.push(`/pacientes/${acompanhamento.id}`)}
      title="Abrir ficha"
      className="flex cursor-pointer flex-col overflow-hidden rounded-xl transition hover:-translate-y-0.5"
      style={{
        background: "var(--card)",
        border: temPendencia ? `2px solid ${AMARELO_BORDA}` : "1px solid var(--border)",
        borderLeft: `4px solid ${temPendencia ? AMARELO_BORDA : avaliado ? "var(--green)" : "var(--red)"}`,
        boxShadow: "var(--nc-shadow-sm)",
        aspectRatio: "3 / 3.2",
      }}
    >
      {/* Faixa de status: clicar alterna a avaliação */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleAvaliado(); }}
        disabled={isPending}
        title={avaliado ? "Clique para desfazer" : "Marcar como avaliado"}
        className="w-full px-2 py-1.5 text-center text-[11px] font-extrabold tracking-wide transition"
        style={{
          background: temPendencia ? AMARELO_BORDA : avaliado ? "var(--green)" : "var(--red)",
          color: temPendencia ? "#451a03" : "white",
          border: "none",
          opacity: isPending ? 0.6 : 1,
          cursor: "pointer",
        }}
      >
        {avaliado ? "✓ Avaliado · toque p/ desfazer" : "👆 Avaliar"}
      </button>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-2.5">
        {/* Nome à esquerda, leito à direita */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="line-clamp-2 font-extrabold uppercase" style={{ color: "var(--text)", fontSize: 14, lineHeight: 1.2 }}>
              {nomeAbreviado(paciente.nome)}
            </p>
          </div>
          {internacao.enfermaria_leito ? (
            <p className="shrink-0 whitespace-nowrap text-right font-extrabold" style={{ color: "var(--accent)", fontSize: 14 }}>
              🛏 {internacao.enfermaria_leito}
            </p>
          ) : (
            <p className="shrink-0 text-right text-[11px] font-bold" style={{ color: "var(--accent)" }}>
              🛏 {internacao.setor.replace(/_/g, " ")}
            </p>
          )}
        </div>

        {acompanhamento.diagnostico_principal && (
          <span
            className="mt-2 inline-block w-fit max-w-full truncate rounded-md px-2 py-0.5 text-[10px] font-bold"
            style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
          >
            {DIAGNOSTICO_LABEL[acompanhamento.diagnostico_principal] ?? acompanhamento.diagnostico_principal}
          </span>
        )}

        <div className="flex-1" />

        {/* Pendências: nome + × para excluir; clicar no nome abre o modal */}
        {temPendencia && (
          <div className="mt-2 flex flex-col items-start gap-1" onClick={(e) => e.stopPropagation()}>
            {pendencias.slice(0, 2).map((p) => (
              <div key={p.id} className="flex max-w-full items-center gap-1 rounded-full px-2 py-0.5"
                style={{ background: AMARELO_FUNDO, border: "1px solid #f5c26b", color: "#92400e" }}>
                <button type="button" onClick={() => setModalPendencias(true)} title={p.descricao}
                  className="truncate text-left text-[11px] font-bold"
                  style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", maxWidth: 130 }}>
                  {p.descricao}
                </button>
                <button type="button" onClick={() => excluirDoCard(p)} aria-label="Excluir pendência"
                  className="shrink-0 text-[12px] font-extrabold leading-none"
                  style={{ background: "none", border: "none", color: "#92400e", cursor: "pointer" }}>
                  ×
                </button>
              </div>
            ))}
            {pendencias.length > 2 && (
              <span className="text-[10px] font-bold" style={{ color: "#92400e" }}>
                + {pendencias.length - 2} outra(s)
              </span>
            )}
          </div>
        )}

        {/* Conduta do dia */}
        <div className="relative mt-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuHd((v) => !v)}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] font-bold transition"
            style={{ background: sit.bg, color: sit.cor, border: "none", cursor: "pointer" }}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: sit.cor }} />
            {sit.label}
            <span className="text-[9px] opacity-70">▾</span>
          </button>

          {menuHd && (
            <>
              <div onClick={() => setMenuHd(false)} className="fixed inset-0 z-40" />
              <div
                className="absolute bottom-[110%] left-0 right-0 z-50 overflow-hidden rounded-(--nc-radius)"
                style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--nc-shadow-md)" }}
              >
                {(Object.keys(SITUACAO) as Situacao[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => mudarSituacao(key)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition hover:opacity-80"
                    style={{
                      color: SITUACAO[key].cor,
                      background: key === situacaoKey ? SITUACAO[key].bg : "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: SITUACAO[key].cor }} />
                    {SITUACAO[key].label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Botão de pendências */}
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setModalPendencias(true)}
            className="w-full rounded-md py-1 text-[11px] font-semibold transition hover:opacity-80"
            style={{
              color: temPendencia ? "#92400e" : "var(--text3)",
              border: `1px dashed ${temPendencia ? AMARELO_BORDA : "var(--border)"}`,
              background: "transparent",
              cursor: "pointer",
            }}
          >
            {temPendencia ? "Editar pendências" : "+ Adicionar pendência"}
          </button>
        </div>

        {modalPendencias && (
          <PendenciasModal
            acompanhamentoId={acompanhamento.id}
            nomePaciente={nomeAbreviado(paciente.nome)}
            pendencias={pendencias}
            onClose={() => setModalPendencias(false)}
          />
        )}
      </div>
    </div>
  );
}
