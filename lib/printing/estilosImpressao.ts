export const estilosImpressao = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body { height: 194mm; }

  @page {
    size: A4 landscape;
    margin: 8mm;
  }

  body {
    display: flex;
    flex-direction: column;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    color: #1a1a2e;
    background: white;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Cabeçalho ─────────────────────────────── */
  .header {
    background: #1e3a5f;
    color: white;
    padding: 7px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 5px;
  }
  .header-title { font-size: 13pt; font-weight: 900; letter-spacing: 0.02em; }
  .header-sub { font-size: 8pt; opacity: 0.8; margin-top: 1px; }
  .header-right { text-align: right; font-size: 8pt; opacity: 0.75; }

  /* ── Dados do paciente ─────────────────────── */
  .paciente-box {
    border: 1px solid #c5d5e8;
    background: #f5f8fc;
    border-radius: 3px;
    margin-bottom: 5px;
    overflow: hidden;
  }
  .paciente-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-bottom: 1px solid #c5d5e8;
  }
  .paciente-grid:last-child { border-bottom: none; }
  .paciente-cell {
    padding: 4px 8px;
    border-right: 1px solid #c5d5e8;
  }
  .paciente-cell:last-child { border-right: none; }
  .paciente-cell .label {
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #1e3a5f;
    display: block;
    margin-bottom: 1px;
  }
  .paciente-cell .value {
    font-size: 9pt;
    font-weight: 600;
    color: #1a1a2e;
  }

  /* ── Layout 2 colunas ──────────────────────── */
  .body-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-bottom: 5px;
    flex: 1 1 auto;
    min-height: 0;
  }
  .body-layout > * { min-height: 0; }
  .body-layout > .secao { height: 100%; display: flex; flex-direction: column; }
  .body-layout > .secao > .secao-header + * { flex: 1 1 auto; min-height: 0; }

  /* ── Seção genérica ────────────────────────── */
  .secao { border: 1px solid #c5d5e8; border-radius: 3px; overflow: hidden; }
  .secao-header {
    background: #1e3a5f;
    color: white;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 4px 8px;
  }
  .secao-header.enfermagem { background: #2d5a82; }

  /* ── Tabela de prescrição ──────────────────── */
  .tabela-prescricao { width: 100%; border-collapse: collapse; }
  .tabela-prescricao tr:nth-child(even) { background: #f0f5fb; }
  .tabela-prescricao td {
    padding: 3.5px 8px;
    font-size: 8.5pt;
    border-bottom: 1px solid #e5edf6;
    vertical-align: middle;
  }
  .tabela-prescricao td:last-child { border-bottom: none; }
  .tabela-prescricao .col-label {
    font-weight: 700;
    color: #1e3a5f;
    width: 42%;
    white-space: nowrap;
  }
  .tabela-prescricao .col-valor {
    color: #1a1a2e;
    font-weight: 600;
  }
  .tabela-prescricao tr:last-child td { border-bottom: none; }

  /* ── Caixa de enfermagem ───────────────────── */
  .enfermagem-box { padding: 4px 8px; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
  .enfermagem-subsecao { margin-bottom: 6px; flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; }
  .enfermagem-subsecao .linha-escrita { flex: 1 1 0; min-height: 12px; height: auto; }
  .enfermagem-subsecao-label {
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #2d5a82;
    margin-bottom: 3px;
    border-bottom: 1px solid #c5d5e8;
    padding-bottom: 1px;
  }
  .linha-escrita {
    border-bottom: 1px solid #c8d8ea;
    height: 14px;
    margin-bottom: 1px;
  }
  .rodape { margin-top: auto; }

  /* ── Assinatura ─────────────────────────────── */
  .assinatura-area {
    text-align: center;
    margin: 6px 0 3px;
  }
  .assinatura-linha {
    display: inline-block;
    width: 220px;
    border-bottom: 1px solid #555;
    margin-bottom: 3px;
  }
  .assinatura-nome {
    font-size: 8.5pt;
    font-weight: 700;
    color: #1e3a5f;
  }
  .assinatura-crm {
    font-size: 7.5pt;
    color: #555;
    margin-top: 1px;
  }

  /* ── Rodapé ─────────────────────────────────── */
  .rodape {
    border-top: 1px solid #1e3a5f;
    padding: 3px 0 0;
    text-align: center;
    font-size: 6.5pt;
    color: #888;
    font-style: italic;
  }

  /* ── Print: garantir cores ──────────────────── */
  @media print {
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .secao-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .tabela-prescricao tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .paciente-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;
