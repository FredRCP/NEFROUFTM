"use client";

import { useState } from "react";
import type { AcompanhamentoNefro, Paciente, Internacao, Evolucao, Medico } from "@/types/database";
import { AbaResumo } from "./AbaResumo";
import { AbaEvolucoes } from "./AbaEvolucoes";
import { AbaExames } from "./AbaExames";
import { AbaTerapiaDialitica } from "./AbaTerapiaDialitica";
import { AbaTimeline } from "./AbaTimeline";

type AbaId = "resumo" | "evolucoes" | "exames" | "dialise" | "timeline";

const ABAS: { id: AbaId; label: string }[] = [
  { id: "resumo", label: "Resumo" },
  { id: "evolucoes", label: "Evoluções" },
  { id: "exames", label: "Exames" },
  { id: "dialise", label: "Terapia Dialítica" },
  { id: "timeline", label: "Timeline" },
];

interface FichaPacienteProps {
  acompanhamento: AcompanhamentoNefro;
  paciente: Paciente;
  internacao: Internacao;
  evolucoes: (Evolucao & { autor: Medico })[];
  usuarioId: string;
}

export function FichaPaciente({
  acompanhamento,
  paciente,
  internacao,
  evolucoes,
  usuarioId,
}: FichaPacienteProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaId>("resumo");

  return (
    <div>
      <div className="nc-tab-bar overflow-x-auto px-3 sm:px-6">
        {ABAS.map((aba) => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            className={`nc-tab ${abaAtiva === aba.id ? "active" : ""}`}
          >
            {aba.label}
          </button>
        ))}
      </div>

      <div className="p-3 sm:p-6">
        {abaAtiva === "resumo" && (
          <AbaResumo acompanhamento={acompanhamento} paciente={paciente} internacao={internacao} />
        )}
        {abaAtiva === "evolucoes" && (
          <AbaEvolucoes
            acompanhamentoId={acompanhamento.id}
            evolucoes={evolucoes}
            usuarioId={usuarioId}
          />
        )}
        {abaAtiva === "exames" && (
          <AbaExames acompanhamentoId={acompanhamento.id} paciente={paciente} />
        )}
        {abaAtiva === "dialise" && <AbaTerapiaDialitica />}
        {abaAtiva === "timeline" && (
          <AbaTimeline acompanhamento={acompanhamento} evolucoes={evolucoes} />
        )}
      </div>
    </div>
  );
}