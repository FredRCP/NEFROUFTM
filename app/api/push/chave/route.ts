import { NextResponse } from "next/server";

// Entrega a chave pública VAPID ao navegador (ela não é segredo).
// Assim não precisamos de variável com prefixo NEXT_PUBLIC_.
export const dynamic = "force-dynamic";

export function GET() {
  const chave = process.env.VAPID_PUBLIC_KEY ?? "";
  if (!chave) return NextResponse.json({ chave: null }, { status: 500 });
  return NextResponse.json({ chave });
}
