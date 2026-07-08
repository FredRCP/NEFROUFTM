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
  "AVC", "DAC", "DM", "Doenca_autoimune", "Doenca_de_Chagas", "Doenca_hematologica",
 "Doenca_renal_policistica", "DPOC", "Etilismo", "Fibrilacao_atrial",
 "HAS", "Hepatopatia", "HIV", "ICC", "Lupus", "Nefrolitiase",
 "Neoplasia", "Obesidade", "Tabagismo", "Transplante_renal",
];

const ETIOLOGIAS_DRC = [
 "Congenita_hereditaria", "Doenca_renal_policistica", "Glomerulopatia",
 "Indeterminada", "Nefrite_tubulo_intersticial",
 "Nefroesclerose_hipertensiva", "Doenca_renal_diabetica",
 "Nefropatia_por_refluxo", "Obstrutiva", "Outras",
];

const DIAGNOSTICOS_PRINCIPAIS = [
 { value: "Avaliacao_plasmaferese",label: "Avaliação para plasmaférese" },
 { value: "DHE",                   label: "Distúrbio Hidroeletrolítico (DHE)" },
 { value: "DRC_D",                 label: "DRC dialítica" },
 { value: "IRA_sobre_DRC",         label: "DRC com IRA sobreposta" },
 { value: "Glomerulopatias",       label: "Glomerulopatia" },
 { value: "Intoxicacao_exogena",   label: "Intoxicação exógena" },
 { value: "IRA",                   label: "IRA — Injúria Renal Aguda" },
 { value: "Nefrolitiase",          label: "Nefrolitíase" },
 { value: "Transplante_renal",     label: "Transplante renal" },
];

// ─── Etiologias por diagnóstico ───────────────────────────────────────────────

// IRA — por topografia
const ETIOLOGIAS_IRA_PRE_RENAL = [
 "Choque", "Diarréia", "Hipovolemia", "Sd_Cardiorrenal", "Sindrome_hepatorrenal", 
];
const ETIOLOGIAS_IRA_RENAL = [
 "NTA", "NIA", "Nefropatia_associada_contraste", "Nefrite_lupica",
 "Crise_esclerodermica", "Eclampsia", "Gamopatia_monoclonal",
 "Glomerulonefrite", "GNRP_rapidamente_progressiva",
 "Leptospirose", "Lise_tumoral",
 "Microangiopatia_trombotica_outras", "Mieloma_multiplo",
 "Necrose_cortical", "Nefropatia_por_IGA", "Nefrotoxicidade_medicamentosa",
 
 "PTT", "Rabdomiolise",
 "Sepse", "SHU", "SHU_atipica", "Sindrome_HELLP",
];
const ETIOLOGIAS_IRA_POS_RENAL = ["Bexigoma", "Estenose_uretra", "Estenose_ureter", "HPB", "Litíase", "Neo", "Outros" ];
const ETIOLOGIAS_IRA_OUTRAS = ["IRA_multifatorial", "Pos_operatorio", "Outras_especificar"];

// Glomerulopatias
const ETIOLOGIAS_GLOMERULOPATIA = [
 "Eclampsia", "Gamopatia_monoclonal", "GESF", "GNMP_membranoproliferativa", "Nefrite_lupica",
 "GNRP_rapidamente_progressiva", "Lesao_minima", "Microangiopatia_trombotica", "Nefropatia_por_IGA", 
 "Nefropatia_membranosa", "PTT",
 "SHU", "SHU_atipica",  "Sindrome_HELLP",
 "Outras",
];

// DHE
const SUBCAMPOS_DHE = [
 "Hiponatremia", "Hipernatremia",
 "Hipocalemia", "Hipercalemia",
 "Hipomagnesemia", "Hipermagnesemia",
 "Hipocalcemia", "Hipercalcemia",
 "Hipofosfatemia", "Hiperfosfatemia",
 "Acidose_metabolica", "Alcalose_metabolica",
 "Acidose_respiratoria", "Alcalose_respiratoria",
];

// Transplante renal
const SUBCAMPOS_TX_RENAL = [
 "Rejeicao_aguda", "Disfuncao_cronica_enxerto",
 "Nefrotoxicidade_inibidor_calcineurina",
 "Infeccao_BKV", "Infeccao_CMV", "Complicacoes_pos_tx", "Outras",
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
  const [etiologias, setEtiologias] = useState<string[]>([]); // múltipla seleção
  const [etiologiaOutroTexto, setEtiologiaOutroTexto] = useState("");
  const [subcamposDHE, setSubcamposDHE] = useState<string[]>([]);
  const [subcamposTxRenal, setSubcamposTxRenal] = useState<string[]>([]);
  const [dataInicioLra, setDataInicioLra] = useState("");

  function toggleEtiologia(v: string) {
    setEtiologias(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }
  function toggleSubcampoDHE(v: string) {
    setSubcamposDHE(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }
  function toggleSubcampoTx(v: string) {
    setSubcamposTxRenal(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

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

    // Monta etiologia final concatenando múltiplas seleções
    const etiologiaFinal = (() => {
      if (diagnosticoPrincipal === "DHE" && subcamposDHE.length > 0)
        return subcamposDHE.map(e => e.replace(/_/g, " ")).join(", ");
      if (diagnosticoPrincipal === "Transplante_renal" && subcamposTxRenal.length > 0)
        return subcamposTxRenal.map(e => e.replace(/_/g, " ")).join(", ");
      if (etiologias.length > 0) {
        const partes = etiologias.filter(e => e !== "Outras_especificar").map(e => e.replace(/_/g, " "));
        if (etiologias.includes("Outras_especificar") && etiologiaOutroTexto.trim())
          partes.push(`Outras: ${etiologiaOutroTexto.trim()}`);
        return partes.join(", ");
      }
      if ((diagnosticoPrincipal === "Nefrolitiase" || diagnosticoPrincipal === "Intoxicacao_exogena" || diagnosticoPrincipal === "Avaliacao_plasmaferese") && etiologiaOutroTexto.trim())
        return etiologiaOutroTexto.trim();
      return undefined;
    })();

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
          creatininaBasal: creatininaBasal ? parseFloat(creatininaBasal.replace(",", ".")) : undefined,
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
          creatininaBasal: creatininaBasal ? parseFloat(creatininaBasal.replace(",", ".")) : undefined,
          dataCreatininaBasal: dataCreatininaBasal || undefined,
          fonteCreatininaBasal: fonteCreatininaBasal || undefined,
          observacoesGerais: observacoes || undefined,
          dataAdmissao,
          setor: setorInferido,
          enfermariaLeito: leito,
          motivoInterconsulta: motivoInterconsulta || undefined,
          diagnosticoPrincipal: diagnosticoPrincipal || undefined,
          etiologia: etiologiaFinal || undefined,
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
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-3xl flex-col overflow-hidden sm:rounded-2xl"
        style={{
          background: "var(--card)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.2)",
          height: "95dvh",
          borderRadius: "20px 20px 0 0",
        }}
      >
        {/* Drag handle — só mobile */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden" style={{ background: "#1e3a5f" }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.3)" }} />
        </div>

        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5"
          style={{ background: "#1e3a5f", borderBottom: "1px solid rgba(255,255,255,0.1)" }}
        >
          <span className="text-sm font-extrabold text-white">
            {ehEdicao ? `Editar — ${paciente!.nome.split(" ")[0]}` : "Novo paciente"}
          </span>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-full w-8 h-8 flex items-center justify-center text-white transition hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.15)", fontSize: 16 }}
          >
            ✕
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
                    setErro(null);
                    setTentouEnviar(false);
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

              {resultadoVerificacao?.existe && !modoReativacao && (() => {
                const estaAtivo = resultadoVerificacao.acompanhamentoAtivo;
                if (estaAtivo) {
                  return (
                    <div className="mt-3 rounded-(--nc-radius) p-3"
                      style={{ background: "var(--red-dim)", border: "1px solid rgba(176,48,32,0.2)" }}>
                      <p className="text-sm" style={{ color: "var(--red)" }}>
                        ⚠ <strong>{resultadoVerificacao.paciente?.nome}</strong> já possui um acompanhamento{" "}
                        <strong>ativo</strong> no sistema. Finalize o acompanhamento atual antes de criar um novo.
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="mt-3 rounded-(--nc-radius) p-3"
                    style={{ background: "var(--amber-dim)", border: "1px solid rgba(154,74,10,0.2)" }}>
                    <p className="text-sm" style={{ color: "var(--amber)" }}>
                      Paciente <strong>{resultadoVerificacao.paciente?.nome}</strong> já
                      está cadastrado, com {resultadoVerificacao.acompanhamentosAnteriores}{" "}
                      acompanhamento(s) anterior(es). Acompanhamento atual: encerrado.
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
                );
              })()}

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
            <form id="modal-paciente-form" onSubmit={handleSubmit} className="mt-5 space-y-5">
              <fieldset disabled={isPending} style={{ border: "none", padding: 0, margin: 0 }}>
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
                      type="text" required autoFocus value={nome}
                      onChange={(e) => setNome(e.target.value)}
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
                  <div className="flex flex-wrap gap-2">
                    {COMORBIDADES_OPCOES.map((c) => {
                      const ativa = comorbidades.includes(c);
                      return (
                        <button
                          type="button" key={c}
                          onClick={() => toggleComorbidade(c)}
                          className={`nc-chip cursor-pointer ${ativa ? "active" : ""}`}
                          style={{ padding: "6px 12px", fontSize: 13, minHeight: 36 }}
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
                      type="text" inputMode="decimal"
                      value={creatininaBasal}
                      onChange={(e) => setCreatininaBasal(e.target.value)}
                      placeholder="Ex: 1,2"
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
                        value={diagnosticoPrincipal}
                        onChange={(e) => {
                          setDiagnosticoPrincipal(e.target.value);
                          setEtiologias([]);
                          setEtiologiaOutroTexto("");
                          setSubcamposDHE([]);
                          setSubcamposTxRenal([]);
                          setDataInicioLra("");
                        }}
                        className={`${inputClass} cursor-pointer ${classeObrigatorio(camposObrigatoriosFaltando.diagnosticoPrincipal)}`}
                        style={estiloObrigatorio(camposObrigatoriosFaltando.diagnosticoPrincipal)}
                      >
                        <option value="">—</option>
                        {DIAGNOSTICOS_PRINCIPAIS.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </Group>
                  </Row>

                  {/* ── IRA ou IRA sobre DRC ── */}
                  {(diagnosticoPrincipal === "IRA" || diagnosticoPrincipal === "IRA_sobre_DRC") && (
                    <div className="space-y-3 rounded-(--nc-radius-lg) p-3" style={{ background: "var(--accent-dim)", border: "1px solid var(--border2)" }}>
                      <p className="nc-label mb-1">Etiologia da IRA</p>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text3)" }}>🔴 Pré-renal</p>
                        <div className="flex flex-wrap gap-1.5">
                          {ETIOLOGIAS_IRA_PRE_RENAL.map(e => (
                            <button key={e} type="button" onClick={() => toggleEtiologia(e)}
                              className={`nc-chip cursor-pointer ${etiologias.includes(e) ? "active" : ""}`} style={{ padding: "6px 12px", fontSize: 13, minHeight: 36 }}>
                              {e.replace(/_/g, " ")}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text3)" }}>🟡 Renal (parenquimatosa)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {ETIOLOGIAS_IRA_RENAL.map(e => (
                            <button key={e} type="button" onClick={() => toggleEtiologia(e)}
                              className={`nc-chip cursor-pointer ${etiologias.includes(e) ? "active" : ""}`} style={{ padding: "6px 12px", fontSize: 13, minHeight: 36 }}>
                              {e.replace(/_/g, " ")}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text3)" }}>🟢 Pós-renal</p>
                        <div className="flex flex-wrap gap-1.5">
                          {ETIOLOGIAS_IRA_POS_RENAL.map(e => (
                            <button key={e} type="button" onClick={() => toggleEtiologia(e)}
                              className={`nc-chip cursor-pointer ${etiologias.includes(e) ? "active" : ""}`} style={{ padding: "6px 12px", fontSize: 13, minHeight: 36 }}>
                              {e.replace(/_/g, " ")}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text3)" }}>⚪ Outras</p>
                        <div className="flex flex-wrap gap-1.5">
                          {ETIOLOGIAS_IRA_OUTRAS.map(e => (
                            <button key={e} type="button" onClick={() => toggleEtiologia(e)}
                              className={`nc-chip cursor-pointer ${etiologias.includes(e) ? "active" : ""}`} style={{ padding: "6px 12px", fontSize: 13, minHeight: 36 }}>
                              {e.replace(/_/g, " ")}
                            </button>
                          ))}
                        </div>
                        {etiologias.includes("Outras_especificar") && (
                          <input
                            type="text" value={etiologiaOutroTexto}
                            onChange={e => setEtiologiaOutroTexto(e.target.value)}
                            placeholder="Especifique a etiologia..."
                            className={`${inputClass} mt-2`}
                          />
                        )}
                      </div>

                      {etiologias.length > 0 && (
                        <p className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                          ✓ Selecionado(s): {etiologias.map(e => e.replace(/_/g, " ")).join(", ")}
                        </p>
                      )}

                      <Row>
                        <Group label="Data provável de início da IRA">
                          <input type="date" value={dataInicioLra} onChange={e => setDataInicioLra(e.target.value)} className={inputClass} />
                        </Group>
                      </Row>
                    </div>
                  )}

                  {/* ── Glomerulopatia ── */}
                  {diagnosticoPrincipal === "Glomerulopatias" && (
                    <div className="rounded-(--nc-radius-lg) p-3" style={{ background: "var(--accent-dim)", border: "1px solid var(--border2)" }}>
                      <p className="nc-label mb-2">Tipo de glomerulopatia — pode selecionar mais de um</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ETIOLOGIAS_GLOMERULOPATIA.map(e => (
                          <button key={e} type="button" onClick={() => toggleEtiologia(e)}
                            className={`nc-chip cursor-pointer ${etiologias.includes(e) ? "active" : ""}`} style={{ padding: "6px 12px", fontSize: 13, minHeight: 36 }}>
                            {e.replace(/_/g, " ")}
                          </button>
                        ))}
                      </div>
                      {etiologias.length > 0 && (
                        <p className="mt-2 text-xs font-semibold" style={{ color: "var(--accent)" }}>
                          ✓ {etiologias.map(e => e.replace(/_/g, " ")).join(", ")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── DHE ── */}
                  {diagnosticoPrincipal === "DHE" && (
                    <div className="rounded-(--nc-radius-lg) p-3" style={{ background: "var(--accent-dim)", border: "1px solid var(--border2)" }}>
                      <p className="nc-label mb-2">Distúrbio(s) presente(s) — selecione todos que se aplicam</p>
                      <div className="flex flex-wrap gap-1.5">
                        {SUBCAMPOS_DHE.map(e => (
                          <button key={e} type="button" onClick={() => toggleSubcampoDHE(e)}
                            className={`nc-chip cursor-pointer ${subcamposDHE.includes(e) ? "active" : ""}`} style={{ padding: "6px 12px", fontSize: 13, minHeight: 36 }}>
                            {e.replace(/_/g, " ")}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Transplante renal ── */}
                  {diagnosticoPrincipal === "Transplante_renal" && (
                    <div className="rounded-(--nc-radius-lg) p-3" style={{ background: "var(--accent-dim)", border: "1px solid var(--border2)" }}>
                      <p className="nc-label mb-2">Motivo da interconsulta pós-Tx — selecione todos que se aplicam</p>
                      <div className="flex flex-wrap gap-1.5">
                        {SUBCAMPOS_TX_RENAL.map(e => (
                          <button key={e} type="button" onClick={() => toggleSubcampoTx(e)}
                            className={`nc-chip cursor-pointer ${subcamposTxRenal.includes(e) ? "active" : ""}`} style={{ padding: "6px 12px", fontSize: 13, minHeight: 36 }}>
                            {e.replace(/_/g, " ")}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Nefrolitíase / Intoxicação / Plasmaférese — sem subcampos específicos ── */}
                  {(diagnosticoPrincipal === "Nefrolitiase" || diagnosticoPrincipal === "Intoxicacao_exogena" || diagnosticoPrincipal === "Avaliacao_plasmaferese") && (
                    <div className="rounded-(--nc-radius-lg) p-3" style={{ background: "var(--accent-dim)", border: "1px solid var(--border2)" }}>
                      <Group label="Especificações / Observações">
                        <textarea value={etiologiaOutroTexto} onChange={e => setEtiologiaOutroTexto(e.target.value)}
                          rows={2} className={inputClass}
                          placeholder={
                            diagnosticoPrincipal === "Nefrolitiase" ? "Ex: Cálculo obstrutivo à direita, cólica renal..." :
                            diagnosticoPrincipal === "Intoxicacao_exogena" ? "Ex: Intoxicação por paracetamol, contraste..." :
                            "Ex: Indicação, protocolo previsto..."
                          }
                        />
                      </Group>
                    </div>
                  )}

                  {/* ── DRC dialítica ── */}
                  {diagnosticoPrincipal === "DRC_D" && (
                    <div className="rounded-(--nc-radius-lg) p-3" style={{ background: "var(--accent-dim)", border: "1px solid var(--border2)" }}>
                      <Row>
                        <Group label="Etiologia da DRC">
                          <select value={etiologias[0] ?? ""} onChange={e => setEtiologias(e.target.value ? [e.target.value] : [])}
                            className={`${inputClass} cursor-pointer`}>
                            <option value="">—</option>
                            {ETIOLOGIAS_DRC.map(e => (
                              <option key={e} value={e}>{e.replace(/_/g, " ")}</option>
                            ))}
                          </select>
                        </Group>
                      </Row>
                    </div>
                  )}
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
              </fieldset>
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
            type="submit"
            form="modal-paciente-form"
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