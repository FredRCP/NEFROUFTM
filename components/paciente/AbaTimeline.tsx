import type { AcompanhamentoNefro, Evolucao, Medico } from "@/types/database";

interface AbaTimelineProps {
  acompanhamento: AcompanhamentoNefro;
  evolucoes: (Evolucao & { autor: Medico })[];
}

interface EventoTimeline {
  data: string;
  label: string;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Timeline derivada automaticamente (Seção 4.8) — não é entrada manual,
 * é composta a partir de eventos já registrados em outras telas.
 * Nesta fase: interconsulta + início da LRA + evoluções que contêm conduta
 * (sinal de evento relevante, não só observação).
 */
function montarEventos(acompanhamento: AcompanhamentoNefro, evolucoes: (Evolucao & { autor: Medico })[]): EventoTimeline[] {
  const eventos: EventoTimeline[] = [];

  eventos.push({
    data: acompanhamento.data_interconsulta,
    label: "Interconsulta solicitada" +
      (acompanhamento.diagnostico_principal ? ` — ${acompanhamento.diagnostico_principal.replace(/_/g, " ")}` : ""),
  });

  if (acompanhamento.data_inicio_lra) {
    eventos.push({
      data: acompanhamento.data_inicio_lra,
      label: "Início provável da LRA",
    });
  }

  // Evoluções com conduta registrada entram como evento (sinal de ação clínica)
  for (const ev of evolucoes) {
    if (ev.conduta) {
      eventos.push({
        data: ev.created_at,
        label: ev.conduta,
      });
    }
  }

  if (!acompanhamento.ativo && acompanhamento.data_saida) {
    eventos.push({
      data: acompanhamento.data_saida,
      label: `Saída do acompanhamento — ${acompanhamento.motivo_alta?.replace(/_/g, " ") || ""}` +
        (acompanhamento.desfecho_renal ? ` (${acompanhamento.desfecho_renal.replace(/_/g, " ")})` : ""),
    });
  }

  return eventos.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
}

export function AbaTimeline({ acompanhamento, evolucoes }: AbaTimelineProps) {
  const eventos = montarEventos(acompanhamento, evolucoes);

  return (
    <div>
      <p className="mb-4 text-xs" style={{ color: "var(--text3)" }}>
        Linha do tempo derivada automaticamente das informações já registradas.
      </p>

      {eventos.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text3)" }}>Nenhum evento registrado ainda.</p>
      ) : (
        <ol className="relative ml-3 space-y-6 border-l pl-6" style={{ borderColor: "var(--border)" }}>
          {eventos.map((ev, i) => (
            <li key={i} className="relative">
              <span
                className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full"
                style={{ background: "var(--accent)" }}
              />
              <p className="text-xs" style={{ color: "var(--text3)" }}>{formatarData(ev.data)}</p>
              <p className="text-sm" style={{ color: "var(--text)" }}>{ev.label}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}