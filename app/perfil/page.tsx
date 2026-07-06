"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function PerfilPage() {
  const supabase = createClient();
  const router = useRouter();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSalvar() {
    setErro(null); setSucesso(false);
    if (!novaSenha || novaSenha.length < 6) {
      setErro("A nova senha deve ter pelo menos 6 caracteres."); return;
    }
    if (novaSenha !== confirmar) {
      setErro("As senhas não conferem."); return;
    }
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    setSucesso(true);
    setSenhaAtual(""); setNovaSenha(""); setConfirmar("");
    setTimeout(() => setSucesso(false), 4000);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Header */}
        <div style={{ background: "#1e3a5f", borderRadius: "var(--nc-radius-lg) var(--nc-radius-lg) 0 0", padding: "20px 24px" }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "white", margin: 0 }}>Meu perfil</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: "4px 0 0" }}>NEFRO-UFTM · HC-UFTM/EBSERH</p>
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 var(--nc-radius-lg) var(--nc-radius-lg)", padding: "24px" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 16px" }}>Alterar senha</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="nc-label">Nova senha</label>
              <input
                type="password" value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="nc-input"
              />
            </div>
            <div>
              <label className="nc-label">Confirmar nova senha</label>
              <input
                type="password" value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSalvar()}
                placeholder="Repita a nova senha"
                className="nc-input"
              />
            </div>
          </div>

          {erro && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--red-dim)", borderRadius: "var(--nc-radius)", border: "1px solid rgba(176,48,32,0.2)" }}>
              <p style={{ fontSize: 13, color: "var(--red)", margin: 0 }}>⚠ {erro}</p>
            </div>
          )}

          {sucesso && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--green-dim)", borderRadius: "var(--nc-radius)", border: "1px solid rgba(26,122,82,0.2)" }}>
              <p style={{ fontSize: 13, color: "var(--green)", margin: 0 }}>✓ Senha alterada com sucesso!</p>
            </div>
          )}

          <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => router.push("/dashboard")}
              className="nc-btn nc-btn-ghost cursor-pointer">
              ← Voltar
            </button>
            <button onClick={handleSalvar} disabled={salvando || !novaSenha || !confirmar}
              className="nc-btn nc-btn-primary cursor-pointer">
              {salvando ? "Salvando..." : "Salvar nova senha"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}