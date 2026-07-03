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

/** Cores suaves por grande grupo (sugestão Chatiane) — tons harmônicos com a paleta azul do app. */
const CORES_GRUPO: Record<string, { bg: string; border: string; text: string }> = {
  UTIs: { bg: "#fdecea", border: "#f3c6c0", text: "#a33a2b" },
  Enfermarias: { bg: "#eef1f6", border: "#d4dce8", text: "#46607a" },
  Pronto_Socorro: { bg: "#fef3e2", border: "#f0d9ad", text: "#9a4a0a" },
  default: { bg: "var(--card2)", border: "var(--border)", text: "var(--text2)" },
};

async function buscarDados(supabase: ReturnType<typeof createClient>): Promise<LinhaDashboard[]> {
  // Busca acompanhamentos ativos + paciente + internação + pendências.
  // Em volume baixo (~20-30 linhas ativas), uma query com joins aninhados
  // do Supabase resolve bem sem precisar de view materializada.
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

/**
 * Ordena pacientes pelo número do leito (ordem numérica, não alfabética).
 * Extrai os dígitos do campo enfermaria_leito (ex: "105" -> 105, "12A" -> 12).
 * Leitos sem número (null/vazio) vão para o final.
 * Em caso de mesmo número (ex: "105A" e "105B"), desempata alfabeticamente
 * pelo texto completo do leito.
 */
function ordenarPorLeito(linhas: LinhaDashboard[]): LinhaDashboard[] {
  return [...linhas].sort((a, b) => {
    const leitoA = a.internacao.enfermaria_leito || "";
    const leitoB = b.internacao.enfermaria_leito || "";

    const numA = leitoA.match(/\d+/)?.[0];
    const numB = leitoB.match(/\d+/)?.[0];

    if (numA === undefined && numB === undefined) return leitoA.localeCompare(leitoB);
    if (numA === undefined) return 1;
    if (numB === undefined) return -1;

    const diff = parseInt(numA, 10) - parseInt(numB, 10);
    if (diff !== 0) return diff;

    return leitoA.localeCompare(leitoB);
  });
}

type FiltroIndicador = "todos" | "avaliados" | "pendentes" | "hd_hoje";

export function DashboardClient() {
  const supabase = createClient();
  const [linhas, setLinhas] = useState<LinhaDashboard[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroIndicador, setFiltroIndicador] = useState<FiltroIndicador>("todos");
  const [modalAberto, setModalAberto] = useState(false);

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
    // Estratégia simples (refetch completo) é adequada ao volume baixo
    // (~20-30 pacientes ativos) — evita complexidade de merge incremental.
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

  // Filtro de busca global simples (Seção 5.0) — nome, RG, diagnóstico, etiologia, tags, comorbidades
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

  // Filtro pelos indicadores clicáveis — combinado com a busca textual acima
  const linhasFiltradas = linhasPorBusca.filter((l) => {
    switch (filtroIndicador) {
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

  function handleClickIndicador(filtro: FiltroIndicador) {
    setFiltroIndicador((atual) => (atual === filtro ? "todos" : filtro));
  }

  // Indicadores agregados (Seção 5.1) — calculados sobre o resultado da busca textual,
  // não sobre o filtro de indicador (senão os números mudariam ao clicar neles).
  const totalAtivos = linhasPorBusca.length;
  const avaliadosHoje = linhasPorBusca.filter((l) => l.acompanhamento.avaliado_hoje).length;
  const pendentes = totalAtivos - avaliadosHoje;
  const hdHoje = linhasPorBusca.filter((l) => l.acompanhamento.situacao_dialitica === "hd_hoje").length;

  // Agrupamento pelos 3 grandes grupos fixos (UTIs / Enfermarias / Pronto-Socorro)
  const linhasPorGrupo = new Map<string, LinhaDashboard[]>();
  for (const linha of linhasFiltradas) {
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

  return (
    <div className="p-3 sm:p-6" style={{ background: "var(--bg)" }}>
      {/* Alerta de pendentes (item 4 da revisão) — visual, ao abrir o app */}
      {pendentes > 0 && (
        <div
          className="mb-4 rounded-(--nc-radius) px-4 py-2.5 text-sm"
          style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(176,48,32,0.2)" }}
        >
          ⚠ Existem <strong>{pendentes}</strong> paciente(s) sem avaliação registrada hoje.
        </div>
      )}

      {/* Indicadores agregados — clicáveis, funcionam como filtro */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:grid-cols-4 sm:gap-3">
        <Indicador
          label="Pacientes ativos"
          valor={totalAtivos}
          ativo={filtroIndicador === "todos"}
          onClick={() => handleClickIndicador("todos")}
        />
        <Indicador
          label="Avaliados hoje"
          valor={avaliadosHoje}
          tom="green"
          ativo={filtroIndicador === "avaliados"}
          onClick={() => handleClickIndicador("avaliados")}
        />
        <Indicador
          label="Pendentes"
          valor={pendentes}
          tom="red"
          ativo={filtroIndicador === "pendentes"}
          onClick={() => handleClickIndicador("pendentes")}
        />
        <Indicador
          label="HD hoje"
          valor={hdHoje}
          tom="red"
          ativo={filtroIndicador === "hd_hoje"}
          onClick={() => handleClickIndicador("hd_hoje")}
        />
      </div>

      {/* Busca global + novo paciente */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
        <div className="relative flex-1">
          <span
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base"
            style={{ color: "var(--text3)" }}
          >
            ⌕
          </span>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, RG, diagnóstico, etiologia, tags..."
            className="nc-input"
            style={{ paddingLeft: 36 }}
          />
        </div>
        <button onClick={() => setModalAberto(true)} className="nc-btn nc-btn-primary shrink-0">
          <span className="text-base leading-none">+</span> Novo paciente
        </button>
      </div>

      {/* Cards pelos 3 grandes grupos — sempre fixos, mesmo vazios */}
      {linhasFiltradas.length === 0 && (busca.trim() || filtroIndicador !== "todos") ? (
        <div
          className="rounded-(--nc-radius-lg) border border-dashed p-12 text-center"
          style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text3)" }}
        >
          Nenhum paciente encontrado para esse filtro.
        </div>
      ) : (
        <div className="space-y-8">
          {GRANDES_GRUPOS.map((grupo) => {
            const linhasDoGrupo = ordenarPorLeito(linhasPorGrupo.get(grupo.value) || []);
            const corGrupo = CORES_GRUPO[grupo.value] || CORES_GRUPO.default;
            return (
              <div key={grupo.value}>
                <div
                  className="mb-3 flex items-center gap-2 rounded-md px-3 py-1.5"
                  style={{ background: corGrupo.bg, border: `1px solid ${corGrupo.border}` }}
                >
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: corGrupo.text, letterSpacing: "0.06em" }}>
                    {grupo.label}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: "rgba(255,255,255,0.6)", color: corGrupo.text }}
                  >
                    {linhasDoGrupo.length}
                  </span>
                </div>
                {linhasDoGrupo.length === 0 ? (
                  <div
                    className="rounded-(--nc-radius) border border-dashed p-6 text-center text-sm"
                    style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text3)" }}
                  >
                    Nenhum paciente neste grupo.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
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
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalAberto && (
        <NovoPacienteModal
          onClose={() => setModalAberto(false)}
          onSaved={() => {
            setModalAberto(false);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

function Indicador({
  label,
  valor,
  tom = "default",
  ativo = false,
  onClick,
}: {
  label: string;
  valor: number;
  tom?: "default" | "green" | "red" | "amber" | "purple";
  ativo?: boolean;
  onClick?: () => void;
}) {
  const cores: Record<string, string> = {
    default: "var(--text)",
    green: "var(--green)",
    red: "var(--red)",
    amber: "var(--amber)",
    purple: "#6b3fa0",
  };

  return (
    <button
      onClick={onClick}
      className="nc-card cursor-pointer p-3 text-left transition"
      style={{
        borderWidth: ativo ? 2 : 1,
        borderColor: ativo ? cores[tom] : "var(--border)",
        background: ativo ? "var(--card2)" : "var(--card)",
      }}
    >
      <p className="text-2xl font-extrabold" style={{ color: cores[tom], fontFamily: "var(--mono)" }}>
        {valor}
      </p>
      <p className="text-xs" style={{ color: "var(--text3)" }}>{label}</p>
    </button>
  );
}