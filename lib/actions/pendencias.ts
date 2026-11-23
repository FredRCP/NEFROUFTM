"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Pendencia } from "@/types/database";

type Resultado = { sucesso: boolean; dados?: Pendencia; erro?: string };

export async function adicionarPendencia(acompanhamentoId: string, descricao: string): Promise<Resultado> {
  const texto = descricao.trim();
  if (!texto) return { sucesso: false, erro: "Descrição vazia." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pendencias")
    .insert({ acompanhamento_id: acompanhamentoId, descricao: texto })
    .select()
    .single();
  if (error) return { sucesso: false, erro: error.message };
  revalidatePath("/dashboard");
  return { sucesso: true, dados: data as Pendencia };
}

export async function editarPendencia(id: string, descricao: string): Promise<Resultado> {
  const texto = descricao.trim();
  if (!texto) return { sucesso: false, erro: "Descrição vazia." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pendencias")
    .update({ descricao: texto })
    .eq("id", id)
    .select()
    .single();
  if (error) return { sucesso: false, erro: error.message };
  revalidatePath("/dashboard");
  return { sucesso: true, dados: data as Pendencia };
}

export async function excluirPendencia(id: string): Promise<{ sucesso: boolean; erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("pendencias").delete().eq("id", id);
  if (error) return { sucesso: false, erro: error.message };
  revalidatePath("/dashboard");
  return { sucesso: true };
}
