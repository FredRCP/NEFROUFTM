"use client";

import { useEffect, useState } from "react";
import { salvarInscricaoPush } from "@/lib/actions/push";

type Estado = "verificando" | "indisponivel" | "inativo" | "ativo" | "bloqueado";

// Converte a chave pública VAPID (base64url) para o formato esperado pelo navegador
function chaveParaUint8(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const texto = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(texto.length));
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i);
  return bytes;
}

export function AtivarAvisosCelular() {
  const [estado, setEstado] = useState<Estado>("verificando");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function verificar() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelado) setEstado("indisponivel");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelado) setEstado("bloqueado");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (!cancelado) setEstado(sub ? "ativo" : "inativo");
    }
    verificar();
    return () => { cancelado = true; };
  }, []);

  async function ativar() {
    setOcupado(true);
    setErro(null);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "bloqueado" : "inativo");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const resposta = await fetch("/api/push/chave");
      const { chave } = (await resposta.json()) as { chave: string | null };
      if (!chave) throw new Error("Chave de notificação não configurada.");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveParaUint8(chave),
      });
      const json = sub.toJSON();
      const r = await salvarInscricaoPush({
        endpoint: json.endpoint ?? "",
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      });
      if (!r.sucesso) {
        setErro(r.erro ?? "Não foi possível salvar a inscrição.");
        return;
      }
      setEstado("ativo");
    } catch {
      setErro("Não foi possível ativar os avisos neste aparelho.");
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "verificando" || estado === "indisponivel") return null;

  if (estado === "ativo") {
    return (
      <p className="mb-4 text-xs font-semibold" style={{ color: "var(--green)" }}>
        🔔 Avisos no celular ativados (16h30)
      </p>
    );
  }

  if (estado === "bloqueado") {
    return (
      <p className="mb-4 text-xs" style={{ color: "var(--text3)" }}>
        Notificações bloqueadas neste aparelho. Libere-as nas configurações do navegador para receber o aviso das 16h30.
      </p>
    );
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={ativar}
        disabled={ocupado}
        className="nc-btn text-xs"
        style={{ padding: "6px 12px" }}
      >
        {ocupado ? "Ativando..." : "🔔 Ativar avisos no celular (16h30)"}
      </button>
      {erro && <p className="mt-2 text-xs" style={{ color: "var(--red)" }}>{erro}</p>}
    </div>
  );
}
