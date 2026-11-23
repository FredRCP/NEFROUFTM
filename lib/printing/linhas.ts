import type { LinhasPrescricao } from "./tipos";

/** Valor vazio vira null. */
export function vazioParaNulo(v?: string | null): string | null {
  return v && v.trim() ? v.trim() : null;
}

/** Toda linha da prescrição aparece; quem não foi informado mostra "—". */
export function campo(label: string, valor?: string | null, destaque?: boolean): LinhasPrescricao {
  const limpo = vazioParaNulo(valor) ?? "—";
  return destaque ? { label, valor: limpo, destaque } : { label, valor: limpo };
}
