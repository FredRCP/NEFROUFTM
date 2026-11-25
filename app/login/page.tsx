"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Aba = "entrar" | "criar";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [aba, setAba] = useState<Aba>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
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

  async function esqueciSenha() {
    setErro(null);
    setAviso(null);
    if (!email.trim()) {
      setErro("Digite seu e-mail acima para receber o link de redefinição.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) {
      setErro("Não foi possível enviar o link agora. Tente novamente em instantes.");
      return;
    }
    setAviso("Se o e-mail estiver cadastrado, você receberá o link para criar uma nova senha.");
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(160deg, #1e3a5f 0%, #1e4f88 55%, #2563a8 100%)" }}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: "var(--card)" }}
      >
        {/* Cabeçalho */}
        <div className="px-6 pb-6 pt-7 text-center" style={{ background: "#1e3a5f" }}>
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}
            aria-hidden="true"
          >
            🫘
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">
            NEFRO<span className="font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>-UFTM</span>
          </h1>
          <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
            Acompanhamento nefrológico · HC-UFTM
          </p>
        </div>

        <div className="px-6 pb-6 pt-5">
          {/* Abas Entrar / Criar conta */}
          <div className="mb-5 flex rounded-xl p-1" style={{ background: "var(--bg2)" }}>
            {(["entrar", "criar"] as Aba[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => { setAba(k); setErro(null); setAviso(null); }}
                className="flex-1 rounded-lg py-2 text-sm font-semibold transition"
                style={{
                  background: aba === k ? "var(--card)" : "transparent",
                  color: aba === k ? "var(--accent)" : "var(--text3)",
                  boxShadow: aba === k ? "var(--nc-shadow-sm)" : "none",
                }}
              >
                {k === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          {aba === "entrar" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="nc-label">E-mail</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="nc-input nc-field"
                  placeholder="seu.nome@hc-uftm.gov.br"
                />
              </div>

              <div>
                <label htmlFor="senha" className="nc-label">Senha</label>
                <input
                  id="senha"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="nc-input nc-field"
                  placeholder="••••••••"
                />
              </div>

              {erro && (
                <p className="text-sm" style={{ color: "var(--red)" }} role="alert">{erro}</p>
              )}
              {aviso && (
                <p className="text-sm" style={{ color: "var(--green)" }} role="status">{aviso}</p>
              )}

              <button type="submit" disabled={carregando} className="nc-btn nc-btn-primary nc-field-btn w-full">
                {carregando ? "Entrando..." : "Entrar no sistema"}
              </button>

              <button
                type="button"
                onClick={esqueciSenha}
                className="block w-full text-center text-xs font-semibold"
                style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
              >
                Esqueci minha senha
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-sm" style={{ color: "var(--text2)" }}>
              <p className="leading-relaxed">
                O acesso ao NEFRO-UFTM é liberado pela coordenação da nefrologia, para manter o uso restrito à equipe do HC-UFTM.
              </p>
              <p className="leading-relaxed">
                Peça à coordenação para cadastrar seu e-mail institucional. Depois disso, use a aba <strong>Entrar</strong>.
              </p>
              <button
                type="button"
                onClick={() => setAba("entrar")}
                className="nc-btn nc-btn-primary nc-field-btn w-full"
              >
                Voltar para Entrar
              </button>
            </div>
          )}
        </div>

        <p className="pb-5 text-center text-[11px]" style={{ color: "var(--text3)" }}>
          Acesso restrito à equipe de nefrologia do HC-UFTM
        </p>
      </div>
    </div>
  );
}
