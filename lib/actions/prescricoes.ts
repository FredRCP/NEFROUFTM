"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function salvarPrescricao(params: {
  acompanhamentoId: string;
  modalidade: string;
  dados: Record<string, unknown>;
  metricas: Record<string, unknown>;
  textoPrescricao: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("prescricoes_dialise").insert({
    acompanhamento_id: params.acompanhamentoId,
    modalidade: params.modalidade,
    dados: params.dados,
    metricas: params.metricas,
    texto_prescricao: params.textoPrescricao,
    criado_por: user?.id,
  });

  if (error) return { sucesso: false, erro: error.message };

  revalidatePath(`/pacientes/${params.acompanhamentoId}`);
  return { sucesso: true };
}

export async function buscarPrescricoes(acompanhamentoId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("prescricoes_dialise")
    .select("id, modalidade, texto_prescricao, dados, metricas, created_at")
    .eq("acompanhamento_id", acompanhamentoId)
    .order("created_at", { ascending: false });

  if (error) return { sucesso: false, erro: error.message, dados: [] };
  return { sucesso: true, dados: data || [] };
}

export async function excluirPrescricao(prescricaoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("prescricoes_dialise")
    .delete()
    .eq("id", prescricaoId);
  if (error) return { sucesso: false, erro: error.message };
  return { sucesso: true };
}