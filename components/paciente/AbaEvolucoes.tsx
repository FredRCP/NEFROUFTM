"use client";

import { useState, useTransition } from "react";
import {
  adicionarEvolucao, editarEvolucao, excluirEvolucao,
} from "@/lib/actions/acompanhamentos";
import { PainelDireito } from "@/components/paciente/PainelDireito";
import type { Evolucao, Medico, Paciente, AcompanhamentoNefro } from "@/types/database";

interface AbaEvolucoesProps {
  acompanhamentoId: string;
  acompanhamento: AcompanhamentoNefro;
  evolucoes: (Evolucao & { autor: Medico })[];
  usuarioId: string;
  paciente: Paciente;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDtHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
function isHoje(iso: string) {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AbaEvolucoes({ acompanhamentoId, acompanhamento, evolucoes, usuarioId, paciente }: AbaEvolucoesProps) {
  const [isPending, startTransition] = useTransition();
  const [evolucaoSelecionada, setEvolucaoSelecionada] = useState<(Evolucao & { autor: Medico }) | null>(evolucoes[0] ?? null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [textoEditor, setTextoEditor] = useState("");
  const [novaEvolucao, setNovaEvolucao] = useState(false);
  const [textoNova, setTextoNova] = useState("");

  // Separa evoluções de hoje vs anteriores
  const evolucoesHoje = evolucoes.filter(e => isHoje(e.created_at));
  const evolucoesAnteriores = evolucoes.filter(e => !isHoje(e.created_at));

  const ehAutor = evolucaoSelecionada?.autor_id === usuarioId;

  function handleNovaEvolucao() {
    setNovaEvolucao(true); setEvolucaoSelecionada(null); setModoEdicao(false); setTextoNova("");
  }
  function handleSalvarNova() {
    if (!textoNova.trim()) return;
    startTransition(async () => {
      await adicionarEvolucao(acompanhamentoId, textoNova);
      setTextoNova(""); setNovaEvolucao(false);
    });
  }
  function handleSalvarEdicao() {
    if (!evolucaoSelecionada) return;
    startTransition(async () => {
      await editarEvolucao(evolucaoSelecionada.id, textoEditor);
      setModoEdicao(false);
    });
  }
  function handleExcluir() {
    if (!evolucaoSelecionada || !confirm("Excluir esta evolução?")) return;
    startTransition(async () => {
      await excluirEvolucao(evolucaoSelecionada.id);
      setEvolucaoSelecionada(evolucoes.find(e => e.id !== evolucaoSelecionada.id) ?? null);
    });
  }

  // Item de evolução na lista lateral
  function ItemEvolucao({ ev }: { ev: Evolucao & { autor: Medico } }) {
    const isActive = !novaEvolucao && evolucaoSelecionada?.id === ev.id;
    return (
      <div
        onClick={() => { setEvolucaoSelecionada(ev); setNovaEvolucao(false); setModoEdicao(false); }}
        style={{
          padding: "9px 14px", borderBottom: "1px solid var(--border)",
          borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
          background: isActive ? "var(--accent-dim)" : "transparent",
          cursor: "pointer", transition: "background 0.1s",
        }}
        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--bg2)"; }}
        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)", fontWeight: 700, marginBottom: 2 }}>
          {fmtDtHora(ev.created_at)}
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600, marginBottom: 1 }}>
          {ev.autor?.nome?.split(" ").slice(0, 2).join(" ") ?? "—"}
        </div>
        <div style={{ fontSize: 11, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ev.texto.slice(0, 45)}{ev.texto.length > 45 ? "…" : ""}
        </div>
      </div>
    );
  }

  // Aba ativa no mobile (layout em abas em vez de 3 colunas)
  const [abaMobile, setAbaMobile] = useState<"historico" | "editor" | "exames">("editor");

  return (
    <>
    {/* ── DESKTOP: 3 colunas ── */}
    <div className="hidden sm:grid" style={{
      gridTemplateColumns: "260px 1fr 260px",
      height: "100%",
      overflow: "hidden",
    }}>

      {/* ── COLUNA ESQUERDA: histórico ────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", overflow: "hidden", background: "var(--card)" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--card2)", flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)" }}>Evoluções</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Botão nova evolução */}
          <div
            onClick={handleNovaEvolucao}
            style={{
              padding: "10px 14px", borderBottom: "1px solid var(--border)",
              borderLeft: novaEvolucao ? "3px solid var(--green)" : "3px solid transparent",
              background: novaEvolucao ? "var(--green-dim)" : "transparent",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={e => { if (!novaEvolucao) (e.currentTarget as HTMLElement).style.background = "var(--bg2)"; }}
            onMouseLeave={e => { if (!novaEvolucao) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: novaEvolucao ? "var(--green)" : "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: novaEvolucao ? "white" : "var(--accent)", flexShrink: 0 }}>
              +
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: novaEvolucao ? "var(--green)" : "var(--accent)" }}>
              {novaEvolucao ? "Escrevendo..." : "Nova evolução"}
            </span>
          </div>

          {/* Separador HOJE */}
          {evolucoesHoje.length > 0 && (
            <>
              <div style={{ padding: "6px 14px 4px", display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ height: 1, flex: 1, background: "var(--green)", opacity: 0.3 }} />
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--green)", flexShrink: 0 }}>Hoje</span>
                <div style={{ height: 1, flex: 1, background: "var(--green)", opacity: 0.3 }} />
              </div>
              {evolucoesHoje.map(ev => <ItemEvolucao key={ev.id} ev={ev} />)}
            </>
          )}

          {/* Separador ANTERIORES */}
          {evolucoesAnteriores.length > 0 && (
            <>
              <div style={{ padding: "6px 14px 4px", display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", flexShrink: 0 }}>Anteriores</span>
                <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
              </div>
              {evolucoesAnteriores.map(ev => <ItemEvolucao key={ev.id} ev={ev} />)}
            </>
          )}

          {evolucoes.length === 0 && !novaEvolucao && (
            <div style={{ padding: "24px 14px", textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
              Nenhuma evolução registrada
            </div>
          )}
        </div>
      </div>

      {/* ── COLUNA CENTRAL: editor ───────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--card)", borderRight: "1px solid var(--border)" }}>
        {novaEvolucao ? (
          <>
            <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--card2)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>✏ Nova evolução</span>
              <button
                onClick={() => { if (evolucoes.length > 0) setTextoNova(evolucoes[0].texto); }}
                disabled={evolucoes.length === 0}
                style={{ fontSize: 11, color: "var(--text3)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>
                Copiar anterior
              </button>
            </div>
            <div style={{ flex: 1, padding: "16px 20px 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <textarea autoFocus value={textoNova} onChange={e => setTextoNova(e.target.value)}
                placeholder="Evolução clínica do dia..."
                style={{ flex: 1, resize: "none", border: "none", outline: "none", fontSize: 14, lineHeight: 1.85, color: "var(--text)", background: "transparent", fontFamily: "var(--font)", width: "100%" }} />
            </div>
            <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: "var(--card)" }}>
              <button onClick={() => setNovaEvolucao(false)} style={{ fontSize: 12, color: "var(--text3)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>Cancelar</button>
              <button onClick={handleSalvarNova} disabled={isPending || !textoNova.trim()} className="nc-btn nc-btn-primary" style={{ fontSize: 13 }}>
                {isPending ? "Salvando..." : "Salvar evolução"}
              </button>
            </div>
          </>
        ) : evolucaoSelecionada ? (
          <>
            <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--card2)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--mono)" }}>{fmtDtHora(evolucaoSelecionada.created_at)}</span>
                <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>{evolucaoSelecionada.autor?.nome}</span>
                {evolucaoSelecionada.updated_at !== evolucaoSelecionada.created_at && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text3)" }}>(editada)</span>
                )}
              </div>
              {ehAutor && (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {/* Copiar — disponível para todos (não só autor) */}
                  <button
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(evolucaoSelecionada.texto); }
                      catch { /* ignora */ }
                    }}
                    title="Copiar texto"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 15, padding: "2px 4px", borderRadius: 4, transition: "color 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}
                  >⧉</button>

                  {modoEdicao ? (
                    <>
                      <button onClick={() => setModoEdicao(false)} className="nc-btn nc-btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }}>Cancelar</button>
                      <button onClick={handleSalvarEdicao} disabled={isPending} className="nc-btn nc-btn-primary" style={{ fontSize: 12, padding: "4px 12px" }}>
                        {isPending ? "Salvando..." : "Salvar"}
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Lápis */}
                      <button
                        onClick={() => { setTextoEditor(evolucaoSelecionada.texto); setModoEdicao(true); }}
                        title="Editar"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 15, padding: "2px 4px", borderRadius: 4, transition: "color 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}
                      >✏</button>
                      {/* Lixo */}
                      <button
                        onClick={handleExcluir}
                        title="Excluir"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 15, padding: "2px 4px", borderRadius: 4, transition: "color 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "var(--red)")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}
                      >🗑</button>
                    </>
                  )}
                </div>
              )}
            </div>
            <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>
              {modoEdicao ? (
                <textarea autoFocus value={textoEditor} onChange={e => setTextoEditor(e.target.value)}
                  style={{ width: "100%", height: "100%", resize: "none", border: "none", outline: "none", fontSize: 14, lineHeight: 1.85, color: "var(--text)", background: "transparent", fontFamily: "var(--font)" }} />
              ) : (
                <p style={{ fontSize: 14, lineHeight: 1.9, color: "var(--text)", whiteSpace: "pre-wrap", margin: 0 }}>
                  {evolucaoSelecionada.texto}
                </p>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ fontSize: 36 }}>📝</div>
            <div style={{ fontSize: 14, color: "var(--text2)", fontWeight: 600 }}>Selecione ou crie uma evolução</div>
            <button onClick={handleNovaEvolucao} className="nc-btn nc-btn-primary">+ Nova evolução</button>
          </div>
        )}
      </div>

      {/* ── COLUNA DIREITA: diurese + TFG + exames ───────────────────── */}
      <div style={{ overflow: "hidden", background: "var(--card)", borderLeft: "1px solid var(--border)" }}>
        <PainelDireito
          acompanhamentoId={acompanhamentoId}
          paciente={paciente}
          acompanhamento={acompanhamento}
        />
      </div>
    </div>

    {/* ── MOBILE: layout em abas ── */}
    <div className="flex sm:hidden" style={{ flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Conteúdo da aba ativa */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* Aba Histórico */}
        {abaMobile === "historico" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--card)" }}>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {/* Botão nova evolução */}
              <div onClick={() => { handleNovaEvolucao(); setAbaMobile("editor"); }}
                style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: novaEvolucao ? "var(--green-dim)" : "transparent" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "var(--accent)" }}>+</div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>Nova evolução</span>
              </div>

              {/* Separador Hoje */}
              {evolucoesHoje.length > 0 && (
                <>
                  <div style={{ padding: "6px 16px 4px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ height: 1, flex: 1, background: "var(--green)", opacity: 0.3 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--green)" }}>Hoje</span>
                    <div style={{ height: 1, flex: 1, background: "var(--green)", opacity: 0.3 }} />
                  </div>
                  {evolucoesHoje.map(ev => (
                    <div key={ev.id} onClick={() => { setEvolucaoSelecionada(ev); setNovaEvolucao(false); setAbaMobile("editor"); }}
                      style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer", borderLeft: evolucaoSelecionada?.id === ev.id ? "3px solid var(--accent)" : "3px solid transparent" }}>
                      <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, marginBottom: 2 }}>{fmtDtHora(ev.created_at)}</div>
                      <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 2 }}>{ev.autor?.nome?.split(" ").slice(0, 2).join(" ")}</div>
                      <div style={{ fontSize: 12, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.texto.slice(0, 60)}…</div>
                    </div>
                  ))}
                </>
              )}

              {/* Separador Anteriores */}
              {evolucoesAnteriores.length > 0 && (
                <>
                  <div style={{ padding: "6px 16px 4px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text3)" }}>Anteriores</span>
                    <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
                  </div>
                  {evolucoesAnteriores.map(ev => (
                    <div key={ev.id} onClick={() => { setEvolucaoSelecionada(ev); setNovaEvolucao(false); setAbaMobile("editor"); }}
                      style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                      <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, marginBottom: 2 }}>{fmtDtHora(ev.created_at)}</div>
                      <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 2 }}>{ev.autor?.nome?.split(" ").slice(0, 2).join(" ")}</div>
                      <div style={{ fontSize: 12, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.texto.slice(0, 60)}…</div>
                    </div>
                  ))}
                </>
              )}

              {evolucoes.length === 0 && (
                <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--text3)" }}>Nenhuma evolução registrada</div>
              )}
            </div>
          </div>
        )}

        {/* Aba Editor */}
        {abaMobile === "editor" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--card)" }}>
            {novaEvolucao ? (
              <>
                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--card2)", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>✏ Nova evolução</span>
                  <button onClick={() => { if (evolucoes.length > 0) setTextoNova(evolucoes[0].texto); }}
                    disabled={evolucoes.length === 0}
                    style={{ fontSize: 12, color: "var(--text3)", background: "none", border: "none", cursor: "pointer" }}>
                    Copiar anterior
                  </button>
                </div>
                <textarea autoFocus value={textoNova} onChange={e => setTextoNova(e.target.value)}
                  placeholder="Evolução clínica do dia..."
                  style={{ flex: 1, padding: "16px", resize: "none", border: "none", outline: "none", fontSize: 15, lineHeight: 1.85, color: "var(--text)", background: "transparent", fontFamily: "var(--font)" }} />
                <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
                  <button onClick={() => setNovaEvolucao(false)} style={{ fontSize: 13, color: "var(--text3)", background: "none", border: "none", cursor: "pointer" }}>Cancelar</button>
                  <button onClick={handleSalvarNova} disabled={isPending || !textoNova.trim()} className="nc-btn nc-btn-primary">
                    {isPending ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </>
            ) : evolucaoSelecionada ? (
              <>
                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--card2)", flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--mono)" }}>{fmtDtHora(evolucaoSelecionada.created_at)}</div>
                  <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600 }}>{evolucaoSelecionada.autor?.nome}</div>
                  {ehAutor && !modoEdicao && (
                    <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                      <button onClick={async () => { try { await navigator.clipboard.writeText(evolucaoSelecionada.texto); } catch {} }}
                        style={{ fontSize: 13, background: "none", border: "none", cursor: "pointer", color: "var(--text3)" }}>⧉ Copiar</button>
                      <button onClick={() => { setTextoEditor(evolucaoSelecionada.texto); setModoEdicao(true); }}
                        style={{ fontSize: 13, background: "none", border: "none", cursor: "pointer", color: "var(--text2)" }}>✏ Editar</button>
                      <button onClick={handleExcluir}
                        style={{ fontSize: 13, background: "none", border: "none", cursor: "pointer", color: "var(--red)" }}>🗑 Excluir</button>
                    </div>
                  )}
                  {modoEdicao && (
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <button onClick={() => setModoEdicao(false)} className="nc-btn nc-btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }}>Cancelar</button>
                      <button onClick={handleSalvarEdicao} disabled={isPending} className="nc-btn nc-btn-primary" style={{ fontSize: 12, padding: "4px 12px" }}>
                        {isPending ? "..." : "Salvar"}
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
                  {modoEdicao ? (
                    <textarea autoFocus value={textoEditor} onChange={e => setTextoEditor(e.target.value)}
                      style={{ width: "100%", height: "100%", resize: "none", border: "none", outline: "none", fontSize: 15, lineHeight: 1.85, color: "var(--text)", background: "transparent", fontFamily: "var(--font)" }} />
                  ) : (
                    <p style={{ fontSize: 15, lineHeight: 1.9, color: "var(--text)", whiteSpace: "pre-wrap", margin: 0 }}>{evolucaoSelecionada.texto}</p>
                  )}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <div style={{ fontSize: 40 }}>📝</div>
                <div style={{ fontSize: 14, color: "var(--text2)", fontWeight: 600 }}>Selecione ou crie uma evolução</div>
                <button onClick={handleNovaEvolucao} className="nc-btn nc-btn-primary">+ Nova evolução</button>
              </div>
            )}
          </div>
        )}

        {/* Aba Exames/Diurese */}
        {abaMobile === "exames" && (
          <div style={{ height: "100%", overflow: "hidden" }}>
            <PainelDireito acompanhamentoId={acompanhamentoId} paciente={paciente} acompanhamento={acompanhamento} />
          </div>
        )}
      </div>

      {/* Barra de navegação mobile — rodapé fixo */}
      <div style={{ flexShrink: 0, display: "flex", borderTop: "1px solid var(--border)", background: "var(--card)" }}>
        {([
          { id: "historico", label: "Histórico", icon: "📋" },
          { id: "editor",    label: "Evolução",  icon: "✏" },
          { id: "exames",    label: "Exames",    icon: "🧪" },
        ] as const).map(aba => (
          <button key={aba.id} onClick={() => setAbaMobile(aba.id)}
            style={{
              flex: 1, padding: "10px 4px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              background: "none", border: "none", cursor: "pointer",
              borderTop: abaMobile === aba.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: abaMobile === aba.id ? "var(--accent)" : "var(--text3)",
            }}>
            <span style={{ fontSize: 18 }}>{aba.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700 }}>{aba.label}</span>
          </button>
        ))}
      </div>
    </div>
    </>
  );
}