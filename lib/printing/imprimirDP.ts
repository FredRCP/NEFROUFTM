import type { LinhasPrescricao } from "./tipos";
import { campo, vazioParaNulo } from "./linhas";

export function gerarLinhasDP(p: Record<string, string>, peso: number | null): LinhasPrescricao[] {
  const volNum = parseFloat((p.volMlKg ?? "").replace(",", "."));
  const vol = peso && !isNaN(volNum) ? Math.round(peso * volNum) : null;

  return [
    campo("Modalidade de TSR", "DPI — Diálise Peritoneal Intermitente (Pediátrica)", true),
    campo("Acesso", "Cateter Tenckhoff"),
    campo("Solução", vazioParaNulo(p.solucao) ? `Glicose ${p.solucao}` : null),
    campo("Número de trocas", p.trocas),
    campo("Tempo de infusão", vazioParaNulo(p.tInfusao) ? `${p.tInfusao} min` : null),
    campo("Tempo de permanência", vazioParaNulo(p.tPermanencia) ? `${p.tPermanencia} min` : null),
    campo("Tempo de drenagem", vazioParaNulo(p.tDrenagem) ? `${p.tDrenagem} min` : null),
    campo("Volume por ciclo", vazioParaNulo(p.volMlKg) ? `${p.volMlKg} mL/kg${vol ? ` = ${vol} mL` : ""}` : null),
    campo("Heparina", p.heparina === "sim" ? "500 UI/L se fibrina" : p.heparina === "nao" ? "Não" : null),
    campo("Outros", p.outros),
  ];
}
