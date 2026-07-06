"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  marcarAvaliado,
  atualizarSituacaoDialitica,
  adicionarPendencia,
  resolverPendencia,
} from "@/lib/actions/acompanhamentos";
import type { AcompanhamentoNefro, Paciente, Internacao, Pendencia } from "@/types/database";

interface PacienteCardProps {
  acompanhamento: AcompanhamentoNefro;
  paciente: Paciente;
  internacao: Internacao;
  pendencias: Pendencia[];
}

function calcularIdade(dataNascimento: string | null): string {
  if (!dataNascimento) return "—";
  const nasc = new Date(dataNascimento);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  if (
    hoje.getMonth() < nasc.getMonth() ||
    (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())
  ) {
    idade--;
  }
  return `${idade}a`;
}

/** Primeiro nome + segundo nome completo, em maiúsculas. */
function nomeAbreviado(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean);
  const base = partes.length <= 2 ? partes.join(" ") : `${partes[0]} ${partes[1]}`;
  return base.toUpperCase();
}

const DIAGNOSTICO_LABEL: Record<string, string> = {
  IRA: "IRA",
  DRC_D: "DRC dialítica",
  IRA_sobre_DRC: "IRA sobre DRC",
};

const SITUACAO_DIALITICA_CONFIG: Record<string, { label: string; cor: string; bg: string; emoji: string }> = {
  hd_hoje:           { label: "HD Hoje",         cor: "var(--red)",    bg: "var(--red-dim)",    emoji: "🔴" },
  hd_amanha:         { label: "HD Amanhã",        cor: "var(--amber)",  bg: "var(--amber-dim)",  emoji: "🟡" },
  hd_continua:       { label: "HD Contínua",      cor: "#7c3aed",       bg: "#f5f3ff",           emoji: "🔁" },
  dpi:               { label: "DPI",              cor: "#0891b2",       bg: "#ecfeff",           emoji: "💧" },
  tpe:               { label: "TPE",              cor: "#db2777",       bg: "#fdf2f8",           emoji: "🔬" },
  conservador:       { label: "Conservador",      cor: "#0f766e",       bg: "#f0fdfa",           emoji: "🌿" },
  sem_hd_programada: { label: "Sem HD",           cor: "var(--green)",  bg: "var(--green-dim)",  emoji: "🟢" },
};

export function PacienteCard({ acompanhamento, paciente, internacao, pendencias }: PacienteCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [novaPendencia, setNovaPendencia] = useState("");
  const [mostrarMenuHd, setMostrarMenuHd] = useState(false);
  const [modalPendenciasAberto, setModalPendenciasAberto] = useState(false);

  const situacaoCfg = acompanhamento.situacao_dialitica
    ? SITUACAO_DIALITICA_CONFIG[acompanhamento.situacao_dialitica]
    : null;

  const temPendencia = pendencias.length > 0;

  // Cor da borda lateral
  const corBorda = temPendencia ? "var(--amber)" : !acompanhamento.avaliado_hoje ? "var(--red)" : "var(--green)";

  function handleToggleAvaliado() {
    startTransition(() => {
      marcarAvaliado(acompanhamento.id, !acompanhamento.avaliado_hoje);
    });
  }

  function handleSituacaoChange(novoValor: "hd_hoje" | "hd_amanha" | "sem_hd_programada" | "hd_continua" | "dpi" | "tpe" | "conservador") {
    setMostrarMenuHd(false);
    startTransition(() => {
      atualizarSituacaoDialitica(acompanhamento.id, novoValor);
    });
  }

  async function handleAdicionarPendencia(e?: { stopPropagation: () => void }) {
    e?.stopPropagation();
    if (!novaPendencia.trim()) return;
    const texto = novaPendencia;
    setNovaPendencia("");
    startTransition(async () => {
      await adicionarPendencia(acompanhamento.id, texto);
    });
  }

  function handleExcluirPendencia(e: { stopPropagation: () => void }, pendenciaId: string) {
    e.stopPropagation();
    startTransition(async () => {
      await resolverPendencia(pendenciaId);
    });
  }

  function handleAbrirDetalhe() {
    router.push(`/pacientes/${acompanhamento.id}`);
  }

  // Fecha o modal automaticamente quando a ÚLTIMA pendência é excluída.
  // Usamos o padrão "ajustar estado durante o render" (recomendado pelo
  // React em vez de useEffect + setState, que causa cascading renders):
  // comparamos a contagem atual com a guardada e, se mudou, atualizamos
  // ambos os estados na mesma passada de render, sem useEffect.
  const [pendenciasAnterior, setPendenciasAnterior] = useState(pendencias.length);
  if (pendencias.length !== pendenciasAnterior) {
    if (modalPendenciasAberto && pendenciasAnterior > 0 && pendencias.length === 0) {
      setModalPendenciasAberto(false);
    }
    setPendenciasAnterior(pendencias.length);
  }

  return (
    <>
    <div
      onClick={handleAbrirDetalhe}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleAbrirDetalhe()}
      title="Ver ficha completa"
      className="flex cursor-pointer flex-col rounded-(--nc-radius-lg) p-3 transition-all duration-150 [--nc-card-pad:0.75rem] sm:aspect-[3/3.2] sm:p-2.5 sm:[--nc-card-pad:0.625rem]"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${corBorda}`,
        boxShadow: "var(--nc-shadow-sm)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.boxShadow = "var(--nc-shadow-md)";
        el.style.borderColor = corBorda;
        el.style.background = "var(--card2)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.boxShadow = "var(--nc-shadow-sm)";
        el.style.borderColor = "var(--border)";
        el.style.background = "var(--card)";
        el.style.borderLeft = `4px solid ${corBorda}`;
      }}
    >
      {/* Faixa fixa no topo — sempre visível, com 1 pílula clicável:
          se houver pendência, mostra SÓ a pílula âmbar de pendência
          (que já indica, implicitamente, que o caso precisa de atenção).
          Sem pendência, mostra o status de avaliação (vermelho "Avaliar"
          / verde "Avaliado"). As pílulas usam sombra + leve "press" no
          hover/active para deixar claro que são clicáveis. */}
      <div
        className="mb-2 flex overflow-hidden rounded-t-(--nc-radius-lg)"
        style={{
          marginTop: "calc(-1 * var(--nc-card-pad, 0.75rem))",
          marginLeft: "calc(-1 * var(--nc-card-pad, 0.75rem) - 4px)",
          marginRight: "calc(-1 * var(--nc-card-pad, 0.75rem))",
        }}
      >
        {temPendencia ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setModalPendenciasAberto(true);
            }}
            title="Ver e gerenciar pendências"
            className="flex flex-1 items-center justify-center gap-1 px-2 py-2.5 text-[13px] font-extrabold transition active:scale-[0.97] sm:py-1.5 sm:text-[11px]"
            style={{
              background: "var(--amber)",
              color: "white",
              boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.12)",
            }}
          >
            ⚠️ {pendencias.length} pendência{pendencias.length > 1 ? "s" : ""}
            <span style={{ opacity: 0.75, fontSize: 9 }}>▾</span>
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleAvaliado();
            }}
            disabled={isPending}
            title={acompanhamento.avaliado_hoje ? "Avaliado hoje — clique para desmarcar" : "Clique para marcar como avaliado hoje"}
            className="flex flex-1 items-center justify-center gap-1 px-2 py-2.5 text-[13px] font-extrabold transition active:scale-[0.97] hover:opacity-90 sm:py-1.5 sm:text-[11px]"
            style={{
              background: acompanhamento.avaliado_hoje ? "var(--green)" : "var(--red)",
              color: "white",
              opacity: isPending ? 0.6 : 1,
              boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.12)",
            }}
          >
            {acompanhamento.avaliado_hoje ? (
              <>✓ Avaliado <span style={{ opacity: 0.6, fontSize: 9 }}>· toque p/ desfazer</span></>
            ) : (
              <>👆 Avaliar agora</>
            )}
          </button>
        )}
      </div>

      {/* Nome (esquerda) + leito (canto direito) */}
      <div className="flex items-baseline justify-between gap-1.5">
        <p
          className="line-clamp-2 text-[14px] font-extrabold sm:text-[15px]"
          style={{ color: "var(--text)", lineHeight: 1.2, letterSpacing: "0.01em" }}
        >
          {nomeAbreviado(paciente.nome)}
        </p>
        {internacao.enfermaria_leito && (
          <p
            className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[14px] font-extrabold sm:text-[15px]"
            style={{ color: "var(--accent)", lineHeight: 1.2 }}
          >
            <span style={{ fontSize: 12, transform: "translateY(-1px)" }}>🛏️</span>
            {internacao.enfermaria_leito}
          </p>
        )}
      </div>

      {/* Idade — discreta, abaixo do nome/leito */}
      <p className="mt-0.5 text-[11px]" style={{ color: "var(--text3)" }}>
        {calcularIdade(paciente.data_nascimento)}
      </p>

      {/* Diagnóstico — discreto, segundo destaque */}
      {acompanhamento.diagnostico_principal && (
        <span
          className="mt-2 inline-block w-fit truncate rounded-md px-1.5 py-0.5 text-[10px] font-bold"
          style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
        >
          {DIAGNOSTICO_LABEL[acompanhamento.diagnostico_principal]}
        </span>
      )}

      {/* Pendências — exibidas como tags/chips diretamente no corpo do card.
          Clicar no corpo do chip abre o modal (útil se o texto truncar);
          clicar no "x" exclui direto, sem precisar abrir nada. */}
      {temPendencia && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {pendencias.map((p) => (
            <span
              key={p.id}
              className="flex max-w-full items-center gap-1 rounded-full pl-2 pr-1 py-0.5 text-[10px] font-bold"
              style={{ background: "var(--amber-dim)", color: "var(--amber)" }}
            >
              <span
                className="line-clamp-1 max-w-45 cursor-pointer sm:max-w-22.5"
                onClick={(e) => {
                  e.stopPropagation();
                  setModalPendenciasAberto(true);
                }}
                title="Clique para ver e gerenciar pendências"
              >
                {p.descricao}
              </span>
              <button
                onClick={(e) => handleExcluirPendencia(e, p.id)}
                disabled={isPending}
                title="Excluir pendência"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition hover:opacity-70 sm:h-3.5 sm:w-3.5 sm:text-[9px]"
                style={{ background: "rgba(0,0,0,0.08)" }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="min-h-2 flex-1" />

      {/* Badge de situação dialítica */}
      <div className="relative mb-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMostrarMenuHd((v) => !v)}
          disabled={isPending}
          title="Clique para definir a conduta dialítica"
          className="flex w-full items-center justify-center gap-1 rounded-full px-2 py-2 text-[12px] font-bold transition sm:py-1 sm:text-[11px]"
          style={{
            background: situacaoCfg ? situacaoCfg.bg : "var(--bg3)",
            color: situacaoCfg ? situacaoCfg.cor : "var(--text3)",
            border: situacaoCfg ? "none" : "1.5px dashed var(--border2)",
          }}
        >
          {situacaoCfg ? (
            <>{situacaoCfg.emoji} {situacaoCfg.label}</>
          ) : (
            <>📋 Definir conduta</>
          )}
          <span style={{ opacity: 0.65, fontSize: 9 }}>{mostrarMenuHd ? "▴" : "▾"}</span>
        </button>

        {mostrarMenuHd && (
          <>
            <div onClick={() => setMostrarMenuHd(false)} className="fixed inset-0 z-40" />
            <div
              className="absolute bottom-[110%] left-0 right-0 z-50 overflow-hidden rounded-(--nc-radius)"
              style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--nc-shadow-md)" }}
            >
              {(Object.keys(SITUACAO_DIALITICA_CONFIG) as Array<keyof typeof SITUACAO_DIALITICA_CONFIG>).map((key) => {
                const cfg = SITUACAO_DIALITICA_CONFIG[key];
                return (
                  <button
                    key={key}
                    onClick={() => handleSituacaoChange(key as "hd_hoje" | "hd_amanha" | "sem_hd_programada" | "hd_continua" | "dpi" | "tpe" | "conservador")}
                    className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold transition hover:opacity-80"
                    style={{ color: cfg.cor, background: key === acompanhamento.situacao_dialitica ? cfg.bg : "transparent" }}
                  >
                    {cfg.emoji} {cfg.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Botão de pendência — sempre visível. Texto muda conforme o contexto:
          se já tem pendência, convida a adicionar mais uma; se não tem
          nenhuma, convida a registrar a primeira. */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setModalPendenciasAberto(true);
        }}
        className="flex items-center justify-center gap-1 rounded-(--nc-radius) py-2 text-[12px] transition hover:opacity-70 sm:py-1 sm:text-[11px]"
        style={{ color: "var(--text3)", border: "1px dashed var(--border)" }}
      >
        + Adicionar pendência
      </button>
    </div>

    {/* Modal de pendências renderizado via Portal direto no <body>.
        Importante: o card pai tem `transform` no hover (translateY),
        e qualquer elemento ancestral com transform vira o "containing
        block" de filhos com position:fixed — fazendo o modal "saltar"
        de posição (e parecer abrir/fechar) sempre que o mouse passa
        por cima de QUALQUER card da lista. O Portal evita esse problema
        renderizando o modal fora da árvore do card, direto no body. */}
    {modalPendenciasAberto && createPortal(
      <div
        className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4"
        onClick={(e) => {
          e.stopPropagation();
          if (e.target === e.currentTarget) {
            setModalPendenciasAberto(false);
          }
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-(--nc-radius-lg) p-5 sm:p-4"
          style={{ background: "var(--card)", boxShadow: "var(--nc-shadow-md)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-base font-bold sm:text-sm" style={{ color: "var(--text)" }}>
              Pendências — {nomeAbreviado(paciente.nome)}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModalPendenciasAberto(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-base transition hover:opacity-70 sm:h-6 sm:w-6 sm:text-sm"
              style={{ color: "var(--text3)" }}
            >
              ✕
            </button>
          </div>

          {pendencias.length === 0 ? (
            <p className="mb-3 text-sm" style={{ color: "var(--text3)" }}>Nenhuma pendência registrada.</p>
          ) : (
            <ul className="mb-3 flex flex-col gap-1.5">
              {pendencias.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-(--nc-radius) px-2.5 py-2 sm:py-1.5"
                  style={{ background: "var(--amber-dim)" }}
                >
                  <span className="text-sm" style={{ color: "var(--amber)" }}>⚠️ {p.descricao}</span>
                  <button
                    onClick={(e) => handleExcluirPendencia(e, p.id)}
                    disabled={isPending}
                    title="Excluir pendência"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold transition hover:opacity-70 sm:h-5 sm:w-5 sm:text-xs"
                    style={{ color: "var(--amber)", border: "1px solid var(--amber)" }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-1.5">
            <input
              type="text"
              autoFocus
              value={novaPendencia}
              onChange={(e) => setNovaPendencia(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdicionarPendencia(e);
              }}
              placeholder="Nova pendência (ex: cateter)"
              className="nc-input flex-1"
            />
            <button onClick={(e) => handleAdicionarPendencia(e)} disabled={isPending} className="nc-btn nc-btn-primary shrink-0">
              + Adicionar
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}