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
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{
        background:
          "radial-gradient(circle at 18% 12%, #2f6bb3 0%, transparent 42%), linear-gradient(160deg, #142c4a 0%, #1e3a5f 45%, #2563a8 100%)",
      }}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white px-7 pb-6 pt-8"
        style={{ boxShadow: "0 25px 60px rgba(10,25,50,0.45)" }}
      >
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-nefrouftm.png"
            alt="Logo NEFRO-UFTM"
            width={96}
            height={96}
            className="h-24 w-24 rounded-2xl"
          />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight" style={{ color: "#1e3a5f" }}>
            NEFRO<span className="font-medium" style={{ color: "#5b7ba3" }}>-UFTM</span>
          </h1>
          <p className="mt-1 text-xs" style={{ color: "#5b7ba3" }}>
            Acompanhamento nefrológico · HC-UFTM
          </p>
        </div>

        <form onSubmit={handleLogin} className="mt-7 space-y-4">
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

          <button
            type="submit"
            disabled={carregando}
            className="nc-btn nc-btn-primary nc-field-btn w-full"
          >
            {carregando ? "Entrando..." : "Entrar no sistema"}
          </button>

          <button
            type="button"
            onClick={esqueciSenha}
            className="block w-full text-center text-xs font-semibold"
            style={{ color: "#2563a8", background: "none", border: "none", cursor: "pointer" }}
          >
            Esqueci minha senha
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] leading-relaxed" style={{ color: "#7a8ca5" }}>
          Acesso liberado pela coordenação da nefrologia, restrito à equipe do HC-UFTM.
        </p>
      </div>
    </div>
  );
}
