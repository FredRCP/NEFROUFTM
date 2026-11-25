"use client";

import { useState, useMemo, useEffect } from "react";
import type { Paciente, Internacao, AcompanhamentoNefro } from "@/types/database";
import { salvarPrescricao, buscarPrescricoes, excluirPrescricao } from "@/lib/actions/prescricoes";
import { montarDadosImpressao } from "@/lib/printing/montarImpressao";
import { abrirJanelaImpressao } from "@/lib/printing/abrirJanelaImpressao";
import { gerarLinhasHD } from "@/lib/printing/imprimirHD";
import { gerarLinhasCVVHDF } from "@/lib/printing/imprimirCVVHDF";
import { gerarLinhasDP } from "@/lib/printing/imprimirDP";
import { gerarLinhasTPE } from "@/lib/printing/imprimirTPE";
import type { LinhasPrescricao } from "@/lib/printing/tipos";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Modalidade = "HD" | "CVVHDF" | "DP" | "TPE";

const MODALIDADES: { value: Modalidade; label: string; sub: string; pesoBrigatorio: boolean }[] = [
  { value: "HD",      label: "HD / HD Estendida / UF", sub: "Hemodiálise clássica ou estendida",    pesoBrigatorio: false },
  { value: "CVVHDF",  label: "CVVHDF",                 sub: "Terapia de substituição contínua",     pesoBrigatorio: true  },
  { value: "DP",      label: "DP Intermitente",        sub: "Diálise peritoneal — pediatria",       pesoBrigatorio: true  },
  { value: "TPE",     label: "Plasmaférese (TPE)",     sub: "Troca de plasma terapêutica",          pesoBrigatorio: true  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function n(v: string) { return parseFloat(v.replace(",", ".")); }
function fmtN(v: number | null, dec = 0) {
  if (v === null || isNaN(v)) return "—";
  return dec > 0 ? v.toFixed(dec) : String(Math.round(v));
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="nc-label" style={{ marginBottom: 0 }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 10, color: "var(--text3)" }}>{hint}</span>}
    </div>
  );
}

function NumInput({ label, value, onChange, unit, placeholder, hint, obrigatorio }: {
  label: string; value: string; onChange: (v: string) => void;
  unit?: string; placeholder?: string; hint?: string; obrigatorio?: boolean;
}) {
  return (
    <Field label={`${label}${unit ? ` (${unit})` : ""}${obrigatorio ? " *" : ""}`} hint={hint}>
      <input type="number" step="any" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className="nc-input" />
    </Field>
  );
}

function Toggle({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label={label}>
      <div className="flex gap-1.5 flex-wrap">
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className="cursor-pointer rounded-(--nc-radius) border px-3 py-1.5 text-sm font-semibold transition"
            style={{
              background: value === o.value ? "var(--accent)" : "var(--card)",
              borderColor: value === o.value ? "var(--accent)" : "var(--border)",
              color: value === o.value ? "white" : "var(--text2)",
            }}>
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

// ─── Prescrição HD / HD Estendida / UF ───────────────────────────────────────

function FormHD({ p, set }: { p: Record<string, string>; set: (k: string, v: string) => void }) {
  const isUF = p.submodalidade === "Ultrafiltração isolada";

  return (
    <div className="space-y-5">
      {/* Modalidade HD */}
      <Toggle label="Modalidade" value={p.submodalidade ?? ""} onChange={v => set("submodalidade", v)}
        options={[
          { value: "HD Clássica", label: "HD Clássica" },
          { value: "HD Estendida", label: "HD Estendida" },
          { value: "Ultrafiltração isolada", label: "Ultrafiltração isolada" },
        ]} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <NumInput label="Tempo" unit="h" value={p.tempoH ?? ""} onChange={v => set("tempoH", v)}
          placeholder={p.submodalidade === "HD Estendida" ? "ex.: 8" : "ex.: 4"} />
        <NumInput label="Ultrafiltração (perdas)" unit="mL" value={p.ufMl ?? ""} onChange={v => set("ufMl", v)}
          placeholder="ex.: 0" />
        <NumInput label="Fluxo de sangue (Qb)" unit="mL/min" value={p.qb ?? ""} onChange={v => set("qb", v)}
          placeholder={p.submodalidade === "HD Estendida" ? "ex.: 180" : "ex.: 300"} />
        {/* Qd — oculto na UF isolada */}
        {!isUF && (
          <NumInput label="Fluxo de dialisato (Qd)" unit="mL/min" value={p.qd ?? ""} onChange={v => set("qd", v)}
            placeholder={p.submodalidade === "HD Estendida" ? "ex.: 300" : "ex.: 500"} />
        )}
        {/* Na — oculto na UF isolada */}
        {!isUF && (
          <NumInput label="Sódio (Na)" unit="mEq/L" value={p.sodio ?? ""} onChange={v => set("sodio", v)}
            placeholder="ex.: 140" />
        )}
        <NumInput label="Temperatura" unit="°C" value={p.temperatura ?? ""} onChange={v => set("temperatura", v)}
          placeholder="ex.: 36,5" />
        {!isUF && (
          <Field label="Capilar">
            <input value={p.capilar ?? ""} onChange={e => set("capilar", e.target.value)}
              className="nc-input" placeholder="Ex: F8, HF80S" />
          </Field>
        )}
        {/* BIC — oculto na UF isolada */}
        {!isUF && (
          <NumInput label="Bicarbonato (BIC)" unit="mEq/L" value={p.bic ?? ""} onChange={v => set("bic", v)}
            placeholder="Ex: +8" />
        )}
      </div>

      {/* Heparina + Lavagem + Cálcio — mesma linha no desktop */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Toggle label="Heparina" value={p.heparina ?? ""} onChange={v => set("heparina", v)}
            options={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]} />
          {p.heparina === "sim" && (
            <NumInput label="Dose (mL)" unit="mL" value={p.heparinaQtd ?? ""} onChange={v => set("heparinaQtd", v)}
              placeholder="Ex: 1,0" hint="Bolus no início" />
          )}
        </div>
        <div className="space-y-2">
          <Toggle label="Lavagem do sistema" value={p.lavagem ?? ""} onChange={v => set("lavagem", v)}
          options={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]} />
          {p.lavagem === "sim" && (
            <NumInput label="Soro a cada 15 min" unit="mL" value={p.lavagemMl ?? ""} onChange={v => set("lavagemMl", v)}
              placeholder="ex.: 50" hint="Soro fisiológico" />
          )}
        </div>
        {!isUF && (
          <Toggle label="Cálcio do dialisato" value={p.calcio ?? ""} onChange={v => set("calcio", v)}
            options={[
              { value: "padrao", label: "Padrão (3,0)" },
              { value: "baixo", label: "Baixo (2,5)" },
            ]} />
        )}
      </div>

      {/* Suplementos */}
      {!isUF && (
        <div>
          <p className="nc-label mb-2">Suplementos / Adicionais</p>
          <div className="grid grid-cols-2 gap-3">
            <Toggle label="Glicose 50% 2 amp" value={p.glicose ?? ""} onChange={v => set("glicose", v)}
              options={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim (ACM)" }]} />
            <Toggle label="NaCl 20% 10 mL/h" value={p.nacl ?? ""} onChange={v => set("nacl", v)}
              options={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim (ACM)" }]} />
          </div>
        </div>
      )}

      {/* Outros */}
      <Field label="Outros">
        <textarea value={p.outros ?? ""} onChange={e => set("outros", e.target.value)}
          rows={2} className="nc-input" placeholder="Observações adicionais, medicações, etc." />
      </Field>
    </div>
  );
}

// ─── Prescrição CVVHDF ────────────────────────────────────────────────────────

function FormCVVHDF({ p, set, peso }: { p: Record<string, string>; set: (k: string, v: string) => void; peso: number | null }) {
  const qb = n(p.qb ?? "");
  const regiocitMlh = !isNaN(qb) ? Math.round(qb * 10) : null;
  const reposPos = n(p.reposicaoPos ?? "");
  const dose = n(p.dose ?? "");
  const biphosyl = (regiocitMlh !== null && !isNaN(reposPos) && !isNaN(dose))
    ? Math.round(dose - reposPos - regiocitMlh)
    : null;

  // Automação: sugere dose alvo conforme indicação + peso
  const doseAlvoMin = (peso && p.indicacao)
    ? Math.round(peso * (p.indicacao === "sepse" ? 30 : 20))
    : null;
  const doseAlvoMax = (peso && p.indicacao)
    ? Math.round(peso * (p.indicacao === "sepse" ? 35 : 25))
    : null;
  const dosePorKg = (peso && !isNaN(dose)) ? (dose / peso).toFixed(1) : null;
  const regiocitSugerido = !isNaN(qb) ? Math.round(qb * 10) : null;

  function autoPreencher() {
    if (!peso || !p.indicacao || isNaN(qb)) return;
    const doseSugerida = Math.round(peso * (p.indicacao === "sepse" ? 32 : 22));
    const rpos = 200;
    const reg = Math.round(qb * 10);
    const bip = doseSugerida - rpos - reg;
    set("dose", String(doseSugerida));
    set("reposicaoPos", String(rpos));
    set("temperatura", p.indicacao === "sepse" ? "38" : "37");
    if (bip > 0) set("biphosylCalc", String(bip));
  }

  return (
    <div className="space-y-5">

      {/* Indicação */}
      <Toggle label="Indicação clínica" value={p.indicacao ?? ""} onChange={v => { set("indicacao", v); }}
        options={[
          { value: "sepse", label: "Sepse / SIRS" },
          { value: "hipervolemia", label: "Hipervolemia / IRA" },
          { value: "outra", label: "Outra" },
        ]} />

      {/* Sugestão automática */}
      {peso && p.indicacao && !isNaN(qb) && (
        <div className="rounded-(--nc-radius-lg) p-3 flex items-center justify-between gap-3"
          style={{ background: "var(--green-dim)", border: "1px solid var(--green)" }}>
          <div>
            <p className="text-xs font-bold" style={{ color: "var(--green)" }}>
              Sugestão automática — {peso} kg · Qb {p.qb} mL/min · {p.indicacao}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>
              Dose alvo: {doseAlvoMin}–{doseAlvoMax} mL/h · Regiocit: {regiocitSugerido} mL/h · Rpos: 200 mL/h
            </p>
          </div>
          <button type="button" onClick={autoPreencher}
            className="nc-btn cursor-pointer shrink-0"
            style={{ background: "var(--green)", color: "white", fontSize: 12, padding: "6px 14px" }}>
            Aplicar
          </button>
        </div>
      )}

      {/* Parâmetros */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <NumInput label="Fluxo de sangue (Qb)" unit="mL/min" value={p.qb ?? ""} onChange={v => set("qb", v)}
          placeholder="ex.: 120" />
        <NumInput label="Dose total" unit="mL/h" value={p.dose ?? ""} onChange={v => set("dose", v)}
          placeholder="ex.: 1800"
          hint={dosePorKg ? `≈ ${dosePorKg} mL/kg/h` : doseAlvoMin ? `Alvo: ${doseAlvoMin}–${doseAlvoMax} mL/h` : "Alvo: 30–35 mL/kg/h (sepse)"} />
        <NumInput label="Reposição pós-filtro" unit="mL/h" value={p.reposicaoPos ?? ""} onChange={v => set("reposicaoPos", v)}
          placeholder="200" hint="Padrão: 200 mL/h" />
        <NumInput label="UF líquida" unit="mL/h" value={p.ufLiquida ?? ""} onChange={v => set("ufLiquida", v)}
          placeholder="ex.: 50" hint="Balanço hídrico alvo" />
        <NumInput label="Temperatura" unit="°C" value={p.temperatura ?? ""} onChange={v => set("temperatura", v)}
          placeholder="ex.: 38,5" />
        <Field label="Set / Capilar">
          <input value={p.set ?? ""} onChange={e => set("set", e.target.value)}
            className="nc-input" placeholder="ex.: oXiris" />
        </Field>
      </div>

      {/* Hematócrito */}
      <NumInput label="Hematócrito" unit="%" value={p.hematocrito ?? ""} onChange={v => set("hematocrito", v)}
        placeholder="Ex: 30" />

      {/* Anticoagulação */}
      <Toggle label="Anticoagulação" value={p.anticoag ?? "regiocit"} onChange={v => set("anticoag", v)}
        options={[
          { value: "regiocit", label: "Regiocit (citrato)" },
          { value: "heparina", label: "Heparina" },
          { value: "nenhuma", label: "Sem anticoag." },
        ]} />

      {/* Painel Regiocit */}
      {(p.anticoag ?? "regiocit") === "regiocit" && (
        <div className="rounded-(--nc-radius-lg) border p-4 space-y-4"
          style={{ borderColor: "var(--border2)", background: "var(--accent-dim)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>Regiocit — volumes calculados</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-(--nc-radius) border p-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text3)" }}>Regiocit (Qb × 10)</p>
              <p className="text-xl font-black" style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>
                {fmtN(regiocitMlh)} {regiocitMlh !== null && <span className="text-xs font-normal" style={{ color: "var(--text3)" }}>mL/h</span>}
              </p>
            </div>
            <div className="rounded-(--nc-radius) border p-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text3)" }}>Biphosyl (Dose − Rpos − Reg.)</p>
              <p className="text-xl font-black" style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>
                {fmtN(biphosyl)} {biphosyl !== null && <span className="text-xs font-normal" style={{ color: "var(--text3)" }}>mL/h</span>}
              </p>
            </div>
            <NumInput label="CaCl₂ 10% em uso" unit="mL/h" value={p.infusaoCalcio ?? ""}
              onChange={v => set("infusaoCalcio", v)} placeholder="atual" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="Ca iônico sistêmico" unit="mmol/L" value={p.calcioSistemico ?? ""}
              onChange={v => set("calcioSistemico", v)} placeholder="ex.: 1,1" hint="Sangue do paciente" />
            <NumInput label="Ca iônico pós-filtro" unit="mmol/L" value={p.calcioPosFiltro ?? ""}
              onChange={v => set("calcioPosFiltro", v)} placeholder="ex.: 0,3" hint="Leitura da máquina" />
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold" style={{ color: "var(--accent)" }}>
              Ver tabelas de referência (protocolo HC-UFTM)
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-(--nc-radius) border p-2.5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <p className="font-semibold mb-1">CaCl₂ ← Ca sistêmico</p>
                <p style={{ color: "var(--red)" }}>&lt; 1,0 → AUMENTAR 10–25%</p>
                <p style={{ color: "var(--green)" }}>1,0–1,2 → MANTER</p>
                <p style={{ color: "var(--amber)" }}>&gt; 1,2 → DIMINUIR 10–25%</p>
              </div>
              <div className="rounded-(--nc-radius) border p-2.5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <p className="font-semibold mb-1">Regiocit ← Ca pós-filtro</p>
                <p style={{ color: "var(--amber)" }}>&lt; 0,25 → DIMINUIR 0,2 mmol/L</p>
                <p style={{ color: "var(--green)" }}>0,25–0,35 → MANTER</p>
                <p style={{ color: "var(--amber)" }}>&gt; 0,35 → AUMENTAR 0,2 mmol/L</p>
              </div>
            </div>
          </details>
        </div>
      )}

      {p.anticoag === "heparina" && (
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Heparina bolus" unit="UI/kg" value={p.hepBolus ?? ""} onChange={v => set("hepBolus", v)}
            placeholder="Ex: 50" />
          <NumInput label="Heparina contínua" unit="UI/kg/h" value={p.hepContinua ?? ""} onChange={v => set("hepContinua", v)}
            placeholder="Ex: 10" />
        </div>
      )}

      <Field label="Outros / Observações">
        <textarea value={p.outros ?? ""} onChange={e => set("outros", e.target.value)}
          rows={2} className="nc-input" placeholder="Observações adicionais" />
      </Field>
    </div>
  );
}

// ─── Prescrição DP ────────────────────────────────────────────────────────────

function FormDP({ p, set, peso }: { p: Record<string, string>; set: (k: string, v: string) => void; peso: number | null }) {
  const volPorCiclo = (peso && n(p.volMlKg ?? "")) ? Math.round(peso * n(p.volMlKg ?? "")) : null;
  const tTrocaMin = (n(p.tInfusao ?? "") + n(p.tPermanencia ?? "") + n(p.tDrenagem ?? "")) || null;
  const totalTrocas = n(p.trocas ?? "");

  return (
    <div className="space-y-5">
      <div className="rounded-(--nc-radius-lg) p-3" style={{ background: "var(--amber-dim)", border: "1px solid var(--amber)" }}>
        <p className="text-sm font-bold" style={{ color: "var(--amber)" }}>
          ⚠ DP Intermitente — protocolo pediátrico (HC-UFTM / UTI-NEO)
        </p>
      </div>

      {/* Solução */}
      <Toggle label="Solução" value={p.solucao ?? ""} onChange={v => set("solucao", v)}
        options={[
          { value: "1.5%", label: "Glicose 1,5%" },
          { value: "2.5%", label: "Glicose 2,5%" },
          { value: "4.25%", label: "Glicose 4,25%" },
        ]} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <NumInput label="Volume" unit="mL/kg" value={p.volMlKg ?? ""} onChange={v => set("volMlKg", v)}
          placeholder="10" hint={volPorCiclo ? `= ${volPorCiclo} mL/ciclo` : "Padrão: 10 mL/kg"} />
        <NumInput label="Número de trocas" value={p.trocas ?? ""} onChange={v => set("trocas", v)}
          placeholder="20" />
        <NumInput label="Tempo de infusão" unit="min" value={p.tInfusao ?? ""} onChange={v => set("tInfusao", v)}
          placeholder="10" />
        <NumInput label="Tempo de permanência" unit="min" value={p.tPermanencia ?? ""} onChange={v => set("tPermanencia", v)}
          placeholder="20" />
        <NumInput label="Tempo de drenagem" unit="min" value={p.tDrenagem ?? ""} onChange={v => set("tDrenagem", v)}
          placeholder="10" hint={tTrocaMin ? `${tTrocaMin} min/ciclo` : ""} />
        {tTrocaMin && !isNaN(totalTrocas) && (
          <div className="flex flex-col justify-end">
            <div className="rounded-(--nc-radius) p-2.5" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
              <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text3)" }}>Duração total</p>
              <p className="text-lg font-black" style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>
                {fmtN(Math.round(tTrocaMin * totalTrocas / 60), 1)} h
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Heparina */}
      <Toggle label="Heparina (se fibrina)" value={p.heparina ?? "nao"} onChange={v => set("heparina", v)}
        options={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim — 500 UI/L" }]} />

      <Field label="Outros / Observações">
        <textarea value={p.outros ?? ""} onChange={e => set("outros", e.target.value)}
          rows={2} className="nc-input" placeholder="Observações adicionais" />
      </Field>
    </div>
  );
}

// ─── Prescrição TPE ───────────────────────────────────────────────────────────

function FormTPE({ p, set, peso }: { p: Record<string, string>; set: (k: string, v: string) => void; peso: number | null }) {
  const ht = n(p.hematocrito ?? "");
  const vs = (peso && !isNaN(peso)) ? Math.round(peso * 70) : null;
  const vp = (vs !== null && !isNaN(ht)) ? Math.round(vs * (1 - ht / 100)) : null;
  const vtt = vp !== null ? Math.round(vp * 1.5) : null;
  const hepBolus = (peso) ? Math.round(peso * 70) : null;
  const hepContinua = (peso) ? Math.round(peso * 15) : null;
  const setTpe = (peso && !isNaN(peso)) ? (peso < 9 ? "—" : peso <= 29 ? "TPE 1000 (9–29 kg)" : "TPE 2000 (>30 kg)") : null;
  const nEsquemas = vtt ? Math.ceil(vtt / 1000) : null;

  return (
    <div className="space-y-5">

      {/* Volumes calculados */}
      {vtt !== null && (
        <div className="rounded-(--nc-radius-lg) border p-4 space-y-3"
          style={{ background: "var(--accent-dim)", borderColor: "var(--border2)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>Volumes calculados automaticamente</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Vol. sangue (Peso×70)", value: vs, unit: "mL" },
              { label: "Vol. plasma (VS×(1−Ht))", value: vp, unit: "mL" },
              { label: "VTT (VP×1,5)", value: vtt, unit: "mL" },
            ].map(({ label, value, unit }) => (
              <div key={label} className="rounded-(--nc-radius) border p-2.5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text3)" }}>{label}</p>
                <p className="text-xl font-black" style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>
                  {value} <span className="text-xs font-normal" style={{ color: "var(--text3)" }}>{unit}</span>
                </p>
              </div>
            ))}
          </div>
          {setTpe && <p className="text-sm" style={{ color: "var(--accent)" }}>Set: <strong>{setTpe}</strong></p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <NumInput label="Hematócrito" unit="%" value={p.hematocrito ?? ""} onChange={v => set("hematocrito", v)}
          placeholder="Ex: 30" obrigatorio />
        <NumInput label="Fluxo de sangue (Qb)" unit="mL/min" value={p.qb ?? ""} onChange={v => set("qb", v)}
          placeholder="ex.: 120" />
        <NumInput label="Temperatura" unit="°C" value={p.temperatura ?? ""} onChange={v => set("temperatura", v)}
          placeholder="ex.: 38,5" hint="Aquecedor: Thermax" />
        <NumInput label="Duração estimada" unit="h" value={p.duracao ?? ""} onChange={v => set("duracao", v)}
          placeholder="ex.: 2,5" hint="Depende do VTT" />
        <NumInput label="Número de sessões" value={p.nSessoes ?? ""} onChange={v => set("nSessoes", v)}
          placeholder="ex.: 5" />
      </div>

      {/* Anticoagulação */}
      <Toggle label="Anticoagulação" value={p.anticoag ?? "heparina"} onChange={v => set("anticoag", v)}
        options={[
          { value: "heparina", label: "Heparina" },
          { value: "citrato", label: "Citrato" },
        ]} />

      {(p.anticoag ?? "heparina") === "heparina" && hepBolus !== null && (
        <div className="rounded-(--nc-radius) p-3" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-bold mb-1" style={{ color: "var(--text)" }}>Heparina calculada (70 UI/kg bolus · 15 UI/kg/h contínua)</p>
          <p className="text-sm" style={{ color: "var(--accent)" }}>
            Bolus: <strong>{hepBolus} UI</strong> · Contínua: <strong>{hepContinua} UI/h</strong>
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>
            Diluir heparina 2 mL (10.000 UI) em 18 mL SF 0,9%
          </p>
        </div>
      )}

      {/* Solução de reposição */}
      <Toggle label="Solução de reposição" value={p.reposicao ?? ""} onChange={v => set("reposicao", v)}
        options={[
          { value: "albumina4", label: "Albumina 4%" },
          { value: "albumina5", label: "Albumina 5%" },
          { value: "pfc", label: "PFC" },
          { value: "misto", label: "Misto (50% PFC + 50% Alb.)" },
        ]} />

      {(p.reposicao === "albumina4" || p.reposicao === "albumina5") && nEsquemas !== null && (
        <div className="rounded-(--nc-radius) p-3" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
          {p.reposicao === "albumina4" && (
            <p className="text-sm" style={{ color: "var(--text)" }}>
              <strong>{nEsquemas} esquema(s)</strong> de: SF 0,9% 800 mL + 4 frascos Albumina 20%
            </p>
          )}
          {p.reposicao === "albumina5" && (
            <p className="text-sm" style={{ color: "var(--text)" }}>
              <strong>{nEsquemas} esquema(s)</strong> de: SF 0,9% 750 mL + 5 frascos Albumina 20%
            </p>
          )}
          <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>
            Monitorar TP, TTPa e fibrinogênio a cada 3–4 sessões
          </p>
        </div>
      )}

      <Field label="Outros / Observações">
        <textarea value={p.outros ?? ""} onChange={e => set("outros", e.target.value)}
          rows={2} className="nc-input" placeholder="Indicação, patologia, observações" />
      </Field>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface AbaTerapiaDialiticaProps {
  acompanhamento: AcompanhamentoNefro;
  paciente: Paciente;
  internacao: Internacao;
  medico?: { nome: string; titulo?: string | null; crm?: string | null } | null;
}

export function AbaTerapiaDialitica({ acompanhamento, paciente, internacao, medico }: AbaTerapiaDialiticaProps) {
  const [modalidade, setModalidade] = useState<Modalidade | "">("");
  const [salvando, setSalvando] = useState(false);
  type PrescricaoSalva = { id: string; modalidade: string; created_at: string; texto_prescricao?: string; dados?: { paciente?: Record<string, string>; prescricao?: Record<string, string> } };
  const [prescricoesSalvas, setPrescricoesSalvas] = useState<PrescricaoSalva[]>([]);
  const [versaoLista, setVersaoLista] = useState(0);
  const [prescricaoAberta, setPrescricaoAberta] = useState<string | null>(null);

  const [dadosPaciente, setDadosPacienteState] = useState<Record<string, string>>(() => {
    let idade = "";
    if (paciente.data_nascimento) {
      const nasc = new Date(paciente.data_nascimento);
      const hoje = new Date();
      let anos = hoje.getFullYear() - nasc.getFullYear();
      if (hoje.getMonth() < nasc.getMonth() ||
        (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) anos--;
      idade = String(anos);
    }
    return {
      nome: paciente.nome,
      rgHospitalar: paciente.rg_hospitalar,
      peso: "",
      idade,
      sexo: paciente.sexo ?? "",
      acesso: "",
      acessoLado: "",
      leito: internacao.enfermaria_leito
        ? `${internacao.setor.replace(/_/g, " ")} — ${internacao.enfermaria_leito}`
        : internacao.setor.replace(/_/g, " "),
      diagnostico: acompanhamento.diagnostico_principal?.replace(/_/g, " ") ?? "",
    };
  });

  const [prescricao, setPrescricaoState] = useState<Record<string, string>>({});

  function setPaciente(k: string, v: string) { setDadosPacienteState(p => ({ ...p, [k]: v })); }
  function setParam(k: string, v: string) { setPrescricaoState(p => ({ ...p, [k]: v })); }

  useEffect(() => {
    let ativo = true;
    buscarPrescricoes(acompanhamento.id).then(r => {
      if (ativo && r.sucesso) setPrescricoesSalvas(r.dados as PrescricaoSalva[]);
    });
    return () => { ativo = false; };
  }, [acompanhamento.id, versaoLista]);

  const modalidadeCfg = MODALIDADES.find(m => m.value === modalidade);
  const pesoBrigatorio = modalidadeCfg?.pesoBrigatorio ?? false;
  const peso = n(dadosPaciente.peso ?? "");
  const pesoValido = !pesoBrigatorio || (!isNaN(peso) && peso > 0);

  const acessoBase = modalidade === "DP" ? "Cateter Tenckhoff" : dadosPaciente.acesso;
  const acessoCompleto = [acessoBase, modalidade === "DP" ? "" : dadosPaciente.acessoLado].filter(Boolean).join(" — ");

  // Fonte única: a prévia na tela, o texto salvo e a impressão usam estas mesmas linhas
  const linhasPrescricao = useMemo<LinhasPrescricao[]>(() => {
    if (!modalidade) return [];
    const pesoNum = parseFloat(dadosPaciente.peso?.replace(",", ".") ?? "");
    const pesoVal = isNaN(pesoNum) ? null : pesoNum;
    if (modalidade === "HD") return gerarLinhasHD(prescricao);
    if (modalidade === "CVVHDF") return gerarLinhasCVVHDF(prescricao, pesoVal);
    if (modalidade === "DP") return gerarLinhasDP(prescricao, pesoVal);
    return gerarLinhasTPE(prescricao, pesoVal);
  }, [modalidade, dadosPaciente.peso, prescricao]);

  const texto = useMemo(() => {
    if (!modalidade) return "";
    const cabecalho = [
      dadosPaciente.nome ? `Paciente: ${dadosPaciente.nome}` : null,
      dadosPaciente.rgHospitalar ? `RG: ${dadosPaciente.rgHospitalar}` : null,
      dadosPaciente.idade ? `Idade: ${dadosPaciente.idade} anos` : null,
      dadosPaciente.leito ? `Leito: ${dadosPaciente.leito}` : null,
      dadosPaciente.diagnostico ? `Diagnóstico: ${dadosPaciente.diagnostico}` : null,
      acessoCompleto ? `Acesso vascular: ${acessoCompleto}` : null,
      medico?.nome ? `Prescritor: ${[medico.titulo ? medico.titulo + "." : "", medico.nome].filter(Boolean).join(" ")}${medico.crm ? ` — CRM-MG ${medico.crm.replace(/^\s*CRM[-\s]*(MG)?[\s-]*/i, "")}` : ""}` : null,
    ].filter(Boolean) as string[];
    const corpo = linhasPrescricao.map(l => `${l.label}: ${l.valor}`);
    return [...cabecalho, "", ...corpo].join("\n");
  }, [modalidade, dadosPaciente, acessoCompleto, linhasPrescricao, medico]);

  async function handleSalvar() {
    if (!modalidade) return;
    setSalvando(true);
    const r = await salvarPrescricao({
      acompanhamentoId: acompanhamento.id,
      modalidade,
      dados: { paciente: dadosPaciente, prescricao },
      metricas: {},
      textoPrescricao: texto,
    });
    setSalvando(false);
    if (!r.sucesso) { window.alert("Não foi possível salvar a prescrição."); return; }
    setVersaoLista(v => v + 1);
  }

  function imprimirSalva(p: PrescricaoSalva) {
    abrirJanelaImpressao(montarDadosImpressao(
      p.modalidade,
      p.dados?.paciente ?? {},
      p.dados?.prescricao ?? {},
      medico,
      new Date(p.created_at),
    ));
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir esta prescrição?")) return;
    await excluirPrescricao(id);
    setPrescricoesSalvas(p => p.filter(x => x.id !== id));
  }

  function carregarNosInputs(p: { modalidade: string; dados?: { paciente?: Record<string, string>; prescricao?: Record<string, string> } }) {
    if (p.dados?.paciente) setDadosPacienteState(prev => ({ ...prev, ...p.dados!.paciente }));
    if (p.dados?.prescricao) setPrescricaoState(p.dados.prescricao);
    setModalidade(p.modalidade as Modalidade);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-5">

      {/* Seletor de modalidade */}
      <div className="nc-card p-4">
        <p className="nc-label mb-3">Modalidade de TSR</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MODALIDADES.map(m => (
            <button key={m.value}
              onClick={() => { setModalidade(m.value); setPrescricaoState({}); }}
              className="flex h-full min-h-[92px] w-full cursor-pointer flex-col justify-center rounded-(--nc-radius-lg) border p-3 text-left transition hover:opacity-90"
              style={{
                background: modalidade === m.value ? "var(--accent)" : "var(--card)",
                borderColor: modalidade === m.value ? "var(--accent)" : "var(--border)",
                color: modalidade === m.value ? "white" : "var(--text)",
              }}>
              <p className="flex min-h-[2.6rem] items-center text-sm font-black leading-tight" style={{ fontFamily: "var(--mono)" }}>{m.label}</p>
              <p className="mt-1 min-h-[2.2rem] text-[11px] leading-snug" style={{ color: modalidade === m.value ? "rgba(255,255,255,0.7)" : "var(--text3)" }}>
                {m.sub}
              </p>
            </button>
          ))}
        </div>
      </div>

      {modalidade && (
        <>
          {/* Dados do paciente */}
          <div className="nc-card p-4">
            <p className="nc-label mb-3">Dados do paciente</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-3">
              <div className="col-span-2 flex flex-col gap-1">
                <label className="nc-label" style={{ marginBottom: 0 }}>Nome</label>
                <input value={dadosPaciente.nome} onChange={e => setPaciente("nome", e.target.value)} className="nc-input" />
              </div>
              <Field label="RG hospitalar">
                <input value={dadosPaciente.rgHospitalar} onChange={e => setPaciente("rgHospitalar", e.target.value)} className="nc-input" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {modalidade !== "HD" && (
                <NumInput
                  label={`Peso${pesoBrigatorio ? " *" : ""}`} unit="kg" obrigatorio={pesoBrigatorio}
                  value={dadosPaciente.peso} onChange={v => setPaciente("peso", v)}
                  placeholder="kg" hint={pesoBrigatorio ? "Obrigatório para cálculos" : undefined}
                />
              )}
              <NumInput label="Idade" unit="anos" value={dadosPaciente.idade} onChange={v => setPaciente("idade", v)} placeholder="anos" />
              <div className="flex flex-col gap-1">
                <label className="nc-label" style={{ marginBottom: 0 }}>Acesso vascular</label>
                {modalidade === "DP" ? (
                  <input value="Cateter Tenckhoff" readOnly className="nc-input"
                    style={{ background: "var(--card2)", color: "var(--text3)", cursor: "not-allowed" }} />
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <select value={dadosPaciente.acesso} onChange={e => setPaciente("acesso", e.target.value)}
                      className="nc-input cursor-pointer" style={{ flex: 1, minWidth: 0 }}>
                      <option value="">—</option>
                      <option>CDL jugular</option>
                      <option>CDL femoral</option>
                      <option>CDL subclávia</option>
                      <option>FAV</option>
                      <option>Permcath</option>
                    </select>
                    <select value={dadosPaciente.acessoLado ?? ""} onChange={e => setPaciente("acessoLado", e.target.value)}
                      className="nc-input cursor-pointer" style={{ width: 110 }} aria-label="Lado do acesso">
                      <option value="">Lado</option>
                      <option value="Direito">Direito</option>
                      <option value="Esquerdo">Esquerdo</option>
                    </select>
                  </div>
                )}
              </div>
              <Field label="Leito">
                <input value={dadosPaciente.leito} onChange={e => setPaciente("leito", e.target.value)} className="nc-input" />
              </Field>
            </div>
            {pesoBrigatorio && !pesoValido && (
              <p className="mt-2 text-xs font-semibold" style={{ color: "var(--red)" }}>
                ⚠ Peso obrigatório para {modalidade === "CVVHDF" ? "CVVHDF" : modalidade === "DP" ? "DP (cálculo de volume)" : "TPE (cálculo de VTT)"}
              </p>
            )}
          </div>

          {/* Formulário específico da modalidade */}
          <div className="nc-card p-4">
            <p className="nc-label mb-3">Parâmetros — {modalidadeCfg?.label}</p>
            {modalidade === "HD" && <FormHD p={prescricao} set={setParam} />}
            {modalidade === "CVVHDF" && <FormCVVHDF p={prescricao} set={setParam} peso={isNaN(peso) ? null : peso} />}
            {modalidade === "DP" && <FormDP p={prescricao} set={setParam} peso={isNaN(peso) ? null : peso} />}
            {modalidade === "TPE" && <FormTPE p={prescricao} set={setParam} peso={isNaN(peso) ? null : peso} />}
          </div>

          {/* Salvar: a prescrição passa a aparecer na lista de prescrições salvas */}
          <div className="flex justify-end">
            <button onClick={handleSalvar} disabled={salvando || (pesoBrigatorio && !pesoValido)}
              className="nc-btn nc-btn-primary disabled:opacity-40">
              {salvando ? "Salvando..." : "💾 Salvar prescrição"}
            </button>
          </div>
        </>
      )}

      {/* Prescrições salvas: lista única (ver, imprimir, carregar nos campos, excluir) */}
      <div className="nc-card overflow-hidden">
        <div style={{ background: "#1e3a5f", padding: "10px 16px" }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "white" }}>
            Prescrições salvas ({prescricoesSalvas.length})
          </span>
        </div>

        {prescricoesSalvas.length === 0 ? (
          <p className="px-4 py-3 text-sm" style={{ color: "var(--text3)" }}>Nenhuma prescrição salva.</p>
        ) : (
          prescricoesSalvas.map(p => {
            const aberta = prescricaoAberta === p.id;
            const botao = { padding: "3px 10px", fontSize: 12, fontWeight: 700, borderRadius: "var(--nc-radius)", cursor: "pointer" } as const;
            return (
              <div key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>{p.modalidade}</span>
                    <span className="text-xs" style={{ color: "var(--text3)" }}>{fmtDt(p.created_at)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setPrescricaoAberta(aberta ? null : p.id)}
                      style={{ ...botao, color: "var(--accent)", background: "var(--card)", border: "1px solid var(--border)" }}>
                      {aberta ? "▴ Ocultar" : "👁 Ver"}
                    </button>
                    <button onClick={() => imprimirSalva(p)}
                      style={{ ...botao, color: "white", background: "#1e3a5f", border: "none" }}>
                      🖨 Imprimir
                    </button>
                    <button onClick={() => carregarNosInputs(p)}
                      style={{ ...botao, color: "var(--accent)", background: "var(--accent-dim)", border: "1px solid var(--accent)" }}>
                      Copiar prescrição
                    </button>
                    <button onClick={() => handleExcluir(p.id)}
                      style={{ ...botao, color: "var(--red)", background: "none", border: "none" }}>
                      Excluir
                    </button>
                  </div>
                </div>
                {aberta && (
                  <pre style={{ padding: "12px 16px", fontSize: 13, lineHeight: 1.8, color: "var(--text)", background: "var(--card)", whiteSpace: "pre-wrap", fontFamily: "var(--mono)", margin: 0 }}>
                    {p.texto_prescricao ?? "Texto não disponível para esta prescrição."}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
