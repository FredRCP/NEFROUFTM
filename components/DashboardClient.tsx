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

/** Cor única baseada no azul do app para todos os grupos — visual mais limpo e coeso. */
const CORES_GRUPO: Record<string, { bg: string; border: string; text: string }> = {
  UTIs:         { bg: "var(--accent-dim)", border: "var(--border2)", text: "var(--accent)" },
  Enfermarias:  { bg: "var(--accent-dim)", border: "var(--border2)", text: "var(--accent)" },
  Pronto_Socorro: { bg: "var(--accent-dim)", border: "var(--border2)", text: "var(--accent)" },
  default:      { bg: "var(--accent-dim)", border: "var(--border2)", text: "var(--accent)" },
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

async function buscarInativos(supabase: ReturnType<typeof createClient>, termo: string): Promise<LinhaDashboard[]> {
  // Busca pacientes cujo nome ou RG bate com o termo
  const { data: pacientes } = await supabase
    .from("pacientes")
    .select("id")
    .or(`nome.ilike.%${termo}%,rg_hospitalar.ilike.%${termo}%`)
    .limit(30);

  if (!pacientes?.length) return [];

  const ids = pacientes.map((p: { id: string }) => p.id);

  const { data, error } = await supabase
    .from("acompanhamentos_nefro")
    .select(`*, paciente:pacientes(*), internacao:internacoes(*), pendencias(*)`)
    .eq("ativo", false)
    .in("paciente_id", ids)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return [];
  return (data || []).map(
    (row: AcompanhamentoNefro & { paciente: Paciente; internacao: Internacao; pendencias: Pendencia[] }) => ({
      acompanhamento: row,
      paciente: row.paciente,
      internacao: row.internacao,
      pendencias: row.pendencias || [],
    })
  );
}

export function DashboardClient() {
  const supabase = createClient();
  const [linhas, setLinhas] = useState<LinhaDashboard[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroIndicador, setFiltroIndicador] = useState<FiltroIndicador>("todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [setoresRecolhidos, setSetoresRecolhidos] = useState<Set<string>>(new Set());
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [linhasInativas, setLinhasInativas] = useState<LinhaDashboard[]>([]);
  const [buscandoInativos, setBuscandoInativos] = useState(false);

  function toggleSetor(valor: string) {
    setSetoresRecolhidos((prev) => {
      const next = new Set(prev);
      if (next.has(valor)) next.delete(valor);
      else next.add(valor);
      return next;
    });
  }

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

  // Busca inativos quando toggle está ativo e há termo de busca
  useEffect(() => {
    let ativo = true;
    async function buscar() {
      if (!incluirInativos || !busca.trim()) {
        setLinhasInativas([]);
        return;
      }
      setBuscandoInativos(true);
      const dados = await buscarInativos(supabase, busca);
      if (ativo) { setLinhasInativas(dados); setBuscandoInativos(false); }
    }
    buscar();
    return () => { ativo = false; };
  }, [incluirInativos, busca, supabase]);

  // Filtro de busca global — nome, RG, diagnóstico, etiologia, tags, comorbidades
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

      {/* Busca global + toggle inativos + novo paciente */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:gap-3">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base" style={{ color: "var(--text3)" }}>
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
        {/* Toggle incluir inativos */}
        <button
          onClick={() => setIncluirInativos(v => !v)}
          className="nc-btn nc-btn-ghost shrink-0"
          style={{
            borderColor: incluirInativos ? "var(--accent)" : undefined,
            color: incluirInativos ? "var(--accent)" : "var(--text3)",
            background: incluirInativos ? "var(--accent-dim)" : undefined,
          }}
          title="Buscar pacientes que já receberam alta"
        >
          🗂 Alta
        </button>
        <button onClick={() => setModalAberto(true)} className="nc-btn nc-btn-primary shrink-0">
          <span className="text-base leading-none">+</span> Novo paciente
        </button>
      </div>

      {/* Resultados de pacientes com alta — só aparece quando toggle ativo */}
      {incluirInativos && (
        <div className="mb-6 rounded-(--nc-radius-lg) border overflow-hidden"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div style={{ background: "#1e3a5f", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "white" }}>🗂 Pacientes com alta</span>
            {busca.trim() && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                {buscandoInativos ? "Buscando..." : `${linhasInativas.length} resultado(s) para "${busca}"`}
              </span>
            )}
          </div>
          {!busca.trim() ? (
            <div style={{ padding: "20px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--text3)" }}>Digite um nome ou RG na busca acima para encontrar pacientes com alta.</p>
            </div>
          ) : buscandoInativos ? (
            <div style={{ padding: "20px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--text3)" }}>Buscando...</p>
            </div>
          ) : linhasInativas.length === 0 ? (
            <div style={{ padding: "20px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--text3)" }}>Nenhum paciente com alta encontrado para &ldquo;{busca}&rdquo;.</p>
            </div>
          ) : (
            <div>
              {linhasInativas.map((l, idx) => (
                <a key={l.acompanhamento.id} href={`/pacientes/${l.acompanhamento.id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 16px", textDecoration: "none",
                    borderBottom: idx < linhasInativas.length - 1 ? "1px solid var(--border)" : "none",
                    background: "var(--card)", transition: "background 0.1s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "var(--card)")}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{l.paciente.nome}</span>
                    <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>RG {l.paciente.rg_hospitalar}</span>
                    {l.acompanhamento.diagnostico_principal && (
                      <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text3)" }}>
                        · {l.acompanhamento.diagnostico_principal.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {l.internacao?.setor && (
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>
                        {l.internacao.setor.replace(/_/g, " ")}
                      </span>
                    )}
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--bg3)", color: "var(--text3)" }}>
                      Alta
                    </span>
                    <span style={{ color: "var(--text3)", fontSize: 14 }}>›</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

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
            const recolhido = setoresRecolhidos.has(grupo.value);
            return (
              <div key={grupo.value}>
                {/* Header clicável — accordion */}
                <button
                  onClick={() => toggleSetor(grupo.value)}
                  className="mb-3 flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 transition hover:opacity-90 active:scale-[0.99]"
                  style={{ background: "#1e3a5f", border: "none" }}
                >
                  <span style={{ color: "white", fontSize: 12, opacity: 0.7, display: "inline-block", transform: recolhido ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                    ▾
                  </span>
                  <span className="text-sm font-extrabold uppercase tracking-widest" style={{ color: "white", letterSpacing: "0.08em" }}>
                    {grupo.label}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: "rgba(255,255,255,0.18)", color: "white" }}>
                    {linhasDoGrupo.length}
                  </span>
                  {recolhido && (
                    <span className="ml-auto text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                      toque para expandir
                    </span>
                  )}
                </button>

                {/* Conteúdo colapsável */}
                {!recolhido && (
                  linhasDoGrupo.length === 0 ? (
                    <div
                      className="rounded-(--nc-radius) border border-dashed p-6 text-center text-sm"
                      style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text3)" }}
                    >
                      Nenhum paciente neste grupo.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 items-stretch sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7" style={{ gap: "12px" }}>
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