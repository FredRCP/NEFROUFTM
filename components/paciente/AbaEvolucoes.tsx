"use client";

import { useState, useTransition, useEffect, useCallback, useRef, useMemo } from "react";
import {
  adicionarEvolucao, editarEvolucao, excluirEvolucao,
} from "@/lib/actions/acompanhamentos";
import {
  registrarDiurese, editarDiurese, excluirDiurese, buscarDiureses,
} from "@/lib/actions/pacientesExtra";
import { createClient } from "@/lib/supabase/client";
import type { Evolucao, Medico, Paciente } from "@/types/database";

interface AbaEvolucoesProps {
  acompanhamentoId: string;
  evolucoes: (Evolucao & { autor: Medico })[];
  usuarioId: string;
  paciente: Paciente;
}

interface PontoDiurese {
  id: string; data: string; volume_ml: number; horas: number;
}

interface ExameRow {
  id: string; data: string;
  parametros: { creatinina?: number|null; ureia?: number|null; potassio?: number|null; };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDtHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
function fmtDataCurta(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function isHoje(iso: string) {
  const hoje = new Date().toISOString().slice(0, 10);
  return iso.slice(0, 10) === hoje;
}

function calcTFG(cr: number, idade: number, sexo: string): number | null {
  if (!cr || !idade) return null;
  const k = sexo === "F" ? 0.7 : 0.9, a = sexo === "F" ? -0.241 : -0.302, sf = sexo === "F" ? 1.012 : 1.0;
  const r = cr / k;
  return Math.round(142 * Math.pow(Math.min(r,1), a) * Math.pow(Math.max(r,1), -1.2) * Math.pow(0.9938, idade) * sf);
}

function estagioTFG(tfg: number): { label: string; cor: string } {
  if (tfg >= 90) return { label: "G1 ≥90", cor: "#16a34a" };
  if (tfg >= 60) return { label: "G2 60–89", cor: "#16a34a" };
  if (tfg >= 45) return { label: "G3a 45–59", cor: "#ca8a04" };
  if (tfg >= 30) return { label: "G3b 30–44", cor: "#d97706" };
  if (tfg >= 15) return { label: "G4 15–29", cor: "#ea580c" };
  return { label: "G5 <15", cor: "#dc2626" };
}

function corCr(v: number) { return v >= 3.0 ? "var(--red)" : v >= 1.4 ? "var(--amber)" : "#16a34a"; }
function corK(v: number) { return v >= 5.5 || v < 3.5 ? "var(--red)" : "#16a34a"; }
function corUr(v: number) { return v > 100 ? "var(--red)" : v > 50 ? "var(--amber)" : "#16a34a"; }

// ─── Coluna direita: TFG + exames + diurese ──────────────────────────────────

function PainelDireito({
  acompanhamentoId, paciente,
}: { acompanhamentoId: string; paciente: Paciente }) {
  const supabase = createClient();
  const [exames, setExames] = useState<ExameRow[]>([]);
  const [diureses, setDiureses] = useState<PontoDiurese[]>([]);
  const [volume, setVolume] = useState("");
  const [horas, setHoras] = useState("24");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editVol, setEditVol] = useState("");
  const [editH, setEditH] = useState("24");
  const dataDiurese = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const idade = useMemo(() => {
    if (!paciente.data_nascimento) return 0;
    const nasc = new Date(paciente.data_nascimento);
    const hoje = new Date();
    let a = hoje.getFullYear() - nasc.getFullYear();
    if (hoje.getMonth() < nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) a--;
    return a;
  }, [paciente.data_nascimento]);

  const carregarDiureses = useCallback(async () => {
    const r = await buscarDiureses(acompanhamentoId);
    if (r.sucesso) setDiureses(r.dados as PontoDiurese[]);
  }, [acompanhamentoId]);

  useEffect(() => {
    let ativo = true;
    supabase.from("exames").select("id,data,parametros")
      .eq("acompanhamento_id", acompanhamentoId).order("data", { ascending: false }).limit(5)
      .then(({ data }) => { if (ativo) setExames((data || []) as ExameRow[]); });
    buscarDiureses(acompanhamentoId).then(r => { if (ativo && r.sucesso) setDiureses(r.dados as PontoDiurese[]); });
    return () => { ativo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acompanhamentoId]);

  // Último exame com dados
  const ultimo = exames[0];
  const cr = ultimo?.parametros?.creatinina ?? null;
  const ur = ultimo?.parametros?.ureia ?? null;
  const k  = ultimo?.parametros?.potassio ?? null;
  const tfg = cr && paciente.sexo ? calcTFG(cr, idade, paciente.sexo) : null;
  const est = tfg ? estagioTFG(tfg) : null;

  async function handleRegistrar() {
    const vol = parseInt(volume, 10), hrs = parseInt(horas, 10);
    if (!volume || isNaN(vol) || vol < 0) { setErro("Volume inválido."); return; }
    if (!horas || isNaN(hrs) || hrs <= 0 || hrs > 24) { setErro("Horas: 1–24."); return; }
    setErro(null); setSalvando(true);
    const r = await registrarDiurese(acompanhamentoId, dataDiurese, vol, hrs);
    setSalvando(false);
    if (r.sucesso) { setVolume(""); setHoras("24"); carregarDiureses(); }
    else setErro(r.erro || "Erro.");
  }

  async function handleSalvarEdicao() {
    if (!editandoId) return;
    const vol = parseInt(editVol, 10), hrs = parseInt(editH, 10);
    if (isNaN(vol) || isNaN(hrs)) return;
    await editarDiurese(editandoId, vol, hrs);
    setEditandoId(null); carregarDiureses();
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir?")) return;
    await excluirDiurese(id); carregarDiureses();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── TFG + Exames ── */}
      <div style={{ flexShrink: 0, padding: "12px 12px 8px" }}>

        {/* TFG em destaque */}
        {tfg && est ? (
          <div style={{ borderRadius: "var(--nc-radius)", padding: "10px 12px", marginBottom: 10, background: est.cor + "12", border: `1px solid ${est.cor}30`, textAlign: "center" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>TFG — CKD-EPI 2021</p>
            <p style={{ fontSize: 28, fontWeight: 900, color: est.cor, fontFamily: "var(--mono)", lineHeight: 1 }}>
              {tfg}
              <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text3)", marginLeft: 3 }}>mL/min</span>
            </p>
            <p style={{ fontSize: 11, fontWeight: 700, color: est.cor, marginTop: 2 }}>DRC {est.label}</p>
          </div>
        ) : (
          <div style={{ borderRadius: "var(--nc-radius)", padding: "10px 12px", marginBottom: 10, background: "var(--card2)", border: "1px solid var(--border)", textAlign: "center" }}>
            <p style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>TFG — CKD-EPI 2021</p>
            <p style={{ fontSize: 18, fontWeight: 900, color: "var(--text3)", fontFamily: "var(--mono)" }}>—</p>
            <p style={{ fontSize: 10, color: "var(--text3)" }}>Registre um exame com creatinina</p>
          </div>
        )}

        {/* Exames essenciais */}
        <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 6 }}>Último exame {ultimo ? `· ${fmtDataCurta(ultimo.data)}` : ""}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { label: "Creatinina", valor: cr, unidade: "mg/dL", cor: cr ? corCr(cr) : undefined },
            { label: "Ureia",      valor: ur, unidade: "mg/dL", cor: ur ? corUr(ur) : undefined },
            { label: "Potássio",   valor: k,  unidade: "mEq/L", cor: k  ? corK(k)  : undefined },
          ].map(({ label, valor, unidade, cor }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 10px", borderRadius: "var(--nc-radius)", background: "var(--card2)", border: "1px solid var(--border)" }}>
              <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--mono)", color: cor || "var(--text3)" }}>
                {valor != null ? valor : "—"}
                {valor != null && <span style={{ fontSize: 9, fontWeight: 400, color: "var(--text3)", marginLeft: 2 }}>{unidade}</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Histórico dos últimos registros */}
        {exames.length > 1 && (
          <div style={{ marginTop: 6 }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 4 }}>Histórico Cr</p>
            {exames.slice(1, 4).map(e => {
              const eCr = e.parametros?.creatinina;
              if (!eCr) return null;
              return (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 8px", borderRadius: 4, marginBottom: 2, background: "var(--bg2)" }}>
                  <span style={{ fontSize: 10, color: "var(--text3)" }}>{fmtDataCurta(e.data)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--mono)", color: corCr(eCr) }}>{eCr}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Divisor */}
      <div style={{ height: 1, background: "var(--border)", flexShrink: 0, margin: "0 12px" }} />

      {/* ── Diurese ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px 12px" }}>
        <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 8 }}>Diurese</p>

        {/* Último registro em destaque */}
        {diureses.length > 0 && (() => {
          const ult = [...diureses].reverse()[0];
          return (
            <div style={{ borderRadius: "var(--nc-radius)", padding: "8px 10px", marginBottom: 8, background: "var(--accent-dim)", border: "1px solid var(--border2)" }}>
              <p style={{ fontSize: 9, color: "var(--text3)", marginBottom: 2 }}>Último registro · {fmtDataCurta(ult.data)}</p>
              <p style={{ fontSize: 22, fontWeight: 900, fontFamily: "var(--mono)", color: "var(--accent)", lineHeight: 1 }}>
                {ult.volume_ml}
                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text3)", marginLeft: 3 }}>ml / {ult.horas}h</span>
              </p>
            </div>
          );
        })()}

        {/* Formulário rápido */}
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", marginBottom: 4 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 9, color: "var(--text3)", marginBottom: 2 }}>Volume (ml)</p>
            <input type="number" min="0" step="10" value={volume}
              onChange={e => setVolume(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRegistrar()}
              placeholder="Ex: 800"
              style={{ width: "100%", padding: "5px 8px", fontSize: 13, fontFamily: "var(--font)", border: "1.5px solid var(--border)", borderRadius: "var(--nc-radius)", background: "var(--card)", color: "var(--text)", outline: "none" }}
            />
          </div>
          <div style={{ width: 44 }}>
            <p style={{ fontSize: 9, color: "var(--text3)", marginBottom: 2 }}>Horas</p>
            <input type="number" min="1" max="24" value={horas}
              onChange={e => setHoras(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRegistrar()}
              style={{ width: "100%", padding: "5px 6px", fontSize: 13, fontFamily: "var(--font)", border: "1.5px solid var(--border)", borderRadius: "var(--nc-radius)", background: "var(--card)", color: "var(--text)", outline: "none" }}
            />
          </div>
          <button onClick={handleRegistrar} disabled={salvando || !volume}
            style={{ padding: "7px 10px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--nc-radius)", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: salvando || !volume ? 0.5 : 1, fontFamily: "var(--font)", flexShrink: 0 }}>
            ✓
          </button>
        </div>
        {erro && <p style={{ fontSize: 10, color: "var(--red)", marginBottom: 4 }}>{erro}</p>}

        {/* Histórico de diureses */}
        {diureses.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {[...diureses].reverse().slice(0, 6).map(d => {
              const emEdicao = editandoId === d.id;
              return (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 6px", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                  {emEdicao ? (
                    <>
                      <input type="number" value={editVol} onChange={e => setEditVol(e.target.value)}
                        style={{ width: 52, padding: "2px 4px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, fontFamily: "var(--font)" }} />
                      <span style={{ color: "var(--text3)" }}>ml/</span>
                      <input type="number" value={editH} onChange={e => setEditH(e.target.value)}
                        style={{ width: 32, padding: "2px 4px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, fontFamily: "var(--font)" }} />
                      <span style={{ color: "var(--text3)" }}>h</span>
                      <button onClick={handleSalvarEdicao} style={{ marginLeft: "auto", background: "var(--accent)", color: "white", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>✓</button>
                      <button onClick={() => setEditandoId(null)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 11 }}>✕</button>
                    </>
                  ) : (
                    <>
                      <span style={{ color: "var(--text3)", minWidth: 36 }}>{fmtDataCurta(d.data)}</span>
                      <span style={{ fontWeight: 700, color: "var(--accent)", fontFamily: "var(--mono)" }}>{d.volume_ml}</span>
                      <span style={{ color: "var(--text3)" }}>ml/{d.horas}h</span>
                      <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                        <button onClick={() => { setEditandoId(d.id); setEditVol(String(d.volume_ml)); setEditH(String(d.horas)); }}
                          style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 11 }}>✏</button>
                        <button onClick={() => handleExcluir(d.id)}
                          style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 11 }}>✕</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AbaEvolucoes({ acompanhamentoId, evolucoes, usuarioId, paciente }: AbaEvolucoesProps) {
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

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "240px 1fr 240px",
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
                <div style={{ display: "flex", gap: 10 }}>
                  {modoEdicao ? (
                    <>
                      <button onClick={() => setModoEdicao(false)} className="nc-btn nc-btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }}>Cancelar</button>
                      <button onClick={handleSalvarEdicao} disabled={isPending} className="nc-btn nc-btn-primary" style={{ fontSize: 12, padding: "4px 12px" }}>
                        {isPending ? "Salvando..." : "Salvar"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setTextoEditor(evolucaoSelecionada.texto); setModoEdicao(true); }}
                        style={{ fontSize: 12, color: "var(--text2)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>Editar</button>
                      <button onClick={handleExcluir}
                        style={{ fontSize: 12, color: "var(--red)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>Excluir</button>
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

      {/* ── COLUNA DIREITA: TFG + exames + diurese ───────────────────── */}
      <div style={{ overflow: "hidden", background: "var(--card2)", borderLeft: "1px solid var(--border)" }}>
        <PainelDireito acompanhamentoId={acompanhamentoId} paciente={paciente} />
      </div>
    </div>
  );
}