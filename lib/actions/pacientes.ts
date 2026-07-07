"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface VerificarRgResult {
  existe: boolean;
  paciente?: {
    id: string;
    nome: string;
    data_nascimento: string | null;
    sexo: "M" | "F" | null;
    comorbidades: string[];
    etiologia_drc: string | null;
    creatinina_basal: number | null;
    data_creatinina_basal: string | null;
    fonte_creatinina_basal: string | null;
    observacoes_gerais: string | null;
  };
  acompanhamentosAnteriores?: number;
  acompanhamentoAtivo?: boolean; // ← novo: true se há acompanhamento ativo
}

export async function verificarRgHospitalar(
  rgHospitalar: string
): Promise<VerificarRgResult> {
  const supabase = await createClient();

  const { data: paciente } = await supabase
    .from("pacientes")
    .select("*")
    .eq("rg_hospitalar", rgHospitalar.trim())
    .maybeSingle();

  if (!paciente) {
    return { existe: false };
  }

  const { count } = await supabase
    .from("acompanhamentos_nefro")
    .select("id", { count: "exact", head: true })
    .eq("paciente_id", paciente.id);

  // Verifica se há acompanhamento ATIVO no momento
  const { data: ativo } = await supabase
    .from("acompanhamentos_nefro")
    .select("id")
    .eq("paciente_id", paciente.id)
    .eq("ativo", true)
    .maybeSingle();

  return {
    existe: true,
    paciente,
    acompanhamentosAnteriores: count ?? 0,
    acompanhamentoAtivo: !!ativo,
  };
}

export interface CadastroPacienteInput {
  pacienteIdExistente?: string;
  nome: string;
  rgHospitalar: string;
  dataNascimento?: string;
  sexo?: "M" | "F";
  comorbidades?: string[];
  etiologiaDrc?: string;
  creatininaBasal?: number;
  dataCreatininaBasal?: string;
  fonteCreatininaBasal?: string;
  observacoesGerais?: string;
  dataAdmissao: string;
  setor: string;
  enfermariaLeito?: string;
  motivoInterconsulta?: string;
  diagnosticoPrincipal?: string;
  etiologia?: string;
  dataInicioLra?: string;
}

export interface CadastroPacienteResult {
  sucesso: boolean;
  erro?: string;
  acompanhamentoId?: string;
}

export async function cadastrarPaciente(
  input: CadastroPacienteInput
): Promise<CadastroPacienteResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { sucesso: false, erro: "Usuário não autenticado." };
  }

  let pacienteId = input.pacienteIdExistente;

  if (!pacienteId) {
    const { data: jaExiste } = await supabase
      .from("pacientes")
      .select("id")
      .eq("rg_hospitalar", input.rgHospitalar.trim())
      .maybeSingle();

    if (jaExiste) {
      return {
        sucesso: false,
        erro: "Este RG hospitalar já está cadastrado. Recarregue a página e use a opção de reativar ficha existente.",
      };
    }

    const { data: novoPaciente, error: erroPaciente } = await supabase
      .from("pacientes")
      .insert({
        nome: input.nome,
        rg_hospitalar: input.rgHospitalar.trim(),
        data_nascimento: input.dataNascimento || null,
        sexo: input.sexo || null,
        comorbidades: input.comorbidades || [],
        etiologia_drc: input.etiologiaDrc || null,
        creatinina_basal: input.creatininaBasal ?? null,
        data_creatinina_basal: input.dataCreatininaBasal || null,
        fonte_creatinina_basal: input.fonteCreatininaBasal || null,
        observacoes_gerais: input.observacoesGerais || null,
      })
      .select("id")
      .single();

    if (erroPaciente || !novoPaciente) {
      return { sucesso: false, erro: `Erro ao criar paciente: ${erroPaciente?.message}` };
    }

    pacienteId = novoPaciente.id;
  }

  const { data: internacao, error: erroInternacao } = await supabase
    .from("internacoes")
    .insert({
      paciente_id: pacienteId,
      data_admissao: input.dataAdmissao,
      setor: input.setor,
      enfermaria_leito: input.enfermariaLeito || null,
      status: "internado",
    })
    .select("id")
    .single();

  if (erroInternacao || !internacao) {
    return { sucesso: false, erro: `Erro ao criar internação: ${erroInternacao?.message}` };
  }

  const { data: acompanhamento, error: erroAcomp } = await supabase
    .from("acompanhamentos_nefro")
    .insert({
      internacao_id: internacao.id,
      paciente_id: pacienteId,
      motivo_interconsulta: input.motivoInterconsulta || null,
      diagnostico_principal: input.diagnosticoPrincipal || null,
      etiologia: input.etiologia || null,
      data_inicio_lra: input.dataInicioLra || null,
      criado_por: user.id,
      ativo: true,
    })
    .select("id")
    .single();

  if (erroAcomp || !acompanhamento) {
    return { sucesso: false, erro: `Erro ao criar acompanhamento: ${erroAcomp?.message}` };
  }

  revalidatePath("/dashboard");

  return { sucesso: true, acompanhamentoId: acompanhamento.id };
}