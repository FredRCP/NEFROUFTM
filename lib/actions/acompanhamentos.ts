"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Marca/desmarca "avaliado hoje" — sempre uma ação EXPLÍCITA do médico
 * (Seção 4.3). O trigger no banco cuida de atualizar ultima_avaliacao_medica
 * apenas na transição false -> true.
 */
export async function marcarAvaliado(acompanhamentoId: string, valor: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("acompanhamentos_nefro")
    .update({ avaliado_hoje: valor })
    .eq("id", acompanhamentoId);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/dashboard");
  return { sucesso: true };
}

export async function atualizarSituacaoDialitica(
  acompanhamentoId: string,
  situacao: "hd_hoje" | "hd_amanha" | "sem_hd_programada"
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("acompanhamentos_nefro")
    .update({ situacao_dialitica: situacao })
    .eq("id", acompanhamentoId);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/dashboard");
  return { sucesso: true };
}

export async function alternarNecessitaDiscussao(
  acompanhamentoId: string,
  valor: boolean
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("acompanhamentos_nefro")
    .update({ necessita_discussao: valor })
    .eq("id", acompanhamentoId);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/dashboard");
  return { sucesso: true };
}

/**
 * Pendências: lista efêmera (Seção 4.3) — resolvida = DELETE real,
 * não soft-delete. A resolução deve ser documentada na evolução pelo
 * médico (texto livre), não fica registrada aqui.
 *
 * Sem revalidatePath aqui de propósito: a tabela "pendencias" já tem
 * uma subscription Realtime no DashboardClient, que recarrega a lista
 * via fetch no client assim que o INSERT/DELETE é detectado. Ter os
 * dois mecanismos disparando juntos (revalidate do Server Action +
 * Realtime do client) causava um "flash"/re-render duplicado em
 * cascata em todos os cards do dashboard ao mesmo tempo.
 */
export async function adicionarPendencia(acompanhamentoId: string, descricao: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("pendencias").insert({
    acompanhamento_id: acompanhamentoId,
    descricao: descricao.trim(),
    criado_por: user?.id,
  });

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  return { sucesso: true };
}

export async function resolverPendencia(pendenciaId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("pendencias")
    .delete()
    .eq("id", pendenciaId);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  return { sucesso: true };
}

/**
 * Evoluções: múltiplas por dia permitidas (Seção 4.4).
 * Edição/exclusão restrita ao autor — já garantido por RLS,
 * mas a action também confia nisso (erro do Supabase se violar).
 */
export async function adicionarEvolucao(
  acompanhamentoId: string,
  texto: string,
  conduta?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { sucesso: false, erro: "Usuário não autenticado." };
  }

  const { error } = await supabase.from("evolucoes").insert({
    acompanhamento_id: acompanhamentoId,
    autor_id: user.id,
    texto: texto.trim(),
    conduta: conduta?.trim() || null,
  });

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/dashboard");
  return { sucesso: true };
}

/**
 * Edição restrita ao próprio autor (Seção 4.4) — garantido pelo RLS
 * (policy evolucoes_update_own), mas a UI já evita oferecer o botão
 * para quem não é autor.
 */
export async function editarEvolucao(evolucaoId: string, texto: string, conduta?: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("evolucoes")
    .update({ texto: texto.trim(), conduta: conduta?.trim() || null })
    .eq("id", evolucaoId);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/dashboard");
  return { sucesso: true };
}

export async function excluirEvolucao(evolucaoId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("evolucoes")
    .delete()
    .eq("id", evolucaoId);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/dashboard");
  return { sucesso: true };
}

export async function atualizarResumoAcompanhamento(
  acompanhamentoId: string,
  dados: {
    diagnosticoPrincipal?: string;
    etiologia?: string;
    tags?: string[];
    prioridade?: string;
    motivoInterconsulta?: string;
    dataInicioLra?: string;
  }
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("acompanhamentos_nefro")
    .update({
      diagnostico_principal: dados.diagnosticoPrincipal || null,
      etiologia: dados.etiologia || null,
      tags: dados.tags || [],
      prioridade: dados.prioridade || null,
      motivo_interconsulta: dados.motivoInterconsulta || null,
      data_inicio_lra: dados.dataInicioLra || null,
    })
    .eq("id", acompanhamentoId);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/dashboard");
  return { sucesso: true };
}

/**
 * Dá baixa no acompanhamento (Seção 3.2): exige motivo da alta E
 * desfecho renal, dois campos distintos.
 */
export async function darBaixaAcompanhamento(
  acompanhamentoId: string,
  motivoAlta: string,
  desfechoRenal: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("acompanhamentos_nefro")
    .update({
      ativo: false,
      motivo_alta: motivoAlta,
      desfecho_renal: desfechoRenal,
      data_saida: new Date().toISOString().slice(0, 10),
    })
    .eq("id", acompanhamentoId);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/dashboard");
  return { sucesso: true };
}