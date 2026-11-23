import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { FichaPaciente } from "@/components/paciente/FichaPaciente";
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

      {/* Barra única: marca à esquerda, paciente no centro, perfil à direita */}
      <AppHeader
        nomeMedico={medico?.nome ?? user.email ?? "Usuário"}
        titulo={medico?.titulo}
        centro={
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "white", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
              {(paciente?.nome ?? acompanhamento.paciente.nome).toUpperCase()}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "var(--mono)" }}>
              RG {paciente?.rg_hospitalar ?? acompanhamento.paciente.rg_hospitalar}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>🛏️ {leito}</span>
            {!acompanhamento.ativo && (
              <span style={{ fontSize: 11, fontWeight: 700, background: "var(--red)", color: "white", padding: "2px 8px", borderRadius: 999 }}>
                Encerrado
              </span>
            )}
          </div>
        }
      />

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