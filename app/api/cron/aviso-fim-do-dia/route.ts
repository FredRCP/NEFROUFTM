import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Chamada pelo Vercel Cron (ver vercel.json) às 16h30 de Brasília (19:30 UTC).
// Envia um único aviso para cada aparelho inscrito, se houver pacientes não avaliados ou pendências.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: ativos, error: erroAtivos } = await sb
    .from("acompanhamentos_nefro")
    .select("id, avaliado_hoje")
    .eq("ativo", true);
  if (erroAtivos) return new NextResponse(erroAtivos.message, { status: 500 });

  const idsAtivos = new Set((ativos ?? []).map((a) => a.id));
  const naoAvaliados = (ativos ?? []).filter((a) => !a.avaliado_hoje).length;

  const { data: pendencias, error: erroPend } = await sb
    .from("pendencias")
    .select("acompanhamento_id");
  if (erroPend) return new NextResponse(erroPend.message, { status: 500 });

  const comPendencia = new Set(
    (pendencias ?? []).map((p) => p.acompanhamento_id).filter((id) => idsAtivos.has(id))
  ).size;

  if (naoAvaliados === 0 && comPendencia === 0) {
    return NextResponse.json({ enviados: 0, motivo: "nada a avisar" });
  }

  const partes: string[] = [];
  if (naoAvaliados > 0) partes.push(`${naoAvaliados} paciente(s) sem avaliação`);
  if (comPendencia > 0) partes.push(`${comPendencia} com pendência(s)`);
  const payload = JSON.stringify({
    title: "NEFRO-UFTM · fim do dia",
    body: partes.join(" e ") + ".",
    url: "/dashboard",
  });

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const { data: inscricoes, error: erroInsc } = await sb
    .from("push_inscricoes")
    .select("id, endpoint, p256dh, auth");
  if (erroInsc) return new NextResponse(erroInsc.message, { status: 500 });

  let enviados = 0;
  const expiradas: string[] = [];

  await Promise.all(
    (inscricoes ?? []).map(async (i) => {
      try {
        await webpush.sendNotification(
          { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
          payload
        );
        enviados++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410: o aparelho cancelou a inscrição; remove para não tentar de novo
        if (status === 404 || status === 410) expiradas.push(i.id);
      }
    })
  );

  if (expiradas.length > 0) {
    await sb.from("push_inscricoes").delete().in("id", expiradas);
  }

  return NextResponse.json({ enviados, removidas: expiradas.length });
}
