"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { registrarDiurese, editarDiurese, excluirDiurese, buscarDiureses } from "@/lib/actions/pacientesExtra";
import { createClient } from "@/lib/supabase/client";
import type { Paciente, AcompanhamentoNefro } from "@/types/database";

interface PontoDiurese { id: string; data: string; volume_ml: number; horas: number; }
interface ExameRow {
  id: string; data: string;
  parametros: Record<string, number | null>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDataCurta(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function calcTFG(cr: number, idade: number, sexo: "F" | "M"): number {
  const k = sexo === "F" ? 0.7 : 0.9;
  const a = sexo === "F" ? -0.241 : -0.302;
  const sf = sexo === "F" ? 1.012 : 1.0;
  const r = cr / k;
  return Math.round(
    142 * Math.pow(Math.min(r, 1), a) * Math.pow(Math.max(r, 1), -1.2) * Math.pow(0.9938, idade) * sf
  );
}

function estagioTFG(tfg: number): { label: string; cor: string; bg: string } {
  if (tfg >= 90) return { label: "G1 ≥90",    cor: "#059669", bg: "#ecfdf5" };
  if (tfg >= 60) return { label: "G2 60–89",  cor: "#16a34a", bg: "#f0fdf4" };
  if (tfg >= 45) return { label: "G3a 45–59", cor: "#ca8a04", bg: "#fefce8" };
  if (tfg >= 30) return { label: "G3b 30–44", cor: "#d97706", bg: "#fffbeb" };
  if (tfg >= 15) return { label: "G4 15–29",  cor: "#ea580c", bg: "#fff7ed" };
  return           { label: "G5 <15",     cor: "#dc2626", bg: "#fef2f2" };
}

function kdigoIRA(crAtual: number, crBasal: number): { estagio: number; cor: string } | null {
  if (crBasal <= 0) return null;
  const ratio = crAtual / crBasal;
  if (ratio >= 3.0 || crAtual >= 4.0) return { estagio: 3, cor: "#dc2626" };
  if (ratio >= 2.0)                   return { estagio: 2, cor: "#ea580c" };
  if (ratio >= 1.5 || (crAtual - crBasal) >= 0.3) return { estagio: 1, cor: "#d97706" };
  return null; // sem critério — não exibe
}

function corCr(v: number) { return v >= 3.0 ? "#dc2626" : v >= 1.4 ? "#d97706" : "#059669"; }
function corK(v: number)  { return v >= 5.5 || v < 3.5 ? "#dc2626" : "#059669"; }
function corUr(v: number) { return v > 100 ? "#dc2626" : v > 50 ? "#d97706" : "#059669"; }

// ─── Gráfico de diurese ───────────────────────────────────────────────────────

function GraficoDiurese({ dados }: { dados: PontoDiurese[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || dados.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    if (!rect.width) return;
    c.width = rect.width * dpr; c.height = 64 * dpr;
    const ctx = c.getContext("2d")!; ctx.scale(dpr, dpr);
    const W = rect.width, H = 64, PT = 8, PB = 18, PL = 6, PR = 6;
    const iW = W - PL - PR, iH = H - PT - PB;
    const vals = dados.map(d => d.volume_ml);
    const mx = Math.max(...vals, 500);
    const tx = (i: number) => PL + (i / (dados.length - 1)) * iW;
    const ty = (v: number) => PT + iH - (v / mx) * iH;

    // Linha oligúria 400ml
    if (mx >= 400) {
      ctx.strokeStyle = "rgba(194,102,10,0.35)"; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(PL, ty(400)); ctx.lineTo(W - PR, ty(400)); ctx.stroke();
      ctx.fillStyle = "rgba(194,102,10,0.5)"; ctx.font = "7px Inter"; ctx.textAlign = "left";
      ctx.fillText("oligúria", PL + 2, ty(400) - 2);
      ctx.setLineDash([]);
    }

    const cor = "#1e4f88";
    ctx.beginPath(); ctx.moveTo(tx(0), ty(vals[0]));
    dados.forEach((d, i) => ctx.lineTo(tx(i), ty(d.volume_ml)));
    ctx.lineTo(tx(dados.length - 1), H - PB); ctx.lineTo(tx(0), H - PB); ctx.closePath();
    ctx.fillStyle = cor + "18"; ctx.fill();

    ctx.beginPath(); ctx.moveTo(tx(0), ty(vals[0]));
    dados.forEach((d, i) => ctx.lineTo(tx(i), ty(d.volume_ml)));
    ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();

    dados.forEach((d, i) => {
      const isLast = i === dados.length - 1;
      ctx.beginPath(); ctx.arc(tx(i), ty(d.volume_ml), isLast ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? cor : cor + "88"; ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.font = "8px Inter"; ctx.textAlign = "center";
      ctx.fillText(fmtDataCurta(d.data), tx(i), H - 3);
    });
  }, [dados]);

  if (dados.length < 2) return null;
  return <canvas ref={canvasRef} style={{ width: "100%", height: 64, display: "block", marginTop: 6 }} />;
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface PainelDireitoProps {
  acompanhamentoId: string;
  paciente: Paciente;
  acompanhamento: AcompanhamentoNefro;
}

export function PainelDireito({ acompanhamentoId, paciente, acompanhamento }: PainelDireitoProps) {
  const supabase = useMemo(() => createClient(), []);
  const [exames, setExames] = useState<ExameRow[]>([]);
  const [diureses, setDiureses] = useState<PontoDiurese[]>([]);
  const [volume, setVolume] = useState("");
  const [horas, setHoras] = useState("24");
  const [dataDiurese, setDataDiurese] = useState(() => new Date().toISOString().slice(0, 10));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editVol, setEditVol] = useState("");
  const [editH, setEditH] = useState("24");
  const [editData, setEditData] = useState("");

  // ml/hora em tempo real
  const mlPorHora = useMemo(() => {
    const v = parseInt(volume, 10), h = parseInt(horas, 10);
    if (!isNaN(v) && !isNaN(h) && h > 0 && v > 0) return Math.round(v / h);
    return null;
  }, [volume, horas]);

  // Idade calculada corretamente
  const idade = useMemo(() => {
    if (!paciente.data_nascimento) return 0;
    const nasc = new Date(paciente.data_nascimento);
    const hoje = new Date();
    let a = hoje.getFullYear() - nasc.getFullYear();
    if (hoje.getMonth() < nasc.getMonth() ||
      (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) a--;
    return Math.max(a, 0);
  }, [paciente.data_nascimento]);

  const carregarDiureses = useCallback(async () => {
    const r = await buscarDiureses(acompanhamentoId);
    if (r.sucesso) setDiureses(r.dados as PontoDiurese[]);
  }, [acompanhamentoId]);

  const sexo: "F" | "M" = paciente.sexo === "F" ? "F" : "M";

  useEffect(() => {
    let ativo = true;
    supabase
      .from("exames")
      .select("id, data, parametros")
      .eq("acompanhamento_id", acompanhamentoId)
      .order("data", { ascending: false })
      .limit(8)
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) return;
        setExames((data || []) as ExameRow[]);
      });
    buscarDiureses(acompanhamentoId).then(r => {
      if (ativo && r.sucesso) setDiureses(r.dados as PontoDiurese[]);
    });
    return () => { ativo = false; };
  }, [acompanhamentoId, supabase, idade, sexo]);

  // Calcular TFG e KDIGO
  const ultimo = exames[0];
  const cr = (ultimo?.parametros?.creatinina != null) ? Number(ultimo.parametros.creatinina) : null;
  const ur = (ultimo?.parametros?.ureia != null) ? Number(ultimo.parametros.ureia) : null;
  const k  = (ultimo?.parametros?.potassio != null) ? Number(ultimo.parametros.potassio) : null;

  const tfg = (cr !== null && cr > 0 && idade > 0) ? calcTFG(cr, idade, sexo) : null;
  const est = tfg !== null ? estagioTFG(tfg) : null;

  const isDRC = acompanhamento.diagnostico_principal === "DRC_D";
  const isIRA = acompanhamento.diagnostico_principal === "IRA" ||
    acompanhamento.diagnostico_principal === "IRA_sobre_DRC";
  const crBasal = paciente.creatinina_basal ? Number(paciente.creatinina_basal) : null;
  const kdigo = (!isDRC && crBasal && cr !== null) ? kdigoIRA(cr, crBasal) : null;

  async function handleRegistrar() {
    const vol = parseInt(volume, 10), hrs = parseInt(horas, 10);
    if (!volume || isNaN(vol) || vol < 0) { setErro("Volume inválido."); return; }
    if (!horas || isNaN(hrs) || hrs <= 0 || hrs > 24) { setErro("Horas: 1–24."); return; }
    setErro(null); setSalvando(true);
    const r = await registrarDiurese(acompanhamentoId, dataDiurese, vol, hrs);
    setSalvando(false);
    if (r.sucesso) { setVolume(""); carregarDiureses(); }
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

  const ultimaDiurese = diureses.length > 0 ? [...diureses].reverse()[0] : null;

  // Estilos compartilhados
  const inputStyle: React.CSSProperties = {
    padding: "5px 7px", fontSize: 12, fontFamily: "var(--font)",
    border: "1.5px solid var(--border2)", borderRadius: "var(--nc-radius)",
    background: "var(--card)", color: "var(--text)", outline: "none", width: "100%",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── DIURESE — topo, destaque azul ──────────────────────────── */}
      <div style={{
        flexShrink: 0,
        background: "var(--accent-dim)",
        borderBottom: "2px solid var(--border2)",
        padding: "10px 12px",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--accent)" }}>
            💧 Diurese
          </span>
          {ultimaDiurese && (
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 16, fontWeight: 900, fontFamily: "var(--mono)", color: "var(--accent)" }}>
                {ultimaDiurese.volume_ml}
              </span>
              <span style={{ fontSize: 10, color: "var(--text3)", marginLeft: 3 }}>
                ml/{ultimaDiurese.horas}h · {Math.round(ultimaDiurese.volume_ml / ultimaDiurese.horas)}ml/h
              </span>
            </div>
          )}
        </div>

        {/* Gráfico */}
        <GraficoDiurese dados={diureses} />

        {/* Formulário — data editável */}
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 9, color: "var(--accent)", fontWeight: 700, margin: "0 0 3px" }}>Data</p>
              <input type="date" value={dataDiurese}
                onChange={e => setDataDiurese(e.target.value)}
                style={{ ...inputStyle }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 9, color: "var(--accent)", fontWeight: 700, margin: "0 0 3px" }}>Volume (ml)</p>
              <input type="number" min="0" step="10" value={volume}
                onChange={e => setVolume(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRegistrar()}
                placeholder="Ex: 800"
                style={{ ...inputStyle, fontSize: 14 }}
              />
            </div>
            <div style={{ width: 64 }}>
              <p style={{ fontSize: 9, color: "var(--accent)", fontWeight: 700, margin: "0 0 3px" }}>Horas</p>
              <input type="number" min="1" max="24" value={horas}
                onChange={e => setHoras(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRegistrar()}
                style={{ ...inputStyle, fontSize: 14 }}
              />
            </div>
            <button onClick={handleRegistrar} disabled={salvando || !volume}
              style={{ padding: "8px 12px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--nc-radius)", fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: salvando || !volume ? 0.5 : 1, fontFamily: "var(--font)", flexShrink: 0 }}>
              ✓
            </button>
          </div>
        </div>

        {/* ml/hora em tempo real */}
        {mlPorHora !== null && (
          <p style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, margin: "3px 0 0", fontFamily: "var(--mono)" }}>
            → {mlPorHora} ml/h
          </p>
        )}
        {erro && <p style={{ fontSize: 10, color: "var(--red)", margin: "3px 0 0" }}>{erro}</p>}

        {/* Histórico */}
        {diureses.length > 0 && (
          <div style={{ marginTop: 6, borderTop: "1px solid var(--border2)" }}>
            {[...diureses].reverse().slice(0, 5).map(d => {
              const emEdicao = editandoId === d.id;
              return (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 0", borderBottom: "1px solid rgba(0,0,0,0.04)", fontSize: 11 }}>
                  {emEdicao ? (
                    <>
                      <input type="date" value={editData} onChange={e => setEditData(e.target.value)}
                        style={{ ...inputStyle, width: 110, fontSize: 10 }} />
                      <input type="number" value={editVol} onChange={e => setEditVol(e.target.value)}
                        style={{ ...inputStyle, width: 48, fontSize: 11 }} />
                      <span style={{ color: "var(--text3)", fontSize: 9 }}>ml/</span>
                      <input type="number" value={editH} onChange={e => setEditH(e.target.value)}
                        style={{ ...inputStyle, width: 32, fontSize: 11 }} />
                      <span style={{ color: "var(--text3)", fontSize: 9 }}>h</span>
                      <button onClick={handleSalvarEdicao} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>✓</button>
                      <button onClick={() => setEditandoId(null)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 11 }}>✕</button>
                    </>
                  ) : (
                    <>
                      <span style={{ color: "var(--text3)", minWidth: 32, fontSize: 10 }}>{fmtDataCurta(d.data)}</span>
                      <span style={{ fontWeight: 700, color: "var(--accent)", fontFamily: "var(--mono)" }}>{d.volume_ml}</span>
                      <span style={{ color: "var(--text3)", fontSize: 10 }}>ml/{d.horas}h</span>
                      <span style={{ color: "var(--text3)", fontSize: 9 }}>({Math.round(d.volume_ml / d.horas)}ml/h)</span>
                      <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                        <button onClick={() => { setEditandoId(d.id); setEditVol(String(d.volume_ml)); setEditH(String(d.horas)); setEditData(d.data); }}
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

      {/* ── TFG + KDIGO + EXAMES ───────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>

        {/* TFG — destaque, sem classificação DRC para IRA */}
        <div style={{
          borderRadius: "var(--nc-radius-lg)", padding: "12px 14px", marginBottom: 8,
          background: est && !isIRA ? est.bg : "var(--card2)",
          border: `1.5px solid ${est && !isIRA ? est.cor + "40" : "var(--border)"}`,
          textAlign: "center",
        }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: est ? est.cor : "var(--text3)", margin: "0 0 4px" }}>
            TFG-e · CKD-EPI 2021
          </p>
          <p style={{ fontSize: 32, fontWeight: 900, fontFamily: "var(--mono)", color: est ? est.cor : "var(--text3)", lineHeight: 1, margin: 0 }}>
            {tfg !== null ? tfg : "—"}
            {tfg !== null && <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text3)", marginLeft: 4 }}>mL/min</span>}
          </p>
          {/* Só mostra classificação DRC se NÃO for IRA */}
          {est && !isIRA && (
            <p style={{ fontSize: 12, fontWeight: 700, color: est.cor, margin: "4px 0 0" }}>
              DRC {est.label}
            </p>
          )}
          {tfg === null && (
            <p style={{ fontSize: 10, color: "var(--text3)", margin: "4px 0 0" }}>
              {idade === 0 ? "Cadastre a data de nascimento" : cr === null ? "Registre exame com creatinina" : "—"}
            </p>
          )}
        </div>

        {/* KDIGO IRA — destaque */}
        {kdigo !== null && cr !== null && (
          <div style={{
            borderRadius: "var(--nc-radius-lg)", padding: "10px 14px", marginBottom: 8,
            background: kdigo.cor + "12", border: `1.5px solid ${kdigo.cor}40`,
            textAlign: "center",
          }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: kdigo.cor, margin: "0 0 4px" }}>
              KDIGO IRA · basal {crBasal} mg/dL
            </p>
            <p style={{ fontSize: 24, fontWeight: 900, color: kdigo.cor, lineHeight: 1, margin: 0 }}>
              IRA KDIGO {kdigo.estagio}
            </p>
            <p style={{ fontSize: 10, color: "var(--text3)", margin: "4px 0 0", fontFamily: "var(--mono)" }}>
              {cr} / {crBasal} = {(cr / crBasal!).toFixed(1)}× basal
            </p>
          </div>
        )}

        {/* Exames essenciais */}
        <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", margin: "0 0 6px" }}>
          Último exame {ultimo ? `· ${fmtDataCurta(ultimo.data)}` : ""}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {[
            { label: "Creatinina", valor: cr, unidade: "mg/dL", cor: cr !== null ? corCr(cr) : undefined },
            { label: "Ureia",      valor: ur, unidade: "mg/dL", cor: ur !== null ? corUr(ur) : undefined },
            { label: "Potássio",   valor: k,  unidade: "mEq/L", cor: k  !== null ? corK(k)  : undefined },
          ].map(({ label, valor, unidade, cor }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", borderRadius: "var(--nc-radius)", background: "var(--card2)", border: "1px solid var(--border)" }}>
              <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "var(--mono)", color: cor || "var(--text3)" }}>
                {valor !== null ? valor : "—"}
                {valor !== null && <span style={{ fontSize: 9, fontWeight: 400, color: "var(--text3)", marginLeft: 2 }}>{unidade}</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Histórico Cr */}
        {exames.length > 1 && (
          <>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", margin: "0 0 4px" }}>
              Histórico Cr
            </p>
            {exames.slice(1, 5).map(e => {
              const eCr = e.parametros?.creatinina != null ? Number(e.parametros.creatinina) : null;
              if (eCr === null) return null;
              return (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 8px", borderRadius: 4, marginBottom: 2, background: "var(--bg2)" }}>
                  <span style={{ fontSize: 10, color: "var(--text3)" }}>{fmtDataCurta(e.data)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--mono)", color: corCr(eCr) }}>{eCr}</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}