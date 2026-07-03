"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setErro("E-mail ou senha incorretos.");
      setCarregando(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="nc-card w-full max-w-sm p-8">
        <h1 className="text-xl font-extrabold tracking-tight" style={{ color: "var(--text)" }}>
          NEFRO<span style={{ color: "var(--text3)", fontWeight: 500 }}>-UFTM</span>
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text3)" }}>
          Acompanhamento nefrológico — equipe HC-UFTM
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="nc-label">E-mail</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="nc-input"
              placeholder="seu.nome@hc-uftm.gov.br"
            />
          </div>

          <div>
            <label htmlFor="senha" className="nc-label">Senha</label>
            <input
              id="senha"
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="nc-input"
              placeholder="••••••••"
            />
          </div>

          {erro && (
            <p className="text-sm" style={{ color: "var(--red)" }} role="alert">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="nc-btn nc-btn-primary w-full"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: "var(--text3)" }}>
          Acesso restrito à equipe de nefrologia do HC-UFTM.
        </p>
      </div>
    </div>
  );
}
