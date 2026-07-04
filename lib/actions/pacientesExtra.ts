"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ─── Diurese ───────────────────────────────────────────────────────────────

export async function registrarDiurese(
  acompanhamentoId: string,
  data: string,
  volumeMl: number,
  horas: number = 24
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("diureses").upsert(
    { acompanhamento_id: acompanhamentoId, data, volume_ml: volumeMl, horas, criado_por: user?.id },
    { onConflict: "acompanhamento_id,data" }
  );

  if (error) return { sucesso: false, erro: error.message };
  return { sucesso: true };
}

export async function editarDiurese(
  diureseId: string,
  volumeMl: number,
  horas: number
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("diureses")
    .update({ volume_ml: volumeMl, horas })
    .eq("id", diureseId);

  if (error) return { sucesso: false, erro: error.message };
  return { sucesso: true };
}

export async function excluirDiurese(diureseId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("diureses").delete().eq("id", diureseId);
  if (error) return { sucesso: false, erro: error.message };
  return { sucesso: true };
}

export async function buscarDiureses(acompanhamentoId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("diureses")
    .select("id, data, volume_ml, horas")
    .eq("acompanhamento_id", acompanhamentoId)
    .order("data", { ascending: true });

  if (error) return { sucesso: false, erro: error.message, dados: [] };
  return { sucesso: true, dados: data || [] };
}

// ─── Edição de paciente + internação ───────────────────────────────────────

/**
 * Atualiza os dados cadastrais do paciente (nome, nascimento, sexo,
 * comorbidades, creatinina basal e fonte) e o leito/setor da internação
 * ativa. Apenas campos fornecidos são atualizados.
 */
export async function editarPaciente(params: {
  pacienteId: string;
  internacaoId: string;
  acompanhamentoId: string;
  nome: string;
  dataNascimento?: string;
  sexo?: "M" | "F";
  comorbidades: string[];
  etiologiaDrc?: string;
  creatininaBasal?: number;
  dataCreatininaBasal?: string;
  fonteCreatininaBasal?: string;
  observacoesGerais?: string;
  enfermariaLeito: string;
  setor: string;
}) {
  const supabase = await createClient();

  // 1) Atualiza dados do paciente
  const { error: erroPaciente } = await supabase
    .from("pacientes")
    .update({
      nome: params.nome,
      data_nascimento: params.dataNascimento || null,
      sexo: params.sexo || null,
      comorbidades: params.comorbidades,
      etiologia_drc: params.etiologiaDrc || null,
      creatinina_basal: params.creatininaBasal ?? null,
      data_creatinina_basal: params.dataCreatininaBasal || null,
      fonte_creatinina_basal: params.fonteCreatininaBasal || null,
      observacoes_gerais: params.observacoesGerais || null,
    })
    .eq("id", params.pacienteId);

  if (erroPaciente) {
    return { sucesso: false, erro: `Erro ao atualizar paciente: ${erroPaciente.message}` };
  }

  // 2) Atualiza leito e setor da internação
  const { error: erroInternacao } = await supabase
    .from("internacoes")
    .update({
      enfermaria_leito: params.enfermariaLeito,
      setor: params.setor,
    })
    .eq("id", params.internacaoId);

  if (erroInternacao) {
    return { sucesso: false, erro: `Erro ao atualizar leito: ${erroInternacao.message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/pacientes/${params.acompanhamentoId}`);
  return { sucesso: true };
}