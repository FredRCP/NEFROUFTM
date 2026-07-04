/**
 * NEFRO-UFTM — lib/engine/gerarPrescricao.ts
 * Gera o texto formatado da prescrição para copiar/imprimir.
 * Sem regra clínica — apenas formatação de saída.
 */

const linha = (rotulo: string, valor: unknown, unidade = ""): string | null =>
  valor !== null && valor !== undefined && valor !== ""
    ? `  ${rotulo}: ${valor}${unidade ? " " + unidade : ""}`
    : null;

export function gerarTextoPrescricao({
  paciente, modalidade, prescricao, metricas, familia,
}: {
  paciente: Record<string, unknown>;
  modalidade: string;
  prescricao: Record<string, unknown>;
  metricas: Record<string, unknown>;
  familia: string;
}): string {
  const carimbo = new Date().toLocaleString("pt-BR");
  const out: string[] = [];

  out.push("PRESCRIÇÃO DE TERAPIA RENAL SUBSTITUTIVA");
  out.push("NEFRO-UFTM — HC-UFTM/EBSERH");
  out.push("=".repeat(48));
  out.push("");
  out.push("PACIENTE");

  [
    linha("Nome", paciente?.nome),
    linha("RG hospitalar", paciente?.rgHospitalar),
    linha("Peso", paciente?.peso, "kg"),
    linha("Altura", paciente?.altura, "cm"),
    linha("Sexo", paciente?.sexo === "F" ? "Feminino" : paciente?.sexo === "M" ? "Masculino" : ""),
    linha("Acesso vascular", paciente?.acesso),
    linha("Diagnóstico", paciente?.diagnostico),
    linha("Setor / Leito", paciente?.leito),
  ]
    .filter(Boolean)
    .forEach((l) => out.push(l!));

  out.push("");
  out.push(`MODALIDADE: ${modalidade}`);
  out.push("");
  out.push("PARÂMETROS PRESCRITOS");

  if (familia === "crrt") {
    const ind = prescricao?.indicacao === "sepse" ? "Sepse/SIRS" : "Hipervolemia";
    const ac = (prescricao?.anticoagulacao as Record<string, unknown>) || {};
    [
      linha("Indicação", ind),
      linha("SET", "ST150 / oXiris (adultos)"),
      linha("Fluxo de sangue (Qb)", prescricao?.fluxoSangue, "mL/min"),
      linha(
        "Anticoagulação",
        ac?.tipo === "regiocit"
          ? "Citrato (Regiocit 0,5%)"
          : ac?.tipo === "heparina"
          ? "Heparina"
          : "Sem anticoagulação"
      ),
    ]
      .filter(Boolean)
      .forEach((l) => out.push(l!));

    if (ac?.tipo === "regiocit") {
      [
        linha("  Regiocit (= Qb × 10)", metricas?.regiocit_mlh, "mL/h"),
        linha("  CaCl₂ 10% em uso", ac?.infusaoCalcio, "mL/h"),
        linha("  Ca iônico sistêmico", ac?.calcioSistemico, "mmol/L"),
        linha("  Ca iônico pós-filtro", ac?.calcioMaquina, "mmol/L"),
      ]
        .filter(Boolean)
        .forEach((l) => out.push(l!));
    }

    [
      linha("Biphosyl (dialisato)", metricas?.biphosyl_mlh, "mL/h  ← Dose − Rpos − Regiocit"),
      linha("Reposição pós-filtro", prescricao?.reposicaoPos, "mL/h"),
      linha("UF líquida", prescricao?.ufLiquida, "mL/h  (0 nas 2h iniciais → 50 → 80)"),
      linha("Temperatura", prescricao?.temperatura, "°C"),
    ]
      .filter(Boolean)
      .forEach((l) => out.push(l!));

    out.push("");
    out.push("VOLUMES CALCULADOS");
    const doseAlvo = metricas?.doseAlvo as { minMlh: number; maxMlh: number; minMlKgH: number; maxMlKgH: number } | null;
    [
      linha("Efluente total", metricas?.efluente_mlh, "mL/h"),
      linha("Dose", metricas?.dose_mlKgH, "mL/kg/h"),
      linha(
        "Faixa-alvo",
        doseAlvo
          ? `${doseAlvo.minMlh}–${doseAlvo.maxMlh} mL/h (${doseAlvo.minMlKgH}–${doseAlvo.maxMlKgH} mL/kg/h)`
          : null
      ),
      linha("Fração de filtração", metricas?.fracaoFiltracao_pct, "%"),
    ]
      .filter(Boolean)
      .forEach((l) => out.push(l!));
  } else {
    [
      linha("Tempo previsto", prescricao?.tempoH, "h"),
      linha("Fluxo de sangue (Qb)", prescricao?.fluxoSangue, "mL/min"),
      linha("Fluxo de dialisato (Qd)", prescricao?.fluxoDialisato, "mL/min"),
      linha("Meta de UF", prescricao?.ufTotalL, "L"),
    ]
      .filter(Boolean)
      .forEach((l) => out.push(l!));

    out.push("");
    out.push("MÉTRICAS CALCULADAS");
    [
      linha("Volume de distribuição (V)", metricas?.volumeUreiaL, "L"),
      linha("Taxa de UF", metricas?.ufRate_mlKgH, "mL/kg/h"),
      linha("Kt/V (pós-sessão)", metricas?.ktvMedido),
      linha("URR", metricas?.urrPct, "%"),
    ]
      .filter(Boolean)
      .forEach((l) => out.push(l!));
  }

  out.push("");
  out.push("-".repeat(48));
  out.push(`Gerado em: ${carimbo}`);
  out.push("Ferramenta de apoio clínico — NEFRO-UFTM.");
  out.push("Não substitui o julgamento médico.");

  return out.join("\n");
}