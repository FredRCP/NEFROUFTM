import { estilosImpressao } from "./estilosImpressao";
import type { DadosImpressao } from "./tipos";

function renderPaciente(d: DadosImpressao): string {
  // Linha 1: identificação · Linha 2: local e clínica · Linha 3: data/hora
  return `
    <div class="paciente-box">
      <div class="paciente-grid">
        <div class="paciente-cell"><span class="label">Paciente</span><span class="value">${d.nomePaciente || "—"}</span></div>
        <div class="paciente-cell"><span class="label">Idade</span><span class="value">${d.idade ? d.idade + " anos" : "—"}</span></div>
        <div class="paciente-cell"><span class="label">RG</span><span class="value">${d.rg || "—"}</span></div>
      </div>
      <div class="paciente-grid">
        <div class="paciente-cell"><span class="label">Leito</span><span class="value">${d.leito || "—"}</span></div>
        <div class="paciente-cell"><span class="label">Diagnóstico</span><span class="value">${d.diagnostico || "—"}</span></div>
        <div class="paciente-cell"><span class="label">Acesso vascular</span><span class="value">${d.acesso || "—"}</span></div>
      </div>
      <div class="paciente-grid">
        <div class="paciente-cell"><span class="label">Data / Hora</span><span class="value">${d.dataHoje} &nbsp;·&nbsp; ${d.hora}</span></div>
      </div>
    </div>`;
}

function renderPrescricao(linhas: DadosImpressao["linhas"]): string {
  const rows = linhas.map((l, i) => `
    <tr>
      <td class="col-label">${l.label}</td>
      <td class="col-valor">${l.valor}</td>
    </tr>`).join("");
  return `
    <div class="secao">
      <div class="secao-header">Prescrição médica</div>
      <table class="tabela-prescricao"><tbody>${rows}</tbody></table>
    </div>`;
}

function renderEnfermagem(nLinhasMed = 8, nLinhasObs = 10): string {
  const linhasMed = Array.from({ length: nLinhasMed }, () => `<div class="linha-escrita"></div>`).join("");
  const linhasObs = Array.from({ length: nLinhasObs }, () => `<div class="linha-escrita"></div>`).join("");
  return `
    <div class="secao">
      <div class="secao-header enfermagem">Registro de enfermagem</div>
      <div class="enfermagem-box">
        <div class="enfermagem-subsecao">
          <div class="enfermagem-subsecao-label">Medicações administradas</div>
          ${linhasMed}
        </div>
        <div class="enfermagem-subsecao">
          <div class="enfermagem-subsecao-label">Intercorrências / Observações</div>
          ${linhasObs}
        </div>
      </div>
    </div>`;
}

function renderAssinatura(d: DadosImpressao): string {
  const nome = d.nomeMedico
    ? `${d.titulo ? d.titulo + ". " : ""}${d.nomeMedico}`
    : "Médico responsável";
  const crmNumero = (d.crm ?? "").replace(/^\s*CRM[-\s]*(MG)?[\s-]*/i, "").trim();
  const crm = crmNumero ? `CRM-MG ${crmNumero}` : "";
  return `
    <div class="assinatura-area">
      <div class="assinatura-linha"></div><br>
      <div class="assinatura-nome">${nome}</div>
      ${crm ? `<div class="assinatura-crm">${crm}</div>` : ""}
    </div>`;
}

function renderRodape(): string {
  const agora = new Date().toLocaleString("pt-BR");
  return `<div class="rodape">Gerado pelo NEFRO-UFTM &nbsp;·&nbsp; ${agora} &nbsp;·&nbsp; Nefrologia HC-UFTM/EBSERH — Uberaba, MG</div>`;
}

export function gerarHTML(d: DadosImpressao): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Prescrição ${d.nomePaciente}</title>
  <style>${estilosImpressao}</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-title">HOSPITAL DE CLÍNICAS — UFTM / EBSERH</div>
      <div class="header-sub">Serviço de Nefrologia &nbsp;·&nbsp; Folha de Prescrição de Terapia Renal Substitutiva</div>
    </div>
    <div class="header-right">NEFRO-UFTM<br>${d.dataHoje}</div>
  </div>

  ${renderPaciente(d)}

  <div class="body-layout">
    ${renderPrescricao(d.linhas)}
    ${renderEnfermagem()}
  </div>

  ${renderAssinatura(d)}
  ${renderRodape()}
</body>
</html>`;
}

export function abrirJanelaImpressao(d: DadosImpressao): void {
  const html = gerarHTML(d);

  // Usar iframe oculto — evita popup blocker
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.opacity = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  // Aguarda carregamento antes de imprimir
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Remove o iframe após a impressão
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  };
}
