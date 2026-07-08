import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { FichaPaciente } from "@/components/paciente/FichaPaciente";
import { ExcluirCadastroButton } from "@/components/paciente/ExcluirCadastroButton";
import { LockBodyScroll } from "@/components/LockBodyScroll";

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
    .from("medicos").select("*").eq("id", user.id).maybeSingle();

  const { data: acompanhamento } = await supabase
    .from("acompanhamentos_nefro")
    .select(`*, paciente:pacientes(*), internacao:internacoes(*)`)
    .eq("id", id).maybeSingle();

  if (!acompanhamento) notFound();

  // Busca paciente separadamente para garantir todos os campos (data_nascimento, sexo, etc.)
  const { data: paciente } = await supabase
    .from("pacientes")
    .select("*")
    .eq("id", acompanhamento.paciente_id)
    .maybeSingle();

  const { data: evolucoes } = await supabase
    .from("evolucoes").select(`*, autor:medicos(*)`)
    .eq("acompanhamento_id", id).order("created_at", { ascending: false });

  const leito = acompanhamento.internacao.enfermaria_leito
    ? `${acompanhamento.internacao.setor.replace(/_/g, " ")} · leito ${acompanhamento.internacao.enfermaria_leito}`
    : acompanhamento.internacao.setor.replace(/_/g, " ");

  return (
    // Toda a página ocupa exatamente a viewport — sem scroll global
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
      <LockBodyScroll />

      {/* AppHeader fixo */}
      <AppHeader nomeMedico={medico?.nome ?? user.email ?? "Usuário"} titulo={medico?.titulo} />

      {/* Barra de identificação do paciente — fixa */}
      <div
        style={{
          flexShrink: 0,
          background: "#1e3a5f",
          padding: "0 16px",
          height: 52,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link
          href="/dashboard"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px 6px 10px", borderRadius: 999,
            background: "rgba(255,255,255,0.12)", color: "white",
            textDecoration: "none", fontSize: 13, fontWeight: 700,
            border: "1px solid rgba(255,255,255,0.18)",
            transition: "background 0.15s", flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>←</span>
          Tela inicial
        </Link>

        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 18, flexShrink: 0 }}>/</span>

        <span style={{
          fontSize: 15, fontWeight: 800, color: "white",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          flex: "1 1 auto", minWidth: 0,
        }}>
          {paciente?.nome ?? acompanhamento.paciente.nome}
        </span>

        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "var(--mono)", whiteSpace: "nowrap", flexShrink: 0 }}>
          RG {paciente?.rg_hospitalar ?? acompanhamento.paciente.rg_hospitalar}
        </span>

        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 16, flexShrink: 0 }}>·</span>

        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
          🛏️ {leito}
        </span>

        {!acompanhamento.ativo && (
          <>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 16, flexShrink: 0 }}>·</span>
            <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0, background: "var(--red)", color: "white", padding: "2px 8px", borderRadius: 999 }}>
              Encerrado
            </span>
          </>
        )}

        <div style={{ marginLeft: "auto", flexShrink: 0 }}>
          <ExcluirCadastroButton
            acompanhamentoId={acompanhamento.id}
            nomePaciente={acompanhamento.paciente.nome}
          />
        </div>
      </div>

      {/* FichaPaciente ocupa o restante — gerencia abas e scroll internamente */}
      <div style={{ flex: 1, overflow: "hidden", background: "var(--card)" }}>
        <FichaPaciente
          acompanhamento={acompanhamento}
          paciente={paciente ?? acompanhamento.paciente}
          internacao={acompanhamento.internacao}
          evolucoes={evolucoes || []}
          usuarioId={user.id}
          medico={medico}
        />
      </div>
    </div>
  );
}