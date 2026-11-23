import type { DadosImpressao, LinhasPrescricao } from "./tipos";
import { gerarLinhasHD } from "./imprimirHD";
import { gerarLinhasCVVHDF } from "./imprimirCVVHDF";
import { gerarLinhasDP } from "./imprimirDP";
import { gerarLinhasTPE } from "./imprimirTPE";

interface MedicoImpressao {
  nome: string;
  titulo?: string | null;
  crm?: string | null;
}

/**
 * Monta os dados de impressão a partir dos dados salvos de uma prescrição.
 * Usado tanto para a prescrição atual quanto para qualquer prescrição salva,
 * então a folha impressa sempre traz todos os parâmetros gravados.
 */
export function montarDadosImpressao(
  modalidade: string,
  paciente: Record<string, string>,
  prescricao: Record<string, string>,
  medico: MedicoImpressao | null | undefined,
  data: Date = new Date()
): DadosImpressao {
  const pesoNum = parseFloat((paciente.peso ?? "").replace(",", "."));
  const pesoVal = isNaN(pesoNum) ? null : pesoNum;

  const linhas: LinhasPrescricao[] =
    modalidade === "HD" ? gerarLinhasHD(prescricao)
    : modalidade === "CVVHDF" ? gerarLinhasCVVHDF(prescricao, pesoVal)
    : modalidade === "DP" ? gerarLinhasDP(prescricao, pesoVal)
    : gerarLinhasTPE(prescricao, pesoVal);

  const acessoBase = modalidade === "DP" ? "Cateter Tenckhoff" : paciente.acesso;
  const acesso = [acessoBase, modalidade === "DP" ? "" : paciente.acessoLado]
    .filter(Boolean)
    .join(" — ");

  return {
    nomePaciente: paciente.nome || "",
    rg: paciente.rgHospitalar || "",
    leito: paciente.leito || "",
    diagnostico: paciente.diagnostico || "",
    idade: paciente.idade || "",
    acesso,
    dataHoje: data.toLocaleDateString("pt-BR"),
    hora: data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    nomeMedico: medico?.nome ?? null,
    titulo: medico?.titulo ?? null,
    crm: medico?.crm ?? null,
    linhas,
  };
}
