"use server";

import { createClient } from "@/lib/supabase/server";

type Inscricao = { endpoint: string; keys: { p256dh: string; auth: string } };

// Guarda o aparelho do médico para receber o aviso das 16h30
export async function salvarInscricaoPush(inscricao: Inscricao): Promise<{ sucesso: boolean; erro?: string }> {
  if (!inscricao.endpoint || !inscricao.keys.p256dh || !inscricao.keys.auth) {
    return { sucesso: false, erro: "Inscrição incompleta." };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { sucesso: false, erro: "Sessão expirada. Entre novamente." };

  const { error } = await supabase.from("push_inscricoes").upsert(
    {
      medico_id: user.id,
      endpoint: inscricao.endpoint,
      p256dh: inscricao.keys.p256dh,
      auth: inscricao.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) return { sucesso: false, erro: error.message };
  return { sucesso: true };
}
