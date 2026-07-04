"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Paciente } from "@/types/database";

// ─── CKD-EPI 2021 ────────────────────────────────────────────────────────────

function ckdEpi2021(cr: number, idade: number, sexo: "F" | "M"): number | null {
  if (!cr || !idade || isNaN(cr) || isNaN(idade)) return null;
  const k  = sexo === "F" ? 0.7 : 0.9;
  const a  = sexo === "F" ? -0.241 : -0.302;
  const sf = sexo === "F" ? 1.012 : 1.0;
  const r  = cr / k;
  return Math.round(142 * Math.pow(Math.min(r, 1), a) * Math.pow(Math.max(r, 1), -1.2) * Math.pow(0.9938, idade) * sf);
}

function estagioTFG(tfg: number | null): { label: string; cor: string; bg: string } {
  if (!tfg) return { label: "—", cor: "var(--text3)", bg: "var(--card2)" };
  if (tfg >= 90) return { label: "G1 ≥90",    cor: "#059669", bg: "#ecfdf5" };
  if (tfg >= 60) return { label: "G2 60–89",  cor: "#16a34a", bg: "#f0fdf4" };
  if (tfg >= 45) return { label: "G3a 45–59", cor: "#ca8a04", bg: "#fefce8" };
  if (tfg >= 30) return { label: "G3b 30–44", cor: "#d97706", bg: "#fffbeb" };
  if (tfg >= 15) return { label: "G4 15–29",  cor: "#ea580c", bg: "#fff7ed" };
  return            { label: "G5 <15",     cor: "#dc2626", bg: "#fef2f2" };
}

// ─── Campos de exame ──────────────────────────────────────────────────────────

type CampoKey =
  | "creatinina" | "ureia" | "potassio" | "sodio" | "calcio" | "fosforo"
  | "hemoglobina" | "hematocrito" | "plaquetas" | "rac" | "pth" | "vitamina_d"
  | "albumina" | "ldl" | "tg" | "tsh" | "fa" | "tgo" | "tgp"
  | "ph" | "bic" | "pco2" | "lactato" | "ferro" | "ferritina" | "tibc"
  | "sat_transf" | "glicemia" | "hba1c" | "acido_urico" | "pcr" | "c3" | "c4"
  | "inr" | "magnesio" | "cloro";

interface CampoConfig {
  k: CampoKey;
  l: string;
  u: string;
  normal?: [number, number];
  alerta?: [number, number];
}

const CAMPOS: CampoConfig[] = [
  { k: "creatinina",  l: "Creatinina",     u: "mg/dL",   normal: [0.5,1.2],   alerta: [1.2,3.0]  },
  { k: "ureia",       l: "Ureia",          u: "mg/dL",   normal: [10,50],     alerta: [50,100]   },
  { k: "potassio",    l: "Potássio",       u: "mEq/L",   normal: [3.5,5.0],   alerta: [3.0,5.5]  },
  { k: "sodio",       l: "Sódio",          u: "mEq/L",   normal: [135,145],   alerta: [130,150]  },
  { k: "calcio",      l: "Cálcio",         u: "mg/dL",   normal: [8.5,10.5],  alerta: [7.5,11.5] },
  { k: "fosforo",     l: "Fósforo",        u: "mg/dL",   normal: [2.5,4.5],   alerta: [1.5,6.0]  },
  { k: "magnesio",    l: "Magnésio",       u: "mg/dL",   normal: [1.5,2.5],   alerta: [1.0,3.0]  },
  { k: "cloro",       l: "Cloro",          u: "mEq/L",   normal: [98,106],    alerta: [90,110]   },
  { k: "hemoglobina", l: "Hemoglobina",    u: "g/dL",    normal: [12,17],     alerta: [8,12]     },
  { k: "hematocrito", l: "Hematócrito",    u: "%",       normal: [36,50],     alerta: [25,55]    },
  { k: "plaquetas",   l: "Plaquetas",      u: "mil/µL",  normal: [150,400],   alerta: [50,150]   },
  { k: "inr",         l: "INR",            u: "",        normal: [0.8,1.2],   alerta: [1.2,2.0]  },
  { k: "rac",         l: "RAC",            u: "mg/g",    normal: [0,30],      alerta: [30,300]   },
  { k: "pth",         l: "PTH",            u: "pg/mL",   normal: [15,65],     alerta: [65,300]   },
  { k: "vitamina_d",  l: "Vitamina D",     u: "ng/mL",   normal: [30,100],    alerta: [20,30]    },
  { k: "albumina",    l: "Albumina",       u: "g/dL",    normal: [3.5,5.0],   alerta: [2.5,3.5]  },
  { k: "ldl",         l: "LDL",           u: "mg/dL",   normal: [0,100],     alerta: [100,160]  },
  { k: "tg",          l: "Triglicérides",  u: "mg/dL",   normal: [0,150],     alerta: [150,500]  },
  { k: "tsh",         l: "TSH",            u: "µUI/mL",  normal: [0.4,4.0],   alerta: [4.0,10.0] },
  { k: "fa",          l: "Fosfatase Alc.", u: "U/L",     normal: [40,130],    alerta: [130,300]  },
  { k: "tgo",         l: "TGO (AST)",      u: "U/L",     normal: [5,40],      alerta: [40,120]   },
  { k: "tgp",         l: "TGP (ALT)",      u: "U/L",     normal: [7,56],      alerta: [56,120]   },
  { k: "ph",          l: "pH",             u: "",        normal: [7.35,7.45], alerta: [7.25,7.55]},
  { k: "bic",         l: "Bicarbonato",    u: "mEq/L",   normal: [22,28],     alerta: [18,32]    },
  { k: "pco2",        l: "pCO₂",           u: "mmHg",    normal: [35,45],     alerta: [25,55]    },
  { k: "lactato",     l: "Lactato",        u: "mmol/L",  normal: [0,2.0],     alerta: [2.0,4.0]  },
  { k: "ferro",       l: "Ferro sérico",   u: "µg/dL",   normal: [60,170],    alerta: [30,60]    },
  { k: "ferritina",   l: "Ferritina",      u: "ng/mL",   normal: [12,300],    alerta: [300,1000] },
  { k: "tibc",        l: "TIBC",           u: "µg/dL",   normal: [250,370],   alerta: [150,250]  },
  { k: "sat_transf",  l: "Sat. Transf.",   u: "%",       normal: [20,50],     alerta: [10,20]    },
  { k: "glicemia",    l: "Glicemia",       u: "mg/dL",   normal: [70,100],    alerta: [100,200]  },
  { k: "hba1c",       l: "HbA1c",          u: "%",       normal: [4,5.7],     alerta: [5.7,6.5]  },
  { k: "acido_urico", l: "Ác. Úrico",      u: "mg/dL",   normal: [2.4,6.0],   alerta: [6.0,9.0]  },
  { k: "pcr",         l: "PCR",            u: "mg/L",    normal: [0,5],       alerta: [5,50]     },
  { k: "c3",          l: "C3",             u: "mg/dL",   normal: [90,180],    alerta: [50,90]    },
  { k: "c4",          l: "C4",             u: "mg/dL",   normal: [16,47],     alerta: [8,16]     },
];

// Perfis por diagnóstico — filtra quais campos aparecer por padrão
const PERFIS: Record<string, { label: string; icon: string; campos: CampoKey[] }> = {
  geral:          { label: "Geral",          icon: "🔬", campos: ["creatinina","ureia","potassio","sodio","hemoglobina","pcr","albumina","ph","bic"] },
  ira:            { label: "IRA",      icon: "🚨", campos: ["creatinina","ureia","potassio","sodio","calcio","fosforo","hemoglobina","ph","bic","pco2","lactato","plaquetas","inr","pcr","albumina"] },
  //drc:            { label: "DRC",            icon: "🫘", campos: ["creatinina","ureia","potassio","sodio","calcio","fosforo","hemoglobina","rac","pth","vitamina_d","albumina","ph","bic","tsh","ldl","tg","glicemia","hba1c","ferro","ferritina","sat_transf"] },
  //dialise:        { label: "Diálise",        icon: "💉", campos: ["creatinina","ureia","potassio","sodio","calcio","fosforo","hemoglobina","pth","vitamina_d","albumina","ph","bic","ferro","ferritina","sat_transf","pcr"] },
  glomerulopatia: { label: "Glomerulopatia", icon: "🔴", campos: ["creatinina","ureia","potassio","sodio","calcio","fosforo","hemoglobina","rac","albumina","c3","c4","tgo","tgp","ldl","glicemia","tsh"] },
  transplante:    { label: "Plasmaférese",    icon: "✅", campos: ["creatinina","ureia","potassio","sodio","calcio","fosforo","hemoglobina","rac","albumina","glicemia","hba1c","ldl","tg","tsh","fa","tgo","tgp","pth","vitamina_d","pcr"] },
};

// ─── Gráfico TFG com Canvas (faixas KDIGO) ───────────────────────────────────

function GraficoTFG({ valores, datas }: { valores: number[]; datas: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || valores.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    if (!rect.width) return;
    c.width = rect.width * dpr;
    c.height = 130 * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = 130, PT = 8, PB = 22, PL = 8, PR = 8;
    const maxTFG = 130;
    const tx = (i: number) => PL + (i / (valores.length - 1)) * (W - PL - PR);
    const ty = (v: number) => PT + (1 - Math.min(v / maxTFG, 1)) * (H - PT - PB);

    // Faixas de fundo por estágio KDIGO
    const faixas = [
      { min: 90, max: 130, cor: "#059669" }, { min: 60, max: 90, cor: "#16a34a" },
      { min: 45, max: 60, cor: "#ca8a04" },  { min: 30, max: 45, cor: "#d97706" },
      { min: 15, max: 30, cor: "#ea580c" },  { min: 0,  max: 15, cor: "#dc2626" },
    ];
    faixas.forEach((f) => {
      ctx.fillStyle = f.cor + "18";
      ctx.fillRect(PL, ty(f.max), W - PL - PR, ty(f.min) - ty(f.max));
    });

    // Linhas de referência
    [{ v: 90, l: "G1" }, { v: 60, l: "G2/G3" }, { v: 30, l: "G3b/G4" }, { v: 15, l: "G4/G5" }].forEach(({ v, l }) => {
      ctx.strokeStyle = "rgba(0,0,0,0.1)"; ctx.lineWidth = 0.8; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(PL, ty(v)); ctx.lineTo(W - PR, ty(v)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.font = "bold 9px Inter,sans-serif"; ctx.textAlign = "left";
      ctx.fillText(String(v), PL + 2, ty(v) - 3);
    });

    const ultimo = valores[valores.length - 1];
    const est = estagioTFG(ultimo);

    // Área
    ctx.beginPath(); ctx.moveTo(tx(0), ty(valores[0]));
    valores.forEach((v, i) => ctx.lineTo(tx(i), ty(v)));
    ctx.lineTo(tx(valores.length - 1), H - PB); ctx.lineTo(tx(0), H - PB); ctx.closePath();
    ctx.fillStyle = est.cor + "22"; ctx.fill();

    // Linha
    ctx.beginPath(); ctx.moveTo(tx(0), ty(valores[0]));
    valores.forEach((v, i) => ctx.lineTo(tx(i), ty(v)));
    ctx.strokeStyle = est.cor; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke();

    // Pontos
    valores.forEach((v, i) => {
      const isLast = i === valores.length - 1;
      ctx.beginPath(); ctx.arc(tx(i), ty(v), isLast ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? est.cor : est.cor + "88"; ctx.fill();
      if (isLast || valores.length <= 6) {
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.font = "bold 10px Inter,monospace"; ctx.textAlign = "center";
        ctx.fillText(String(v), tx(i), ty(v) - 8);
      }
    });

    // Datas eixo X
    ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.font = "9px Inter,sans-serif"; ctx.textAlign = "center";
    datas.forEach((d, i) => {
      if (valores.length <= 6 || i === 0 || i === valores.length - 1 || i % Math.ceil(valores.length / 4) === 0)
        ctx.fillText(d, tx(i), H - 5);
    });
  }, [valores, datas]);

  if (valores.length < 2) return null;

  const ultimo = valores[valores.length - 1];
  const est = estagioTFG(ultimo);

  return (
    <div className="nc-card overflow-hidden">
      <div className="flex items-start justify-between px-3 pt-3 pb-1">
        <div>
          <p className="text-xs font-bold" style={{ color: "var(--text2)" }}>TFG — CKD-EPI 2021</p>
          <p className="text-[10px]" style={{ color: "var(--text3)" }}>mL/min/1,73m²</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black" style={{ color: est.cor, fontFamily: "var(--mono)" }}>{ultimo}</p>
          <p className="text-[11px] font-bold" style={{ color: est.cor }}>{est.label}</p>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ width: "100%", height: 130, display: "block" }} />
    </div>
  );
}

// ─── Gráfico de linha genérico com Canvas ────────────────────────────────────

function GraficoLinha({
  id, label, unidade, valores, datas, cor, refLine,
}: {
  id: string; label: string; unidade: string;
  valores: number[]; datas: string[]; cor: string; refLine?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || valores.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    if (!rect.width) return;
    c.width = rect.width * dpr; c.height = 110 * dpr;
    const ctx = c.getContext("2d")!; ctx.scale(dpr, dpr);
    const W = rect.width, H = 110, PT = 10, PB = 22, PL = 8, PR = 8;
    const mn = Math.min(...valores) * 0.88, mx = Math.max(...valores) * 1.12;
    const tx = (i: number) => PL + (i / (valores.length - 1)) * (W - PL - PR);
    const ty = (v: number) => PT + (1 - (v - mn) / (mx - mn)) * (H - PT - PB);

    if (refLine && refLine > mn && refLine < mx) {
      ctx.strokeStyle = "rgba(0,0,0,0.1)"; ctx.lineWidth = 0.8; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(PL, ty(refLine)); ctx.lineTo(W - PR, ty(refLine)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.font = "bold 9px Inter,sans-serif"; ctx.textAlign = "left";
      ctx.fillText(String(refLine), PL + 2, ty(refLine) - 3);
    }

    ctx.beginPath(); ctx.moveTo(tx(0), ty(valores[0]));
    valores.forEach((v, i) => ctx.lineTo(tx(i), ty(v)));
    ctx.lineTo(tx(valores.length - 1), H - PB); ctx.lineTo(tx(0), H - PB); ctx.closePath();
    ctx.fillStyle = cor + "20"; ctx.fill();

    ctx.beginPath(); ctx.moveTo(tx(0), ty(valores[0]));
    valores.forEach((v, i) => ctx.lineTo(tx(i), ty(v)));
    ctx.strokeStyle = cor; ctx.lineWidth = 2.2; ctx.lineJoin = "round"; ctx.stroke();

    valores.forEach((v, i) => {
      const isLast = i === valores.length - 1;
      ctx.beginPath(); ctx.arc(tx(i), ty(v), isLast ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? cor : cor + "88"; ctx.fill();
      if (isLast || valores.length <= 6) {
        const lbl = v % 1 !== 0 ? v.toFixed(v < 10 ? 2 : 1) : String(v);
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.font = "bold 10px Inter,monospace"; ctx.textAlign = "center";
        ctx.fillText(lbl, tx(i), ty(v) - 8);
      }
    });

    ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.font = "9px Inter,sans-serif"; ctx.textAlign = "center";
    datas.forEach((d, i) => {
      if (valores.length <= 6 || i === 0 || i === valores.length - 1 || i % Math.ceil(valores.length / 4) === 0)
        ctx.fillText(d, tx(i), H - 5);
    });
  }, [valores, datas, cor, refLine]);

  const ultimo = valores[valores.length - 1];
  return (
    <div className="nc-card overflow-hidden">
      <div className="flex items-baseline justify-between px-3 pt-3 pb-1">
        <span className="text-xs font-bold" style={{ color: "var(--text2)" }}>{label}</span>
        <span className="text-lg font-black" style={{ color: cor, fontFamily: "var(--mono)" }}>
          {ultimo} <span className="text-[10px] font-normal" style={{ color: "var(--text3)" }}>{unidade}</span>
        </span>
      </div>
      {valores.length >= 2 ? (
        <canvas ref={canvasRef} style={{ width: "100%", height: 110, display: "block" }} />
      ) : (
        <p className="px-3 pb-3 text-[11px]" style={{ color: "var(--text3)" }}>Apenas 1 ponto — adicione mais registros para ver o gráfico.</p>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function corValor(v: number, normal?: [number, number], alerta?: [number, number]): string {
  if (!normal || !alerta) return "var(--text)";
  if (v >= normal[0] && v <= normal[1]) return "#059669";
  if (v >= alerta[0] && v <= alerta[1]) return "#d97706";
  return "#dc2626";
}

function fmtDt(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const VAZIO = () => Object.fromEntries(CAMPOS.map((c) => [c.k, ""])) as Record<string, string>;

// ─── Componente principal ─────────────────────────────────────────────────────

interface AbaExamesProps {
  acompanhamentoId: string;
  paciente: Paciente;
}

interface RegistroExame {
  id: string;
  data: string;
  parametros: Record<string, number | null>;
}

export function AbaExames({ acompanhamentoId, paciente }: AbaExamesProps) {
  const supabase = createClient();
  const [registros, setRegistros] = useState<RegistroExame[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Formulário (novo ou edição)
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [perfilAtivo, setPerfilAtivo] = useState<string>("geral");
  const [form, setForm] = useState<Record<string, string>>(VAZIO());
  const [dataColeta, setDataColeta] = useState(() => new Date().toISOString().slice(0, 10));

  // Calcula TFG em tempo real ao preencher creatinina
  const idade = paciente.data_nascimento
    ? Math.floor((Date.now() - new Date(paciente.data_nascimento).getTime()) / (365.25 * 24 * 3600 * 1000))
    : 0;
  const tfgAtual = form.creatinina && paciente.sexo
    ? ckdEpi2021(Number(form.creatinina.replace(",", ".")), idade, paciente.sexo as "F" | "M")
    : null;
  const estAtual = estagioTFG(tfgAtual);

  const carregarRegistros = useCallback(async () => {
    setCarregando(true);
    const { data } = await supabase
      .from("exames")
      .select("*")
      .eq("acompanhamento_id", acompanhamentoId)
      .order("data", { ascending: true });
    setRegistros(data || []);
    setCarregando(false);
  }, [acompanhamentoId]);

  useEffect(() => { carregarRegistros(); }, [carregarRegistros]);

  function setF(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  function abrirNovo() {
    setForm(VAZIO()); setDataColeta(new Date().toISOString().slice(0, 10));
    setEditingId(null); setErro(null); setShowModal(true);
  }

  function abrirEditar(r: RegistroExame) {
    const f = VAZIO();
    CAMPOS.forEach((c) => { f[c.k] = r.parametros?.[c.k] != null ? String(r.parametros[c.k]) : ""; });
    setForm(f); setDataColeta(r.data); setEditingId(r.id); setErro(null); setShowModal(true);
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este registro de exames?")) return;
    await supabase.from("exames").delete().eq("id", id);
    setRegistros((p) => p.filter((r) => r.id !== id));
  }

  async function salvar() {
    const parametros: Record<string, number | null> = {};
    let temAlgum = false;
    CAMPOS.forEach((c) => {
      const v = form[c.k];
      if (v && v.trim()) {
        const n = parseFloat(v.replace(",", "."));
        if (!isNaN(n)) { parametros[c.k] = n; temAlgum = true; }
        else parametros[c.k] = null;
      } else parametros[c.k] = null;
    });
    if (!temAlgum) { setErro("Preencha ao menos um parâmetro."); return; }
    setErro(null); setSaving(true);

    if (editingId) {
      const { error } = await supabase.from("exames").update({ data: dataColeta, parametros }).eq("id", editingId);
      if (error) { setErro(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("exames").upsert(
        { acompanhamento_id: acompanhamentoId, data: dataColeta, parametros },
        { onConflict: "acompanhamento_id,data" }
      );
      if (error) { setErro(error.message); setSaving(false); return; }
    }
    setSaving(false); setShowModal(false);
    carregarRegistros();
  }

  // Série temporal de um campo nos registros
  function serie(k: string) {
    return registros.filter((r) => r.parametros?.[k] != null)
      .map((r) => r.parametros[k] as number);
  }
  function datasParaSerie(k: string) {
    return registros.filter((r) => r.parametros?.[k] != null).map((r) => fmtDt(r.data));
  }
  function ultimoValor(k: string): number | null {
    for (let i = registros.length - 1; i >= 0; i--) {
      const v = registros[i].parametros?.[k];
      if (v != null) return v as number;
    }
    return null;
  }

  const camposDoPerfilAtivo = PERFIS[perfilAtivo]?.campos ?? CAMPOS.map((c) => c.k);
  const tfgSerie = registros
    .filter((r) => r.parametros?.creatinina != null)
    .map((r) => ckdEpi2021(r.parametros.creatinina!, idade, paciente.sexo as "F" | "M"))
    .filter(Boolean) as number[];
  const tfgDatas = registros
    .filter((r) => r.parametros?.creatinina != null)
    .map((r) => fmtDt(r.data));

  return (
    <div className="space-y-4">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--text3)" }}>
          {carregando ? "Carregando..." : registros.length === 0
            ? "Nenhum exame registrado ainda."
            : `${registros.length} registro(s) · último em ${fmtDt(registros[registros.length - 1]?.data)}`}
        </p>
        <button onClick={abrirNovo} className="nc-btn nc-btn-primary cursor-pointer"
          style={{ padding: "6px 14px" }}>
          + Novo registro
        </button>
      </div>

      {/* Gráfico TFG — destaque principal */}
      {tfgSerie.length >= 2 && (
        <GraficoTFG valores={tfgSerie} datas={tfgDatas} />
      )}

      {/* Gráficos dos demais parâmetros que têm ≥2 pontos */}
      {registros.length >= 2 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { k: "creatinina", cor: "#dc2626", ref: 1.2 },
            { k: "ureia",      cor: "#d97706", ref: 50  },
            { k: "potassio",   cor: "#ea580c", ref: 5.0 },
            { k: "hemoglobina",cor: "#6366f1", ref: 12  },
            { k: "ph",         cor: "#0ea5e9", ref: 7.35 },
            { k: "pcr",        cor: "#8b5cf6", ref: 5   },
          ].map(({ k, cor, ref }) => {
            const vals = serie(k); const dts = datasParaSerie(k);
            if (vals.length < 2) return null;
            const cfg = CAMPOS.find((c) => c.k === k)!;
            return (
              <GraficoLinha key={k} id={`chart-${k}`}
                label={cfg.l} unidade={cfg.u}
                valores={vals} datas={dts} cor={cor} refLine={ref} />
            );
          })}
        </div>
      )}

      {/* Tabela de registros */}
      {!carregando && registros.length > 0 && (
        <div className="nc-card overflow-hidden">
          <p className="px-4 py-3 text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--text3)", borderBottom: "1px solid var(--border)" }}>
            Histórico de registros
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--card2)" }}>
                  <th className="px-4 py-2 text-left text-xs font-bold" style={{ color: "var(--text3)" }}>Data</th>
                  {["creatinina","ureia","potassio","sodio","hemoglobina","ph"].map((k) => {
                    const cfg = CAMPOS.find((c) => c.k === k)!;
                    return (
                      <th key={k} className="px-3 py-2 text-right text-xs font-bold" style={{ color: "var(--text3)" }}>
                        {cfg.l}
                      </th>
                    );
                  })}
                  <th className="px-3 py-2 text-right text-xs font-bold" style={{ color: "var(--text3)" }}>TFG</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {[...registros].reverse().map((r) => {
                  const tfg = r.parametros?.creatinina
                    ? ckdEpi2021(r.parametros.creatinina, idade, paciente.sexo as "F" | "M")
                    : null;
                  const estR = estagioTFG(tfg);
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: "var(--text2)" }}>
                        {fmtDt(r.data)}
                      </td>
                      {["creatinina","ureia","potassio","sodio","hemoglobina","ph"].map((k) => {
                        const v = r.parametros?.[k];
                        const cfg = CAMPOS.find((c) => c.k === k)!;
                        return (
                          <td key={k} className="px-3 py-2.5 text-right text-xs font-bold"
                            style={{ color: v != null ? corValor(v as number, cfg.normal, cfg.alerta) : "var(--text3)", fontFamily: "var(--mono)" }}>
                            {v != null ? v : "—"}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right text-xs font-black"
                        style={{ color: estR.cor, fontFamily: "var(--mono)" }}>
                        {tfg ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-3">
                          <button onClick={() => abrirEditar(r)}
                            className="cursor-pointer text-xs transition hover:opacity-70"
                            style={{ color: "var(--text2)" }}>Editar</button>
                          <button onClick={() => excluir(r.id)}
                            className="cursor-pointer text-xs transition hover:opacity-70"
                            style={{ color: "var(--red)" }}>Excluir</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de novo/editar registro */}
      {showModal && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center p-2 sm:p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl sm:max-h-[90vh]"
            style={{ background: "var(--card)", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-5 py-3.5"
              style={{ background: "#1e3a5f", borderBottom: "1px solid var(--border)" }}>
              <div>
                <span className="text-sm font-extrabold text-white">
                  {editingId ? "Editar registro" : "Novo registro de exames"}
                </span>
                <span className="ml-3 text-xs text-white opacity-70">
                  {paciente.nome} · {paciente.sexo} · {idade}a
                </span>
              </div>
              <button onClick={() => setShowModal(false)}
                className="cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.15)" }}>
                ✕ Fechar
              </button>
            </div>

            {/* Corpo com scroll */}
            <div className="flex-1 overflow-y-auto px-5 py-4" style={{ background: "var(--bg)" }}>

              {/* Data + TFG em tempo real */}
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <div className="flex flex-col gap-1">
                  <label className="nc-label" style={{ marginBottom: 0 }}>Data da coleta</label>
                  <input type="date" value={dataColeta} onChange={(e) => setDataColeta(e.target.value)}
                    className="nc-input" style={{ width: 160 }} />
                </div>
                {tfgAtual !== null && (
                  <div className="flex items-center gap-2 rounded-(--nc-radius) px-4 py-2"
                    style={{ background: estAtual.bg, border: `1px solid ${estAtual.cor}40` }}>
                    <div>
                      <p className="text-[10px] font-bold uppercase" style={{ color: estAtual.cor }}>TFG-e (CKD-EPI 2021)</p>
                      <p className="text-2xl font-black leading-none" style={{ color: estAtual.cor, fontFamily: "var(--mono)" }}>
                        {tfgAtual} <span className="text-xs font-normal">mL/min/1,73m²</span>
                      </p>
                      <p className="text-xs font-bold" style={{ color: estAtual.cor }}>DRC {estAtual.label}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Seletor de perfil */}
              <div className="mb-4 flex flex-wrap gap-1.5">
                {Object.entries(PERFIS).map(([k, p]) => (
                  <button key={k} onClick={() => setPerfilAtivo(k)}
                    className="cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80"
                    style={{
                      background: perfilAtivo === k ? "var(--accent)" : "var(--card2)",
                      color: perfilAtivo === k ? "white" : "var(--text2)",
                      border: `1px solid ${perfilAtivo === k ? "var(--accent)" : "var(--border)"}`,
                    }}>
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>

              {/* Campos do perfil selecionado */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 md:grid-cols-4">
                {CAMPOS.filter((c) => camposDoPerfilAtivo.includes(c.k)).map((c) => (
                  <div key={c.k} className="flex flex-col gap-0.5">
                    <label className="text-[11px] font-semibold" style={{ color: "var(--text3)" }}>
                      {c.l}
                      {c.u && <span className="ml-1 opacity-60">({c.u})</span>}
                    </label>
                    <input
                      type="number" step="any"
                      value={form[c.k] ?? ""}
                      onChange={(e) => setF(c.k, e.target.value)}
                      placeholder="—"
                      className="nc-input"
                      style={{
                        padding: "5px 8px", fontSize: 13,
                        color: form[c.k] ? corValor(
                          parseFloat(form[c.k].replace(",", ".")),
                          c.normal, c.alerta
                        ) : "var(--text)",
                        fontWeight: form[c.k] ? 700 : 400,
                      }}
                    />
                    {/* Mostra TFG calculado ao lado da creatinina */}
                    {c.k === "creatinina" && tfgAtual !== null && (
                      <span className="text-[10px] font-bold" style={{ color: estAtual.cor }}>
                        TFG: {tfgAtual} ({estAtual.label})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            {erro && (
              <div className="px-5 py-2" style={{ background: "var(--red-dim)" }}>
                <p className="text-sm" style={{ color: "var(--red)" }}>⚠ {erro}</p>
              </div>
            )}
            <div className="flex shrink-0 justify-end gap-2 px-5 py-3.5"
              style={{ borderTop: "1px solid var(--border)", background: "var(--card)" }}>
              <button onClick={() => setShowModal(false)} className="nc-btn nc-btn-ghost cursor-pointer">Cancelar</button>
              <button onClick={salvar} disabled={saving} className="nc-btn nc-btn-primary cursor-pointer" style={{ minWidth: 140 }}>
                {saving ? "Salvando..." : editingId ? "✓ Atualizar" : "Salvar exames"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}