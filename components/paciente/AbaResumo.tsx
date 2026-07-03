"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  atualizarResumoAcompanhamento,
  darBaixaAcompanhamento,
} from "@/lib/actions/acompanhamentos";
import { NovoPacienteModal } from "@/components/paciente/NovoPacienteModal";
import type { AcompanhamentoNefro, Paciente, Internacao } from "@/types/database";

interface AbaResumoProps {
  acompanhamento: AcompanhamentoNefro;
  paciente: Paciente;
  internacao: Internacao;
}

// Mantido em ordem alfabética e sincronizado com o constraint
// acompanhamentos_nefro_etiologia_check no Supabase.
const ETIOLOGIAS_LRA = [
  "Cardiorrenal",
  "Glomerulonefrite",
  "Hipovolemia",
  "Lise_tumoral",
  "Mieloma_gamopatia_monoclonal",
  "Necrose_cortical",
  "Nefropatia_por_contraste",
  "NIA",
  "NTA",
  "Obstrucao",
  "Outras",
  "Rabdomiolise",
  "Sepse",
  "Sindrome_hepatorrenal",
];

// Sincronizado com o constraint acompanhamentos_nefro_diagnostico_principal_check
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
  if (hoje.getMonth() < nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) {
    idade--;
  }
  return `${idade} anos`;
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
      if (!resultado.sucesso) {
        setErro(resultado.erro || "Erro ao dar baixa.");
        return;
      }
      router.push("/dashboard");
    });
  }

  return (
    <div className="space-y-6">
      {/* Dados demográficos — botão de editar abre o modal de edição */}
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>Dados do paciente</h3>
          <button
            onClick={() => setModalEdicaoAberto(true)}
            className="cursor-pointer text-xs font-semibold transition hover:opacity-70"
            style={{ color: "var(--accent)" }}
          >
            ✏ Editar paciente / leito
          </button>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs" style={{ color: "var(--text3)" }}>Idade</dt>
            <dd style={{ color: "var(--text2)" }}>{calcularIdade(paciente.data_nascimento)}</dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: "var(--text3)" }}>Sexo</dt>
            <dd style={{ color: "var(--text2)" }}>{paciente.sexo || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: "var(--text3)" }}>RG hospitalar</dt>
            <dd style={{ color: "var(--text2)" }}>{paciente.rg_hospitalar}</dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: "var(--text3)" }}>Setor / leito</dt>
            <dd style={{ color: "var(--text2)" }}>
              {internacao.setor.replace(/_/g, " ")}
              {internacao.enfermaria_leito ? ` · ${internacao.enfermaria_leito}` : ""}
            </dd>
          </div>
        </dl>

        {paciente.comorbidades.length > 0 && (
          <div className="mt-3">
            <dt className="text-xs" style={{ color: "var(--text3)" }}>Comorbidades</dt>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {paciente.comorbidades.map((c) => (
                <span key={c} className="nc-badge nc-badge-blue">
                  {c.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {paciente.creatinina_basal && (
          <div className="mt-3 text-sm" style={{ color: "var(--text2)" }}>
            Creatinina basal: <strong style={{ color: "var(--text)" }}>{paciente.creatinina_basal} mg/dL</strong>
            {paciente.data_creatinina_basal && ` (${paciente.data_creatinina_basal})`}
            {paciente.fonte_creatinina_basal && ` — ${paciente.fonte_creatinina_basal.replace(/_/g, " ")}`}
          </div>
        )}
      </section>

      {/* Diagnóstico nefrológico — editável */}
      <section className="nc-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>Diagnóstico e conduta nefrológica</h3>
          {!editando && (
            <button
              onClick={() => setEditando(true)}
              className="text-xs font-semibold transition hover:opacity-70"
              style={{ color: "var(--text3)" }}
            >
              Editar
            </button>
          )}
        </div>

        {editando ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="nc-label">Diagnóstico principal</label>
                <select
                  value={diagnosticoPrincipal}
                  onChange={(e) => setDiagnosticoPrincipal(e.target.value)}
                  className="nc-input"
                >
                  <option value="">—</option>
                  {DIAGNOSTICOS_PRINCIPAIS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="nc-label">Etiologia</label>
                <select
                  value={etiologia}
                  onChange={(e) => setEtiologia(e.target.value)}
                  className="nc-input"
                >
                  <option value="">—</option>
                  {ETIOLOGIAS_LRA.map((e) => (
                    <option key={e} value={e}>{e.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="nc-label">Data início da LRA</label>
                <input
                  type="date" value={dataInicioLra} onChange={(e) => setDataInicioLra(e.target.value)}
                  className="nc-input"
                />
              </div>
              <div>
                <label className="nc-label">Prioridade</label>
                <select
                  value={prioridade} onChange={(e) => setPrioridade(e.target.value)}
                  className="nc-input"
                >
                  <option value="">—</option>
                  <option value="Alta">Alta</option>
                  <option value="Baixa">Baixa</option>
                  <option value="Media">Média</option>
                </select>
              </div>
            </div>

            <div>
              <label className="nc-label">Motivo da interconsulta</label>
              <textarea
                value={motivoInterconsulta} onChange={(e) => setMotivoInterconsulta(e.target.value)}
                rows={2}
                className="nc-input"
              />
            </div>

            <div>
              <label className="nc-label">Tags (separadas por vírgula)</label>
              <input
                type="text" value={tagsTexto} onChange={(e) => setTagsTexto(e.target.value)}
                placeholder="Ex: Sepse, Cateter femoral, UTI"
                className="nc-input"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setEditando(false)} className="nc-btn nc-btn-ghost">
                Cancelar
              </button>
              <button
                onClick={handleSalvar} disabled={isPending}
                className="nc-btn nc-btn-primary"
              >
                {isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        ) : (
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs" style={{ color: "var(--text3)" }}>Diagnóstico principal</dt>
              <dd style={{ color: "var(--text2)" }}>{acompanhamento.diagnostico_principal?.replace(/_/g, " ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs" style={{ color: "var(--text3)" }}>Etiologia</dt>
              <dd style={{ color: "var(--text2)" }}>{acompanhamento.etiologia?.replace(/_/g, " ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs" style={{ color: "var(--text3)" }}>Motivo da interconsulta</dt>
              <dd style={{ color: "var(--text2)" }}>{acompanhamento.motivo_interconsulta || "—"}</dd>
            </div>
            {acompanhamento.tags.length > 0 && (
              <div>
                <dt className="text-xs" style={{ color: "var(--text3)" }}>Tags</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {acompanhamento.tags.map((t) => (
                    <span key={t} className="nc-badge nc-badge-blue">
                      {t}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        )}
      </section>

      {/* Dar baixa do acompanhamento */}
      <section
        className="rounded-(--nc-radius-lg) border p-4"
        style={{ borderColor: "rgba(176,48,32,0.25)", background: "var(--red-dim)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>Encerrar acompanhamento</h3>
          {!mostrarBaixa && (
            <button
              onClick={() => setMostrarBaixa(true)}
              className="text-xs font-semibold transition hover:opacity-70"
              style={{ color: "var(--red)" }}
            >
              Dar baixa
            </button>
          )}
        </div>

        {mostrarBaixa && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="nc-label">Motivo da alta</label>
                <select
                  value={motivoAlta} onChange={(e) => setMotivoAlta(e.target.value)}
                  className="nc-input"
                >
                  <option value="">Selecione...</option>
                  {MOTIVOS_ALTA.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="nc-label">Desfecho renal</label>
                <select
                  value={desfechoRenal} onChange={(e) => setDesfechoRenal(e.target.value)}
                  className="nc-input"
                >
                  <option value="">Selecione...</option>
                  {DESFECHOS_RENAIS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {erro && <p className="text-sm" style={{ color: "var(--red)" }}>{erro}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setMostrarBaixa(false)} className="nc-btn nc-btn-ghost">
                Cancelar
              </button>
              <button
                onClick={handleDarBaixa} disabled={isPending}
                className="nc-btn"
                style={{ background: "var(--red)", color: "white" }}
              >
                {isPending ? "Confirmando..." : "Confirmar baixa"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Modal de edição de paciente — reutiliza NovoPacienteModal em modo "edicao" */}
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