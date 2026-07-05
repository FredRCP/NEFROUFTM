"use client";

import { useState, useMemo } from "react";
import type { Paciente, AcompanhamentoNefro } from "@/types/database";

interface RegistroExame {
  id: string;
  data: string;
  parametros: Record<string, number | string | null>;
}

interface ExportarExamesProps {
  registros: RegistroExame[];
  paciente: Paciente;
  acompanhamento: AcompanhamentoNefro;
  onClose: () => void;
}

// ─── Campos para exibição organizada ─────────────────────────────────────────

const GRUPOS_EXIBICAO = [
  {
    label: "Função Renal",
    campos: [
      { k: "creatinina", l: "Creatinina", u: "mg/dL" },
      { k: "ureia", l: "Ureia", u: "mg/dL" },
      { k: "tfg_calc", l: "TFG-e (CKD-EPI)", u: "mL/min", calculado: true },
      { k: "clearance_cr", l: "Clearance Cr", u: "mL/min" },
      { k: "proteinuria_24h", l: "Proteinúria 24h", u: "g/24h" },
      { k: "rac", l: "RAC", u: "mg/g" },
      { k: "rpc", l: "RPC", u: "mg/g" },
    ],
  },
  {
    label: "Eletrólitos",
    campos: [
      { k: "sodio", l: "Sódio", u: "mEq/L" },
      { k: "potassio", l: "Potássio", u: "mEq/L" },
      { k: "calcio", l: "Cálcio total", u: "mg/dL" },
      { k: "calcio_ionico", l: "Cálcio iônico", u: "mmol/L" },
      { k: "fosforo", l: "Fósforo", u: "mg/dL" },
      { k: "magnesio", l: "Magnésio", u: "mg/dL" },
    ],
  },
  {
    label: "Gasometria / Ácido-base",
    campos: [
      { k: "ph", l: "pH", u: "" },
      { k: "bic", l: "Bicarbonato", u: "mEq/L" },
      { k: "lactato", l: "Lactato", u: "mmol/L" },
    ],
  },
  {
    label: "Hemograma / Coagulação",
    campos: [
      { k: "hemoglobina", l: "Hemoglobina", u: "g/dL" },
      { k: "hematocrito", l: "Hematócrito", u: "%" },
      { k: "plaquetas", l: "Plaquetas", u: "mil/µL" },
      { k: "tap", l: "TAP", u: "%" },
      { k: "ttpa", l: "TTPa", u: "" },
      { k: "fibrinogenio", l: "Fibrinogênio", u: "mg/dL" },
    ],
  },
  {
    label: "Inflamação / Metabolismo",
    campos: [
      { k: "albumina", l: "Albumina", u: "g/dL" },
      { k: "pcr", l: "PCR", u: "mg/L" },
      { k: "cpk", l: "CPK", u: "U/L" },
      { k: "acido_urico", l: "Ác. Úrico", u: "mg/dL" },
      { k: "dhl", l: "DHL", u: "U/L" },
      { k: "haptoglobina", l: "Haptoglobina", u: "mg/dL" },
    ],
  },
  {
    label: "Hepático / Endócrino",
    campos: [
      { k: "tgo", l: "TGO (AST)", u: "U/L" },
      { k: "tgp", l: "TGP (ALT)", u: "U/L" },
      { k: "fa", l: "Fosfatase Alc.", u: "U/L" },
      { k: "ggt", l: "Gama-GT", u: "U/L" },
      { k: "bilirrubina_total", l: "Bilirrubinas", u: "mg/dL" },
      { k: "tsh", l: "TSH", u: "µUI/mL" },
      { k: "t4l", l: "T4 livre", u: "ng/dL" },
    ],
  },
  {
    label: "Lipídios / Glicemia",
    campos: [
      { k: "glicemia", l: "Glicemia", u: "mg/dL" },
      { k: "colesterol", l: "Col. Total", u: "mg/dL" },
      { k: "ldl", l: "LDL", u: "mg/dL" },
      { k: "hdl", l: "HDL", u: "mg/dL" },
      { k: "tg", l: "Triglicérides", u: "mg/dL" },
    ],
  },
  {
    label: "Imunologia / Complemento",
    campos: [
      { k: "c3", l: "C3", u: "mg/dL" },
      { k: "c4", l: "C4", u: "mg/dL" },
      { k: "c1q", l: "C1q", u: "mg/dL" },
      { k: "aso", l: "ASLO", u: "UI/mL" },
      { k: "iga", l: "IgA sérica", u: "mg/dL" },
      { k: "pla2r", l: "PLA2R", u: "RU/mL" },
      { k: "beta2_micro", l: "β2-microglobulina", u: "mg/L" },
    ],
  },
];

const CAMPOS_TEXTO_EXIBICAO = [
  { k: "eas", l: "EAS / Urina tipo 1" },
  { k: "urocultura", l: "Urocultura" },
  { k: "dismorfismo", l: "Dismorfismo eritrocitário" },
  { k: "imagem", l: "Exame de imagem" },
  { k: "fan", l: "FAN / Anti-DNA" },
  { k: "anca", l: "p-ANCA / c-ANCA" },
  { k: "crioglobulinas", l: "Crioglobulinas" },
  { k: "eletroforese_ser", l: "Eletroforese sérica" },
  { k: "eletroforese_ur", l: "Eletroforese urinária" },
  { k: "sorologias_hiv", l: "Anti-HIV" },
  { k: "sorologias_hcv", l: "Anti-HCV" },
  { k: "sorologias_hbv", l: "Anti-HBs / Anti-HBc / HBsAg" },
  { k: "sorologias_vdrl", l: "VDRL" },
  { k: "coombs", l: "Coombs / Esquizócitos" },
  { k: "antifosfolipides", l: "Antifosfolípides" },
  { k: "anti_lkm", l: "Anti-LKM / anti-SLA / anti-SM / anti-RNP" },
  { k: "anti_gbm", l: "Anti-GBM" },
  { k: "cadeias_leves", l: "Cadeias leves livres" },
  { k: "imunofixacao_ur", l: "Imunofixação urinária" },
  { k: "bhcg", l: "β-HCG" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcTFG(cr: number, idade: number, sexo: "F" | "M"): number | null {
  if (!cr || !idade || cr <= 0 || idade <= 0) return null;
  const k = sexo === "F" ? 0.7 : 0.9;
  const a = sexo === "F" ? -0.241 : -0.302;
  const sf = sexo === "F" ? 1.012 : 1.0;
  const r = cr / k;
  return Math.round(142 * Math.pow(Math.min(r, 1), a) * Math.pow(Math.max(r, 1), -1.2) * Math.pow(0.9938, idade) * sf);
}

function fmtDt(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
}

function fmtDtLonga() {
  return new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

function loadLib(src: string, scriptId: string, globalKey: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const win = window as unknown as Record<string, unknown>;
    if (win[globalKey]) { resolve(win[globalKey]); return; }
    if (document.getElementById(scriptId)) {
      const check = setInterval(() => { if (win[globalKey]) { clearInterval(check); resolve(win[globalKey]); } }, 100);
      setTimeout(() => { clearInterval(check); reject(new Error(`Timeout: ${globalKey}`)); }, 15000);
      return;
    }
    const s = document.createElement("script");
    s.id = scriptId; s.src = src;
    s.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    s.onload = () => {
      if (win[globalKey]) { resolve(win[globalKey]); return; }
      const check = setInterval(() => { if (win[globalKey]) { clearInterval(check); resolve(win[globalKey]); } }, 50);
      setTimeout(() => { clearInterval(check); resolve(win[globalKey]); }, 3000);
    };
    document.head.appendChild(s);
  });
}

// ─── VisualizarRegistro — fora do ExportarExames para evitar recriação no render ──

interface VisualizarRegistroProps {
  r: RegistroExame;
  enrichRegistro: (r: RegistroExame) => RegistroExame;
  onVoltar: () => void;
  onPDF: () => void;
  gerandoPDF: boolean;
}

function VisualizarRegistro({ r, enrichRegistro, onVoltar, onPDF, gerandoPDF }: VisualizarRegistroProps) {
  const enriched = enrichRegistro(r);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onVoltar}
          style={{ background: "var(--accent-dim)", border: "none", borderRadius: "var(--nc-radius)", padding: "5px 12px", color: "var(--accent)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          ← Voltar
        </button>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", margin: 0 }}>
          Registro de {fmtDt(r.data)}
        </h3>
        <button onClick={onPDF} disabled={gerandoPDF}
          className="nc-btn nc-btn-primary cursor-pointer" style={{ marginLeft: "auto", padding: "5px 14px", fontSize: 12 }}>
          {gerandoPDF ? "⏳ Gerando..." : "📄 PDF"}
        </button>
      </div>

      {GRUPOS_EXIBICAO.map(grupo => {
        const itens = grupo.campos.filter(c => enriched.parametros[c.k] != null);
        if (itens.length === 0) return null;
        return (
          <div key={grupo.label} style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--accent)", margin: "0 0 6px", borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
              {grupo.label}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "6px 12px" }}>
              {itens.map(c => (
                <div key={c.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: "var(--card2)", borderRadius: "var(--nc-radius)", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>{c.l}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--text)" }}>
                    {enriched.parametros[c.k]} <span style={{ fontSize: 9, fontWeight: 400, color: "var(--text3)" }}>{c.u}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {CAMPOS_TEXTO_EXIBICAO.some(c => r.parametros[c.k]) && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--accent)", margin: "0 0 6px", borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
            Resultados qualitativos
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {CAMPOS_TEXTO_EXIBICAO.filter(c => r.parametros[c.k]).map(c => (
              <div key={c.k} style={{ padding: "6px 10px", background: "var(--card2)", borderRadius: "var(--nc-radius)", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", display: "block", marginBottom: 2 }}>{c.l}</span>
                <span style={{ fontSize: 12, color: "var(--text)" }}>{String(r.parametros[c.k])}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {r.parametros["outros_lista"] && (() => {
        try {
          const lista = JSON.parse(String(r.parametros["outros_lista"])) as { nome: string; resultado: string }[];
          if (lista.length === 0) return null;
          return (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--accent)", margin: "0 0 6px", borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
                Outros
              </p>
              {lista.map((item, i) => (
                <div key={i} style={{ padding: "5px 10px", background: "var(--accent-dim)", borderRadius: "var(--nc-radius)", border: "1px solid var(--border2)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{item.nome}</span>
                  <span style={{ fontSize: 12, color: "var(--text2)" }}>{item.resultado}</span>
                </div>
              ))}
            </div>
          );
        } catch { return null; }
      })()}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ExportarExames({ registros, paciente, acompanhamento, onClose }: ExportarExamesProps) {
  const [modo, setModo] = useState<"tabela" | "registro">("tabela");
  const [registroSelecionado, setRegistroSelecionado] = useState<RegistroExame | null>(null);
  const [dataInicio, setDataInicio] = useState(registros[0]?.data ?? "");
  const [dataFim, setDataFim] = useState(registros[registros.length - 1]?.data ?? "");
  const [gerandoPDF, setGerandoPDF] = useState(false);

  const idade = useMemo(() => {
    if (!paciente.data_nascimento) return 0;
    const nasc = new Date(paciente.data_nascimento);
    const hoje = new Date();
    let a = hoje.getFullYear() - nasc.getFullYear();
    if (hoje.getMonth() < nasc.getMonth() ||
      (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) a--;
    return Math.max(a, 0);
  }, [paciente.data_nascimento]);

  const sexo: "F" | "M" = paciente.sexo === "F" ? "F" : "M";

  // Registros filtrados pelo período selecionado
  const registrosFiltrados = useMemo(() => {
    return registros.filter(r => {
      if (dataInicio && r.data < dataInicio) return false;
      if (dataFim && r.data > dataFim) return false;
      return true;
    });
  }, [registros, dataInicio, dataFim]);

  // Enriquece registros com TFG calculado
  function enrichRegistro(r: RegistroExame): RegistroExame {
    const cr = r.parametros.creatinina;
    const tfg = cr != null ? calcTFG(Number(cr), idade, sexo) : null;
    return {
      ...r,
      parametros: { ...r.parametros, tfg_calc: tfg } as Record<string, number | string | null>,
    };
  }

  // ─── PDF ──────────────────────────────────────────────────────────────────

  async function exportarPDF() {
    setGerandoPDF(true);
    try {
      await loadLib(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
        "jspdf-cdn", "jspdf"
      );
      const win = window as unknown as Record<string, unknown>;
      const jspdfMod = win.jspdf as Record<string, unknown>;
      const jsPDF = (jspdfMod?.jsPDF || win.jsPDF) as new (...args: unknown[]) => unknown;
      if (!jsPDF) throw new Error("jsPDF não carregou");

      // Carrega autotable
      await new Promise<void>((resolve, reject) => {
        const proto = (jsPDF as unknown as { prototype: Record<string, unknown> }).prototype;
        if (typeof proto.autoTable === "function") { resolve(); return; }
        const s = document.createElement("script");
        s.id = "autotable-cdn";
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
        s.onerror = () => reject(new Error("Falha autotable"));
        s.onload = () => {
          const check = setInterval(() => {
            if (typeof proto.autoTable === "function") { clearInterval(check); resolve(); }
          }, 50);
          setTimeout(() => { clearInterval(check); resolve(); }, 5000);
        };
        document.head.appendChild(s);
      });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" }) as Record<string, unknown> & {
        setFillColor: (...a: unknown[]) => void;
        rect: (...a: unknown[]) => void;
        setTextColor: (...a: unknown[]) => void;
        setFontSize: (...a: unknown[]) => void;
        setFont: (...a: unknown[]) => void;
        text: (...a: unknown[]) => void;
        autoTable: (opts: unknown) => void;
        save: (name: string) => void;
        lastAutoTable: { finalY: number };
      };

      const W = 297, margin = 14;

      // Header azul
      doc.setFillColor(30, 58, 95);
      doc.rect(0, 0, W, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text("NEFRO-UFTM — Relatório de Exames", margin, 12);
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(`HC-UFTM/EBSERH · ${fmtDtLonga()}`, W - margin, 12, { align: "right" });

      let y = 24;

      // Dados do paciente
      doc.setTextColor(24, 41, 61);
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(paciente.nome.toUpperCase(), margin, y);
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.setTextColor(70, 96, 122);
      const meta = [
        paciente.rg_hospitalar ? `RG: ${paciente.rg_hospitalar}` : null,
        idade > 0 ? `${idade} anos` : null,
        paciente.sexo === "F" ? "Feminino" : paciente.sexo === "M" ? "Masculino" : null,
        acompanhamento.diagnostico_principal?.replace(/_/g, " ") ?? null,
        dataInicio && dataFim ? `Período: ${fmtDt(dataInicio)} a ${fmtDt(dataFim)}` : null,
      ].filter(Boolean).join("  ·  ");
      doc.text(meta, margin, y + 5);
      y += 14;

      const regs = [...registrosFiltrados].reverse().map(enrichRegistro);

      // ── Tabela transposta: exames nas linhas, datas nas colunas ──────────
      const camposTabela = [
        { k: "tfg_calc", l: "TFG-e (mL/min)" },
        { k: "creatinina", l: "Creatinina (mg/dL)" },
        { k: "ureia", l: "Ureia (mg/dL)" },
        { k: "potassio", l: "Potássio (mEq/L)" },
        { k: "sodio", l: "Sódio (mEq/L)" },
        { k: "hemoglobina", l: "Hemoglobina (g/dL)" },
        { k: "calcio", l: "Cálcio (mg/dL)" },
        { k: "fosforo", l: "Fósforo (mg/dL)" },
        { k: "ph", l: "pH" },
        { k: "bic", l: "Bicarbonato (mEq/L)" },
        { k: "albumina", l: "Albumina (g/dL)" },
        { k: "plaquetas", l: "Plaquetas (mil/µL)" },
        { k: "tap", l: "TAP (%)" },
      ];

      // Só inclui linhas que tenham pelo menos um valor
      const linhasComDados = camposTabela.filter(c =>
        regs.some(r => r.parametros[c.k] != null)
      );

      // Cabeçalho: "Exame" + uma coluna por data (mais recente primeiro)
      const head = [["Exame", ...regs.map(r => fmtDt(r.data))]];

      // Corpo: uma linha por exame
      const body = linhasComDados.map(c => [
        c.l,
        ...regs.map(r => {
          const v = r.parametros[c.k];
          return v != null ? String(v) : "—";
        }),
      ]);

      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(24, 41, 61);
      doc.text("Comparativo temporal", margin, y);
      y += 4;

      doc.autoTable({
        head,
        body,
        startY: y,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [24, 41, 61] },
        headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [247, 250, 252] },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 22 } },
      });

      y = doc.lastAutoTable.finalY + 10;

      // ── Seção de resultados qualitativos ─────────────────────────────────
      const temTextos = regs.some(r =>
        CAMPOS_TEXTO_EXIBICAO.some(c => r.parametros[c.k])
      );
      if (temTextos) {
        doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(24, 41, 61);
        doc.text("Resultados qualitativos", margin, y); y += 4;
        const textoBody: string[][] = [];
        for (const r of regs) {
          for (const c of CAMPOS_TEXTO_EXIBICAO) {
            const v = r.parametros[c.k];
            if (v) textoBody.push([fmtDt(r.data), c.l, String(v)]);
          }
          const outros = r.parametros["outros_lista"];
          if (outros && typeof outros === "string") {
            try {
              const lista = JSON.parse(outros) as { nome: string; resultado: string }[];
              lista.forEach(item => textoBody.push([fmtDt(r.data), item.nome, item.resultado]));
            } catch { /* ignora */ }
          }
        }
        if (textoBody.length > 0) {
          doc.autoTable({
            head: [["Data", "Exame", "Resultado"]],
            body: textoBody,
            startY: y,
            margin: { left: margin, right: margin },
            styles: { fontSize: 8, cellPadding: 2.5, textColor: [24, 41, 61] },
            headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [247, 250, 252] },
            columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 55 } },
          });
        }
      }

      doc.save(`${paciente.nome.replace(/\s+/g, "_")}_exames_${dataInicio}_${dataFim}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar PDF: " + (err as Error).message);
    }
    setGerandoPDF(false);
  }

  // ─── Tabela comparativa ───────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-index: 300 flex items-center justify-center p-2 sm:p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--card)", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>

        {/* Header */}
        <div style={{ background: "#1e3a5f", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "white" }}>
            📊 Exames — {paciente.nome}
          </span>
          <button onClick={onClose}
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "var(--nc-radius)", padding: "5px 12px", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ✕ Fechar
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "16px 20px", background: "var(--bg)" }}>
          {registroSelecionado ? (
            <VisualizarRegistro
              r={registroSelecionado}
              enrichRegistro={enrichRegistro}
              onVoltar={() => setRegistroSelecionado(null)}
              onPDF={exportarPDF}
              gerandoPDF={gerandoPDF}
            />
          ) : (
            <>
              {/* Filtros de período + ações — simplificado */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginBottom: 16, padding: "12px 14px", background: "var(--card)", borderRadius: "var(--nc-radius-lg)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", whiteSpace: "nowrap" }}>Período:</span>
                  <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                    className="nc-input" style={{ width: 145 }} />
                  <span style={{ fontSize: 12, color: "var(--text3)" }}>até</span>
                  <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                    className="nc-input" style={{ width: 145 }} />
                  <span style={{ fontSize: 12, color: "var(--text3)" }}>
                    ({registrosFiltrados.length} registro{registrosFiltrados.length !== 1 ? "s" : ""})
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setModo(m => m === "tabela" ? "registro" : "tabela")}
                    className="nc-btn nc-btn-ghost cursor-pointer" style={{ padding: "6px 12px", fontSize: 12 }}>
                    {modo === "tabela" ? "🔍 Por registro" : "📋 Tabela"}
                  </button>
                  <button onClick={exportarPDF} disabled={gerandoPDF || registrosFiltrados.length === 0}
                    className="nc-btn nc-btn-primary cursor-pointer" style={{ padding: "6px 14px", fontSize: 12 }}>
                    {gerandoPDF ? "⏳..." : "📄 PDF"}
                  </button>
                </div>
              </div>

              {/* Modo tabela transposta — exames nas linhas, datas nas colunas */}
              {modo === "tabela" && (() => {
                const regs = [...registrosFiltrados].reverse().map(enrichRegistro);
                const camposTabela = [
                  { k: "tfg_calc", l: "TFG-e (mL/min)" },
                  { k: "creatinina", l: "Creatinina (mg/dL)" },
                  { k: "ureia", l: "Ureia (mg/dL)" },
                  { k: "potassio", l: "Potássio (mEq/L)" },
                  { k: "sodio", l: "Sódio (mEq/L)" },
                  { k: "hemoglobina", l: "Hemoglobina (g/dL)" },
                  { k: "calcio", l: "Cálcio (mg/dL)" },
                  { k: "fosforo", l: "Fósforo (mg/dL)" },
                  { k: "ph", l: "pH" },
                  { k: "bic", l: "Bicarbonato (mEq/L)" },
                  { k: "albumina", l: "Albumina (g/dL)" },
                  { k: "plaquetas", l: "Plaquetas (mil/µL)" },
                  { k: "tap", l: "TAP (%)" },
                ];
                const camposComDados = camposTabela.filter(c =>
                  regs.some(r => r.parametros[c.k] != null)
                );
                return (
                  <div style={{ overflowX: "auto", isolation: "isolate" }}>
                    <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
                      <thead>
                        <tr style={{ background: "#1e3a5f" }}>
                          <th style={{ padding: "7px 10px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", position: "sticky", left: 0, background: "#1e3a5f", zIndex: 1 }}>
                            Exame
                          </th>
                          {regs.map(r => (
                            <th key={r.id} style={{ padding: "7px 10px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", minWidth: 76 }}>
                              {fmtDt(r.data)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {camposComDados.map(({ k, l }, idx) => (
                          <tr key={k} style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "var(--card)" : "var(--card2)" }}>
                            <td style={{ padding: "5px 10px", fontWeight: 700, color: "var(--text2)", whiteSpace: "nowrap", fontSize: 11, position: "sticky", left: 0, background: idx % 2 === 0 ? "var(--card)" : "var(--card2)", zIndex: 1 }}>
                              {l}
                            </td>
                            {regs.map(r => {
                              const v = r.parametros[k];
                              return (
                                <td key={r.id} style={{ padding: "5px 10px", textAlign: "center", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 12, color: v != null ? "var(--text)" : "var(--text3)" }}>
                                  {v != null ? String(v) : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* Modo lista por registro */}
              {modo === "registro" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...registrosFiltrados].reverse().map(r => (
                    <div key={r.id}
                      onClick={() => setRegistroSelecionado(r)}
                      style={{ padding: "12px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--nc-radius-lg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg2)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "var(--card)")}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{fmtDt(r.data)}</span>
                        <span style={{ marginLeft: 12, fontSize: 12, color: "var(--text3)" }}>
                          {[
                            r.parametros.creatinina ? `Cr ${r.parametros.creatinina}` : null,
                            r.parametros.ureia ? `Ur ${r.parametros.ureia}` : null,
                            r.parametros.potassio ? `K ${r.parametros.potassio}` : null,
                          ].filter(Boolean).join("  ·  ")}
                        </span>
                      </div>
                      <span style={{ color: "var(--text3)", fontSize: 14 }}>›</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}