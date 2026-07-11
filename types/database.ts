// Tipos derivados de schema.sql — manter sincronizado com o banco.
// Em uma fase futura, considerar gerar automaticamente via
// `supabase gen types typescript`.

/** Os 3 grandes grupos fixos do dashboard. */
export type GrandeGrupo = "UTIs" | "Enfermarias" | "Pronto_Socorro";

export const GRANDES_GRUPOS: { value: GrandeGrupo; label: string }[] = [
  { value: "Pronto_Socorro", label: "Pronto-Socorro" },
  { value: "UTIs", label: "UTIs" },
  { value: "Enfermarias", label: "Enfermarias" },
];

export type Setor =
  | "Clinica_Cirurgica"
  | "Clinica_Medica"
  | "GO"
  | "Neuro"
  | "Onco_Hemato"
  | "Ortopedia"
  | "Pediatria"
  | "Pronto_Socorro"
  | "RPA"
  | "UDIP"
  | "UTI_2"
  | "UTI_Coronariana"
  | "UTI_Geral"
  | "UTI_Neo"
  | "UTR";

export const SETORES: { value: Setor; label: string; grupo: GrandeGrupo }[] = [
  { value: "Clinica_Cirurgica",  label: "Clínica Cirúrgica",  grupo: "Enfermarias"   },
  { value: "Clinica_Medica",     label: "Clínica Médica",     grupo: "Enfermarias"   },
  { value: "GO",                 label: "GO",                  grupo: "Enfermarias"   },
  { value: "Neuro",              label: "Neurologia",          grupo: "Enfermarias"   },
  { value: "Onco_Hemato",        label: "Onco-Hemato",         grupo: "Enfermarias"   },
  { value: "Ortopedia",          label: "Ortopedia",           grupo: "Enfermarias"   },
  { value: "Pediatria",          label: "Pediatria",           grupo: "Enfermarias"   },
  { value: "Pronto_Socorro",     label: "Pronto-Socorro",      grupo: "Pronto_Socorro"},
  { value: "RPA",                label: "RPA",                 grupo: "Enfermarias"   },
  { value: "UDIP",               label: "UDIP",                grupo: "Enfermarias"   },
  { value: "UTI_2",              label: "UTI 2 / Neuro",       grupo: "UTIs"          },
  { value: "UTI_Coronariana",    label: "UTI Coronariana",     grupo: "UTIs"          },
  { value: "UTI_Geral",          label: "UTI Geral",           grupo: "UTIs"          },
  { value: "UTI_Neo",            label: "UTI Neo",             grupo: "UTIs"          },
  { value: "UTR",                label: "UTR",                 grupo: "Enfermarias"   },
];

export function getGrupoBySetor(setor: string): GrandeGrupo {
  return SETORES.find((s) => s.value === setor)?.grupo ?? "Enfermarias";
}

export interface LeitoCatalogo {
  numero: string;
  setor: Setor;
}

export const CATALOGO_LEITOS: LeitoCatalogo[] = [
  // ── UTI Geral: 224, 227, 229 ─────────────────────────────────────────────
  { numero: "224", setor: "UTI_Geral" },
  { numero: "227", setor: "UTI_Geral" },
  { numero: "229", setor: "UTI_Geral" },

  // ── UTI Coronariana: 225, 226, 231 ───────────────────────────────────────
  { numero: "225", setor: "UTI_Coronariana" },
  { numero: "226", setor: "UTI_Coronariana" },
  { numero: "231", setor: "UTI_Coronariana" },

  // ── UTI 2 / Neuro: 206, 207, 208 ─────────────────────────────────────────
  { numero: "206", setor: "UTI_2" },
  { numero: "207", setor: "UTI_2" },
  { numero: "208", setor: "UTI_2" },

  // ── UTI Neo ───────────────────────────────────────────────────────────────
  { numero: "UTI Neo", setor: "UTI_Neo" },

  // ── UTR ───────────────────────────────────────────────────────────────────
  { numero: "UTR", setor: "UTR" },

  // ── Clínica Médica: 300-307 ───────────────────────────────────────────────
  ...["300", "301", "302", "303", "304", "305", "306", "307"].map((n) => ({
    numero: n,
    setor: "Clinica_Medica" as Setor,
  })),

  // ── Clínica Cirúrgica: 308-316 ────────────────────────────────────────────
  ...Array.from({ length: 9 }, (_, i) => String(308 + i)).map((n) => ({
    numero: n,
    setor: "Clinica_Cirurgica" as Setor,
  })),

  // ── Neurologia: 201-205 ───────────────────────────────────────────────────
  ...["201", "202", "203", "204", "205"].map((n) => ({
    numero: n,
    setor: "Neuro" as Setor,
  })),

  // ── Onco-Hemato: 200-A até 200-E ─────────────────────────────────────────
  ...["200-A", "200-B", "200-C", "200-D", "200-E"].map((n) => ({
    numero: n,
    setor: "Onco_Hemato" as Setor,
  })),

  // ── Pendentes de numeração definitiva ────────────────────────────────────
  { numero: "GO (a definir)",        setor: "GO"        },
  { numero: "Ortopedia (a definir)", setor: "Ortopedia" },
  { numero: "Pediatria (a definir)", setor: "Pediatria" },

  // ── Outros ───────────────────────────────────────────────────────────────
  { numero: "UDIP", setor: "UDIP" },
  { numero: "RPA",  setor: "RPA"  },

  // ── Pronto-Socorro ────────────────────────────────────────────────────────
  { numero: "Código / Sala Vermelha", setor: "Pronto_Socorro" },
  { numero: "Corredor",               setor: "Pronto_Socorro" },
  { numero: "100",                    setor: "Pronto_Socorro" },
  { numero: "105",                    setor: "Pronto_Socorro" },
  { numero: "107",                    setor: "Pronto_Socorro" },
  { numero: "108",                    setor: "Pronto_Socorro" },
  { numero: "109",                    setor: "Pronto_Socorro" },
];

/** Dado o número do leito escolhido, retorna o setor correspondente. */
export function getSetorByLeito(numeroLeito: string): Setor | undefined {
  return CATALOGO_LEITOS.find((l) => l.numero === numeroLeito)?.setor;
}

export type DiagnosticoPrincipal = "IRA" | "DRC_D" | "IRA_sobre_DRC";

export type Etiologia =
  | "Sepse" | "Hipovolemia" | "NTA" | "Obstrucao" | "Glomerulonefrite"
  | "Sindrome_hepatorrenal" | "Cardiorrenal" | "Outras";

export type SituacaoDialitica = "hd_hoje" | "hd_amanha" | "sem_hd_programada";

export type Comorbidade =
  | "DM" | "HAS" | "AVC" | "HIV" | "Hepatopatia" | "DPOC" | "ICC" | "ICO"
  | "DAC" | "Fibrilacao_atrial" | "Cirrose" | "Doenca_autoimune"
  | "Neoplasia" | "Transplante_renal" | "Transplante_hepatico";

export type EtiologiaDRC =
  | "Nefropatia_diabetica" | "Nefroesclerose_hipertensiva" | "DRPAD"
  | "Glomerulopatia" | "Nefrite_tubulo_intersticial" | "Obstrutiva"
  | "Indeterminada" | "Outras";

export interface Medico {
  id: string;
  nome: string;
  crm: string | null;
  titulo: "Dr" | "Dra" | null;
  ativo: boolean;
  created_at: string;
}

export interface Paciente {
  id: string;
  nome: string;
  rg_hospitalar: string;
  data_nascimento: string | null;
  sexo: "M" | "F" | null;
  comorbidades: Comorbidade[];
  etiologia_drc: EtiologiaDRC | null;
  creatinina_basal: number | null;
  data_creatinina_basal: string | null;
  fonte_creatinina_basal: "Ambulatorio" | "Internacao_anterior" | "Laboratorio_externo" | "Estimada" | null;
  observacoes_gerais: string | null;
  created_at: string;
  updated_at: string;
}

export interface Internacao {
  id: string;
  paciente_id: string;
  data_admissao: string;
  setor: Setor;
  enfermaria_leito: string | null;
  status: "internado" | "alta" | "obito";
  created_at: string;
  updated_at: string;
}

export interface AcompanhamentoNefro {
  id: string;
  internacao_id: string;
  paciente_id: string;
  data_interconsulta: string;
  motivo_interconsulta: string | null;
  diagnostico_principal: DiagnosticoPrincipal | null;
  etiologia: Etiologia | null;
  data_inicio_lra: string | null;
  tags: string[];
  prioridade: "Baixa" | "Media" | "Alta" | null;
  situacao_dialitica: SituacaoDialitica;
  necessita_discussao: boolean;
  avaliado_hoje: boolean;
  data_ultima_avaliacao: string | null;
  ultima_atualizacao: string;
  ultima_avaliacao_medica: string | null;
  ativo: boolean;
  motivo_alta: "Alta_hospitalar" | "Alta_da_nefrologia" | "Transferencia" | "Obito" | null;
  desfecho_renal: "Recuperacao_completa" | "Recuperacao_parcial" | "Dependente_de_dialise" | "Evolucao_para_DRC" | "Obito" | null;
  data_saida: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pendencia {
  id: string;
  acompanhamento_id: string;
  descricao: string;
  criado_por: string | null;
  created_at: string;
}

export interface Evolucao {
  id: string;
  acompanhamento_id: string;
  autor_id: string;
  texto: string;
  conduta: string | null;
  created_at: string;
  updated_at: string;
}

export interface PacienteCard {
  acompanhamento: AcompanhamentoNefro;
  paciente: Paciente;
  internacao: Internacao;
  pendencias: Pendencia[];
}

export interface Diurese {
  id: string;
  acompanhamento_id: string;
  data: string;
  volume_ml: number;
  criado_por: string | null;
  created_at: string;
}