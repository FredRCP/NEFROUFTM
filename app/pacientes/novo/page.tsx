"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  verificarRgHospitalar,
  cadastrarPaciente,
  type VerificarRgResult,
} from "@/lib/actions/pacientes";
import { CATALOGO_LEITOS, getSetorByLeito, SETORES } from "@/types/database";

const COMORBIDADES_OPCOES = [
  "DM", "HAS", "AVC", "HIV", "Hepatopatia", "DPOC", "ICC", "ICO",
  "DAC", "Fibrilacao_atrial", "Cirrose", "Doenca_autoimune",
  "Neoplasia", "Transplante_renal", "Transplante_hepatico",
];

const ETIOLOGIAS_DRC = [
  "Nefropatia_diabetica", "Nefroesclerose_hipertensiva", "DRPAD",
  "Glomerulopatia", "Nefrite_tubulo_intersticial", "Obstrutiva",
  "Indeterminada", "Outras",
];

const ETIOLOGIAS_LRA = [
  "Sepse", "Hipovolemia", "NTA", "Obstrucao", "Glomerulonefrite",
  "Sindrome_hepatorrenal", "Cardiorrenal", "Outras",
];

export default function NovoPacientePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Etapa 1: RG e verificação de duplicidade
  const [rg, setRg] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [resultadoVerificacao, setResultadoVerificacao] = useState<VerificarRgResult | null>(null);
  const [rgConfirmado, setRgConfirmado] = useState(false);
  const [modoReativacao, setModoReativacao] = useState(false);

  // Etapa 2: dados do paciente (só relevante se for novo)
  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [sexo, setSexo] = useState<"M" | "F" | "">("");
  const [comorbidades, setComorbidades] = useState<string[]>([]);
  const [etiologiaDrc, setEtiologiaDrc] = useState("");
  const [creatininaBasal, setCreatininaBasal] = useState("");
  const [dataCreatininaBasal, setDataCreatininaBasal] = useState("");
  const [fonteCreatininaBasal, setFonteCreatininaBasal] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Etapa 3: internação + acompanhamento (sempre preenchido)
  const [dataAdmissao, setDataAdmissao] = useState(() => new Date().toISOString().slice(0, 10));
  const [leito, setLeito] = useState("");
  const [motivoInterconsulta, setMotivoInterconsulta] = useState("");
  const [diagnosticoPrincipal, setDiagnosticoPrincipal] = useState("");
  const [etiologia, setEtiologia] = useState("");
  const [dataInicioLra, setDataInicioLra] = useState("");

  const [erro, setErro] = useState<string | null>(null);

  async function handleVerificarRg() {
    if (!rg.trim()) return;
    setVerificando(true);
    setErro(null);

    const resultado = await verificarRgHospitalar(rg);
    setResultadoVerificacao(resultado);
    setVerificando(false);

    if (!resultado.existe) {
      setRgConfirmado(true);
    }
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!leito) {
      setErro("Selecione o leito do paciente.");
      return;
    }

    const setorInferido = getSetorByLeito(leito);
    if (!setorInferido) {
      setErro("Leito inválido — não foi possível identificar o setor.");
      return;
    }

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

      router.push("/dashboard");
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-slate-900">Novo paciente</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cadastro de interconsulta — equipe de nefrologia
        </p>

        {/* ETAPA 1: RG hospitalar */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <label className="block text-sm font-medium text-slate-700">
            RG hospitalar
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={rg}
              disabled={rgConfirmado}
              onChange={(e) => {
                setRg(e.target.value);
                setResultadoVerificacao(null);
                setRgConfirmado(false);
                setModoReativacao(false);
              }}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              placeholder="Número do registro hospitalar"
            />
            {!rgConfirmado && (
              <button
                type="button"
                onClick={handleVerificarRg}
                disabled={verificando || !rg.trim()}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {verificando ? "Verificando..." : "Verificar"}
              </button>
            )}
          </div>

          {resultadoVerificacao?.existe && !modoReativacao && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-900">
                Paciente <strong>{resultadoVerificacao.paciente?.nome}</strong> já
                está cadastrado, com {resultadoVerificacao.acompanhamentosAnteriores}{" "}
                acompanhamento(s) anterior(es). Reative a ficha existente em vez de
                criar um cadastro novo — isso preserva o histórico.
              </p>
              <button
                type="button"
                onClick={handleReativarFicha}
                className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
              >
                Reativar ficha de {resultadoVerificacao.paciente?.nome}
              </button>
            </div>
          )}

          {modoReativacao && (
            <p className="mt-3 text-sm text-emerald-700">
              ✓ Reativando ficha existente — dados anteriores carregados abaixo.
            </p>
          )}

          {rgConfirmado && !modoReativacao && (
            <p className="mt-3 text-sm text-emerald-700">
              ✓ RG novo — siga com o cadastro abaixo.
            </p>
          )}
        </div>

        {/* ETAPAS 2 e 3: só aparecem após confirmar o RG */}
        {rgConfirmado && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Dados do paciente</h2>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Nome</label>
                  <input
                    type="text" required value={nome} onChange={(e) => setNome(e.target.value)}
                    disabled={modoReativacao}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Data de nascimento</label>
                  <input
                    type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)}
                    disabled={modoReativacao}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Sexo</label>
                  <select
                    value={sexo} onChange={(e) => setSexo(e.target.value as "M" | "F")}
                    disabled={modoReativacao}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  >
                    <option value="">—</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">Comorbidades</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COMORBIDADES_OPCOES.map((c) => (
                    <button
                      type="button" key={c} disabled={modoReativacao}
                      onClick={() => toggleComorbidade(c)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        comorbidades.includes(c)
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      } disabled:opacity-60`}
                    >
                      {c.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">Etiologia da DRC (se houver)</label>
                <select
                  value={etiologiaDrc} onChange={(e) => setEtiologiaDrc(e.target.value)}
                  disabled={modoReativacao}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                >
                  <option value="">—</option>
                  {ETIOLOGIAS_DRC.map((e) => (
                    <option key={e} value={e}>{e.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Creatinina basal</label>
                  <input
                    type="number" step="0.01" value={creatininaBasal}
                    onChange={(e) => setCreatininaBasal(e.target.value)}
                    disabled={modoReativacao}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Data</label>
                  <input
                    type="date" value={dataCreatininaBasal}
                    onChange={(e) => setDataCreatininaBasal(e.target.value)}
                    disabled={modoReativacao}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Fonte</label>
                  <select
                    value={fonteCreatininaBasal} onChange={(e) => setFonteCreatininaBasal(e.target.value)}
                    disabled={modoReativacao}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  >
                    <option value="">—</option>
                    <option value="Ambulatorio">Ambulatório</option>
                    <option value="Internacao_anterior">Internação anterior</option>
                    <option value="Laboratorio_externo">Laboratório externo</option>
                    <option value="Estimada">Estimada</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Internação atual</h2>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Data de admissão</label>
                  <input
                    type="date" required value={dataAdmissao}
                    onChange={(e) => setDataAdmissao(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Leito</label>
                  <select
                    required value={leito} onChange={(e) => setLeito(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
                  <p className="mt-1 text-xs text-slate-400">
                    O setor e o grupo (UTIs / Enfermarias / Pronto-Socorro) são identificados automaticamente a partir do leito.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Interconsulta nefrológica</h2>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">Motivo da interconsulta</label>
                <textarea
                  value={motivoInterconsulta} onChange={(e) => setMotivoInterconsulta(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Diagnóstico principal</label>
                  <select
                    value={diagnosticoPrincipal} onChange={(e) => setDiagnosticoPrincipal(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    <option value="IRA">IRA</option>
                    <option value="DRC_D">DRC dialítica</option>
                    <option value="IRA_sobre_DRC">IRA sobre DRC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Etiologia</label>
                  <select
                    value={etiologia} onChange={(e) => setEtiologia(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {ETIOLOGIAS_LRA.map((e) => (
                      <option key={e} value={e}>{e.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Data provável de início da LRA (opcional)
                  </label>
                  <input
                    type="date" value={dataInicioLra} onChange={(e) => setDataInicioLra(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </section>

            {erro && <p className="text-sm text-red-600" role="alert">{erro}</p>}

            <div className="flex justify-end gap-3">
              <button
                type="button" onClick={() => router.push("/dashboard")}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit" disabled={isPending}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {isPending ? "Salvando..." : "Cadastrar paciente"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
