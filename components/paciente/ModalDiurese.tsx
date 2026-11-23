"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { registrarDiurese } from "@/lib/actions/pacientesExtra";

function hojeLocal(): string {
  return new Date().toLocaleDateString("sv-SE");
}

interface ModalDiureseProps {
  acompanhamentoId: string;
  onClose: () => void;
  onSalvo: () => void;
}

/** Diurese do dia: volume (mL) e número de horas em que foi quantificada. */
export function ModalDiurese({ acompanhamentoId, onClose, onSalvo }: ModalDiureseProps) {
  const [volume, setVolume] = useState("");
  const [horas, setHoras] = useState("24");
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

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: "var(--nc-radius-lg)", padding: 20, width: "100%", maxWidth: 360, boxShadow: "var(--nc-shadow-md)" }}
      >
        <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", margin: 0 }}>💧 Preencher diurese</p>
        <p style={{ fontSize: 12, color: "var(--text3)", margin: "4px 0 14px" }}>
          Informe o volume total e o tempo em que foi quantificado.
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", margin: "0 0 4px" }}>Volume (mL)</p>
            <input type="number" inputMode="numeric" min="0" autoFocus value={volume}
              onChange={(e) => setVolume(e.target.value)} placeholder="ex.: 1200" className="nc-input" />
          </div>
          <div style={{ width: 110 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", margin: "0 0 4px" }}>Horas</p>
            <input type="number" inputMode="numeric" min="1" max="24" value={horas}
              onChange={(e) => setHoras(e.target.value)} placeholder="ex.: 24" className="nc-input" />
          </div>
        </div>

        {erro && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>{erro}</p>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
          <button onClick={onClose}
            style={{ fontSize: 13, color: "var(--text3)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={isPending} className="nc-btn nc-btn-primary">
            {isPending ? "Salvando..." : "Salvar diurese"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
