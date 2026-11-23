-- ============================================================
-- NEFRO-UFTM — Migration: nova hierarquia de setores
-- (3 grandes grupos: UTIs, Enfermarias, Pronto-Socorro)
-- Rodar no SQL Editor do Supabase, DEPOIS do schema.sql original.
-- Não derruba dados existentes.
-- ============================================================

-- Remove a constraint antiga de setor
alter table public.internacoes drop constraint if exists internacoes_setor_check;

-- Recria com a lista atualizada (Setor, conforme types/database.ts)
alter table public.internacoes add constraint internacoes_setor_check
  check (setor in (
    'UTI_Geral', 'UTI_2', 'UTI_Coronariana', 'UTI_Neo',
    'Clinica_Medica', 'Clinica_Cirurgica', 'Ortopedia', 'GO',
    'Pediatria', 'Onco_Hemato', 'UDIP', 'RPA', 'Pronto_Socorro'
  ));

-- Nota: se você já tinha internações cadastradas com os valores antigos
-- removidos (Cirurgia_Geral, Neurologia, PS_Pediatrico, UTR, Bercario,
-- Enfermarias_PS), a constraint vai REJEITAR qualquer UPDATE futuro
-- nessas linhas até corrigir o valor de "setor" manualmente. Para
-- corrigir uma linha específica:
--
-- update public.internacoes set setor = 'Clinica_Medica' where id = 'UUID-AQUI';
