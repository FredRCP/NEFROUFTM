import Link from 'next/link';
import type { ReactNode } from 'react';
import { DATA_ATUALIZACAO } from '@/lib/termos';

export const metadata = { title: 'Termo de Uso · NEFRO-UFTM' };

const H = ({ children }: { children: ReactNode }) => (
  <h3 className="text-xl font-semibold mt-8 mb-3" style={{ color: '#1e3a5f' }}>{children}</h3>
);
const P = ({ children }: { children: ReactNode }) => (
  <p className="text-base mb-4 leading-relaxed" style={{ color: 'var(--text)' }}>{children}</p>
);

export default function TermosDeUso() {
  return (
    <div className="flex justify-center p-2" style={{ background: 'linear-gradient(to bottom, var(--bg), var(--card2))' }}>
      <div className="w-full max-w-4xl p-8 rounded-lg shadow-lg mx-auto" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <h2 className="text-2xl font-semibold mb-6 text-center" style={{ color: 'var(--text)' }}>
          Termo de Uso do NEFRO-UFTM
        </h2>
        <p className="text-sm italic mb-6 text-center" style={{ color: 'var(--text2)' }}>
          Última atualização: {DATA_ATUALIZACAO}
        </p>

        <P>
          Bem-vindo ao <strong>NEFRO-UFTM</strong>, sistema de acompanhamento nefrológico do Hospital de Clínicas da Universidade Federal do Triângulo Mineiro (HC-UFTM).
          Este documento estabelece as condições para o uso da ferramenta. Leia atentamente antes de prosseguir.
        </P>

        <H>1. Uso do NEFRO-UFTM</H>
        <P>
          - O NEFRO-UFTM é uma ferramenta de apoio ao acompanhamento de pacientes da Nefrologia do HC-UFTM: lista de pacientes, evoluções, exames, diurese e prescrições de terapia renal substitutiva.
          <br />
          - O sistema organiza informações já registradas pela equipe e não realiza diagnóstico nem prescreve tratamentos.
        </P>

        <H>2. Natureza de apoio ao cuidado</H>
        <P>
          O NEFRO-UFTM apoia o cuidado, mas não substitui o prontuário oficial, a prescrição médica assinada nem o julgamento clínico do profissional.
          As informações devem ser conferidas na fonte antes de qualquer decisão.
        </P>

        <H>3. Requisitos para uso</H>
        <P>
          - O uso é permitido apenas a profissionais de saúde da equipe de Nefrologia do HC-UFTM, autorizados pela chefia do serviço.
          <br />
          - O acesso é feito por credencial individual (e-mail e senha).
          <br />
          - Ao aceitar este termo, o profissional declara estar habilitado para o exercício da profissão.
        </P>

        <H>4. Dados de pacientes e sigilo</H>
        <P>
          - Os dados tratados são pessoais e de saúde. Estão protegidos pelo sigilo profissional (Código de Ética Médica) e pela Lei Geral de Proteção de Dados (LGPD).
          <br />
          - É proibido copiar, fotografar, exportar ou divulgar dados de pacientes para finalidades diferentes da assistência e da gestão do serviço.
          <br />
          - Prescrições impressas devem ser tratadas como documentos do prontuário.
        </P>

        <H>5. Credenciais e segurança</H>
        <P>
          - A senha é pessoal e intransferível. É proibido compartilhar login.
          <br />
          - Encerre a sessão ao deixar um computador compartilhado.
          <br />
          - Comunique imediatamente à equipe de suporte qualquer suspeita de acesso indevido.
        </P>

        <H>6. Registros e auditoria</H>
        <P>
          - As ações realizadas no sistema (quem fez, quando e o quê) são registradas para auditoria e segurança.
          <br />
          - O aceite deste termo também é registrado, com a versão e a data.
        </P>

        <H>7. Responsabilidades do usuário</H>
        <P>
          - Manter os dados corretos e atualizados.
          <br />
          - Não inserir informações falsas ou enganosas.
          <br />
          - Corrigir registros errados, em vez de deixá-los como estão.
        </P>

        <H>8. Disponibilidade do serviço</H>
        <P>
          - O sistema pode ficar indisponível por manutenção, atualização ou falha técnica, sem garantia de funcionamento contínuo.
          <br />
          - Durante a indisponibilidade, o registro segue pelo meio habitual do serviço, até o sistema voltar.
        </P>

        <H>9. Alterações nos termos</H>
        <P>
          - Este termo pode ser atualizado para refletir mudanças no sistema ou na legislação.
          <br />
          - Quando houver mudança relevante, será pedido novo aceite antes de continuar o uso.
        </P>

        <H>10. Responsáveis e contato</H>
        <P>
          - O NEFRO-UFTM é mantido pela equipe de Nefrologia do HC-UFTM, com desenvolvimento de Frederico Rodrigues da Cunha Pereira.
          <br />
          - Para dúvidas, sugestões ou relato de problemas: [E-MAIL DE SUPORTE — a definir].
        </P>

        <H>11. Legislação aplicável</H>
        <P>
          - Aplica-se a legislação brasileira, em especial a LGPD (Lei nº 13.709/2018) e as normas do Conselho Federal de Medicina.
          <br />
          - Fica eleito o foro competente conforme a legislação aplicável.
        </P>

        <div className="flex justify-center mt-10 pb-10">
          <Link href="/dashboard" className="px-6 py-4 rounded-lg text-lg font-medium shadow-md text-white" style={{ background: '#1e3a5f' }}>
            Voltar ao painel
          </Link>
        </div>
      </div>
    </div>
  );
}
