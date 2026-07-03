"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { excluirCadastroCompleto } from "@/lib/actions/excluirCadastro";

interface ExcluirCadastroButtonProps {
  acompanhamentoId: string;
  nomePaciente: string;
}

/**
 * Botão de exclusão DEFINITIVA — para cadastros feitos por erro, não para
 * pacientes que tiveram alta/transferência/óbito (isso é "dar baixa",
 * uma ação diferente que preserva o histórico).
 *
 * Confirmação de segurança: o usuário precisa digitar o nome exato do
 * paciente antes do botão de exclusão ficar habilitado.
 */
export function ExcluirCadastroButton({ acompanhamentoId, nomePaciente }: ExcluirCadastroButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalAberto, setModalAberto] = useState(false);
  const [textoConfirmacao, setTextoConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const nomeConfere = textoConfirmacao.trim().toLowerCase() === nomePaciente.trim().toLowerCase();

  function handleAbrirModal() {
    setTextoConfirmacao("");
    setErro(null);
    setModalAberto(true);
  }

  function handleConfirmarExclusao() {
    if (!nomeConfere) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await excluirCadastroCompleto(acompanhamentoId);
      if (!resultado.sucesso) {
        setErro(resultado.erro || "Erro ao excluir cadastro.");
        return;
      }
      setModalAberto(false);
      router.push("/dashboard");
    });
  }

  return (
    <>
      <button
        onClick={handleAbrirModal}
        className="shrink-0 rounded-(--nc-radius) px-2.5 py-2 text-xs font-bold transition hover:opacity-80 sm:px-3 sm:py-1.5"
        style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(176,48,32,0.25)" }}
        title="Excluir definitivamente este cadastro (uso apenas para erros de cadastro — para alta/transferência/óbito, use 'Dar baixa')"
      >
        <span className="sm:hidden">🗑 Excluir</span>
        <span className="hidden sm:inline">🗑 Excluir cadastro (erro)</span>
      </button>

      {modalAberto && createPortal(
        <div
          className="fixed inset-0 z-100 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) setModalAberto(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-(--nc-radius-lg) p-5"
            style={{ background: "var(--card)", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}
          >
            <p className="text-base font-extrabold" style={{ color: "var(--red)" }}>
              ⚠ Excluir cadastro definitivamente
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
              Esta ação é <strong>irreversível</strong>. Serão excluídos permanentemente:
              o acompanhamento, a internação, as evoluções, as pendências e — se este for
              o único acompanhamento do paciente — o cadastro do paciente também.
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
              Use isto apenas para <strong>cadastros feitos por engano</strong>. Para
              pacientes que tiveram alta, transferência ou óbito, use a opção
              <strong> &quot;Dar baixa&quot;</strong> em vez desta — ela preserva o histórico.
            </p>

            <label className="mt-4 block text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text3)" }}>
              Digite o nome completo do paciente para confirmar: <span style={{ color: "var(--red)" }}>{nomePaciente}</span>
            </label>
            <input
              type="text"
              autoFocus
              value={textoConfirmacao}
              onChange={(e) => setTextoConfirmacao(e.target.value)}
              className="nc-input mt-1.5"
              placeholder="Digite o nome exato do paciente"
              disabled={isPending}
            />

            {erro && (
              <div
                className="mt-3 rounded-(--nc-radius) px-3 py-2 text-sm"
                style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(176,48,32,0.2)" }}
              >
                ⚠ {erro}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setModalAberto(false)}
                disabled={isPending}
                className="nc-btn nc-btn-ghost"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarExclusao}
                disabled={!nomeConfere || isPending}
                className="nc-btn"
                style={{
                  background: nomeConfere ? "var(--red)" : "var(--border)",
                  color: nomeConfere ? "white" : "var(--text3)",
                  cursor: nomeConfere ? "pointer" : "not-allowed",
                }}
              >
                {isPending ? "Excluindo..." : "Excluir definitivamente"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}