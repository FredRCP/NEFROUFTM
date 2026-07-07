"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PacienteRow {
  id: string;
  nome: string;
  rg_hospitalar: string;
  data_nascimento: string | null;
  sexo: "M" | "F" | null;
  comorbidades: string[];
  creatinina_basal: number | null;
  acompanhamento: {
    id: string;
    diagnostico_principal: string | null;
    etiologia: string | null;
    situacao_dialitica: string | null;
    ativo: boolean;
    created_at: string;
    internacao: {
      setor: string;
      enfermaria_leito: string | null;
      data_admissao: string | null;
    } | null;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcIdade(dataNasc: string | null): number | null {
  if (!dataNasc) return null;
  const nasc = new Date(dataNasc);
  const hoje = new Date();
  let a = hoje.getFullYear() - nasc.getFullYear();
  if (hoje.getMonth() < nasc.getMonth() ||
    (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) a--;
  return a;
}

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const DIAGNOSTICOS = [
  { value: "IRA", label: "IRA" },
  { value: "DRC_D", label: "DRC dialítica" },
  { value: "IRA_sobre_DRC", label: "IRA sobre DRC" },
  { value: "Glomerulopatias", label: "Glomerulopatias" },
  { value: "Avaliacao_plasmaferese", label: "Avaliação para plasmaférese" },
  { value: "DHE", label: "Distúrbios Hidroeletrolíticos" },
];

const COMORBIDADES_OPCOES = [
  "HAS", "DM", "ICC", "DPOC", "Obesidade", "Dislipidemia",
  "FA", "Cancer", "IRC", "Hepatopatia", "Imunossuprimido",
];

// ─── Componente ───────────────────────────────────────────────────────────────

export default function PacientesPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [pacientes, setPacientes] = useState<PacienteRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [total, setTotal] = useState(0);

  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroDiagnostico, setFiltroDiagnostico] = useState("");
  const [filtroSexo, setFiltroSexo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState(""); // "" | "ativo" | "alta"
  const [filtroIdadeMin, setFiltroIdadeMin] = useState("");
  const [filtroIdadeMax, setFiltroIdadeMax] = useState("");
  const [filtroComorbidade, setFiltroComorbidade] = useState("");
  const [filtroPeriodoInicio, setFiltroPeriodoInicio] = useState("");
  const [filtroPeriodoFim, setFiltroPeriodoFim] = useState("");
  const [ordenar, setOrdenar] = useState<"nome" | "idade" | "data">("data");
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 50;

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      const { data, error, count } = await supabase
        .from("pacientes")
        .select(`
          id, nome, rg_hospitalar, data_nascimento, sexo, comorbidades, creatinina_basal,
          acompanhamento:acompanhamentos_nefro(
            id, diagnostico_principal, etiologia, situacao_dialitica, ativo, created_at,
            internacao:internacoes(setor, enfermaria_leito, data_admissao)
          )
        `, { count: "exact" })
        .order("nome", { ascending: true })
        .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);

      if (!ativo) return;
      if (!error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: PacienteRow[] = (data || []).map((p: any) => ({
          ...p,
          acompanhamento: Array.isArray(p.acompanhamento)
            ? ([...p.acompanhamento].sort((a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              ).map((ac: any) => ({
                ...ac,
                internacao: Array.isArray(ac.internacao) ? ac.internacao[0] ?? null : ac.internacao,
              }))[0] ?? null)
            : p.acompanhamento,
        }));
        setPacientes(rows);
        setTotal(count ?? 0);
      }
      setCarregando(false);
    }
    carregar();
    return () => { ativo = false; };
  }, [supabase, pagina]);

  // Filtros no cliente (rápido, dados já carregados)
  const filtrados = useMemo(() => {
    let lista = [...pacientes];

    if (busca.trim()) {
      const t = busca.toLowerCase();
      lista = lista.filter(p =>
        p.nome.toLowerCase().includes(t) ||
        p.rg_hospitalar.toLowerCase().includes(t)
      );
    }

    if (filtroDiagnostico) {
      lista = lista.filter(p => p.acompanhamento?.diagnostico_principal === filtroDiagnostico);
    }

    if (filtroSexo) {
      lista = lista.filter(p => p.sexo === filtroSexo);
    }

    if (filtroStatus === "ativo") {
      lista = lista.filter(p => p.acompanhamento?.ativo === true);
    } else if (filtroStatus === "alta") {
      lista = lista.filter(p => p.acompanhamento?.ativo === false);
    }

    if (filtroComorbidade) {
      lista = lista.filter(p => p.comorbidades?.some(c => c === filtroComorbidade));
    }

    if (filtroIdadeMin || filtroIdadeMax) {
      lista = lista.filter(p => {
        const idade = calcIdade(p.data_nascimento);
        if (idade === null) return false;
        if (filtroIdadeMin && idade < parseInt(filtroIdadeMin)) return false;
        if (filtroIdadeMax && idade > parseInt(filtroIdadeMax)) return false;
        return true;
      });
    }

    if (filtroPeriodoInicio || filtroPeriodoFim) {
      lista = lista.filter(p => {
        const dataAdmissao = p.acompanhamento?.internacao?.data_admissao;
        if (!dataAdmissao) return false;
        if (filtroPeriodoInicio && dataAdmissao < filtroPeriodoInicio) return false;
        if (filtroPeriodoFim && dataAdmissao > filtroPeriodoFim) return false;
        return true;
      });
    }

    // Ordenação
    lista.sort((a, b) => {
      if (ordenar === "nome") return a.nome.localeCompare(b.nome);
      if (ordenar === "idade") {
        const ia = calcIdade(a.data_nascimento) ?? 0;
        const ib = calcIdade(b.data_nascimento) ?? 0;
        return ib - ia;
      }
      // data — mais recente primeiro
      const da = a.acompanhamento?.internacao?.data_admissao ?? "";
      const db = b.acompanhamento?.internacao?.data_admissao ?? "";
      return db.localeCompare(da);
    });

    return lista;
  }, [pacientes, busca, filtroDiagnostico, filtroSexo, filtroStatus,
      filtroComorbidade, filtroIdadeMin, filtroIdadeMax,
      filtroPeriodoInicio, filtroPeriodoFim, ordenar]);

  function limparFiltros() {
    setBusca(""); setFiltroDiagnostico(""); setFiltroSexo("");
    setFiltroStatus(""); setFiltroIdadeMin(""); setFiltroIdadeMax("");
    setFiltroComorbidade(""); setFiltroPeriodoInicio(""); setFiltroPeriodoFim("");
  }

  const temFiltroAtivo = busca || filtroDiagnostico || filtroSexo || filtroStatus ||
    filtroIdadeMin || filtroIdadeMax || filtroComorbidade ||
    filtroPeriodoInicio || filtroPeriodoFim;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <div style={{ background: "#1e3a5f", padding: "0 20px", height: 52, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/dashboard")}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px 6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.18)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font)" }}>
          <span style={{ fontSize: 16 }}>←</span> Dashboard
        </button>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }}>/</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: "white" }}>Todos os Pacientes</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginLeft: 4 }}>
          {carregando ? "..." : `${total} cadastrados · ${filtrados.length} exibidos`}
        </span>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 16px" }}>

        {/* Painel de filtros */}
        <div className="nc-card" style={{ padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)" }}>
              Filtros
            </span>
            {temFiltroAtivo && (
              <button onClick={limparFiltros}
                style={{ fontSize: 11, color: "var(--red)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)", fontWeight: 600 }}>
                ✕ Limpar filtros
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px 14px" }}>
            {/* Busca */}
            <div style={{ gridColumn: "span 2" }}>
              <label className="nc-label">Nome ou RG</label>
              <input value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar..." className="nc-input" />
            </div>

            {/* Diagnóstico */}
            <div>
              <label className="nc-label">Diagnóstico</label>
              <select value={filtroDiagnostico} onChange={e => setFiltroDiagnostico(e.target.value)}
                className="nc-input" style={{ cursor: "pointer" }}>
                <option value="">Todos</option>
                {DIAGNOSTICOS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>

            {/* Sexo */}
            <div>
              <label className="nc-label">Sexo</label>
              <select value={filtroSexo} onChange={e => setFiltroSexo(e.target.value)}
                className="nc-input" style={{ cursor: "pointer" }}>
                <option value="">Todos</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="nc-label">Status</label>
              <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
                className="nc-input" style={{ cursor: "pointer" }}>
                <option value="">Todos</option>
                <option value="ativo">Em acompanhamento</option>
                <option value="alta">Com alta</option>
              </select>
            </div>

            {/* Comorbidade */}
            <div>
              <label className="nc-label">Comorbidade</label>
              <select value={filtroComorbidade} onChange={e => setFiltroComorbidade(e.target.value)}
                className="nc-input" style={{ cursor: "pointer" }}>
                <option value="">Todas</option>
                {COMORBIDADES_OPCOES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Faixa etária */}
            <div>
              <label className="nc-label">Idade mínima</label>
              <input type="number" min="0" max="120" value={filtroIdadeMin}
                onChange={e => setFiltroIdadeMin(e.target.value)}
                placeholder="Ex: 18" className="nc-input" />
            </div>
            <div>
              <label className="nc-label">Idade máxima</label>
              <input type="number" min="0" max="120" value={filtroIdadeMax}
                onChange={e => setFiltroIdadeMax(e.target.value)}
                placeholder="Ex: 80" className="nc-input" />
            </div>

            {/* Período de internação */}
            <div>
              <label className="nc-label">Internado a partir de</label>
              <input type="date" value={filtroPeriodoInicio}
                onChange={e => setFiltroPeriodoInicio(e.target.value)} className="nc-input" />
            </div>
            <div>
              <label className="nc-label">Internado até</label>
              <input type="date" value={filtroPeriodoFim}
                onChange={e => setFiltroPeriodoFim(e.target.value)} className="nc-input" />
            </div>

            {/* Ordenação */}
            <div>
              <label className="nc-label">Ordenar por</label>
              <select value={ordenar} onChange={e => setOrdenar(e.target.value as "nome" | "idade" | "data")}
                className="nc-input" style={{ cursor: "pointer" }}>
                <option value="data">Data de internação (recente)</option>
                <option value="nome">Nome (A-Z)</option>
                <option value="idade">Idade (maior)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="nc-card overflow-hidden">
          {carregando ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)" }}>Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)" }}>
              <p style={{ fontSize: 16, marginBottom: 8 }}>Nenhum paciente encontrado</p>
              {temFiltroAtivo && (
                <button onClick={limparFiltros} className="nc-btn nc-btn-ghost" style={{ marginTop: 8 }}>
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#1e3a5f" }}>
                    {["Nome", "RG", "Idade", "Sexo", "Diagnóstico", "Etiologia", "Comorbidades", "Setor", "Admissão", "Status"].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", color: "white", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((p, idx) => {
                    const idade = calcIdade(p.data_nascimento);
                    const ac = p.acompanhamento;
                    const ativo = ac?.ativo;
                    return (
                      <tr key={p.id}
                        onClick={() => ac && router.push(`/pacientes/${ac.id}`)}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: idx % 2 === 0 ? "var(--card)" : "var(--card2)",
                          cursor: ac ? "pointer" : "default",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={e => { if (ac) (e.currentTarget as HTMLElement).style.background = "var(--accent-dim)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? "var(--card)" : "var(--card2)"; }}
                      >
                        <td style={{ padding: "9px 12px", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>
                          {p.nome}
                        </td>
                        <td style={{ padding: "9px 12px", color: "var(--text3)", fontFamily: "var(--mono)", fontSize: 12 }}>
                          {p.rg_hospitalar}
                        </td>
                        <td style={{ padding: "9px 12px", color: "var(--text2)", fontFamily: "var(--mono)", textAlign: "center" }}>
                          {idade !== null ? `${idade}a` : "—"}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center", color: "var(--text2)" }}>
                          {p.sexo === "F" ? "♀ F" : p.sexo === "M" ? "♂ M" : "—"}
                        </td>
                        <td style={{ padding: "9px 12px", color: "var(--accent)", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {ac?.diagnostico_principal?.replace(/_/g, " ") ?? "—"}
                        </td>
                        <td style={{ padding: "9px 12px", color: "var(--text2)", whiteSpace: "nowrap" }}>
                          {ac?.etiologia?.replace(/_/g, " ") ?? "—"}
                        </td>
                        <td style={{ padding: "9px 12px", maxWidth: 200 }}>
                          {p.comorbidades?.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                              {p.comorbidades.slice(0, 4).map(c => (
                                <span key={c} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 600 }}>
                                  {c.replace(/_/g, " ")}
                                </span>
                              ))}
                              {p.comorbidades.length > 4 && (
                                <span style={{ fontSize: 10, color: "var(--text3)" }}>+{p.comorbidades.length - 4}</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "9px 12px", color: "var(--text2)", fontSize: 12, whiteSpace: "nowrap" }}>
                          {ac?.internacao?.setor?.replace(/_/g, " ") ?? "—"}
                          {ac?.internacao?.enfermaria_leito && (
                            <span style={{ color: "var(--text3)" }}> · {ac.internacao.enfermaria_leito}</span>
                          )}
                        </td>
                        <td style={{ padding: "9px 12px", color: "var(--text3)", fontSize: 12, whiteSpace: "nowrap" }}>
                          {fmtData(ac?.internacao?.data_admissao ?? null)}
                        </td>
                        <td style={{ padding: "9px 12px" }}>
                          {ativo === true ? (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--green-dim)", color: "var(--green)" }}>
                              Ativo
                            </span>
                          ) : ativo === false ? (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--bg3)", color: "var(--text3)" }}>
                              Alta
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--text3)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {total > POR_PAGINA && (
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--card2)" }}>
              <span style={{ fontSize: 12, color: "var(--text3)" }}>
                Página {pagina} de {Math.ceil(total / POR_PAGINA)} · {total} pacientes
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                  className="nc-btn nc-btn-ghost" style={{ padding: "5px 14px", fontSize: 12 }}>
                  ← Anterior
                </button>
                <button onClick={() => setPagina(p => p + 1)} disabled={pagina >= Math.ceil(total / POR_PAGINA)}
                  className="nc-btn nc-btn-ghost" style={{ padding: "5px 14px", fontSize: 12 }}>
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}