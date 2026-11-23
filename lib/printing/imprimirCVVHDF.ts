import type { LinhasPrescricao } from "./tipos";
import { campo, vazioParaNulo } from "./linhas";

export function gerarLinhasCVVHDF(p: Record<string, string>, peso: number | null): LinhasPrescricao[] {
  const doseN = parseFloat(p.dose ?? "");
  const dkg = peso && !isNaN(doseN) ? ` (≈ ${(doseN / peso).toFixed(1)} mL/kg/h)` : "";

  const qbN = parseFloat(p.qb ?? "");
  const regVol = !isNaN(qbN) ? Math.round(qbN * 10) : null;
  const rpos = parseFloat(p.reposicaoPos ?? "");
  const bip = regVol !== null && !isNaN(rpos) && !isNaN(doseN)
    ? Math.round(doseN - rpos - regVol) : null;

  const anticoag = p.anticoag ?? "regiocit";
  const anticoagTxt = anticoag === "regiocit"
    ? `Citrato 0,5% (Regiocit) = 3 mmol/L${regVol ? `; ${regVol} mL/h` : ""}`
    : anticoag === "heparina" ? "Heparina" : "Sem anticoagulação";

  return [
    campo("Modalidade de TSR", "CVVHDF", true),
    campo("Peso", peso ? `${peso} kg` : null),
    campo("Hematócrito", vazioParaNulo(p.hematocrito) ? `${p.hematocrito}%` : null),
    campo("Indicação", p.indicacao),
    campo("Fluxo de sangue (Qb)", vazioParaNulo(p.qb) ? `${p.qb} mL/min` : null),
    campo("SET / Capilar", p.set),
    campo("Dose total", vazioParaNulo(p.dose) ? `${p.dose} mL/h${dkg}` : null),
    campo("Anticoagulação", anticoagTxt),
    campo("Dialisato (Biphosyl)", bip !== null && bip > 0 ? `${bip} mL/h` : null),
    campo("Reposição pós-filtro", vazioParaNulo(p.reposicaoPos) ? `${p.reposicaoPos} mL/h` : null),
    campo("UF líquida (balanço)", vazioParaNulo(p.ufLiquida) ? `${p.ufLiquida} mL/h` : null),
    campo("Temperatura", vazioParaNulo(p.temperatura) ? `${p.temperatura}°C` : null),
    campo("CaCl₂ 10% atual", vazioParaNulo(p.infusaoCalcio) ? `${p.infusaoCalcio} mL/h` : null),
    campo("Outros", p.outros),
  ];
}
