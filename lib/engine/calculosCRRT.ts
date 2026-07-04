/**
 * ============================================================================
 *  NEFRO-UFTM — lib/engine/calculosCRRT.ts
 *  Portado do NefroSmart TSR (engine/calculosCRRT.js) para TypeScript.
 *  Motor de cálculo para terapias CONTÍNUAS (CRRT):
 *    - CVVHDF (implementada — protocolo HC-UFTM / ST150-oXiris / Regiocit)
 *
 *  ⚠️  AVISO CLÍNICO
 *  Ferramenta de apoio. NÃO substitui o julgamento médico.
 *  Valores de referência baseados no protocolo HC-UFTM [1].
 * ============================================================================
 */

export const PROTOCOLO_HC_UFTM = {
  DOSE_SEPSE_MIN: 30,
  DOSE_SEPSE_MAX: 35,
  DOSE_HIPERVOLEMIA_MIN: 20,
  DOSE_HIPERVOLEMIA_MAX: 25,
  QB_MIN: 100,
  QB_MAX: 130,
  REPOSICAO_POS_PADRAO_MLH: 200,
  FRACAO_FILTRACAO_MAX_PCT: 25,
  HEMATOCRITO_PADRAO: 0.30,
};

export interface AjusteCitrato {
  nivel: "info" | "aviso" | "critico";
  codigo: string;
  acao: string;
  ajuste: string | null;
  mensagem: (ca: number) => string;
  condicao: (ca: number) => boolean;
}

export const TABELA_CALCIO_SISTEMICO: AjusteCitrato[] = [
  {
    condicao: (ca) => ca < 1.0,
    nivel: "critico",
    codigo: "CA_SISTEMICO_BAIXO",
    acao: "AUMENTAR",
    ajuste: "10 a 25%",
    mensagem: (ca) =>
      `Cálcio iônico sistêmico ${ca} mmol/L (< 1,0) — AUMENTAR infusão de CaCl₂ 10% em 10 a 25%.`,
  },
  {
    condicao: (ca) => ca >= 1.0 && ca <= 1.2,
    nivel: "info",
    codigo: "CA_SISTEMICO_OK",
    acao: "MANTER",
    ajuste: null,
    mensagem: (ca) =>
      `Cálcio iônico sistêmico ${ca} mmol/L (1,0–1,2) — MANTER infusão de CaCl₂ atual.`,
  },
  {
    condicao: (ca) => ca > 1.2,
    nivel: "aviso",
    codigo: "CA_SISTEMICO_ALTO",
    acao: "DIMINUIR",
    ajuste: "10 a 25%",
    mensagem: (ca) =>
      `Cálcio iônico sistêmico ${ca} mmol/L (> 1,2) — DIMINUIR infusão de CaCl₂ 10% em 10 a 25%.`,
  },
];

export const TABELA_CITRATO_MAQUINA: AjusteCitrato[] = [
  {
    condicao: (ca) => ca < 0.25,
    nivel: "aviso",
    codigo: "CA_MAQUINA_BAIXO",
    acao: "DIMINUIR_CITRATO",
    ajuste: "0,2 mmol/L",
    mensagem: (ca) =>
      `Cálcio iônico pós-filtro ${ca} mmol/L (< 0,25) — DIMINUIR Regiocit em 0,2 mmol/L.`,
  },
  {
    condicao: (ca) => ca >= 0.25 && ca <= 0.40,
    nivel: "info",
    codigo: "CA_MAQUINA_OK",
    acao: "MANTER",
    ajuste: null,
    mensagem: (ca) =>
      `Cálcio iônico pós-filtro ${ca} mmol/L (0,25–0,40) — MANTER dose de Regiocit.`,
  },
  {
    condicao: (ca) => ca > 0.40,
    nivel: "aviso",
    codigo: "CA_MAQUINA_ALTO",
    acao: "AUMENTAR_CITRATO",
    ajuste: "0,2 mmol/L",
    mensagem: (ca) =>
      `Cálcio iônico pós-filtro ${ca} mmol/L (> 0,40) — AUMENTAR Regiocit em 0,2 mmol/L.`,
  },
];

const num = (v: unknown): number =>
  v === "" || v === null || v === undefined ? NaN : Number(v);
const arred = (v: number, casas = 2): number | null =>
  Number.isFinite(v) ? Math.round(v * 10 ** casas) / 10 ** casas : null;

export function calcularRegiocit(fluxoSangue: unknown): number | null {
  const Qb = num(fluxoSangue);
  return Number.isFinite(Qb) ? arred(Qb * 10, 0) : null;
}

export function calcularBiphosyl(
  doseTotalMlh: unknown,
  reposicaoPos: unknown,
  regiocit: unknown
): number | null {
  const d = num(doseTotalMlh), rpos = num(reposicaoPos), reg = num(regiocit);
  if (![d, rpos, reg].every(Number.isFinite)) return null;
  const vol = d - rpos - reg;
  return vol > 0 ? arred(vol, 0) : null;
}

export function calcularDoseAlvo(peso: unknown, indicacao: string) {
  const P = num(peso);
  if (!Number.isFinite(P) || P <= 0) return null;
  const R = PROTOCOLO_HC_UFTM;
  if (indicacao === "sepse") {
    return {
      minMlh: arred(P * R.DOSE_SEPSE_MIN, 0)!,
      maxMlh: arred(P * R.DOSE_SEPSE_MAX, 0)!,
      minMlKgH: R.DOSE_SEPSE_MIN,
      maxMlKgH: R.DOSE_SEPSE_MAX,
    };
  }
  return {
    minMlh: arred(P * R.DOSE_HIPERVOLEMIA_MIN, 0)!,
    maxMlh: arred(P * R.DOSE_HIPERVOLEMIA_MAX, 0)!,
    minMlKgH: R.DOSE_HIPERVOLEMIA_MIN,
    maxMlKgH: R.DOSE_HIPERVOLEMIA_MAX,
  };
}

export function avaliarCalcioSistemico(calcioMmolL: unknown) {
  const ca = num(calcioMmolL);
  if (!Number.isFinite(ca)) return null;
  return TABELA_CALCIO_SISTEMICO.find((r) => r.condicao(ca)) || null;
}

export function avaliarCalcioMaquina(calcioMmolL: unknown) {
  const ca = num(calcioMmolL);
  if (!Number.isFinite(ca)) return null;
  return TABELA_CITRATO_MAQUINA.find((r) => r.condicao(ca)) || null;
}

export interface PrescricaoCRRT {
  indicacao?: string;
  fluxoSangue?: unknown;
  reposicaoPos?: unknown;
  ufLiquida?: unknown;
  regiocit?: unknown;
  taxaDialisato?: unknown;
  temperatura?: unknown;
  hematocrito?: unknown;
  anticoagulacao?: {
    tipo?: string;
    calcioSistemico?: unknown;
    calcioMaquina?: unknown;
    infusaoCalcio?: unknown;
  };
}

export interface MetricasCRRT {
  modalidade: string;
  regiocit_mlh: number | null;
  biphosyl_mlh: number | null;
  efluente_mlh: number | null;
  dose_mlKgH: number | null;
  doseAlvo: ReturnType<typeof calcularDoseAlvo>;
  fracaoFiltracao_pct: number | null;
  Qplasma_mlh: number | null;
  balancoHorario_mlh: number | null;
  ajusteCalcioSistemico: AjusteCitrato | null;
  ajusteCalcioMaquina: AjusteCitrato | null;
}

export interface Alerta {
  nivel: "info" | "aviso" | "critico";
  codigo: string;
  mensagem: string;
}

export function calcularCRRT({
  modalidade = "CVVHDF",
  paciente,
  prescricao,
}: {
  modalidade?: string;
  paciente?: { peso?: unknown; hematocrito?: unknown };
  prescricao?: PrescricaoCRRT;
}): { metricas: MetricasCRRT; alertas: Alerta[] } {
  const p = prescricao || {};
  const R = PROTOCOLO_HC_UFTM;
  const peso = num(paciente?.peso);
  const Qb = num(p.fluxoSangue);
  const Rpos = num(p.reposicaoPos ?? R.REPOSICAO_POS_PADRAO_MLH);
  const ufLiq = num(p.ufLiquida ?? 0);
  const regiocitCalc = calcularRegiocit(Qb);
  const regiocit = Number.isFinite(num(p.regiocit))
    ? num(p.regiocit)
    : (regiocitCalc ?? 0);
  const doseAlvo = calcularDoseAlvo(peso, p.indicacao || "hipervolemia");
  const doseTotalAlvo = doseAlvo?.minMlh;
  const biphosylCalc = doseTotalAlvo != null
    ? calcularBiphosyl(doseTotalAlvo, Rpos, regiocit)
    : null;
  const Qd = Number.isFinite(num(p.taxaDialisato))
    ? num(p.taxaDialisato)
    : (biphosylCalc ?? 0);
  const efluente_mlh = arred(
    (Number.isFinite(Qd) ? Qd : 0) +
    (Number.isFinite(Rpos) ? Rpos : 0) +
    (Number.isFinite(regiocit) ? regiocit : 0) +
    (Number.isFinite(ufLiq) ? ufLiq : 0),
    0
  );
  const dose_mlKgH =
    Number.isFinite(efluente_mlh) && Number.isFinite(peso) && peso > 0
      ? arred(efluente_mlh! / peso, 2)
      : null;
  const Hct = Number.isFinite(num(p.hematocrito))
    ? num(p.hematocrito)
    : R.HEMATOCRITO_PADRAO;
  const Qplasma_mlh = Number.isFinite(Qb) ? arred(Qb * 60 * (1 - Hct), 0) : null;
  const ufPlasma_mlh = (Number.isFinite(Rpos) ? Rpos : 0) + (Number.isFinite(ufLiq) ? ufLiq : 0);
  const fracaoFiltracao_pct =
    Number.isFinite(Qplasma_mlh) && Qplasma_mlh! > 0
      ? arred((ufPlasma_mlh / Qplasma_mlh!) * 100, 1)
      : null;
  const ac = p.anticoagulacao || {};
  const ajusteCalcioSistemico = avaliarCalcioSistemico(ac.calcioSistemico);
  const ajusteCalcioMaquina = avaliarCalcioMaquina(ac.calcioMaquina);

  const metricas: MetricasCRRT = {
    modalidade,
    regiocit_mlh: regiocit,
    biphosyl_mlh: biphosylCalc,
    efluente_mlh,
    dose_mlKgH,
    doseAlvo,
    fracaoFiltracao_pct,
    Qplasma_mlh,
    balancoHorario_mlh: Number.isFinite(ufLiq) ? -ufLiq : null,
    ajusteCalcioSistemico,
    ajusteCalcioMaquina,
  };

  return { metricas, alertas: gerarAlertasCRRT(metricas, p) };
}

export function gerarAlertasCRRT(m: MetricasCRRT, prescricao?: PrescricaoCRRT): Alerta[] {
  const alertas: Alerta[] = [];
  const R = PROTOCOLO_HC_UFTM;
  const ac = prescricao?.anticoagulacao || {};

  if (Number.isFinite(m.dose_mlKgH) && m.doseAlvo) {
    const { minMlKgH, maxMlKgH } = m.doseAlvo;
    if (m.dose_mlKgH! < minMlKgH) {
      alertas.push({ nivel: "critico", codigo: "DOSE_BAIXA",
        mensagem: `Dose (${m.dose_mlKgH} mL/kg/h) abaixo do mínimo para esta indicação (${minMlKgH} mL/kg/h).` });
    } else if (m.dose_mlKgH! > maxMlKgH) {
      alertas.push({ nivel: "aviso", codigo: "DOSE_ACIMA_ALVO",
        mensagem: `Dose (${m.dose_mlKgH} mL/kg/h) acima do alvo (${maxMlKgH} mL/kg/h). Risco de hipofosfatemia.` });
    }
  }

  const Qb = num(prescricao?.fluxoSangue);
  if (Number.isFinite(Qb)) {
    if (Qb < R.QB_MIN) alertas.push({ nivel: "aviso", codigo: "QB_BAIXO",
      mensagem: `Fluxo de sangue (${Qb} mL/min) abaixo do range do protocolo (${R.QB_MIN}–${R.QB_MAX} mL/min).` });
    else if (Qb > R.QB_MAX) alertas.push({ nivel: "aviso", codigo: "QB_ALTO",
      mensagem: `Fluxo de sangue (${Qb} mL/min) acima do range HC-UFTM. Confirmar se intencional.` });
  }

  if (Number.isFinite(m.fracaoFiltracao_pct) && m.fracaoFiltracao_pct! > R.FRACAO_FILTRACAO_MAX_PCT) {
    alertas.push({ nivel: "aviso", codigo: "FF_ELEVADA",
      mensagem: `Fração de filtração (${m.fracaoFiltracao_pct}%) > ${R.FRACAO_FILTRACAO_MAX_PCT}% — risco de coagulação do filtro.` });
  }

  if (m.ajusteCalcioSistemico) {
    const a = m.ajusteCalcioSistemico;
    alertas.push({ nivel: a.nivel, codigo: a.codigo, mensagem: a.mensagem(num(ac.calcioSistemico)) });
  }
  if (m.ajusteCalcioMaquina) {
    const a = m.ajusteCalcioMaquina;
    alertas.push({ nivel: a.nivel, codigo: a.codigo, mensagem: a.mensagem(num(ac.calcioMaquina)) });
  }
  if (Number.isFinite(m.dose_mlKgH) && m.dose_mlKgH! >= 30) {
    alertas.push({ nivel: "info", codigo: "FOSFATO_MONITOR",
      mensagem: "Dose ≥ 30 mL/kg/h — monitorizar fosfato e considerar reposição profilática." });
  }
  if (ac.tipo === "regiocit") {
    alertas.push({ nivel: "info", codigo: "CITRATO_HEPATOPATA",
      mensagem: "Regiocit ativo: atenção a acúmulo de citrato em hepatopatas." });
  }

  return alertas;
}