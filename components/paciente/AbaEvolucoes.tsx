"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
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
import type { Evolucao, Medico } from "@/types/database";

interface AbaEvolucoesProps {
  acompanhamentoId: string;
  evolucoes: (Evolucao & { autor: Medico })[];
  usuarioId: string;
}

interface PontoDiurese {
  id: string;
  data: string;
  volume_ml: number;
  horas: 6 | 12 | 24;
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatarDataCurta(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit",
  });
}

// Normaliza diurese para ml/24h para padronizar o gráfico
function normalizar24h(volume: number, horas: number): number {
  return Math.round((volume / horas) * 24);
}

// ─── Gráfico SVG de diurese ─────────────────────────────────────────────────

function GraficoDiurese({ dados }: { dados: PontoDiurese[] }) {
  const dadosNorm = dados.map((d) => ({
    ...d,
    vol24h: normalizar24h(d.volume_ml, d.horas),
  }));

  if (dadosNorm.length === 0) {
    return (
      <p className="py-4 text-center text-xs" style={{ color: "var(--text3)" }}>
        Nenhum registro ainda — adicione o primeiro valor acima.
      </p>
    );
  }

  const W = 520, H = 150;
  const PAD = { top: 18, right: 16, bottom: 36, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxVol = Math.max(...dadosNorm.map((d) => d.vol24h), 600);

  function xPos(i: number) {
    return PAD.left + (dadosNorm.length === 1 ? innerW / 2 : (i / (dadosNorm.length - 1)) * innerW);
  }
  function yPos(vol: number) {
    return PAD.top + innerH - (vol / maxVol) * innerH;
  }

  const pontos = dadosNorm.map((d, i) => `${xPos(i)},${yPos(d.vol24h)}`).join(" ");
  const area = [
    `${xPos(0)},${PAD.top + innerH}`,
    ...dadosNorm.map((d, i) => `${xPos(i)},${yPos(d.vol24h)}`),
    `${xPos(dadosNorm.length - 1)},${PAD.top + innerH}`,
  ].join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <polygon points={area} fill="var(--accent)" opacity={0.08} />

      {/* Linha de oligúria 400ml/24h */}
      {maxVol >= 400 && (
        <>
          <line x1={PAD.left} y1={yPos(400)} x2={W - PAD.right} y2={yPos(400)}
            stroke="var(--amber)" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
          <text x={PAD.left + 3} y={yPos(400) - 3} fontSize={9} fill="var(--amber)">oligúria (400)</text>
        </>
      )}
      {/* Linha anúria 100ml/24h */}
      {maxVol >= 100 && (
        <>
          <line x1={PAD.left} y1={yPos(100)} x2={W - PAD.right} y2={yPos(100)}
            stroke="var(--red)" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
          <text x={PAD.left + 3} y={yPos(100) - 3} fontSize={9} fill="var(--red)">anúria (100)</text>
        </>
      )}
      {/* Poliúria */}
      {maxVol >= 2000 && (
        <>
          <line x1={PAD.left} y1={yPos(2500)} x2={W - PAD.right} y2={yPos(2500)}
            stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 3" opacity={0.35} />
          <text x={PAD.left + 3} y={yPos(2500) - 3} fontSize={9} fill="var(--accent)">poliúria (2500)</text>
        </>
      )}

      {/* Labels eixo Y */}
      {[0, Math.round(maxVol / 2), maxVol].map((v) => (
        <text key={v} x={PAD.left - 4} y={yPos(v) + 3} fontSize={9}
          textAnchor="end" fill="var(--text3)">
          {v >= 1000 ? `${(v / 1000).toFixed(1)}L` : `${v}`}
        </text>
      ))}

      <polyline points={pontos} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" />

      {dadosNorm.map((d, i) => (
        <g key={i}>
          <circle cx={xPos(i)} cy={yPos(d.vol24h)} r={4}
            fill="var(--card)" stroke="var(--accent)" strokeWidth={2} />
          <text x={xPos(i)} y={PAD.top + innerH + 14} fontSize={9}
            textAnchor="middle" fill="var(--text3)">{formatarDataCurta(d.data)}</text>
          <text x={xPos(i)} y={yPos(d.vol24h) - 8} fontSize={9}
            textAnchor="middle" fill="var(--accent)" fontWeight="700">
            {d.vol24h >= 1000 ? `${(d.vol24h / 1000).toFixed(1)}L` : `${d.vol24h}`}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function AbaEvolucoes({ acompanhamentoId, evolucoes, usuarioId }: AbaEvolucoesProps) {
  const [isPending, startTransition] = useTransition();

  // Evolução
  const [texto, setTexto] = useState("");
  const [editandoEvolucaoId, setEditandoEvolucaoId] = useState<string | null>(null);
  const [textoEdicao, setTextoEdicao] = useState("");

  // Diurese
  const [diureses, setDiureses] = useState<PontoDiurese[]>([]);
  const [carregandoDiurese, setCarregandoDiurese] = useState(true);
  const [volumeDiurese, setVolumeDiurese] = useState("");
  const [horasDiurese, setHorasDiurese] = useState<6 | 12 | 24>(24);
  const [dataDiurese, setDataDiurese] = useState(() => new Date().toISOString().slice(0, 10));
  const [salvandoDiurese, setSalvandoDiurese] = useState(false);
  const [diureseErro, setDiureseErro] = useState<string | null>(null);

  // Edição de diurese
  const [editandoDiureseId, setEditandoDiureseId] = useState<string | null>(null);
  const [editVol, setEditVol] = useState("");
  const [editHoras, setEditHoras] = useState<6 | 12 | 24>(24);

  const carregarDiureses = useCallback(async () => {
    setCarregandoDiurese(true);
    const resultado = await buscarDiureses(acompanhamentoId);
    if (resultado.sucesso) setDiureses(resultado.dados as PontoDiurese[]);
    setCarregandoDiurese(false);
  }, [acompanhamentoId]);

  useEffect(() => { carregarDiureses(); }, [carregarDiureses]);

  async function handleRegistrarDiurese() {
    const vol = parseInt(volumeDiurese, 10);
    if (!volumeDiurese || isNaN(vol) || vol < 0) {
      setDiureseErro("Informe um volume válido (ml).");
      return;
    }
    setDiureseErro(null);
    setSalvandoDiurese(true);
    const resultado = await registrarDiurese(acompanhamentoId, dataDiurese, vol, horasDiurese);
    setSalvandoDiurese(false);
    if (resultado.sucesso) {
      setVolumeDiurese("");
      carregarDiureses();
    } else {
      setDiureseErro(resultado.erro || "Erro ao registrar.");
    }
  }

  function iniciarEdicaoDiurese(d: PontoDiurese) {
    setEditandoDiureseId(d.id);
    setEditVol(String(d.volume_ml));
    setEditHoras(d.horas);
  }

  async function handleSalvarEdicaoDiurese() {
    if (!editandoDiureseId) return;
    const vol = parseInt(editVol, 10);
    if (isNaN(vol) || vol < 0) return;
    setSalvandoDiurese(true);
    const resultado = await editarDiurese(editandoDiureseId, vol, editHoras);
    setSalvandoDiurese(false);
    if (resultado.sucesso) {
      setEditandoDiureseId(null);
      carregarDiureses();
    }
  }

  async function handleExcluirDiurese(id: string) {
    if (!confirm("Excluir este registro de diurese?")) return;
    await excluirDiurese(id);
    carregarDiureses();
  }

  // Evolução handlers
  function handleCopiarAnterior() {
    if (evolucoes.length === 0) return;
    setTexto(evolucoes[0].texto);
  }

  function handleAdicionar() {
    if (!texto.trim()) return;
    startTransition(async () => {
      await adicionarEvolucao(acompanhamentoId, texto);
      setTexto("");
    });
  }

  function iniciarEdicaoEvolucao(ev: Evolucao) {
    setEditandoEvolucaoId(ev.id);
    setTextoEdicao(ev.texto);
  }

  function handleSalvarEdicaoEvolucao() {
    if (!editandoEvolucaoId) return;
    startTransition(async () => {
      await editarEvolucao(editandoEvolucaoId, textoEdicao);
      setEditandoEvolucaoId(null);
    });
  }

  function handleExcluirEvolucao(evolucaoId: string) {
    if (!confirm("Excluir esta evolução? Esta ação não pode ser desfeita.")) return;
    startTransition(async () => { await excluirEvolucao(evolucaoId); });
  }

  const horasOpcoes: { value: 6 | 12 | 24; label: string }[] = [
    { value: 6, label: "6h" },
    { value: 12, label: "12h" },
    { value: 24, label: "24h" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Diurese ─────────────────────────────────────────────────── */}
      <div className="nc-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>Diurese</h3>
          <span className="text-xs" style={{ color: "var(--text3)" }}>
            Gráfico normalizado em ml/24h
          </span>
        </div>

        {/* Formulário de registro */}
        <div className="flex flex-wrap items-end gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex flex-col gap-1">
            <label className="nc-label" style={{ marginBottom: 0 }}>Data</label>
            <input type="date" value={dataDiurese}
              onChange={(e) => setDataDiurese(e.target.value)}
              className="nc-input" style={{ width: 148 }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="nc-label" style={{ marginBottom: 0 }}>Volume (ml)</label>
            <input type="number" min="0" step="10"
              value={volumeDiurese}
              onChange={(e) => setVolumeDiurese(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRegistrarDiurese()}
              placeholder="Ex: 400"
              className="nc-input" style={{ width: 110 }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="nc-label" style={{ marginBottom: 0 }}>Período</label>
            <div className="flex gap-1">
              {horasOpcoes.map((op) => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setHorasDiurese(op.value)}
                  className="cursor-pointer rounded-(--nc-radius) px-3 py-2 text-xs font-bold transition"
                  style={{
                    background: horasDiurese === op.value ? "var(--accent)" : "var(--card2)",
                    color: horasDiurese === op.value ? "white" : "var(--text2)",
                    border: `1px solid ${horasDiurese === op.value ? "var(--accent)" : "var(--border)"}`,
                  }}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleRegistrarDiurese}
            disabled={salvandoDiurese || !volumeDiurese}
            className="nc-btn nc-btn-primary cursor-pointer shrink-0"
          >
            {salvandoDiurese ? "Salvando..." : "Registrar"}
          </button>
          {diureseErro && <p className="w-full text-xs" style={{ color: "var(--red)" }}>{diureseErro}</p>}
        </div>

        {/* Gráfico */}
        <div className="px-2 py-3">
          {carregandoDiurese ? (
            <p className="py-4 text-center text-xs" style={{ color: "var(--text3)" }}>Carregando...</p>
          ) : (
            <GraficoDiurese dados={diureses} />
          )}
        </div>

        {/* Lista de registros com edição inline */}
        {diureses.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border)" }}>
            <p className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: "var(--text3)" }}>Registros</p>
            {[...diureses].reverse().map((d) => {
              const emEdicao = editandoDiureseId === d.id;
              const vol24h = normalizar24h(d.volume_ml, d.horas);
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-2"
                  style={{ borderTop: "1px solid var(--border)" }}>
                  {emEdicao ? (
                    <>
                      <span className="text-xs font-semibold" style={{ color: "var(--text3)", minWidth: 56 }}>
                        {formatarDataCurta(d.data)}
                      </span>
                      <input type="number" min="0" value={editVol}
                        onChange={(e) => setEditVol(e.target.value)}
                        className="nc-input" style={{ width: 90, padding: "4px 8px", fontSize: 13 }} />
                      <span className="text-xs" style={{ color: "var(--text3)" }}>ml /</span>
                      <div className="flex gap-1">
                        {horasOpcoes.map((op) => (
                          <button key={op.value} onClick={() => setEditHoras(op.value)}
                            className="cursor-pointer rounded-(--nc-radius) px-2 py-1 text-xs font-bold transition"
                            style={{
                              background: editHoras === op.value ? "var(--accent)" : "var(--card2)",
                              color: editHoras === op.value ? "white" : "var(--text2)",
                              border: `1px solid ${editHoras === op.value ? "var(--accent)" : "var(--border)"}`,
                            }}>
                            {op.label}
                          </button>
                        ))}
                      </div>
                      <div className="ml-auto flex gap-2">
                        <button onClick={() => setEditandoDiureseId(null)}
                          className="nc-btn nc-btn-ghost cursor-pointer" style={{ padding: "4px 10px", fontSize: 12 }}>
                          Cancelar
                        </button>
                        <button onClick={handleSalvarEdicaoDiurese} disabled={salvandoDiurese}
                          className="nc-btn nc-btn-primary cursor-pointer" style={{ padding: "4px 10px", fontSize: 12 }}>
                          Salvar
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-semibold" style={{ color: "var(--text3)", minWidth: 56 }}>
                        {formatarDataCurta(d.data)}
                      </span>
                      <span className="text-sm font-bold" style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>
                        {d.volume_ml} ml
                      </span>
                      <span className="text-xs" style={{ color: "var(--text3)" }}>/ {d.horas}h</span>
                      {d.horas !== 24 && (
                        <span className="text-xs" style={{ color: "var(--text3)" }}>
                          (~{vol24h} ml/24h)
                        </span>
                      )}
                      <div className="ml-auto flex gap-3">
                        <button onClick={() => iniciarEdicaoDiurese(d)}
                          className="cursor-pointer text-xs transition hover:opacity-70"
                          style={{ color: "var(--text2)" }}>Editar</button>
                        <button onClick={() => handleExcluirDiurese(d.id)}
                          className="cursor-pointer text-xs transition hover:opacity-70"
                          style={{ color: "var(--red)" }}>Excluir</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Nova evolução ────────────────────────────────────────────── */}
      <div className="nc-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>Nova evolução</h3>
          {evolucoes.length > 0 && (
            <button onClick={handleCopiarAnterior}
              className="cursor-pointer text-xs font-semibold transition hover:opacity-70"
              style={{ color: "var(--text3)" }}>
              Copiar anterior
            </button>
          )}
        </div>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)}
          rows={5}
          placeholder="Evolução clínica do dia — inclua conduta ao final se necessário..."
          className="nc-input mt-3" />
        <div className="mt-2 flex justify-end">
          <button onClick={handleAdicionar} disabled={isPending || !texto.trim()}
            className="nc-btn nc-btn-primary cursor-pointer">
            {isPending ? "Salvando..." : "Adicionar evolução"}
          </button>
        </div>
      </div>

      {/* ── Histórico ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {evolucoes.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text3)" }}>Nenhuma evolução registrada ainda.</p>
        )}
        {evolucoes.map((ev) => {
          const ehAutor = ev.autor_id === usuarioId;
          const emEdicao = editandoEvolucaoId === ev.id;
          return (
            <div key={ev.id} className="nc-card p-4">
              <div className="flex items-center justify-between text-xs" style={{ color: "var(--text3)" }}>
                <span>
                  <strong style={{ color: "var(--text2)" }}>{ev.autor?.nome}</strong>
                  {" · "}{formatarDataHora(ev.created_at)}
                  {ev.updated_at !== ev.created_at && " (editada)"}
                </span>
                {/* Só o próprio autor pode editar/excluir a evolução */}
                {ehAutor && !emEdicao && (
                  <div className="flex gap-3">
                    <button onClick={() => iniciarEdicaoEvolucao(ev)}
                      className="cursor-pointer transition hover:opacity-70"
                      style={{ color: "var(--text2)" }}>Editar</button>
                    <button onClick={() => handleExcluirEvolucao(ev.id)}
                      className="cursor-pointer transition hover:opacity-70"
                      style={{ color: "var(--red)" }}>Excluir</button>
                  </div>
                )}
              </div>
              {emEdicao ? (
                <div className="mt-2 space-y-2">
                  <textarea value={textoEdicao} onChange={(e) => setTextoEdicao(e.target.value)}
                    rows={6} className="nc-input" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditandoEvolucaoId(null)} className="nc-btn nc-btn-ghost cursor-pointer">
                      Cancelar
                    </button>
                    <button onClick={handleSalvarEdicaoEvolucao} disabled={isPending}
                      className="nc-btn nc-btn-primary cursor-pointer">
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm" style={{ color: "var(--text)" }}>
                  {ev.texto}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}