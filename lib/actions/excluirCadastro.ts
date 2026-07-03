"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Exclusão DEFINITIVA de um cadastro feito por erro — diferente de
 * "dar baixa" (que fecha um acompanhamento real com motivo de alta e
 * preserva o histórico). Aqui o registro inteiro é removido do banco,
 * sem volta.
 *
 * Ordem de exclusão respeita as foreign keys:
 *   pendencias / evolucoes  →  acompanhamento_nefro  →  internacao  →  paciente
 *
 * O paciente só é excluído se NÃO tiver nenhum outro acompanhamento
 * (de internações anteriores), preservando histórico legítimo de quem
 * já foi atendido outras vezes.
 */
export async function excluirCadastroCompleto(acompanhamentoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { sucesso: false, erro: "Usuário não autenticado." };
  }

  // 1) Busca o acompanhamento para obter as referências necessárias
  const { data: acompanhamento, error: erroBusca } = await supabase
    .from("acompanhamentos_nefro")
    .select("id, internacao_id, paciente_id")
    .eq("id", acompanhamentoId)
    .maybeSingle();

  if (erroBusca || !acompanhamento) {
    return { sucesso: false, erro: "Acompanhamento não encontrado." };
  }

  const { internacao_id: internacaoId, paciente_id: pacienteId } = acompanhamento;

  // 1.5) Checagem prévia: evoluções de OUTROS autores bloqueiam a exclusão
  // completa, porque o RLS (evolucoes_delete_own) só permite que o próprio
  // autor exclua sua evolução. Verificamos isso ANTES de excluir qualquer
  // coisa, para não deixar o cadastro "pela metade" (ex: pendências já
  // excluídas, mas acompanhamento intacto porque travou nas evoluções).
  const { data: evolucoesDoAcompanhamento, error: erroListaEvolucoes } = await supabase
    .from("evolucoes")
    .select("id, autor_id")
    .eq("acompanhamento_id", acompanhamentoId);

  if (erroListaEvolucoes) {
    return { sucesso: false, erro: `Erro ao verificar evoluções: ${erroListaEvolucoes.message}` };
  }

  const evolucoesDeOutroAutor = (evolucoesDoAcompanhamento || []).filter(
    (e) => e.autor_id !== user.id
  );

  if (evolucoesDeOutroAutor.length > 0) {
    return {
      sucesso: false,
      erro:
        `Este acompanhamento tem ${evolucoesDeOutroAutor.length} evolução(ões) registrada(s) ` +
        `por outro(s) médico(s), e cada médico só pode excluir suas próprias evoluções. ` +
        `Não é possível concluir a exclusão completa enquanto essas evoluções existirem.`,
    };
  }

  // 2) Exclui pendências ligadas a este acompanhamento
  const { error: erroPendencias } = await supabase
    .from("pendencias")
    .delete()
    .eq("acompanhamento_id", acompanhamentoId);

  if (erroPendencias) {
    return { sucesso: false, erro: `Erro ao excluir pendências: ${erroPendencias.message}` };
  }

  // 3) Exclui evoluções ligadas a este acompanhamento
  const { error: erroEvolucoes } = await supabase
    .from("evolucoes")
    .delete()
    .eq("acompanhamento_id", acompanhamentoId);

  if (erroEvolucoes) {
    return { sucesso: false, erro: `Erro ao excluir evoluções: ${erroEvolucoes.message}` };
  }

  // 4) Exclui o acompanhamento em si
  const { error: erroAcompanhamento } = await supabase
    .from("acompanhamentos_nefro")
    .delete()
    .eq("id", acompanhamentoId);

  if (erroAcompanhamento) {
    return { sucesso: false, erro: `Erro ao excluir acompanhamento: ${erroAcompanhamento.message}` };
  }

  // 5) Exclui a internação associada
  const { error: erroInternacao } = await supabase
    .from("internacoes")
    .delete()
    .eq("id", internacaoId);

  if (erroInternacao) {
    return { sucesso: false, erro: `Erro ao excluir internação: ${erroInternacao.message}` };
  }

  // 6) Só exclui o paciente se ele não tiver NENHUM outro acompanhamento
  //    (de outras internações) — preserva histórico legítimo.
  const { count: outrosAcompanhamentos, error: erroCheck } = await supabase
    .from("acompanhamentos_nefro")
    .select("id", { count: "exact", head: true })
    .eq("paciente_id", pacienteId);

  if (erroCheck) {
    return { sucesso: false, erro: `Erro ao verificar histórico do paciente: ${erroCheck.message}` };
  }

  let pacienteExcluido = false;
  if (!outrosAcompanhamentos || outrosAcompanhamentos === 0) {
    const { error: erroPaciente } = await supabase
      .from("pacientes")
      .delete()
      .eq("id", pacienteId);

    if (erroPaciente) {
      return { sucesso: false, erro: `Erro ao excluir paciente: ${erroPaciente.message}` };
    }
    pacienteExcluido = true;
  }

  revalidatePath("/dashboard");
  return { sucesso: true, pacienteExcluido };
}