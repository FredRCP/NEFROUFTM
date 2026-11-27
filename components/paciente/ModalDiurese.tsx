"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { registrarDiurese, registrarSemDiurese } from "@/lib/actions/pacientesExtra";

function hojeLocal(): string {
  return new Date().toLocaleDateString("sv-SE");
}

interface ModalDiureseProps {
  acompanhamentoId: string;
  onClose: () => void;
  onSalvo: () => void;
  aviso?: string;
}

/** Diurese do dia: volume (mL) e horas de quantificação, ou justificativa para não anotar. */
export function ModalDiurese({ acompanhamentoId, onClose, onSalvo, aviso }: ModalDiureseProps) {
  const [modo, setModo] = useState<"medir" | "justificar">("medir");
  const [volume, setVolume] = useState("");
  const [horas, setHoras] = useState("24");
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function salvar() {
    const ml = parseFloat(volume.replace(",", "."));
    const h = parseInt(horas, 10);
    if (isNaN(ml) || ml < 0) { setErro("Informe o volume em mL."); return; }
    if (isNaN(h) || h < 1 || h > 24) { setErro("Informe o número de horas (de 1 a 24)."); return; }
    startTransition(async () => {
      const r = await registrarDiurese(acompanhamentoId, hojeLocal(), Math.round(ml), h);
      if (!r.sucesso) { setErro("Não foi possível salvar a diurese."); return; }
      onSalvo();
      onClose();
    });
  }

  function salvarSemDiurese() {
    if (justificativa.trim().length < 5) { setErro("Escreva a justificativa."); return; }
    startTransition(async () => {
      const r = await registrarSemDiurese(acompanhamentoId, hojeLocal(), justificativa);
      if (!r.sucesso) { setErro(r.erro ?? "Não foi possível salvar."); return; }
      onSalvo();
      onClose();
    });
  }

  const rotuloCampo = { fontSize: 11, fontWeight: 700, color: "var(--text2)", margin: "0 0 4px" } as const;
  const botaoTexto = { fontSize: 13, color: "var(--text3)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" } as const;

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: "var(--nc-radius-lg)", padding: 20, width: "100%", maxWidth: 360, boxShadow: "var(--nc-shadow-md)" }}
      >
        {modo === "medir" ? (
          <>
            <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", margin: 0 }}>💧 Preencher diurese</p>
            <p style={{ fontSize: 12, color: "var(--text3)", margin: "4px 0 14px" }}>
              Informe o volume total e o tempo em que foi quantificado.
            </p>
            {aviso && (
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--amber)", margin: "0 0 12px" }}>{aviso}</p>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <p style={rotuloCampo}>Volume (mL)</p>
                <input type="number" inputMode="numeric" min="0" autoFocus value={volume}
                  onChange={(e) => setVolume(e.target.value)} placeholder="ex.: 1200" className="nc-input" />
              </div>
              <div style={{ width: 110 }}>
                <p style={rotuloCampo}>Horas</p>
                <input type="number" inputMode="numeric" min="1" max="24" value={horas}
                  onChange={(e) => setHoras(e.target.value)} placeholder="ex.: 24" className="nc-input" />
              </div>
            </div>

            {erro && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>{erro}</p>}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
              <button onClick={onClose} style={botaoTexto}>Cancelar</button>
              <button onClick={salvar} disabled={isPending} className="nc-btn nc-btn-primary">
                {isPending ? "Salvando..." : "Salvar diurese"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => { setModo("justificar"); setErro(null); }}
              style={{ ...botaoTexto, display: "block", margin: "14px auto 0", color: "var(--accent)", fontWeight: 700, fontSize: 12 }}
            >
              Não vou anotar a diurese hoje
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", margin: 0 }}>Diurese não anotada</p>
            <p style={{ fontSize: 12, color: "var(--text3)", margin: "4px 0 14px" }}>
              Explique o motivo. Essa justificativa fica registrada no dia de hoje.
            </p>

            <p style={rotuloCampo}>Justificativa</p>
            <textarea
              autoFocus
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="ex.: paciente em diálise sem diurese residual"
              rows={3}
              className="nc-input"
              style={{ height: "auto", minHeight: 80, padding: "10px 12px", lineHeight: 1.4 }}
            />

            {erro && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>{erro}</p>}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
              <button onClick={() => { setModo("medir"); setErro(null); }} style={botaoTexto}>Voltar</button>
              <button onClick={salvarSemDiurese} disabled={isPending} className="nc-btn nc-btn-primary">
                {isPending ? "Salvando..." : "Confirmar sem diurese"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
