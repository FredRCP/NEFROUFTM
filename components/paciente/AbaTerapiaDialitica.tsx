"use client";

import { useState, useMemo } from "react";
import type { Paciente, Internacao, AcompanhamentoNefro } from "@/types/database";
import { salvarPrescricao, buscarPrescricoes, excluirPrescricao } from "@/lib/actions/prescricoes";

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
          { value: "HD Estendida", label: "HD Estendida (SLED)" },
          { value: "Ultrafiltração isolada", label: "Ultrafiltração isolada" },
        ]} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <NumInput label="Tempo" unit="h" value={p.tempoH ?? ""} onChange={v => set("tempoH", v)}
          placeholder={p.submodalidade === "HD Estendida" ? "6–12" : "3–4"} />
        <NumInput label="Ultrafiltração (perdas)" unit="mL" value={p.ufMl ?? ""} onChange={v => set("ufMl", v)}
          placeholder="0 = sem perdas" />
        <NumInput label="Fluxo de sangue (Qb)" unit="mL/min" value={p.qb ?? ""} onChange={v => set("qb", v)}
          placeholder={p.submodalidade === "HD Estendida" ? "150–200" : "250–350"} />
        {/* Qd — oculto na UF isolada */}
        {!isUF && (
          <NumInput label="Fluxo de dialisato (Qd)" unit="mL/min" value={p.qd ?? ""} onChange={v => set("qd", v)}
            placeholder={p.submodalidade === "HD Estendida" ? "300" : "500"} />
        )}
        {/* Na — oculto na UF isolada */}
        {!isUF && (
          <NumInput label="Sódio (Na)" unit="mEq/L" value={p.sodio ?? ""} onChange={v => set("sodio", v)}
            placeholder="138–145" />
        )}
        <NumInput label="Temperatura" unit="°C" value={p.temperatura ?? ""} onChange={v => set("temperatura", v)}
          placeholder="35–37" />
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

      {/* Heparina */}
      <Toggle label="Heparina" value={p.heparina ?? ""} onChange={v => set("heparina", v)}
        options={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]} />
      {p.heparina === "sim" && (
        <NumInput label="Dose de heparina" unit="mL" value={p.heparinaQtd ?? ""} onChange={v => set("heparinaQtd", v)}
          placeholder="Ex: 1,0" hint="Dose em bolus no início" />
      )}

      {/* Lavagem do sistema */}
      <Toggle label="Lavagem do sistema" value={p.lavagem ?? ""} onChange={v => set("lavagem", v)}
        options={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]} />

      {/* Cálcio do dialisato — oculto na UF isolada */}
      {!isUF && (
        <Toggle label="Cálcio do dialisato" value={p.calcio ?? ""} onChange={v => set("calcio", v)}
          options={[
            { value: "padrao", label: "Cálcio padrão (3,0 mEq/L)" },
            { value: "baixo", label: "Baixo cálcio (1,25 mEq/L)" },
          ]} />
      )}

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
          placeholder="100–130" hint="Protocolo HC-UFTM: 100–130" />
        <NumInput label="Dose total" unit="mL/h" value={p.dose ?? ""} onChange={v => set("dose", v)}
          placeholder={doseAlvoMin ? `${doseAlvoMin}–${doseAlvoMax}` : "Ex: 1800"}
          hint={dosePorKg ? `≈ ${dosePorKg} mL/kg/h` : doseAlvoMin ? `Alvo: ${doseAlvoMin}–${doseAlvoMax} mL/h` : "Alvo: 30–35 mL/kg/h (sepse)"} />
        <NumInput label="Reposição pós-filtro" unit="mL/h" value={p.reposicaoPos ?? ""} onChange={v => set("reposicaoPos", v)}
          placeholder="200" hint="Padrão: 200 mL/h" />
        <NumInput label="UF líquida" unit="mL/h" value={p.ufLiquida ?? ""} onChange={v => set("ufLiquida", v)}
          placeholder="0 / 50 / 80" hint="Balanço hídrico alvo" />
        <NumInput label="Temperatura" unit="°C" value={p.temperatura ?? ""} onChange={v => set("temperatura", v)}
          placeholder="38–40" hint="Protocolo: 38–40°C" />
        <Field label="Set / Capilar">
          <input value={p.set ?? ""} onChange={e => set("set", e.target.value)}
            className="nc-input" placeholder="oXiris ou ST150" />
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
              onChange={v => set("calcioSistemico", v)} placeholder="1,0–1,2" hint="Sangue do paciente" />
            <NumInput label="Ca iônico pós-filtro" unit="mmol/L" value={p.calcioPosFiltro ?? ""}
              onChange={v => set("calcioPosFiltro", v)} placeholder="0,25–0,35" hint="Leitura da máquina" />
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
          placeholder="100–150" />
        <NumInput label="Temperatura" unit="°C" value={p.temperatura ?? ""} onChange={v => set("temperatura", v)}
          placeholder="38–40" hint="Aquecedor: Thermax" />
        <NumInput label="Duração estimada" unit="h" value={p.duracao ?? ""} onChange={v => set("duracao", v)}
          placeholder="2–3" hint="Depende do VTT" />
        <NumInput label="Número de sessões" value={p.nSessoes ?? ""} onChange={v => set("nSessoes", v)}
          placeholder="Depende da patologia" />
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

// ─── Gerador de texto de prescrição ──────────────────────────────────────────

function gerarTexto(modalidade: Modalidade, dadosPac: Record<string, string>, p: Record<string, string>): string {
  const peso = n(dadosPac.peso ?? "");
  const ht = n(p.hematocrito ?? "");
  const vs = (!isNaN(peso)) ? Math.round(peso * 70) : null;
  const vp = (vs !== null && !isNaN(ht)) ? Math.round(vs * (1 - ht / 100)) : null;
  const vtt = vp !== null ? Math.round(vp * 1.5) : null;

  const linhas: string[] = [
    `Modalidade de TSR: ${
      modalidade === "HD" ? (p.submodalidade ?? "HD") :
      modalidade === "CVVHDF" ? "CVVHDF" :
      modalidade === "DP" ? "DPI" : "TPE — Plasmaférese"
    }`,
  ];

  if (modalidade === "HD") {
    if (p.tempoH)     linhas.push(`Tempo: ${p.tempoH}h`);
    const uf = p.ufMl ? (n(p.ufMl) === 0 ? "Sem perdas" : `${p.ufMl} mL`) : null;
    if (uf)           linhas.push(`UF: ${uf}`);
    const hepStr = p.heparina === "sim"
      ? `${p.heparinaQtd ? p.heparinaQtd + " mL" : "Sim"}`
      : "Sem heparina";
    linhas.push(`Heparina: ${hepStr}`);
    if (p.lavagem)    linhas.push(`Lavagem do sistema: ${p.lavagem === "sim" ? "Sim" : "Não"}`);
    if (p.qb)         linhas.push(`Fluxo de Sangue: ${p.qb} mL/min`);
    if (p.qd)         linhas.push(`Fluxo de Dialisato: ${p.qd} mL/min`);
    if (p.sodio)      linhas.push(`Na: ${p.sodio}`);
    if (p.temperatura)linhas.push(`Temperatura: ${p.temperatura}°C`);
    if (p.capilar)    linhas.push(`Capilar: ${p.capilar}`);
    if (p.bic)        linhas.push(`BIC: ${p.bic}`);
    const calcStr = p.calcio === "baixo" ? "Baixo cálcio (1,25 mEq/L)" : "Cálcio padrão (3,0 mEq/L)";
    linhas.push(`Cálcio do dialisato: ${calcStr}`);
    if (p.glicose === "sim") linhas.push(`Glicose 50% 2 amp ACM`);
    if (p.nacl === "sim")    linhas.push(`NaCl 20% 10 mL/hora ACM`);
    if (p.outros?.trim())    linhas.push(`Outros: ${p.outros.trim()}`);
  }

  if (modalidade === "CVVHDF") {
    if (!isNaN(peso) && p.hematocrito) linhas.push(`Hematócrito: ${p.hematocrito}%   Peso: ${dadosPac.peso} kg`);
    if (p.qb) linhas.push(`Fluxo de Sangue: ${p.qb} mL/min`);
    if (p.dose) {
      const doseKg = (!isNaN(peso) && !isNaN(n(p.dose))) ? (n(p.dose) / peso).toFixed(1) : null;
      linhas.push(`Dose: ${p.dose} mL/hora${doseKg ? ` (≈ ${doseKg} mL/kg/h)` : ""}`);
    }
    if (p.set) linhas.push(`SET: ${p.set}`);
    const anticoag = p.anticoag ?? "regiocit";
    if (anticoag === "regiocit") {
      const regVol = !isNaN(n(p.qb ?? "")) ? n(p.qb!) * 10 : null;
      linhas.push(`Anticoagulação: Citrato 0,5% (Regiocit) = 3 mmol/L${regVol ? `; Volume: ${regVol} mL/hora` : ""}`);
      if (p.infusaoCalcio) linhas.push(`Compensação de cálcio atual: ${p.infusaoCalcio} mL/h (CaCl₂ 10%)`);
    } else if (anticoag === "heparina") {
      const bolus = (!isNaN(peso) && p.hepBolus) ? Math.round(n(p.hepBolus) * peso) : null;
      linhas.push(`Anticoagulação: Heparina${bolus ? ` — bolus ${bolus} UI` : ""}`);
    } else {
      linhas.push(`Sem anticoagulação`);
    }
    if (p.reposicaoPos) linhas.push(`Reposição pós-filtro: ${p.reposicaoPos} mL/hora`);
    if (!isNaN(n(p.reposicaoPos ?? "")) && !isNaN(n(p.qb ?? ""))) {
      const biphosyl = n(p.dose ?? "") - n(p.reposicaoPos ?? "") - n(p.qb ?? "") * 10;
      if (!isNaN(biphosyl)) linhas.push(`Dialisato (Biphosyl): ${Math.round(biphosyl)} mL/hora`);
    }
    if (p.ufLiquida) linhas.push(`Ultrafiltração efetiva: ${p.ufLiquida} mL/hora`);
    if (p.temperatura) linhas.push(`Temperatura: ${p.temperatura}°C`);
    if (p.outros?.trim()) linhas.push(`Outros: ${p.outros.trim()}`);
  }

  if (modalidade === "DP") {
    if (p.solucao) linhas.push(`Solução: Glicose ${p.solucao}`);
    if (p.trocas)  linhas.push(`Trocas: ${p.trocas}`);
    if (p.tInfusao) linhas.push(`Tempo de Infusão: ${p.tInfusao} min`);
    if (p.tPermanencia) linhas.push(`Tempo de Permanência: ${p.tPermanencia} min`);
    if (p.tDrenagem) linhas.push(`Tempo de Drenagem: ${p.tDrenagem} min`);
    if (p.volMlKg) {
      const volTotal = (!isNaN(peso) && !isNaN(n(p.volMlKg))) ? Math.round(peso * n(p.volMlKg)) : null;
      linhas.push(`Volume: ${p.volMlKg} mL/kg${volTotal ? ` (${volTotal} mL/ciclo)` : ""}`);
    }
    linhas.push(`Heparina: ${p.heparina === "sim" ? "500 UI/L se fibrina" : "Não"}`);
    if (p.outros?.trim()) linhas.push(`Outros: ${p.outros.trim()}`);
  }

  if (modalidade === "TPE") {
    if (!isNaN(peso)) {
      linhas.push(`Peso: ${dadosPac.peso} kg   Hematócrito: ${p.hematocrito ?? "—"}%`);
      if (vtt !== null) linhas.push(`Volume Total de Troca (VTT): ${vtt} mL`);
      const set = peso < 9 ? "—" : peso <= 29 ? "TPE 1000 (9–29 kg)" : "TPE 2000 (>30 kg)";
      linhas.push(`SET: ${set}`);
    }
    if (p.qb) linhas.push(`Fluxo de Sangue: ${p.qb} mL/min`);
    if (p.temperatura) linhas.push(`Temperatura: ${p.temperatura}°C   Aquecedor: Thermax`);
    if (p.duracao) linhas.push(`Duração estimada: ${p.duracao}h`);
    if (p.nSessoes) linhas.push(`Número de sessões: ${p.nSessoes}`);
    const anticoag = p.anticoag ?? "heparina";
    if (anticoag === "heparina") {
      const hepBol = !isNaN(peso) ? Math.round(peso * 70) : null;
      const hepCont = !isNaN(peso) ? Math.round(peso * 15) : null;
      linhas.push(`Anticoagulação: Heparina — ${hepBol ? `Bolus: ${hepBol} UI; ` : ""}Contínua: ${hepCont ?? "—"} UI/h`);
    } else {
      linhas.push(`Anticoagulação: Citrato`);
    }
    const repMap: Record<string, string> = {
      albumina4: "Albumina 4% (SF 800 mL + 4 fr Albumina 20%)",
      albumina5: "Albumina 5% (SF 750 mL + 5 fr Albumina 20%)",
      pfc: "Plasma Fresco Congelado",
      misto: "Misto: 50% PFC + 50% Albumina",
    };
    if (p.reposicao) linhas.push(`Reposição: ${repMap[p.reposicao] ?? p.reposicao}`);
    if (p.outros?.trim()) linhas.push(`Outros: ${p.outros.trim()}`);
  }

  const pacStr = [
    dadosPac.nome ? `Paciente: ${dadosPac.nome}` : null,
    dadosPac.rgHospitalar ? `RG: ${dadosPac.rgHospitalar}` : null,
    dadosPac.leito ? `Leito: ${dadosPac.leito}` : null,
    dadosPac.diagnostico ? `Diagnóstico: ${dadosPac.diagnostico}` : null,
  ].filter(Boolean);

  return [...pacStr, "", ...linhas].join("\n");
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface AbaTerapiaDialiticaProps {
  acompanhamento: AcompanhamentoNefro;
  paciente: Paciente;
  internacao: Internacao;
}

export function AbaTerapiaDialitica({ acompanhamento, paciente, internacao }: AbaTerapiaDialiticaProps) {
  const [modalidade, setModalidade] = useState<Modalidade | "">("");
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [prescricoesSalvas, setPrescricoesSalvas] = useState<{ id: string; modalidade: string; created_at: string; texto_prescricao?: string }[]>([]);
  const [carregouHistorico, setCarregouHistorico] = useState(false);
  const [verHistorico, setVerHistorico] = useState(false);
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
      leito: internacao.enfermaria_leito
        ? `${internacao.setor.replace(/_/g, " ")} — leito ${internacao.enfermaria_leito}`
        : internacao.setor.replace(/_/g, " "),
      diagnostico: acompanhamento.diagnostico_principal?.replace(/_/g, " ") ?? "",
    };
  });

  const [prescricao, setPrescricaoState] = useState<Record<string, string>>({});

  function setPaciente(k: string, v: string) { setDadosPacienteState(p => ({ ...p, [k]: v })); }
  function setParam(k: string, v: string) { setPrescricaoState(p => ({ ...p, [k]: v })); }

  const modalidadeCfg = MODALIDADES.find(m => m.value === modalidade);
  const pesoBrigatorio = modalidadeCfg?.pesoBrigatorio ?? false;
  const peso = n(dadosPaciente.peso ?? "");
  const pesoValido = !pesoBrigatorio || (!isNaN(peso) && peso > 0);

  const texto = useMemo(() => {
    if (!modalidade) return "";
    return gerarTexto(modalidade as Modalidade, dadosPaciente, prescricao);
  }, [modalidade, dadosPaciente, prescricao]);

  async function carregarHistorico() {
    if (carregouHistorico) return;
    const r = await buscarPrescricoes(acompanhamento.id);
    if (r.sucesso) setPrescricoesSalvas(r.dados as { id: string; modalidade: string; created_at: string; texto_prescricao?: string }[]);
    setCarregouHistorico(true);
  }

  async function handleSalvar() {
    if (!modalidade) return;
    setSalvando(true);
    await salvarPrescricao({
      acompanhamentoId: acompanhamento.id,
      modalidade,
      dados: { paciente: dadosPaciente, prescricao },
      metricas: {},
      textoPrescricao: texto,
    });
    setSalvando(false);
    setCarregouHistorico(false);
    await carregarHistorico();
    setCarregouHistorico(true);
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir esta prescrição?")) return;
    await excluirPrescricao(id);
    setPrescricoesSalvas(p => p.filter(x => x.id !== id));
  }

  async function copiarTexto() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch { /* ignora */ }
  }

  async function exportarPDF() {
    const src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    await new Promise<void>((res, rej) => {
      if ((window as unknown as Record<string, unknown>).jspdf) { res(); return; }
      const s = document.createElement("script");
      s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error("jsPDF falhou"));
      document.head.appendChild(s);
    });
    const win = window as unknown as Record<string, unknown>;
    const jspdfMod = win.jspdf as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const JsPDF = (jspdfMod?.jsPDF || win.jsPDF) as new (...args: any[]) => any;
    if (!JsPDF) return;
    const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, margin = 14;
    let y = 14;

    // Cabeçalho azul
    doc.setFillColor(30, 58, 95);
    doc.rect(margin, y, W - margin * 2, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("FOLHA DE PRESCRIÇÃO", W / 2, y + 6.5, { align: "center" });
    y += 10;

    doc.setFillColor(240, 244, 248);
    doc.rect(margin, y, W - margin * 2, 8, "F");
    doc.setTextColor(30, 58, 95);
    doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
    doc.text("HOSPITAL DE CLÍNICAS — UFTM / EBSERH   ·   SERVIÇO DE NEFROLOGIA", W / 2, y + 5, { align: "center" });
    y += 12;

    // Dados do paciente
    const dataHoje = new Date().toLocaleDateString("pt-BR");
    doc.setDrawColor(180, 200, 220);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, W - margin * 2, 16, "FD");
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
    doc.text(`Nome do Paciente: ${dadosPaciente.nome || "—"}`, margin + 3, y + 5);
    doc.text(`Registro Geral: ${dadosPaciente.rgHospitalar || "—"}`, margin + 3, y + 11);
    doc.text(`Leito: ${dadosPaciente.leito || "—"}`, W / 2 + 10, y + 5);
    doc.text(`Data: ${dataHoje}`, W / 2 + 10, y + 11);
    y += 20;

    // Header da prescrição
    doc.setFillColor(30, 58, 95);
    doc.rect(margin, y, W - margin * 2, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("PRESCRIÇÃO — TERAPIA RENAL SUBSTITUTIVA", W / 2, y + 4.8, { align: "center" });
    y += 10;

    // Linhas da prescrição
    const linhas = texto.split("\n").filter(l => l.trim());
    doc.setTextColor(20, 20, 20);
    linhas.forEach((linha, i) => {
      if (y > 260) { doc.addPage(); y = 20; }
      if (i === 0) {
        doc.setFont("helvetica", "bold");
        doc.setFillColor(220, 232, 245);
        doc.rect(margin, y - 1.5, W - margin * 2, 8, "F");
      } else {
        doc.setFont("helvetica", "normal");
        if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(margin, y - 1.5, W - margin * 2, 7, "F"); }
      }
      doc.setDrawColor(200, 215, 230);
      doc.line(margin, y + 5, W - margin, y + 5);
      doc.setFontSize(9.5);
      doc.text(linha, margin + 3, y + 3.5);
      y += i === 0 ? 8 : 7;
    });

    // Rodapé
    y += 10;
    doc.setDrawColor(30, 58, 95);
    doc.line(margin, y, W - margin, y);
    y += 5;
    doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(100, 100, 100);
    doc.text(`Gerado pelo NEFRO-UFTM em ${new Date().toLocaleString("pt-BR")}  ·  Nefrologia HC-UFTM/EBSERH — Uberaba, MG`, W / 2, y, { align: "center" });
    y += 15;
    doc.setDrawColor(150); doc.setFont("helvetica", "normal"); doc.setTextColor(40, 40, 40);
    doc.line(margin + 10, y, margin + 90, y);
    doc.setFontSize(8);
    doc.text("Médico responsável / CRM", margin + 10, y + 4);

    doc.save(`prescricao_${modalidade}_${(dadosPaciente.rgHospitalar || "paciente")}_${dataHoje.replace(/\//g, "-")}.pdf`);
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
              className="cursor-pointer rounded-(--nc-radius-lg) border p-3 text-left transition hover:opacity-90"
              style={{
                background: modalidade === m.value ? "var(--accent)" : "var(--card)",
                borderColor: modalidade === m.value ? "var(--accent)" : "var(--border)",
                color: modalidade === m.value ? "white" : "var(--text)",
              }}>
              <p className="text-sm font-black" style={{ fontFamily: "var(--mono)" }}>{m.label}</p>
              <p className="text-[11px] mt-0.5" style={{ color: modalidade === m.value ? "rgba(255,255,255,0.7)" : "var(--text3)" }}>
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
                  <select value={dadosPaciente.acesso} onChange={e => setPaciente("acesso", e.target.value)}
                    className="nc-input cursor-pointer">
                    <option value="">—</option>
                    <option>CDL jugular</option>
                    <option>CDL femoral</option>
                    <option>CDL subclávia</option>
                    <option>FAV</option>
                    <option>Permcath</option>
                  </select>
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

          {/* Prescrição gerada */}
          {texto && (
            <div className="nc-card overflow-hidden">
              <div style={{ background: "#1e3a5f", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>📋 Prescrição gerada</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={copiarTexto}
                    className="cursor-pointer rounded-full px-3 py-1 text-xs font-bold transition hover:opacity-80"
                    style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}>
                    {copiado ? "✓ Copiado!" : "⧉ Copiar"}
                  </button>
                  <button onClick={exportarPDF}
                    className="cursor-pointer rounded-full px-3 py-1 text-xs font-bold transition hover:opacity-80"
                    style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}>
                    📄 PDF
                  </button>
                  <button onClick={handleSalvar} disabled={salvando || (pesoBrigatorio && !pesoValido)}
                    className="cursor-pointer rounded-full px-3 py-1 text-xs font-bold transition hover:opacity-80 disabled:opacity-40"
                    style={{ background: "var(--green)", color: "white" }}>
                    {salvando ? "Salvando..." : "💾 Salvar"}
                  </button>
                </div>
              </div>
              <pre style={{
                padding: "16px", fontSize: 13, lineHeight: 1.8, color: "var(--text)",
                background: "var(--card)", whiteSpace: "pre-wrap", fontFamily: "var(--mono)",
                margin: 0,
              }}>
                {texto}
              </pre>
            </div>
          )}
        </>
      )}

      {/* Histórico */}
      <div className="nc-card overflow-hidden">
        <button onClick={async () => { if (!verHistorico) await carregarHistorico(); setVerHistorico(v => !v); }}
          className="flex w-full cursor-pointer items-center justify-between px-4 py-3 transition hover:opacity-80"
          style={{ background: "var(--card2)", border: "none" }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text3)" }}>
            Prescrições salvas neste acompanhamento
          </span>
          <span style={{ color: "var(--text3)", fontSize: 12 }}>{verHistorico ? "▴" : "▾"}</span>
        </button>

        {verHistorico && (
          prescricoesSalvas.length === 0 ? (
            <p className="px-4 py-3 text-sm" style={{ color: "var(--text3)" }}>Nenhuma prescrição salva.</p>
          ) : (
            prescricoesSalvas.map(p => (
              <div key={p.id}>
                <div className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: "1px solid var(--border)" }}>
                  <button onClick={() => setPrescricaoAberta(prescricaoAberta === p.id ? null : p.id)}
                    className="flex items-center gap-2 cursor-pointer text-left" style={{ background: "none", border: "none" }}>
                    <span className="text-sm font-bold" style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>{p.modalidade}</span>
                    <span className="text-xs" style={{ color: "var(--text3)" }}>{fmtDt(p.created_at)}</span>
                    <span style={{ color: "var(--text3)", fontSize: 10 }}>{prescricaoAberta === p.id ? "▴" : "▾"}</span>
                  </button>
                  <button onClick={() => handleExcluir(p.id)}
                    className="cursor-pointer text-xs transition hover:opacity-70"
                    style={{ color: "var(--red)", background: "none", border: "none" }}>
                    Excluir
                  </button>
                </div>
                {prescricaoAberta === p.id && p.texto_prescricao && (
                  <pre style={{ padding: "12px 16px", fontSize: 12, lineHeight: 1.7, color: "var(--text2)", background: "var(--bg2)", whiteSpace: "pre-wrap", fontFamily: "var(--mono)", margin: 0 }}>
                    {p.texto_prescricao}
                  </pre>
                )}
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}