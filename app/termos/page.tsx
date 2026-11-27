import { DATA_ATUALIZACAO } from "@/lib/termos";
import { LegalLayout, Lista, Secao } from "@/components/LegalLayout";

export const metadata = { title: "Termo de Uso · NEFRO-UFTM" };

export default function TermosDeUso() {
  return (
    <LegalLayout titulo="Termo de Uso do NEFRO-UFTM" atualizacao={DATA_ATUALIZACAO}>
      <p className="text-[15px] leading-relaxed" style={{ color: "#1f2937" }}>
        Bem-vindo ao <strong>NEFRO-UFTM</strong>, sistema de acompanhamento nefrológico do Hospital de Clínicas da
        Universidade Federal do Triângulo Mineiro (HC-UFTM). Este documento estabelece as condições para o uso da
        ferramenta. Leia atentamente antes de prosseguir.
      </p>

      <Secao titulo="1. Uso do NEFRO-UFTM">
        <Lista itens={[
          "O NEFRO-UFTM é uma ferramenta de apoio ao acompanhamento de pacientes da Nefrologia do HC-UFTM: lista de pacientes, evoluções, exames, diurese e prescrições de terapia renal substitutiva.",
          "O sistema organiza informações já registradas pela equipe e não realiza diagnóstico nem prescreve tratamentos.",
        ]} />
      </Secao>

      <Secao titulo="2. Natureza de apoio ao cuidado">
        <p>
          O NEFRO-UFTM apoia o cuidado, mas não substitui o prontuário oficial, a prescrição médica assinada nem o
          julgamento clínico do profissional. As informações devem ser conferidas na fonte antes de qualquer decisão.
        </p>
      </Secao>

      <Secao titulo="3. Requisitos para uso">
        <Lista itens={[
          "O uso é permitido apenas a profissionais de saúde da equipe de Nefrologia do HC-UFTM, autorizados pela chefia do serviço.",
          "O acesso é feito por credencial individual (e-mail e senha).",
          "Ao aceitar este termo, o profissional declara estar habilitado para o exercício da profissão.",
        ]} />
      </Secao>

      <Secao titulo="4. Dados de pacientes e sigilo">
        <Lista itens={[
          "Os dados tratados são pessoais e de saúde. Estão protegidos pelo sigilo profissional (Código de Ética Médica) e pela Lei Geral de Proteção de Dados (LGPD).",
          "É proibido copiar, fotografar, exportar ou divulgar dados de pacientes para finalidades diferentes da assistência e da gestão do serviço.",
          "Prescrições impressas devem ser tratadas como documentos do prontuário.",
        ]} />
      </Secao>

      <Secao titulo="5. Credenciais e segurança">
        <Lista itens={[
          "A senha é pessoal e intransferível. É proibido compartilhar login.",
          "Encerre a sessão ao deixar um computador compartilhado.",
          "Comunique imediatamente à equipe de suporte qualquer suspeita de acesso indevido.",
        ]} />
      </Secao>

      <Secao titulo="6. Registros e auditoria">
        <Lista itens={[
          "As ações realizadas no sistema (quem fez, quando e o quê) são registradas para auditoria e segurança.",
          "O aceite deste termo também é registrado, com a versão e a data.",
        ]} />
      </Secao>

      <Secao titulo="7. Responsabilidades do usuário">
        <Lista itens={[
          "Manter os dados corretos e atualizados.",
          "Não inserir informações falsas ou enganosas.",
          "Corrigir registros errados, em vez de deixá-los como estão.",
        ]} />
      </Secao>

      <Secao titulo="8. Disponibilidade do serviço">
        <Lista itens={[
          "O sistema pode ficar indisponível por manutenção, atualização ou falha técnica, sem garantia de funcionamento contínuo.",
          "Durante a indisponibilidade, o registro segue pelo meio habitual do serviço, até o sistema voltar.",
        ]} />
      </Secao>

      <Secao titulo="9. Alterações nos termos">
        <Lista itens={[
          "Este termo pode ser atualizado para refletir mudanças no sistema ou na legislação.",
          "Quando houver mudança relevante, será pedido novo aceite antes de continuar o uso.",
        ]} />
      </Secao>

      <Secao titulo="10. Responsáveis e contato">
        <Lista itens={[
          "O NEFRO-UFTM é mantido pela equipe de Nefrologia do HC-UFTM, com desenvolvimento de Frederico Rodrigues da Cunha Pereira.",
          "Para dúvidas, sugestões ou relato de problemas: [E-MAIL DE SUPORTE — a definir].",
        ]} />
      </Secao>

      <Secao titulo="11. Legislação aplicável">
        <Lista itens={[
          "Aplica-se a legislação brasileira, em especial a LGPD (Lei nº 13.709/2018) e as normas do Conselho Federal de Medicina.",
          "Fica eleito o foro competente conforme a legislação aplicável.",
        ]} />
      </Secao>
    </LegalLayout>
  );
}
