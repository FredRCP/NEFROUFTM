-- ============================================================
-- NEFRO-UFTM — Schema inicial (Fase 1: MVP núcleo operacional)
-- Conforme folhao-digital-spec.md v1.2
-- Rodar no SQL Editor do Supabase (projeto em região São Paulo)
-- ============================================================

-- ------------------------------------------------------------
-- LIMPEZA (idempotente) — permite re-rodar o script do zero
-- mesmo que uma execução anterior tenha parado no meio.
-- Seguro: este projeto ainda não tem dados em produção.
-- ------------------------------------------------------------
drop table if exists public.auditoria cascade;
drop table if exists public.evolucoes cascade;
drop table if exists public.pendencias cascade;
drop table if exists public.acompanhamentos_nefro cascade;
drop table if exists public.internacoes cascade;
drop table if exists public.pacientes cascade;
drop table if exists public.medicos cascade;
drop function if exists public.is_medico_ativo() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.set_acompanhamento_timestamps() cascade;

-- ------------------------------------------------------------
-- EXTENSÕES
-- ------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm; -- necessária para gin_trgm_ops (busca textual)

-- ------------------------------------------------------------
-- TABELA: medicos
-- Vincula o usuário autenticado (auth.users) ao grupo nefrologia.
-- Existir uma linha aqui = ter acesso ao sistema (base do RLS).
-- ------------------------------------------------------------
create table public.medicos (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  crm text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.medicos is 'Equipe de 7 nefrologistas com acesso ao sistema. Existir aqui = ter acesso (base do RLS).';

-- ------------------------------------------------------------
-- TABELA: pacientes
-- Entidade permanente. RG hospitalar é chave única de identificação.
-- ------------------------------------------------------------
create table public.pacientes (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  rg_hospitalar text not null unique,
  data_nascimento date,
  sexo text check (sexo in ('M', 'F')),

  -- Comorbidades (multi-select via array)
  comorbidades text[] default '{}',
  -- valores esperados: DM, HAS, AVC, HIV, Hepatopatia, DPOC, ICC, ICO,
  -- DAC, Fibrilacao_atrial, Cirrose, Doenca_autoimune, Neoplasia,
  -- Transplante_renal, Transplante_hepatico

  etiologia_drc text check (etiologia_drc in (
    'Nefropatia_diabetica', 'Nefroesclerose_hipertensiva', 'DRPAD',
    'Glomerulopatia', 'Nefrite_tubulo_intersticial', 'Obstrutiva',
    'Indeterminada', 'Outras'
  )),

  -- Creatinina basal estruturada (Seção 4.1)
  creatinina_basal numeric(4,2),
  data_creatinina_basal date,
  fonte_creatinina_basal text check (fonte_creatinina_basal in (
    'Ambulatorio', 'Internacao_anterior', 'Laboratorio_externo', 'Estimada'
  )),

  observacoes_gerais text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pacientes is 'Entidade permanente do paciente. RG hospitalar (rg_hospitalar) é chave única — reinternação reativa a mesma ficha.';
comment on column public.pacientes.rg_hospitalar is 'Identificador único e estável. Verificação de duplicidade obrigatória no cadastro (Seção 3.1).';

create index idx_pacientes_rg on public.pacientes(rg_hospitalar);
create index idx_pacientes_nome on public.pacientes using gin (nome gin_trgm_ops);

-- ------------------------------------------------------------
-- TABELA: internacoes
-- Cada passagem do paciente pelo hospital.
-- ------------------------------------------------------------
create table public.internacoes (
  id uuid primary key default uuid_generate_v4(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,

  data_admissao date not null,
  setor text not null check (setor in (
    'UTI_Geral', 'UTI_2', 'UTI_Coronariana', 'UTI_Neo',
    'Pronto_Socorro', 'Enfermarias_PS', 'Clinica_Medica',
    'Cirurgia_Geral', 'Ortopedia', 'GO', 'Pediatria',
    'Onco_Hemato', 'Neurologia', 'UDIP', 'PS_Pediatrico',
    'UTR', 'RPA', 'Bercario'
  )),
  enfermaria_leito text, -- granularidade de enfermaria (ex: "105"), não sub-leito

  status text not null default 'internado' check (status in ('internado', 'alta', 'obito')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.internacoes is 'Cada passagem do paciente pelo hospital. Setor/leito é sobrescrito ao mudar — sem histórico de movimentação (Seção 4.2).';

create index idx_internacoes_paciente on public.internacoes(paciente_id);
create index idx_internacoes_status on public.internacoes(status);

-- ------------------------------------------------------------
-- TABELA: acompanhamentos_nefro
-- Relação entre internação e equipe de nefrologia.
-- Esta é a tabela "viva" central do dashboard.
-- ------------------------------------------------------------
create table public.acompanhamentos_nefro (
  id uuid primary key default uuid_generate_v4(),
  internacao_id uuid not null references public.internacoes(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade, -- desnormalizado para facilitar query/histórico

  data_interconsulta date not null default current_date,
  motivo_interconsulta text,

  diagnostico_principal text check (diagnostico_principal in ('IRA', 'DRC_D', 'IRA_sobre_DRC')),
  etiologia text check (etiologia in (
    'Sepse', 'Hipovolemia', 'NTA', 'Obstrucao', 'Glomerulonefrite',
    'Sindrome_hepatorrenal', 'Cardiorrenal', 'Outras'
  )),

  data_inicio_lra date, -- opcional (Seção 4.1 / item 7 Chatiane)

  tags text[] default '{}',

  prioridade text check (prioridade in ('Baixa', 'Media', 'Alta')), -- definida manualmente pelo médico

  situacao_dialitica text not null default 'sem_hd_programada' check (situacao_dialitica in (
    'hd_hoje', 'hd_amanha', 'sem_hd_programada'
  )),

  necessita_discussao boolean not null default false,

  -- Status de avaliação do dia (marcação explícita, nunca inferida)
  avaliado_hoje boolean not null default false,
  data_ultima_avaliacao date, -- reseta a lógica de "hoje" é feita na aplicação

  -- Dois timestamps distintos (Seção 4.3 / item 8 Chatiane-Gemini)
  ultima_atualizacao timestamptz not null default now(), -- qualquer edição
  ultima_avaliacao_medica timestamptz, -- só quando avaliado_hoje é marcado

  -- Ciclo de vida / saída (Seção 3.2)
  ativo boolean not null default true,
  motivo_alta text check (motivo_alta in (
    'Alta_hospitalar', 'Alta_da_nefrologia', 'Transferencia', 'Obito'
  )),
  desfecho_renal text check (desfecho_renal in (
    'Recuperacao_completa', 'Recuperacao_parcial', 'Dependente_de_dialise',
    'Evolucao_para_DRC', 'Obito'
  )),
  data_saida date,

  criado_por uuid references public.medicos(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.acompanhamentos_nefro is 'Tabela central viva do dashboard. ~20-30 linhas ativas por vez (ativo=true). Histórico completo preservado mesmo após ativo=false.';
comment on column public.acompanhamentos_nefro.avaliado_hoje is 'Marcação EXPLÍCITA pelo médico — nunca inferida por edição de outros campos (Seção 4.3).';
comment on column public.acompanhamentos_nefro.ultima_atualizacao is 'Atualizado por trigger a cada UPDATE em qualquer campo.';
comment on column public.acompanhamentos_nefro.ultima_avaliacao_medica is 'Atualizado APENAS quando avaliado_hoje passa a true. Distinto de ultima_atualizacao (Seção 4.3).';

create index idx_acomp_ativo on public.acompanhamentos_nefro(ativo);
create index idx_acomp_internacao on public.acompanhamentos_nefro(internacao_id);
create index idx_acomp_paciente on public.acompanhamentos_nefro(paciente_id);
create index idx_acomp_situacao_dialitica on public.acompanhamentos_nefro(situacao_dialitica);
create index idx_acomp_avaliado_hoje on public.acompanhamentos_nefro(avaliado_hoje);
create index idx_acomp_tags on public.acompanhamentos_nefro using gin(tags);

-- ------------------------------------------------------------
-- TABELA: pendencias
-- Efêmeras: somem quando resolvidas (delete real, não soft-delete).
-- ------------------------------------------------------------
create table public.pendencias (
  id uuid primary key default uuid_generate_v4(),
  acompanhamento_id uuid not null references public.acompanhamentos_nefro(id) on delete cascade,
  descricao text not null,
  criado_por uuid references public.medicos(id),
  created_at timestamptz not null default now()
);

comment on table public.pendencias is 'Lista de pendências para quem assume o plantão. Resolvida = DELETE da linha (não soft delete). Resolução é documentada em texto na evolução, não aqui.';

create index idx_pendencias_acomp on public.pendencias(acompanhamento_id);

-- ------------------------------------------------------------
-- TABELA: evolucoes
-- Múltiplas entradas por dia permitidas. Só autor edita/exclui a própria.
-- ------------------------------------------------------------
create table public.evolucoes (
  id uuid primary key default uuid_generate_v4(),
  acompanhamento_id uuid not null references public.acompanhamentos_nefro(id) on delete cascade,
  autor_id uuid not null references public.medicos(id),
  texto text not null,
  conduta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.evolucoes is 'Múltiplas evoluções por dia permitidas (intercorrências). Edição/exclusão restrita ao autor original (Seção 4.4) — aplicado via RLS.';

create index idx_evolucoes_acomp on public.evolucoes(acompanhamento_id, created_at desc);

-- ------------------------------------------------------------
-- TABELA: auditoria
-- Log de alterações relevantes (quem, o quê, quando).
-- ------------------------------------------------------------
create table public.auditoria (
  id uuid primary key default uuid_generate_v4(),
  tabela text not null,
  registro_id uuid not null,
  acao text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  autor_id uuid references public.medicos(id),
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz not null default now()
);

comment on table public.auditoria is 'Log de auditoria — quem editou, o quê, quando (requisito de rastreabilidade legal/clínica, Seção 6).';

create index idx_auditoria_registro on public.auditoria(tabela, registro_id);
create index idx_auditoria_autor on public.auditoria(autor_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Atualiza updated_at / ultima_atualizacao automaticamente
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_pacientes_updated_at before update on public.pacientes
  for each row execute function public.set_updated_at();

create trigger trg_internacoes_updated_at before update on public.internacoes
  for each row execute function public.set_updated_at();

create trigger trg_evolucoes_updated_at before update on public.evolucoes
  for each row execute function public.set_updated_at();

-- acompanhamentos_nefro tem lógica especial: ultima_atualizacao sempre muda,
-- mas ultima_avaliacao_medica só muda quando avaliado_hoje vira true
create or replace function public.set_acompanhamento_timestamps()
returns trigger as $$
begin
  new.updated_at = now();
  new.ultima_atualizacao = now();

  if new.avaliado_hoje = true and (old.avaliado_hoje = false or old.avaliado_hoje is null) then
    new.ultima_avaliacao_medica = now();
    new.data_ultima_avaliacao = current_date;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_acomp_timestamps before update on public.acompanhamentos_nefro
  for each row execute function public.set_acompanhamento_timestamps();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Política simples: usuário precisa existir em public.medicos
-- e estar ativo. Sem segmentação por "paciente meu vs. de outro".
-- ============================================================

alter table public.medicos enable row level security;
alter table public.pacientes enable row level security;
alter table public.internacoes enable row level security;
alter table public.acompanhamentos_nefro enable row level security;
alter table public.pendencias enable row level security;
alter table public.evolucoes enable row level security;
alter table public.auditoria enable row level security;

-- Helper: função que checa se o usuário autenticado é médico ativo
create or replace function public.is_medico_ativo()
returns boolean as $$
  select exists (
    select 1 from public.medicos
    where id = auth.uid() and ativo = true
  );
$$ language sql security definer stable;

-- medicos: qualquer médico ativo pode ver a lista da equipe (não editar outros)
create policy "medicos_select" on public.medicos
  for select using (public.is_medico_ativo());
create policy "medicos_update_self" on public.medicos
  for update using (id = auth.uid());

-- pacientes: leitura/escrita liberada para qualquer médico ativo
create policy "pacientes_all" on public.pacientes
  for all using (public.is_medico_ativo()) with check (public.is_medico_ativo());

-- internacoes: idem
create policy "internacoes_all" on public.internacoes
  for all using (public.is_medico_ativo()) with check (public.is_medico_ativo());

-- acompanhamentos_nefro: idem
create policy "acompanhamentos_all" on public.acompanhamentos_nefro
  for all using (public.is_medico_ativo()) with check (public.is_medico_ativo());

-- pendencias: idem
create policy "pendencias_all" on public.pendencias
  for all using (public.is_medico_ativo()) with check (public.is_medico_ativo());

-- evolucoes: leitura liberada para todos os médicos ativos;
-- edição/exclusão restrita ao autor original (Seção 4.4)
create policy "evolucoes_select" on public.evolucoes
  for select using (public.is_medico_ativo());
create policy "evolucoes_insert" on public.evolucoes
  for insert with check (public.is_medico_ativo() and autor_id = auth.uid());
create policy "evolucoes_update_own" on public.evolucoes
  for update using (autor_id = auth.uid());
create policy "evolucoes_delete_own" on public.evolucoes
  for delete using (autor_id = auth.uid());

-- auditoria: somente leitura para médicos ativos; inserção via trigger/service role
create policy "auditoria_select" on public.auditoria
  for select using (public.is_medico_ativo());

-- (extensões já criadas no topo do arquivo: uuid-ossp, pg_trgm)
