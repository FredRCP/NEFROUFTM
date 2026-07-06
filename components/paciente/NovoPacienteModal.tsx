"use client";

import { useState, useTransition } from "react";
import {
  verificarRgHospitalar,
  cadastrarPaciente,
  type VerificarRgResult,
} from "@/lib/actions/pacientes";
import { editarPaciente } from "@/lib/actions/pacientesExtra";
import { CATALOGO_LEITOS, getSetorByLeito, SETORES } from "@/types/database";
import type { Paciente, Internacao } from "@/types/database";

const COMORBIDADES_OPCOES = [
  "AVC", "Cirrose", "DAC", "Doenca_autoimune", "Doenca_renal_policistica",
  "DM", "DPOC", "Fibrilacao_atrial", "HAS", "Hepatopatia", "HIV",
  "ICC", "ICO", "Neoplasia", "Obesidade", "Transplante_hepatico", "Transplante_renal",
];

const ETIOLOGIAS_DRC = [
  "DRPAD", "Glomerulopatia", "Indeterminada", "Nefrite_tubulo_intersticial",
  "Nefroesclerose_hipertensiva", "Nefropatia_diabetica", "Obstrutiva", "Outras",
];

const DIAGNOSTICOS_PRINCIPAIS = [
  { value: "Avaliacao_plasmaferese", label: "Avaliação para plasmaférese" },
  { value: "DHE", label: "Distúrbios Hidroeletrolíticos (DHE)" },
  { value: "DRC_D", label: "DRC dialítica" },
  { value: "IRA_sobre_DRC", label: "DRC com IRA sobreposta" },
  { value: "Glomerulopatias", label: "Glomerulopatias" },
  { value: "IRA", label: "IRA" },
];

const ETIOLOGIAS_LRA = [
  "Cardiorrenal", "Glomerulonefrite", "Hipovolemia", "Lise_tumoral",
  "Mieloma_gamopatia_monoclonal", "Necrose_cortical", "Nefropatia_por_contraste",
  "NIA", "NTA", "Obstrucao", "Outras", "Rabdomiolise", "Sepse", "Sindrome_hepatorrenal",
];

// ─── Props ─────────────────────────────────────────────────────────────────

interface NovoPacienteModalBaseProps {
  onClose: () => void;
  onSaved: () => void;
}

interface NovoPacienteModalCadastroProps extends NovoPacienteModalBaseProps {
  modo?: "cadastro";
  paciente?: undefined;
  internacao?: undefined;
  acompanhamentoId?: undefined;
}

interface NovoPacienteModalEdicaoProps extends NovoPacienteModalBaseProps {
  modo: "edicao";
  paciente: Paciente;
  internacao: Internacao;
  acompanhamentoId: string;
}

type NovoPacienteModalProps = NovoPacienteModalCadastroProps | NovoPacienteModalEdicaoProps;

// ─── Componente ────────────────────────────────────────────────────────────

export function NovoPacienteModal({
  onClose, onSaved, modo = "cadastro",
  paciente, internacao, acompanhamentoId,
}: NovoPacienteModalProps) {
  const [isPending, startTransition] = useTransition();
  const ehEdicao = modo === "edicao";

  // Etapa 1: RG (apenas no modo cadastro)
  const [rg, setRg] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [resultadoVerificacao, setResultadoVerificacao] = useState<VerificarRgResult | null>(null);
  const [rgConfirmado, setRgConfirmado] = useState(ehEdicao);
  const [modoReativacao, setModoReativacao] = useState(false);

  // Dados do paciente — pré-preenchidos em modo edição
  const [nome, setNome] = useState(paciente?.nome ?? "");
  const [dataNascimento, setDataNascimento] = useState(paciente?.data_nascimento ?? "");
  const [sexo, setSexo] = useState<"M" | "F" | "">(paciente?.sexo ?? "");
  const [comorbidades, setComorbidades] = useState<string[]>(paciente?.comorbidades ?? []);
  const [etiologiaDrc, setEtiologiaDrc] = useState(paciente?.etiologia_drc ?? "");
  const [creatininaBasal, setCreatininaBasal] = useState(paciente?.creatinina_basal?.toString() ?? "");
  const [dataCreatininaBasal, setDataCreatininaBasal] = useState(paciente?.data_creatinina_basal ?? "");
  const [fonteCreatininaBasal, setFonteCreatininaBasal] = useState(paciente?.fonte_creatinina_basal ?? "");
  const [observacoes, setObservacoes] = useState(paciente?.observacoes_gerais ?? "");

  // Internação — pré-preenchida em modo edição
  const [dataAdmissao, setDataAdmissao] = useState(
    internacao?.data_admissao ?? new Date().toISOString().slice(0, 10)
  );
  const [leito, setLeito] = useState(internacao?.enfermaria_leito ?? "");

  // Campos só de cadastro (interconsulta)
  const [motivoInterconsulta, setMotivoInterconsulta] = useState("");
  const [diagnosticoPrincipal, setDiagnosticoPrincipal] = useState("");
  const [etiologia, setEtiologia] = useState("");
  const [dataInicioLra, setDataInicioLra] = useState("");

  const [erro, setErro] = useState<string | null>(null);
  const [tentouEnviar, setTentouEnviar] = useState(false);

  // ── Handlers de cadastro (modo = "cadastro") ────────────────────────────

  async function handleVerificarRg() {
    if (!rg.trim()) return;
    setVerificando(true);
    setErro(null);
    const resultado = await verificarRgHospitalar(rg);
    setResultadoVerificacao(resultado);
    setVerificando(false);
    if (!resultado.existe) setRgConfirmado(true);
  }

  function handleReativarFicha() {
    if (!resultadoVerificacao?.paciente) return;
    const p = resultadoVerificacao.paciente;
    setNome(p.nome);
    setDataNascimento(p.data_nascimento || "");
    setSexo((p.sexo as "M" | "F") || "");
    setComorbidades(p.comorbidades || []);
    setEtiologiaDrc(p.etiologia_drc || "");
    setCreatininaBasal(p.creatinina_basal?.toString() || "");
    setDataCreatininaBasal(p.data_creatinina_basal || "");
    setFonteCreatininaBasal(p.fonte_creatinina_basal || "");
    setObservacoes(p.observacoes_gerais || "");
    setModoReativacao(true);
    setRgConfirmado(true);
  }

  function toggleComorbidade(c: string) {
    setComorbidades((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  // ── Validação de campos obrigatórios ────────────────────────────────────

  const camposObrigatoriosFaltando = {
    nome: !nome.trim(),
    dataNascimento: !dataNascimento,
    sexo: !sexo,
    diagnosticoPrincipal: !ehEdicao && !diagnosticoPrincipal,
    leito: !leito,
  };
  const temCampoFaltando = Object.values(camposObrigatoriosFaltando).some(Boolean);

  function classeObrigatorio(faltando: boolean) {
    return tentouEnviar && faltando ? "ring-2 ring-offset-0" : "";
  }
  function estiloObrigatorio(faltando: boolean): React.CSSProperties {
    return tentouEnviar && faltando
      ? { borderColor: "var(--red)", boxShadow: "0 0 0 1px var(--red)" }
      : {};
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setTentouEnviar(true);

    if (temCampoFaltando) {
      setErro("Preencha todos os campos obrigatórios destacados em vermelho.");
      return;
    }

    const setorInferido = getSetorByLeito(leito);
    if (!setorInferido) {
      setErro("Leito inválido — não foi possível identificar o setor.");
      return;
    }

    if (ehEdicao) {
      // Modo edição: update de paciente + internação
      startTransition(async () => {
        const resultado = await editarPaciente({
          pacienteId: paciente!.id,
          internacaoId: internacao!.id,
          acompanhamentoId: acompanhamentoId!,
          nome,
          dataNascimento: dataNascimento || undefined,
          sexo: sexo || undefined,
          comorbidades,
          etiologiaDrc: etiologiaDrc || undefined,
          creatininaBasal: creatininaBasal ? parseFloat(creatininaBasal) : undefined,
          dataCreatininaBasal: dataCreatininaBasal || undefined,
          fonteCreatininaBasal: fonteCreatininaBasal || undefined,
          observacoesGerais: observacoes || undefined,
          enfermariaLeito: leito,
          setor: setorInferido,
        });

        if (!resultado.sucesso) {
          setErro(resultado.erro || "Erro ao salvar alterações.");
          return;
        }
        onSaved();
      });
    } else {
      // Modo cadastro: insert completo
      startTransition(async () => {
        const resultado = await cadastrarPaciente({
          pacienteIdExistente: modoReativacao ? resultadoVerificacao?.paciente?.id : undefined,
          nome,
          rgHospitalar: rg,
          dataNascimento: dataNascimento || undefined,
          sexo: sexo || undefined,
          comorbidades,
          etiologiaDrc: etiologiaDrc || undefined,
          creatininaBasal: creatininaBasal ? parseFloat(creatininaBasal) : undefined,
          dataCreatininaBasal: dataCreatininaBasal || undefined,
          fonteCreatininaBasal: fonteCreatininaBasal || undefined,
          observacoesGerais: observacoes || undefined,
          dataAdmissao,
          setor: setorInferido,
          enfermariaLeito: leito,
          motivoInterconsulta: motivoInterconsulta || undefined,
          diagnosticoPrincipal: diagnosticoPrincipal || undefined,
          etiologia: etiologia || undefined,
          dataInicioLra: dataInicioLra || undefined,
        });

        if (!resultado.sucesso) {
          setErro(resultado.erro || "Erro ao cadastrar paciente.");
          return;
        }
        onSaved();
      });
    }
  }

  const inputClass = "nc-input";
  const labelClass = "nc-label";

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-2 sm:p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl sm:max-h-[90vh]"
        style={{ background: "var(--card)", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between px-5 py-3.5"
          style={{ background: "#1e3a5f", borderBottom: "1px solid var(--border)" }}
        >
          <span className="text-sm font-extrabold text-white">
            {ehEdicao ? `Editar paciente — ${paciente!.nome}` : "Novo paciente"}
          </span>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            ✕ Fechar
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5" style={{ background: "var(--bg)" }}>

          {/* ETAPA 1: RG hospitalar — só no modo cadastro */}
          {!ehEdicao && (
            <div className="nc-card p-4">
              <label className={labelClass}>RG hospitalar</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={rg}
                  disabled={rgConfirmado}
                  onChange={(e) => {
                    // Aceita apenas dígitos
                    const apenasDigitos = e.target.value.replace(/\D/g, "");
                    setRg(apenasDigitos);
                    setResultadoVerificacao(null);
                    setRgConfirmado(false);
                    setModoReativacao(false);
                  }}
                  className={`${inputClass} flex-1 disabled:opacity-60`}
                  placeholder="Apenas números (ex: 123456)"
                />
                {!rgConfirmado && (
                  <button
                    type="button"
                    onClick={handleVerificarRg}
                    disabled={verificando || !rg.trim()}
                    className="nc-btn nc-btn-primary cursor-pointer"
                  >
                    {verificando ? "Verificando..." : "Verificar"}
                  </button>
                )}
              </div>

              {resultadoVerificacao?.existe && !modoReativacao && (
                <div
                  className="mt-3 rounded-(--nc-radius) p-3"
                  style={{ background: "var(--amber-dim)", border: "1px solid rgba(154,74,10,0.2)" }}
                >
                  <p className="text-sm" style={{ color: "var(--amber)" }}>
                    Paciente <strong>{resultadoVerificacao.paciente?.nome}</strong> já
                    está cadastrado, com {resultadoVerificacao.acompanhamentosAnteriores}{" "}
                    acompanhamento(s) anterior(es).
                  </p>
                  <button
                    type="button"
                    onClick={handleReativarFicha}
                    className="nc-btn mt-2 cursor-pointer"
                    style={{ background: "var(--amber)", color: "white" }}
                  >
                    Reativar ficha de {resultadoVerificacao.paciente?.nome}
                  </button>
                </div>
              )}

              {modoReativacao && (
                <p className="mt-3 text-sm font-semibold" style={{ color: "var(--green)" }}>
                  ✓ Reativando ficha existente — dados anteriores carregados abaixo.
                </p>
              )}
              {rgConfirmado && !modoReativacao && (
                <p className="mt-3 text-sm font-semibold" style={{ color: "var(--green)" }}>
                  ✓ RG novo — siga com o cadastro abaixo.
                </p>
              )}
            </div>
          )}

          {/* ETAPAS 2 e 3 */}
          {rgConfirmado && (
            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              <Section label="Dados do paciente">
                {/* Leito em destaque — dado mais editado, fica no topo */}
                <div
                  className="mb-4 rounded-(--nc-radius-lg) p-3"
                  style={{ background: "var(--accent-dim)", border: "1px solid var(--border2)" }}
                >
                  <label className="nc-label" style={{ color: "var(--accent)", marginBottom: 4 }}>
                    🛏️ Leito <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <select
                    required value={leito} onChange={(e) => setLeito(e.target.value)}
                    className={`${inputClass} cursor-pointer ${classeObrigatorio(camposObrigatoriosFaltando.leito)}`}
                    style={{
                      ...estiloObrigatorio(camposObrigatoriosFaltando.leito),
                      fontWeight: leito ? 700 : 400,
                      fontSize: 15,
                    }}
                  >
                    <option value="">Selecione o leito...</option>
                    {SETORES.map((s) => {
                      const leitosDoSetor = CATALOGO_LEITOS.filter((l) => l.setor === s.value);
                      if (leitosDoSetor.length === 0) return null;
                      return (
                        <optgroup key={s.value} label={s.label}>
                          {leitosDoSetor.map((l) => (
                            <option key={l.numero} value={l.numero}>{l.numero}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  {leito && (
                    <p className="mt-1 text-xs" style={{ color: "var(--accent)" }}>
                      Setor identificado automaticamente a partir do leito.
                    </p>
                  )}
                </div>

                <Row>
                  <Group label="Nome" required flex={2}>
                    <input
                      type="text" required value={nome} onChange={(e) => setNome(e.target.value)}
                      className={`${inputClass} ${classeObrigatorio(camposObrigatoriosFaltando.nome)}`}
                      style={estiloObrigatorio(camposObrigatoriosFaltando.nome)}
                    />
                  </Group>
                  <Group label="Data de nascimento" required>
                    <input
                      type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)}
                      className={`${inputClass} ${classeObrigatorio(camposObrigatoriosFaltando.dataNascimento)}`}
                      style={estiloObrigatorio(camposObrigatoriosFaltando.dataNascimento)}
                    />
                  </Group>
                  <Group label="Sexo" required>
                    <select
                      value={sexo} onChange={(e) => setSexo(e.target.value as "M" | "F")}
                      className={`${inputClass} cursor-pointer ${classeObrigatorio(camposObrigatoriosFaltando.sexo)}`}
                      style={estiloObrigatorio(camposObrigatoriosFaltando.sexo)}
                    >
                      <option value="">—</option>
                      <option value="F">Feminino</option>
                      <option value="M">Masculino</option>
                    </select>
                  </Group>
                </Row>

                <div className="mt-3">
                  <label className={labelClass}>Comorbidades</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COMORBIDADES_OPCOES.map((c) => {
                      const ativa = comorbidades.includes(c);
                      return (
                        <button
                          type="button" key={c}
                          onClick={() => toggleComorbidade(c)}
                          className={`nc-chip cursor-pointer ${ativa ? "active" : ""}`}
                        >
                          {c.replace(/_/g, " ")}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3">
                  <Group label="Etiologia da DRC (se houver)">
                    <select
                      value={etiologiaDrc} onChange={(e) => setEtiologiaDrc(e.target.value)}
                      className={`${inputClass} cursor-pointer`}
                    >
                      <option value="">—</option>
                      {ETIOLOGIAS_DRC.map((e) => (
                        <option key={e} value={e}>{e.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </Group>
                </div>

                <Row>
                  <Group label="Creatinina basal">
                    <input
                      type="number" step="0.01" value={creatininaBasal}
                      onChange={(e) => setCreatininaBasal(e.target.value)}
                      className={inputClass}
                    />
                  </Group>
                  <Group label="Data">
                    <input
                      type="date" value={dataCreatininaBasal}
                      onChange={(e) => setDataCreatininaBasal(e.target.value)}
                      className={inputClass}
                    />
                  </Group>
                  <Group label="Fonte">
                    <select
                      value={fonteCreatininaBasal} onChange={(e) => setFonteCreatininaBasal(e.target.value)}
                      className={`${inputClass} cursor-pointer`}
                    >
                      <option value="">—</option>
                      <option value="Laboratorio_interno">Laboratório interno</option>
                      <option value="Laboratorio_externo">Laboratório externo</option>
                    </select>
                  </Group>
                </Row>
              </Section>

              <Section label="Internação atual">
                {!ehEdicao && (
                  <Row>
                    <Group label="Data de admissão" required>
                      <input
                        type="date" required value={dataAdmissao}
                        onChange={(e) => setDataAdmissao(e.target.value)}
                        className={inputClass}
                      />
                    </Group>
                  </Row>
                )}
              </Section>

              {/* Seção de interconsulta — só no modo cadastro */}
              {!ehEdicao && (
                <Section label="Interconsulta nefrológica">
                  <Group label="Motivo da interconsulta">
                    <textarea
                      value={motivoInterconsulta} onChange={(e) => setMotivoInterconsulta(e.target.value)}
                      rows={2} className={inputClass}
                    />
                  </Group>
                  <Row>
                    <Group label="Diagnóstico principal" required>
                      <select
                        value={diagnosticoPrincipal} onChange={(e) => setDiagnosticoPrincipal(e.target.value)}
                        className={`${inputClass} cursor-pointer ${classeObrigatorio(camposObrigatoriosFaltando.diagnosticoPrincipal)}`}
                        style={estiloObrigatorio(camposObrigatoriosFaltando.diagnosticoPrincipal)}
                      >
                        <option value="">—</option>
                        {DIAGNOSTICOS_PRINCIPAIS.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </Group>
                    <Group label="Etiologia">
                      <select
                        value={etiologia} onChange={(e) => setEtiologia(e.target.value)}
                        className={`${inputClass} cursor-pointer`}
                      >
                        <option value="">—</option>
                        {ETIOLOGIAS_LRA.map((e) => (
                          <option key={e} value={e}>{e.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </Group>
                  </Row>
                  <Group label="Data provável de início da LRA (opcional)">
                    <input
                      type="date" value={dataInicioLra} onChange={(e) => setDataInicioLra(e.target.value)}
                      className={inputClass}
                    />
                  </Group>
                </Section>
              )}

              {tentouEnviar && temCampoFaltando && (
                <div
                  className="rounded-(--nc-radius) px-3 py-2 text-sm"
                  style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(176,48,32,0.2)" }}
                >
                  ⚠ Preencha os campos obrigatórios destacados em vermelho.
                </div>
              )}

              {erro && (
                <div
                  className="rounded-(--nc-radius) px-3 py-2 text-sm"
                  style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(176,48,32,0.2)" }}
                >
                  ⚠ {erro}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex shrink-0 justify-end gap-2 px-4 py-3 sm:px-6 sm:py-3.5"
          style={{ borderTop: "1px solid var(--border)", background: "var(--card)" }}
        >
          <button onClick={onClose} className="nc-btn nc-btn-ghost cursor-pointer">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={!rgConfirmado || isPending}
            className="nc-btn nc-btn-primary cursor-pointer"
            style={{ minWidth: 160 }}
          >
            {isPending ? "Salvando..." : ehEdicao ? "Salvar alterações" : "Cadastrar paciente"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="nc-section mt-0">
        <span className="nc-section-label">{label}</span>
        <div className="nc-section-line" />
      </div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 flex flex-wrap gap-3">{children}</div>;
}

function Group({
  label, flex, required, children,
}: { label: string; flex?: number; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-w-35 flex-col gap-1" style={{ flex: flex || 1 }}>
      <span className="nc-label" style={{ marginBottom: 0 }}>
        {label}
        {required && <span style={{ color: "var(--red)" }}> *</span>}
      </span>
      {children}
    </div>
  );
}