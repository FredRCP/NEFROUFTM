import type { LinhasPrescricao } from "./tipos";
import { campo, vazioParaNulo } from "./linhas";

export function gerarLinhasHD(p: Record<string, string>): LinhasPrescricao[] {
  const isUF = p.submodalidade === "Ultrafiltração isolada";

  const ufNum = vazioParaNulo(p.ufMl);
  const uf = ufNum === null ? null
    : parseFloat(ufNum.replace(",", ".")) === 0 ? "Sem perdas" : `${ufNum} mL`;

  const heparina = p.heparina === "sim"
    ? (vazioParaNulo(p.heparinaQtd) ? `${p.heparinaQtd.trim()} mL (bolus no início)` : "Sim")
    : p.heparina === "nao" ? "Sem heparina" : null;

  const lavagem = p.lavagem === "sim"
    ? (vazioParaNulo(p.lavagemMl) ? `Sim — ${p.lavagemMl.trim()} mL de soro a cada 15 min` : "Sim")
    : p.lavagem === "nao" ? "Não" : null;

  const calcio = p.calcio === "baixo" ? "Baixo (2,5 mEq/L)"
    : p.calcio === "padrao" ? "Padrão (3,0 mEq/L)" : null;
  const glicose = p.glicose === "sim" ? "2 amp ACM" : p.glicose === "nao" ? "Não" : null;
  const nacl = p.nacl === "sim" ? "10 mL/h ACM" : p.nacl === "nao" ? "Não" : null;

  const linhas: LinhasPrescricao[] = [
    campo("Modalidade de TSR", p.submodalidade, true),
    campo("Tempo", vazioParaNulo(p.tempoH) ? `${p.tempoH} h` : null),
    campo("UF (perdas)", uf),
    campo("Heparina", heparina),
    campo("Lavagem do sistema", lavagem),
    campo("Fluxo de sangue (Qb)", vazioParaNulo(p.qb) ? `${p.qb} mL/min` : null),
  ];

  // Itens que não se aplicam à UF isolada não entram na folha
  if (!isUF) {
    linhas.push(
      campo("Fluxo de dialisato (Qd)", vazioParaNulo(p.qd) ? `${p.qd} mL/min` : null),
      campo("Sódio (Na)", vazioParaNulo(p.sodio) ? `${p.sodio} mEq/L` : null),
    );
  }

  linhas.push(campo("Temperatura", vazioParaNulo(p.temperatura) ? `${p.temperatura}°C` : null));

  if (!isUF) {
    linhas.push(
      campo("Capilar", p.capilar),
      campo("Bicarbonato (BIC)", p.bic),
      campo("Cálcio do dialisato", calcio),
      campo("Glicose 50%", glicose),
      campo("NaCl 20%", nacl),
    );
  }

  linhas.push(campo("Outros", p.outros));
  return linhas;
}
