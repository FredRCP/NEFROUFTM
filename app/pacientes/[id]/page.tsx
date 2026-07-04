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

  if (!user) redirect("/login");

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

  if (!acompanhamento) notFound();

  const { data: evolucoes } = await supabase
    .from("evolucoes")
    .select(`*, autor:medicos(*)`)
    .eq("acompanhamento_id", id)
    .order("created_at", { ascending: false });

  const leito = acompanhamento.internacao.enfermaria_leito
    ? `${acompanhamento.internacao.setor.replace(/_/g, " ")} · leito ${acompanhamento.internacao.enfermaria_leito}`
    : acompanhamento.internacao.setor.replace(/_/g, " ");

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <AppHeader nomeMedico={medico?.nome ?? user.email ?? "Usuário"} titulo={medico?.titulo} />

      {/* Cabeçalho compacto — tudo em uma linha */}
      <div
        style={{
          background: "var(--card)",
          borderBottom: "1px solid var(--border)",
          padding: "0 16px",
          height: 52,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Seta de voltar — gorda e bonita */}
        <Link
          href="/dashboard"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
            background: "var(--accent-dim)", color: "var(--accent)",
            textDecoration: "none", fontSize: 18, fontWeight: 900,
            transition: "background 0.15s, transform 0.15s",
          }}
          title="Voltar ao dashboard"
          onMouseEnter={undefined}
        >
          ←
        </Link>

        {/* Nome */}
        <span
          style={{
            fontSize: 16, fontWeight: 800, color: "var(--text)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            flex: "1 1 auto", minWidth: 0,
          }}
        >
          {acompanhamento.paciente.nome}
        </span>

        {/* RG */}
        <span
          style={{
            fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)",
            whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          RG {acompanhamento.paciente.rg_hospitalar}
        </span>

        {/* Separador */}
        <span style={{ color: "var(--border2)", fontSize: 16, flexShrink: 0 }}>·</span>

        {/* Setor/leito */}
        <span
          style={{
            fontSize: 12, color: "var(--text2)", fontWeight: 600,
            whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          🛏️ {leito}
        </span>

        {!acompanhamento.ativo && (
          <>
            <span style={{ color: "var(--border2)", fontSize: 16, flexShrink: 0 }}>·</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", flexShrink: 0 }}>
              Encerrado
            </span>
          </>
        )}

        {/* Botão excluir — empurrado para direita */}
        <div style={{ marginLeft: "auto", flexShrink: 0 }}>
          <ExcluirCadastroButton
            acompanhamentoId={acompanhamento.id}
            nomePaciente={acompanhamento.paciente.nome}
          />
        </div>
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