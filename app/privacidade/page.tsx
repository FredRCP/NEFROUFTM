import Link from 'next/link';
import type { ReactNode } from 'react';
import { DATA_ATUALIZACAO } from '@/lib/termos';

export const metadata = { title: 'Política de Privacidade · NEFRO-UFTM' };

const H = ({ children }: { children: ReactNode }) => (
  <h3 className="text-lg font-semibold mt-6 mb-2" style={{ color: '#1e3a5f' }}>{children}</h3>
);
const P = ({ children }: { children: ReactNode }) => (
  <p className="text-base mb-4" style={{ color: 'var(--text)' }}>{children}</p>
);

export default function PoliticaPrivacidade() {
  return (
    <div className="flex justify-center p-2" style={{ background: 'linear-gradient(to bottom, var(--bg), var(--card2))' }}>
      <div className="w-full max-w-4xl p-8 rounded-lg shadow-lg mx-auto" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <h2 className="text-2xl font-semibold mb-6 text-center" style={{ color: 'var(--text)' }}>Política de Privacidade</h2>
        <p className="text-sm italic mb-4" style={{ color: 'var(--text2)' }}>Última atualização: {DATA_ATUALIZACAO}</p>

        <P>
          Esta política explica como o <strong>NEFRO-UFTM</strong> trata dados pessoais e de saúde. O sistema é usado pela equipe de Nefrologia do Hospital de Clínicas da UFTM e segue a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).
        </P>

        <H>1. Dados tratados</H>
        <P>
          <strong>De pacientes:</strong> nome, RG hospitalar, data de nascimento, sexo, leito, diagnósticos, comorbidades, exames laboratoriais, prescrições de terapia renal substitutiva, evoluções clínicas e registros de diurese.
          São dados pessoais sensíveis, por se tratarem de informações de saúde.
          <br /><br />
          <strong>Dos profissionais:</strong> nome, CRM, e-mail de acesso, registros das ações no sistema e registro do aceite destes termos.
          <br /><br />
          <strong>No seu navegador:</strong> apenas o necessário para manter a sessão de login.
        </P>

        <H>2. Finalidade e base legal</H>
        <P>
          Os dados de pacientes são usados exclusivamente para a assistência à saúde e a gestão do serviço de nefrologia, com base na tutela da saúde (art. 11, inciso II, alínea "f", da LGPD).
          Os dados dos profissionais são usados para acesso, segurança e auditoria do sistema.
        </P>

        <H>3. Compartilhamento</H>
        <P>
          Não há compartilhamento de dados para fins comerciais ou publicidade. Os dados são processados pelo provedor de banco de dados e autenticação contratado para o sistema, em nome do serviço.
          Região de armazenamento: [REGIÃO DE HOSPEDAGEM — a confirmar].
          Dados podem ser compartilhados com autoridades públicas quando a lei ou ordem judicial exigir.
        </P>

        <H>4. Armazenamento e segurança</H>
        <P>
          - Os dados trafegam por conexão criptografada (HTTPS).
          <br />
          - O acesso é feito por login individual. As regras do banco de dados limitam cada usuário aos seus próprios registros de escrita.
          <br />
          - As ações são registradas para auditoria.
          <br />
          - Os dados são mantidos pelo prazo legal de guarda do prontuário médico.
        </P>

        <H>4.1 Incidentes de segurança</H>
        <P>
          Nenhum sistema está completamente isento de riscos. Em caso de incidente que possa causar risco ou dano relevante aos titulares, serão adotadas as medidas exigidas pela legislação, incluindo a comunicação à Autoridade Nacional de Proteção de Dados e aos titulares, quando necessário.
        </P>

        <H>5. Direitos do titular</H>
        <P>
          Pacientes e profissionais podem pedir confirmação do tratamento, acesso, correção de dados incompletos ou desatualizados, informações sobre o compartilhamento e demais direitos previstos no art. 18 da LGPD.
          Para pacientes, o pedido pode ser feito pelo Serviço de Informação ao Cidadão do HC-UFTM. Para profissionais, pelo canal do encarregado abaixo.
        </P>

        <H>6. Armazenamento do navegador</H>
        <P>
          O sistema usa armazenamento técnico do navegador para manter a sessão de login e o funcionamento do aplicativo. Não são usados cookies de publicidade nem de rastreamento entre sites.
        </P>

        <H>7. Alterações nesta política</H>
        <P>
          A versão atual está sempre disponível nesta página. Quando houver mudança relevante, será pedido novo aceite antes de continuar o uso.
        </P>

        <H>8. Controlador e encarregado</H>
        <P>
          Controlador: Hospital de Clínicas da Universidade Federal do Triângulo Mineiro (HC-UFTM/EBSERH), Uberaba (MG).
          <br />
          Encarregado (DPO): [NOME DO ENCARREGADO] · [E-MAIL DO ENCARREGADO — a definir].
        </P>

        <H>9. Bases legais</H>
        <P>
          O tratamento se apoia nas bases legais do art. 7º e do art. 11 da LGPD, em especial:
          <br />
          - tutela da saúde, por profissionais de saúde (art. 11, II, "f");
          <br />
          - cumprimento de obrigação legal ou regulatória, como a guarda do prontuário;
          <br />
          - legítimo interesse, para segurança e auditoria do sistema.
        </P>

        <div className="flex justify-center mt-8 pb-16">
          <Link href="/dashboard" className="px-4 py-2 rounded text-base text-center text-white" style={{ background: '#1e3a5f' }}>
            Voltar ao painel
          </Link>
        </div>
      </div>
    </div>
  );
}
