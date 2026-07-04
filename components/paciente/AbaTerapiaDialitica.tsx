"use client";

import { useState, useMemo } from "react";
import type { Paciente, Internacao, AcompanhamentoNefro } from "@/types/database";
import { calcularCRRT } from "@/lib/engine/calculosCRRT";
import { calcularDifusivo } from "@/lib/engine/calculosDifusivo";
import { gerarTextoPrescricao } from "@/lib/engine/gerarPrescricao";
import { salvarPrescricao, buscarPrescricoes, excluirPrescricao } from "@/lib/actions/prescricoes";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Modalidade = "HDi" | "SLED" | "CVVHDF";
type Familia = "difusivo" | "crrt";

const FAMILIA: Record<Modalidade, Familia> = {
  HDi: "difusivo",
  SLED: "difusivo",
  CVVHDF: "crrt",
};

const MODALIDADES: { value: Modalidade; label: string; sub: string }[] = [
  { value: "HDi",    label: "HDi",    sub: "Hemodiálise clássica" },
  { value: "SLED",   label: "SLED",   sub: "Diálise prolongada" },
  { value: "CVVHDF", label: "CVVHDF", sub: "Contínua difusão+convecção" },
];

// Protocolos rápidos adaptados para HC-UFTM
const PROTOCOLOS = [
  {
    id: "cvvhdf-sepse",
    modalidade: "CVVHDF" as Modalidade,
    nome: "CVVHDF — Sepse/SIRS",
    descricao: "Protocolo HC-UFTM: Qb 100, Regiocit, dose 30–35 mL/kg/h",
    preset: { indicacao: "sepse", fluxoSangue: 100, reposicaoPos: 200, ufLiquida: 0, temperatura: 38,
      anticoagulacao: { tipo: "regiocit" } },
  },
  {
    id: "cvvhdf-hipervolemia",
    modalidade: "CVVHDF" as Modalidade,
    nome: "CVVHDF — Hipervolemia",
    descricao: "Protocolo HC-UFTM: Qb 100, Regiocit, dose 20–25 mL/kg/h",
    preset: { indicacao: "hipervolemia", fluxoSangue: 100, reposicaoPos: 200, ufLiquida: 50, temperatura: 38,
      anticoagulacao: { tipo: "regiocit" } },
  },
  {
    id: "hdi-padrao",
    modalidade: "HDi" as Modalidade,
    nome: "HDi — Padrão 4h",
    descricao: "4h, Qb 300, Qd 500, UF 2L",
    preset: { tempoH: 4, fluxoSangue: 300, fluxoDialisato: 500, ufTotalL: 2 },
  },
  {
    id: "sled-padrao",
    modalidade: "SLED" as Modalidade,
    nome: "SLED — Padrão 8h",
    descricao: "8h, Qb 150, Qd 300, UF 2L",
    preset: { tempoH: 8, fluxoSangue: 150, fluxoDialisato: 300, ufTotalL: 2 },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function corAlerta(nivel: string) {
  if (nivel === "critico") return "var(--red)";
  if (nivel === "aviso") return "var(--amber)";
  return "var(--accent)";
}

function bgAlerta(nivel: string) {
  if (nivel === "critico") return "var(--red-dim)";
  if (nivel === "aviso") return "var(--amber-dim)";
  return "var(--accent-dim)";
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function InputN({
  label, value, onChange, unit, placeholder, hint, width,
}: {
  label: string; value: string; onChange: (v: string) => void;
  unit?: string; placeholder?: string; hint?: string; width?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="nc-label" style={{ marginBottom: 0 }}>
        {label} {unit && <span style={{ color: "var(--text3)", fontWeight: 400 }}>({unit})</span>}
      </label>
      <input
        type="number" step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="nc-input"
        style={{ width: width ?? 120 }}
      />
      {hint && <span className="text-[11px]" style={{ color: "var(--text3)" }}>{hint}</span>}
    </div>
  );
}

function MetricaCard({ label, value, unit, destaque }: {
  label: string; value: unknown; unit?: string; destaque?: boolean;
}) {
  const display = value != null ? String(value) : "—";
  return (
    <div className="rounded-(--nc-radius) p-2.5" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text3)" }}>{label}</p>
      <p
        className="text-xl font-black"
        style={{ color: destaque ? "var(--accent)" : "var(--text)", fontFamily: "var(--mono)" }}
      >
        {display}
        {value != null && unit && (
          <span className="ml-1 text-xs font-normal" style={{ color: "var(--text3)" }}>{unit}</span>
        )}
      </p>
    </div>
  );
}

// ─── Etapas ───────────────────────────────────────────────────────────────────

function EtapaPaciente({
  dados, onChange,
}: {
  dados: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-2 flex flex-col gap-1">
          <label className="nc-label" style={{ marginBottom: 0 }}>Nome do paciente</label>
          <input value={dados.nome} onChange={(e) => onChange("nome", e.target.value)}
            className="nc-input" placeholder="Nome completo" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="nc-label" style={{ marginBottom: 0 }}>RG hospitalar</label>
          <input value={dados.rgHospitalar} onChange={(e) => onChange("rgHospitalar", e.target.value)}
            className="nc-input" placeholder="Prontuário" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InputN label="Peso" value={dados.peso} onChange={(v) => onChange("peso", v)} unit="kg" placeholder="70" />
        <InputN label="Altura" value={dados.altura} onChange={(v) => onChange("altura", v)} unit="cm" placeholder="170" />
        <InputN label="Idade" value={dados.idade} onChange={(v) => onChange("idade", v)} unit="anos" placeholder="60" />
        <div className="flex flex-col gap-1">
          <label className="nc-label" style={{ marginBottom: 0 }}>Sexo</label>
          <select value={dados.sexo} onChange={(e) => onChange("sexo", e.target.value)} className="nc-input cursor-pointer">
            <option value="">—</option>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="nc-label" style={{ marginBottom: 0 }}>Acesso vascular</label>
          <select value={dados.acesso} onChange={(e) => onChange("acesso", e.target.value)} className="nc-input cursor-pointer">
            <option value="">—</option>
            <option value="CDL jugular">CDL jugular</option>
            <option value="CDL femoral">CDL femoral</option>
            <option value="CDL subclávia">CDL subclávia</option>
            <option value="FAV">FAV</option>
            <option value="Permcath">Permcath</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="nc-label" style={{ marginBottom: 0 }}>Setor / Leito</label>
          <input value={dados.leito} onChange={(e) => onChange("leito", e.target.value)}
            className="nc-input" placeholder="Ex: UTI Geral — leito 5" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="nc-label" style={{ marginBottom: 0 }}>Diagnóstico principal</label>
        <input value={dados.diagnostico} onChange={(e) => onChange("diagnostico", e.target.value)}
          className="nc-input" placeholder="Ex: LRA por sepse" />
      </div>
    </div>
  );
}

function EtapaModalidade({
  modalidade, setModalidade, aplicarProtocolo,
}: {
  modalidade: Modalidade | "";
  setModalidade: (m: Modalidade) => void;
  aplicarProtocolo: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="nc-label mb-2">Modalidade de TSR</p>
        <div className="grid grid-cols-3 gap-3">
          {MODALIDADES.map((m) => (
            <button
              key={m.value}
              onClick={() => setModalidade(m.value)}
              className="cursor-pointer rounded-(--nc-radius-lg) border p-4 text-left transition hover:opacity-90"
              style={{
                background: modalidade === m.value ? "var(--accent)" : "var(--card)",
                borderColor: modalidade === m.value ? "var(--accent)" : "var(--border)",
                color: modalidade === m.value ? "white" : "var(--text)",
              }}
            >
              <p className="text-lg font-black" style={{ fontFamily: "var(--mono)" }}>{m.label}</p>
              <p className="text-xs mt-0.5" style={{ color: modalidade === m.value ? "rgba(255,255,255,0.75)" : "var(--text3)" }}>
                {m.sub}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="nc-label mb-2">⚡ Protocolos rápidos</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROTOCOLOS.map((p) => (
            <button
              key={p.id}
              onClick={() => aplicarProtocolo(p.id)}
              className="cursor-pointer rounded-(--nc-radius) border p-3 text-left transition hover:opacity-80"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{p.nome}</span>
                <span className="rounded px-1.5 py-0.5 text-xs font-bold"
                  style={{ background: "var(--accent-dim)", color: "var(--accent)", fontFamily: "var(--mono)" }}>
                  {p.modalidade}
                </span>
              </div>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text3)" }}>{p.descricao}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EtapaTerapia({
  familia, prescricao, setPrescricao, metricas, alertas,
}: {
  familia: Familia;
  prescricao: Record<string, unknown>;
  setPrescricao: (k: string, v: unknown) => void;
  metricas: Record<string, unknown>;
  alertas: { nivel: string; codigo: string; mensagem: string }[];
}) {
  const setP = (k: string) => (v: string) => setPrescricao(k, v);
  const setAc = (k: string) => (v: unknown) =>
    setPrescricao("anticoagulacao", { ...(prescricao.anticoagulacao as Record<string, unknown> || {}), [k]: v });
  const ac = (prescricao.anticoagulacao as Record<string, unknown>) || {};
  const doseAlvo = metricas.doseAlvo as { minMlh: number; maxMlh: number; minMlKgH: number; maxMlKgH: number } | null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Formulário */}
      <div className="space-y-5">
        {familia === "crrt" ? (
          <>
            {/* Indicação */}
            <div>
              <p className="nc-label mb-2">Indicação clínica (define faixa de dose)</p>
              <div className="flex gap-2">
                {[
                  { value: "sepse", label: "Sepse / SIRS (30–35 mL/kg/h)" },
                  { value: "hipervolemia", label: "Hipervolemia (20–25 mL/kg/h)" },
                ].map((op) => (
                  <button key={op.value}
                    onClick={() => setPrescricao("indicacao", op.value)}
                    className="cursor-pointer flex-1 rounded-(--nc-radius) border px-3 py-2 text-sm font-semibold transition"
                    style={{
                      background: prescricao.indicacao === op.value ? "var(--accent)" : "var(--card)",
                      borderColor: prescricao.indicacao === op.value ? "var(--accent)" : "var(--border)",
                      color: prescricao.indicacao === op.value ? "white" : "var(--text2)",
                    }}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Parâmetros CRRT */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <InputN label="Fluxo de sangue (Qb)" value={String(prescricao.fluxoSangue ?? "")}
                onChange={setP("fluxoSangue")} unit="mL/min" placeholder="100–130"
                hint="Protocolo: 100–130" />
              <InputN label="UF líquida" value={String(prescricao.ufLiquida ?? "")}
                onChange={setP("ufLiquida")} unit="mL/h" placeholder="0 / 50 / 80"
                hint="0→50→80 mL/h" />
              <InputN label="Reposição pós" value={String(prescricao.reposicaoPos ?? "")}
                onChange={setP("reposicaoPos")} unit="mL/h" placeholder="200"
                hint="Padrão: 200 mL/h" />
              <InputN label="Temperatura" value={String(prescricao.temperatura ?? "")}
                onChange={setP("temperatura")} unit="°C" placeholder="38–40"
                hint="Protocolo: 38–40°C" />
            </div>

            {/* Anticoagulação */}
            <div>
              <p className="nc-label mb-2">Anticoagulação</p>
              <div className="flex gap-2 mb-3">
                {["regiocit", "heparina", "nenhuma"].map((tipo) => (
                  <button key={tipo}
                    onClick={() => setAc("tipo")(tipo)}
                    className="cursor-pointer rounded-(--nc-radius) border px-3 py-1.5 text-sm font-semibold capitalize transition"
                    style={{
                      background: ac.tipo === tipo ? "var(--accent)" : "var(--card)",
                      borderColor: ac.tipo === tipo ? "var(--accent)" : "var(--border)",
                      color: ac.tipo === tipo ? "white" : "var(--text2)",
                    }}>
                    {tipo === "regiocit" ? "Regiocit (citrato)" : tipo === "heparina" ? "Heparina" : "Sem anticoag."}
                  </button>
                ))}
              </div>

              {ac.tipo === "regiocit" && (
                <div className="rounded-(--nc-radius-lg) border p-4 space-y-4"
                  style={{ borderColor: "var(--border2)", background: "var(--accent-dim)" }}>
                  <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>
                    Regiocit — monitorização de cálcio iônico
                  </p>

                  {/* Volumes calculados */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-(--nc-radius) border p-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                      <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text3)" }}>Regiocit (= Qb × 10)</p>
                      <p className="text-xl font-black" style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>
                        {metricas.regiocit_mlh != null ? String(metricas.regiocit_mlh) : "—"}
                        {metricas.regiocit_mlh != null && <span className="text-sm font-normal ml-1" style={{ color: "var(--text3)" }}>mL/h</span>}
                      </p>
                    </div>
                    <div className="rounded-(--nc-radius) border p-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                      <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text3)" }}>Biphosyl (calculado)</p>
                      <p className="text-xl font-black" style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>
                        {metricas.biphosyl_mlh != null ? String(metricas.biphosyl_mlh) : "—"}
                        {metricas.biphosyl_mlh != null && <span className="text-sm font-normal ml-1" style={{ color: "var(--text3)" }}>mL/h</span>}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text3)" }}>Dose − Rpos − Regiocit</p>
                    </div>
                  </div>

                  {/* Leituras de cálcio */}
                  <div className="grid grid-cols-3 gap-3">
                    <InputN label="Ca iônico sistêmico" value={String(ac.calcioSistemico ?? "")}
                      onChange={(v) => setAc("calcioSistemico")(v)} unit="mmol/L" placeholder="ex: 1.1"
                      hint="Sangue do paciente" />
                    <InputN label="Ca iônico pós-filtro" value={String(ac.calcioMaquina ?? "")}
                      onChange={(v) => setAc("calcioMaquina")(v)} unit="mmol/L" placeholder="ex: 0.35"
                      hint="Leitura da máquina" />
                    <InputN label="CaCl₂ 10% em uso" value={String(ac.infusaoCalcio ?? "")}
                      onChange={(v) => setAc("infusaoCalcio")(v)} unit="mL/h" placeholder="atual" />
                  </div>

                  {/* Tabelas de referência */}
                  <details className="text-xs">
                    <summary className="cursor-pointer font-semibold" style={{ color: "var(--accent)" }}>
                      Ver tabelas de referência (protocolo HC-UFTM)
                    </summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-(--nc-radius) border p-2.5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                        <p className="font-semibold mb-1" style={{ color: "var(--text)" }}>CaCl₂ ← Ca sistêmico</p>
                        <p style={{ color: "var(--red)" }}>&lt; 1,0 → AUMENTAR 10–25%</p>
                        <p style={{ color: "var(--green)" }}>1,0–1,2 → MANTER</p>
                        <p style={{ color: "var(--amber)" }}>&gt; 1,2 → DIMINUIR 10–25%</p>
                      </div>
                      <div className="rounded-(--nc-radius) border p-2.5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                        <p className="font-semibold mb-1" style={{ color: "var(--text)" }}>Regiocit ← Ca pós-filtro</p>
                        <p style={{ color: "var(--amber)" }}>&lt; 0,25 → DIMINUIR 0,2 mmol/L</p>
                        <p style={{ color: "var(--green)" }}>0,25–0,40 → MANTER</p>
                        <p style={{ color: "var(--amber)" }}>&gt; 0,40 → AUMENTAR 0,2 mmol/L</p>
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Formulário difusivo (HDi/SLED) */
          <>
            <div className="grid grid-cols-2 gap-4">
              <InputN label="Tempo previsto" value={String(prescricao.tempoH ?? "")}
                onChange={setP("tempoH")} unit="h" placeholder="4" />
              <InputN label="Meta de UF" value={String(prescricao.ufTotalL ?? "")}
                onChange={setP("ufTotalL")} unit="L" placeholder="2.0" />
              <InputN label="Fluxo de sangue (Qb)" value={String(prescricao.fluxoSangue ?? "")}
                onChange={setP("fluxoSangue")} unit="mL/min" placeholder="300" />
              <InputN label="Fluxo de dialisato (Qd)" value={String(prescricao.fluxoDialisato ?? "")}
                onChange={setP("fluxoDialisato")} unit="mL/min" placeholder="500" />
            </div>

            <div className="rounded-(--nc-radius-lg) border border-dashed p-4 space-y-3"
              style={{ borderColor: "var(--border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text3)" }}>
                Adequação (preenche após a sessão)
              </p>
              <div className="grid grid-cols-3 gap-4">
                <InputN label="Ureia pré" value={String(prescricao.ureiaPre ?? "")}
                  onChange={setP("ureiaPre")} unit="mg/dL" />
                <InputN label="Ureia pós" value={String(prescricao.ureiaPos ?? "")}
                  onChange={setP("ureiaPos")} unit="mg/dL" />
                <InputN label="Peso pós" value={String(prescricao.pesoPos ?? "")}
                  onChange={setP("pesoPos")} unit="kg" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Painel lateral de métricas + alertas */}
      <div className="space-y-4">
        <p className="text-sm font-bold" style={{ color: "var(--text3)" }}>Cálculo ao vivo</p>

        {/* Faixa-alvo CRRT */}
        {familia === "crrt" && doseAlvo && (
          <div className="rounded-(--nc-radius) border p-3"
            style={{ background: "var(--accent-dim)", borderColor: "var(--border2)" }}>
            <p className="text-[10px] font-bold uppercase" style={{ color: "var(--accent)" }}>Faixa-alvo (HC-UFTM)</p>
            <p className="text-xl font-black" style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>
              {doseAlvo.minMlh}–{doseAlvo.maxMlh} mL/h
            </p>
            <p className="text-xs" style={{ color: "var(--text3)" }}>
              {doseAlvo.minMlKgH}–{doseAlvo.maxMlKgH} mL/kg/h
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {familia === "crrt" ? (
            <>
              <MetricaCard label="Efluente total" value={metricas.efluente_mlh} unit="mL/h" destaque />
              <MetricaCard label="Dose" value={metricas.dose_mlKgH} unit="mL/kg/h" />
              <MetricaCard label="Regiocit" value={metricas.regiocit_mlh} unit="mL/h" />
              <MetricaCard label="Biphosyl" value={metricas.biphosyl_mlh} unit="mL/h" />
              <MetricaCard label="Fração filtr." value={metricas.fracaoFiltracao_pct} unit="%" />
              <MetricaCard label="Balanço/h" value={metricas.balancoHorario_mlh} unit="mL/h" />
            </>
          ) : (
            <>
              <MetricaCard label="Kt/V" value={metricas.ktvMedido} destaque />
              <MetricaCard label="URR" value={metricas.urrPct} unit="%" />
              <MetricaCard label="Volume (V)" value={metricas.volumeUreiaL} unit="L" />
              <MetricaCard label="UF rate" value={metricas.ufRate_mlKgH} unit="mL/kg/h" />
            </>
          )}
        </div>

        {/* Alertas */}
        <div className="space-y-2">
          {alertas.length === 0 ? (
            <div className="rounded-(--nc-radius) p-3 text-sm"
              style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
              ✓ Sem alertas. Revise os parâmetros antes de finalizar.
            </div>
          ) : (
            alertas.map((a) => (
              <div key={a.codigo} className="rounded-(--nc-radius) p-3 text-sm"
                style={{ background: bgAlerta(a.nivel), color: corAlerta(a.nivel), border: `1px solid ${corAlerta(a.nivel)}30` }}>
                {a.nivel === "critico" ? "🔴" : a.nivel === "aviso" ? "⚠️" : "ℹ️"} {a.mensagem}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function EtapaFinal({
  texto, alertas, salvando, onSalvar, prescricoesSalvas, onExcluir,
}: {
  texto: string;
  alertas: { nivel: string; codigo: string; mensagem: string }[];
  salvando: boolean;
  onSalvar: () => void;
  prescricoesSalvas: { id: string; modalidade: string; created_at: string }[];
  onExcluir: (id: string) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const criticos = alertas.filter((a) => a.nivel === "critico");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* ignora */ }
  }

  return (
    <div className="space-y-5">
      {criticos.length > 0 && (
        <div className="space-y-2">
          {criticos.map((a) => (
            <div key={a.codigo} className="rounded-(--nc-radius) p-3 text-sm"
              style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(176,48,32,0.2)" }}>
              🔴 {a.mensagem}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={copiar}
          className="nc-btn nc-btn-primary cursor-pointer">
          {copiado ? "✓ Copiado!" : "📋 Copiar texto"}
        </button>
        <button onClick={() => window.print()}
          className="nc-btn nc-btn-ghost cursor-pointer">
          🖨 Imprimir / PDF
        </button>
        <button onClick={onSalvar} disabled={salvando}
          className="nc-btn cursor-pointer"
          style={{ background: "var(--green)", color: "white" }}>
          {salvando ? "Salvando..." : "💾 Salvar no prontuário"}
        </button>
      </div>

      {/* Texto da prescrição */}
      <div className="nc-card overflow-hidden">
        <pre className="whitespace-pre-wrap p-5 text-sm leading-relaxed"
          style={{ color: "var(--text)", fontFamily: "var(--mono)" }}>
          {texto}
        </pre>
      </div>

      {/* Histórico de prescrições salvas */}
      {prescricoesSalvas.length > 0 && (
        <div className="nc-card overflow-hidden">
          <p className="px-4 py-3 text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--text3)", borderBottom: "1px solid var(--border)" }}>
            Prescrições salvas neste acompanhamento
          </p>
          {prescricoesSalvas.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <span className="text-sm font-bold" style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>
                  {p.modalidade}
                </span>
                <span className="ml-2 text-xs" style={{ color: "var(--text3)" }}>{fmtDt(p.created_at)}</span>
              </div>
              <button onClick={() => onExcluir(p.id)}
                className="cursor-pointer text-xs transition hover:opacity-70"
                style={{ color: "var(--red)" }}>
                Excluir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const ETAPAS = ["Paciente", "Modalidade", "Parâmetros", "Prescrição"];

interface AbaTerapiaDialiticaProps {
  acompanhamento: AcompanhamentoNefro;
  paciente: Paciente;
  internacao: Internacao;
}

export function AbaTerapiaDialitica({ acompanhamento, paciente, internacao }: AbaTerapiaDialiticaProps) {
  const [etapa, setEtapa] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [prescricoesSalvas, setPrescricoesSalvas] = useState<{ id: string; modalidade: string; created_at: string }[]>([]);
  const [carregouHistorico, setCarregouHistorico] = useState(false);

  // Dados do paciente — pré-preenchidos do cadastro.
  // Usa função lazy no useState para que o cálculo de idade (que usa a data)
  // rode apenas uma vez na inicialização, não a cada re-render.
  const [dadosPaciente, setDadosPaciente] = useState<Record<string, string>>(() => {
    let idade = "";
    if (paciente.data_nascimento) {
      const nasc = new Date(paciente.data_nascimento);
      const hoje = new Date();
      let anos = hoje.getFullYear() - nasc.getFullYear();
      const aniversarioPassou =
        hoje.getMonth() > nasc.getMonth() ||
        (hoje.getMonth() === nasc.getMonth() && hoje.getDate() >= nasc.getDate());
      if (!aniversarioPassou) anos--;
      idade = String(anos);
    }
    return {
      nome: paciente.nome,
      rgHospitalar: paciente.rg_hospitalar,
      peso: "",
      altura: "",
      idade,
      sexo: paciente.sexo ?? "",
      acesso: "",
      leito: internacao.enfermaria_leito
        ? `${internacao.setor.replace(/_/g, " ")} — leito ${internacao.enfermaria_leito}`
        : internacao.setor.replace(/_/g, " "),
      diagnostico: acompanhamento.diagnostico_principal?.replace(/_/g, " ") ?? "",
    };
  });

  const [modalidade, setModalidade] = useState<Modalidade | "">("");
  const [prescricao, setPrescricaoState] = useState<Record<string, unknown>>({
    indicacao: "sepse",
    reposicaoPos: 200,
    ufLiquida: 0,
    anticoagulacao: { tipo: "regiocit" },
  });

  const familia: Familia | null = modalidade ? FAMILIA[modalidade] : null;

  function setPaciente(k: string, v: string) {
    setDadosPaciente((p) => ({ ...p, [k]: v }));
  }

  function setPrescricao(k: string, v: unknown) {
    setPrescricaoState((p) => ({ ...p, [k]: v }));
  }

  function aplicarProtocolo(id: string) {
    const proto = PROTOCOLOS.find((p) => p.id === id);
    if (!proto) return;
    setModalidade(proto.modalidade);
    setPrescricaoState({ ...proto.preset });
    setEtapa(2); // vai direto para parâmetros
  }

  // Cálculo reativo
  const { metricas, alertas } = useMemo(() => {
    if (!modalidade) return { metricas: {}, alertas: [] };
    const pac = {
      sexo: dadosPaciente.sexo,
      peso: dadosPaciente.peso,
      altura: dadosPaciente.altura,
      idade: dadosPaciente.idade,
    };
    if (familia === "crrt") {
      const r = calcularCRRT({ modalidade, paciente: pac, prescricao });
      return { metricas: r.metricas as unknown as Record<string, unknown>, alertas: r.alertas };
    }
    if (familia === "difusivo") {
      const r = calcularDifusivo({ modalidade, paciente: pac, prescricao });
      return { metricas: r.metricas as unknown as Record<string, unknown>, alertas: r.alertas };
    }
    return { metricas: {}, alertas: [] };
  }, [modalidade, familia, dadosPaciente, prescricao]);

  // Texto da prescrição
  const texto = useMemo(() => {
    if (!modalidade || !familia) return "";
    return gerarTextoPrescricao({
      paciente: dadosPaciente as Record<string, unknown>,
      modalidade,
      prescricao,
      metricas,
      familia,
    });
  }, [modalidade, familia, dadosPaciente, prescricao, metricas]);

  // Carrega histórico ao chegar na etapa final
  async function carregarHistorico() {
    if (carregouHistorico) return;
    const r = await buscarPrescricoes(acompanhamento.id);
    if (r.sucesso) setPrescricoesSalvas(r.dados as { id: string; modalidade: string; created_at: string }[]);
    setCarregouHistorico(true);
  }

  async function handleSalvar() {
    if (!modalidade || !familia) return;
    setSalvando(true);
    await salvarPrescricao({
      acompanhamentoId: acompanhamento.id,
      modalidade,
      dados: { paciente: dadosPaciente, prescricao },
      metricas,
      textoPrescricao: texto,
    });
    setSalvando(false);
    await carregarHistorico();
    setCarregouHistorico(false); // força recarregar
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir esta prescrição?")) return;
    await excluirPrescricao(id);
    setPrescricoesSalvas((p) => p.filter((x) => x.id !== id));
  }

  function avancar() {
    if (etapa === 3) return;
    if (etapa === 2) carregarHistorico();
    setEtapa((e) => e + 1);
  }

  function podeAvancar() {
    if (etapa === 0) return true;
    if (etapa === 1) return !!modalidade;
    if (etapa === 2) return true;
    return false;
  }

  return (
    <div className="space-y-6">
      {/* Barra de progresso */}
      <div className="flex items-center gap-0">
        {ETAPAS.map((label, i) => (
          <div key={i} className="flex flex-1 items-center">
            <button
              onClick={() => i < etapa && setEtapa(i)}
              disabled={i > etapa}
              className="flex flex-col items-center gap-1"
              style={{ cursor: i <= etapa ? "pointer" : "default" }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition"
                style={{
                  background: i <= etapa ? "var(--accent)" : "var(--border)",
                  color: i <= etapa ? "white" : "var(--text3)",
                }}
              >
                {i < etapa ? "✓" : i + 1}
              </div>
              <span className="text-[10px] font-semibold hidden sm:block"
                style={{ color: i === etapa ? "var(--accent)" : "var(--text3)" }}>
                {label}
              </span>
            </button>
            {i < ETAPAS.length - 1 && (
              <div className="flex-1 mx-1 h-0.5 transition"
                style={{ background: i < etapa ? "var(--accent)" : "var(--border)" }} />
            )}
          </div>
        ))}
      </div>

      {/* Conteúdo da etapa */}
      <div className="nc-card p-5">
        <h3 className="mb-4 text-sm font-bold" style={{ color: "var(--text)" }}>
          {etapa + 1}. {ETAPAS[etapa]}
        </h3>

        {etapa === 0 && (
          <EtapaPaciente dados={dadosPaciente} onChange={setPaciente} />
        )}
        {etapa === 1 && (
          <EtapaModalidade modalidade={modalidade} setModalidade={setModalidade} aplicarProtocolo={aplicarProtocolo} />
        )}
        {etapa === 2 && familia && (
          <EtapaTerapia
            familia={familia} prescricao={prescricao}
            setPrescricao={setPrescricao}
            metricas={metricas} alertas={alertas}
          />
        )}
        {etapa === 3 && (
          <EtapaFinal
            texto={texto} alertas={alertas}
            salvando={salvando} onSalvar={handleSalvar}
            prescricoesSalvas={prescricoesSalvas}
            onExcluir={handleExcluir}
          />
        )}
      </div>

      {/* Navegação */}
      <div className="flex justify-between">
        <button
          onClick={() => setEtapa((e) => e - 1)}
          disabled={etapa === 0}
          className="nc-btn nc-btn-ghost cursor-pointer disabled:opacity-40"
        >
          ← Anterior
        </button>
        {etapa < 3 && (
          <button
            onClick={avancar}
            disabled={!podeAvancar()}
            className="nc-btn nc-btn-primary cursor-pointer disabled:opacity-40"
          >
            Próximo →
          </button>
        )}
      </div>
    </div>
  );
}