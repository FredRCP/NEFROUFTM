'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { aceitarTermo, termoAceitoPelaVersao } from '@/lib/actions/termos';

// Páginas onde o aviso não aparece, para dar para ler os textos.
const PAGINAS_LIVRES = ['/termos', '/privacidade'];

/**
 * Aviso obrigatório "Antes de começar": cobre o app até o profissional aceitar
 * o Termo de Uso e a Política de Privacidade da versão vigente.
 */
export default function AvisoTermos() {
  const pathname = usePathname() ?? '';
  const [pendente, setPendente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const livre = PAGINAS_LIVRES.some((r) => pathname === r || pathname.startsWith(r + '/'));

  // Verifica a cada troca de página: depois do login, o aviso aparece na primeira tela do app.
  useEffect(() => {
    let ativo = true;
    (async () => {
      const aceito = await termoAceitoPelaVersao();
      if (ativo) setPendente(!aceito);
    })();
    return () => { ativo = false; };
  }, [pathname]);

  useEffect(() => {
    if (pendente && !livre) botao.current?.focus();
  }, [pendente, livre]);

  if (!pendente || livre) return null;

  async function aceitar() {
    setEnviando(true);
    setErro(null);
    const r = await aceitarTermo();
    if (r.sucesso) {
      setPendente(false);
    } else {
      setErro(r.erro ?? 'Não foi possível registrar o aceite.');
      setEnviando(false);
    }
  }

  return (
    <div
      data-testid="aviso-termos"
      className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-termos"
        className="w-full max-w-md rounded-2xl p-5 shadow-xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <h2 id="titulo-termos" className="mb-2 text-center text-xl font-bold" style={{ color: '#1e3a5f' }}>
          Antes de começar
        </h2>
        <p className="text-sm leading-relaxed">
          O NEFRO-UFTM é uma ferramenta de apoio ao acompanhamento nefrológico, de uso restrito à equipe do Hospital de Clínicas da UFTM.
          Não substitui o prontuário nem o julgamento clínico. Para continuar, leia e aceite os{' '}
          <Link href="/termos" target="_blank" className="font-semibold underline">Termos de Uso</Link> e a{' '}
          <Link href="/privacidade" target="_blank" className="font-semibold underline">Política de Privacidade</Link>.
        </p>

        {erro && <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--red)' }}>{erro}</p>}

        <button
          ref={botao}
          type="button"
          onClick={aceitar}
          disabled={enviando}
          className="mt-4 w-full rounded-xl px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
          style={{ background: '#1e3a5f' }}
        >
          {enviando ? 'Registrando...' : 'Li e aceito'}
        </button>
      </div>
    </div>
  );
}
