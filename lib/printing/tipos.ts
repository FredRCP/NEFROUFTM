// Linha da tabela de prescrição
export interface LinhasPrescricao {
  label: string;
  valor: string;
  destaque?: boolean; // primeira linha (modalidade) aparece em negrito
}

// Dados do paciente para impressão
export interface DadosImpressao {
  nomePaciente: string;
  rg: string;
  leito: string;
  diagnostico?: string;
  idade?: string;
  acesso?: string;
  dataHoje: string;
  hora: string;
  nomeMedico?: string | null;
  crm?: string | null;
  titulo?: string | null;
  linhas: LinhasPrescricao[];
}
