"use server";

import { createClient } from "@/lib/supabase/server";
import { TERMO_VERSAO } from "@/lib/termos";

/** Registra o aceite do termo vigente para o usuário logado (via função segura no banco). */
export async function aceitarTermo(): Promise<{ sucesso: boolean; erro?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { sucesso: false, erro: "Sessão expirada. Entre novamente." };

  const { error } = await supabase.rpc("aceitar_termo", { p_versao: TERMO_VERSAO });
  if (error) return { sucesso: false, erro: error.message };
  return { sucesso: true };
}

/** true se não há login (nada a aceitar) ou se o usuário já aceitou a versão vigente. */
export async function termoAceitoPelaVersao(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return true;

  const { data } = await supabase
    .from("medicos")
    .select("termo_versao")
    .eq("id", user.id)
    .maybeSingle();
  return (data as { termo_versao?: string | null } | null)?.termo_versao === TERMO_VERSAO;
}
