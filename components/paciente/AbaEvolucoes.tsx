"use client";

import { useState, useTransition, useEffect, useCallback, useRef, useMemo } from "react";
import {
  adicionarEvolucao,
  editarEvolucao,
  excluirEvolucao,
} from "@/lib/actions/acompanhamentos";
import {
  registrarDiurese,
  editarDiurese,
  excluirDiurese,
  buscarDiureses,
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
  id: string;
  data: string;
  volume_ml: number;
  horas: number;
}

interface ExameEssencial {
  id: string;
  data: string;
  parametros: {
    creatinina?: number | null;
    sodio?: number | null;
    potassio?: number | null;
    ph?: number | null;
    bic?: number | null;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDtHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDataCurta(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit",
  });
}

function calcTFG(cr: number, idade: number, sexo: string): number | null {
  if (!cr || !idade) return null;
  const k = sexo === "F" ? 0.7 : 0.9;
  const a = sexo === "F" ? -0.241 : -0.302;
  const sf = sexo === "F" ? 1.012 : 1.0;
  const r = cr / k;
  return Math.round(142 * Math.pow(Math.min(r, 1), a) * Math.pow(Math.max(r, 1), -1.2) * Math.pow(0.9938, idade) * sf);
}

function corCr(v: number) { return v >= 3.0 ? "var(--red)" : v >= 1.4 ? "var(--amber)" : "var(--green)"; }
function corK(v: number) { return v >= 5.5 || v < 3.5 ? "var(--red)" : "var(--green)"; }
function corNa(v: number) { return v < 130 || v > 150 ? "var(--red)" : v < 135 || v > 145 ? "var(--amber)" : "var(--green)"; }
function corPH(v: number) { return v < 7.25 || v > 7.55 ? "var(--red)" : v < 7.35 || v > 7.45 ? "var(--amber)" : "var(--green)"; }
function corBic(v: number) { return v < 18 || v > 32 ? "var(--red)" : v < 22 || v > 28 ? "var(--amber)" : "var(--green)"; }
function corTFG(v: number) { return v < 15 ? "var(--red)" : v < 30 ? "#ea580c" : v < 60 ? "var(--amber)" : "var(--green)"; }
function corDiurese(mlH: number) {
  // ml por hora real
  const per24 = mlH * 24;
  return per24 < 100 ? "var(--red)" : per24 < 400 ? "var(--amber)" : "var(--green)";
}

// ─── Gráfico Canvas de creatinina ────────────────────────────────────────────

function MiniGraficoCr({ valores, cor }: { valores: number[]; cor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || valores.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    if (!rect.width) return;
    c.width = rect.width * dpr; c.height = 44 * dpr;
    const ctx = c.getContext("2d")!; ctx.scale(dpr, dpr);
    const W = rect.width, H = 44, P = 4;
    const mn = Math.min(...valores) * 0.85, mx = Math.max(...valores) * 1.15;
    const tx = (i: number) => P + (i / (valores.length - 1)) * (W - P * 2);
    const ty = (v: number) => H - P - ((v - mn) / (mx - mn)) * (H - P * 2);
    if (1.2 > mn && 1.2 < mx) {
      ctx.strokeStyle = "rgba(0,0,0,0.1)"; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(P, ty(1.2)); ctx.lineTo(W - P, ty(1.2)); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.beginPath(); ctx.moveTo(tx(0), ty(valores[0]));
    valores.forEach((v, i) => ctx.lineTo(tx(i), ty(v)));
    ctx.lineTo(tx(valores.length - 1), H); ctx.lineTo(tx(0), H); ctx.closePath();
    ctx.fillStyle = cor + "25"; ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx(0), ty(valores[0]));
    valores.forEach((v, i) => ctx.lineTo(tx(i), ty(v)));
    ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
    valores.forEach((v, i) => {
      ctx.beginPath(); ctx.arc(tx(i), ty(v), i === valores.length - 1 ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = i === valores.length - 1 ? cor : cor + "88"; ctx.fill();
    });
  }, [valores, cor]);
  return <canvas ref={canvasRef} style={{ width: "100%", height: 44, display: "block" }} />;
}

// ─── Gráfico Canvas de diurese ────────────────────────────────────────────────

function GraficoDiurese({ dados }: { dados: PontoDiurese[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || dados.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    if (!rect.width) return;
    c.width = rect.width * dpr; c.height = 70 * dpr;
    const ctx = c.getContext("2d")!; ctx.scale(dpr, dpr);
    const W = rect.width, H = 70, PT = 8, PB = 18, PL = 8, PR = 8;
    const innerH = H - PT - PB, innerW = W - PL - PR;
    const valores = dados.map(d => d.volume_ml);
    const mn = 0, mx = Math.max(...valores, 500);
    const tx = (i: number) => PL + (i / (dados.length - 1)) * innerW;
    const ty = (v: number) => PT + innerH - ((v - mn) / (mx - mn)) * innerH;

    // Linha anúria (100ml)
    if (mx >= 100) {
      ctx.strokeStyle = "rgba(176,48,32,0.25)"; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(PL, ty(100)); ctx.lineTo(W - PR, ty(100)); ctx.stroke();
    }
    // Linha oligúria (400ml)
    if (mx >= 400) {
      ctx.strokeStyle = "rgba(194,102,10,0.25)"; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(PL, ty(400)); ctx.lineTo(W - PR, ty(400)); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.setLineDash([]);

    // Área + linha
    const cor = "#1e4f88";
    ctx.beginPath(); ctx.moveTo(tx(0), ty(valores[0]));
    dados.forEach((d, i) => ctx.lineTo(tx(i), ty(d.volume_ml)));
    ctx.lineTo(tx(dados.length - 1), H - PB); ctx.lineTo(tx(0), H - PB); ctx.closePath();
    ctx.fillStyle = cor + "20"; ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx(0), ty(valores[0]));
    dados.forEach((d, i) => ctx.lineTo(tx(i), ty(d.volume_ml)));
    ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();

    // Pontos + datas
    dados.forEach((d, i) => {
      const isLast = i === dados.length - 1;
      ctx.beginPath(); ctx.arc(tx(i), ty(d.volume_ml), isLast ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? cor : cor + "88"; ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.font = `8px Inter,sans-serif`; ctx.textAlign = "center";
      ctx.fillText(fmtDataCurta(d.data), tx(i), H - 4);
    });
  }, [dados]);

  if (dados.length < 2) return null;
  return <canvas ref={canvasRef} style={{ width: "100%", height: 70, display: "block" }} />;
}

// ─── Painel direito de exames ────────────────────────────────────────────────

function PainelExames({ acompanhamentoId, paciente }: { acompanhamentoId: string; paciente: Paciente }) {
  const supabase = createClient();
  const [exames, setExames] = useState<ExameEssencial[]>([]);

  useEffect(() => {
    let ativo = true;
    supabase.from("exames").select("id, data, parametros")
      .eq("acompanhamento_id", acompanhamentoId)
      .order("data", { ascending: false }).limit(10)
      .then(({ data }) => { if (ativo) setExames((data || []) as ExameEssencial[]); });
    return () => { ativo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acompanhamentoId]);

  const idade = useMemo(() => {
    if (!paciente.data_nascimento) return 0;
    const nasc = new Date(paciente.data_nascimento);
    const hoje = new Date();
    let anos = hoje.getFullYear() - nasc.getFullYear();
    const passou = hoje.getMonth() > nasc.getMonth() ||
      (hoje.getMonth() === nasc.getMonth() && hoje.getDate() >= nasc.getDate());
    if (!passou) anos--;
    return anos;
  }, [paciente.data_nascimento]);

  const crSerie = exames.filter(e => e.parametros?.creatinina != null)
    .map(e => e.parametros.creatinina!).reverse();
  const ultimoCr = crSerie[crSerie.length - 1];
  const ultimoTFG = ultimoCr && paciente.sexo ? calcTFG(ultimoCr, idade, paciente.sexo) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--card2)", flexShrink: 0 }}>
        <span className="nc-label" style={{ margin: 0 }}>Exames essenciais</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
        {crSerie.length >= 2 && ultimoCr && (
          <div style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: "var(--nc-radius)", padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)" }}>Creatinina</span>
              <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--mono)", color: corCr(ultimoCr) }}>
                {ultimoCr} <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text3)" }}>mg/dL</span>
              </span>
            </div>
            <MiniGraficoCr valores={crSerie} cor={corCr(ultimoCr)} />
            {ultimoTFG && (
              <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, color: "var(--text3)" }}>TFG-e CKD-EPI 2021</span>
                <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "var(--mono)", color: corTFG(ultimoTFG) }}>
                  {ultimoTFG} <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text3)" }}>mL/min</span>
                </span>
              </div>
            )}
          </div>
        )}
        {exames.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 12, padding: "20px 0" }}>Nenhum exame</p>
        ) : (
          <>
            <span className="nc-label" style={{ display: "block", marginBottom: 6 }}>Histórico</span>
            {exames.slice(0, 8).map((e) => {
              const p = e.parametros;
              const cr = p?.creatinina;
              const tfg = cr && paciente.sexo ? calcTFG(cr, idade, paciente.sexo) : null;
              return (
                <div key={e.id} style={{ padding: "8px 10px", marginBottom: 6, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--nc-radius)", borderLeft: "3px solid var(--accent)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--mono)", marginBottom: 6 }}>
                    {fmtDataCurta(e.data)}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px" }}>
                    {cr != null && <ExVal label="Cr" value={cr} unit="mg/dL" cor={corCr(cr)} />}
                    {tfg != null && <ExVal label="TFG" value={tfg} unit="" cor={corTFG(tfg)} />}
                    {p?.sodio != null && <ExVal label="Na" value={p.sodio} unit="mEq/L" cor={corNa(p.sodio)} />}
                    {p?.potassio != null && <ExVal label="K" value={p.potassio} unit="mEq/L" cor={corK(p.potassio)} />}
                    {p?.ph != null && <ExVal label="pH" value={p.ph} unit="" cor={corPH(p.ph)} />}
                    {p?.bic != null && <ExVal label="Bic" value={p.bic} unit="mEq/L" cor={corBic(p.bic)} />}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function ExVal({ label, value, unit, cor }: { label: string; value: number; unit: string; cor?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
      <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 600, minWidth: 24 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "var(--mono)", color: cor || "var(--text)" }}>
        {typeof value === "number" ? (value % 1 !== 0 ? value.toFixed(value < 10 ? 2 : 1) : value) : value}
      </span>
      {unit && <span style={{ fontSize: 9, color: "var(--text3)" }}>{unit}</span>}
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

  // Diurese
  const [diureses, setDiureses] = useState<PontoDiurese[]>([]);
  const [volumeDiurese, setVolumeDiurese] = useState("");
  const [horasDiurese, setHorasDiurese] = useState("24");
  const [dataDiurese] = useState(() => new Date().toISOString().slice(0, 10));
  const [salvandoDiurese, setSalvandoDiurese] = useState(false);
  const [diureseErro, setDiureseErro] = useState<string | null>(null);
  const [editandoDiureseId, setEditandoDiureseId] = useState<string | null>(null);
  const [editVol, setEditVol] = useState("");
  const [editHoras, setEditHoras] = useState("24");
  const [mostrarTodosDiureses, setMostrarTodosDiureses] = useState(false);

  const carregarDiureses = useCallback(async () => {
    const r = await buscarDiureses(acompanhamentoId);
    if (r.sucesso) setDiureses(r.dados as PontoDiurese[]);
  }, [acompanhamentoId]);

  useEffect(() => {
    let ativo = true;
    buscarDiureses(acompanhamentoId).then(r => { if (ativo && r.sucesso) setDiureses(r.dados as PontoDiurese[]); });
    return () => { ativo = false; };
  }, [acompanhamentoId]);

  async function handleRegistrarDiurese() {
    const vol = parseInt(volumeDiurese, 10), hrs = parseInt(horasDiurese, 10);
    if (!volumeDiurese || isNaN(vol) || vol < 0) { setDiureseErro("Volume inválido."); return; }
    if (!horasDiurese || isNaN(hrs) || hrs <= 0 || hrs > 24) { setDiureseErro("Horas: 1–24."); return; }
    setDiureseErro(null); setSalvandoDiurese(true);
    const r = await registrarDiurese(acompanhamentoId, dataDiurese, vol, hrs);
    setSalvandoDiurese(false);
    if (r.sucesso) { setVolumeDiurese(""); setHorasDiurese("24"); carregarDiureses(); }
    else setDiureseErro(r.erro || "Erro.");
  }

  async function handleSalvarEdicaoDiurese() {
    if (!editandoDiureseId) return;
    const vol = parseInt(editVol, 10), hrs = parseInt(editHoras, 10);
    if (isNaN(vol) || isNaN(hrs)) return;
    setSalvandoDiurese(true);
    await editarDiurese(editandoDiureseId, vol, hrs);
    setSalvandoDiurese(false); setEditandoDiureseId(null);
    carregarDiureses();
  }

  async function handleExcluirDiurese(id: string) {
    if (!confirm("Excluir este registro?")) return;
    await excluirDiurese(id); carregarDiureses();
  }

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

  function handleExcluirEvolucao() {
    if (!evolucaoSelecionada || !confirm("Excluir esta evolução?")) return;
    startTransition(async () => {
      await excluirEvolucao(evolucaoSelecionada.id);
      setEvolucaoSelecionada(evolucoes.find(e => e.id !== evolucaoSelecionada.id) ?? null);
    });
  }

  const ehAutor = evolucaoSelecionada?.autor_id === usuarioId;
  const ultimaDiurese = diureses.length > 0 ? [...diureses].reverse()[0] : null;
  const diuresesToShow = mostrarTodosDiureses ? [...diureses].reverse() : [...diureses].reverse().slice(0, 4);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "260px 1fr 260px",
      height: "calc(100vh - 158px)",
      minHeight: 520,
      overflow: "hidden",
      background: "var(--bg)",
      borderRadius: "var(--nc-radius-lg)",
      border: "1px solid var(--border)",
      boxShadow: "var(--nc-shadow-sm)",
    }}>

      {/* ── COLUNA ESQUERDA ───────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", overflow: "hidden", background: "var(--card)" }}>

        {/* Header da lista */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--card2)", flexShrink: 0 }}>
          <span className="nc-label" style={{ margin: 0 }}>Evoluções</span>
        </div>

        {/* Lista de evoluções */}
        <div style={{ flex: 1, overflowY: "auto" }}>

          {/* Botão + Nova evolução como primeiro item */}
          <div
            onClick={handleNovaEvolucao}
            style={{
              padding: "10px 14px", borderBottom: "1px solid var(--border)",
              borderLeft: novaEvolucao ? "3px solid var(--green)" : "3px solid transparent",
              background: novaEvolucao ? "var(--green-dim)" : "transparent",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              transition: "background 0.1s",
            }}
            onMouseEnter={e => { if (!novaEvolucao) (e.currentTarget as HTMLElement).style.background = "var(--bg2)"; }}
            onMouseLeave={e => { if (!novaEvolucao) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: novaEvolucao ? "var(--green)" : "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: novaEvolucao ? "white" : "var(--accent)", flexShrink: 0 }}>+</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: novaEvolucao ? "var(--green)" : "var(--accent)" }}>
              {novaEvolucao ? "Escrevendo..." : "Nova evolução"}
            </span>
          </div>

          {evolucoes.length === 0 && !novaEvolucao && (
            <div style={{ padding: "24px 14px", textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
              Nenhuma evolução registrada
            </div>
          )}

          {evolucoes.map((ev) => {
            const isActive = !novaEvolucao && evolucaoSelecionada?.id === ev.id;
            return (
              <div key={ev.id}
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
          })}
        </div>

        {/* ── DIURESE — seção destacada ── */}
        <div style={{ borderTop: "2px solid var(--accent)", flexShrink: 0, background: "var(--card)" }}>
          {/* Header diurese com último valor em destaque */}
          <div style={{ padding: "10px 14px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span className="nc-label" style={{ margin: 0 }}>Diurese</span>
              {ultimaDiurese && (
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 2 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, fontFamily: "var(--mono)", color: corDiurese(ultimaDiurese.volume_ml / ultimaDiurese.horas) }}>
                    {ultimaDiurese.volume_ml}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>ml/{ultimaDiurese.horas}h</span>
                  <span style={{ fontSize: 10, color: "var(--text3)" }}>
                    ({fmtDataCurta(ultimaDiurese.data)})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Gráfico de evolução da diurese */}
          {diureses.length >= 2 && (
            <div style={{ padding: "0 10px 6px" }}>
              <GraficoDiurese dados={[...diureses]} />
            </div>
          )}

          {/* Formulário de registro rápido */}
          <div style={{ padding: "6px 10px 8px", display: "flex", gap: 4, alignItems: "flex-end", borderTop: "1px solid var(--border)" }}>
            <div style={{ flex: 1 }}>
              <label className="nc-label" style={{ marginBottom: 2, fontSize: 9 }}>Volume (ml)</label>
              <input type="number" min="0" step="10"
                value={volumeDiurese} onChange={e => setVolumeDiurese(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRegistrarDiurese()}
                placeholder="Ex: 800"
                className="nc-input" style={{ padding: "5px 8px", fontSize: 13 }} />
            </div>
            <div style={{ width: 52 }}>
              <label className="nc-label" style={{ marginBottom: 2, fontSize: 9 }}>Horas</label>
              <input type="number" min="1" max="24"
                value={horasDiurese} onChange={e => setHorasDiurese(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRegistrarDiurese()}
                className="nc-input" style={{ padding: "5px 6px", fontSize: 13 }} />
            </div>
            <button onClick={handleRegistrarDiurese} disabled={salvandoDiurese || !volumeDiurese}
              style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--nc-radius)", padding: "7px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: salvandoDiurese || !volumeDiurese ? 0.5 : 1, fontFamily: "var(--font)", flexShrink: 0 }}>
              {salvandoDiurese ? "…" : "✓"}
            </button>
          </div>

          {diureseErro && <p style={{ color: "var(--red)", fontSize: 10, padding: "0 10px 4px", margin: 0 }}>{diureseErro}</p>}

          {/* Histórico de registros */}
          {diureses.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border)", maxHeight: 140, overflowY: "auto" }}>
              {diuresesToShow.map(d => {
                const emEdicao = editandoDiureseId === d.id;
                return (
                  <div key={d.id} style={{ padding: "5px 10px", display: "flex", alignItems: "center", gap: 4, borderBottom: "1px solid var(--border)" }}>
                    {emEdicao ? (
                      <>
                        <input type="number" value={editVol} onChange={e => setEditVol(e.target.value)}
                          className="nc-input" style={{ width: 60, padding: "3px 6px", fontSize: 12 }} />
                        <span style={{ fontSize: 10, color: "var(--text3)" }}>ml/</span>
                        <input type="number" value={editHoras} onChange={e => setEditHoras(e.target.value)}
                          className="nc-input" style={{ width: 40, padding: "3px 6px", fontSize: 12 }} />
                        <span style={{ fontSize: 10, color: "var(--text3)" }}>h</span>
                        <button onClick={handleSalvarEdicaoDiurese} style={{ marginLeft: "auto", background: "var(--accent)", color: "white", border: "none", borderRadius: 4, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontFamily: "var(--font)" }}>✓</button>
                        <button onClick={() => setEditandoDiureseId(null)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 12 }}>✕</button>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 10, color: "var(--text3)", minWidth: 38 }}>{fmtDataCurta(d.data)}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: corDiurese(d.volume_ml / d.horas), fontFamily: "var(--mono)" }}>{d.volume_ml}</span>
                        <span style={{ fontSize: 10, color: "var(--text3)" }}>ml/{d.horas}h</span>
                        <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                          <button onClick={() => { setEditandoDiureseId(d.id); setEditVol(String(d.volume_ml)); setEditHoras(String(d.horas)); }}
                            style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 11, padding: "0 3px" }}>✏</button>
                          <button onClick={() => handleExcluirDiurese(d.id)}
                            style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 11, padding: "0 3px" }}>✕</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {diureses.length > 4 && (
                <button onClick={() => setMostrarTodosDiureses(v => !v)}
                  style={{ width: "100%", padding: "5px", fontSize: 11, color: "var(--text3)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>
                  {mostrarTodosDiureses ? "Mostrar menos ▴" : `Ver todos (${diureses.length}) ▾`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── COLUNA CENTRAL: editor ────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--card)", borderRight: "1px solid var(--border)" }}>
        {novaEvolucao ? (
          <>
            <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--card2)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>✏ Nova evolução</span>
              <button onClick={() => { if (evolucoes.length > 0) setTextoNova(evolucoes[0].texto); }}
                disabled={evolucoes.length === 0}
                style={{ fontSize: 11, color: "var(--text3)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>
                Copiar anterior
              </button>
            </div>
            <div style={{ flex: 1, padding: "16px 20px 0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <textarea autoFocus value={textoNova} onChange={e => setTextoNova(e.target.value)}
                placeholder="Evolução clínica do dia..."
                style={{ flex: 1, resize: "none", border: "none", outline: "none", fontSize: 14, lineHeight: 1.8, color: "var(--text)", background: "transparent", fontFamily: "var(--font)", width: "100%" }} />
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
                <div style={{ display: "flex", gap: 8 }}>
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
                      <button onClick={handleExcluirEvolucao}
                        style={{ fontSize: 12, color: "var(--red)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>Excluir</button>
                    </>
                  )}
                </div>
              )}
            </div>
            <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>
              {modoEdicao ? (
                <textarea autoFocus value={textoEditor} onChange={e => setTextoEditor(e.target.value)}
                  style={{ width: "100%", height: "100%", resize: "none", border: "none", outline: "none", fontSize: 14, lineHeight: 1.8, color: "var(--text)", background: "transparent", fontFamily: "var(--font)" }} />
              ) : (
                <p style={{ fontSize: 14, lineHeight: 1.85, color: "var(--text)", whiteSpace: "pre-wrap", margin: 0 }}>
                  {evolucaoSelecionada.texto}
                </p>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text3)", gap: 12 }}>
            <div style={{ fontSize: 36 }}>📝</div>
            <div style={{ fontSize: 14, color: "var(--text2)", fontWeight: 600 }}>Selecione ou crie uma evolução</div>
            <button onClick={handleNovaEvolucao} className="nc-btn nc-btn-primary">+ Nova evolução</button>
          </div>
        )}
      </div>

      {/* ── COLUNA DIREITA: exames ────────────────────────────────────── */}
      <div style={{ overflow: "hidden", background: "var(--card)" }}>
        <PainelExames acompanhamentoId={acompanhamentoId} paciente={paciente} />
      </div>
    </div>
  );
}