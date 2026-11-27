import { DATA_ATUALIZACAO } from "@/lib/termos";
import { LegalLayout, Lista, Secao } from "@/components/LegalLayout";

export const metadata = { title: "Política de Privacidade · NEFRO-UFTM" };

export default function PoliticaPrivacidade() {
  return (
    <LegalLayout titulo="Política de Privacidade" atualizacao={DATA_ATUALIZACAO}>
      <p className="text-[15px] leading-relaxed" style={{ color: "#1f2937" }}>
        Esta política explica como o <strong>NEFRO-UFTM</strong> trata dados pessoais e de saúde. O sistema é usado pela
        equipe de Nefrologia do Hospital de Clínicas da UFTM e segue a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).
      </p>

      <Secao titulo="1. Dados tratados">
        <Lista itens={[
          <><strong>De pacientes:</strong> nome, RG hospitalar, data de nascimento, sexo, leito, diagnósticos, comorbidades, exames laboratoriais, prescrições de terapia renal substitutiva, evoluções clínicas e registros de diurese. São dados pessoais sensíveis, por se tratarem de informações de saúde.</>,
          <><strong>Dos profissionais:</strong> nome, CRM, e-mail de acesso, registros das ações no sistema e registro do aceite destes termos.</>,
          <><strong>No seu navegador:</strong> apenas o necessário para manter a sessão de login.</>,
        ]} />
      </Secao>

      <Secao titulo="2. Finalidade e base legal">
        <p>
          Os dados de pacientes são usados exclusivamente para a assistência à saúde e a gestão do serviço de nefrologia,
          com base na tutela da saúde (art. 11, inciso II, alínea “f”, da LGPD). Os dados dos profissionais são usados
          para acesso, segurança e auditoria do sistema.
        </p>
      </Secao>

      <Secao titulo="3. Compartilhamento">
        <p>
          Não há compartilhamento de dados para fins comerciais ou publicidade. Os dados são processados pelo provedor de
          banco de dados e autenticação contratado para o sistema, em nome do serviço.
        </p>
        <p>Região de armazenamento: [REGIÃO DE HOSPEDAGEM — a confirmar].</p>
        <p>Dados podem ser compartilhados com autoridades públicas quando a lei ou ordem judicial exigir.</p>
      </Secao>

      <Secao titulo="4. Armazenamento e segurança">
        <Lista itens={[
          "Os dados trafegam por conexão criptografada (HTTPS).",
          "O acesso é feito por login individual. As regras do banco de dados limitam cada usuário aos seus próprios registros de escrita.",
          "As ações são registradas para auditoria.",
          "Os dados são mantidos pelo prazo legal de guarda do prontuário médico.",
        ]} />
      </Secao>

      <Secao titulo="4.1 Incidentes de segurança">
        <p>
          Nenhum sistema está completamente isento de riscos. Em caso de incidente que possa causar risco ou dano
          relevante aos titulares, serão adotadas as medidas exigidas pela legislação, incluindo a comunicação à
          Autoridade Nacional de Proteção de Dados e aos titulares, quando necessário.
        </p>
      </Secao>

      <Secao titulo="5. Direitos do titular">
        <p>
          Pacientes e profissionais podem pedir confirmação do tratamento, acesso, correção de dados incompletos ou
          desatualizados, informações sobre o compartilhamento e demais direitos previstos no art. 18 da LGPD.
        </p>
        <p>
          Para pacientes, o pedido pode ser feito pelo Serviço de Informação ao Cidadão do HC-UFTM. Para profissionais,
          pelo canal do encarregado abaixo.
        </p>
      </Secao>

      <Secao titulo="6. Armazenamento do navegador">
        <p>
          O sistema usa armazenamento técnico do navegador para manter a sessão de login e o funcionamento do aplicativo.
          Não são usados cookies de publicidade nem de rastreamento entre sites.
        </p>
      </Secao>

      <Secao titulo="7. Alterações nesta política">
        <p>
          A versão atual está sempre disponível nesta página. Quando houver mudança relevante, será pedido novo aceite
          antes de continuar o uso.
        </p>
      </Secao>

      <Secao titulo="8. Controlador e encarregado">
        <p>
          Controlador: Hospital de Clínicas da Universidade Federal do Triângulo Mineiro (HC-UFTM/EBSERH), Uberaba (MG).
        </p>
        <p>Encarregado (DPO): [NOME DO ENCARREGADO] · [E-MAIL DO ENCARREGADO — a definir].</p>
      </Secao>

      <Secao titulo="9. Bases legais">
        <p>O tratamento se apoia nas bases legais do art. 7º e do art. 11 da LGPD, em especial:</p>
        <Lista itens={[
          "tutela da saúde, por profissionais de saúde (art. 11, II, “f”);",
          "cumprimento de obrigação legal ou regulatória, como a guarda do prontuário;",
          "legítimo interesse, para segurança e auditoria do sistema.",
        ]} />
      </Secao>
    </LegalLayout>
  );
}
