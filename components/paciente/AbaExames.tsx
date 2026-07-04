"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Paciente, AcompanhamentoNefro } from "@/types/database";
import { ExportarExames } from "./ExportarExames";

// ─── CKD-EPI 2021 ────────────────────────────────────────────────────────────

function ckdEpi2021(cr: number, idade: number, sexo: "F" | "M"): number | null {
  if (!cr || !idade || isNaN(cr) || isNaN(idade) || cr <= 0 || idade <= 0) return null;
  const k = sexo === "F" ? 0.7 : 0.9;
  const a = sexo === "F" ? -0.241 : -0.302;
  const sf = sexo === "F" ? 1.012 : 1.0;
  const r = cr / k;
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

function corValor(v: number, normal?: [number, number], alerta?: [number, number]): string {
  if (!normal || !alerta) return "var(--text)";
  if (v >= normal[0] && v <= normal[1]) return "#059669";
  if (v >= alerta[0] && v <= alerta[1]) return "#d97706";
  return "#dc2626";
}

function fmtDt(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RegistroExame {
  id: string;
  data: string;
  parametros: Record<string, number | string | null>;
}

// ─── Campos numéricos comuns ──────────────────────────────────────────────────

interface Campo {
  k: string;
  l: string;
  u: string;
  normal?: [number, number];
  alerta?: [number, number];
  tipo?: "numero" | "texto";
}

const CAMPOS_NUMERICOS: Campo[] = [
  { k: "creatinina",  l: "Creatinina",    u: "mg/dL",  normal:[0.5,1.2],  alerta:[1.2,3.0] },
  { k: "ureia",       l: "Ureia",         u: "mg/dL",  normal:[10,50],    alerta:[50,100]  },
  { k: "sodio",       l: "Sódio",         u: "mEq/L",  normal:[135,145],  alerta:[130,150] },
  { k: "potassio",    l: "Potássio",       u: "mEq/L",  normal:[3.5,5.0],  alerta:[3.0,5.5] },
  { k: "calcio",      l: "Cálcio",        u: "mg/dL",  normal:[8.5,10.5], alerta:[7.5,11.5]},
  { k: "fosforo",     l: "Fósforo",       u: "mg/dL",  normal:[2.5,4.5],  alerta:[1.5,6.0] },
  { k: "magnesio",    l: "Magnésio",      u: "mg/dL",  normal:[1.5,2.5],  alerta:[1.0,3.0] },
  { k: "ph",          l: "pH",            u: "",       normal:[7.35,7.45],alerta:[7.25,7.55]},
  { k: "bic",         l: "Bicarbonato",   u: "mEq/L",  normal:[22,28],    alerta:[18,32]   },
  { k: "lactato",     l: "Lactato",       u: "mmol/L", normal:[0,2.0],    alerta:[2.0,4.0] },
  { k: "albumina",    l: "Albumina",      u: "g/dL",   normal:[3.5,5.0],  alerta:[2.5,3.5] },
  { k: "tap",         l: "TAP (%)",       u: "%",      normal:[70,100],   alerta:[50,70]   },
  { k: "ttpa",        l: "TTPa (relação)",u: "",       normal:[0.8,1.2],  alerta:[1.2,2.0] },
  { k: "hemoglobina", l: "Hemoglobina",   u: "g/dL",   normal:[12,17],    alerta:[8,12]    },
  { k: "hematocrito", l: "Hematócrito",   u: "%",      normal:[36,50],    alerta:[25,55]   },
  { k: "plaquetas",   l: "Plaquetas",     u: "mil/µL", normal:[150,400],  alerta:[50,150]  },
  { k: "cpk",         l: "CPK",           u: "U/L",    normal:[30,200],   alerta:[200,1000]},
  { k: "acido_urico", l: "Ác. Úrico",     u: "mg/dL",  normal:[2.4,6.0],  alerta:[6.0,9.0] },
  { k: "tgo",         l: "TGO (AST)",     u: "U/L",    normal:[5,40],     alerta:[40,120]  },
  { k: "tgp",         l: "TGP (ALT)",     u: "U/L",    normal:[7,56],     alerta:[56,120]  },
  { k: "fa",          l: "Fosfatase Alc.",u: "U/L",    normal:[40,130],   alerta:[130,300] },
  { k: "ggt",         l: "Gama-GT",       u: "U/L",    normal:[5,55],     alerta:[55,200]  },
  { k: "bilirrubina_total", l: "Bilirrubina Total", u: "mg/dL", normal:[0,1.2], alerta:[1.2,5.0] },
  { k: "fibrinogenio",l: "Fibrinogênio",  u: "mg/dL",  normal:[200,400],  alerta:[100,200] },
  { k: "c3",          l: "C3",            u: "mg/dL",  normal:[90,180],   alerta:[50,90]   },
  { k: "c4",          l: "C4",            u: "mg/dL",  normal:[16,47],    alerta:[8,16]    },
  { k: "c1q",         l: "C1q",           u: "mg/dL",  normal:[10,25],    alerta:[5,10]    },
  { k: "aso",         l: "ASLO",          u: "UI/mL",  normal:[0,200],    alerta:[200,400] },
  { k: "iga",         l: "IgA sérica",    u: "mg/dL",  normal:[70,400],   alerta:[400,1000]},
  { k: "tsh",         l: "TSH",           u: "µUI/mL", normal:[0.4,4.0],  alerta:[4.0,10.0]},
  { k: "t4l",         l: "T4 livre",      u: "ng/dL",  normal:[0.8,1.8],  alerta:[0.5,0.8] },
  { k: "colesterol",  l: "Col. Total",    u: "mg/dL",  normal:[0,200],    alerta:[200,240] },
  { k: "ldl",         l: "LDL",           u: "mg/dL",  normal:[0,100],    alerta:[100,160] },
  { k: "hdl",         l: "HDL",           u: "mg/dL",  normal:[40,999],   alerta:[35,40]   },
  { k: "tg",          l: "Triglicérides", u: "mg/dL",  normal:[0,150],    alerta:[150,500] },
  { k: "glicemia",    l: "Glicemia",      u: "mg/dL",  normal:[70,100],   alerta:[100,200] },
  { k: "calcio_ionico", l: "Cálcio iônico", u: "mmol/L", normal:[1.15,1.35], alerta:[1.0,1.15] },
  { k: "rac",         l: "RAC (mg/g)",    u: "mg/g",   normal:[0,30],     alerta:[30,300]  },
  { k: "rpc",         l: "RPC (mg/g)",    u: "mg/g",   normal:[0,200],    alerta:[200,3500]},
  { k: "proteinuria_24h", l: "Proteinúria 24h", u: "g/24h", normal:[0,0.15], alerta:[0.15,3.5]},
  { k: "clearance_cr",l: "Clearance Cr",  u: "mL/min", normal:[60,120],   alerta:[30,60]   },
  { k: "beta2_micro", l: "β2-microglobulina", u: "mg/L", normal:[0,2.5], alerta:[2.5,5.0] },
  { k: "pla2r",       l: "PLA2R",         u: "RU/mL",  normal:[0,14],     alerta:[14,50]   },
  { k: "dhl",         l: "DHL",           u: "U/L",    normal:[120,246],  alerta:[246,600] },
  { k: "haptoglobina",l: "Haptoglobina",  u: "mg/dL",  normal:[36,195],   alerta:[10,36]   },
];

// Campos texto livre — resultados qualitativos/descritivos
const CAMPOS_TEXTO: Campo[] = [
  { k: "eas",              l: "EAS / Urina tipo 1",                    u: "", tipo: "texto" },
  { k: "urocultura",       l: "Urocultura",                            u: "", tipo: "texto" },
  { k: "dismorfismo",      l: "Dismorfismo eritrocitário",             u: "", tipo: "texto" },
  { k: "imagem",           l: "Exame de imagem",                       u: "", tipo: "texto" },
  { k: "fan",              l: "FAN / Anti-DNA dupla hélice",           u: "", tipo: "texto" },
  { k: "anca",             l: "p-ANCA / c-ANCA",                       u: "", tipo: "texto" },
  { k: "crioglobulinas",   l: "Crioglobulinas séricas",                u: "", tipo: "texto" },
  { k: "eletroforese_ser", l: "Eletroforese proteínas séricas",        u: "", tipo: "texto" },
  { k: "eletroforese_ur",  l: "Eletroforese proteínas urinárias",      u: "", tipo: "texto" },
  { k: "sorologias_hiv",   l: "Anti-HIV 1 e 2",                        u: "", tipo: "texto" },
  { k: "sorologias_hcv",   l: "Anti-HCV",                              u: "", tipo: "texto" },
  { k: "sorologias_hbv",   l: "Anti-HBs / Anti-HBc / HBsAg",          u: "", tipo: "texto" },
  { k: "sorologias_vdrl",  l: "VDRL",                                  u: "", tipo: "texto" },
  { k: "coombs",           l: "Coombs direto / Esquizócitos",          u: "", tipo: "texto" },
  { k: "antifosfolipides", l: "Antifosfolípides (AL, aCL, anti-β2-GPI)", u: "", tipo: "texto" },
  { k: "anti_lkm",         l: "Anti-LKM, anti-SLA, anti-SM, anti-RNP", u: "", tipo: "texto" },
  { k: "anti_gbm",         l: "Anti-GBM",                              u: "", tipo: "texto" },
  { k: "cadeias_leves",    l: "Cadeias leves livres (κ/λ)",            u: "", tipo: "texto" },
  { k: "imunofixacao_ur",  l: "Imunofixação urinária",                 u: "", tipo: "texto" },
  { k: "bhcg",             l: "β-HCG",                                 u: "", tipo: "texto" },
];

// ─── Perfis ───────────────────────────────────────────────────────────────────

const PERFIS: Record<string, { label: string; icon: string; numericos: string[]; textos: string[] }> = {
  geral: {
    label: "Geral", icon: "🔬",
    numericos: ["creatinina","ureia","sodio","potassio","calcio","calcio_ionico","fosforo","ph","bic","lactato","albumina","tap","ttpa","hemoglobina","hematocrito","plaquetas","tgo","tgp","cpk","acido_urico","rac"],
    textos: ["eas","urocultura","imagem"],
  },
  ira: {
    label: "IRA / UTI", icon: "🚨",
    numericos: ["creatinina","ureia","sodio","potassio","calcio","calcio_ionico","fosforo","ph","bic","lactato","albumina","tap","ttpa","hemoglobina","hematocrito","plaquetas","cpk","acido_urico"],
    textos: ["eas","urocultura","imagem"],
  },
  glomerulopatia: {
    label: "Glomerulopatia", icon: "🔴",
    numericos: [
      "creatinina","ureia","sodio","potassio","calcio","fosforo","magnesio","acido_urico",
      "fa","ggt","tap","ttpa","hemoglobina","hematocrito","plaquetas",
      "tgo","tgp","bilirrubina_total","dhl","haptoglobina",
      "tsh","t4l","colesterol","ldl","hdl","tg","glicemia",
      "c3","c4","c1q","aso","iga",
      "rac","rpc","proteinuria_24h","clearance_cr",
      "pla2r","beta2_micro","albumina",
    ],
    textos: [
      "eas","dismorfismo","urocultura","imagem",
      "fan","anca","crioglobulinas",
      "eletroforese_ser","eletroforese_ur",
      "sorologias_hiv","sorologias_hcv","sorologias_hbv","sorologias_vdrl",
      "coombs","antifosfolipides","anti_lkm","anti_gbm",
      "cadeias_leves","imunofixacao_ur","bhcg",
    ],
  },
  plasmaferese: {
    label: "Plasmaférese", icon: "✅",
    numericos: ["creatinina","ureia","sodio","potassio","hemoglobina","hematocrito","plaquetas","fibrinogenio"],
    textos: ["imagem"],
  },
};

// ─── Gráfico Canvas genérico ──────────────────────────────────────────────────

function MiniGrafico({ valores, datas, cor, refLine, label, unidade }: {
  valores: number[]; datas: string[]; cor: string;
  refLine?: number; label: string; unidade: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || valores.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    if (!rect.width) return;
    c.width = rect.width * dpr; c.height = 80 * dpr;
    const ctx = c.getContext("2d")!; ctx.scale(dpr, dpr);
    const W = rect.width, H = 80, PT = 10, PB = 18, PL = 6, PR = 6;
    const mn = Math.min(...valores) * 0.88, mx = Math.max(...valores) * 1.12;
    const range = mx - mn || 1;
    const tx = (i: number) => PL + (i / (valores.length - 1)) * (W - PL - PR);
    const ty = (v: number) => PT + (1 - (v - mn) / range) * (H - PT - PB);
    if (refLine && refLine > mn && refLine < mx) {
      ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 0.8; ctx.setLineDash([3,2]);
      ctx.beginPath(); ctx.moveTo(PL, ty(refLine)); ctx.lineTo(W-PR, ty(refLine)); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.beginPath(); ctx.moveTo(tx(0), ty(valores[0]));
    valores.forEach((v,i) => ctx.lineTo(tx(i), ty(v)));
    ctx.lineTo(tx(valores.length-1), H-PB); ctx.lineTo(tx(0), H-PB); ctx.closePath();
    ctx.fillStyle = cor + "20"; ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx(0), ty(valores[0]));
    valores.forEach((v,i) => ctx.lineTo(tx(i), ty(v)));
    ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
    valores.forEach((v,i) => {
      ctx.beginPath(); ctx.arc(tx(i), ty(v), i === valores.length-1 ? 4 : 2.5, 0, Math.PI*2);
      ctx.fillStyle = i === valores.length-1 ? cor : cor+"88"; ctx.fill();
      if (i === valores.length-1 || valores.length <= 5) {
        const lbl = v%1!==0 ? v.toFixed(v<10?2:1) : String(v);
        ctx.fillStyle = cor; ctx.font = "bold 9px Inter"; ctx.textAlign = "center";
        ctx.fillText(lbl, tx(i), ty(v)-5);
      }
    });
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.font = "8px Inter"; ctx.textAlign = "center";
    datas.forEach((d,i) => {
      if (valores.length <= 5 || i === 0 || i === valores.length-1) ctx.fillText(d, tx(i), H-3);
    });
  }, [valores, datas, cor, refLine]);

  const ultimo = valores[valores.length-1];
  const cfg = CAMPOS_NUMERICOS.find(c => c.l === label);
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--nc-radius-lg)", overflow: "hidden" }}>
      <div style={{ padding: "8px 12px 4px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)" }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 900, fontFamily: "var(--mono)", color: cfg ? corValor(ultimo, cfg.normal, cfg.alerta) : cor }}>
          {ultimo} <span style={{ fontSize: 9, fontWeight: 400, color: "var(--text3)" }}>{unidade}</span>
        </span>
      </div>
      <canvas ref={canvasRef} style={{ width: "100%", height: 80, display: "block" }} />
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface AbaExamesProps {
  acompanhamentoId: string;
  paciente: Paciente;
  acompanhamento: AcompanhamentoNefro;
}

export function AbaExames({ acompanhamentoId, paciente, acompanhamento }: AbaExamesProps) {
  const supabase = useMemo(() => createClient(), []);
  const [registros, setRegistros] = useState<RegistroExame[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showExportar, setShowExportar] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [perfilAtivo, setPerfilAtivo] = useState<string>("geral");
  const [formNum, setFormNum] = useState<Record<string, string>>({});
  const [formTxt, setFormTxt] = useState<Record<string, string>>({});
  const [dataColeta, setDataColeta] = useState(() => new Date().toISOString().slice(0, 10));
  // Lista dinâmica de "outros" exames — {nome, resultado}
  const [outrosItens, setOutrosItens] = useState<{nome: string; resultado: string}[]>([]);
  const [outrosNome, setOutrosNome] = useState("");
  const [outrosResultado, setOutrosResultado] = useState("");

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

  // TFG em tempo real ao digitar creatinina
  const tfgAtual = useMemo(() => {
    const cr = parseFloat(formNum.creatinina?.replace(",", ".") ?? "");
    if (isNaN(cr) || cr <= 0 || idade <= 0) return null;
    return ckdEpi2021(cr, idade, sexo);
  }, [formNum.creatinina, idade, sexo]);
  const estAtual = estagioTFG(tfgAtual);

  // Para IRA e IRA_sobre_DRC não classificamos por estágio G1-G5 de DRC
  const isIRA = acompanhamento.diagnostico_principal === "IRA" ||
    acompanhamento.diagnostico_principal === "IRA_sobre_DRC";

  const carregarRegistros = useCallback(async () => {
    setCarregando(true);
    const { data } = await supabase.from("exames").select("*")
      .eq("acompanhamento_id", acompanhamentoId).order("data", { ascending: true });
    setRegistros((data || []) as RegistroExame[]);
    setCarregando(false);
  }, [acompanhamentoId, supabase]);

  useEffect(() => { carregarRegistros(); }, [carregarRegistros]);

  const perfil = PERFIS[perfilAtivo];

  function abrirNovo() {
    setFormNum({}); setFormTxt({});
    setOutrosItens([]); setOutrosNome(""); setOutrosResultado("");
    setDataColeta(new Date().toISOString().slice(0, 10));
    setEditingId(null); setErro(null); setShowModal(true);
  }

  function abrirEditar(r: RegistroExame) {
    const num: Record<string, string> = {};
    const txt: Record<string, string> = {};
    CAMPOS_NUMERICOS.forEach(c => {
      if (r.parametros[c.k] != null) num[c.k] = String(r.parametros[c.k]);
    });
    CAMPOS_TEXTO.forEach(c => {
      if (r.parametros[c.k] != null) txt[c.k] = String(r.parametros[c.k]);
    });
    // Carregar outros
    const outros = r.parametros["outros_lista"];
    if (outros && typeof outros === "string") {
      try { setOutrosItens(JSON.parse(outros)); } catch { setOutrosItens([]); }
    } else setOutrosItens([]);
    setOutrosNome(""); setOutrosResultado("");
    setFormNum(num); setFormTxt(txt);
    setDataColeta(r.data); setEditingId(r.id); setErro(null); setShowModal(true);
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este registro?")) return;
    await supabase.from("exames").delete().eq("id", id);
    setRegistros(p => p.filter(r => r.id !== id));
  }

  async function salvar() {
    const parametros: Record<string, number | string | null> = {};
    let temAlgum = false;
    CAMPOS_NUMERICOS.forEach(c => {
      const v = formNum[c.k];
      if (v?.trim()) {
        const n = parseFloat(v.replace(",", "."));
        if (!isNaN(n)) { parametros[c.k] = n; temAlgum = true; }
        else parametros[c.k] = null;
      } else parametros[c.k] = null;
    });
    CAMPOS_TEXTO.forEach(c => {
      const v = formTxt[c.k];
      if (v?.trim()) { parametros[c.k] = v.trim(); temAlgum = true; }
      else parametros[c.k] = null;
    });
    // Salva lista de outros como JSON
    if (outrosItens.length > 0) {
      parametros["outros_lista"] = JSON.stringify(outrosItens);
      temAlgum = true;
    } else parametros["outros_lista"] = null;
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

  // Séries temporais
  function serieNum(k: string): number[] {
    return registros.filter(r => r.parametros[k] != null && typeof r.parametros[k] === "number")
      .map(r => r.parametros[k] as number);
  }
  function datasNum(k: string): string[] {
    return registros.filter(r => r.parametros[k] != null && typeof r.parametros[k] === "number")
      .map(r => fmtDt(r.data));
  }
  function ultimoValor(k: string): number | null {
    for (let i = registros.length - 1; i >= 0; i--) {
      const v = registros[i].parametros[k];
      if (v != null && typeof v === "number") return v;
    }
    return null;
  }

  // TFG calculado para cada registro
  const tfgSerie = registros
    .filter(r => r.parametros.creatinina != null)
    .map(r => ckdEpi2021(r.parametros.creatinina as number, idade, sexo))
    .filter((v): v is number => v !== null);
  const tfgDatas = registros
    .filter(r => r.parametros.creatinina != null)
    .map(r => fmtDt(r.data));
  const ultimoTFG = tfgSerie[tfgSerie.length - 1] ?? null;
  const estUltimo = estagioTFG(ultimoTFG);

  return (
    <div className="space-y-4">

      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <p style={{ fontSize: 12, color: "var(--text3)" }}>
          {carregando ? "Carregando..." : registros.length === 0
            ? "Nenhum exame registrado ainda."
            : `${registros.length} registro(s) · último em ${fmtDt(registros[registros.length - 1]?.data)}`}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {registros.length > 0 && (
            <button onClick={() => setShowExportar(true)}
              className="nc-btn nc-btn-ghost cursor-pointer" style={{ padding: "6px 14px" }}>
              📊 Ver / Exportar
            </button>
          )}
          <button onClick={abrirNovo} className="nc-btn nc-btn-primary cursor-pointer" style={{ padding: "6px 14px" }}>
            + Novo registro
          </button>
        </div>
      </div>

      {/* TFG destaque + gráficos Cr/Ur/K em linha */}
      {(ultimoTFG !== null || serieNum("creatinina").length >= 1) && (
        <div>
          {/* TFG em destaque */}
          {ultimoTFG !== null && (
            <div style={{ borderRadius: "var(--nc-radius-lg)", padding: "12px 16px", marginBottom: 12, background: isIRA ? "var(--card2)" : estUltimo.bg, border: `1.5px solid ${isIRA ? "var(--border)" : estUltimo.cor + "40"}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: isIRA ? "var(--text3)" : estUltimo.cor, margin: "0 0 2px" }}>TFG-e · CKD-EPI 2021</p>
                <p style={{ fontSize: 36, fontWeight: 900, fontFamily: "var(--mono)", color: isIRA ? "var(--text)" : estUltimo.cor, lineHeight: 1, margin: 0 }}>
                  {ultimoTFG}
                  <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text3)", marginLeft: 6 }}>mL/min/1,73m²</span>
                </p>
                {/* Classificação DRC só para não-IRA */}
                {!isIRA && (
                  <p style={{ fontSize: 13, fontWeight: 700, color: estUltimo.cor, margin: "4px 0 0" }}>DRC {estUltimo.label}</p>
                )}
              </div>
              {tfgSerie.length >= 2 && (
                <div style={{ width: 120, opacity: 0.7 }}>
                  <MiniGrafico valores={tfgSerie} datas={tfgDatas} cor={isIRA ? "var(--accent)" : estUltimo.cor} label="TFG" unidade="" />
                </div>
              )}
            </div>
          )}

          {/* Gráficos Cr / Ur / K — 3 colunas desktop, 1 mobile */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}
            className="sm:grid-cols-3 grid-cols-1">
            {[
              { k: "creatinina", cor: "#dc2626", ref: 1.2 },
              { k: "ureia",      cor: "#d97706", ref: 50  },
              { k: "potassio",   cor: "#ea580c", ref: 5.0 },
            ].map(({ k, cor, ref }) => {
              const vals = serieNum(k); const dts = datasNum(k);
              const cfg = CAMPOS_NUMERICOS.find(c => c.k === k)!;
              const ult = ultimoValor(k);
              if (ult === null) return null;
              return (
                <div key={k}>
                  {vals.length >= 2
                    ? <MiniGrafico valores={vals} datas={dts} cor={cor} refLine={ref} label={cfg.l} unidade={cfg.u} />
                    : (
                      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--nc-radius-lg)", padding: "10px 12px" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", margin: "0 0 2px" }}>{cfg.l}</p>
                        <p style={{ fontSize: 22, fontWeight: 900, fontFamily: "var(--mono)", color: corValor(ult, cfg.normal, cfg.alerta), margin: 0 }}>
                          {ult} <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text3)" }}>{cfg.u}</span>
                        </p>
                      </div>
                    )
                  }
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabela histórico — datas na horizontal, exames na vertical */}
      {!carregando && registros.length > 0 && (() => {
        const regsOrdenados = [...registros].reverse(); // mais recente primeiro
        const camposTabela = [
          { k: "tfg_est", l: "TFG-e", isTFG: true },
          { k: "creatinina", l: "Creatinina" },
          { k: "ureia", l: "Ureia" },
          { k: "potassio", l: "Potássio" },
          { k: "sodio", l: "Sódio" },
          { k: "hemoglobina", l: "Hemoglobina" },
          { k: "ph", l: "pH" },
          { k: "bic", l: "Bicarbonato" },
        ];

        return (
          <div className="nc-card overflow-hidden">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", margin: 0 }}>
                Histórico comparativo
              </p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
                <thead>
                  <tr style={{ background: "#1e3a5f" }}>
                    <th style={{ padding: "7px 12px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", position: "sticky", left: 0, background: "#1e3a5f", zIndex: 1 }}>
                      Exame
                    </th>
                    {regsOrdenados.map(r => (
                      <th key={r.id} style={{ padding: "7px 12px", textAlign: "center", color: "white", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", minWidth: 80 }}>
                        {fmtDt(r.data)}
                      </th>
                    ))}
                    <th style={{ padding: "7px 8px", background: "#1e3a5f" }}>
                      {/* ações */}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {camposTabela.map(({ k, l, isTFG }) => (
                    <tr key={k} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 12px", fontWeight: 700, color: "var(--text2)", whiteSpace: "nowrap", fontSize: 11, position: "sticky", left: 0, background: "var(--card2)", zIndex: 1 }}>
                        {l}
                      </td>
                      {regsOrdenados.map(r => {
                        let v: number | null = null;
                        let cor = "var(--text3)";
                        if (isTFG) {
                          const cr = r.parametros.creatinina as number | null;
                          v = cr ? (ckdEpi2021(cr, idade, sexo) ?? null) : null;
                          if (v !== null) cor = isIRA ? "var(--text)" : estagioTFG(v).cor;
                        } else {
                          v = r.parametros[k] as number | null;
                          const cfg = CAMPOS_NUMERICOS.find(c => c.k === k);
                          if (v != null && cfg) cor = corValor(v, cfg.normal, cfg.alerta);
                        }
                        return (
                          <td key={r.id} style={{ padding: "6px 12px", textAlign: "center", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 12, color: v != null ? cor : "var(--text3)" }}>
                            {v ?? "—"}
                          </td>
                        );
                      })}
                      <td />
                    </tr>
                  ))}
                </tbody>
                {/* Linha de ações */}
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border)", background: "var(--card2)" }}>
                    <td style={{ padding: "5px 12px", fontSize: 10, color: "var(--text3)", fontWeight: 600, position: "sticky", left: 0, background: "var(--card2)", zIndex: 1 }}>
                      Ações
                    </td>
                    {regsOrdenados.map(r => (
                      <td key={r.id} style={{ padding: "5px 12px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                          <button onClick={() => abrirEditar(r)} title="Editar" style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 13 }}>✏</button>
                          <button onClick={() => excluir(r.id)} title="Excluir" style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 13 }}>🗑</button>
                        </div>
                      </td>
                    ))}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Modal novo/editar */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl"
            style={{ background: "var(--card)", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>

            {/* Header */}
            <div style={{ background: "#1e3a5f", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 800, color: "white" }}>
                  {editingId ? "Editar registro" : "Novo registro de exames"}
                </span>
                <span style={{ marginLeft: 10, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                  {paciente.nome} · {paciente.sexo ?? "sexo não cadastrado"} · {idade > 0 ? `${idade}a` : "nascimento não cadastrado"}
                </span>
              </div>
              <button onClick={() => setShowModal(false)}
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "var(--nc-radius)", padding: "5px 12px", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                ✕ Fechar
              </button>
            </div>

            {/* Corpo */}
            <div className="flex-1 overflow-y-auto" style={{ padding: "16px 20px", background: "var(--bg)" }}>

              {/* Data + TFG em tempo real */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="nc-label">Data da coleta</label>
                  <input type="date" value={dataColeta} onChange={e => setDataColeta(e.target.value)}
                    className="nc-input" style={{ width: 160 }} />
                </div>
                {tfgAtual !== null && (
                  <div style={{ borderRadius: "var(--nc-radius)", padding: "8px 14px", background: estAtual.bg, border: `1px solid ${estAtual.cor}40` }}>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: estAtual.cor, margin: "0 0 2px" }}>TFG-e CKD-EPI 2021</p>
                    <p style={{ fontSize: 22, fontWeight: 900, fontFamily: "var(--mono)", color: estAtual.cor, lineHeight: 1, margin: 0 }}>
                      {tfgAtual} <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text3)" }}>mL/min</span>
                    </p>
                    <p style={{ fontSize: 10, fontWeight: 700, color: estAtual.cor, margin: "2px 0 0" }}>DRC {estAtual.label}</p>
                  </div>
                )}
              </div>

              {/* Seletor de perfil */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {Object.entries(PERFIS).map(([k, p]) => (
                  <button key={k} onClick={() => setPerfilAtivo(k)}
                    style={{
                      padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: perfilAtivo === k ? "var(--accent)" : "var(--card2)",
                      color: perfilAtivo === k ? "white" : "var(--text2)",
                      border: `1px solid ${perfilAtivo === k ? "var(--accent)" : "var(--border)"}`,
                    }}>
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>

              {/* Campos numéricos */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px 14px", marginBottom: 16 }}>
                {perfil.numericos.map(k => {
                  const cfg = CAMPOS_NUMERICOS.find(c => c.k === k);
                  if (!cfg) return null;
                  const v = formNum[k];
                  const numV = v ? parseFloat(v.replace(",", ".")) : NaN;
                  const cor = v && !isNaN(numV) ? corValor(numV, cfg.normal, cfg.alerta) : "var(--text)";
                  return (
                    <div key={k}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", display: "block", marginBottom: 3 }}>
                        {cfg.l} {cfg.u && <span style={{ opacity: 0.6 }}>({cfg.u})</span>}
                      </label>
                      <input type="number" step="any" value={v ?? ""} onChange={e => setFormNum(p => ({ ...p, [k]: e.target.value }))}
                        placeholder="—" className="nc-input"
                        style={{ padding: "5px 8px", fontSize: 13, color: cor, fontWeight: v ? 700 : 400 }} />
                      {k === "creatinina" && tfgAtual !== null && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: estAtual.cor }}>TFG: {tfgAtual} ({estAtual.label})</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Campos texto */}
              {perfil.textos.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px 14px", marginBottom: 16 }}>
                  {perfil.textos.map(k => {
                    const cfg = CAMPOS_TEXTO.find(c => c.k === k);
                    if (!cfg) return null;
                    return (
                      <div key={k}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", display: "block", marginBottom: 3 }}>{cfg.l}</label>
                        <textarea value={formTxt[k] ?? ""} onChange={e => setFormTxt(p => ({ ...p, [k]: e.target.value }))}
                          rows={2} placeholder="Descreva o resultado..." className="nc-input" style={{ fontSize: 12, resize: "vertical" }} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Outros exames — lista dinâmica */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  ➕ Outros exames (adicione quantos quiser)
                </label>
                {/* Lista de outros adicionados */}
                {outrosItens.length > 0 && (
                  <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                    {outrosItens.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--accent-dim)", border: "1px solid var(--border2)", borderRadius: "var(--nc-radius)" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", minWidth: 120 }}>{item.nome}</span>
                        <span style={{ fontSize: 12, color: "var(--text2)", flex: 1 }}>{item.resultado}</span>
                        <button onClick={() => setOutrosItens(p => p.filter((_, i) => i !== idx))}
                          style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 14, flexShrink: 0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Formulário para adicionar */}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 160px" }}>
                    <label style={{ fontSize: 10, color: "var(--text3)", display: "block", marginBottom: 3 }}>Nome do exame</label>
                    <input value={outrosNome} onChange={e => setOutrosNome(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && outrosNome.trim()) { setOutrosItens(p => [...p, { nome: outrosNome.trim(), resultado: outrosResultado.trim() }]); setOutrosNome(""); setOutrosResultado(""); }}}
                      placeholder="Ex: Anti-HCV" className="nc-input" style={{ fontSize: 12 }} />
                  </div>
                  <div style={{ flex: "2 1 200px" }}>
                    <label style={{ fontSize: 10, color: "var(--text3)", display: "block", marginBottom: 3 }}>Resultado</label>
                    <input value={outrosResultado} onChange={e => setOutrosResultado(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && outrosNome.trim()) { setOutrosItens(p => [...p, { nome: outrosNome.trim(), resultado: outrosResultado.trim() }]); setOutrosNome(""); setOutrosResultado(""); }}}
                      placeholder="Ex: Reagente / Não reagente / valor" className="nc-input" style={{ fontSize: 12 }} />
                  </div>
                  <button
                    onClick={() => { if (outrosNome.trim()) { setOutrosItens(p => [...p, { nome: outrosNome.trim(), resultado: outrosResultado.trim() }]); setOutrosNome(""); setOutrosResultado(""); }}}
                    disabled={!outrosNome.trim()}
                    className="nc-btn nc-btn-primary cursor-pointer"
                    style={{ padding: "8px 14px", flexShrink: 0 }}
                  >
                    + Adicionar
                  </button>
                </div>
                <p style={{ fontSize: 10, color: "var(--text3)", marginTop: 4 }}>
                  Pressione Enter ou clique em "+ Adicionar" para incluir cada exame na lista.
                </p>
              </div>
            </div>

            {/* Footer */}
            {erro && <div style={{ padding: "8px 20px", background: "var(--red-dim)" }}>
              <p style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>⚠ {erro}</p>
            </div>}
            <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border)", background: "var(--card)", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
              <button onClick={() => setShowModal(false)} className="nc-btn nc-btn-ghost cursor-pointer">Cancelar</button>
              <button onClick={salvar} disabled={saving} className="nc-btn nc-btn-primary cursor-pointer" style={{ minWidth: 140 }}>
                {saving ? "Salvando..." : editingId ? "✓ Atualizar" : "Salvar exames"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de exportar / visualizar */}
      {showExportar && (
        <ExportarExames
          registros={registros}
          paciente={paciente}
          acompanhamento={acompanhamento}
          onClose={() => setShowExportar(false)}
        />
      )}
    </div>
  );
}