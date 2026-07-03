import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { FichaPaciente } from "@/components/paciente/FichaPaciente";
import { ExcluirCadastroButton } from "@/components/paciente/ExcluirCadastroButton";

export default async function DetalhePacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: medico } = await supabase
    .from("medicos")
    .select("nome, titulo")
    .eq("id", user.id)
    .maybeSingle();

  const { data: acompanhamento } = await supabase
    .from("acompanhamentos_nefro")
    .select(`*, paciente:pacientes(*), internacao:internacoes(*)`)
    .eq("id", id)
    .maybeSingle();

  if (!acompanhamento) {
    notFound();
  }

  // Evoluções com nome do autor (join), mais recente primeiro —
  // múltiplas por dia permitidas (Seção 4.4).
  const { data: evolucoes } = await supabase
    .from("evolucoes")
    .select(`*, autor:medicos(*)`)
    .eq("acompanhamento_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <AppHeader nomeMedico={medico?.nome ?? user.email ?? "Usuário"} titulo={medico?.titulo} />

      <div className="px-3 pt-4 sm:px-6" style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-2">
          <Link href="/dashboard" className="shrink-0 text-sm transition hover:opacity-70" style={{ color: "var(--text3)" }}>
            ← Voltar
          </Link>
          <ExcluirCadastroButton
            acompanhamentoId={acompanhamento.id}
            nomePaciente={acompanhamento.paciente.nome}
          />
        </div>

        <h1 className="mt-3 text-xl font-extrabold" style={{ color: "var(--text)" }}>
          {acompanhamento.paciente.nome}
        </h1>
        <p className="pb-4 text-sm" style={{ color: "var(--text3)" }}>
          RG {acompanhamento.paciente.rg_hospitalar} · {acompanhamento.internacao.setor.replace(/_/g, " ")}
          {!acompanhamento.ativo && " · Acompanhamento encerrado"}
        </p>
      </div>

      <div style={{ background: "var(--card)" }}>
        <FichaPaciente
          acompanhamento={acompanhamento}
          paciente={acompanhamento.paciente}
          internacao={acompanhamento.internacao}
          evolucoes={evolucoes || []}
          usuarioId={user.id}
        />
      </div>
    </div>
  );
}