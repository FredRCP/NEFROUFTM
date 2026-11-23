"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { adicionarPendencia, editarPendencia, excluirPendencia } from "@/lib/actions/pendencias";
import type { Pendencia } from "@/types/database";

interface PendenciasModalProps {
  acompanhamentoId: string;
  nomePaciente: string;
  pendencias: Pendencia[];
  onClose: () => void;
}

export function PendenciasModal({ acompanhamentoId, nomePaciente, pendencias, onClose }: PendenciasModalProps) {
  const [lista, setLista] = useState<Pendencia[]>(pendencias);
  const [novaDescricao, setNovaDescricao] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdicao, setTextoEdicao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function adicionar() {
    const texto = novaDescricao.trim();
    if (!texto) return;
    startTransition(async () => {
      const r = await adicionarPendencia(acompanhamentoId, texto);
      if (!r.sucesso || !r.dados) { setErro(r.erro ?? "Não foi possível adicionar."); return; }
      const novo = r.dados;
      setLista((l) => [...l, novo]);
      setNovaDescricao("");
      setErro(null);
    });
  }

  function salvarEdicao() {
    const id = editandoId;
    const texto = textoEdicao.trim();
    if (!id || !texto) return;
    startTransition(async () => {
      const r = await editarPendencia(id, texto);
      if (!r.sucesso || !r.dados) { setErro(r.erro ?? "Não foi possível salvar."); return; }
      const atualizado = r.dados;
      setLista((l) => l.map((x) => (x.id === id ? atualizado : x)));
      setEditandoId(null);
      setErro(null);
    });
  }

  function excluir(id: string) {
    if (!window.confirm("Excluir esta pendência?")) return;
    startTransition(async () => {
      const r = await excluirPendencia(id);
      if (!r.sucesso) { setErro(r.erro ?? "Não foi possível excluir."); return; }
      setLista((l) => l.filter((x) => x.id !== id));
      setEditandoId(null);
      setErro(null);
    });
  }

  return createPortal(
    <div
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        className="nc-card"
        style={{ width: "min(440px, 100%)", padding: 16, boxShadow: "var(--nc-shadow-md)" }}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-bold" style={{ color: "var(--text)" }}>Pendências — {nomePaciente}</p>
          <button onClick={onClose} aria-label="Fechar"
            className="text-lg leading-none" style={{ color: "var(--text3)", background: "none", border: "none", cursor: "pointer" }}>
            ×
          </button>
        </div>

        {lista.length === 0 ? (
          <p className="mb-3 text-sm" style={{ color: "var(--text3)" }}>Nenhuma pendência registrada.</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-1.5">
            {lista.map((p) =>
              editandoId === p.id ? (
                <li key={p.id} className="flex flex-col gap-1.5 rounded-md p-2" style={{ background: "#fef3c7" }}>
                  <input
                    autoFocus
                    value={textoEdicao}
                    onChange={(e) => setTextoEdicao(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") salvarEdicao();
                      if (e.key === "Escape") setEditandoId(null);
                    }}
                    className="nc-input"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button onClick={salvarEdicao} disabled={isPending} className="nc-btn nc-btn-primary" style={{ padding: "4px 12px", fontSize: 12 }}>
                      Salvar
                    </button>
                    <button onClick={() => setEditandoId(null)} className="nc-btn" style={{ padding: "4px 12px", fontSize: 12 }}>
                      Cancelar
                    </button>
                    <button onClick={() => excluir(p.id)} disabled={isPending} className="nc-btn ml-auto"
                      style={{ padding: "4px 12px", fontSize: 12, color: "var(--red)" }}>
                      Excluir
                    </button>
                  </div>
                </li>
              ) : (
                <li key={p.id} className="flex items-center gap-2 rounded-full px-3 py-1.5"
                  style={{ background: "#fef3c7", border: "1px solid #f5c26b", color: "#92400e" }}>
                  <button
                    onClick={() => { setEditandoId(p.id); setTextoEdicao(p.descricao); setErro(null); }}
                    title="Clique para editar"
                    className="min-w-0 flex-1 truncate text-left text-sm font-semibold"
                    style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
                  >
                    ⚠ {p.descricao}
                  </button>
                  <button onClick={() => excluir(p.id)} disabled={isPending} aria-label="Excluir pendência"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-extrabold leading-none"
                    style={{ background: "none", border: "1.5px solid #92400e", color: "#92400e", cursor: "pointer" }}>
                    ×
                  </button>
                </li>
              )
            )}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={novaDescricao}
            onChange={(e) => setNovaDescricao(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            placeholder="Nova pendência (ex: cateter)"
            className="nc-input flex-1"
          />
          <button onClick={adicionar} disabled={isPending || !novaDescricao.trim()} className="nc-btn nc-btn-primary shrink-0">
            + Adicionar
          </button>
        </div>

        {erro && <p className="mt-2 text-xs font-semibold" style={{ color: "var(--red)" }}>{erro}</p>}
      </div>
    </div>,
    document.body
  );
}
