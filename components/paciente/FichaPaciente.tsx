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
  acompanhamento, paciente, internacao, evolucoes, usuarioId,
}: FichaPacienteProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaId>("resumo");

  return (
    // height: 100% herda o restante da viewport definido no page.tsx
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Abas fixas — sem scroll horizontal */}
      <div
        style={{
          flexShrink: 0,
          background: "var(--card)",
          borderBottom: "2px solid var(--border)",
          display: "flex",
          paddingLeft: 8,
          paddingRight: 8,
        }}
      >
        {ABAS.map((aba) => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            style={{
              flexShrink: 0,
              padding: "11px 16px",
              fontSize: 13,
              fontWeight: abaAtiva === aba.id ? 700 : 500,
              color: abaAtiva === aba.id ? "var(--accent)" : "var(--text3)",
              background: "none",
              border: "none",
              borderBottom: abaAtiva === aba.id ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -2,
              cursor: "pointer",
              fontFamily: "var(--font)",
              transition: "color 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {aba.label}
          </button>
        ))}
      </div>

      {/* Conteúdo — scroll próprio, exceto Evoluções que gerencia o próprio layout */}
      <div style={{ flex: 1, overflow: abaAtiva === "evolucoes" ? "hidden" : "auto" }}>
        {abaAtiva === "resumo" && (
          <div style={{ padding: "20px 24px" }}>
            <AbaResumo acompanhamento={acompanhamento} paciente={paciente} internacao={internacao} />
          </div>
        )}
        {abaAtiva === "evolucoes" && (
          <AbaEvolucoes
            acompanhamentoId={acompanhamento.id}
            acompanhamento={acompanhamento}
            evolucoes={evolucoes}
            usuarioId={usuarioId}
            paciente={paciente}
          />
        )}
        {abaAtiva === "exames" && (
          <div style={{ padding: "20px 24px" }}>
            <AbaExames
              acompanhamentoId={acompanhamento.id}
              paciente={paciente}
              acompanhamento={acompanhamento}
            />
          </div>
        )}
        {abaAtiva === "dialise" && (
          <div style={{ padding: "20px 24px" }}>
            <AbaTerapiaDialitica
              acompanhamento={acompanhamento}
              paciente={paciente}
              internacao={internacao}
            />
          </div>
        )}
        {abaAtiva === "timeline" && (
          <div style={{ padding: "20px 24px" }}>
            <AbaTimeline acompanhamento={acompanhamento} evolucoes={evolucoes} />
          </div>
        )}
      </div>
    </div>
  );
}