/**
 * NEFRO-UFTM — lib/engine/calculosDifusivo.ts
 * Motor para HDi e SLED. Portado do NefroSmart TSR.
 * ⚠️ Ferramenta de apoio. Não substitui o julgamento médico.
 */

export const REFERENCIAS_DIFUSIVO = {
  KTV_ALVO_3X_SEMANA: 1.4,
  KTV_MINIMO_3X_SEMANA: 1.2,
  URR_MINIMO_PCT: 65,
  GFAC_3X_SEMANA: 0.008,
  UF_RATE_MAX_ML_KG_H: 13,
};

const num = (v: unknown): number =>
  v === "" || v === null || v === undefined ? NaN : Number(v);
const arred = (v: number, casas = 2): number | null =>
  Number.isFinite(v) ? Math.round(v * 10 ** casas) / 10 ** casas : null;

export function estimarVolumeUreia({
  sexo, peso, altura, idade,
}: {
  sexo?: string;
  peso?: unknown;
  altura?: unknown;
  idade?: unknown;
}): number | null {
  const W = num(peso), H = num(altura), A = num(idade);
  if (!Number.isFinite(W) || !Number.isFinite(H)) return null;
  if (!Number.isFinite(A)) return arred(0.55 * W, 1);
  if (sexo === "F") return arred(-2.097 + 0.1069 * H + 0.2466 * W, 1);
  return arred(2.447 - 0.09516 * A + 0.1074 * H + 0.3362 * W, 1);
}

export function calcularURR(ureiaPre: unknown, ureiaPos: unknown): number | null {
  const pre = num(ureiaPre), pos = num(ureiaPos);
  if (!Number.isFinite(pre) || !Number.isFinite(pos) || pre <= 0) return null;
  return arred((1 - pos / pre) * 100, 1);
}

export function calcularKtVDaugirdas({
  ureiaPre, ureiaPos, tempoH, ufVolumeL, pesoPos,
  gfac = REFERENCIAS_DIFUSIVO.GFAC_3X_SEMANA,
}: {
  ureiaPre?: unknown; ureiaPos?: unknown; tempoH?: unknown;
  ufVolumeL?: unknown; pesoPos?: unknown; gfac?: number;
}): number | null {
  const pre = num(ureiaPre), pos = num(ureiaPos);
  const t = num(tempoH), uf = num(ufVolumeL), W = num(pesoPos);
  if (![pre, pos, t, uf, W].every(Number.isFinite) || pre <= 0 || W <= 0) return null;
  const R = pos / pre;
  const interno = R - gfac * t;
  if (interno <= 0) return null;
  return arred(-Math.log(interno) + (4 - 3.5 * R) * (uf / W), 2);
}

export interface PrescricaoDifusiva {
  tempoH?: unknown;
  fluxoSangue?: unknown;
  fluxoDialisato?: unknown;
  ufTotalL?: unknown;
  ureiaPre?: unknown;
  ureiaPos?: unknown;
  pesoPos?: unknown;
}

export interface MetricasDifusivas {
  volumeUreiaL: number | null;
  ufRate_mlKgH: number | null;
  ktvMedido: number | null;
  urrPct: number | null;
  modalidade: string;
}

export interface Alerta {
  nivel: "info" | "aviso" | "critico";
  codigo: string;
  mensagem: string;
}

export function calcularDifusivo({
  modalidade, paciente, prescricao,
}: {
  modalidade: string;
  paciente?: { sexo?: string; peso?: unknown; altura?: unknown; idade?: unknown };
  prescricao?: PrescricaoDifusiva;
}): { metricas: MetricasDifusivas; alertas: Alerta[] } {
  const p = prescricao || {};
  const V = estimarVolumeUreia(paciente || {});
  const tempoH = num(p.tempoH);
  const ufTotalL = num(p.ufTotalL);
  const pesoSeco = num(paciente?.peso);

  const ufRate =
    Number.isFinite(ufTotalL) && Number.isFinite(tempoH) &&
    Number.isFinite(pesoSeco) && tempoH > 0 && pesoSeco > 0
      ? arred((ufTotalL * 1000) / tempoH / pesoSeco, 2)
      : null;

  const ktvMedido = calcularKtVDaugirdas({
    ureiaPre: p.ureiaPre,
    ureiaPos: p.ureiaPos,
    tempoH,
    ufVolumeL: ufTotalL,
    pesoPos: Number.isFinite(num(p.pesoPos)) ? p.pesoPos : pesoSeco,
  });

  const urr = calcularURR(p.ureiaPre, p.ureiaPos);

  const metricas: MetricasDifusivas = {
    volumeUreiaL: V,
    ufRate_mlKgH: ufRate,
    ktvMedido,
    urrPct: urr,
    modalidade,
  };

  return { metricas, alertas: gerarAlertasDifusivo(metricas) };
}

export function gerarAlertasDifusivo(m: MetricasDifusivas): Alerta[] {
  const alertas: Alerta[] = [];
  const R = REFERENCIAS_DIFUSIVO;

  if (m.ktvMedido != null) {
    if (m.ktvMedido < R.KTV_MINIMO_3X_SEMANA) {
      alertas.push({ nivel: "critico", codigo: "KTV_BAIXO",
        mensagem: `Kt/V (${m.ktvMedido}) abaixo do mínimo (${R.KTV_MINIMO_3X_SEMANA}). Considerar aumentar tempo, Qb ou Qd.` });
    } else if (m.ktvMedido < R.KTV_ALVO_3X_SEMANA) {
      alertas.push({ nivel: "aviso", codigo: "KTV_SUBOTIMO",
        mensagem: `Kt/V (${m.ktvMedido}) abaixo do alvo (${R.KTV_ALVO_3X_SEMANA}), mas acima do mínimo.` });
    }
  }

  if (m.urrPct != null && m.urrPct < R.URR_MINIMO_PCT) {
    alertas.push({ nivel: "aviso", codigo: "URR_BAIXO",
      mensagem: `URR (${m.urrPct}%) abaixo do mínimo recomendado (${R.URR_MINIMO_PCT}%).` });
  }

  if (m.ufRate_mlKgH != null && m.ufRate_mlKgH > R.UF_RATE_MAX_ML_KG_H) {
    alertas.push({ nivel: "aviso", codigo: "UF_RATE_ELEVADA",
      mensagem: `Taxa de UF (${m.ufRate_mlKgH} mL/kg/h) elevada — risco de instabilidade hemodinâmica.` });
  }

  return alertas;
}