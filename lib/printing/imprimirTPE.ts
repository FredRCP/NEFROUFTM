import type { LinhasPrescricao } from "./tipos";
import { campo, vazioParaNulo } from "./linhas";

export function gerarLinhasTPE(p: Record<string, string>, peso: number | null): LinhasPrescricao[] {
  const ht = parseFloat(p.hematocrito ?? "");
  const vs = peso ? Math.round(peso * 70) : null;
  const vp = vs && !isNaN(ht) ? Math.round(vs * (1 - ht / 100)) : null;
  const vtt = vp ? Math.round(vp * 1.5) : null;
  const set = peso ? (peso < 9 ? null : peso <= 29 ? "TPE 1000 (9–29 kg)" : "TPE 2000 (>30 kg)") : null;

  const anticoag = p.anticoag ?? "heparina";
  const anticoagTxt = anticoag === "heparina"
    ? (peso ? `Heparina — Bolus: ${Math.round(peso * 70)} UI · Contínua: ${Math.round(peso * 15)} UI/h` : "Heparina")
    : "Citrato";

  const repMap: Record<string, string> = {
    albumina4: "Albumina 4% (SF 800 mL + 4 fr Albumina 20%)",
    albumina5: "Albumina 5% (SF 750 mL + 5 fr Albumina 20%)",
    pfc: "Plasma Fresco Congelado (PFC)",
    misto: "Misto: 50% PFC + 50% Albumina",
  };

  return [
    campo("Modalidade de TSR", "TPE — Plasmaférese Terapêutica", true),
    campo("Peso", peso ? `${peso} kg` : null),
    campo("Hematócrito", vazioParaNulo(p.hematocrito) ? `${p.hematocrito}%` : null),
    campo("Vol. de sangue (Peso×70)", vs ? `${vs} mL` : null),
    campo("Vol. de plasma (VS×(1−Ht))", vp ? `${vp} mL` : null),
    campo("Vol. total de troca (VTT)", vtt ? `${vtt} mL` : null),
    campo("SET", set),
    campo("Fluxo de sangue (Qb)", vazioParaNulo(p.qb) ? `${p.qb} mL/min` : null),
    campo("Temperatura", vazioParaNulo(p.temperatura) ? `${p.temperatura}°C — Aquecedor: Thermax` : null),
    campo("Duração estimada", vazioParaNulo(p.duracao) ? `${p.duracao} h` : null),
    campo("Número de sessões", p.nSessoes),
    campo("Anticoagulação", anticoagTxt),
    campo("Solução de reposição", p.reposicao ? (repMap[p.reposicao] ?? p.reposicao) : null),
    campo("Outros / Indicação", p.outros),
  ];
}
