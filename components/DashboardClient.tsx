"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PacienteCard } from "@/components/PacienteCard";
import { NovoPacienteModal } from "@/components/paciente/NovoPacienteModal";
import { GRANDES_GRUPOS, getGrupoBySetor } from "@/types/database";
import type { AcompanhamentoNefro, Paciente, Internacao, Pendencia } from "@/types/database";

interface LinhaDashboard {
  acompanhamento: AcompanhamentoNefro;
  paciente: Paciente;
  internacao: Internacao;
  pendencias: Pendencia[];
}

async function buscarDados(supabase: ReturnType<typeof createClient>): Promise<LinhaDashboard[]> {
  const { data, error } = await supabase
    .from("acompanhamentos_nefro")
    .select(
      `
      *,
      paciente:pacientes(*),
      internacao:internacoes(*),
      pendencias(*)
    `
    )
    .eq("ativo", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar dashboard:", error);
    return [];
  }

  return (data || []).map(
    (row: AcompanhamentoNefro & { paciente: Paciente; internacao: Internacao; pendencias: Pendencia[] }) => ({
      acompanhamento: row,
      paciente: row.paciente,
      internacao: row.internacao,
      pendencias: row.pendencias || [],
    })
  );
}

/** Ordena por setor e, dentro do setor, pelo número do leito (101 antes de 224). */
function compararPorSetorELeito(a: LinhaDashboard, b: LinhaDashboard): number {
  const setor = a.internacao.setor.localeCompare(b.internacao.setor, "pt-BR");
  if (setor !== 0) return setor;
  return (a.internacao.enfermaria_leito ?? "").localeCompare(
    b.internacao.enfermaria_leito ?? "", "pt-BR", { numeric: true, sensitivity: "base" }
  );
}

type FiltroStatus = "todos" | "pendentes" | "avaliados" | "hd_hoje";

export function DashboardClient() {
  const supabase = createClient();
  const [linhas, setLinhas] = useState<LinhaDashboard[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [fechados, setFechados] = useState<Record<string, boolean>>({});

  const recarregar = useCallback(() => {
    buscarDados(supabase).then(setLinhas);
  }, [supabase]);

  useEffect(() => {
    let ativo = true;

    buscarDados(supabase).then((dados) => {
      if (ativo) {
        setLinhas(dados);
        setCarregando(false);
      }
    });

    // Realtime: qualquer mudança nas tabelas relevantes recarrega a lista.
    const channel = supabase
      .channel("dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "acompanhamentos_nefro" }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "pendencias" }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "internacoes" }, recarregar)
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(channel);
    };
  }, [recarregar, supabase]);

  // Busca textual: nome, RG, diagnóstico, etiologia, tags, comorbidades
  const linhasPorBusca = busca.trim()
    ? linhas.filter((l) => {
        const termo = busca.toLowerCase();
        return (
          l.paciente.nome.toLowerCase().includes(termo) ||
          l.paciente.rg_hospitalar.toLowerCase().includes(termo) ||
          l.acompanhamento.diagnostico_principal?.toLowerCase().includes(termo) ||
          l.acompanhamento.etiologia?.toLowerCase().includes(termo) ||
          l.acompanhamento.tags?.some((t) => t.toLowerCase().includes(termo)) ||
          l.paciente.comorbidades?.some((c) => c.toLowerCase().replace(/_/g, " ").includes(termo))
        );
      })
    : linhas;

  // Filtro de status (substitui os 4 cards de indicadores)
  const linhasFiltradas = linhasPorBusca.filter((l) => {
    switch (filtro) {
      case "avaliados":
        return l.acompanhamento.avaliado_hoje;
      case "pendentes":
        return !l.acompanhamento.avaliado_hoje;
      case "hd_hoje":
        return l.acompanhamento.situacao_dialitica === "hd_hoje";
      default:
        return true;
    }
  });

  // Contagens sobre a busca textual (não sobre o filtro de status)
  const totalAtivos = linhasPorBusca.length;
  const avaliadosHoje = linhasPorBusca.filter((l) => l.acompanhamento.avaliado_hoje).length;
  const pendentes = totalAtivos - avaliadosHoje;
  const hdHoje = linhasPorBusca.filter((l) => l.acompanhamento.situacao_dialitica === "hd_hoje").length;

  const linhasPorGrupo = new Map<string, LinhaDashboard[]>();
  for (const linha of [...linhasFiltradas].sort(compararPorSetorELeito)) {
    const grupo = getGrupoBySetor(linha.internacao.setor);
    if (!linhasPorGrupo.has(grupo)) linhasPorGrupo.set(grupo, []);
    linhasPorGrupo.get(grupo)!.push(linha);
  }

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-16">
        <div
          className="nc-spin h-8 w-8 rounded-full border-[3px]"
          style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }}
        />
        <p className="text-sm" style={{ color: "var(--text3)" }}>Carregando pacientes...</p>
      </div>
    );
  }

  const opcoesFiltro: { id: FiltroStatus; label: string; n: number; cor: string }[] = [
    { id: "todos", label: "Todos", n: totalAtivos, cor: "var(--text)" },
    { id: "pendentes", label: "Sem avaliação", n: pendentes, cor: "var(--red)" },
    { id: "avaliados", label: "Avaliados", n: avaliadosHoje, cor: "var(--green)" },
    { id: "hd_hoje", label: "HD hoje", n: hdHoje, cor: "var(--red)" },
  ];

  return (
    <div className="p-4 sm:p-6" style={{ background: "var(--bg)" }}>
      {pendentes > 0 && (
        <div className="mb-4 rounded-(--nc-radius) px-4 py-2.5 text-sm"
          style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(176,48,32,0.2)" }}>
          ⚠ Existem <strong>{pendentes}</strong> paciente(s) sem avaliação registrada hoje.
        </div>
      )}

      {/* Busca + novo paciente */}
      <div className="mb-3 flex gap-3">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base" style={{ color: "var(--text3)" }}>⌕</span>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, RG, diagnóstico, etiologia, tags..."
            className="nc-input"
            style={{ paddingLeft: 36 }}
          />
        </div>
        <button onClick={() => setModalAberto(true)} className="nc-btn nc-btn-primary hidden shrink-0 sm:inline-flex">
          <span className="text-base leading-none">+</span> Novo paciente
        </button>
      </div>

      {/* Filtro de status */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
        {opcoesFiltro.map((op) => {
          const ativo = filtro === op.id;
          return (
            <button
              key={op.id}
              onClick={() => setFiltro(op.id)}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition"
              style={{
                background: ativo ? op.cor : "var(--card)",
                color: ativo ? "white" : op.cor,
                border: `1px solid ${ativo ? op.cor : "var(--border)"}`,
              }}
            >
              {op.label}
              <span className="rounded-full px-1.5 text-[11px] font-extrabold"
                style={{ background: ativo ? "rgba(255,255,255,0.25)" : "var(--card2)", color: ativo ? "white" : op.cor, fontFamily: "var(--mono)" }}>
                {op.n}
              </span>
            </button>
          );
        })}
      </div>

      {linhasFiltradas.length === 0 && (busca.trim() || filtro !== "todos") ? (
        <div className="rounded-(--nc-radius-lg) border border-dashed p-12 text-center"
          style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text3)" }}>
          Nenhum paciente encontrado.
        </div>
      ) : (
        <div className="space-y-6">
          {GRANDES_GRUPOS.map((grupo) => {
            const linhasDoGrupo = linhasPorGrupo.get(grupo.value) || [];
            const recolhido = !!fechados[grupo.value];
            return (
              <section key={grupo.value}>
                <button
                  onClick={() => setFechados((f) => ({ ...f, [grupo.value]: !f[grupo.value] }))}
                  className="mb-3 flex w-full items-center gap-2.5 rounded-md px-3.5 py-2 text-left transition hover:opacity-90"
                  style={{ background: "#1e3a5f", color: "white", border: "none", cursor: "pointer" }}
                >
                  <span className="text-[10px]">{recolhido ? "▸" : "▾"}</span>
                  <span className="text-xs font-extrabold uppercase" style={{ letterSpacing: "0.08em" }}>{grupo.label}</span>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "rgba(255,255,255,0.18)" }}>
                    {linhasDoGrupo.length}
                  </span>
                </button>

                {!recolhido && (
                  linhasDoGrupo.length === 0 ? (
                    <p className="px-1 text-xs" style={{ color: "var(--text3)" }}>Nenhum paciente neste grupo.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:[grid-template-columns:repeat(auto-fill,minmax(170px,260px))]">
                      {linhasDoGrupo.map((linha) => (
                        <PacienteCard
                          key={linha.acompanhamento.id}
                          acompanhamento={linha.acompanhamento}
                          paciente={linha.paciente}
                          internacao={linha.internacao}
                          pendencias={linha.pendencias}
                        />
                      ))}
                    </div>
                  )
                )}
              </section>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setModalAberto(true)}
        aria-label="Novo paciente"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-3xl font-light text-white shadow-lg sm:hidden"
        style={{ background: "var(--accent)" }}
      >
        +
      </button>

      {modalAberto && (
        <NovoPacienteModal
          onClose={() => setModalAberto(false)}
          onSaved={() => { setModalAberto(false); recarregar(); }}
        />
      )}
    </div>
  );
}
