"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  atualizarResumoAcompanhamento,
  darBaixaAcompanhamento,
} from "@/lib/actions/acompanhamentos";
import { atualizarLeito } from "@/lib/actions/pacientesExtra";
import { NovoPacienteModal } from "@/components/paciente/NovoPacienteModal";
import { CATALOGO_LEITOS, SETORES } from "@/types/database";
import type { AcompanhamentoNefro, Paciente, Internacao } from "@/types/database";

interface AbaResumoProps {
  acompanhamento: AcompanhamentoNefro;
  paciente: Paciente;
  internacao: Internacao;
}

const ETIOLOGIAS_LRA = [
  "Cardiorrenal", "Glomerulonefrite", "Hipovolemia", "Lise_tumoral",
  "Mieloma_gamopatia_monoclonal", "Necrose_cortical", "Nefropatia_por_contraste",
  "NIA", "NTA", "Obstrucao", "Outras", "Rabdomiolise", "Sepse", "Sindrome_hepatorrenal",
];

const DIAGNOSTICOS_PRINCIPAIS = [
  { value: "Avaliacao_plasmaferese", label: "Avaliação para plasmaférese" },
  { value: "DHE", label: "Distúrbios Hidroeletrolíticos (DHE)" },
  { value: "DRC_D", label: "DRC dialítica" },
  { value: "IRA_sobre_DRC", label: "DRC com IRA sobreposta" },
  { value: "Glomerulopatias", label: "Glomerulopatias" },
  { value: "IRA", label: "IRA" },
];

const MOTIVOS_ALTA = [
  { value: "Alta_hospitalar", label: "Alta hospitalar" },
  { value: "Alta_da_nefrologia", label: "Alta da nefrologia" },
  { value: "Transferencia", label: "Transferência" },
  { value: "Obito", label: "Óbito" },
];

const DESFECHOS_RENAIS = [
  { value: "Recuperacao_completa", label: "Recuperação completa" },
  { value: "Recuperacao_parcial", label: "Recuperação parcial" },
  { value: "Dependente_de_dialise", label: "Dependente de diálise" },
  { value: "Evolucao_para_DRC", label: "Evolução para DRC" },
  { value: "Obito", label: "Óbito" },
];

function calcularIdade(dataNascimento: string | null): string {
  if (!dataNascimento) return "—";
  const nasc = new Date(dataNascimento);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  if (hoje.getMonth() < nasc.getMonth() ||
    (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) idade--;
  return `${idade} anos`;
}

// Cabeçalho de seção — igual ao estilo das barras do dashboard
function SecaoHeader({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between rounded-md px-3 py-2 mb-3"
      style={{ background: "#1e3a5f" }}
    >
      <span className="text-sm font-extrabold uppercase tracking-widest"
        style={{ color: "white", letterSpacing: "0.07em" }}>
        {label}
      </span>
      {action}
    </div>
  );
}

export function AbaResumo({ acompanhamento, paciente, internacao }: AbaResumoProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [editando, setEditando] = useState(false);
  const [diagnosticoPrincipal, setDiagnosticoPrincipal] = useState(acompanhamento.diagnostico_principal || "");
  const [etiologia, setEtiologia] = useState(acompanhamento.etiologia || "");
  const [motivoInterconsulta, setMotivoInterconsulta] = useState(acompanhamento.motivo_interconsulta || "");
  const [dataInicioLra, setDataInicioLra] = useState(acompanhamento.data_inicio_lra || "");
  const [tagsTexto, setTagsTexto] = useState((acompanhamento.tags || []).join(", "));
  const [prioridade, setPrioridade] = useState(acompanhamento.prioridade || "");

  // Edição inline do leito
  const [editandoLeito, setEditandoLeito] = useState(false);
  const [novoLeito, setNovoLeito] = useState(internacao.enfermaria_leito || "");
  const [salvandoLeito, setSalvandoLeito] = useState(false);

  async function handleSalvarLeito() {
    if (!novoLeito) return;
    const leitoCfg = CATALOGO_LEITOS.find(l => l.numero === novoLeito);
    const setorNovo = leitoCfg?.setor ?? internacao.setor;
    setSalvandoLeito(true);
    await atualizarLeito(internacao.id, novoLeito, setorNovo);
    setSalvandoLeito(false);
    setEditandoLeito(false);
  }

  const [mostrarBaixa, setMostrarBaixa] = useState(false);
  const [motivoAlta, setMotivoAlta] = useState("");
  const [desfechoRenal, setDesfechoRenal] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);

  function handleSalvar() {
    startTransition(async () => {
      await atualizarResumoAcompanhamento(acompanhamento.id, {
        diagnosticoPrincipal: diagnosticoPrincipal || undefined,
        etiologia: etiologia || undefined,
        motivoInterconsulta: motivoInterconsulta || undefined,
        dataInicioLra: dataInicioLra || undefined,
        tags: tagsTexto.split(",").map((t) => t.trim()).filter(Boolean),
        prioridade: prioridade || undefined,
      });
      setEditando(false);
    });
  }

  function handleDarBaixa() {
    if (!motivoAlta || !desfechoRenal) {
      setErro("Selecione o motivo da alta e o desfecho renal.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const resultado = await darBaixaAcompanhamento(acompanhamento.id, motivoAlta, desfechoRenal);
      if (!resultado.sucesso) { setErro(resultado.erro || "Erro ao dar baixa."); return; }
      router.push("/dashboard");
    });
  }

  return (
    <div className="space-y-5">

      {/* ── Dados do paciente ─────────────────────────────────────────── */}
      <section>
        <SecaoHeader
          label="Dados do paciente"
          action={
            <button
              onClick={() => setModalEdicaoAberto(true)}
              className="cursor-pointer rounded-full px-3 py-1 text-xs font-bold transition hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.25)" }}
            >
              ✏ Editar
            </button>
          }
        />
        <div className="nc-card p-4">
          {/* Linha principal: nome + leito em destaque */}
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-extrabold" style={{ color: "var(--text)" }}>{paciente.nome}</p>
              <p className="text-sm" style={{ color: "var(--text3)" }}>
                {calcularIdade(paciente.data_nascimento)}
                {paciente.sexo ? ` · ${paciente.sexo === "F" ? "Feminino" : "Masculino"}` : ""}
                {" · RG "}{paciente.rg_hospitalar}
              </p>
            </div>
            {/* Leito em destaque — clicável para edição inline */}
            {editandoLeito ? (
              <div className="shrink-0 rounded-(--nc-radius-lg) p-2 text-center"
                style={{ background: "var(--accent-dim)", border: "1px solid var(--accent)", minWidth: 110 }}>
                <p className="text-[10px] font-bold uppercase mb-1" style={{ color: "var(--text3)" }}>Leito</p>
                <select
                  value={novoLeito}
                  onChange={e => setNovoLeito(e.target.value)}
                  autoFocus
                  className="nc-input cursor-pointer"
                  style={{ padding: "3px 6px", fontSize: 13, fontWeight: 700, marginBottom: 4 }}
                >
                  {SETORES.map(s => {
                    const leitosDoSetor = CATALOGO_LEITOS.filter(l => l.setor === s.value);
                    if (!leitosDoSetor.length) return null;
                    return (
                      <optgroup key={s.value} label={s.label}>
                        {leitosDoSetor.map(l => (
                          <option key={l.numero} value={l.numero}>{l.numero}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                  <button onClick={handleSalvarLeito} disabled={salvandoLeito}
                    style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--nc-radius)", padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {salvandoLeito ? "..." : "✓"}
                  </button>
                  <button onClick={() => { setEditandoLeito(false); setNovoLeito(internacao.enfermaria_leito || ""); }}
                    style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--nc-radius)", padding: "3px 8px", fontSize: 11, cursor: "pointer", color: "var(--text3)" }}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditandoLeito(true)}
                className="shrink-0 rounded-(--nc-radius-lg) px-4 py-2 text-center transition hover:opacity-80 cursor-pointer"
                style={{ background: "var(--accent-dim)", border: "1px solid var(--border2)", minWidth: 90 }}
                title="Clique para editar o leito"
              >
                <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text3)" }}>Leito ✏</p>
                <p className="text-lg font-black" style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>
                  {internacao.enfermaria_leito || "—"}
                </p>
                <p className="text-[10px]" style={{ color: "var(--text3)" }}>
                  {internacao.setor.replace(/_/g, " ")}
                </p>
              </button>
            )}
          </div>

          {/* Comorbidades */}
          {paciente.comorbidades.length > 0 && (
            <div className="mb-3">
              <p className="text-xs mb-1.5" style={{ color: "var(--text3)" }}>Comorbidades</p>
              <div className="flex flex-wrap gap-1.5">
                {paciente.comorbidades.map((c) => (
                  <span key={c} className="nc-badge nc-badge-blue">{c.replace(/_/g, " ")}</span>
                ))}
              </div>
            </div>
          )}

          {/* Creatinina basal */}
          {paciente.creatinina_basal && (
            <div className="rounded-(--nc-radius) px-3 py-2"
              style={{ background: "var(--accent-dim)", border: "1px solid var(--border2)" }}>
              <span className="text-xs" style={{ color: "var(--text3)" }}>Creatinina basal: </span>
              <span className="text-sm font-bold" style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>
                {paciente.creatinina_basal} mg/dL
              </span>
              {paciente.data_creatinina_basal && (
                <span className="text-xs" style={{ color: "var(--text3)" }}> · {paciente.data_creatinina_basal}</span>
              )}
              {paciente.fonte_creatinina_basal && (
                <span className="text-xs" style={{ color: "var(--text3)" }}> · {paciente.fonte_creatinina_basal.replace(/_/g, " ")}</span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Diagnóstico e conduta nefrológica ────────────────────────── */}
      <section>
        <SecaoHeader
          label="Diagnóstico e conduta nefrológica"
          action={
            !editando ? (
              <button
                onClick={() => setEditando(true)}
                className="cursor-pointer rounded-full px-3 py-1 text-xs font-bold transition hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.25)" }}
              >
                ✏ Editar
              </button>
            ) : undefined
          }
        />
        <div className="nc-card p-4">
          {editando ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="nc-label">Diagnóstico principal</label>
                  <select value={diagnosticoPrincipal} onChange={(e) => setDiagnosticoPrincipal(e.target.value)} className="nc-input cursor-pointer">
                    <option value="">—</option>
                    {DIAGNOSTICOS_PRINCIPAIS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="nc-label">Etiologia</label>
                  <select value={etiologia} onChange={(e) => setEtiologia(e.target.value)} className="nc-input cursor-pointer">
                    <option value="">—</option>
                    {ETIOLOGIAS_LRA.map((e) => <option key={e} value={e}>{e.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="nc-label">Data início da LRA</label>
                  <input type="date" value={dataInicioLra} onChange={(e) => setDataInicioLra(e.target.value)} className="nc-input" />
                </div>
                <div>
                  <label className="nc-label">Prioridade</label>
                  <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className="nc-input cursor-pointer">
                    <option value="">—</option>
                    <option value="Alta">Alta</option>
                    <option value="Media">Média</option>
                    <option value="Baixa">Baixa</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="nc-label">Motivo da interconsulta</label>
                <textarea value={motivoInterconsulta} onChange={(e) => setMotivoInterconsulta(e.target.value)} rows={2} className="nc-input" />
              </div>
              <div>
                <label className="nc-label">Tags (separadas por vírgula)</label>
                <input type="text" value={tagsTexto} onChange={(e) => setTagsTexto(e.target.value)}
                  placeholder="Ex: Sepse, Cateter femoral" className="nc-input" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditando(false)} className="nc-btn nc-btn-ghost cursor-pointer">Cancelar</button>
                <button onClick={handleSalvar} disabled={isPending} className="nc-btn nc-btn-primary cursor-pointer">
                  {isPending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          ) : (
            <dl className="space-y-3 text-sm">
              <InfoRow label="Diagnóstico principal" value={acompanhamento.diagnostico_principal?.replace(/_/g, " ")} />
              <InfoRow label="Etiologia" value={acompanhamento.etiologia?.replace(/_/g, " ")} />
              <InfoRow label="Motivo da interconsulta" value={acompanhamento.motivo_interconsulta} />
              {acompanhamento.tags.length > 0 && (
                <div>
                  <dt className="text-xs mb-1" style={{ color: "var(--text3)" }}>Tags</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {acompanhamento.tags.map((t) => <span key={t} className="nc-badge nc-badge-blue">{t}</span>)}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </section>

      {/* ── Encerrar acompanhamento ───────────────────────────────────── */}
      <section>
        <SecaoHeader label="Encerrar acompanhamento" />
        <div className="nc-card overflow-hidden">
          {/* Botão principal de dar baixa — clicável, com hover explícito */}
          {!mostrarBaixa ? (
            <button
              onClick={() => setMostrarBaixa(true)}
              className="flex w-full cursor-pointer items-center justify-between px-4 py-3.5 transition"
              style={{ background: "var(--red-dim)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#fbd5d0")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--red-dim)")}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: "var(--red)", color: "white", fontSize: 16 }}>
                  ↓
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold" style={{ color: "var(--red)" }}>Dar baixa no acompanhamento</p>
                  <p className="text-xs" style={{ color: "var(--text3)" }}>
                    Registra motivo de alta e desfecho renal. Não pode ser desfeito.
                  </p>
                </div>
              </div>
              <span style={{ color: "var(--red)", fontSize: 18, opacity: 0.5 }}>›</span>
            </button>
          ) : (
            <div className="p-4 space-y-3" style={{ background: "var(--red-dim)" }}>
              <p className="text-sm font-bold" style={{ color: "var(--red)" }}>Confirmar encerramento</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="nc-label">Motivo da alta</label>
                  <select value={motivoAlta} onChange={(e) => setMotivoAlta(e.target.value)} className="nc-input cursor-pointer">
                    <option value="">Selecione...</option>
                    {MOTIVOS_ALTA.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="nc-label">Desfecho renal</label>
                  <select value={desfechoRenal} onChange={(e) => setDesfechoRenal(e.target.value)} className="nc-input cursor-pointer">
                    <option value="">Selecione...</option>
                    {DESFECHOS_RENAIS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              </div>
              {erro && <p className="text-sm" style={{ color: "var(--red)" }}>{erro}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => { setMostrarBaixa(false); setErro(null); }} className="nc-btn nc-btn-ghost cursor-pointer">
                  Cancelar
                </button>
                <button onClick={handleDarBaixa} disabled={isPending}
                  className="nc-btn cursor-pointer" style={{ background: "var(--red)", color: "white" }}>
                  {isPending ? "Confirmando..." : "Confirmar baixa"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Modal de edição */}
      {modalEdicaoAberto && (
        <NovoPacienteModal
          modo="edicao"
          paciente={paciente}
          internacao={internacao}
          acompanhamentoId={acompanhamento.id}
          onClose={() => setModalEdicaoAberto(false)}
          onSaved={() => setModalEdicaoAberto(false)}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs" style={{ color: "var(--text3)" }}>{label}</dt>
      <dd className="mt-0.5" style={{ color: "var(--text2)" }}>{value || "—"}</dd>
    </div>
  );
}