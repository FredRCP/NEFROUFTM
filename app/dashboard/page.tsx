import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DashboardClient } from "@/components/DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Busca o registro em public.medicos vinculado a este usuário.
  // Se não existir, o RLS já bloquearia o acesso a qualquer dado,
  // mas aqui sinalizamos isso de forma explícita na UI.
  const { data: medico } = await supabase
    .from("medicos")
    .select("nome, titulo, ativo")
    .eq("id", user.id)
    .maybeSingle();

  if (!medico || !medico.ativo) {
    return (
      <div className="flex min-h-screen flex-col" style={{ background: "var(--bg)" }}>
        <AppHeader nomeMedico={user.email ?? "Usuário"} />
        <div className="flex flex-1 items-center justify-center px-4">
          <div
            className="max-w-md rounded-(--nc-radius-lg) p-6 text-center"
            style={{ background: "var(--amber-dim)", border: "1px solid rgba(154,74,10,0.25)" }}
          >
            <h2 className="font-bold" style={{ color: "var(--amber)" }}>Acesso pendente</h2>
            <p className="mt-2 text-sm" style={{ color: "var(--amber)" }}>
              Seu login foi criado, mas você ainda não está cadastrado como
              médico ativo na equipe de nefrologia. Peça para um administrador
              te incluir na tabela <code className="rounded px-1" style={{ background: "rgba(154,74,10,0.12)" }}>medicos</code>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <AppHeader nomeMedico={medico.nome} titulo={medico.titulo} />
      <DashboardClient />
    </div>
  );
}