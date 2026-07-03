export function AbaTerapiaDialitica() {
  return (
    <div className="space-y-4">
      <div
        className="rounded-(--nc-radius-lg) border border-dashed p-8 text-center"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--text3)" }}>
          Prescrição de hemodiálise e diálise peritoneal
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--text3)" }}>
          Fase 3 — inclui prescrição completa (modalidade, acesso, heparinização,
          fluxos, complicações) e exportação em PDF para entrega à enfermagem.
          Ver Seção 4.6 e 5.3 da especificação.
        </p>
      </div>
    </div>
  );
}