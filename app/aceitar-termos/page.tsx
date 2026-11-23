"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { aceitarTermo } from "@/lib/actions/termos";

export default function AceitarTermosPage() {
  const router = useRouter();
  const [marcado, setMarcado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function aceitar() {
    setErro(null);
    startTransition(async () => {
      const r = await aceitarTermo();
      if (!r.sucesso) {
        setErro(r.erro ?? "Não foi possível registrar o aceite.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  }

  async function recusar() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4" style={{ background: "var(--bg)" }}>
      <div className="nc-card w-full max-w-lg p-6" style={{ borderRadius: "var(--nc-radius-lg)" }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>NEFRO-UFTM</p>
        <h1 className="mt-1 text-xl font-extrabold" style={{ color: "var(--text)" }}>Antes de começar</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
          O NEFRO-UFTM trata dados pessoais e de saúde de pacientes. Para usar o sistema, é preciso
          ler e aceitar o Termo de Uso e a Política de Privacidade.
        </p>

        <div className="mt-4 flex flex-col gap-2 text-sm">
          <Link href="/termos" target="_blank" className="font-semibold" style={{ color: "var(--accent)" }}>
            📄 Ler o Termo de Uso
          </Link>
          <Link href="/privacidade" target="_blank" className="font-semibold" style={{ color: "var(--accent)" }}>
            🔒 Ler a Política de Privacidade
          </Link>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-(--nc-radius) p-3 text-sm"
          style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--text)" }}>
          <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Li e aceito o Termo de Uso e a Política de Privacidade do NEFRO-UFTM.</span>
        </label>

        {erro && <p className="mt-3 text-sm font-semibold" style={{ color: "var(--red)" }}>{erro}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button onClick={recusar} className="text-sm font-semibold" style={{ color: "var(--text3)", background: "none", border: "none", cursor: "pointer" }}>
            Não aceito (sair)
          </button>
          <button onClick={aceitar} disabled={!marcado || isPending} className="nc-btn nc-btn-primary disabled:opacity-40">
            {isPending ? "Registrando..." : "Aceitar e continuar"}
          </button>
        </div>
      </div>
    </main>
  );
}
